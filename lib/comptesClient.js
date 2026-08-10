// lib/comptesClient.js
//
// CÔTÉ NAVIGATEUR de la création de comptes employés : parle à notre
// route /api/utilisateurs/inviter (le compte et le lien se fabriquent
// côté serveur — la clé service ne quitte jamais Vercel). Même patron
// que lib/courriels.js : retourne toujours un objet, jamais d'exception.
//
// Réponses possibles :
//   { envoye: true, nouveau }         — invitation partie par courriel
//   { envoye: false, lien, erreur }   — compte OK mais courriel raté :
//                                       l'admin transmet le lien lui-même
//   { simule: true, lien? }           — service non configuré (local)
//   { erreur }                        — refus (rôle, courriel invalide…)

import { supabase } from "./supabase/client";

export async function inviterEmploye({ courriel, nom, role, sousCategorie }) {
  try {
    const { data } = await supabase.auth.getSession();
    const jeton = data?.session?.access_token;
    if (!jeton) return { erreur: "Session expirée — reconnecte-toi." };
    const reponse = await fetch("/api/utilisateurs/inviter", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ courriel, nom, role, sousCategorie }),
    });
    return await reponse.json();
  } catch {
    return { erreur: "Réseau indisponible — réessaie." };
  }
}
