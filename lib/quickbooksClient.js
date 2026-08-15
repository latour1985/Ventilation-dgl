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
// Réponses : { simule } | { nonConnecte } | { transactions } | { erreur }.
export async function listerTransactionsQuickbooks() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/quickbooks/transactions", { headers: { Authorization: `Bearer ${jeton}` } });
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
