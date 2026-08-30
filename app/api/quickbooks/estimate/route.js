// app/api/quickbooks/estimate/route.js
//
// DEVIS QUICKBOOKS (« Estimate ») — le propriétaire faisait ses devis
// DANS QuickBooks avant l'application ; ce pont préserve sa pratique :
// chaque devis de l'application existe aussi dans QuickBooks, et son
// comptable retrouve la même structure qu'avant (devis → facture).
//
// UN devis d'application = UN estimate QuickBooks, mis à JOUR quand le
// devis est révisé (nouvelle version) — pas un nouvel estimate par
// révision, sinon le grand livre se remplit de brouillons. QBO exige le
// SyncToken courant pour une mise à jour : on le relit à chaque fois.
//
// SANDBOX (compagnie US) : montants HT, pas de TPS/TVQ — le fichier
// canadien réel appliquera ses taxes à la bascule.

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  requeteQbo,
  ecrireQbo,
  echapperQbo,
  clientQboPour,
  articleServiceQboPour,
  codeTaxeVente,
  proprietesTaxe, entrepriseDuCompte } from "@/lib/quickbooksServeur";

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

  // ============================================================
  // ACTION « LIRE » (2026-08-25) — TRANSITION QUICKBOOKS.
  // ------------------------------------------------------------
  // Un numéro de devis tapé À LA MAIN sur une tâche (devis fait dans
  // QuickBooks AVANT l'application) n'était qu'une étiquette : aucun
  // montant, aucune ligne — le garde-fou anti-dépassement se rabattait
  // sur le montant du bon et la facturation progressive était
  // impossible. Ici, on RETROUVE l'estimate par son numéro (DocNumber)
  // et on rapporte total + lignes. Lecture seule, rien n'est modifié.
  // Introuvable ≠ erreur : on répond { trouve: false } — l'appelant le
  // dit à l'humain au lieu de faire semblant.
  // ============================================================
  // ============================================================
  // ACTION « REJETER » (2026-08-29) — le devis accepté que le client
  // annule finalement. L'estimate QuickBooks passe à TxnStatus
  // « Rejected » (mise à jour partielle : Id + SyncToken relus juste
  // avant — jamais de suppression, la comptable garde la trace).
  // ============================================================
  if (corps?.action === "rejeter") {
    const estimateId = String(corps?.estimateId || "").replace(/[^0-9]/g, "");
    if (!estimateId) return Response.json({ erreur: "Identifiant d'estimate requis." }, { status: 400 });
    let acces3;
    try {
      acces3 = await jetonAccesValide(entrepriseId);
    } catch (e) {
      return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
    }
    if (!acces3) return Response.json({ nonConnecte: true });
    try {
      const lu = await requeteQbo(acces3, `select Id, SyncToken from Estimate where Id = '${estimateId}'`);
      const est = lu?.Estimate?.[0];
      if (!est) return Response.json({ trouve: false });
      const maj = await ecrireQbo(acces3, "estimate", {
        Id: est.Id,
        SyncToken: est.SyncToken,
        sparse: true,
        TxnStatus: "Rejected",
      });
      return Response.json({ rejete: maj?.Estimate?.TxnStatus === "Rejected" });
    } catch (e) {
      return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
    }
  }

  if (corps?.action === "lire") {
    const numeroCherche = String(corps?.numero || "").trim();
    if (!numeroCherche) return Response.json({ erreur: "Numéro requis." }, { status: 400 });
    let acces2;
    try {
      acces2 = await jetonAccesValide(entrepriseId);
    } catch (e) {
      return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
    }
    if (!acces2) return Response.json({ nonConnecte: true });
    try {
      const lu = await requeteQbo(
        acces2,
        `select * from Estimate where DocNumber = '${echapperQbo(numeroCherche)}' maxresults 1`
      );
      const est = lu?.Estimate?.[0];
      if (!est) return Response.json({ trouve: false });
      const lignes = (est.Line || [])
        .filter((l) => l.DetailType === "SalesItemLineDetail")
        .map((l) => ({
          description: String(l.Description || "").trim() || "Item du devis",
          quantite: Number(l.SalesItemLineDetail?.Qty) || 1,
          prixUnitaire: Number(l.SalesItemLineDetail?.UnitPrice) || Number(l.Amount) || 0,
        }));
      return Response.json({
        trouve: true,
        estimateId: est.Id,
        docNumber: est.DocNumber || numeroCherche,
        // Total HT : somme des lignes (TotalAmt inclurait les taxes du
        // fichier canadien à la bascule — les lignes, elles, restent HT).
        total: Math.round(lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0) * 100) / 100,
        clientNomQbo: est.CustomerRef?.name || null,
        lignes,
      });
    } catch (e) {
      return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
    }
  }

  const clientNom = String(corps?.clientNom || "").trim();
  const numero = String(corps?.numero || "").trim();
  const lignes = (Array.isArray(corps?.lignes) ? corps.lignes : [])
    .map((l) => ({
      // 2000 et non 300 (2026-08-24) : la description d'une ligne de
      // devis, c'est l'argumentaire de vente — modèles, garantie, ce qui
      // est inclus. À 300 caractères, elle partait coupée au client, en
      // silence. QuickBooks en accepte 4000.
      description: String(l?.description || "").slice(0, 2000),
      quantite: Number(l?.quantite) || 1,
      prixUnitaire: Number(l?.prixUnitaire) || 0,
    }))
    .filter((l) => l.description && l.prixUnitaire !== 0);
  if (!clientNom || !numero || lignes.length === 0) {
    return Response.json({ erreur: "Client, numéro et lignes requis." }, { status: 400 });
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
      // 🍁 Code de taxe du fichier — un fichier canadien exige un code
      // sur chaque ligne, devis compris (2026-09-09).
      codeTaxeVente(acces),
    ]);
    if (!customerId) return Response.json({ erreur: "Client QuickBooks introuvable et non créable." }, { status: 502 });
    if (!itemId) return Response.json({ erreur: "Aucun article de type Service dans ce fichier QuickBooks." }, { status: 502 });

    const corpsEstimate = {
      CustomerRef: { value: customerId },
      DocNumber: numero.slice(0, 21), // limite QBO
      PrivateNote: `Devis ${numero} — créé par l'application Ventilation DGL`,
      // 🍁 Montants HORS TAXES — QuickBooks ajoute TPS/TVQ.
      ...proprietesTaxe(codeTaxe),
      Line: lignes.map((l) => ({
        DetailType: "SalesItemLineDetail",
        Amount: Math.round(l.quantite * l.prixUnitaire * 100) / 100,
        Description: l.description,
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: l.quantite,
          UnitPrice: l.prixUnitaire,
          ...(codeTaxe ? { TaxCodeRef: { value: codeTaxe } } : {}),
        },
      })),
    };

    // MISE À JOUR si l'estimate existe déjà (id fourni et retrouvable),
    // sinon CRÉATION. La mise à jour QBO est un remplacement complet
    // avec le SyncToken courant.
    const estimateId = String(corps?.estimateId || "").trim();
    if (estimateId) {
      const lu = await requeteQbo(acces, `select Id, SyncToken from Estimate where Id = '${echapperQbo(estimateId)}' maxresults 1`);
      const existant = lu?.Estimate?.[0];
      if (existant) {
        const maj = await ecrireQbo(acces, "estimate", { ...corpsEstimate, Id: existant.Id, SyncToken: existant.SyncToken });
        return Response.json({ creee: true, misAJour: true, estimateId: maj?.Estimate?.Id || existant.Id, docNumber: maj?.Estimate?.DocNumber || numero });
      }
      // Introuvable (supprimé côté QBO ?) — on retombe sur la création.
    }
    const cree = await ecrireQbo(acces, "estimate", corpsEstimate);
    return Response.json({ creee: true, misAJour: false, estimateId: cree?.Estimate?.Id || null, docNumber: cree?.Estimate?.DocNumber || numero });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
