// lib/supabase/photosTravaux.js
//
// Téléversement des photos de chantier (avant/après) vers le stockage
// Supabase (bucket « photos-travaux », voir snippet SQL 15). Chaque photo
// est déjà compressée par l'app technicien (~100-200 Ko) avant l'envoi.
// L'URL publique retournée est enregistrée avec le travail complété —
// c'est elle qui s'affiche au bureau, sur le bon de travail client et
// dans le PDF.

import { supabase } from "./client";

const BUCKET = "photos-travaux";

function nettoyer(texte) {
  return String(texte || "inconnu").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Téléverse un blob JPEG et retourne son URL publique.
export async function televerserPhotoTravail(blob) {
  const { data: infoSession } = await supabase.auth.getSession();
  const courriel = nettoyer(infoSession?.session?.user?.email);
  const chemin = `${courriel}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  return data.publicUrl;
}

// ------------------------------------------------------------
// PIÈCES JOINTES D'UNE TÂCHE (bureau → technicien)
// ------------------------------------------------------------
// Photos du site, plans PDF — attachés à la CRÉATION de la tâche par le
// bureau, affichés sur le téléphone du technicien. Même bucket que les
// photos de chantier (aucun SQL de plus), sous un dossier distinct.
export async function televerserPieceJointeTache(fichier, { blob = null, contentType = null } = {}) {
  const extension = (fichier.name || "").split(".").pop()?.toLowerCase() || "bin";
  const chemin = `pieces-jointes-taches/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nettoyer(fichier.name?.replace(/\.[^.]+$/, ""))}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob || fichier, {
    contentType: contentType || fichier.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  return data.publicUrl;
}
