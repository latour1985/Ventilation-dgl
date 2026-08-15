// lib/supabase/devis.js
//
// Persistance des devis (soumissions). Avant, ils vivaient uniquement
// dans la mémoire du navigateur et disparaissaient au rechargement.
//
// VERSIONS : un devis peut être révisé plusieurs fois. Toutes les
// révisions partagent le même « numéro de dossier » (numero_base) :
//   DEV-3500      version 0  (originale)
//   DEV-3500-1    version 1
//   DEV-3500-2    version 2  ← version active
// Une seule version est ACTIVE à la fois ; les autres sont archivées en
// lecture seule pour qu'on puisse toujours revoir ce que le client a reçu.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    numero: row.numero,
    // Numéro de dossier partagé par toutes les révisions (DEV-3500).
    numeroBase: row.numero_base || row.numero,
    // L'« estimate » QuickBooks du dossier — UN par devis, mis à jour
    // aux révisions (le devis vit dans l'app ET dans QuickBooks).
    qboEstimateId: row.qbo_estimate_id || null,
    version: row.version ?? 0,
    versionActive: row.version_active !== false,
    clientId: row.client_id || null,
    clientNom: row.client_nom || "",
    lignes: Array.isArray(row.lignes) ? row.lignes : [],
    totalCoutant: Number(row.total_coutant) || 0,
    totalVendant: Number(row.total_vendant) || 0,
    statut: row.statut || "envoye",
    date: row.date_emission,
    courrielEnvoi: row.courriel_envoi || null,
    courrielsEnvoi: Array.isArray(row.courriels_envoi) ? row.courriels_envoi : [],
    estContrat: !!row.est_contrat,
    frequenceFacturationAnnuelle: row.frequence_facturation || null,
    // Raison de la révision (« le client veut retirer le rooftop »).
    noteVersion: row.note_version || "",
    // Suivi du traitement une fois le devis accepté.
    traite: !!row.traite,
    modeTraitement: row.mode_traitement || null, // "bon_travail" | "projet"
    projetId: row.projet_id || null,
    creeLe: row.created_at || null,
    // LIEN PUBLIC + RÉPONSE DU CLIENT (preuve d'acceptation).
    jetonPublic: row.jeton_public || null,
    jetonExpireLe: row.jeton_expire_le || null,
    reponseClient: row.reponse_client || null, // accepte | refuse | modification
    reponduLe: row.repondu_le || null,
    reponduParNom: row.repondu_par_nom || "",
    messageClient: row.message_client || "",
    conditionsVersion: row.conditions_version || null,
  };
}

export async function listerDevis() {
  const { data, error } = await supabase
    .from("devis_app")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderDevis(d) {
  const { error } = await supabase.from("devis_app").upsert({
    id: d.id,
    numero: d.numero,
    numero_base: d.numeroBase || d.numero,
    qbo_estimate_id: d.qboEstimateId || null,
    version: d.version ?? 0,
    version_active: d.versionActive !== false,
    client_id: d.clientId || null,
    client_nom: d.clientNom || null,
    lignes: d.lignes || [],
    total_coutant: d.totalCoutant ?? 0,
    total_vendant: d.totalVendant ?? 0,
    statut: d.statut || "envoye",
    date_emission: d.date,
    courriel_envoi: d.courrielEnvoi || null,
    courriels_envoi: d.courrielsEnvoi || [],
    est_contrat: !!d.estContrat,
    frequence_facturation: d.frequenceFacturationAnnuelle || null,
    note_version: d.noteVersion || null,
    traite: !!d.traite,
    mode_traitement: d.modeTraitement || null,
    projet_id: d.projetId || null,
    // LIEN PUBLIC D'ACCEPTATION — jeton aléatoire et date d'expiration
    // (30 jours, comme la clause 1 sur la validité des prix).
    jeton_public: d.jetonPublic || null,
    jeton_expire_le: d.jetonExpireLe || null,
  });
  if (error) throw error;
}

// Archive toutes les révisions d'un dossier sauf celle qui devient
// active — garantit qu'une seule version est « courante » à la fois.
export async function activerVersionDevis(numeroBase, idActif) {
  const { error: e1 } = await supabase.from("devis_app").update({ version_active: false }).eq("numero_base", numeroBase);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("devis_app").update({ version_active: true }).eq("id", idActif);
  if (e2) throw e2;
}

export async function supprimerDevis(id) {
  const { error } = await supabase.from("devis_app").delete().eq("id", id);
  if (error) throw error;
}

export function sAbonnerDevis(onChangement) {
  const canal = supabase
    .channel("devis-app")
    .on("postgres_changes", { event: "*", schema: "public", table: "devis_app" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
