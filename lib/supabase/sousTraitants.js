// lib/supabase/sousTraitants.js
//
// SOUS-TRAITANTS À L'AGENDA (2026-08-19).
// Le répertoire vit dans `sous_traitants_app` (snippet SQL 75). Les
// ASSIGNATIONS, elles, réutilisent `taches_assignees` avec un courriel
// synthétique « st::<id> » : la reconstruction de l'agenda, la
// persistance entre les postes et le glisser-déposer fonctionnent
// exactement comme pour un employé — mais aucun téléphone ne lira
// jamais ces lignes (pas de compte), et l'app technicien les EXCLUT de
// la composition d'équipe (voir etatEquipeTache).
//
// Un sous-traitant peut être AUSSI un client (client_id facultatif) :
// une seule identité, deux rôles — les coordonnées restent sur la
// fiche client, jamais dupliquées.

import { supabase } from "./client";

export const COURRIEL_ST = (id) => `st::${id}`;
export const estCourrielST = (courriel) => String(courriel || "").startsWith("st::");

export async function listerSousTraitants() {
  const { data, error } = await supabase
    .from("sous_traitants_app")
    .select("*")
    .order("nom");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    nom: r.nom,
    specialite: r.specialite || "",
    telephone: r.telephone || "",
    courriel: r.courriel || "",
    note: r.note || "",
    clientId: r.client_id || null,
    actif: r.actif !== false,
  }));
}

export async function sauvegarderSousTraitant(st) {
  const { error } = await supabase.from("sous_traitants_app").upsert({
    id: st.id,
    nom: st.nom,
    specialite: st.specialite || null,
    telephone: st.telephone || null,
    courriel: st.courriel || null,
    note: st.note || null,
    client_id: st.clientId || null,
    actif: st.actif !== false,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Les assignations de TOUS les sous-traitants — pour la liste
// « Sous-traitance à facturer » (Facturation) et les statuts des blocs.
export async function listerAssignationsSousTraitants() {
  const { data, error } = await supabase
    .from("taches_assignees")
    .select("*")
    .like("employe_email", "st::%")
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return data || [];
}
