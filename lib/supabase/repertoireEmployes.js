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
    toujoursCommercial: !!row.toujours_commercial,
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

// ANNUAIRE — noms et courriels SEULEMENT (jamais les salaires). Lit la
// vue `annuaire_employes` (snippet SQL 44), accessible à tout employé
// connecté, alors que la table `repertoire_employes` complète reste
// réservée au bureau (RLS). C'est ce que l'app technicien utilise pour
// l'écran « passager » et pour afficher le nom du technicien connecté —
// sans jamais exposer les taux horaires de qui que ce soit.
export async function listerAnnuaireEmployes() {
  const { data, error } = await supabase
    .from("annuaire_employes")
    .select("id, nom, courriel, nom_utilisateur")
    .order("nom");
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    nom: row.nom,
    courriel: row.courriel || "",
    nomUtilisateur: row.nom_utilisateur || "",
  }));
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
    toujours_commercial: !!u.toujoursCommercial,
    poste: u.poste || null,
    date_embauche: u.dateEmbauche || null,
    adresse: u.adresse || null,
    notes_rh: u.notesRH || null,
    mot_de_passe_cree: !!u.motDePasseCree,
  });
  if (error) throw error;
}
