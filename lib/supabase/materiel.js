// lib/supabase/materiel.js
//
// MATÉRIEL — deux des trois flux décidés avec le propriétaire
// (2026-08-15) :
//
//   1. COMMANDES CAMION (technicien → bureau) : le technicien demande
//      son réapprovisionnement ; le bureau passe la vraie commande et
//      clique « Commande passée » (+ note facultative). Boucle courte,
//      pas d'étape « reçue » — le stock arrive dans son camion.
//   2. ACHATS LIBRES : un bon de commande sans tâche ni projet
//      (« 4 rouleaux de tape »). Ceux attribués à un PROJET passent
//      plutôt par projets_app.bons_commande — le circuit de coûts
//      existant.
//
// (Le 3e flux — matériel du STOCK attribué à un projet — vit sur
// l'objet projet, voir lib/supabase/projets.js.)

import { supabase } from "./client";

// ------------------------------------------------------------
// FLUX 1 — COMMANDES DE MATÉRIEL CAMION
// ------------------------------------------------------------
function commandeVersUi(row) {
  return {
    id: row.id,
    technicienEmail: (row.technicien_email || "").toLowerCase(),
    technicienNom: row.technicien_nom || row.technicien_email || "—",
    lignes: Array.isArray(row.lignes) ? row.lignes : [],
    noteTechnicien: row.note_technicien || "",
    statut: row.statut || "envoyee",
    noteBureau: row.note_bureau || "",
    commandeePar: row.commandee_par || "",
    commandeeLe: row.commandee_le || null,
    creeLe: row.created_at || null,
  };
}

export async function enregistrerCommandeCamion({ lignes, note }, session) {
  const email = session?.user?.email?.toLowerCase() || null;
  const nom = session?.user?.user_metadata?.nom || (email ? email.split("@")[0] : null);
  const { error } = await supabase.from("commandes_camion").insert({
    technicien_email: email,
    technicien_nom: nom,
    lignes: lignes || [],
    note_technicien: note || null,
  });
  if (error) throw error;
}

// Les demandes du technicien connecté — pour afficher le statut sur son
// téléphone (« ✓ Commande passée » + la note du bureau).
export async function listerCommandesCamionPourEmploye(courriel) {
  if (!courriel) return [];
  const { data, error } = await supabase
    .from("commandes_camion")
    .select("*")
    .eq("technicien_email", courriel.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).map(commandeVersUi);
}

// Toutes les demandes — pour la personne des achats au bureau.
export async function listerCommandesCamion() {
  const { data, error } = await supabase
    .from("commandes_camion")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map(commandeVersUi);
}

// « ✓ Commande passée » — le seul geste du bureau. La note est
// FACULTATIVE et visible au technicien (ex. « arrive jeudi »).
export async function marquerCommandeCamionPassee(id, note, session) {
  const { error } = await supabase
    .from("commandes_camion")
    .update({
      statut: "commandee",
      note_bureau: note || null,
      commandee_par: session?.user?.email || null,
      commandee_le: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------
// MÉMOIRE ARTICLE → FOURNISSEUR (commande groupée, 2026-08-17).
// ------------------------------------------------------------
// Se souvient chez QUI chaque article a été commandé la dernière fois :
// la semaine suivante, la commande groupée arrive pré-assignée.
export async function listerMemoireFournisseurs() {
  const { data, error } = await supabase.from("articles_fournisseurs").select("article, fournisseur_nom");
  if (error) throw error;
  const memoire = {};
  (data || []).forEach((r) => {
    memoire[r.article] = r.fournisseur_nom;
  });
  return memoire;
}

export async function memoriserFournisseursArticles(assignations) {
  const lignes = (assignations || [])
    .filter((a) => a.article && a.fournisseurNom)
    .map((a) => ({ article: a.article, fournisseur_nom: a.fournisseurNom, updated_at: new Date().toISOString() }));
  if (lignes.length === 0) return;
  const { error } = await supabase.from("articles_fournisseurs").upsert(lignes);
  if (error) throw error;
}

export function sAbonnerCommandesCamion(onChangement) {
  const canal = supabase
    .channel("commandes-camion")
    .on("postgres_changes", { event: "*", schema: "public", table: "commandes_camion" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

// ------------------------------------------------------------
// FLUX 2 — ACHATS LIBRES (BC sans projet)
// ------------------------------------------------------------
export async function creerAchatLibre({ numeroBc, fournisseurNom, description, montantHT, dateAchat }, session) {
  const { error } = await supabase.from("achats_libres").insert({
    numero_bc: numeroBc || null,
    fournisseur_nom: fournisseurNom || null,
    description: description || null,
    montant_ht: Number(montantHT) || 0,
    cree_par: session?.user?.email || null,
    date_achat: dateAchat || null,
  });
  if (error) throw error;
}

export async function listerAchatsLibres() {
  const { data, error } = await supabase
    .from("achats_libres")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    numeroBc: row.numero_bc || "",
    fournisseurNom: row.fournisseur_nom || "",
    description: row.description || "",
    montantHT: Number(row.montant_ht) || 0,
    statut: row.statut || "commande",
    dateAchat: row.date_achat || null,
    creeLe: row.created_at || null,
  }));
}
