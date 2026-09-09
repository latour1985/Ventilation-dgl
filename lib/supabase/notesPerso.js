// lib/supabase/notesPerso.js
//
// 📝 MES NOTES — le bloc-notes PERSONNEL à cocher (2026-09-09, demande
// №8 du propriétaire : « une place où toutes ses notes sont regroupées
// et cocher quand il les a fait »). Chaque personne — bureau OU
// technicien — a SA liste : ajouter une note, la cocher quand c'est
// fait, la supprimer. Privé : la RLS (snippet 138) ne montre à chacun
// QUE ses propres notes (courriel du jeton), cloisonnées par
// entreprise comme tout le reste.

import { supabase } from "./client";

export async function listerNotesPerso() {
  const { data, error } = await supabase
    .from("notes_perso")
    .select("*")
    .order("fait", { ascending: true })
    .order("cree_le", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    texte: row.texte || "",
    fait: row.fait === true,
    creeLe: row.cree_le || null,
    faitLe: row.fait_le || null,
  }));
}

export async function ajouterNotePerso(texte) {
  const propre = String(texte || "").trim();
  if (!propre) return null;
  const { data: session } = await supabase.auth.getSession();
  const courriel = (session?.session?.user?.email || "").toLowerCase();
  if (!courriel) throw new Error("Session expirée — reconnecte-toi.");
  const ligne = { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, courriel, texte: propre, fait: false };
  const { error } = await supabase.from("notes_perso").insert(ligne);
  if (error) throw error;
  return ligne.id;
}

export async function basculerNotePerso(id, fait) {
  const { error } = await supabase
    .from("notes_perso")
    .update({ fait: fait === true, fait_le: fait === true ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function supprimerNotePerso(id) {
  const { error } = await supabase.from("notes_perso").delete().eq("id", id);
  if (error) throw error;
}
