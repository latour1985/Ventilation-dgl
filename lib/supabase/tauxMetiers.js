// lib/supabase/tauxMetiers.js
//
// Persistance de la grille des taux horaires coûtants (métier × niveau)
// + résolution du taux d'un employé par courriel. C'est la brique qui
// permet le « taux FIGÉ au moment de la saisie » (spec contrôle de
// gestion) : quand un technicien termine une tâche, on fige le taux en
// vigueur ce jour-là sur la ligne de travail.

import { supabase } from "./client";

// Grille complète -> forme de l'app : { Frigoriste: { "Apprenti 1": 45, ... }, ... }
export async function listerTaux() {
  const { data, error } = await supabase.from("taux_metiers").select("*");
  if (error) throw error;
  const grille = {};
  (data || []).forEach((r) => {
    grille[r.metier] = grille[r.metier] || {};
    grille[r.metier][r.niveau] = Number(r.taux) || 0;
  });
  return grille;
}

// Sauvegarde la grille complète (upsert de chaque case).
export async function sauvegarderTaux(tauxMetiers) {
  const lignes = [];
  Object.entries(tauxMetiers || {}).forEach(([metier, niveaux]) => {
    Object.entries(niveaux || {}).forEach(([niveau, taux]) => {
      lignes.push({ metier, niveau, taux: Number(taux) || 0 });
    });
  });
  if (lignes.length === 0) return;
  const { error } = await supabase.from("taux_metiers").upsert(lignes);
  if (error) throw error;
}

// Taux coûtant actuel d'un employé (via sa fiche du répertoire).
// Règles (spec contrôle de gestion) :
// - Métier de BUREAU (adjointe, chargé de projet, estimateur,
//   répartiteur, directeur) : taux horaire INDIVIDUEL de la fiche.
// - Métier de TERRAIN (frigoriste, ferblantier) : grille CCQ
//   (taux_metiers, métier × niveau) + PRIME horaire individuelle
//   éventuelle (entente avec l'employé).
// Retourne null si introuvable — l'appelant garde alors un taux nul et
// l'admin retombera sur le taux par défaut du projet.
export async function tauxPourCourriel(courriel) {
  if (!courriel) return null;
  const { data: emp } = await supabase
    .from("repertoire_employes")
    .select("metier, niveau, taux_horaire, prime_horaire")
    .eq("courriel", courriel.toLowerCase())
    .maybeSingle();
  if (!emp) return null;
  // Taux individuel (métiers de bureau) — prioritaire s'il est défini.
  const tauxIndividuel = Number(emp.taux_horaire);
  if (tauxIndividuel > 0) return tauxIndividuel;
  // Grille CCQ + prime individuelle (métiers de terrain).
  if (!emp.metier || !emp.niveau) return null;
  const { data: ligne } = await supabase
    .from("taux_metiers")
    .select("taux")
    .eq("metier", emp.metier)
    .eq("niveau", emp.niveau)
    .maybeSingle();
  const base = Number(ligne?.taux);
  if (!(base > 0)) return null;
  const prime = Number(emp.prime_horaire) || 0;
  return base + prime;
}
