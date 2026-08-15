// lib/supabase/tauxMetiers.js
//
// Persistance de la grille des taux horaires coûtants (métier × niveau)
// + résolution du taux d'un employé par courriel. C'est la brique qui
// permet le « taux FIGÉ au moment de la saisie » (spec contrôle de
// gestion) : quand un technicien termine une tâche, on fige le taux en
// vigueur ce jour-là sur la ligne de travail.

import { supabase } from "./client";

// Grilles complètes -> forme de l'app :
//   { com: { Frigoriste: { "Apprenti 1": 45, ... } }, res: { ... } }
// DEUX SECTEURS CCQ (2026-08-15, demande du propriétaire) : le même
// compagnon ne coûte pas le même prix en commercial qu'en résidentiel.
// `com` garde la sémantique historique de la colonne `taux`.
export async function listerTaux() {
  const { data, error } = await supabase.from("taux_metiers").select("*");
  if (error) throw error;
  const com = {};
  const res = {};
  (data || []).forEach((r) => {
    com[r.metier] = com[r.metier] || {};
    com[r.metier][r.niveau] = Number(r.taux) || 0;
    res[r.metier] = res[r.metier] || {};
    res[r.metier][r.niveau] = Number(r.taux_residentiel) || 0;
  });
  return { com, res };
}

// Sauvegarde les DEUX grilles (upsert de chaque case métier × niveau).
export async function sauvegarderTaux(tauxCom, tauxRes = {}) {
  const lignes = [];
  Object.entries(tauxCom || {}).forEach(([metier, niveaux]) => {
    Object.entries(niveaux || {}).forEach(([niveau, taux]) => {
      lignes.push({
        metier,
        niveau,
        taux: Number(taux) || 0,
        taux_residentiel: Number(tauxRes?.[metier]?.[niveau]) || 0,
      });
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
// `secteur` : "commercial" (défaut) ou "residentiel". Un taux
// résidentiel absent (0) RETOMBE sur le commercial — une grille à
// moitié remplie ne doit jamais donner une paie à zéro.
// Retourne { taux, secteurPaie } — `secteurPaie` peut différer du
// secteur de la TÂCHE : un employé au DROIT ACQUIS « toujours
// commercial » est payé commercial même sur une job résidentielle, et
// la feuille de temps doit refléter la PAIE réelle, pas la tâche.
export async function tauxEtSecteurPourCourriel(courriel, secteurTache = "commercial") {
  if (!courriel) return { taux: null, secteurPaie: secteurTache };
  const { data: emp } = await supabase
    .from("repertoire_employes")
    .select("metier, niveau, taux_horaire, prime_horaire, toujours_commercial")
    .eq("courriel", courriel.toLowerCase())
    .maybeSingle();
  if (!emp) return { taux: null, secteurPaie: secteurTache };
  const secteurPaie = emp.toujours_commercial ? "commercial" : secteurTache;
  const taux = await tauxDepuisFiche(emp, secteurPaie);
  return { taux, secteurPaie };
}

export async function tauxPourCourriel(courriel, secteur = "commercial") {
  const { taux } = await tauxEtSecteurPourCourriel(courriel, secteur);
  return taux;
}

async function tauxDepuisFiche(emp, secteur) {
  // Taux individuel (métiers de bureau) — prioritaire s'il est défini.
  const tauxIndividuel = Number(emp.taux_horaire);
  if (tauxIndividuel > 0) return tauxIndividuel;
  // Grille CCQ + prime individuelle (métiers de terrain).
  if (!emp.metier || !emp.niveau) return null;
  const { data: ligne } = await supabase
    .from("taux_metiers")
    .select("taux, taux_residentiel")
    .eq("metier", emp.metier)
    .eq("niveau", emp.niveau)
    .maybeSingle();
  const base =
    secteur === "residentiel" && Number(ligne?.taux_residentiel) > 0
      ? Number(ligne.taux_residentiel)
      : Number(ligne?.taux);
  if (!(base > 0)) return null;
  const prime = Number(emp.prime_horaire) || 0;
  return base + prime;
}
