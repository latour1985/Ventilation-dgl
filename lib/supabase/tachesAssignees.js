// lib/supabase/tachesAssignees.js
//
// Pont agenda admin -> app technicien (Phase 2). L'agenda écrit une
// ligne par (tâche, technicien) à chaque assignation ; l'app technicien
// lit les lignes de SON courriel et se met à jour en direct (Realtime).

import { supabase } from "./client";

// Upsert d'une assignation (clé : tache_id + employe_email).
export async function assignerTacheSupabase(tache, employe, { date, heureDebut }) {
  if (!employe?.courriel) return; // employé sans courriel — rien à synchroniser
  const { error } = await supabase.from("taches_assignees").upsert(
    {
      tache_id: tache.id,
      employe_email: employe.courriel.toLowerCase(),
      employe_nom: employe.nom || null,
      titre: tache.titre || tache.clientNom || "Tâche",
      client_nom: tache.clientNom || null,
      description: tache.description || null,
      type_tache: tache.typeTache || null,
      projet_id: tache.projetId || null,
      date_debut: date,
      heure_debut: heureDebut || null,
      heures: tache.heures ?? null,
      jours: tache.jours ?? null,
      statut: "planifiee",
      // Fiche COMPLÈTE de la tâche (toutes ses informations : adresse des
      // travaux, lien devis, sauter week-end, client, etc.) — la
      // reconstruction de l'agenda restaure ainsi une tâche identique,
      // modifiable comme avant le rechargement.
      donnees: { ...tache },
    },
    { onConflict: "tache_id,employe_email" }
  );
  if (error) throw error;
}

// Retrait d'une assignation (tâche retirée de l'horaire d'un technicien).
export async function retirerTacheSupabase(tacheId, courriel) {
  if (!courriel) return;
  const { error } = await supabase
    .from("taches_assignees")
    .delete()
    .eq("tache_id", tacheId)
    .eq("employe_email", courriel.toLowerCase());
  if (error) throw error;
}

// Ajoute N jours à une date « AAAA-MM-JJ » en restant en heure LOCALE
// (jamais toISOString : le décalage UTC ferait basculer la journée).
function dateDecalee(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function estFinDeSemaine(dateISO) {
  const j = new Date(`${dateISO}T00:00:00`).getDay();
  return j === 0 || j === 6;
}

// Journées de travail d'une tâche qui s'étale sur plusieurs jours.
// Respecte « sauter les fins de semaine » quand l'agenda l'a demandé.
function joursDeLaTache(dateDebut, nbJours, sauterWeekend) {
  const total = Math.max(1, Number(nbJours) || 1);
  const jours = [];
  let curseur = dateDebut;
  let garde = 0;
  while (jours.length < total && garde < 60) {
    if (!(sauterWeekend && estFinDeSemaine(curseur))) jours.push(curseur);
    curseur = dateDecalee(curseur, 1);
    garde++;
  }
  return jours;
}

// Tâches assignées au technicien connecté (par courriel).
//
// ------------------------------------------------------------
// UNE TÂCHE DE PLUSIEURS JOURS DEVIENT UNE TÂCHE PAR JOUR
// ------------------------------------------------------------
// Le nombre de jours était enregistré à l'agenda mais jamais lu ici :
// un chantier du lundi au mercredi n'apparaissait que le LUNDI. Mardi
// matin, le technicien ouvrait un écran vide — pas de tâche, donc pas
// de transports (ils ne se créent que pour les journées qui ont du
// travail), et aucune façon de pointer ses heures.
//
// Chaque journée reçoit :
//   • sa propre carte et son propre chronomètre ;
//   • sa propre CLÉ D'HEURES (`cleHeures`) — sans ça, les heures de
//     mardi écraseraient celles de lundi, la table n'acceptant qu'une
//     ligne par tâche et par employé ;
//   • le même `tacheOrigineId`, pour rester rattachée au bloc d'agenda.
export async function listerTachesPourEmploye(courriel) {
  if (!courriel) return [];
  const { data, error } = await supabase
    .from("taches_assignees")
    .select("*")
    .eq("employe_email", courriel.toLowerCase())
    .order("date_debut");
  if (error) throw error;

  const lignes = [];
  (data || []).forEach((row) => {
    const nbJours = Math.max(1, Number(row.jours) || 1);
    const jours = joursDeLaTache(row.date_debut, nbJours, !!row.donnees?.sauterWeekend);
    jours.forEach((jour, index) => {
      lignes.push({ row, jour, index, nbJours: jours.length });
    });
  });

  // Conversion vers la forme de tâche de l'app technicien.
  return lignes.map(({ row, jour, index, nbJours }) => ({
    // Une carte par journée : l'identifiant porte le jour, sinon les
    // trois journées seraient la même tâche à l'écran.
    id: nbJours > 1 ? `sb-${row.id}-j${index + 1}` : `sb-${row.id}`,
    supabase: true,
    // Identifiant de la tâche CÔTÉ AGENDA — indispensable pour que le
    // travail complété retrouve son bloc dans l'agenda admin (vert ✓).
    tacheOrigineId: row.tache_id,
    // CLÉ D'ENREGISTREMENT DES HEURES — distincte par journée, sinon
    // mardi écraserait lundi (une seule ligne par tâche × employé).
    cleHeures: nbJours > 1 ? `${row.tache_id}::${jour}` : row.tache_id,
    // Position dans le chantier — sert à afficher « Jour 2 sur 3 » et à
    // savoir si c'est la DERNIÈRE journée prévue.
    jourNumero: index + 1,
    nbJoursPrevus: nbJours,
    dernierJourPrevu: index + 1 === nbJours,
    type: "travail",
    typeTache: row.type_tache || null,
    // Secteur CCQ (commercial/résidentiel) — décide du taux coûtant figé.
    secteur: row.donnees?.secteur === "residentiel" ? "residentiel" : "commercial",
    // Types NON FACTURABLES (visites, divers, congé) : rien ne part en
    // facturation à la fin. Les heures restent payées — sauf le congé,
    // qui n'a ni chronomètre ni heures.
    nonFacturable: !!row.donnees?.nonFacturable,
    sansHeures: !!row.donnees?.sansHeures,
    categorieHeures: row.donnees?.categorieHeures || "projet",
    date: jour,
    heure: row.heure_debut || "08:00",
    titre: row.titre,
    clientNom: row.client_nom,
    description: row.description,
    clientId: null,
    adresseId: null,
    // ADRESSE OÙ SE RENDRE — le technicien n'a pas accès au répertoire
    // des clients : sans cette chaîne de texte, son écran reste vide et
    // il part sans savoir où aller. `adresseIntervention` est stampée à
    // la création de la tâche (adresse des travaux, ou celle du client
    // à défaut) ; on accepte aussi les anciens champs pour les tâches
    // créées avant cet ajout.
    adresseIntervention:
      row.donnees?.adresseIntervention || row.donnees?.adresseTravaux || null,
    adresseTravaux: row.donnees?.adresseTravaux || null,
    projetId: row.projet_id || null,
    // Dépôt perçu (transmis via la fiche complète) — le technicien voit
    // le récapitulatif, mais ne génère ni n'envoie jamais de facture.
    depotRequis: !!row.donnees?.depotRequis,
    depotMontant: Number(row.donnees?.depotMontant) || 0,
    zoneAppel: row.donnees?.zoneAppel || null, // "Zone 1/2/3" ou "hors_zone"
    // Courriels du client — pour l'envoi du bon de travail signé depuis
    // le terrain (choix multiple d'adresses).
    clientCourriels: Array.isArray(row.donnees?.clientCourriels) ? row.donnees.clientCourriels : [],
    // 📎 Photos et plans joints par le bureau à la création de la tâche
    // — affichés sur le téléphone (images plein écran, PDF dans le
    // navigateur). Le technicien a l'information dans sa poche.
    piecesJointes: Array.isArray(row.donnees?.piecesJointes) ? row.donnees.piecesJointes : [],
    // Devis lié : numéro + lignes SANS PRIX (nom, quantité, unité
    // seulement) — pour la fenêtre « Voir le devis » côté technicien.
    devisNumero: row.donnees?.devisNumero || null,
    devisLignes: Array.isArray(row.donnees?.devisLignes) ? row.donnees.devisLignes : [],
    etat: "a_faire",
    tempsAccumuleSec: 0,
    tempsDebutSegment: null,
    kilometres: 0,
  }));
}

// Toutes les assignations (brutes) — pour reconstruire la grille de
// l'agenda admin au démarrage (persistance de l'horaire).
export async function listerToutesAssignations() {
  const { data, error } = await supabase
    .from("taches_assignees")
    .select("*")
    .order("date_debut");
  if (error) throw error;
  return data || [];
}

// Abonnement Realtime : rappelé à chaque changement d'assignation.
export function sAbonnerTachesAssignees(onChangement) {
  const canal = supabase
    .channel("taches-assignees")
    .on("postgres_changes", { event: "*", schema: "public", table: "taches_assignees" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

// ============================================================
// ÉQUIPE SUR UNE TÂCHE — qui y est assigné, qui a déjà terminé
// ------------------------------------------------------------
// Quand deux techniciens partagent un travail, trois questions se
// posent, et elles ont toutes la même réponse ici :
//
//   • Le bureau doit-il facturer ? → seulement quand TOUS ont fini,
//     sinon on facture un travail inachevé.
//   • Qui fait signer le client ? → le DERNIER à fermer. Sans ça,
//     chacun fait signer le sien et le client signe deux fois pour
//     le même travail.
//   • Qui manque-t-il ? → nommé, pour pouvoir l'appeler.
//
// `tacheId` est l'identifiant CÔTÉ AGENDA (tacheOrigineId dans l'app
// technicien), le seul que les deux tables partagent.
//
// `jour` (AAAA-MM-JJ, facultatif) : la journée qu'on regarde. Il compte
// pour les chantiers de PLUSIEURS JOURS, où les heures sont rangées
// sous des clés « id::jour » — une par journée. Sans lui, la recherche
// exacte sur `tacheId` ne trouvait AUCUNE de ces lignes : au moment de
// fermer la dernière journée, chaque technicien voyait ses collègues
// « pas encore terminés » pour toujours, et la consigne « c'est toi qui
// fais signer le client » ne s'affichait jamais. Avec lui, « terminé »
// veut dire : a fermé SA carte de CETTE journée-là — ce qui est la
// bonne question, autant pour la bannière que pour la signature.
export async function etatEquipeTache(tacheId, jour = null) {
  if (!tacheId) return null;
  const [assignations, travaux] = await Promise.all([
    supabase.from("taches_assignees").select("employe_email, employe_nom").eq("tache_id", tacheId),
    supabase
      .from("travaux_effectues")
      .select("tache_id, employe_email, employe_nom, heures")
      // La clé exacte (tâche d'un jour) ET les clés par journée
      // (« id::2026-08-04 ») d'un chantier multi-jours.
      .or(`tache_id.eq.${tacheId},tache_id.like.${tacheId}::%`),
  ]);
  if (assignations.error) throw assignations.error;
  if (travaux.error) throw travaux.error;

  const normaliser = (e) => (e || "").toLowerCase();
  const equipe = (assignations.data || []).map((a) => ({
    email: normaliser(a.employe_email),
    nom: a.employe_nom || a.employe_email,
  }));
  // « Fini » = a une ligne d'heures pour LA journée demandée (clé exacte
  // ou clé de cette journée). Sans `jour`, n'importe quelle ligne compte.
  const compteCommeFini = (t) =>
    t.tache_id === tacheId ? true : jour ? t.tache_id === `${tacheId}::${jour}` : true;
  const finis = new Set((travaux.data || []).filter(compteCommeFini).map((t) => normaliser(t.employe_email)));

  return {
    equipe,
    partage: equipe.length > 1,
    termines: equipe.filter((m) => finis.has(m.email)),
    manquants: equipe.filter((m) => !finis.has(m.email)),
    // Heures de TOUTE l'équipe — c'est ce qui va au coût du projet.
    heuresTotales: (travaux.data || []).reduce((s, t) => s + (Number(t.heures) || 0), 0),
  };
}

// Suis-je le DERNIER à fermer ? Vrai si tous les autres membres de
// l'équipe ont déjà enregistré leur travail. C'est cette personne qui
// fait signer le bon de travail au client.
export async function suisJeLeDernier(tacheId, monCourriel, jour = null) {
  const etat = await etatEquipeTache(tacheId, jour);
  if (!etat || !etat.partage) return true; // seul sur la tâche
  const moi = (monCourriel || "").toLowerCase();
  return etat.manquants.every((m) => m.email === moi);
}
