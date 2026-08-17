// lib/supabase/journal.js
//
// JOURNAL D'ACTIVITÉ (piste d'audit — exigence Loi 25). Avant, il ne
// vivait que dans le navigateur : perdu en changeant d'ordinateur ou en
// vidant le cache, et invisible pour les autres utilisateurs.
//
// Table volontairement APPEND-ONLY : on y ajoute, on n'y modifie ni
// n'y supprime jamais (voir les politiques du snippet SQL 22).

import { supabase } from "./client";

// ⚠️ ÉTAT RÉEL vérifié par sonde le 2026-08-17 : la table
// journal_activite (colonnes id, texte, created_at, created_by uuid,
// entreprise_id) est SCELLÉE par la RLS pour les comptes connectés —
// ni lecture ni écriture. L'ancien code écrivait en plus des colonnes
// inexistantes (par_nom, date_locale…) : chaque insertion échouait en
// silence et la piste d'audit restait VIDE depuis le début. Tout passe
// maintenant par la route serveur /api/journal (clé service), qui
// détermine l'auteur depuis le jeton vérifié. La date/heure LOCALES
// (règle de la maison) se calculent à la lecture depuis created_at.
function versUi(row) {
  const d = row.created_at ? new Date(row.created_at) : null;
  return {
    id: row.id,
    texte: row.texte, // l'auteur est déjà inscrit dedans (« — par X »)
    par: "",
    date: d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : "",
    heure: d ? d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "",
    horodatage: row.created_at,
  };
}

async function jetonSession(session) {
  if (session?.access_token) return session.access_token;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export async function listerJournal(limite = 300, session = null) {
  const jeton = await jetonSession(session);
  if (!jeton) return [];
  const reponse = await fetch("/api/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ action: "lister", limite }),
  });
  if (!reponse.ok) throw new Error("Journal illisible.");
  const { lignes } = await reponse.json();
  return (lignes || []).map(versUi);
}

// `entree` = { texte } — l'auteur est déterminé PAR LE SERVEUR depuis
// le jeton de session (une piste d'audit ne se maquille pas).
export async function ajouterEntreeJournal(entree, session) {
  const jeton = await jetonSession(session);
  if (!jeton) throw new Error("Session requise.");
  const reponse = await fetch("/api/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ action: "ajouter", texte: entree.texte }),
  });
  if (!reponse.ok) throw new Error("Écriture du journal refusée.");
}

export function sAbonnerJournal(onChangement) {
  const canal = supabase
    .channel("journal-activite")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "journal_activite" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
