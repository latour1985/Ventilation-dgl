// lib/supabase/camions.js
//
// Parc de véhicules (répertoire officiel). Avant, la liste des camions
// était DÉDUITE des inspections : une faute de frappe créait un camion
// fantôme (« Camion 2 » vs « Camion 02 »). Le technicien choisit
// maintenant dans une liste fermée, alimentée ici par l'administration.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    nom: row.nom,
    immatriculation: row.immatriculation || "",
    marqueModele: row.marque_modele || "",
    annee: row.annee || "",
    actif: row.actif !== false, // un camion retiré du parc reste dans l'historique
    notes: row.notes || "",
    // RETRAIT DU PARC (vente, remplacement, bris majeur) : le camion
    // quitte la liste des techniciens mais son dossier reste consultable
    // dans « Anciens véhicules » avec tout son historique.
    retireLe: row.retire_le || null,
    motifRetrait: row.motif_retrait || "",
    remplacePar: row.remplace_par || "",
  };
}

export async function listerCamions() {
  const { data, error } = await supabase.from("camions").select("*").order("nom");
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderCamion(c) {
  const { error } = await supabase.from("camions").upsert({
    id: c.id,
    nom: c.nom,
    immatriculation: c.immatriculation || null,
    marque_modele: c.marqueModele || null,
    annee: c.annee || null,
    actif: c.actif !== false,
    notes: c.notes || null,
    retire_le: c.retireLe || null,
    motif_retrait: c.motifRetrait || null,
    remplace_par: c.remplacePar || null,
  });
  if (error) throw error;
}

export async function supprimerCamion(id) {
  const { error } = await supabase.from("camions").delete().eq("id", id);
  if (error) throw error;
}
