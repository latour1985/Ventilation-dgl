// lib/supabase/bonsTravail.js
//
// Bons de travail COMPLÉTÉS et signés sur le terrain (terrain -> bureau).
// Quand le technicien clique « Terminer et envoyer » :
//   1. le bon signé part au(x) courriel(s) choisi(s) du client (envoi
//      simulé en mode test — le vrai service d'envoi arrive en Phase 4) ;
//   2. le bon devient une DEMANDE DE FACTURATION visible en direct dans
//      l'onglet Facturation de l'admin.

import { supabase } from "./client";

// Enregistre le bon signé. `infos` = { tacheId, titre, clientNom,
// description, date, heures, typeTache, devisNumero, adresseTravaux,
// projetId, photosAvant, photosApres, courrielsEnvoi, signeParNom }.
export async function enregistrerBonTravail(infos, session) {
  const email = session?.user?.email?.toLowerCase() || null;
  const { error } = await supabase.from("bons_travail").upsert(
    {
      tache_id: infos.tacheId,
      employe_email: email,
      employe_nom: session?.user?.user_metadata?.nom || (email ? email.split("@")[0] : null),
      titre: infos.titre || null,
      client_nom: infos.clientNom || null,
      description: infos.description || null,
      date_travail: infos.date,
      heures: Math.round((Number(infos.heures) || 0) * 100) / 100,
      type_tache: infos.typeTache || null,
      secteur: infos.secteur === "residentiel" ? "residentiel" : "commercial",
      devis_numero: infos.devisNumero || null,
      adresse_travaux: infos.adresseTravaux || null,
      projet_id: infos.projetId || null,
      photos:
        (infos.photosAvant || []).length > 0 || (infos.photosApres || []).length > 0
          ? { avant: infos.photosAvant || [], apres: infos.photosApres || [] }
          : null,
      // Destinataires du bon signé (choix multiple côté technicien).
      courriels_envoi: infos.courrielsEnvoi || [],
      signe_par_nom: infos.signeParNom || null,
      // Clause 10 : client absent à la fin des travaux — bon envoyé sans
      // signature, travaux réputés reçus. Le bureau doit le voir.
      client_absent: !!infos.clientAbsent,
      // Unités vérifiées — LISTE, parce qu'un immeuble peut en avoir
      // plusieurs. Les deux anciennes colonnes restent remplies avec la
      // première, pour les écrans qui ne lisent pas encore la liste.
      unites: infos.unites || [],
      modele_unite: infos.unites?.[0]?.modele || null,
      serie_unite: infos.unites?.[0]?.serie || null,
      piece_a_commander: !!infos.pieceACommander,
      piece_requise: infos.pieceRequise || null,
      envoye_le: new Date().toISOString(),
      statut_facturation: "a_facturer",
    },
    { onConflict: "tache_id,employe_email" }
  );
  if (error) throw error;
}

// Bons complétés — pour l'onglet Facturation de l'admin.
export async function listerBonsTravail() {
  const { data, error } = await supabase
    .from("bons_travail")
    .select("*")
    .order("envoye_le", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: `sbb-${row.id}`,
    supabase: true,
    tacheId: row.tache_id,
    client: row.client_nom || "",
    projet: row.titre || "Travail complété",
    description: row.description || "",
    date: row.date_travail,
    heures: Number(row.heures) || 0,
    type: row.type_tache || "temps_materiel",
    secteur: row.secteur === "residentiel" ? "residentiel" : "commercial",
    devisNumero: row.devis_numero || null,
    adresseTravaux: row.adresse_travaux || null,
    projetId: row.projet_id || null,
    photosAvantUrls: Array.isArray(row.photos?.avant) ? row.photos.avant : [],
    photosApresUrls: Array.isArray(row.photos?.apres) ? row.photos.apres : [],
    courrielsEnvoi: Array.isArray(row.courriels_envoi) ? row.courriels_envoi : [],
    signeParNom: row.signe_par_nom || null,
    clientAbsent: !!row.client_absent,
    unites: Array.isArray(row.unites) && row.unites.length > 0
      ? row.unites
      : (row.modele_unite || row.serie_unite)
        ? [{ modele: row.modele_unite || "", serie: row.serie_unite || "" }]
        : [],
    modeleUnite: row.modele_unite || "",
    serieUnite: row.serie_unite || "",
    pieceACommander: !!row.piece_a_commander,
    pieceRequise: row.piece_requise || "",
    envoyeLe: row.envoye_le || null,
    // Lien public déjà transmis au client ? La carte du bon l'affiche.
    envoyeClientLe: row.envoye_client_le || null,
    employeNom: row.employe_nom || null,
    // Forme attendue par l'onglet Facturation existant.
    //
    // `montant` reste à 0 ICI et `prixNonListe` à true : c'est vrai pour
    // du temps et matériel, dont le prix dépend des heures réelles.
    // Pour une tâche RATTACHÉE À UN DEVIS, le prix est déjà connu — il
    // est écrit sur le devis que le client a accepté. L'onglet
    // Facturation va le chercher (il a la liste des devis, pas nous) et
    // remplace ces deux valeurs. Sans ça, une tâche « devis » tombait
    // dans la pile rouge « prix à réviser » et il fallait retaper un
    // montant déjà négocié.
    montant: 0,
    prixNonListe: true,
    statutQb: row.statut_facturation === "envoye" ? "envoye" : "en_attente",
    // FACTURES ÉMISES — enfin persistées (avant : toujours [], et tout
    // l'historique d'émission disparaissait au rechargement).
    facturesEmises: Array.isArray(row.factures_emises) ? row.factures_emises : [],
  }));
}

// Écrit la liste des factures émises d'un bon (identifiant de LIGNE
// bons_travail — le "sbb-" retiré par l'appelant). Le statut suit :
// complet quand le cumul couvre le montant attendu.
export async function majFacturesEmises(rowId, factures, statut) {
  const { error } = await supabase
    .from("bons_travail")
    .update({ factures_emises: factures || [], ...(statut ? { statut_facturation: statut } : {}) })
    .eq("id", rowId);
  if (error) throw error;
}

export function sAbonnerBonsTravail(onChangement) {
  const canal = supabase
    .channel("bons-travail")
    .on("postgres_changes", { event: "*", schema: "public", table: "bons_travail" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
