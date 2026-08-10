// lib/supabase/utilisateurs.js
//
// Remplace UTILISATEURS_INIT et OngletUtilisateurs dans
// AdminInterface.jsx. La création de compte se fait en 2 temps :
// 1. Création du compte d'authentification (Supabase Auth) — via
//    supabase.auth.admin.createUser(), qui exige la clé service_role
//    et doit donc passer par une route API serveur (jamais depuis le
//    navigateur), pas directement ici.
// 2. Création du profil applicatif (ce fichier), lié par le même id.

import { supabase } from "./client";

export async function listerUtilisateurs() {
  const { data, error } = await supabase.from("profils_utilisateurs").select("*").order("nom");
  if (error) throw error;
  return data;
}

// Appelée après que la route API serveur a créé le compte Auth et
// retourné son id.
export async function creerProfilUtilisateur(authUserId, { nom, nomUtilisateur, courriel, telephone, typeAcces }) {
  const { data, error } = await supabase
    .from("profils_utilisateurs")
    .insert({
      id: authUserId,
      nom,
      nom_utilisateur: nomUtilisateur,
      courriel,
      telephone_chiffre: telephone, // à chiffrer via RPC en prod, voir clients.js
      type_acces: typeAcces,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Équivalent du bouton "Modifier" (ModalProfilUtilisateur)
export async function mettreAJourProfil(utilisateurId, champs) {
  const { error } = await supabase
    .from("profils_utilisateurs")
    .update({
      nom: champs.nom,
      courriel: champs.courriel,
      telephone_chiffre: champs.telephone,
      type_acces: champs.typeAcces,
      poste: champs.poste,
      date_embauche: champs.dateEmbauche || null,
      adresse: champs.adresse,
      notes_rh: champs.notesRH,
    })
    .eq("id", utilisateurId);
  if (error) throw error;
}

// Équivalent de "Réinitialiser le mot de passe" — envoie un lien
// Supabase Auth de réinitialisation par courriel (aucune manipulation
// de mot de passe en clair côté client).
export async function envoyerLienReinitialisation(courriel) {
  const { error } = await supabase.auth.resetPasswordForEmail(courriel, {
    // La page existe depuis 2026-08-07 — elle sert aux invitations ET
    // aux réinitialisations.
    redirectTo: `${window.location.origin}/choisir-mot-de-passe`,
  });
  if (error) throw error;
}
