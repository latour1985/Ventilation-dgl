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
import { lireParPages } from "./lireParPages";

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
  // 📚 Par pages (bilan 2026-09-03) — un article mémorisé par produit commandé.
  const data = await lireParPages(() => supabase.from("articles_fournisseurs").select("article, fournisseur_nom").order("article"));
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
// 🔗 RATTACHEMENT À UNE TÂCHE (2026-08-25, snippet 77) : un achat fait
// POUR une job (le Midea de tel client) porte la tâche et un MONTANT
// ATTRIBUÉ — ajustable à la baisse quand on profite de la commande pour
// ajouter du stock : seule la part de la job compte dans son coût.
// 👤 RATTACHEMENT DIRECT À UN CLIENT (2026-08-26, snippet 79) : l'achat
// fait pour un client précis mais sans tâche ni projet (l'unité
// commandée avant que la job soit à l'horaire). Le coût remonte dans
// « par client », et QuickBooks suit par le numéro de BC.
export async function creerAchatLibre({ numeroBc, fournisseurNom, description, montantHT, dateAchat, tacheId, tacheTitre, clientId, clientNom, montantAttribue }, session) {
  const base = {
    numero_bc: numeroBc || null,
    fournisseur_nom: fournisseurNom || null,
    description: description || null,
    montant_ht: Number(montantHT) || 0,
    cree_par: session?.user?.email || null,
    date_achat: dateAchat || null,
  };
  const avecRattachement =
    tacheId || clientId
      ? {
          ...base,
          tache_id: tacheId || null,
          tache_titre: tacheTitre || null,
          client_id: clientId || null,
          client_nom: clientNom || null,
          // Jamais plus que la facture — et à défaut de choix, tout.
          montant_attribue: Math.min(Number(montantAttribue ?? montantHT) || 0, Number(montantHT) || 0),
        }
      : base;
  let { error } = await supabase.from("achats_libres").insert(avecRattachement);
  // ⚠️ FILET COLONNE MANQUANTE (même leçon que les devis du 2026-08-15) :
  // snippet 77/79 pas encore passé → on réessaie SANS le rattachement
  // plutôt que de perdre l'achat. Le lien pourra se refaire après.
  if (error && (tacheId || clientId) && (error.code === "PGRST204" || /tache_id|montant_attribue|client_id/.test(error.message || ""))) {
    ({ error } = await supabase.from("achats_libres").insert(base));
  }
  if (error) throw error;
}

// ✏️ MODIFICATION D'UN BON DE COMMANDE (2026-08-26) — la liste était en
// lecture seule : une erreur de frappe, un prix ajusté par le
// fournisseur ou un rattachement à refaire exigeaient de tout recréer.
// `champs` ne porte QUE ce qui change ; les clés absentes ne bougent pas.
export async function majAchatLibre(id, champs) {
  const maj = {};
  if (champs.fournisseurNom !== undefined) maj.fournisseur_nom = champs.fournisseurNom || null;
  if (champs.description !== undefined) maj.description = champs.description || null;
  if (champs.montantHT !== undefined) maj.montant_ht = Number(champs.montantHT) || 0;
  if (champs.tacheId !== undefined) maj.tache_id = champs.tacheId || null;
  if (champs.tacheTitre !== undefined) maj.tache_titre = champs.tacheTitre || null;
  if (champs.clientId !== undefined) maj.client_id = champs.clientId || null;
  if (champs.clientNom !== undefined) maj.client_nom = champs.clientNom || null;
  if (champs.montantAttribue !== undefined) {
    maj.montant_attribue = champs.montantAttribue == null ? null : Number(champs.montantAttribue) || 0;
  }
  if (Object.keys(maj).length === 0) return;
  let { error } = await supabase.from("achats_libres").update(maj).eq("id", id);
  // Filet colonne manquante (snippet 79) : une modification SANS client
  // passe quand même — seule la cible client exige le snippet.
  if (error && (error.code === "PGRST204" || /client_id/.test(error.message || ""))) {
    if (champs.clientId) throw error; // cible client : impossible sans le snippet
    const { client_id: _c, ...sansClient } = maj;
    if (Object.keys(sansClient).length === 0) return;
    ({ error } = await supabase.from("achats_libres").update(sansClient).eq("id", id));
  }
  if (error) throw error;
}

// 🗑️ Suppression définitive (BC de test, doublon). La confirmation en
// deux clics vit côté interface ; ici on exécute, c'est tout.
export async function supprimerAchatLibre(id) {
  const { error } = await supabase.from("achats_libres").delete().eq("id", id);
  if (error) throw error;
}

export async function listerAchatsLibres() {
  // 📚 PAR PAGES (2026-09-04) : le limit(50) rendait introuvable toute
  // commande plus vieille — or la Recherche rapide cherche maintenant
  // les numéros de BC (la boîte reçue peut avoir des mois). Règle du
  // projet : toute table qui grossit se lit par pages, ordre stable.
  const data = await lireParPages(() =>
    supabase.from("achats_libres").select("*").order("created_at", { ascending: false }).order("id", { ascending: true })
  );
  return (data || []).map((row) => ({
    id: row.id,
    numeroBc: row.numero_bc || "",
    fournisseurNom: row.fournisseur_nom || "",
    description: row.description || "",
    montantHT: Number(row.montant_ht) || 0,
    statut: row.statut || "commande",
    dateAchat: row.date_achat || null,
    creeLe: row.created_at || null,
    // Rattachement à une job ou à un client (null = achat général / stock).
    tacheId: row.tache_id || null,
    tacheTitre: row.tache_titre || "",
    clientId: row.client_id || null,
    clientNom: row.client_nom || "",
    montantAttribue: row.montant_attribue != null ? Number(row.montant_attribue) : null,
  }));
}
