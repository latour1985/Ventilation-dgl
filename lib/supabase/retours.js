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

export function sAbonnerRetours(onChangement) {
  const canal = supabase
    .channel("retours-logiciel")
    .on("postgres_changes", { event: "*", schema: "public", table: "retours_logiciel" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
