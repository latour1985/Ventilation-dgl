// lib/supabase/fournisseurs.js
//
// Répertoire des fournisseurs (matériaux, location d'équipement,
// sous-traitance). Sert à envoyer le bon de commande directement au
// fournisseur depuis l'app, sans passer par un logiciel de courriel
// externe — et à réutiliser ses coordonnées d'un BC à l'autre.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    nom: row.nom,
    // Plusieurs adresses possibles (achats, comptabilité, représentant).
    courriels: Array.isArray(row.courriels) ? row.courriels : [],
    telephone: row.telephone || "",
    adresse: row.adresse || "",
    notes: row.notes || "",
  };
}

export async function listerFournisseurs() {
  const { data, error } = await supabase.from("fournisseurs").select("*").order("nom");
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderFournisseur(f) {
  const { error } = await supabase.from("fournisseurs").upsert({
    id: f.id,
    nom: f.nom,
    courriels: f.courriels || [],
    telephone: f.telephone || null,
    adresse: f.adresse || null,
    notes: f.notes || null,
  });
  if (error) throw error;
}

export async function supprimerFournisseur(id) {
  const { error } = await supabase.from("fournisseurs").delete().eq("id", id);
  if (error) throw error;
}
