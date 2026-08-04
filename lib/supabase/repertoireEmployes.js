// lib/supabase/repertoireEmployes.js
//
// Persistance du répertoire des employés (dossier Utilisateurs de
// l'admin). Sans elle, un employé créé disparaissait au rechargement —
// et donc de l'agenda et de la synchro des tâches par courriel.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    nom: row.nom,
    courriel: row.courriel || "",
    telephone: row.telephone || "",
    nomUtilisateur: row.nom_utilisateur || "",
    typeAcces: row.type_acces || "Employé",
    metier: row.metier || undefined,
    niveau: row.niveau || undefined,
    // Taux horaire INDIVIDUEL (métiers de bureau) et PRIME horaire
    // individuelle (métiers de terrain — s'ajoute à la grille CCQ).
    tauxHoraire: row.taux_horaire != null ? Number(row.taux_horaire) : null,
    primeHoraire: row.prime_horaire != null ? Number(row.prime_horaire) : null,
    poste: row.poste || "",
    dateEmbauche: row.date_embauche || "",
    adresse: row.adresse || "",
    notesRH: row.notes_rh || "",
    motDePasseCree: !!row.mot_de_passe_cree,
  };
}

export async function listerEmployes() {
  const { data, error } = await supabase.from("repertoire_employes").select("*").order("nom");
  if (error) throw error;
  return (data || []).map(versUi);
}

// Suppression définitive d'une fiche (répertoire seulement — la
// révocation des accès est faite séparément par l'appelant).
export async function supprimerEmploye(id) {
  const { error } = await supabase.from("repertoire_employes").delete().eq("id", id);
  if (error) throw error;
}

export async function sauvegarderEmploye(u) {
  const { error } = await supabase.from("repertoire_employes").upsert({
    id: u.id,
    nom: u.nom,
    courriel: u.courriel || null,
    telephone: u.telephone || null,
    nom_utilisateur: u.nomUtilisateur || null,
    type_acces: u.typeAcces || null,
    metier: u.metier || null,
    niveau: u.niveau || null,
    taux_horaire: u.tauxHoraire != null ? u.tauxHoraire : null,
    prime_horaire: u.primeHoraire != null ? u.primeHoraire : null,
    poste: u.poste || null,
    date_embauche: u.dateEmbauche || null,
    adresse: u.adresse || null,
    notes_rh: u.notesRH || null,
    mot_de_passe_cree: !!u.motDePasseCree,
  });
  if (error) throw error;
}
