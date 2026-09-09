// lib/supabase/modelesEtapes.js
//
// 📋 MODÈLES D'ÉTAPES (v2 de la checklist, 2026-09-09 — GO du
// propriétaire) : « Installation thermopompe » = 8 étapes standard,
// définies UNE fois et rechargées à la création de n'importe quelle
// tâche. Par entreprise (cloison RLS, snippet 140) — tout le bureau
// partage les mêmes modèles.

import { supabase } from "./client";

export async function listerModelesEtapes() {
  const { data, error } = await supabase
    .from("modeles_etapes")
    .select("*")
    .order("nom");
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    nom: row.nom || "",
    etapes: Array.isArray(row.etapes) ? row.etapes : [],
  }));
}

export async function sauvegarderModeleEtapes(nom, etapes) {
  const propre = String(nom || "").trim();
  const textes = (etapes || []).map((e) => String(e?.texte || "").trim()).filter(Boolean);
  if (!propre || textes.length === 0) return null;
  const ligne = {
    id: `mod-${Date.now()}`,
    nom: propre,
    // Le modèle ne garde que les TEXTES — jamais les coches d'une job.
    etapes: textes.map((t, i) => ({ texte: t, ordre: i })),
  };
  const { error } = await supabase.from("modeles_etapes").insert(ligne);
  if (error) throw error;
  return ligne.id;
}

export async function supprimerModeleEtapes(id) {
  const { error } = await supabase.from("modeles_etapes").delete().eq("id", id);
  if (error) throw error;
}
