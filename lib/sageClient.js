// lib/sageClient.js
//
// PONT NAVIGATEUR → routes /api/sage/* (jamais vers Sage directement —
// les jetons vivent côté serveur). Même patron que quickbooksClient :
// retourne toujours un objet, jamais d'exception.

import { supabase } from "./supabase/client";

async function jetonSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

// État de la connexion : { configure, connecte, businessNom, expireLe }.
export async function etatSage() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { configure: false, connecte: false, erreur: "Session expirée." };
    const reponse = await fetch("/api/sage/etat", { headers: { Authorization: `Bearer ${jeton}` } });
    return await reponse.json();
  } catch {
    return { configure: false, connecte: false, erreur: "Réseau indisponible." };
  }
}

// Départ de la connexion : la route répond l'adresse d'autorisation
// Sage — l'appelant y navigue lui-même (window.location).
export async function demarrerConnexionSage() {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/sage/connexion", { headers: { Authorization: `Bearer ${jeton}` } });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}
