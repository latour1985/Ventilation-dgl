// lib/connexionSurveillee.js
//
// LA CONNEXION SURVEILLÉE — partagée par les trois écrans de connexion
// (admin, technicien, plateforme). Parle à /api/connexion (compteur
// d'échecs CÔTÉ SERVEUR : 3 échecs = verrou 15 min) puis installe la
// session dans le navigateur. Offre aussi la réinitialisation par
// courriel et le déverrouillage après réinitialisation réussie.

import { supabase } from "./supabase/client";

// Retourne :
//   { ok: true }                          — connecté (session installée)
//   { verrouille: true, minutes, vientDArriver } — compte verrouillé
//   { erreur, essaisRestants? }           — échec normal
export async function seConnecterSurveille(courriel, motDePasse) {
  try {
    const reponse = await fetch("/api/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courriel, motDePasse }),
    });
    const r = await reponse.json().catch(() => ({}));
    if (r?.session?.access_token) {
      const { error } = await supabase.auth.setSession(r.session);
      if (error) return { erreur: "Session refusée — réessaie." };
      return { ok: true };
    }
    if (r?.verrouille) return r;
    return { erreur: r?.erreur || "Connexion refusée — réessaie.", essaisRestants: r?.essaisRestants };
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}

// Le courriel de réinitialisation — ramène sur /choisir-mot-de-passe.
export async function demanderReinitialisation(courriel) {
  const { error } = await supabase.auth.resetPasswordForEmail(courriel.trim(), {
    redirectTo: `${window.location.origin}/choisir-mot-de-passe`,
  });
  return !error;
}

// Après une réinitialisation réussie : le verrou saute immédiatement.
export async function deverrouillerApresReinitialisation() {
  try {
    const { data } = await supabase.auth.getSession();
    const jeton = data?.session?.access_token;
    if (!jeton) return;
    await fetch("/api/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "deverrouiller" }),
    });
  } catch {
    // le verrou tombera tout seul après 15 minutes
  }
}
