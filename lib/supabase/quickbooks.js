// lib/supabase/quickbooks.js
//
// ⚠️ FICHIER PRÉPARATOIRE, PAS ENCORE BRANCHÉ (aucun import ailleurs).
//
// L'intégration RÉELLE est passée par des routes Next.js plutôt que par
// une Supabase Edge Function (même patron serveur que /api/courriel —
// aucun outillage de plus à installer) :
//   - lib/quickbooksServeur.js        (OAuth, jetons, requêtes — serveur)
//   - app/api/quickbooks/connexion    (départ vers Intuit)
//   - app/api/quickbooks/callback     (retour + stockage des jetons)
//   - app/api/quickbooks/etat         (état pour Paramètres → Connexions)
//   - app/api/quickbooks/transactions (lecture Invoice/Purchase/Bill)
//   - lib/quickbooksClient.js         (appels côté navigateur)
//
// Ce fichier reste pour l'étape « persistance des attributions » : les
// fonctions ci-dessous liront/écriront la table transactions_quickbooks
// quand on voudra que les assignations manuelles survivent au refresh.

import { supabase } from "./client";

export async function listerTransactionsNonAssignees() {
  const { data, error } = await supabase
    .from("transactions_quickbooks")
    .select("*")
    .is("projet_id", null)
    .order("synced_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listerTransactionsDuProjet(projetId) {
  const { data, error } = await supabase
    .from("transactions_quickbooks")
    .select("*")
    .eq("projet_id", projetId)
    .order("synced_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Déclenche la synchronisation réelle — appelle l'Edge Function
// `sync-quickbooks-transactions`, qui applique les règles
// d'attribution automatique (Règle 1 : CustomerRef/ProjectRef,
// Règle 2 : numéro de BC) côté serveur avant d'upsert dans
// `transactions_quickbooks` (déduplication par la contrainte UNIQUE
// sur quickbooks_id — pas de logique de dédup à réécrire ici).
export async function synchroniserQuickbooks() {
  const { data, error } = await supabase.functions.invoke("sync-quickbooks-transactions");
  if (error) throw error;
  return data; // { nbSynchronisees, nbAssignees, nbNonAssignees }
}

// Équivalent de assignerTransactionManuellement
export async function assignerTransactionManuellement(quickbooksId, projetId) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("transactions_quickbooks")
    .update({ projet_id: projetId, assignee_manuellement_par: userData.user?.id })
    .eq("quickbooks_id", quickbooksId);
  if (error) throw error;
}
