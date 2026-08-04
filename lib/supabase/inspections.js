// lib/supabase/inspections.js
//
// Inspections journalières des véhicules + entretien périodique.
// PREMIER domaine branché en vrai (Phase 2) : le technicien soumet son
// inspection → elle est écrite dans `inspections_vehicules` → l'onglet
// admin la lit (et se met à jour en direct via Realtime).
//
// Identité du technicien : en mode test, on enregistre simplement le
// nom/courriel du compte connecté (colonnes technicien_nom /
// technicien_email) — le lien vers profils_utilisateurs viendra avec
// le durcissement pré-production.

import { supabase } from "./client";

// --- Conversion ligne BDD -> forme attendue par l'interface admin ---
function versUiInspection(row) {
  const controles = row.controles || {};
  return {
    id: row.id,
    date: row.date_inspection,
    technicienNom: row.technicien_nom || row.technicien_email || "—",
    technicienEmail: (row.technicien_email || "").toLowerCase(),
    sansVehicule: !!row.sans_vehicule,
    // PASSAGER : dans le camion d'un collègue (nommé). Pas d'inspection
    // à faire — un camion, une inspection, celle du conducteur. Sert au
    // coûtant (pas de coût camion pour lui) et à la facturation (taux
    // réduit du 2e technicien dans le même camion).
    passagerDeNom: row.passager_de_nom || "",
    passagerDeEmail: (row.passager_de_email || "").toLowerCase(),
    // Coût horaire du camion FIGÉ ce matin-là — les vieilles journées
    // gardent leur taux quand le réglage change.
    coutCamionHoraire: row.cout_camion_horaire != null ? Number(row.cout_camion_horaire) : null,
    camion: row.numero_camion || "",
    km: row.kilometrage,
    anomalie: !!row.a_anomalie,
    remarque: row.remarque_anomalie || "",
    controleProblemes: Object.keys(controles).filter((c) => controles[c] === "probleme"),
    statutAnomalie: row.statut_anomalie || "aucune",
    noteCharge: row.note_prise_en_charge || "",
    prisParNom: row.pris_en_charge_par_nom || "",
    // Photos de l'anomalie — `photo_url` est l'ancienne colonne à une
    // seule photo, gardée pour les fiches d'avant le passage au tableau.
    photos: Array.isArray(row.photos) ? row.photos : row.photo_url ? [row.photo_url] : [],
  };
}

function versUiEntretien(row) {
  return {
    id: row.id,
    camion: row.numero_camion,
    km: row.kilometrage,
    date: row.date_entretien,
  };
}

export async function listerInspections() {
  const { data, error } = await supabase
    .from("inspections_vehicules")
    .select("*")
    .order("date_inspection", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(versUiInspection);
}

export async function listerEntretiens() {
  const { data, error } = await supabase
    .from("entretiens_vehicules")
    .select("*")
    .order("date_entretien", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(versUiEntretien);
}

// Soumission depuis l'app technicien. `donnees` = l'objet du formulaire
// (sansVehicule, camion, km, controles, remarque, anomalie), `session` =
// la session Supabase du technicien connecté.
export async function enregistrerInspection(donnees, session) {
  const email = session?.user?.email || null;
  const nom = session?.user?.user_metadata?.nom || (email ? email.split("@")[0] : null);
  const { error } = await supabase.from("inspections_vehicules").insert({
    date_inspection: donnees.date,
    sans_vehicule: !!donnees.sansVehicule,
    numero_camion: donnees.camion || null,
    kilometrage: donnees.km ?? null,
    controles: donnees.controles || {},
    remarque_anomalie: donnees.remarque || null,
    a_anomalie: !!donnees.anomalie,
    statut_anomalie: donnees.anomalie ? "nouvelle" : "aucune",
    technicien_nom: nom,
    technicien_email: email,
    // Passager d'un collègue (bloc 6) + coût camion figé du jour (bloc 5).
    passager_de_nom: donnees.passagerDeNom || null,
    passager_de_email: donnees.passagerDeEmail || null,
    cout_camion_horaire: donnees.coutCamionHoraire ?? null,
    // Liens des photos de l'anomalie (stockage Supabase) — c'est ce que
    // le bureau affiche dans le dossier du véhicule. Avant, aucune
    // photo n'existait : le bouton du technicien était un leurre.
    photos: Array.isArray(donnees.photos) ? donnees.photos : [],
  });
  if (error) throw error;
}

export async function prendreEnChargeInspection(id, note, parNom) {
  const { error } = await supabase
    .from("inspections_vehicules")
    .update({
      statut_anomalie: "prise_en_charge",
      note_prise_en_charge: note,
      pris_en_charge_par_nom: parNom || "l'administrateur",
      pris_en_charge_le: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// FERMETURE DE L'ANOMALIE : la réparation est faite. L'anomalie cesse
// d'apparaître comme ouverte et le camion peut redevenir conforme.
// Le détail des travaux est enregistré séparément au carnet du véhicule.
export async function marquerAnomalieReparee(id) {
  const { error } = await supabase
    .from("inspections_vehicules")
    .update({ statut_anomalie: "reparee" })
    .eq("id", id);
  if (error) throw error;
}

export async function creerEntretien({ camion, km }) {
  // Date LOCALE (Québec), pas UTC : après ~20 h, toISOString() donnerait
  // déjà la date du lendemain sur la fiche d'entretien.
  const d = new Date();
  const dateLocale = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { error } = await supabase.from("entretiens_vehicules").insert({
    numero_camion: camion,
    kilometrage: km,
    date_entretien: dateLocale,
  });
  if (error) throw error;
}

// Abonnement Realtime : `onChangement` est rappelé à chaque insertion /
// mise à jour dans les deux tables (l'admin re-liste alors les données).
// Retourne une fonction de désabonnement.
export function sAbonnerInspections(onChangement) {
  const canal = supabase
    .channel("inspections-vehicules")
    .on("postgres_changes", { event: "*", schema: "public", table: "inspections_vehicules" }, onChangement)
    .on("postgres_changes", { event: "*", schema: "public", table: "entretiens_vehicules" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
