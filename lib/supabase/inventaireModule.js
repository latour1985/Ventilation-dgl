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

const aujourdhuiLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// L'option est ACTIVE si cochée et pas encore arrivée à sa fin
// (désactivation = fin du mois en cours, snippet 171).
export const optionInventaireActive = (config) =>
  config?.optionInventaire === true && (!config?.optionInventaireFinLe || config.optionInventaireFinLe >= aujourdhuiLocal());

// L'option est visible si : version d'essai (pour l'instant) ET option active.
export const inventaireDisponible = (config) => INVENTAIRE_EN_ESSAI && optionInventaireActive(config);

// 📜 CONDITIONS DE L'OPTION (2026-10-08, validées par le propriétaire).
// Texte JURIDIQUE : il reste en français (règle i18n) ; sa VERSION et son
// texte complet sont enregistrés avec chaque consentement. Toute
// modification = nouvelle version (ne jamais réécrire une version déjà
// acceptée par un client).
export const CONDITIONS_INVENTAIRE_VERSION = "inventaire-2026-10-08";
export const conditionsInventaire = (prix) => [
  `Prix : ${Number(prix || 0).toFixed(2)} $ par mois, taxes en sus, ajoutés à l'abonnement Fluxya de l'entreprise.`,
  "Activation : immédiate. Le mois de l'activation est facturé au prorata des jours restants (jour d'activation inclus).",
  "Période gratuite : pendant le 1er mois gratuit ou une entente pionnier, l'option est gratuite aussi ; la facturation commence avec le premier mois payant.",
  "Rabais : le rabais permanent de l'abonnement, s'il y en a un, s'applique aussi à l'option.",
  "Désactivation : en tout temps, par l'Admin principal. Elle prend effet à la fin du mois en cours ; l'accès est conservé jusque-là, sans remboursement partiel.",
  "Données : l'inventaire (emplacements, stock, historique) est conservé après la désactivation et redevient accessible si l'option est réactivée.",
  "Changement de prix : tout changement est annoncé au moins 30 jours à l'avance ; l'entreprise peut désactiver l'option avant son entrée en vigueur.",
];

// Activer (ou annuler une désactivation programmée) — Admin principal
// seulement (vérifié par la base). `prixVu` : le prix AFFICHÉ et accepté ;
// s'il a changé entre-temps, la base refuse.
export async function activerOptionInventaire(prixVu) {
  const texte = conditionsInventaire(prixVu).join("\n");
  const { data, error } = await supabase.rpc("option_inventaire_activer", {
    p_prix_vu: Number(prixVu),
    p_version: CONDITIONS_INVENTAIRE_VERSION,
    p_texte: texte,
  });
  if (error) throw new Error(error.message || "Activation refusée.");
  return data; // "activation" | "annulation_desactivation"
}

export async function desactiverOptionInventaire() {
  const { data, error } = await supabase.rpc("option_inventaire_desactiver");
  if (error) throw new Error(error.message || "Désactivation refusée.");
  return data; // date de fin (AAAA-MM-JJ)
}

export async function listerConsentementsOptions() {
  const { data, error } = await supabase
    .from("options_consentements")
    .select("id, entreprise_id, option, action, prix, conditions_version, par_email, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({
    id: r.id,
    entrepriseId: r.entreprise_id,
    option: r.option,
    action: r.action,
    prix: r.prix != null ? Number(r.prix) : null,
    version: r.conditions_version || "",
    parEmail: r.par_email || "",
    le: r.created_at,
  }));
}

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
