// lib/supabase/projets.js
//
// Persistance des PROJETS. Avant, un projet créé (avec son budget, ses
// bons de commande et toute sa rentabilité) disparaissait au
// rechargement de la page.
//
// Table `projets_app` — distincte de la table `projets` du schéma
// initial (section 6), jamais utilisée par l'application.
//
// Le budget prévu et les bons de commande sont stockés en jsonb : ils
// sont toujours lus et écrits avec leur projet, jamais séparément.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    clientId: row.client_id || null,
    nom: row.nom,
    dateDebut: row.date_debut || "",
    dateFin: row.date_fin || "",
    statut: row.statut || "a_planifier",
    // Secteur CCQ du chantier — hérité par chaque tâche du projet.
    secteur: row.secteur === "residentiel" ? "residentiel" : "commercial",
    adresseLivraison: row.adresse_livraison || "",
    budgetTotal: Number(row.budget_total) || 0,
    tauxHoraireCoutant: Number(row.taux_horaire_coutant) || 0,
    budgetPrevu: row.budget_prevu || null,
    bonsCommande: Array.isArray(row.bons_commande) ? row.bons_commande : [],
  };
}

export async function listerProjets() {
  const { data, error } = await supabase.from("projets_app").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderProjet(p) {
  const { error } = await supabase.from("projets_app").upsert({
    id: p.id,
    client_id: p.clientId || null,
    nom: p.nom,
    date_debut: p.dateDebut || null,
    date_fin: p.dateFin || null,
    statut: p.statut || "a_planifier",
    secteur: p.secteur === "residentiel" ? "residentiel" : "commercial",
    adresse_livraison: p.adresseLivraison || null,
    budget_total: p.budgetTotal ?? 0,
    taux_horaire_coutant: p.tauxHoraireCoutant ?? 0,
    budget_prevu: p.budgetPrevu || null,
    bons_commande: p.bonsCommande || [],
  });
  if (error) throw error;
}

export async function supprimerProjet(id) {
  const { error } = await supabase.from("projets_app").delete().eq("id", id);
  if (error) throw error;
}

export function sAbonnerProjets(onChangement) {
  const canal = supabase
    .channel("projets-app")
    .on("postgres_changes", { event: "*", schema: "public", table: "projets_app" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
