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
  const nom = session?.user?.user_metadata?.nom || (email ? email.split("@")[0] : null);
  return ecrireBon(infos, email, nom);
}

// 🏢 FERMETURE PAR LE BUREAU (2026-08-17) : demande de facturation créée
// par l'admin au nom d'un technicien qui a oublié de fermer — sans
// signature ni photos (le bureau facture en connaissance de cause).
export async function enregistrerBonTravailBureau(infos, employe) {
  const email = (employe?.courriel || "").toLowerCase() || null;
  const nom = employe?.nom || (email ? email.split("@")[0] : null);
  return ecrireBon(infos, email, nom);
}

async function ecrireBon(infos, email, nom) {
  const ligne = {
      tache_id: infos.tacheId,
      employe_email: email,
      employe_nom: nom,
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
      // Les VIDÉOS voyagent dans le même champ jsonb que les photos
      // (2026-08-20) — aucun changement de schéma, elles suivent le bon
      // jusqu'au bureau comme le reste de la preuve terrain.
      photos:
        (infos.photosAvant || []).length > 0 || (infos.photosApres || []).length > 0 || (infos.videos || []).length > 0
          ? { avant: infos.photosAvant || [], apres: infos.photosApres || [], videos: infos.videos || [] }
          : null,
      // Destinataires du bon signé (choix multiple côté technicien).
      courriels_envoi: infos.courrielsEnvoi || [],
      signe_par_nom: infos.signeParNom || null,
      // Équipe de 2+ : le dernier à fermer peut déclarer que son
      // collègue a déjà recueilli la signature — pas de 2e signature,
      // pas d'alerte « non signé » au bureau.
      signe_par_collegue: !!infos.signeParCollegue,
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
      // 🚧 Travaux non terminés + ce qui reste à faire (2026-08-22).
      travaux_non_termines: !!infos.travauxNonTermines,
      reste_a_faire: infos.resteAFaire || null,
      envoye_le: new Date().toISOString(),
      statut_facturation: "a_facturer",
  };
  const ecrire = (charge) =>
    supabase
      .from("bons_travail")
      .upsert(charge, { onConflict: "tache_id,employe_email" })
      .select("id")
      .single();

  let { data, error } = await ecrire(ligne);
  // ⚠️ FILET COLONNE MANQUANTE (leçon du 2026-08-15, où les devis n'ont
  // plus été enregistrés pendant une semaine faute d'une colonne) : si
  // le snippet SQL n'a pas encore été passé, on réessaie SANS les deux
  // nouvelles colonnes. Un bon de travail ne doit JAMAIS être perdu à
  // cause d'un ajout de schéma en retard — c'est la facturation qui est
  // au bout.
  if (error && (error.code === "PGRST204" || /travaux_non_termines|reste_a_faire/.test(error.message || ""))) {
    const { travaux_non_termines: _a, reste_a_faire: _b, ...sansNouvelles } = ligne;
    ({ data, error } = await ecrire(sansNouvelles));
  }
  if (error) throw error;
  // L'identifiant de LIGNE — l'envoi automatique du bon au client en a
  // besoin pour créer le lien public tout de suite après.
  return data?.id || null;
}

// 📦 MATÉRIEL DU STOCK AU COÛT STANDARD (2026-08-25, snippet 77) —
// items du catalogue posés sur le bon PAR LE BUREAU à la facturation :
// [{ id, nom, quantite, coutant }]. Coût interne seulement — jamais sur
// un document client. Le forfait murale, la prise de l'électricien :
// c'est par ici que la consommation d'entrepôt entre au coût de la job.
export async function majMaterielStock(bonRowId, items) {
  const id = String(bonRowId).startsWith("sbb-") ? String(bonRowId).slice(4) : bonRowId;
  const { error } = await supabase
    .from("bons_travail")
    .update({ materiel_stock: Array.isArray(items) ? items : [] })
    .eq("id", id);
  if (error) throw error;
}

// Un bon existe-t-il déjà pour cette tâche ? Garde anti-doublon du
// rattrapage de course (voir envoyer() côté technicien) : si le
// coéquipier vient de créer le bon, on ne crée pas le nôtre en plus.
// En cas d'erreur (hors-ligne, lecture bloquée), on répond false — le
// pire des cas est un bon en double que le bureau fusionne par tâche,
// bien moins grave qu'AUCUN bon (vécu : tâche Tomalex du 2026-08-17).
export async function bonExistePourTache(tacheId) {
  try {
    const { data, error } = await supabase
      .from("bons_travail")
      .select("id")
      .eq("tache_id", tacheId)
      .limit(1);
    if (error) return false;
    return (data || []).length > 0;
  } catch {
    return false;
  }
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
    videosUrls: Array.isArray(row.photos?.videos) ? row.photos.videos : [],
    courrielsEnvoi: Array.isArray(row.courriels_envoi) ? row.courriels_envoi : [],
    signeParNom: row.signe_par_nom || null,
    signeParCollegue: !!row.signe_par_collegue,
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
    travauxNonTermines: !!row.travaux_non_termines,
    resteAFaire: row.reste_a_faire || "",
    materielStock: Array.isArray(row.materiel_stock) ? row.materiel_stock : [],
    envoyeLe: row.envoye_le || null,
    employeEmail: (row.employe_email || "").toLowerCase(),
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
    statutQb:
      row.statut_facturation === "envoye"
        ? "envoye"
        : row.statut_facturation === "retire"
          ? "retire"
          : "en_attente",
    // Retrait de facturation (demande -> validation Admin principal).
    retraitStatut: row.retrait_statut || null,
    retraitRaison: row.retrait_raison || null,
    retraitNote: row.retrait_note || "",
    retraitDemandePar: row.retrait_demande_par || null,
    retraitDemandeLe: row.retrait_demande_le || null,
    retraitValidePar: row.retrait_valide_par || null,
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

// ------------------------------------------------------------
// RETRAIT DE FACTURATION — en deux temps, avec trace complète.
// ------------------------------------------------------------
// N'importe qui de la facturation peut DEMANDER (raison prédéfinie +
// note), mais seul un Admin principal VALIDE. « Travaux en cours » est
// un REPORT (le bon reste dans la pile, badgé) ; garantie et client
// maison sont des retraits — le bon sort de la pile mais GARDE ses
// coûts : l'analyse de rentabilité le compte en non facturable au lieu
// de le laisser s'évaporer. Tout s'applique par TÂCHE (tache_id) : un
// travail à plusieurs techniciens se retire d'un bloc.
export const RAISONS_RETRAIT = {
  travaux_en_cours: "Travaux en cours — sera facturé à la prochaine journée de facturation",
  garantie: "Retour sous garantie — non facturable",
  client_maison: "Client maison — non facturable",
};

export async function demanderRetraitFacturation(tacheId, raison, note) {
  const { data } = await supabase.auth.getSession();
  const email = data?.session?.user?.email || null;
  const { error } = await supabase
    .from("bons_travail")
    .update({
      retrait_statut: "demande",
      retrait_raison: raison,
      retrait_note: note || null,
      retrait_demande_par: email,
      retrait_demande_le: new Date().toISOString(),
      retrait_valide_par: null,
      retrait_valide_le: null,
    })
    .eq("tache_id", tacheId);
  if (error) throw error;
}

// `approuve` = true (le retrait s'applique) ou false (refus : le bon
// revient tel quel, la demande est effacée).
export async function validerRetraitFacturation(tacheId, approuve, raison) {
  const { data } = await supabase.auth.getSession();
  const email = data?.session?.user?.email || null;
  const champs = approuve
    ? {
        retrait_statut: raison === "travaux_en_cours" ? "reporte" : "retire",
        retrait_valide_par: email,
        retrait_valide_le: new Date().toISOString(),
        ...(raison !== "travaux_en_cours" ? { statut_facturation: "retire" } : {}),
      }
    : {
        retrait_statut: null,
        retrait_raison: null,
        retrait_note: null,
        retrait_demande_par: null,
        retrait_demande_le: null,
      };
  const { error } = await supabase.from("bons_travail").update(champs).eq("tache_id", tacheId);
  if (error) throw error;
}

// Un bon retiré peut revenir dans la pile (erreur de raison, client
// maison finalement facturé…) — Admin principal seulement.
export async function remettreAFacturer(tacheId) {
  const { error } = await supabase
    .from("bons_travail")
    .update({
      retrait_statut: null,
      retrait_raison: null,
      retrait_note: null,
      retrait_demande_par: null,
      retrait_demande_le: null,
      retrait_valide_par: null,
      retrait_valide_le: null,
      statut_facturation: "a_facturer",
    })
    .eq("tache_id", tacheId);
  if (error) throw error;
}

// ============================================================
// 🏗️/📄 RATTACHEMENT RÉTROACTIF (2026-08-22)
// ------------------------------------------------------------
// Le bon de travail garde une COPIE du projet et du devis, prise au
// moment où le technicien a fermé sa tâche. Rattacher la tâche après
// coup doit donc corriger le bon aussi — sinon la facturation continue
// d'afficher « aucun devis » sur un travail qui en a un, et le bon
// resterait hors projet.
// `null` = détachement volontaire ; les clés absentes ne sont pas touchées.
export async function rattacherAuBon(tacheId, { projetId, devisNumero } = {}) {
  if (!tacheId) return false;
  const maj = {};
  if (projetId !== undefined) maj.projet_id = projetId || null;
  if (devisNumero !== undefined) maj.devis_numero = devisNumero || null;
  if (Object.keys(maj).length === 0) return false;
  const { data, error } = await supabase
    .from("bons_travail")
    .update(maj)
    .eq("tache_id", tacheId)
    .select("id");
  if (error) throw error;
  return (data || []).length > 0;
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
