// lib/supabase/facturesLibres.js
//
// 🧾 REGISTRE DES FACTURES SANS CHANTIER (2026-08-29)
//
// Retour du propriétaire : « j'ai créé 2 factures et elles
// n'apparaissent pas ». La facture libre (et sa cousine groupée sur les
// bons) ne vivait que dans QuickBooks et au journal — invisible dans
// Fluxya, donc impossible à retrouver, à vérifier ou à RENVOYER.
//
// Ce registre garde une trace locale de chaque facture libre : la
// section « Factures sans chantier » de l'onglet Facturation s'en sert
// pour les lister avec leur preuve d'envoi et leur bouton Renvoyer.
// Table : factures_libres (snippet 105, RLS + trigger d'étiquette).

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    qboInvoiceId: row.qbo_invoice_id || null,
    docNumber: row.doc_number || "",
    clientId: row.client_id || null,
    clientNom: row.client_nom || "",
    montantHT: Number(row.montant_ht) || 0,
    courriels: Array.isArray(row.courriels) ? row.courriels : [],
    projetId: row.projet_id || null,
    reference: row.reference || "",
    envoiStatut: row.envoi_statut || null, // "envoyee" | "non_confirme"
    envoyeeLe: row.envoyee_le || null,
    creeLe: row.created_at || null,
    // 🚦 CYCLE DE VIE (snippet 117, 2026-08-31) :
    //   "en_creation" — la demande part vers QuickBooks (verrou anti-
    //                   doublon : une 2e émission identique est bloquée) ;
    //   "creee"       — confirmée par QuickBooks (le statut normal) ;
    //   "a_verifier"  — la réponse de QuickBooks n'est JAMAIS revenue
    //                   (délai réseau) : la facture existe PEUT-ÊTRE
    //                   là-bas — vérifier avant de réémettre. C'est
    //                   exactement le trou qui a produit les factures
    //                   4251/4252 en double chez un client.
    //   "annulee"     — annulée d'ici (VOID QuickBooks + note comptable).
    statut: row.statut || "creee",
    annuleeLe: row.annulee_le || null,
    annulationNote: row.annulation_note || "",
    annuleePar: row.annulee_par || "",
  };
}

export async function listerFacturesLibres() {
  const { data, error } = await supabase
    .from("factures_libres")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function enregistrerFactureLibre(f) {
  const { data, error } = await supabase
    .from("factures_libres")
    .insert({
      qbo_invoice_id: f.qboInvoiceId || null,
      doc_number: f.docNumber || null,
      client_id: f.clientId || null,
      client_nom: f.clientNom || null,
      montant_ht: Number(f.montantHT) || 0,
      courriels: f.courriels || [],
      projet_id: f.projetId || null,
      reference: f.reference || null,
      envoi_statut: f.envoiStatut || null,
      envoyee_le: f.envoyeeLe || null,
      ...(f.statut ? { statut: f.statut } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return versUi(data);
}

// Mise à jour générale d'une facture du registre (statut, identifiants
// QuickBooks après confirmation, annulation…). Retourne la ligne à jour.
export async function majFactureLibre(id, patch) {
  const ligne = {};
  if (patch.qboInvoiceId !== undefined) ligne.qbo_invoice_id = patch.qboInvoiceId;
  if (patch.docNumber !== undefined) ligne.doc_number = patch.docNumber;
  if (patch.envoiStatut !== undefined) ligne.envoi_statut = patch.envoiStatut;
  if (patch.envoyeeLe !== undefined) ligne.envoyee_le = patch.envoyeeLe;
  if (patch.courriels !== undefined) ligne.courriels = patch.courriels;
  if (patch.statut !== undefined) ligne.statut = patch.statut;
  if (patch.annuleeLe !== undefined) ligne.annulee_le = patch.annuleeLe;
  if (patch.annulationNote !== undefined) ligne.annulation_note = patch.annulationNote;
  if (patch.annuleePar !== undefined) ligne.annulee_par = patch.annuleePar;
  const { data, error } = await supabase.from("factures_libres").update(ligne).eq("id", id).select().single();
  if (error) throw error;
  return versUi(data);
}

// Retrait d'une ligne « en_creation » quand QuickBooks a REFUSÉ
// proprement (rien n'a été créé là-bas) — le registre ne garde pas de
// fantômes. Jamais utilisé sur une facture confirmée.
export async function supprimerFactureLibreEnCreation(id) {
  const { error } = await supabase.from("factures_libres").delete().eq("id", id).eq("statut", "en_creation");
  if (error) throw error;
}

// Après un renvoi : la preuve et les destinataires se mettent à jour.
export async function majEnvoiFactureLibre(id, { courriels, envoiStatut, envoyeeLe }) {
  const { error } = await supabase
    .from("factures_libres")
    .update({
      ...(courriels ? { courriels } : {}),
      envoi_statut: envoiStatut || null,
      envoyee_le: envoyeeLe || null,
    })
    .eq("id", id);
  if (error) throw error;
}
