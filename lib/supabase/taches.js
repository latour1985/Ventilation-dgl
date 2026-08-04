// lib/supabase/taches.js
//
// TÂCHES EN ATTENTE (celles pas encore placées à l'horaire). Avant,
// une tâche créée mais non assignée disparaissait au rechargement.
//
// Les tâches DÉJÀ PLACÉES à l'agenda vivent, elles, dans
// `taches_assignees` (une ligne par tâche × technicien) — voir
// lib/supabase/tachesAssignees.js. Ici, on ne garde que la file
// d'attente.
//
// La fiche complète est stockée en jsonb (`donnees`) : une tâche porte
// beaucoup de champs (dépôt, zone, devis lié, technicien prévu,
// adresse des travaux, courriels du client…) et ils voyagent toujours
// ensemble.

import { supabase } from "./client";

export async function listerTachesAttente() {
  const { data, error } = await supabase
    .from("taches_attente")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data || []).map((row) => ({ ...(row.donnees || {}), id: row.id }));
}

export async function sauvegarderTacheAttente(t) {
  const { error } = await supabase.from("taches_attente").upsert({
    id: t.id,
    titre: t.titre || null,
    client_nom: t.clientNom || null,
    type_tache: t.typeTache || null,
    donnees: { ...t },
  });
  if (error) throw error;
}

// Retirée de la file : soit placée à l'horaire, soit supprimée.
export async function retirerTacheAttente(id) {
  const { error } = await supabase.from("taches_attente").delete().eq("id", id);
  if (error) throw error;
}

export function sAbonnerTachesAttente(onChangement) {
  const canal = supabase
    .channel("taches-attente")
    .on("postgres_changes", { event: "*", schema: "public", table: "taches_attente" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
