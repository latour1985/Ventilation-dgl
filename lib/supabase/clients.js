// lib/supabase/clients.js
//
// Persistance des CLIENTS. Avant, ils vivaient uniquement dans la
// mémoire du navigateur : un client créé disparaissait au rechargement,
// et tout ce qui pointait vers lui (devis, projets, tâches, bons de
// travail) devenait orphelin.
//
// Table `clients_app` — distincte de la table `clients` du schéma
// initial (section 3), qui visait un modèle chiffré jamais mis en place.
// Le chiffrement des champs sensibles fait partie du durcissement
// pré-production (avec les politiques RLS).

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    nom: row.nom,
    entreprise: row.entreprise || "",
    // Ce que les LISTES affichent quand nom ET entreprise existent :
    // "nom" (défaut), "entreprise", ou "nom-entreprise" (les deux).
    nomAffichage: row.nom_affichage || "nom",
    // Plusieurs contacts possibles : [{ id, label, email, defaut }]
    courriels: Array.isArray(row.courriels) ? row.courriels : [],
    telephone: row.telephone || "",
    termeFacturation: row.terme_facturation || "",
    adresseFacturation: row.adresse_facturation || "",
    // Adresses de chantier : [{ id, nom, ligne1, codePostal }]
    adresses: Array.isArray(row.adresses) ? row.adresses : [],
    // REGISTRE D'ÉQUIPEMENTS — modèle + numéro de série des unités
    // installées chez ce client, saisis par les techniciens lors des
    // appels de service. Se remplit tout seul et sert bien au-delà des
    // pièces : partir avec la bonne pièce, cibler l'entretien préventif,
    // retrouver les clients touchés par un rappel de fabricant.
    equipements: Array.isArray(row.equipements) ? row.equipements : [],
    quickbooksCustomerId: row.quickbooks_customer_id || null,
    syncQb: row.sync_qb || null,
  };
}

export async function listerClients() {
  const { data, error } = await supabase.from("clients_app").select("*").order("nom");
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function sauvegarderClient(c) {
  const { error } = await supabase.from("clients_app").upsert({
    id: c.id,
    nom: c.nom,
    entreprise: c.entreprise || null,
    nom_affichage: c.nomAffichage || null,
    courriels: c.courriels || [],
    telephone: c.telephone || null,
    terme_facturation: c.termeFacturation || null,
    adresse_facturation: c.adresseFacturation || null,
    adresses: c.adresses || [],
    equipements: c.equipements || [],
    quickbooks_customer_id: c.quickbooksCustomerId || null,
    sync_qb: c.syncQb || null,
  });
  if (error) throw error;
}

export async function supprimerClient(id) {
  const { error } = await supabase.from("clients_app").delete().eq("id", id);
  if (error) throw error;
}

export function sAbonnerClients(onChangement) {
  const canal = supabase
    .channel("clients-app")
    .on("postgres_changes", { event: "*", schema: "public", table: "clients_app" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
