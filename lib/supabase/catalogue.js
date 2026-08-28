// lib/supabase/catalogue.js
//
// CATALOGUE D'ITEMS — la liste de produits et de forfaits utilisée pour
// monter les devis. Avant, c'étaient 5 items de démonstration écrits en
// dur dans app/admin/page.jsx (et qui venaient d'un ancien modèle de
// couvreur : « bardeau architectural », « membrane élastomère »).
//
// Peuplée depuis l'export QuickBooks (snippet SQL 26). Quand la
// connexion QuickBooks arrivera, l'API alimentera CETTE MÊME table et
// `qb_item_id` fera le lien — l'import CSV disparaîtra sans rien casser.
//
// ------------------------------------------------------------
// LE COÛT PEUT ÊTRE INCONNU — ET CE N'EST PAS ZÉRO
// ------------------------------------------------------------
// 71 des items importés (tous les forfaits d'installation) n'ont aucun
// coût dans QuickBooks, parce qu'un service n'a pas de prix d'achat :
// son coût réel, ce sont des heures de technicien et du matériel, que
// l'application calcule déjà par ailleurs.
//
// `prix_coutant` est donc NULLABLE. Traiter un coût absent comme 0
// afficherait « 100 % de marge » sur un forfait de 6 450 $ — le genre
// de chiffre qui fait prendre une mauvaise décision avec confiance.
// Partout, un coût nul veut dire INCONNU : la marge ne s'affiche pas.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    nom: row.nom,
    categorie: row.categorie || "",
    typeItem: row.type_item || "materiel",
    // null = inconnu (jamais 0)
    prix_vendant: row.prix_vendant != null ? Number(row.prix_vendant) : null,
    prix_coutant: row.prix_coutant != null ? Number(row.prix_coutant) : null,
    unite: row.unite || "unité",
    description: row.description || "",
    actif: row.actif !== false,
    qbItemId: row.qb_item_id || null,
  };
}

export async function listerCatalogue() {
  const { data, error } = await supabase
    .from("catalogue_items")
    .select("*")
    .eq("actif", true)
    .order("nom")
    .limit(2000);
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderItem(item) {
  const ligne = {
    nom: (item.nom || "").trim(),
    categorie: item.categorie || null,
    type_item: item.typeItem || "materiel",
    prix_vendant: item.prix_vendant === "" || item.prix_vendant == null ? null : Number(item.prix_vendant),
    prix_coutant: item.prix_coutant === "" || item.prix_coutant == null ? null : Number(item.prix_coutant),
    unite: item.unite || null,
    description: item.description || null,
    actif: item.actif !== false,
    updated_at: new Date().toISOString(),
  };
  // 🔗 Lien QuickBooks (2026-08-28) — posé par la synchronisation du
  // catalogue : c'est LA clé anti-doublon des mises à jour suivantes.
  if (item.qbItemId !== undefined) ligne.qb_item_id = item.qbItemId || null;
  if (item.id) ligne.id = item.id;
  const { data, error } = await supabase.from("catalogue_items").upsert(ligne).select().single();
  if (error) throw error;
  return versUi(data);
}

// ------------------------------------------------------------
// ENREGISTREMENT EN LOT (2026-08-28) — import de liste de prix et
// synchronisation QuickBooks.
// ------------------------------------------------------------
// Un catalogue, c'est 300 items d'un coup. Les enregistrer UN PAR UN
// faisait 300 allers-retours (plus 300 écritures au journal lancées en
// parallèle) : la base saturait et la plupart des items échouaient —
// « 288 items n'ont pas pu être enregistrés ». Ici : un envoi par
// tranche de 100, et l'appelant écrit UNE seule ligne au journal.
// L'erreur remonte telle quelle (jamais un simple compteur d'échecs).
export async function enregistrerItemsEnLot(items) {
  const TRANCHE = 100;
  const sauves = [];
  const lignes = (items || []).map((item) => {
    const ligne = {
      nom: (item.nom || "").trim(),
      categorie: item.categorie || null,
      type_item: item.typeItem || "materiel",
      prix_vendant: item.prix_vendant === "" || item.prix_vendant == null ? null : Number(item.prix_vendant),
      prix_coutant: item.prix_coutant === "" || item.prix_coutant == null ? null : Number(item.prix_coutant),
      unite: item.unite || null,
      description: item.description || null,
      actif: item.actif !== false,
      updated_at: new Date().toISOString(),
    };
    if (item.qbItemId !== undefined) ligne.qb_item_id = item.qbItemId || null;
    if (item.id) ligne.id = item.id;
    return ligne;
  });
  for (let debut = 0; debut < lignes.length; debut += TRANCHE) {
    const { data, error } = await supabase
      .from("catalogue_items")
      .upsert(lignes.slice(debut, debut + TRANCHE))
      .select();
    if (error) throw new Error(error.message || "Enregistrement refusé par la base");
    sauves.push(...(data || []).map(versUi));
  }
  return sauves;
}

// DÉSACTIVATION, jamais suppression — même règle que « Void, jamais
// Delete » côté QuickBooks : un item effacé casserait les devis et les
// factures qui le référencent.
export async function desactiverItem(id) {
  const { error } = await supabase
    .from("catalogue_items")
    .update({ actif: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------
// MARGE — une seule définition dans toute l'application
// ------------------------------------------------------------
// marge % = (vendant − coûtant) ÷ VENDANT
//
// À ne pas confondre avec la majoration (÷ coûtant), qui donne un
// chiffre plus flatteur pour la même réalité : sur 3,38 $ coûtant
// vendu 4,23 $, la marge est de 20 % et la majoration de 25 %.
// Retourne null quand le calcul n'a pas de sens (coût inconnu).
export function margePourcent(vendant, coutant) {
  const v = Number(vendant);
  const c = Number(coutant);
  if (!Number.isFinite(v) || v === 0 || coutant == null || !Number.isFinite(c)) return null;
  return ((v - c) / v) * 100;
}

export function profitDollars(vendant, coutant) {
  const v = Number(vendant);
  const c = Number(coutant);
  if (!Number.isFinite(v) || coutant == null || !Number.isFinite(c)) return null;
  return v - c;
}

// Prix de vente donnant la marge visée à partir d'un coût — c'est le
// sens « inverse » du calcul, pour tarifer un item neuf.
export function vendantPourMarge(coutant, margePct) {
  const c = Number(coutant);
  const m = Number(margePct);
  if (!Number.isFinite(c) || !Number.isFinite(m) || m >= 100) return null;
  return c / (1 - m / 100);
}

export function sAbonnerCatalogue(onChangement) {
  const canal = supabase
    .channel("catalogue-items")
    .on("postgres_changes", { event: "*", schema: "public", table: "catalogue_items" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

// ------------------------------------------------------------
// ITEMS RETIRÉS (discontinués / remplacés) — jamais supprimés.
// ------------------------------------------------------------
// Un produit discontinué disparaît du sélecteur de devis et de la liste
// courante, mais son histoire reste : les anciens devis y réfèrent, et
// un produit « discontinué » revient parfois au catalogue du fabricant.
export async function listerCatalogueRetires() {
  const { data, error } = await supabase
    .from("catalogue_items")
    .select("*")
    .eq("actif", false)
    .order("nom")
    .limit(2000);
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function reactiverItem(id) {
  const { error } = await supabase
    .from("catalogue_items")
    .update({ actif: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
