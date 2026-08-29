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
    // ✅ Réponse du client CLASSÉE par le bureau (snippet 104) : sert au
    // bloc « Réponses de tes clients ». Une demande de modification à
    // laquelle on a répondu par téléphone, ou un refus pris en note, se
    // range d'un clic. Null = encore à traiter.
    reponseTraiteeLe: row.reponse_traitee_le || null,
  };
}

// Les trois réponses de client qui demandent une action du bureau —
// calculées sur la VERSION ACTIVE seulement : faire une nouvelle version
// classe donc automatiquement la demande de modification (l'ancienne
// version cesse d'être active), sans rien à cocher.
export function reponsesClientATraiter(devisListe) {
  return (devisListe || [])
    .filter((d) => d.versionActive !== false && !d.reponseTraiteeLe)
    .map((d) => {
      if (d.reponseClient === "modification") return { devis: d, genre: "modification" };
      // Accepté mais pas encore converti en projet ou en bon de travail.
      if (d.statut === "accepte" && !d.traite) return { devis: d, genre: "accepte" };
      if (d.reponseClient === "refuse") return { devis: d, genre: "refuse" };
      return null;
    })
    .filter(Boolean)
    // Ordre d'urgence : le client qui attend une réponse d'abord, puis
    // l'argent à convertir, puis les refus (pour information).
    .sort((a, b) => {
      const rang = { modification: 0, accepte: 1, refuse: 2 };
      return rang[a.genre] - rang[b.genre] || String(b.devis.reponduLe || "").localeCompare(String(a.devis.reponduLe || ""));
    });
}

// Classe une réponse (« j'ai appelé le client », « refus pris en note »).
export async function classerReponseDevis(id, classee = true) {
  const { error } = await supabase
    .from("devis_app")
    .update({ reponse_traitee_le: classee ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
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
  // ⚠️ VÉCU (diagnostic empirique 2026-08-17) : la colonne
  // qbo_estimate_id (snippet SQL 48) n'avait jamais été créée en
  // production — CHAQUE devis depuis le 2026-08-15 échouait à
  // l'enregistrement (PGRST204), l'erreur avalée en silence, d'où les
  // liens morts (DEV-3509 à 3513). Deux protections désormais :
  // l'erreur REMONTE avec son vrai message, et si c'est précisément
  // cette colonne qui manque, on réessaie SANS elle plutôt que de
  // perdre le devis (le miroir QuickBooks est un extra, jamais vital).
  const ligne = {
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
  };
  const { error } = await supabase.from("devis_app").upsert(ligne);
  if (error && error.code === "PGRST204" && /qbo_estimate_id/.test(error.message || "")) {
    const { qbo_estimate_id: _absent, ...sansQbo } = ligne;
    const { error: e2 } = await supabase.from("devis_app").upsert(sansQbo);
    if (e2) throw e2;
    return;
  }
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
