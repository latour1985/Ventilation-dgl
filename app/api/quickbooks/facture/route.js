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
} from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
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
  const lignes = (Array.isArray(corps?.lignes) ? corps.lignes : [])
    .map((l) => ({ description: String(l?.description || "").slice(0, 300), montant: Number(l?.montant) || 0 }))
    .filter((l) => l.description && l.montant !== 0);
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  if (!clientNom || lignes.length === 0 || total <= 0) {
    return Response.json({ erreur: "Client et lignes (total positif) requis." }, { status: 400 });
  }

  let acces;
  try {
    acces = await jetonAccesValide();
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

    const cree = await ecrireQbo(acces, "invoice?include=invoiceLink", {
      CustomerRef: { value: customerId },
      DueDate: dateLocale,
      PrivateNote: `Facture — ${corps?.reference || "travaux"} — créée par l'application Ventilation DGL`,
      // Choix HUMAIN fait à l'envoi (fenêtre d'avant-envoi) — jamais un
      // défaut silencieux pour ces factures.
      AllowOnlineCreditCardPayment: corps?.paiementCarte === true,
      AllowOnlineACHPayment: corps?.paiementVirement === true,
      Line: lignes.map((l) => ({
        DetailType: "SalesItemLineDetail",
        Amount: l.montant,
        Description: l.description,
        SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: l.montant },
      })),
    });
    const facture = cree?.Invoice;
    return Response.json({
      creee: true,
      factureId: facture?.Id || null,
      docNumber: facture?.DocNumber || null,
      lienPaiement: facture?.InvoiceLink || null,
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
