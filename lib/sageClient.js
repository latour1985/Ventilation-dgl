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

// Synchronisation des clients vers Sage — même contrat que
// synchroniserClientsQbo : { clientId } pour un seul, { tous: true }
// pour le rattrapage (lots — rappeler tant que `termine` est faux),
// { forcer: true } pour pousser une fiche reliée à jour.
export async function synchroniserClientsSage(options = {}) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/sage/clients-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(options),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// Départ de la connexion : la route répond l'adresse d'autorisation
// Sage — l'appelant y navigue lui-même (window.location).
// `pays` (facultatif, ex. "gb") : force la RÉGION Sage — vécu du
// 2026-09-07 : sans lui, Sage routait l'owner vers l'aile Amérique du
// Nord (accounting.na.sageone.com, « We're creating your account » en
// boucle) alors que son essai vit au Royaume-Uni.
export async function demarrerConnexionSage(pays = null) {
  try {
    const jeton = await jetonSession();
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch(`/api/sage/connexion${pays ? `?pays=${encodeURIComponent(pays)}` : ""}`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}
