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
    })
    .select()
    .single();
  if (error) throw error;
  return versUi(data);
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
