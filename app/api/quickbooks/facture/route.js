// app/api/quickbooks/facture/route.js
//
// VRAIE FACTURE QUICKBOOKS — pour TOUT ce qui se facture depuis
// l'onglet Facturation : appel de service, travaux sur devis (y compris
// facturation partielle), contrat d'entretien, temps et matériel,
// visite de retour avec pièce. Sandbox tant que la bascule production
// n'est pas faite.
//
// PAIEMENT EN LIGNE — RÈGLE VALIDÉE AVEC LE PROPRIÉTAIRE : pour ces
// factures-là, le choix est fait PAR FACTURE, à l'envoi, cases
// décochées par défaut (seuls les dépôts d'appels de service ont un
// chemin automatique — voir facture-depot). Les drapeaux arrivent donc
// du corps de la demande, décidés par un humain dans la fenêtre
// d'avant-envoi. Aucuns frais ajoutés au client, jamais (LPC Québec).
//
// NOTE SANDBOX : compagnie de test américaine — pas de TPS/TVQ ; la
// facture Sandbox porte les montants HT. Le fichier canadien réel
// appliquera ses codes de taxes à la bascule.

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  ecrireQbo,
  clientQboPour,
  articleServiceQboPour,
  envoyerFactureParQb,
  environnementQb, entrepriseDuCompte } from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  const clientNom = String(corps?.clientNom || "").trim();
  // Lignes = { description, montant } — les items réels de la révision
  // ou la portion facturée d'un devis. Le montant peut être négatif
  // (déduction de dépôt/pièce payée d'avance) mais le TOTAL doit être
  // positif : on n'émet pas une facture à zéro ou négative.
  //
  // 📝 LES LIGNES À 0 $ SONT GARDÉES (2026-08-24, demande du
  // propriétaire). Elles étaient JETÉES ICI, en silence : le bureau
  // écrivait au client ce qui avait été fait sur le chantier — pump
  // down, code erreur, pièce à commander — et le client recevait une
  // facture avec le seul montant, sans un mot d'explication. Personne
  // ne pouvait s'en rendre compte : l'écran, lui, montrait le texte.
  // Elles partent maintenant en LIGNES DE DESCRIPTION SEULEMENT, le
  // type prévu par QuickBooks pour du texte sans montant.
  //
  // 300 caractères, c'était court : les notes de chantier dépassent
  // couramment. QuickBooks accepte 4000 — on garde 2000, largement
  // assez, et la coupure devient improbable au lieu d'être la règle.
  const lignes = (Array.isArray(corps?.lignes) ? corps.lignes : [])
    .map((l) => ({ description: String(l?.description || "").slice(0, 2000), montant: Number(l?.montant) || 0 }))
    .filter((l) => l.description);
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  if (!clientNom || lignes.length === 0 || total <= 0) {
    return Response.json({ erreur: "Client et lignes (total positif) requis." }, { status: 400 });
  }

  let acces;
  try {
    acces = await jetonAccesValide(entrepriseId);
  } catch (e) {
    return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  try {
    const admin = clientSupabaseService();
    const [customerId, itemId] = await Promise.all([
      clientQboPour(acces, admin, { clientId: corps?.clientId || null, clientNom }),
      articleServiceQboPour(acces),
    ]);
    if (!customerId) return Response.json({ erreur: "Client QuickBooks introuvable et non créable." }, { status: 502 });
    if (!itemId) return Response.json({ erreur: "Aucun article de type Service dans ce fichier QuickBooks." }, { status: 502 });

    // Échéance : terme de paiement des Paramètres (ex. « Net 30 »).
    const joursTerme = (() => {
      const m = String(corps?.termePaiement || "").match(/(\d+)/);
      return m ? Math.min(120, Math.max(0, parseInt(m[1], 10))) : 30;
    })();
    const echeance = new Date(Date.now() + joursTerme * 24 * 60 * 60 * 1000);
    const dateLocale = `${echeance.getFullYear()}-${String(echeance.getMonth() + 1).padStart(2, "0")}-${String(echeance.getDate()).padStart(2, "0")}`;

    // Les adresses d'envoi — QuickBooks enverra SA facture officielle
    // à ces courriels tout de suite après la création.
    const envoyerA = (Array.isArray(corps?.envoyerA) ? corps.envoyerA : [])
      .map((e) => String(e || "").trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .slice(0, 5);

    // Une ligne SANS montant devient une ligne de description ; les
    // autres restent des lignes de vente normales.
    const ligneQbo = (l, texteSeulement) =>
      l.montant === 0 && !texteSeulement
        ? { DetailType: "DescriptionOnly", Description: l.description, DescriptionLineDetail: {} }
        : {
            DetailType: "SalesItemLineDetail",
            Amount: l.montant,
            Description: l.description,
            SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: l.montant },
          };

    const corpsFacture = async (texteSeulement) => ({
      CustomerRef: { value: customerId },
      DueDate: dateLocale,
      ...(envoyerA.length > 0 ? { BillEmail: { Address: envoyerA.join(", ") } } : {}),
      // Notre MESSAGE au client — il apparaît sur la facture et dans le
      // courriel QuickBooks (contexte : réservation, délai, référence).
      // 💳 Les MODALITÉS DE PAIEMENT de l'entreprise (Paramètres →
      // « Note et modalités de paiement » : chèque, virement Interac…)
      // s'ajoutent À CHAQUE facture, côté serveur — aucun appelant ne
      // peut les oublier (2026-08-17).
      ...(await (async () => {
        let note = "";
        try {
          // Scopé à L'ENTREPRISE DU DEMANDEUR (multi-QuickBooks
          // 2026-09-08) : .limit(1) sans filtre prenait la note de la
          // PREMIÈRE compagnie de la table.
          const { data } = await clientSupabaseService().from("entreprises").select("note_facture").eq("id", entrepriseId).maybeSingle();
          note = data?.note_facture || "";
        } catch {
          // note indisponible — la facture part sans, jamais bloquée
        }
        // 📜 TERMES ET CONDITIONS (2026-09-02, retour du propriétaire :
        // « les termes et conditions ne sont pas là ») — le texte complet
        // ne tient pas dans le mémo QuickBooks (900 caractères), alors
        // c'est le LIEN vers la page officielle qui part sur CHAQUE
        // facture, même patron que les courriels de dépôt. L'origine est
        // lue de la demande : fluxya.app en production, localhost en dev.
        let lienConditions = "";
        try {
          lienConditions = `Termes et conditions : ${new URL(request.url).origin}/conditions`;
        } catch {
          lienConditions = "Termes et conditions disponibles sur demande.";
        }
        const memo = [String(corps?.customerMemo || "").trim(), note.trim(), lienConditions].filter(Boolean).join("\n\n");
        return memo ? { CustomerMemo: { value: memo.slice(0, 900) } } : {};
      })()),
      // L'ADRESSE DES TRAVAUX — elle change à chaque job, donc elle vit
      // sur la FACTURE (champ livraison), pas sur la fiche client.
      ...(corps?.adresseTravaux ? { ShipAddr: { Line1: String(corps.adresseTravaux).slice(0, 500) } } : {}),
      PrivateNote: `Facture — ${corps?.reference || "travaux"} — créée par l'application Ventilation DGL`,
      // Choix HUMAIN fait à l'envoi (fenêtre d'avant-envoi) — jamais un
      // défaut silencieux pour ces factures.
      AllowOnlineCreditCardPayment: corps?.paiementCarte === true,
      AllowOnlineACHPayment: corps?.paiementVirement === true,
      Line: lignes.map((l) => ligneQbo(l, texteSeulement)),
    });

    // ⚠️ FILET : si QuickBooks refuse le type « description seulement »
    // (variante de compte, réglage particulier), on RÉÉMET la facture
    // avec ces lignes en montant 0 plutôt que de la perdre. Le client
    // verra « 0,00 $ » à côté du texte — moins joli, mais l'explication
    // se rend, et la facture part. Une facture bloquée coûte plus cher
    // qu'une ligne à zéro.
    let cree;
    try {
      cree = await ecrireQbo(acces, "invoice?include=invoiceLink", await corpsFacture(false));
    } catch (e) {
      if (!lignes.some((l) => l.montant === 0)) throw e;
      cree = await ecrireQbo(acces, "invoice?include=invoiceLink", await corpsFacture(true));
    }
    const facture = cree?.Invoice;

    // ENVOI PAR QUICKBOOKS + PREUVE — jamais « envoyé » sans l'avoir
    // relu dans le registre QuickBooks. En cas d'échec, la facture
    // existe quand même : l'application affichera l'alerte et le
    // bouton « Renvoyer ».
    let envoiQb = null;
    if (envoyerA.length > 0 && facture?.Id) {
      try {
        envoiQb = await envoyerFactureParQb(acces, facture.Id, envoyerA);
      } catch {
        envoiQb = { envoyee: false, envoyeeLe: null };
      }
    }

    return Response.json({
      creee: true,
      factureId: facture?.Id || null,
      docNumber: facture?.DocNumber || null,
      lienPaiement: facture?.InvoiceLink || null,
      envoiQb,
      environnement: acces.environnement,
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
