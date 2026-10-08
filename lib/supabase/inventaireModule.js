// lib/supabase/inventaireModule.js
//
// 📦 MODULE INVENTAIRE — OPTION PAYANTE (2026-10-08, snippet 170).
// Emplacements (entrepôt, camions, chantiers), stock par emplacement,
// mouvements (historique APPEND-ONLY). Le stock ne s'écrit JAMAIS
// directement : tout passe par les fonctions de la base
// (inv_mouvement, inv_valider_comptage, inv_importer_stock), qui
// vérifient l'entreprise, l'option active et le rôle.
//
// 🧪 EN CHANTIER : visible seulement sur la version d'essai
// (NEXT_PUBLIC_VERSION_ESSAI=1, posé par « npm run essayer ») — la
// production ne le montre pas tant que le propriétaire n'a pas dit GO.

import { supabase } from "./client";
import { lireParPages } from "./lireParPages";

export const INVENTAIRE_EN_ESSAI = process.env.NEXT_PUBLIC_VERSION_ESSAI === "1";

// L'option est visible si : version d'essai (pour l'instant) ET option
// activée par la plateforme pour cette entreprise.
export const inventaireDisponible = (config) => INVENTAIRE_EN_ESSAI && config?.optionInventaire === true;

export const TYPES_EMPLACEMENT = {
  entrepot: { icone: "🏭", libelle: "Entrepôt" },
  camion: { icone: "🚚", libelle: "Camion" },
  chantier: { icone: "🏗️", libelle: "Chantier" },
};

export const LIBELLES_MOUVEMENT = {
  import: "Import (non vérifié)",
  reception: "Réception",
  sortie: "Sortie",
  retour: "Retour",
  transfert: "Transfert",
  ajustement: "Ajustement",
  comptage: "Comptage",
};

// Les erreurs de la base arrivent en français (raise exception) — on les
// rend telles quelles, sinon un message générique.
const messageErreur = (error) => error?.message || "Opération refusée — réessaie.";

export async function listerEmplacements() {
  const { data, error } = await supabase
    .from("inv_emplacements")
    .select("*")
    .order("type", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw new Error(messageErreur(error));
  return (data || []).map((r) => ({
    id: r.id,
    nom: r.nom,
    type: r.type,
    responsableEmail: r.responsable_email || "",
    projetId: r.projet_id || null,
    actif: r.actif !== false,
  }));
}

export async function creerEmplacement({ nom, type, responsableEmail = null, projetId = null }) {
  const { data, error } = await supabase
    .from("inv_emplacements")
    .insert({ nom, type, responsable_email: responsableEmail ? String(responsableEmail).toLowerCase() : null, projet_id: projetId })
    .select("id")
    .single();
  if (error) throw new Error(messageErreur(error));
  return data.id;
}

export async function majEmplacement(id, champs) {
  const maj = {};
  if (champs.nom !== undefined) maj.nom = champs.nom;
  if (champs.responsableEmail !== undefined) maj.responsable_email = champs.responsableEmail ? String(champs.responsableEmail).toLowerCase() : null;
  if (champs.actif !== undefined) maj.actif = !!champs.actif;
  const { error } = await supabase.from("inv_emplacements").update(maj).eq("id", id);
  if (error) throw new Error(messageErreur(error));
}

export async function listerArticlesInventaire() {
  const data = await lireParPages(() =>
    supabase.from("inventaire_articles").select("*").order("nom", { ascending: true }).order("id", { ascending: true })
  );
  return (data || []).map((r) => ({
    id: r.id,
    nom: r.nom || "",
    unite: r.unite || "",
    codeProduit: r.code_produit || "",
    codeBarres: r.code_barres || "",
    coutMoyen: Number(r.cout_moyen) || 0,
    fournisseurNom: r.fournisseur_nom || "",
    // Quantité de l'ANCIEN écran — sert seulement à l'import.
    quantiteAncienne: Number(r.quantite) || 0,
    seuilAncien: Number(r.seuil_alerte) || 0,
  }));
}

// Fiche article : codes, fournisseur, coût moyen (saisie de départ).
export async function majArticleInventaire(id, champs) {
  const maj = { updated_at: new Date().toISOString() };
  if (champs.nom !== undefined) maj.nom = champs.nom;
  if (champs.unite !== undefined) maj.unite = champs.unite || null;
  if (champs.codeProduit !== undefined) maj.code_produit = champs.codeProduit || null;
  if (champs.codeBarres !== undefined) maj.code_barres = champs.codeBarres ? String(champs.codeBarres).trim() : null;
  if (champs.fournisseurNom !== undefined) maj.fournisseur_nom = champs.fournisseurNom || null;
  if (champs.coutMoyen !== undefined) maj.cout_moyen = Math.max(0, Number(champs.coutMoyen) || 0);
  const { error } = await supabase.from("inventaire_articles").update(maj).eq("id", id);
  if (error) {
    if (/ux_inventaire_code_barres|duplicate key/i.test(error.message || "")) throw new Error("Ce code-barres est déjà utilisé par un autre article.");
    throw new Error(messageErreur(error));
  }
}

// Nouvel article (créé depuis l'inventaire) — quantité 0 dans l'ancien
// écran : son stock vit maintenant par emplacement.
export async function creerArticleInventaire({ nom, unite = "", codeProduit = "", codeBarres = "", fournisseurNom = "", coutMoyen = 0 }) {
  const id = `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await supabase.from("inventaire_articles").insert({
    id,
    nom,
    quantite: 0,
    unite: unite || null,
    code_produit: codeProduit || null,
    code_barres: codeBarres ? String(codeBarres).trim() : null,
    fournisseur_nom: fournisseurNom || null,
    cout_moyen: Math.max(0, Number(coutMoyen) || 0),
  });
  if (error) {
    if (/ux_inventaire_code_barres|duplicate key/i.test(error.message || "")) throw new Error("Ce code-barres est déjà utilisé par un autre article.");
    throw new Error(messageErreur(error));
  }
  return id;
}

export async function listerStock() {
  const data = await lireParPages(() =>
    supabase.from("inv_stock").select("*").order("article_id", { ascending: true }).order("emplacement_id", { ascending: true })
  );
  return (data || []).map((r) => ({
    articleId: r.article_id,
    emplacementId: r.emplacement_id,
    quantite: Number(r.quantite) || 0,
    seuilMin: r.seuil_min != null ? Number(r.seuil_min) : null,
    verifieLe: r.verifie_le || null,
    majLe: r.maj_le || null,
  }));
}

export async function majSeuil(articleId, emplacementId, seuil) {
  const { error } = await supabase
    .from("inv_stock")
    .update({ seuil_min: seuil === "" || seuil == null ? null : Math.max(0, Number(seuil) || 0) })
    .eq("article_id", articleId)
    .eq("emplacement_id", emplacementId);
  if (error) throw new Error(messageErreur(error));
}

export async function listerMouvements({ articleId = null, emplacementId = null, limite = 100 } = {}) {
  let req = supabase.from("inv_mouvements").select("*");
  if (articleId) req = req.eq("article_id", articleId);
  if (emplacementId) req = req.or(`de_emplacement.eq.${emplacementId},vers_emplacement.eq.${emplacementId}`);
  const { data, error } = await req.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limite);
  if (error) throw new Error(messageErreur(error));
  return (data || []).map((r) => ({
    id: r.id,
    articleId: r.article_id,
    type: r.type,
    de: r.de_emplacement || null,
    vers: r.vers_emplacement || null,
    quantite: Number(r.quantite) || 0,
    coutUnitaire: r.cout_unitaire != null ? Number(r.cout_unitaire) : null,
    tacheId: r.tache_id || null,
    bcNumero: r.bc_numero || null,
    note: r.note || "",
    parEmail: r.par_email || "",
    le: r.created_at,
  }));
}

// type : reception | sortie | retour | transfert | ajustement
export async function enregistrerMouvement({ articleId, type, de = null, vers = null, quantite, cout = null, tacheId = null, bcNumero = null, note = null }) {
  const { data, error } = await supabase.rpc("inv_mouvement", {
    p_article: articleId,
    p_type: type,
    p_de: de,
    p_vers: vers,
    p_quantite: Number(quantite),
    p_cout: cout == null || cout === "" ? null : Number(cout),
    p_tache: tacheId,
    p_bc: bcNumero,
    p_note: note,
  });
  if (error) throw new Error(messageErreur(error));
  return data;
}

// lignes : [{ articleId, compte }]
export async function validerComptage(emplacementId, lignes, note = null) {
  const { data, error } = await supabase.rpc("inv_valider_comptage", {
    p_emplacement: emplacementId,
    p_lignes: lignes.map((l) => ({ article_id: l.articleId, compte: Number(l.compte) })),
    p_note: note,
  });
  if (error) throw new Error(messageErreur(error));
  return Number(data) || 0;
}

export async function importerStockExistant(emplacementId) {
  const { data, error } = await supabase.rpc("inv_importer_stock", { p_emplacement: emplacementId });
  if (error) throw new Error(messageErreur(error));
  return Number(data) || 0;
}
