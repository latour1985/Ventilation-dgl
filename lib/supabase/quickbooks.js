// lib/supabase/quickbooks.js
//
// PERSISTANCE DES ATTRIBUTIONS MANUELLES QuickBooks.
//
// Les transactions elles-mêmes sont TOUJOURS relues en direct de
// QuickBooks (route /api/quickbooks/transactions — montants et statuts
// à jour). Ce qu'on mémorise ici, c'est UNIQUEMENT la décision humaine
// « cette transaction appartient à ce projet », par numéro QuickBooks.
//
// Sans ça, assigner une transaction à un projet à la main était oublié
// au moindre rafraîchissement (mémoire du navigateur seulement). Avec
// ça : à chaque synchro, après l'attribution automatique (Règle 1/2),
// on ré-applique par-dessus les décisions manuelles enregistrées.
//
// Table : qb_attributions_manuelles (snippet SQL 46) — réservée au
// bureau par la RLS, comme le reste de la facturation.

import { supabase } from "./client";

// Retourne un annuaire { quickbooksId: projetId } des attributions
// manuelles enregistrées.
export async function listerAttributionsQb() {
  const { data, error } = await supabase
    .from("qb_attributions_manuelles")
    .select("quickbooks_id, projet_id");
  if (error) throw error;
  const parId = {};
  (data || []).forEach((r) => {
    if (r.quickbooks_id && r.projet_id) parId[r.quickbooks_id] = r.projet_id;
  });
  return parId;
}

// Enregistre (ou remplace) l'attribution manuelle d'une transaction.
// projetId null = on retire l'attribution (retour à l'automatique).
export async function enregistrerAttributionQb(quickbooksId, projetId, parNom) {
  if (!projetId) {
    const { error } = await supabase
      .from("qb_attributions_manuelles")
      .delete()
      .eq("quickbooks_id", quickbooksId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("qb_attributions_manuelles").upsert(
    {
      quickbooks_id: quickbooksId,
      projet_id: projetId,
      assignee_par: parNom || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "quickbooks_id" }
  );
  if (error) throw error;
}
