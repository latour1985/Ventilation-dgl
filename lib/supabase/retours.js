// lib/supabase/retours.js
//
// 💬 RETOURS SUR LE LOGICIEL — la communication en 2 ÉTAGES validée par
// le propriétaire (2026-09-02) :
//
//   TECHNICIEN  →  ADMIN de son entreprise  →  FLUXYA (console)
//   « ça bugge / j'ai une idée »   trie      ne reçoit que le transmis
//
// Le filtrage se fait au bon endroit : l'admin sait si « le bouton
// marche pas » est un vrai bug ou un malentendu — Fluxya ne reçoit que
// du pré-trié, avec le commentaire de l'admin par-dessus.
//
// Statuts : nouveau → regle-interne | refuse-interne | transmis
//           transmis → en-cours → regle | refuse   (côté Fluxya)

import { supabase } from "./client";

// Où les transmissions ARRIVENT (courriel d'avis) — l'adresse du
// fabricant du logiciel, pas celle de l'entreprise.
export const COURRIEL_PLATEFORME = "jeanfrancois@ventilationdgl.com";

export const LIBELLES_STATUT_RETOUR = {
  nouveau: "Nouveau",
  "regle-interne": "Réglé à l'interne",
  "refuse-interne": "Refusé",
  transmis: "Transmis à Fluxya",
  "en-cours": "En cours chez Fluxya",
  regle: "Réglé ✓",
  refuse: "Refusé par Fluxya",
};

function versUi(r) {
  return {
    id: r.id,
    entrepriseId: r.entreprise_id || "dgl",
    type: r.type || "bug",
    message: r.message || "",
    photoUrl: r.photo_url || null,
    contexte: r.contexte || null,
    auteurEmail: r.auteur_email || "",
    auteurNom: r.auteur_nom || "",
    statut: r.statut || "nouveau",
    reponseAdmin: r.reponse_admin || "",
    transmisLe: r.transmis_le || null,
    transmisPar: r.transmis_par || "",
    commentaireTransmission: r.commentaire_transmission || "",
    reponseFluxya: r.reponse_fluxya || "",
    traitePar: r.traite_par || "",
    creeLe: r.created_at || null,
  };
}

// Le technicien crée son retour — contexte capturé automatiquement.
export async function creerRetour({ type, message, photoUrl, contexte }, session) {
  const { error } = await supabase.from("retours_logiciel").insert({
    type: type === "idee" ? "idee" : "bug",
    message: String(message || "").trim().slice(0, 4000),
    photo_url: photoUrl || null,
    contexte: contexte || null,
    auteur_email: session?.user?.email?.toLowerCase() || null,
    auteur_nom: session?.user?.user_metadata?.nom || null,
  });
  if (error) throw error;
}

// ✍️ L'ADMIN écrit DIRECTEMENT à Fluxya (onglet Aide & suggestions,
// 2026-09-06) — pas de triage : l'admin EST le triage de son
// entreprise, son message naît « transmis ». Type « question » permis
// en plus de bug/idée.
export async function creerRetourAdmin({ type, message, photoUrl }, session) {
  const propre = ["bug", "idee", "question"].includes(type) ? type : "question";
  const { error } = await supabase.from("retours_logiciel").insert({
    type: propre,
    message: String(message || "").trim().slice(0, 4000),
    // 📷 Capture d'écran compressée (data URL) — voir OngletAide.
    photo_url: photoUrl || null,
    auteur_email: session?.user?.email?.toLowerCase() || null,
    auteur_nom: session?.user?.user_metadata?.nom || null,
    statut: "transmis",
    transmis_le: new Date().toISOString(),
    transmis_par: session?.user?.user_metadata?.nom || session?.user?.email || null,
  });
  if (error) throw error;
}

// « Mes signalements » (technicien) — les siens seulement, avec statuts.
export async function listerMesRetours(courriel) {
  if (!courriel) return [];
  const { data, error } = await supabase
    .from("retours_logiciel")
    .select("*")
    .eq("auteur_email", courriel.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(versUi);
}

// Le triage de l'admin — tous les retours de l'entreprise.
export async function listerRetoursEntreprise() {
  const { data, error } = await supabase
    .from("retours_logiciel")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(versUi);
}

// La console Fluxya — SEULEMENT ce qui a passé le triage des admins.
export async function listerRetoursTransmis() {
  const { data, error } = await supabase
    .from("retours_logiciel")
    .select("*")
    .in("statut", ["transmis", "en-cours", "regle", "refuse"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function majRetour(id, champs) {
  const bd = { updated_at: new Date().toISOString() };
  if (champs.statut !== undefined) bd.statut = champs.statut;
  if (champs.reponseAdmin !== undefined) bd.reponse_admin = champs.reponseAdmin || null;
  if (champs.transmisPar !== undefined) {
    bd.transmis_par = champs.transmisPar || null;
    bd.transmis_le = new Date().toISOString();
  }
  if (champs.commentaireTransmission !== undefined) bd.commentaire_transmission = champs.commentaireTransmission || null;
  if (champs.reponseFluxya !== undefined) bd.reponse_fluxya = champs.reponseFluxya || null;
  if (champs.traitePar !== undefined) bd.traite_par = champs.traitePar || null;
  const { error } = await supabase.from("retours_logiciel").update(bd).eq("id", id);
  if (error) throw error;
}

// ⚠️ NOM DE CANAL UNIQUE À CHAQUE APPEL (correctif 2026-09-06) : avec un
// nom FIXE, deux abonnés en même temps (le badge du menu admin ET
// l'onglet Aide & suggestions) récupèrent LE MÊME canal déjà souscrit —
// supabase-js lance alors « cannot add postgres_changes callbacks after
// subscribe() », React replante en boucle et Chrome tue la page
// (« This page couldn't load » sur /admin#aide). Un suffixe unique
// donne à chacun SON canal ; se désabonner n'éteint plus celui du voisin.
let compteurCanalRetours = 0;
export function sAbonnerRetours(onChangement) {
  compteurCanalRetours += 1;
  const canal = supabase
    .channel(`retours-logiciel-${compteurCanalRetours}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "retours_logiciel" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
