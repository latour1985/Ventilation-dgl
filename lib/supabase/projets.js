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

// Les statuts de PROJET sont des étiquettes lisibles (« À planifier »,
// « En cours », « Facturation d'acompte », « Terminé »). Des projets
// créés avant le 2026-08-28 portent le code technique des TÂCHES
// (« a_planifier ») : ils n'entraient alors dans AUCUNE colonne du
// tableau et disparaissaient de l'écran. On les rattrape à la lecture —
// aucune migration à passer, et une vieille valeur inconnue retombe sur
// « À planifier » plutôt que de rendre le projet invisible.
const STATUTS_HERITES = {
  a_planifier: "À planifier",
  "a-planifier": "À planifier",
  en_cours: "En cours",
  "en-cours": "En cours",
  termine: "Terminé",
  "termine ": "Terminé",
};
const STATUTS_CONNUS = ["À planifier", "En cours", "Facturation d'acompte", "Terminé", "Annulé"];
function statutProjet(brut) {
  const valeur = String(brut || "").trim();
  if (STATUTS_CONNUS.includes(valeur)) return valeur;
  return STATUTS_HERITES[valeur.toLowerCase()] || "À planifier";
}

function versUi(row) {
  return {
    id: row.id,
    clientId: row.client_id || null,
    nom: row.nom,
    dateDebut: row.date_debut || "",
    dateFin: row.date_fin || "",
    statut: statutProjet(row.statut),
    // Secteur CCQ du chantier — hérité par chaque tâche du projet.
    secteur: row.secteur === "residentiel" ? "residentiel" : "commercial",
    adresseLivraison: row.adresse_livraison || "",
    budgetTotal: Number(row.budget_total) || 0,
    tauxHoraireCoutant: Number(row.taux_horaire_coutant) || 0,
    budgetPrevu: row.budget_prevu || null,
    bonsCommande: Array.isArray(row.bons_commande) ? row.bons_commande : [],
    // 📥 Reprise de chantier (snippet 101) — { heures: [], factures: [] }.
    // Vide tant que le snippet n'est pas passé : le bloc s'affiche, il
    // n'enregistre simplement rien.
    reprise: row.reprise && typeof row.reprise === "object" ? row.reprise : {},
    // Matériel pris au STOCK du bureau, attribué à ce projet (coûts).
    materielStock: Array.isArray(row.materiel_stock) ? row.materiel_stock : [],
  };
}

export async function listerProjets() {
  const { data, error } = await supabase.from("projets_app").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderProjet(p) {
  const ligne = {
    id: p.id,
    client_id: p.clientId || null,
    nom: p.nom,
    date_debut: p.dateDebut || null,
    date_fin: p.dateFin || null,
    statut: statutProjet(p.statut),
    secteur: p.secteur === "residentiel" ? "residentiel" : "commercial",
    adresse_livraison: p.adresseLivraison || null,
    budget_total: p.budgetTotal ?? 0,
    taux_horaire_coutant: p.tauxHoraireCoutant ?? 0,
    budget_prevu: p.budgetPrevu || null,
    bons_commande: p.bonsCommande || [],
    materiel_stock: p.materielStock || [],
    reprise: p.reprise && typeof p.reprise === "object" ? p.reprise : {},
  };
  const { error } = await supabase.from("projets_app").upsert(ligne);
  // ⚠️ FILET COLONNE MANQUANTE : tant que le snippet 101 n'est pas
  // passé, le reste du projet continue de s'enregistrer normalement.
  if (error && (error.code === "PGRST204" || /reprise/.test(error.message || ""))) {
    const { reprise: _sansReprise, ...sansColonneRecente } = ligne;
    const { error: e2 } = await supabase.from("projets_app").upsert(sansColonneRecente);
    if (e2) throw e2;
    return;
  }
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
