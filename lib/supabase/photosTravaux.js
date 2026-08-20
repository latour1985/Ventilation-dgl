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
// `origine` : "camera" (prise EN DIRECT dans l'app — valeur de preuve)
// ou "galerie" (importée du téléphone). L'étiquette est gravée dans le
// NOM DU FICHIER : elle suit l'URL partout sans changer aucun schéma,
// et le bureau l'affiche — on sait toujours ce qui a été pris sur place.
export async function televerserPhotoTravail(blob, origine = "camera") {
  const { data: infoSession } = await supabase.auth.getSession();
  const courriel = nettoyer(infoSession?.session?.user?.email);
  const suffixe = origine === "galerie" ? "-galerie" : "";
  const chemin = `${courriel}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffixe}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  return data.publicUrl;
}

// 🎥 VIDÉO DE CHANTIER (2026-08-20, demande du propriétaire) — une
// courte séquence dit parfois ce que dix photos n'expliquent pas : un
// bruit anormal, une vibration, une fuite qui coule.
//
// PAS DE COMPRESSION possible dans le navigateur (contrairement aux
// photos) : le fichier part TEL QUEL. Une vidéo de téléphone pèse vite
// des dizaines de mégaoctets — d'où le plafond ci-dessous, annoncé
// clairement au technicien plutôt qu'un échec obscur au téléversement.
export const VIDEO_MAX_OCTETS = 45 * 1024 * 1024; // 45 Mo (~30-40 s)

export async function televerserVideoTravail(fichier) {
  if (!fichier) throw new Error("Aucune vidéo.");
  if (fichier.size > VIDEO_MAX_OCTETS) {
    throw new Error(
      `Vidéo trop lourde (${Math.round(fichier.size / 1024 / 1024)} Mo) — filme plus court (maximum ${Math.round(VIDEO_MAX_OCTETS / 1024 / 1024)} Mo).`
    );
  }
  const { data: infoSession } = await supabase.auth.getSession();
  const courriel = nettoyer(infoSession?.session?.user?.email);
  const extension = (fichier.name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const chemin = `${courriel}/${new Date().toISOString().slice(0, 10)}/video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, fichier, {
    contentType: fichier.type || "video/mp4",
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

// ------------------------------------------------------------
// LÉGENDES — un titre/détail par photo (« fissure déjà présente à
// l'arrivée »), clé = l'URL de la photo. Écrites du terrain ou du
// bureau, affichées dans la visionneuse des deux applications.
// ------------------------------------------------------------
export async function listerLegendes(urls) {
  const propres = (urls || []).filter(Boolean);
  if (propres.length === 0) return {};
  const { data, error } = await supabase.from("photos_legendes").select("url, legende").in("url", propres);
  if (error) return {};
  const parUrl = {};
  (data || []).forEach((r) => { parUrl[r.url] = r.legende || ""; });
  return parUrl;
}

export async function sauvegarderLegende(url, legende, session) {
  if (!url) return;
  const { error } = await supabase.from("photos_legendes").upsert({
    url,
    legende: (legende || "").slice(0, 300) || null,
    modifie_par: session?.user?.email || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
