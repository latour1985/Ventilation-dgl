// lib/supabase/piecesCommandees.js
//
// PIÈCES À COMMANDER — le suivi entre le diagnostic et la réparation.
//
// Le technicien constate qu'il manque une pièce : il note le modèle, le
// numéro de série et la pièce requise. Sa visite de diagnostic se
// facture normalement ; une tâche de RETOUR est créée, bloquée tant que
// la pièce n'est pas arrivée (et payée, si le paiement est exigé).
//
// ------------------------------------------------------------
// CE QUI DÉBLOQUE : UN HUMAIN, JAMAIS UNE FACTURE
// ------------------------------------------------------------
// En phase 4, la facture du fournisseur entrée contre le bon de
// commande dans QuickBooks lèvera une ALERTE — « la facture est
// arrivée, vérifie avec le magasinier ». Elle ne débloquera rien.
//
// Un fournisseur peut facturer à l'expédition alors que la pièce roule
// encore ; la saisie comptable peut traîner deux jours ; une livraison
// peut être partielle. Envoyer un technicien chez un client pour une
// pièce absente est PIRE que de ne rien automatiser, parce qu'on y
// serait allé en confiance.
//
// C'est donc `recu_le` — posé par la personne qui a la pièce dans les
// mains — qui ouvre la planification.

import { supabase } from "./client";

// Date du jour en heure LOCALE. `toISOString()` donnerait l'heure UTC :
// passé 20 h au Québec, on serait déjà "demain" et une pièce attendue
// aujourd'hui serait affichée en retard tous les soirs.
function aujourdhuiLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function versUi(row) {
  return {
    id: row.id,
    tacheOrigineId: row.tache_origine_id || null,
    tacheRetourId: row.tache_retour_id || null,
    clientId: row.client_id || null,
    clientNom: row.client_nom || "",
    modele: row.modele || "",
    numeroSerie: row.numero_serie || "",
    pieceRequise: row.piece_requise || "",
    note: row.note || "",
    fournisseurId: row.fournisseur_id || null,
    fournisseurNom: row.fournisseur_nom || "",
    numeroBc: row.numero_bc || "",
    numeroFactureFournisseur: row.numero_facture_fournisseur || "",
    statut: row.statut || "a_commander",
    paiementRequis: !!row.paiement_requis,
    // Bloc 3 : le client paie AVANT qu'on commande (et non avant la
    // planification) — le bouton « Commander la pièce » reste verrouillé
    // tant que le paiement n'est pas confirmé.
    paiementAvantCommande: !!row.paiement_avant_commande,
    paiementRecu: !!row.paiement_recu,
    // Bloc 2 : trace de l'envoi du BC au fournisseur (confirmé par un
    // humain — un lien « mailto » ne peut pas savoir si on a cliqué
    // Envoyer dans Outlook).
    bcEnvoyeLe: row.bc_envoye_le || null,
    // Trace de la demande de paiement ENVOYÉE au client — sans elle, tout
    // le monde croit que quelqu'un d'autre a appelé.
    demandePaiementLe: row.demande_paiement_le || null,
    montantPiece: row.montant_piece != null ? Number(row.montant_piece) : null,
    recuLe: row.recu_le || null,
    recuParNom: row.recu_par_nom || "",
    recuVia: row.recu_via || null,
    annuleLe: row.annule_le || null,
    annuleRaison: row.annule_raison || "",
    unites: Array.isArray(row.unites) ? row.unites : [],
    dateReceptionPrevue: row.date_reception_prevue || null,
    // Snippet 36 : livraison FIXE (quelqu'un se déplace à l'entrepôt
    // pour recevoir ce jour-là) ou souple (au plus tard). Le courriel
    // au fournisseur adapte sa formulation.
    livraisonFixe: !!row.livraison_fixe,
    // Historique des reports { de, a, le, par } — la mémoire des
    // promesses du fournisseur.
    reportsDate: Array.isArray(row.reports_date) ? row.reports_date : [],
    // Date promise DÉPASSÉE et toujours rien : c'est ce qui doit faire
    // rappeler le fournisseur.
    enRetard: !!row.date_reception_prevue && row.statut !== "recue" && row.statut !== "annulee"
      && row.date_reception_prevue < aujourdhuiLocal(),
    demandeParNom: row.demande_par_nom || "",
    creeLe: row.created_at || null,
    // Âge en jours — c'est lui qui fait relancer un fournisseur qui
    // traîne. Une pièce « commandée » depuis 3 semaines doit crier.
    jours: row.created_at
      ? Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000))
      : 0,
  };
}

export async function listerPieces() {
  const { data, error } = await supabase
    .from("pieces_commandees")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data || []).map(versUi);
}

export async function creerPiece(p, session) {
  const nom = session?.user?.user_metadata?.nom || session?.user?.email || null;
  // 🛡️ GARDE ANTI-DOUBLON CÔTÉE SERVEUR (2026-08-27, bogue vécu : la
  // création automatique tournait AVANT le chargement de la liste des
  // pièces — chaque rechargement de page recréait la même demande, le
  // bureau s'est retrouvé avec une pile de doublons). UNE tâche
  // d'origine = UNE pièce : si elle existe déjà, on la RETOURNE au lieu
  // d'en créer une autre. Le verrou final est l'index unique du snippet
  // SQL 80 — l'insert concurrent (2 postes à la même seconde) échoue en
  // 23505 et on relit l'existante.
  const lireExistante = async () => {
    if (!p.tacheOrigineId) return null;
    const { data } = await supabase
      .from("pieces_commandees")
      .select("*")
      .eq("tache_origine_id", p.tacheOrigineId)
      .limit(1);
    return data && data[0] ? versUi(data[0]) : null;
  };
  const existante = await lireExistante();
  if (existante) return existante;
  const { data, error } = await supabase
    .from("pieces_commandees")
    .insert({
      tache_origine_id: p.tacheOrigineId || null,
      tache_retour_id: p.tacheRetourId || null,
      client_id: p.clientId || null,
      client_nom: p.clientNom || null,
      modele: p.modele || null,
      numero_serie: p.numeroSerie || null,
      piece_requise: p.pieceRequise,
      note: p.note || null,
      unites: p.unites || [],
      demande_par_nom: nom,
    })
    .select()
    .single();
  if (error) {
    // 23505 = l'index unique a fait son travail (course entre 2 postes).
    if (error.code === "23505") {
      const gagnante = await lireExistante();
      if (gagnante) return gagnante;
    }
    throw error;
  }
  return versUi(data);
}

export async function majPiece(id, champs) {
  const { error } = await supabase.from("pieces_commandees").update(champs).eq("id", id);
  if (error) throw error;
}

// RÉCEPTION CONFIRMÉE — le seul geste qui ouvre la planification.
export async function marquerRecue(id, parNom, via = "manuel") {
  await majPiece(id, {
    statut: "recue",
    recu_le: new Date().toISOString(),
    recu_par_nom: parNom || null,
    recu_via: via,
  });
}

// Annulation : le client refuse la réparation, la pièce n'est plus
// fabriquée, le coût ne vaut plus la peine. La raison reste au dossier.
export async function annulerPiece(id, raison) {
  await majPiece(id, {
    statut: "annulee",
    annule_le: new Date().toISOString(),
    annule_raison: raison || null,
  });
}

// La tâche de retour est-elle plaçable à l'horaire ?
// DEUX conditions, et le paiement compte autant que la pièce : on ne
// pose pas une pièce de 800 $ avant d'avoir été payé.
//
// PIÈCE ANNULÉE = TÂCHE TOUJOURS BLOQUÉE. Avant, l'annulation
// déverrouillait la tâche : elle glissait dans « Prêtes à planifier »
// et on risquait de céduler un technicien pour poser une pièce qui
// n'existera jamais. Maintenant elle reste bloquée, avec une question
// à l'écran : supprimer la tâche, ou la garder sans pièce ? C'est un
// humain qui tranche — peut-être que le client a changé d'idée.
export function pieceBloqueLaTache(piece) {
  if (!piece) return false;
  if (piece.statut === "annulee") return true;
  if (piece.statut !== "recue") return true;
  if (piece.paiementRequis && !piece.paiementRecu) return true;
  return false;
}

export function sAbonnerPieces(onChangement) {
  const canal = supabase
    .channel("pieces-commandees")
    .on("postgres_changes", { event: "*", schema: "public", table: "pieces_commandees" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
