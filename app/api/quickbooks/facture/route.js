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
  requeteQbo,
  clientQboPour,
  articleServiceQboPour,
  codeTaxeVente,
  proprietesTaxe,
  envoyerFactureParQb,
  environnementQb, entrepriseDuCompte } from "@/lib/quickbooksServeur";
// 🔒 RLS phase 3 : le rôle vient de la table des permissions.
import { roleServeur } from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if ((await roleServeur(utilisateur)) === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  // ---------- ANNULATION PAR VOID, AVEC NOTE COMPTABLE ----------
  // Demande du propriétaire (2026-08-31) : annuler une facture depuis
  // Fluxya ET laisser une preuve dans QuickBooks. La note est ÉCRITE sur
  // la facture (mémo interne) AVANT le VOID : la comptable voit qui a
  // annulé, quand et pourquoi — jamais de Delete (règle gelée). AVANT la
  // validation client+lignes : une annulation n'a ni l'un ni l'autre.
  if (corps?.action === "void") {
    const factureId = String(corps?.factureId || "").replace(/[^0-9]/g, "");
    if (!factureId) return Response.json({ erreur: "factureId requis." }, { status: 400 });
    let acces;
    try {
      acces = await jetonAccesValide(entrepriseId);
    } catch (e) {
      return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
    }
    if (!acces) return Response.json({ nonConnecte: true });
    const note = String(corps?.note || "").trim().slice(0, 800);
    const par = String(utilisateur.user_metadata?.nom || utilisateur.email || "").trim();
    try {
      const lu = await requeteQbo(acces, `select Id, SyncToken, PrivateNote from Invoice where Id = '${factureId}' maxresults 1`);
      const facture = lu?.Invoice?.[0];
      if (!facture) return Response.json({ annulee: true, note: "Facture introuvable — probablement déjà annulée." });
      // 1. La preuve d'abord : le mémo interne reçoit la raison.
      const quand = new Date().toLocaleDateString("fr-CA");
      const trace = `❌ Annulée depuis Fluxya le ${quand}${par ? ` par ${par}` : ""}${note ? ` — ${note}` : ""}`;
      const apresNote = await ecrireQbo(acces, "invoice", {
        Id: facture.Id,
        SyncToken: facture.SyncToken,
        sparse: true,
        PrivateNote: [String(facture.PrivateNote || "").trim(), trace].filter(Boolean).join("\n").slice(0, 4000),
      });
      // 2. Puis le VOID, avec le SyncToken FRAIS retourné par l'étape 1.
      await ecrireQbo(acces, "invoice?operation=void", {
        Id: facture.Id,
        SyncToken: apresNote?.Invoice?.SyncToken ?? facture.SyncToken,
      });
      return Response.json({ annulee: true });
    } catch (e) {
      return Response.json({ erreur: `Annulation refusée : ${e?.message || "erreur"}` }, { status: 502 });
    }
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
    const [customerId, itemId, codeTaxe] = await Promise.all([
      clientQboPour(acces, admin, { clientId: corps?.clientId || null, clientNom }),
      articleServiceQboPour(acces),
      // 🍁 Code de taxe du fichier (TPS/TVQ) — OBLIGATOIRE au Canada,
      // absent d'un fichier américain type Sandbox (voir quickbooksServeur).
      codeTaxeVente(acces),
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
    // 🔢 QUANTITÉ × PRIX UNITAIRE (2026-09-04, demande du propriétaire) :
    // une ligne peut porter sa quantité et son prix unitaire — la
    // colonne « Qté » de QuickBooks devient vraie (« 5 × 12,50 $ »).
    // Sans quantité : 1 × montant, comme avant.
    const ligneQbo = (l, texteSeulement) => {
      if (l.montant === 0 && !texteSeulement) {
        return { DetailType: "DescriptionOnly", Description: l.description, DescriptionLineDetail: {} };
      }
      const qte = Number(l.quantite) > 0 ? Number(l.quantite) : 1;
      const prixUnitaire =
        Number(l.prixUnitaire) > 0 ? Number(l.prixUnitaire) : Math.round(((Number(l.montant) || 0) / qte) * 10000) / 10000;
      return {
        DetailType: "SalesItemLineDetail",
        Amount: l.montant,
        Description: l.description,
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: qte,
          UnitPrice: prixUnitaire,
          ...(codeTaxe ? { TaxCodeRef: { value: codeTaxe } } : {}),
        },
      };
    };

    const corpsFacture = async (texteSeulement, sansLienEstimate = false) => ({
      // 🔗 LIEN VERS L'ESTIMATE (2026-08-30, GO du propriétaire) : une
      // facture issue d'un devis RÉFÉRENCE son estimate — la comptable
      // voit la chaîne devis → accepté → facturé dans QuickBooks, et
      // l'estimate se ferme tout seul une fois tout facturé.
      ...(corps?.qboEstimateId && !sansLienEstimate
        ? { LinkedTxn: [{ TxnId: String(corps.qboEstimateId).replace(/[^0-9]/g, ""), TxnType: "Estimate" }] }
        : {}),
      CustomerRef: { value: customerId },
      DueDate: dateLocale,
      // 📅 DATE DE LA FACTURE = DATE DES TRAVAUX (2026-09-06, décision
      // du propriétaire, mise en garde taxes donnée) : quand l'appelant
      // fournit la date des travaux, elle devient TxnDate — sinon
      // QuickBooks met la date du jour, comme avant.
      ...(/^\d{4}-\d{2}-\d{2}$/.test(String(corps?.dateFacture || "")) ? { TxnDate: corps.dateFacture } : {}),
      // 🔢 Nº DE SUIVI DU CLIENT (2026-09-06, demande du propriétaire :
      // « les clients nous demandent de mettre leur numéro selon les
      // projets ») — rempli dans le champ « Nº de suivi » de QuickBooks.
      ...(String(corps?.numeroSuivi || "").trim() ? { TrackingNum: String(corps.numeroSuivi).trim().slice(0, 31) } : {}),
      // 🍁 Nos montants sont HORS TAXES — QuickBooks ajoute TPS/TVQ.
      ...proprietesTaxe(codeTaxe),
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
          // « ?e=<entreprise> » : la page montre le nom et le logo de la
          // bonne compagnie (2026-09-04).
          lienConditions = `Termes et conditions : ${new URL(request.url).origin}/conditions?e=${encodeURIComponent(entrepriseId)}`;
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
    // Le lien vers l'estimate est un BONUS, jamais un bloqueur : si
    // QuickBooks le refuse (estimate fermé, client différent…), la
    // facture repart SANS lui — une facture bloquée coûte plus cher.
    let lienEstimatePose = !!corps?.qboEstimateId;
    try {
      cree = await ecrireQbo(acces, "invoice?include=invoiceLink", await corpsFacture(false));
    } catch (e) {
      if (corps?.qboEstimateId) {
        lienEstimatePose = false;
        try {
          cree = await ecrireQbo(acces, "invoice?include=invoiceLink", await corpsFacture(false, true));
        } catch (e2) {
          if (!lignes.some((l) => l.montant === 0)) throw e2;
          cree = await ecrireQbo(acces, "invoice?include=invoiceLink", await corpsFacture(true, true));
        }
      } else {
        if (!lignes.some((l) => l.montant === 0)) throw e;
        cree = await ecrireQbo(acces, "invoice?include=invoiceLink", await corpsFacture(true));
      }
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
      // null = aucun estimate fourni ; true/false = lien posé ou refusé.
      lienEstimate: corps?.qboEstimateId ? lienEstimatePose : null,
      envoiQb,
      environnement: acces.environnement,
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
