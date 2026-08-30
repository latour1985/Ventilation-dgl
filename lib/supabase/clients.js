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
    // 📇 CARNET DE CONTACTS (SQL 72, 2026-08-17) — les personnes à voir
    // SUR PLACE, réutilisables de chantier en chantier :
    // [{ id, nom, role, telephone }]. Distinct des courriels (facturation).
    contacts: Array.isArray(row.contacts) ? row.contacts : [],
    quickbooksCustomerId: row.quickbooks_customer_id || null,
    syncQb: row.sync_qb || null,
    // 📌 NOTE GÉNÉRALE (snippet 109, 2026-08-30) — demande du
    // propriétaire : « s'il y a un problème on peut le noter ».
    // Interne au bureau : jamais montrée au client ni au technicien.
    note: row.note || "",
  };
}

export async function listerClients() {
  // 📚 LECTURE PAR PAGES (2026-09-09) : Supabase plafonne chaque requête
  // à 1 000 lignes — depuis la descente QuickBooks (1 465 fiches chez
  // DGL), une lecture simple coupait la liste vers « M » en silence. On
  // boucle jusqu'à la page courte pour TOUT ramener, quel que soit le
  // nombre de clients.
  const PAGE = 1000;
  const tous = [];
  for (let depart = 0; ; depart += PAGE) {
    const { data, error } = await supabase
      .from("clients_app")
      .select("*")
      .order("nom")
      .range(depart, depart + PAGE - 1);
    if (error) throw error;
    tous.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return tous.map(versUi);
}

export async function sauvegarderClient(c) {
  const ligne = {
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
    contacts: c.contacts || [],
    quickbooks_customer_id: c.quickbooksCustomerId || null,
    sync_qb: c.syncQb || null,
    note: c.note || null,
  };
  const { error } = await supabase.from("clients_app").upsert(ligne);
  // SQL 72 pas encore passé (colonne contacts absente) : on réessaie
  // SANS le carnet plutôt que de bloquer toute la sauvegarde du client.
  // Le carnet se mettra à écrire dès que le snippet sera exécuté.
  if (error && /contacts/.test(error.message || "")) {
    const { contacts: _ignore, ...sansContacts } = ligne;
    const { error: e2 } = await supabase.from("clients_app").upsert(sansContacts);
    if (e2) throw e2;
    return;
  }
  // Même filet pour la note générale (snippet 109 pas encore passé) :
  // la fiche s'enregistre quand même, la note écrira dès que possible.
  if (error && /\bnote\b/.test(error.message || "")) {
    const { note: _ignore2, ...sansNote } = ligne;
    const { error: e3 } = await supabase.from("clients_app").upsert(sansNote);
    if (e3) throw e3;
    return;
  }
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
