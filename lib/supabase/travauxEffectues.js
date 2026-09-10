// lib/supabase/travauxEffectues.js
//
// Travaux COMPLÉTÉS par les techniciens (terrain -> bureau). Chaque
// tâche terminée écrit une ligne avec les heures réelles ET le taux
// coûtant FIGÉ au moment de la saisie (spec contrôle de gestion) —
// une augmentation future de la grille ne réécrit jamais le passé.

import { supabase } from "./client";
import { tauxEtSecteurPourCourriel } from "./tauxMetiers";

// Enregistre un travail complété. `infos` = { tacheId, titre, clientNom,
// date, heures, estTransport, kilometres, projetId, noteTerrain }.
export async function enregistrerTravailEffectue(infos, session) {
  const email = session?.user?.email?.toLowerCase() || null;
  const nom = session?.user?.user_metadata?.nom || (email ? email.split("@")[0] : null);
  return ecrireTravail(infos, email, nom);
}

// 🏢 FERMETURE PAR LE BUREAU (2026-08-17) : l'admin déclare les heures
// d'un technicien qui a OUBLIÉ de fermer — même écriture, même taux
// figé, mais l'employé est EXPLICITE (pas la session de l'admin).
export async function enregistrerTravailPourEmploye(infos, employe) {
  const email = (employe?.courriel || "").toLowerCase() || null;
  const nom = employe?.nom || (email ? email.split("@")[0] : null);
  return ecrireTravail(infos, email, nom);
}

// Taux FIGÉ à la saisie : lu maintenant, stocké pour toujours. Partagé
// entre l'écriture directe et la fermeture atomique (snippet 141).
export async function resoudreTauxFige(email, secteur) {
  let tauxFige = null;
  let secteurPaie = secteur === "residentiel" ? "residentiel" : "commercial";
  try {
    // Le SECTEUR de la tâche choisit la colonne de la grille CCQ — sauf
    // droit acquis « toujours commercial » (fiche employé), qui force le
    // taux ET l'étiquette de paie au commercial.
    const resolution = await tauxEtSecteurPourCourriel(email, secteurPaie);
    tauxFige = resolution.taux;
    secteurPaie = resolution.secteurPaie;
  } catch {
    // grille ou répertoire inaccessibles — taux null, repli côté admin
  }
  return { tauxFige, secteurPaie };
}

// Le MOULE de la ligne travaux_effectues — même principe que
// construireLigneBon : un seul endroit décide de ce qui s'écrit.
export function construireLigneTravail(infos, email, nom, tauxFige, secteurPaie) {
  return {
      tache_id: infos.tacheId,
      employe_email: email,
      employe_nom: nom,
      titre: infos.titre || null,
      client_nom: infos.clientNom || null,
      date_travail: infos.date,
      heures: Math.round((infos.heures || 0) * 100) / 100,
      est_transport: !!infos.estTransport,
      kilometres: infos.kilometres ?? null,
      projet_id: infos.projetId || null,
      note_terrain: infos.noteTerrain || null,
      // Note INTERNE : jamais montrée au client — mais visible au bureau
      // (agenda) pour répondre vite quand le client rappelle.
      note_interne: infos.noteInterne || null,
      // Heures RÉELLES de début/fin (horodatages) — affichées au bureau et
      // servant de base aux ajustements par heure de la journée.
      debut_reel: infos.debutReel ? new Date(infos.debutReel).toISOString() : null,
      fin_reelle: infos.finReelle ? new Date(infos.finReelle).toISOString() : null,
      // Liens des photos téléversées (stockage Supabase) — avant/après.
      // Les VIDÉOS partagent le même champ jsonb (2026-08-20) — elles
      // s'affichent ainsi dans la fiche de tâche du bureau.
      photos:
        (infos.photosAvant || []).length > 0 || (infos.photosApres || []).length > 0 || (infos.videos || []).length > 0
          ? { avant: infos.photosAvant || [], apres: infos.photosApres || [], videos: infos.videos || [] }
          : null,
      taux_coutant_fige: tauxFige,
      // L'étiquette suit la PAIE (droit acquis inclus), pas la tâche.
      secteur: secteurPaie === "residentiel" ? "residentiel" : "commercial",
      // OÙ CES HEURES VONT DANS LES COÛTS — 'projet' (défaut historique),
      // 'administratif' (visites faites par l'administration) ou 'divers'.
      // La PAIE ne change pas : toutes sont dues. Seule l'imputation au
      // coût des projets diffère, pour qu'une visite de soumission ne
      // gonfle pas le coût d'un contrat pas encore vendu.
      categorie_heures: infos.categorieHeures || "projet",
      // JOURNÉE BLOQUÉE : posé quand le chrono a dépassé le plafond et
      // que la tâche s'est fermée seule. Tant que ce drapeau est là, la
      // journée entière est exclue des « Heures de la semaine ».
      jour_bloque: !!infos.jourBloque,
      bloque_raison: infos.bloqueRaison || null,
      // CORRECTION À VALIDER — posée quand le technicien déclare
      // lui-même son heure de fin après un chrono oublié. Les heures
      // déclarées comptent tout de suite (le chrono emballé, lui, est
      // connu faux), mais l'administrateur doit approuver : la ligne
      // apparaît dans la liste des corrections en attente.
      heures_proposees: infos.heuresProposees != null ? arrondi2(infos.heuresProposees) : null,
      debut_propose: infos.debutPropose || null,
      fin_propose: infos.finPropose || null,
      proposition_par: infos.propositionPar || null,
      proposition_le: infos.propositionPar ? new Date().toISOString() : null,
      groupe_proposition: infos.propositionPar ? `chrono-${infos.tacheId}` : null,
      // ➕ AJOUT TARDIF PAR LE BUREAU (2026-08-31) : des heures ajoutées
      // sur une semaine de paie DÉJÀ PASSÉE portent d'emblée la marque
      // de correction — la différence (tout le montant, avant = 0) part
      // en Report ± sur la semaine courante, comme les corrections.
      ...(infos.corrigeLe !== undefined ? { corrige_le: infos.corrigeLe } : {}),
      ...(infos.heuresAvantCorrection !== undefined ? { heures_avant_correction: infos.heuresAvantCorrection } : {}),
  };
}

async function ecrireTravail(infos, email, nom) {
  const { tauxFige, secteurPaie } = await resoudreTauxFige(email, infos.secteur);
  const { error } = await supabase.from("travaux_effectues").upsert(
    construireLigneTravail(infos, email, nom, tauxFige, secteurPaie),
    { onConflict: "tache_id,employe_email" }
  );
  if (error) throw error;
}

// Mes heures pour cette tâche (clé exacte, jour compris) sont-elles déjà
// au bureau ? Garde de la fermeture d'équipe : si oui, plus rien à
// confirmer — on ne repose pas la question (téléphone réinstallé…).
export async function travailDejaEnregistre(tacheCle, email) {
  const info = await infoTravailEnregistre(tacheCle, email);
  return info.existe;
}

// ⚠️ « DÉJÀ FERMÉE » DOIT VENIR DE LA BASE, PAS DU TÉLÉPHONE
// (diagnostic 2026-08-20). Le drapeau `envoye` et son horodatage
// vivaient UNIQUEMENT dans la mémoire locale de l'appareil : PWA
// réinstallée, cache vidé ou deuxième téléphone, et une tâche déjà
// fermée redevenait « à faire » — le délai de modification de 10
// minutes ne s'appliquait plus, et le bon pouvait être renvoyé des
// jours plus tard. La ligne d'heures, elle, est au bureau : c'est
// ELLE qui fait foi, avec son heure d'écriture.
export async function infoTravailEnregistre(tacheCle, email) {
  try {
    const { data, error } = await supabase
      .from("travaux_effectues")
      .select("id, created_at")
      .eq("tache_id", tacheCle)
      .eq("employe_email", (email || "").toLowerCase())
      .limit(1);
    if (error || (data || []).length === 0) return { existe: false, creeLe: null };
    return { existe: true, creeLe: data[0].created_at || null };
  } catch {
    // Hors ligne : on ne PRÉTEND pas qu'elle est fermée (le technicien
    // sur un chantier sans réseau doit pouvoir travailler).
    return { existe: false, creeLe: null };
  }
}

// Conversion d'une ligne DB vers la forme des `travaux` de l'app —
// partagée par la liste admin et la liste « Mes heures » du technicien.
function versUiTravail(row) {
  return {
    id: `sbt-${row.id}`,
    supabase: true,
    tacheId: row.tache_id,
    clientId: null,
    clientNom: row.client_nom || "",
    projetId: row.projet_id || null,
    heures: Number(row.heures) || 0,
    estTransport: !!row.est_transport,
    distanceKm: row.kilometres != null ? Number(row.kilometres) : undefined,
    titre: row.titre || (row.est_transport ? "Transport" : "Travail complété"),
    date: row.date_travail,
    statut: "complete",
    montant: null,
    noteTerrain: row.note_terrain || "",
    noteInterne: row.note_interne || "",
    photos: [],
    // Liens des photos réelles du chantier (stockage Supabase).
    photosAvantUrls: Array.isArray(row.photos?.avant) ? row.photos.avant : [],
    photosApresUrls: Array.isArray(row.photos?.apres) ? row.photos.apres : [],
    videosUrls: Array.isArray(row.photos?.videos) ? row.photos.videos : [],
    employeEmail: row.employe_email,
    employeNom: row.employe_nom,
    tauxCoutantFige: row.taux_coutant_fige != null ? Number(row.taux_coutant_fige) : null,
    secteur: row.secteur === "residentiel" ? "residentiel" : "commercial",
    // Heures réelles de début/fin (horodatages ISO) — null pour les
    // lignes complétées avant l'ajout de cette capture.
    debutReel: row.debut_reel || null,
    finReelle: row.fin_reelle || null,
    // Proposition d'ajustement d'heures (répartiteur) en attente de
    // validation par un administrateur — null si aucune. Les lignes
    // d'une même correction partagent un groupe (validées ensemble).
    heuresProposees: row.heures_proposees != null ? Number(row.heures_proposees) : null,
    propositionPar: row.proposition_par || null,
    debutPropose: row.debut_propose || null,
    finPropose: row.fin_propose || null,
    groupeProposition: row.groupe_proposition || null,
    // Correction TARDIVE (appliquée après la fin de la semaine de paie de
    // la ligne) : date de correction + heures d'avant — la différence est
    // REPORTÉE sur la semaine de paie de la correction.
    corrigeLe: row.corrige_le || null,
    heuresAvantCorrection: row.heures_avant_correction != null ? Number(row.heures_avant_correction) : null,
    // JOURNÉE BLOQUÉE (chrono oublié, fermeture automatique) : la
    // journée entière de ce technicien sort de tous les totaux tant
    // qu'un administrateur ne l'a pas débloquée.
    categorieHeures: row.categorie_heures || "projet",
    jourBloque: !!row.jour_bloque,
    bloqueRaison: row.bloque_raison || "",
  };
}

// Une JOURNÉE (technicien × date) est bloquée dès qu'UNE de ses lignes
// porte le drapeau. Partagé par l'écran admin et « Mes heures ».
export function cleJour(email, date) {
  return `${(email || "").toLowerCase()}|${date}`;
}
export function joursBloques(travaux) {
  const set = new Set();
  (travaux || []).forEach((t) => {
    if (t.jourBloque && t.employeEmail && t.date) set.add(cleJour(t.employeEmail, t.date));
  });
  return set;
}

// Liste pour l'admin — convertie vers la forme des `travaux` de l'app.
export async function listerTravauxEffectues() {
  const { data, error } = await supabase
    .from("travaux_effectues")
    .select("*")
    .order("date_travail", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(versUiTravail);
}

// « Mes heures » (app technicien) : SEULEMENT les lignes du compte
// connecté — heures uniquement, jamais de taux ni de montants affichés.
export async function listerTravauxPourEmploye(courriel) {
  if (!courriel) return [];
  const { data, error } = await supabase
    .from("travaux_effectues")
    .select("*")
    .eq("employe_email", courriel.toLowerCase())
    .order("date_travail", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(versUiTravail);
}

// Identifiant BRUT de la ligne (les ids côté app portent le préfixe sbt-).
function idBrut(id) {
  return String(id).startsWith("sbt-") ? String(id).slice(4) : id;
}

const arrondi2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const CHAMPS_PROPOSITION_VIDES = {
  heures_proposees: null,
  proposition_par: null,
  proposition_le: null,
  debut_propose: null,
  fin_propose: null,
  groupe_proposition: null,
};

// AJUSTEMENT DIRECT (Admin principal / régulier) — applique d'un coup une
// correction qui peut toucher PLUSIEURS lignes (la ligne éditée + ses
// voisins réalloués). Le taux figé de chaque ligne ne bouge jamais.
// `ajustements` = [{ id, heures, debutReel?, finReelle? }]
export async function appliquerAjustementsHeures(ajustements) {
  // 🛡️ TOUT OU RIEN (snippet 141, audit 2026-09-09) : une correction qui
  // réalloue « 9 h job A → 5 h A + 4 h B » écrit DEUX lignes. La boucle
  // d'avant pouvait s'arrêter entre les deux (5 h écrites, 4 h perdues
  // — de la paie CCQ disparue). La fonction Postgres applique le lot
  // entier dans UNE transaction. Repli : l'ancienne boucle.
  const charge = (ajustements || []).map((a) => ({
    id: idBrut(a.id),
    heures: arrondi2(a.heures),
    ...(a.debutReel !== undefined ? { debut_reel: a.debutReel } : {}),
    ...(a.finReelle !== undefined ? { fin_reelle: a.finReelle } : {}),
    ...(a.corrigeLe !== undefined ? { corrige_le: a.corrigeLe } : {}),
    ...(a.heuresAvantCorrection !== undefined ? { heures_avant_correction: a.heuresAvantCorrection } : {}),
  }));
  if (charge.length === 0) return;
  const { error } = await supabase.rpc("appliquer_ajustements_heures_lot", { p_ajustements: charge });
  if (!error) return;
  if (!(error.code === "PGRST202" || /find the function|does not exist/i.test(String(error.message || "")))) throw error;
  for (const a of ajustements) {
    const maj = { heures: arrondi2(a.heures), ...CHAMPS_PROPOSITION_VIDES };
    if (a.debutReel !== undefined) maj.debut_reel = a.debutReel;
    if (a.finReelle !== undefined) maj.fin_reelle = a.finReelle;
    // Correction TARDIVE (semaine de paie déjà passée) : mémorise la date
    // de correction et les heures d'avant — la différence sera REPORTÉE
    // sur la semaine de paie courante (calculé par l'appelant).
    if (a.corrigeLe !== undefined) maj.corrige_le = a.corrigeLe;
    if (a.heuresAvantCorrection !== undefined) maj.heures_avant_correction = a.heuresAvantCorrection;
    const { error: e2 } = await supabase.from("travaux_effectues").update(maj).eq("id", idBrut(a.id));
    if (e2) throw e2;
  }
}

// ============================================================
// 🏗️ RATTACHEMENT RÉTROACTIF D'UN PROJET (2026-08-22)
// ------------------------------------------------------------
// Quand le bureau rattache une tâche DÉJÀ TRAVAILLÉE à un projet, les
// heures déjà pointées portent encore l'ancien projet (chaque ligne a
// gardé une COPIE du projet au moment de la fermeture). Sans cette
// reprise, la rentabilité du projet — qui additionne les heures
// « qui portent son nom » — resterait fausse en silence.
//
// La tâche d'un chantier de plusieurs jours range ses heures sous des
// clés « id::jour » : on reprend donc la clé exacte ET ses journées.
// ============================================================
function filtreCleTache(requete, tacheId) {
  return requete.or(`tache_id.eq.${tacheId},tache_id.like.${tacheId}::%`);
}

// Ce que le rattachement VA toucher — pour l'annoncer avant d'agir
// (« 3 entrées d'heures, 12,50 h seront ajoutées au projet »).
export async function heuresRattachablesA(tacheId) {
  if (!tacheId) return { nb: 0, heures: 0 };
  const { data, error } = await filtreCleTache(
    supabase.from("travaux_effectues").select("id, heures, categorie_heures"),
    tacheId
  );
  if (error) throw error;
  // Seules les heures de CHANTIER comptent dans un projet — les heures
  // administratives et « divers » sont des frais généraux, elles ne
  // doivent jamais gonfler le coût d'un chantier.
  const lignes = (data || []).filter((r) => (r.categorie_heures || "projet") === "projet");
  return {
    nb: lignes.length,
    heures: arrondi2(lignes.reduce((s, r) => s + (Number(r.heures) || 0), 0)),
  };
}

// Réécrit le projet sur les heures DÉJÀ enregistrées de cette tâche.
// `projetId` à null = détachement (les heures redeviennent hors projet).
// `toutesCategories` (2026-08-31) : le TRAVAIL AU SHOP pointe ses heures
// en « divers » — quand le bureau confirme après coup le projet proposé
// par le technicien, ces heures-là doivent suivre aussi. Réservé à ce
// cas : partout ailleurs, seules les heures de chantier suivent.
export async function rattacherProjetAuxHeures(tacheId, projetId, { toutesCategories = false } = {}) {
  if (!tacheId) return 0;
  const { data, error } = await filtreCleTache(
    supabase.from("travaux_effectues").select("id, categorie_heures"),
    tacheId
  );
  if (error) throw error;
  const cibles = (data || []).filter((r) => toutesCategories || (r.categorie_heures || "projet") === "projet");
  for (const r of cibles) {
    const { error: e2 } = await supabase
      .from("travaux_effectues")
      .update({ projet_id: projetId || null })
      .eq("id", r.id);
    if (e2) throw e2;
  }
  return cibles.length;
}

// 🛡️ RATTACHEMENT TOUT-OU-RIEN (snippet 141, audit 2026-09-09) : les
// heures ET le bon de travail suivent le projet/devis dans UNE
// transaction. Avant, la boucle pouvait s'arrêter au milieu — 3 lignes
// d'heures sur 8 rattachées, et la rentabilité du chantier mentait en
// silence. Retourne le nombre de lignes d'heures touchées, ou null si
// le snippet n'est pas passé (l'appelant retombe sur l'ancien chemin).
export async function rattacherTacheLot(tacheId, { majProjet = false, projetId = null, toutesCategories = false, majDevis = false, devisNumero = null } = {}) {
  if (!tacheId || (!majProjet && !majDevis)) return 0;
  const { data, error } = await supabase.rpc("rattacher_tache_lot", {
    p_tache_id: tacheId,
    p_maj_projet: majProjet,
    p_projet_id: projetId || null,
    p_toutes_categories: toutesCategories,
    p_maj_devis: majDevis,
    p_devis_numero: devisNumero || null,
  });
  if (error) {
    if (error.code === "PGRST202" || /find the function|does not exist/i.test(String(error.message || ""))) return null;
    throw error;
  }
  return Number(data) || 0;
}

// PROPOSITION (répartiteur) — les lignes d'une même correction partagent
// un GROUPE : l'administrateur valide ou refuse le tout d'un bloc.
// L'heure ORIGINALE reste en vigueur partout en attendant.
export async function proposerAjustementsHeures(ajustements, parNom) {
  const groupe = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  for (const a of ajustements) {
    const { error } = await supabase
      .from("travaux_effectues")
      .update({
        heures_proposees: arrondi2(a.heures),
        debut_propose: a.debutReel !== undefined ? a.debutReel : null,
        fin_propose: a.finReelle !== undefined ? a.finReelle : null,
        proposition_par: parNom || null,
        proposition_le: new Date().toISOString(),
        groupe_proposition: groupe,
      })
      .eq("id", idBrut(a.id));
    if (error) throw error;
  }
  return groupe;
}

// VALIDATION d'un groupe : chaque proposition devient officielle (heures
// + heures réelles corrigées) — paie, coûts de projets et agenda suivent.
// `lignes` = les lignes du groupe telles que chargées côté app.
export async function validerGroupePropositions(lignes) {
  // 🛡️ TOUT OU RIEN (snippet 141) : « le tout d'un bloc » est maintenant
  // garanti par Postgres — la même transaction que les ajustements
  // directs. Repli : l'ancienne boucle si le snippet n'est pas passé.
  const charge = (lignes || [])
    .filter((l) => l.heuresProposees != null)
    .map((l) => ({
      id: idBrut(l.id),
      heures: arrondi2(l.heuresProposees),
      ...(l.debutPropose ? { debut_reel: l.debutPropose } : {}),
      ...(l.finPropose ? { fin_reelle: l.finPropose } : {}),
      ...(l.corrigeLeAEcrire !== undefined ? { corrige_le: l.corrigeLeAEcrire } : {}),
      ...(l.heuresAvantCorrectionAEcrire !== undefined ? { heures_avant_correction: l.heuresAvantCorrectionAEcrire } : {}),
    }));
  if (charge.length === 0) return;
  const { error } = await supabase.rpc("appliquer_ajustements_heures_lot", { p_ajustements: charge });
  if (!error) return;
  if (!(error.code === "PGRST202" || /find the function|does not exist/i.test(String(error.message || "")))) throw error;
  for (const l of lignes) {
    if (l.heuresProposees == null) continue;
    const maj = { heures: arrondi2(l.heuresProposees), ...CHAMPS_PROPOSITION_VIDES };
    if (l.debutPropose) maj.debut_reel = l.debutPropose;
    if (l.finPropose) maj.fin_reelle = l.finPropose;
    // Correction TARDIVE : champs de report calculés par l'appelant (la
    // date qui compte est celle de la VALIDATION par l'administrateur).
    if (l.corrigeLeAEcrire !== undefined) maj.corrige_le = l.corrigeLeAEcrire;
    if (l.heuresAvantCorrectionAEcrire !== undefined) maj.heures_avant_correction = l.heuresAvantCorrectionAEcrire;
    const { error: e2 } = await supabase.from("travaux_effectues").update(maj).eq("id", idBrut(l.id));
    if (e2) throw e2;
  }
}

// REFUS d'un groupe : les propositions disparaissent, l'original reste.
export async function refuserGroupePropositions(lignes) {
  for (const l of lignes) {
    const { error } = await supabase.from("travaux_effectues").update(CHAMPS_PROPOSITION_VIDES).eq("id", idBrut(l.id));
    if (error) throw error;
  }
}

// DÉBLOCAGE d'une journée — geste EXPLICITE de l'administrateur, après
// avoir appelé le technicien et corrigé ses heures. Volontairement
// séparé de la correction : c'est l'admin qui décide que la journée est
// juste, pas le système qui le devine.
export async function debloquerJournee(email, date) {
  const { error } = await supabase
    .from("travaux_effectues")
    .update({ jour_bloque: false, bloque_raison: null })
    .eq("employe_email", (email || "").toLowerCase())
    .eq("date_travail", date);
  if (error) throw error;
}

export function sAbonnerTravauxEffectues(onChangement) {
  const canal = supabase
    .channel("travaux-effectues")
    .on("postgres_changes", { event: "*", schema: "public", table: "travaux_effectues" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
