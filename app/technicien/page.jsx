"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MapPin, Navigation2, Camera, Mic, MicOff, CheckCircle2,
  AlertTriangle, ChevronLeft, ChevronDown, ChevronRight, Plus, Trash2,
  Clock, User, Loader2, Play, Pause, Square, Car, Lock, LogOut, RotateCcw, X, FileText, Check, Phone,
} from "lucide-react";
import TermesConditions from "@/components/TermesConditions";
import ConnexionTechnicien from "@/components/ConnexionTechnicien";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase/client";
import { permissionsEffectives } from "@/lib/permissions";
import { enregistrerInspection } from "@/lib/supabase/inspections";
import { listerAnnuaireEmployes } from "@/lib/supabase/repertoireEmployes";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { listerTravauxPourEmploye } from "@/lib/supabase/travauxEffectues";
import { televerserPhotoTravail, listerLegendes, sauvegarderLegende } from "@/lib/supabase/photosTravaux";
import VisionneusePhotos from "@/components/VisionneusePhotos";
import { enregistrerBonTravail, bonExistePourTache } from "@/lib/supabase/bonsTravail";
import { envoyerCourriel, gabaritBonTravail } from "@/lib/courriels";
import { assurerJetonBon, lienBonPublic, marquerBonEnvoyeClient, bonDejaEnvoyeAuClient, JOURS_VALIDITE_BON } from "@/lib/supabase/bonPublic";
import { listerCamions, camionIndisponible } from "@/lib/supabase/camions";
import { pushSupporte, activerNotificationsPush, resouscrireSiPermis } from "@/lib/notificationsPush";
import { googlePlacesDisponible, nouveauJeton, chercherAdresses } from "@/lib/googlePlaces";
import { listerTachesPourEmploye, sAbonnerTachesAssignees, etatEquipeTache, creerCourseTechnicien, creerTravailShopTechnicien, declarerEquipeTerminee, signalerDepartPremier, majStatutAssignation } from "@/lib/supabase/tachesAssignees";
import { enregistrerTravailEffectue, travailDejaEnregistre } from "@/lib/supabase/travauxEffectues";
import { CONFIG_DEFAUT, chargerEntreprise } from "@/lib/supabase/entreprise";
import { enregistrerCommandeCamion, listerCommandesCamionPourEmploye, sAbonnerCommandesCamion } from "@/lib/supabase/materiel";
import { ContexteEntreprise, useEntreprise } from "@/lib/contexteEntreprise";

// ============================================================
// COMPOSANT BOUTON RÉUTILISABLE
// Variantes : primary (noir plein — validation/soumission),
// outline (bordure — action secondaire), danger (rouge — suppression).
// Gère aussi l'état loading (spinner) et disabled.
// En prod, ce composant vit dans components/ui/Button.jsx et est
// importé — ici, dans cet artefact autonome, il est défini localement
// dans chaque fichier (voir le fichier Button.jsx fourni séparément
// pour la version destinée à un vrai projet Next.js).
// ============================================================
function Button({ variant = "primary", loading = false, disabled = false, className = "", children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold min-h-[48px] touch-manipulation transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:active:scale-100";
  const variantes = {
    primary: "bg-black text-white hover:bg-zinc-800 active:bg-zinc-950 disabled:bg-zinc-300 disabled:text-zinc-500",
    outline: "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-zinc-300 disabled:text-zinc-500",
  };
  return (
    <button disabled={disabled || loading} className={`${base} ${variantes[variant]} ${className}`} {...props}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}


// ============================================================
// DONNÉES SIMULÉES (à remplacer par les appels Supabase)
// Le prix_coutant n'existe volontairement PAS dans ces objets :
// un technicien ne doit jamais pouvoir y accéder, même via
// l'inspecteur du navigateur.
// ============================================================

// Destination fixe du trajet de fin de journée — l'entrepôt de
// Ventilation DGL inc. En prod, ces coordonnées viendraient d'un
// géocodage réel (Google Geocoding API) fait une fois et mis en cache.
const DEPOT_ADRESSE = {
  nom: "Entrepôt Ventilation DGL",
  ligne1: "771 boulevard Industriel, Blainville, QC, J7C 3V3",
  lat: 45.657,
  lng: -73.889,
};

// Vitesse moyenne utilisée pour estimer une durée de trajet à partir
// d'une distance à vol d'oiseau, quand seule la distance Haversine est
// disponible (pas d'API d'itinéraire réelle). C'est une ESTIMATION,
// pas un temps de trajet routier exact ni tenant compte du trafic —
// en prod, ceci serait remplacé par un appel à l'API Google Distance
// Matrix (ou équivalent), qui retourne une durée routière réelle.
const VITESSE_MOYENNE_ESTIMATION_KMH = 45;

const CLIENTS = [
  {
    id: "c1",
    nom: "Toitures Lavallée inc.",
    adresses: [
      { id: "a1", nom: "Entrepôt principal", ligne1: "1450 rue Bélanger, Montréal, QC", defaut: true, lat: 45.5495, lng: -73.6198 },
      { id: "a2", nom: "Chantier Nord", ligne1: "88 boul. des Laurentides, Laval, QC", defaut: false, lat: 45.5610, lng: -73.7420 },
    ],
  },
  {
    id: "c2",
    nom: "Résidence Tremblay",
    adresses: [
      { id: "a3", nom: "Domicile", ligne1: "22 rue des Érables, Longueuil, QC", defaut: true, lat: 45.5312, lng: -73.5185 },
    ],
  },
];

const PRODUITS_CATALOGUE = [
  { id: "p1", nom: "Main d'œuvre (heure)", prix_vendant: 95.0 },
  { id: "p2", nom: "Filtre standard 20x25", prix_vendant: 34.5 },
  { id: "p3", nom: "Thermostat programmable", prix_vendant: 189.0 },
  { id: "p4", nom: "Déplacement urgence", prix_vendant: 65.0 },
];

// Taux utilisés pour estimer le coût du déplacement (à déplacer dans
// une table de configuration Supabase — ex: table `parametres_paie`).
const TAUX_KM = 0.68; // $/km
const TAUX_HORAIRE_DEPLACEMENT = 45.0; // $/heure

const TACHES_INITIALES = [
  // --- Aujourd'hui (jourOffset 0) : la journée complète ---
  { id: "transport-debut", type: "transport", momentTransport: "debut", heure: "08:00", titre: "Transport — Début de journée", jourOffset: 0 },
  { id: "t1", type: "travail", heure: "08:30", clientId: "c1", adresseId: "a1", projetId: "proj1", typeIntervention: "Installation", jourOffset: 0 },
  { id: "t2", type: "travail", heure: "11:00", clientId: "c2", adresseId: "a3", projetId: null, typeIntervention: "Réparation", jourOffset: 0 },
  { id: "t3", type: "travail", heure: "14:00", clientId: "c1", adresseId: "a2", projetId: "proj1", typeIntervention: "Entretien", jourOffset: 0 },
  { id: "transport-fin", type: "transport", momentTransport: "fin", heure: "16:30", titre: "Transport — Fin de journée", jourOffset: 0 },
  // --- Demain (jourOffset 1) ---
  { id: "t4", type: "travail", heure: "09:00", clientId: "c1", adresseId: "a2", projetId: "proj1", typeIntervention: "Installation", jourOffset: 1 },
  { id: "t5", type: "travail", heure: "13:30", clientId: "c2", adresseId: "a3", projetId: null, typeIntervention: "Entretien", jourOffset: 1 },
  // --- Après-demain (jourOffset 2) ---
  { id: "t6", type: "travail", heure: "10:00", clientId: "c1", adresseId: "a1", projetId: "proj1", typeIntervention: "Réparation", jourOffset: 2 },
  // --- Hier (jourOffset -1) ---
  { id: "t7", type: "travail", heure: "11:30", clientId: "c2", adresseId: "a3", projetId: null, typeIntervention: "Inspection", jourOffset: -1 },
];

// Clé utilisée pour la persistance locale des tâches (mode hors-ligne).
// ⚠️ localStorage n'est pas disponible dans l'aperçu Artifact de
// Claude.ai (bac à sable) — ces fonctions échouent silencieusement
// (try/catch) dans ce contexte et l'app retombe sur les données de
// démo. Elles fonctionnent normalement une fois le fichier exécuté
// dans un vrai navigateur (PWA déployée sur le domaine de l'entreprise).
const CLE_STOCKAGE = "ventilationdgl_taches_v2";
const CLE_INSPECTION = "ventilationdgl_inspection_v1";
const CLE_CAMIONS = "ventilationdgl_camions_v1";
const CONTROLES_INSPECTION_TECH = ["Pneus", "Freins", "Niveaux de fluides", "Bruit moteur", "Lumières", "Carrosserie / Propreté"];

// Liste des numéros de camion déjà saisis — pour l'autocomplétion
// (saisie libre, mais on propose les camions connus pour la cohérence).
function chargerCamionsConnus() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const brut = window.localStorage.getItem(CLE_CAMIONS);
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}
function ajouterCamionConnu(nom) {
  try {
    if (typeof window === "undefined" || !window.localStorage || !nom) return;
    const liste = chargerCamionsConnus();
    if (!liste.includes(nom)) {
      window.localStorage.setItem(CLE_CAMIONS, JSON.stringify([nom, ...liste].slice(0, 50)));
    }
  } catch {
    // stockage indisponible — sans conséquence
  }
}

// Types d'intervention affichés sur les vignettes de bon de travail.
const TYPES_INTERVENTION = ["Installation", "Réparation", "Entretien", "Inspection"];

// --- Helpers de date (en heure LOCALE, jamais UTC, pour éviter tout
// décalage de jour selon le fuseau horaire) ---
function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}
function isoAvecDecalage(nbJours) {
  const d = new Date();
  d.setDate(d.getDate() + nbJours);
  return isoLocal(d);
}
function dateDepuisIso(iso) {
  return new Date(`${iso}T00:00:00`);
}
function decalerDate(date, nbJours) {
  const copie = new Date(date);
  copie.setDate(copie.getDate() + nbJours);
  return copie;
}
function debutDeSemaine(date) {
  const copie = new Date(date);
  const jour = copie.getDay(); // 0 = dimanche … 6 = samedi
  const versLundi = (jour + 6) % 7; // nombre de jours depuis le lundi
  copie.setDate(copie.getDate() - versLundi);
  copie.setHours(0, 0, 0, 0);
  return copie;
}
function joursDeLaSemaine(date) {
  const debut = debutDeSemaine(date);
  return Array.from({ length: 7 }, (_, i) => decalerDate(debut, i));
}

// Décale une heure "HH:MM" de N minutes (bornée à la journée).
function decalerHeure(heure, minutes) {
  const [h, m] = (heure || "08:00").split(":").map((x) => parseInt(x, 10) || 0);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Même règle d'affaires que l'agenda admin : pour CHAQUE journée ayant
// au moins une vraie tâche, garantir un « Transport — Début de journée »
// (avant la première tâche) et un « Transport — Fin de journée » (après
// la dernière). Idempotent — ne crée rien si les transports existent déjà.
function completerTransportsJournee(tachesEntree) {
  // MIGRATION de nom : ce transport a porté deux noms avant « Transport
  // journalier » — « Transport CCQ », puis « Transport durant la
  // journée ». Le titre est figé à la création de la carte : sans ce
  // renommage, les anciennes cartes garderaient leur nom d'origine.
  const taches = tachesEntree.map((t) =>
    t.type === "transport" &&
    t.momentTransport === "ccq" &&
    (t.titre === "Transport CCQ" || t.titre === "Transport durant la journée")
      ? { ...t, titre: "Transport journalier" }
      : t
  );
  const parDate = {};
  taches.forEach((t) => {
    if (t.type === "travail" && t.date) (parDate[t.date] = parDate[t.date] || []).push(t);
  });
  // 1) REPOSITIONNE les transports existants : si une tâche est ajoutée
  // plus tard dans la journée, le « Transport — Fin de journée » se
  // replace automatiquement APRÈS elle (et le Début avant la première).
  // On ne déplace jamais un transport déjà commencé ou terminé.
  const resultat = taches.map((t) => {
    if (t.type !== "transport" || !t.date || !parDate[t.date] || t.etat !== "a_faire") return t;
    const heures = parDate[t.date].map((x) => x.heure || "08:00").sort();
    if (t.momentTransport === "debut") return { ...t, heure: decalerHeure(heures[0], -30) };
    if (t.momentTransport === "fin") return { ...t, heure: decalerHeure(heures[heures.length - 1], 150) };
    if (t.momentTransport === "ccq") {
      // Le transport CCQ reste ENTRE sa tâche précédente et sa tâche
      // suivante : jamais avant la précédente — même quand les deux
      // tâches partagent la même heure (tâches empilées).
      const triees = parDate[t.date].slice().sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
      const idx = triees.findIndex((x) => x.id === t.tacheSuivanteId);
      if (idx > 0) {
        const apresPrecedente = triees[idx - 1].heure || "08:00";
        const avantSuivante = decalerHeure(triees[idx].heure || "08:00", -15);
        return { ...t, heure: avantSuivante > apresPrecedente ? avantSuivante : apresPrecedente };
      }
    }
    return t;
  });
  // 2) CRÉE les transports manquants pour chaque journée travaillée.
  Object.entries(parDate).forEach(([date, liste]) => {
    const heures = liste.map((t) => t.heure || "08:00").sort();
    // SECTEUR des transports (règle validée) : ils héritent de la tâche
    // à laquelle ils se rattachent — début = 1re tâche du jour, fin =
    // dernière, CCQ = sa tâche de destination (réglé plus bas).
    const trieesPourSecteur = liste.slice().sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
    const secteurPremiere = trieesPourSecteur[0]?.secteur || "commercial";
    const secteurDerniere = trieesPourSecteur[trieesPourSecteur.length - 1]?.secteur || "commercial";
    const gabarit = { type: "transport", date, etat: "a_faire", tempsAccumuleSec: 0, tempsDebutSegment: null, kilometres: 0 };
    if (!resultat.some((t) => t.type === "transport" && t.momentTransport === "debut" && t.date === date)) {
      resultat.push({ ...gabarit, secteur: secteurPremiere, id: `transport-debut-${date}`, momentTransport: "debut", heure: decalerHeure(heures[0], -30), titre: "Transport — Début de journée" });
    }
    if (!resultat.some((t) => t.type === "transport" && t.momentTransport === "fin" && t.date === date)) {
      resultat.push({ ...gabarit, secteur: secteurDerniere, id: `transport-fin-${date}`, momentTransport: "fin", heure: decalerHeure(heures[heures.length - 1], 150), titre: "Transport — Fin de journée" });
    }
    // 3) TRANSPORT CCQ entre chaque paire de tâches consécutives (2 tâches
    // et plus dans la journée) : le déplacement entre deux clients est
    // compté lui aussi — aucune minute ne manque à la paie. Chaque
    // transport CCQ est rattaché à la tâche SUIVANTE (tacheSuivanteId) :
    // son chrono démarre automatiquement quand la tâche précédente est
    // terminée, et s'arrête quand la suivante commence.
    const triees = liste.slice().sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
    for (let i = 1; i < triees.length; i++) {
      const suivante = triees[i];
      if (!resultat.some((t) => t.type === "transport" && t.momentTransport === "ccq" && t.tacheSuivanteId === suivante.id)) {
        // ENTRE les deux tâches, jamais avant la précédente — même quand
        // elles partagent la même heure (tâches empilées).
        const apresPrecedente = triees[i - 1].heure || "08:00";
        const avantSuivante = decalerHeure(suivante.heure || "08:00", -15);
        resultat.push({
          ...gabarit,
          // CCQ : le secteur de sa tâche de DESTINATION (même règle que
          // l'imputation du projet).
          secteur: suivante.secteur || "commercial",
          id: `transport-ccq-${date}-${suivante.id}`,
          momentTransport: "ccq",
          tacheSuivanteId: suivante.id,
          heure: avantSuivante > apresPrecedente ? avantSuivante : apresPrecedente,
          titre: "Transport journalier",
        });
      }
    }
  });
  // 4) NETTOIE les transports CCQ orphelins : si la tâche suivante a été
  // retirée de la journée (désassignée/déplacée), ou si elle est devenue
  // la PREMIÈRE tâche du jour (plus rien avant elle), son transport CCQ
  // non commencé disparaît.
  return resultat.filter((t) => {
    if (t.type !== "transport" || t.momentTransport !== "ccq") return true;
    if (t.etat !== "a_faire" || (t.tempsAccumuleSec || 0) > 0) return true; // temps déjà couru — on garde
    const jour = (parDate[t.date] || []).slice().sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
    const idx = jour.findIndex((x) => x.id === t.tacheSuivanteId);
    return idx > 0; // absente (-1) ou première tâche du jour (0) → retiré
  });
}

function tachesParDefaut() {
  return completerTransportsJournee(
    TACHES_INITIALES.map((t) => ({
      ...t,
      // Date calculée par rapport à aujourd'hui (à partir de jourOffset)
      // pour que la vue Semaine ait toujours du contenu autour du jour actuel.
      date: isoAvecDecalage(t.jourOffset || 0),
      etat: "a_faire",
      tempsAccumuleSec: 0,
      tempsDebutSegment: null,
      kilometres: 0,
    }))
  );
}

// Les URL.createObjectURL des photos ne survivent pas à un
// rafraîchissement de page — on ne garde que les métadonnées (tailles)
// à la sauvegarde, pas l'aperçu de l'image elle-même. Le dessin de la
// signature (pixels du canvas) n'est pas persisté non plus, pour
// garder le stockage léger ; seul le fait qu'elle ait été signée l'est.
function allegerPhotosPourStockage(photos) {
  // L'URL DISTANTE (stockage Supabase) survit au rechargement — c'est le
  // lien officiel de la photo au dossier. Les blobs/URLs locaux, non.
  return (photos || []).map((p) => ({ tailleOriginale: p.tailleOriginale, tailleCompressee: p.tailleCompressee, urlDistante: p.urlDistante || null }));
}

// Clé de stockage PAR COMPTE : chaque technicien connecté a son propre
// horaire local — se connecter avec un autre compte ne montre plus les
// tâches (ni la progression) laissées par le compte précédent.
function cleStockagePour(email) {
  return `${CLE_STOCKAGE}:${(email || "").toLowerCase()}`;
}
// Même principe pour les inspections de véhicule : chaque compte a les
// SIENNES — l'inspection faite par un collègue ne compte pas pour soi.
function cleInspectionPour(email) {
  return `${CLE_INSPECTION}:${(email || "").toLowerCase()}`;
}

function chargerTachesDepuisStockage(email) {
  try {
    if (typeof window === "undefined" || !window.localStorage || !email) return [];
    const brut = window.localStorage.getItem(cleStockagePour(email));
    // Aucun horaire local pour CE compte → liste vide : les vraies
    // tâches assignées arrivent de Supabase (plus de tâches de démo).
    if (!brut) return [];
    const sauvegardees = JSON.parse(brut);
    if (!Array.isArray(sauvegardees)) return [];
    // Complète les transports manquants (ex. cache créé avant que la
    // règle « transports sur chaque journée travaillée » existe).
    return completerTransportsJournee(sauvegardees);
  } catch {
    // Stockage indisponible ou données corrompues — on repart à vide
    // plutôt que de faire planter l'application.
    return [];
  }
}

function sauvegarderTaches(taches, email) {
  try {
    if (typeof window === "undefined" || !window.localStorage || !email) return;
    const allegees = taches.map((t) => ({
      ...t,
      // Ne pas persister d'éventuelles URL blob de photos (invalides
      // après un rechargement) — seulement leurs métadonnées.
      photosAvant: t.photosAvant ? allegerPhotosPourStockage(t.photosAvant) : undefined,
      photosApres: t.photosApres ? allegerPhotosPourStockage(t.photosApres) : undefined,
    }));
    window.localStorage.setItem(cleStockagePour(email), JSON.stringify(allegees));
  } catch {
    // Quota dépassé ou stockage indisponible — on continue sans
    // bloquer l'utilisateur ; les données restent en mémoire pour la
    // session en cours.
  }
}

// ------------------------------------------------------------
// FILE D'ATTENTE DE SYNCHRONISATION HORS-LIGNE
// ------------------------------------------------------------
// Chaque modification importante (mise à jour de tâche, envoi de bon
// de travail, etc.) est enregistrée ici comme une action distincte et
// horodatée — pas seulement l'état final. En prod, chaque action de
// cette file correspondrait à un appel réel vers Supabase (upsert sur
// la table `taches`) ; ici, "synchroniser" = vider la file après un
// court délai simulé. Les actions non traitées survivent à un
// rechargement de page (persistées séparément de l'état des tâches).
const CLE_FILE_ATTENTE = "ventilationdgl_file_attente_v1";

function chargerFileAttente() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const brut = window.localStorage.getItem(CLE_FILE_ATTENTE);
    const parsed = brut ? JSON.parse(brut) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sauvegarderFileAttente(file) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(CLE_FILE_ATTENTE, JSON.stringify(file));
  } catch {
    // Stockage indisponible — la file reste en mémoire pour la session
    // en cours, elle sera simplement perdue à la fermeture de l'onglet.
  }
}

const ANNEE = new Date().getFullYear();

// ============================================================
// ⚠️ MODE DÉVELOPPEMENT — À DÉSACTIVER AVANT LA MISE EN PRODUCTION
// Permet de se connecter avec le nom d'utilisateur "admin" sans mot
// de passe, pour accélérer les tests pendant la programmation.
// Mettre à `false` (ou retirer complètement ce bloc et son usage
// dans soumettreIdentifiants) avant de déployer l'application aux
// vrais utilisateurs — sinon n'importe qui peut se connecter en
// admin sans mot de passe.
// ============================================================
const MODE_DEVELOPPEMENT = true;
const NOM_UTILISATEUR_DEV = "admin";

// ============================================================
// UTILITAIRES
// ============================================================
function formatKo(bytes) {
  return `${Math.round(bytes / 1024)} Ko`;
}

function formatDuree(secondes) {
  const s = Math.max(0, Math.floor(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

// Durée écoulée d'une tâche, incluant le segment en cours s'il y a lieu.
// ============================================================
// CHRONO OUBLIÉ — rappel puis plafond automatique
// ------------------------------------------------------------
// Le compteur est bâti sur une HEURE DE DÉPART : il continue donc de
// courir même téléphone fermé (c'est voulu — aucune minute ne manque
// à la paie). Le revers : rien ne l'arrête tout seul. Un technicien
// qui range son téléphone le vendredi soir sans appuyer sur
// « Terminer » produirait une ligne de 60 heures le lundi matin.
//
// Deux filets, validés avec le propriétaire :
//   • 12 h → bannière rouge à l'ouverture (« l'as-tu oublié ? »)
//   • 16 h → la tâche se ferme SEULE, durée plafonnée à 16 h et
//     marquée « à valider » pour correction au bureau.
//
// Le plafond s'applique à l'ouverture de l'app (il n'y a pas de
// processus qui tourne en arrière-plan) : le lundi matin, la tâche du
// vendredi se ferme au moment où le technicien rouvre l'application.
//
// Pour changer ces seuils : ici, ou les déplacer un jour dans
// Paramètres → Paie & heures s'ils doivent varier d'une entreprise à
// l'autre.
const HEURES_AVANT_RAPPEL = 12;
const HEURES_AVANT_PLAFOND = 16;

function dureeEcoulee(tache) {
  const enCours = tache.etat === "en_cours" && tache.tempsDebutSegment;
  const segmentActuel = enCours ? (Date.now() - tache.tempsDebutSegment) / 1000 : 0;
  return tache.tempsAccumuleSec + segmentActuel;
}

// Combine la DATE d'une tâche avec une heure saisie « HH:MM » et rend un
// horodatage LOCAL. Jamais de toISOString ici : la règle du projet est
// que toute date de calendrier se construit en heure locale (le bogue
// UTC nous avait déjà décalé des journées entières).
function horodatageDepuisHeure(dateISO, heureStr) {
  if (!dateISO || !heureStr) return null;
  const [h, m] = String(heureStr).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const heureHHMM = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Tâches EN COURS depuis plus de `seuilHeures` — sert au rappel (12 h)
// comme au plafond (16 h). Une tâche en pause n'est jamais concernée :
// son chrono ne court pas.
function tachesTropLongues(taches, seuilHeures) {
  return (taches || []).filter(
    (t) => t.etat === "en_cours" && t.tempsDebutSegment && dureeEcoulee(t) / 3600 >= seuilHeures
  );
}

// ------------------------------------------------------------
// IMPUTATION AUTOMATIQUE DU TRANSPORT À UN PROJET
// Règle : le Transport Aller (début de journée) s'impute au projet de
// la PREMIÈRE tâche de travail de la journée (chronologiquement) ;
// le Transport Retour (fin de journée) s'impute au projet de la
// DERNIÈRE tâche de travail de la journée. Si cette tâche n'a pas de
// projet associé, le transport reste comptabilisé en heures générales
// mais hors-projet (retourne null).
// Calcul dérivé à la volée depuis `taches` — jamais stocké séparément,
// pour ne jamais désynchroniser de la chronologie réelle du jour.
// ------------------------------------------------------------
function projetImputeAuTransport(tache, taches) {
  if (tache.type !== "transport" || !tache.momentTransport) return null;
  // Transport CCQ (entre deux tâches) : imputé au projet de la tâche de
  // DESTINATION (celle vers laquelle le technicien roule).
  if (tache.momentTransport === "ccq") {
    const destination = taches.find((t) => t.id === tache.tacheSuivanteId);
    return destination?.projetId || null;
  }
  const travailTries = taches
    .filter((t) => t.type === "travail" && t.date === tache.date)
    .slice()
    .sort((a, b) => a.heure.localeCompare(b.heure));
  if (travailTries.length === 0) return null;
  const tacheAdjacente = tache.momentTransport === "debut" ? travailTries[0] : travailTries[travailTries.length - 1];
  return tacheAdjacente.projetId || null;
}

function ouvrirTrajet(adresseTexte, app = "auto") {
  // 🚪 L'unité (« , app. 4 ») est RETIRÉE de la recherche : Maps/Waze se
  // perdent avec un numéro d'appartement — on navigue vers l'immeuble,
  // l'unité est affichée sur la fiche de tâche à côté de l'adresse.
  const encodee = encodeURIComponent(String(adresseTexte || "").replace(/,\s*app\.\s*[^,]+/gi, ""));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  let url;
  if (app === "waze") {
    url = `https://waze.com/ul?q=${encodee}&navigate=yes`;
  } else if (app === "google") {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodee}`;
  } else if (app === "apple") {
    url = `https://maps.apple.com/?daddr=${encodee}&dirflg=d`;
  } else {
    // auto : Plans sur iOS, Google Maps ailleurs
    url = isIOS
      ? `https://maps.apple.com/?daddr=${encodee}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodee}`;
  }
  window.open(url, "_blank");
}

// Distance à vol d'oiseau entre deux coordonnées GPS (formule de
// Haversine), en kilomètres — utilisée pour suggérer le chantier le
// plus proche de la position actuelle du technicien.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Trouve l'adresse (client + adresse) la plus proche d'une position
// GPS donnée, parmi toutes les adresses connues. En prod, les
// coordonnées viendraient du géocodage réel de l'adresse (Google
// Places) au moment de son enregistrement — ici elles sont pré-
// calculées dans CLIENTS pour la démo.
function trouverChantierLePlusProche(latitude, longitude) {
  let meilleur = null;
  let meilleureDistance = Infinity;
  CLIENTS.forEach((client) => {
    (client.adresses || []).forEach((adresse) => {
      if (adresse.lat == null || adresse.lng == null) return;
      const d = distanceKm(latitude, longitude, adresse.lat, adresse.lng);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = { client, adresse, distanceKm: d };
      }
    });
  });
  return meilleur;
}

// Capture une position GPS ponctuelle (départ ou arrivée d'un trajet
// de transport) — résout `null` plutôt que de rejeter en cas
// d'indisponibilité (permission refusée, pas de GPS), pour que
// l'appelant puisse toujours retomber sur une saisie manuelle.
function capturerPositionGps() {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, heure: Date.now() }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

// Résout la destination d'un trajet de transport :
// - Trajet ALLER (début de journée) → adresse des travaux de la
//   PREMIÈRE tâche que le technicien a encore À FAIRE aujourd'hui
//   (pas simplement la première chronologiquement si elle est déjà
//   complétée — la destination doit toujours pointer vers le
//   prochain chantier réel du technicien).
// - Trajet RETOUR (fin de journée) → l'adresse de L'ENTREPRISE, lue
//   dans ses Paramètres (décision du propriétaire, 2026-08-16) : pour
//   DGL c'est le 771 boul. Industriel, mais chaque entreprise cliente
//   inscrit LA SIENNE — plus rien d'écrit en dur pour le multi-
//   entreprises. Les coordonnées GPS du 771 ne servent que si c'est
//   bien l'adresse de DGL (l'estimation de distance se passe d'elles
//   sinon, comme pour les tâches venues de l'agenda).
function destinationDuTrajet(tache, taches, config) {
  // Fin de journée : retour à l'adresse de l'entreprise (Paramètres).
  if (tache.momentTransport === "fin") {
    const adresseEntreprise = (config?.adresse || "").trim() || DEPOT_ADRESSE.ligne1;
    const estDepotDgl = adresseEntreprise === DEPOT_ADRESSE.ligne1 || adresseEntreprise.includes("771");
    return {
      nom: `Entrepôt — ${config?.nomCommercial || config?.nomLegal || "l'entreprise"}`,
      ligne1: adresseEntreprise,
      lat: estDepotDgl ? DEPOT_ADRESSE.lat : null,
      lng: estDepotDgl ? DEPOT_ADRESSE.lng : null,
    };
  }
  // Transport CCQ : destination = la tâche SUIVANTE (le prochain client).
  // Début de journée : destination = la première tâche à faire du jour.
  const travailARealiser = taches
    .filter((t) => t.type === "travail" && t.etat !== "complete" && t.date === tache.date)
    .slice()
    .sort((a, b) => a.heure.localeCompare(b.heure));
  const premiere =
    tache.momentTransport === "ccq"
      ? taches.find((t) => t.id === tache.tacheSuivanteId)
      : travailARealiser[0];
  if (!premiere) return null;

  // TÂCHE VENUE DE L'AGENDA (le cas normal) : elle porte son adresse en
  // TEXTE, parce que l'app technicien n'a pas le répertoire des clients.
  // C'est ce cas-ci qu'il faut traiter EN PREMIER — avant, on cherchait
  // uniquement dans les clients de démonstration, donc un vrai transport
  // du matin n'affichait aucune destination.
  if (premiere.adresseIntervention || premiere.adresseTravaux) {
    return {
      nom: premiere.clientNom || premiere.titre || "Prochaine tâche",
      ligne1: premiere.adresseIntervention || premiere.adresseTravaux,
      lat: null,
      lng: null,
    };
  }

  // Tâches de démonstration : l'adresse se résout par le répertoire local.
  const client = CLIENTS.find((c) => c.id === premiere.clientId);
  const adresse = client?.adresses?.find((a) => a.id === premiere.adresseId);
  if (!client || !adresse) return null;
  return { nom: `${client.nom} — ${adresse.nom}`, ligne1: adresse.ligne1, lat: adresse.lat, lng: adresse.lng };
}

function compresserImage(file) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Impossible de lire le fichier — il est peut-être corrompu ou trop volumineux."));
    lecteur.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Le fichier sélectionné n'est pas une image valide."));
      img.onload = () => {
        try {
          // 1600 px / qualité 80 % : on LIT les plaques signalétiques.
          // L'ancien réglage (1000 px / 60 %) rendait les numéros de
          // série illisibles — le réglage d'économie coûtait plus cher
          // en rappels au bureau qu'en données cellulaires.
          const largeurMax = 1600;
          const echelle = Math.min(1, largeurMax / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = img.width * echelle;
          canvas.height = img.height * echelle;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("La compression a échoué — réessaie avec une autre photo."));
                return;
              }
              resolve({
                url: URL.createObjectURL(blob),
                // Le blob voyage avec la photo — c'est lui qui sera
                // téléversé vers le stockage Supabase en arrière-plan.
                blob,
                tailleOriginale: file.size,
                tailleCompressee: blob.size,
              });
            },
            "image/jpeg",
            0.8
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    lecteur.readAsDataURL(file);
  });
}

// ============================================================
// PIED DE PAGE — COPYRIGHT
// ============================================================
function PiedCopyright() {
  return (
    <div className="py-3 text-center text-[11px] text-slate-400 tracking-wide">
      Fluxya · © {ANNEE} Ventilation DGL inc. — Tous droits réservés.
      <br />
      Application confidentielle — usage interne uniquement.
    </div>
  );
}

// ============================================================
// PANNEAU DE MINUTAGE — Débuter / Pause / Terminer
// Partagé entre le bon de travail et les tâches de transport,
// pour que le calcul du temps soit identique partout.
// ============================================================
function PanneauMinutage({ tache, onDemarrer, onPause, onReprendre, onTerminer, tacheBloquante, inspectionRequise, labelDebuter, labelTerminer, chargementDebuter, chargementTerminer, fermetureGuidee = false, onAllerSigner = null }) {
  const duree = formatDuree(dureeEcoulee(tache));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Temps sur la tâche</p>
          <p className="mt-0.5 font-mono text-2xl font-extrabold tabular-nums text-slate-900">{duree}</p>
        </div>
        {tache.etat === "en_cours" && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            EN COURS
          </span>
        )}
        {tache.etat === "en_pause" && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">EN PAUSE</span>
        )}
        {tache.etat === "complete" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">TERMINÉ</span>
        )}
      </div>

      {tacheBloquante && tache.etat !== "complete" && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-600">
          <Lock size={14} className="mt-0.5 shrink-0" />
          Termine d'abord « {tacheBloquante.titre || tacheBloquante.clientNom} » avant de commencer celle-ci — une seule tâche à la fois.
        </div>
      )}

      {inspectionRequise && !tacheBloquante && tache.etat === "a_faire" && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
          <Lock size={14} className="mt-0.5 shrink-0" />
          Fais d'abord ton inspection du véhicule (« Transport — Début de journée ») pour pouvoir démarrer. Tu peux quand même consulter les détails.
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {tache.etat === "a_faire" && (
          <Button onClick={onDemarrer} disabled={!!tacheBloquante || inspectionRequise} loading={chargementDebuter} className="col-span-2">
            <Play size={16} /> {labelDebuter || "Débuter la tâche"}
          </Button>
        )}
        {tache.etat === "en_cours" && (
          <>
            <Button variant="outline" onClick={onPause}>
              <Pause size={15} /> Pause (non compté)
            </Button>
            {fermetureGuidee ? (
              <Button onClick={onAllerSigner}>✍️ Terminer → signer</Button>
            ) : (
              <Button onClick={onTerminer} loading={chargementTerminer}>
                <Square size={15} /> {labelTerminer || "Terminer"}
              </Button>
            )}
          </>
        )}
        {tache.etat === "en_pause" && (
          <>
            <Button onClick={onReprendre} disabled={!!tacheBloquante}>
              <Play size={15} /> Reprendre
            </Button>
            {fermetureGuidee ? (
              <Button onClick={onAllerSigner}>✍️ Terminer → signer</Button>
            ) : (
              <Button onClick={onTerminer} loading={chargementTerminer}>
                <Square size={15} /> {labelTerminer || "Terminer"}
              </Button>
            )}
          </>
        )}
      </div>
      {/* ⏸️ EN PAUSE — dire clairement ce que la pause fait (et le bon
          réflexe matériel : la 🚗 course garde ce temps PAYÉ sans le
          facturer au client). */}
      {tache.etat === "en_pause" && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-snug text-amber-800">
          ⏸️ En pause — le chrono est arrêté : ce temps ne sera ni compté sur la tâche ni facturé.
          Parti chercher du matériel ? Crée une <span className="font-bold">🚗 course</span> (écran d&apos;accueil) :
          ce déplacement restera payé sans être facturé au client.
        </p>
      )}
      {/* ✍️ FERMETURE GUIDÉE — la tâche client se ferme par la
          signature, jamais par un raccourci (rien ne peut être oublié). */}
      {fermetureGuidee && tache.etat !== "a_faire" && tache.etat !== "complete" && (
        <p className="mt-3 rounded-xl bg-orange-50 p-3 text-[11px] leading-snug text-orange-800">
          Cette tâche se termine par le <span className="font-bold">bon de travail en bas</span> (signature du client,
          client absent, ou collègue qui a fait signer) — la fermeture est automatique après l&apos;envoi.
        </p>
      )}
    </div>
  );
}

// ============================================================
// INSPECTION JOURNALIÈRE DU VÉHICULE
// S'ouvre au clic sur « Transport — Début de journée ». Obligatoire
// avant de DÉMARRER une tâche (la consultation reste possible).
// ============================================================
function FormulaireInspection({ onSoumettre, onRetour, dateLabel, monCourriel }) {
  const configEnt = useEntreprise();
  const [etape, setEtape] = useState("choix"); // "choix" | "form" | "passager"
  const [camion, setCamion] = useState("");
  // PASSAGER (bloc 6) : dans le camion d'un collègue. Pas d'inspection à
  // faire — un camion, une inspection, celle du CONDUCTEUR. Le nom du
  // conducteur est déclaré (pas déduit) : c'est ce qui rend fiables le
  // coûtant (pas de coût camion pour le passager) et la facturation
  // (taux réduit du 2e technicien dans le même camion).
  const [conducteur, setConducteur] = useState(null); // { nom, courriel }
  const [collegues, setCollegues] = useState([]);
  useEffect(() => {
    if (etape !== "passager") return;
    // Annuaire noms + courriels seulement — jamais les salaires (RLS).
    listerAnnuaireEmployes()
      .then((liste) =>
        setCollegues(
          (liste || []).filter((e) => (e.courriel || "").toLowerCase() !== (monCourriel || "").toLowerCase())
        )
      )
      .catch(() => setCollegues([]));
  }, [etape, monCourriel]);
  const [km, setKm] = useState("");
  const [controles, setControles] = useState(() =>
    Object.fromEntries(CONTROLES_INSPECTION_TECH.map((c) => [c, "ok"]))
  );
  const [remarque, setRemarque] = useState("");
  // PHOTOS DE L'ANOMALIE — vraies photos, compressées et téléversées.
  // Avant, « Ajouter une photo » ne faisait qu'inverser un booléen :
  // le bouton affichait « Photo ajoutée ✓ » alors qu'aucune caméra ne
  // s'était ouverte et qu'aucune image n'existait. Le bureau recevait
  // une anomalie sans jamais pouvoir la voir.
  const [photosAnomalie, setPhotosAnomalie] = useState([]);
  // Parc de véhicules OFFICIEL (répertoire de l'administration) — le
  // technicien CHOISIT son camion au lieu de l'écrire : plus de camion
  // fantôme créé par une faute de frappe. Repli sur les camions déjà
  // utilisés localement si le parc n'est pas accessible (hors-ligne).
  const [camionsParc, setCamionsParc] = useState([]);
  const [parcCharge, setParcCharge] = useState(false);
  useEffect(() => {
    listerCamions()
      .then((liste) => {
        setCamionsParc(liste.filter((c) => c.actif));
        setParcCharge(true);
      })
      .catch(() => setParcCharge(true));
  }, []);
  const camionsLocaux = chargerCamionsConnus();
  const camionsConnus = camionsParc.length > 0 ? camionsParc.map((c) => c.nom) : camionsLocaux;

  const problemes = CONTROLES_INSPECTION_TECH.filter((c) => controles[c] === "probleme");
  const anomalie = problemes.length > 0 || remarque.trim().length > 0;
  const peutSoumettre = camion.trim().length > 0 && km !== "";

  const soumettre = () => {
    if (!peutSoumettre) return;
    ajouterCamionConnu(camion.trim());
    onSoumettre({
      sansVehicule: false,
      camion: camion.trim(),
      km: parseInt(km, 10) || 0,
      controles,
      controleProblemes: problemes,
      remarque: remarque.trim(),
      // Liens des photos déjà téléversées vers le stockage Supabase —
      // c'est ce que le bureau affichera dans le dossier du véhicule.
      photos: photosAnomalie.map((p) => p.urlDistante).filter(Boolean),
      anomalie,
      // Coût horaire du camion FIGÉ ce matin (bloc 5) — si le tarif
      // change dans Paramètres, les journées passées gardent le leur.
      coutCamionHoraire: Number(configEnt?.coutCamionHoraire) || null,
    });
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-100">
      <div className="bg-[#131B2E] px-5 pb-6 pt-8 text-white">
        <button onClick={onRetour} className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-400">
          <ChevronLeft size={14} /> Horaire
        </button>
        <p className="text-sm text-slate-400">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-black">Inspection du véhicule</h1>
        <p className="mt-1 text-[11px] text-zinc-300">À remplir avant de démarrer ta journée.</p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-5">
        {etape === "choix" ? (
          <div className="space-y-2">
            <Button onClick={() => setEtape("form")} className="w-full">
              <Car size={16} /> Je conduis un camion
            </Button>
            <Button variant="outline" onClick={() => setEtape("passager")} className="w-full">
              👥 Je suis passager d'un collègue
            </Button>
            <Button variant="outline" onClick={() => onSoumettre({ sansVehicule: true })} className="w-full">
              🚶 Je n'ai pas de véhicule aujourd'hui
            </Button>
          </div>
        ) : etape === "passager" ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Qui conduit le camion ?</label>
              <select
                value={conducteur?.courriel || ""}
                onChange={(e) => {
                  const f = collegues.find((c) => (c.courriel || "") === e.target.value);
                  setConducteur(f ? { nom: f.nom, courriel: f.courriel } : null);
                }}
                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
              >
                <option value="">— Choisis le conducteur —</option>
                {collegues.map((c) => (
                  <option key={c.courriel || c.nom} value={c.courriel || ""}>{c.nom}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
                Pas d'inspection à faire : c'est le conducteur qui inspecte son camion. Ta journée démarre dès que tu confirmes.
              </p>
            </div>
            <Button
              disabled={!conducteur}
              onClick={() =>
                onSoumettre({
                  sansVehicule: true,
                  passagerDeNom: conducteur.nom,
                  passagerDeEmail: (conducteur.courriel || "").toLowerCase(),
                })
              }
              className="w-full"
            >
              <Check size={16} /> Confirmer — passager de {conducteur?.nom || "…"}
            </Button>
            <Button variant="outline" onClick={() => setEtape("choix")} className="w-full">Retour</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Numéro de camion</label>
                {camionsConnus.length > 0 ? (
                  <select
                    value={camion}
                    onChange={(e) => setCamion(e.target.value)}
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                  >
                    <option value="">— Choisis ton camion —</option>
                    {(camionsParc.length > 0 ? camionsParc : camionsLocaux.map((n) => ({ nom: n }))).map((c) => {
                      // 🔧 Camion déclaré indisponible (au garage…) :
                      // grisé — impossible de le choisir par habitude.
                      const indispo = camionIndisponible(c);
                      return (
                        <option key={c.nom} value={c.nom} disabled={indispo}>
                          {c.nom}{indispo ? ` — 🔧 ${c.indispoRaison || "indisponible"}` : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  // Parc non chargé (hors-ligne) ou vide : saisie libre en
                  // dépannage pour ne jamais bloquer l'inspection.
                  <>
                    <input
                      value={camion}
                      onChange={(e) => setCamion(e.target.value)}
                      placeholder="Entre ton numéro de camion"
                      className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                    <p className="mt-1 text-[10px] text-amber-600">
                      {parcCharge ? "Aucun camion au parc — préviens l'administration." : "Liste des camions non chargée — saisie manuelle en dépannage."}
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Kilométrage actuel</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Vérifications rapides</p>
              {CONTROLES_INSPECTION_TECH.map((c) => (
                <div key={c} className="flex items-center justify-between border-t border-slate-100 py-2.5 first:border-t-0">
                  <span className="text-sm font-semibold text-slate-700">{c}</span>
                  <div className="flex overflow-hidden rounded-full border border-slate-200">
                    <button onClick={() => setControles((p) => ({ ...p, [c]: "ok" }))} className={`px-3 py-1 text-[11px] font-bold ${controles[c] === "ok" ? "bg-emerald-500 text-white" : "text-slate-400"}`}>OK</button>
                    <button onClick={() => setControles((p) => ({ ...p, [c]: "probleme" }))} className={`px-3 py-1 text-[11px] font-bold ${controles[c] === "probleme" ? "bg-red-500 text-white" : "text-slate-400"}`}>Problème</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Anomalie constatée (facultatif)</label>
              <input
                value={remarque}
                onChange={(e) => setRemarque(e.target.value)}
                placeholder="Ex : feu arrière grillé"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              {/* Vraies photos — même composant que les bons de travail :
                  caméra ou galerie, compression avant envoi, et
                  téléversement vers le stockage Supabase. */}
              <ZonePhoto
                titre="Photos de l'anomalie"
                photos={photosAnomalie}
                setPhotos={setPhotosAnomalie}
              />
              {anomalie && photosAnomalie.length === 0 && (
                <p className="text-[11px] leading-snug text-amber-700">
                  📷 Une photo aide beaucoup le bureau à juger de l&apos;urgence et à commander la bonne pièce.
                </p>
              )}
            </div>

            {anomalie && (
              <p className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                <AlertTriangle size={14} /> Anomalie détectée — l'administration sera notifiée.
              </p>
            )}

            <Button onClick={soumettre} disabled={!peutSoumettre} className="w-full">
              Soumettre l'inspection
            </Button>
          </>
        )}
      </div>
      <PiedCopyright />
    </div>
  );
}

// ============================================================
// ÉCRAN ACCUEIL
// ============================================================
// ============================================================
// ÉCRAN DE CONNEXION
// Compte simulé pour la démo — en prod, l'authentification et le
// mot de passe vivent dans Supabase Auth, jamais côté client.
// ============================================================
function EcranConnexion({ compte, setCompte, onConnecte }) {
  const [etape, setEtape] = useState("identifiants"); // "identifiants" | "creation_mdp"
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmationMdp, setConfirmationMdp] = useState("");
  const [erreur, setErreur] = useState("");

  const soumettreIdentifiants = () => {
    // ⚠️ Contournement de mot de passe réservé au développement — voir
    // la constante MODE_DEVELOPPEMENT en haut du fichier.
    if (MODE_DEVELOPPEMENT && nomUtilisateur.trim().toLowerCase() === NOM_UTILISATEUR_DEV) {
      setErreur("");
      onConnecte(NOM_UTILISATEUR_DEV);
      return;
    }

    if (nomUtilisateur.trim().toLowerCase() !== compte.nomUtilisateur) {
      setErreur("Nom d'utilisateur introuvable.");
      return;
    }
    setErreur("");
    if (!compte.motDePasse) {
      setEtape("creation_mdp");
      return;
    }
    if (motDePasse !== compte.motDePasse) {
      setErreur("Mot de passe incorrect.");
      return;
    }
    onConnecte(compte.nomUtilisateur);
  };

  const creerMotDePasse = () => {
    if (nouveauMdp.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (nouveauMdp !== confirmationMdp) {
      setErreur("Les mots de passe ne correspondent pas.");
      return;
    }
    setCompte((prev) => ({ ...prev, motDePasse: nouveauMdp }));
    setErreur("");
    onConnecte(compte.nomUtilisateur);
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#131B2E] px-6">
      <div className="w-full max-w-xs">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF6A13]">
            <Lock size={24} className="text-white" />
          </div>
          <div className="flex justify-center"><Logo variant="compact" sombre /></div>
          <p className="text-xs text-slate-400">Portail technicien</p>
          {MODE_DEVELOPPEMENT && (
            <p className="mt-2 rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-bold text-amber-300">
              MODE DÉVELOPPEMENT — "{NOM_UTILISATEUR_DEV}" sans mot de passe
            </p>
          )}
        </div>

        {etape === "identifiants" ? (
          <div className="space-y-3">
            <input
              value={nomUtilisateur}
              onChange={(e) => setNomUtilisateur(e.target.value)}
              placeholder="Nom d'utilisateur"
              className="w-full rounded-xl border border-slate-600 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-400"
            />
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="Mot de passe"
              className="w-full rounded-xl border border-slate-600 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-400"
            />
            {erreur && <p className="text-xs font-semibold text-red-400">{erreur}</p>}
            <Button onClick={soumettreIdentifiants} className="w-full">
              Se connecter
            </Button>
            <p className="text-center text-[11px] text-slate-400">
              Première connexion ? Entre ton nom d'utilisateur — tu pourras créer ton mot de passe à l'étape suivante.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-xs text-slate-300">
              Première connexion pour <span className="font-bold text-white">{nomUtilisateur}</span> — crée ton mot de passe.
            </p>
            <input
              type="password"
              value={nouveauMdp}
              onChange={(e) => setNouveauMdp(e.target.value)}
              placeholder="Nouveau mot de passe (6 caractères min.)"
              className="w-full rounded-xl border border-slate-600 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-400"
            />
            <input
              type="password"
              value={confirmationMdp}
              onChange={(e) => setConfirmationMdp(e.target.value)}
              placeholder="Confirmer le mot de passe"
              className="w-full rounded-xl border border-slate-600 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-400"
            />
            {erreur && <p className="text-xs font-semibold text-red-400">{erreur}</p>}
            <Button onClick={creerMotDePasse} className="w-full">
              Créer le mot de passe et me connecter
            </Button>
          </div>
        )}
      </div>
      <p className="mt-8 text-[10px] text-slate-500">Fluxya · © {ANNEE} Ventilation DGL inc.</p>
    </div>
  );
}

// ============================================================
// MES HEURES — le technicien consulte SES heures de la semaine de paie
// (dimanche à samedi), avec le détail par journée. LECTURE SEULE, heures
// seulement — jamais de taux ni de montants. Mêmes règles de calcul que
// l'onglet « Heures de la semaine » du bureau (dîner, nuit à 16 h,
// sam/dim, report des corrections tardives) : aucun écart possible.
// ============================================================
// ============================================================
// FENÊTRE DE CORRECTION D'UN CHRONO OUBLIÉ
// ------------------------------------------------------------
// Ouverte depuis la bannière rouge (12 h), AVANT que le plafond ne
// bloque la journée. Le technicien déclare son heure de fin réelle —
// et, s'il oubliait aussi son transport de retour, son heure d'arrivée
// au bureau. Sa déclaration part au bureau comme CORRECTION À VALIDER :
// elle est utilisable tout de suite, mais un administrateur doit
// l'approuver (règle validée avec le propriétaire).
//
// Gros champs, gros boutons : ça se remplit dans un camion, avec des
// gants, sur un écran de téléphone.
// ============================================================
function ModalCorrectionChrono({ tache, transportRetour, onAnnuler, onConfirmer }) {
  const estTransport = tache.type === "transport";
  const debut = tache.debutReel || tache.tempsDebutSegment;
  const [heureFin, setHeureFin] = useState("");
  // Deuxième champ : seulement si le technicien ferme une tâche de
  // CHANTIER et que son transport de fin de journée n'est pas parti.
  const [heureArrivee, setHeureArrivee] = useState("");
  const [erreur, setErreur] = useState("");

  const heuresEcoulees = Math.floor(dureeEcoulee(tache) / 3600);
  const finTs = horodatageDepuisHeure(tache.date, heureFin);
  const arriveeTs = horodatageDepuisHeure(tache.date, heureArrivee);

  const valider = () => {
    if (!finTs) {
      setErreur("Entre ton heure de fin.");
      return;
    }
    if (debut && finTs <= debut) {
      setErreur(`Ton heure de fin doit être APRÈS ${heureHHMM(debut)}, l'heure de départ.`);
      return;
    }
    if (debut && (finTs - debut) / 3600000 > HEURES_AVANT_PLAFOND) {
      setErreur(`Plus de ${HEURES_AVANT_PLAFOND} h — vérifie l'heure. Si c'est exact, appelle l'administration.`);
      return;
    }
    if (transportRetour && heureArrivee) {
      if (!arriveeTs || arriveeTs <= finTs) {
        setErreur("Ton arrivée au bureau doit être après ton heure de fin sur le chantier.");
        return;
      }
    }
    onConfirmer({ finTs, arriveeTs: transportRetour && heureArrivee ? arriveeTs : null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-base font-extrabold text-slate-900">🕐 Corriger ton heure de fin</h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          « <span className="font-bold">{tache.titre || "Tâche"}</span> » roule depuis{" "}
          <span className="font-extrabold">{heuresEcoulees} h</span>
          {debut ? <> — parti à <span className="font-extrabold">{heureHHMM(debut)}</span></> : null}.
        </p>

        <label className="mt-4 block text-[12px] font-extrabold uppercase tracking-wide text-slate-500">
          {estTransport ? "À quelle heure es-tu arrivé au bureau ?" : "À quelle heure as-tu terminé sur le chantier ?"}
        </label>
        <input
          type="time"
          value={heureFin}
          onChange={(e) => { setHeureFin(e.target.value); setErreur(""); }}
          className="mt-1 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-3 text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none focus:border-[#FF6A13]"
        />

        {transportRetour && (
          <>
            <label className="mt-4 block text-[12px] font-extrabold uppercase tracking-wide text-slate-500">
              Heure d&apos;arrivée au bureau
            </label>
            <input
              type="time"
              value={heureArrivee}
              onChange={(e) => { setHeureArrivee(e.target.value); setErreur(""); }}
              className="mt-1 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-3 text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none focus:border-[#FF6A13]"
            />
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Ferme aussi ton « {transportRetour.titre} ». Laisse vide si tu n&apos;es pas retourné au bureau.
            </p>
          </>
        )}

        {erreur && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">{erreur}</p>
        )}

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
          Ta correction est envoyée au bureau et doit être <span className="font-bold">approuvée par un administrateur</span>.
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={valider}
            className="min-h-[52px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
          >
            Corriger et terminer
          </button>
          <button
            onClick={onAnnuler}
            className="min-h-[48px] w-full rounded-xl border border-slate-300 text-sm font-bold text-slate-600 active:scale-[0.99]"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FENÊTRE — UN COÉQUIPIER A FERMÉ LA TÂCHE POUR TOUTE L'ÉQUIPE
// ------------------------------------------------------------
// (2026-08-17) Posée à l'ouverture de l'app quand un collègue a déclaré
// « toute l'équipe a terminé » en fermant une tâche partagée.
//   • « Oui, j'avais terminé » : les heures POINTÉES du technicien
//     (arrêtées à l'heure de la fermeture du bon) partent au bureau et
//     se cumulent automatiquement — aucune validation nécessaire.
//   • « Non, j'ajuste » : il déclare son heure de fin réelle — la ligne
//     part À VALIDER par un administrateur (même mécanisme que la
//     correction de chrono oublié).
// Le chrono d'un technicien vit sur SON téléphone : c'est pour ça que
// c'est LUI qui confirme ses heures, jamais son collègue à sa place.
// ============================================================
function ModalFermetureEquipe({ tache, onConfirmer, onAjuster, onPlusTard }) {
  const fermeTs = Date.parse(tache.fermetureEquipe?.a) || Date.now();
  // Heures pointées, arrêtées à l'instant où le bon a été fermé — pas à
  // « maintenant » : un chrono resté ouvert toute la nuit n'invente
  // aucune heure.
  const segment =
    tache.etat === "en_cours" && tache.tempsDebutSegment
      ? Math.max(0, (fermeTs - tache.tempsDebutSegment) / 1000)
      : 0;
  const heuresPointees = Math.max(0, ((tache.tempsAccumuleSec || 0) + segment) / 3600);
  const jamaisPointe = heuresPointees < 0.02;

  const [ajuste, setAjuste] = useState(jamaisPointe);
  const [heureDebut, setHeureDebut] = useState(() =>
    tache.debutReel ? heureHHMM(tache.debutReel) : ""
  );
  const [heureFin, setHeureFin] = useState(() => heureHHMM(fermeTs));
  const [erreur, setErreur] = useState("");

  const validerAjustement = () => {
    const debutTs = horodatageDepuisHeure(tache.date, heureDebut);
    const finTs = horodatageDepuisHeure(tache.date, heureFin);
    if (!debutTs || !finTs) {
      setErreur("Entre ton heure de début et ton heure de fin.");
      return;
    }
    if (finTs <= debutTs) {
      setErreur("Ton heure de fin doit être après ton heure de début.");
      return;
    }
    onAjuster({ debutTs, finTs });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-base font-extrabold text-slate-900">
          🤝 {tache.fermetureEquipe?.par || "Un coéquipier"} a fermé « {tache.titre || "la tâche"} »
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          Il a fait signer le client et indiqué que <span className="font-bold">toute l&apos;équipe avait terminé</span>{" "}
          à <span className="font-extrabold">{heureHHMM(fermeTs)}</span>. Le bon est déjà parti — il reste seulement à
          confirmer <span className="font-bold">tes heures</span>.
        </p>

        {!ajuste && (
          <>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tes heures pointées</p>
              <p className="text-2xl font-extrabold tabular-nums text-slate-900">{heuresPointees.toFixed(2)} h</p>
              {tache.debutReel && (
                <p className="text-[11px] text-slate-500">
                  {heureHHMM(tache.debutReel)} → {heureHHMM(fermeTs)}
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={onConfirmer}
                className="min-h-[52px] w-full rounded-xl bg-[#FF6A13] px-3 text-sm font-extrabold text-white active:scale-[0.99]"
              >
                ✅ C&apos;est exact — confirmer mes {heuresPointees.toFixed(2)} h
              </button>
              <p className="text-[11px] leading-snug text-slate-500">
                Tes heures partent au bureau et se cumulent automatiquement — rien d&apos;autre à faire.
              </p>
              <button
                onClick={() => setAjuste(true)}
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 text-sm font-extrabold text-slate-700 active:scale-[0.99]"
              >
                ✋ Non — ajuster mes heures
              </button>
            </div>
          </>
        )}

        {ajuste && (
          <>
            {jamaisPointe && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800">
                Ton chronomètre n&apos;a pas roulé sur cette tâche — déclare tes heures réelles.
              </p>
            )}
            <label className="mt-3 block text-[12px] font-extrabold uppercase tracking-wide text-slate-500">
              À quelle heure as-tu commencé ?
            </label>
            <input
              type="time"
              value={heureDebut}
              onChange={(e) => { setHeureDebut(e.target.value); setErreur(""); }}
              className="mt-1 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-3 text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none focus:border-[#FF6A13]"
            />
            <label className="mt-3 block text-[12px] font-extrabold uppercase tracking-wide text-slate-500">
              À quelle heure as-tu terminé ?
            </label>
            <input
              type="time"
              value={heureFin}
              onChange={(e) => { setHeureFin(e.target.value); setErreur(""); }}
              className="mt-1 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-3 text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none focus:border-[#FF6A13]"
            />
            {erreur && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">{erreur}</p>
            )}
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
              Tes heures ajustées partent au bureau et doivent être{" "}
              <span className="font-bold">approuvées par un administrateur</span>.
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={validerAjustement}
                className="min-h-[52px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
              >
                Envoyer mes heures pour validation
              </button>
              {!jamaisPointe && (
                <button
                  onClick={() => { setAjuste(false); setErreur(""); }}
                  className="min-h-[44px] w-full rounded-xl text-[13px] font-bold text-slate-500 active:scale-[0.99]"
                >
                  ← Revenir à mes heures pointées
                </button>
              )}
            </div>
          </>
        )}

        <button
          onClick={onPlusTard}
          className="mt-2 min-h-[44px] w-full rounded-xl text-[13px] font-bold text-slate-400 active:scale-[0.99]"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}

function MesHeures({ courriel, onRetour }) {
  // Heure de bascule « Nuit » : la même que celle réglée au bureau dans
  // les Paramètres — les deux écrans ne peuvent pas diverger.
  const heureNuit = Number(useEntreprise().heureBasculeNuit) || 16;
  const [mesTravaux, setMesTravaux] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [jourOuvert, setJourOuvert] = useState(null);
  const dimancheDe = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - c.getDay());
    return c;
  };
  const [dimancheAffiche, setDimancheAffiche] = useState(() => dimancheDe(new Date()));

  useEffect(() => {
    let annule = false;
    listerTravauxPourEmploye(courriel)
      .then((liste) => {
        if (annule) return;
        setMesTravaux(liste);
        setChargement(false);
      })
      .catch(() => {
        if (annule) return;
        setErreur("Impossible de charger tes heures — vérifie ta connexion et réessaie.");
        setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [courriel]);

  // Mêmes règles de classification que le bureau.
  const estCcq = (t) => t.estTransport && /ccq|durant la journée|journalier/i.test(t.titre || "");
  const estLunch = (t) => !t.estTransport && /dîner|diner|lunch/i.test(t.titre || "");
  const heureLocaleDe = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const dimancheISOde = (v) => {
    const dt = typeof v === "string" ? (v.includes("T") ? new Date(v) : new Date(`${v}T00:00:00`)) : new Date(v);
    return isoLocal(dimancheDe(dt));
  };
  const classificationJournee = (lignes, iso) => {
    const js = new Date(`${iso}T00:00:00`).getDay();
    if (js === 0 || js === 6) return "weekend";
    const debuts = (lignes || []).filter((l) => l.debutReel && !estLunch(l)).map((l) => new Date(l.debutReel).getTime());
    if (debuts.length === 0) return "jour";
    return new Date(Math.min(...debuts)).getHours() >= heureNuit ? "nuit" : "jour";
  };

  const jours = Array.from({ length: 7 }, (_, i) => decalerDate(dimancheAffiche, i));
  const isoJours = jours.map(isoLocal);
  const debutISO = isoJours[0];
  const finISO = isoJours[6];
  const lignesSemaineBrutes = mesTravaux.filter((t) => t.date >= debutISO && t.date <= finISO);
  // JOURNÉES BLOQUÉES — mêmes règles qu'au bureau : une journée dont le
  // chrono a été oublié ne compte nulle part tant que l'administration
  // ne l'a pas corrigée. Le technicien doit COMPRENDRE pourquoi ses
  // heures ont disparu, plutôt que de croire à un bogue.
  const datesBloquees = new Set(lignesSemaineBrutes.filter((t) => t.jourBloque).map((t) => t.date));
  const lignesSemaine = lignesSemaineBrutes.filter((t) => !datesBloquees.has(t.date));

  const totaux = { chantier: 0, transport: 0, ccq: 0, diner: 0, nuit: 0, weekend: 0, report: 0, total: 0 };
  const parDate = {};
  lignesSemaine.forEach((t) => {
    const h = Number(t.heures) || 0;
    (parDate[t.date] = parDate[t.date] || []).push(t);
    if (estLunch(t)) totaux.diner += h;
    else if (estCcq(t)) totaux.ccq += h;
    else if (t.estTransport) totaux.transport += h;
    else totaux.chantier += h;
    totaux.total += h;
  });
  Object.entries(parDate).forEach(([iso, lignes]) => {
    const classe = classificationJournee(lignes, iso);
    if (classe === "jour") return;
    const somme = lignes.reduce((s, t) => s + (Number(t.heures) || 0), 0);
    if (classe === "nuit") totaux.nuit += somme;
    else totaux.weekend += somme;
  });
  // Report ± : corrections tardives validées PENDANT cette semaine sur
  // des journées de semaines antérieures.
  mesTravaux.forEach((t) => {
    if (!t.corrigeLe || t.heuresAvantCorrection == null) return;
    if (dimancheISOde(t.corrigeLe) !== debutISO) return;
    if (!(t.date < debutISO)) return;
    totaux.report += (Number(t.heures) || 0) - (Number(t.heuresAvantCorrection) || 0);
  });
  const aPayer = totaux.total + totaux.report;

  const labelSemaine = `du ${jours[0].toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} au ${jours[6].toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
  const catDe = (t) =>
    estLunch(t)
      ? { label: "DÎNER", cls: "bg-rose-100 text-rose-700" }
      : estCcq(t)
      ? { label: "TRANSP. JOURNALIER", cls: "bg-amber-100 text-amber-700" }
      : t.estTransport
      ? { label: "TRANSPORT", cls: "bg-slate-200 text-slate-600" }
      : { label: "CHANTIER", cls: "bg-emerald-100 text-emerald-700" };

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5">
        <button onClick={onRetour} aria-label="Retour" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-slate-600 active:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">🕐 Mes heures</h1>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setDimancheAffiche(decalerDate(dimancheAffiche, -7))} aria-label="Semaine précédente" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-slate-600 active:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[170px] text-center text-sm font-extrabold text-slate-800">{labelSemaine}</span>
          <button onClick={() => setDimancheAffiche(decalerDate(dimancheAffiche, 7))} aria-label="Semaine suivante" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-slate-600 active:bg-slate-100">
            <ChevronRight size={18} />
          </button>
        </div>

        {chargement ? (
          <p className="py-8 text-center text-sm text-slate-400">Chargement de tes heures…</p>
        ) : erreur ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-600">{erreur}</p>
        ) : (
          <>
            {/* JOURNÉE BLOQUÉE — expliquée franchement. Sans ça, le
                technicien verrait ses heures manquer sans comprendre et
                penserait à un bogue de l'application. */}
            {datesBloquees.size > 0 && (
              <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-extrabold text-red-700">
                  <AlertTriangle size={16} className="shrink-0" /> {datesBloquees.size} journée{datesBloquees.size > 1 ? "s" : ""} en attente de correction
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {[...datesBloquees].sort().map((d) => (
                    <li key={d} className="text-[12px] font-bold capitalize text-red-800">
                      • {new Date(`${d}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] leading-snug text-red-900">
                  Ton chrono a roulé trop longtemps — il a été arrêté automatiquement. Ces heures
                  <span className="font-bold"> ne sont pas dans le total ci-dessous</span> tant que le bureau ne les a pas corrigées.
                </p>
                <p className="mt-1 text-[12px] font-bold leading-snug text-red-900">
                  📞 L&apos;administration va t&apos;appeler pour connaître ton heure de fin réelle. Tu seras payé normalement une fois corrigé.
                </p>
              </div>
            )}

            {/* SOMMAIRE DE LA SEMAINE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total de la semaine</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{aPayer.toFixed(2)} h</p>
              {totaux.report !== 0 && (
                <p className="text-[11px] font-bold tabular-nums text-purple-600">
                  {totaux.total.toFixed(2)} h travaillées {totaux.report > 0 ? "+" : ""}{totaux.report.toFixed(2)} h de correction reportée
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-emerald-700">Chantier {totaux.chantier.toFixed(2)} h</span>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600">Transport {totaux.transport.toFixed(2)} h</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-700">Transp. journée {totaux.ccq.toFixed(2)} h</span>
                {totaux.diner !== 0 && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-rose-700">Dîner {totaux.diner.toFixed(2)} h</span>
                )}
                {totaux.nuit !== 0 && (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-indigo-700">🌙 Nuit {totaux.nuit.toFixed(2)} h</span>
                )}
                {totaux.weekend !== 0 && (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-sky-700">Sam/Dim {totaux.weekend.toFixed(2)} h</span>
                )}
              </div>
            </div>

            {/* DÉTAIL PAR JOURNÉE */}
            {Object.keys(parDate).length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                Aucune heure enregistrée cette semaine.
              </p>
            ) : (
              isoJours
                .filter((iso) => parDate[iso])
                .map((iso) => {
                  const lignes = parDate[iso].slice().sort((a, b) => (a.debutReel || "").localeCompare(b.debutReel || ""));
                  const totalJour = lignes.reduce((s, t) => s + (Number(t.heures) || 0), 0);
                  const classe = classificationJournee(lignes, iso);
                  const ouvert = jourOuvert === iso;
                  return (
                    <div key={iso} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <button
                        onClick={() => setJourOuvert(ouvert ? null : iso)}
                        className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4 py-3 text-left active:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-extrabold capitalize text-slate-800">
                            {new Date(`${iso}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "short" })}
                          </span>
                          {classe === "nuit" && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">🌙 NUIT</span>}
                          {classe === "weekend" && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold text-sky-700">SAM/DIM</span>}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold tabular-nums text-slate-900">{totalJour.toFixed(2)} h</span>
                          <ChevronDown size={15} className={`text-slate-400 transition-transform ${ouvert ? "rotate-180" : ""}`} />
                        </span>
                      </button>
                      {ouvert && (
                        <div className="space-y-1.5 border-t border-slate-100 px-3 py-2.5">
                          {lignes.map((t) => {
                            const cat = catDe(t);
                            return (
                              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                                <p className="min-w-0 flex-1 truncate text-[11px] text-slate-700">
                                  <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${cat.cls}`}>{cat.label}</span>
                                  {t.titre || "Travail"}
                                </p>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {t.debutReel && t.finReelle && (
                                    <span className="text-[10px] tabular-nums text-slate-400">
                                      {heureLocaleDe(t.debutReel)} → {heureLocaleDe(t.finReelle)}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-extrabold tabular-nums text-slate-800">{(Number(t.heures) || 0).toFixed(2)} h</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
            )}

            <p className="pb-2 text-center text-[10px] leading-relaxed text-slate-400">
              Consultation seulement — pour toute correction, parle à ton répartiteur ou à l'administration.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 🧰 MATÉRIEL DE CAMION — le technicien demande, le bureau commande.
// ------------------------------------------------------------
// Boucle volontairement COURTE (décision du propriétaire) : le
// technicien envoie sa liste, le bureau clique « Commande passée »
// (+ note facultative — « arrive jeudi »), et c'est tout. Pas d'étape
// « reçue » : le stock apparaît dans son camion. Le technicien n'a pas
// besoin de savoir chez qui la commande est partie.
// ============================================================
function CarteCommandeCamion({ session }) {
  const [ouvert, setOuvert] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);
  const [lignes, setLignes] = useState([{ article: "", quantite: 1 }]);
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [mesCommandes, setMesCommandes] = useState([]);

  const courriel = session?.user?.email || null;
  useEffect(() => {
    if (!courriel) return;
    const charger = () => listerCommandesCamionPourEmploye(courriel).then(setMesCommandes).catch(() => {});
    charger();
    // En direct : quand le bureau clique « Commande passée », le badge
    // change ici sans rien rafraîchir.
    return sAbonnerCommandesCamion(charger);
  }, [courriel]);

  const envoyer = async () => {
    const propres = lignes
      .map((l) => ({ article: (l.article || "").trim(), quantite: Math.max(1, Number(l.quantite) || 1) }))
      .filter((l) => l.article);
    if (propres.length === 0) return;
    setEnvoi(true);
    try {
      await enregistrerCommandeCamion({ lignes: propres, note: note.trim() }, session);
      setLignes([{ article: "", quantite: 1 }]);
      setNote("");
      setFormOuvert(false);
      listerCommandesCamionPourEmploye(courriel).then(setMesCommandes).catch(() => {});
    } finally {
      setEnvoi(false);
    }
  };

  const enAttente = mesCommandes.filter((c) => c.statut === "envoyee").length;

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-white">
      <button onClick={() => setOuvert(!ouvert)} className="flex w-full items-center justify-between p-3.5 text-left">
        <span className="text-sm font-extrabold text-slate-800">
          🧰 Matériel de camion
          {enAttente > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{enAttente} en attente</span>
          )}
        </span>
        <span className="text-slate-400">{ouvert ? "▲" : "▼"}</span>
      </button>
      {ouvert && (
        <div className="border-t border-slate-100 p-3.5 pt-2.5">
          {!formOuvert ? (
            <Button variant="outline" onClick={() => setFormOuvert(true)} className="w-full">
              ➕ Commander du matériel pour mon camion
            </Button>
          ) : (
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    value={l.article}
                    onChange={(e) => setLignes((prev) => prev.map((x, j) => (j === i ? { ...x, article: e.target.value } : x)))}
                    placeholder="Ex : ruban d'aluminium"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={l.quantite}
                    onChange={(e) => setLignes((prev) => prev.map((x, j) => (j === i ? { ...x, quantite: e.target.value } : x)))}
                    className="w-16 rounded-xl border border-slate-300 px-2 py-2.5 text-center text-sm tabular-nums"
                  />
                  {lignes.length > 1 && (
                    <button onClick={() => setLignes((prev) => prev.filter((_, j) => j !== i))} aria-label="Retirer" className="px-1 text-slate-300">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setLignes((prev) => [...prev, { article: "", quantite: 1 }])} className="text-xs font-bold text-slate-500 underline underline-offset-2">
                + Ajouter un article
              </button>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Note pour le bureau (optionnel)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={envoyer} loading={envoi} disabled={!lignes.some((l) => (l.article || "").trim())} className="flex-1">
                  Envoyer au bureau
                </Button>
                <Button variant="outline" onClick={() => setFormOuvert(false)}>Annuler</Button>
              </div>
            </div>
          )}

          {mesCommandes.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {mesCommandes.slice(0, 5).map((c) => (
                <div key={c.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-600">
                      {c.lignes.map((l) => `${l.article} ×${l.quantite}`).join(" · ")}
                    </span>
                    {c.statut === "commandee" ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">✓ Commande passée</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">⏳ Envoyée</span>
                    )}
                  </div>
                  {c.statut === "commandee" && c.noteBureau && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700">💬 {c.noteBureau}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Accueil({ session, taches, dateSelectionnee, setDateSelectionnee, modeVue, setModeVue, onOuvrir, onDeconnexion, role, enLigne, suggestionChantier, onConfirmerChantier, onIgnorerChantier, onReinitialiser, nbEnAttente, syncEnCours, erreurSync, nomTechnicien, onOuvrirMesHeures, onCorrigerChrono }) {
  // 🚗 COURSE — le technicien crée LUI-MÊME une petite tâche sans
  // client (porter un camion au garage, chercher une pièce en fin de
  // journée) : le répartiteur ne peut pas toujours le prévoir. Pour
  // lui-même, aujourd'hui seulement — la planification reste au bureau.
  // Heures payées (catégorie « divers »), jamais de facturation.
  const [courseOuverte, setCourseOuverte] = useState(false);
  const [courseTitre, setCourseTitre] = useState("");
  const [courseAdresse, setCourseAdresse] = useState("");
  const [courseNote, setCourseNote] = useState("");
  const [courseEnCours, setCourseEnCours] = useState(false);
  const [courseMsg, setCourseMsg] = useState("");
  // 🔔 État du bouton d'activation des notifications push.
  const [etatPush, setEtatPush] = useState(null);
  // 📍 Autocomplétion Google sur l'adresse de la course — comme
  // partout ailleurs. Recherche différée de 300 ms, jeton de session
  // (une seule unité de facturation Google par saisie).
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [courseAdresseChoisie, setCourseAdresseChoisie] = useState(false);
  const courseJetonRef = useRef(null);
  useEffect(() => {
    if (!courseOuverte || courseAdresseChoisie || !googlePlacesDisponible() || courseAdresse.trim().length < 3) {
      setCourseSuggestions([]);
      return;
    }
    let annule = false;
    const minuterie = setTimeout(async () => {
      try {
        if (!courseJetonRef.current) courseJetonRef.current = await nouveauJeton();
        const res = await chercherAdresses(courseAdresse, courseJetonRef.current);
        if (!annule) setCourseSuggestions(res.slice(0, 5));
      } catch {
        if (!annule) setCourseSuggestions([]);
      }
    }, 300);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [courseAdresse, courseOuverte, courseAdresseChoisie]);
  // 🏭 TRAVAIL AU SHOP — mêmes états et même recette que la course.
  const [shopOuvert, setShopOuvert] = useState(false);
  const [shopTitre, setShopTitre] = useState("");
  const [shopNote, setShopNote] = useState("");
  const [shopEnCours, setShopEnCours] = useState(false);
  const [shopMsg, setShopMsg] = useState("");
  const creerShop = async () => {
    if (!shopTitre.trim()) return;
    setShopEnCours(true);
    setShopMsg("");
    try {
      await creerTravailShopTechnicien({ titre: shopTitre.trim(), note: shopNote.trim() }, session);
      setShopMsg("ok");
      setShopTitre("");
      setShopNote("");
      setTimeout(() => {
        setShopOuvert(false);
        setShopMsg("");
      }, 1200);
    } catch {
      setShopMsg("erreur");
    }
    setShopEnCours(false);
  };
  const creerCourse = async () => {
    if (!courseTitre.trim()) return;
    setCourseEnCours(true);
    setCourseMsg("");
    try {
      await creerCourseTechnicien({ titre: courseTitre.trim(), adresse: courseAdresse.trim(), note: courseNote.trim() }, session);
      setCourseMsg("ok");
      setCourseTitre("");
      setCourseAdresse("");
      setCourseNote("");
      setTimeout(() => {
        setCourseOuverte(false);
        setCourseMsg("");
      }, 1200);
    } catch {
      setCourseMsg("erreur");
    }
    setCourseEnCours(false);
  };
  const isoJour = isoLocal(dateSelectionnee);
  // CHRONOS OUBLIÉS — cherchés sur TOUTES les tâches, pas seulement
  // celles du jour affiché : une tâche laissée en marche vendredi doit
  // sauter aux yeux le lundi, même si on regarde le lundi.
  const chronosOublies = tachesTropLongues(taches, HEURES_AVANT_RAPPEL);
  // Filtre les tâches selon la journée voulue (toutes les tâches sont
  // déjà en localStorage, donc la semaine reste dispo hors-ligne).
  // Les « Transport journalier » sont INVISIBLES pour le
  // technicien : leur chrono roule tout seul en coulisse (démarre à la
  // fin d'une tâche, s'arrête au début de la suivante) et leurs heures
  // vont quand même à la paie.
  const tachesDuJour = (iso) =>
    taches
      .filter((t) => t.date === iso && t.momentTransport !== "ccq")
      .sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  const tachesJourCourant = tachesDuJour(isoJour);
  const complete = tachesJourCourant.filter((t) => t.etat === "complete").length;
  const total = tachesJourCourant.length;
  const jours = joursDeLaSemaine(dateSelectionnee);
  const reculer = () => setDateSelectionnee((d) => decalerDate(d, modeVue === "semaine" ? -7 : -1));
  const avancer = () => setDateSelectionnee((d) => decalerDate(d, modeVue === "semaine" ? 7 : 1));
  const clsOnglet = (actif) => `rounded-lg py-2 text-sm font-bold ${actif ? "bg-white text-[#131B2E] shadow-sm" : "text-slate-500"}`;

  const badgeEtat = (tache) => {
    if (tache.etat === "complete")
      return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">TERMINÉ · {formatDuree(dureeEcoulee(tache))}</span>;
    if (tache.etat === "en_cours")
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          EN COURS · {formatDuree(dureeEcoulee(tache))}
        </span>
      );
    if (tache.etat === "en_pause")
      return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">EN PAUSE · {formatDuree(dureeEcoulee(tache))}</span>;
    return <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-[#B14E0E]">À FAIRE</span>;
  };

  const rendreVignette = (tache) => {
    if (tache.type === "transport") {
      return (
        <button
          key={tache.id}
          onClick={() => onOuvrir(tache.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-left shadow-sm active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
            <Car size={18} className="text-slate-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock size={13} />
              <span className="text-xs font-semibold tabular-nums">{tache.heure}</span>
            </div>
            <p className="font-bold text-slate-900">{tache.titre}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">{badgeEtat(tache)}</div>
          <ChevronRight size={18} className="shrink-0 text-slate-300" />
        </button>
      );
    }

    const client = CLIENTS.find((c) => c.id === tache.clientId);
    const adresse = client?.adresses.find((a) => a.id === tache.adresseId);

    return (
      <button
        key={tache.id}
        onClick={() => onOuvrir(tache.id)}
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock size={15} />
            <span className="text-sm font-semibold tabular-nums">{tache.heure}</span>
          </div>
          {badgeEtat(tache)}
        </div>
        {/* TITRE de la tâche en évidence (« c'est quoi la job » d'un coup
            d'œil), puis le client en dessous. */}
        {tache.titre && (
          <p className="mt-3 text-[15px] font-extrabold leading-snug text-slate-900">{tache.titre}</p>
        )}
        {(client?.nom || tache.clientNom || !tache.titre) && (
          <div className={`${tache.titre ? "mt-1" : "mt-3"} flex items-center gap-2 text-slate-900`}>
            <User size={16} className="text-slate-400" />
            <span className={tache.titre ? "text-sm font-semibold text-slate-600" : "font-bold"}>
              {client?.nom || tache.clientNom || "Tâche assignée"}
            </span>
          </div>
        )}
        {tache.supabase && (
          <span className="mt-2 mr-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
            Assignée par l'admin
          </span>
        )}
        {tache.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-500">{tache.description}</p>
        )}
        {tache.typeIntervention && (
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
            {tache.typeIntervention}
          </span>
        )}
        {adresse && (
          <div className="mt-1 flex items-start gap-2 text-sm text-slate-500">
            <MapPin size={15} className="mt-0.5 shrink-0" />
            <span>{adresse.nom} — {adresse.ligne1}</span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-100">
      <div className="bg-[#131B2E] px-5 pb-6 pt-8 text-white">
        <div className="flex items-start justify-between">
          <p className="text-sm text-slate-400">
            {dateSelectionnee.toLocaleDateString("fr-CA", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${enLigne ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${enLigne ? "bg-emerald-400" : "bg-zinc-400"}`} />
              {enLigne ? "En ligne" : "Hors ligne"}
            </span>
            {nbEnAttente > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                {syncEnCours ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                {nbEnAttente} en attente
              </span>
            )}
            {role === "admin" && (
              <>
                <span className="rounded-full bg-[#FF6A13]/20 px-2 py-0.5 text-[10px] font-bold text-[#FF6A13]">ADMIN</span>
                <button
                  onClick={onReinitialiser}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300"
                  title="Réinitialise toutes les tâches à leur état de départ (mode test)"
                >
                  <RotateCcw size={11} /> Réinitialiser
                </button>
              </>
            )}
            <button onClick={onDeconnexion} className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <LogOut size={13} /> Déconnexion
            </button>
          </div>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Bonjour, {nomTechnicien || "technicien"}</h1>
        {!enLigne && (
          <p className="mt-1 text-[11px] text-zinc-300">
            Tes données sont sauvegardées localement et se synchroniseront au retour de la connexion.
          </p>
        )}
        {erreurSync && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
            <AlertTriangle size={11} /> {erreurSync}
          </p>
        )}
        {/* RAPPEL — CHRONO OUBLIÉ (12 h). Volontairement gros, rouge et
            placé avant tout le reste : c'est le premier écran que voit
            le technicien en rouvrant son téléphone le lendemain. Un
            bouton mène directement à la tâche pour la terminer. */}
        {chronosOublies.length > 0 && (
          <div className="mt-4 rounded-xl border-2 border-red-400 bg-red-500 p-3">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-white">
              <AlertTriangle size={16} className="shrink-0" /> Chrono encore parti
            </p>
            {chronosOublies.map((t) => (
              <div key={t.id} className="mt-2">
                <p className="text-[13px] leading-snug text-white">
                  « <span className="font-bold">{t.titre || "Tâche"}</span> » tourne depuis{" "}
                  <span className="font-extrabold tabular-nums">{Math.floor(dureeEcoulee(t) / 3600)} h</span>. L&apos;as-tu oublié ?
                </p>
                <button
                  onClick={() => onCorrigerChrono(t.id)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg bg-white text-sm font-extrabold text-red-600 active:scale-[0.99]"
                >
                  Corriger mon heure de fin
                </button>
              </div>
            ))}
            <p className="mt-2 text-[11px] leading-snug text-red-100">
              Après {HEURES_AVANT_PLAFOND} h, la tâche se ferme seule et sa durée est plafonnée — le bureau devra corriger tes heures.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3">
          <CheckCircle2 size={18} className="text-[#FF6A13]" />
          <span className="text-sm font-medium text-white">
            {complete} / {total} tâches complétées
          </span>
        </div>
      </div>

      {/* BARRE DE NAVIGATION TEMPORELLE */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={() => setModeVue("jour")} className={clsOnglet(modeVue === "jour")}>Jour</button>
          <button onClick={() => setModeVue("semaine")} className={clsOnglet(modeVue === "semaine")}>Semaine</button>
        </div>
        {/* MES HEURES — consultation de sa semaine de paie (lecture seule). */}
        <button
          onClick={onOuvrirMesHeures}
          className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-700 active:bg-slate-100"
        >
          🕐 Mes heures de la semaine
        </button>
        <button
          onClick={() => setCourseOuverte(true)}
          className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-700 active:bg-slate-100"
        >
          🚗 Course / déplacement (sans client)
        </button>
        {/* 🏭 TRAVAIL AU SHOP (demande du propriétaire, 2026-08-19) : il
            finit sa dernière tâche, arrive au bureau — ses heures
            continuent de compter, sans rien demander au répartiteur. */}
        <button
          onClick={() => setShopOuvert(true)}
          className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-700 active:bg-slate-100"
        >
          🏭 Travail au shop (atelier)
        </button>
        {/* 🔔 NOTIFICATIONS PUSH (2026-08-18) : « nouvelle tâche »,
            « matériel commandé » — reçues même application fermée.
            Le bouton disparaît une fois la permission accordée.
            iPhone : exige l'app AJOUTÉE À L'ÉCRAN D'ACCUEIL (iOS 16.4+). */}
        {pushSupporte() && typeof Notification !== "undefined" && Notification.permission === "default" && etatPush !== "active" && (
          <button
            onClick={async () => {
              setEtatPush("demande");
              const r = await activerNotificationsPush();
              setEtatPush(r);
            }}
            disabled={etatPush === "demande"}
            className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-extrabold text-amber-800 active:bg-amber-100 disabled:opacity-60"
          >
            {etatPush === "demande" ? "Activation…" : "🔔 Activer les notifications (nouvelle tâche, matériel…)"}
          </button>
        )}
        {etatPush === "active" && (
          <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-center text-[11px] font-bold text-emerald-700">
            ✅ Notifications activées — tu recevras les nouvelles tâches sur ce téléphone.
          </p>
        )}
        {etatPush === "refuse" && (
          <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-center text-[11px] font-bold text-red-700">
            Notifications refusées — réactive-les dans les réglages du navigateur si tu changes d'idée.
          </p>
        )}
        {courseOuverte && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => !courseEnCours && setCourseOuverte(false))(); }}>
            <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-extrabold text-slate-900">🚗 Nouvelle course</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Pour toi, aujourd&apos;hui. Aucun client, rien à facturer — tes heures sont payées et le bureau la voit dans l&apos;agenda.
              </p>
              <label className="mt-3 mb-1 block text-[11px] font-bold text-slate-500">Quoi ?</label>
              <input
                value={courseTitre}
                onChange={(e) => setCourseTitre(e.target.value)}
                placeholder="Ex : porter le camion 4 au garage"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <label className="mt-2 mb-1 block text-[11px] font-bold text-slate-500">Adresse (facultatif)</label>
              <input
                value={courseAdresse}
                onChange={(e) => {
                  setCourseAdresse(e.target.value);
                  setCourseAdresseChoisie(false);
                }}
                placeholder="Ex : 123 rue du Garage, Blainville"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              {courseSuggestions.length > 0 && (
                <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {courseSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setCourseAdresse(s.texte);
                        setCourseAdresseChoisie(true);
                        setCourseSuggestions([]);
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 last:border-0 active:bg-orange-50"
                    >
                      📍 {s.texte}
                    </button>
                  ))}
                </div>
              )}
              <label className="mt-2 mb-1 block text-[11px] font-bold text-slate-500">Note (facultatif)</label>
              <textarea
                rows={2}
                value={courseNote}
                onChange={(e) => setCourseNote(e.target.value)}
                placeholder="Détails utiles…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              {courseMsg === "ok" && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-700">✅ Course créée — elle apparaît dans ton horaire.</p>
              )}
              {courseMsg === "erreur" && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">Impossible de créer la course — vérifie ta connexion et réessaie.</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setCourseOuverte(false)} disabled={courseEnCours} className="w-full">
                  Annuler
                </Button>
                <Button onClick={creerCourse} disabled={courseEnCours || !courseTitre.trim()} className="w-full">
                  {courseEnCours ? "Création…" : "Créer la course"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* 🏭 FENÊTRE — TRAVAIL AU SHOP : quoi + note, c'est tout.
            Aucun client, aucune adresse — le chrono roule comme sur
            n'importe quelle tâche, la fermeture est simple (pas de bon). */}
        {shopOuvert && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; if (!shopEnCours) setShopOuvert(false); }}>
            <div className="w-full max-w-md rounded-2xl bg-white p-4">
              <h3 className="text-base font-extrabold text-slate-900">🏭 Travail au shop</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Pour toi, aujourd&apos;hui. Aucun client, rien à facturer — tes heures sont payées et le bureau le voit dans l&apos;agenda.
              </p>
              <label className="mt-3 mb-1 block text-[11px] font-bold text-slate-500">Quoi ?</label>
              <input
                value={shopTitre}
                onChange={(e) => setShopTitre(e.target.value)}
                placeholder="Ex : fabrication de conduits, ménage du camion"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <label className="mt-2 mb-1 block text-[11px] font-bold text-slate-500">Note (facultatif)</label>
              <textarea
                rows={2}
                value={shopNote}
                onChange={(e) => setShopNote(e.target.value)}
                placeholder="Détails utiles…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              {shopMsg === "ok" && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-700">✅ Tâche créée — elle apparaît dans ton horaire, pèse Débuter en arrivant.</p>
              )}
              {shopMsg === "erreur" && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">Impossible de créer la tâche — vérifie ta connexion et réessaie.</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setShopOuvert(false)} disabled={shopEnCours} className="w-full">
                  Annuler
                </Button>
                <Button onClick={creerShop} disabled={shopEnCours || !shopTitre.trim()} className="w-full">
                  {shopEnCours ? "Création…" : "Créer la tâche"}
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={reculer} aria-label="Précédent" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-slate-600 active:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setDateSelectionnee(new Date())} className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 active:bg-slate-100">
            Aujourd'hui
          </button>
          <button onClick={avancer} aria-label="Suivant" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-slate-600 active:bg-slate-100">
            <ChevronRight size={18} />
          </button>
          <input
            type="date"
            value={isoJour}
            onChange={(e) => e.target.value && setDateSelectionnee(dateDepuisIso(e.target.value))}
            className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700"
          />
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">
          {modeVue === "semaine"
            ? `Semaine du ${jours[0].toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} au ${jours[6].toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`
            : dateSelectionnee.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {suggestionChantier && (
        <div className="mx-4 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3.5">
          <p className="text-sm font-bold text-blue-900">
            Êtes-vous sur le chantier « {suggestionChantier.client.nom} » ?
          </p>
          <p className="mt-0.5 text-xs text-blue-700">
            {suggestionChantier.adresse.nom} — {suggestionChantier.adresse.ligne1} (~{suggestionChantier.distanceKm.toFixed(1)} km)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button onClick={onConfirmerChantier} className="min-h-0 py-2 text-xs">
              Oui, m'y rendre
            </Button>
            <Button variant="outline" onClick={onIgnorerChantier} className="min-h-0 py-2 text-xs">
              Ignorer
            </Button>
          </div>
        </div>
      )}

      {modeVue === "jour" ? (
        <div className="flex-1 space-y-3 px-4 py-5">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Horaire du jour
          </h2>
          {tachesJourCourant.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              Aucune tâche pour cette journée.
            </p>
          ) : (
            tachesJourCourant.map((tache) => rendreVignette(tache))
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-4 px-4 py-5">
          {jours.map((jour) => {
            const iso = isoLocal(jour);
            const liste = tachesDuJour(iso);
            const estAujourdhui = iso === isoLocal(new Date());
            return (
              <div key={iso}>
                <button
                  onClick={() => { setDateSelectionnee(jour); setModeVue("jour"); }}
                  className="mb-2 flex w-full items-center justify-between px-1"
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${estAujourdhui ? "text-[#FF6A13]" : "text-slate-500"}`}>
                    {jour.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "short" })}
                    {estAujourdhui ? " · aujourd'hui" : ""}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {liste.length} {liste.length > 1 ? "tâches" : "tâche"}
                  </span>
                </button>
                {liste.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-3 text-center text-xs text-slate-400">
                    Aucune tâche
                  </p>
                ) : (
                  <div className="space-y-2">{liste.map((tache) => rendreVignette(tache))}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CarteCommandeCamion session={session} />
      <PiedCopyright />
    </div>
  );
}

// ============================================================
// SÉLECTEUR CLIENT / ADRESSE
// ============================================================
function SelecteurClientAdresse({ clientId, adresseId, setClientId, setAdresseId, lectureSeule, clientNomFallback, clientTelephone }) {
  const client = CLIENTS.find((c) => c.id === clientId);
  const [choixTrajetOuvert, setChoixTrajetOuvert] = useState(false);
  const adresseActive = client?.adresses.find((a) => a.id === adresseId);

  // Tâche assignée par l'admin (Supabase) : le client n'existe pas dans
  // la liste locale de démo — affichage simple du nom, sans sélecteur.
  if (!client) {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Client</label>
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800">
          {clientNomFallback || "Client assigné par l'administration"}
        </p>
        {/* NUMÉRO DU CLIENT sous le nom (demande du 2026-08-17) : en
            GROS pour être lisible si le technicien appelle d'un autre
            téléphone, et cliquable — le lien tel: ouvre le composeur
            du téléphone avec le numéro déjà entré (aucune permission
            à demander : le téléphone confirme l'appel lui-même). */}
        {clientTelephone && (
          <a
            href={`tel:${String(clientTelephone).replace(/[^+0-9]/g, "")}`}
            className="mt-1.5 flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 active:scale-[0.99]"
          >
            <Phone size={16} className="shrink-0 text-[#FF6A13]" />
            <span className="text-lg font-extrabold tabular-nums tracking-wide text-slate-900">{clientTelephone}</span>
            <span className="ml-auto text-[11px] font-bold uppercase text-slate-400">Appeler</span>
          </a>
        )}
        <p className="mt-1 text-[11px] text-slate-400">Détails de la tâche dans la description ci-dessous.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Client
        </label>
        <div className="relative">
          <select
            value={clientId}
            disabled={lectureSeule}
            onChange={(e) => {
              setClientId(e.target.value);
              const nouveauClient = CLIENTS.find((c) => c.id === e.target.value);
              const defaut = nouveauClient.adresses.find((a) => a.defaut) || nouveauClient.adresses[0];
              setAdresseId(defaut.id);
            }}
            className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
          >
            {CLIENTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Adresse de livraison
        </label>
        <div className="relative">
          <select
            value={adresseId}
            disabled={lectureSeule}
            onChange={(e) => setAdresseId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
          >
            {client.adresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom} — {a.ligne1}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </div>
        {/* Adresse cliquable — accès rapide au trajet sans passer par
            le bouton, satisfait "toutes les adresses cliquables". */}
        <button
          onClick={() => setChoixTrajetOuvert((v) => !v)}
          className="mt-1 flex items-center gap-1 text-xs font-semibold text-blue-600 underline underline-offset-2"
        >
          <MapPin size={12} /> {adresseActive.ligne1}
        </button>
      </div>

      {!choixTrajetOuvert ? (
        <Button variant="outline" onClick={() => setChoixTrajetOuvert(true)} className="w-full">
          <Navigation2 size={18} />
          Trajet vers cette adresse
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => { ouvrirTrajet(adresseActive.ligne1, "google"); setChoixTrajetOuvert(false); }}
          >
            Google Maps
          </Button>
          <Button
            variant="outline"
            onClick={() => { ouvrirTrajet(adresseActive.ligne1, "waze"); setChoixTrajetOuvert(false); }}
          >
            Waze
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LIGNE PRODUIT
// ============================================================
function LigneProduit({ ligne, onChange, onSupprimer, lectureSeule }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {ligne.horsCatalogue ? (
            <input
              type="text"
              placeholder="Description de l'item"
              value={ligne.nom}
              disabled={lectureSeule}
              onChange={(e) => onChange({ ...ligne, nom: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-semibold disabled:bg-slate-100"
            />
          ) : (
            <p className="text-sm font-bold text-slate-900">{ligne.nom}</p>
          )}
        </div>
        {!lectureSeule && (
          <button onClick={onSupprimer} className="p-1 text-slate-400">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ ...ligne, quantite: Math.max(1, ligne.quantite - 1) })}
            disabled={lectureSeule}
            className="h-11 w-11 touch-manipulation rounded-lg bg-slate-100 text-lg font-bold text-slate-600 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-bold tabular-nums">{ligne.quantite}</span>
          <button
            onClick={() => onChange({ ...ligne, quantite: ligne.quantite + 1 })}
            disabled={lectureSeule}
            className="h-11 w-11 touch-manipulation rounded-lg bg-slate-100 text-lg font-bold text-slate-600 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-1">
          {ligne.prixNonListe || ligne.horsCatalogue ? (
            <>
              <span className="text-sm text-slate-500">$</span>
              <InputNombreDecimal
                valeur={Number(ligne.prix_vendant) || 0}
                disabled={lectureSeule}
                onChange={(v) => onChange({ ...ligne, prix_vendant: v })}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-bold tabular-nums disabled:bg-slate-100"
              />
            </>
          ) : (
            <span className="text-sm font-bold tabular-nums text-slate-900">
              {ligne.prix_vendant.toFixed(2)} $
            </span>
          )}
        </div>
      </div>

      {!ligne.horsCatalogue && (
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#B14E0E]">
          <input
            type="checkbox"
            checked={ligne.prixNonListe}
            disabled={lectureSeule}
            onChange={(e) => onChange({ ...ligne, prixNonListe: e.target.checked })}
            className="h-4 w-4 accent-[#FF6A13]"
          />
          Prix non listé / spécial (nécessite révision)
        </label>
      )}
    </div>
  );
}

// ============================================================
// ZONE PHOTO (avant / après) AVEC COMPRESSION
// ============================================================
// ============================================================
// CAPTURE CAMÉRA INTÉGRÉE — demande explicitement la permission
// (getUserMedia) et affiche un flux vidéo en direct DANS l'app,
// plutôt que de déléguer à l'appareil photo natif du téléphone. Ceci
// évite aussi un piège technique : appeler input.click() APRÈS un
// await (ex: après avoir attendu getUserMedia) perd le contexte de
// "geste utilisateur" exigé par les navigateurs pour ouvrir un
// sélecteur de fichier — le picker natif resterait alors bloqué
// silencieusement. En capturant directement via <video>, ce problème
// ne se pose pas.
// ============================================================
function ModalCaptureCamera({ onCapture, onFermer }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [erreur, setErreur] = useState("");
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      // CONTEXTE NON SÉCURISÉ : les navigateurs mobiles coupent l'accès
      // à la caméra hors HTTPS (une adresse http://10.0.0.x ne compte
      // pas). `navigator.mediaDevices` est alors carrément absent.
      // Sans ce test, le technicien recevait « accès refusé » et allait
      // fouiller ses réglages pour rien — la permission n'est pas en
      // cause, c'est l'adresse du site.
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!annule) {
          setErreur(
            window.isSecureContext === false
              ? "La caméra est bloquée parce que l'application est ouverte en http:// non sécurisé. Préviens l'administration — l'application doit être servie en https://."
              : "Ce navigateur ne donne pas accès à la caméra. Utilise le bouton « Choisir une photo » à la place."
          );
        }
        return;
      }
      try {
        // Sans largeur demandée, bien des téléphones servent du 640×480
        // (qualité webcam) — on exige le 1080p, le téléphone donne ce
        // qu'il peut de mieux en dessous si sa caméra est plus modeste.
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (annule) {
          flux.getTracks().forEach((piste) => piste.stop());
          return;
        }
        streamRef.current = flux;
        if (videoRef.current) {
          videoRef.current.srcObject = flux;
          await videoRef.current.play().catch(() => {});
        }
        if (!annule) setPret(true);
      } catch {
        if (!annule) setErreur("Accès à la caméra refusé — active la permission dans les réglages de ton téléphone pour ajouter une photo.");
      }
    })();
    return () => {
      annule = true;
      streamRef.current?.getTracks().forEach((piste) => piste.stop());
    };
  }, []);

  const capturer = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const largeurMax = 1600;
    const echelle = Math.min(1, largeurMax / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth * echelle;
    canvas.height = video.videoHeight * echelle;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture({ url: URL.createObjectURL(blob), blob, tailleOriginale: blob.size, tailleCompressee: blob.size });
      },
      "image/jpeg",
      0.8
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3">
        <button onClick={onFermer} aria-label="Fermer la caméra" className="rounded-full bg-white/10 p-3 text-white active:scale-95">
          <X size={22} />
        </button>
        <span className="text-xs font-bold text-white">Prendre une photo</span>
        <div className="w-12" />
      </div>

      {erreur ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle size={32} className="text-amber-400" />
          <p className="text-sm text-white">{erreur}</p>
          <Button variant="outline" onClick={onFermer} className="border-white text-white">
            Fermer
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-black">
            {!pret && <Loader2 size={28} className="animate-spin text-white/60" />}
            <video ref={videoRef} playsInline muted className={`max-h-full max-w-full ${pret ? "" : "hidden"}`} />
          </div>
          <div className="flex items-center justify-center p-6">
            <button
              onClick={capturer}
              disabled={!pret}
              aria-label="Capturer la photo"
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:scale-95 disabled:opacity-40"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ZonePhoto({ titre, photos, setPhotos, onPhotosChange, obligatoire, lectureSeule }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [cameraOuverte, setCameraOuverte] = useState(false);
  // 📸 Visionneuse : glissement de doigt ET flèches (gants de travail).
  const [visionneuseIndex, setVisionneuseIndex] = useState(null);
  const [legendes, setLegendes] = useState({});
  const inputRef = useRef(null);
  // 📁 Sélecteur GALERIE — sans l'attribut capture : le système ouvre le
  // choix de photos existantes. L'app ne voit QUE les photos choisies
  // (sélecteur du système), jamais le reste de la galerie.
  const inputGalerieRef = useRef(null);

  const ajouterPhoto = (nouvellePhoto) => {
    const nouvellesPhotos = [...photos, nouvellePhoto];
    setPhotos(nouvellesPhotos);
    // Action directe (ajout de photo) → on synchronise l'état global
    // immédiatement, pas via un useEffect déclenché à chaque rendu.
    if (onPhotosChange) onPhotosChange(nouvellesPhotos);
    // TÉLÉVERSEMENT EN ARRIÈRE-PLAN vers le stockage Supabase : l'URL
    // distante obtenue voyagera avec le travail complété (bureau, bon de
    // travail client, PDF). Hors-ligne : la photo reste locale — elle
    // apparaîtra sur le téléphone mais pas au dossier.
    if (nouvellePhoto.blob) {
      televerserPhotoTravail(nouvellePhoto.blob, nouvellePhoto.origine || "camera")
        .then((urlDistante) => {
          setPhotos((prev) => {
            const maj = prev.map((p) => (p.url === nouvellePhoto.url ? { ...p, urlDistante } : p));
            if (onPhotosChange) setTimeout(() => onPhotosChange(maj), 0);
            return maj;
          });
        })
        .catch(() => {
          // hors-ligne ou bucket absent (snippet 15 non exécuté) — la
          // photo reste utilisable localement, sans lien au dossier
        });
    }
  };

  // Supprime une photo ET révoque son URL Blob — c'est le point où la
  // fuite mémoire se produisait : les Blob créés par
  // URL.createObjectURL() restent en mémoire tant qu'ils ne sont pas
  // explicitement révoqués, même après avoir retiré la photo de la
  // liste affichée.
  const retirerPhoto = (index) => {
    const photo = photos[index];
    if (photo?.url) URL.revokeObjectURL(photo.url);
    const nouvellesPhotos = photos.filter((_, i) => i !== index);
    setPhotos(nouvellesPhotos);
    if (onPhotosChange) onPhotosChange(nouvellesPhotos);
  };

  const gererFichier = async (e, origine = "camera") => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    setEnCours(true);
    setErreur("");
    try {
      const resultat = await compresserImage(fichier);
      // L'ORIGINE accompagne la photo : "camera" = prise en direct
      // (valeur de preuve), "galerie" = importée du téléphone.
      ajouterPhoto({ ...resultat, origine });
    } catch (err) {
      // Ne jamais laisser l'interface bloquée en "chargement" si la
      // compression échoue — le technicien voit un message clair et
      // peut réessayer immédiatement.
      setErreur(err.message || "Échec de l'ajout de la photo — réessaie.");
    } finally {
      setEnCours(false);
      e.target.value = "";
    }
  };

  // Ouvre la capture caméra intégrée à l'app (avec demande explicite
  // de permission — voir ModalCaptureCamera) si disponible ; sinon,
  // clic synchrone sur le sélecteur natif (aucun problème de "geste
  // utilisateur perdu" ici, car ce clic n'est précédé d'aucun await).
  const demarrerAjoutPhoto = () => {
    setErreur("");
    if (navigator.mediaDevices?.getUserMedia) {
      setCameraOuverte(true);
    } else {
      inputRef.current?.click();
    }
  };

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        {titre}
        {obligatoire && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-red-600">
            Obligatoire
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
            <img
              src={p.url}
              alt=""
              className="h-full w-full object-cover"
              onClick={() => {
                setVisionneuseIndex(i);
                const urls = photos.map((x) => x.urlDistante).filter(Boolean);
                if (urls.length) listerLegendes(urls).then(setLegendes).catch(() => {});
              }}
            />
            {p.origine === "galerie" && (
              <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[9px] text-white" title="Importée de la galerie">📁</span>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[9px] text-white">
              -{Math.round(100 - (p.tailleCompressee / p.tailleOriginale) * 100)}%
            </div>
            {!lectureSeule && (
              <button
                type="button"
                onClick={() => retirerPhoto(i)}
                aria-label="Retirer la photo"
                className="absolute right-0.5 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white active:scale-95"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {!lectureSeule && (
          <>
            <button
              type="button"
              onClick={demarrerAjoutPhoto}
              disabled={enCours}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 active:scale-95 disabled:opacity-60"
            >
              {enCours ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
              <span className="text-[10px] font-semibold">Photo</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => gererFichier(e, "camera")}
                className="hidden"
              />
            </button>
            {/* 📁 GALERIE — décision du propriétaire : la documentation
                entre TOUJOURS (photos prises avec la caméra native,
                reçues du client par texto…), mais son origine reste
                marquée — en direct vs importée. Avec les photos AVANT
                travaux, un bris avant/après se tranche facilement. */}
            <button
              type="button"
              onClick={() => { setErreur(""); inputGalerieRef.current?.click(); }}
              disabled={enCours}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-slate-300 active:scale-95 disabled:opacity-60"
            >
              <span className="text-lg leading-none">📁</span>
              <span className="text-[10px] font-semibold">Galerie</span>
              <input
                ref={inputGalerieRef}
                type="file"
                accept="image/*"
                onChange={(e) => gererFichier(e, "galerie")}
                className="hidden"
              />
            </button>
          </>
        )}
      </div>
      {photos.length === 0 && lectureSeule && (
        <p className="mt-1 text-[11px] text-slate-400">Aucune photo.</p>
      )}
      {photos.length > 0 && (
        <p className="mt-1 text-[11px] text-slate-400">
          {formatKo(photos.reduce((s, p) => s + p.tailleOriginale, 0))} →{" "}
          {formatKo(photos.reduce((s, p) => s + p.tailleCompressee, 0))} compressé
        </p>
      )}
      {erreur && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-600">
          <AlertTriangle size={11} className="shrink-0" /> {erreur}
        </p>
      )}
      {visionneuseIndex != null && (
        <VisionneusePhotos
          photos={photos.map((p, i2) => ({ url: p.urlDistante || p.url, etiquette: `${titre} ${i2 + 1}/${photos.length}`, origineGalerie: p.origine === "galerie" }))}
          indexDepart={visionneuseIndex}
          legendes={legendes}
          onFermer={() => setVisionneuseIndex(null)}
          onLegende={(url, texte) => {
            // La légende se rattache à la photo TÉLÉVERSÉE (URL web).
            // Une photo encore locale (hors-ligne) attendra sa mise en
            // ligne — le champ l'explique au lieu d'échouer en silence.
            if (!/^https?:/.test(url)) {
              setErreur("Photo pas encore téléversée (connexion requise) — le détail pourra s'ajouter une fois en ligne.");
              return;
            }
            setLegendes((prev) => ({ ...prev, [url]: texte }));
            sauvegarderLegende(url, texte, null).catch(() => {});
          }}
        />
      )}
      {cameraOuverte && (
        <ModalCaptureCamera
          onFermer={() => setCameraOuverte(false)}
          onCapture={(nouvellePhoto) => {
            ajouterPhoto(nouvellePhoto);
            setCameraOuverte(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// SIGNATURE TACTILE
// ============================================================
function ZoneSignature({ aSignature, setASignature, canvasRef, onSignatureCommencee, onSignatureEffacee, lectureSeule, libelle }) {
  const dessine = useRef(false);

  // L'ÉCRAN NE DOIT PAS BOUGER PENDANT LA SIGNATURE (constat des
  // employés). `touch-none` ne suffit pas sur tous les téléphones :
  // on bloque AUSSI les événements tactiles natifs du canevas (en mode
  // non passif — seul mode où preventDefault fonctionne), sinon la page
  // défile, la barre d'adresse se replie et le canevas glisse sous le
  // doigt en plein trait.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bloquer = (e) => e.preventDefault();
    canvas.addEventListener("touchstart", bloquer, { passive: false });
    canvas.addEventListener("touchmove", bloquer, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", bloquer);
      canvas.removeEventListener("touchmove", bloquer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Le canvas a une résolution interne fixe (320x140) mais sa taille
    // affichée à l'écran varie (w-full) — il faut remettre les
    // coordonnées à l'échelle, sinon le trait apparaît décalé.
    const echelleX = canvas.width / rect.width;
    const echelleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * echelleX,
      y: (e.clientY - rect.top) * echelleY,
    };
  };

  const debut = (e) => {
    if (lectureSeule) return;
    dessine.current = true;
    // Gèle le défilement de la PAGE le temps du trait — remis à la fin.
    document.body.style.overflow = "hidden";
    e.target.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const trace = (e) => {
    if (!dessine.current || lectureSeule) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#131B2E";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!aSignature) {
      setASignature(true);
      if (onSignatureCommencee) onSignatureCommencee();
    }
  };

  const fin = () => {
    dessine.current = false;
    document.body.style.overflow = "";
  };

  const effacer = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setASignature(false);
    if (onSignatureEffacee) onSignatureEffacee();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
          {libelle || "Signature *"}
        </label>
        {!lectureSeule && (
          <button onClick={effacer} className="text-xs font-semibold text-slate-400 underline">
            Effacer
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        onPointerDown={debut}
        onPointerMove={trace}
        onPointerUp={fin}
        onPointerLeave={fin}
        className={`w-full touch-none rounded-xl border-2 border-slate-300 bg-slate-50 ${lectureSeule ? "cursor-not-allowed opacity-70" : ""}`}
        style={{ height: 140 }}
      />
      {!aSignature && !lectureSeule && (
        <p className="mt-1 text-[11px] text-slate-400">Signez avec le doigt dans la zone ci-dessus</p>
      )}
    </div>
  );
}

// ============================================================
// ÉCRAN TRANSPORT (début / fin de journée)
// ============================================================
function TacheTransport({ tache, onDemarrer, onPause, onReprendre, onTerminer, onMajTache, onRetour, tacheBloquante, inspectionFaite, toutesLesTaches }) {
  const [kilometresLocal, setKilometresLocal] = useState(tache.kilometres);
  const [captureGpsEnCours, setCaptureGpsEnCours] = useState(null); // "depart" | "arrivee" | null
  const [messageGps, setMessageGps] = useState("");
  const [estimationRetour, setEstimationRetour] = useState(null); // { distanceKm, dureeMin }
  const [estimationEnCours, setEstimationEnCours] = useState(false);
  const duree = dureeEcoulee(tache);
  const heures = duree / 3600;
  const projetImpute = projetImputeAuTransport(tache, toutesLesTaches);
  const estAller = tache.momentTransport === "debut";
  // La configuration de l'entreprise — l'adresse de retour y vit.
  const configTransport = useEntreprise();
  const destination = destinationDuTrajet(tache, toutesLesTaches, configTransport);

  const commettreKilometres = () => {
    onMajTache(tache.id, { kilometres: kilometresLocal });
  };

  // "Lancer le trajet (Google Maps)" (aller) / "Quitter le chantier"
  // (retour) — capture la position GPS de départ + l'heure, démarre le
  // chronomètre habituel, ET ouvre l'itinéraire pré-rempli vers la
  // destination (première tâche du jour à l'aller, entrepôt au
  // retour). Si le GPS est indisponible, le trajet démarre quand même
  // (le kilométrage restera à saisir manuellement) et Maps s'ouvre
  // tout de même avec l'adresse de destination seule.
  const demarrerAvecGps = async () => {
    setCaptureGpsEnCours("depart");
    const position = await capturerPositionGps();
    if (position) {
      onMajTache(tache.id, { latDepart: position.lat, lngDepart: position.lng, heureDepartGps: position.heure });
      setMessageGps("");
    } else {
      setMessageGps("Position GPS indisponible au départ — le kilométrage devra être ajusté manuellement.");
    }
    if (destination) ouvrirTrajet(destination.ligne1, "google");
    setCaptureGpsEnCours(null);
    onDemarrer();
  };

  // "Arrivé au chantier" (aller) / "Arrivé à l'entrepôt" (retour) —
  // capture la position GPS d'arrivée et calcule automatiquement la
  // distance parcourue depuis le départ (Haversine), en plus d'arrêter
  // le chronomètre habituel.
  const arriverAvecGps = async () => {
    setCaptureGpsEnCours("arrivee");
    const position = await capturerPositionGps();
    if (position && tache.latDepart != null && tache.lngDepart != null) {
      const distance = Math.round(distanceKm(tache.latDepart, tache.lngDepart, position.lat, position.lng) * 10) / 10;
      setKilometresLocal(distance);
      onMajTache(tache.id, { latArrivee: position.lat, lngArrivee: position.lng, kilometres: distance });
      setMessageGps("");
    } else if (!position) {
      setMessageGps("Position GPS indisponible à l'arrivée — ajuste le kilométrage manuellement ci-dessous.");
    } else {
      setMessageGps("Position de départ manquante — ajuste le kilométrage manuellement ci-dessous.");
    }
    setCaptureGpsEnCours(null);
    onTerminer();
  };

  // "Estimation temps de retour (Google Maps)" — outil de planification
  // AVANT de quitter le chantier : capture la position actuelle et
  // estime la distance + durée jusqu'à l'entrepôt, sans démarrer le
  // chronomètre ni modifier la tâche. Le technicien peut ensuite
  // valider (fermer l'estimation) ou lancer le guidage réel.
  const estimerRetour = async () => {
    setEstimationEnCours(true);
    const position = await capturerPositionGps();
    // L'estimation vise la destination RÉELLE du retour (l'adresse de
    // l'entreprise, selon ses Paramètres). Sans coordonnées connues
    // (entreprise cliente : adresse en texte seulement), pas de calcul
    // à vol d'oiseau possible — le guidage Google reste disponible.
    if (position && destination?.lat != null && destination?.lng != null) {
      const distance = Math.round(distanceKm(position.lat, position.lng, destination.lat, destination.lng) * 10) / 10;
      const dureeMin = Math.round((distance / VITESSE_MOYENNE_ESTIMATION_KMH) * 60);
      setEstimationRetour({ distanceKm: distance, dureeMin });
    } else if (position) {
      setMessageGps("Estimation indisponible pour cette adresse — utilise « Lancer le guidage » (Google calcule le trajet réel).");
    } else {
      setMessageGps("Position GPS indisponible pour l'estimation du retour.");
    }
    setEstimationEnCours(false);
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-100">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5">
        <button onClick={onRetour} className="text-slate-500">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">{tache.titre}</h1>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        {destination ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-2 text-xs">
              <MapPin size={14} className="mt-0.5 shrink-0 text-[#FF6A13]" />
              <div className="min-w-0 flex-1">
                <p className="font-bold uppercase tracking-wide text-slate-400" style={{ fontSize: "10px" }}>
                  Destination {estAller ? "(premier chantier du jour)" : "(entrepôt — fixe)"}
                </p>
                <p className="font-semibold text-slate-800">{destination.nom}</p>
                <p className="text-slate-500">{destination.ligne1}</p>
              </div>
            </div>
            {/* Bouton PERMANENT : le trajet s'ouvre déjà au démarrage,
                mais si le technicien ferme la navigation ou refait un
                détour, il doit pouvoir la relancer sans redémarrer sa
                tâche (ce qui fausserait son chrono). */}
            <button
              onClick={() => ouvrirTrajet(destination.ligne1)}
              className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-700 active:scale-[0.99]"
            >
              <Navigation2 size={14} /> Ouvrir la navigation
            </button>
          </div>
        ) : (
          /* Sans destination, le technicien partirait à l'aveugle — on
             le dit franchement plutôt que de n'afficher rien du tout. */
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <AlertTriangle size={14} className="shrink-0" /> Aucune adresse de destination
            </p>
            <p className="mt-1 text-[11px] leading-snug text-amber-700">
              {estAller
                ? "Aucune tâche avec adresse n'est prévue aujourd'hui. Appelle le bureau avant de partir."
                : "L'adresse de l'entrepôt est introuvable — préviens l'administration."}
            </p>
          </div>
        )}

        <PanneauMinutage
          tache={tache}
          onDemarrer={demarrerAvecGps}
          onPause={onPause}
          onReprendre={onReprendre}
          onTerminer={arriverAvecGps}
          tacheBloquante={tacheBloquante}
          inspectionRequise={!inspectionFaite}
          labelDebuter={estAller ? "Lancer le trajet (Google Maps)" : "Quitter le chantier"}
          labelTerminer={estAller ? "Arrivé au chantier" : "Arrivé à l'entrepôt"}
          chargementDebuter={captureGpsEnCours === "depart"}
          chargementTerminer={captureGpsEnCours === "arrivee"}
        />

        {!estAller && tache.etat === "a_faire" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Avant de partir</p>
            <Button variant="outline" onClick={estimerRetour} loading={estimationEnCours} className="w-full">
              Estimation temps de retour (Google Maps)
            </Button>
            {estimationRetour && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">
                  ~{estimationRetour.distanceKm} km · ~{estimationRetour.dureeMin} min (estimation)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Estimation à vol d'oiseau — le trajet réel et le trafic peuvent varier.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setEstimationRetour(null)} className="min-h-0 py-2 text-xs">
                    Valider / fermer
                  </Button>
                  <Button onClick={() => ouvrirTrajet(destination?.ligne1 || DEPOT_ADRESSE.ligne1, "google")} className="min-h-0 py-2 text-xs">
                    Lancer le guidage
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {messageGps && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">{messageGps}</div>
        )}

        {tache.latDepart != null && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
            <MapPin size={14} className="shrink-0" />
            Position de départ capturée par GPS{tache.latArrivee != null ? " — arrivée aussi capturée, distance calculée automatiquement." : "."}
          </div>
        )}

        <div className={`rounded-xl p-3 text-xs font-semibold ${projetImpute ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
          {projetImpute
            ? `Imputé automatiquement au projet #${projetImpute} (${estAller ? "première" : "dernière"} tâche de la journée rattachée à ce projet).`
            : "Hors-projet — comptabilisé en heures générales seulement (la tâche adjacente n'est rattachée à aucun projet)."}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Kilométrage parcouru
            {tache.latDepart != null && tache.latArrivee != null && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-emerald-700">
                Calculé par GPS
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.1"
              value={kilometresLocal}
              onChange={(e) => setKilometresLocal(parseFloat(e.target.value) || 0)}
              onBlur={commettreKilometres}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold tabular-nums"
              placeholder="0"
            />
            <span className="shrink-0 text-sm font-semibold text-slate-500">km</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Calculé automatiquement à l'arrivée via GPS — modifiable au besoin (ex: si le GPS était indisponible).
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Temps de transport
          </label>
          <p className="text-2xl font-extrabold tabular-nums text-slate-900">{heures.toFixed(2)} h</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Calculé à partir du chronomètre ({formatDuree(duree)}), converti en heures/fractions pour la feuille de temps — imputé automatiquement au projet (voir ci-dessus).
          </p>
        </div>
      </div>

      <PiedCopyright />
    </div>
  );
}

// ============================================================
// FORMULAIRE BON DE TRAVAIL
// ============================================================
function BonDeTravail({ tache, onDemarrer, onPause, onReprendre, onTerminer, onRetour, onMajTache, tacheBloquante, inspectionFaite, role, enLigne, session }) {
  // ============================================================
  // TRAVAIL PARTAGÉ À PLUSIEURS TECHNICIENS
  // ------------------------------------------------------------
  // Sans cette lecture, chacun faisait signer SON bon de travail : le
  // client signait deux fois pour la même job, et le bureau recevait
  // deux demandes de facturation pour un seul contrat.
  //
  // Règle : le bon de travail appartient à la TÂCHE, pas au technicien.
  // Celui qui ferme EN DERNIER le signe avec le client ; les autres ne
  // font qu'enregistrer leurs heures.
  const [equipe, setEquipe] = useState(null);
  // ⚙️ Réglages de l'entreprise — l'interrupteur « envoi automatique du
  // bon au client » y vit (Paramètres, débrayable par entreprise).
  const configEnt = useEntreprise();
  // ✍️ Cible du défilement « Terminer → signer » (fermeture guidée).
  const refSignature = useRef(null);
  const monCourriel = (session?.user?.email || "").toLowerCase();
  useEffect(() => {
    const id = tache.tacheOrigineId;
    if (!id) return;
    let annule = false;
    // La DATE de la carte accompagne la demande : sur un chantier de
    // plusieurs jours, « terminé » veut dire « a fermé sa carte de
    // CETTE journée » — pas celle d'hier.
    etatEquipeTache(id, tache.date || null)
      .then((e) => { if (!annule) setEquipe(e); })
      .catch(() => {});
    return () => { annule = true; };
    // Recalculé quand la tâche change d'état : un collègue a pu fermer
    // la sienne entre-temps.
  }, [tache.tacheOrigineId, tache.date, tache.etat]);

  // « JE TERMINE SEUL » — le collègue assigné n'est pas venu.
  //
  // Impossible de le deviner : le chronomètre d'un technicien vit sur
  // SON téléphone jusqu'à ce qu'il ferme sa tâche. Ni le bureau ni son
  // collègue ne peuvent distinguer « pas encore commencé » de « ne
  // viendra jamais ». La seule personne qui le sait est celle qui est
  // sur place — c'est donc à elle de le déclarer.
  const [termineSeul, setTermineSeul] = useState(!!tache.termineSeul);

  // « TOUTE L'ÉQUIPE A TERMINÉ » (demande du propriétaire, 2026-08-17).
  // À la fermeture d'une tâche partagée, on pose LA question à l'humain
  // sur place plutôt que de deviner : s'il déclare que tous ont fini,
  // il devient le dernier (signature + bon), et ses coéquipiers
  // recevront la demande de confirmation de leurs heures sur leur
  // téléphone. S'il répond non, comportement habituel.
  const [equipeTerminee, setEquipeTerminee] = useState(!!tache.equipeTerminee);
  // ⚠️ RÉF EN MIROIR de l'état (audit 2026-08-17) : « Oui, on a tous
  // terminé » enchaîne parfois setEquipeTerminee puis envoyer() dans le
  // MÊME rendu (client sans courriels) — envoyer() lisait alors l'état
  // d'AVANT (fermeture périmée) et retombait dans « pas le dernier » :
  // aucun bon créé. La réf, elle, est à jour immédiatement.
  const equipeTermineeRef = useRef(!!tache.equipeTerminee);
  const [modalEquipe, setModalEquipe] = useState(false);
  // 🚪 « JE PARS EN PREMIER DU CHANTIER » (demande du propriétaire,
  // 2026-08-18) : celui qui quitte avant les autres ferme SA carte —
  // heures enregistrées, aucune description/photo/signature exigée
  // (c'est le travail de celui qui reste avec le client).
  const [modalPartirPremier, setModalPartirPremier] = useState(false);
  const [partirEnCours, setPartirEnCours] = useState(false);
  const [partirRefus, setPartirRefus] = useState("");

  const jeSuisSeul = !equipe || !equipe.partage;
  const jeSuisLeDernier =
    jeSuisSeul || termineSeul || equipeTerminee || equipe.manquants.every((m) => m.email === monCourriel);
  const collegues = jeSuisSeul ? [] : equipe.equipe.filter((m) => m.email !== monCourriel);
  const colleguesRestants = jeSuisSeul ? [] : equipe.manquants.filter((m) => m.email !== monCourriel);
  // FERMETURE GUIDÉE (demande du propriétaire, 2026-08-17) : pour une
  // tâche client facturable, le jour où le bon doit se faire (journée
  // unique ou dernière journée du chantier), le « Terminer » du haut ne
  // ferme plus — il descend vers la signature. La SEULE porte de sortie
  // devient le circuit complet → envoi → fermeture automatique.
  // Journées intermédiaires d'un chantier : fermeture directe conservée.
  const fermetureGuidee = !tache.nonFacturable && (Number(tache.nbJoursPrevus || 1) <= 1 || !!tache.dernierJourPrevu);
  // État initialisé depuis `tache` (la source de vérité globale) plutôt
  // que vide : si le technicien avait déjà rempli ce bon puis était
  // revenu à l'accueil (ou si la page a été rafraîchie), ses données
  // réapparaissent au lieu d'être perdues.
  const [clientId, setClientId] = useState(tache.clientId);
  const [adresseId, setAdresseId] = useState(tache.adresseId);
  const [lignes, setLignes] = useState(tache.lignes || []);
  const [notesTerrain, setNotesTerrain] = useState(tache.notesTerrain || "");
  const [notesInternes, setNotesInternes] = useState(tache.notesInternes || "");
  const [ecoute, setEcoute] = useState(null); // "terrain" | "interne" | null
  const [erreurDictee, setErreurDictee] = useState("");
  const [photosAvant, setPhotosAvant] = useState(tache.photosAvant || []);
  const [photosApres, setPhotosApres] = useState(tache.photosApres || []);
  const [nomMoule, setNomMoule] = useState(tache.nomMoule || "");
  // ÉQUIPE DE 2+ : le dernier à fermer peut déclarer que son collègue a
  // DÉJÀ recueilli la signature du client — la sienne n'est plus exigée
  // et le bon part UNE seule fois (demande du propriétaire, 2026-08-16).
  const [collegueAFaitSigner, setCollegueAFaitSigner] = useState(!!tache.collegueAFaitSigner);
  const [aSignature, setASignature] = useState(!!tache.aSignature);
  // Acceptation des termes et conditions — verrouille la signature tant
  // qu'elle n'est pas cochée. Considérée acquise si le bon est déjà signé.
  const [accepteConditions, setAccepteConditions] = useState(!!tache.accepteConditions || !!tache.aSignature);
  // CLIENT ABSENT à la fin des travaux (clause 10 des conditions) : la
  // case remplace la signature — les travaux sont réputés reçus, et la
  // mention suit le bon jusqu'à la facturation au bureau.
  const [clientAbsent, setClientAbsent] = useState(!!tache.clientAbsent);
  const [modaleConditions, setModaleConditions] = useState(false);
  // Fenêtre « Voir le devis » — contenu du devis lié SANS prix ni totaux.
  const [modaleDevis, setModaleDevis] = useState(false);
  const accepterConditions = () => {
    setAccepteConditions(true);
    onMajTache(tache.id, { accepteConditions: true });
    setModaleConditions(false);
  };
  // 2e signature client — exigée seulement quand un EMPLOYÉ modifie un
  // bon déjà fermé (voir necessiteDeuxiemeSignature plus bas). Repart
  // toujours à vide : chaque modification doit être revalidée par le
  // client, on ne réutilise pas une signature précédente.
  const [nomMoule2, setNomMoule2] = useState("");
  const [aSignature2, setASignature2] = useState(false);
  // `tache.envoye` est persistant (survit à la navigation/au refresh) —
  // mais l'écran de confirmation, lui, ne doit s'afficher qu'une fois,
  // juste après avoir cliqué "Terminer et envoyer" CETTE session-ci.
  // En rouvrant un bon déjà envoyé plus tard, on retombe directement
  // sur le formulaire (modifiable), pas sur l'écran de confirmation —
  // c'est ce qui permet d'ajouter une note ou une photo après coup.
  const [montrerConfirmation, setMontrerConfirmation] = useState(false);
  const canvasRef = useRef(null);
  const canvasRef2 = useRef(null);
  const recoRef = useRef(null); // instance SpeechRecognition active, pour éviter les doublons

  // ------------------------------------------------------------
  // PERMISSIONS DE MODIFICATION APRÈS FERMETURE
  // - Un administrateur peut toujours modifier.
  // - Un employé peut modifier dans les 10 minutes suivant l'envoi
  //   (ou si un admin a réactivé la modification pour cette tâche),
  //   mais doit alors faire revalider le changement par une 2e
  //   signature client.
  // - Passé ce délai (et sans réactivation), l'employé n'a plus qu'un
  //   accès visuel — lecture seule.
  // ------------------------------------------------------------
  const DELAI_MODIFICATION_MS = 10 * 60 * 1000;
  const fermee = !!tache.envoye;
  const dansDelai = fermee && tache.envoyeA && Date.now() - tache.envoyeA <= DELAI_MODIFICATION_MS;
  const modifReactivee = !!tache.modifReactivee;
  const modifAutorisee = role === "admin" || !fermee || dansDelai || modifReactivee;
  const necessiteDeuxiemeSignature = role !== "admin" && fermee && (dansDelai || modifReactivee);
  const lectureSeule = fermee && !modifAutorisee;

  const forceRevision = lignes.some((l) => l.prixNonListe);
  const statutBon = forceRevision ? "En attente de révision de prix" : "Prêt à envoyer";
  const total = lignes.reduce((s, l) => s + l.prix_vendant * l.quantite, 0);

  // Description + photo après-travaux obligatoires avant fermeture —
  // seule la photo "après" est exigée pour ce type de bon (pas
  // "avant", qui reste facultative).
  const descriptionManquante = notesTerrain.trim().length === 0;
  const photoApresManquante = photosApres.length === 0;
  // SIGNATURE DU CLIENT : exigée UNIQUEMENT du dernier à fermer.
  // Un technicien qui part avant ses collègues enregistre ses heures et
  // s'en va — c'est celui qui finit avec le client qui fait signer.
  // CLIENT ABSENT (clause 10) : coché = la signature n'est plus exigée.
  const peutEnvoyerBase =
    !descriptionManquante &&
    !photoApresManquante &&
    (jeSuisLeDernier
      ? clientAbsent || collegueAFaitSigner || (nomMoule.trim().length > 2 && aSignature && accepteConditions)
      : true);
  const peutEnvoyer =
    !lectureSeule &&
    peutEnvoyerBase &&
    (!necessiteDeuxiemeSignature || clientAbsent || collegueAFaitSigner || (nomMoule2.trim().length > 2 && aSignature2));

  // ------------------------------------------------------------
  // ACTIONS DIRECTES → synchronisées immédiatement vers l'état
  // global (onMajTache), pas via un useEffect qui tournerait à
  // chaque rendu.
  // ------------------------------------------------------------
  const ajouterProduit = (produit) => {
    const nouvelles = [...lignes, { ...produit, uid: `${produit.id}-${Date.now()}`, quantite: 1, prixNonListe: false }];
    setLignes(nouvelles);
    onMajTache(tache.id, { lignes: nouvelles });
  };

  const ajouterHorsCatalogue = () => {
    const nouvelles = [
      ...lignes,
      { uid: `custom-${Date.now()}`, nom: "", prix_vendant: 0, quantite: 1, prixNonListe: true, horsCatalogue: true },
    ];
    setLignes(nouvelles);
    onMajTache(tache.id, { lignes: nouvelles });
  };

  const majLigne = (uid, nouvelle) => {
    // Frappe/valeur en cours d'édition : mise à jour locale seulement,
    // pour un rendu instantané. La synchronisation globale se fait au
    // blur (voir onBlur sur le conteneur des lignes plus bas).
    setLignes((prev) => prev.map((l) => (l.uid === uid ? nouvelle : l)));
  };

  const supprimerLigne = (uid) => {
    const nouvelles = lignes.filter((l) => l.uid !== uid);
    setLignes(nouvelles);
    onMajTache(tache.id, { lignes: nouvelles });
  };

  // Commet les lignes vers l'état global quand le focus quitte la zone
  // (un seul écouteur, les événements blur des champs imbriqués
  // remontent jusqu'ici grâce à la délégation React).
  const commettreLignes = () => onMajTache(tache.id, { lignes });

  const changerClient = (id) => {
    setClientId(id);
    onMajTache(tache.id, { clientId: id });
  };
  const changerAdresse = (id) => {
    setAdresseId(id);
    onMajTache(tache.id, { adresseId: id });
  };

  const commettrePhotos = (champ, nouvelles) => onMajTache(tache.id, { [champ]: nouvelles });

  const commettreNotesTerrain = () => onMajTache(tache.id, { notesTerrain });
  const commettreNotesInternes = () => onMajTache(tache.id, { notesInternes });
  const commettreNomMoule = () => onMajTache(tache.id, { nomMoule });

  const marquerSignature = () => {
    // Ne s'exécute qu'une fois, au premier trait (transition
    // false → true), pas à chaque pixel dessiné.
    setASignature(true);
    onMajTache(tache.id, { aSignature: true });
  };

  const effacerSignature = () => {
    setASignature(false);
    onMajTache(tache.id, { aSignature: false });
  };

  // ------------------------------------------------------------
  // DICTÉE VOCALE — corrige le bug de répétition en boucle : un
  // clic pendant que l'écoute est déjà active BASCULE (arrête)
  // l'instance en cours au lieu d'en démarrer une deuxième en
  // parallèle (c'était ça qui causait le texte dupliqué/répété,
  // puisque deux instances envoyaient chacune leurs propres
  // événements onresult vers le même champ).
  // ------------------------------------------------------------
  const basculerDicteeVocale = async (cible) => {
    if (recoRef.current) {
      recoRef.current.stop();
      recoRef.current = null;
      setEcoute(null);
      return;
    }

    const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Reconnaissance) {
      setErreurDictee("La dictée vocale n'est pas prise en charge sur cet appareil.");
      return;
    }
    setErreurDictee("");

    // Demande explicite d'accès au microphone AVANT de démarrer la
    // reconnaissance vocale — plutôt que de laisser SpeechRecognition
    // déclencher la permission silencieusement et échouer sans
    // explication claire si elle est refusée. On arrête tout de suite
    // le flux audio de test : seule la permission nous intéresse ici,
    // SpeechRecognition gère son propre accès au micro ensuite.
    if (navigator.mediaDevices?.getUserMedia) {
      setEcoute(`${cible}-demande`);
      try {
        const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        flux.getTracks().forEach((piste) => piste.stop());
      } catch {
        setEcoute(null);
        setErreurDictee("Accès au microphone refusé — active la permission dans les réglages de ton téléphone pour dicter une note.");
        return;
      }
    }

    const reco = new Reconnaissance();
    reco.lang = "fr-CA";
    reco.continuous = false;
    reco.interimResults = false;
    reco.onresult = (e) => {
      // Un seul résultat final par session (continuous=false), donc
      // pas de boucle possible ici — le bug venait des instances
      // multiples ci-dessus, pas de ce handler.
      const texte = e.results[e.results.length - 1][0].transcript;
      const setter = cible === "interne" ? setNotesInternes : setNotesTerrain;
      setter((prev) => {
        const nouveau = prev ? `${prev} ${texte}` : texte;
        onMajTache(tache.id, cible === "interne" ? { notesInternes: nouveau } : { notesTerrain: nouveau });
        return nouveau;
      });
    };
    reco.onerror = () => {
      recoRef.current = null;
      setEcoute(null);
      setErreurDictee("Micro indisponible ou permission refusée.");
    };
    reco.onend = () => {
      recoRef.current = null;
      setEcoute(null);
    };
    recoRef.current = reco;
    reco.start();
    setEcoute(cible);
  };

  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  // Choix des courriels du client (CHOIX MULTIPLE) avant l'envoi du bon.
  const courrielsClient = tache.clientCourriels || [];
  const [modalCourriels, setModalCourriels] = useState(false);
  const [courrielsChoisis, setCourrielsChoisis] = useState(() =>
    courrielsClient.filter((c) => c.defaut).map((c) => c.email)
  );
  const basculerCourriel = (email) =>
    setCourrielsChoisis((prev) => (prev.includes(email) ? prev.filter((x) => x !== email) : [...prev, email]));

  // Étape 1 : choisir les destinataires (s'il y a des courriels au dossier).
  const demarrerEnvoi = () => {
    if (courrielsClient.length > 0) {
      setModalCourriels(true);
      return;
    }
    envoyer([]);
  };

  // ---- FERMER LA JOURNÉE (chantier de plusieurs jours) ----
  // Les heures partent, la tâche du jour se ferme, mais le chantier
  // reste OUVERT : ni signature, ni bon de travail, ni facturation.
  const [confirmation, setConfirmation] = useState(null);
  const fermerLaJournee = () => {
    // Dernier jour prévu : sans avertissement, le chantier resterait
    // ouvert indéfiniment et le bureau ne pourrait jamais facturer.
    if (tache.dernierJourPrevu) {
      setConfirmation("dernierJour");
      return;
    }
    onTerminer();
    onRetour();
  };

  // ---- FERMER LES TRAVAUX ----
  // Avertit si des journées restent prévues : un technicien qui clique
  // par habitude le premier soir fermerait le chantier trop tôt, et le
  // bureau facturerait un travail inachevé.
  // LA QUESTION D'ÉQUIPE — avec relecture FRAÎCHE au moment du clic
  // (rapport des techniciens, 2026-08-18 : la composition de l'équipe
  // lue à l'ouverture de la page pouvait avoir échoué en silence —
  // réseau de chantier — et l'application se croyait « seule sur la
  // tâche » : la question n'était jamais posée). TOUTES les portes de
  // fermeture passent maintenant par ici, y compris les confirmations
  // multi-jours qui court-circuitaient la question avant.
  const verifierEquipePuisFermer = async () => {
    let e = equipe;
    try {
      const frais = await etatEquipeTache(tache.tacheOrigineId || tache.id, tache.date || null);
      if (frais) {
        e = frais;
        setEquipe(frais);
      }
    } catch {
      // hors-ligne : on continue avec la lecture faite à l'ouverture
    }
    const restants = !e || !e.partage ? [] : e.manquants.filter((m) => m.email !== monCourriel);
    if (restants.length > 0 && !termineSeul && !equipeTermineeRef.current) {
      setModalEquipe(true);
      return;
    }
    // GARDE (audit 2026-08-18) : les portes multi-jours (« dernier jour
    // prévu », « il reste des jours ») arrivaient ici SANS passer par le
    // bouton principal — un bon pouvait partir sans description, photo
    // ni signature. Si les exigences manquent, on descend au formulaire
    // (la liste des éléments requis s'y affiche) au lieu d'envoyer.
    if (!peutEnvoyer) {
      refSignature.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    demarrerEnvoi();
  };

  const demarrerFermetureTravaux = () => {
    if (tache.nbJoursPrevus > 1 && !tache.dernierJourPrevu) {
      setConfirmation("tropTot");
      return;
    }
    verifierEquipePuisFermer();
  };

  // 🚪 Confirmation du départ en premier. GARDE : relecture fraîche du
  // serveur — si en réalité tous les autres ont DÉJÀ fermé, celui-ci
  // est le dernier et la sortie rapide est refusée (sinon personne ne
  // ferait signer le client). Hors-ligne : on laisse partir — le
  // comportement d'avant, le bureau réactive au besoin.
  const confirmerPartirPremier = async () => {
    setPartirEnCours(true);
    try {
      const frais = await etatEquipeTache(tache.tacheOrigineId || tache.id, tache.date || null);
      if (frais) {
        setEquipe(frais);
        const restants = (frais.manquants || []).filter((m) => m.email !== monCourriel);
        if (!frais.partage || restants.length === 0) {
          setPartirEnCours(false);
          setPartirRefus(
            "Tes coéquipiers ont déjà tous fermé leur tâche : tu es le DERNIER sur ce travail. C'est toi qui fais signer le client — remplis le bon et utilise « Terminer et envoyer »."
          );
          return;
        }
      }
    } catch {
      // hors-ligne : on laisse partir quand même
    }
    signalerDepartPremier(tache.tacheOrigineId || tache.id, tache.date || null).catch(() => {});
    setPartirEnCours(false);
    setModalPartirPremier(false);
    onTerminer();
    onRetour();
  };

  // Réponse à la question d'équipe. « Oui » : je deviens le dernier —
  // signature exigée (on y descend si elle manque), puis le bon part et
  // mes coéquipiers reçoivent la demande de confirmation d'heures.
  // « Non » : j'enregistre seulement ma partie, la tâche continue chez
  // les autres — exactement comme avant.
  const repondreEquipe = (tousTermine) => {
    setModalEquipe(false);
    if (!tousTermine) {
      demarrerEnvoi();
      return;
    }
    setEquipeTerminee(true);
    equipeTermineeRef.current = true;
    onMajTache(tache.id, { equipeTerminee: true });
    const signatureOk =
      clientAbsent || collegueAFaitSigner || (nomMoule.trim().length > 2 && aSignature && accepteConditions);
    // Description et photo « après » restent exigées aussi (la question
    // d'équipe peut maintenant arriver par les portes multi-jours, qui
    // ne passaient pas par le bouton principal — audit 2026-08-18).
    if (signatureOk && !descriptionManquante && !photoApresManquante) demarrerEnvoi();
    else refSignature.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Étape 2 : envoi du bon signé au(x) client(s) + création de la
  // DEMANDE DE FACTURATION pour le bureau.
  const envoyer = async (destinataires) => {
    setModalCourriels(false);
    setEnvoiEnCours(true);
    const heures = dureeEcoulee(tache) / 3600;
    // TÂCHE NON FACTURABLE (visite, divers, congé) : aucune demande de
    // facturation n'est créée. Elle n'apparaîtra jamais dans l'onglet
    // Facturation — il n'y a donc rien à refuser ni à oublier. Les
    // heures, elles, sont enregistrées normalement et payées.
    if (tache.nonFacturable) {
      // 🤝 Même sans facturation, les coéquipiers déclarés « terminés »
      // doivent recevoir leur demande de confirmation d'heures — cet
      // avertissement était sauté par le raccourci (corrigé 2026-08-18).
      if (equipeTermineeRef.current && colleguesRestants.length > 0) {
        declarerEquipeTerminee(tache.tacheOrigineId || tache.id, tache.date || null).catch(() => {});
      }
      setEnvoiEnCours(false);
      onTerminer();
      // Retour au menu des tâches — l'écran restait planté ici (constat
      // des employés) : la tâche était finie mais rien ne bougeait.
      onRetour();
      return;
    }
    // UN SEUL BON DE TRAVAIL PAR TÂCHE : seul le dernier à fermer le
    // crée. Sans ce garde, chaque technicien envoyait le sien — deux
    // demandes de facturation pour un seul contrat, et le client
    // recevait deux bons à signer pour la même job.
    // Les heures de tout le monde, elles, partent quand même (elles
    // sont enregistrées séparément, dans travaux_effectues).
    // La réf (jamais périmée) couvre le cas « Oui, on a tous terminé »
    // suivi d'un envoi immédiat dans le même rendu — voir sa déclaration.
    const dernierEffectif = jeSuisLeDernier || equipeTermineeRef.current;
    if (!dernierEffectif) {
      onTerminer();
      // ------------------------------------------------------------
      // ANTI-COURSE (2026-08-17 — vécu : Dominic et Philippe ferment la
      // même tâche à 170 ms d'écart ; chacun voit l'autre « pas fini »,
      // chacun se croit « pas le dernier », et PERSONNE ne crée le bon —
      // la tâche n'atteint jamais la facturation ni le client).
      // Après avoir enregistré MES heures : on redemande au serveur qui
      // manque VRAIMENT. Si en réalité tous mes collègues ont fini,
      // c'est moi le dernier — je poursuis et crée le bon. Garde
      // anti-doublon : si un coéquipier l'a déjà créé, on s'arrête.
      // ------------------------------------------------------------
      let dernierEnRealite = false;
      try {
        // Petit délai : le temps que les heures du coéquipier (parties
        // en même temps que les miennes) soient visibles côté serveur.
        await new Promise((r) => setTimeout(r, 1500));
        const etatFrais = await etatEquipeTache(tache.tacheOrigineId || tache.id, tache.date || null);
        dernierEnRealite =
          !etatFrais?.partage || (etatFrais.manquants || []).every((m) => m.email === monCourriel);
        if (dernierEnRealite && (await bonExistePourTache(tache.tacheOrigineId || tache.id))) {
          dernierEnRealite = false; // un coéquipier l'a déjà créé — parfait
        }
      } catch {
        dernierEnRealite = false; // hors-ligne : comportement d'avant
      }
      // ⚠️ GARDE-SIGNATURE (audit 2026-08-17) : ce technicien se croyait
      // « pas le dernier », donc l'app ne lui a JAMAIS exigé de faire
      // signer. Sans signature en main, on ne crée PAS le bon officiel
      // ici (il partirait au client non signé — règle gelée violée).
      // On retombe sur le comportement d'avant : le bureau réactive au
      // besoin. La fenêtre « toute l'équipe a terminé ? » reste le
      // chemin normal, elle, avec signature exigée.
      if (
        dernierEnRealite &&
        !(clientAbsent || collegueAFaitSigner || (nomMoule.trim().length > 2 && aSignature && accepteConditions))
      ) {
        dernierEnRealite = false;
      }
      if (!dernierEnRealite) {
        setEnvoiEnCours(false);
        onRetour();
        return;
      }
      // Je suis en réalité le dernier : le code ci-dessous crée le bon,
      // exactement comme si l'app l'avait su du premier coup.
    }
    enregistrerBonTravail(
      {
        tacheId: tache.tacheOrigineId || tache.id,
        titre: tache.titre || tache.clientNom || "Travail complété",
        clientNom: tache.clientNom || null,
        description: notesTerrain || tache.description || "",
        date: tache.date || isoLocal(new Date()),
        heures,
        typeTache: tache.typeTache || null,
        secteur: tache.secteur || "commercial",
        devisNumero: tache.devisNumero || null,
        adresseTravaux: tache.adresseTravaux || null,
        projetId: tache.projetId || null,
        photosAvant: (photosAvant || []).map((p) => p.urlDistante).filter(Boolean),
        photosApres: (photosApres || []).map((p) => p.urlDistante).filter(Boolean),
        courrielsEnvoi: destinataires,
        signeParNom: clientAbsent || collegueAFaitSigner ? "" : nomMoule.trim(),
        signeParCollegue: collegueAFaitSigner,
        // Clause 10 : client absent à la fin des travaux — la mention
        // suit le bon jusqu'à la facturation.
        clientAbsent,
        // Unité vérifiée + pièce manquante — remontent au bureau avec le
        // bon de travail : registre d'équipements du client et alerte
        // pour la personne des achats.
        // Liste des unites verifiees (un immeuble peut en avoir 3).
        unites: (tache.unites || []).filter((u) => (u.modele || "").trim() || (u.serie || "").trim()),
        pieceACommander: !!tache.pieceACommander,
        pieceRequise: tache.pieceRequise || null,
      },
      session
    ).then(async (bonRowId) => {
      // 🤝 FERMETURE D'ÉQUIPE : le bon est créé — on avertit maintenant
      // les coéquipiers qui n'avaient pas fermé. Leur téléphone leur
      // demandera de confirmer (ou d'ajuster) leurs heures. Si l'appel
      // échoue (réseau), rien ne casse : ils fermeront leur tâche
      // eux-mêmes, comme avant — aucune heure n'est inventée.
      if (equipeTermineeRef.current && colleguesRestants.length > 0) {
        declarerEquipeTerminee(tache.tacheOrigineId || tache.id, tache.date || null).catch(() => {});
      }
      // 📸 ENVOI AUTOMATIQUE DU BON AU CLIENT — sur-le-champ (demande du
      // propriétaire, 2026-08-16). Conditions : l'interrupteur est actif
      // (Paramètres) ET le technicien a coché au moins un courriel. En
      // cas d'échec (réseau), rien n'est perdu : la carte du bon au
      // bureau n'affichera PAS « envoyé » et le bouton manuel reste là.
      if (!bonRowId || configEnt?.envoiAutoBonClient === false || (destinataires || []).length === 0) return;
      try {
        // Anti-doublon : si un bon de CETTE tâche a déjà été transmis
        // au client (collègue qui a fermé avant, « je termine seul »
        // suivi du vrai dernier…), on ne renvoie JAMAIS un deuxième
        // courriel. Le bureau garde son bouton pour les cas spéciaux.
        if (await bonDejaEnvoyeAuClient(tache.tacheOrigineId || tache.id)) return;
        const jetonBon = await assurerJetonBon(bonRowId);
        const r = await envoyerCourriel({
          a: destinataires,
          sujet: `Vos travaux sont terminés — bon de travail (${configEnt?.nomCommercial || configEnt?.nomLegal || ""})`,
          html: gabaritBonTravail({
            config: configEnt,
            clientNom: tache.clientNom || "",
            lien: lienBonPublic(jetonBon),
            joursValidite: JOURS_VALIDITE_BON,
          }),
        });
        if (r.envoye) marquerBonEnvoyeClient(bonRowId).catch(() => {});
      } catch {
        // le bureau garde son bouton « Bon au client »
      }
    }).catch(() => {
      // hors-ligne ou table absente — le bon reste complété localement,
      // le bureau ne le voit pas encore (le technicien peut réessayer).
    });
    // Simule le temps d'envoi réseau — en prod, ce délai correspond à
    // l'appel réel vers Supabase / l'API de facturation.
    setTimeout(() => {
      setMontrerConfirmation(true);
      onMajTache(tache.id, {
        envoye: true,
        courrielsEnvoi: destinataires,
        // On (re)fixe l'horodatage à chaque envoi/mise à jour : le délai
        // de 10 minutes redémarre à partir de la dernière fermeture, pas
        // seulement la toute première.
        envoyeA: Date.now(),
        // Une fois la modification revalidée par la 2e signature, la
        // réactivation admin est consommée — il faudra que l'admin la
        // réactive de nouveau pour une prochaine modification hors délai.
        modifReactivee: necessiteDeuxiemeSignature ? false : tache.modifReactivee,
      });
      if (tache.etat !== "complete") onTerminer();
      setEnvoiEnCours(false);
    }, 600);
  };

  // RETOUR AUTOMATIQUE (constat des employés : « la tâche reste
  // ouverte ») : l'écran de confirmation ramène à l'horaire tout seul
  // après 5 secondes. Toucher « Ajouter une note ou une photo »
  // l'annule — le nettoyage de l'effet coupe le minuteur.
  useEffect(() => {
    if (!montrerConfirmation) return;
    const minuteur = setTimeout(() => onRetour(), 5000);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montrerConfirmation]);

  if (montrerConfirmation) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-slate-100 px-6 text-center">
        <div className="rounded-full bg-emerald-100 p-4">
          <CheckCircle2 size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Bon de travail envoyé</h2>
        <p className="text-sm text-slate-500">Statut : {statutBon}</p>
        <p className="text-sm text-slate-500">Temps travaillé : {formatDuree(dureeEcoulee(tache))}</p>
        <Button variant="outline" onClick={() => setMontrerConfirmation(false)} className="mt-4 px-6">
          Ajouter une note ou une photo
        </Button>
        <Button onClick={onRetour} className="px-6">
          Retour à l'horaire
        </Button>
        <p className="text-[11px] text-slate-400">Retour automatique dans quelques secondes…</p>
        <PiedCopyright />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-100">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5">
        <button onClick={onRetour} className="text-slate-500">
          <ChevronLeft size={22} />
        </button>
        <h1 className="flex-1 text-base font-extrabold text-slate-900">Bon de travail</h1>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${enLigne ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${enLigne ? "bg-emerald-500" : "bg-zinc-400"}`} />
          {enLigne ? "En ligne" : "Hors ligne"}
        </span>
      </div>

      {fermee && role === "admin" && (
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={14} />
          Déjà envoyé — accès administrateur : modification illimitée.
        </div>
      )}
      {fermee && role !== "admin" && dansDelai && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
          <Lock size={14} />
          Déjà envoyé — modification encore possible pendant 10 minutes. Une 2e signature client sera demandée.
        </div>
      )}
      {fermee && role !== "admin" && !dansDelai && modifReactivee && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
          <Lock size={14} />
          Modification réactivée par un administrateur. Une 2e signature client sera demandée.
        </div>
      )}
      {lectureSeule && (
        <div className="flex items-center gap-2 bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
          <Lock size={14} />
          Lecture seule — délai de modification (10 min) dépassé. Demande à un administrateur de réactiver la modification au besoin.
        </div>
      )}

      <div className="flex-1 space-y-5 px-4 py-4">
        <PanneauMinutage
          tache={tache}
          onDemarrer={onDemarrer}
          onPause={onPause}
          onReprendre={onReprendre}
          onTerminer={onTerminer}
          tacheBloquante={tacheBloquante}
          inspectionRequise={!inspectionFaite}
          fermetureGuidee={fermetureGuidee}
          onAllerSigner={() => refSignature.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />

        <SelecteurClientAdresse
          clientId={clientId}
          adresseId={adresseId}
          setClientId={changerClient}
          setAdresseId={changerAdresse}
          lectureSeule={lectureSeule}
          clientNomFallback={tache.clientNom || tache.titre}
          clientTelephone={tache.clientTelephone}
        />

        {/* ÉQUIPE SUR CE TRAVAIL — affiché dès l'ouverture, pas au
            moment de fermer : le technicien doit savoir d'avance si la
            signature du client lui revient ou non. */}
        {equipe?.partage && (
          <div className={`rounded-2xl border-2 p-4 ${jeSuisLeDernier ? "border-[#FF6A13] bg-orange-50" : "border-slate-200 bg-white"}`}>
            <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <User size={13} /> Vous êtes {equipe.equipe.length} sur ce travail
            </p>
            <p className="mt-1 text-[12px] text-slate-600">
              Avec toi : {collegues.map((c) => c.nom).join(", ")}
            </p>

            {jeSuisLeDernier ? (
              <>
              <div className="mt-2.5 rounded-xl bg-[#FF6A13] p-3">
                <p className="text-sm font-extrabold text-white">✍️ C&apos;est toi qui fais signer</p>
                <p className="mt-1 text-[12px] leading-snug text-white/90">
                  {termineSeul
                    ? "Tu as déclaré terminer seul."
                    : equipeTerminee
                      ? "Tu as déclaré que toute l'équipe avait terminé."
                      : "Tu es le dernier à fermer ce travail."}{" "}
                  <span className="font-bold">Fais signer le bon de travail au client avant de partir</span> —
                  c&apos;est le seul document qu&apos;il recevra pour cette job.
                </p>
              </div>
              {!clientAbsent ? (
                <label
                  className={`mt-2 flex min-h-[52px] cursor-pointer items-start gap-2.5 rounded-xl border-2 p-3 ${collegueAFaitSigner ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}
                >
                  <input
                    type="checkbox"
                    checked={collegueAFaitSigner}
                    onChange={(e) => {
                      setCollegueAFaitSigner(e.target.checked);
                      onMajTache(tache.id, { collegueAFaitSigner: e.target.checked });
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
                  />
                  <span className="min-w-0 text-[12px] leading-snug text-slate-700">
                    <span className="font-extrabold">✍️ {collegues.map((c) => c.nom).join(", ") || "Mon collègue"} a déjà fait signer le client</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      Ta signature n&apos;est plus exigée et le client ne recevra PAS un deuxième bon — un seul document part pour cette job.
                    </span>
                  </span>
                </label>
              ) : null}
              </>
            ) : (
              <div className="mt-2.5 rounded-xl bg-slate-100 p-3">
                <p className="text-[12px] font-bold text-slate-700">
                  {colleguesRestants.map((c) => c.nom).join(", ")} n&apos;a pas encore fermé sa part
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
                  Si tout va bien, c&apos;est {colleguesRestants.length > 1 ? "eux" : "elle ou lui"} qui fera signer le client
                  en partant. Tu peux fermer tes heures.
                </p>
                {/* SORTIE DE SECOURS — le collègue n'est pas venu.
                    Sans ce bouton, le travail partait SANS signature du
                    client : l'application attendait quelqu'un qui ne
                    viendrait jamais. */}
                <button
                  onClick={() => { setTermineSeul(true); onMajTache(tache.id, { termineSeul: true }); }}
                  className="mt-2 min-h-[44px] w-full rounded-lg border-2 border-[#FF6A13] text-[12px] font-extrabold text-[#FF6A13] active:scale-[0.99]"
                >
                  Je termine seul — {colleguesRestants.map((c) => c.nom).join(", ")} n&apos;est pas venu
                </button>
                <p className="mt-1 text-[10px] leading-snug text-slate-400">
                  À utiliser seulement si tu es certain. Tu deviens alors responsable de faire signer le client, et le
                  bureau en est informé.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ADRESSE DE L'INTERVENTION + NAVIGATION
            ------------------------------------------------------------
            Elle n'était affichée nulle part : le technicien ouvrait sa
            tâche sans savoir où aller. Le bouton lance l'application de
            navigation du téléphone (Plans sur iPhone, Google Maps
            ailleurs) — gros bouton, utilisable avec des gants. */}
        {(tache.adresseIntervention || tache.adresseTravaux) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#FF6A13]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Adresse des travaux</p>
                <p className="mt-0.5 text-sm font-bold leading-snug text-slate-800">
                  {tache.adresseIntervention || tache.adresseTravaux}
                </p>
                {/* 🚪 L'unité en ÉVIDENCE (demande du propriétaire,
                    2026-08-19) — un technicien devant un immeuble doit
                    savoir à quelle porte frapper sans fouiller. */}
                {tache.adresseUnite && (
                  <p className="mt-0.5 text-[13px] font-extrabold text-[#FF6A13]">🚪 App. / local : {tache.adresseUnite}</p>
                )}
                {/* Sur un gros chantier, savoir QUI demander vaut autant
                    que l'adresse elle-même. */}
                {tache.contactSurPlace?.nom && (
                  <p className="mt-1 text-[12px] font-semibold text-[#FF6A13]">
                    👤 Demander {tache.contactSurPlace.nom}
                    {tache.contactSurPlace.role ? ` (${tache.contactSurPlace.role})` : ""}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => ouvrirTrajet(tache.adresseIntervention || tache.adresseTravaux)}
              className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
            >
              <Navigation2 size={16} /> M&apos;y rendre
            </button>
          </div>
        )}

        {/* TÉLÉPHONE — QUI APPELER SUR PLACE
            ------------------------------------------------------------
            Retour de tests du 2026-08-17 : le numéro n'apparaissait
            nulle part sur la fiche du technicien. Et souvent la bonne
            personne n'est PAS le numéro de la fiche client : c'est le
            CONTACT SUR PLACE choisi par le bureau (chargé de projet,
            concierge…). Il s'affiche en premier avec le bouton d'appel ;
            le numéro général du client reste en plan B dessous. Numéro
            en GROS (lisible pour composer d'un autre téléphone), lien
            tel: = composition directe, gros bouton, gants. */}
        {(tache.contactSurPlace?.telephone || tache.clientTelephone) && (() => {
          const contact = tache.contactSurPlace?.telephone ? tache.contactSurPlace : null;
          const numeroPrincipal = contact ? contact.telephone : tache.clientTelephone;
          const nomPrincipal = contact
            ? `${contact.nom}${contact.role ? ` — ${contact.role}` : ""}`
            : tache.clientNom || "";
          const planB = contact && tache.clientTelephone && tache.clientTelephone !== contact.telephone;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-2">
                <Phone size={16} className="mt-0.5 shrink-0 text-[#FF6A13]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {contact ? "Contact sur place" : "Téléphone du client"}
                  </p>
                  {nomPrincipal && <p className="mt-0.5 text-sm font-bold leading-snug text-slate-800">{nomPrincipal}</p>}
                  <p className="text-lg font-extrabold tabular-nums tracking-wide text-slate-900">{numeroPrincipal}</p>
                </div>
              </div>
              <a
                href={`tel:${String(numeroPrincipal).replace(/[^+0-9]/g, "")}`}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
              >
                <Phone size={16} /> {contact ? "Appeler le contact sur place" : "Appeler le client"}
              </a>
              {planB && (
                <a
                  href={`tel:${String(tache.clientTelephone).replace(/[^+0-9]/g, "")}`}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 text-[13px] font-bold text-slate-600 active:scale-[0.99]"
                >
                  <Phone size={14} /> {tache.clientNom || "Client"} — {tache.clientTelephone}
                </a>
              )}
            </div>
          );
        })()}

        {/* DEVIS LIÉ — le numéro est cliquable et ouvre la fenêtre de
            consultation (items et quantités SEULEMENT, jamais de prix). */}
        {tache.devisNumero && (
          <button
            onClick={() => setModaleDevis(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-purple-200 bg-purple-50 p-4 text-left active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <FileText size={16} className="shrink-0 text-purple-600" />
              <span>
                <span className="block text-xs font-bold uppercase tracking-wide text-purple-700">Devis lié aux travaux</span>
                <span className="block text-sm font-extrabold text-purple-900">Devis #{tache.devisNumero}</span>
              </span>
            </span>
            <span className="rounded-full bg-purple-600 px-3 py-1 text-[11px] font-bold text-white">Voir le devis</span>
          </button>
        )}

        {/* DESCRIPTION DES TRAVAUX — rédigée par l'administration */}
        {tache.description && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">
              <FileText size={13} /> Description des travaux — par l'administration
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-blue-900">{tache.description}</p>
          </div>
        )}

        {/* 📎 DOCUMENTS DU BUREAU — photos du site et plans joints à la
            création de la tâche. Un tap ouvre l'image ou le PDF plein
            écran dans le navigateur : l'information est dans la poche,
            plus besoin d'appeler pour « c'est où déjà ? ». */}
        {(tache.piecesJointes || []).length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              📎 Documents du bureau ({tache.piecesJointes.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {tache.piecesJointes.map((pj) => (
                <a
                  key={pj.url}
                  href={pj.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-slate-200 active:scale-[0.98]"
                >
                  {pj.type === "image" ? (
                    <img src={pj.url} alt={pj.nom} loading="lazy" decoding="async" className="h-20 w-full object-cover" />
                  ) : (
                    <span className="flex h-20 flex-col items-center justify-center gap-1 bg-slate-50 px-1">
                      <span className="text-2xl">📄</span>
                      <span className="w-full truncate text-center text-[9px] font-bold text-slate-500">{pj.nom}</span>
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* FENÊTRE — CONTENU DU DEVIS (SANS PRIX). Les montants ne sont
            jamais transmis à l'app technicien : seuls le nom, la quantité
            et l'unité de chaque item arrivent jusqu'ici. */}
        {modaleDevis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setModaleDevis(false))(); }}>
            <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Devis #{tache.devisNumero}</h3>
                  <p className="text-[11px] text-slate-500">Items et quantités — les prix sont gérés par l'administration.</p>
                </div>
                <button onClick={() => setModaleDevis(false)} aria-label="Fermer">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              {(tache.devisLignes || []).length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {tache.devisLignes.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <p className="text-sm font-semibold text-slate-800">{l.nom}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-slate-600">
                        {l.quantite} {l.unite || ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {tache.description || "Le détail de ce devis n'a pas été transmis avec la tâche — demande à l'administration de la réassigner."}
                </p>
              )}
              <button
                onClick={() => setModaleDevis(false)}
                className="mt-4 min-h-[48px] w-full rounded-xl bg-[#131B2E] py-3 text-sm font-bold text-white active:scale-[0.99]"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Les détails de facturation (temps facturable de l'appel de
            service, dépôt perçu) restent CÔTÉ ADMIN uniquement — le
            technicien n'a pas besoin de ces informations sur le terrain. */}

        {/* PRODUITS */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Produits / services
            </label>
          </div>

          <div className="space-y-2" onBlur={commettreLignes}>
            {lignes.map((l) => (
              <LigneProduit
                key={l.uid}
                ligne={l}
                onChange={(n) => majLigne(l.uid, n)}
                onSupprimer={() => supprimerLigne(l.uid)}
                lectureSeule={lectureSeule}
              />
            ))}
          </div>

          {!lectureSeule && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="relative">
                <select
                  onChange={(e) => {
                    const produit = PRODUITS_CATALOGUE.find((p) => p.id === e.target.value);
                    if (produit) ajouterProduit(produit);
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-8 text-xs font-bold text-slate-700"
                >
                  <option value="" disabled>
                    + Ajouter du catalogue
                  </option>
                  {PRODUITS_CATALOGUE.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} — {p.prix_vendant.toFixed(2)} $
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              </div>
              <Button variant="outline" onClick={ajouterHorsCatalogue} className="min-h-0 py-2.5 text-xs">
                <Plus size={14} /> Item hors catalogue
              </Button>
            </div>
          )}

          {lignes.length > 0 && (
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{total.toFixed(2)} $</span>
            </div>
          )}

          {forceRevision && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-xs font-semibold text-[#B14E0E]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Un item à prix non listé a été ajouté. Ce bon sera marqué
              « En attente de révision de prix » à l'envoi.
            </div>
          )}
        </div>

        {/* ============================================================
            L'UNITÉ + LA PIÈCE À COMMANDER
            ------------------------------------------------------------
            Modèle et numéro de série sont demandés à CHAQUE appel de
            service. Ils construisent tout seuls le registre des
            équipements du client : dans deux ans, on saura ce qu'il a
            sans avoir à redemander. La case « aucun numéro » évite de
            bloquer le technicien devant une plaque illisible.
            ============================================================ */}
        {!lectureSeule && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Unité vérifiée</p>

            <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5">
              <input
                type="checkbox"
                checked={!!tache.aucunNumero}
                onChange={(e) => onMajTache(tache.id, { aucunNumero: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#131B2E]"
              />
              <span className="text-[13px] leading-snug text-slate-600">
                Aucun numéro à prendre, ou déjà pris
              </span>
            </label>

            {/* PLUSIEURS UNITÉS — un immeuble peut avoir trois rooftops,
                une résidence une thermopompe et un échangeur d'air. Un
                seul champ obligeait à tout écraser dans une case. */}
            {!tache.aucunNumero && (
              <div className="space-y-2">
                {(tache.unites && tache.unites.length > 0 ? tache.unites : [{ modele: "", serie: "" }]).map((u, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                        Unité {i + 1}
                      </span>
                      {(tache.unites || []).length > 1 && (
                        <button
                          onClick={() => onMajTache(tache.id, { unites: tache.unites.filter((_, j) => j !== i) })}
                          className="text-[11px] font-bold text-slate-400"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={u.modele || ""}
                        onChange={(e) => {
                          const liste = [...(tache.unites && tache.unites.length > 0 ? tache.unites : [{ modele: "", serie: "" }])];
                          liste[i] = { ...liste[i], modele: e.target.value };
                          onMajTache(tache.id, { unites: liste });
                        }}
                        placeholder="Modèle"
                        className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                      />
                      <input
                        value={u.serie || ""}
                        onChange={(e) => {
                          const liste = [...(tache.unites && tache.unites.length > 0 ? tache.unites : [{ modele: "", serie: "" }])];
                          liste[i] = { ...liste[i], serie: e.target.value };
                          onMajTache(tache.id, { unites: liste });
                        }}
                        placeholder="Nº de série"
                        className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    onMajTache(tache.id, {
                      unites: [...(tache.unites && tache.unites.length > 0 ? tache.unites : [{ modele: "", serie: "" }]), { modele: "", serie: "" }],
                    })
                  }
                  className="min-h-[44px] w-full rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500 active:scale-[0.99]"
                >
                  + Ajouter une unité
                </button>
              </div>
            )}

            {/* PIÈCE À COMMANDER — la réparation attend, mais la visite
                de diagnostic se facture normalement. Une 2e tâche sera
                créée au bureau, bloquée jusqu'à réception de la pièce. */}
            <label className="flex items-start gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <input
                type="checkbox"
                checked={!!tache.pieceACommander}
                onChange={(e) => onMajTache(tache.id, { pieceACommander: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A13]"
              />
              <span className="text-[13px] font-bold leading-snug text-amber-900">
                🔧 Pièce à commander — je ne peux pas terminer la réparation aujourd&apos;hui
              </span>
            </label>

            {tache.pieceACommander && (
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">Pièce requise</label>
                <textarea
                  rows={2}
                  value={tache.pieceRequise || ""}
                  onChange={(e) => onMajTache(tache.id, { pieceRequise: e.target.value })}
                  placeholder="Ex. : carte de contrôle, moteur de ventilateur…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] leading-snug text-amber-700">
                  Le bureau sera alerté pour commander. Une 2e visite sera planifiée dès la réception de la pièce.
                </p>
              </div>
            )}
          </div>
        )}

        {/* PHOTOS */}
        <div className="grid grid-cols-2 gap-3">
          <ZonePhoto
            titre="Photos avant"
            photos={photosAvant}
            setPhotos={setPhotosAvant}
            onPhotosChange={(nouvelles) => commettrePhotos("photosAvant", nouvelles)}
            lectureSeule={lectureSeule}
          />
          <ZonePhoto
            titre="Photos après"
            photos={photosApres}
            setPhotos={setPhotosApres}
            onPhotosChange={(nouvelles) => commettrePhotos("photosApres", nouvelles)}
            obligatoire
            lectureSeule={lectureSeule}
          />
        </div>

        {/* NOTES */}
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                Notes de terrain
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-emerald-700">
                  Visible au client
                </span>
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-red-600">
                  Obligatoire
                </span>
              </label>
              {!lectureSeule && (
                <button
                  onClick={() => basculerDicteeVocale("terrain")}
                  disabled={ecoute === "terrain-demande"}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
                    ecoute === "terrain" ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {ecoute === "terrain-demande" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : ecoute === "terrain" ? (
                    <MicOff size={14} />
                  ) : (
                    <Mic size={14} />
                  )}
                  {ecoute === "terrain-demande" ? "Autorisation..." : ecoute === "terrain" ? "Écoute..." : "Dicter"}
                </button>
              )}
            </div>
            <textarea
              value={notesTerrain}
              onChange={(e) => setNotesTerrain(e.target.value)}
              onBlur={commettreNotesTerrain}
              disabled={lectureSeule}
              rows={3}
              placeholder="Observations, travaux effectués, recommandations..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                Notes internes
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-slate-600">
                  Non visible au client
                </span>
              </label>
              {!lectureSeule && (
                <button
                  onClick={() => basculerDicteeVocale("interne")}
                  disabled={ecoute === "interne-demande"}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
                    ecoute === "interne" ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {ecoute === "interne-demande" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : ecoute === "interne" ? (
                    <MicOff size={14} />
                  ) : (
                    <Mic size={14} />
                  )}
                  {ecoute === "interne-demande" ? "Autorisation..." : ecoute === "interne" ? "Écoute..." : "Dicter"}
                </button>
              )}
            </div>
            <textarea
              value={notesInternes}
              onChange={(e) => setNotesInternes(e.target.value)}
              onBlur={commettreNotesInternes}
              disabled={lectureSeule}
              rows={3}
              placeholder="Notes pour l'équipe seulement (accès difficile, comportement client, à surveiller...)"
              className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          {erreurDictee && <p className="text-[11px] text-red-500">{erreurDictee}</p>}
        </div>

        {/* TERMES ET CONDITIONS + SIGNATURE — seulement pour celui qui
            ferme en DERNIER. Les autres n'ont pas à faire signer : un
            seul bon de travail existe par job, et le client ne doit
            signer qu'une fois. */}
        {/* EN CAS DE DOUTE, ON DEMANDE LA SIGNATURE.
            Le bloc reste TOUJOURS visible — il est seulement facultatif
            quand un collègue doit fermer après. Une signature de trop ne
            fait de tort à personne ; un travail livré sans signature,
            oui. C'est ce déséquilibre qui décide de la règle. */}
        {!jeSuisLeDernier && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[12px] leading-snug text-slate-600">
              <span className="font-bold text-slate-700">Signature facultative pour toi</span> —{" "}
              {colleguesRestants.map((c) => c.nom).join(", ")} doit fermer après toi. Si le client est devant toi et
              que le travail est fini, tu peux quand même la faire signer : ça ne nuit jamais.
            </p>
          </div>
        )}
        <div ref={refSignature} className="rounded-2xl border border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={() => setModaleConditions(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700 active:bg-slate-100"
          >
            <FileText size={16} /> Consulter les termes et conditions générales
          </button>
          <label className="mt-3 flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={accepteConditions}
              onChange={(e) => {
                setAccepteConditions(e.target.checked);
                onMajTache(tache.id, { accepteConditions: e.target.checked });
              }}
              disabled={lectureSeule}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#131B2E]"
            />
            <span className="text-sm text-slate-700">
              J'ai lu et j'accepte les termes et conditions générales de Ventilation DGL inc. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {/* CLIENT ABSENT — clause 10 des conditions. La case remplace la
            signature : le bouton d'envoi se débloque, la mention part au
            bureau avec le bon et s'affiche en facturation. Les photos
            « après » (déjà obligatoires) deviennent la preuve terrain. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={clientAbsent}
              onChange={(e) => {
                setClientAbsent(e.target.checked);
                onMajTache(tache.id, { clientAbsent: e.target.checked });
              }}
              disabled={lectureSeule}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#131B2E]"
            />
            <span className="text-sm text-slate-700">
              <span className="font-bold">Le client n&apos;était pas sur place à la fin des travaux</span> — impossible
              de faire signer le bon.
            </span>
          </label>
          {clientAbsent && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800">
              La signature n&apos;est plus exigée : selon la clause 10 des conditions, les travaux sont
              réputés reçus tels qu&apos;exécutés. La mention sera inscrite au dossier et visible au bureau.
              Assure-toi que tes photos « après » montrent bien le travail terminé — c&apos;est ta preuve.
            </p>
          )}
        </div>

        {/* SIGNATURE */}
        <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${clientAbsent ? "opacity-50" : ""}`}>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Nom en lettres moulées {clientAbsent ? "(client absent)" : "*"}
          </label>
          <input
            type="text"
            value={nomMoule}
            onChange={(e) => setNomMoule(e.target.value)}
            onBlur={commettreNomMoule}
            disabled={lectureSeule || !accepteConditions || clientAbsent}
            placeholder="Ex: JEAN TREMBLAY"
            className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold uppercase tracking-wide disabled:bg-slate-100 disabled:text-slate-500"
          />
          {!accepteConditions && !lectureSeule && !clientAbsent && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              <Lock size={13} className="shrink-0" /> Accepte les termes et conditions ci-dessus pour débloquer la signature.
            </p>
          )}
          <ZoneSignature
            aSignature={aSignature}
            setASignature={setASignature}
            canvasRef={canvasRef}
            onSignatureCommencee={marquerSignature}
            onSignatureEffacee={effacerSignature}
            lectureSeule={lectureSeule || !accepteConditions || clientAbsent}
          />
        </div>

        {/* MODALE — TERMES ET CONDITIONS */}
        {/* CONFIRMATIONS DES DEUX FERMETURES — symétriques, parce qu'on
            peut se tromper dans les deux sens. */}
        {confirmation === "tropTot" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5">
              <p className="text-base font-extrabold text-slate-900">⚠️ Il reste des jours prévus</p>
              <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                Ce chantier est prévu sur <span className="font-bold">{tache.nbJoursPrevus} jours</span> et tu es au
                jour {tache.jourNumero}. Fermer les travaux maintenant fait signer le client et envoie le bon au bureau
                pour facturation.
              </p>
              <p className="mt-2 text-[13px] font-bold text-slate-800">Les travaux sont-ils vraiment terminés ?</p>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => { setConfirmation(null); verifierEquipePuisFermer(); }}
                  className="min-h-[48px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
                >
                  Oui, les travaux sont terminés
                </button>
                <button
                  onClick={() => setConfirmation(null)}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 text-sm font-bold text-slate-600 active:scale-[0.99]"
                >
                  Non, je reviens demain
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmation === "dernierJour" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5">
              <p className="text-base font-extrabold text-slate-900">C&apos;est le dernier jour prévu</p>
              <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                Si les travaux sont finis, ferme-les : sans ça, le bureau ne pourra pas facturer et le chantier restera
                ouvert.
              </p>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => { setConfirmation(null); verifierEquipePuisFermer(); }}
                  className="min-h-[48px] w-full rounded-xl bg-[#FF6A13] text-sm font-extrabold text-white active:scale-[0.99]"
                >
                  ✓ Les travaux sont terminés
                </button>
                {/* PAS DE JOURNÉE SUPPLÉMENTAIRE EN AUTONOMIE : le
                    technicien ne connaît pas les contraintes d'horaire
                    du bureau — on ne peut pas nécessairement revenir
                    demain, et lui ne peut pas le savoir. */}
                <button
                  onClick={() => { setConfirmation(null); onTerminer(); onRetour(); }}
                  className="min-h-[48px] w-full rounded-xl border-2 border-amber-400 bg-amber-50 text-sm font-bold text-amber-800 active:scale-[0.99]"
                >
                  📞 Pas fini — j&apos;appelle le bureau
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                Aucune journée ne se rajoute toute seule : c&apos;est le bureau qui décide de la suite de l&apos;horaire.
              </p>
            </div>
          </div>
        )}

        {modaleConditions && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            onClick={() => setModaleConditions(false)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-extrabold text-slate-900">Termes et conditions générales</h3>
                <button onClick={() => setModaleConditions(false)} aria-label="Fermer">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2" style={{ maxHeight: "80vh" }}>
                <TermesConditions />
              </div>
              <div className="shrink-0 border-t border-slate-200 p-3">
                <Button onClick={accepterConditions} className="w-full">
                  J'ai lu et j'accepte
                </Button>
              </div>
            </div>
          </div>
        )}

        {necessiteDeuxiemeSignature && !lectureSeule && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
              <Lock size={13} /> 2e signature client — validation de la modification
            </p>
            <p className="mb-3 text-xs text-amber-700">
              Ce bon a déjà été fermé. Le client doit revalider la modification pour qu'elle soit envoyée.
            </p>
            <input
              type="text"
              value={nomMoule2}
              onChange={(e) => setNomMoule2(e.target.value)}
              placeholder="Ex: JEAN TREMBLAY"
              className="mb-4 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm font-bold uppercase tracking-wide"
            />
            <ZoneSignature
              aSignature={aSignature2}
              setASignature={setASignature2}
              canvasRef={canvasRef2}
              libelle="2e signature *"
            />
          </div>
        )}
      </div>

      {/* BARRE D'ACTION FIXE */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">
        {lectureSeule ? (
          <p className="text-center text-xs font-semibold text-slate-400">
            Consultation seulement — envoi désactivé.
          </p>
        ) : (
          <>
            {!peutEnvoyer && (
              <ul className="mb-2 space-y-0.5 text-center text-[11px] font-semibold text-slate-400">
                {descriptionManquante && <li>La description (notes de terrain) est requise.</li>}
                {photoApresManquante && <li>Au moins une photo « après travaux » est requise.</li>}
                {(nomMoule.trim().length <= 2 || !aSignature) && <li>Le nom en lettres moulées et la signature sont requis.</li>}
                {necessiteDeuxiemeSignature && (nomMoule2.trim().length <= 2 || !aSignature2) && (
                  <li>La 2e signature client est requise pour valider la modification.</li>
                )}
              </ul>
            )}
            {/* ============================================================
                DEUX FERMETURES DIFFÉRENTES
                ------------------------------------------------------------
                « Ma journée est finie » et « les travaux sont finis » ne
                sont pas la même chose. L'application les confondait : sur
                un chantier de 3 jours, chaque soir aurait produit un bon
                de travail, une signature du client et une demande de
                facturation. Trois fois pour une seule job.
                ============================================================ */}
            {/* 🚪 JE PARS EN PREMIER — visible seulement quand des
                coéquipiers restent sur place : ferme MA carte (heures)
                sans exiger le bon — description, photo et signature
                restent au dernier, qui est averti sur son téléphone. */}
            {!jeSuisSeul && colleguesRestants.length > 0 && !termineSeul && !equipeTerminee && !tache.envoye && !lectureSeule && (
              <button
                onClick={() => { setPartirRefus(""); setModalPartirPremier(true); }}
                className="mb-2 min-h-[52px] w-full rounded-xl border-2 border-sky-300 bg-sky-50 text-sm font-extrabold text-sky-800 active:scale-[0.99]"
              >
                🚪 Je pars en premier — {colleguesRestants.map((c) => c.nom).join(", ")} fera signer le client
              </button>
            )}
            {tache.nbJoursPrevus > 1 && (
              <button
                onClick={fermerLaJournee}
                className="mb-2 min-h-[52px] w-full rounded-xl border-2 border-slate-300 text-sm font-extrabold text-slate-700 active:scale-[0.99]"
              >
                Terminer ma journée — je reviens demain
              </button>
            )}
            <Button disabled={!peutEnvoyer} loading={envoiEnCours} onClick={demarrerFermetureTravaux} className="w-full tracking-wide">
              {tache.envoye ? "METTRE À JOUR L'ENVOI" : tache.nbJoursPrevus > 1 ? "✓ TRAVAUX TERMINÉS" : "TERMINER ET ENVOYER"}
            </Button>
            {tache.nbJoursPrevus > 1 && (
              <p className="mt-1.5 text-center text-[11px] leading-snug text-slate-400">
                Jour {tache.jourNumero} sur {tache.nbJoursPrevus}. « Travaux terminés » fait signer le client et envoie
                le bon — une seule fois pour tout le chantier.
              </p>
            )}
          </>
        )}
      </div>

      {/* CHOIX DES DESTINATAIRES — le bon signé (avec photos) part au(x)
          courriel(s) cochés du client, puis la demande de facturation
          est créée pour le bureau. */}
      {modalCourriels && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setModalCourriels(false))(); }}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-slate-900">📧 Envoyer le bon au client</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Coche une ou plusieurs adresses — le client reçoit tout de suite le détail des travaux, avec les photos.
            </p>
            <div className="mt-3 space-y-2">
              {courrielsClient.map((c) => (
                <label
                  key={c.email}
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                    courrielsChoisis.includes(c.email) ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={courrielsChoisis.includes(c.email)}
                    onChange={() => basculerCourriel(c.email)}
                    className="h-5 w-5 shrink-0 accent-[#FF6A13]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{c.email}</span>
                    <span className="block text-[11px] text-slate-500">{c.label}{c.defaut ? " · défaut" : ""}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <Button onClick={() => envoyer(courrielsChoisis)} disabled={courrielsChoisis.length === 0} className="w-full">
                Envoyer le bon{courrielsChoisis.length > 1 ? ` (${courrielsChoisis.length} adresses)` : ""}
              </Button>
              <Button variant="outline" onClick={() => envoyer([])} className="w-full">
                Terminer sans envoyer de courriel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FENÊTRE — « JE PARS EN PREMIER DU CHANTIER » (2026-08-18).
          Confirmation avant de fermer SA carte sans bon : les heures
          partent, le coéquipier restant fait signer et il est averti
          par notification. Refusée si tous les autres ont déjà fermé. */}
      {modalPartirPremier && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h3 className="text-base font-extrabold text-slate-900">🚪 Tu pars en premier du chantier ?</h3>
            {partirRefus ? (
              <>
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-800">⚠️ {partirRefus}</p>
                <button
                  onClick={() => setModalPartirPremier(false)}
                  className="mt-3 min-h-[48px] w-full rounded-xl bg-[#FF6A13] text-sm font-extrabold text-white active:scale-[0.99]"
                >
                  Compris
                </button>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                  Tes <span className="font-extrabold">{(dureeEcoulee(tache) / 3600).toFixed(2)} h</span> partent au bureau et ta
                  carte se ferme — sans description, photo ni signature.{" "}
                  <span className="font-bold">{colleguesRestants.map((c) => c.nom).join(", ")}</span> reste sur place : c&apos;est
                  lui qui remplit le bon, fait signer le client et l&apos;envoie. Il reçoit l&apos;avis sur son téléphone.
                </p>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={confirmerPartirPremier}
                    disabled={partirEnCours}
                    className="min-h-[52px] w-full rounded-xl bg-sky-600 px-3 text-sm font-extrabold text-white active:scale-[0.99] disabled:opacity-60"
                  >
                    {partirEnCours ? "Un instant…" : "✅ Oui, je pars — fermer ma carte"}
                  </button>
                  <button
                    onClick={() => setModalPartirPremier(false)}
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 px-3 text-sm font-extrabold text-slate-700 active:scale-[0.99]"
                  >
                    Non, je reste
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* FENÊTRE — « EST-CE QUE TOUTE L'ÉQUIPE A TERMINÉ ? »
          (2026-08-17). Posée au moment de fermer une tâche partagée
          quand des coéquipiers n'ont pas encore fermé la leur. « Oui » :
          je fais signer, le bon part UNE fois, et chaque coéquipier
          reçoit la demande de confirmation de ses heures sur son
          téléphone. « Non » : j'enregistre ma partie seulement. */}
      {modalEquipe && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h3 className="text-base font-extrabold text-slate-900">🤝 Est-ce que toute l&apos;équipe a terminé ?</h3>
            <div className="mt-3 space-y-1.5">
              {colleguesRestants.map((c) => (
                <p key={c.email} className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                  ⏱️ <span className="font-bold">{c.nom}</span> n&apos;a pas encore fermé sa tâche sur son téléphone.
                </p>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => repondreEquipe(true)}
                className="min-h-[52px] w-full rounded-xl bg-[#FF6A13] px-3 text-sm font-extrabold text-white active:scale-[0.99]"
              >
                ✅ Oui, on a tous terminé
              </button>
              <p className="text-[11px] leading-snug text-slate-500">
                Tu fais signer le client et le bon part une seule fois.{" "}
                {colleguesRestants.map((c) => c.nom).join(", ")} recevra une demande de confirmation de ses heures —
                s&apos;il les ajuste, un administrateur devra valider.
              </p>
              <button
                onClick={() => repondreEquipe(false)}
                className="min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-3 text-sm font-extrabold text-slate-700 active:scale-[0.99]"
              >
                Non, d&apos;autres continuent — je ferme seulement ma partie
              </button>
              <button
                onClick={() => setModalEquipe(false)}
                className="min-h-[44px] w-full rounded-xl text-[13px] font-bold text-slate-400 active:scale-[0.99]"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <PiedCopyright />
    </div>
  );
}

// ============================================================
// APP PRINCIPALE
// ============================================================
// ============================================================
// POINT D'ENTRÉE — charge la configuration de l'entreprise (règles de
// paie : durée du dîner, heure de bascule « Nuit ») et la met à
// disposition de toute l'app technicien. Ces règles sont réglées au
// bureau dans Paramètres : les deux applications lisent la MÊME source,
// donc elles ne peuvent pas diverger.
//
// Si la table n'est pas encore créée (SQL 23 non lancé), on garde
// CONFIG_DEFAUT — rien ne casse pour les techniciens sur la route.
// ============================================================
export default function App() {
  const [configEntreprise, setConfigEntreprise] = useState(CONFIG_DEFAUT);
  useEffect(() => {
    chargerEntreprise()
      .then(setConfigEntreprise)
      .catch(() => {
        // table absente — valeurs par défaut
      });
  }, []);
  return (
    <ContexteEntreprise.Provider value={configEntreprise}>
      <AppTechnicien />
    </ContexteEntreprise.Provider>
  );
}

function AppTechnicien() {
  // Config entreprise (contexte) — lue EN TÊTE : les hooks doivent
  // précéder tout retour conditionnel (règle des hooks React).
  const configTech = useEntreprise();
  // Durée de la pause dîner non payée (Paramètres de l'entreprise).
  const minutesDiner = Number(useEntreprise().minutesDiner) || 30;
  const [connecte, setConnecte] = useState(false);
  // --- Authentification Supabase ---
  const [session, setSession] = useState(null);
  const [authVerifie, setAuthVerifie] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setConnecte(!!data.session);
      setAuthVerifie(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setConnecte(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Tâches assignées par l'agenda admin (table taches_assignees) —
  // chargées pour le courriel connecté, mises à jour en direct (Realtime),
  // et fusionnées avec les tâches locales SANS perdre la progression
  // (chrono, photos, signature) des tâches déjà entamées.
  useEffect(() => {
    if (!session?.user?.email) return;
    let annule = false;
    // 🔔 Permission déjà accordée : l'abonnement push se rafraîchit en
    // silence (il peut expirer côté navigateur) — le bouton d'activation
    // de l'accueil reste le chemin pour la première fois.
    resouscrireSiPermis();
    const chargerAssignees = async () => {
      try {
        const distantes = await listerTachesPourEmploye(session.user.email);
        if (annule) return;
        setTaches((prev) => {
          const enrichies = distantes.map((d) => {
            const locale = prev.find((t) => t.id === d.id);
            // La version locale garde sa progression ; seuls les champs
            // planifiés par l'admin (titre, date, heure, description) suivent.
            return locale
              ? {
                  ...locale,
                  titre: d.titre,
                  clientNom: d.clientNom,
                  description: d.description,
                  devisNumero: d.devisNumero,
                  devisLignes: d.devisLignes,
                  zoneAppel: d.zoneAppel,
                  depotRequis: d.depotRequis,
                  depotMontant: d.depotMontant,
                  // Ces champs viennent du BUREAU : ils doivent suivre
                  // ses mises à jour, comme le titre et la description.
                  // Sans eux ici, une adresse corrigée ou un document
                  // ajouté par l'admin n'atteignait jamais un téléphone
                  // qui avait déjà la tâche en mémoire.
                  adresseIntervention: d.adresseIntervention,
                  adresseTravaux: d.adresseTravaux,
                  clientCourriels: d.clientCourriels,
                  clientTelephone: d.clientTelephone,
                  contactSurPlace: d.contactSurPlace,
                  piecesJointes: d.piecesJointes,
                  // Fermeture d'équipe déclarée par un coéquipier — doit
                  // atteindre un téléphone qui avait déjà la tâche en
                  // mémoire, sinon la question ne se pose jamais.
                  fermetureEquipe: d.fermetureEquipe,
                  // Fermeture par le BUREAU (oubli) — même raison.
                  fermetureBureau: d.fermetureBureau,
                  date: d.date,
                  heure: d.heure,
                }
              : d;
          });
          const locales = prev.filter((t) => !t.supabase);
          return completerTransportsJournee([...locales, ...enrichies]);
        });
      } catch {
        // table absente ou hors-ligne — l'app locale continue sans blocage
      }
    };
    chargerAssignees();
    const desabonner = sAbonnerTachesAssignees(chargerAssignees);
    return () => {
      annule = true;
      desabonner();
    };
  }, [session]);

  // Accès personnalisés (table permissions_utilisateurs) — même logique
  // que l'app admin : entrée personnalisée sinon défauts du rôle.
  const [accesPerso, setAccesPerso] = useState(null);
  const [accesCharge, setAccesCharge] = useState(false);
  useEffect(() => {
    if (!session?.user?.email) {
      setAccesPerso(null);
      setAccesCharge(false);
      return;
    }
    let annule = false;
    supabase
      .from("permissions_utilisateurs")
      .select("*")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (!annule) {
          setAccesPerso(data || null);
          setAccesCharge(true);
        }
      });
    return () => {
      annule = true;
    };
  }, [session]);
  const [role, setRole] = useState("employe"); // "admin" | "employe" — déterminé à la connexion
  const [compte, setCompte] = useState({ nomUtilisateur: "mgagnon", motDePasse: null });
  // Nom affiché dans « Bonjour, … » : métadonnées du compte si définies,
  // sinon le nom de la FICHE DU RÉPERTOIRE des employés (matché par
  // courriel), sinon le début du courriel en dernier recours.
  const [nomTechnicien, setNomTechnicien] = useState("");
  useEffect(() => {
    const courriel = session?.user?.email?.toLowerCase();
    if (!courriel) return;
    const meta = session.user.user_metadata?.nom;
    if (meta) {
      setNomTechnicien(meta);
      return;
    }
    setNomTechnicien(courriel.split("@")[0]); // affichage immédiat, raffiné ensuite
    // Annuaire noms + courriels seulement (jamais les salaires).
    listerAnnuaireEmployes()
      .then((liste) => {
        const fiche = (liste || []).find((e) => (e.courriel || "").toLowerCase() === courriel);
        if (fiche?.nom) setNomTechnicien(fiche.nom);
      })
      .catch(() => {
        // annuaire inaccessible — le début du courriel reste affiché
      });
  }, [session]);

  // Horaire local PAR COMPTE : vide au montage, chargé dès que le compte
  // connecté est connu (clé de stockage propre à son courriel). Fini les
  // tâches de démo héritées d'un autre compte.
  const [taches, setTaches] = useState([]);
  const tachesChargeesRef = useRef(false);
  useEffect(() => {
    const courriel = session?.user?.email;
    if (!courriel) return;
    setTaches(chargerTachesDepuisStockage(courriel));
    tachesChargeesRef.current = true;
  }, [session?.user?.email]);
  const [dateSelectionnee, setDateSelectionnee] = useState(() => new Date());
  const [modeVue, setModeVue] = useState("jour"); // "jour" | "semaine"
  // Fiches d'inspection par JOURNÉE de travail ({ "2026-07-26": fiche, ... }).
  // Chaque journée ayant des tâches exige SA propre inspection, faite au
  // moment de lancer le « Transport — Début de journée » de cette date.
  const [inspectionsParDate, setInspectionsParDate] = useState({});
  const inspectionFaitePour = (date) => !!inspectionsParDate[date];
  const [vue, setVue] = useState("accueil");
  // ⬅️ BOUTON RETOUR (Android / navigateur) : ferme la fiche de tâche
  // ou l'écran Mes heures au lieu de quitter l'application — le
  // réflexe naturel du téléphone (demande du propriétaire, 2026-08-17).
  useEffect(() => {
    const surRetour = () => {
      setTacheActiveId(null);
      setVue("accueil");
    };
    window.addEventListener("popstate", surRetour);
    return () => window.removeEventListener("popstate", surRetour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tacheActiveId, setTacheActiveId] = useState(null);
  // OUVERTURE D'UNE TÂCHE : toujours repartir du HAUT de l'écran. La
  // liste de l'horaire peut être défilée loin — sans ce retour en haut,
  // le panneau « Démarrer la tâche » s'ouvrait à moitié hors écran.
  useEffect(() => {
    if (tacheActiveId) window.scrollTo(0, 0);
  }, [tacheActiveId]);
  // Question « As-tu dîné ? » posée au démarrage du Transport — Fin de
  // journée (id de la tâche concernée, ou null).
  const [modalLunchPour, setModalLunchPour] = useState(null);
  // Tâche dont le technicien corrige le chrono oublié (fenêtre ouverte
  // depuis la bannière rouge de l'accueil).
  const [correctionPour, setCorrectionPour] = useState(null);
  // 🤝 Tâche fermée « pour toute l'équipe » par un coéquipier — en
  // attente de la confirmation d'heures du technicien (fenêtre posée à
  // l'ouverture de l'app). « Plus tard » : mémorisé pour la session.
  const [fermetureEquipePour, setFermetureEquipePour] = useState(null);
  const fermeturesReporteesRef = useRef(new Set());
  // 🏢 Le bureau a fermé une de mes tâches (oubli) : avis à l'écran —
  // les heures sont déjà écrites par le bureau, rien à confirmer.
  const [avisFermetureBureau, setAvisFermetureBureau] = useState(null);

  // Transport de FIN DE JOURNÉE encore ouvert le même jour que `t` —
  // c'est lui qu'on propose de fermer du même geste quand le technicien
  // corrige une tâche de chantier.
  const transportRetourDe = (t) => {
    if (!t || t.type !== "travail") return null;
    return (
      taches.find(
        (x) => x.type === "transport" && x.momentTransport === "fin" && x.date === t.date && x.etat !== "complete"
      ) || null
    );
  };
  const [, forceRafraichir] = useState(0);
  const [enLigne, setEnLigne] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [fileAttente, setFileAttente] = useState(chargerFileAttente);
  const [syncFileEnCours, setSyncFileEnCours] = useState(false);

  const [suggestionChantier, setSuggestionChantier] = useState(null);

  // Indicateur réseau — un seul abonnement aux événements du
  // navigateur au montage (tableau de dépendances vide), pas une
  // synchronisation répétée à chaque rendu. Les données restent
  // sauvegardées localement (voir sauvegarderTaches) même hors ligne ;
  // cet indicateur informe seulement le technicien que la synchronisation
  // avec le serveur est en pause.
  useEffect(() => {
    const majEnLigne = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", majEnLigne);
    window.addEventListener("offline", majEnLigne);
    return () => {
      window.removeEventListener("online", majEnLigne);
      window.removeEventListener("offline", majEnLigne);
    };
  }, []);

  // Persiste la file d'attente à chaque changement (comme pour
  // `taches`), pour qu'un rechargement de page ne perde pas les
  // actions pas encore synchronisées.
  useEffect(() => {
    sauvegarderFileAttente(fileAttente);
  }, [fileAttente]);

  // Synchronisation de la file — traite UNE action à la fois, puis se
  // redéclenche automatiquement (la dépendance `fileAttente` change
  // après chaque retrait). Réactive à la fois au retour de connexion
  // ET à l'ajout d'une nouvelle action pendant qu'on est déjà en
  // ligne (pas besoin d'attendre un cycle offline/online). Si la
  // connexion retombe en cours de route, le traitement s'arrête et
  // l'action restante demeure en file pour la prochaine tentative.
  //
  // Important : le verrou anti-concurrence (`syncEnCoursRef`) est une
  // ref, PAS un état — s'il était dans le tableau de dépendances de
  // cet effet tout en étant modifié PAR cet effet, chaque
  // `setSyncFileEnCours(true)` re-déclencherait l'effet, ce qui
  // annulerait (cleanup) l'opération asynchrone en cours avant même
  // qu'elle ait eu la chance de se terminer — une boucle qui empêche
  // toute synchronisation de jamais aboutir.
  //
  // Autre piège évité : le cleanup ne remet JAMAIS le verrou à `false`
  // lui-même. Si l'effet est démonté pendant qu'une requête réseau
  // RÉELLE est encore en vol (une fois branché à Supabase — voir
  // INTEGRATION.md), l'appel réseau lui-même n'est pas annulé par
  // `annule` : seul le traitement APRÈS coup l'est. Libérer le verrou
  // dans le cleanup permettrait alors à une 2e synchronisation de
  // démarrer immédiatement en parallèle de la 1re toujours en cours,
  // risquant d'envoyer deux fois la même donnée au serveur. Le verrou
  // n'est donc libéré que dans le `finally` — une fois l'opération
  // (réussie, échouée, ou abandonnée) VRAIMENT terminée.
  const syncEnCoursRef = useRef(false);
  const [erreurSync, setErreurSync] = useState("");
  useEffect(() => {
    if (!enLigne || syncEnCoursRef.current || fileAttente.length === 0) return;
    let annule = false;
    syncEnCoursRef.current = true;
    setSyncFileEnCours(true);
    (async () => {
      try {
        // Simule l'appel réseau réel (en prod : mettreAJourBonDeTravail
        // ou l'action Supabase correspondante — voir INTEGRATION.md).
        // Enveloppé dans un try/catch pour que les VRAIS échecs réseau
        // (pas seulement "hors-ligne" détecté par le navigateur) soient
        // gérés proprement : l'action reste en file, rien n'est perdu.
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            if (!navigator.onLine) reject(new Error("hors-ligne"));
            else resolve();
          }, 400);
        });
        if (annule) return;
        setFileAttente((prev) => prev.slice(1));
        setErreurSync("");
      } catch {
        if (annule) return;
        // Échec réel (pas juste une déconnexion détectée à l'avance) —
        // l'action reste en tête de file pour une prochaine tentative ;
        // un message informe le technicien sans bloquer le reste de
        // l'app. Pas de retrait de la file, donc pas de perte de données.
        setErreurSync("Synchronisation interrompue — nouvelle tentative dès que la connexion sera stable.");
      } finally {
        // Le verrou se libère TOUJOURS ici, que l'opération ait été
        // annulée ou non — c'est le seul endroit où l'on sait que
        // l'appel réseau sous-jacent est réellement terminé.
        syncEnCoursRef.current = false;
        if (!annule) setSyncFileEnCours(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [enLigne, fileAttente]);

  // Suggestion de chantier selon la position GPS — une seule demande
  // de géolocalisation, juste après la connexion (pas à chaque
  // rafraîchissement). Échoue silencieusement si la permission est
  // refusée ou l'appareil ne supporte pas la géolocalisation : ce
  // n'est qu'un raccourci, jamais un blocage.
  useEffect(() => {
    if (!connecte || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const proche = trouverChantierLePlusProche(position.coords.latitude, position.coords.longitude);
        if (proche && proche.distanceKm < 5) {
          setSuggestionChantier(proche);
        }
      },
      () => {}, // permission refusée / indisponible — pas d'erreur affichée
      { timeout: 8000 }
    );
  }, [connecte]);

  // RÔLE — lu dans les VRAIES permissions Supabase.
  //
  // Avant, il venait d'une comparaison de chaîne avec l'ancien écran de
  // connexion de démonstration (« admin » sans mot de passe). Cet écran
  // a disparu au passage à Supabase Auth : `gererConnexion` n'était
  // plus appelé par personne, et `role` restait donc bloqué sur
  // « employe » pour tout le monde — y compris pour le propriétaire.
  // Conséquence : le bouton « Réinitialiser » était devenu invisible et
  // inatteignable.
  useEffect(() => {
    if (!accesCharge || !session) return;
    const { role: r } = permissionsEffectives(accesPerso, session);
    setRole(r === "Admin principal" || r === "Admin régulier" ? "admin" : "employe");
  }, [accesCharge, accesPerso, session]);

  // Rafraîchit l'affichage chaque seconde pour que les minuteurs en
  // cours (EN COURS / EN PAUSE) restent à jour à l'écran.
  useEffect(() => {
    const enCours = taches.some((t) => t.etat === "en_cours");
    if (!enCours) return;
    const intervalle = setInterval(() => forceRafraichir((n) => n + 1), 1000);
    return () => clearInterval(intervalle);
  }, [taches]);

  // Persistance hors-ligne : sauvegarde uniquement quand `taches`
  // change réellement (dépendance [taches]), jamais à chaque rendu —
  // et JAMAIS avant le chargement initial du compte (sinon la liste
  // vide de départ écraserait l'horaire enregistré).
  useEffect(() => {
    if (!tachesChargeesRef.current) return;
    sauvegarderTaches(taches, session?.user?.email);
  }, [taches, session]);

  const majTache = (id, champs) => {
    setTaches((prev) => prev.map((t) => (t.id === id ? { ...t, ...champs } : t)));
    setFileAttente((prev) => [
      ...prev,
      { id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tacheId: id, champs, horodatage: Date.now() },
    ]);
  };

  const demarrerTache = (id) => {
    // TRANSPORT DURANT LA JOURNÉE en cours : cette carte est INVISIBLE
    // pour le technicien — dès qu'il démarre n'importe quelle autre
    // tâche (travail suivant OU transport de fin de journée), le
    // transport en cours se termine et s'envoie tout seul. Le compteur
    // passe d'une étape à l'autre sans manipulation ni minute perdue.
    const ccqEnRoute = taches.find(
      (t) => t.id !== id && t.momentTransport === "ccq" && (t.etat === "en_cours" || t.etat === "en_pause")
    );
    // Une seule tâche active (en_cours ou en_pause) à la fois pour ce
    // technicien — la tâche en cours doit être terminée avant d'en
    // commencer une autre. Les boutons sont déjà désactivés côté
    // interface (voir tacheBloquante), ceci est une garde défensive.
    const autreTacheActive = taches.some(
      (t) => t.id !== id && t.id !== ccqEnRoute?.id && (t.etat === "en_cours" || t.etat === "en_pause")
    );
    if (autreTacheActive) return;
    if (ccqEnRoute) terminerTache(ccqEnRoute.id);
    // HEURE DE DÉBUT RÉELLE : notée au tout premier démarrage de la tâche
    // (jamais réécrite par une reprise après pause) — envoyée au bureau à
    // la fin pour l'affichage « 7 h 42 → 11 h 15 » et les ajustements.
    const cible = taches.find((x) => x.id === id);
    majTache(id, { etat: "en_cours", tempsDebutSegment: Date.now(), debutReel: cible?.debutReel || Date.now() });
    // ⏱️ AGENDA EN DIRECT (2026-08-18) : le bloc du bureau passe « en
    // cours » (bleu) dès le Débuter. Un bonus, jamais un bloqueur — en
    // cas d'échec réseau, le chronomètre local roule quand même.
    if (cible?.supabase && cible.tacheOrigineId && cible.type === "travail") {
      majStatutAssignation(cible.tacheOrigineId, session?.user?.email, "en_cours").catch(() => {});
    }
  };

  const mettreEnPause = (id) => {
    setTaches((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const ecoule = t.tempsDebutSegment ? (Date.now() - t.tempsDebutSegment) / 1000 : 0;
        return { ...t, etat: "en_pause", tempsAccumuleSec: t.tempsAccumuleSec + ecoule, tempsDebutSegment: null };
      })
    );
  };

  const terminerTache = (id) => {
    // Capture AVANT la mise à jour d'état : la ligne « travail effectué »
    // (heures réelles + taux coûtant FIGÉ à la saisie) part vers le
    // bureau via Supabase — alimente les coûts réels des projets.
    const t = taches.find((x) => x.id === id);
    if (t) {
      const ecoule = t.tempsDebutSegment ? (Date.now() - t.tempsDebutSegment) / 1000 : 0;
      const heures = (t.tempsAccumuleSec + ecoule) / 3600;
      const clientDemo = CLIENTS.find((c) => c.id === t.clientId);
      enregistrerTravailEffectue(
        {
          // Pour les tâches assignées par l'admin : l'identifiant D'ORIGINE
          // (côté agenda), pour que le bloc passe au vert dans l'agenda.
          tacheId: t.cleHeures || t.tacheOrigineId || t.id,
        secteur: t.secteur || "commercial",
          titre: t.titre || (t.type === "transport" ? "Transport" : undefined),
          clientNom: t.clientNom || clientDemo?.nom || null,
          date: t.date || isoLocal(new Date()),
          heures,
          estTransport: t.type === "transport",
          // Où ces heures atterrissent dans les coûts : projet,
          // administratif, ou divers (payées mais rattachées à rien).
          categorieHeures: t.categorieHeures || "projet",
          kilometres: t.type === "transport" ? t.kilometres || 0 : null,
          projetId: t.projetId || null,
          noteTerrain: t.notesTerrain || "",
          noteInterne: t.notesInternes || "",
          // Heures RÉELLES de début et de fin — pour l'affichage
          // « 7 h 42 → 11 h 15 » et les ajustements côté bureau.
          debutReel: t.debutReel || null,
          finReelle: Date.now(),
          // Liens des photos téléversées (avant/après) — affichées au
          // bureau, sur le bon de travail client et dans le PDF.
          photosAvant: (t.photosAvant || []).map((p) => p.urlDistante).filter(Boolean),
          photosApres: (t.photosApres || []).map((p) => p.urlDistante).filter(Boolean),
        },
        session
      )
        .then(() => setErreurSync(""))
        .catch((e) => {
          // La tâche reste complétée localement, mais le bureau ne la verra
          // pas (pas de vert dans l'agenda) — on l'affiche clairement au
          // lieu d'échouer en silence.
          setErreurSync(
            `⚠️ Travail terminé NON transmis au bureau (« ${t.titre || "tâche"} ») — ${e?.message || "connexion impossible"}. L'agenda admin ne passera pas au vert.`
          );
        });
      // ⏱️ AGENDA EN DIRECT : la carte se ferme — le bloc du bureau
      // quitte le bleu « en cours » (le VERT, lui, vient des heures).
      if (t.supabase && t.tacheOrigineId && t.type === "travail") {
        majStatutAssignation(t.tacheOrigineId, session?.user?.email, "planifiee").catch(() => {});
      }
    }
    setTaches((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const ecoule = t.tempsDebutSegment ? (Date.now() - t.tempsDebutSegment) / 1000 : 0;
        return { ...t, etat: "complete", tempsAccumuleSec: t.tempsAccumuleSec + ecoule, tempsDebutSegment: null };
      })
    );
    // TRANSPORT CCQ automatique : une tâche de TRAVAIL vient de se
    // terminer et une autre suit aujourd'hui → le chrono du transport
    // vers la prochaine tâche démarre tout seul. Le compteur ne
    // s'arrête jamais entre deux clients — aucune minute ne manque à
    // la paie.
    if (t && t.type === "travail") {
      const travauxJour = taches
        .filter((x) => x.type === "travail" && x.date === t.date)
        .sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
      const idx = travauxJour.findIndex((x) => x.id === t.id);
      const suivante = idx >= 0 ? travauxJour[idx + 1] : null;
      if (suivante && suivante.etat !== "complete") {
        const ccq = taches.find(
          (x) => x.momentTransport === "ccq" && x.tacheSuivanteId === suivante.id && x.etat === "a_faire"
        );
        if (ccq) majTache(ccq.id, { etat: "en_cours", tempsDebutSegment: Date.now(), debutReel: ccq.debutReel || Date.now() });
      }
    }
  };

  // PLAFOND AUTOMATIQUE — le technicien n'a pas rattrapé son oubli dans
  // la fenêtre du rappel. La tâche se ferme seule et sa JOURNÉE ENTIÈRE
  // est BLOQUÉE : elle ne compte dans aucun total des heures de la
  // semaine tant qu'un administrateur n'a pas appelé le technicien pour
  // obtenir ses vraies heures de fin (règle validée avec le
  // propriétaire).
  //
  // La durée envoyée reste plafonnée au seuil — jamais les 60 h réelles
  // d'une fin de semaine — mais elle ne sert que de repère à l'admin :
  // aucun chiffre de cette journée n'entre dans la paie avant déblocage.
  const plafonnerTacheOubliee = (t) => {
    const heuresPlafond = HEURES_AVANT_PLAFOND;
    const debut = t.debutReel || t.tempsDebutSegment;
    const titreOriginal = t.titre || (t.type === "transport" ? "Transport" : "Tâche");
    const dateTache = t.date || isoLocal(new Date());
    enregistrerTravailEffectue(
      {
        tacheId: t.cleHeures || t.tacheOrigineId || t.id,
        secteur: t.secteur || "commercial",
        titre: `🔒 JOURNÉE BLOQUÉE — ${titreOriginal}`,
        clientNom: t.clientNom || null,
        date: dateTache,
        heures: heuresPlafond,
        estTransport: t.type === "transport",
        kilometres: t.type === "transport" ? t.kilometres || 0 : null,
        projetId: t.projetId || null,
        noteTerrain: t.notesTerrain || "",
        noteInterne:
          `${t.notesInternes ? t.notesInternes + "\n" : ""}` +
          `🔒 CHRONO OUBLIÉ — la tâche tournait encore après ${heuresPlafond} h. ` +
          `Fermeture automatique, journée BLOQUÉE. Appeler le technicien pour ` +
          `obtenir son heure de fin réelle, corriger, puis débloquer la journée.`,
        debutReel: debut || null,
        // Fin = début + le plafond, et non « maintenant » : sinon une
        // tâche rouverte le lundi afficherait une fin le lundi matin.
        finReelle: debut ? debut + heuresPlafond * 3600 * 1000 : Date.now(),
        photosAvant: (t.photosAvant || []).map((p) => p.urlDistante).filter(Boolean),
        photosApres: (t.photosApres || []).map((p) => p.urlDistante).filter(Boolean),
        // ---- LE DRAPEAU QUI BLOQUE LA JOURNÉE ----
        jourBloque: true,
        bloqueRaison: `Chrono oublié sur « ${titreOriginal} » — fermé automatiquement après ${heuresPlafond} h.`,
      },
      session
    ).catch((e) => {
      setErreurSync(
        `⚠️ Journée bloquée (chrono oublié sur « ${titreOriginal} ») mais NON transmise au bureau — ${e?.message || "connexion impossible"}. Appelle l'administration.`
      );
    });
    setTaches((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, etat: "complete", tempsAccumuleSec: heuresPlafond * 3600, tempsDebutSegment: null, chronoPlafonne: true }
          : x
      )
    );
  };

  // CORRECTION PAR LE TECHNICIEN (chemin « il se rattrape lui-même »).
  // Il déclare son heure de fin réelle avant que le plafond ne bloque
  // sa journée. La ligne part au bureau avec les heures déclarées ET en
  // CORRECTION À VALIDER : utilisable tout de suite, mais un
  // administrateur doit l'approuver.
  //
  // On n'enregistre PAS la durée du chrono emballé : elle est connue
  // fausse. La déclaration de bonne foi du technicien vaut mieux qu'un
  // chiffre dont tout le monde sait qu'il est inventé.
  const appliquerCorrectionChrono = ({ finTs, arriveeTs }) => {
    const t = taches.find((x) => x.id === correctionPour);
    setCorrectionPour(null);
    if (!t) return;
    const debut = t.debutReel || t.tempsDebutSegment;
    // Durée = segments déjà cumulés + le segment courant arrêté à
    // l'heure déclarée (les pauses du technicien restent respectées).
    const secondesSegment = t.tempsDebutSegment ? Math.max(0, (finTs - t.tempsDebutSegment) / 1000) : 0;
    const heures = Math.max(0, (t.tempsAccumuleSec + secondesSegment) / 3600);

    const envoyer = (tache, h, dReel, fReelle, note) =>
      enregistrerTravailEffectue(
        {
          tacheId: tache.cleHeures || tache.tacheOrigineId || tache.id,
        secteur: tache.secteur || "commercial",
          titre: tache.titre || (tache.type === "transport" ? "Transport" : undefined),
          clientNom: tache.clientNom || null,
          date: tache.date || isoLocal(new Date()),
          heures: h,
          estTransport: tache.type === "transport",
          kilometres: tache.type === "transport" ? tache.kilometres || 0 : null,
          projetId: tache.projetId || null,
          noteTerrain: tache.notesTerrain || "",
          noteInterne: `${tache.notesInternes ? tache.notesInternes + "\n" : ""}${note}`,
          debutReel: dReel || null,
          finReelle: fReelle,
          photosAvant: (tache.photosAvant || []).map((p) => p.urlDistante).filter(Boolean),
          photosApres: (tache.photosApres || []).map((p) => p.urlDistante).filter(Boolean),
          // CORRECTION À VALIDER — même mécanisme que les propositions du
          // répartiteur : l'admin voit le badge et approuve d'un clic.
          heuresProposees: h,
          debutPropose: dReel ? new Date(dReel).toISOString() : null,
          finPropose: new Date(fReelle).toISOString(),
          propositionPar: `${nomTechnicien || "Technicien"} (correction chrono oublié)`,
        },
        session
      );

    envoyer(
      t,
      heures,
      debut,
      finTs,
      `🕐 CHRONO OUBLIÉ — heure de fin déclarée par le technicien (${heureHHMM(finTs)}). À VALIDER.`
    )
      .then(() => setErreurSync(""))
      .catch((e) =>
        setErreurSync(
          `⚠️ Ta correction n'a PAS été transmise au bureau — ${e?.message || "connexion impossible"}. Réessaie une fois connecté.`
        )
      );

    setTaches((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, etat: "complete", tempsAccumuleSec: heures * 3600, tempsDebutSegment: null, finReelle: finTs }
          : x
      )
    );

    // Transport de retour fermé du même geste, s'il a donné son arrivée.
    const retour = transportRetourDe(t);
    if (arriveeTs && retour) {
      const hRetour = Math.max(0, (arriveeTs - finTs) / 3600000);
      envoyer(
        retour,
        hRetour,
        finTs,
        arriveeTs,
        `🕐 CHRONO OUBLIÉ — retour au bureau déclaré par le technicien (${heureHHMM(finTs)} → ${heureHHMM(arriveeTs)}). À VALIDER.`
      ).catch(() => {});
      setTaches((prev) =>
        prev.map((x) =>
          x.id === retour.id
            ? { ...x, etat: "complete", tempsAccumuleSec: hRetour * 3600, tempsDebutSegment: null, debutReel: finTs, finReelle: arriveeTs }
            : x
        )
      );
    }
  };

  // ------------------------------------------------------------
  // 🤝 FERMETURE D'ÉQUIPE — réponses du coéquipier (2026-08-17).
  // ------------------------------------------------------------
  // Champs communs de la ligne d'heures envoyée au bureau — mêmes
  // informations que la fermeture normale (notes, photos, catégorie).
  const champsFermetureEquipe = (t) => ({
    tacheId: t.cleHeures || t.tacheOrigineId || t.id,
    secteur: t.secteur || "commercial",
    titre: t.titre || undefined,
    clientNom: t.clientNom || null,
    date: t.date || isoLocal(new Date()),
    estTransport: false,
    categorieHeures: t.categorieHeures || "projet",
    kilometres: null,
    projetId: t.projetId || null,
    noteTerrain: t.notesTerrain || "",
    photosAvant: (t.photosAvant || []).map((p) => p.urlDistante).filter(Boolean),
    photosApres: (t.photosApres || []).map((p) => p.urlDistante).filter(Boolean),
  });

  // « Oui, j'avais terminé » : les heures POINTÉES (arrêtées à l'heure
  // de la fermeture du bon, jamais à « maintenant ») partent au bureau
  // et se cumulent automatiquement — aucune validation d'administrateur.
  const confirmerFermetureEquipe = (id) => {
    const t = taches.find((x) => x.id === id);
    setFermetureEquipePour(null);
    if (!t || !t.fermetureEquipe) return;
    const fermeTs = Date.parse(t.fermetureEquipe.a) || Date.now();
    const segment =
      t.etat === "en_cours" && t.tempsDebutSegment ? Math.max(0, (fermeTs - t.tempsDebutSegment) / 1000) : 0;
    const heures = Math.max(0, ((t.tempsAccumuleSec || 0) + segment) / 3600);
    enregistrerTravailEffectue(
      {
        ...champsFermetureEquipe(t),
        heures,
        noteInterne:
          `${t.notesInternes ? t.notesInternes + "\n" : ""}` +
          `🤝 Tâche fermée pour l'équipe par ${t.fermetureEquipe.par} — heures pointées confirmées par le technicien.`,
        debutReel: t.debutReel || null,
        finReelle: fermeTs,
      },
      session
    )
      .then(() => setErreurSync(""))
      .catch((e) =>
        setErreurSync(
          `⚠️ Tes heures n'ont PAS été transmises au bureau — ${e?.message || "connexion impossible"}. Rouvre l'app une fois connecté.`
        )
      );
    setTaches((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, etat: "complete", tempsAccumuleSec: heures * 3600, tempsDebutSegment: null, finReelle: fermeTs }
          : x
      )
    );
  };

  // « Non, j'ajuste » : heures DÉCLARÉES par le technicien — partent au
  // bureau À VALIDER par un administrateur (même mécanisme que la
  // correction de chrono oublié : badge ⏳ dans Heures & paie).
  const ajusterFermetureEquipe = (id, { debutTs, finTs }) => {
    const t = taches.find((x) => x.id === id);
    setFermetureEquipePour(null);
    if (!t) return;
    const heures = Math.max(0, (finTs - debutTs) / 3600000);
    enregistrerTravailEffectue(
      {
        ...champsFermetureEquipe(t),
        heures,
        noteInterne:
          `${t.notesInternes ? t.notesInternes + "\n" : ""}` +
          `🤝 Fermée pour l'équipe par ${t.fermetureEquipe?.par || "un coéquipier"} — heures AJUSTÉES par le technicien (${heureHHMM(debutTs)} → ${heureHHMM(finTs)}). À VALIDER.`,
        debutReel: debutTs,
        finReelle: finTs,
        heuresProposees: heures,
        debutPropose: new Date(debutTs).toISOString(),
        finPropose: new Date(finTs).toISOString(),
        propositionPar: `${nomTechnicien || "Technicien"} (fermeture d'équipe — heures ajustées)`,
      },
      session
    )
      .then(() => setErreurSync(""))
      .catch((e) =>
        setErreurSync(
          `⚠️ Ton ajustement n'a PAS été transmis au bureau — ${e?.message || "connexion impossible"}. Réessaie une fois connecté.`
        )
      );
    setTaches((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, etat: "complete", tempsAccumuleSec: heures * 3600, tempsDebutSegment: null, debutReel: debutTs, finReelle: finTs }
          : x
      )
    );
  };

  // 🤝 FERMETURE D'ÉQUIPE — détection côté coéquipier (2026-08-17).
  // Un collègue a fermé une tâche partagée en déclarant que toute
  // l'équipe avait terminé : sa marque arrive par l'assignation
  // (Realtime ou prochaine ouverture de l'app). Avant de poser la
  // question, on vérifie au serveur que MES heures n'y sont pas déjà
  // (téléphone réinstallé, double appareil…) — dans ce cas la tâche se
  // ferme sans question, il n'y a rien à confirmer.
  // (Placé APRÈS les déclarations de `taches` et `fermetureEquipePour` :
  // le tableau de dépendances est évalué au rendu — les référencer plus
  // haut plantait la page entière, « Cannot access before initialization ».)
  useEffect(() => {
    if (fermetureEquipePour) return;
    const monEmail = (session?.user?.email || "").toLowerCase();
    if (!monEmail) return;
    const candidate = taches.find(
      (t) =>
        t.supabase &&
        t.type === "travail" &&
        t.etat !== "complete" &&
        !t.envoye &&
        t.fermetureEquipe &&
        (t.fermetureEquipe.parEmail || "").toLowerCase() !== monEmail &&
        (!t.fermetureEquipe.jour || t.fermetureEquipe.jour === t.date) &&
        !fermeturesReporteesRef.current.has(t.id)
    );
    if (!candidate) return;
    let annule = false;
    (async () => {
      const deja = await travailDejaEnregistre(
        candidate.cleHeures || candidate.tacheOrigineId || candidate.id,
        monEmail
      );
      if (annule) return;
      if (deja) {
        majTache(candidate.id, { etat: "complete", tempsDebutSegment: null });
        return;
      }
      setFermetureEquipePour(candidate.id);
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches, session?.user?.email, fermetureEquipePour]);

  // 🏢 FERMETURE PAR LE BUREAU (oubli) — la marque arrive par
  // l'assignation (Realtime ou ouverture de l'app) : la carte se ferme
  // et un avis s'affiche. Aucune question — les heures sont déjà
  // écrites par le bureau ; en cas de désaccord, le technicien appelle.
  useEffect(() => {
    const c = taches.find(
      (t) =>
        t.supabase &&
        t.type === "travail" &&
        t.etat !== "complete" &&
        t.fermetureBureau &&
        (!t.fermetureBureau.jour || t.fermetureBureau.jour === t.date)
    );
    if (!c) return;
    majTache(c.id, { etat: "complete", tempsDebutSegment: null });
    setAvisFermetureBureau({
      titre: c.titre || c.clientNom || "ta tâche",
      debut: c.fermetureBureau.debut,
      fin: c.fermetureBureau.fin,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches]);

  // Vérification au démarrage de l'app, puis toutes les 5 minutes.
  // Pas de processus en arrière-plan : c'est l'ouverture de l'app qui
  // déclenche le rattrapage (lundi matin pour un oubli du vendredi).
  useEffect(() => {
    if (!connecte) return;
    const verifier = () => {
      const oubliees = tachesTropLongues(taches, HEURES_AVANT_PLAFOND);
      oubliees.forEach(plafonnerTacheOubliee);
    };
    verifier();
    const minuterie = setInterval(verifier, 5 * 60 * 1000);
    return () => clearInterval(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte, taches]);

  const ouvrirTache = (id) => {
    setTacheActiveId(id);
    window.history.pushState({ ecran: "tache" }, "", "#tache");
    setVue("tache");
  };
  const retourAccueil = () => setVue("accueil");

  // Réponse à « As-tu dîné ? » (une fois par journée, au démarrage du
  // Transport — Fin de journée). LUNCH = une ligne de temps NÉGATIF (la
  // pause non payée) part vers le bureau (visible dans « Heures de la
  // semaine », colonne Dîner + résumé de la journée). Aucun projet
  // touché. La durée vient des Paramètres de l'entreprise (30 min par
  // défaut) — elle n'est plus figée dans le code.
  const repondreLunch = (tacheId, reponse) => {
    const t = taches.find((x) => x.id === tacheId);
    setModalLunchPour(null);
    if (!t) return;
    majTache(t.id, { lunchReponse: reponse });
    if (reponse === "lunch") {
      enregistrerTravailEffectue(
        {
          tacheId: `lunch-${t.date || isoLocal(new Date())}`,
          titre: `Dîner (${minutesDiner} min non payées)`,
          clientNom: null,
          date: t.date || isoLocal(new Date()),
          heures: -(minutesDiner / 60),
          estTransport: false,
          kilometres: null,
          projetId: null,
          noteTerrain: "",
        },
        session
      )
        .then(() => setErreurSync(""))
        .catch((e) => {
          setErreurSync(`⚠️ Dîner NON transmis au bureau — ${e?.message || "connexion impossible"}. La déduction de ${minutesDiner} min n'apparaîtra pas dans les heures de la semaine.`);
        });
    }
    demarrerTache(t.id);
  };

  // Charge les inspections DU COMPTE CONNECTÉ depuis localStorage —
  // clé propre à son courriel : l'inspection faite sous un autre compte
  // (ou par les anciens tests) ne compte plus pour lui.
  useEffect(() => {
    const courriel = session?.user?.email;
    if (!courriel) return;
    try {
      const brut = window.localStorage?.getItem(cleInspectionPour(courriel));
      if (!brut) {
        setInspectionsParDate({});
        return;
      }
      const obj = JSON.parse(brut);
      setInspectionsParDate(obj && typeof obj === "object" ? obj : {});
    } catch {
      // stockage indisponible — sans conséquence
    }
  }, [session?.user?.email]);

  const soumettreInspection = (donnees) => {
    // L'inspection vaut pour la JOURNÉE de la tâche de transport cliquée
    // (aujourd'hui en usage normal ; une autre date en test/planification).
    const dateCible = tacheActive?.date || isoLocal(new Date());
    const record = { ...donnees, date: dateCible, soumisLe: Date.now() };
    setInspectionsParDate((prev) => {
      const maj = { ...prev, [dateCible]: record };
      try {
        window.localStorage?.setItem(cleInspectionPour(session?.user?.email), JSON.stringify(maj));
      } catch {
        // stockage indisponible — l'inspection reste valable pour la session
      }
      return maj;
    });
    // Écriture réelle dans Supabase (inspections_vehicules) — l'onglet
    // admin la voit en direct. En cas d'échec réseau, l'inspection reste
    // valable localement (le déblocage des tâches n'attend pas le serveur).
    enregistrerInspection(record, session).catch(() => {
      // hors-ligne ou table non accessible — sans blocage pour le technicien
    });
    // Courriel automatique à l'admin si anomalie : Phase 4 (Edge Function).
    retourAccueil();
  };

  // Réinitialise toutes les tâches à leur état de départ (statuts,
  // minuteurs, photos, signatures, kilométrage, positions GPS captées
  // — tout est effacé) et vide le stockage local correspondant.
  // Utilitaire de test/démo uniquement, visible seulement en mode
  // admin/développement — n'existe pas pour un vrai compte employé.
  const reinitialiserTachesTest = () => {
    // Révoque toutes les URLs Blob des photos accumulées (avant/après,
    // sur toutes les tâches) avant de les jeter — sans ça, les Blob
    // sous-jacents restent en mémoire jusqu'au rechargement complet de
    // la page, même une fois les tâches réinitialisées.
    taches.forEach((t) => {
      (t.photosAvant || []).forEach((p) => p.url && URL.revokeObjectURL(p.url));
      (t.photosApres || []).forEach((p) => p.url && URL.revokeObjectURL(p.url));
    });
    // Repart à VIDE (plus de tâches de démo) — les tâches réellement
    // assignées à ce compte reviendront de Supabase au prochain
    // rechargement de la page.
    setTaches([]);
    setFileAttente([]);
    setInspectionsParDate({});
    setTacheActiveId(null);
    setVue("accueil");
    try {
      window.localStorage.removeItem(cleStockagePour(session?.user?.email));
      window.localStorage.removeItem(cleInspectionPour(session?.user?.email));
      window.localStorage.removeItem(CLE_STOCKAGE); // anciennes clés globales (héritage)
      window.localStorage.removeItem(CLE_FILE_ATTENTE);
      window.localStorage.removeItem(CLE_INSPECTION);
    } catch {
      // Stockage indisponible — rien à faire, l'état React est déjà réinitialisé.
    }
  };

  // Cherche, parmi les tâches du jour, une tâche du client/adresse
  // suggéré par le GPS — si trouvée, l'ouvre directement (1 clic pour
  // confirmer et démarrer) ; sinon referme simplement la bannière.
  const confirmerChantierSuggere = () => {
    if (suggestionChantier) {
      const tacheCorrespondante = taches.find(
        (t) => t.type === "travail" && t.clientId === suggestionChantier.client.id && t.adresseId === suggestionChantier.adresse.id
      );
      if (tacheCorrespondante) ouvrirTache(tacheCorrespondante.id);
    }
    setSuggestionChantier(null);
  };

  const tacheActive = taches.find((t) => t.id === tacheActiveId);

  // La tâche (autre que celle-ci) qui est actuellement en cours ou en
  // pause — s'il y en a une, on ne peut pas démarrer/reprendre celle-ci.
  // EXCEPTION : un « Transport journalier » en cours ne bloque
  // JAMAIS — cette carte est invisible pour le technicien, et démarrer
  // n'importe quelle tâche l'arrête automatiquement (voir demarrerTache).
  const tacheBloquante = tacheActive
    ? taches.find(
        (t) =>
          t.id !== tacheActive.id &&
          (t.etat === "en_cours" || t.etat === "en_pause") &&
          t.momentTransport !== "ccq"
      )
    : null;

  if (!authVerifie) {
    return (
      <div className="flex min-h-screen w-full flex-col sm:mx-auto items-center justify-center sm:h-[844px] sm:min-h-0 sm:max-w-sm sm:overflow-hidden sm:rounded-[2.5rem] sm:border-8 sm:border-slate-900 bg-[#131B2E] text-sm text-slate-400 shadow-2xl">
        Chargement…
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex min-h-screen w-full flex-col sm:mx-auto sm:h-[844px] sm:min-h-0 sm:max-w-sm sm:overflow-hidden sm:rounded-[2.5rem] sm:border-8 sm:border-slate-900 bg-white shadow-2xl">
        <ConnexionTechnicien />
      </div>
    );
  }
  if (!accesCharge) {
    return (
      <div className="flex min-h-screen w-full flex-col sm:mx-auto items-center justify-center sm:h-[844px] sm:min-h-0 sm:max-w-sm sm:overflow-hidden sm:rounded-[2.5rem] sm:border-8 sm:border-slate-900 bg-[#131B2E] text-sm text-slate-400 shadow-2xl">
        Chargement…
      </div>
    );
  }
  // Blocage d'accès : seuls les rôles/accès ayant "technicien" entrent ici.
  // 🧩 MODULES À LA CARTE : si le forfait de l'entreprise (plateforme)
  // n'inclut pas le module « technicien », l'app mobile se ferme aussi.
  const { role: roleTech, sections: sectionsTech } = permissionsEffectives(accesPerso, session);
  const moduleTechnicienActif = !Array.isArray(configTech?.modules) || configTech.modules.includes("technicien");
  if (!sectionsTech.includes("technicien") || !moduleTechnicienActif) {
    return (
      <div className="flex min-h-screen w-full flex-col sm:mx-auto items-center justify-center gap-3 sm:h-[844px] sm:min-h-0 sm:max-w-sm sm:overflow-hidden sm:rounded-[2.5rem] sm:border-8 sm:border-slate-900 bg-white p-6 text-center shadow-2xl">
        <p className="text-lg font-extrabold text-slate-800">Accès refusé</p>
        <p className="text-sm text-slate-500">Ton compte ({roleTech}) n'a pas accès à l'application technicien.</p>
        <button onClick={() => supabase.auth.signOut()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Se déconnecter</button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col sm:mx-auto sm:h-[844px] sm:min-h-0 sm:max-w-sm sm:overflow-hidden sm:rounded-[2.5rem] sm:border-8 sm:border-slate-900 bg-white shadow-2xl">
      <div className="flex-1 overflow-y-auto">
        {vue === "mesheures" ? (
          <MesHeures courriel={session?.user?.email} onRetour={retourAccueil} />
        ) : vue === "accueil" || !tacheActive ? (
          <Accueil
            session={session}
            taches={taches}
            dateSelectionnee={dateSelectionnee}
            setDateSelectionnee={setDateSelectionnee}
            modeVue={modeVue}
            setModeVue={setModeVue}
            onOuvrir={ouvrirTache}
            onDeconnexion={() => supabase.auth.signOut()}
            role={role}
            enLigne={enLigne}
            suggestionChantier={suggestionChantier}
            onConfirmerChantier={confirmerChantierSuggere}
            onIgnorerChantier={() => setSuggestionChantier(null)}
            onReinitialiser={reinitialiserTachesTest}
            nbEnAttente={fileAttente.length}
            erreurSync={erreurSync}
            syncEnCours={syncFileEnCours}
            nomTechnicien={nomTechnicien}
            onOuvrirMesHeures={() => { setVue("mesheures"); window.history.pushState({ ecran: "heures" }, "", "#heures"); }}
            onCorrigerChrono={(id) => setCorrectionPour(id)}
          />
        ) : tacheActive.type === "transport" && tacheActive.momentTransport === "debut" && !inspectionFaitePour(tacheActive.date) ? (
          <FormulaireInspection
            onSoumettre={soumettreInspection}
            onRetour={retourAccueil}
            monCourriel={session?.user?.email || ""}
            dateLabel={dateDepuisIso(tacheActive.date || isoLocal(new Date())).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          />
        ) : tacheActive.type === "transport" ? (
          <TacheTransport
            tache={tacheActive}
            onDemarrer={() => {
              // TRANSPORT FIN DE JOURNÉE : avant de partir, une question —
              // « As-tu dîné ? » (une seule fois par journée). Lunch = 30
              // minutes non payées retirées de la journée.
              if (tacheActive.momentTransport === "fin" && !tacheActive.lunchReponse) {
                setModalLunchPour(tacheActive.id);
                return;
              }
              demarrerTache(tacheActive.id);
            }}
            onPause={() => mettreEnPause(tacheActive.id)}
            onReprendre={() => demarrerTache(tacheActive.id)}
            onTerminer={() => terminerTache(tacheActive.id)}
            onMajTache={majTache}
            onRetour={retourAccueil}
            tacheBloquante={tacheBloquante}
            inspectionFaite={inspectionFaitePour(tacheActive.date)}
            toutesLesTaches={taches}
          />
        ) : (
          <BonDeTravail
            tache={tacheActive}
            onDemarrer={() => demarrerTache(tacheActive.id)}
            onPause={() => mettreEnPause(tacheActive.id)}
            onReprendre={() => demarrerTache(tacheActive.id)}
            onTerminer={() => terminerTache(tacheActive.id)}
            onMajTache={majTache}
            onRetour={retourAccueil}
            tacheBloquante={tacheBloquante}
            inspectionFaite={inspectionFaitePour(tacheActive.date)}
            role={role}
            enLigne={enLigne}
            session={session}
          />
        )}
      </div>

      {/* FENÊTRE — « AS-TU DÎNÉ ? » (une fois par journée, avant le
          Transport — Fin de journée). Lunch = la pause non payée réglée dans les Paramètres. */}
      {/* CORRECTION D'UN CHRONO OUBLIÉ — ouverte depuis la bannière
          rouge, avant que le plafond ne bloque la journée. */}
      {correctionPour && (() => {
        const t = taches.find((x) => x.id === correctionPour);
        if (!t) return null;
        return (
          <ModalCorrectionChrono
            tache={t}
            transportRetour={transportRetourDe(t)}
            onAnnuler={() => setCorrectionPour(null)}
            onConfirmer={appliquerCorrectionChrono}
          />
        );
      })()}

      {/* 🏢 AVIS — le bureau a fermé une tâche pour le technicien
          (oubli) : ses heures sont déjà écrites, transparence complète. */}
      {avisFermetureBureau && (
        <div className="fixed inset-x-3 top-3 z-50 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 shadow-lg sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2">
          <p className="text-[13px] font-bold leading-snug text-amber-900">
            🏢 Le bureau a fermé « {avisFermetureBureau.titre} » pour toi
            {avisFermetureBureau.debut ? ` (${avisFermetureBureau.debut} → ${avisFermetureBureau.fin})` : ""}.
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
            Tes heures sont déjà enregistrées au bureau. Si c&apos;est inexact, appelle l&apos;administration.
          </p>
          <button
            onClick={() => setAvisFermetureBureau(null)}
            className="mt-2 min-h-[40px] w-full rounded-xl bg-amber-500 text-[12px] font-extrabold text-white active:scale-[0.99]"
          >
            OK, compris
          </button>
        </div>
      )}

      {/* 🤝 FERMETURE D'ÉQUIPE — un coéquipier a fermé la tâche pour
          tout le monde : confirmation (automatique) ou ajustement (à
          valider par un administrateur) des heures du technicien. */}
      {fermetureEquipePour && (() => {
        const t = taches.find((x) => x.id === fermetureEquipePour);
        if (!t) return null;
        return (
          <ModalFermetureEquipe
            tache={t}
            onConfirmer={() => confirmerFermetureEquipe(t.id)}
            onAjuster={(v) => ajusterFermetureEquipe(t.id, v)}
            onPlusTard={() => {
              fermeturesReporteesRef.current.add(t.id);
              setFermetureEquipePour(null);
            }}
          />
        );
      })()}

      {modalLunchPour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5">
            <h3 className="text-base font-extrabold text-slate-900">🍴 As-tu dîné aujourd'hui ?</h3>
            <p className="mt-1 text-xs text-slate-500">
              Réponse demandée une fois par journée, avant le retour. « Lunch » retire {minutesDiner} minutes (pause non payée) de ta journée.
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => repondreLunch(modalLunchPour, "lunch")}
                className="min-h-[48px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
              >
                🍴 Lunch — j&apos;ai pris ma pause dîner (−{minutesDiner} min)
              </button>
              <button
                onClick={() => repondreLunch(modalLunchPour, "no_lunch")}
                className="min-h-[48px] w-full rounded-xl border border-slate-300 text-sm font-extrabold text-slate-800 active:scale-[0.99]"
              >
                🚫 No lunch — j'ai travaillé sans pause
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
