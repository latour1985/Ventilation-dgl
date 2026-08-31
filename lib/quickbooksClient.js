// lib/quickbooksClient.js
//
// CÔTÉ NAVIGATEUR de l'intégration QuickBooks : parle uniquement à NOS
// routes /api/quickbooks/* (jamais à Intuit directement — les jetons
// vivent côté serveur). Même patron que lib/courriels.js : retourne
// toujours un objet, jamais d'exception.

import { supabase } from "./supabase/client";

async function jetonSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

// État de la connexion : { configure, connecte, environnement, ... }.
export async function etatQuickbooks() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { configure: false, connecte: false, erreur: "Session expirée." };
    const reponse = await fetch("/api/quickbooks/etat", { headers: { Authorization: `Bearer ${jeton}` } });
    return await reponse.json();
  } catch {
    return { configure: false, connecte: false, erreur: "Réseau indisponible." };
  }
}

// Vraies transactions (Sandbox ou production selon le serveur).
// `depuis` (facultatif, "AAAA-MM-JJ") = la date-plancher des Paramètres :
// rien n'est lu dans QuickBooks avant cette date.
// Réponses : { simule } | { nonConnecte } | { transactions } | { erreur }.
export async function listerTransactionsQuickbooks(depuis) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const param = /^\d{4}-\d{2}-\d{2}$/.test(depuis || "") ? `?depuis=${depuis}` : "";
    const reponse = await fetch(`/api/quickbooks/transactions${param}`, { headers: { Authorization: `Bearer ${jeton}` } });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// 🔄 CATALOGUE D'ITEMS QUICKBOOKS (2026-08-28) — la liste brute, pour la
// fenêtre de synchronisation du catalogue (onglet Tarifs). La
// comparaison et l'AUTORISATION humaine se font côté admin.
// Réponses : { items } | { simule } | { nonConnecte } | { erreur }.
export async function listerItemsQbo() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/catalogue", { headers: { Authorization: `Bearer ${jeton}` } });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// 💰 SONDAGE DES DÉPÔTS PAYÉS (2026-08-22) — ferme la boucle : un
// client qui paie sa facture de dépôt dans QuickBooks débloque sa tâche
// tout seul, sans que personne ait à surveiller. Appelé au démarrage
// puis toutes les quelques minutes.
// Réponses : { verifies, payes: [{ tacheId, docNumber, montant }] }
// | { simule } | { nonConnecte } | { erreur }.
export async function sonderDepotsPayes() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/depots-payes", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}` },
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// 🔁 REFLET DES RÉPONSES DE DEVIS (2026-08-30) : les acceptations et
// refus des clients pas encore transmis passent aux estimates
// QuickBooks (« Accepted »/« Rejected »). Appelé par le sondage 3 min.
export async function refleterReponsesDevisQbo() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/estimates-reponses", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}` },
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// FACTURE DE DÉPÔT — création dans QuickBooks (Sandbox tant que la
// bascule n'est pas faite). Réponses : { creee, factureId, docNumber }
// | { simule } | { nonConnecte } | { erreur }.
export async function creerFactureDepot(infos) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/facture-depot", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(infos),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// Annulation par VOID (jamais Delete — règle gelée du propriétaire).
export async function annulerFactureDepot(factureId) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/facture-depot", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "void", factureId }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// VRAIE FACTURE — tout ce qui se facture depuis l'onglet Facturation.
// infos = { clientId, clientNom, lignes: [{description, montant}],
//           termePaiement, reference, paiementCarte, paiementVirement }
export async function creerFactureQbo(infos) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/facture", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(infos),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// ❌ ANNULER une facture régulière (2026-08-31) — VOID + note comptable
// écrite dans QuickBooks (mémo interne) : qui, quand, pourquoi.
export async function annulerFactureQbo(factureId, note) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/facture", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "void", factureId, note: note || "" }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// ❌ REJETER un estimate (2026-08-29) — le devis accepté que le client
// annule finalement : TxnStatus « Rejected », jamais de suppression.
export async function rejeterEstimateQbo(estimateId) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "rejeter", estimateId }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}
// DEVIS (« estimate ») — créé/mis à jour dans QuickBooks pour préserver
// la pratique du propriétaire (ses devis vivaient dans QuickBooks).
export async function creerEstimateQbo(infos) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(infos),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// 🔎 LECTURE d'un devis QuickBooks par son NUMÉRO (transition : devis
// faits dans QuickBooks avant l'application, numéro tapé à la main sur
// la tâche). Réponses : { trouve, estimateId, docNumber, total,
// clientNomQbo, lignes } | { trouve: false } | { nonConnecte } |
// { simule } | { erreur }.
export async function lireEstimateQbo(numero) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "lire", numero }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// (RE)ENVOI D'UNE FACTURE PAR QUICKBOOKS — retourne { envoyee,
// envoyeeLe } vérifiés dans le registre QuickBooks. Le bouton
// « Renvoyer » des factures dont l'envoi n'est pas confirmé.
export async function envoyerFactureQbo(factureId, courriels) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/facture-envoi", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "envoyer", factureId, courriels }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// STATUT D'ENVOI RÉEL d'un lot de factures — le filet « Vérifier les
// envois » : { statuts: { id: { envoyee, envoyeeLe } } }.
export async function verifierEnvoisQbo(ids) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/facture-envoi", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "verifier", ids }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// LE PDF OFFICIEL d'une facture QuickBooks — ouvert dans un nouvel
// onglet. Retourne true si le PDF s'est ouvert, false sinon.
export async function ouvrirFacturePdfQbo(factureId) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return false;
    const reponse = await fetch(`/api/quickbooks/facture-pdf?id=${encodeURIComponent(factureId)}`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    if (!reponse.ok || !(reponse.headers.get("content-type") || "").includes("pdf")) return false;
    const blob = await reponse.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    return false;
  }
}

// SYNCHRONISATION DES CLIENTS — { clientId } pour un seul (création de
// fiche), { tous: true } pour le rattrapage par lots de 100.
export async function synchroniserClientsQbo(options) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/clients-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(options || {}),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}
