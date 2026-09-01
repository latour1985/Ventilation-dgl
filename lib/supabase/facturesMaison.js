// lib/supabase/facturesMaison.js
//
// 🧾 FACTURATION MAISON — SANS QUICKBOOKS (2026-09-02, design approuvé
// le 2026-08-17). Pour les compagnies de la plateforme sans système
// comptable : la facture vit ENTIÈREMENT dans Fluxya.
//
// Règles gelées reprises du design :
//   • séquence SANS TROU par entreprise (FAC-2026-0001…) — le numéro et
//     l'insertion se font dans LA MÊME transaction Postgres
//     (creer_facture_maison, snippet 119) ;
//   • JAMAIS de suppression : une erreur s'annule par NOTE DE CRÉDIT
//     (CR-2026-0001) rattachée à la facture d'origine — la séquence
//     comptable reste pleine, comme le VOID QuickBooks ;
//   • le client reçoit un LIEN PUBLIC (même mécanique que les devis) ;
//   • export comptable : plage de dates OU « depuis le dernier export »
//     (exportee_le posé sur chaque facture exportée → zéro doublon).

import { supabase } from "./client";

export function versUiFactureMaison(row) {
  return {
    id: row.id,
    numero: row.numero,
    type: row.type || "facture", // "facture" | "credit"
    factureOrigineId: row.facture_origine_id || null,
    clientId: row.client_id || null,
    clientNom: row.client_nom || "",
    clientAdresse: row.client_adresse || "",
    courriels: Array.isArray(row.courriels) ? row.courriels : [],
    lignes: Array.isArray(row.lignes) ? row.lignes : [],
    sousTotal: Number(row.sous_total) || 0,
    // Lignes de taxes SELON LE RÉGIME choisi (province) : [{code, taux, montant}].
    taxes: Array.isArray(row.taxes) ? row.taxes : [],
    regimeTaxes: row.regime_taxes || "qc",
    total: Number(row.total) || 0,
    terme: row.terme || "",
    dateEmission: row.date_emission || null,
    dateEcheance: row.date_echeance || null,
    note: row.note || "",
    statut: row.statut || "emise", // emise | envoyee | payee | annulee
    envoyeeLe: row.envoyee_le || null,
    payeeLe: row.payee_le || null,
    modePaiement: row.mode_paiement || "",
    annuleeLe: row.annulee_le || null,
    annulationNote: row.annulation_note || "",
    exporteeLe: row.exportee_le || null,
    jetonPublic: row.jeton_public || null,
    creeLe: row.created_at || null,
  };
}

// « En retard » se CALCULE (échéance passée, ni payée ni annulée) — on
// ne stocke jamais un statut qui peut se déduire, il mentirait un jour.
export function estEnRetard(f) {
  if (!f || f.statut === "payee" || f.statut === "annulee" || f.type === "credit") return false;
  if (!f.dateEcheance) return false;
  const ajd = new Date();
  const iso = `${ajd.getFullYear()}-${String(ajd.getMonth() + 1).padStart(2, "0")}-${String(ajd.getDate()).padStart(2, "0")}`;
  return f.dateEcheance < iso;
}

export async function listerFacturesMaison() {
  const { data, error } = await supabase
    .from("factures_maison")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(versUiFactureMaison);
}

// Création ATOMIQUE (numéro sans trou) — voir creer_facture_maison.
// `f` = { type?, factureOrigineId?, clientId, clientNom, clientAdresse,
//         courriels, lignes: [{description, quantite, prixUnitaire, montant}],
//         sousTotal, taxes: [{code,taux,montant}], regimeTaxes, total, terme, dateEcheance, note }
export async function creerFactureMaison(f) {
  const { data, error } = await supabase.rpc("creer_facture_maison", {
    p: {
      type: f.type || "facture",
      facture_origine_id: f.factureOrigineId || "",
      client_id: f.clientId || "",
      client_nom: f.clientNom || "",
      client_adresse: f.clientAdresse || "",
      courriels: f.courriels || [],
      lignes: f.lignes || [],
      sous_total: f.sousTotal ?? 0,
      taxes: f.taxes || [],
      regime_taxes: f.regimeTaxes || "qc",
      total: f.total ?? 0,
      terme: f.terme || "",
      date_echeance: f.dateEcheance || "",
      note: f.note || "",
    },
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return versUiFactureMaison(row);
}

export async function majFactureMaison(id, patch) {
  const ligne = {};
  if (patch.statut !== undefined) ligne.statut = patch.statut;
  if (patch.envoyeeLe !== undefined) ligne.envoyee_le = patch.envoyeeLe;
  if (patch.courriels !== undefined) ligne.courriels = patch.courriels;
  if (patch.payeeLe !== undefined) ligne.payee_le = patch.payeeLe;
  if (patch.modePaiement !== undefined) ligne.mode_paiement = patch.modePaiement;
  if (patch.annuleeLe !== undefined) ligne.annulee_le = patch.annuleeLe;
  if (patch.annulationNote !== undefined) ligne.annulation_note = patch.annulationNote;
  if (patch.exporteeLe !== undefined) ligne.exportee_le = patch.exporteeLe;
  const { data, error } = await supabase.from("factures_maison").update(ligne).eq("id", id).select().single();
  if (error) throw error;
  return versUiFactureMaison(data);
}

// Le lien public de la facture — même patron que les devis et les bons.
export function lienFactureMaison(f) {
  if (!f?.jetonPublic) return null;
  const origine = typeof window !== "undefined" ? window.location.origin : "https://fluxya.app";
  return `${origine}/facture/${f.jetonPublic}`;
}

// La page publique (anonyme) — via la fonction Postgres, jamais la table.
export async function chargerFactureMaisonPublique(jeton) {
  const { data, error } = await supabase.rpc("facture_maison_public", { p_jeton: jeton });
  if (error) throw error;
  const f = Array.isArray(data) ? data[0] : data;
  if (!f) return null;
  return {
    numero: f.numero,
    type: f.type || "facture",
    numeroOrigine: f.numero_origine || null,
    clientNom: f.client_nom || "",
    clientAdresse: f.client_adresse || "",
    lignes: Array.isArray(f.lignes) ? f.lignes : [],
    sousTotal: Number(f.sous_total) || 0,
    taxes: Array.isArray(f.taxes) ? f.taxes : [],
    total: Number(f.total) || 0,
    terme: f.terme || "",
    dateEmission: f.date_emission || null,
    dateEcheance: f.date_echeance || null,
    note: f.note || "",
    statut: f.statut || "emise",
    payeeLe: f.payee_le || null,
    expire: !!f.expire,
    entreprise: {
      id: f.entreprise_id || null,
      nom: f.entreprise_nom || null,
      adresse: f.entreprise_adresse || "",
      telephone: f.entreprise_telephone || "",
      courriel: f.entreprise_courriel || "",
      siteWeb: f.entreprise_site_web || "",
      logo: f.entreprise_logo || null,
      rbq: f.entreprise_rbq || "",
      associations: Array.isArray(f.entreprise_associations) ? f.entreprise_associations : [],
      numeroTps: f.entreprise_numero_tps || "",
      numeroTvq: f.entreprise_numero_tvq || "",
      noteFacture: f.entreprise_note_facture || "",
    },
  };
}

// ---- EXPORT COMPTABLE (CSV) ----
// Colonnes convenues avec le propriétaire (2026-08-17) : le comptable
// travaille à partir de ce fichier. Excel (Québec) ouvre les CSV avec
// point-virgule ; les montants gardent le point décimal.
export function csvFacturesMaison(factures) {
  // Une colonne par code de taxe canadien — le comptable retrouve chaque
  // taxe dans sa colonne, peu importe la province de la facture.
  const taxeDe = (f, code) => (f.taxes || []).filter((t) => t.code === code).reduce((s, t) => s + (Number(t.montant) || 0), 0);
  const lignes = [
    ["Numero", "Type", "Date", "Client", "Sous-total", "TPS", "TVQ", "TVH", "TVP", "Total", "Statut", "Date paiement", "Mode paiement", "Facture d'origine"].join(";"),
    ...factures.map((f) =>
      [
        f.numero,
        f.type === "credit" ? "Note de credit" : "Facture",
        f.dateEmission || "",
        `"${String(f.clientNom).replace(/"/g, '""')}"`,
        f.sousTotal.toFixed(2),
        taxeDe(f, "TPS").toFixed(2),
        taxeDe(f, "TVQ").toFixed(2),
        taxeDe(f, "TVH").toFixed(2),
        taxeDe(f, "TVP").toFixed(2),
        f.total.toFixed(2),
        f.statut === "payee" ? "Payee" : f.statut === "annulee" ? "Annulee" : estEnRetard(f) ? "En retard" : f.statut === "envoyee" ? "Envoyee" : "Emise",
        f.payeeLe ? String(f.payeeLe).slice(0, 10) : "",
        f.modePaiement || "",
        f.type === "credit" ? f.factureOrigineNumero || "" : "",
      ].join(";")
    ),
  ];
  // BOM UTF-8 : sans lui, Excel affiche « Ã© » à la place des accents.
  return "﻿" + lignes.join("\r\n");
}
