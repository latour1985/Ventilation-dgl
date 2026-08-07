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

import { configQuickbooksPresente, jetonAccesValide, requeteQbo, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

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

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) {
    return Response.json({ erreur: "Connexion requise." }, { status: 401 });
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
  const borne = dateLocale(depuis);
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
        qbProjectRef: null,
        poNumber: (a.DocNumber || "").trim() || null,
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
        qbProjectRef: null,
        poNumber: (b.DocNumber || "").trim() || null,
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
