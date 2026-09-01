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
import { lireParPages } from "./lireParPages";

// TROIS CIBLES POSSIBLES (2026-08-26, snippet SQL 78) : une dépense
// achetée pour une JOB sans projet n'avait nulle part où aller — elle
// restait orpheline et le coût réel de la job était faux en silence.
// Une attribution vise donc maintenant un projet, une tâche OU un client.
// + « hors » (2026-08-28) : la transaction ne concerne PAS Fluxya
// (frais généraux, essence, comptable…) — elle sort de la liste « à
// rattacher » sans entrer dans aucune marge. Décision réversible.
export const CIBLES_QB = ["projet", "tache", "client", "hors"];

// Annuaire { quickbooksId: { type, id } } des attributions manuelles.
// Compatibilité : une vieille ligne sans `cible_type` (avant le snippet
// 78) est relue comme une cible de type « projet » — aucune décision
// humaine déjà prise n'est perdue.
export async function listerAttributionsQb() {
  // 📚 Par pages (bilan 2026-09-03) — une attribution par transaction QuickBooks.
  const data = await lireParPages(() =>
    supabase.from("qb_attributions_manuelles").select("quickbooks_id, projet_id, cible_type, cible_id").order("quickbooks_id")
  );
  const parId = {};
  (data || []).forEach((r) => {
    if (!r.quickbooks_id) return;
    const type = CIBLES_QB.includes(r.cible_type) ? r.cible_type : "projet";
    const id = r.cible_id || r.projet_id;
    if (id) parId[r.quickbooks_id] = { type, id };
  });
  return parId;
}

// Enregistre (ou remplace) l'attribution manuelle d'une transaction.
// cible null (ou id vide) = on retire l'attribution (retour à
// l'automatique). `projet_id` reste rempli pour une cible « projet » :
// les écrans qui ne lisent pas encore les nouvelles colonnes continuent
// de fonctionner tels quels.
export async function enregistrerAttributionQb(quickbooksId, cible, parNom) {
  const type = cible && CIBLES_QB.includes(cible.type) ? cible.type : null;
  const id = cible?.id || null;
  if (!type || !id) {
    const { error } = await supabase
      .from("qb_attributions_manuelles")
      .delete()
      .eq("quickbooks_id", quickbooksId);
    if (error) throw error;
    return;
  }
  const ligne = {
    quickbooks_id: quickbooksId,
    projet_id: type === "projet" ? id : null,
    cible_type: type,
    cible_id: id,
    assignee_par: parNom || null,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase
    .from("qb_attributions_manuelles")
    .upsert(ligne, { onConflict: "quickbooks_id" });
  // ⚠️ FILET COLONNE MANQUANTE (même leçon que les bons de travail) : si
  // le snippet 78 n'a pas encore été passé, une attribution de PROJET
  // continue de s'enregistrer à l'ancienne plutôt que d'échouer.
  if (error && (error.code === "PGRST204" || /cible_type|cible_id/.test(error.message || ""))) {
    if (type !== "projet") throw error; // tâche/client : impossible sans le snippet
    const { cible_type: _a, cible_id: _b, ...ancienneForme } = ligne;
    ({ error } = await supabase
      .from("qb_attributions_manuelles")
      .upsert(ancienneForme, { onConflict: "quickbooks_id" }));
  }
  if (error) throw error;
}
