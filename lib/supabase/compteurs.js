// lib/supabase/compteurs.js
//
// Numérotation SÉQUENTIELLE et SANS DOUBLON des documents créés dans
// l'application (devis, bons de commande).
//
// Le compteur vit dans la base de données, pas dans le navigateur :
// c'est ce qui garantit qu'aucun numéro ne peut être attribué deux fois,
// même si deux personnes créent un devis exactement en même temps.
// La séquence est continue à l'infini : ... 9998, 9999, 10000, 10001 ...
//
// À noter : les numéros de FACTURE ne passent pas par ici — ils sont
// attribués par QuickBooks (séquence comptable officielle, exigée par
// Revenu Québec). Voir la Phase 4.

import { supabase } from "./client";

// Récupère le prochain numéro d'une série et l'incrémente d'un coup
// (opération atomique côté base — voir la fonction SQL prochain_numero).
export async function prochainNumero(prefixe, cle) {
  const { data, error } = await supabase.rpc("prochain_numero", { cle_compteur: cle });
  if (error) throw error;
  return `${prefixe}-${data}`;
}

export const numeroDevis = () => prochainNumero("DEV", "devis");
export const numeroBonCommande = () => prochainNumero("BC", "bon_commande");

// Valeurs actuelles des compteurs (pour affichage/réglage à l'admin).
export async function listerCompteurs() {
  const { data, error } = await supabase.from("compteurs").select("*").order("cle");
  if (error) throw error;
  return data || [];
}
