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
