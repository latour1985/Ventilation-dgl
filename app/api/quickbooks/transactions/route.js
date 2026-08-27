// app/api/quickbooks/transactions/route.js
//
// SYNCHRONISATION QUICKBOOKS — la lecture des vraies transactions.
//
// Interroge l'API QuickBooks (Sandbox tant que QB_ENVIRONNEMENT n'est
// pas 'production') et retourne les factures clients (Invoice) et les
// dépenses fournisseurs (Purchase + Bill) des 12 derniers mois, dans
// EXACTEMENT la forme que l'interface admin connaît déjà — les règles
// d'attribution (Règle 1 : client/projet, Règle 2 : numéro de BC)
// continuent de s'appliquer côté admin, où vivent projets et clients.
//
// LECTURE SEULE : cette route n'écrit rien dans QuickBooks. (Et le
// jour où on écrira — factures de dépôt —, la règle gelée s'applique :
// annulation par VOID, jamais Delete.)
//
// Réponses possibles :
//   { simule: true }        — variables d'environnement absentes
//   { nonConnecte: true }   — config posée mais OAuth pas encore fait
//   { transactions: [...] } — la vraie liste

import { configQuickbooksPresente, jetonAccesValide, requeteQbo, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

// Date locale (règle gelée : jamais toISOString pour une date calendrier).
function dateLocale(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// PAID / UNPAID / DUE — même vocabulaire que l'interface. DUE = solde
// impayé ET date d'échéance dépassée (c'est elle qui doit crier).
function statutDepuisSolde(entite, aujourdhui) {
  const solde = Number(entite.Balance) || 0;
  if (solde === 0) return "PAID";
  return entite.DueDate && entite.DueDate < aujourdhui ? "DUE" : "UNPAID";
}

function montantHT(entite) {
  const ttc = Number(entite.TotalAmt) || 0;
  const taxes = Number(entite.TxnTaxDetail?.TotalTax) || 0;
  return Math.round((ttc - taxes) * 100) / 100;
}

// ============================================================
// OÙ CHERCHER LE NUMÉRO DE BON DE COMMANDE (2026-08-24)
// ------------------------------------------------------------
// Constat du propriétaire, capture à l'appui : sur une facture
// fournisseur, le champ « Nº de la facture à payer » porte le numéro DU
// FOURNISSEUR (3419360), pas notre BC. Chercher là ne pouvait donc
// presque jamais marcher.
//
// On ratisse maintenant tout le texte libre de la transaction :
//   • DocNumber      — « Nº de référence » (le cas d'origine)
//   • PrivateNote    — le champ « Mémo », en bas de l'écran QuickBooks
//   • Line[].Description — la colonne DESCRIPTION de chaque ligne
//
// Tronqué : une facture à 40 lignes n'a pas à voyager en entier, on
// cherche un numéro court, pas à recopier la comptabilité.
function texteCherchable(entite) {
  const morceaux = [
    entite.DocNumber || "",
    entite.PrivateNote || "",
    ...(Array.isArray(entite.Line) ? entite.Line.map((l) => l?.Description || "") : []),
  ];
  return morceaux.filter(Boolean).join(" ").slice(0, 400) || null;
}

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) {
    return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  }
  // 🔐 GRAND SOIR (2026-09-04) : la comptabilite branchee est celle de
  // DGL — les entreprises d'essai n'ont pas (encore) de connexion
  // QuickBooks a elles. Refus net plutot que de servir les chiffres
  // d'une autre entreprise.
  if (entrepriseDuCompte(utilisateur) !== "dgl") {
    return Response.json({ erreur: "La connexion comptable n'est pas encore offerte a votre entreprise." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) {
    return Response.json({ simule: true });
  }

  let acces;
  try {
    acces = await jetonAccesValide();
  } catch (e) {
    return Response.json({ erreur: `Renouvellement du jeton refusé : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) {
    return Response.json({ nonConnecte: true });
  }

  // 12 mois d'historique — assez pour la rentabilité des projets en
  // cours, sans aspirer toute la comptabilité.
  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - 12);
  let borne = dateLocale(depuis);
  // 📅 DATE-PLANCHER (2026-08-28) — « ne rien lire avant le … »
  // (Paramètres → Connexions). L'historique d'avant Fluxya reste dans
  // QuickBooks : sans coûts en face dans l'application, l'importer
  // fabriquerait des marges fausses et une liste « à rattacher » de
  // centaines de cartes. Le plancher ne peut que RESSERRER la fenêtre
  // de 12 mois, jamais l'élargir.
  const plancher = new URL(request.url).searchParams.get("depuis") || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(plancher) && plancher > borne) borne = plancher;
  const aujourdhui = dateLocale(new Date());

  try {
    const [factures, achats, facturesFournisseurs] = await Promise.all([
      requeteQbo(acces, `select * from Invoice where TxnDate >= '${borne}' orderby TxnDate desc maxresults 1000`),
      requeteQbo(acces, `select * from Purchase where TxnDate >= '${borne}' orderby TxnDate desc maxresults 1000`),
      requeteQbo(acces, `select * from Bill where TxnDate >= '${borne}' orderby TxnDate desc maxresults 1000`),
    ]);

    const transactions = [
      // Factures de VENTE — reliées au client (Règle 1 côté admin).
      ...(factures.Invoice || []).map((f) => ({
        quickbooksId: `QBO-INV-${f.Id}`,
        type: "INVOICE",
        customerRefId: f.CustomerRef?.value || null,
        // 👤 Le NOM du client tel que QuickBooks le connaît (2026-08-28) :
        // affiché sur les cartes « à rattacher » (une carte anonyme est
        // inclassable) et utilisé pour l'appariement automatique par nom.
        clientNomQb: f.CustomerRef?.name || null,
        qbProjectRef: f.ProjectRef?.value || null,
        poNumber: null,
        amountHT: montantHT(f),
        amountTTC: Number(f.TotalAmt) || 0,
        status: statutDepuisSolde(f, aujourdhui),
        date: f.TxnDate || null,
      })),
      // DÉPENSES payées comptant/carte (Purchase) — le numéro de BC
      // saisi par la comptable dans « No de référence » fait le lien
      // (Règle 2). Toujours réputées payées : l'argent est déjà sorti.
      ...(achats.Purchase || []).map((a) => ({
        quickbooksId: `QBO-EXP-${a.Id}`,
        type: "EXPENSE",
        customerRefId: null,
        fournisseurNomQb: a.EntityRef?.name || null,
        qbProjectRef: null,
        poNumber: (a.DocNumber || "").trim() || null,
        referenceTexte: texteCherchable(a),
        amountHT: montantHT(a),
        amountTTC: Number(a.TotalAmt) || 0,
        status: "PAID",
        date: a.TxnDate || null,
      })),
      // FACTURES FOURNISSEURS à payer (Bill) — même logique de BC.
      ...(facturesFournisseurs.Bill || []).map((b) => ({
        quickbooksId: `QBO-BILL-${b.Id}`,
        type: "EXPENSE",
        customerRefId: null,
        fournisseurNomQb: b.VendorRef?.name || null,
        qbProjectRef: null,
        poNumber: (b.DocNumber || "").trim() || null,
        referenceTexte: texteCherchable(b),
        amountHT: montantHT(b),
        amountTTC: Number(b.TotalAmt) || 0,
        status: statutDepuisSolde(b, aujourdhui),
        date: b.TxnDate || null,
      })),
    ];

    return Response.json({ transactions });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable — réessaie.") }, { status: 502 });
  }
}
