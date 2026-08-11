// lib/supabase/prixDepots.js
//
// Liste de prix des dépôts d'appels de service, par ZONE (1, 2, 3,
// 4-Montréal). Modifiable par l'Admin principal (onglet Utilisateurs)
// et persistée. « Hors zone » n'a pas de prix fixe : tarif sur mesure,
// saisi manuellement à la création de la tâche.

import { supabase } from "./client";

// Zone 4 (Montréal) ajoutée le 2026-08-10 à la demande du propriétaire
// — mêmes règles que les zones 1-2-3 (temps inclus CHEZ le client,
// transport compris dans le prix de zone).
export const ZONES_DEPOTS = ["Zone 1", "Zone 2", "Zone 3", "Zone 4 (Montréal)"];

// Clés de configuration des appels de service (stockées dans la même
// table) : temps minimum INCLUS chez le client, puis facturation du
// dépassement au taux horaire VENDANT des techniciens.
export const CLE_TAUX_VENDANT = "taux_horaire_vendant";
export const CLE_MINUTES_INCLUSES = "minutes_incluses"; // zones 1-2-3 : temps CHEZ LE CLIENT (transport inclus dans le prix de zone)
export const CLE_MINUTES_HORS_ZONE = "minutes_incluses_hors_zone"; // hors zone : transport aller-retour depuis l'entrepôt + temps sur place

export async function listerPrixDepots() {
  const { data, error } = await supabase.from("prix_depots").select("*");
  if (error) throw error;
  const parZone = {};
  (data || []).forEach((r) => {
    parZone[r.zone] = Number(r.montant_ht) || 0;
  });
  return parZone;
}

export async function sauvegarderPrixDepots(parZone) {
  const cles = [...ZONES_DEPOTS, CLE_TAUX_VENDANT, CLE_MINUTES_INCLUSES, CLE_MINUTES_HORS_ZONE];
  const lignes = cles.map((cle) => ({
    zone: cle,
    montant_ht: Number(parZone?.[cle]) || 0,
  }));
  const { error } = await supabase.from("prix_depots").upsert(lignes);
  if (error) throw error;
}
