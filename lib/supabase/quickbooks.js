// lib/supabase/quickbooks.js
//
// Remplace transactionsQb (useState local) et synchroniserQuickBooksProjets
// / assignerTransactionManuellement dans AdminInterface.jsx.
//
// IMPORTANT : le VRAI appel à l'API QuickBooks Online (OAuth2,
// endpoints Invoice/Purchase) doit se faire depuis une Supabase Edge
// Function (jamais depuis le navigateur — les jetons d'accès
// QuickBooks ne doivent jamais transiter côté client). Cette fonction
// `synchroniserQuickbooks()` invoque cette Edge Function, qui écrit
// directement dans `transactions_quickbooks` ; ce fichier ne fait que
// déclencher l'appel et relire le résultat.

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
