// lib/supabase/journal.js
//
// JOURNAL D'ACTIVITÉ (piste d'audit — exigence Loi 25). Avant, il ne
// vivait que dans le navigateur : perdu en changeant d'ordinateur ou en
// vidant le cache, et invisible pour les autres utilisateurs.
//
// Table volontairement APPEND-ONLY : on y ajoute, on n'y modifie ni
// n'y supprime jamais (voir les politiques du snippet SQL 22).

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    texte: row.texte,
    par: row.par_nom || "",
    date: row.date_locale,
    heure: row.heure_locale,
    horodatage: row.created_at,
  };
}

export async function listerJournal(limite = 300) {
  const { data, error } = await supabase
    .from("journal_activite")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []).map(versUi);
}

// `entree` = { texte, par, date, heure } — date et heure LOCALES
// (Québec), calculées par l'appelant comme partout ailleurs.
export async function ajouterEntreeJournal(entree, session) {
  const { error } = await supabase.from("journal_activite").insert({
    texte: entree.texte,
    par_nom: entree.par || session?.user?.user_metadata?.nom || session?.user?.email || null,
    date_locale: entree.date,
    heure_locale: entree.heure,
  });
  if (error) throw error;
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
