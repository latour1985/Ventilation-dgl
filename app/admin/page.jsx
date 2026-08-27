"use client";

import React, { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import {
  FileText, Calendar, Bell, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft,
  ChevronRight, MapPin, Mail, FileCheck2, Clock, Send, X, Check,
  AlertCircle, Search, Users, UserPlus, RefreshCw, Phone, CreditCard,
  Camera, ClipboardList, UserCog, KeyRound, ShieldCheck, Lock, Loader2, User, Pencil, Briefcase, Car,
  Cloud, CheckCircle2, AlertTriangle, LayoutGrid, List, BarChart3, Menu, LogOut, Banknote, Copy, Settings, Package,
} from "lucide-react";
import TermesConditions from "@/components/TermesConditions";
import ConnexionAdmin from "@/components/ConnexionAdmin";
import Logo from "@/components/Logo";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { supabase, transporterSessionPourBascule } from "@/lib/supabase/client";
import { permissionsEffectives, permissionsPour, ORDRE_SECTIONS, LIBELLES_SECTIONS, aAutorisation, AUTORISATIONS, LIBELLES_AUTORISATIONS, AIDES_AUTORISATIONS, ROLES_AVEC_AUTORISATIONS } from "@/lib/permissions";
import { SqueletteAdmin } from "@/components/EcranSquelette";
import GestionAcces from "@/components/GestionAcces";
import { listerInspections, listerEntretiens, prendreEnChargeInspection, marquerAnomalieReparee, creerEntretien, sAbonnerInspections } from "@/lib/supabase/inspections";
import { listerCarnetVehicules, ajouterEntreeCarnet, sAbonnerCarnetVehicules } from "@/lib/supabase/carnetVehicules";
import { erreursClientPourQuickBooks } from "@/lib/validationQuickBooks";
import { assignerTacheSupabase, retirerTacheSupabase, listerToutesAssignations, majFacturableAssignation, majDonneesAssignation, sAbonnerTachesAssignees } from "@/lib/supabase/tachesAssignees";
import { listerSousTraitants, sauvegarderSousTraitant, listerAssignationsSousTraitants, COURRIEL_ST, estCourrielST } from "@/lib/supabase/sousTraitants";
import { listerEmployes, sauvegarderEmploye, supprimerEmploye } from "@/lib/supabase/repertoireEmployes";
import { listerTravauxEffectues, sAbonnerTravauxEffectues, appliquerAjustementsHeures, proposerAjustementsHeures, validerGroupePropositions, refuserGroupePropositions, joursBloques, cleJour, debloquerJournee, enregistrerTravailPourEmploye, rattacherProjetAuxHeures, heuresRattachablesA } from "@/lib/supabase/travauxEffectues";
import { listerBonsTravail, sAbonnerBonsTravail, majFacturesEmises, demanderRetraitFacturation, validerRetraitFacturation, remettreAFacturer, RAISONS_RETRAIT, enregistrerBonTravailBureau, rattacherAuBon, majMaterielStock } from "@/lib/supabase/bonsTravail";
import { listerFournisseurs, sauvegarderFournisseur } from "@/lib/supabase/fournisseurs";
import { listerCamions, sauvegarderCamion, camionIndisponible, declarerIndispoCamion, leverIndispoCamion } from "@/lib/supabase/camions";
import { numeroDevis, numeroBonCommande } from "@/lib/supabase/compteurs";
import { listerDevis, sauvegarderDevis, activerVersionDevis, sAbonnerDevis, supprimerDevis } from "@/lib/supabase/devis";
import { listerClients, sauvegarderClient, sAbonnerClients } from "@/lib/supabase/clients";
import { listerProjets, sauvegarderProjet, sAbonnerProjets } from "@/lib/supabase/projets";
import { listerTachesAttente, sauvegarderTacheAttente, retirerTacheAttente, sAbonnerTachesAttente } from "@/lib/supabase/taches";
import { listerJournal, ajouterEntreeJournal } from "@/lib/supabase/journal";
import { listerTaux, sauvegarderTaux } from "@/lib/supabase/tauxMetiers";
import { listerDepots, creerDepot, marquerDepotPayeManuellement, annulerDepotDelai, sAbonnerDepots, taxesDepot, majDepotFactureQbo } from "@/lib/supabase/depots";
import { ZONES_DEPOTS, listerPrixDepots, sauvegarderPrixDepots, zonesDepuis, supprimerZoneDepot } from "@/lib/supabase/prixDepots";
import { listerCatalogue, sauvegarderItem, desactiverItem, listerCatalogueRetires, reactiverItem, margePourcent, profitDollars, vendantPourMarge, sAbonnerCatalogue } from "@/lib/supabase/catalogue";
import { googlePlacesDisponible, nouveauJeton, chercherAdresses, detailsAdresse } from "@/lib/googlePlaces";
import { genererJeton, lienDevisPublic, JOURS_VALIDITE_LIEN_DEVIS } from "@/lib/supabase/devisPublic";
import { listerCommandesCamion, marquerCommandeCamionPassee, sAbonnerCommandesCamion, creerAchatLibre, listerAchatsLibres, majAchatLibre, supprimerAchatLibre, listerMemoireFournisseurs, memoriserFournisseursArticles } from "@/lib/supabase/materiel";
import { televerserPieceJointeTache, listerLegendes, sauvegarderLegende } from "@/lib/supabase/photosTravaux";
import { envoyerPushA } from "@/lib/notificationsPush";
import VisionneusePhotos from "@/components/VisionneusePhotos";
import { envoyerCourriel, gabaritDevis, gabaritBonCommande, gabaritDemandePaiement, gabaritBonTravail, gabaritCommandeGroupee, conditionsDepotAppel } from "@/lib/courriels";
import { termesHtmlCourriel } from "@/lib/termes";
import { assurerJetonBon, lienBonPublic, marquerBonEnvoyeClient, JOURS_VALIDITE_BON } from "@/lib/supabase/bonPublic";
import { ententePourStatut } from "@/lib/ententeTexte";
import { etatQuickbooks, listerTransactionsQuickbooks, creerFactureDepot, annulerFactureDepot, creerFactureQbo, creerEstimateQbo, synchroniserClientsQbo, envoyerFactureQbo, verifierEnvoisQbo, ouvrirFacturePdfQbo, sonderDepotsPayes, lireEstimateQbo } from "@/lib/quickbooksClient";
import { listerAttributionsQb, enregistrerAttributionQb } from "@/lib/supabase/quickbooks";
import { inviterEmploye } from "@/lib/comptesClient";
import { listerPieces, creerPiece, majPiece, marquerRecue, annulerPiece, pieceBloqueLaTache, sAbonnerPieces } from "@/lib/supabase/piecesCommandees";
import { CONFIG_DEFAUT, chargerEntreprise, sauvegarderEntreprise, calculerTaxes , accepterEntente } from "@/lib/supabase/entreprise";
import { ContexteEntreprise, useEntreprise } from "@/lib/contexteEntreprise";
import dynamic from "next/dynamic";
import { HEURES, indexCaseHeure, dateISO, todayISO, ajouterJours, dimancheDeSemaineISO, joursDepuis, moisDepuis, STATUTS_PIECE, genererNumeroSecours, bornesPeriodeAnalyse, Button, DefilementHorizontal, ITEMS_PAR_PAGE, BarrePagination, SelecteurCibleAchat, PhotosInspection } from "./partage";
import { OngletPaies } from "./OngletPaies";
import { OngletPieces } from "./OngletPieces";
import { SEUIL_ENTRETIEN_KM, SEUIL_ENTRETIEN_MOIS, OngletInspectionsVehicules } from "./OngletInspectionsVehicules";
import { ModalAnalyseRentabilite } from "./ModalAnalyseRentabilite";
import { correspond, METIERS_TERRAIN, METIERS_BUREAU, METIERS, NIVEAUX_PAR_METIER, NIVEAUX_CCQ_DEFAUT, niveauxPourMetier, estMetierBureau, metiersTerrainDe, metiersPourTypeAcces, accesParDefautPour, TYPES_ACCES, COULEUR_TYPE_ACCES, zonesEffectives, tauxAffiche } from "./partage";
import { ModalItemCatalogue, SectionCatalogue, OngletTarifs } from "./OngletTarifs";
import { ChampParametre, EnTeteEntreprise, PiedDocument, CarteConnexionQuickbooks, OngletParametres } from "./OngletParametres";

// CONFIGURATION DE L'ENTREPRISE — disponible partout
// ------------------------------------------------------------
// Les coordonnées, numéros officiels, taux de taxes et règles de paie
// étaient écrits en dur un peu partout dans ce fichier. Ils vivent
// maintenant dans la table `entreprises` et circulent par le contexte
// (lib/contexteEntreprise.js) : n'importe quel composant appelle
// `useEntreprise()` sans qu'on ait à faire descendre l'information de
// main en main sur des dizaines de niveaux.
//
// Repli sûr : tant que le snippet SQL 23 n'est pas exécuté, c'est
// CONFIG_DEFAUT (les valeurs actuelles de DGL) qui s'applique — rien
// ne casse.

// CATALOGUE D'ITEMS — comme la configuration d'entreprise, il circule
// par un contexte : il sert dans l'éditeur de devis ET dans la fenêtre
// de facturation, deux endroits profondément imbriqués.
const ContexteCatalogue = createContext([]);
function useCatalogue() {
  return useContext(ContexteCatalogue) || [];
}

// RÉPERTOIRE DES CLIENTS — même raison : les aperçus de documents ont
// besoin de l'adresse de facturation, et ils sont trop imbriqués pour
// la recevoir en propriété depuis l'App.
const ContexteClients = createContext([]);
function useClients() {
  return useContext(ContexteClients) || [];
}

// LISTE DES DEVIS — la facture d'un devis doit pouvoir reprendre ses
// lignes détaillées, sinon le client reçoit un montant sans explication.
const ContexteDevis = createContext([]);
function useDevis() {
  return useContext(ContexteDevis) || [];
}

// Hauteur d'un champ de description pour qu'il montre TOUT son contenu
// sans barre de défilement interne.
//
// Une description QuickBooks fait souvent 15 lignes (modèles, garantie,
// numéros AHRI, subventions). Un champ plafonné à 6 lignes n'en montrait
// qu'un tiers, et il fallait faire défiler dans une boîte minuscule pour
// relire ce qu'on envoie au client — donc on ne le relisait pas.
//
// On compte les sauts de ligne ET les retours à la ligne automatiques
// (une ligne longue occupe plusieurs rangées à l'écran).
const LARGEUR_LIGNE_DESCRIPTION = 52; // caractères visibles par rangée
function hauteurDescription(texte) {
  const contenu = String(texte || "");
  if (!contenu.trim()) return 2;
  const rangees = contenu
    .split("\n")
    .reduce((total, ligne) => total + Math.max(1, Math.ceil(ligne.length / LARGEUR_LIGNE_DESCRIPTION)), 0);
  // Plafond haut : au-delà, on garde une barre de défilement plutôt
  // qu'un champ qui repousserait les totaux hors de l'écran.
  return Math.min(30, Math.max(2, rangees));
}

const BoutonPDF = dynamic(() => import("@/components/pdf/BoutonPDF"), {
  ssr: false,
  loading: () => (
    <span className="mt-3 block text-center text-[11px] text-slate-400">Chargement du PDF…</span>
  ),
});

const CATALOGUE_REPLI = [];

const CLIENTS_INIT = [
  {
    id: "c1",
    nom: "Toitures Lavallée inc.",
    entreprise: "Toitures Lavallée inc.",
    // Plusieurs courriels possibles pour un même client — utile pour
    // une entreprise où la facturation, un chargé de projet et
    // l'administration générale ont des adresses différentes.
    courriels: [
      { id: "cc1", label: "Administration générale", email: "info@toitureslavallee.com", defaut: true },
      { id: "cc2", label: "Facturation / comptabilité", email: "facturation@toitureslavallee.com", defaut: false },
    ],
    telephone: "514-555-0142",
    termeFacturation: "Net 30",
    quickbooksCustomerId: "QBO-1001",
    adresses: [
      { id: "a1", nom: "Entrepôt principal", ligne1: "1450 rue Bélanger, Montréal, QC", codePostal: "H2G 1B4" },
    ],
  },
  {
    id: "c2",
    nom: "Résidence Tremblay",
    courriels: [{ id: "cc3", label: "Principal", email: "j.tremblay@courriel.com", defaut: true }],
    telephone: "450-555-0198",
    termeFacturation: "Comptant à la livraison",
    quickbooksCustomerId: "QBO-1002",
    adresses: [{ id: "a3", nom: "Domicile", ligne1: "22 rue des Érables, Longueuil, QC", codePostal: "J4K 3S1" }],
  },
];

const TERMES_FACTURATION = ["Comptant à la livraison", "Net 15", "Net 30", "Net 45", "Net 60"];

function GrilleAcces({ sections, onBasculer, desactive }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-500">Accès à l'application (coche / décoche librement)</label>
      <div className="grid grid-cols-2 gap-1.5">
        {ORDRE_SECTIONS.map((s) => (
          <label
            key={s}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
              sections.includes(s) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"
            } ${desactive ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={sections.includes(s)}
              disabled={desactive}
              onChange={() => onBasculer(s)}
              className="h-4 w-4 accent-[#131B2E]"
            />
            {LIBELLES_SECTIONS[s]}
          </label>
        ))}
      </div>
    </div>
  );
}
const TAUX_METIERS_INIT = {
  Frigoriste: { "Apprenti 1": 0, "Apprenti 2": 0, "Apprenti 3": 0, "Apprenti 4": 0, "Compagnon": 0 },
  Ferblantier: { "Apprenti 1": 0, "Apprenti 2": 0, "Apprenti 3": 0, "Compagnon": 0 },
  "Électricien": { "Apprenti 1": 0, "Apprenti 2": 0, "Apprenti 3": 0, "Apprenti 4": 0, "Compagnon": 0 },
  "Plombier": { "Apprenti 1": 0, "Apprenti 2": 0, "Apprenti 3": 0, "Apprenti 4": 0, "Compagnon": 0 },
  "Peintre": { "Apprenti 1": 0, "Apprenti 2": 0, "Apprenti 3": 0, "Compagnon": 0 },
  "Plâtrier": { "Apprenti 1": 0, "Apprenti 2": 0, "Apprenti 3": 0, "Compagnon": 0 },
};

const UTILISATEURS_INIT = [
  { id: "u1", nom: "Marc Gagnon", telephone: "514-555-0111", courriel: "marc.gagnon@ventilationdgl.com", nomUtilisateur: "mgagnon", typeAcces: "Employé", motDePasseCree: true, poste: "Technicien senior", dateEmbauche: "", adresse: "", notesRH: "" },
  { id: "u2", nom: "Sophie Roy", telephone: "514-555-0122", courriel: "sophie.roy@ventilationdgl.com", nomUtilisateur: "sroy", typeAcces: "Chargé de projet", motDePasseCree: true, poste: "", dateEmbauche: "", adresse: "", notesRH: "" },
];

// Historique des travaux par client — en prod, ceci vient d'une table
// Supabase `travaux` (liée aux bons de travail complétés par les
// techniciens et aux tâches planifiées dans l'agenda).
const TRAVAUX_INIT = [
  {
    id: "tr1",
    clientId: "c1",
    projetId: "proj1",
    heures: 32,
    estTransport: false,
    titre: "Réfection toiture — Entrepôt principal",
    date: "2026-06-10",
    statut: "complete",
    montant: 4250.0,
    envoyeA: new Date("2026-06-10T14:32:00").getTime(),
    modifReactivee: false,
    noteTerrain: "Remplacement complet de la membrane élastomère sur la section ouest. Drains nettoyés et solins remplacés. Aucun problème structural détecté.",
    noteInterne: "Accès entrepôt par la porte arrière seulement — code de la barrière : demander au contremaître Marc.",
    photos: ["Avant — vue générale", "Après — membrane installée", "Détail des solins"],
  },
  {
    id: "tr1-transport-aller",
    clientId: "c1",
    projetId: "proj1",
    heures: 0.75,
    distanceKm: 16.1,
    estTransport: true,
    titre: "Transport — Début de journée (imputé automatiquement)",
    date: "2026-06-10",
    statut: "complete",
    montant: null,
    envoyeA: new Date("2026-06-10T08:15:00").getTime(),
    modifReactivee: false,
    noteTerrain: "",
    noteInterne: "",
    photos: [],
  },
  {
    id: "tr1-transport-retour",
    clientId: "c1",
    projetId: "proj1",
    heures: 0.75,
    distanceKm: 15.8,
    estTransport: true,
    titre: "Transport — Fin de journée (imputé automatiquement)",
    date: "2026-06-10",
    statut: "complete",
    montant: null,
    envoyeA: new Date("2026-06-10T16:45:00").getTime(),
    modifReactivee: false,
    noteTerrain: "",
    noteInterne: "",
    photos: [],
  },
  {
    id: "tr2",
    clientId: "c1",
    projetId: "proj1",
    heures: 12,
    estTransport: false,
    titre: "Réparation toiture — Chantier Nord",
    date: "2026-08-05",
    statut: "a_venir",
    montant: null,
    modifReactivee: false,
    noteTerrain: "",
    noteInterne: "",
    photos: [],
  },
  {
    id: "tr3",
    clientId: "c2",
    projetId: null,
    heures: 2,
    estTransport: false,
    titre: "Remplacement thermostat",
    date: "2026-07-19",
    statut: "complete",
    montant: 284.5,
    envoyeA: new Date("2026-07-19T10:20:00").getTime(),
    modifReactivee: false,
    noteTerrain: "Ancien thermostat non programmable remplacé par un modèle programmable. Client formé sur l'utilisation de base.",
    noteInterne: "Client un peu pressé lors de la visite — prévoir un peu plus de temps la prochaine fois pour l'explication.",
    photos: ["Avant", "Après installation"],
  },
  {
    id: "tr4",
    clientId: "c2",
    projetId: null,
    heures: 1,
    estTransport: false,
    titre: "Entretien filtre CVAC",
    date: "2026-09-02",
    statut: "a_venir",
    montant: null,
    modifReactivee: false,
    noteTerrain: "",
    noteInterne: "",
    photos: [],
  },
];

// Projets / chantiers au long cours — lient un client, des tâches de
// terrain (via `travaux[].projetId`), des bons de commande fournisseur
// et un budget, pour calculer la rentabilité réelle. En prod, ceci vit
// dans une table Supabase `projets` avec des clés étrangères vers
// `clients`, `travaux` et `bons_commande`.
const STATUTS_PROJET = ["À planifier", "En cours", "Facturation d'acompte", "Terminé"];

const PROJETS_INIT = [
  {
    id: "proj1",
    nom: "Réfection toiture — Entrepôt & Chantier Nord",
    clientId: "c1",
    adresseTravaux: "Entrepôt principal — 1450 rue Bélanger, Montréal, QC",
    dateDebut: "2026-06-01",
    dateFin: "2026-09-30",
    statut: "En cours",
    budgetTotal: 18500.0,
    tauxHoraireCoutant: 45.0,
    bonsCommande: [
      { id: "bc1", numeroBC: "BC-1001", fournisseur: "Toitures Bélanger (matériaux)", montantHT: 6200.0, statut: "Reçu", date: "2026-06-05" },
      { id: "bc2", numeroBC: "BC-1002", fournisseur: "Location d'équipement Laval", montantHT: 850.0, statut: "En attente", date: "2026-06-08" },
    ],
  },
];

const EMPLOYES = [
  { id: "e1", nom: "Marc Gagnon" },
  { id: "e2", nom: "Sophie Roy" },
  { id: "e3", nom: "Éric Bouchard" },
];

const HEURES_QUART = HEURES.flatMap((h) => ["00", "15", "30", "45"].map((m) => `${h.slice(0, 2)}:${m}`));
function nomAffichageClient(c) {
  if (!c) return "";
  const nom = (c.nom || "").trim();
  const entreprise = (c.entreprise || "").trim();
  const mode = c.nomAffichage || "nom";
  if (mode === "entreprise") return entreprise || nom;
  if (mode === "nom-entreprise") return [nom, entreprise].filter(Boolean).join(" — ") || nom;
  return nom || entreprise;
}

// Heure locale « HH:MM » d'un horodatage — pour afficher les heures
// RÉELLES chronométrées sur les blocs terminés de l'agenda (2026-08-19).
function heureLocaleHHMM(horodatage) {
  const d = new Date(horodatage);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Étiquette d'une adresse de chantier — avec l'appartement s'il existe.
function libelleAdresse(a) {
  if (!a) return "";
  return `${a.ligne1}${a.appartement ? `, app. ${a.appartement}` : ""}`;
}

// Génère une tâche de transport SYSTÈME (Début/Fin de journée). Ces
// tâches sont recalculées automatiquement (voir recalculerTransports) et
// ne doivent pas être supprimées à la main dans la grille.
function tacheTransportSysteme(moment, employeId, dateISO, heure) {
  return {
    id: `transport-${moment}-${employeId}-${dateISO}`,
    type: "transport",
    momentTransport: moment,
    titre: moment === "debut" ? "Transport — Début de journée" : "Transport — Fin de journée",
    est_tache_systeme: true,
    employeId,
    heure,
    heures: 1,
    jours: 0,
    statut: "planifiee",
  };
}

// Recalcule les transports système pour TOUT le planning : pour chaque
// (journée, technicien) ayant au moins une VRAIE tâche, place un Transport
// Début juste avant la première et un Transport Fin juste après la
// dernière ; retire les transports d'une journée qui n'a plus de vraie
// tâche. Idempotent — à rappeler après chaque changement du planning.
// Contenu d'une case du planning, TOUJOURS sous forme de liste : depuis
// que plusieurs tâches peuvent partager la même plage horaire (elles
// s'empilent à l'écran au lieu de s'écraser), chaque case contient un
// tableau de tâches. Ce petit assistant tolère aussi l'ancien format
// (une tâche seule) par prudence.
function listeCellule(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function recalculerTransports(planning) {
  const resultat = {};
  const groupes = {}; // `${date}|${employeId}` -> { date, employeId, indices: [] }
  Object.entries(planning).forEach(([cle, valeur]) => {
    // On retire les anciens transports système — ils seront replacés.
    const reelles = listeCellule(valeur).filter((t) => !t?.est_tache_systeme);
    if (reelles.length === 0) return;
    resultat[cle] = reelles;
    const [date, employeId, heure] = cle.split("|");
    const g = `${date}|${employeId}`;
    if (!groupes[g]) groupes[g] = { date, employeId, indices: [] };
    const idx = HEURES.indexOf(heure);
    if (idx >= 0) groupes[g].indices.push(idx);
  });
  Object.values(groupes).forEach(({ date, employeId, indices }) => {
    if (indices.length === 0) return;
    // 🤝 SOUS-TRAITANTS : jamais de transports système (retour de tests
    // 2026-08-19) — on ne paie ni ne suit leur déplacement, leur rangée
    // ne montre que leurs blocs de présence.
    if (String(employeId).startsWith("st-")) return;
    const idxDebut = Math.min(...indices) - 1; // la case juste avant la 1re tâche
    const idxFin = Math.max(...indices) + 1; // la case juste après la dernière
    if (idxDebut >= 0) {
      const cle = `${date}|${employeId}|${HEURES[idxDebut]}`;
      resultat[cle] = [...listeCellule(resultat[cle]), tacheTransportSysteme("debut", employeId, date, HEURES[idxDebut])];
    }
    if (idxFin < HEURES.length) {
      const cle = `${date}|${employeId}|${HEURES[idxFin]}`;
      resultat[cle] = [...listeCellule(resultat[cle]), tacheTransportSysteme("fin", employeId, date, HEURES[idxFin])];
    }
  });
  return resultat;
}
// Heure de départ par défaut lors de la création/assignation d'une
// tâche — on ne veut pas qu'une nouvelle tâche démarre par défaut à
// minuit (HEURES[0]) : elle démarre à 7h du matin.
const HEURE_PAR_DEFAUT = "07:00";

const BONS_TRAVAIL_COMPLETES_INIT = [
  { id: "bt1", client: "Toitures Lavallée inc.", projet: "Réfection toiture - Entrepôt", montant: 4250.0, description: "", date: "2026-07-18", prixNonListe: true, statutQb: "en_attente", type: "temps_materiel", adresseTravaux: null },
  { id: "bt2", client: "Résidence Tremblay", projet: "Remplacement thermostat", montant: 284.5, date: "2026-07-19", prixNonListe: false, statutQb: "en_attente", type: "appel_service", adresseTravaux: null },
  { id: "bt3", client: "Résidence Tremblay", projet: "Entretien filtre CVAC", montant: 34.5, date: "2026-07-20", prixNonListe: false, statutQb: "en_attente", type: "appel_service", adresseTravaux: null },
  { id: "bt4", client: "Toitures Lavallée inc.", projet: "Réfection toiture — Chantier Sud", montant: 3100.0, date: "2026-07-21", prixNonListe: false, statutQb: "en_attente", type: "devis", devisNumero: "DEV-4821", adresseTravaux: "Chantier Sud — 88 boulevard des Laurentides, Laval, QC", facturesEmises: [] },
  { id: "bt5", client: "Résidence Tremblay", projet: "Entretien annuel système CVAC", montant: 1200.0, date: "2026-07-22", prixNonListe: false, statutQb: "en_attente", type: "entretien_contrat", devisNumero: "DEV-3390", frequenceFacturationAnnuelle: 4, adresseTravaux: null, facturesEmises: [] },
];

// ============================================================
// INTÉGRATION QUICKBOOKS ONLINE — FACTURES & DÉPENSES PAR PROJET
// ------------------------------------------------------------
// Service de synchronisation. En prod, `fetchQuickBooksTransactions`
// ferait un appel réel à l'API QuickBooks Online (endpoints Invoice
// et Purchase/Bill via /v3/company/{realmId}/query, authentifié en
// OAuth2), idéalement depuis une fonction backend (Supabase Edge
// Function) pour ne jamais exposer le jeton d'accès côté client.
// Ici, la fonction est simulée pour la démo : elle retourne un jeu de
// transactions fixe représentant ce que l'API renverrait.
// ============================================================
async function fetchQuickBooksTransactions() {
  // Simule la latence réseau d'un vrai appel API.
  //
  // Convention de nommage pour éviter toute confusion :
  // - `qbProjectRef` / `customerRefId` / `poNumber` = champs BRUTS tels
  //   que reçus de l'API QuickBooks (ProjectRef, CustomerRef, PO Number).
  // - `projectId` = champ ajouté par NOTRE app une fois la transaction
  //   résolue vers un projet local (voir attribuerTransactionQuickBooks
  //   plus bas). C'est LE SEUL champ utilisé pour filtrer les
  //   transactions d'un projet dans calculerRentabiliteProjet — jamais
  //   les champs bruts, qui ne sont que les entrées du mapping.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return [
    // Facture de vente liée au client "Toitures Lavallée inc." via son
    // CustomerRef QuickBooks (QBO-1001) — correspondance Règle 1.
    { quickbooksId: "QBO-INV-501", type: "INVOICE", customerRefId: "QBO-1001", qbProjectRef: null, poNumber: null, amountHT: 4250.0, amountTTC: 4886.29, status: "PAID", date: "2026-06-15" },
    // Dépense fournisseur portant le numéro de BC "BC-1001" — aucun
    // CustomerRef, donc correspondance par Règle 2 (numéro de BC).
    { quickbooksId: "QBO-EXP-812", type: "EXPENSE", customerRefId: null, qbProjectRef: null, poNumber: "BC-1001", amountHT: 6200.0, amountTTC: 7128.15, status: "PAID", date: "2026-06-05" },
    // Dépense dont le numéro de BC ne correspond à aucun projet connu
    // — tombe dans "Factures QuickBooks non assignées".
    { quickbooksId: "QBO-EXP-813", type: "EXPENSE", customerRefId: null, qbProjectRef: null, poNumber: "BC-9999", amountHT: 340.0, amountTTC: 390.83, status: "DUE", date: "2026-07-01" },
    // Facture sans CustomerRef ni numéro de BC reconnu — non assignée.
    { quickbooksId: "QBO-INV-502", type: "INVOICE", customerRefId: null, qbProjectRef: null, poNumber: null, amountHT: 890.0, amountTTC: 1023.53, status: "UNPAID", date: "2026-07-10" },
  ];
}

// ============================================================
// À QUOI APPARTIENT CETTE DÉPENSE QUICKBOOKS ?
// ------------------------------------------------------------
// Retourne une CIBLE { type: "projet"|"tache"|"client", id } — ou null
// (l'appelant place alors la transaction en attribution manuelle).
//
// TROIS CIBLES DEPUIS LE 2026-08-26 : avant, une dépense ne pouvait
// viser qu'un PROJET. Le produit acheté pour une job sans projet — une
// tâche, un client — n'entrait donc dans AUCUN coût : il restait
// orphelin et le coût réel de la job était faux en silence (constat du
// propriétaire : « le p/o pour l'achat de l'unité est bien là »).
//
// L'ordre va du plus PRÉCIS au plus large : un numéro de BC désigne une
// job exacte, un client ne désigne qu'un dossier.
// ============================================================
function attribuerTransactionQuickBooks(transaction, projets, clients, achatsLibres = []) {
  // Règle 1a : correspondance directe par ProjectRef (sous-projet QB).
  if (transaction.qbProjectRef) {
    const parRef = projets.find((p) => p.id === transaction.qbProjectRef);
    if (parRef) return { type: "projet", id: parRef.id };
  }
  // Règle 1b : correspondance par CustomerRef QuickBooks → client de
  // l'appli → projet "En cours" le plus pertinent pour ce client.
  // Depuis le 2026-08-28, le NOM QuickBooks sert de repli : les clients
  // d'avant Fluxya n'ont pas de lien quickbooksCustomerId sur leur
  // fiche — leur nom, lui, est le même des deux côtés.
  const clientDeLaTransaction = clientQbDeTransaction(transaction, clients);
  if (clientDeLaTransaction) {
    const projetsDuClient = projets.filter((p) => p.clientId === clientDeLaTransaction.id);
    const projetPertinent = projetsDuClient.find((p) => p.statut === "En cours") || projetsDuClient[0];
    if (projetPertinent) return { type: "projet", id: projetPertinent.id };
  }
  // Règle 2a : le numéro de BC est SEUL dans le champ « Nº de
  // référence » — le cas propre, correspondance exacte.
  if (transaction.poNumber) {
    const projetParBc = projets.find((p) => (p.bonsCommande || []).some((bc) => bc.numeroBC === transaction.poNumber));
    if (projetParBc) return { type: "projet", id: projetParBc.id, bc: transaction.poNumber };
  }
  // Règle 2b : LE NUMÉRO EST NOYÉ DANS DU TEXTE (2026-08-24).
  // ------------------------------------------------------------
  // Sur une facture fournisseur, le champ « Nº de la facture à payer »
  // porte le numéro DU FOURNISSEUR — notre BC, lui, finit dans le Mémo
  // ou dans la description d'une ligne. La règle 2a ne pouvait donc
  // presque jamais s'appliquer aux factures fournisseurs.
  // On cherche maintenant le BC À L'INTÉRIEUR du texte libre.
  if (transaction.referenceTexte) {
    const texte = String(transaction.referenceTexte).toUpperCase();
    const projetParTexte = projets.find((p) =>
      (p.bonsCommande || []).some((bc) => texteContientBc(texte, bc.numeroBC))
    );
    if (projetParTexte) {
      const bcTrouve = (projetParTexte.bonsCommande || []).find((bc) => texteContientBc(texte, bc.numeroBC));
      return { type: "projet", id: projetParTexte.id, bc: bcTrouve?.numeroBC || null };
    }
  }

  // ---- Règle 3 : LE BC D'UNE TÂCHE (2026-08-26) ----
  // Un BC créé pour une job sans projet vit dans `achats_libres` avec
  // son `tacheId`. Même recherche que pour les projets — numéro exact,
  // puis numéro noyé dans le mémo ou une description de ligne.
  const achatsAvecTache = (achatsLibres || []).filter((a) => a.tacheId && a.numeroBc);
  if (transaction.poNumber) {
    const parBc = achatsAvecTache.find(
      (a) => String(a.numeroBc).trim().toUpperCase() === String(transaction.poNumber).trim().toUpperCase()
    );
    if (parBc) return { type: "tache", id: parBc.tacheId, bc: parBc.numeroBc };
  }
  if (transaction.referenceTexte) {
    const texte = String(transaction.referenceTexte).toUpperCase();
    const parTexte = achatsAvecTache.find((a) => texteContientBc(texte, a.numeroBc));
    if (parTexte) return { type: "tache", id: parTexte.tacheId, bc: parTexte.numeroBc };
  }

  // ---- Règle 3b : LE BC D'UN CLIENT (2026-08-26, snippet 79) ----
  // Un BC rattaché DIRECTEMENT à un client (sans tâche ni projet — le
  // dossier ouvert avant que la job soit à l'horaire) : la dépense
  // QuickBooks qui porte son numéro suit le client.
  const achatsAvecClient = (achatsLibres || []).filter((a) => !a.tacheId && a.clientId && a.numeroBc);
  if (transaction.poNumber) {
    const parBcClient = achatsAvecClient.find(
      (a) => String(a.numeroBc).trim().toUpperCase() === String(transaction.poNumber).trim().toUpperCase()
    );
    if (parBcClient) return { type: "client", id: parBcClient.clientId, bc: parBcClient.numeroBc };
  }
  if (transaction.referenceTexte) {
    const texte = String(transaction.referenceTexte).toUpperCase();
    const parTexteClient = achatsAvecClient.find((a) => texteContientBc(texte, a.numeroBc));
    if (parTexteClient) return { type: "client", id: parTexteClient.clientId, bc: parTexteClient.numeroBc };
  }

  // ---- Règle 4 : LE CLIENT, à défaut de mieux (2026-08-26) ----
  // Le fournisseur a facturé au nom du client mais aucun projet ni
  // aucun BC ne colle : la dépense appartient quand même à ce client.
  // Mieux vaut un coût rattaché au bon DOSSIER qu'un coût nulle part.
  if (clientDeLaTransaction) return { type: "client", id: clientDeLaTransaction.id };
  return null; // Fallback → attribution manuelle requise.
}

// 👤 QUEL CLIENT FLUXYA pour cette transaction QuickBooks ? Par le lien
// quickbooksCustomerId d'abord (fiable), par le NOM sinon (2026-08-28 :
// les factures des clients d'avant Fluxya n'ont que leur nom pour se
// faire reconnaître). Normalisation : nomClientNormalise (plus bas).
function clientQbDeTransaction(transaction, clients) {
  if (transaction.customerRefId) {
    const parId = clients.find((c) => c.quickbooksCustomerId === transaction.customerRefId);
    if (parId) return parId;
  }
  const nomQb = nomClientNormalise(transaction.clientNomQb);
  if (!nomQb) return null;
  // Nom de la fiche OU nom d'entreprise de la fiche — QuickBooks mélange
  // les deux (« Amir Elbaz » vs « Constructions AB inc. »).
  return (
    clients.find((c) => nomClientNormalise(c.nom) === nomQb) ||
    clients.find((c) => c.entreprise && nomClientNormalise(c.entreprise) === nomQb) ||
    null
  );
}

// Pose la cible sur une transaction — attribution MANUELLE d'abord (la
// décision humaine prime toujours et survit aux rafraîchissements),
// automatique ensuite. `projectId` reste rempli pour une cible de type
// « projet » : tous les écrans qui le lisent déjà continuent de
// fonctionner sans changement.
function enrichirTransactionQb(t, manuelles, projets, clients, achatsLibres) {
  const cible = manuelles?.[t.quickbooksId] || attribuerTransactionQuickBooks(t, projets, clients, achatsLibres);
  return {
    ...t,
    cible: cible || null,
    projectId: cible?.type === "projet" ? cible.id : null,
    syncedAt: new Date().toISOString(),
  };
}

// Le numéro « BC-104 » ne doit PAS se reconnaître dans « BC-1042 » :
// deux commandes différentes, deux projets possiblement différents. On
// exige donc qu'aucun chiffre ne colle au numéro, de part et d'autre.
function texteContientBc(texteMajuscules, numeroBC) {
  const cible = String(numeroBC || "").trim().toUpperCase();
  if (cible.length < 3) return false; // trop court pour être sûr
  let depuis = 0;
  for (;;) {
    const i = texteMajuscules.indexOf(cible, depuis);
    if (i === -1) return false;
    const avant = i > 0 ? texteMajuscules[i - 1] : "";
    const apres = texteMajuscules[i + cible.length] || "";
    if (!/[0-9]/.test(avant) && !/[0-9]/.test(apres)) return true;
    depuis = i + 1;
  }
}

// ============================================================
// CALCUL DE RENTABILITÉ D'UN PROJET (temps réel)
// ============================================================
// Avancement calendrier (temps écoulé entre dateDebut et dateFin),
// distinct de l'avancement budgétaire — utilisé pour la double barre
// de progression du Hub Projets.
// Jauge de santé budgétaire — code couleur à 3 paliers :
// vert (< 75% consommé), jaune (75-100%), rouge clignotant (> 100%,
// dépassement réel du budget).
function couleurSanteBudget(pourcentageDepense) {
  if (pourcentageDepense > 100) {
    return { barre: "bg-red-500 animate-pulse", texte: "text-red-600", pastille: "bg-red-500 animate-pulse" };
  }
  if (pourcentageDepense >= 75) {
    return { barre: "bg-amber-500", texte: "text-amber-600", pastille: "bg-amber-500" };
  }
  return { barre: "bg-emerald-500", texte: "text-emerald-600", pastille: "bg-emerald-500" };
}

function calculerAvancementCalendrier(projet) {
  if (!projet.dateDebut || !projet.dateFin) return null;
  const debut = new Date(projet.dateDebut).getTime();
  const fin = new Date(projet.dateFin).getTime();
  if (!(fin > debut)) return null;
  const pct = ((Date.now() - debut) / (fin - debut)) * 100;
  return Math.max(0, Math.min(100, pct));
}

// "En retard" est un indicateur calculé (pas un statut choisi par
// l'admin) : la date de fin prévue est dépassée et le projet n'est
// pas marqué "Terminé".
function projetEnRetard(projet) {
  if (!projet.dateFin || projet.statut === "Terminé") return false;
  return new Date(projet.dateFin).getTime() < Date.now();
}

// ------------------------------------------------------------
// SANTÉ GLOBALE D'UN PROJET — règle unifiée utilisée PARTOUT (Hub,
// Kanban, fiche client, tableau de bord) pour que le même projet
// affiche toujours la même couleur, peu importe l'endroit :
//   VERT  = sous-budget ET dans les temps
//   JAUNE = 75-100% du budget consommé OU échéance dans les 7 jours
//   ROUGE = dépassement de budget OU en retard OU en perte
// ------------------------------------------------------------
function evaluerSanteProjet(projet, r) {
  const enRetard = projetEnRetard(projet);
  const enPerte = r.profitReel < 0;

  if (r.depassementBudget || enRetard || enPerte) {
    return { niveau: "rouge", pastille: "bg-red-500 animate-pulse", texte: "text-red-600", fond: "bg-red-100" };
  }

  let echeanceProche = false;
  if (projet.dateFin && projet.statut !== "Terminé") {
    const joursRestants = (new Date(projet.dateFin).getTime() - Date.now()) / 86400000;
    echeanceProche = joursRestants >= 0 && joursRestants <= 7;
  }

  if (r.pourcentageDepense >= 75 || echeanceProche) {
    return { niveau: "jaune", pastille: "bg-amber-500", texte: "text-amber-600", fond: "bg-amber-100" };
  }

  return { niveau: "vert", pastille: "bg-emerald-500", texte: "text-emerald-600", fond: "bg-emerald-100" };
}

function calculerRentabiliteProjet(projet, travaux, transactionsQb, utilisateurs = [], tauxMetiers = {}, inspections = [], coutCamionDefaut = 0) {
  // Heures du projet — les heures ADMINISTRATIVES et DIVERSES en sont
  // exclues même si elles portent un projetId. Une visite de soumission
  // faite avant d'avoir vendu le contrat ne doit pas gonfler le coût de
  // ce contrat : elle est un frais de vente de l'entreprise.
  // (Ces heures restent PAYÉES — voir « Heures de la semaine ».)
  const travauxDuProjet = travaux.filter(
    (t) => t.projetId === projet.id && (t.categorieHeures || "projet") === "projet"
  );
  // Heures Totales du Projet = Heures Tâches Projet + Heures Transport
  // Aller/Retour imputées (voir la règle d'imputation automatique côté
  // app technicien, basée sur la chronologie de la journée). Les deux
  // catégories sont distinguées ici pour l'affichage, mais comptent
  // également dans le coût de main-d'œuvre.
  const travauxChantier = travauxDuProjet.filter((t) => !t.estTransport);
  const travauxTransport = travauxDuProjet.filter((t) => t.estTransport);
  const heuresChantier = travauxChantier.reduce((s, t) => s + (t.heures || 0), 0);
  const heuresTransport = travauxTransport.reduce((s, t) => s + (t.heures || 0), 0);
  const totalHeures = heuresChantier + heuresTransport;
  // Kilométrage total de transport rattaché au projet — capturé par
  // GPS au départ/arrivée de chaque trajet côté app technicien.
  const kilometrageTransport = travauxTransport.reduce((s, t) => s + (t.distanceKm || 0), 0);
  // Dépenses QuickBooks (achats/sous-traitance) rattachées à ce projet.
  // Les factures de vente QuickBooks rattachées → suivies séparément
  // comme "facturé réel" (encaissements réels vs budget), sans changer le
  // calcul du profit (qui reste basé sur le budget initial vendu).
  const transactionsDuProjet = (transactionsQb || []).filter((t) => t.projectId === projet.id);
  const depensesQb = transactionsDuProjet.filter((t) => t.type === "EXPENSE");
  const facturesQb = transactionsDuProjet.filter((t) => t.type === "INVOICE");
  // ------------------------------------------------------------
  // ANTI-DOUBLE-COMPTAGE : un bon de commande saisi dans l'app et la
  // facture fournisseur correspondante dans QuickBooks (même numéro de
  // BC) sont LA MÊME dépense. On ne les additionne jamais :
  // - BC apparié à une dépense QB → le montant RÉEL de QuickBooks fait
  //   foi (il remplace le montant saisi, qui n'était qu'une estimation ;
  //   un BC laissé à 0 se remplit donc tout seul) ;
  // - BC sans dépense QB → son montant saisi compte (estimation) ;
  // - dépense QB sans BC correspondant → s'ajoute normalement.
  // ------------------------------------------------------------
  const numeroBcNormalise = (v) => String(v || "").trim().toUpperCase();
  const depensesParNumeroBc = new Map();
  depensesQb.forEach((d) => {
    const num = numeroBcNormalise(d.poNumber);
    if (num) depensesParNumeroBc.set(num, d);
    // Le numéro était NOYÉ dans le mémo (factures fournisseurs) : la
    // règle d'attribution l'a retrouvé — même appariement.
    const numMemo = numeroBcNormalise(d.cible?.bc);
    if (numMemo) depensesParNumeroBc.set(numMemo, d);
  });
  const bcApparies = new Set();
  const coutMateriauxBC = (projet.bonsCommande || []).reduce((s, bc) => {
    const correspondance = depensesParNumeroBc.get(numeroBcNormalise(bc.numeroBC));
    if (correspondance) {
      bcApparies.add(correspondance.quickbooksId);
      return s + (Number(correspondance.amountHT) || 0); // montant RÉEL de QuickBooks
    }
    return s + (Number(bc.montantHT) || 0); // estimation saisie dans l'app
  }, 0);
  // Dépenses QuickBooks qui ne correspondent à AUCUN bon de commande.
  const coutMateriauxQb = depensesQb
    .filter((d) => !bcApparies.has(d.quickbooksId))
    .reduce((s, t) => s + (Number(t.amountHT) || 0), 0);
  // MATÉRIEL DU STOCK — déjà payé, pris sur la tablette du bureau et
  // attribué à ce projet (« 4 paquets de tuyaux ») : un vrai coût du
  // projet même sans bon de commande ni dépense QuickBooks.
  const coutMaterielStock = (projet.materielStock || []).reduce((s, m) => s + (Number(m.coutTotal) || 0), 0);
  const coutMateriaux = coutMateriauxBC + coutMateriauxQb + coutMaterielStock;
  const totalFactureReel = facturesQb.reduce((s, t) => s + t.amountHT, 0);
  // Coût de main-d'œuvre : idéalement calculé par employé (taux du métier
  // + niveau de celui qui a pointé les heures, lu dans la table centrale).
  // Tant qu'un « travail » ne porte pas d'employeId (avant l'app technicien
  // + Supabase), on retombe sur le taux unique du projet.
  const tauxDeEmploye = (t) => {
    // Priorité 1 : le taux FIGÉ à la saisie (spec contrôle de gestion) —
    // stocké sur la ligne quand le technicien a terminé la tâche.
    if (Number(t.tauxCoutantFige) > 0) return Number(t.tauxCoutantFige);
    const emp = utilisateurs.find((u) => u.id === t.employeId);
    // Priorité 2 : taux horaire INDIVIDUEL de la fiche (métiers de bureau).
    if (Number(emp?.tauxHoraire) > 0) return Number(emp.tauxHoraire);
    // Priorité 3 : grille CCQ (métier × niveau) + prime individuelle.
    const taux = emp && tauxMetiers?.[emp.metier]?.[emp.niveau];
    if (Number(taux) > 0) return Number(taux) + (Number(emp?.primeHoraire) || 0);
    return projet.tauxHoraireCoutant || 0;
  };
  // Ventilation du coût main-d'œuvre par catégorie, avec le MÊME taux par
  // employé que ci-dessus — garantit coutMainOeuvreChantier + coutTransport === coutMainOeuvre.
  const coutMainOeuvreChantier = travauxChantier.reduce((s, t) => s + (t.heures || 0) * tauxDeEmploye(t), 0);
  const coutTransport = travauxTransport.reduce((s, t) => s + (t.heures || 0) * tauxDeEmploye(t), 0);
  const coutMainOeuvre = coutMainOeuvreChantier + coutTransport;
  // ------------------------------------------------------------
  // COÛT DU CAMION (bloc 5) : chaque heure d'un technicien qui AVAIT un
  // camion ce jour-là (son inspection du matin le dit) coûte le taux
  // camion en plus — chantier ET transports, le camion roule toute la
  // journée. Passager ou sans véhicule : zéro (le camion du conducteur
  // coûte déjà, on ne compte jamais deux fois le même véhicule).
  // Taux FIGÉ sur l'inspection du matin ; à défaut (vieille inspection
  // d'avant ce champ, ou inspection introuvable), le taux courant des
  // Paramètres — on COMPTE le camion en cas de doute : un coûtant
  // légèrement surestimé est moins dangereux qu'une job qui a l'air
  // plus payante qu'elle l'est.
  const coutCamionDe = (t) => {
    const email = (t.employeEmail || "").toLowerCase();
    if (!email || !t.date) return coutCamionDefaut;
    const insp = inspections.find((i) => i.date === t.date && (i.technicienEmail || "").toLowerCase() === email);
    if (!insp) return coutCamionDefaut;
    if (insp.sansVehicule || insp.passagerDeNom) return 0;
    return insp.coutCamionHoraire != null ? insp.coutCamionHoraire : coutCamionDefaut;
  };
  const coutCamion = travauxDuProjet.reduce((s, t) => s + (t.heures || 0) * coutCamionDe(t), 0);
  const coutTotalReel = coutMateriaux + coutMainOeuvre + coutCamion;
  const profitReel = projet.budgetTotal - coutTotalReel;
  const pourcentageMarge = projet.budgetTotal > 0 ? (profitReel / projet.budgetTotal) * 100 : 0;
  const pourcentageDepense = projet.budgetTotal > 0 ? (coutTotalReel / projet.budgetTotal) * 100 : 0;
  return {
    travauxDuProjet,
    travauxChantier,
    travauxTransport,
    heuresChantier,
    heuresTransport,
    kilometrageTransport,
    totalHeures,
    coutMateriauxBC,
    coutMateriauxQb,
    coutMaterielStock,
    coutMateriaux,
    transactionsDuProjet,
    totalFactureReel,
    coutMainOeuvre,
    coutMainOeuvreChantier,
    coutTransport,
    coutCamion,
    coutTotalReel,
    profitReel,
    pourcentageMarge,
    pourcentageDepense,
    depassementBudget: coutTotalReel > projet.budgetTotal,
  };
}

function courrielDefautClient(client) {
  if (!client?.courriels?.length) return null;
  return client.courriels.find((c) => c.defaut) || client.courriels[0];
}

function compresserImageJointe(file) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Fichier illisible"));
    lecteur.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const largeurMax = 1600;
        const echelle = Math.min(1, largeurMax / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * echelle;
        canvas.height = img.height * echelle;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve({ blob }) : reject(new Error("Compression échouée"))), "image/jpeg", 0.8);
      };
      img.src = e.target.result;
    };
    lecteur.readAsDataURL(file);
  });
}

function listeDestinataires(choix) {
  if (!choix) return [];
  return Array.isArray(choix) ? choix.filter(Boolean) : [choix];
}
// « courriel1 (Principal), courriel2 (Comptabilité) » pour le journal.
function libelleDestinataires(choix) {
  return listeDestinataires(choix)
    .map((c) => `${c.email}${c.label ? ` (${c.label})` : ""}`)
    .join(", ");
}

const CLE_JOURNAL = "ventilationdgl_journal_v1";
// Plafond généreux (pas 10-12 comme un simple aperçu) — un vrai
// journal d'audit doit couvrir au moins plusieurs jours d'activité.
const PLAFOND_JOURNAL = 500;

function chargerJournalDepuisStockage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const brut = window.localStorage.getItem(CLE_JOURNAL);
    const parsed = brut ? JSON.parse(brut) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sauvegarderJournal(journal) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(CLE_JOURNAL, JSON.stringify(journal));
  } catch {
    // Quota dépassé ou stockage indisponible — l'historique reste en
    // mémoire pour la session en cours sans bloquer l'utilisateur.
  }
}

function adresseFacturationClient(client) {
  if (client?.adresseFacturation) return client.adresseFacturation;
  const principale = client?.adresses?.[0];
  if (!principale) return "";
  return [libelleAdresse(principale), principale.codePostal].filter(Boolean).join(", ");
}

// Nom normalisé pour la détection de DOUBLONS : minuscules, accents
// retirés, espaces réduits — « Raphaël  Gélinas » = « raphael gelinas ».
function nomClientNormalise(nom) {
  return String(nom || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ============================================================
// NAVIGATION
// ============================================================
// ============================================================
// MENU LATÉRAL — navigation groupée (bureau : fixe à gauche ;
// mobile : tiroir ☰ par-dessus le contenu). Filtré par permissions.
// ============================================================
function MenuLateral({ vue, onChoisir, permissions, badges, courriel, role, onDeconnexion, ouvert, onFermer, reduit, onBasculerReduit }) {
  const groupes = [
    { titre: "Vue d'ensemble", items: [
      { id: "tableau-de-bord", label: "Tableau de bord", icone: LayoutGrid },
      // « Recherche » retirée du menu (retour de tests 2026-08-10) :
      // doublon exact de la recherche globale de l'en-tête, même moteur.
      // La page existe toujours si un vieux lien y mène.
    ]},
    { titre: "Clients & ventes", items: [
      { id: "clients", label: "Clients", icone: Users },
      { id: "devis", label: "Devis", icone: FileText },
      { id: "facturation", label: "Facturation", icone: Bell, badge: badges?.facturation },
    ]},
    { titre: "Opérations", items: [
      { id: "agenda", label: "Agenda", icone: Calendar, badge: badges?.agenda },
      { id: "projets", label: "Projets", icone: Briefcase, badge: badges?.projets },
      { id: "inspections", label: "Véhicules", icone: Car },
      { id: "pieces", label: "Pièces en commande", icone: Package, badge: badges?.pieces },
    ]},
    { titre: "Administration", items: [
      { id: "paies", label: "Heures de la semaine", icone: Banknote, badge: badges?.paies },
      { id: "tarifs", label: "Tarifs", icone: CreditCard },
      { id: "utilisateurs", label: "Utilisateurs", icone: UserCog },
      { id: "parametres", label: "Paramètres", icone: Settings },
    ]},
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => permissions.includes(i.id)) }))
    .filter((g) => g.items.length > 0);

  // Bascule réduit/agrandi : flèche ‹ à droite de « Vue d'ensemble »
  // (menu ouvert) ou flèche › en haut du rail (menu réduit).
  const contenu = (estReduit, avecBascule) => (
    <>
      <div className={`flex items-center border-b border-white/10 py-4 ${estReduit ? "justify-center px-2" : "gap-2.5 px-4"}`}>
        {/* FLUXYA — la marque produit dans l'en-tête (brief 2026-08-18). */}
        {estReduit ? (
          <Logo variant="icon" taille={32} className="shrink-0" />
        ) : (
          <div className="min-w-0">
            <Logo variant="compact" sombre />
            <p className="text-[10px] text-slate-500">Administration</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {estReduit && avecBascule && (
          <button
            onClick={onBasculerReduit}
            title="Agrandir le menu"
            aria-label="Agrandir le menu"
            className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        )}
        {groupes.map((g, gi) => (
          <div key={g.titre}>
            {estReduit ? (
              <div className="mx-2 my-2 border-t border-white/10" />
            ) : (
              <div className="flex items-center justify-between pr-0.5">
                <p className="px-2.5 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{g.titre}</p>
                {gi === 0 && avecBascule && (
                  <button
                    onClick={onBasculerReduit}
                    title="Réduire le menu"
                    aria-label="Réduire le menu"
                    className="mt-2 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronLeft size={15} />
                  </button>
                )}
              </div>
            )}
            {g.items.map((o) => {
              const Icone = o.icone;
              const actif = vue === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => { onChoisir(o.id); onFermer?.(); }}
                  title={o.label}
                  className={`relative flex w-full items-center rounded-lg py-2 text-left text-[13px] font-semibold ${
                    estReduit ? "justify-center px-0" : "gap-2.5 px-2.5"
                  } ${actif ? "bg-[#FF6A13] font-extrabold text-white" : "text-slate-300 hover:bg-white/5"}`}
                >
                  <Icone size={estReduit ? 17 : 15} className="shrink-0" />
                  {!estReduit && <span className="min-w-0 flex-1 truncate">{o.label}</span>}
                  {o.badge > 0 && (
                    <span className={`rounded-full bg-red-500 font-extrabold text-white ${
                      estReduit ? "absolute right-1 top-0.5 px-1 text-[8px]" : "shrink-0 px-1.5 py-0.5 text-[9px]"
                    }`}>{o.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`border-t border-white/10 py-3 ${estReduit ? "px-2 text-center" : "px-4"}`}>
        {!estReduit && (
          <>
            <p className="truncate text-[11px] font-bold text-slate-200">{courriel}</p>
            <p className="text-[10px] text-slate-500">{role}</p>
          </>
        )}
        <button
          onClick={onDeconnexion}
          title="Déconnexion"
          className={`mt-2 rounded-lg border border-white/20 text-slate-300 hover:bg-white/5 ${
            estReduit ? "p-1.5" : "px-3 py-1 text-[10px] font-bold"
          }`}
        >
          {estReduit ? <LogOut size={14} /> : "Déconnexion"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Bureau : colonne fixe, réductible en rail d'icônes (flèche ‹ / ›) */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#131B2E] transition-all md:flex ${reduit ? "w-14" : "w-56"}`}>
        {contenu(reduit, true)}
      </aside>
      {/* Mobile : tiroir par-dessus (toujours complet) */}
      {ouvert && (
        <div className="fixed inset-0 z-40 md:hidden" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-[#131B2E]" onClick={(e) => e.stopPropagation()}>
            {contenu(false, false)}
          </aside>
        </div>
      )}
    </>
  );
}

function BarreNav({ onglet, setOnglet, compteAttente, compteAlertes, compteRisqueProjets, permissions }) {
  const onglets = [
    { id: "tableau-de-bord", label: "Tableau de bord", icone: LayoutGrid },
    { id: "recherche", label: "Recherche", icone: Search },
    { id: "clients", label: "Clients", icone: Users },
    { id: "projets", label: "Projets", icone: Briefcase, badge: compteRisqueProjets },
    { id: "devis", label: "Devis", icone: FileText },
    { id: "agenda", label: "Agenda", icone: Calendar, badge: compteAttente },
    { id: "facturation", label: "Facturation", icone: Bell, badge: compteAlertes },
    { id: "inspections", label: "Véhicules", icone: Car },
    { id: "tarifs", label: "Tarifs", icone: CreditCard },
    { id: "utilisateurs", label: "Utilisateurs", icone: UserCog },
  ].filter((o) => permissions.includes(o.id));
  return (
    <div className="sticky top-0 z-20 flex items-stretch overflow-x-auto border-b border-slate-200 bg-white px-2 md:px-6">
      {onglets.map((o) => {
        const Icone = o.icone;
        const actif = onglet === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3.5 text-sm font-bold md:flex-none md:px-5 ${
              actif ? "border-[#FF6A13] text-[#131B2E]" : "border-transparent text-slate-400"
            }`}
          >
            <Icone size={17} />
            <span className="hidden sm:inline">{o.label}</span>
            {o.badge > 0 && (
              <span className="absolute -top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white md:static md:ml-0.5">
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function dateIlYaMois(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return dateISO(d);
}
function camionsEntretienDu(inspections, entretiens) {
  const camions = [...new Set((inspections || []).filter((i) => !i.sansVehicule && i.camion).map((i) => i.camion))];
  return camions.filter((camion) => {
    const kmList = (inspections || []).filter((i) => i.camion === camion && i.km != null).map((i) => i.km);
    const kmActuel = kmList.length ? Math.max(...kmList) : 0;
    const dernier = (entretiens || []).filter((e) => e.camion === camion).sort((a, b) => b.date.localeCompare(a.date))[0];
    const ecartKm = kmActuel - (dernier ? dernier.km : 0);
    const mois = dernier ? moisDepuis(dernier.date) : Infinity;
    return ecartKm >= SEUIL_ENTRETIEN_KM || mois >= SEUIL_ENTRETIEN_MOIS;
  });
}

const INSPECTIONS_INIT = [
  { id: "insp1", date: dateISO(new Date()), technicienNom: "Marc Gagnon", sansVehicule: false, camion: "Camion 02", km: 142380, anomalie: true, remarque: "Feu arrière gauche grillé", controleProblemes: ["Lumières"], statutAnomalie: "nouvelle", noteCharge: "", prisParNom: "" },
  { id: "insp2", date: dateISO(new Date()), technicienNom: "Sophie Roy", sansVehicule: false, camion: "Camion 01", km: 98120, anomalie: false, remarque: "", controleProblemes: [], statutAnomalie: "aucune", noteCharge: "", prisParNom: "" },
  { id: "insp3", date: dateISO(new Date()), technicienNom: "Éric Bouchard", sansVehicule: true, camion: "", km: null, anomalie: false, remarque: "", controleProblemes: [], statutAnomalie: "aucune", noteCharge: "", prisParNom: "" },
  { id: "insp4", date: dateISO(new Date()), technicienNom: "Sophie Roy", sansVehicule: false, camion: "Camion 05", km: 54900, anomalie: true, remarque: "Frein arrière mou", controleProblemes: ["Freins"], statutAnomalie: "prise_en_charge", noteCharge: "Pièce reçue, réparation faite le jour même.", prisParNom: "l'administrateur" },
  { id: "insp5", date: dateISO(ajouterJours(new Date(), -1)), technicienNom: "Marc Gagnon", sansVehicule: false, camion: "Camion 03", km: 76540, anomalie: false, remarque: "", controleProblemes: [], statutAnomalie: "aucune", noteCharge: "", prisParNom: "" },
];

const ENTRETIENS_INIT = [
  { id: "ent1", camion: "Camion 01", km: 88000, date: dateIlYaMois(3) },
  { id: "ent2", camion: "Camion 02", km: 135000, date: dateIlYaMois(4) },
  { id: "ent3", camion: "Camion 03", km: 70000, date: dateIlYaMois(8) },
  { id: "ent4", camion: "Camion 05", km: 50000, date: dateIlYaMois(2) },
];

function OngletTableauDeBord({ projets, travaux, transactionsQb, utilisateurs, tauxMetiers, clients, compteAlertes, compteAttente, journal, setOnglet, inspections, entretiens, soumissionsSansDevis, bons, devisListe, parcCamions, planning, statutsAssignations, achatsLibres = [] }) {
  const configTdb = useEntreprise();
  const analyse = projets.map((p) => {
    const r = calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers, inspections, Number(configTdb?.coutCamionHoraire) || 0);
    return { p, r, sante: evaluerSanteProjet(p, r) };
  });
  // Heures RÉELLES saisies aujourd'hui par les techniciens (chantier +
  // transport confondus) — date locale.
  const heuresAujourdhui = (travaux || [])
    .filter((t) => t.date === todayISO())
    .reduce((s, t) => s + (Number(t.heures) || 0), 0);
  // Camions dont l'entretien périodique est dû (10 000 km / 6 mois).
  const entretiensDus = camionsEntretienDu(inspections, entretiens);
  const aRisque = analyse.filter((x) => x.sante.niveau === "rouge");
  const rang = { rouge: 0, jaune: 1, vert: 2 };
  const aSurveiller = analyse
    .filter((x) => x.sante.niveau !== "vert")
    .sort((a, b) => rang[a.sante.niveau] - rang[b.sante.niveau]);
  const margeMoyenne = analyse.length ? analyse.reduce((s, x) => s + x.r.pourcentageMarge, 0) / analyse.length : 0;
  // 📊 Analyse de rentabilité — ouverte par la tuile « Marge moyenne ».
  const [analyseOuverte, setAnalyseOuverte] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold text-slate-900">Tableau de bord</h2>
        <span className="text-xs text-slate-400">Vue d'ensemble</span>
      </div>

      {/* 📱 AUJOURD'HUI SUR LE TERRAIN — TÉLÉPHONE (2026-08-21)
          ------------------------------------------------------------
          La première question d'un admin sur la route est toujours la
          même : « qui est où, et où en est-il ? ». Sur l'ordinateur,
          l'agenda y répond d'un coup d'œil ; sur un téléphone, il
          fallait ouvrir l'agenda et défiler. Ce bloc donne la réponse
          en haut de l'écran d'accueil, en direct (le rose « en cours »
          vient du chronomètre du technicien lui-même). */}
      {(() => {
        const jour = todayISO();
        const gens = (utilisateurs || []).filter((u) => !estMetierBureau(u.metier));
        const lignes = gens
          .map((u) => {
            const taches = tachesDuJourPourEmploye(planning || {}, jour, u.id).filter((t) => !t.est_tache_systeme);
            if (taches.length === 0) return null;
            const courriel = (u.courriel || "").toLowerCase();
            const heuresDuJour = (travaux || [])
              .filter((t) => t.date === jour && (t.employeEmail || "").toLowerCase() === courriel)
              .reduce((s, t) => s + (Number(t.heures) || 0), 0);
            const aDesHeures = (t) =>
              (travaux || []).some(
                (x) => x.supabase && cleTacheDesHeures(x.tacheId) === t.id && (x.employeEmail || "").toLowerCase() === courriel && x.date === jour
              );
            // ⚠️ LES HEURES TRANCHENT, PAS LE STATUT (2026-08-21) : le
            // marqueur « en cours » peut rester collé sur une tâche
            // fermée par un coéquipier (la remise à zéro ne partait pas
            // de ce chemin-là). Une tâche dont les heures sont au
            // bureau n'est JAMAIS « en cours ».
            const enCours = taches.find((t) => (statutsAssignations || {})[`${t.id}|${courriel}`] === "en_cours" && !aDesHeures(t));
            const finies = taches.filter(aDesHeures).length;
            return { u, taches, enCours, finies, heuresDuJour };
          })
          .filter(Boolean);
        if (lignes.length === 0) return null;
        return (
          <div className="rounded-2xl border border-slate-200 bg-white md:hidden">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              👷 Aujourd&apos;hui sur le terrain
            </p>
            <div className="divide-y divide-slate-100">
              {lignes.map(({ u, taches, enCours, finies, heuresDuJour }) => (
                <button
                  key={u.id}
                  onClick={() => setOnglet("agenda")}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{u.nom}</span>
                    {enCours ? (
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-fuchsia-500" />
                        <span className="truncate text-[11px] font-semibold text-fuchsia-700">
                          {enCours.titre || enCours.clientNom}
                        </span>
                      </span>
                    ) : (
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                        {finies >= taches.length ? "journée terminée" : `${taches.length - finies} tâche${taches.length - finies > 1 ? "s" : ""} à faire`}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-extrabold tabular-nums text-slate-700">
                      {finies}/{taches.length}
                    </span>
                    {heuresDuJour > 0 && (
                      <span className="block text-[10px] tabular-nums text-slate-400">{heuresDuJour.toFixed(2)} h</span>
                    )}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* TUILES KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <button onClick={() => setOnglet("agenda")} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-400">Heures aujourd'hui</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-blue-700">{heuresAujourdhui.toFixed(1)} h</p>
          <p className="mt-1 text-[11px] text-blue-400">saisies par les techniciens</p>
        </button>
        <button
          onClick={() => setOnglet("inspections")}
          className={`rounded-2xl border p-4 text-left active:scale-[0.99] ${
            entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className={`text-[10px] font-extrabold uppercase tracking-wide ${entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "text-orange-500" : "text-slate-400"}`}>
            Entretiens camions
          </p>
          <p className={`mt-1 text-3xl font-extrabold tabular-nums ${entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "text-orange-600" : "text-[#131B2E]"}`}>
            {entretiensDus.length + (parcCamions || []).filter((c) => c.actif && camionIndisponible(c)).length}
          </p>
          <p className={`mt-1 truncate text-[11px] ${entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "text-orange-500" : "text-slate-400"}`}>
            {[
              ...entretiensDus,
              ...(parcCamions || []).filter((c) => c.actif && camionIndisponible(c)).map((c) => `🔧 ${c.nom} indisponible`),
            ].join(", ") || "aucun entretien dû"}
          </p>
        </button>
        <button onClick={() => setOnglet("projets")} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-red-400">Projets à risque</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-red-600">{aRisque.length}</p>
          <p className="mt-1 text-[11px] text-red-400">dépassement ou en perte</p>
        </button>
        <button onClick={() => setOnglet("facturation")} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-500">Factures en attente</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-amber-700">{compteAlertes}</p>
          <p className="mt-1 text-[11px] text-amber-600">à émettre / réviser</p>
        </button>
        <button onClick={() => setOnglet("agenda")} className="rounded-2xl border border-slate-200 bg-white p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Tâches à planifier</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#131B2E]">{compteAttente}</p>
          <p className="mt-1 text-[11px] text-slate-400">non assignées</p>
        </button>
        <button onClick={() => setAnalyseOuverte(true)} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-500">Marge moyenne</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-700">{margeMoyenne.toFixed(0)}%</p>
          <p className="mt-1 text-[11px] text-emerald-600">projets actifs · cliquer pour l'analyse</p>
        </button>
      </div>

      {analyseOuverte && (
        <ModalAnalyseRentabilite
          analyse={analyse}
          travaux={travaux}
          bons={bons}
          devisListe={devisListe}
          inspections={inspections}
          achatsLibres={achatsLibres}
          transactionsQb={transactionsQb}
          clients={clients}
          onFermer={() => setAnalyseOuverte(false)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        {/* VISITES DE SOUMISSION SANS DEVIS
            ------------------------------------------------------------
            Une visite faite mais jamais chiffrée, c'est une vente qui
            s'éteint toute seule. Le rappel MONTE LE TON avec les jours :
            visible dès le premier, rouge après trois. Un client qui
            attend une semaine a souvent déjà appelé un concurrent. */}
        {(soumissionsSansDevis || []).length > 0 && (
          <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
              <FileText size={13} /> {soumissionsSansDevis.length} visite{soumissionsSansDevis.length > 1 ? "s" : ""} de soumission sans devis
            </h3>
            <div className="space-y-1.5">
              {soumissionsSansDevis.map((v) => {
                const urgent = v.jours >= 3;
                return (
                  <div
                    key={v.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      urgent ? "border-red-300 bg-red-50" : "border-indigo-200 bg-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800">{v.clientNom || v.titre}</p>
                      <p className="text-[10px] text-slate-500">Visite du {v.date}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        urgent ? "bg-red-500 text-white" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {v.jours === 0 ? "aujourd'hui" : `${v.jours} jour${v.jours > 1 ? "s" : ""}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-indigo-700">
              Ces visites disparaîtront d'ici dès qu'un devis sera créé pour le client.
            </p>
          </div>
        )}

        {/* PROJETS À SURVEILLER */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Projets à surveiller</h3>
          {aSurveiller.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">Aucun projet à risque — tout est au vert. 🎉</p>
          ) : (
            <div className="space-y-1">
              {aSurveiller.map(({ p, r, sante }) => (
                <button key={p.id} onClick={() => setOnglet("projets")} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sante.pastille}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{p.nom}</p>
                    <p className="truncate text-[11px] text-slate-400">{clients.find((c) => c.id === p.clientId)?.nom} · {p.statut}</p>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="mb-0.5 flex justify-between text-[9px] font-bold text-slate-400"><span>Budget</span><span className="tabular-nums">{r.pourcentageDepense.toFixed(0)}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`} style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }} />
                    </div>
                  </div>
                  <span className={`w-12 shrink-0 text-right text-sm font-extrabold tabular-nums ${sante.texte}`}>{r.pourcentageMarge.toFixed(0)}%</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ACTIVITÉ RÉCENTE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Activité récente</h3>
          {journal.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune activité pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {journal.slice(0, 6).map((e) => (
                <div key={e.id} className="flex gap-2 text-[12px] leading-snug text-slate-600">
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-300">{e.heure}</span>
                  <span className="min-w-0">{e.texte}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SAISIE D'ADRESSE — GOOGLE PLACES
// ------------------------------------------------------------
// Les suggestions viennent de la vraie API Google Places (restreinte
// au Canada). Avant, c'était une liste de 5 adresses fictives : aucune
// adresse réelle n'apparaissait, donc rien ne pouvait être sélectionné
// et la création d'un client restait bloquée sur « adresse incomplète ».
//
// Google renvoie la ville et le code postal DÉJÀ DÉCOUPÉS. C'est le
// vrai gain : ces champs partent sur les factures des clients, et les
// deviner dans une chaîne de texte finit toujours par produire une
// adresse fautive.
//
// SAISIE MANUELLE CONSERVÉE : si la clé manque, si le quota est
// dépassé, ou hors ligne, on retombe sur la saisie libre avec ville
// obligatoire. Créer un client ne doit jamais dépendre d'un tiers.
// ============================================================
function AutocompleteAdresse({ onSelection }) {
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [googleEnPanne, setGoogleEnPanne] = useState(!googlePlacesDisponible());
  // Champs de repli, utilisés seulement en saisie manuelle.
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  // Jeton de session Google : une seule unité de facturation pour toute
  // la recherche + la sélection (voir lib/googlePlaces.js).
  const jetonRef = useRef(null);

  // Recherche différée de 300 ms : on n'interroge pas Google à chaque
  // lettre, on attend que le doigt s'arrête.
  useEffect(() => {
    if (googleEnPanne || texte.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let annule = false;
    setChargement(true);
    const minuterie = setTimeout(async () => {
      try {
        if (!jetonRef.current) jetonRef.current = await nouveauJeton();
        const res = await chercherAdresses(texte, jetonRef.current);
        if (!annule) setSuggestions(res);
      } catch {
        // Clé refusée, quota dépassé, hors ligne — on bascule en saisie
        // manuelle sans message technique incompréhensible.
        if (!annule) {
          setGoogleEnPanne(true);
          setSuggestions([]);
        }
      } finally {
        if (!annule) setChargement(false);
      }
    }, 300);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [texte, googleEnPanne]);

  const choisir = async (s) => {
    try {
      const details = await detailsAdresse(s, jetonRef.current);
      onSelection(details);
      setTexte(details.label);
    } catch {
      // Détails indisponibles : on garde au moins le texte de la
      // suggestion plutôt que de perdre le choix du client.
      onSelection({ label: s.texte, ligne1: s.texte, ville: "", codePostal: "" });
      setTexte(s.texte);
    }
    jetonRef.current = null; // le jeton meurt avec la sélection
    setSuggestions([]);
    setOuvert(false);
  };

  // Saisie manuelle : proposée quand Google est indisponible, ou quand
  // aucune suggestion ne correspond (adresse neuve, chantier sans
  // numéro civique…).
  const saisieLibre = texte.trim().length >= 5 && !chargement && suggestions.length === 0;

  const confirmerSaisieLibre = () => {
    if (!texte.trim() || !ville.trim()) return;
    onSelection({
      label: texte.trim(),
      ligne1: texte.trim(),
      ville: ville.trim(),
      codePostal: codePostal.trim(),
    });
    setOuvert(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setOuvert(true);
          }}
          placeholder="Commence à taper l'adresse…"
          className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-9 text-sm"
        />
        {chargement && (
          <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {ouvert && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => choisir(s)}
              className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-[#FF6A13]" />
              {s.texte}
            </button>
          ))}
        </div>
      )}

      {saisieLibre && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="mb-1.5 text-[10px] leading-snug text-slate-500">
            {googleEnPanne
              ? "Suggestions Google indisponibles — entre l'adresse à la main."
              : "Aucune suggestion ne correspond. Tu peux utiliser l'adresse telle quelle."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Ville *</label>
              <input
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Mirabel"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Code postal</label>
              <input
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value.toUpperCase())}
                placeholder="J7N 3V4"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none"
              />
            </div>
          </div>
          <Button onClick={confirmerSaisieLibre} disabled={!ville.trim()} className="mt-2 w-full min-h-0 py-2 text-xs">
            <Check size={13} /> Utiliser cette adresse
          </Button>
        </div>
      )}
    </div>
  );
}

function DevisDuClient({ devisListe, clientId, surlignerNumero, compact }) {
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [versionAffichee, setVersionAffichee] = useState(null);
  const [apercu, setApercu] = useState(null);

  // Regroupement par dossier : une entrée par devis, ses révisions dedans.
  const dossiers = (() => {
    const parBase = {};
    (devisListe || [])
      .filter((d) => (clientId ? d.clientId === clientId : true))
      .forEach((d) => {
        const base = d.numeroBase || d.numero;
        (parBase[base] = parBase[base] || []).push(d);
      });
    return Object.entries(parBase)
      .map(([base, versions]) => {
        const triees = versions.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
        const active = triees.find((v) => v.versionActive !== false) || triees[triees.length - 1];
        return { base, versions: triees, active };
      })
      .sort((a, b) => (b.active.creeLe || b.active.date || "").localeCompare(a.active.creeLe || a.active.date || ""));
  })();

  if (dossiers.length === 0) {
    return <p className="text-xs text-slate-400">Aucun devis pour ce client.</p>;
  }

  return (
    <div className="space-y-1.5">
      {dossiers.map(({ base, versions, active }) => {
        const ouvert = dossierOuvert === base;
        const affichee = ouvert ? versions.find((v) => v.numero === versionAffichee) || active : active;
        // Devis ciblé par la recherche : mis en évidence à l'ouverture.
        const cible = surlignerNumero && versions.some((v) => v.numero === surlignerNumero);
        return (
          <div
            key={base}
            className={`rounded-lg border p-2.5 ${cible ? "border-[#FF6A13] bg-orange-50 ring-2 ring-orange-200" : "border-slate-200 bg-white"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900">
                  {affichee.numero}
                  {versions.length > 1 && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{versions.length} versions</span>
                  )}
                  {affichee.estContrat && (
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                      CONTRAT · {affichee.frequenceFacturationAnnuelle}×/an
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400">
                  {affichee.date}
                  {affichee.noteVersion ? ` · ${affichee.noteVersion}` : ""}
                  {!compact && affichee.clientNom ? ` · ${affichee.clientNom}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold tabular-nums text-slate-800">{affichee.totalVendant.toFixed(2)} $</p>
                <span
                  className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    affichee.statut === "accepte" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {affichee.statut === "accepte" ? "ACCEPTÉ" : "ENVOYÉ"}
                </span>
              </div>
            </div>

            {/* ONGLETS DES VERSIONS */}
            {versions.length > 1 && (
              <div className="mt-1.5 flex flex-wrap gap-1 rounded-md border border-slate-200 p-0.5">
                {versions.map((v) => (
                  <button
                    key={v.numero}
                    onClick={() => {
                      setDossierOuvert(base);
                      setVersionAffichee(v.numero);
                    }}
                    title={v.noteVersion || undefined}
                    className={`rounded px-1.5 py-1 text-[9px] font-extrabold ${
                      v.numero === affichee.numero ? "bg-[#131B2E] text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {v.version === 0 ? "Originale" : `v${v.version}`}
                    {v.numero === active.numero ? " ★" : ""}
                  </button>
                ))}
              </div>
            )}
            {affichee.numero !== active.numero && (
              <p className="mt-1 text-[9px] font-bold text-slate-400">🔒 Version archivée — la courante est {active.numero}</p>
            )}
            {affichee.traite && (
              <p className="mt-1 text-[9px] font-bold text-blue-600">
                ✓ Traité — {affichee.modeTraitement === "projet" ? "converti en projet" : "converti en bon de travail"}
              </p>
            )}
            <Button variant="outline" onClick={() => setApercu(affichee)} className="mt-1.5 w-full min-h-0 gap-1 py-1.5 text-[11px]">
              <FileText size={11} /> Voir version client
            </Button>
          </div>
        );
      })}
      {apercu && <ApercuDevisClient devis={apercu} onFermer={() => setApercu(null)} />}
    </div>
  );
}


// ============================================================
// ✏️ MODIFIER LA FICHE CLIENT — après la création
// ------------------------------------------------------------
// Demande du propriétaire (2026-08-15) : tout se corrige après coup —
// le nom du contact, l'entreprise, LE NOM AFFICHÉ (personne vs
// entreprise — ex. afficher « Toitures Lavallée inc. » plutôt que le
// contact), le téléphone et l'ADRESSE DE FACTURATION. La sauvegarde
// passe par l'effet de persistance existant (clients modifiés =
// réécrits automatiquement en base).
// ============================================================
function ModalEditionClient({ client, onFermer, onEnregistrer }) {
  const [nom, setNom] = useState(client.nom || "");
  const [entreprise, setEntreprise] = useState(client.entreprise || "");
  const [nomAffichage, setNomAffichage] = useState(client.nomAffichage || "nom");
  const [telephone, setTelephone] = useState(client.telephone || "");
  // Adresse de facturation : l'actuelle (règle complète) affichée, une
  // nouvelle choisie via Google la remplace.
  const [nouvelleAdresse, setNouvelleAdresse] = useState(null);
  const [nouvelleAdresseUnite, setNouvelleAdresseUnite] = useState("");
  const actuelle = adresseFacturationClient(client);
  // 📇 CARNET DE CONTACTS SUR PLACE (SQL 72, 2026-08-17) — chargé de
  // projet, concierge, gérant… réutilisables de chantier en chantier.
  const [contacts, setContacts] = useState(() => (client.contacts || []).map((c) => ({ ...c })));
  const majContact = (id, champs) =>
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...champs } : c)));
  const ajouterContact = () =>
    setContacts((prev) => [...prev, { id: `ct-${Date.now()}`, nom: "", role: "", telephone: "" }]);
  const retirerContact = (id) => setContacts((prev) => prev.filter((c) => c.id !== id));

  // PERSONNE OU ENTREPRISE + téléphone obligatoire (2026-08-17) —
  // mêmes règles qu'à la création.
  const personneOk = nom.trim().length > 0 && nom.trim() !== entreprise.trim();
  const identiteOk = personneOk || entreprise.trim().length > 0;
  const raisonsFiche = [];
  if (!identiteOk) raisonsFiche.push("une personne OU une entreprise");
  if (!telephone.trim()) raisonsFiche.push("un téléphone");
  const enregistrer = () => {
    if (raisonsFiche.length > 0) return;
    onEnregistrer({
      // Entreprise seule : elle sert de nom et d'affichage.
      nom: personneOk ? nom.trim() : entreprise.trim(),
      entreprise: entreprise.trim(),
      nomAffichage: personneOk ? (entreprise.trim() ? nomAffichage : "nom") : "entreprise",
      telephone: telephone.trim(),
      // Lignes vides écartées (un contact sans nom ne sert à rien).
      contacts: contacts
        .map((c) => ({ ...c, nom: (c.nom || "").trim(), role: (c.role || "").trim(), telephone: (c.telephone || "").trim() }))
        .filter((c) => c.nom),
      ...(nouvelleAdresse
        ? {
            adresseFacturation: [nouvelleAdresse.label, nouvelleAdresseUnite.trim() ? `app. ${nouvelleAdresseUnite.trim()}` : ""]
              .filter(Boolean)
              .join(", "),
          }
        : {}),
    });
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">✏️ Modifier la fiche — {nomAffichageClient(client)}</h3>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Nom du contact</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Entreprise (optionnel)</label>
            <input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Ex : Toitures Lavallée inc." className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          {entreprise.trim() && (
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Nom affiché (listes, devis, factures)</label>
              <div className="flex flex-wrap gap-3">
                {[["nom", "Nom de la personne"], ["entreprise", "Entreprise"], ["nom-entreprise", "Nom — Entreprise"]].map(([val, lib]) => (
                  <label key={val} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <input type="radio" name="edition-nom-affichage" checked={nomAffichage === val} onChange={() => setNomAffichage(val)} />
                    {lib}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Téléphone</label>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Adresse de facturation</label>
            {nouvelleAdresse ? (
              <p className="mb-1 flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700">
                <Check size={11} /> {nouvelleAdresse.label}
                <button onClick={() => setNouvelleAdresse(null)} className="ml-auto text-emerald-600 underline">annuler</button>
              </p>
            ) : (
              <p className="mb-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                {actuelle || <span className="italic text-amber-600">aucune — choisis-en une ci-dessous</span>}
              </p>
            )}
            <AutocompleteAdresse onSelection={setNouvelleAdresse} />
            <input
              value={nouvelleAdresseUnite}
              onChange={(e) => setNouvelleAdresseUnite(e.target.value)}
              placeholder="App. / bureau / casier postal (facultatif)"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <p className="mt-0.5 text-[9px] text-slate-400">
              Cette adresse s'imprime sous « Facturé à » sur les devis, bons de travail et factures.
            </p>
          </div>

          {/* 📇 CONTACTS SUR PLACE — le carnet du client. Offerts en
              liste déroulante à la création de tâche ; le technicien
              voit le contact choisi avec son bouton d'appel. */}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Contacts sur place (chantiers)</label>
            {contacts.length === 0 && (
              <p className="mb-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] italic text-slate-500">
                Aucun contact — ajoute la personne à voir sur place (chargé de projet, concierge…).
              </p>
            )}
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={c.nom}
                      onChange={(e) => majContact(c.id, { nom: e.target.value })}
                      placeholder="Nom (ex. : Marc Tremblay)"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      value={c.role || ""}
                      onChange={(e) => majContact(c.id, { role: e.target.value })}
                      placeholder="Rôle (chargé de projet…)"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      value={c.telephone || ""}
                      onChange={(e) => majContact(c.id, { telephone: e.target.value })}
                      placeholder="Téléphone"
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => retirerContact(c.id)}
                      className="shrink-0 rounded-lg border border-red-200 px-2 py-1.5 text-[10px] font-bold text-red-600"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={ajouterContact}
              className="mt-1.5 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-bold text-slate-500"
            >
              ➕ Ajouter un contact
            </button>
          </div>

          {raisonsFiche.length > 0 && (
            <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
              Pour enregistrer, il manque : {raisonsFiche.join(" · ")}.
            </p>
          )}
          <Button onClick={enregistrer} disabled={raisonsFiche.length > 0} className="w-full">Enregistrer les modifications</Button>
        </div>
      </div>
    </div>
  );
}


function GalerieAvantApres({ travail, enMarge = false }) {
  const [indexOuvert, setIndexOuvert] = useState(null);
  const [legendes, setLegendes] = useState({});
  const [zipEnCours, setZipEnCours] = useState("");

  const avant = travail.photosAvantUrls || [];
  const apres = travail.photosApresUrls || [];
  const photos = [
    ...avant.map((u, i) => ({ url: u, etiquette: `Avant ${i + 1}/${avant.length}`, section: "avant" })),
    ...apres.map((u, i) => ({ url: u, etiquette: `Après ${i + 1}/${apres.length}`, section: "apres" })),
  ];

  useEffect(() => {
    const urls = photos.map((p) => p.url);
    if (urls.length) listerLegendes(urls).then(setLegendes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travail.id]);

  const nomBase = `${String(travail.client || "photos").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${travail.date || ""}`;

  const telechargerZip = async (section) => {
    setZipEnCours(section);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const liste = photos.filter((p) => p.section === section);
      for (let i = 0; i < liste.length; i++) {
        const reponse = await fetch(liste[i].url);
        zip.file(`${nomBase}-${section}-${String(i + 1).padStart(2, "0")}.jpg`, await reponse.blob());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(blob);
      lien.download = `${nomBase}-${section}.zip`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch {
      // réseau — l'utilisateur peut télécharger photo par photo
    } finally {
      setZipEnCours("");
    }
  };

  const vignette = (p, indexGlobal) => (
    <button
      key={p.url + indexGlobal}
      onClick={() => setIndexOuvert(indexGlobal)}
      className="relative block aspect-square w-full overflow-hidden rounded-lg border border-slate-200"
      title="Ouvrir la visionneuse (flèches pour naviguer)"
    >
      <img src={p.url} alt={p.etiquette} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      {p.url.includes("-galerie") && (
        <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">📁 importée</span>
      )}
      {legendes[p.url] && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-left text-[8px] text-white">📝 {legendes[p.url]}</span>
      )}
    </button>
  );

  const section = (titre, cle, decalage, liste) => (
    liste.length > 0 && (
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{titre}</p>
          <button
            onClick={() => telechargerZip(cle)}
            disabled={zipEnCours !== ""}
            className="text-[10px] font-bold text-slate-400 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
          >
            {zipEnCours === cle ? "Préparation…" : "⬇️ Tout (.zip)"}
          </button>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {liste.map((p, i) => vignette(p, decalage + i))}
        </div>
      </div>
    )
  );

  return (
    <div className={`space-y-2 ${enMarge ? "mt-3" : ""}`}>
      {section("Photos avant travaux", "avant", 0, photos.filter((p) => p.section === "avant"))}
      {section("Photos après travaux", "apres", avant.length, photos.filter((p) => p.section === "apres"))}
      {indexOuvert != null && (
        <VisionneusePhotos
          photos={photos}
          indexDepart={indexOuvert}
          legendes={legendes}
          onFermer={() => setIndexOuvert(null)}
          onLegende={async (url, texte) => {
            setLegendes((prev) => ({ ...prev, [url]: texte }));
            const { data } = await supabase.auth.getSession();
            sauvegarderLegende(url, texte, data?.session).catch(() => {});
          }}
          nomFichier={(p, i) => `${nomBase}-${p.section}-${String(i + 1).padStart(2, "0")}.jpg`}
        />
      )}
    </div>
  );
}

// ============================================================
// 📜 ACCEPTATION DE L'ENTENTE — première connexion d'une entreprise
// cliente. L'admin principal coche « j'ai lu et j'accepte » au nom de
// son entreprise ; qui, quand et quelle version sont consignés. Le
// texte suit le STATUT : fondateur (1 an gratuit + 25 % à vie — les 3
// premiers seulement) ou régulier (la clause n'y apparaît JAMAIS).
// Le Propriétaire (DGL) est exempt. Les employés ne la voient pas —
// l'admin accepte pour l'entreprise, comme une signature de contrat.
// ============================================================
function EcranEntente({ config, session, onAcceptee }) {
  const [coche, setCoche] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const entente = ententePourStatut(config.statutPlateforme);
  const accepter = async () => {
    setEnvoi(true);
    try {
      await accepterEntente(config.id, entente.version, session);
      onAcceptee(new Date().toISOString());
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#131B2E] p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white">
        <div className="border-b border-slate-200 p-5">
          <h1 className="text-lg font-extrabold text-slate-900">📜 {entente.titre}</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            À lire et accepter avant la première utilisation — version {entente.version}
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm leading-relaxed text-slate-700">
          {entente.sections.map((sec) => (
            <section key={sec.titre}>
              <h2 className="mb-1 font-extrabold text-slate-900">{sec.titre}</h2>
              {sec.points.map((p, i) => (
                <p key={i} className="mb-1.5">{p}</p>
              ))}
            </section>
          ))}
        </div>
        <div className="border-t border-slate-200 p-5">
          <label className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-slate-800">
            <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#131B2E]" />
            <span>
              Au nom de <span className="font-extrabold">{config.nomCommercial || config.nomLegal}</span>, j'ai lu la
              présente entente (incluant l'Annexe A — Protection des données) et je l'accepte.
            </span>
          </label>
          <Button onClick={accepter} disabled={!coche} loading={envoi} className="mt-3 w-full">
            Accepter et entrer dans l'application
          </Button>
        </div>
      </div>
    </div>
  );
}

function OngletRecherche({ clients, devisListe, onOuvrirDevis, terme, setTerme }) {
  const q = terme.trim().toLowerCase();
  const resultats = terme.trim() ? clients.filter((c) => correspond(c, terme)) : [];

  // DEVIS trouvés : par numéro (« 3500 », « DEV-3500-1 »), par nom de
  // client, ou par CONTENU (un item du devis — « rooftop », « membrane »).
  // Regroupés par dossier pour ne pas répéter toutes les versions.
  const devisTrouves = (() => {
    if (!q) return [];
    const correspondDevis = (d) =>
      (d.numero || "").toLowerCase().includes(q) ||
      (d.numeroBase || "").toLowerCase().includes(q) ||
      (d.clientNom || "").toLowerCase().includes(q) ||
      (d.lignes || []).some((l) => (l.nom || "").toLowerCase().includes(q));
    const parBase = {};
    (devisListe || []).filter(correspondDevis).forEach((d) => {
      const base = d.numeroBase || d.numero;
      (parBase[base] = parBase[base] || []).push(d);
    });
    return Object.entries(parBase)
      .map(([base, versions]) => {
        const triees = versions.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
        return { base, versions: triees, active: triees.find((v) => v.versionActive !== false) || triees[triees.length - 1] };
      })
      .sort((a, b) => (b.active.date || "").localeCompare(a.active.date || ""));
  })();

  const total = resultats.length + devisTrouves.length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input
          autoFocus
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
          placeholder="Client, adresse, téléphone, nº de devis, produit..."
          className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm"
        />
      </div>

      {!terme.trim() && (
        <p className="text-center text-xs text-slate-400">
          Cherche un <span className="font-bold">client</span> (nom, entreprise, adresse, téléphone, courriel) ou un{" "}
          <span className="font-bold">devis</span> (numéro, client, produit inscrit dedans).
        </p>
      )}

      {terme.trim() && total === 0 && (
        <p className="text-center text-xs text-slate-400">Aucun résultat pour « {terme} ».</p>
      )}

      {total > 0 && (
        <p className="text-xs font-bold text-slate-400">{total} résultat{total > 1 ? "s" : ""}</p>
      )}

      {/* DEVIS — un clic ouvre le dossier du client, devis en évidence. */}
      {devisTrouves.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Devis ({devisTrouves.length})</p>
          {devisTrouves.map(({ base, versions, active }) => (
            <button
              key={base}
              onClick={() => onOuvrirDevis?.(active)}
              className="flex w-full items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-[#FF6A13] hover:bg-orange-50"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                  {active.numero}
                  {versions.length > 1 && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{versions.length} versions</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{active.clientNom}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {(active.lignes || []).map((l) => l.nom).filter(Boolean).slice(0, 3).join(" · ") || "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-slate-800">{active.totalVendant.toFixed(2)} $</p>
                <p className="text-[10px] text-slate-400">{active.date}</p>
                <span className="mt-0.5 inline-block text-[10px] font-bold text-[#FF6A13]">Ouvrir ›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {resultats.length > 0 && (
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Clients ({resultats.length})</p>
      )}
      <div className="space-y-2">
        {resultats.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{nomAffichageClient(c)}</p>
                {c.entreprise && <p className="text-xs font-semibold text-[#131B2E]">{c.entreprise}</p>}
              </div>
              {c.quickbooksCustomerId && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {c.quickbooksCustomerId}
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
              {(c.courriels || []).map((cc) => (
                <div key={cc.id} className="flex items-center gap-1.5">
                  <Mail size={11} /> {cc.email}
                  <span className="text-[10px] text-slate-400">({cc.label}{cc.defaut ? " · défaut" : ""})</span>
                </div>
              ))}
              {c.telephone && <div className="flex items-center gap-1.5"><Phone size={11} /> {c.telephone}</div>}
              {(c.adresses || []).map((a, idx) => (
                <div key={a.id} className="flex items-center gap-1.5">
                  <MapPin size={11} /> {a.nom} — {libelleAdresse(a)}
                  {idx === 0 && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-500" title="La première adresse de la fiche sert d'adresse de facturation">
                      Principale (facturation)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DÉTAIL D'UN TRAVAIL (passé ou à venir) — notes + photos
// ============================================================
// ============================================================
// APERÇU DU BON DE TRAVAIL — VERSION CLIENT
// ------------------------------------------------------------
// Ce que le client reçoit réellement : coordonnées d'entreprise,
// notes de terrain (jamais les notes internes), photos, montant s'il
// y a lieu, et confirmation de signature. Aucune information de coût
// interne ni note réservée à l'équipe n'apparaît ici.
// ============================================================
function ApercuBonTravailClient({ travail, clients, onFermer }) {
  const client = (clients || []).find((c) => c.id === travail.clientId);
  const adresse = travail.adresseTravaux || (client?.adresses?.[0] ? `${client.adresses[0].nom} — ${libelleAdresse(client.adresses[0])}` : null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-500">Aperçu — version envoyée au client</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-sm">
          <EnTeteEntreprise />
          <p className="mt-3 text-lg font-extrabold text-[#131B2E]">BON DE TRAVAIL</p>
          <p className="text-xs text-slate-500">Date : {travail.date}</p>
          <AdressesDocument
            clientNom={client?.nom || travail.clientNom}
            adresseFacturation={adresseFacturationClient(client)}
            adresseTravaux={adresse}
          />

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Description des travaux</p>
            <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {travail.noteTerrain || travail.titre || "Détails à venir."}
            </p>
          </div>

          {/* PHOTOS RÉELLES du chantier (stockage Supabase) — avant/après. */}
          {(travail.photosAvantUrls?.length > 0 || travail.photosApresUrls?.length > 0) && (
            <GalerieAvantApres travail={travail} enMarge />
          )}
          {/* Repli — anciennes lignes de démonstration (libellés seulement). */}
          {!(travail.photosAvantUrls?.length > 0 || travail.photosApresUrls?.length > 0) && travail.photos?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Photos</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {travail.photos.map((label, i) => (
                  <div key={i} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 p-1.5 text-center">
                    <Camera size={16} className="text-slate-400" />
                    <span className="text-[9px] leading-tight text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {travail.montant != null && (
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
              <span>Montant</span><span className="tabular-nums">{travail.montant.toFixed(2)} $</span>
            </div>
          )}

          <TermesConditions />

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-700">
            <FileCheck2 size={14} className="shrink-0" /> Signé électroniquement par le client à la fin de l'intervention
          </div>

          <PiedDocument />
        </div>

        <BoutonPDF type="bon-travail" travail={travail} clients={clients} />

        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — les notes internes et informations de coût ne sont jamais incluses dans le document réellement envoyé.
        </p>
      </div>
    </div>
  );
}

function DetailTravail({ travail, clients, onFermer, onReactiver }) {
  const [apercuClientOuvert, setApercuClientOuvert] = useState(false);
  const complete = travail.statut === "complete";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                complete ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-[#B14E0E]"
              }`}
            >
              {complete ? "COMPLÉTÉ" : "À VENIR"}
            </span>
            <h3 className="mt-1.5 text-sm font-extrabold text-slate-900">{travail.titre}</h3>
            <p className="text-xs text-slate-500">{travail.date}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {complete && travail.montant != null && (
          <p className="mb-3 text-sm font-bold tabular-nums text-slate-800">{travail.montant.toFixed(2)} $</p>
        )}

        {complete && (
          <Button variant="outline" onClick={() => setApercuClientOuvert(true)} className="mb-3 w-full min-h-0 gap-1.5 py-2 text-xs">
            <FileText size={13} /> Voir version client
          </Button>
        )}

        {travail.estTransport && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Kilométrage transport</p>
              <p className="text-sm font-bold tabular-nums text-slate-800">{(travail.distanceKm || 0).toFixed(1)} km</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Temps de transport</p>
              <p className="text-sm font-bold tabular-nums text-slate-800">{(travail.heures || 0).toFixed(2)} h</p>
            </div>
          </div>
        )}

        {complete && (() => {
          const DELAI_MODIFICATION_MS = 10 * 60 * 1000;
          const dansDelai = travail.envoyeA && Date.now() - travail.envoyeA <= DELAI_MODIFICATION_MS;
          return (
            <div className={`mb-3 rounded-xl border p-3 ${travail.modifReactivee || dansDelai ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <KeyRound size={13} />
                    Modification par l'employé
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {travail.modifReactivee
                      ? "Réactivée — l'employé peut modifier ce travail (2e signature client requise)."
                      : dansDelai
                      ? "Encore dans la fenêtre de 10 minutes suivant l'envoi — l'employé peut modifier sans réactivation (2e signature client requise)."
                      : "Verrouillée — le délai de 10 minutes suivant l'envoi est écoulé."}
                  </p>
                </div>
                <Button
                  variant={travail.modifReactivee ? "outline" : "primary"}
                  onClick={() => onReactiver(travail.id, !travail.modifReactivee)}
                  className="min-h-0 px-3 py-1.5 text-xs"
                >
                  {travail.modifReactivee ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            </div>
          );
        })()}

        <div className="mb-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes de terrain
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-emerald-700">
              Visible au client
            </span>
          </p>
          <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {travail.noteTerrain || "Aucune note pour l'instant."}
          </p>
        </div>

        <div className="mb-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes internes
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-slate-600">
              Non visible au client
            </span>
          </p>
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
            {travail.noteInterne || "Aucune note interne."}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Photos</p>
          {travail.photosAvantUrls?.length > 0 || travail.photosApresUrls?.length > 0 ? (
            <GalerieAvantApres travail={travail} />
          ) : travail.photos.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune photo pour l'instant.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {travail.photos.map((label, i) => (
                <div key={i} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 p-1.5 text-center">
                  <Camera size={16} className="text-slate-400" />
                  <span className="text-[9px] leading-tight text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Cette réactivation doit se synchroniser vers l'app technicien (via Supabase Realtime en prod) pour que l'employé y ait accès de son côté.
        </p>
      </div>
      {apercuClientOuvert && <ApercuBonTravailClient travail={travail} clients={clients} onFermer={() => setApercuClientOuvert(false)} />}
    </div>
  );
}

// ============================================================
// APERÇU DU COURRIEL DE CONNEXION
// ============================================================
function ApercuCourrielConnexion({ utilisateur, onFermer }) {
  const { nomLegal: nomEntreprise } = useEntreprise();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-[#FF6A13]" />
            <h3 className="text-sm font-extrabold">Lien de connexion envoyé</h3>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <p className="text-xs text-slate-400">À : {utilisateur.courriel}</p>
          <p className="mt-1 font-bold text-slate-800">Objet : Accès à l'application {nomEntreprise}</p>
          <p className="mt-2 text-slate-600">
            Bonjour {utilisateur.nom},<br /><br />
            Un accès ({utilisateur.typeAcces}) a été créé pour vous. Utilisez le lien ci-dessous pour vous connecter
            et créer votre mot de passe.
          </p>
          <p className="mt-2 truncate rounded-lg bg-slate-50 p-2 text-xs text-blue-600">
            https://app.ventilationdgl.com/connexion?u={utilisateur.nomUtilisateur}&jeton=xxxxxxxx
          </p>
          <p className="mt-2 text-xs text-slate-500">Nom d'utilisateur : <span className="font-bold">{utilisateur.nomUtilisateur}</span></p>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — l'envoi réel se fait via une fonction backend (service courriel transactionnel) avec un jeton à usage unique généré par Supabase Auth.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ONGLET UTILISATEURS
// ============================================================
// ============================================================
// FICHE PROFIL UTILISATEUR — ajout/modification des informations
// personnelles et du profil de l'employé
// ============================================================
function ModalProfilUtilisateur({ utilisateur, onFermer, onEnregistrer, onSupprimer, estAdminPrincipal, tauxMetiers }) {
  // Confirmation explicite avant suppression (2 clics).
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  // ENCADRÉ DE CHOIX (demande du propriétaire, 2026-08-18) : tout le
  // dossier de la personne dans UNE fenêtre — la fiche RH d'un côté,
  // les accès fins de l'autre (l'ancien panneau « Gestion des accès »
  // ne sert plus qu'aux accès sans fiche).
  const [ongletModal, setOngletModal] = useState("fiche");
  // La fiche d'un administrateur est INTOUCHABLE pour un Admin régulier
  // (même règle que dans Gestion des accès).
  const ficheAdministrateur = ["Admin principal", "Admin régulier", "Administrateur"].includes(utilisateur.typeAcces);
  const verrouillePourRegulier = !estAdminPrincipal && ficheAdministrateur;
  const [nom, setNom] = useState(utilisateur.nom || "");
  const [courriel, setCourriel] = useState(utilisateur.courriel || "");
  const [telephone, setTelephone] = useState(utilisateur.telephone || "");
  // Conversion des ANCIENNES valeurs de type d'accès (« Administrateur »,
  // « Employé ») vers les 5 rôles actuels — sans ça, une ancienne valeur
  // absente du menu semblait affichée correctement mais restait inchangée
  // à l'enregistrement.
  const [typeAcces, setTypeAcces] = useState(() => {
    const v = utilisateur.typeAcces;
    if (v === "Administrateur") return "Admin principal";
    if (v === "Employé") return "Technicien";
    // Anciens rôles autonomes → regroupés sous « Administration bureau ».
    if (v === "Chargé de projet" || v === "Répartiteur") return "Administration bureau";
    return TYPES_ACCES.includes(v) ? v : "Technicien";
  });
  // Métier NORMALISÉ selon le type d'accès converti : une fiche héritée
  // peut porter un métier qui n'est plus permis pour son type (ex. type
  // « Répartiteur » converti en Administration bureau avec un métier de
  // terrain) — on bascule alors sur le premier métier permis, sinon le
  // menu afficherait un choix trompeur sans changer la valeur.
  const [metier, setMetier] = useState(() => {
    const permis = metiersPourTypeAcces(typeAcces, tauxMetiers);
    return permis.includes(utilisateur.metier) ? utilisateur.metier : permis[0];
  });
  const [niveau, setNiveau] = useState(() => {
    const permis = metiersPourTypeAcces(typeAcces, tauxMetiers);
    const m = permis.includes(utilisateur.metier) ? utilisateur.metier : permis[0];
    const niveaux = niveauxPourMetier(m);
    return niveaux.includes(utilisateur.niveau) ? utilisateur.niveau : niveaux[0];
  });
  // Taux horaire INDIVIDUEL (métiers de bureau) et PRIME horaire
  // individuelle (métiers de terrain — s'ajoute à la grille CCQ).
  const [tauxHoraire, setTauxHoraire] = useState(utilisateur.tauxHoraire ?? 0);
  const [primeHoraire, setPrimeHoraire] = useState(utilisateur.primeHoraire ?? 0);
  // 💼 Droit acquis : payé au taux COMMERCIAL peu importe le secteur.
  const [toujoursCommercial, setToujoursCommercial] = useState(!!utilisateur.toujoursCommercial);
  const [poste, setPoste] = useState(utilisateur.poste || "");
  const [dateEmbauche, setDateEmbauche] = useState(utilisateur.dateEmbauche || "");
  const [adresse, setAdresse] = useState(utilisateur.adresse || "");
  const [notesRH, setNotesRH] = useState(utilisateur.notesRH || "");

  // GRILLE DES ACCÈS intégrée à la fiche : démarre sur les défauts du
  // type/métier, puis se remplace par les accès RÉELS du compte (table
  // permissions_utilisateurs) dès qu'ils sont chargés.
  const [sectionsAcces, setSectionsAcces] = useState(() => accesParDefautPour(
    (() => {
      const v = utilisateur.typeAcces;
      if (v === "Administrateur") return "Admin principal";
      if (v === "Employé") return "Technicien";
      if (v === "Chargé de projet" || v === "Répartiteur") return "Administration bureau";
      return TYPES_ACCES.includes(v) ? v : "Technicien";
    })(),
    utilisateur.metier
  ));
  useEffect(() => {
    const c = (utilisateur.courriel || "").trim().toLowerCase();
    if (!c) return;
    supabase
      .from("permissions_utilisateurs")
      .select("sections")
      .eq("email", c)
      .maybeSingle()
      .then(({ data }) => {
        if (Array.isArray(data?.sections)) setSectionsAcces(data.sections);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const basculerSectionAcces = (s) =>
    setSectionsAcces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const changerMetier = (m) => {
    setMetier(m);
    setNiveau(niveauxPourMetier(m)[0]);
    // Changer la sous-catégorie recharge ses accès par défaut.
    if (typeAcces === "Administration bureau") setSectionsAcces(accesParDefautPour(typeAcces, m));
  };

  // Le type d'accès et le métier restent cohérents : choisir
  // « Administration bureau » bascule sur un métier de bureau (sa
  // sous-catégorie), « Technicien » sur un métier de terrain.
  const changerTypeAcces = (t) => {
    setTypeAcces(t);
    const permis = metiersPourTypeAcces(t, tauxMetiers);
    const metierFinal = permis.includes(metier) ? metier : permis[0];
    if (metierFinal !== metier) {
      setMetier(metierFinal);
      setNiveau(niveauxPourMetier(metierFinal)[0]);
    }
    setSectionsAcces(accesParDefautPour(t, metierFinal));
  };

  const peutEnregistrer = nom.trim().length > 0 && courriel.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Profil de l'employé</h3>
            <p className="text-xs text-slate-500">@{utilisateur.nomUtilisateur}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {/* L'encadré de choix : Fiche employé ↔ Accès */}
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {[["fiche", "👤 Fiche employé"], ["acces", "🔑 Accès"]].map(([id, libelle]) => (
            <button
              key={id}
              onClick={() => setOngletModal(id)}
              className={`rounded-lg py-2 text-xs font-extrabold ${ongletModal === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {libelle}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {ongletModal === "fiche" && (<>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom complet</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Type d'accès</label>
              <select
                value={typeAcces}
                onChange={(e) => changerTypeAcces(e.target.value)}
                disabled={verrouillePourRegulier}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400"
              >
                {(estAdminPrincipal || verrouillePourRegulier ? TYPES_ACCES : TYPES_ACCES.filter((t) => t !== "Admin principal" && t !== "Admin régulier")).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">Enregistrer la fiche règle aussi les ACCÈS de ce compte (type + métier). Ajustements fins : onglet « 🔑 Accès » ci-dessus.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">
                Métier{typeAcces === "Administration bureau" ? " (sous-catégorie)" : ""}
              </label>
              <select value={metier} onChange={(e) => changerMetier(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                {metiersPourTypeAcces(typeAcces, tauxMetiers).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {estMetierBureau(metier) ? (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Taux horaire ($/h)</label>
                <InputNombreDecimal
                  valeur={tauxHoraire || 0}
                  onChange={(v) => setTauxHoraire(v)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                />
                <p className="mt-1 text-[10px] text-slate-400">Taux individuel — figé sur chaque heure au moment de la saisie.</p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Niveau</label>
                <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                  {niveauxPourMetier(metier).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
          {!estMetierBureau(metier) && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Prime horaire (+ $/h) — entente individuelle</label>
              <InputNombreDecimal
                valeur={primeHoraire || 0}
                onChange={(v) => setPrimeHoraire(v)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                S'ajoute à la grille CCQ (Tarifs). Taux coûtant réel = grille {metier} · {niveau} + prime. 0 = aucune entente.
              </p>
              <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700">
                <input type="checkbox" checked={toujoursCommercial} onChange={(e) => setToujoursCommercial(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#131B2E]" />
                <span>
                  💼 Payé au taux <span className="font-extrabold">COMMERCIAL en tout temps</span> (droit acquis)
                  <span className="block text-[10px] font-normal text-slate-400">
                    Même sur une tâche résidentielle, ses heures se figent au taux commercial — la feuille de temps suit sa paie réelle.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Courriel</label>
              <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
              <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Informations personnelles</p>
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Poste / fonction</label>
                <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Ex: Technicien senior" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Date d'embauche</label>
                  <input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Adresse</label>
                  <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Optionnel" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Notes internes (RH)</label>
                <textarea
                  value={notesRH}
                  onChange={(e) => setNotesRH(e.target.value)}
                  rows={3}
                  placeholder="Notes visibles seulement par les administrateurs"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          </>)}

          {/* ONGLET ACCÈS — la grille fine + les autorisations
              particulières (l'ancien panneau « Gestion des accès »,
              maintenant DANS le dossier de la personne). */}
          {ongletModal === "acces" && (<>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
            Le type d&apos;accès et le métier se choisissent dans la fiche — ici tu ajustes finement les sections
            visibles et les autorisations. Les changements prennent effet à sa <span className="font-bold">prochaine connexion</span>.
          </p>
          <GrilleAcces sections={sectionsAcces} onBasculer={basculerSectionAcces} desactive={verrouillePourRegulier} />
          {ROLES_AVEC_AUTORISATIONS.includes(typeAcces) && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Autorisations particulières</p>
              <div className="space-y-1.5">
                {AUTORISATIONS.map((a) => {
                  // L'Admin principal les possède d'office : case cochée
                  // et verrouillée plutôt que de laisser croire qu'on
                  // peut la lui retirer.
                  const impose = typeAcces === "Admin principal";
                  const coche = impose || sectionsAcces.includes(a);
                  return (
                    <label
                      key={a}
                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                        coche ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={impose || verrouillePourRegulier}
                        onChange={() => basculerSectionAcces(a)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
                      />
                      <span className="min-w-0">
                        {LIBELLES_AUTORISATIONS[a]}
                        {impose && <span className="ml-1 font-normal opacity-70">(toujours accordée à l&apos;Admin principal)</span>}
                        <span className="mt-0.5 block text-[10px] font-normal leading-snug opacity-80">{AIDES_AUTORISATIONS[a]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          </>)}

          <Button
            onClick={() =>
              onEnregistrer({
                nom,
                courriel,
                telephone,
                typeAcces,
                metier,
                niveau,
                // Métier de bureau : taux individuel (pas de prime) ;
                // métier de terrain : prime au-dessus de la grille CCQ.
                tauxHoraire: estMetierBureau(metier) ? Number(tauxHoraire) || 0 : null,
                primeHoraire: !estMetierBureau(metier) ? Number(primeHoraire) || 0 : null,
                toujoursCommercial: !estMetierBureau(metier) && toujoursCommercial,
                sectionsAcces,
                poste,
                dateEmbauche,
                adresse,
                notesRH,
              })
            }
            className="w-full"
            disabled={!peutEnregistrer || verrouillePourRegulier}
          >
            Enregistrer les modifications
          </Button>

          {verrouillePourRegulier && (
            <p className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
              <Lock size={12} className="shrink-0" /> Fiche d'un administrateur — modifiable par un Admin principal seulement.
            </p>
          )}

          {/* SUPPRESSION DE LA FICHE — retire l'employé du répertoire (et
              de l'agenda) et RÉVOQUE immédiatement tous ses accès.
              Confirmation en 2 clics. */}
          {onSupprimer && !verrouillePourRegulier && (
            confirmeSuppression ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                <p className="text-xs font-bold text-red-700">
                  Supprimer définitivement la fiche de {utilisateur.nom} ? Tous ses accès seront révoqués immédiatement (il ne pourra plus ouvrir ni l'admin ni l'app technicien).
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="danger" onClick={onSupprimer} className="min-h-0 flex-1 py-2 text-xs">
                    Oui, supprimer et révoquer les accès
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmeSuppression(false)} className="min-h-0 flex-1 py-2 text-xs">
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmeSuppression(true)} className="w-full min-h-0 border-red-200 py-2 text-xs text-red-600">
                <Trash2 size={13} /> Supprimer la fiche de l'employé…
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SelecteurItem({ catalogue, onChoisir, libelle = "+ Ajouter un produit" }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const champRef = useRef(null);

  useEffect(() => {
    if (ouvert && champRef.current) champRef.current.focus();
  }, [ouvert]);

  const resultats = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = catalogue || [];
    if (!t) return base.slice(0, 40);
    return base.filter((i) => `${i.nom} ${i.categorie}`.toLowerCase().includes(t)).slice(0, 40);
  }, [catalogue, q]);

  if (!ouvert) {
    return (
      <Button variant="outline" onClick={() => setOuvert(true)} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
        <Search size={12} /> {libelle}
      </Button>
    );
  }

  return (
    // 📱 PLEIN ÉCRAN SUR TÉLÉPHONE (2026-08-21) : choisir un item dans
    // un catalogue de 289 produits demande de la place et de gros
    // boutons — sur un écran de 6 pouces, la petite fenêtre obligeait à
    // viser. Sur ordinateur, rien ne change (fenêtre centrée).
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 sm:p-4 sm:pt-16" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setOuvert(false))(); }}>
      <div className="flex h-full w-full max-w-md flex-col bg-white p-3 sm:h-auto sm:rounded-2xl sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-slate-300 px-2.5 py-2.5">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input ref={champRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un item…" className="w-full text-base outline-none sm:text-sm" />
          <button onClick={() => setOuvert(false)} aria-label="Fermer" className="p-1"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="mt-2 flex-1 overflow-y-auto sm:max-h-[55vh] sm:flex-none">
          {(catalogue || []).length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">
              Catalogue vide — lance le snippet SQL « 26 » pour importer ta liste de prix.
            </p>
          ) : resultats.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">Aucun item ne correspond à « {q} ».</p>
          ) : (
            resultats.map((i) => (
              <button
                key={i.id}
                onClick={() => { onChoisir(i); setOuvert(false); setQ(""); }}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-slate-100 px-2 py-2.5 text-left last:border-0 active:bg-orange-50 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 sm:text-xs">{i.nom}</span>
                  {i.categorie && <span className="block truncate text-[11px] text-slate-400 sm:text-[10px]">{i.categorie}</span>}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700 sm:text-xs">
                  {i.prix_vendant != null ? `${i.prix_vendant.toFixed(2)} $` : "—"}
                </span>
              </button>
            ))
          )}
        </div>
        {!q && (catalogue || []).length > 40 && (
          <p className="mt-1 text-[10px] text-slate-400">40 premiers sur {catalogue.length} — tape pour chercher.</p>
        )}
      </div>
    </div>
  );
}

function OngletUtilisateurs({ utilisateurs, setUtilisateurs, ajouterJournal, tauxMetiers, persisterUtilisateur, supprimerUtilisateur, estAdminPrincipal }) {
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [typeAcces, setTypeAcces] = useState("Technicien");
  const [metier, setMetier] = useState(METIERS[0]);
  const [niveau, setNiveau] = useState(niveauxPourMetier(METIERS[0])[0]);
  // Taux individuel (métiers de bureau) / prime au-dessus de la grille
  // CCQ (métiers de terrain) — saisis dès la création de la fiche.
  const [tauxHoraire, setTauxHoraire] = useState(0);
  const [primeHoraire, setPrimeHoraire] = useState(0);
  const [toujoursCommercial, setToujoursCommercial] = useState(false);
  const [courrielAperçu, setCourrielAperçu] = useState(null);
  const [utilisateurOuvertId, setUtilisateurOuvertId] = useState(null);
  // 🔎 LISTE MAÎTRISÉE (demande du propriétaire, 2026-08-18) : la liste
  // défilait à l'infini. Recherche + filtre par type d'accès, fiches
  // REPLIÉES (nom + rôle) — le détail et les boutons s'ouvrent au tap.
  const [rechercheU, setRechercheU] = useState("");
  const [filtreAcces, setFiltreAcces] = useState("tous");
  const [uDeplie, setUDeplie] = useState(null);
  const utilisateursAffiches = useMemo(() => {
    const q = rechercheU.trim().toLowerCase();
    return utilisateurs
      .filter((u) => filtreAcces === "tous" || u.typeAcces === filtreAcces)
      .filter(
        (u) =>
          !q ||
          [u.nom, u.nomUtilisateur, u.courriel, u.telephone, u.metier, u.poste]
            .filter(Boolean)
            .some((c) => String(c).toLowerCase().includes(q))
      )
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  }, [utilisateurs, rechercheU, filtreAcces]);

  // GRILLE DES ACCÈS dans le formulaire de création : suit le type
  // d'accès + métier choisis, ajustable case par case avant de créer.
  const [sectionsAcces, setSectionsAcces] = useState(accesParDefautPour("Technicien"));
  const basculerSectionAcces = (s) =>
    setSectionsAcces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const changerMetier = (m) => {
    setMetier(m);
    setNiveau(niveauxPourMetier(m)[0]); // le niveau doit rester valide pour le métier
    if (typeAcces === "Administration bureau") setSectionsAcces(accesParDefautPour(typeAcces, m));
  };

  // Type d'accès et métier restent cohérents (voir metiersPourTypeAcces).
  const changerTypeAcces = (t) => {
    setTypeAcces(t);
    const permis = metiersPourTypeAcces(t, tauxMetiers);
    const metierFinal = permis.includes(metier) ? metier : permis[0];
    if (metierFinal !== metier) {
      setMetier(metierFinal);
      setNiveau(niveauxPourMetier(metierFinal)[0]);
    }
    setSectionsAcces(accesParDefautPour(t, metierFinal));
  };

  const reinitialiserFormulaire = () => {
    setNom("");
    setTelephone("");
    setCourriel("");
    setNomUtilisateur("");
    setTypeAcces("Technicien");
    setMetier(METIERS[0]);
    setNiveau(niveauxPourMetier(METIERS[0])[0]);
    setTauxHoraire(0);
    setPrimeHoraire(0);
    setSectionsAcces(accesParDefautPour("Technicien"));
  };

  const peutCreer = nom.trim() && courriel.trim() && nomUtilisateur.trim();

  // RÉSULTAT D'UNE INVITATION — un seul interprète pour les trois
  // gestes (créer, renvoyer, réinitialiser). Le journal ne dit
  // « envoyé » que si c'est VRAI ; en mode simulé (local) ou si le
  // courriel rate, le lien est copié dans le presse-papier de l'admin
  // pour transmission manuelle — jamais de trou noir.
  const journaliserInvitation = async (r, cible, contexte) => {
    if (r?.envoye) {
      ajouterJournal(
        `📧 ${contexte} — ${r.nouveau ? `compte créé et invitation envoyée à ${cible.courriel} (il choisit son mot de passe via le lien)` : `lien de réinitialisation envoyé à ${cible.courriel}`}`
      );
    } else if (r?.lien) {
      let copie = false;
      try {
        await navigator.clipboard?.writeText(r.lien);
        copie = true;
      } catch {
        window.prompt("Copie ce lien et transmets-le à l'employé :", r.lien);
      }
      ajouterJournal(
        `🔗 ${contexte} — ${r.simule ? "service de courriels non configuré ici (normal en local)" : `courriel NON parti (${r.erreur || "erreur"})`} ; le lien « choisir mot de passe » de ${cible.courriel} ${copie ? "est COPIÉ dans ton presse-papier" : "t'a été montré"} — transmets-le-lui.`
      );
    } else {
      ajouterJournal(`⚠️ ${contexte} — compte de connexion NON créé pour ${cible.courriel} : ${r?.erreur || "erreur inconnue"}.`);
    }
  };

  const creerUtilisateur = async () => {
    if (!peutCreer) return;
    const nouvel = {
      id: `u-${Date.now()}`,
      nom: nom.trim(),
      telephone: telephone.trim(),
      courriel: courriel.trim(),
      nomUtilisateur: nomUtilisateur.trim().toLowerCase(),
      typeAcces,
      metier,
      niveau,
      tauxHoraire: estMetierBureau(metier) ? Number(tauxHoraire) || 0 : null,
      primeHoraire: !estMetierBureau(metier) ? Number(primeHoraire) || 0 : null,
      toujoursCommercial: !estMetierBureau(metier) && toujoursCommercial,
      sectionsAcces,
      motDePasseCree: false,
    };
    setUtilisateurs((prev) => [...prev, nouvel]);
    // Persistance Supabase : l'employé survit aux rechargements et
    // apparaît durablement dans l'agenda (et la synchro des tâches).
    persisterUtilisateur?.(nouvel);
    ajouterJournal(`👤 Fiche "${nouvel.nom}" créée (${typeAcces})`);
    setFormulaireOuvert(false);
    reinitialiserFormulaire();
    // Le VRAI compte de connexion + l'invitation — la route serveur
    // fait tout (Auth + rôle en métadonnées + courriel Resend).
    if (nouvel.courriel) {
      const r = await inviterEmploye({
        courriel: nouvel.courriel,
        nom: nouvel.nom,
        role: nouvel.typeAcces,
        sousCategorie: nouvel.typeAcces === "Administration bureau" ? nouvel.metier : null,
      });
      await journaliserInvitation(r, nouvel, "Invitation");
    } else {
      ajouterJournal(`⚠️ "${nouvel.nom}" n'a pas de courriel — aucun compte de connexion créé. Ajoute son courriel puis « Renvoyer le lien ».`);
    }
  };

  const envoyerLienConnexion = async (u) => {
    const r = await inviterEmploye({
      courriel: u.courriel,
      nom: u.nom,
      role: u.typeAcces,
      sousCategorie: u.typeAcces === "Administration bureau" ? u.metier : null,
    });
    await journaliserInvitation(r, u, `Lien de connexion pour ${u.nom}`);
  };

  const reinitialiserMotDePasse = async (id) => {
    setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, motDePasseCree: false } : u)));
    const u = utilisateurs.find((x) => x.id === id);
    if (!u) return;
    const r = await inviterEmploye({ courriel: u.courriel, nom: u.nom, role: u.typeAcces });
    await journaliserInvitation(r, u, `Réinitialisation du mot de passe de ${u.nom}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Utilisateurs</h2>

      {/* "NOUVEL UTILISATEUR" — toujours en premier */}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white">
        <button
          onClick={() => setFormulaireOuvert((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6A13]/10">
            <UserPlus size={18} className="text-[#FF6A13]" />
          </div>
          <span className="font-bold text-slate-800">Nouvel utilisateur</span>
        </button>

        {formulaireOuvert && (
          <div className="space-y-3 border-t border-slate-200 p-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom complet</label>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Type d'accès</label>
              <select
                value={typeAcces}
                onChange={(e) => changerTypeAcces(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                {(estAdminPrincipal ? TYPES_ACCES : TYPES_ACCES.filter((t) => t !== "Admin principal" && t !== "Admin régulier")).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">Créer la fiche règle aussi les ACCÈS de ce compte (type + métier). Ajustements fins : bouton Modifier de la fiche → onglet « 🔑 Accès ».</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">
                  Métier{typeAcces === "Administration bureau" ? " (sous-catégorie)" : ""}
                </label>
                <select
                  value={metier}
                  onChange={(e) => changerMetier(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  {metiersPourTypeAcces(typeAcces, tauxMetiers).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              {estMetierBureau(metier) ? (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Taux horaire ($/h)</label>
                  <InputNombreDecimal
                    valeur={tauxHoraire || 0}
                    onChange={(v) => setTauxHoraire(v)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Niveau</label>
                  <select
                    value={niveau}
                    onChange={(e) => setNiveau(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                  >
                    {niveauxPourMetier(metier).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {!estMetierBureau(metier) && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Prime horaire (+ $/h) — entente individuelle (0 = aucune)</label>
                <InputNombreDecimal
                  valeur={primeHoraire || 0}
                  onChange={(v) => setPrimeHoraire(v)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                />
                <p className="mt-1 text-[10px] text-slate-400">S'ajoute à la grille CCQ (onglet Tarifs) pour cet employé seulement.</p>
                <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700">
                  <input type="checkbox" checked={toujoursCommercial} onChange={(e) => setToujoursCommercial(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#131B2E]" />
                  <span>
                    💼 Payé au taux <span className="font-extrabold">COMMERCIAL en tout temps</span> (droit acquis)
                    <span className="block text-[10px] font-normal text-slate-400">
                      Même sur une tâche résidentielle, ses heures se figent au taux commercial — la feuille de temps suit sa paie réelle.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {/* GESTION DES ACCÈS directement à la création : la grille suit
                le type d'accès + métier, ajustable case par case. */}
            <GrilleAcces sections={sectionsAcces} onBasculer={basculerSectionAcces} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Courriel</label>
                <input
                  type="email"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom d'utilisateur</label>
              <input
                value={nomUtilisateur}
                onChange={(e) => setNomUtilisateur(e.target.value)}
                placeholder="Ex: jtremblay"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <Button onClick={creerUtilisateur} disabled={!peutCreer} className="w-full">
              Créer l'utilisateur et envoyer le lien de connexion
            </Button>
          </div>
        )}
      </div>

      {/* RECHERCHE + FILTRE — la liste défilait à l'infini (2026-08-18). */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={rechercheU}
            onChange={(e) => setRechercheU(e.target.value)}
            placeholder="Chercher un nom, courriel, téléphone, métier…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["tous", ...TYPES_ACCES.filter((t) => utilisateurs.some((u) => u.typeAcces === t))].map((t) => (
            <button
              key={t}
              onClick={() => setFiltreAcces(t)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                filtreAcces === t ? "bg-[#131B2E] text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {t === "tous"
                ? `Tous (${utilisateurs.length})`
                : `${t} (${utilisateurs.filter((u) => u.typeAcces === t).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* LISTE DES UTILISATEURS — fiches repliées : le détail (contacts,
          statut, boutons) s'ouvre au tap sur la ligne. */}
      <div className="space-y-2">
        {utilisateursAffiches.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-400">
            Aucun utilisateur ne correspond à cette recherche.
          </p>
        )}
        {utilisateursAffiches.map((u) => {
          const ouvert = uDeplie === u.id;
          return (
          <div key={u.id} className="rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => setUDeplie(ouvert ? null : u.id)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{u.nom}</p>
                <p className="truncate text-xs text-slate-400">
                  @{u.nomUtilisateur}
                  {u.metier ? ` · ${u.metier}` : u.poste ? ` · ${u.poste}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {!u.motDePasseCree && (
                  <span title="En attente de première connexion" className="h-2 w-2 rounded-full bg-amber-400" />
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${COULEUR_TYPE_ACCES[u.typeAcces] || "bg-slate-100 text-slate-600"}`}>
                  {u.typeAcces}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${ouvert ? "rotate-180" : ""}`} />
              </span>
            </button>
            {ouvert && (
              <div className="border-t border-slate-100 p-3.5 pt-2.5">
                <div className="space-y-0.5 text-xs text-slate-500">
                  {u.poste && <div className="flex items-center gap-1.5"><Briefcase size={11} /> {u.poste}</div>}
                  {u.courriel && <div className="flex items-center gap-1.5"><Mail size={11} /> {u.courriel}</div>}
                  {u.telephone && <div className="flex items-center gap-1.5"><Phone size={11} /> {u.telephone}</div>}
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={11} />
                    {u.motDePasseCree ? "Mot de passe déjà créé" : "En attente de première connexion"}
                  </div>
                  {u.metier && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={11} /> {u.metier} · {u.niveau}
                      {Number(tauxMetiers?.[u.metier]?.[u.niveau]) > 0
                        ? ` · ${Number(tauxMetiers[u.metier][u.niveau]).toFixed(2)} $/h`
                        : " · taux à saisir"}
                    </div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={() => setUtilisateurOuvertId(u.id)} className="min-h-0 py-1.5 text-xs">
                    <Pencil size={12} /> Modifier
                  </Button>
                  <Button variant="outline" onClick={() => reinitialiserMotDePasse(u.id)} className="min-h-0 py-1.5 text-xs">
                    <KeyRound size={12} /> Mot de passe
                  </Button>
                  <Button onClick={() => envoyerLienConnexion(u)} className="min-h-0 py-1.5 text-xs">
                    <Send size={12} /> Lien
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {courrielAperçu && <ApercuCourrielConnexion utilisateur={courrielAperçu} onFermer={() => setCourrielAperçu(null)} />}
      {utilisateurOuvertId && (
        <ModalProfilUtilisateur
          tauxMetiers={tauxMetiers}
          utilisateur={utilisateurs.find((u) => u.id === utilisateurOuvertId)}
          estAdminPrincipal={estAdminPrincipal}
          onFermer={() => setUtilisateurOuvertId(null)}
          onEnregistrer={(champs) => {
            const existant = utilisateurs.find((u) => u.id === utilisateurOuvertId);
            setUtilisateurs((prev) => prev.map((u) => (u.id === utilisateurOuvertId ? { ...u, ...champs } : u)));
            if (existant) persisterUtilisateur?.({ ...existant, ...champs });
            ajouterJournal(`✏️ Profil de ${champs.nom || existant?.nom} mis à jour`);
            setUtilisateurOuvertId(null);
          }}
          onSupprimer={() => {
            const existant = utilisateurs.find((u) => u.id === utilisateurOuvertId);
            if (existant) supprimerUtilisateur?.(existant);
            setUtilisateurOuvertId(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// TABLEAU DE BORD D'UN PROJET (rentabilité en temps réel)
// ============================================================
// ============================================================
// ONGLETS DU TABLEAU DE BORD PROJET — sous-composants extraits pour
// alléger ModalDetailProjet et permettre à chaque onglet de ne
// recevoir que les données dont il a besoin.
// ============================================================
const ONGLETS_PROJET = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "achats", label: "Bons de commande" },
  { id: "temps", label: "Feuille de temps" },
  { id: "facturation", label: "Facturation" },
];

function OngletApercuProjet({ projet, r, sante, onChangerStatut, onSyncQuickBooks, syncQbEnCours, peutSyncQb }) {
  // Utilise la ventilation calculée par calculerRentabiliteProjet (même
  // logique par employé que r.coutMainOeuvre) — plus de recalcul au taux fixe.
  const coutMainOeuvreChantier = r.coutMainOeuvreChantier || 0;
  const coutTransport = r.coutTransport || 0;
  const donneesComparaison = useMemo(
    () => [
      { nom: "Budget", montant: Math.round(projet.budgetTotal) },
      { nom: "Coût réel", montant: Math.round(r.coutTotalReel) },
    ],
    [projet.budgetTotal, r.coutTotalReel]
  );
  const donneesRepartition = useMemo(
    () =>
      [
        { nom: "Main-d'œuvre", valeur: Math.round(coutMainOeuvreChantier) },
        { nom: "Matériaux", valeur: Math.round(r.coutMateriaux) },
        { nom: "Transport", valeur: Math.round(coutTransport) },
        // Bloc 5 — le camion est un coût comme les autres : 15 $/h pour
        // chaque heure d'un technicien qui en avait un ce jour-là.
        { nom: "Camion", valeur: Math.round(r.coutCamion || 0) },
      ].filter((d) => d.valeur > 0),
    [coutMainOeuvreChantier, r.coutMateriaux, coutTransport, r.coutCamion]
  );
  const COULEURS_REPARTITION = ["#131B2E", "#FF6A13", "#3B82F6", "#0EA5E9"];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sante.pastille}`} />
          <select
            value={projet.statut}
            onChange={(e) => onChangerStatut(projet.id, e.target.value)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700"
          >
            {STATUTS_PROJET.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Button
          variant="outline"
          onClick={peutSyncQb ? onSyncQuickBooks : undefined}
          disabled={!peutSyncQb}
          loading={syncQbEnCours}
          title={peutSyncQb ? undefined : "Réservé aux administrateurs"}
          className="min-h-0 gap-1.5 px-2.5 py-1.5 text-xs"
        >
          {!syncQbEnCours && (peutSyncQb ? <RefreshCw size={12} /> : <Lock size={12} />)} Synchroniser QuickBooks
        </Button>
      </div>

      {/* BARRE DE PROGRESSION FINANCIÈRE */}
      <div className={`mb-4 rounded-xl p-3.5 ${sante.niveau === "rouge" ? "bg-red-50" : sante.niveau === "jaune" ? "bg-amber-50" : "bg-slate-50"}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-600">Budget dépensé</span>
          {r.depassementBudget && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
              <AlertCircle size={11} /> Dépassement de budget
            </span>
          )}
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`}
            style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
          <span className={`font-semibold ${couleurSanteBudget(r.pourcentageDepense).texte}`}>
            {r.coutTotalReel.toFixed(2)} $ dépensé ({r.pourcentageDepense.toFixed(0)}%)
          </span>
          <span>Budget : {projet.budgetTotal.toFixed(2)} $</span>
        </div>
      </div>

      {/* RENTABILITÉ */}
      <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
        <div className="flex justify-between text-slate-500"><span>Coût matériaux/achats (BC)</span><span className="tabular-nums">{r.coutMateriaux.toFixed(2)} $</span></div>
        <div className="flex justify-between text-slate-500"><span>Heures de travail sur chantier</span><span className="tabular-nums">{r.heuresChantier} h</span></div>
        <div className="flex justify-between text-slate-500"><span>Heures de transport imputées</span><span className="tabular-nums">{r.heuresTransport} h</span></div>
        {r.kilometrageTransport > 0 && (
          <div className="flex justify-between text-slate-500"><span>Kilométrage transport</span><span className="tabular-nums">{r.kilometrageTransport.toFixed(1)} km</span></div>
        )}
        <div className="flex justify-between font-semibold text-slate-600"><span>Total heures projet</span><span className="tabular-nums">{r.totalHeures} h</span></div>
        <div className="flex justify-between text-slate-500"><span>Coût main-d'œuvre ({r.totalHeures} h × {projet.tauxHoraireCoutant.toFixed(2)} $)</span><span className="tabular-nums">{r.coutMainOeuvre.toFixed(2)} $</span></div>
        {(r.coutCamion || 0) > 0 && (
          <div className="flex justify-between text-slate-500"><span>Coût camion (heures avec véhicule)</span><span className="tabular-nums">{r.coutCamion.toFixed(2)} $</span></div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-700"><span>Coût total réel</span><span className="tabular-nums">{r.coutTotalReel.toFixed(2)} $</span></div>
        <div className="flex justify-between font-bold text-slate-800"><span>Budget initial</span><span className="tabular-nums">{projet.budgetTotal.toFixed(2)} $</span></div>
        <div className={`flex justify-between border-t border-slate-200 pt-1 text-sm font-extrabold ${r.profitReel < 0 ? "text-red-600" : "text-emerald-600"}`}>
          <span>Profit réel ({r.pourcentageMarge.toFixed(1)}%)</span><span className="tabular-nums">{r.profitReel.toFixed(2)} $</span>
        </div>
      </div>

      {/* RAPPORTS — GRAPHIQUES DE RENTABILITÉ */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <BarChart3 size={12} /> Rapports
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 p-2">
            <p className="mb-1 text-center text-[10px] font-semibold text-slate-500">Budget vs coût réel</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={donneesComparaison} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="nom" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v) => `${v} $`} />
                <Bar dataKey="montant" radius={[4, 4, 0, 0]}>
                  {donneesComparaison.map((entree, i) => (
                    <Cell key={i} fill={i === 1 && r.depassementBudget ? "#EF4444" : i === 1 ? "#10B981" : "#131B2E"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-slate-200 p-2">
            <p className="mb-1 text-center text-[10px] font-semibold text-slate-500">Répartition des dépenses</p>
            {donneesRepartition.length === 0 ? (
              <p className="flex h-[140px] items-center justify-center text-center text-[10px] text-slate-400">Aucune dépense enregistrée pour l'instant.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={donneesRepartition} dataKey="valeur" nameKey="nom" innerRadius={30} outerRadius={50} paddingAngle={2}>
                    {donneesRepartition.map((entree, i) => (
                      <Cell key={i} fill={COULEURS_REPARTITION[i % COULEURS_REPARTITION.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} $`} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OngletBonsCommandeProjet({ projet, onAjouterBC, onMajMateriel, r, transactionsQb, fournisseurs, setFournisseurs, ajouterJournal, clients }) {
  // 🧱 MATÉRIEL DU STOCK — pris sur la tablette du bureau, attribué à ce
  // projet (décision du propriétaire : bureau seulement, catalogue OU
  // coût manuel au choix — la liste de produits est grande).
  const catalogueStock = useCatalogue();
  const [stockForm, setStockForm] = useState(null); // {description, quantite, coutUnitaire, tacheTitre}
  const ajouterStock = () => {
    const f = stockForm;
    if (!f || !(f.description || "").trim() || !(Number(f.coutUnitaire) >= 0) || !(Number(f.quantite) > 0)) return;
    const quantite = Number(f.quantite) || 1;
    const coutUnitaire = Number(f.coutUnitaire) || 0;
    const entree = {
      id: "mat-" + Date.now(),
      description: f.description.trim(),
      quantite,
      coutUnitaire,
      coutTotal: Math.round(quantite * coutUnitaire * 100) / 100,
      tacheTitre: (f.tacheTitre || "").trim() || null,
      date: todayISO(),
    };
    onMajMateriel?.([...(projet.materielStock || []), entree]);
    ajouterJournal("🧱 Matériel du stock ajouté au projet « " + projet.nom + " » : " + entree.description + " ×" + quantite + " = " + entree.coutTotal.toFixed(2) + " $");
    setStockForm(null);
  };
  const tachesDuProjet = [...new Set((r?.travauxDuProjet || []).map((t) => t.titre).filter(Boolean))];
  // Dépenses QuickBooks de ce projet, indexées par numéro de BC — sert à
  // montrer quels BC ont déjà leur facture fournisseur réelle (le montant
  // de QuickBooks fait alors foi, jamais additionné au montant saisi).
  const depensesParBc = new Map(
    (transactionsQb || [])
      .filter((t) => t.projectId === projet.id && t.type === "EXPENSE" && (t.poNumber || t.cible?.bc))
      .map((t) => [String(t.cible?.bc || t.poNumber).trim().toUpperCase(), t])
  );
  const [bcFournisseurId, setBcFournisseurId] = useState("");
  const [bcMontant, setBcMontant] = useState("");
  const [bcNumero, setBcNumero] = useState("");
  const [bcDescription, setBcDescription] = useState("");
  const [modalFournisseur, setModalFournisseur] = useState(false);
  // Envoi du BC au fournisseur : choix des adresses avant création.
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const [courrielsChoisis, setCourrielsChoisis] = useState([]);

  const fournisseurChoisi = (fournisseurs || []).find((f) => f.id === bcFournisseurId) || null;
  const adresseLivraison =
    projet.adresseLivraison ||
    (clients || []).find((c) => c.id === projet.clientId)?.adresses?.[0]?.ligne1 ||
    null;

  const choisirFournisseur = (id) => {
    setBcFournisseurId(id);
    const f = (fournisseurs || []).find((x) => x.id === id);
    setCourrielsChoisis((f?.courriels || []).filter((c) => c.defaut).map((c) => c.email));
  };

  // Étape 1 : si le fournisseur a des courriels, proposer l'envoi.
  const demarrerAjoutBC = () => {
    if (!fournisseurChoisi) return;
    if ((fournisseurChoisi.courriels || []).length > 0) {
      setEnvoiOuvert(true);
      return;
    }
    creerBC([]);
  };

  // Étape 2 : création du BC + envoi (simulé) du bon au fournisseur.
  const creerBC = async (destinataires) => {
    setEnvoiOuvert(false);
    // Numéro saisi à la main, sinon prochain numéro SÉQUENTIEL de la base.
    let numero = bcNumero.trim();
    if (!numero) {
      try {
        numero = await numeroBonCommande();
      } catch {
        numero = genererNumeroSecours("BC");
        ajouterJournal?.("⚠️ Numéro de BC séquentiel indisponible — numéro de secours attribué, à corriger manuellement.");
      }
    }
    onAjouterBC(projet.id, {
      id: `bc-${Date.now()}`,
      numeroBC: numero,
      fournisseur: fournisseurChoisi?.nom || "",
      fournisseurId: fournisseurChoisi?.id || null,
      description: bcDescription.trim(),
      // Le MONTANT est optionnel : un BC créé sans montant (0 $) se
      // remplira tout seul quand la facture fournisseur portant le même
      // numéro arrivera de QuickBooks (voir calculerRentabiliteProjet).
      montantHT: parseFloat(bcMontant) || 0,
      statut: destinataires.length > 0 ? "Envoyé au fournisseur" : "En attente",
      courrielsEnvoi: destinataires,
      date: todayISO(),
    });
    ajouterJournal?.(
      destinataires.length > 0
        ? `📧 Bon de commande ${numero} envoyé à ${fournisseurChoisi?.nom} (${destinataires.join(", ")}) — ${bcDescription.trim() || "sans description"}${adresseLivraison ? ` · livraison : ${adresseLivraison}` : ""}`
        : `📋 Bon de commande ${numero} créé pour ${fournisseurChoisi?.nom || "fournisseur"} — aucun courriel envoyé`
    );
    setBcFournisseurId("");
    setBcMontant("");
    setBcNumero("");
    setBcDescription("");
    setCourrielsChoisis([]);
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Bons de commande</p>
      <div className="space-y-1.5">
        {(projet.bonsCommande || []).map((bc) => {
          const depenseQb = depensesParBc.get(String(bc.numeroBC || "").trim().toUpperCase());
          const montantAffiche = depenseQb ? Number(depenseQb.amountHT) || 0 : Number(bc.montantHT) || 0;
          return (
            <div key={bc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{bc.numeroBC} — {bc.fournisseur}</p>
                {bc.description && <p className="mt-0.5 whitespace-pre-line text-[11px] text-slate-600">{bc.description}</p>}
                <p className="text-[10px] text-slate-400">{bc.date} · {bc.statut}</p>
                {bc.courrielsEnvoi?.length > 0 && (
                  <p className="mt-0.5 text-[10px] font-semibold text-blue-600">📧 Envoyé à {bc.courrielsEnvoi.join(", ")}</p>
                )}
                {depenseQb ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-bold text-emerald-600">
                      ✓ Montant réel de QuickBooks ({depenseQb.status === "PAID" ? "payée" : "à payer"})
                    </p>
                    {Number(bc.montantHT) > 0 && Math.abs(Number(bc.montantHT) - montantAffiche) > 1 && (
                      <p className="mt-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        ⚠️ Écart de prix — BC : {Number(bc.montantHT).toFixed(2)} $ · QuickBooks : {montantAffiche.toFixed(2)} $ ({montantAffiche > Number(bc.montantHT) ? "+" : ""}{(montantAffiche - Number(bc.montantHT)).toFixed(2)} $) — le prix est-il bon ?
                      </p>
                    )}
                  </>
                ) : Number(bc.montantHT) === 0 ? (
                  <p className="mt-0.5 text-[10px] font-bold text-amber-600">⏳ En attente de la facture QuickBooks (BC {bc.numeroBC})</p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-slate-400">Estimation saisie — sera remplacée par le montant de QuickBooks</p>
                )}
              </div>
              <span className={`shrink-0 font-bold tabular-nums ${depenseQb ? "text-emerald-700" : montantAffiche === 0 ? "text-amber-600" : "text-slate-700"}`}>
                {montantAffiche.toFixed(2)} $
              </span>
            </div>
          );
        })}
        {(projet.bonsCommande || []).length === 0 && <p className="text-xs text-slate-400">Aucun bon de commande pour l'instant.</p>}
      </div>
      {/* 🧱 MATÉRIEL DU STOCK — déjà payé, sur la tablette : un coût du
          projet sans bon de commande. Catalogue (coûtant auto) OU saisie
          manuelle, tâche précise facultative. */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">🧱 Matériel du stock (sans commande)</p>
        {(projet.materielStock || []).map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 text-xs last:border-0">
            <span className="min-w-0 truncate text-slate-700">
              {m.description} <span className="text-slate-400">×{m.quantite}</span>
              {m.tacheTitre && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{m.tacheTitre}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-bold tabular-nums text-slate-700">{(Number(m.coutTotal) || 0).toFixed(2)} $</span>
              <button
                onClick={() => onMajMateriel?.((projet.materielStock || []).filter((x) => x.id !== m.id))}
                className="text-slate-300 hover:text-red-500"
                aria-label="Retirer"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        ))}
        {(projet.materielStock || []).length === 0 && !stockForm && (
          <p className="text-xs text-slate-400">Rien pour l'instant — « 4 paquets de tuyaux pris au bureau », c'est ici.</p>
        )}
        {stockForm ? (
          <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2">
            <SelecteurItem
              catalogue={catalogueStock}
              libelle="🔎 Choisir du catalogue (coûtant automatique)"
              onChoisir={(item) =>
                setStockForm((f) => ({
                  ...f,
                  description: item.nom,
                  coutUnitaire: item.prix_coutant != null ? item.prix_coutant : f.coutUnitaire,
                }))
              }
            />
            <input
              value={stockForm.description}
              onChange={(e) => setStockForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="ou description libre — ex : paquet de tuyaux 6po"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                Qté
                <input type="number" min={1} value={stockForm.quantite}
                  onChange={(e) => setStockForm((f) => ({ ...f, quantite: e.target.value }))}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                Coût unitaire
                <InputNombreDecimal valeur={Number(stockForm.coutUnitaire) || 0}
                  onChange={(v) => setStockForm((f) => ({ ...f, coutUnitaire: v }))}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                $
              </span>
              <span className="text-[11px] font-bold tabular-nums text-slate-600">
                = {((Number(stockForm.quantite) || 0) * (Number(stockForm.coutUnitaire) || 0)).toFixed(2)} $
              </span>
            </div>
            {tachesDuProjet.length > 0 && (
              <select
                value={stockForm.tacheTitre || ""}
                onChange={(e) => setStockForm((f) => ({ ...f, tacheTitre: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="">Projet en général (aucune tâche précise)</option>
                {tachesDuProjet.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <div className="flex gap-1.5">
              <Button onClick={ajouterStock}
                disabled={!(stockForm.description || "").trim() || !(Number(stockForm.quantite) > 0)}
                className="min-h-0 flex-1 py-1.5 text-xs">
                Ajouter au projet
              </Button>
              <Button variant="outline" onClick={() => setStockForm(null)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setStockForm({ description: "", quantite: 1, coutUnitaire: 0, tacheTitre: "" })}
            className="mt-2 min-h-0 w-full py-1.5 text-xs">
            ➕ Matériel utilisé (du stock)
          </Button>
        )}
      </div>

      {/* NOUVEAU BON DE COMMANDE — le fournisseur vient du répertoire, la
          description part dans le courriel, et le BC peut être envoyé
          directement au fournisseur à sa création. */}
      <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nouveau bon de commande</p>
        <select
          value={bcFournisseurId}
          onChange={(e) => {
            if (e.target.value === "__nouveau__") {
              setModalFournisseur(true);
              return;
            }
            choisirFournisseur(e.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold"
        >
          <option value="">— Choisir un fournisseur —</option>
          <option value="__nouveau__">➕ Nouveau fournisseur…</option>
          {(fournisseurs || []).map((f) => (
            <option key={f.id} value={f.id}>{f.nom}</option>
          ))}
        </select>
        <textarea
          value={bcDescription}
          onChange={(e) => setBcDescription(e.target.value)}
          rows={2}
          placeholder="Ce qui est commandé (ex : 12 × membrane élastomère, livraison au chantier)"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <input value={bcNumero} onChange={(e) => setBcNumero(e.target.value)} placeholder="N° BC (auto si vide)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <input
            type="number" min={0} step="0.01" value={bcMontant} onChange={(e) => setBcMontant(e.target.value)}
            placeholder="Montant avant taxes $ (optionnel)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <Button variant="outline" onClick={demarrerAjoutBC} disabled={!fournisseurChoisi} className="w-full min-h-0 py-1.5 text-xs">
          <Plus size={12} /> {fournisseurChoisi && (fournisseurChoisi.courriels || []).length > 0 ? "Créer et envoyer le BC" : "Ajouter le BC"}
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
        Montant <span className="font-bold">avant taxes</span> (les taxes payées aux fournisseurs sont récupérables, donc jamais comptées comme coût).
        Tu peux le laisser vide : il se remplira automatiquement quand la facture fournisseur portant ce numéro de BC arrivera de QuickBooks.
      </p>

      {modalFournisseur && (
        <ModalNouveauFournisseur
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
          onFermer={() => setModalFournisseur(false)}
          onSelection={choisirFournisseur}
        />
      )}

      {/* ENVOI DU BON DE COMMANDE AU FOURNISSEUR — choix multiple des
          adresses + aperçu de ce qui part. */}
      {envoiOuvert && fournisseurChoisi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setEnvoiOuvert(false))(); }}>
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-slate-900">📧 Envoyer le bon de commande</h3>
            <p className="mt-0.5 text-xs text-slate-500">À {fournisseurChoisi.nom} — coche une ou plusieurs adresses.</p>
            <div className="mt-3 space-y-1.5">
              {(fournisseurChoisi.courriels || []).map((c) => (
                <label
                  key={c.email}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 ${
                    courrielsChoisis.includes(c.email) ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={courrielsChoisis.includes(c.email)}
                    onChange={() =>
                      setCourrielsChoisis((prev) => (prev.includes(c.email) ? prev.filter((x) => x !== c.email) : [...prev, c.email]))
                    }
                    className="h-4 w-4 shrink-0 accent-[#FF6A13]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-800">{c.email}</span>
                    <span className="block text-[11px] text-slate-500">{c.label}{c.defaut ? " · défaut" : ""}</span>
                  </span>
                </label>
              ))}
            </div>
            {/* Aperçu de ce qui sera envoyé */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              <p className="font-bold text-slate-800">Bon de commande {bcNumero.trim() || "(numéro automatique)"}</p>
              <p className="mt-1 whitespace-pre-wrap">{bcDescription.trim() || "— aucune description saisie —"}</p>
              {adresseLivraison && <p className="mt-1">📍 Livraison : {adresseLivraison}</p>}
              <p className="mt-1 text-slate-400">Projet : {projet.nom}</p>
            </div>
            <div className="mt-4 space-y-2">
              <Button onClick={() => creerBC(courrielsChoisis)} disabled={courrielsChoisis.length === 0} className="w-full">
                Envoyer le BC{courrielsChoisis.length > 1 ? ` (${courrielsChoisis.length} adresses)` : ""}
              </Button>
              <Button variant="outline" onClick={() => creerBC([])} className="w-full">
                Créer sans envoyer de courriel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OngletTempsProjet({ r }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
        Tâches & heures ({r.heuresChantier} h chantier + {r.heuresTransport} h transport = {r.totalHeures} h)
      </p>
      <div className="space-y-1.5">
        {r.travauxDuProjet.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              {t.estTransport && <Car size={12} className="shrink-0 text-slate-400" />}
              <div>
                <p className="font-semibold text-slate-800">{t.titre}</p>
                <p className="text-[10px] text-slate-400">{t.date}{t.estTransport ? " · imputation automatique" : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold tabular-nums text-slate-700">{t.heures || 0} h</p>
              {t.estTransport && t.distanceKm > 0 && (
                <p className="text-[10px] tabular-nums text-slate-400">{t.distanceKm.toFixed(1)} km</p>
              )}
            </div>
          </div>
        ))}
        {r.travauxDuProjet.length === 0 && <p className="text-xs text-slate-400">Aucune tâche rattachée à ce projet pour l'instant.</p>}
      </div>
    </div>
  );
}

function OngletFacturationProjet({ r, devisDuClient }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Finances — Factures & dépenses QuickBooks ({r.transactionsDuProjet.length})
        </p>
        {r.transactionsDuProjet.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune transaction QuickBooks synchronisée pour ce projet. Clique "Synchroniser QuickBooks" dans l'onglet Vue d'ensemble.</p>
        ) : (
          <div className="space-y-1.5">
            {r.transactionsDuProjet.map((t) => (
              <div key={t.quickbooksId} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                <div className="flex items-center gap-2">
                  {t.type === "INVOICE" ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">VENTE</span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">DÉPENSE</span>
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">{t.quickbooksId}</p>
                    <p className="text-[10px] text-slate-400">{t.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-slate-700">{t.amountHT.toFixed(2)} $ HT</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    t.status === "PAID" ? "bg-emerald-100 text-emerald-700" : t.status === "UNPAID" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                  }`}>
                    {t.status === "PAID" ? <CheckCircle2 size={10} /> : t.status === "UNPAID" ? <AlertTriangle size={10} /> : <Cloud size={10} />}
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-[11px] font-semibold text-slate-500">
              <span>Total facturé réel (encaissé/à encaisser)</span>
              <span className="tabular-nums">{r.totalFactureReel.toFixed(2)} $</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Facturation progressive</p>
        {devisDuClient.length === 0 ? (
          <p className="text-xs text-slate-400">Aucun devis pour ce client — voir l'onglet Devis pour en créer un, puis l'onglet Facturation pour les acomptes.</p>
        ) : (
          <div className="space-y-1">
            {devisDuClient.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                <span className="font-semibold text-slate-800">{d.numero}</span>
                <span className="tabular-nums text-slate-600">{d.totalVendant.toFixed(2)} $</span>
              </div>
            ))}
            <p className="text-[10px] text-slate-400">Voir l'onglet Facturation pour émettre les acomptes/factures de situation.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalDetailProjet({ projet, travaux, devisListe, transactionsQb, clients, utilisateurs, tauxMetiers, onFermer, onAjouterBC, onMajMateriel, onChangerStatut, onSyncQuickBooks, onAssignerTransaction, syncQbEnCours, peutSyncQb, fournisseurs, setFournisseurs, ajouterJournal, inspections }) {
  const [ongletActif, setOngletActif] = useState("apercu");
  const configProj = useEntreprise();
  const r = useMemo(
    () => calculerRentabiliteProjet(projet, travaux, transactionsQb, utilisateurs, tauxMetiers, inspections || [], Number(configProj?.coutCamionHoraire) || 0),
    [projet, travaux, transactionsQb, utilisateurs, tauxMetiers, inspections, configProj]
  );
  const sante = useMemo(() => evaluerSanteProjet(projet, r), [projet, r]);
  const devisDuClient = useMemo(() => devisListe.filter((d) => d.clientId === projet.clientId), [devisListe, projet.clientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white">
        <div className="p-5 pb-0">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{projet.nom}</h3>
              <p className="text-xs text-slate-500">{projet.dateDebut} → {projet.dateFin}</p>
              {projet.adresseTravaux && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin size={11} /> {projet.adresseTravaux}
                </p>
              )}
            </div>
            <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
          </div>

          {/* ONGLETS */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {ONGLETS_PROJET.map((o) => (
              <button
                key={o.id}
                onClick={() => setOngletActif(o.id)}
                className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold ${
                  ongletActif === o.id ? "border-[#131B2E] text-[#131B2E]" : "border-transparent text-slate-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {ongletActif === "apercu" && (
            <OngletApercuProjet projet={projet} r={r} sante={sante} onChangerStatut={onChangerStatut} onSyncQuickBooks={onSyncQuickBooks} syncQbEnCours={syncQbEnCours} peutSyncQb={peutSyncQb} />
          )}
          {ongletActif === "achats" && <OngletBonsCommandeProjet projet={projet} onAjouterBC={onAjouterBC} onMajMateriel={onMajMateriel} r={r} transactionsQb={transactionsQb} fournisseurs={fournisseurs} setFournisseurs={setFournisseurs} ajouterJournal={ajouterJournal} clients={clients} />}
          {ongletActif === "temps" && <OngletTempsProjet r={r} />}
          {ongletActif === "facturation" && <OngletFacturationProjet r={r} devisDuClient={devisDuClient} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HUB PROJETS & RENTABILITÉ — vue générale, recherche/filtres,
// cartes synthétiques de tous les projets
// ============================================================
const FILTRES_STATUT_HUB = ["Tous", "À planifier", "En cours", "Facturation d'acompte", "Terminé", "En retard"];

const LigneProjetClient = React.memo(function LigneProjetClient({ p, travaux, transactionsQb, utilisateurs, tauxMetiers, onOuvrir }) {
  const r = useMemo(() => calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers), [p, travaux, transactionsQb, utilisateurs, tauxMetiers]);
  const sante = evaluerSanteProjet(p, r);
  return (
    <button
      onClick={() => onOuvrir(p.id)}
      className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${sante.pastille}`} />
          <div>
            <p className="text-xs font-bold text-slate-800">{p.nom}</p>
            <p className="text-[10px] text-slate-400">{p.statut} · {p.dateDebut} → {p.dateFin || "?"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-right">
          <p className={`text-xs font-bold tabular-nums ${sante.texte}`}>
            {r.pourcentageMarge.toFixed(0)}% marge
          </p>
          <ChevronRight size={12} className="text-slate-300" />
        </div>
      </div>
      {/* Micro-jauge : budget consommé (coût réel / budget), couleur = santé */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`}
            style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }}
          />
        </div>
        <span className="shrink-0 text-[9px] font-semibold tabular-nums text-slate-400">
          {r.pourcentageDepense.toFixed(0)}%
        </span>
      </div>
    </button>
  );
});

const CarteProjet = React.memo(function CarteProjet({ p, client, travaux, transactionsQb, utilisateurs, tauxMetiers, onOuvrir, draggable, onDragStart, compact }) {
  const r = useMemo(() => calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers), [p, travaux, transactionsQb, utilisateurs, tauxMetiers]);
  const avancementCalendrier = useMemo(() => calculerAvancementCalendrier(p), [p]);
  const enRetard = projetEnRetard(p);
  const enPerte = r.profitReel < 0;

  return (
    <button
      onClick={() => onOuvrir(p.id)}
      draggable={draggable}
      onDragStart={onDragStart}
      className={`w-full rounded-2xl border border-slate-200 bg-white text-left hover:border-slate-300 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-bold text-slate-900 ${compact ? "text-xs" : "text-sm"}`}>{p.nom}</p>
          <p className="text-[11px] text-slate-500">{client?.nom}{!compact && ` · ${p.statut}`}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {r.depassementBudget && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
              <AlertCircle size={10} /> {!compact && "Risque de dépassement"}
            </span>
          )}
          {enPerte && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
              <AlertCircle size={10} /> {!compact && "En perte"}
            </span>
          )}
          {enRetard && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              <Clock size={10} /> {!compact && "En retard"}
            </span>
          )}
        </div>
      </div>

      {/* Double barre de progression : budget vs calendrier */}
      <div className="mt-3 space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] font-semibold text-slate-400">
            <span>Budget consommé</span><span>{r.pourcentageDepense.toFixed(0)}%</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`} style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }} />
          </div>
        </div>
        {!compact && avancementCalendrier !== null && (
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-slate-400">
              <span>Avancement calendrier</span><span>{avancementCalendrier.toFixed(0)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${avancementCalendrier}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Chiffres clés */}
      <div className="mt-3 grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Budget</p>
          <p className="text-xs font-bold tabular-nums text-slate-800">{p.budgetTotal.toFixed(0)} $</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Coûts réels</p>
          <p className="text-xs font-bold tabular-nums text-slate-800">{r.coutTotalReel.toFixed(0)} $</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Profit</p>
          <p className={`text-xs font-bold tabular-nums ${enPerte ? "text-red-600" : "text-emerald-600"}`}>
            {r.profitReel.toFixed(0)} $ ({r.pourcentageMarge.toFixed(0)}%)
          </p>
        </div>
      </div>
    </button>
  );
});

function OngletProjetsHub({ projets, setProjets, clients, travaux, devisListe, transactionsQb, bonsTravail = [], utilisateurs, tauxMetiers, syncQbEnCours, onSyncQuickBooks, onAssignerTransaction, ajouterJournal, peutSyncQb, fournisseurs, setFournisseurs, inspections }) {
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("Tous");
  const [filtreClientId, setFiltreClientId] = useState("");
  const [projetOuvertId, setProjetOuvertId] = useState(null);
  const [assignationManuelleId, setAssignationManuelleId] = useState(null);
  const [vueAffichage, setVueAffichage] = useState("liste"); // "liste" | "kanban"
  const [colonneSurvolee, setColonneSurvolee] = useState(null);

  const projetOuvert = projets.find((p) => p.id === projetOuvertId) || null;
  // ============================================================
  // FACTURES QUICKBOOKS NON ASSIGNÉES — REPLIÉES PAR DÉFAUT
  // ------------------------------------------------------------
  // Retour du propriétaire (2026-08-24) : le bloc occupait tout le haut
  // de la page Projets, avec un triangle rouge par ligne — ça laissait
  // croire à un problème alors qu'il n'y en a pas. Et ça va empirer, pas
  // s'améliorer : le jour où le vrai QuickBooks remplace le Sandbox,
  // cette liste comptera des centaines de vraies factures.
  //
  // Deux décisions :
  //   • replié par défaut — rien n'est caché, une ligne suffit à dire
  //     combien il y en a, on déplie quand on vient FAIRE du classement ;
  //   • les factures à 0,00 $ sont écartées — un montant nul ne change
  //     aucune marge, le classer ne sert donc à rien.
  // ============================================================
  const [blocQbOuvert, setBlocQbOuvert] = useState(false);
  // 🔧 Les JOBS auxquelles on peut rattacher une dépense : les bons de
  // travail (une job facturable = un bon), les plus récents d'abord.
  // C'est la même clé `tacheId` que les achats saisis à la main.
  const jobsRattachables = useMemo(() => {
    const vues = new Set();
    return (bonsTravail || [])
      .filter((b) => b.tacheId && !vues.has(b.tacheId) && vues.add(b.tacheId))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 60)
      .map((b) => ({
        id: b.tacheId,
        libelle: `${b.date || ""} · ${b.projet || "Travail"}${b.client ? ` — ${b.client}` : ""}`,
      }));
  }, [bonsTravail]);

  const transactionsSansProjet = transactionsQb.filter((t) => !t.cible);
  const transactionsNonAssignees = transactionsSansProjet.filter(
    (t) => Math.abs(Number(t.amountHT) || 0) > 0
  );
  const nbQbMontantNul = transactionsSansProjet.length - transactionsNonAssignees.length;
  // 🚫 Transactions marquées « Hors Fluxya » — sorties de la liste mais
  // jamais perdues : un petit tiroir permet de les remettre à classer.
  const transactionsHorsFluxya = transactionsQb.filter((t) => t.cible?.type === "hors");
  const [horsFluxyaOuvert, setHorsFluxyaOuvert] = useState(false);

  const ajouterBonCommandeProjet = (projetId, bc) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, bonsCommande: [...(p.bonsCommande || []), bc] } : p)));
    const p = projets.find((x) => x.id === projetId);
    ajouterJournal(`📦 BC ${bc.numeroBC} (${bc.montantHT.toFixed(2)} $) ajouté au projet "${p?.nom}"`);
  };

  const changerStatutProjet = (projetId, statut) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, statut } : p)));
  };

  const projetsFiltres = projets.filter((p) => {
    if (filtreClientId && p.clientId !== filtreClientId) return false;
    if (filtreStatut !== "Tous") {
      if (filtreStatut === "En retard" ? !projetEnRetard(p) : p.statut !== filtreStatut) return false;
    }
    if (recherche.trim()) {
      const client = clients.find((c) => c.id === p.clientId);
      const texte = `${p.nom} ${client?.nom || ""}`.toLowerCase();
      if (!texte.includes(recherche.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Projets &amp; Rentabilité</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setVueAffichage("liste")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${vueAffichage === "liste" ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              <List size={12} /> Liste
            </button>
            <button
              onClick={() => setVueAffichage("kanban")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${vueAffichage === "kanban" ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              <LayoutGrid size={12} /> Kanban
            </button>
          </div>
          <Button
            variant="outline"
            onClick={peutSyncQb ? onSyncQuickBooks : undefined}
            disabled={!peutSyncQb}
            loading={syncQbEnCours}
            title={peutSyncQb ? undefined : "Réservé aux administrateurs"}
            className="min-h-0 gap-1.5 px-2.5 py-1.5 text-xs"
          >
            {!syncQbEnCours && (peutSyncQb ? <RefreshCw size={12} /> : <Lock size={12} />)} Synchroniser QuickBooks
          </Button>
        </div>
      </div>

      {/* RECHERCHE & FILTRES */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom de projet ou client..."
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTRES_STATUT_HUB.map((s) => (
            <button
              key={s}
              onClick={() => setFiltreStatut(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                filtreStatut === s ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={filtreClientId}
          onChange={(e) => setFiltreClientId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>

      {/* FACTURES QUICKBOOKS NON ASSIGNÉES — repliées par défaut.
          (Le bloc reste visible tant qu'il existe des transactions
          « Hors Fluxya » : c'est là qu'on peut les remettre à classer.) */}
      {(transactionsNonAssignees.length > 0 || transactionsHorsFluxya.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <button
            type="button"
            onClick={() => setBlocQbOuvert((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-amber-700">
              <AlertTriangle size={13} className="shrink-0" />
              <span className="truncate">
                {transactionsNonAssignees.length} facture{transactionsNonAssignees.length > 1 ? "s" : ""} QuickBooks à
                rattacher à un projet, une job ou un client
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-amber-700">{blocQbOuvert ? "▲ Replier" : "▼ Ouvrir"}</span>
          </button>
          {!blocQbOuvert && (
            <p className="mt-1 text-[10px] leading-snug text-amber-600">
              Sert à calculer la marge réelle. Une dépense se rattache à un <span className="font-bold">projet</span>, à une{" "}
              <span className="font-bold">job</span> (le produit acheté pour une tâche précise) ou à un{" "}
              <span className="font-bold">client</span>. Rien d&apos;urgent : tant qu&apos;une facture n&apos;est pas
              rattachée, elle ne fausse aucun chiffre — elle n&apos;est simplement comptée nulle part.
              {nbQbMontantNul > 0 && ` (${nbQbMontantNul} facture${nbQbMontantNul > 1 ? "s" : ""} à 0,00 $ écartée${nbQbMontantNul > 1 ? "s" : ""} — un montant nul ne change aucune marge.)`}
            </p>
          )}
          {blocQbOuvert && (
          <div className="mt-2 space-y-1.5">
            {transactionsNonAssignees.map((t) => {
              // 🎯 TROIS CIBLES (2026-08-26) : un achat fait pour une job
              // SANS projet n'avait aucune destination — il restait
              // orphelin et son coût n'apparaissait nulle part. La valeur
              // du menu est « type:id » pour tenir les trois familles.
              const choix = assignationManuelleId?.quickbooksId === t.quickbooksId ? assignationManuelleId.valeur : "";
              return (
                <div key={t.quickbooksId} className="rounded-lg border border-amber-200 bg-white p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex min-w-0 items-center gap-1 font-semibold text-slate-800">
                      <AlertTriangle size={11} className="shrink-0 text-red-500" />
                      {/* 👤 Le NOM d'abord (2026-08-28) : une carte « QBO-INV-1042 »
                          est inclassable — « Toitures Marleau · 12 mars » se classe
                          en une seconde. Le numéro QuickBooks passe en second. */}
                      <span className="truncate">
                        {(t.type === "INVOICE" ? t.clientNomQb : t.fournisseurNomQb) || t.quickbooksId}
                      </span>
                      <span className="shrink-0 text-[10px] font-normal text-slate-400">
                        · {t.type === "INVOICE" ? "Vente" : "Dépense"}{t.date ? ` · ${t.date}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-700">{t.amountHT.toFixed(2)} $ HT</span>
                  </div>
                  {((t.type === "INVOICE" ? t.clientNomQb : t.fournisseurNomQb) || t.poNumber || t.referenceTexte) && (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">
                      {t.quickbooksId}
                      {t.poNumber ? ` · Nº ${t.poNumber}` : ""}
                      {t.referenceTexte ? ` · ${String(t.referenceTexte).slice(0, 60)}` : ""}
                    </p>
                  )}
                  <div className="mt-1.5 flex gap-1.5">
                    <select
                      value={choix}
                      onChange={(e) => setAssignationManuelleId({ quickbooksId: t.quickbooksId, valeur: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                    >
                      <option value="">Rattacher à…</option>
                      {projets.length > 0 && (
                        <optgroup label="🏗️ Projets">
                          {projets.map((p) => <option key={p.id} value={`projet:${p.id}`}>{p.nom}</option>)}
                        </optgroup>
                      )}
                      {jobsRattachables.length > 0 && (
                        <optgroup label="🔧 Jobs (tâches)">
                          {jobsRattachables.map((j) => (
                            <option key={j.id} value={`tache:${j.id}`}>
                              {j.libelle}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {(clients || []).length > 0 && (
                        <optgroup label="👤 Clients (aucune job précise)">
                          {(clients || []).map((c) => <option key={c.id} value={`client:${c.id}`}>{c.nom}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!choix}
                      onClick={() => {
                        const [type, ...reste] = String(choix).split(":");
                        onAssignerTransaction(t.quickbooksId, { type, id: reste.join(":") });
                        setAssignationManuelleId(null);
                      }}
                      className="min-h-0 px-2 py-1 text-[11px]"
                    >
                      Assigner
                    </Button>
                    {/* 🚫 HORS FLUXYA (2026-08-28) : la transaction ne
                        concerne aucune job (essence, comptable, frais
                        généraux…) — elle sort de la liste sans entrer
                        dans aucune marge. Réversible en bas du bloc. */}
                    <Button
                      variant="outline"
                      onClick={() => onAssignerTransaction(t.quickbooksId, { type: "hors", id: "hors" })}
                      title="Cette transaction ne concerne aucune job — la sortir de la liste (récupérable)"
                      className="min-h-0 px-2 py-1 text-[11px] text-slate-500"
                    >
                      🚫 Hors Fluxya
                    </Button>
                  </div>
                </div>
              );
            })}
            {nbQbMontantNul > 0 && (
              <p className="pt-1 text-[10px] leading-snug text-amber-600">
                {nbQbMontantNul} facture{nbQbMontantNul > 1 ? "s" : ""} à 0,00 $ {nbQbMontantNul > 1 ? "sont" : "est"}{" "}
                écartée{nbQbMontantNul > 1 ? "s" : ""} de cette liste — un montant nul ne change aucune marge.
              </p>
            )}
            {transactionsHorsFluxya.length > 0 && (
              <div className="border-t border-amber-200 pt-1.5">
                <button
                  type="button"
                  onClick={() => setHorsFluxyaOuvert((v) => !v)}
                  className="text-[10px] font-bold text-amber-600 underline"
                >
                  🚫 {transactionsHorsFluxya.length} transaction{transactionsHorsFluxya.length > 1 ? "s" : ""} marquée{transactionsHorsFluxya.length > 1 ? "s" : ""} « Hors Fluxya » {horsFluxyaOuvert ? "▲" : "▼"}
                </button>
                {horsFluxyaOuvert && (
                  <div className="mt-1 space-y-1">
                    {transactionsHorsFluxya.map((t) => (
                      <div key={t.quickbooksId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <span className="min-w-0 truncate text-slate-500">
                          {(t.type === "INVOICE" ? t.clientNomQb : t.fournisseurNomQb) || t.quickbooksId}
                          {t.date ? ` · ${t.date}` : ""} · <span className="tabular-nums">{t.amountHT.toFixed(2)} $</span>
                        </span>
                        <button
                          onClick={() => onAssignerTransaction(t.quickbooksId, null)}
                          className="shrink-0 text-[10px] font-bold text-slate-500 underline"
                        >
                          Remettre à classer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      )}


      {/* CARTES PROJETS — vue Liste ou Kanban */}
      {vueAffichage === "liste" ? (
        <div className="space-y-3">
          {projetsFiltres.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              Aucun projet ne correspond à ces critères. Les projets se créent depuis la fiche client (onglet Clients).
            </p>
          )}
          {projetsFiltres.map((p) => (
            <CarteProjet
              key={p.id}
              p={p}
              client={clients.find((c) => c.id === p.clientId)}
              travaux={travaux}
              transactionsQb={transactionsQb}
              utilisateurs={utilisateurs}
              tauxMetiers={tauxMetiers}
              onOuvrir={setProjetOuvertId}
            />
          ))}
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex gap-3" style={{ minWidth: STATUTS_PROJET.length * 220 }}>
            {STATUTS_PROJET.map((statutColonne) => {
              const projetsColonne = projetsFiltres.filter((p) => p.statut === statutColonne);
              return (
                <div
                  key={statutColonne}
                  onDragOver={(e) => { e.preventDefault(); setColonneSurvolee(statutColonne); }}
                  onDragLeave={() => setColonneSurvolee(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const projetId = e.dataTransfer.getData("text/plain");
                    if (projetId) changerStatutProjet(projetId, statutColonne);
                    setColonneSurvolee(null);
                  }}
                  className={`w-[220px] shrink-0 rounded-xl p-2 ${colonneSurvolee === statutColonne ? "bg-orange-50" : "bg-slate-50"}`}
                >
                  <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-slate-600">
                    {statutColonne}
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] tabular-nums">{projetsColonne.length}</span>
                  </p>
                  <div className="space-y-2">
                    {projetsColonne.map((p) => (
                      <CarteProjet
                        key={p.id}
                        p={p}
                        client={clients.find((c) => c.id === p.clientId)}
                        travaux={travaux}
                        transactionsQb={transactionsQb}
                        utilisateurs={utilisateurs}
                        tauxMetiers={tauxMetiers}
                        onOuvrir={setProjetOuvertId}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                        compact
                      />
                    ))}
                    {projetsColonne.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[10px] text-slate-400">
                        Glisse un projet ici
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projetOuvert && (
        <ModalDetailProjet
          inspections={inspections}
          onMajMateriel={(liste) => setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, materielStock: liste } : px)))}
          projet={projetOuvert}
          travaux={travaux}
          devisListe={devisListe}
          transactionsQb={transactionsQb}
          clients={clients}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          onFermer={() => setProjetOuvertId(null)}
          onAjouterBC={ajouterBonCommandeProjet}
          onChangerStatut={changerStatutProjet}
          onSyncQuickBooks={onSyncQuickBooks}
          peutSyncQb={peutSyncQb}
          syncQbEnCours={syncQbEnCours}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
        />
      )}
    </div>
  );
}

function OngletClients({ clients, setClients, ajouterJournal, travaux, setTravaux, projets, setProjets, devisListe, transactionsQb, utilisateurs, tauxMetiers, syncQbEnCours, onSyncQuickBooksProjets, peutSyncQb, fournisseurs, setFournisseurs, clientCible, devisCible, onCreerDevis, bons, inspections, achatsLibres = [] }) {
  // Taux camion par défaut — pour le coût réel des travaux du client.
  const configClients = useEntreprise();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [entreprise, setEntreprise] = useState("");
  // Nom affiché dans les listes quand nom ET entreprise existent.
  const [nomAffichageChoix, setNomAffichageChoix] = useState("nom");
  const [prenom, setPrenom] = useState("");
  const [nomFamille, setNomFamille] = useState("");
  const [courriel, setCourriel] = useState("");
  const [telephone, setTelephone] = useState("");
  const [termeFacturation, setTermeFacturation] = useState(TERMES_FACTURATION[0]);
  const [adresseFacturation, setAdresseFacturation] = useState(null);
  // 🚪 App./bureau/casier postal — certains clients fonctionnent ainsi.
  const [adresseFacturationApp, setAdresseFacturationApp] = useState("");
  const [dejaSyncQb, setDejaSyncQb] = useState(false);
  const [syncEnCours, setSyncEnCours] = useState(false);
  const [clientOuvertId, setClientOuvertId] = useState(null);
  // ✏️ Fiche client en cours de MODIFICATION (fenêtre d'édition).
  const [clientEnEditionId, setClientEnEditionId] = useState(null);
  // Arrivée depuis la RECHERCHE RAPIDE : le dossier du client visé
  // s'ouvre tout seul (et son devis est mis en évidence par DevisDuClient).
  useEffect(() => {
    if (clientCible) setClientOuvertId(clientCible);
  }, [clientCible, devisCible]);
  // Recherche rapide dans la liste des clients (nom, entreprise,
  // courriel, téléphone, adresse, nº QuickBooks).
  const [rechercheClients, setRechercheClients] = useState("");
  const qClients = rechercheClients.trim().toLowerCase();
  // 📄 Pagination (2026-08-26) : 10 fiches par page — sans recherche,
  // TOUTE la liste s'affichait (mur garanti à 200 clients). Taper une
  // recherche ramène page 1.
  const [pageClients, setPageClients] = useState(1);
  const refListeClients = useRef(null);
  useEffect(() => { setPageClients(1); }, [qClients]);
  const clientsFiltres = !qClients
    ? clients
    : clients.filter((c) =>
        [
          c.nom,
          c.entreprise,
          c.telephone,
          c.quickbooksCustomerId,
          ...(c.courriels || []).map((cc) => cc.email),
          ...(c.adresses || []).map((a) => `${a.nom} ${a.ligne1}`),
        ]
          .filter(Boolean)
          .some((champ) => String(champ).toLowerCase().includes(qClients))
      );
  // Recherche rapide dans « Travaux (passés et à venir) » du client ouvert.
  const [rechercheTravaux, setRechercheTravaux] = useState("");
  const [filtreTravauxStatut, setFiltreTravauxStatut] = useState("tous"); // "tous" | "a_venir" | "complete"
  // Repart à neuf quand on change de client ouvert.
  useEffect(() => {
    setRechercheTravaux("");
    setFiltreTravauxStatut("tous");
  }, [clientOuvertId]);
  const [nouveauCourrielLabel, setNouveauCourrielLabel] = useState("");
  // ✏️ Édition en place d'un courriel existant — { clientId, courrielId, email, label }.
  const [editionCourriel, setEditionCourriel] = useState(null);
  const [nouveauCourrielEmail, setNouveauCourrielEmail] = useState("");

  // ✏️ MODIFIER un courriel existant — y compris le PRINCIPAL (avant,
  // le courriel unique ne pouvait ni s'éditer ni se supprimer : angle
  // mort constaté par le propriétaire, 2026-08-17).
  const modifierCourrielClient = (clientId, courrielId, email, label) => {
    const propre = (email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) return false;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              courriels: (c.courriels || []).map((cc) =>
                cc.id === courrielId ? { ...cc, email: propre, label: (label || "").trim() || cc.label } : cc
              ),
            }
          : c
      )
    );
    ajouterJournal(`✏️ Courriel corrigé sur la fiche : ${propre}`);
    // La fiche QuickBooks suit — plus jamais de divergence.
    synchroniserClientsQbo({ clientId, forcer: true }).catch(() => {});
    return true;
  };

  const ajouterCourrielClient = (clientId) => {
    if (!nouveauCourrielEmail.trim()) return;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              courriels: [
                ...(c.courriels || []),
                {
                  id: `cc-${Date.now()}`,
                  label: nouveauCourrielLabel.trim() || "Autre",
                  email: nouveauCourrielEmail.trim(),
                  defaut: (c.courriels || []).length === 0,
                },
              ],
            }
          : c
      )
    );
    const c = clients.find((x) => x.id === clientId);
    ajouterJournal(`📧 Courriel "${nouveauCourrielLabel.trim() || "Autre"}" ajouté pour ${c?.nom} (${nouveauCourrielEmail.trim()})`);
    synchroniserClientsQbo({ clientId, forcer: true }).catch(() => {});
    setNouveauCourrielLabel("");
    setNouveauCourrielEmail("");
  };

  const retirerCourrielClient = (clientId, courrielId) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const restants = (c.courriels || []).filter((cc) => cc.id !== courrielId);
        // Si on retire celui marqué par défaut, le premier restant
        // reprend automatiquement ce rôle — jamais 0 courriel par
        // défaut tant qu'il en reste au moins un.
        if (restants.length > 0 && !restants.some((cc) => cc.defaut)) restants[0].defaut = true;
        return { ...c, courriels: restants };
      })
    );
  };

  const definirCourrielDefaut = (clientId, courrielId) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, courriels: (c.courriels || []).map((cc) => ({ ...cc, defaut: cc.id === courrielId })) }
          : c
      )
    );
    // Le courriel PAR DÉFAUT est celui que QuickBooks utilise — il suit.
    synchroniserClientsQbo({ clientId, forcer: true }).catch(() => {});
  };

  const [travailOuvertId, setTravailOuvertId] = useState(null);
  const travailOuvert = travaux.find((t) => t.id === travailOuvertId) || null;
  const [projetOuvertId, setProjetOuvertId] = useState(null);
  const projetOuvert = projets.find((p) => p.id === projetOuvertId) || null;
  const [formulaireProjetPourClient, setFormulaireProjetPourClient] = useState(null); // clientId ou null
  const [nouveauProjetNom, setNouveauProjetNom] = useState("");
  const [nouveauProjetDebut, setNouveauProjetDebut] = useState(todayISO());
  const [nouveauProjetFin, setNouveauProjetFin] = useState("");
  const [nouveauProjetAdresseId, setNouveauProjetAdresseId] = useState("");
  const [nouveauProjetNouvelleAdresse, setNouveauProjetNouvelleAdresse] = useState(null);
  // Ventilation du budget PRÉVU (Étape A). Le RÉEL viendra plus tard :
  // les heures depuis l'app employé (travaux), et les coûts matériaux /
  // sous-traitance depuis QuickBooks (rattachés par numéro de projet).
  const [nouveauProjetMoHeures, setNouveauProjetMoHeures] = useState("");
  const [nouveauProjetMoFacture, setNouveauProjetMoFacture] = useState("");
  const [nouveauProjetMoCoutant, setNouveauProjetMoCoutant] = useState("");
  const [nouveauProjetTrHeures, setNouveauProjetTrHeures] = useState("");
  const [nouveauProjetTrFacture, setNouveauProjetTrFacture] = useState("");
  const [nouveauProjetTrCoutant, setNouveauProjetTrCoutant] = useState("");
  const [nouveauProjetMatFacture, setNouveauProjetMatFacture] = useState("");
  const [nouveauProjetMatCoutant, setNouveauProjetMatCoutant] = useState("");
  const [nouveauProjetSousTraitants, setNouveauProjetSousTraitants] = useState([]);
  const nb = (v) => parseFloat(v) || 0;
  const ajouterSousTraitant = () =>
    setNouveauProjetSousTraitants((p) => [...p, { id: `st-${Date.now()}`, nom: "", facture: "", coutant: "" }]);
  const majSousTraitant = (id, champ, val) =>
    setNouveauProjetSousTraitants((p) => p.map((st) => (st.id === id ? { ...st, [champ]: val } : st)));
  const retirerSousTraitant = (id) =>
    setNouveauProjetSousTraitants((p) => p.filter((st) => st.id !== id));
  const totalFactureProjet =
    nb(nouveauProjetMoFacture) + nb(nouveauProjetTrFacture) + nb(nouveauProjetMatFacture) +
    nouveauProjetSousTraitants.reduce((s, st) => s + nb(st.facture), 0);
  const totalCoutantProjet =
    nb(nouveauProjetMoCoutant) + nb(nouveauProjetTrCoutant) + nb(nouveauProjetMatCoutant) +
    nouveauProjetSousTraitants.reduce((s, st) => s + nb(st.coutant), 0);
  const margeProjet = totalFactureProjet - totalCoutantProjet;
  const margePctProjet = totalFactureProjet > 0 ? (margeProjet / totalFactureProjet) * 100 : 0;

  const [nouveauProjetSecteur, setNouveauProjetSecteur] = useState("commercial");
  const creerProjet = (clientId) => {
    if (!nouveauProjetNom.trim() || totalFactureProjet <= 0) return;
    const client = clients.find((c) => c.id === clientId);
    let adresseTravaux = null;
    if (nouveauProjetNouvelleAdresse) {
      adresseTravaux = nouveauProjetNouvelleAdresse.label;
    } else if (nouveauProjetAdresseId) {
      const a = client?.adresses?.find((x) => x.id === nouveauProjetAdresseId);
      if (a) adresseTravaux = `${a.nom} — ${libelleAdresse(a)}`;
    }
    const moHeures = nb(nouveauProjetMoHeures);
    const moCoutant = nb(nouveauProjetMoCoutant);
    const nouveau = {
      id: `projet-${Date.now()}`,
      nom: nouveauProjetNom.trim(),
      clientId,
      adresseTravaux,
      dateDebut: nouveauProjetDebut,
      dateFin: nouveauProjetFin,
      // Secteur CCQ du chantier — chaque tâche du projet en HÉRITE
      // (changeable tâche par tâche à la création).
      secteur: nouveauProjetSecteur === "residentiel" ? "residentiel" : "commercial",
      statut: "À planifier",
      // budgetTotal et tauxHoraireCoutant sont dérivés de la ventilation
      // ci-dessous (le calcul de rentabilité existant s'en sert toujours).
      budgetTotal: totalFactureProjet,
      tauxHoraireCoutant: moHeures > 0 ? moCoutant / moHeures : 45,
      bonsCommande: [],
      // Ventilation du budget PRÉVU. Le RÉEL viendra de l'app employé
      // (heures) et de QuickBooks (matériaux / sous-traitance).
      budgetPrevu: {
        mainOeuvreChantier: { heures: moHeures, facture: nb(nouveauProjetMoFacture), coutant: moCoutant },
        transport: { heures: nb(nouveauProjetTrHeures), facture: nb(nouveauProjetTrFacture), coutant: nb(nouveauProjetTrCoutant) },
        materiaux: { facture: nb(nouveauProjetMatFacture), coutant: nb(nouveauProjetMatCoutant) },
        sousTraitants: nouveauProjetSousTraitants.map((st) => ({ nom: st.nom.trim(), facture: nb(st.facture), coutant: nb(st.coutant) })),
        totalFacture: totalFactureProjet,
        totalCoutant: totalCoutantProjet,
        marge: margeProjet,
      },
    };
    setProjets((prev) => [...prev, nouveau]);
    ajouterJournal(`🏗️ Projet "${nouveau.nom}" créé pour ${client?.nom} — budget ${totalFactureProjet.toFixed(2)} $, marge prévue ${margeProjet.toFixed(2)} $`);
    setNouveauProjetNom("");
    setNouveauProjetDebut(todayISO());
    setNouveauProjetFin("");
    setNouveauProjetMoHeures(""); setNouveauProjetMoFacture(""); setNouveauProjetMoCoutant("");
    setNouveauProjetTrHeures(""); setNouveauProjetTrFacture(""); setNouveauProjetTrCoutant("");
    setNouveauProjetMatFacture(""); setNouveauProjetMatCoutant("");
    setNouveauProjetSousTraitants([]);
    setNouveauProjetAdresseId("");
    setNouveauProjetNouvelleAdresse(null);
    setFormulaireProjetPourClient(null);
  };

  const ajouterBonCommandeProjet = (projetId, bc) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, bonsCommande: [...(p.bonsCommande || []), bc] } : p)));
    const p = projets.find((x) => x.id === projetId);
    ajouterJournal(`📦 BC ${bc.numeroBC} (${bc.montantHT.toFixed(2)} $) ajouté au projet "${p?.nom}"`);
  };

  const changerStatutProjet = (projetId, statut) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, statut } : p)));
  };

  const reactiverModification = (id, actif) => {
    setTravaux((prev) => prev.map((t) => (t.id === id ? { ...t, modifReactivee: actif } : t)));
    const t = travaux.find((x) => x.id === id);
    ajouterJournal(
      actif
        ? `🔓 Modification réactivée pour l'employé sur « ${t?.titre} »`
        : `🔒 Réactivation retirée sur « ${t?.titre} »`
    );
  };

  const reinitialiserFormulaire = () => {
    setEntreprise("");
    setPrenom("");
    setNomFamille("");
    setCourriel("");
    setTelephone("");
    setTermeFacturation(TERMES_FACTURATION[0]);
    setAdresseFacturation(null);
    setAdresseFacturationApp("");
    setNomAffichageChoix("nom");
  };

  // PERSONNE OU ENTREPRISE (retour de tests 2026-08-17) : bien des
  // clients n'ont qu'un nom d'entreprise — l'un OU l'autre débloque.
  // TÉLÉPHONE désormais obligatoire (il voyage jusqu'au technicien).
  const personneRemplie = !!(prenom.trim() && nomFamille.trim());
  const peutCreer = (personneRemplie || entreprise.trim()) && courriel.trim() && telephone.trim();
  const raisonsCreation = [];
  if (!personneRemplie && !entreprise.trim()) raisonsCreation.push("une personne (prénom + nom) OU une entreprise");
  if (!courriel.trim()) raisonsCreation.push("un courriel");
  if (!telephone.trim()) raisonsCreation.push("un téléphone");
  // Erreurs de validation bloquantes avant le transfert vers QuickBooks.
  const [erreursCreation, setErreursCreation] = useState([]);

  const creerClient = () => {
    if (!peutCreer) return;
    // Conformité : aucune donnée invalide ne part vers QuickBooks —
    // courriel au bon format et adresse complète (ligne + ville) exigés.
    const erreurs = erreursClientPourQuickBooks({ courriel, adresse: adresseFacturation });
    if (erreurs.length > 0) {
      setErreursCreation(erreurs);
      return;
    }
    setErreursCreation([]);
    const id = `c-${Date.now()}`;
    const nouveauClient = {
      id,
      entreprise: entreprise.trim(),
      // Entreprise seule : elle sert de nom ET d'affichage — aucune
      // fiche « sans nom » ne circule (listes, QuickBooks, documents).
      nomAffichage: personneRemplie ? (entreprise.trim() ? nomAffichageChoix : "nom") : "entreprise",
      nom: personneRemplie ? `${prenom.trim()} ${nomFamille.trim()}` : entreprise.trim(),
      courriels: [{ id: `cc-${Date.now()}`, label: "Principal", email: courriel.trim(), defaut: true }],
      telephone: telephone.trim(),
      termeFacturation,
      // 🚪 L'unité suit l'adresse partout : chaîne de facturation (QB et
      // documents) ET fiche d'adresse (champ appartement).
      adresseFacturation: adresseFacturation
        ? [adresseFacturation.label, adresseFacturationApp.trim() ? `app. ${adresseFacturationApp.trim()}` : ""].filter(Boolean).join(", ")
        : "",
      adresses: adresseFacturation
        ? [{ id: `a-${Date.now()}`, nom: "Facturation", ligne1: adresseFacturation.label, ...(adresseFacturationApp.trim() ? { appartement: adresseFacturationApp.trim() } : {}), codePostal: adresseFacturation.codePostal }]
        : [],
      quickbooksCustomerId: null,
      syncQb: "en_cours",
    };
    setClients((prev) => [...prev, nouveauClient]);
    ajouterJournal(`👤 Client "${nouveauClient.nom}" créé — transfert vers QuickBooks en cours...`);
    setFormulaireOuvert(false);
    reinitialiserFormulaire();

    // VRAI transfert QuickBooks (2026-08-15) — décision du propriétaire :
    // TOUS les clients existent dans QuickBooks (sa pratique d'avant,
    // quand ses devis s'y faisaient). Persistance d'abord, puis liaison.
    sauvegarderClient(nouveauClient)
      .then(() => synchroniserClientsQbo({ clientId: id }))
      .then((r) => {
        if (r?.fait > 0) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "synchronise" } : c)));
          ajouterJournal(`🔄 Client "${nouveauClient.nom}" créé/relié dans QuickBooks (Sandbox)`);
        } else if (r?.simule) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🧪 QuickBooks non configuré ici — client local seulement (normal en développement)");
        } else if (r?.nonConnecte) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🔌 QuickBooks non connecté — le client sera repris par « Synchroniser les clients » (Paramètres → Connexions)");
        } else {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal(`⚠️ Client "${nouveauClient.nom}" non transféré : ${(r?.erreurs || [])[0] || r?.erreur || "erreur"} — repris plus tard par la synchronisation`);
        }
      })
      .catch(() => ajouterJournal(`⚠️ Client "${nouveauClient.nom}" enregistré localement mais transfert QuickBooks à reprendre`));
  };

  // ⬇️ VRAIE DESCENTE QuickBooks → Fluxya (2026-08-29 — remplace la
  // simulation de démonstration qui vivait ici depuis les débuts et
  // inventait un faux client). Décision du propriétaire : TOUS les
  // clients de QuickBooks — « si le client appelle, qu'il soit facile à
  // retrouver ». La route relie les homonymes (jamais de doublon) et
  // crée les fiches manquantes ; le Realtime rafraîchit la liste seul.
  const synchroniserDepuisQuickbooks = async () => {
    if (syncEnCours) return;
    setSyncEnCours(true);
    const r = await synchroniserClientsQbo({ descendre: true });
    setSyncEnCours(false);
    if (r?.erreur || r?.nonConnecte || r?.simule) {
      ajouterJournal(
        `⚠️ Descente des clients QuickBooks impossible : ${r?.erreur || (r?.nonConnecte ? "QuickBooks non connecté (Paramètres → Connexions)" : "mode simulé — clés absentes")}`
      );
      return;
    }
    setDejaSyncQb(true);
    if ((r?.crees || 0) === 0 && (r?.relies || 0) === 0) {
      ajouterJournal(`✅ Clients à jour avec QuickBooks — ${r?.totalQb ?? 0} clients vérifiés, rien de nouveau.`);
      return;
    }
    ajouterJournal(
      `⬇️ Clients QuickBooks descendus : ${r?.crees || 0} fiche${(r?.crees || 0) > 1 ? "s" : ""} créée${(r?.crees || 0) > 1 ? "s" : ""}, ${r?.relies || 0} reliée${(r?.relies || 0) > 1 ? "s" : ""} par nom (sur ${r?.totalQb ?? 0} clients QuickBooks).`
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Clients</h2>
        <Button
          variant="outline"
          onClick={synchroniserDepuisQuickbooks}
          loading={syncEnCours}
          className="min-h-0 px-3 py-1.5 text-xs"
        >
          {!syncEnCours && <RefreshCw size={13} />}
          {dejaSyncQb ? "✓ Synchroniser depuis QuickBooks" : "Synchroniser depuis QuickBooks"}
        </Button>
      </div>

      {/* "NOUVEAU CLIENT" — toujours en premier dans la liste */}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white">
        <button
          onClick={() => setFormulaireOuvert((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6A13]/10">
            <UserPlus size={18} className="text-[#FF6A13]" />
          </div>
          <span className="font-bold text-slate-800">Nouveau client</span>
        </button>

        {formulaireOuvert && (
          <div className="space-y-3 border-t border-slate-200 p-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom d'entreprise (optionnel)</label>
              <input
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                placeholder="Ex: Toitures Lavallée inc."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {/* NOM AFFICHÉ (retour de tests) : avec une entreprise, on
                  choisit ce que les listes montrent. */}
              {entreprise.trim() && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Nom affiché dans les listes</p>
                  <div className="flex flex-wrap gap-3">
                    {[["nom", "Nom de la personne"], ["entreprise", "Entreprise"], ["nom-entreprise", "Nom — Entreprise"]].map(([val, lib]) => (
                      <label key={val} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                        <input
                          type="radio"
                          name="nom-affichage-client"
                          checked={nomAffichageChoix === val}
                          onChange={() => setNomAffichageChoix(val)}
                        />
                        {lib}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Prénom</label>
                <input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Nom</label>
                <input
                  value={nomFamille}
                  onChange={(e) => setNomFamille(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Adresse de facturation</label>
              <AutocompleteAdresse onSelection={setAdresseFacturation} />
              {adresseFacturation && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <Check size={12} /> {adresseFacturation.label}
                </p>
              )}
              <input
                value={adresseFacturationApp}
                onChange={(e) => setAdresseFacturationApp(e.target.value)}
                placeholder="App. / bureau / casier postal (facultatif)"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Terme de facturation</label>
              <select
                value={termeFacturation}
                onChange={(e) => setTermeFacturation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                {TERMES_FACTURATION.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Courriel</label>
                <input
                  type="email"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {(() => {
              const nomSaisi = nomClientNormalise(`${prenom} ${nomFamille}`);
              const doublon =
                nomSaisi.length > 3 && (clients || []).find((c) => nomClientNormalise(c.nom) === nomSaisi);
              return doublon ? (
                <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  ⚠️ Un client nommé <span className="font-extrabold">{doublon.nom}</span> existe déjà — vérifie sa
                  fiche avant de créer un doublon (les devis et tâches se rattachent par client).
                </p>
              ) : null;
            })()}
            {erreursCreation.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-red-700">
                  <AlertCircle size={14} /> Envoi vers QuickBooks bloqué — corrige d'abord :
                </p>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-red-700">
                  {erreursCreation.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {raisonsCreation.length > 0 && (
              <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
                Pour créer le client, il manque : {raisonsCreation.join(" · ")}.
              </p>
            )}
            <Button onClick={creerClient} disabled={!peutCreer} className="w-full">
              Créer le client et transférer vers QuickBooks
            </Button>
          </div>
        )}
      </div>

      {/* RECHERCHE RAPIDE DE CLIENTS */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          value={rechercheClients}
          onChange={(e) => setRechercheClients(e.target.value)}
          placeholder="Rechercher un client (nom, entreprise, courriel, téléphone, adresse…)"
          className="w-full text-sm outline-none"
        />
        {rechercheClients && (
          <button onClick={() => setRechercheClients("")} aria-label="Effacer la recherche">
            <X size={14} className="text-slate-400" />
          </button>
        )}
        {qClients && (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
            {clientsFiltres.length}/{clients.length}
          </span>
        )}
      </div>

      {/* LISTE DES CLIENTS EXISTANTS */}
      <div ref={refListeClients} className="space-y-2">
        {qClients && clientsFiltres.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
            Aucun client ne correspond à « {rechercheClients.trim()} ».
          </p>
        )}
        {clientEnEditionId && (() => {
          const cible = clients.find((x) => x.id === clientEnEditionId);
          if (!cible) return null;
          return (
            <ModalEditionClient
              client={cible}
              onFermer={() => setClientEnEditionId(null)}
              onEnregistrer={(champs) => {
                setClients((prev) => prev.map((x) => (x.id === cible.id ? { ...x, ...champs } : x)));
                ajouterJournal(`✏️ Fiche client modifiée : ${champs.entreprise && champs.nomAffichage !== "nom" ? champs.entreprise : champs.nom}`);
              }}
            />
          );
        })()}
        {clientsFiltres.slice((Math.min(pageClients, Math.max(1, Math.ceil(clientsFiltres.length / ITEMS_PAR_PAGE))) - 1) * ITEMS_PAR_PAGE, Math.min(pageClients, Math.max(1, Math.ceil(clientsFiltres.length / ITEMS_PAR_PAGE))) * ITEMS_PAR_PAGE).map((c) => {
          const ouvert = clientOuvertId === c.id;
          return (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white">
              <button
                onClick={() => setClientOuvertId(ouvert ? null : c.id)}
                className="flex w-full items-start justify-between gap-2 p-3.5 text-left"
              >
                <p className="text-sm font-bold text-slate-900">{c.nom}</p>
                {c.quickbooksCustomerId ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {c.quickbooksCustomerId}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    Synchronisation...
                  </span>
                )}
              </button>

              {ouvert && (
                <div className="space-y-1.5 border-t border-slate-100 px-3.5 pb-3.5 pt-2 text-xs text-slate-500">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-extrabold text-[#131B2E]">{c.entreprise || "Particulier (aucune entreprise)"}</p>
                    <button
                      onClick={() => setClientEnEditionId(c.id)}
                      className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      ✏️ Modifier la fiche
                    </button>
                  </div>
                  {/* ADRESSE DE FACTURATION — la règle : champ explicite,
                      sinon l'adresse PRINCIPALE (première de la fiche). */}
                  <p className="flex items-center gap-1.5">
                    🧾 <span className="font-bold text-slate-600">Facturation :</span>
                    {adresseFacturationClient(c) || <span className="italic text-amber-600">aucune adresse — à compléter via ✏️</span>}
                  </p>

                  <div className="space-y-1 rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Courriels ({(c.courriels || []).length})</p>
                    {(c.courriels || []).map((cc) =>
                      editionCourriel?.courrielId === cc.id && editionCourriel?.clientId === c.id ? (
                        <div key={cc.id} className="flex items-center gap-1.5">
                          <input
                            value={editionCourriel.email}
                            onChange={(e) => setEditionCourriel((prev) => ({ ...prev, email: e.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                          />
                          <input
                            value={editionCourriel.label}
                            onChange={(e) => setEditionCourriel((prev) => ({ ...prev, label: e.target.value }))}
                            placeholder="Étiquette"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                          />
                          <button
                            onClick={() => {
                              if (modifierCourrielClient(c.id, cc.id, editionCourriel.email, editionCourriel.label)) setEditionCourriel(null);
                            }}
                            className="shrink-0 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white"
                          >
                            OK
                          </button>
                          <button onClick={() => setEditionCourriel(null)} className="shrink-0 text-slate-400"><X size={12} /></button>
                        </div>
                      ) : (
                        <div key={cc.id} className="flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Mail size={11} className="shrink-0" />
                            <span>{cc.email}</span>
                            <span className="text-[10px] text-slate-400">({cc.label})</span>
                            {cc.defaut && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">Défaut</span>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => setEditionCourriel({ clientId: c.id, courrielId: cc.id, email: cc.email, label: cc.label || "" })}
                              className="text-slate-300 hover:text-slate-600"
                              title="Modifier ce courriel"
                            >
                              ✏️
                            </button>
                            {!cc.defaut && (
                              <button onClick={() => definirCourrielDefaut(c.id, cc.id)} className="text-[10px] font-semibold text-blue-600">
                                Définir par défaut
                              </button>
                            )}
                            {(c.courriels || []).length > 1 && (
                              <button onClick={() => retirerCourrielClient(c.id, cc.id)} className="text-slate-300 hover:text-red-500">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    )}
                    <div className="mt-1.5 grid grid-cols-3 gap-1">
                      <input
                        value={nouveauCourrielLabel}
                        onChange={(e) => setNouveauCourrielLabel(e.target.value)}
                        placeholder="Ex: Projet X"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                      />
                      <input
                        type="email"
                        value={nouveauCourrielEmail}
                        onChange={(e) => setNouveauCourrielEmail(e.target.value)}
                        placeholder="courriel@..."
                        className="col-span-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                      />
                      <Button variant="outline" onClick={() => ajouterCourrielClient(c.id)} className="min-h-0 gap-1 py-1 text-[10px]">
                        <Plus size={10} /> Ajouter
                      </Button>
                    </div>
                  </div>

                  {c.telephone && (
                    <div className="flex items-center gap-1.5"><Phone size={11} /> {c.telephone}</div>
                  )}
                  {c.termeFacturation && (
                    <div className="flex items-center gap-1.5"><CreditCard size={11} /> {c.termeFacturation}</div>
                  )}

                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                      <ClipboardList size={12} /> Travaux (passés et à venir)
                    </p>
                    {travaux.filter((t) => t.clientId === c.id || (t.clientNom && t.clientNom === c.nom)).length === 0 ? (
                      <p className="text-xs text-slate-400">Aucun travail enregistré pour ce client.</p>
                    ) : (
                      <>
                        {/* RECHERCHE RAPIDE dans les travaux du client */}
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <div className="flex min-w-[160px] flex-1 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                            <Search size={12} className="shrink-0 text-slate-400" />
                            <input
                              value={rechercheTravaux}
                              onChange={(e) => setRechercheTravaux(e.target.value)}
                              placeholder="Rechercher un travail (titre, date, note…)"
                              className="w-full text-xs outline-none"
                            />
                            {rechercheTravaux && (
                              <button onClick={() => setRechercheTravaux("")} aria-label="Effacer la recherche">
                                <X size={12} className="text-slate-400" />
                              </button>
                            )}
                          </div>
                          {[["tous", "Tous"], ["a_venir", "À venir"], ["complete", "Complétés"]].map(([val, label]) => (
                            <button
                              key={val}
                              onClick={() => setFiltreTravauxStatut(val)}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                filtreTravauxStatut === val ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const q = rechercheTravaux.trim().toLowerCase();
                          const listeFiltree = travaux
                            .filter((t) => t.clientId === c.id || (t.clientNom && t.clientNom === c.nom))
                            .filter((t) =>
                              filtreTravauxStatut === "tous"
                                ? true
                                : filtreTravauxStatut === "complete"
                                ? t.statut === "complete"
                                : t.statut !== "complete"
                            )
                            .filter((t) =>
                              !q
                                ? true
                                : [t.titre, t.date, t.noteTerrain, t.noteInterne]
                                    .filter(Boolean)
                                    .some((champ) => champ.toLowerCase().includes(q))
                            )
                            .sort((a, b) => a.date.localeCompare(b.date));
                          if (listeFiltree.length === 0) {
                            return (
                              <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-center text-xs text-slate-400">
                                Aucun travail ne correspond à la recherche.
                              </p>
                            );
                          }
                          return (
                            <div className="overflow-hidden rounded-lg border border-slate-100">
                              {listeFiltree.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setTravailOuvertId(t.id)}
                              className="flex w-full items-center justify-between gap-2 border-b border-slate-100 bg-white px-2.5 py-2 text-left last:border-0 hover:bg-slate-50"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-800">{t.titre}</p>
                                <p className="text-[10px] text-slate-400">{t.date}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                    t.statut === "complete"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-orange-100 text-[#B14E0E]"
                                  }`}
                                >
                                  {t.statut === "complete" ? "COMPLÉTÉ" : "À VENIR"}
                                </span>
                                <ChevronRight size={13} className="text-slate-300" />
                              </div>
                            </button>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                        <Briefcase size={12} /> Projets / chantiers
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setFormulaireProjetPourClient(formulaireProjetPourClient === c.id ? null : c.id)}
                        className="min-h-0 gap-1 px-2 py-1 text-[10px]"
                      >
                        <Plus size={10} /> Créer un projet
                      </Button>
                    </div>

                    {formulaireProjetPourClient === c.id && (
                      <div className="mb-2 space-y-1.5 rounded-lg bg-slate-50 p-2">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nom du projet</label>
                          <input value={nouveauProjetNom} onChange={(e) => setNouveauProjetNom(e.target.value)} placeholder="Nom du projet" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        </div>

                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse des travaux</label>
                          {(c.adresses || []).length > 0 && (
                            <select
                              value={nouveauProjetAdresseId}
                              onChange={(e) => { setNouveauProjetAdresseId(e.target.value); setNouveauProjetNouvelleAdresse(null); }}
                              className="mb-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            >
                              <option value="">— Choisir une adresse enregistrée —</option>
                              {(c.adresses || []).map((a) => (
                                <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                              ))}
                            </select>
                          )}
                          <AutocompleteAdresse
                            onSelection={(place) => { setNouveauProjetNouvelleAdresse(place); setNouveauProjetAdresseId(""); }}
                          />
                          {nouveauProjetNouvelleAdresse && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                              <Check size={10} /> {nouveauProjetNouvelleAdresse.label}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Secteur CCQ du chantier</label>
                            <div className="mb-2 flex gap-1.5">
                              {[["commercial", "🏢 Commercial"], ["residentiel", "🏠 Résidentiel"]].map(([val, lib]) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setNouveauProjetSecteur(val)}
                                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                                    nouveauProjetSecteur === val ? "border-[#131B2E] bg-[#131B2E] text-white" : "border-slate-300 bg-white text-slate-600"
                                  }`}
                                >
                                  {lib}
                                </button>
                              ))}
                            </div>
                            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date de début</label>
                            <input type="date" value={nouveauProjetDebut} onChange={(e) => setNouveauProjetDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date de fin</label>
                            <input type="date" value={nouveauProjetFin} onChange={(e) => setNouveauProjetFin(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                        <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">Heures — prévu vs réel (suivi)</p>
                          <p className="mb-1.5 text-[9px] text-blue-500">Le réel se remplit au fur et à mesure que les techniciens pointent (app employé). Aucun impact sur les montants $.</p>
                          <div className="grid grid-cols-[1fr_3rem_3rem_2.75rem] items-center gap-1.5">
                            <span></span>
                            <span className="text-center text-[9px] font-bold uppercase text-blue-600">Prévu</span>
                            <span className="text-center text-[9px] font-bold uppercase text-blue-600">Réel</span>
                            <span className="text-center text-[9px] font-bold uppercase text-blue-600">Reste</span>

                            <span className="text-[10px] font-bold text-blue-900">Chantier</span>
                            <input type="number" min={0} step="0.5" value={nouveauProjetMoHeures} onChange={(e) => setNouveauProjetMoHeures(e.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-1.5 py-1 text-center text-xs" />
                            <input value="0" readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 text-center text-xs text-slate-500" />
                            <span className="text-center text-[11px] font-bold text-emerald-600">{nb(nouveauProjetMoHeures)} h</span>

                            <span className="text-[10px] font-bold text-blue-900">Transport</span>
                            <input type="number" min={0} step="0.5" value={nouveauProjetTrHeures} onChange={(e) => setNouveauProjetTrHeures(e.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-1.5 py-1 text-center text-xs" />
                            <input value="0" readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 text-center text-xs text-slate-500" />
                            <span className="text-center text-[11px] font-bold text-emerald-600">{nb(nouveauProjetTrHeures)} h</span>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Ventilation du budget ($)</p>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Main d'œuvre chantier</p>
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMoFacture} onChange={(e) => setNouveauProjetMoFacture(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMoCoutant} onChange={(e) => setNouveauProjetMoCoutant(e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Transport</p>
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetTrFacture} onChange={(e) => setNouveauProjetTrFacture(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetTrCoutant} onChange={(e) => setNouveauProjetTrCoutant(e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Matériaux</p>
                            <p className="text-[9px] text-slate-400">Coût réel à venir depuis QuickBooks (nº de projet).</p>
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMatFacture} onChange={(e) => setNouveauProjetMatFacture(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMatCoutant} onChange={(e) => setNouveauProjetMatCoutant(e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Sous-traitants</p>
                            <p className="text-[9px] text-slate-400">Coût réel à venir depuis QuickBooks (nº de projet).</p>
                            {nouveauProjetSousTraitants.map((st) => (
                              <div key={st.id} className="mt-1.5 rounded-md bg-slate-50 p-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input value={st.nom} onChange={(e) => majSousTraitant(st.id, "nom", e.target.value)} placeholder="Nom de l'entreprise" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                                  <button type="button" onClick={() => retirerSousTraitant(st.id)} className="shrink-0 rounded-md p-1 text-red-500 hover:bg-red-50" aria-label="Retirer le sous-traitant">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <div className="mt-1 grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                    <input type="number" min={0} step="0.01" value={st.facture} onChange={(e) => majSousTraitant(st.id, "facture", e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                                  </div>
                                  <div>
                                    <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                    <input type="number" min={0} step="0.01" value={st.coutant} onChange={(e) => majSousTraitant(st.id, "coutant", e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={ajouterSousTraitant} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                              <Plus size={11} /> Ajouter un sous-traitant
                            </button>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-200 pt-2 text-center">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Facturé</p>
                              <p className="text-xs font-extrabold text-slate-800 tabular-nums">{totalFactureProjet.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-orange-500">Coûtant</p>
                              <p className="text-xs font-extrabold text-orange-700 tabular-nums">{totalCoutantProjet.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Marge</p>
                              <p className="text-xs font-extrabold text-emerald-700 tabular-nums">{margeProjet.toFixed(0)} $ · {margePctProjet.toFixed(0)} %</p>
                            </div>
                          </div>
                        </div>
                        <Button onClick={() => creerProjet(c.id)} disabled={!nouveauProjetNom.trim() || totalFactureProjet <= 0} className="w-full min-h-0 py-1.5 text-xs">
                          Créer le projet
                        </Button>
                      </div>
                    )}

                    {/* REGISTRE D'ÉQUIPEMENTS — se remplit tout seul à
                        partir des appels de service : le technicien
                        relève modèle et numéro de série, ils atterrissent
                        ici. Dans deux ans, quand ce client rappelle, on
                        sait déjà ce qu'il a. Sert aussi à partir avec la
                        bonne pièce et à retrouver les clients touchés par
                        un rappel de fabricant. */}
                    {(() => {
                      const unites = [];
                      // Toutes les unités de chaque bon (un immeuble peut
                      // en avoir 3) — avant, seule la première comptait.
                      // L'EMPLACEMENT (« RTU toit côté nord », 2026-08-19)
                      // suit et se complète au fil des visites.
                      (bons || [])
                        .filter((b) => b.client === c.nom)
                        .forEach((b) => {
                          const listeU =
                            Array.isArray(b.unites) && b.unites.length > 0
                              ? b.unites
                              : b.modeleUnite || b.serieUnite
                                ? [{ modele: b.modeleUnite, serie: b.serieUnite }]
                                : [];
                          listeU.forEach((ub) => {
                            if (!(ub.modele || ub.serie || ub.emplacement)) return;
                            const cle = `${ub.modele || ""}|${ub.serie || ""}`;
                            const existe = unites.find((u) => `${u.modele || ""}|${u.serie || ""}` === cle);
                            if (existe) {
                              if (b.date > existe.derniereVisite) existe.derniereVisite = b.date;
                              if (ub.emplacement && !existe.emplacement) existe.emplacement = ub.emplacement;
                            } else {
                              unites.push({ modele: ub.modele, serie: ub.serie, emplacement: ub.emplacement || "", derniereVisite: b.date });
                            }
                          });
                        });
                      if (unites.length === 0) return null;
                      return (
                        <div className="mb-2 rounded-xl border border-slate-200 bg-white p-2.5">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            <Cloud size={11} /> Équipements relevés ({unites.length})
                          </p>
                          <div className="space-y-1">
                            {unites.map((u, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                                <span className="text-[11px] font-bold text-slate-700">
                                  {u.emplacement ? <span className="mr-1.5 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-bold text-slate-600">📍 {u.emplacement}</span> : null}
                                  {u.modele || "Modèle non relevé"}
                                  {u.serie ? <span className="ml-1.5 font-normal text-slate-500">Nº {u.serie}</span> : null}
                                </span>
                                <span className="text-[10px] text-slate-400">vu le {u.derniereVisite}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ============================================================
                        💵 COÛT DES TRAVAUX DU CLIENT — SANS BESOIN DE PROJET
                        (2026-08-25, demande du propriétaire : « où voit-on
                        les coûts par client si on ne voit pas les projets ? »)
                        ------------------------------------------------------------
                        Le bloc « Rentabilité » ci-dessous n'apparaît que si le
                        client a des PROJETS — or presque tous les clients n'en
                        ont pas : appels de service et temps-et-matériel. Leurs
                        chiffres existaient (bons + heures) mais restaient
                        invisibles ici. Même calcul que l'analyse « par client »
                        du tableau de bord : facturé (factures émises), coût
                        réel (heures pointées × taux FIGÉ + camion selon
                        l'inspection du matin + matériel au coûtant du devis
                        lié). Écran ADMIN uniquement — jamais sur un document
                        client. */}
                    {(() => {
                      const bonsDuClient = (bons || []).filter((b) => b.client === c.nom);
                      if (bonsDuClient.length === 0) return null;
                      const camionDefautClient = Number(configClients?.coutCamionHoraire) || 0;
                      const cumul = { facture: 0, cout: 0, heures: 0, jobs: 0 };
                      const tachesVues = new Set();
                      bonsDuClient.forEach((b) => {
                        cumul.facture += (b.facturesEmises || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
                        const cleTache = b.tacheId || b.id;
                        if (tachesVues.has(cleTache)) return; // heures/matériel comptés UNE fois par tâche
                        tachesVues.add(cleTache);
                        cumul.jobs += 1;
                        const lignesHeures = (travaux || []).filter(
                          (t) => String(t.tacheId || "").split("::")[0] === b.tacheId && (t.categorieHeures || "projet") === "projet"
                        );
                        lignesHeures.forEach((t) => {
                          const h = Number(t.heures) || 0;
                          cumul.heures += h;
                          cumul.cout += h * (Number(t.tauxCoutantFige) || 0);
                          const insp = (inspections || []).find(
                            (i) =>
                              i.date === t.date &&
                              !i.sansVehicule &&
                              !i.passagerDeNom &&
                              (i.technicienEmail && t.employeEmail ? i.technicienEmail === t.employeEmail : i.technicienNom === t.employeNom)
                          );
                          if (insp) cumul.cout += h * (insp.coutCamionHoraire != null ? insp.coutCamionHoraire : camionDefautClient);
                        });
                        const devisLie = b.devisNumero ? (devisListe || []).find((d) => d.numero === b.devisNumero) : null;
                        if (devisLie) {
                          cumul.cout += (devisLie.lignes || [])
                            .filter((l) => !l.estRabais)
                            .reduce((s, l) => s + (Number(l.prix_coutant) || 0) * (Number(l.quantite) || 1), 0);
                        }
                        // 📦 Matériel du stock (coût standard posé sur le
                        // bon) + 🧾 achats rattachés à la tâche (part
                        // attribuée) — les deux chemins du matériel.
                        cumul.cout += (b.materielStock || []).reduce(
                          (s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1),
                          0
                        );
                        cumul.cout += (achatsLibres || [])
                          .filter((a) => a.tacheId && a.tacheId === b.tacheId)
                          .reduce((s, a) => s + (a.montantAttribue != null ? a.montantAttribue : a.montantHT), 0);
                      });
                      const profit = cumul.facture - cumul.cout;
                      const marge = cumul.facture > 0 ? (profit / cumul.facture) * 100 : null;
                      return (
                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            💵 Coût des travaux — {cumul.jobs} tâche{cumul.jobs > 1 ? "s" : ""} · {cumul.heures.toFixed(1)} h
                          </p>
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Facturé</p>
                              <p className="text-xs font-extrabold tabular-nums text-slate-800">{cumul.facture.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-orange-500">Coût réel</p>
                              <p className="text-xs font-extrabold tabular-nums text-orange-600">{cumul.cout.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Profit</p>
                              <p className={`text-xs font-extrabold tabular-nums ${profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{profit.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Marge</p>
                              <p className={`text-xs font-extrabold tabular-nums ${marge != null && marge < (Number(configClients?.seuilMargeAlerte) || 25) ? "text-red-600" : "text-emerald-700"}`}>
                                {marge != null ? `${marge.toFixed(0)} %` : "—"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] leading-snug text-slate-400">
                            Heures pointées × taux figés + camion (inspection du jour) + matériel : coûtant du devis lié,
                            stock au coût standard et achats rattachés (part attribuée).
                            {cumul.facture === 0 ? " Rien de facturé encore — le coût court déjà." : ""}
                          </p>
                        </div>
                      );
                    })()}

                    {/* RENTABILITÉ DU CLIENT — coûtant vs vendant sur
                        l'ensemble de ses projets. Le coûtant vient des
                        heures réelles à taux FIGÉ + les matériaux (bons
                        de commande et dépenses QuickBooks, sans double
                        comptage) ; le vendant, du montant vendu.
                        Écran ADMIN uniquement : ces chiffres ne sortent
                        jamais sur un devis ni sur un bon de travail. */}
                    {(() => {
                      const projetsDuClient = projets.filter((p) => p.clientId === c.id);
                      if (projetsDuClient.length === 0) return null;
                      const cumul = projetsDuClient.reduce(
                        (acc, p) => {
                          const r = calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers);
                          acc.vendant += Number(p.budgetTotal) || 0;
                          acc.coutant += r.coutTotalReel || 0;
                          return acc;
                        },
                        { vendant: 0, coutant: 0 }
                      );
                      const profit = cumul.vendant - cumul.coutant;
                      const marge = cumul.vendant > 0 ? (profit / cumul.vendant) * 100 : null;
                      const bon = profit >= 0;
                      return (
                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            <BarChart3 size={11} /> Rentabilité — {projetsDuClient.length} projet{projetsDuClient.length > 1 ? "s" : ""}
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Vendant</p>
                              <p className="text-xs font-bold tabular-nums text-slate-800">{cumul.vendant.toFixed(2)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-orange-500">Coûtant</p>
                              <p className="text-xs font-bold tabular-nums text-orange-600">{cumul.coutant.toFixed(2)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Profit</p>
                              <p className={`text-xs font-extrabold tabular-nums ${bon ? "text-emerald-600" : "text-red-600"}`}>
                                {profit.toFixed(2)} $
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Marge</p>
                              <p className={`text-xs font-extrabold tabular-nums ${bon ? "text-emerald-600" : "text-red-600"}`}>
                                {marge != null ? `${marge.toFixed(1)} %` : "—"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] text-slate-400">
                            Marge = (vendant − coûtant) ÷ vendant · coûtant calculé aux taux figés à la saisie
                          </p>
                        </div>
                      );
                    })()}

                    {(() => {
                      const projetsDuClient = projets.filter((p) => p.clientId === c.id);
                      return projetsDuClient.length === 0 ? (
                        <p className="text-xs text-slate-400">Aucun projet pour ce client.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {projetsDuClient.map((p) => (
                            <LigneProjetClient
                              key={p.id}
                              p={p}
                              travaux={travaux}
                              transactionsQb={transactionsQb}
                              utilisateurs={utilisateurs}
                              tauxMetiers={tauxMetiers}
                              onOuvrir={setProjetOuvertId}
                            />
                          ))}
                        </div>
                      );
                    })()}

                    {/* DEVIS DU CLIENT — chaque dossier avec ses versions.
                        C'est ici qu'on retrouve les devis, plutôt que dans
                        une grande liste générale qui devient vite illisible. */}
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Devis ({(devisListe || []).filter((d) => d.clientId === c.id).length})
                        </p>
                        {/* Amène à l'éditeur de devis avec CE client déjà
                            choisi. On n'y recopie pas un mini-formulaire :
                            l'éditeur porte la recherche dans le catalogue,
                            les marges, les versions et les conditions —
                            deux copies finiraient par ne plus donner le
                            même prix selon la porte d'entrée utilisée. */}
                        <Button
                          variant="outline"
                          onClick={() => onCreerDevis?.(c.id)}
                          className="min-h-0 gap-1 px-2 py-1 text-[10px]"
                        >
                          <Plus size={10} /> Créer un devis
                        </Button>
                      </div>
                      <DevisDuClient devisListe={devisListe} clientId={c.id} surlignerNumero={devisCible} compact />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <BarrePagination total={clientsFiltres.length} page={pageClients} onPage={setPageClients} refHaut={refListeClients} libelle="clients" />
      </div>

      {travailOuvert && (
        <DetailTravail
          travail={travailOuvert}
          clients={clients}
          onFermer={() => setTravailOuvertId(null)}
          onReactiver={reactiverModification}
        />
      )}
      {projetOuvert && (
        <ModalDetailProjet
          inspections={inspections}
          onMajMateriel={(liste) => setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, materielStock: liste } : px)))}
          projet={projetOuvert}
          travaux={travaux}
          devisListe={devisListe}
          transactionsQb={transactionsQb}
          clients={clients}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          onFermer={() => setProjetOuvertId(null)}
          onAjouterBC={ajouterBonCommandeProjet}
          onChangerStatut={changerStatutProjet}
          onSyncQuickBooks={onSyncQuickBooksProjets}
          peutSyncQb={peutSyncQb}
          syncQbEnCours={syncQbEnCours}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
        />
      )}
    </div>
  );
}

// ============================================================
// SÉLECTION DU COURRIEL DE DESTINATION — affichée avant chaque envoi
// (devis, bon de travail, facture) quand le client a plusieurs
// courriels enregistrés. Le choix par défaut est pré-sélectionné mais
// toujours modifiable.
// ============================================================
// Sélection des courriels de destination — CHOIX MULTIPLE : un même
// client peut avoir plusieurs contacts (propriétaire, gestionnaire,
// comptabilité...) et recevoir le document à plusieurs adresses d'un
// coup. `onConfirmer` reçoit la LISTE des courriels cochés (le premier
// sert d'affichage principal pour la compatibilité).

// ============================================================
// RETRAIT DE FACTURATION — la DEMANDE (raison prédéfinie + note).
// ------------------------------------------------------------
// Personne ne « perd » une facture en un clic : la demande est tracée
// (qui, quand, pourquoi) et un Admin principal doit valider avant que
// le bon quitte la pile. « Travaux en cours » = simple report.
// ============================================================
function ModalRetraitFacturation({ bon, onFermer, onDemander }) {
  const [raison, setRaison] = useState("travaux_en_cours");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Retirer de la facturation</h3>
            <p className="text-xs text-slate-500">{bon.client} · {bon.projet}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>
        <p className="mb-2 text-[11px] text-slate-500">
          Choisis la raison — un <span className="font-bold">Admin principal</span> devra valider avant que le bon quitte la pile.
        </p>
        <div className="space-y-1.5">
          {Object.entries(RAISONS_RETRAIT).map(([cle, libelle]) => (
            <label
              key={cle}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${raison === cle ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"}`}
            >
              <input
                type="radio"
                name="raison-retrait"
                checked={raison === cle}
                onChange={() => setRaison(cle)}
                className="mt-0.5 h-4 w-4 accent-[#FF6A13]"
              />
              <span className="text-xs font-semibold text-slate-700">
                {cle === "travaux_en_cours" ? "🔄 " : cle === "garantie" ? "🛡️ " : "🏠 "}{libelle}
              </span>
            </label>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note facultative (ex : 2e visite prévue vendredi)"
          rows={2}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#FF6A13]"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={() => onDemander(raison, note.trim())}>Demander le retrait</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FACTURES ÉMISES D'UN BON — chaque ligne porte sa PREUVE d'envoi
// (registre QuickBooks), son PDF officiel et, au besoin, son bouton
// « Renvoyer ». Rien ne se perd : pas de preuve = alerte rouge.
// ============================================================
function FacturesEmisesListe({ bon, onPdf, onRenvoyer, envoiAuto = true }) {
  return (
    <div className="mt-1.5 space-y-1">
      {(bon.facturesEmises || []).map((f) => (
        <div key={f.id} className="rounded-lg bg-slate-50 px-1.5 py-1 text-left text-[10px] text-slate-500">
          <p>
            <span className="font-semibold text-slate-600">{f.numeroFactureQb}</span> — {Number(f.montant).toFixed(2)} $ ({f.detail}) · {f.date}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {f.envoiQb?.statut === "envoyee" ? (
              <span className="font-bold text-emerald-600">✉️ Envoyée par QuickBooks ✓</span>
            ) : f.qboInvoiceId && !envoiAuto ? (
              <>
                <span className="font-bold text-slate-500">📄 Créée — envoi manuel</span>
                <button onClick={() => onRenvoyer(bon, f)} className="rounded bg-slate-700 px-1.5 py-0.5 font-bold text-white active:scale-95">
                  Envoyer par QuickBooks
                </button>
              </>
            ) : f.qboInvoiceId ? (
              <>
                <span className="font-bold text-red-600">⚠️ Envoi non confirmé</span>
                <button onClick={() => onRenvoyer(bon, f)} className="rounded bg-red-600 px-1.5 py-0.5 font-bold text-white active:scale-95">
                  Renvoyer
                </button>
              </>
            ) : (
              <span className="text-slate-400">facture locale (QuickBooks non connecté)</span>
            )}
            {f.qboInvoiceId && (
              <button onClick={() => onPdf(f)} className="font-semibold text-slate-500 underline underline-offset-2">
                📄 PDF
              </button>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 💰/🤝 TECHNICIEN FACTURABLE OU NON — le choix OBLIGATOIRE quand un
// 2e (3e, 4e…) technicien s'ajoute sur une tâche. Aucun bouton par
// défaut, pas de fermeture sans répondre : envoyer un 2e technicien ne
// décide JAMAIS tout seul s'il se facture. Le premier est toujours
// facturable. Coûts et paie ne changent pas — seule la facturation.
// ============================================================
function ModalChoixFacturable({ info, onChoisir }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-sm font-extrabold text-slate-900">
          {info.employe?.nom || "Ce technicien"} s'ajoute sur « {info.titre} »
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Ses heures sont-elles <span className="font-extrabold">facturables au client</span> ?
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Le premier technicien est toujours facturable. Ta réponse ne change ni la paie ni les coûts —
          seulement le calcul de facturation. (Redéposer le technicien sur la tâche repose la question.)
        </p>
        <div className="mt-3 grid gap-2">
          <button
            onClick={() => onChoisir(true)}
            className="min-h-[48px] w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 text-sm font-extrabold text-emerald-800 active:scale-[0.99]"
          >
            💰 Facturable au client
          </button>
          <button
            onClick={() => onChoisir(false)}
            className="min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 text-sm font-extrabold text-slate-700 active:scale-[0.99]"
          >
            🤝 Non facturable (aide interne, apprenti…)
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalSelectionCourriel({ client, contexte, onConfirmer, onFermer, onAjouterFiche = null }) {
  const courriels = client?.courriels || [];
  const [selectionIds, setSelectionIds] = useState(() => {
    const parDefaut = courrielDefautClient(client);
    return parDefaut ? [parDefaut.id] : [];
  });
  const basculer = (id) =>
    setSelectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selection = courriels.filter((cc) => selectionIds.includes(cc.id));
  // COURRIEL AJOUTÉ À LA MAIN — parfois le document doit aussi partir
  // ailleurs (assureur, gestionnaire d'immeuble, notaire…). Plusieurs
  // adresses possibles, séparées par une virgule ou un point-virgule.
  // Seules les adresses au format valide partent — jamais de rebond
  // silencieux à cause d'une coquille.
  const [extra, setExtra] = useState("");
  // 💾 L'adresse tapée peut rejoindre la FICHE du client — la prochaine
  // fois, elle sera dans la liste à cocher.
  const [ajouterAFiche, setAjouterAFiche] = useState(false);
  const extras = extra
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    .map((x, i) => ({ id: `extra-${i}`, email: x, label: "Ajouté à la main" }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Choisir les courriels de destination</h3>
            <p className="text-xs text-slate-500">{contexte}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {courriels.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
            {client?.nom} n'a aucun courriel enregistré — ajoute-en un dans sa fiche (onglet Clients), ou utilise le champ « autre adresse » ci-dessous pour cet envoi-ci.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-[11px] text-slate-400">Coche une ou plusieurs adresses — le document part à toutes en même temps.</p>
            <div className="space-y-1.5">
              {courriels.map((cc) => (
                <label
                  key={cc.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${
                    selectionIds.includes(cc.id) ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectionIds.includes(cc.id)}
                    onChange={() => basculer(cc.id)}
                    className="mt-0.5 h-4 w-4 accent-[#FF6A13]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{cc.email}</p>
                    <p className="text-[11px] text-slate-500">{cc.label}{cc.defaut ? " · défaut" : ""}</p>
                  </div>
                </label>
              ))}
            </div>
            {courriels.length > 1 && (
              <button
                onClick={() => setSelectionIds(selectionIds.length === courriels.length ? [] : courriels.map((cc) => cc.id))}
                className="mt-2 text-[11px] font-bold text-slate-500 underline underline-offset-2"
              >
                {selectionIds.length === courriels.length ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
          </>
        )}

        <div className="mt-3">
          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
            Envoyer aussi à une autre adresse (facultatif)
          </label>
          <input
            type="email"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="ex : assureur@exemple.com — virgule pour plusieurs"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#FF6A13]"
          />
          {extra.trim() !== "" && extras.length === 0 && (
            <p className="mt-0.5 text-[10px] font-bold text-amber-600">
              Adresse incomplète — vérifie le format (nom@domaine.com).
            </p>
          )}
          {extras.length > 0 && client && onAjouterFiche && (
            <label className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={ajouterAFiche}
                onChange={(e) => setAjouterAFiche(e.target.checked)}
                className="h-4 w-4 accent-[#FF6A13]"
              />
              💾 Ajouter cette adresse à la fiche de {client?.nom || "ce client"}
            </label>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button
            disabled={selection.length + extras.length === 0}
            onClick={() => {
              if (ajouterAFiche && onAjouterFiche) extras.forEach((x) => onAjouterFiche(x.email));
              onConfirmer([...selection, ...extras]);
            }}
          >
            Envoyer{selection.length + extras.length > 1 ? ` (${selection.length + extras.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRAITEMENT D'UN DEVIS ACCEPTÉ — choix explicite entre intervention
// directe (bon de travail unique) et nouveau projet d'envergure
// (le devis devient le budget initial + une tâche par ligne).
// ============================================================
function ModalTraiterDevis({ devis, clients, onFermer, onChoisirBonTravail, onChoisirProjet }) {
  const [option, setOption] = useState(null); // "bon_travail" | "projet" | null
  const client = clients.find((c) => c.id === devis.clientId);
  const [adresseTravauxId, setAdresseTravauxId] = useState("");
  const [tauxHoraireCoutant, setTauxHoraireCoutant] = useState("45");
  const [dateFin, setDateFin] = useState("");

  const adresseChoisie = () => {
    const a = client?.adresses?.find((x) => x.id === adresseTravauxId);
    return a ? `${a.nom} — ${libelleAdresse(a)}` : null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Traiter le devis {devis.numero}</h3>
            <p className="text-xs text-slate-500">{devis.clientNom} · {devis.totalVendant.toFixed(2)} $</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {!option && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-500">Comment ce devis accepté doit-il être converti ?</p>
            <button
              onClick={() => setOption("bon_travail")}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left hover:border-slate-300"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <ClipboardList size={16} className="text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Intervention directe (Bon de travail)</p>
                <p className="text-xs text-slate-500">Convertit le devis en un seul bon de travail pré-rempli, prêt à être assigné et planifié dans l'agenda.</p>
              </div>
            </button>
            <button
              onClick={() => setOption("projet")}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left hover:border-slate-300"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Briefcase size={16} className="text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Nouveau projet d'envergure</p>
                <p className="text-xs text-slate-500">Le montant du devis devient le budget initial ; chaque ligne devient une étape/tâche du projet, dans le Hub Projets.</p>
              </div>
            </button>
            <p className="text-[10px] text-slate-400">Dans les deux cas, le lien avec QuickBooks est conservé — la facturation finale se fait via l'onglet Facturation.</p>
          </div>
        )}

        {option === "bon_travail" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Adresse des travaux</label>
              {(client?.adresses || []).length > 0 ? (
                <select
                  value={adresseTravauxId}
                  onChange={(e) => setAdresseTravauxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Adresse de facturation par défaut —</option>
                  {client.adresses.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400">Aucune adresse enregistrée pour ce client — l'adresse de facturation sera utilisée par défaut.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setOption(null)}>Retour</Button>
              <Button onClick={() => onChoisirBonTravail(devis, adresseChoisie())}>Convertir et assigner</Button>
            </div>
          </div>
        )}

        {option === "projet" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Adresse des travaux</label>
              {(client?.adresses || []).length > 0 ? (
                <select
                  value={adresseTravauxId}
                  onChange={(e) => setAdresseTravauxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Adresse de facturation par défaut —</option>
                  {client.adresses.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400">Aucune adresse enregistrée pour ce client.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Taux horaire coûtant</label>
                <input
                  type="number" min={0} step="0.01" value={tauxHoraireCoutant}
                  onChange={(e) => setTauxHoraireCoutant(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Date de fin prévue</label>
                <input
                  type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Budget initial du projet : <span className="font-bold text-slate-800">{devis.totalVendant.toFixed(2)} $</span> ·{" "}
              {devis.lignes.length} étape{devis.lignes.length > 1 ? "s" : ""} seront créées dans l'agenda
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setOption(null)}>Retour</Button>
              <Button onClick={() => onChoisirProjet(devis, { tauxHoraireCoutant, dateFin, adresseTravaux: adresseChoisie() })}>
                Créer le projet
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FENÊTRE « NOUVEAU CLIENT » PARTAGÉE — ouverte depuis le devis OU la
// création de tâche (agenda). Mêmes validations que l'onglet Clients
// (courriel valide + adresse complète, exigences QuickBooks), avec
// avertissement anti-doublon. `onSelection(id)` est rappelé avec le
// client créé (ou l'existant choisi) pour le sélectionner sur place.
// ============================================================
// L'enregistrement des clients est assuré par la sauvegarde automatique
// de l'App (voir « SAUVEGARDE AUTOMATIQUE ») — aucun appel à faire ici.
function ModalNouveauClient({ clients, setClients, ajouterJournal, onFermer, onSelection }) {
  const [ncPrenom, setNcPrenom] = useState("");
  const [ncNomFamille, setNcNomFamille] = useState("");
  const [ncEntreprise, setNcEntreprise] = useState("");
  const [ncCourriel, setNcCourriel] = useState("");
  const [ncTelephone, setNcTelephone] = useState("");
  const [ncAdresse, setNcAdresse] = useState(null);
  const [ncAdresseApp, setNcAdresseApp] = useState("");
  const [ncErreurs, setNcErreurs] = useState([]);
  // Doublon probable : même courriel, ou nom identique à un client existant.
  // PERSONNE OU ENTREPRISE (retour de tests 2026-08-17) + téléphone
  // obligatoire — mêmes règles que le grand formulaire de l'onglet
  // Clients (une seule logique, deux portes d'entrée).
  const ncPersonne = !!(ncPrenom.trim() && ncNomFamille.trim());
  const ncIdentiteOk = ncPersonne || !!ncEntreprise.trim();
  const ncComplet = ncIdentiteOk && ncCourriel.trim() && ncTelephone.trim();
  const ncRaisons = [];
  if (!ncIdentiteOk) ncRaisons.push("une personne (prénom + nom) OU une entreprise");
  if (!ncCourriel.trim()) ncRaisons.push("un courriel");
  if (!ncTelephone.trim()) ncRaisons.push("un téléphone");
  const doublonPossible = (clients || []).find((c) => {
    const courrielSaisi = ncCourriel.trim().toLowerCase();
    // Insensible aux ACCENTS et aux espaces : « Raphaël  Gélinas » =
    // « raphael gelinas » — c'est comme ça que le doublon est passé.
    const nomSaisi = nomClientNormalise(ncPersonne ? `${ncPrenom} ${ncNomFamille}` : ncEntreprise);
    if (courrielSaisi && (c.courriels || []).some((cc) => cc.email.toLowerCase() === courrielSaisi)) return true;
    return nomSaisi.length > 3 && (nomClientNormalise(c.nom) === nomSaisi || nomClientNormalise(c.entreprise || "") === nomSaisi);
  });
  const creer = () => {
    if (!ncComplet) return;
    // Conformité : aucune donnée invalide ne part vers QuickBooks.
    const erreurs = erreursClientPourQuickBooks({ courriel: ncCourriel, adresse: ncAdresse });
    if (erreurs.length > 0) {
      setNcErreurs(erreurs);
      return;
    }
    const id = `c-${Date.now()}`;
    const nouveauClient = {
      id,
      entreprise: ncEntreprise.trim(),
      // Entreprise seule : elle sert de nom et d'affichage.
      nomAffichage: ncPersonne ? "nom" : "entreprise",
      nom: ncPersonne ? `${ncPrenom.trim()} ${ncNomFamille.trim()}` : ncEntreprise.trim(),
      courriels: [{ id: `cc-${Date.now()}`, label: "Principal", email: ncCourriel.trim(), defaut: true }],
      telephone: ncTelephone.trim(),
      termeFacturation: TERMES_FACTURATION[0],
      adresseFacturation: ncAdresse
        ? [ncAdresse.label, ncAdresseApp.trim() ? `app. ${ncAdresseApp.trim()}` : ""].filter(Boolean).join(", ")
        : "",
      adresses: ncAdresse
        ? [{ id: `a-${Date.now()}`, nom: "Facturation", ligne1: ncAdresse.label, ...(ncAdresseApp.trim() ? { appartement: ncAdresseApp.trim() } : {}), codePostal: ncAdresse.codePostal }]
        : [],
      quickbooksCustomerId: null,
      syncQb: "en_cours",
    };
    setClients((prev) => [...prev, nouveauClient]);
    ajouterJournal(`👤 Client "${nouveauClient.nom}" créé — transfert vers QuickBooks en cours...`);
    onSelection?.(id);
    onFermer();
    // VRAI transfert QuickBooks — même flux que l'onglet Clients.
    sauvegarderClient(nouveauClient)
      .then(() => synchroniserClientsQbo({ clientId: id }))
      .then((r) => {
        if (r?.fait > 0) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "synchronise" } : c)));
          ajouterJournal(`🔄 Client "${nouveauClient.nom}" créé/relié dans QuickBooks (Sandbox)`);
        } else if (r?.simule) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🧪 QuickBooks non configuré ici — client local seulement (normal en développement)");
        } else if (r?.nonConnecte) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🔌 QuickBooks non connecté — le client sera repris par « Synchroniser les clients » (Paramètres → Connexions)");
        } else {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal(`⚠️ Client "${nouveauClient.nom}" non transféré : ${(r?.erreurs || [])[0] || r?.erreur || "erreur"} — repris plus tard par la synchronisation`);
        }
      })
      .catch(() => ajouterJournal(`⚠️ Client "${nouveauClient.nom}" enregistré localement mais transfert QuickBooks à reprendre`));
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">➕ Nouveau client</h3>
            <p className="text-xs text-slate-500">Créé au répertoire clients et sélectionné sur place.</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={ncPrenom} onChange={(e) => setNcPrenom(e.target.value)} placeholder="Prénom" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <input value={ncNomFamille} onChange={(e) => setNcNomFamille(e.target.value)} placeholder="Nom" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>
          <input value={ncEntreprise} onChange={(e) => setNcEntreprise(e.target.value)} placeholder="Entreprise" className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          <p className="text-[10px] leading-snug text-slate-400">
            Personne (prénom + nom) OU entreprise — au moins un des deux. Les deux ensemble : encore mieux.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input value={ncCourriel} onChange={(e) => setNcCourriel(e.target.value)} placeholder="Courriel *" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <input value={ncTelephone} onChange={(e) => setNcTelephone(e.target.value)} placeholder="Téléphone *" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse de facturation *</label>
            <AutocompleteAdresse onSelection={(place) => setNcAdresse(place)} />
            {ncAdresse ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <Check size={11} className="shrink-0" /> {ncAdresse.label}
                <button onClick={() => setNcAdresse(null)} aria-label="Retirer l'adresse" className="ml-1 text-slate-400 hover:text-red-500"><X size={11} /></button>
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Écris le numéro et la rue, puis précise la ville et clique « Utiliser cette adresse ».</p>
            )}
            <input
              value={ncAdresseApp}
              onChange={(e) => setNcAdresseApp(e.target.value)}
              placeholder="App. / bureau / casier postal (facultatif)"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>
          {doublonPossible && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
              ⚠️ Un client semblable existe déjà : <span className="font-bold">{doublonPossible.nom}</span>.
              <button
                onClick={() => { onSelection?.(doublonPossible.id); onFermer(); }}
                className="ml-1 underline"
              >
                L'utiliser plutôt
              </button>
            </div>
          )}
          {ncErreurs.length > 0 && (
            <ul className="space-y-0.5 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-600">
              {ncErreurs.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
          {ncRaisons.length > 0 && (
            <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
              Pour créer le client, il manque : {ncRaisons.join(" · ")}.
            </p>
          )}
          <Button onClick={creer} disabled={!ncComplet} className="w-full">
            Créer le client et l'utiliser
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FENÊTRE « NOUVEAU FOURNISSEUR » — ouverte depuis le formulaire de bon
// de commande. Plusieurs adresses courriel possibles (achats,
// comptabilité, représentant) : le BC peut partir à plusieurs d'un coup.
// `onSelection(id)` sélectionne le fournisseur créé sur place.
// ============================================================
function ModalNouveauFournisseur({ fournisseurs, setFournisseurs, ajouterJournal, onFermer, onSelection }) {
  const [nom, setNom] = useState("");
  const [courrielsTexte, setCourrielsTexte] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [erreurs, setErreurs] = useState([]);
  const doublon = (fournisseurs || []).find((f) => f.nom.trim().toLowerCase() === nom.trim().toLowerCase() && nom.trim().length > 2);

  const creer = () => {
    if (!nom.trim()) return;
    // Une adresse par ligne (ou séparées par des virgules) — la première
    // devient l'adresse par défaut du fournisseur.
    const liste = courrielsTexte
      .split(/[\n,;]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    const invalides = liste.filter((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
    if (invalides.length > 0) {
      setErreurs([`Adresse(s) invalide(s) : ${invalides.join(", ")}`]);
      return;
    }
    const id = `f-${Date.now()}`;
    const nouveau = {
      id,
      nom: nom.trim(),
      courriels: liste.map((email, i) => ({ id: `fc-${Date.now()}-${i}`, email, label: i === 0 ? "Principal" : "Autre", defaut: i === 0 })),
      telephone: telephone.trim(),
      adresse: adresse.trim(),
      notes: "",
    };
    setFournisseurs((prev) => [...prev, nouveau]);
    sauvegarderFournisseur(nouveau).catch(() =>
      ajouterJournal(`⚠️ Fournisseur « ${nouveau.nom} » créé localement, mais NON enregistré (table fournisseurs absente ?).`)
    );
    ajouterJournal(`🏭 Fournisseur « ${nouveau.nom} » ajouté au répertoire${liste.length > 0 ? ` (${liste.length} adresse${liste.length > 1 ? "s" : ""} courriel)` : ""}`);
    onSelection?.(id);
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🏭 Nouveau fournisseur</h3>
            <p className="text-xs text-slate-500">Ajouté au répertoire et sélectionné pour ce bon de commande.</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-2">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du fournisseur *" className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Courriels — une adresse par ligne</label>
            <textarea
              value={courrielsTexte}
              onChange={(e) => setCourrielsTexte(e.target.value)}
              rows={3}
              placeholder={"achats@fournisseur.com\ncomptabilite@fournisseur.com"}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">La première adresse sera cochée par défaut à l'envoi des bons de commande.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse (optionnel)" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>
          {doublon && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
              ⚠️ « {doublon.nom} » existe déjà.
              <button onClick={() => { onSelection?.(doublon.id); onFermer(); }} className="ml-1 underline">L'utiliser plutôt</button>
            </div>
          )}
          {erreurs.length > 0 && (
            <ul className="space-y-0.5 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-600">
              {erreurs.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
          <Button onClick={creer} disabled={!nom.trim()} className="w-full">Créer le fournisseur et l'utiliser</Button>
        </div>
      </div>
    </div>
  );
}

// Fenêtre proposant de reporter au catalogue le coût saisi sur une
// ligne de devis. Le report est un geste qui touche TOUS les futurs
// devis de l'entreprise — d'où la confirmation explicite plutôt qu'un
// enregistrement silencieux.
function ModalReportCatalogue({ info, peutModifierListePrix, onFermer, onConfirmer }) {
  const [reporter, setReporter] = useState(false);
  const { item, saisi, auCatalogue } = info;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-slate-900">Coût saisi sur cette ligne</h3>
        <p className="mt-1 text-xs font-semibold text-slate-700">{item.nom}</p>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">
            Catalogue : <span className="tabular-nums font-semibold">{auCatalogue == null ? "aucun coût" : `${auCatalogue.toFixed(2)} $`}</span>
          </span>
          <span className="font-extrabold tabular-nums text-slate-900">→ {saisi.toFixed(2)} $</span>
        </div>

        {peutModifierListePrix ? (
          <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 p-2.5">
            <input
              type="checkbox"
              checked={reporter}
              onChange={(e) => setReporter(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
            />
            <span className="text-[11px] leading-snug text-slate-600">
              <span className="font-bold text-slate-800">Mettre à jour la liste de prix</span> (onglet Tarifs)
              <br />
              Le coût servira à tous les prochains devis. Les devis déjà créés gardent leur prix d&apos;origine.
            </span>
          </label>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
            Ce coût s&apos;applique <span className="font-bold">à ce devis seulement</span>. La modification de la liste de prix
            demande une autorisation particulière.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button onClick={() => onConfirmer(peutModifierListePrix && reporter)} className="min-h-0 py-2 text-xs">
            Confirmer
          </Button>
        </div>
      </div>
    </div>
  );
}

function OngletDevis({ clients, setClients, devisListe, setDevisListe, ajouterJournal, ajouterTacheAgenda, setProjets, onDevisTraite, persisterDevis, clientCible, peutModifierListePrix, onMajCoutCatalogue }) {
  // Liste de prix (289 items) — sert au sélecteur de lignes de devis.
  const catalogue = useCatalogue();
  // Taux de taxes des Paramètres — pour afficher le total client.
  const configEnt = useEntreprise();
  // AUCUN client présélectionné + recherche rapide (2026-08-17) —
  // même mécanique que le formulaire de tâche.
  const [clientId, setClientId] = useState("");
  const [filtreClientDevis, setFiltreClientDevis] = useState("");
  // 📋 LISTE OUVERTE AU CLIC (2026-08-25, demande du propriétaire) : la
  // liste n'apparaissait qu'après la première lettre — quand on a
  // OUBLIÉ le nom, il n'y a justement pas de première lettre à taper.
  // Un clic dans le champ montre tous les clients en ordre alphabétique.
  const [listeClientsDevisOuverte, setListeClientsDevisOuverte] = useState(false);
  // ARRIVÉE DEPUIS UNE FICHE CLIENT (bouton « + Créer un devis ») :
  // le client est déjà choisi, on ne le redemande pas. Même mécanisme
  // que la recherche rapide qui ouvre la bonne fiche.
  useEffect(() => {
    if (clientCible && clients.some((c) => c.id === clientCible)) setClientId(clientCible);
  }, [clientCible, clients]);
  const [nouvelleAdresseNom, setNouvelleAdresseNom] = useState("");
  const [nouvelleAdresseNomUnite, setNouvelleAdresseNomUnite] = useState("");
  const [lignes, setLignes] = useState([]);
  // 🙈 COÛTS MASQUÉS (demande du propriétaire, 2026-08-22) : chez le
  // client, l'écran du téléphone est visible par-dessus l'épaule — le
  // prix COÛTANT et la marge ne doivent pas s'y trouver. Masqués PAR
  // DÉFAUT ; les montants continuent d'être saisis, enregistrés et
  // comptés exactement pareil (on cache l'AFFICHAGE, jamais la donnée).
  // Le choix est mémorisé PAR APPAREIL : au bureau on les affiche une
  // fois, le téléphone reste discret de son côté.
  const [coutsVisibles, setCoutsVisibles] = useState(false);
  useEffect(() => {
    try {
      setCoutsVisibles(localStorage.getItem("devis-couts-visibles") === "1");
    } catch {
      // stockage indisponible — on reste sur « masqués », le choix sûr
    }
  }, []);
  const basculerCouts = () =>
    setCoutsVisibles((v) => {
      try {
        localStorage.setItem("devis-couts-visibles", v ? "0" : "1");
      } catch {}
      return !v;
    });
  // ✏️ Description en GRAND — { uid } : sur un téléphone, la petite
  // zone de deux lignes ne permet ni de lire ni d'écrire confortablement
  // l'argumentaire qui partira au client.
  const [descriptionOuverte, setDescriptionOuverte] = useState(null);
  const [pdfAperçu, setPdfAperçu] = useState(null);
  const [devisAperçu, setDevisAperçu] = useState(null);
  // Contrat d'entretien : le devis est facturé progressivement (2, 3 ou
  // 4 factures par an) — marqué dès sa création, repris automatiquement
  // à la création de la tâche « Entretien selon contrat ».
  const [estContrat, setEstContrat] = useState(false);
  const [frequenceContrat, setFrequenceContrat] = useState(4);
  // « ➕ Nouveau client » directement depuis le devis — fenêtre partagée
  // ModalNouveauClient (mêmes validations que l'onglet Clients). Le devis
  // en cours (lignes déjà saisies) reste intact derrière.
  const [modalNouveauClient, setModalNouveauClient] = useState(false);

  const client = clients.find((c) => c.id === clientId);

  const totaux = lignes.reduce(
    (acc, l) => ({
      coutant: acc.coutant + (Number(l.prix_coutant) || 0) * l.quantite,
      vendant: acc.vendant + (Number(l.prix_vendant) || 0) * l.quantite,
    }),
    { coutant: 0, vendant: 0 }
  );
  // MARGE CALCULÉE SUR LES SEULES LIGNES COMPLÈTES.
  //
  // Une ligne sans prix coûtant (tes forfaits d'installation, que
  // QuickBooks ne chiffre pas) est EXCLUE du calcul au lieu de le
  // fausser. Sinon un devis de 8 110 $ dont 8 100 $ ne sont pas évalués
  // affichait fièrement « 100 % de marge » — un chiffre faux et
  // rassurant, le pire mélange pour décider d'accepter un contrat.
  //
  // Le total VENDANT, lui, reste complet : c'est bien ce que le client
  // paiera. On ne cache rien, on refuse juste de calculer un
  // pourcentage sur du vide.
  const lignesEvaluees = lignes.filter((l) => (Number(l.prix_coutant) || 0) > 0);
  // Un RABAIS n'a pas de coût — ce n'est pas une donnée manquante, c'est
  // sa nature. Il ne doit donc jamais apparaître dans « coût manquant ».
  const lignesNonEvaluees = lignes.filter(
    (l) => !l.estRabais && (Number(l.prix_coutant) || 0) === 0 && (Number(l.prix_vendant) || 0) > 0
  );
  const evalues = lignesEvaluees.reduce(
    (acc, l) => ({
      coutant: acc.coutant + (Number(l.prix_coutant) || 0) * l.quantite,
      vendant: acc.vendant + (Number(l.prix_vendant) || 0) * l.quantite,
    }),
    { coutant: 0, vendant: 0 }
  );
  const montantNonEvalue = lignesNonEvaluees.reduce(
    (s, l) => s + (Number(l.prix_vendant) || 0) * l.quantite,
    0
  );
  const marge = evalues.vendant - evalues.coutant;
  const margePct = evalues.vendant > 0 ? (marge / evalues.vendant) * 100 : 0;

  // REPORT AU CATALOGUE — proposé quand le coûtant saisi sur une ligne
  // diffère de celui du catalogue, et seulement pour un item QUI VIENT
  // du catalogue : une ligne « sur mesure » ne doit jamais polluer la
  // liste de prix de l'entreprise.
  const [reportCatalogue, setReportCatalogue] = useState(null);
  const proposerReportCatalogue = (ligne) => {
    if (ligne.surMesure || !ligne.id) return;
    const item = (catalogue || []).find((i) => i.id === ligne.id);
    if (!item) return;
    const saisi = Number(ligne.prix_coutant) || 0;
    const auCatalogue = item.prix_coutant == null ? null : Number(item.prix_coutant);
    if (saisi <= 0) return;                       // rien de neuf à proposer
    if (auCatalogue != null && Math.abs(auCatalogue - saisi) < 0.005) return; // inchangé
    setReportCatalogue({ ligne, item, saisi, auCatalogue });
  };

  const ajouterLigne = (produit) => {
    // PRIX TOUJOURS NUMÉRIQUES SUR UNE LIGNE DE DEVIS.
    //
    // Dans le catalogue, un prix coûtant absent veut dire INCONNU — et
    // c'est le cas de tes 71 forfaits d'installation, que QuickBooks ne
    // chiffre pas. Mais une ligne de devis doit calculer : sans nombre,
    // l'affichage plantait dès l'ajout de l'item.
    //
    // On met donc 0, et la ligne est SIGNALÉE plus bas (« coût à
    // compléter ») : un 0 silencieux afficherait 100 % de marge sur un
    // forfait de 6 450 $, exactement le chiffre trompeur qu'on veut
    // éviter.
    const coutantInconnu = produit.prix_coutant == null;
    setLignes((prev) => [
      ...prev,
      {
        ...produit,
        uid: `${produit.id}-${Date.now()}`,
        quantite: 1,
        prix_coutant: Number(produit.prix_coutant) || 0,
        prix_vendant: Number(produit.prix_vendant) || 0,
        coutantInconnu,
      },
    ]);
  };
  const ajouterLignePersonnalisee = () => {
    setLignes((prev) => [
      ...prev,
      {
        uid: `perso-${Date.now()}`,
        nom: "",
        unite: "unité",
        quantite: 1,
        prix_coutant: 0,
        prix_vendant: 0,
        surMesure: true,
      },
    ]);
  };
  // LIEN D'ACCEPTATION — crée le jeton au premier clic (pas à la
  // création du devis : inutile d'exposer un lien qu'on n'enverra
  // peut-être jamais), puis le copie dans le presse-papier.
  // Le LIEN vit 1 an (des clients reviennent un an plus tard) ; la
  // clause « prix valides 30 jours » se joue sur la page publique, qui
  // ferme le bouton « Accepter » passé 30 jours.
  const [lienCopie, setLienCopie] = useState(null);
  const creerLienAcceptation = async (devis) => {
    let jeton = devis.jetonPublic;
    // ON REGÉNÈRE AUSSI UN JETON EXPIRÉ. Sans ça, recopier le lien d'un
    // vieux devis redonnait l'ancien jeton : le client cliquait et
    // tombait sur « Ce devis est expiré ». Quand on clique pour envoyer
    // un lien, on veut un lien qui MARCHE.
    const perime = !!devis.jetonExpireLe && new Date(devis.jetonExpireLe).getTime() < Date.now();
    if (!jeton || perime) {
      jeton = genererJeton();
      const expire = new Date(Date.now() + JOURS_VALIDITE_LIEN_DEVIS * 24 * 60 * 60 * 1000).toISOString();
      const maj = { ...devis, jetonPublic: jeton, jetonExpireLe: expire };
      setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? maj : d)));
      try {
        await persisterDevis(maj);
      } catch {
        ajouterJournal(`⚠️ Lien d'acceptation de ${devis.numero} créé localement mais NON enregistré — le client verrait une page invalide.`);
        return;
      }
      ajouterJournal(
        perime
          ? `🔗 Lien d'acceptation de ${devis.numero} EXPIRÉ — un nouveau lien a été créé (valide 1 an). L'ancien ne fonctionne plus.`
          : `🔗 Lien d'acceptation créé pour ${devis.numero} (valide 1 an — l'acceptation ferme après 30 jours, la consultation reste).`
      );
    }
    try {
      await navigator.clipboard?.writeText(lienDevisPublic(jeton));
      setLienCopie(devis.id);
      setTimeout(() => setLienCopie(null), 3000);
    } catch {
      // Presse-papier refusé — on montre le lien pour copie manuelle.
      window.prompt("Copie ce lien et envoie-le au client :", lienDevisPublic(jeton));
    }
  };

  // ------------------------------------------------------------
  // ENVOI DU DEVIS PAR COURRIEL — le client reçoit le lien
  // d'acceptation dans sa boîte : il clique, lit, accepte ou refuse.
  // ------------------------------------------------------------
  // Même règle de jeton que la copie du lien (expiré = régénéré), même
  // porte d'envoi que le reste du système (/api/courriel). Tant que le
  // service n'est pas configuré, le journal explique quoi faire — rien
  // n'échoue en silence.
  const [envoiDevis, setEnvoiDevis] = useState(null); // { devisId, choisis: [...], extra: "" }
  const [envoiDevisEnCours, setEnvoiDevisEnCours] = useState(false);
  const ficheClientDe = (devis) =>
    clients.find((c) => c.id === devis.clientId) ||
    clients.find((c) => (c.nom || "").trim().toLowerCase() === (devis.clientNom || "").trim().toLowerCase());
  const ouvrirEnvoiDevis = (devis) => {
    const fiche = ficheClientDe(devis);
    const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
    const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
    // Pré-coche l'adresse par défaut ; à défaut la première ; sinon rien
    // (le champ libre prend le relais pour un client sans courriel).
    setEnvoiDevis({ devisId: devis.id, choisis: defauts.length > 0 ? defauts : tous.slice(0, 1), extra: "", extraFiche: false });
  };
  const envoyerDevisParCourriel = async (devis) => {
    const extra = (envoiDevis?.extra || "").trim();
    const adresses = [...new Set([...(envoiDevis?.choisis || []), ...(extra ? [extra] : [])])];
    // 💾 L'adresse tapée rejoint la FICHE si demandé — la prochaine
    // fois, elle sera dans la liste à cocher.
    if (envoiDevis?.extraFiche && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)) {
      const fiche = ficheClientDe(devis);
      if (fiche) {
        setClients((prev) =>
          prev.map((c) => {
            if (c.id !== fiche.id) return c;
            if ((c.courriels || []).some((cc) => (cc.email || "").toLowerCase() === extra.toLowerCase())) return c;
            return { ...c, courriels: [...(c.courriels || []), { id: `cc-${Date.now()}`, label: "Ajouté à l'envoi", email: extra, defaut: (c.courriels || []).length === 0 }] };
          })
        );
        ajouterJournal(`💾 ${extra} ajouté à la fiche de ${fiche.nom}.`);
      }
    }
    if (adresses.length === 0) return;
    setEnvoiDevisEnCours(true);
    // Jeton valide — régénéré s'il est expiré, comme pour la copie.
    let jeton = devis.jetonPublic;
    const perime = !!devis.jetonExpireLe && new Date(devis.jetonExpireLe).getTime() < Date.now();
    if (!jeton || perime) {
      jeton = genererJeton();
      const expire = new Date(Date.now() + JOURS_VALIDITE_LIEN_DEVIS * 24 * 60 * 60 * 1000).toISOString();
      const maj = { ...devis, jetonPublic: jeton, jetonExpireLe: expire };
      setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? maj : d)));
      try {
        await persisterDevis(maj);
      } catch {
        ajouterJournal(`⚠️ Devis ${devis.numero} NON envoyé — le lien n'a pas pu être enregistré. Réessaie.`);
        setEnvoiDevisEnCours(false);
        return;
      }
    }
    const dejaAccepte = devis.reponseClient === "accepte";
    const r = await envoyerCourriel({
      a: adresses,
      sujet: dejaAccepte
        ? `Votre copie du devis ${devis.numero} — ${configEnt.nomCommercial || configEnt.nomLegal}`
        : `Devis ${devis.numero} — ${configEnt.nomCommercial || configEnt.nomLegal}`,
      html: gabaritDevis({
        config: configEnt,
        numero: devis.numero,
        clientNom: devis.clientNom,
        total: null,
        lien: lienDevisPublic(jeton),
        dejaAccepte,
      }),
    });
    setEnvoiDevisEnCours(false);
    if (r.envoye) {
      ajouterJournal(
        dejaAccepte
          ? `✉️ Copie du devis ${devis.numero} (déjà accepté) renvoyée à ${adresses.join(", ")}.`
          : `✉️ Devis ${devis.numero} ENVOYÉ à ${adresses.join(", ")} — le client peut répondre en ligne.`
      );
      setEnvoiDevis(null);
    } else if (r.simule) {
      ajouterJournal(
        `🔧 Envoi SIMULÉ du devis ${devis.numero} — le service de courriels n'est pas encore configuré (clé Resend absente dans Vercel). En attendant, « Copier le lien » et colle-le dans ton propre courriel.`
      );
      setEnvoiDevis(null);
    } else {
      ajouterJournal(`⚠️ Devis ${devis.numero} NON envoyé — ${r.erreur}`);
    }
  };

  // RABAIS — une ligne sur mesure au montant négatif, prête à remplir.
  // Le coûtant reste à 0 et la ligne est marquée `estRabais` pour ne
  // jamais être comptée comme « coût manquant » : un rabais n'a pas de
  // coût, ce n'est pas une donnée qui manque.
  const ajouterRabais = () => {
    setLignes((prev) => [
      ...prev,
      {
        uid: `rabais-${Date.now()}`,
        nom: "Rabais",
        unite: "unité",
        quantite: 1,
        prix_coutant: 0,
        prix_vendant: 0,
        surMesure: true,
        estRabais: true,
      },
    ]);
  };
  const majLigne = (uid, n) => setLignes((prev) => prev.map((l) => (l.uid === uid ? n : l)));
  const supprimerLigne = (uid) => setLignes((prev) => prev.filter((l) => l.uid !== uid));

  const enregistrerAdresse = (place) => {
    if (!nouvelleAdresseNom.trim()) return;
    const nouvelle = {
      id: `a-${Date.now()}`,
      nom: nouvelleAdresseNom,
      ligne1: place.label,
      ...(nouvelleAdresseNomUnite.trim() ? { appartement: nouvelleAdresseNomUnite.trim() } : {}),
      codePostal: place.codePostal,
    };
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, adresses: [...(c.adresses || []), nouvelle] } : c))
    );
    setNouvelleAdresseNom("");
    ajouterJournal(`Nouvelle adresse enregistrée au dossier de ${client.nom} : ${nouvelle.ligne1}`);
  };

  const [courrielModalOuvert, setCourrielModalOuvert] = useState(false);
  // ------------------------------------------------------------
  // VERSIONS DE DEVIS — un même dossier (numeroBase) peut avoir
  // plusieurs révisions. Une seule est ACTIVE ; les autres restent
  // consultables en lecture seule (on doit pouvoir revoir exactement ce
  // que le client avait reçu).
  // ------------------------------------------------------------
  // Dossier ouvert (numeroBase) + version affichée dans ses onglets.
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [versionAffichee, setVersionAffichee] = useState(null);
  const [noteNouvelleVersion, setNoteNouvelleVersion] = useState("");
  const [creationVersionPour, setCreationVersionPour] = useState(null);

  const versionsDuDossier = (numeroBase) =>
    devisListe.filter((d) => (d.numeroBase || d.numero) === numeroBase).sort((a, b) => (a.version ?? 0) - (b.version ?? 0));

  // Un seul enregistrement par DOSSIER dans la liste : la version active
  // (ou la plus récente à défaut). Sinon la liste triplerait.
  // 📝 Les BROUILLONS vivent dans leur propre section — ils n'ont pas
  // de numéro officiel et ne sont pas des dossiers.
  const brouillonsDevis = devisListe.filter((d) => d.statut === "brouillon");
  const dossiersDevis = (() => {
    const parBase = {};
    devisListe.filter((d) => d.statut !== "brouillon").forEach((d) => {
      const base = d.numeroBase || d.numero;
      (parBase[base] = parBase[base] || []).push(d);
    });
    return Object.entries(parBase)
      .map(([base, versions]) => {
        const triees = versions.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
        const active = triees.find((v) => v.versionActive !== false) || triees[triees.length - 1];
        return { base, versions: triees, active };
      })
      .sort((a, b) => (b.active.creeLe || b.active.date || "").localeCompare(a.active.creeLe || a.active.date || ""));
  })();

  // ÉDITION D'UNE VERSION : { source, note } — les lignes du devis
  // source sont chargées dans le constructeur pour être modifiées
  // (ajout/retrait de produits, quantités, prix) avant enregistrement.
  const [editionVersion, setEditionVersion] = useState(null);
  // 📄 Pagination (2026-08-26) : avant, la liste était COUPÉE aux 10
  // premiers — le 11e devis était invisible. 10 par page, tout visible.
  const [pageDevis, setPageDevis] = useState(1);
  const refListeDevis = useRef(null);

  // Étape 1 : charger la version source dans le constructeur. Le devis
  // d'origine reste INTACT tant que rien n'est enregistré (règle A :
  // un devis envoyé ne se modifie jamais, il se révise).
  const demarrerNouvelleVersion = (source, note) => {
    setLignes(
      (source.lignes || []).map((l, i) => ({ ...l, uid: `${l.uid || "l"}-copie-${Date.now()}-${i}` }))
    );
    setClientId(source.clientId || clientId);
    setEstContrat(!!source.estContrat);
    setFrequenceContrat(source.frequenceFacturationAnnuelle || 4);
    setEditionVersion({ source, note: (note || "").trim() });
    setCreationVersionPour(null);
    setNoteNouvelleVersion("");
    // Remonte au constructeur (il est en haut de la colonne de gauche).
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const annulerEdition = () => {
    setEditionVersion(null);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
  };

  // Étape 2 : enregistrer la révision AVEC les lignes modifiées.
  // Incrémente le suffixe et archive les versions précédentes.
  const enregistrerVersion = () => {
    if (!editionVersion) return;
    const { source, note } = editionVersion;
    const base = source.numeroBase || source.numero;
    const versions = versionsDuDossier(base);
    const prochaineVersion = Math.max(...versions.map((v) => v.version ?? 0)) + 1;
    const numero = `${base}-${prochaineVersion}`;
    const revision = {
      ...source,
      id: numero,
      numero,
      numeroBase: base,
      version: prochaineVersion,
      versionActive: true,
      // La révision repart « envoyée » : elle n'est ni acceptée ni traitée.
      statut: "envoye",
      traite: false,
      modeTraitement: null,
      projetId: null,
      date: todayISO(),
      courrielEnvoi: null,
      courrielsEnvoi: [],
      noteVersion: note,
      creeLe: new Date().toISOString(),
      // Les lignes MODIFIÉES dans le constructeur — la version d'origine
      // n'est jamais touchée.
      lignes,
      totalCoutant: totaux.coutant,
      totalVendant: totaux.vendant,
      estContrat,
      frequenceFacturationAnnuelle: estContrat ? frequenceContrat : null,
    };
    setDevisListe((prev) => [revision, ...prev.map((d) => ((d.numeroBase || d.numero) === base ? { ...d, versionActive: false } : d))]);
    persisterDevis?.(revision);
    activerVersionDevis(base, numero).catch(() => {});
    ajouterJournal(
      `📄 Version ${numero} enregistrée à partir de ${source.numero}${note ? ` — ${note}` : ""} · ${totaux.vendant.toFixed(2)} $ (les versions précédentes restent consultables)`
    );
    setEditionVersion(null);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
    setDossierOuvert(base);
    setVersionAffichee(numero);
  };

  const demarrerCreationDevis = () => {
    if (lignes.length === 0 || !clientId) return;
    setCourrielModalOuvert(true);
  };

  // ============================================================
  // 📝 BROUILLON DE DEVIS (séance 3, plan du propriétaire) —
  // commencer sur le téléphone chez le client, finir au bureau, SANS
  // consommer de numéro officiel. Le brouillon n'a ni numéro de la
  // séquence, ni courriel, ni miroir QuickBooks : c'est une feuille de
  // travail. « Reprendre » recharge tout dans le formulaire ; créer le
  // devis pour vrai prend alors un numéro et efface le brouillon.
  // ============================================================
  const [reprisBrouillonId, setReprisBrouillonId] = useState(null);
  const [brouillonASupprimer, setBrouillonASupprimer] = useState(null); // deux temps
  const garderBrouillon = async () => {
    if (lignes.length === 0 || !clientId) return;
    const brouillon = {
      // Reprise d'un brouillon existant : on ÉCRASE le même — pas de
      // multiplication de copies à chaque sauvegarde.
      id: reprisBrouillonId || `BR-${Date.now()}`,
      numero: reprisBrouillonId || `BR-${Date.now()}`,
      numeroBase: reprisBrouillonId || `BR-${Date.now()}`,
      version: 0,
      versionActive: true,
      clientId,
      clientNom: client?.nom || "",
      lignes,
      totalCoutant: totaux.coutant,
      totalVendant: totaux.vendant,
      statut: "brouillon",
      date: todayISO(),
      estContrat,
      frequenceFacturationAnnuelle: estContrat ? frequenceContrat : null,
    };
    // id/numero/numeroBase doivent être IDENTIQUES entre eux — recalcule
    // une seule fois si nouveau.
    if (!reprisBrouillonId) {
      const idB = `BR-${Date.now()}`;
      brouillon.id = idB; brouillon.numero = idB; brouillon.numeroBase = idB;
    }
    setDevisListe((prev) => [brouillon, ...prev.filter((d) => d.id !== brouillon.id)]);
    await persisterDevis?.(brouillon);
    ajouterJournal(`📝 Brouillon de devis gardé pour ${client?.nom || "?"} (${totaux.vendant.toFixed(2)} $, ${lignes.length} ligne${lignes.length > 1 ? "s" : ""}) — aucun numéro consommé.`);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
    setClientId("");
    setReprisBrouillonId(null);
  };
  const reprendreBrouillon = (b) => {
    setClientId(b.clientId || "");
    setLignes(Array.isArray(b.lignes) ? b.lignes : []);
    setEstContrat(!!b.estContrat);
    setFrequenceContrat(b.frequenceFacturationAnnuelle || 4);
    setReprisBrouillonId(b.id);
    ajouterJournal(`📝 Brouillon repris dans le formulaire (${b.clientNom}) — crée le devis pour lui donner son numéro officiel.`);
  };
  const supprimerBrouillon = async (b) => {
    setDevisListe((prev) => prev.filter((d) => d.id !== b.id));
    if (reprisBrouillonId === b.id) setReprisBrouillonId(null);
    setBrouillonASupprimer(null);
    await supprimerDevis(b.id).catch(() => {});
    ajouterJournal(`🗑️ Brouillon de devis supprimé (${b.clientNom}, ${Number(b.totalVendant || 0).toFixed(2)} $) — c'était une feuille de travail, aucun numéro n'y était attaché.`);
  };

  const creerDevis = async (choixCourriels) => {
    // Choix MULTIPLE : le devis peut partir à plusieurs contacts du client.
    const destinataires = listeDestinataires(choixCourriels);
    // Numéro SÉQUENTIEL attribué par la base (aucun doublon possible).
    let numero;
    try {
      numero = await numeroDevis();
    } catch {
      numero = genererNumeroSecours("DEV");
      ajouterJournal("⚠️ Numéro de devis séquentiel indisponible — numéro de secours attribué, à corriger manuellement.");
    }
    // ENVOI RÉEL À LA CRÉATION — le détour « aller dans Devis récents
    // puis Envoyer par courriel » créait des oublis. Désormais : des
    // destinataires choisis = le courriel part TOUT DE SUITE, avec le
    // lien d'acceptation (jeton généré ici, 1 an, comme partout).
    const jeton = destinataires.length > 0 ? genererJeton() : null;
    const nouveauDevis = {
      id: numero,
      numero,
      // Nouveau dossier : version 0, active. Les révisions à venir
      // partageront ce numeroBase (DEV-3500 → DEV-3500-1, -2 …).
      numeroBase: numero,
      version: 0,
      versionActive: true,
      clientId,
      clientNom: client.nom,
      lignes,
      totalCoutant: totaux.coutant,
      totalVendant: totaux.vendant,
      statut: "envoye",
      date: todayISO(),
      courrielEnvoi: destinataires[0]?.email || null,
      courrielsEnvoi: destinataires.map((c) => c.email),
      ...(jeton ? { jetonPublic: jeton, jetonExpireLe: new Date(Date.now() + JOURS_VALIDITE_LIEN_DEVIS * 24 * 60 * 60 * 1000).toISOString() } : {}),
      // Contrat d'entretien : fréquence portée par le devis lui-même,
      // reprise automatiquement à la création de la tâche.
      estContrat,
      frequenceFacturationAnnuelle: estContrat ? frequenceContrat : null,
    };
    setDevisListe((prev) => [nouveauDevis, ...prev]);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
    setCourrielModalOuvert(false);
    // ON ATTEND la confirmation d'enregistrement AVANT tout envoi : un
    // devis qui n'est pas en base ne doit JAMAIS générer un courriel
    // (sinon le client reçoit un lien mort — vécu avec DEV-3509).
    const enregistre = await persisterDevis?.(nouveauDevis);
    if (enregistre === false) {
      // ⚠️ RETRAIT DU FANTÔME (audit 2026-08-17) : le devis avait été
      // ajouté à la liste AVANT la confirmation — le laisser affiché
      // offrait encore « Envoyer au client »/« Copier le lien » sur un
      // devis inexistant en base (lien mort DEV-3509 en différé).
      setDevisListe((prev) => prev.filter((d) => d.id !== nouveauDevis.id));
      ajouterJournal(`⛔ Devis ${numero} NON enregistré — retiré de la liste, AUCUN courriel envoyé (pas de lien mort). Vérifie la connexion et recrée le devis.`);
      return;
    }
    // 📝 Devis créé à partir d'un BROUILLON : le brouillon a fait son
    // travail, il s'efface — seulement APRÈS l'enregistrement confirmé
    // du vrai devis (jamais avant : sinon une panne effacerait les deux).
    if (reprisBrouillonId) {
      const idBrouillon = reprisBrouillonId;
      setReprisBrouillonId(null);
      setDevisListe((prev) => prev.filter((d) => d.id !== idBrouillon));
      supprimerDevis(idBrouillon).catch(() => {});
      ajouterJournal(`📝 Brouillon transformé en devis ${numero} — le brouillon est effacé.`);
    }
    if (destinataires.length === 0) {
      ajouterJournal(`Devis ${numero} créé pour ${client.nom} (${totaux.vendant.toFixed(2)} $) — aucun courriel disponible pour l'envoi`);
      return;
    }
    // Le journal ne dit « envoyé » QUE si c'est vrai — plus jamais de
    // « créé et envoyé » fictif.
    const r = await envoyerCourriel({
      a: destinataires.map((c) => c.email),
      sujet: `Devis ${numero} — ${configEnt.nomCommercial || configEnt.nomLegal}`,
      html: gabaritDevis({
        config: configEnt,
        numero,
        clientNom: client.nom,
        total: null,
        lien: lienDevisPublic(jeton),
      }),
    });
    if (r.envoye) {
      ajouterJournal(`✉️ Devis ${numero} créé ET envoyé à ${libelleDestinataires(destinataires)} pour ${client.nom} (${totaux.vendant.toFixed(2)} $) — le client peut accepter en ligne.`);
    } else if (r.simule) {
      ajouterJournal(`Devis ${numero} créé (${totaux.vendant.toFixed(2)} $) — envoi SIMULÉ : le service de courriels n'est pas configuré ici. Utilise « Copier le lien » en attendant.`);
    } else {
      ajouterJournal(`⚠️ Devis ${numero} créé, mais courriel NON parti — ${r.erreur || "erreur d'envoi"}. Réessaie avec « Envoyer par courriel » dans Devis récents.`);
    }
  };

  const [devisATraiterId, setDevisATraiterId] = useState(null);
  const devisATraiter = devisListe.find((d) => d.id === devisATraiterId) || null;

  // "Marquer accepté" ne fait plus QUE changer le statut — l'admin
  // choisit ENSUITE explicitement, via "Traiter le devis", comment ce
  // devis accepté doit être converti (bon de travail direct ou
  // nouveau projet d'envergure). `traite` distingue un devis accepté
  // mais pas encore converti d'un devis déjà traité.
  const accepterDevis = (devis) => {
    setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? { ...d, statut: "accepte", traite: false } : d)));
    persisterDevis?.({ ...devis, statut: "accepte", traite: false });
    ajouterJournal(`✅ Devis ${devis.numero} marqué accepté — prêt à être traité ("Traiter le devis")`);
  };

  // OPTION A — Intervention directe : le devis devient un bon de
  // travail unique, pré-rempli, envoyé directement dans l'agenda pour
  // attribution à un technicien. Conserve l'automatisation BC/achats
  // (du matériel est probablement encore nécessaire pour intervenir),
  // et surtout `devisNumero` — c'est ce lien qui permet à ce travail
  // d'apparaître ensuite dans l'onglet Facturation (facturation
  // progressive plafonnée au devis) puis d'être converti en facture
  // QuickBooks, exactement comme les devis traités par l'ancien flux.
  const traiterCommeBonDeTravail = async (devis, adresseTravaux) => {
    let numeroBc;
    try {
      numeroBc = await numeroBonCommande();
    } catch {
      numeroBc = genererNumeroSecours("BC");
      ajouterJournal("⚠️ Numéro de BC séquentiel indisponible — numéro de secours attribué, à corriger manuellement.");
    }
    const materiaux = devis.lignes.map((l) => ({ description: l.nom, quantite: l.quantite, unite: l.unite || "unité" }));

    setPdfAperçu({ numero: numeroBc, client: devis.clientNom, materiaux, date: todayISO() });
    ajouterJournal(`📄 Bon de commande ${numeroBc} généré (PDF, sans prix de vente)`);
    ajouterJournal(`📧 Courriel envoyé à achats@ventilationdgl.com — pièce jointe : ${numeroBc}.pdf`);

    ajouterTacheAgenda({
      id: `tache-${devis.id}`,
      clientId: devis.clientId,
      clientNom: devis.clientNom,
      titre: `Devis ${devis.numero} — Intervention`,
      description: materiaux.map((m) => `${m.quantite} × ${m.description}`).join(", "),
      statut: "a_planifier",
      heures: 1,
      jours: 0,
      sauterWeekend: false,
      typeTache: "devis",
      devisNumero: devis.numero,
      adresseTravaux: adresseTravaux || null,
    });

    setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? { ...d, traite: true, modeTraitement: "bon_travail" } : d)));
    persisterDevis?.({ ...devis, traite: true, modeTraitement: "bon_travail" });
    ajouterJournal(`🔧 Devis ${devis.numero} converti en bon de travail — prêt pour attribution dans l'agenda. Lien QuickBooks conservé (facturation finale via l'onglet Facturation).`);
    setDevisATraiterId(null);
    onDevisTraite?.("agenda");
  };

  // OPTION B — Nouveau projet d'envergure : le montant du devis
  // devient le budget initial du projet, et chaque ligne du devis
  // devient une tâche/étape distincte dans l'agenda, rattachée au
  // projet via projetId — pour un suivi de rentabilité dès le départ.
  const traiterCommeProjet = (devis, { tauxHoraireCoutant, dateFin, adresseTravaux }) => {
    const nouveauProjetId = `projet-${Date.now()}`;
    const nouveauProjet = {
      id: nouveauProjetId,
      nom: `Devis ${devis.numero} — ${devis.clientNom}`,
      clientId: devis.clientId,
      adresseTravaux: adresseTravaux || null,
      dateDebut: todayISO(),
      dateFin: dateFin || "",
      statut: "a_planifier",
      budgetTotal: devis.totalVendant,
      tauxHoraireCoutant: parseFloat(tauxHoraireCoutant) || 45,
      bonsCommande: [],
    };
    setProjets((prev) => [...prev, nouveauProjet]);

    // Chaque ligne du devis devient une étape/tâche distincte, déjà
    // rattachée au nouveau projet — l'admin n'a plus qu'à les
    // assigner dans l'agenda au fur et à mesure de l'avancement.
    devis.lignes.forEach((ligne, i) => {
      ajouterTacheAgenda({
        id: `tache-${devis.id}-etape-${i}`,
        clientId: devis.clientId,
        clientNom: devis.clientNom,
        titre: `${devis.numero} — ${ligne.nom}`,
        description: `${ligne.quantite} × ${ligne.nom}`,
        statut: "a_planifier",
        heures: 1,
        jours: 0,
        sauterWeekend: false,
        typeTache: "devis",
        devisNumero: devis.numero,
        projetId: nouveauProjetId,
        adresseTravaux: adresseTravaux || null,
      });
    });

    setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? { ...d, traite: true, modeTraitement: "projet", projetId: nouveauProjetId } : d)));
    persisterDevis?.({ ...devis, traite: true, modeTraitement: "projet", projetId: nouveauProjetId });
    ajouterJournal(
      `🏗️ Devis ${devis.numero} converti en projet "${nouveauProjet.nom}" (budget initial ${devis.totalVendant.toFixed(2)} $, ${devis.lignes.length} étape${devis.lignes.length > 1 ? "s" : ""} ajoutée${devis.lignes.length > 1 ? "s" : ""} à l'agenda). Lien QuickBooks conservé (facturation progressive via l'onglet Facturation).`
    );
    setDevisATraiterId(null);
    onDevisTraite?.("projets");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="grid gap-6 md:grid-cols-5">
        {/* CONSTRUCTEUR DE DEVIS */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-3 md:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
            {editionVersion ? "Modification en cours" : "Nouveau devis"}
          </h2>
          {/* MODE ÉDITION — les lignes de la version source sont chargées
              ici. Le devis d'origine reste INTACT : l'enregistrement crée
              une NOUVELLE version (règle validée : un devis envoyé ne se
              modifie jamais, il se révise). */}
          {editionVersion && (
            <div className="rounded-xl border border-blue-300 bg-blue-50 p-2.5">
              <p className="text-xs font-bold text-blue-900">
                ✏️ Nouvelle version à partir de {editionVersion.source.numero}
              </p>
              <p className="mt-0.5 text-[10px] text-blue-700">
                Ajoute ou retire des produits, change les quantités et les prix. {editionVersion.source.numero} ne sera pas modifié — une nouvelle version sera créée à l'enregistrement.
              </p>
              {editionVersion.note && <p className="mt-1 text-[10px] italic text-blue-600">Raison : {editionVersion.note}</p>}
              <Button variant="outline" onClick={annulerEdition} className="mt-2 w-full min-h-0 py-1.5 text-[11px]">
                Annuler la modification
              </Button>
            </div>
          )}

          {/* TYPE DE DEVIS — choisi dès le départ, bien visible (comme les
              boutons Jour/Semaine/Mois de l'agenda) : travaux réguliers, ou
              entretien périodique facturé selon contrat (1 à 4 fois/an). */}
          <div className="flex rounded-xl border border-slate-200 p-0.5">
            <button
              onClick={() => setEstContrat(false)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${!estContrat ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              Travaux réguliers
            </button>
            <button
              onClick={() => setEstContrat(true)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${estContrat ? "bg-purple-700 text-white" : "text-slate-500"}`}
            >
              📄 Entretien périodique
            </button>
          </div>
          {estContrat && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-2.5">
              <label className="mb-0.5 block text-[10px] font-bold text-purple-800">Fréquence de facturation du contrat</label>
              <select
                value={frequenceContrat}
                onChange={(e) => setFrequenceContrat(parseInt(e.target.value))}
                className="w-full rounded-lg border border-purple-300 bg-white px-2 py-1.5 text-xs font-semibold"
              >
                {FREQUENCES_CONTRAT.map((f) => (
                  <option key={f} value={f}>
                    {f === 1 ? "1 facture par an (montant complet payé en une fois)" : `${f} factures par an (1/${f} du montant à chaque échéance)`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Client</label>
            <button
              type="button"
              onClick={() => setModalNouveauClient(true)}
              className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 active:scale-[0.99]"
            >
              ➕ Nouveau client…
            </button>
            <input
              value={filtreClientDevis}
              onChange={(e) => setFiltreClientDevis(e.target.value)}
              onFocus={() => setListeClientsDevisOuverte(true)}
              // Petit délai avant de fermer : le clic sur un nom de la
              // liste doit avoir le temps de compter avant que le champ
              // perde le focus.
              onBlur={() => setTimeout(() => setListeClientsDevisOuverte(false), 200)}
              placeholder="🔍 Clique pour la liste, ou tape le nom…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            />
            {(listeClientsDevisOuverte || filtreClientDevis.trim() !== "") && (
              <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {clients
                  .filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientDevis.trim().toLowerCase()))
                  .sort((a, b) => nomAffichageClient(a).localeCompare(nomAffichageClient(b), "fr"))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setClientId(c.id); setFiltreClientDevis(""); setListeClientsDevisOuverte(false); }}
                      className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 last:border-0 active:bg-orange-50"
                    >
                      <span className="block truncate">{nomAffichageClient(c)}</span>
                    </button>
                  ))}
                {clients.filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientDevis.trim().toLowerCase())).length === 0 && (
                  <p className="px-3 py-2.5 text-xs text-slate-400">Aucun client trouvé — crée-le avec « ➕ Nouveau client… » juste au-dessus.</p>
                )}
              </div>
            )}
            {(() => {
              const c = clients.find((x) => x.id === clientId);
              return c ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-[#FF6A13] bg-orange-50 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-bold text-slate-800">{c.nom}</span>
                  <button type="button" onClick={() => setClientId("")} className="shrink-0 text-[11px] font-bold text-slate-400 underline underline-offset-2">
                    changer
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[11px] font-bold text-amber-600">— Choisis le client (tape son nom, ou crée-le avec ➕) —</p>
              );
            })()}
          </div>

          {/* Ajouter une adresse — SEULEMENT quand un client est choisi :
              sans client sélectionné, `client` est undefined et lire
              `client.nom` faisait planter tout l'onglet Devis (depuis le
              retrait de la présélection, 2026-08-17). */}
          {client && (
            <div className="rounded-xl bg-slate-50 p-3">
              <label className="mb-1 block text-xs font-bold text-slate-500">Ajouter une adresse au dossier client</label>
              <input
                value={nouvelleAdresseNom}
                onChange={(e) => setNouvelleAdresseNom(e.target.value)}
                placeholder="Nom de l'adresse (ex: Chantier Sud)"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={nouvelleAdresseNomUnite}
                onChange={(e) => setNouvelleAdresseNomUnite(e.target.value)}
                placeholder="App. / bureau / casier postal (facultatif)"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <AutocompleteAdresse onSelection={enregistrerAdresse} />
              <p className="mt-1 text-[11px] text-slate-400">Sélectionner un résultat enregistre l'adresse au dossier de {client.nom}.</p>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                Lignes du devis
                {/* 👁️ L'interrupteur des coûts — bien en vue : d'un tap,
                    l'écran devient montrable au client. */}
                <button
                  type="button"
                  onClick={basculerCouts}
                  title={coutsVisibles ? "Masquer les coûts et la marge (écran montrable au client)" : "Afficher les coûts et la marge"}
                  className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                    coutsVisibles ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {coutsVisibles ? "👁️ Coûts visibles" : "🙈 Coûts masqués"}
                </button>
              </label>
              <div className="flex gap-1.5">
                <SelecteurItem catalogue={catalogue} onChoisir={(p) => ajouterLigne(p)} />
                <Button variant="outline" onClick={ajouterLignePersonnalisee} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
                  <Plus size={12} /> Ligne sur mesure
                </Button>
                {/* RABAIS — une ligne au montant NÉGATIF. Rien
                    n'empêchait d'en saisir une à la main, mais il
                    fallait deviner qu'un prix pouvait être négatif.
                    Le rabais s'applique AVANT les taxes, comme il se
                    doit : on ne facture pas de taxes sur un montant
                    que le client ne paie pas. */}
                <Button variant="outline" onClick={ajouterRabais} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
                  − Rabais
                </Button>
              </div>
            </div>

            {/* 📱 LIGNES EN CARTES — TÉLÉPHONE (2026-08-21)
                ------------------------------------------------------------
                Le tableau à 4 colonnes (produit, qté, coûtant, vendant)
                est écrasé sur un écran de 6 pouces : on se trompe de
                case. Même devis, une CARTE par ligne, avec de vrais
                champs sous le pouce. Tout est modifiable comme sur
                l'ordinateur — c'est la même donnée. */}
            <div className="space-y-2 md:hidden">
              {lignes.map((l) => {
                const totalLigne = (Number(l.prix_vendant) || 0) * (Number(l.quantite) || 0);
                const coutant = Number(l.prix_coutant) || 0;
                return (
                  <div key={l.uid} className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      {l.surMesure ? (
                        <input
                          type="text"
                          value={l.nom}
                          onChange={(e) => majLigne(l.uid, { ...l, nom: e.target.value })}
                          placeholder="Détail de l'item…"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm font-semibold"
                        />
                      ) : (
                        <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900">{l.nom}</p>
                      )}
                      <button
                        onClick={() => supprimerLigne(l.uid)}
                        aria-label="Retirer la ligne"
                        className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* ✏️ La description s'ouvre EN GRAND d'un tap — deux
                        lignes ne suffisent ni pour lire ni pour écrire
                        l'argumentaire qui partira au client. */}
                    <button
                      type="button"
                      onClick={() => setDescriptionOuverte({ uid: l.uid })}
                      className="mt-2 flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left"
                    >
                      <span className={`min-w-0 flex-1 text-[12px] leading-snug ${l.description ? "text-slate-600" : "italic text-slate-400"}`}>
                        {l.description || "Ajouter une description visible par le client…"}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-slate-400">✏️</span>
                    </button>
                    <div className={`mt-2 grid gap-2 ${coutsVisibles ? "grid-cols-3" : "grid-cols-2"}`}>
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Qté</label>
                        <input
                          type="number"
                          min={1}
                          value={l.quantite}
                          onChange={(e) => majLigne(l.uid, { ...l, quantite: parseFloat(e.target.value) || 1 })}
                          className="min-h-[44px] w-full rounded-lg border border-slate-300 px-2 text-center text-sm tabular-nums"
                        />
                      </div>
                      {/* 🙈 Le COÛTANT n'apparaît que si les coûts sont
                          affichés — mais il continue d'être enregistré et
                          compté dans la marge, masqué ou non. */}
                      {coutsVisibles && (
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Coûtant</label>
                          <InputNombreDecimal
                            valeur={l.prix_coutant}
                            onChange={(v) => majLigne(l.uid, { ...l, prix_coutant: v })}
                            onBlur={() => proposerReportCatalogue(l)}
                            className={`min-h-[44px] w-full rounded-lg border px-2 text-right text-sm tabular-nums ${
                              coutant === 0 ? "border-amber-400 bg-amber-50" : "border-slate-300"
                            }`}
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Vendant</label>
                        <InputNombreDecimal
                          valeur={l.prix_vendant}
                          onChange={(v) => majLigne(l.uid, { ...l, prix_vendant: v })}
                          className={`min-h-[44px] w-full rounded-lg border px-2 text-right text-sm font-bold tabular-nums ${
                            (Number(l.prix_vendant) || 0) < 0 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-300"
                          }`}
                        />
                      </div>
                    </div>
                    <p className="mt-1.5 flex items-center justify-between text-[11px]">
                      {coutsVisibles ? (
                        <span className={coutant === 0 ? "font-semibold text-amber-600" : "text-slate-400"}>
                          {coutant === 0 ? "⚠️ Coût inconnu — hors marge" : `Marge ${margePourcent(coutant, Number(l.prix_vendant) || 0).toFixed(0)} %`}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="font-bold tabular-nums text-slate-700">{totalLigne.toFixed(2)} $</span>
                    </p>
                  </div>
                );
              })}
              {lignes.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">Aucune ligne — ajoute un produit du catalogue.</p>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-1.5 font-semibold">Produit</th>
                    <th className="pb-1.5 text-center font-semibold">Qté</th>
                    {coutsVisibles && <th className="pb-1.5 text-right font-semibold">Coûtant</th>}
                    <th className="pb-1.5 text-right font-semibold">Vendant</th>
                    <th className="pb-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.uid} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 font-semibold text-slate-800">
                        {l.surMesure ? (
                          <input
                            type="text"
                            value={l.nom}
                            onChange={(e) => majLigne(l.uid, { ...l, nom: e.target.value })}
                            placeholder="Détail de l'item..."
                            className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
                          />
                        ) : (
                          l.nom
                        )}
                        {/* DESCRIPTION DE L'ITEM — modèles, garantie,
                            numéros AHRI, subventions… Elle vient du
                            catalogue (importée de QuickBooks) et part
                            SUR LE DEVIS DU CLIENT : c'est l'argumentaire
                            de vente, il n'a rien à faire caché au fond
                            de la base de données.
                            Modifiable ici : on l'ajuste pour CE devis
                            sans toucher au catalogue. */}
                        <textarea
                          rows={hauteurDescription(l.description)}
                          value={l.description || ""}
                          onChange={(e) => majLigne(l.uid, { ...l, description: e.target.value })}
                          placeholder="Description visible par le client (modèles, garantie, ce qui est inclus…)"
                          className="mt-1 w-full resize-y rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] font-normal leading-snug text-slate-600 outline-none focus:border-slate-400"
                        />
                        <p className="mt-0.5 flex items-center justify-between gap-2 text-[9px] italic text-slate-400">
                          <span>Modifiable — n&apos;affecte que ce devis, pas le catalogue.</span>
                          <button
                            type="button"
                            onClick={() => setDescriptionOuverte({ uid: l.uid })}
                            className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold not-italic text-slate-500 hover:border-slate-400 hover:text-slate-700"
                          >
                            ⤢ Agrandir
                          </button>
                        </p>
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={l.quantite}
                          onChange={(e) => majLigne(l.uid, { ...l, quantite: parseFloat(e.target.value) || 1 })}
                          className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center tabular-nums"
                        />
                      </td>
                      {/* COÛTANT TOUJOURS MODIFIABLE — c'est ici qu'on
                          complète un forfait dont QuickBooks ne connaît
                          pas le coût, au moment où on monte le devis.
                          En sortant du champ, une fenêtre propose de
                          reporter le prix au catalogue (si le droit
                          l'autorise). Encadré en ambre tant qu'il est à
                          zéro : la ligne n'entre pas dans la marge. */}
                      {coutsVisibles && (
                        <td className="py-1.5 text-right tabular-nums text-slate-500">
                          <InputNombreDecimal
                            valeur={l.prix_coutant}
                            onChange={(v) => majLigne(l.uid, { ...l, prix_coutant: v })}
                            onBlur={() => proposerReportCatalogue(l)}
                            className={`w-16 rounded border px-1 py-0.5 text-right tabular-nums ${
                              (Number(l.prix_coutant) || 0) === 0
                                ? "border-amber-400 bg-amber-50"
                                : "border-slate-300"
                            }`}
                          />
                        </td>
                      )}
                      {/* PRIX DE VENTE TOUJOURS MODIFIABLE — il ne
                          l'était que sur les lignes « sur mesure » :
                          sur un item du catalogue, c'était du texte
                          figé. Impossible d'ajuster un prix pour un
                          client, ni de saisir un rabais.
                          Les valeurs NÉGATIVES sont acceptées (rabais,
                          crédit) : le champ et les totaux les gèrent. */}
                      <td className="py-1.5 text-right tabular-nums font-semibold text-slate-900">
                        <InputNombreDecimal
                          valeur={l.prix_vendant}
                          onChange={(v) => majLigne(l.uid, { ...l, prix_vendant: v })}
                          className={`w-20 rounded border px-1 py-0.5 text-right tabular-nums font-semibold ${
                            (Number(l.prix_vendant) || 0) < 0
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : "border-slate-300"
                          }`}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => supprimerLigne(l.uid)} className="text-slate-300 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lignes.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Aucune ligne — ajoute un produit du catalogue.</p>}
            </div>
          </div>

          {lignes.length > 0 && (
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
              {coutsVisibles && (
                <div className="flex justify-between text-slate-500"><span>Total coûtant</span><span className="tabular-nums">{totaux.coutant.toFixed(2)} $</span></div>
              )}
              <div className="flex justify-between font-bold text-slate-900"><span>Sous-total (HT)</span><span className="tabular-nums">{totaux.vendant.toFixed(2)} $</span></div>

              {/* TAXES — elles n'apparaissaient qu'au moment de l'aperçu
                  client. Or c'est le TOTAL TTC que le client compare et
                  retient : il doit être visible pendant qu'on monte le
                  devis, pas seulement à la fin. Taux lus dans les
                  Paramètres de l'entreprise. */}
              {(() => {
                const { tps, tvq, total } = calculerTaxes(totaux.vendant, configEnt);
                return (
                  <>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span>
                      <span className="tabular-nums">{tps.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span>
                      <span className="tabular-nums">{tvq.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-extrabold text-slate-900">
                      <span>Total client</span>
                      <span className="tabular-nums">{total.toFixed(2)} $</span>
                    </div>
                  </>
                );
              })()}
              {/* 🙈 MARGE ET COÛTS — masqués par défaut : l'écran est
                  souvent tourné vers le client pendant qu'on monte le
                  devis. Les chiffres restent enregistrés et calculés,
                  seul l'affichage disparaît. Le rappel « lignes sans
                  coûtant » reste, lui, visible : il ne dévoile aucun
                  montant et évite d'envoyer un devis à l'aveugle. */}
              {!coutsVisibles && lignesNonEvaluees.length > 0 && (
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>🙈 Coûts masqués</span>
                  <span>
                    {lignesNonEvaluees.length} ligne{lignesNonEvaluees.length > 1 ? "s" : ""} sans coûtant
                  </span>
                </div>
              )}
              {coutsVisibles && (
              <div className={`flex justify-between ${lignesNonEvaluees.length > 0 ? "text-slate-600" : "text-emerald-600"}`}>
                <span>
                  Marge
                  {lignesNonEvaluees.length > 0 && (
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      sur {lignesEvaluees.length} ligne{lignesEvaluees.length > 1 ? "s" : ""} sur {lignes.length}
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {lignesEvaluees.length === 0
                    ? "— non évaluable"
                    : `${marge.toFixed(2)} $ (${margePct.toFixed(0)}%)`}
                </span>
              </div>
              )}

              {/* CE QUI N'EST PAS ÉVALUÉ — en DOLLARS, pas en nombre de
                  lignes : « 1 ligne incomplète » ne dit pas s'il s'agit
                  d'un bouchon à 10 $ ou d'un contrat à 8 100 $. */}
              {coutsVisibles && lignesNonEvaluees.length > 0 && (
                <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2">
                  <p className="text-[11px] font-extrabold tabular-nums text-amber-800">
                    ⚠️ {montantNonEvalue.toFixed(2)} $ non évalués sur {totaux.vendant.toFixed(2)} $
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {lignesNonEvaluees.slice(0, 4).map((l) => (
                      <li key={l.uid} className="text-[10px] leading-snug text-amber-700">
                        • {l.nom || "Ligne sans nom"} — coût manquant
                      </li>
                    ))}
                    {lignesNonEvaluees.length > 4 && (
                      <li className="text-[10px] text-amber-700">• +{lignesNonEvaluees.length - 4} autre(s)</li>
                    )}
                  </ul>
                  <p className="mt-1 text-[10px] leading-snug text-amber-700">
                    Entre le coûtant directement dans la colonne pour compléter la marge.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ✏️ DESCRIPTION EN GRAND — deux lignes d'aperçu suffisent pour
              repérer, jamais pour écrire ni relire l'argumentaire qui
              partira au client. Le texte s'écrit directement dans la
              ligne : rien à « valider », fermer suffit. */}
          {descriptionOuverte && (() => {
            const ligneOuverte = lignes.find((x) => x.uid === descriptionOuverte.uid);
            if (!ligneOuverte) return null;
            return (
              <div
                className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
                onClick={() => setDescriptionOuverte(null)}
              >
                <div
                  className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Description visible par le client</p>
                      <p className="truncate text-sm font-bold text-slate-800">{ligneOuverte.nom || "Ligne sans nom"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescriptionOuverte(null)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Fermer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <textarea
                      autoFocus
                      value={ligneOuverte.description || ""}
                      onChange={(e) => majLigne(ligneOuverte.uid, { ...ligneOuverte, description: e.target.value })}
                      placeholder="Modèles, garantie, ce qui est inclus, ce qui ne l'est pas…"
                      className="h-[55vh] w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-slate-500 sm:h-72"
                    />
                    <p className="mt-2 text-[11px] italic leading-snug text-slate-400">
                      N&apos;affecte que ce devis, pas le catalogue. Le texte s&apos;enregistre au fur et à mesure.
                    </p>
                  </div>
                  <div className="border-t border-slate-200 p-3">
                    <Button onClick={() => setDescriptionOuverte(null)} className="w-full">
                      Terminé
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 📝 GARDER EN BROUILLON — commencer chez le client sur le
              téléphone, finir au bureau, sans brûler de numéro. Pas
              offert en révision de version (une révision a déjà son
              dossier — le brouillon n'a pas de sens là). */}
          {!editionVersion && (
            <Button
              variant="outline"
              onClick={garderBrouillon}
              disabled={lignes.length === 0 || !clientId}
              className="w-full"
            >
              📝 Garder en brouillon {reprisBrouillonId ? "(mise à jour)" : "(sans numéro)"}
            </Button>
          )}
          <Button
            onClick={editionVersion ? enregistrerVersion : demarrerCreationDevis}
            disabled={lignes.length === 0}
            className="w-full"
          >
            {editionVersion
              ? "Enregistrer la nouvelle version"
              : estContrat
              ? "Créer le contrat d'entretien périodique"
              : "Créer le devis"}
          </Button>
        </div>

        {/* LISTE DES DEVIS */}
        <div className="space-y-2 md:col-span-2">
          {/* 📝 BROUILLONS — feuilles de travail sans numéro. Reprendre
              recharge le formulaire ; le vrai devis s'y crée ensuite. */}
          {brouillonsDevis.length > 0 && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                📝 Brouillons ({brouillonsDevis.length}) — sans numéro
              </p>
              <div className="mt-1.5 space-y-1.5">
                {brouillonsDevis.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{b.clientNom || "Client ?"}</p>
                      <p className="text-[10px] tabular-nums text-slate-500">
                        {(Number(b.totalVendant) || 0).toFixed(2)} $ · {(b.lignes || []).length} ligne{(b.lignes || []).length > 1 ? "s" : ""} · {b.date}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => reprendreBrouillon(b)} className="min-h-[40px] px-3 py-1.5 text-[11px]">
                      Reprendre
                    </Button>
                    {brouillonASupprimer === b.id ? (
                      <button onClick={() => supprimerBrouillon(b)} className="rounded-lg bg-red-600 px-2.5 py-2 text-[10px] font-bold text-white">
                        Confirmer ?
                      </button>
                    ) : (
                      <button onClick={() => setBrouillonASupprimer(b.id)} className="px-1 text-[10px] font-semibold text-slate-400 underline underline-offset-2">
                        Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 ref={refListeDevis} className="px-1 text-sm font-extrabold uppercase tracking-wide text-slate-500">Devis récents</h2>
          <p className="px-1 text-[11px] text-slate-400">
            10 par page. Tous les devis d'un client sont dans <span className="font-bold">son dossier</span> (onglet Clients), et la{" "}
            <span className="font-bold">recherche rapide</span> les trouve par numéro, client ou produit.
          </p>
          {dossiersDevis.length === 0 && <p className="px-1 text-xs text-slate-400">Aucun devis pour le moment.</p>}
          {/* UNE CARTE PAR DOSSIER — la version active est affichée ; les
              révisions précédentes s'atteignent par les onglets. */}
          {dossiersDevis.slice((Math.min(pageDevis, Math.max(1, Math.ceil(dossiersDevis.length / ITEMS_PAR_PAGE))) - 1) * ITEMS_PAR_PAGE, Math.min(pageDevis, Math.max(1, Math.ceil(dossiersDevis.length / ITEMS_PAR_PAGE))) * ITEMS_PAR_PAGE).map(({ base, versions, active }) => {
            const ouvert = dossierOuvert === base;
            const affichee = ouvert ? versions.find((v) => v.numero === versionAffichee) || active : active;
            const estActive = affichee.numero === active.numero;
            return (
              <div key={base} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                      {affichee.numero}
                      {versions.length > 1 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                          {versions.length} versions
                        </span>
                      )}
                      {affichee.estContrat && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                          CONTRAT · {affichee.frequenceFacturationAnnuelle}×/an
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{affichee.clientNom}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      affichee.statut === "accepte" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-black"
                    }`}
                  >
                    {affichee.statut === "accepte" ? "ACCEPTÉ" : "ENVOYÉ"}
                  </span>
                </div>

                {/* ONGLETS DES VERSIONS — visibles dès qu'il y a une révision. */}
                {versions.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-slate-200 p-0.5">
                    {versions.map((v) => {
                      const selectionne = v.numero === affichee.numero;
                      return (
                        <button
                          key={v.numero}
                          onClick={() => {
                            setDossierOuvert(base);
                            setVersionAffichee(v.numero);
                          }}
                          className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${
                            selectionne ? "bg-[#131B2E] text-white" : "text-slate-500 hover:bg-slate-50"
                          }`}
                          title={v.noteVersion || undefined}
                        >
                          {v.version === 0 ? "Originale" : `v${v.version}`}
                          {v.numero === active.numero ? " ★" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="mt-1.5 text-sm font-bold tabular-nums text-slate-800">{affichee.totalVendant.toFixed(2)} $</p>
                <p className="text-[10px] text-slate-400">
                  {affichee.date}
                  {affichee.noteVersion ? ` · ${affichee.noteVersion}` : ""}
                </p>

                {!estActive && (
                  <p className="mt-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-500">
                    🔒 Version archivée — lecture seule. La version courante est {active.numero}.
                  </p>
                )}
                {affichee.traite && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    <CheckCircle2 size={11} /> Traité — {affichee.modeTraitement === "projet" ? "converti en projet" : "converti en bon de travail"}
                  </span>
                )}

                <Button variant="outline" onClick={() => setDevisAperçu(affichee)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                  <FileText size={13} /> Voir version client
                </Button>

                {/* RÉPONSE DU CLIENT — la preuve. Nom saisi, date, heure,
                    et la version des conditions qu'il a lues ce jour-là.
                    C'est ce qui répond à « je n'ai jamais été avisé ». */}
                {affichee.reponseClient && (
                  <div className={`mt-2 rounded-lg border p-2.5 ${
                    affichee.reponseClient === "accepte" ? "border-emerald-300 bg-emerald-50"
                      : affichee.reponseClient === "modification" ? "border-blue-300 bg-blue-50"
                      : "border-slate-300 bg-slate-50"
                  }`}>
                    <p className="text-[11px] font-extrabold text-slate-800">
                      {affichee.reponseClient === "accepte" ? "✅ Accepté par le client"
                        : affichee.reponseClient === "modification" ? "✏️ Modification demandée"
                        : "❌ Refusé par le client"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      {affichee.reponduParNom}
                      {affichee.reponduLe ? ` · ${new Date(affichee.reponduLe).toLocaleString("fr-CA")}` : ""}
                    </p>
                    {affichee.messageClient && (
                      <p className="mt-1 whitespace-pre-line rounded bg-white/70 px-2 py-1 text-[10px] italic text-slate-700">
                        « {affichee.messageClient} »
                      </p>
                    )}
                    {affichee.conditionsVersion && (
                      <p className="mt-1 text-[9px] text-slate-400">
                        Conditions version {affichee.conditionsVersion} — texte exact conservé
                      </p>
                    )}
                  </div>
                )}

                {/* ENVOI AU CLIENT — le courriel avec le lien d'acceptation.
                    « Copier le lien » reste là comme plan B (téléphone,
                    texto, ou service d'envoi pas encore configuré). */}
                {/* ENVOI / RENVOI — disponible tant que le client n'a pas
                    répondu, ET aussi pour un devis DÉJÀ ACCEPTÉ (le client
                    a perdu sa copie et la redemande). */}
                {estActive && (!affichee.reponseClient || affichee.reponseClient === "accepte") && envoiDevis?.devisId !== affichee.id && (
                  <Button onClick={() => ouvrirEnvoiDevis(affichee)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                    {affichee.reponseClient === "accepte" ? "✉️ Renvoyer la copie au client" : "✉️ Envoyer au client"}
                  </Button>
                )}
                {estActive && (!affichee.reponseClient || affichee.reponseClient === "accepte") && envoiDevis?.devisId === affichee.id && (
                  <div className="mt-2 rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">{affichee.reponseClient === "accepte" ? "Renvoyer la copie à :" : "Envoyer le devis à :"}</p>
                    {(ficheClientDe(affichee)?.courriels || []).map((c) => {
                      const adresse = typeof c === "string" ? c : c.email;
                      if (!adresse) return null;
                      const coche = envoiDevis.choisis.includes(adresse);
                      return (
                        <label key={adresse} className="mb-1 flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={coche}
                            onChange={() =>
                              setEnvoiDevis((prev) => ({
                                ...prev,
                                choisis: coche ? prev.choisis.filter((a) => a !== adresse) : [...prev.choisis, adresse],
                              }))
                            }
                          />
                          {adresse}
                          {typeof c === "object" && c.label ? <span className="text-[10px] text-slate-400">({c.label})</span> : null}
                        </label>
                      );
                    })}
                    <input
                      value={envoiDevis.extra}
                      onChange={(e) => setEnvoiDevis((prev) => ({ ...prev, extra: e.target.value }))}
                      placeholder="Autre adresse (optionnel)"
                      className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    {envoiDevis.extra.trim() !== "" && (
                      <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={!!envoiDevis.extraFiche}
                          onChange={(e) => setEnvoiDevis((prev) => ({ ...prev, extraFiche: e.target.checked }))}
                          className="h-4 w-4 accent-[#FF6A13]"
                        />
                        💾 Ajouter cette adresse à la fiche du client
                      </label>
                    )}
                    <div className="flex gap-1.5">
                      <Button
                        onClick={() => envoyerDevisParCourriel(affichee)}
                        disabled={envoiDevisEnCours || (envoiDevis.choisis.length === 0 && !envoiDevis.extra.trim())}
                        className="min-h-0 flex-1 py-1.5 text-xs"
                      >
                        {envoiDevisEnCours ? "Envoi…" : "Envoyer"}
                      </Button>
                      <Button variant="outline" onClick={() => setEnvoiDevis(null)} className="min-h-0 py-1.5 text-xs">
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
                {estActive && (!affichee.reponseClient || affichee.reponseClient === "accepte") && (
                  <Button
                    variant="outline"
                    onClick={() => creerLienAcceptation(affichee)}
                    className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs"
                  >
                    <Copy size={13} /> {lienCopie === affichee.id ? "Lien copié ✓" : affichee.reponseClient === "accepte" ? "Copier le lien du devis" : "Copier le lien d'acceptation"}
                  </Button>
                )}

                {/* Actions réservées à la version ACTIVE — on ne traite
                    jamais une révision archivée par erreur. */}
                {estActive && affichee.statut !== "accepte" && (
                  <Button onClick={() => accepterDevis(affichee)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                    <Check size={13} /> Marquer accepté
                  </Button>
                )}
                {estActive && affichee.statut === "accepte" && !affichee.traite && (
                  <Button onClick={() => setDevisATraiterId(affichee.id)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                    <ClipboardList size={13} /> Traiter le devis
                  </Button>
                )}

                {/* NOUVELLE VERSION — depuis la version affichée. C'est ce
                    qui permet de « repartir d'une ancienne version ». */}
                {creationVersionPour === affichee.numero ? (
                  <div className="mt-2 rounded-lg border border-slate-300 bg-slate-50 p-2.5">
                    <p className="text-[11px] font-bold text-slate-800">Nouvelle version à partir de {affichee.numero}</p>
                    <input
                      value={noteNouvelleVersion}
                      onChange={(e) => setNoteNouvelleVersion(e.target.value)}
                      placeholder="Raison (ex : le client retire le rooftop)"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <Button onClick={() => demarrerNouvelleVersion(affichee, noteNouvelleVersion)} className="min-h-0 flex-1 py-1.5 text-[11px]">
                        Modifier et créer
                      </Button>
                      <Button variant="outline" onClick={() => setCreationVersionPour(null)} className="min-h-0 py-1.5 text-[11px]">
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  !affichee.traite && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreationVersionPour(affichee.numero);
                        setNoteNouvelleVersion("");
                      }}
                      className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs"
                    >
                      <Plus size={13} /> {estActive ? "Nouvelle version" : "Repartir de cette version"}
                    </Button>
                  )
                )}
              </div>
            );
          })}
          <BarrePagination total={dossiersDevis.length} page={pageDevis} onPage={setPageDevis} refHaut={refListeDevis} libelle="devis" />
        </div>
      </div>

      {pdfAperçu && <ApercuBonCommande data={pdfAperçu} onFermer={() => setPdfAperçu(null)} />}
      {devisAperçu && <ApercuDevisClient devis={devisAperçu} onFermer={() => setDevisAperçu(null)} />}
      {courrielModalOuvert && (
        <ModalSelectionCourriel
          client={client}
          contexte={`Devis pour ${client.nom} — ${totaux.vendant.toFixed(2)} $`}
          onFermer={() => setCourrielModalOuvert(false)}
          onConfirmer={(choix) => creerDevis(choix)}
        />
      )}
      {/* FENÊTRE — NOUVEAU CLIENT depuis le devis (composant partagé). */}
      {/* REPORT DU COÛT AU CATALOGUE — fenêtre de confirmation.
          Sans le droit « Modifier la liste de prix », la case n'est pas
          proposée : on l'annonce clairement plutôt que d'afficher un
          bouton grisé que personne ne comprend. */}
      {reportCatalogue && (
        <ModalReportCatalogue
          info={reportCatalogue}
          peutModifierListePrix={peutModifierListePrix}
          onFermer={() => setReportCatalogue(null)}
          onConfirmer={async (reporter) => {
            const { item, saisi } = reportCatalogue;
            setReportCatalogue(null);
            if (!reporter) return;
            try {
              await onMajCoutCatalogue?.({ ...item, prix_coutant: saisi });
            } catch {
              // L'échec ne doit pas faire perdre le devis en cours : le
              // prix reste bon sur la ligne, seul le catalogue n'a pas suivi.
              ajouterJournal(`⚠️ Coût de « ${item.nom} » appliqué au devis mais NON enregistré au catalogue — réessaie depuis l'onglet Tarifs.`);
            }
          }}
        />
      )}

      {modalNouveauClient && (
        <ModalNouveauClient
          clients={clients}
          setClients={setClients}
          ajouterJournal={ajouterJournal}
          onFermer={() => setModalNouveauClient(false)}
          onSelection={(id) => setClientId(id)}
        />
      )}
      {devisATraiter && (
        <ModalTraiterDevis
          devis={devisATraiter}
          clients={clients}
          onFermer={() => setDevisATraiterId(null)}
          onChoisirBonTravail={traiterCommeBonDeTravail}
          onChoisirProjet={traiterCommeProjet}
        />
      )}
    </div>
  );
}

function AdressesDocument({ clientNom, adresseFacturation, adresseTravaux }) {
  const differente =
    adresseTravaux && adresseTravaux.trim() && adresseTravaux.trim() !== (adresseFacturation || "").trim();
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Facturé à</p>
        <p className="text-sm font-bold text-slate-800">{clientNom || "—"}</p>
        {adresseFacturation ? (
          <p className="whitespace-pre-line text-[11px] leading-snug text-slate-600">{adresseFacturation}</p>
        ) : (
          <p className="text-[11px] italic text-amber-600">Adresse de facturation manquante</p>
        )}
      </div>
      {differente && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Adresse des travaux</p>
          <p className="whitespace-pre-line text-[11px] leading-snug text-slate-600">{adresseTravaux}</p>
        </div>
      )}
    </div>
  );
}

function ApercuDevisClient({ devis, onFermer }) {
  // Adresses lues dans la fiche du client au moment de l'affichage —
  // elles ne sont pas figées sur le devis. Une correction d'adresse se
  // reflète donc sur une réimpression, ce qui est souhaitable pour un
  // renvoi. Le devis reste inchangé pour tout le reste.
  const fiche = (useClients() || []).find((c) => c.id === devis.clientId || c.nom === devis.clientNom);
  // Taux de taxes lus dans les Paramètres de l'entreprise (plus codés
  // en dur : si Québec change la TVQ, on l'ajuste dans l'écran).
  const configEnt = useEntreprise();
  const sousTotal = devis.totalVendant;
  const { tps, tvq, total } = calculerTaxes(sousTotal, configEnt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-500">Aperçu — version envoyée au client</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-sm">
          <EnTeteEntreprise />
          <p className="mt-3 text-lg font-extrabold text-[#131B2E]">DEVIS {devis.numero}</p>
          <p className="text-xs text-slate-500">Date : {devis.date}</p>
          {/* Exactement la même source que le PDF (AdressesPDF) : cet écran
              s'annonce comme « la version envoyée au client », il ne doit
              rien afficher que le PDF n'aurait pas. */}
          <AdressesDocument
            clientNom={devis.clientNom}
            adresseFacturation={adresseFacturationClient(fiche)}
            adresseTravaux={devis.adresseTravaux}
          />

          <table className="mt-4 w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400">
                <th className="pb-1.5 font-semibold">Description</th>
                <th className="pb-1.5 text-center font-semibold">Qté</th>
                <th className="pb-1.5 text-right font-semibold">Prix</th>
                <th className="pb-1.5 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l) => (
                <tr key={l.uid} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-700">
                    <span className="font-semibold">{l.nom || "—"}</span>
                    {/* La description part chez le client : modèles,
                        garantie, ce qui est inclus. `whitespace-pre-line`
                        respecte les sauts de ligne de QuickBooks. */}
                    {l.description ? (
                      <span className="mt-0.5 block whitespace-pre-line text-[10px] leading-snug text-slate-500">
                        {l.description}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-center tabular-nums text-slate-500">{l.quantite}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">{(Number(l.prix_vendant) || 0).toFixed(2)} $</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-slate-800">
                    {((Number(l.prix_vendant) || 0) * l.quantite).toFixed(2)} $
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{sousTotal.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span><span className="tabular-nums">{tps.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span><span className="tabular-nums">{tvq.toFixed(2)} $</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{total.toFixed(2)} $</span>
            </div>
          </div>

          <TermesConditions signature />

          <p className="mt-4 text-[10px] italic text-slate-400">
            Devis valide 30 jours. Aucune information de coût interne n'apparaît sur ce document.
          </p>
          <PiedDocument />
        </div>

        <BoutonPDF type="devis" devis={{ ...devis, adresseFacturation: devis?.adresseFacturation || adresseFacturationClient(fiche) }} />

        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — le PDF réel envoyé par courriel au client se génère et s'expédie via une fonction backend, avec ce même contenu.
        </p>
      </div>
    </div>
  );
}

function ApercuBonCommande({ data, onFermer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 size={18} className="text-[#FF6A13]" />
            <h3 className="text-sm font-extrabold">Bon de commande généré</h3>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <p className="font-bold">BON DE COMMANDE — {data.numero}</p>
          <p className="text-xs text-slate-500">Client : {data.client} · {data.date}</p>
          <p className="mt-2 text-xs font-bold uppercase text-slate-400">Matériaux requis</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {data.materiaux.map((m, i) => (
              <li key={i}>• {m.quantite} × {m.description} ({m.unite})</li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] italic text-slate-400">Aucun prix de vente inclus — document destiné aux achats uniquement.</p>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <Mail size={15} className="shrink-0 text-slate-400" />
          Envoyé automatiquement à <span className="font-semibold">achats@ventilationdgl.com</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — la génération réelle du PDF et l'envoi du courriel se font via une fonction backend (ex. Supabase Edge Function + service courriel transactionnel).
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ONGLET AGENDA
// ============================================================
function joursDuMois(date) {
  const annee = date.getFullYear();
  const mois = date.getMonth();
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  return Array.from({ length: nbJours }, (_, i) => new Date(annee, mois, i + 1));
}

function calculerJoursCibles(dateDepart, nbJours, sauterWeekend) {
  const resultat = [];
  let curseur = new Date(dateDepart);
  let securite = 0;
  while (resultat.length < Math.max(1, nbJours) && securite < 60) {
    const jourSemaine = curseur.getDay(); // 0 = dimanche, 6 = samedi
    if (!sauterWeekend || (jourSemaine !== 0 && jourSemaine !== 6)) {
      resultat.push(new Date(curseur));
    }
    curseur = ajouterJours(curseur, 1);
    securite += 1;
  }
  return resultat;
}

// Utilisée par les vues Semaine/Mois : retrouve la tâche assignée à un
// employé pour une date donnée, peu importe à quelle heure précise
// elle a été déposée (une seule source de vérité — les clés horaires
// de `planning` — pour que toutes les vues restent synchronisées).
// Clé de tâche d'une ligne d'heures : un chantier de plusieurs jours
// range ses heures sous « id::AAAA-MM-JJ » — on remonte à l'identifiant
// de la tâche. (Au niveau MODULE depuis 2026-08-21 : le tableau de bord
// en a besoin lui aussi, il vivait dans l'agenda seulement.)
function cleTacheDesHeures(tacheIdBrut) {
  return String(tacheIdBrut || "").split("::")[0];
}

// 📱 Tâches d'une journée AVEC leur heure de départ — pour la vue
// LISTE du téléphone (2026-08-21) : une grille de 24 colonnes est
// illisible sur un écran de 6 pouces, mais la journée se lit très bien
// en liste, dans l'ordre.
function tachesDuJourAvecHeure(planning, dateStr, employeId) {
  const parId = new Map();
  for (const h of HEURES) {
    listeCellule(planning[`${dateStr}|${employeId}|${h}`]).forEach((t) => {
      if (t && !parId.has(t.id)) parId.set(t.id, { tache: t, heure: h });
    });
  }
  return [...parId.values()];
}

function tachesDuJourPourEmploye(planning, dateStr, employeId) {
  // TOUTES les tâches du jour (uniques, dans l'ordre de leur première
  // heure) — les vues Semaine/Mois les empilent pour n'en perdre aucune.
  const vues = new Set();
  const liste = [];
  for (const h of HEURES) {
    listeCellule(planning[`${dateStr}|${employeId}|${h}`]).forEach((t) => {
      if (t && !vues.has(t.id)) {
        vues.add(t.id);
        liste.push(t);
      }
    });
  }
  return liste;
}

const TYPES_TACHE = [
  { id: "appel_service", label: "Appel de service", description: "Facturation automatique depuis le bon de commande" },
  { id: "devis", label: "Travaux avec devis", description: "Facturation uniquement à partir d'un devis — validation admin requise" },
  { id: "temps_materiel", label: "Travaux en temps et matériel", description: "Facturation automatique depuis le bon de commande" },
  { id: "entretien_contrat", label: "Entretien selon contrat", description: "Facturation selon contrat — 1 à 4 factures par an" },
  // ---- TYPES NON FACTURABLES ----
  // Rien ne part en facturation : ces tâches n'apparaissent jamais dans
  // l'onglet Facturation, il n'y a donc rien à refuser ni à oublier.
  // Les heures restent PAYÉES — c'est la facturation qui change, pas la paie.
  { id: "visite_chantier", label: "Visite de chantier", description: "Non facturable — heures aux frais administratifs (ou au projet, au choix)", nonFacturable: true, admin: true },
  { id: "visite_soumission", label: "Visite pour soumission", description: "Non facturable — reste en attente tant qu'aucun devis n'y est rattaché", nonFacturable: true, admin: true, suiviDevis: true },
  { id: "divers", label: "Divers", description: "Non facturable — heures payées, hors projet et hors administratif", nonFacturable: true },
  // 🚗 COURSE / INTERNE — la même mécanique que la course créée par le
  // technicien (2026-08-17) : AUCUN client, juste une adresse. Porter
  // un camion au garage, aller chercher une pièce. Heures payées en
  // « divers », jamais facturable.
  { id: "course", label: "🚗 Course / interne (sans client)", description: "Aucun client — porter un camion au garage, chercher une pièce. Heures payées (divers), jamais facturable.", nonFacturable: true, sansClient: true },
  // 🏭 TRAVAIL AU SHOP (demande du propriétaire, 2026-08-19) — heures
  // payées à l'atelier : fabrication, préparation, ménage. Aucun client.
  // « Divers » par défaut ; LIÉ À UN PROJET, les heures comptent dans
  // SES coûts réels (fabriquer les conduits d'un chantier, c'est du
  // temps de chantier fait au shop).
  { id: "shop", label: "🏭 Travail au shop", description: "Aucun client — travail à l'atelier. Heures payées (divers — ou comptées au projet si un projet est lié). Jamais facturable.", nonFacturable: true, sansClient: true },
  // CONGÉ : ce n'est pas du travail. Aucun chronomètre, aucune heure —
  // seulement un marqueur qui bloque la journée dans l'agenda pour
  // qu'on n'y place pas de travail par erreur.
  { id: "conge", label: "Congé / absence", description: "Bloque l'agenda — aucune heure, aucun chronomètre", nonFacturable: true, sansHeures: true },
];

// Raccourcis lisibles, utilisés partout plutôt que de répéter les listes.
const TYPE_INFO = (id) => TYPES_TACHE.find((t) => t.id === id) || null;
const estTypeNonFacturable = (id) => !!TYPE_INFO(id)?.nonFacturable;
const estTypeSansHeures = (id) => !!TYPE_INFO(id)?.sansHeures;
const estTypeAdministratif = (id) => !!TYPE_INFO(id)?.admin;
const estTypeSansClient = (id) => !!TYPE_INFO(id)?.sansClient || id === "conge";

const FREQUENCES_CONTRAT = [1, 2, 3, 4];

// Couleurs distinctes par type de tâche, utilisées dans les cartes en
// attente et les cases du calendrier, pour les différencier d'un
// coup d'œil.
const COULEUR_TYPE_TACHE = {
  // Turquoise VIF : lisible avec le texte noir (l'ancien gris foncé ne se
  // lisait pas) et bien distinct des transports gris, du bleu des devis,
  // de l'orange temps & matériel et du mauve des contrats.
  appel_service: { fond: "bg-teal-400", pastille: "bg-teal-500", bordurePastille: "border-teal-500", texte: "text-teal-700", clair: "bg-teal-100" },
  devis: { fond: "bg-blue-600", pastille: "bg-blue-500", bordurePastille: "border-blue-500", texte: "text-blue-700", clair: "bg-blue-100" },
  temps_materiel: { fond: "bg-[#FF6A13]", pastille: "bg-[#FF6A13]", bordurePastille: "border-[#FF6A13]", texte: "text-[#B14E0E]", clair: "bg-orange-100" },
  entretien_contrat: { fond: "bg-purple-600", pastille: "bg-purple-500", bordurePastille: "border-purple-500", texte: "text-purple-700", clair: "bg-purple-100" },
  // NON FACTURABLES — teintes volontairement sourdes : elles ne
  // rapportent rien, elles ne doivent pas attirer l'œil comme un
  // contrat. Le congé est le plus effacé de tous : c'est une absence.
  visite_chantier: { fond: "bg-sky-500", pastille: "bg-sky-500", bordurePastille: "border-sky-500", texte: "text-sky-700", clair: "bg-sky-100" },
  visite_soumission: { fond: "bg-indigo-500", pastille: "bg-indigo-500", bordurePastille: "border-indigo-500", texte: "text-indigo-700", clair: "bg-indigo-100" },
  divers: { fond: "bg-stone-400", pastille: "bg-stone-400", bordurePastille: "border-stone-400", texte: "text-stone-700", clair: "bg-stone-100" },
  course: { fond: "bg-stone-500", pastille: "bg-stone-500", bordurePastille: "border-stone-500", texte: "text-stone-700", clair: "bg-stone-100" },
  // 🏭 Travail au shop — lime : la seule teinte encore libre qui reste
  // discrète (interne, non facturable) sans se confondre avec divers.
  shop: { fond: "bg-lime-400", pastille: "bg-lime-500", bordurePastille: "border-lime-500", texte: "text-lime-700", clair: "bg-lime-100" },
  conge: { fond: "bg-zinc-300", pastille: "bg-zinc-400", bordurePastille: "border-zinc-400", texte: "text-zinc-600", clair: "bg-zinc-100" },
};
const COULEUR_TYPE_DEFAUT = COULEUR_TYPE_TACHE.temps_materiel;

// ============================================================
// MODAL DE DÉTAIL D'UNE TÂCHE DE L'AGENDA
// ============================================================
function ModalDetailTache({ info, onFermer }) {
  const { tache, employe, date, heure } = info;
  const couleur = COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT;
  const typeLabel = TYPES_TACHE.find((t) => t.id === tache.typeTache)?.label || "Type non spécifié";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${couleur.fond}`}>
              {typeLabel}
            </span>
            <h3 className="mt-1.5 text-sm font-extrabold text-slate-900">{tache.titre || tache.clientNom}</h3>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Users size={13} className="shrink-0 text-slate-400" />
            <span>Assignée à <span className="font-semibold text-slate-800">{employe.nom}</span></span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar size={13} className="shrink-0 text-slate-400" />
            <span>
              {date}
              {heure && <> à <span className="font-semibold text-slate-800">{heure}</span></>}
            </span>
          </div>
          {tache.clientNom && (
            <div className="flex items-center gap-2 text-slate-600">
              <User size={13} className="shrink-0 text-slate-400" />
              <span className="font-semibold text-slate-800">{tache.clientNom}</span>
            </div>
          )}
          {tache.adresseTravaux && (
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span>Travaux : {tache.adresseTravaux}</span>
            </div>
          )}
          {tache.devisNumero && (
            <div className="flex items-center gap-2 text-slate-600">
              <FileText size={13} className="shrink-0 text-slate-400" />
              <span>
                {tache.typeTache === "entretien_contrat" ? "Contrat" : "Devis"} #{tache.devisNumero}
                {tache.frequenceFacturationAnnuelle && ` — ${tache.frequenceFacturationAnnuelle} factures/an`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-600">
            <Clock size={13} className="shrink-0 text-slate-400" />
            <span>
              {(tache.jours ?? 0) >= 1
                ? `${tache.jours} jour${tache.jours > 1 ? "s" : ""} (journée complète bloquée)`
                : `${tache.heures ?? 1} heure${(tache.heures ?? 1) > 1 ? "s" : ""}`}
            </span>
          </div>
          {tache.sauterWeekend && (
            <p className="text-[11px] text-slate-400">Fins de semaine sautées dans le calcul des jours.</p>
          )}
          {tache.description && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Description</p>
              <p className="whitespace-pre-line text-slate-700">{tache.description}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">Statut :</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {tache.statut === "en_attente_materiel" ? "En attente de matériel" : "Planifiée"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ÉDITION RAPIDE D'UNE TÂCHE EN ATTENTE — ouverte au clic sur une
// carte de la section "Tâches en attente". Permet de fixer d'un coup
// la date, l'heure de début, la durée (heures/jours) et le technicien
// attribué. Si un technicien ET une date sont choisis, "Enregistrer"
// assigne directement la tâche dans l'horaire (même logique que le
// glisser-déposer) ; sinon, seule la durée est mise à jour et la
// tâche reste dans "Tâches en attente".
// ============================================================
// Reconstruit la grille `planning` de l'agenda à partir des assignations
// Supabase (taches_assignees) — l'horaire survit ainsi aux rechargements.
// Même logique de placement que assigner() : jours >= 1 bloque la journée
// complète, sinon N cases horaires à partir de l'heure de début.
function reconstruirePlanning(rows, employesRef) {
  const planning = {};
  rows.forEach((r) => {
    const courriel = (r.employe_email || "").toLowerCase();
    const emp = employesRef.find((e) => (e.courriel || "").toLowerCase() === courriel);
    if (!emp || !r.date_debut) return; // employé introuvable — ligne ignorée
    // Fiche complète si disponible (colonne `donnees`) — la tâche
    // reconstruite est identique à l'originale et reste modifiable.
    // Repli sur les colonnes simples pour les assignations plus anciennes.
    const base = r.donnees && typeof r.donnees === "object" ? r.donnees : {
      titre: r.titre || undefined,
      clientNom: r.client_nom || undefined,
      description: r.description || "",
      typeTache: r.type_tache || undefined,
      projetId: r.projet_id || null,
      heures: r.heures ?? 1,
      jours: r.jours ?? 1,
      sauterWeekend: false,
    };
    const tache = {
      ...base,
      id: r.tache_id,
      heures: r.heures ?? base.heures ?? 1,
      jours: r.jours ?? base.jours ?? 1,
      statut: "planifiee",
      employeId: emp.id,
    };
    const nbJours = Math.max(0, tache.jours);
    const blocJourComplet = nbJours >= 1;
    const joursCibles = calculerJoursCibles(new Date(`${r.date_debut}T00:00:00`), nbJours, !!tache.sauterWeekend);
    const indexDepart = r.heure_debut ? Math.max(0, indexCaseHeure(r.heure_debut)) : 0;
    const nbHeures = Math.max(0, Math.min(tache.heures ?? 1, HEURES.length - indexDepart));
    // Même correction que dans assigner() : le bloc « journée complète »
    // part de l'heure de début enregistrée, pas de minuit.
    const heuresCibles = blocJourComplet ? HEURES.slice(indexDepart) : HEURES.slice(indexDepart, indexDepart + nbHeures);
    joursCibles.forEach((d) => {
      heuresCibles.forEach((h) => {
        const cle = `${dateISO(d)}|${emp.id}|${h}`;
        // AJOUT à la case (jamais d'écrasement) : deux tâches sur la même
        // plage horaire coexistent et s'empilent à l'écran.
        planning[cle] = [...listeCellule(planning[cle]).filter((x) => x.id !== tache.id), tache];
      });
    });
  });
  return recalculerTransports(planning);
}

// ============================================================
// 🔁 FUSION AVEC LE SERVEUR (2026-08-22 — « les tâches d'Éloïse
// n'apparaissent pas chez les autres »)
// ------------------------------------------------------------
// La table `taches_assignees` FAIT FOI. Avant, l'agenda ne se
// reconstruisait que si la grille locale était vide ou abîmée : dès
// qu'un écran avait sa grille, il ne relisait plus jamais le serveur.
// Deux répartitrices travaillant en même temps ne voyaient donc jamais
// le travail l'une de l'autre — jusqu'à recréer les mêmes tâches en
// double.
//
// Seuls blocs conservés du local : ceux des employés SANS COURRIEL.
// Rien n'a jamais pu être écrit pour eux (l'assignation le dit déjà au
// Journal) ; les reconstruire depuis le serveur les effacerait de
// l'écran. Pour tous les autres, le serveur écrase — c'est ce qui fait
// aussi disparaître, chez tout le monde, une tâche retirée ailleurs.
// ============================================================
function fusionnerPlanningServeur(prev, rows, employesRef) {
  const serveur = reconstruirePlanning(rows, employesRef);
  const sansCourriel = new Set(employesRef.filter((e) => !e.courriel).map((e) => e.id));
  if (sansCourriel.size === 0) return serveur;
  const fusion = { ...serveur };
  Object.entries(prev || {}).forEach(([cle, valeur]) => {
    const empId = cle.split("|")[1];
    if (!sansCourriel.has(empId)) return;
    const locales = listeCellule(valeur).filter((t) => t && !t.est_tache_systeme);
    if (locales.length === 0) return;
    fusion[cle] = [
      ...listeCellule(fusion[cle]).filter((x) => !locales.some((l) => l.id === x.id)),
      ...locales,
    ];
  });
  return recalculerTransports(fusion);
}

// Techniciens actuellement assignés à une tâche (balayage du planning),
// avec un résumé lisible de l'horaire propre de chacun — alimente la
// section « Appliquer la modification à… » de la modale d'édition.
function techniciensPourTache(planning, tacheId, employes) {
  const infos = {};
  Object.entries(planning).forEach(([cle, valeur]) => {
    if (!listeCellule(valeur).some((t) => t?.id === tacheId)) return;
    const [dateCle, empId, heure] = cle.split("|");
    const e = (infos[empId] = infos[empId] || { employeId: empId, dates: new Set(), premiereHeure: heure, nbCases: 0 });
    e.dates.add(dateCle);
    if (heure < e.premiereHeure) e.premiereHeure = heure;
    e.nbCases++;
  });
  return Object.values(infos).map((e) => {
    const nbJours = e.dates.size;
    const heuresParJour = nbJours > 0 ? Math.round(e.nbCases / nbJours) : 0;
    const premiereDate = [...e.dates].sort()[0];
    return {
      employeId: e.employeId,
      nom: employes.find((x) => x.id === e.employeId)?.nom || e.employeId,
      detail: `${premiereDate} · ${e.premiereHeure} · ${heuresParJour >= HEURES.length ? "journée complète" : `${heuresParJour} h/jour`} · ${nbJours} jour${nbJours > 1 ? "s" : ""}`,
    };
  });
}

// ============================================================
// 🏗️ CRÉER UN PROJET À PARTIR D'UNE TÂCHE (2026-08-22)
// ------------------------------------------------------------
// Un projet n'est pas qu'un dossier : c'est un BUDGET (prévu vs réel)
// — rien de tout ça n'existe sur une tâche, la transformation ne peut
// donc pas être automatique. On pré-remplit ce qu'on SAIT (client,
// adresse, secteur, nom, date) et l'humain n'entre que les montants.
// La ventilation fine (transport, matériaux, sous-traitants) reste
// ajustable ensuite dans l'onglet Projets — ici on garde le strict
// minimum pour que la rentabilité soit juste dès le départ.
// ============================================================
function ModalProjetDepuisTache({ tache, clients, onFermer, onCreer }) {
  const client = (clients || []).find((c) => c.id === tache.clientId) || (clients || []).find((c) => c.nom === tache.clientNom);
  const [nom, setNom] = useState(tache.titre || tache.clientNom || "Nouveau chantier");
  const [debut, setDebut] = useState(todayISO());
  const [fin, setFin] = useState("");
  const [facture, setFacture] = useState(0);
  const [moHeures, setMoHeures] = useState(0);
  const [moCoutant, setMoCoutant] = useState(0);
  const nb = (v) => Number(v) || 0;
  const totalFacture = nb(facture);
  const totalCoutant = nb(moCoutant);
  const marge = totalFacture - totalCoutant;
  const peutCreer = nom.trim().length > 0 && totalFacture > 0;

  const creer = () => {
    if (!peutCreer) return;
    onCreer({
      id: `projet-${Date.now()}`,
      nom: nom.trim(),
      clientId: client?.id || tache.clientId || null,
      adresseTravaux: tache.adresseTravaux || tache.adresseIntervention || null,
      dateDebut: debut,
      dateFin: fin || debut,
      // Le secteur CCQ vient de la tâche (commercial par défaut).
      secteur: tache.secteur === "residentiel" ? "residentiel" : "commercial",
      statut: "En cours", // du travail y est déjà rattaché
      budgetTotal: totalFacture,
      tauxHoraireCoutant: nb(moHeures) > 0 ? nb(moCoutant) / nb(moHeures) : 45,
      bonsCommande: [],
      budgetPrevu: {
        mainOeuvreChantier: { heures: nb(moHeures), facture: totalFacture, coutant: nb(moCoutant) },
        transport: { heures: 0, facture: 0, coutant: 0 },
        materiaux: { facture: 0, coutant: 0 },
        sousTraitants: [],
        totalFacture,
        totalCoutant,
        marge,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; onFermer(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🏗️ Créer un projet à partir de cette tâche</h3>
            <p className="text-xs text-slate-500">{tache.titre || tache.clientNom}</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-600">
          Le client, l&apos;adresse et le secteur sont repris de la tâche. Entre le budget — c&apos;est ce qui permet de
          suivre la rentabilité. Tu pourras détailler transport, matériaux et sous-traitants dans l&apos;onglet Projets.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Nom du projet</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {(client || tache.clientNom) && (
            <p className="text-[11px] text-slate-500">
              Client : <span className="font-bold text-slate-700">{client?.nom || tache.clientNom}</span>
              {(tache.adresseTravaux || tache.adresseIntervention) && (
                <span className="block">Travaux : {tache.adresseTravaux || tache.adresseIntervention}</span>
              )}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Début</label>
              <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Fin prévue</label>
              <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Montant facturé au client ($)</label>
            <InputNombreDecimal valeur={facture} onChange={setFacture} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Heures prévues</label>
              <InputNombreDecimal valeur={moHeures} onChange={setMoHeures} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Coûtant main-d&apos;œuvre ($)</label>
              <InputNombreDecimal valeur={moCoutant} onChange={setMoCoutant} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
          </div>
          {totalFacture > 0 && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
              Marge prévue : {marge.toFixed(2)} $ ({totalFacture > 0 ? ((marge / totalFacture) * 100).toFixed(1) : "0"} %)
            </p>
          )}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
            ⚠️ En créant le projet, cette tâche y est rattachée — et les <span className="font-bold">heures déjà pointées</span>{" "}
            comptent tout de suite dans ses coûts réels.
          </p>
          <Button onClick={creer} disabled={!peutCreer} className="w-full">
            Créer le projet et y rattacher la tâche
          </Button>
          {!peutCreer && (
            <p className="text-center text-[11px] text-slate-400">Il manque : un nom et un montant facturé supérieur à 0 $.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalEditionTache({ tache, clients, employes, dateInitiale, heureInitiale, employeIdInitial, onFermer, onEnregistrer, techniciensSurTache, onAjouterTechnicien, travailFait, onRetirerHoraire, onAnnulerTache, annulation, onFermerPourTechnicien, projets, devisListe, onCreerProjetDepuisTache }) {
  // ANNULATION EN DEUX TEMPS — un geste irréversible mérite deux clics
  // volontaires : 1) raison obligatoire (+ avertissements dépôt/pièce),
  // 2) dernière vérification en rouge. Adminis toujours ; répartiteur
  // seulement sans dépôt ni pièce (règle du propriétaire) ; app
  // technicien : jamais — ces props n'y existent pas.
  const [etapeAnnulation, setEtapeAnnulation] = useState(null); // null | "raison" | "confirmation"
  const [raisonAnnulation, setRaisonAnnulation] = useState("");
  const [date, setDate] = useState(dateInitiale || todayISO());
  const [heureDebut, setHeureDebut] = useState(heureInitiale || HEURE_PAR_DEFAUT);
  const [heures, setHeures] = useState(tache.heures ?? 1);
  const [jours, setJours] = useState(tache.jours ?? 1);
  const [sauterWeekend, setSauterWeekend] = useState(!!tache.sauterWeekend);
  const [employeId, setEmployeId] = useState(employeIdInitial || "");
  const [description, setDescription] = useState(tache.description || "");
  // 📇 Contact sur place — repris du carnet du client ; « actuel »
  // couvre un contact déjà attaché à la tâche mais absent du carnet
  // (retiré du carnet, ou client non résolu). ⚠️ On vérifie VRAIMENT
  // l'appartenance au carnet (audit 2026-08-17) : initialiser avec un
  // id introuvable faisait afficher « Aucun » au sélecteur alors que
  // l'enregistrement CONSERVAIT le contact — l'écran mentait et le
  // contact devenait impossible à retirer.
  const [contactTacheId, setContactTacheId] = useState(() => {
    if (!tache.contactSurPlace) return "";
    const ficheClient =
      (clients || []).find((c) => c.id === tache.clientId) || (clients || []).find((c) => c.nom === tache.clientNom);
    const dansCarnet = (ficheClient?.contacts || []).some((x) => x.id === tache.contactSurPlace.id);
    return dansCarnet ? tache.contactSurPlace.id : "actuel";
  });
  const dejaPlanifiee = !!employeIdInitial;
  // Assignation MULTIPLE à la création (édition rapide) : tous les
  // techniciens cochés reçoivent la tâche avec la même date/heure/durée
  // — chacun reste ensuite ajustable individuellement via la modale.
  const [employeIds, setEmployeIds] = useState([]);
  const basculerEmploye = (id) =>
    setEmployeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // Techniciens (autres que celui ouvert ici) qui recevront AUSSI la
  // modification — cases cochées dans « Appliquer la modification à… ».
  const [autresCibles, setAutresCibles] = useState([]);
  const basculerCible = (id) =>
    setAutresCibles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // ============================================================
  // 🏗️/📄 RATTACHEMENTS APRÈS COUP (demande du propriétaire, 2026-08-22)
  // ------------------------------------------------------------
  // Le projet et le devis ne se choisissaient qu'À LA CRÉATION : une
  // job qui devient partie d'un chantier, ou un devis fait après la
  // visite, n'avaient aucun moyen d'être rattachés. Ici, les deux se
  // changent — et les HEURES déjà pointées suivent (voir
  // rattacherProjetAuxHeures : sans ça, le coût réel du projet
  // resterait faux en silence).
  // ============================================================
  const [projetLie, setProjetLie] = useState(tache.projetId || "");
  const [devisLie, setDevisLie] = useState(tache.devisNumero || "");
  const [devisSaisiMain, setDevisSaisiMain] = useState("");
  // Projets proposés : ceux du client de la tâche d'abord ; les autres
  // restent accessibles (un chantier peut être ouvert sous une société
  // mère). Un projet terminé n'est plus proposé, mais s'il est déjà lié
  // il reste affiché — sinon l'écran mentirait sur le rattachement réel.
  const projetsProposes = (projets || []).filter(
    (p) => p.id === tache.projetId || (p.statut !== "Terminé" && (!tache.clientId || !p.clientId || p.clientId === tache.clientId))
  );
  const devisProposes = (devisListe || []).filter(
    (d) => d.numero === tache.devisNumero || !tache.clientId || !d.clientId || d.clientId === tache.clientId
  );
  const rattachementChange = (projetLie || "") !== (tache.projetId || "") ||
    (devisSaisiMain.trim() || devisLie || "") !== (tache.devisNumero || "");
  // Formulaire « Ajouter / dupliquer vers un technicien ».
  const dejaAssignes = (techniciensSurTache || []).map((t) => t.employeId);
  const [ajoutEmployeId, setAjoutEmployeId] = useState(
    () => (employes?.find((e) => !dejaAssignes.includes(e.id)) || employes?.[0])?.id || ""
  );
  const [ajoutDate, setAjoutDate] = useState(dateInitiale || todayISO());
  const [ajoutHeure, setAjoutHeure] = useState(heureInitiale || HEURE_PAR_DEFAUT);
  const [ajoutHeures, setAjoutHeures] = useState(tache.heures ?? 1);
  const [ajoutJours, setAjoutJours] = useState(tache.jours ?? 1);
  const lancerAjout = (dupliquer) =>
    onAjouterTechnicien?.({
      employeId: ajoutEmployeId,
      date: ajoutDate,
      heureDebut: ajoutHeure,
      heures: ajoutHeures,
      jours: ajoutJours,
      dupliquer,
    });

  // 🏢 FERMER POUR LE TECHNICIEN (oubli) — demande du propriétaire,
  // 2026-08-17. Offert SEULEMENT quand ce technicien n'a AUCUNE heure
  // sur la tâche : on ne réécrit jamais ce qu'il a pointé lui-même.
  const [fermDebut, setFermDebut] = useState(heureInitiale || HEURE_PAR_DEFAUT);
  const [fermFin, setFermFin] = useState("");
  const [fermBon, setFermBon] = useState(false); // décochée par défaut (choix du propriétaire)
  const [fermErreur, setFermErreur] = useState("");
  const nomTechOuvert = employes?.find((e) => e.id === employeIdInitial)?.nom || "le technicien";

  // 📸 VISIONNEUSE des photos du technicien (retour de tests
  // 2026-08-17) : avant, chaque vignette ouvrait un onglet — il fallait
  // ouvrir/fermer les photos une à une. Même visionneuse que partout
  // ailleurs : flèches, glissement de doigt, clavier.
  const photosTravail = [
    ...((travailFait?.photosAvantUrls || []).map((u, i) => ({ url: u, etiquette: `Avant ${i + 1}` }))),
    ...((travailFait?.photosApresUrls || []).map((u, i) => ({ url: u, etiquette: `Après ${i + 1}` }))),
  ];
  const [photoOuverte, setPhotoOuverte] = useState(null);
  const validerFermetureBureau = () => {
    if (!fermFin) {
      setFermErreur("Entre son heure de fin.");
      return;
    }
    if (fermFin <= fermDebut) {
      setFermErreur("L'heure de fin doit être après l'heure de début.");
      return;
    }
    onFermerPourTechnicien?.({ debutHM: fermDebut, finHM: fermFin, creerBon: fermBon });
  };

  // Fiche client complète — via clientId si disponible (tâches créées
  // récemment), sinon repli sur une recherche par nom (tâches plus
  // anciennes qui n'avaient que clientNom).
  const client = (clients || []).find((c) => c.id === tache.clientId) || (clients || []).find((c) => c.nom === tache.clientNom);
  const courrielClient = client ? courrielDefautClient(client) : null;
  // Adresse des TRAVAUX — jamais confondue avec l'adresse de
  // FACTURATION du client : `tache.adresseTravaux` est explicitement
  // distincte (voir sa création dans le formulaire "Nouvelle tâche").
  // Si aucune adresse de travaux propre n'a été fixée pour cette
  // tâche, on retombe sur l'adresse de facturation par défaut du
  // client, mais l'étiquette le précise sans ambiguïté.
  const adresseFacturationDefaut = client?.adresses?.[0];

  const enregistrer = () => {
    // Contact sur place résolu depuis le carnet (ou conservé tel quel).
    const carnetClient = client?.contacts || [];
    const contactChoisi =
      contactTacheId === ""
        ? null
        : contactTacheId === "actuel"
          ? tache.contactSurPlace || null
          : (() => {
              const c = carnetClient.find((x) => x.id === contactTacheId);
              return c ? { id: c.id, nom: c.nom, role: c.role || "", telephone: c.telephone || "" } : tache.contactSurPlace || null;
            })();
    onEnregistrer({
      heures: Math.max(0, heures),
      jours: Math.max(0, jours),
      sauterWeekend,
      // Assignation immédiate seulement si un/des technicien(s) choisis —
      // sinon la tâche reste "en attente" avec sa durée mise à jour.
      employeId: dejaPlanifiee ? employeId || null : employeIds[0] || null,
      employeIds: dejaPlanifiee ? undefined : employeIds,
      date,
      heureDebut,
      description,
      contactSurPlace: contactChoisi,
      // 🏗️/📄 Rattachements — transmis SEULEMENT s'ils ont changé : une
      // clé absente laisse l'existant tranquille (les heures déjà
      // pointées ne sont alors jamais réécrites pour rien).
      ...((projetLie || "") !== (tache.projetId || "") ? { projetId: projetLie || null } : {}),
      ...((devisSaisiMain.trim() || devisLie || "") !== (tache.devisNumero || "")
        ? { devisNumero: devisSaisiMain.trim() || devisLie || null }
        : {}),
      // Autres techniciens cochés dans « Appliquer la modification à… » —
      // ils reçoivent les mêmes date/heure/durée/description sur leurs plages.
      autresCibles,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{dejaPlanifiee ? "Modifier la tâche" : "Édition rapide"}</h3>
            <p className="text-xs text-slate-500">{tache.titre || tache.clientNom}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {/* CLIENT & ADRESSE DES TRAVAUX — l'adresse des travaux (où le
            technicien doit se rendre) n'est JAMAIS la même chose que
            l'adresse de facturation du client ; les deux sont
            affichées séparément, avec des étiquettes explicites, pour
            ne jamais les confondre au moment de l'envoi. */}
        <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <User size={13} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-bold text-slate-800">{client?.nom || tache.clientNom || "Client non spécifié"}</p>
              {client?.entreprise && client.entreprise !== client.nom && (
                <p className="text-[11px] text-slate-500">{client.entreprise}</p>
              )}
            </div>
          </div>
          {client?.telephone && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <Phone size={12} className="shrink-0 text-slate-400" /> {client.telephone}
            </p>
          )}
          {courrielClient && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <Mail size={12} className="shrink-0 text-slate-400" /> {courrielClient.email}
            </p>
          )}

          <div className="border-t border-slate-200 pt-2">
            {tache.adresseTravaux ? (
              <>
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  <MapPin size={11} /> Adresse des travaux
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">{tache.adresseTravaux}</p>
              </>
            ) : adresseFacturationDefaut ? (
              <>
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  <MapPin size={11} /> Adresse de facturation (par défaut — aucune adresse de travaux distincte définie)
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">
                  {adresseFacturationDefaut.nom} — {libelleAdresse(adresseFacturationDefaut)}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-slate-400">Aucune adresse disponible pour ce client.</p>
            )}
          </div>
        </div>

        {/* NOTES DU TECHNICIEN (travail complété) — pour retrouver vite
            l'information quand le client rappelle pour des détails. */}
        {travailFait && (travailFait.noteTerrain || travailFait.noteInterne) && (
          <div className="mb-4 space-y-2">
            {travailFait.noteTerrain && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  📝 Note de terrain du technicien <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-bold normal-case">visible au client</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-emerald-900">{travailFait.noteTerrain}</p>
              </div>
            )}
            {travailFait.noteInterne && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  🔒 Note interne du technicien <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 font-bold normal-case">non visible au client</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{travailFait.noteInterne}</p>
              </div>
            )}
          </div>
        )}
        {/* PHOTOS DU CHANTIER prises par le technicien (avant/après) —
            cliquer une vignette ouvre la photo pleine grandeur. */}
        {travailFait && (travailFait.photosAvantUrls?.length > 0 || travailFait.photosApresUrls?.length > 0) && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            {[
              ["📷 Photos avant travaux", travailFait.photosAvantUrls, 0],
              ["📷 Photos après travaux", travailFait.photosApresUrls, (travailFait.photosAvantUrls || []).length],
            ].map(([titre, urls, decalage]) =>
              urls?.length > 0 ? (
                <div key={titre}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{titre}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {urls.map((u, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPhotoOuverte(decalage + i)}
                        title="Ouvrir la visionneuse (flèches pour naviguer)"
                        className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200 hover:border-slate-400"
                      >
                        <img src={u} alt={`${titre} ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
        {photoOuverte != null && photosTravail.length > 0 && (
          <VisionneusePhotos
            photos={photosTravail}
            indexDepart={photoOuverte}
            onFermer={() => setPhotoOuverte(null)}
          />
        )}

        {/* 🎥 VIDÉOS DU CHANTIER (2026-08-20) — un bruit, une vibration,
            une fuite : ce qu'une photo ne montre pas. Lecture directe
            dans la fiche, rien à télécharger. */}
        {(travailFait?.videosUrls || []).length > 0 && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              🎥 Vidéos du technicien ({travailFait.videosUrls.length})
            </p>
            {travailFait.videosUrls.map((u, i) => (
              <video key={i} src={u} controls preload="metadata" className="w-full rounded-lg bg-black" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Heure de début</label>
              {/* Quarts d'heure permis — la tâche occupe la case de
                  l'heure dans la grille, les minutes restent affichées. */}
              <select value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Heures / jour</label>
              <input
                type="number" min={0} max={HEURES.length} value={heures}
                onChange={(e) => { const v = parseInt(e.target.value); setHeures(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nombre de jours</label>
              <input
                type="number" min={0} value={jours}
                onChange={(e) => { const v = parseInt(e.target.value); setJours(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          {jours >= 1 && (
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <input type="checkbox" checked={sauterWeekend} onChange={(e) => setSauterWeekend(e.target.checked)} className="h-3.5 w-3.5 accent-[#FF6A13]" />
              Sauter les samedis et dimanches
            </label>
          )}

          {dejaPlanifiee ? (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Technicien attribué</label>
              <select value={employeId} onChange={(e) => setEmployeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                <option value="">— Laisser en attente (ne pas assigner) —</option>
                {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                {employeId
                  ? "Enregistrer déplacera la tâche à cette date/heure/technicien dans l'horaire."
                  : "Sans technicien, la tâche retournera dans les tâches en attente."}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Assigner à… (un ou plusieurs techniciens)</label>
              <div className="space-y-1.5">
                {employes.map((e) => (
                  <label key={e.id} className={`flex items-center gap-2.5 rounded-lg border p-2 ${employeIds.includes(e.id) ? "border-[#131B2E] bg-slate-50" : "border-slate-200"}`}>
                    <input
                      type="checkbox"
                      checked={employeIds.includes(e.id)}
                      onChange={() => basculerEmploye(e.id)}
                      className="h-4 w-4 shrink-0 accent-[#131B2E]"
                    />
                    <span className="text-xs font-bold text-slate-800">{e.nom}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {employeIds.length === 0
                  ? "Aucun technicien coché — seule la durée est enregistrée, la tâche reste en attente."
                  : employeIds.length === 1
                  ? "La tâche sera placée dans l'horaire de ce technicien."
                  : `La tâche sera placée chez ${employeIds.length} techniciens (même date/heure/durée) — ajuste ensuite chacun individuellement en cliquant son bloc.`}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">
              Description des travaux <span className="font-normal text-orange-600">(visible au technicien)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ce qu'il y a à faire sur cette tâche, instructions particulières..."
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>

          {/* 📇 CONTACT SUR PLACE — se confirme souvent APRÈS la création
              (« finalement c'est le concierge qui t'ouvre ») ; la mise à
              jour part en direct vers le téléphone du technicien. Les
              contacts s'ajoutent au carnet via la fiche client. */}
          {(client?.contacts?.length > 0 || tache.contactSurPlace) && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Contact sur place</label>
              <select
                value={contactTacheId}
                onChange={(e) => setContactTacheId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="">Aucun — numéro de la fiche client</option>
                {tache.contactSurPlace && !(client?.contacts || []).some((x) => x.id === tache.contactSurPlace.id) && (
                  <option value="actuel">
                    {tache.contactSurPlace.nom}{tache.contactSurPlace.role ? ` — ${tache.contactSurPlace.role}` : ""} (actuel)
                  </option>
                )}
                {(client?.contacts || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}{c.role ? ` — ${c.role}` : ""}{c.telephone ? ` (${c.telephone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 🏗️/📄 RATTACHEMENTS (2026-08-22) — projet et devis, changeables
              APRÈS la création. Les heures déjà pointées et le bon de
              travail déjà créé suivent le nouveau rattachement. */}
          {!estTypeSansClient(tache.typeTache) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Rattachements</p>

              <label className="mb-1 block text-[11px] font-bold text-slate-500">🏗️ Projet lié</label>
              <select
                value={projetLie}
                onChange={(e) => setProjetLie(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="">Aucun — hors projet</option>
                {projetsProposes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}{p.statut === "Terminé" ? " (terminé)" : ""}</option>
                ))}
              </select>
              {onCreerProjetDepuisTache && (
                <button
                  type="button"
                  onClick={() => onCreerProjetDepuisTache(tache)}
                  className="mt-1.5 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-white"
                >
                  🏗️ Créer un projet à partir de cette tâche…
                </button>
              )}

              <label className="mt-3 mb-1 block text-[11px] font-bold text-slate-500">📄 Devis lié</label>
              <select
                value={devisSaisiMain.trim() ? "" : devisLie}
                onChange={(e) => { setDevisLie(e.target.value); setDevisSaisiMain(""); }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {devisProposes.map((d) => (
                  <option key={d.id || d.numero} value={d.numero}>
                    {d.numero}{d.clientNom ? ` — ${d.clientNom}` : ""}
                  </option>
                ))}
              </select>
              <input
                value={devisSaisiMain}
                onChange={(e) => setDevisSaisiMain(e.target.value)}
                placeholder="…ou un numéro de devis fait hors de l'application"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />

              {rattachementChange && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                  ⚠️ En enregistrant, les <span className="font-bold">heures déjà pointées</span> sur cette tâche et le
                  bon de travail déjà créé suivront ce rattachement — les coûts du projet se mettront à jour.
                </p>
              )}
            </div>
          )}

          {/* APPLIQUER LA MODIFICATION À… — visible dès que la tâche est
              partagée entre plusieurs techniciens. */}
          {dejaPlanifiee && (techniciensSurTache || []).length > 1 && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Appliquer la modification à…</p>
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                Coche les techniciens dont les plages recevront ces changements (date, heures, durée, description).
              </p>
              <div className="space-y-1.5">
                {(techniciensSurTache || []).map((t) => {
                  const estOuvert = t.employeId === employeIdInitial;
                  const coche = estOuvert || autresCibles.includes(t.employeId);
                  return (
                    <label key={t.employeId} className={`flex items-center gap-2.5 rounded-lg border p-2 ${estOuvert ? "border-[#131B2E] bg-slate-50" : "border-slate-200"}`}>
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={estOuvert}
                        onChange={() => basculerCible(t.employeId)}
                        className="h-4 w-4 shrink-0 accent-[#131B2E]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{t.nom}</p>
                        <p className="text-[10px] text-slate-400">{t.detail}</p>
                      </div>
                      {estOuvert && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">OUVERT ICI</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* AJOUTER / DUPLIQUER VERS UN TECHNICIEN */}
          {dejaPlanifiee && onAjouterTechnicien && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ajouter ou dupliquer vers un technicien</p>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Technicien</label>
                  <select value={ajoutEmployeId} onChange={(e) => setAjoutEmployeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                    {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date</label>
                  <input type="date" value={ajoutDate} onChange={(e) => setAjoutDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                </div>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heure début</label>
                  <select value={ajoutHeure} onChange={(e) => setAjoutHeure(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                    {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heures / jour</label>
                  <input type="number" min={0} max={HEURES.length} value={ajoutHeures} onChange={(e) => { const v = parseInt(e.target.value); setAjoutHeures(Number.isNaN(v) ? 0 : Math.max(0, v)); }} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Jours</label>
                  <input type="number" min={0} value={ajoutJours} onChange={(e) => { const v = parseInt(e.target.value); setAjoutJours(Number.isNaN(v) ? 0 : Math.max(0, v)); }} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => lancerAjout(false)} className="min-h-0 py-2 text-xs">
                  <Plus size={12} /> Ajouter à cette tâche
                </Button>
                <Button variant="outline" onClick={() => lancerAjout(true)} className="min-h-0 py-2 text-xs">
                  Dupliquer (copie)
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                <span className="font-bold text-slate-500">Ajouter</span> = le technicien rejoint LA MÊME job : un seul
                bon de travail, les heures s&apos;additionnent, UNE seule facturation (signature par le dernier qui ferme).
                <br />
                <span className="font-bold text-slate-500">Dupliquer</span> = une job jumelle mais INDÉPENDANTE : son
                propre bon, sa propre facturation — pour deux interventions distinctes qui se ressemblent.
                <br />
                En résumé : même job à plusieurs bras = Ajouter · deux jobs séparées = Dupliquer. Les transports
                Début/Fin se créent automatiquement dans les deux cas.
              </p>
            </div>
          )}

          {/* 🏢 FERMER POUR LE TECHNICIEN (oubli) — visible seulement si
              AUCUNE heure n'est enregistrée par lui sur cette tâche.
              L'admin déclare début/fin : paie au taux figé, carte fermée
              sur le téléphone (avec avis), facturation en OPTION
              (bon sans signature ni photos — décochée par défaut). */}
          {dejaPlanifiee && !travailFait && onFermerPourTechnicien && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
                🕐 Fermer cette tâche pour {nomTechOuvert} (oubli)
              </p>
              <p className="mt-1 text-[10px] leading-snug text-amber-800">
                Aucune heure enregistrée par {nomTechOuvert} sur cette tâche. Déclare ses heures réelles : elles entrent
                en paie au taux figé, sa tâche se ferme sur son téléphone et il en est avisé.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-amber-700">Son heure de début</label>
                  <select value={fermDebut} onChange={(e) => { setFermDebut(e.target.value); setFermErreur(""); }} className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs">
                    {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-amber-700">Son heure de fin</label>
                  <select value={fermFin} onChange={(e) => { setFermFin(e.target.value); setFermErreur(""); }} className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs">
                    <option value="">— choisir —</option>
                    {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={fermBon} onChange={(e) => setFermBon(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" />
                <span className="text-[10px] leading-snug text-amber-800">
                  Créer aussi la <span className="font-bold">demande de facturation</span> — le bon sera{" "}
                  <span className="font-bold">sans signature, sans photos ni notes terrain</span> (alerte « non signé »
                  visible au bureau). Décochée : paie seulement.
                </span>
              </label>
              {fermErreur && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">{fermErreur}</p>}
              <button
                type="button"
                onClick={validerFermetureBureau}
                className="mt-2 w-full rounded-lg border-2 border-amber-500 bg-white py-2 text-xs font-extrabold text-amber-700 active:scale-[0.99]"
              >
                🏢 Fermer pour {nomTechOuvert}
              </button>
            </div>
          )}

          {/* BOUTON COLLANT (2026-08-17, vécu) : il était enfoui sous les
              sections « Appliquer à… » et « Ajouter un technicien » — on
              modifiait le nombre de jours puis on fermait la fenêtre sans
              le trouver, et RIEN n'était enregistré. Il reste maintenant
              visible au bas de la fenêtre pendant qu'on défile. */}
          <div className="sticky bottom-0 -mx-1 border-t border-slate-200 bg-white px-1 pb-1 pt-2">
            <Button onClick={enregistrer} className="w-full">
              {dejaPlanifiee ? "Enregistrer les modifications" : employeId ? "Enregistrer et assigner" : "Enregistrer"}
            </Button>
          </div>

          {/* RETRAIT DE L'HORAIRE — le même geste que « Laisser en
              attente » du menu déroulant, mais VISIBLE : personne ne
              devine qu'une option de menu sert de bouton Retirer. */}
          {dejaPlanifiee && onRetirerHoraire && (
            <Button
              variant="outline"
              onClick={() => onRetirerHoraire({ heures: Math.max(0, heures), jours: Math.max(0, jours), sauterWeekend, description })}
              className="min-h-0 w-full py-2 text-xs"
            >
              ↩️ Retirer de l&apos;horaire — la tâche retourne dans « Tâches en attente »
            </Button>
          )}

          {/* ANNULATION DÉFINITIVE — lien discret (pas un gros bouton
              rouge à côté d'Enregistrer), mais parcours en 2 étapes. */}
          {onAnnulerTache && travailFait && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-500">
              🔒 Un technicien a déjà exécuté du travail sur cette tâche — elle ne peut plus être annulée :
              elle doit se facturer (ou se créditer) via l&apos;onglet Facturation.
            </p>
          )}
          {onAnnulerTache && !travailFait && annulation?.permise && (
            <button
              onClick={() => setEtapeAnnulation("raison")}
              className="w-full text-center text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-red-600"
            >
              🗑️ Annuler cette tâche définitivement…
            </button>
          )}
          {onAnnulerTache && !travailFait && !annulation?.permise && annulation?.bloqueeRaison && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{annulation.bloqueeRaison}</p>
          )}
        </div>
      </div>

      {/* ÉTAPE 1 — raison obligatoire + avertissements dépôt/pièce. */}
      {etapeAnnulation === "raison" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-base font-extrabold text-slate-900">🗑️ Annuler la tâche</p>
            <p className="mt-1 text-[13px] font-bold text-slate-700">« {tache.titre || tache.clientNom} »</p>
            {(annulation?.avertissements || []).map((a, i) => (
              <p key={i} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-snug text-amber-800">{a}</p>
            ))}
            <label className="mt-3 mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Raison de l&apos;annulation *</label>
            <textarea
              value={raisonAnnulation}
              onChange={(e) => setRaisonAnnulation(e.target.value)}
              rows={2}
              placeholder="Ex. : le client a annulé son rendez-vous"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => { setEtapeAnnulation(null); setRaisonAnnulation(""); }} className="min-h-0 flex-1 py-2 text-xs">
                Retour
              </Button>
              <Button onClick={() => setEtapeAnnulation("confirmation")} disabled={raisonAnnulation.trim().length < 3} className="min-h-0 flex-1 py-2 text-xs">
                Continuer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 — dernière vérification, en rouge, irréversible. */}
      {etapeAnnulation === "confirmation" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-base font-extrabold text-red-600">⚠️ Dernière vérification</p>
            <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
              La tâche <span className="font-bold text-slate-800">« {tache.titre || tache.clientNom} »</span> sera
              annulée <span className="font-bold">définitivement</span> : retirée de l&apos;horaire de tous les
              techniciens et de la liste d&apos;attente. Cette action est <span className="font-bold">irréversible</span>.
            </p>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-500">Raison : {raisonAnnulation.trim()}</p>
            <div className="mt-4 space-y-2">
              <Button
                variant="danger"
                onClick={() => onAnnulerTache(raisonAnnulation.trim())}
                className="min-h-[48px] w-full text-sm font-extrabold"
              >
                Oui, annuler définitivement
              </Button>
              <Button variant="outline" onClick={() => setEtapeAnnulation("raison")} className="min-h-[48px] w-full text-sm font-bold">
                Non, retour
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OngletAgenda({ tachesAttente, setTachesAttente, planning, setPlanning, ajouterJournal, clients, setClients, devisListe, projets, lectureSeule, employes, travaux, bons, pieces, depots, prixDepots, onCreerDepot, onDepotPaye, onDetacherPiece, onCreerProjet, role, onMajFacturable, statutsAssignations, sousTraitants, assignationsST, onEnregistrerSousTraitant, onStatutST, onAjouterCoutSousTraitant }) {
  // ============================================================
  // SECTIONS DE L'AGENDA (2026-08-19, demande du propriétaire) :
  //   🔧 Équipe terrain (en haut, comme avant)
  //   🗂️ Personnel de bureau (repliée — congés et déplacements)
  //   🤝 Sous-traitants (repliée — planification + suivi Présent/Absent)
  // Le choix ouvert/replié survit au rechargement (localStorage).
  // ============================================================
  const [bureauOuvert, setBureauOuvert] = useState(() => {
    try { return localStorage.getItem("agenda-bureau-ouvert") === "1"; } catch { return false; }
  });
  const [stOuvert, setStOuvert] = useState(() => {
    try { return localStorage.getItem("agenda-st-ouvert") === "1"; } catch { return false; }
  });
  const basculerSection = (quoi) => {
    if (quoi === "bureau") {
      setBureauOuvert((v) => { try { localStorage.setItem("agenda-bureau-ouvert", v ? "0" : "1"); } catch {} return !v; });
    } else {
      setStOuvert((v) => { try { localStorage.setItem("agenda-st-ouvert", v ? "0" : "1"); } catch {} return !v; });
    }
  };
  // Fiche sous-traitant (création/édition) et statut d'un bloc ST.
  const [modalFicheST, setModalFicheST] = useState(null); // { id?, nom, specialite, telephone, note, clientId }
  const [modalStatutST, setModalStatutST] = useState(null); // { tache, employe, date }
  // Statut d'un bloc de sous-traitant — lu dans SES assignations.
  const statutBlocST = (tacheId, courrielSt) => {
    const a = (assignationsST || []).find((x) => x.tache_id === tacheId && x.employe_email === courrielSt);
    return a?.donnees?.stStatut || "prevu";
  };
  // 💰/🤝 Le choix « facturable » en attente de réponse — { tacheId, titre, employe }.
  const [choixFacturable, setChoixFacturable] = useState(null);
  // 🏗️ « Créer un projet à partir de cette tâche » — la tâche visée.
  const [projetDepuisTache, setProjetDepuisTache] = useState(null);
  // Un AUTRE technicien tient-il déjà cette tâche dans la grille ?
  const autreTechnicienALaTache = (tacheId, employeIdCourant) =>
    Object.entries(planning || {}).some(
      ([cle, cellule]) =>
        cle.split("|")[1] !== String(employeIdCourant) &&
        // 🤝 Les rangées de SOUS-TRAITANTS ne comptent pas : un ST sur la
        // tâche ne fait pas du technicien un « 2e technicien » (pas de
        // question 💰/🤝 à cause d'un sous-traitant).
        !cle.split("|")[1].startsWith("st-") &&
        listeCellule(cellule).some((x) => x.id === tacheId)
    );
  // Taux de taxes des Paramètres — dépôts affichés taxes incluses.
  const configEnt = useEntreprise();
  // Statut du dépôt d'une tâche : bloque la planification tant que le
  // dépôt n'est pas payé (ou payé manuellement) — annulé après 24 h.
  const depotDe = (tacheId) => depots?.[tacheId];
  const depotBloque = (tacheId) => {
    const d = depotDe(tacheId);
    return !!d && (d.statut === "en_attente_paiement" || d.statut === "annule_delai");
  };
  // Modale « Dépôt reçu manuellement » : { tacheId } ou null.
  const [depotModal, setDepotModal] = useState(null);
  const [depotMode, setDepotMode] = useState("Comptant");
  // Tâches TERMINÉES par les techniciens (via travaux_effectues) — la clé
  // `tacheId|courriel` colore le bloc du bon technicien en vert ET donne
  // accès au travail complété (note de terrain, heures réelles).
  // Sur un chantier de PLUSIEURS JOURS, chaque journée enregistre ses
  // heures sous une clé « tacheId::date » (sinon mardi écraserait
  // lundi). On rattache donc l'heure à la tâche par le préfixe.
  const travauxParCle = new Map(
    (travaux || [])
      .filter((t) => t.supabase && t.tacheId && t.employeEmail)
      .map((t) => [`${cleTacheDesHeures(t.tacheId)}|${t.employeEmail.toLowerCase()}`, t])
  );
  // Nombre de JOURNÉES déjà pointées sur un chantier — sert au « 2/3 »
  // affiché sur le bloc : un bloc gris trois jours de suite ne dit pas
  // si le technicien y est allé.
  const joursPointes = (tache, emp) => {
    const courriel = (emp?.courriel || "").toLowerCase();
    return (travaux || []).filter(
      (t) => t.supabase && cleTacheDesHeures(t.tacheId) === tache.id && (t.employeEmail || "").toLowerCase() === courriel
    ).length;
  };
  const travailTermine = (tache, emp) =>
    travauxParCle.get(`${tache.id}|${(emp?.courriel || "").toLowerCase()}`);
  // VERT = TRAVAUX FERMÉS, pas « une journée pointée ». Sur un chantier
  // de 3 jours, les trois blocs passent au vert ensemble, quand le
  // technicien a déclaré les travaux terminés (bon de travail envoyé).
  const estTerminee = (tache, emp) => {
    const t = travailTermine(tache, emp);
    if (!t) return false;
    if (!(Number(tache.jours) > 1)) return true;
    return (bons || []).some((b) => b.tacheId === tache.id);
  };
  // ⏱️ ROSE VIF (fuchsia) = CHRONOMÈTRE PARTI (2026-08-18) : le
  // technicien a pesé Débuter et n'a pas encore fermé sa carte. Fuchsia
  // parce que TOUT le reste de la palette est pris (le bleu ciel = les
  // visites de chantier, remarque du propriétaire). Le vert (travaux
  // fermés) garde priorité.
  const estEnCours = (tache, emp) =>
    !estTerminee(tache, emp) &&
    statutsAssignations?.[`${tache.id}|${(emp?.courriel || "").toLowerCase()}`] === "en_cours";
  const [jourAffiche, setJourAffiche] = useState(new Date());
  const [vue, setVue] = useState("jour"); // "jour" | "semaine" | "mois"
  const grilleScrollRef = useRef(null);

  // ------------------------------------------------------------
  // REDIMENSIONNEMENT D'UNE TÂCHE À LA SOURIS (vue Jour) — on suit le
  // pointeur via `document.elementFromPoint` plutôt qu'un calcul en
  // pixels : les colonnes horaires ont une largeur variable
  // (`minmax(52px, 1fr)`), donc lire directement la case survolée
  // (via l'attribut `data-heure-index`) reste fiable peu importe le
  // zoom, la largeur d'écran ou le défilement horizontal en cours.
  // ------------------------------------------------------------
  const [redim, setRedim] = useState(null); // { tache, employeId, jourCible, indexDebut, spanInitial, spanActuel }
  const [survol, setSurvol] = useState(null); // { tache, employe, x, y }

  useEffect(() => {
    if (!redim) return;

    const surDeplacement = (e) => {
      // Calcul GÉOMÉTRIQUE : la durée découle de la distance parcourue
      // par la souris depuis le bord gauche du bloc (mesuré au moment où
      // la poignée est attrapée). On ne lit plus « l'élément sous le
      // curseur » : passer au-dessus du bloc lui-même ou d'un bloc voisin
      // renvoyait le numéro de SA première case → la tâche sautait à
      // 1 h puis se ré-étirait d'un coup.
      const maxSpan = HEURES.length - redim.indexDebut;
      const nouveauSpan = Math.max(1, Math.min(maxSpan, Math.ceil((e.clientX - redim.origineX) / redim.largeurCase)));
      setRedim((prev) => (prev && prev.spanActuel !== nouveauSpan ? { ...prev, spanActuel: nouveauSpan } : prev));
    };

    const surRelachement = () => {
      setRedim((actuel) => {
        if (actuel && actuel.spanActuel !== actuel.spanInitial) {
          redimensionnerTache(actuel.tache, actuel.employeId, actuel.jourCible, actuel.heureDebut, actuel.spanActuel);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", surDeplacement);
    window.addEventListener("pointerup", surRelachement);
    return () => {
      window.removeEventListener("pointermove", surDeplacement);
      window.removeEventListener("pointerup", surRelachement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!redim]);

  // Au chargement (et à chaque retour en vue Jour), fait défiler la
  // grille horizontalement pour que 7h00 soit la première plage
  // visible à l'écran — sans retirer les heures avant 7h ni changer
  // leur ordre : l'admin peut toujours se déplacer librement vers la
  // gauche (heures plus tôt) ou la droite (heures plus tard) au besoin.
  useEffect(() => {
    if (vue !== "jour") return;
    // requestAnimationFrame plutôt qu'un calcul immédiat : au tout
    // premier rendu, la grille peut ne pas avoir encore sa largeur
    // intrinsèque finale (min-w-[640px]) au moment où l'effet
    // s'exécute — sans ce délai, scrollWidth === clientWidth et il
    // n'y a alors rien à faire défiler.
    const id = requestAnimationFrame(() => {
      if (!grilleScrollRef.current) return;
      // La colonne des noms est maintenant collante (sticky) : elle
      // occupe en permanence les 120 premiers pixels à gauche. Pour que
      // 07:00 apparaisse juste APRÈS elle (et non caché dessous), le
      // défilement ne compte plus la largeur de cette colonne.
      const LARGEUR_MIN_COLONNE_HEURE = 52;
      const indexSeptHeures = HEURES.indexOf("07:00");
      grilleScrollRef.current.scrollLeft = indexSeptHeures * LARGEUR_MIN_COLONNE_HEURE;
    });
    return () => cancelAnimationFrame(id);
  }, [vue]);

  const [tacheSurvolee, setTacheSurvolee] = useState(null);
  const [tacheDetailOuverte, setTacheDetailOuverte] = useState(null); // { tache, employe, date, heure }
  const [tacheEnEditionId, setTacheEnEditionId] = useState(null);
  // 🎴 Carte d'attente dépliée (une seule à la fois) — les autres
  // restent sur UNE ligne : pastille, titre, chips d'état.
  const [tacheDepliee, setTacheDepliee] = useState(null);
  const [assignationMobile, setAssignationMobile] = useState(null); // {tacheId, employeId, heure, date}
  // 📱 AGENDA TÉLÉPHONE — LISTE DÉPLIÉE (essai des cartes repliées
  // abandonné le 2026-08-22 après usage réel : ça tenait dans un écran,
  // mais ça se lisait moins bien qu'un simple défilement où tout est
  // déjà là. Rien à ouvrir, rien à mémoriser.)
  //
  // 📋 / ▦ DEUX MODES AU CHOIX (2026-08-22, demande du propriétaire).
  // ------------------------------------------------------------
  // La liste se lit vite, mais elle ne montre pas la FORME de la
  // journée — qui est libre à 10 h, qui déborde. La grille, elle, le
  // montre d'un coup d'œil ; elle demande juste de glisser de côté.
  // Les deux servent, à des moments différents : c'est donc un choix,
  // pas une devinette sur la largeur de l'écran. Mémorisé PAR
  // APPAREIL — le téléphone garde son réglage, le bureau le sien.
  const [modeAgendaMobile, setModeAgendaMobile] = useState("liste");
  useEffect(() => {
    try {
      if (localStorage.getItem("agenda-mobile-mode") === "grille") setModeAgendaMobile("grille");
    } catch {
      // stockage indisponible — on reste sur la liste, le choix sûr
    }
  }, []);
  const choisirModeAgenda = (mode) => {
    setModeAgendaMobile(mode);
    try {
      localStorage.setItem("agenda-mobile-mode", mode);
    } catch {}
  };
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  // « ➕ Nouveau client » depuis la création de tâche (fenêtre partagée).
  const [modalNouveauClientTache, setModalNouveauClientTache] = useState(false);
  // 👯 Tâche jumelle détectée à la création — { titre, client, date } :
  // la fenêtre demande confirmation avant de créer une seconde fois.
  const [doublonTache, setDoublonTache] = useState(null);
  // ✏️ Correction rapide de la fiche du client choisi, sans quitter la
  // création de tâche (retour de tests 2026-08-17 : « où est l'option
  // pour modifier les clients ? » — elle existait dans l'onglet Clients,
  // maintenant elle est aussi ICI, là où on en a besoin).
  const [clientEnEditionAgenda, setClientEnEditionAgenda] = useState(null);
  // Onglets du panneau « Tâches en attente » : PRÊTES à planifier
  // (glissables maintenant) vs EN ATTENTE (bloquées par un dépôt non
  // payé/annulé). Une tâche change d'onglet automatiquement dès que son
  // dépôt est payé.
  const [ongletAttente, setOngletAttente] = useState("pretes");
  // Une tache de RETOUR attend sa piece : elle ne peut pas aller a
  // l'horaire tant que la piece n'est pas recue (et payee si exige).
  // Meme mecanique que les depots — on reutilise la meme pile bloquee.
  const pieceBloque = (tacheId) => {
    const p = (pieces || []).find((x) => x.tacheRetourId === tacheId);
    return pieceBloqueLaTache(p);
  };
  const estBloquee = (t) => depotBloque(t.id) || pieceBloque(t.id);
  const tachesPretes = tachesAttente.filter((t) => !estBloquee(t));
  // TROIS PILES, PAS DEUX — parce que le GESTE diffère.
  //
  // Un dépôt impayé, on rappelle le CLIENT pour de l'argent. Une pièce
  // qui n'arrive pas, on rappelle le FOURNISSEUR. Ce n'est pas la même
  // personne au bureau qui décroche, et les mélanger obligeait à lire
  // chaque carte pour savoir laquelle des deux on regarde.
  const tachesPiece = tachesAttente.filter((t) => pieceBloque(t.id));
  const tachesBloquees = tachesAttente.filter((t) => depotBloque(t.id) && !pieceBloque(t.id));
  const tachesAttenteAffichees =
    ongletAttente === "bloquees" ? tachesBloquees : ongletAttente === "pieces" ? tachesPiece : tachesPretes;
  // Une date promise déjà dépassée : le compteur de l'onglet vire au
  // rouge pour que personne n'ait à ouvrir la pile pour le découvrir.
  const piecesEnRetard = (pieces || []).filter((p) => p.enRetard).length;
  const [nouveauTitre, setNouveauTitre] = useState("");
  // ASSISTANT EN 2 ÉTAPES (demande du propriétaire, 2026-08-17) : le
  // TYPE d'abord (grandes tuiles), puis un formulaire qui ne montre que
  // les cases utiles à ce type.
  const [etapeTypeTache, setEtapeTypeTache] = useState(true);
  const [adresseCourseLibre, setAdresseCourseLibre] = useState("");
  // 📎 PIÈCES JOINTES (photos du site, plans PDF) — téléversées dès la
  // sélection, transmises au technicien AVEC la tâche (via donnees).
  const [nouvellesPiecesJointes, setNouvellesPiecesJointes] = useState([]);
  const [televersementJointe, setTeleversementJointe] = useState(false);
  const ajouterPiecesJointes = async (fichiers) => {
    setTeleversementJointe(true);
    for (const fichier of fichiers) {
      try {
        if (fichier.type === "application/pdf") {
          if (fichier.size > 15 * 1024 * 1024) {
            ajouterJournal(`⚠️ « ${fichier.name} » dépasse 15 Mo — allège le PDF avant de le joindre.`);
            continue;
          }
          const url = await televerserPieceJointeTache(fichier);
          setNouvellesPiecesJointes((prev) => [...prev, { url, nom: fichier.name, type: "pdf" }]);
        } else if (fichier.type.startsWith("image/")) {
          const { blob } = await compresserImageJointe(fichier);
          const url = await televerserPieceJointeTache(fichier, { blob, contentType: "image/jpeg" });
          setNouvellesPiecesJointes((prev) => [...prev, { url, nom: fichier.name, type: "image" }]);
        } else {
          ajouterJournal(`⚠️ « ${fichier.name} » ignoré — seuls les images et les PDF sont acceptés.`);
        }
      } catch {
        ajouterJournal(`⚠️ Téléversement de « ${fichier.name} » échoué — réessaie.`);
      }
    }
    setTeleversementJointe(false);
  };
  // AUCUN client présélectionné (demande du propriétaire, 2026-08-17) :
  // avant, le premier en ordre alphabétique était choisi d'office — une
  // tâche pouvait partir sur le mauvais client par simple distraction.
  const [nouveauClientId, setNouveauClientId] = useState("");
  const [nouveauType, setNouveauType] = useState("appel_service");
  // TEMPS SUR LE PROJET, OU FRAIS ADMINISTRATIFS ?
  //
  // La même visite n'a pas le même sens selon le moment : préparer une
  // soumission qu'on ne remportera peut-être pas est un coût de VENTE,
  // alors qu'une visite sur un chantier en cours est un coût de CE
  // projet. Aucun automatisme ne peut trancher — c'est un choix humain,
  // fait au moment de créer la tâche.
  //
  // Par défaut décoché (= administratif), comme le propriétaire l'a
  // décrit : ces visites sont normalement faites par l'administration.
  const [tempsSurProjet, setTempsSurProjet] = useState(false);
  // --- Dépôt préalable (coché d'office pour les appels de service) ---
  const [depotRequis, setDepotRequis] = useState(true);
  const [depotMontant, setDepotMontant] = useState("");
  // 🗺️ ZONE DE TARIFICATION — INDÉPENDANTE DU DÉPÔT (2026-08-25,
  // demande du propriétaire). Avant, la zone se choisissait DANS le
  // bloc dépôt : décocher le dépôt (client régulier, payeur sur
  // facture) créait un appel SANS zone — et la facturation ne savait
  // plus ni le prix de base ni la règle du temps inclus (90 min chez
  // le client en zone, 180 min TOTALES transport compris hors zone).
  // La zone est maintenant un choix OBLIGATOIRE de l'appel de service,
  // dépôt ou pas ; le montant du dépôt en DÉCOULE quand il est requis.
  const [zoneAppelChoix, setZoneAppelChoix] = useState(""); // "", nom de zone, ou "hors_zone"
  // Destinataires de la DEMANDE DE DÉPÔT (courriel avec facture QBO) —
  // les adresses par défaut du client sont précochées au choix du client.
  const [depotEmails, setDepotEmails] = useState([]);
  const [depotExtra, setDepotExtra] = useState("");
  // 📌 « Autre adresse » AU DOSSIER (2026-08-24, demande du
  // propriétaire) : un courriel tapé ici partait avec la demande de
  // dépôt puis disparaissait — à la prochaine tâche du même client, il
  // fallait le retaper. Même patron que l'adresse de chantier : coché
  // d'avance, anti-doublon, trace au journal.
  const [depotExtraAuDossier, setDepotExtraAuDossier] = useState(true);
  // Le défaut suit le type : appel de service = dépôt suggéré d'office.
  useEffect(() => {
    // Le dépôt d'appel suit la RÈGLE DE L'ENTREPRISE (Paramètres →
    // Appels de service) — certaines n'exigent pas de dépôt.
    setDepotRequis(nouveauType === "appel_service" && configEnt?.appelsDepotDefaut !== false);
  }, [nouveauType]);
  const [nouveauDevisId, setNouveauDevisId] = useState("");
  const [nouvelleFrequence, setNouvelleFrequence] = useState(4);
  const [nouveauProjetId, setNouveauProjetId] = useState(""); // "" = Aucun / Projet général
  // SECTEUR CCQ — décide du taux coûtant de chaque heure. Hérité du
  // (DOIT vivre APRÈS nouveauProjetId : l'avoir déclaré AVANT plantait
  // tout l'onglet Agenda — « cannot access before initialization ».
  // Trouvé par le propriétaire en production, 2026-08-15.)
  // PROJET choisi (option validée par le propriétaire), Commercial par
  // défaut, changeable au cas par cas.
  // AUCUNE présélection (demande du propriétaire, 2026-08-17) : le
  // secteur décide du taux coûtant CCQ figé — un « Commercial » oublié
  // faussait la paie de toute la tâche. Choix obligatoire à la création
  // (sauf types sans heures) ; un projet choisi l'hérite quand même.
  const [nouveauSecteur, setNouveauSecteur] = useState("");
  useEffect(() => {
    const projetChoisi = (projets || []).find((pr) => pr.id === nouveauProjetId);
    if (projetChoisi?.secteur) setNouveauSecteur(projetChoisi.secteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nouveauProjetId]);
  const [adresseTravauxDifferente, setAdresseTravauxDifferente] = useState(false);
  const [adresseTravauxId, setAdresseTravauxId] = useState("");
  const [nouvelleAdresseTravaux, setNouvelleAdresseTravaux] = useState(null); // résultat de l'autocomplétion
  // 📌 Une NOUVELLE adresse tapée s'enregistre au dossier du client
  // (coché d'avance — retour de tests 2026-08-17 : l'adresse d'une tâche
  // précédente n'était jamais offerte à la suivante).
  const [enregistrerAdresseFiche, setEnregistrerAdresseFiche] = useState(true);
  // Planification directe dès la création — si date + technicien sont
  // tous les deux renseignés, la tâche se positionne immédiatement
  // dans la grille plutôt que d'atterrir dans "Tâches en attente".
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [nouvelleHeureDebut, setNouvelleHeureDebut] = useState(HEURE_PAR_DEFAUT);
  const [nouveauEmployeId, setNouveauEmployeId] = useState("");
  // MULTI-TECHNICIENS à la création (retour de tests 2026-08-10) : les
  // techniciens cochés EN PLUS reçoivent la MÊME tâche partagée (heures
  // additionnées, une seule facturation) — fini le détour « créer puis
  // ajouter dans l'agenda ».
  const [nouveauxEmployesEnPlus, setNouveauxEmployesEnPlus] = useState([]);
  // 💰/🤝 Choix facturable PAR technicien supplémentaire, fait À LA
  // CRÉATION (demande du propriétaire, 2026-08-17) : { employeId: true
  // (facturable) | false (aide interne) }. Obligatoire — remplace la
  // fenêtre posée après coup, qui s'écrasait quand on cochait deux
  // techniciens d'un coup (un des choix n'était jamais demandé).
  const [facturablesEnPlus, setFacturablesEnPlus] = useState({});
  // 📇 CONTACT SUR PLACE (demande du propriétaire, 2026-08-17) : la
  // personne à voir sur le chantier (chargé de projet, concierge…) —
  // souvent PAS le numéro de la fiche client. Choisi dans le carnet du
  // client, ou créé ici (et enregistré au carnet pour la prochaine
  // fois). "" = aucun (numéro de la fiche client), "nouveau" = saisie.
  const [contactSurPlaceId, setContactSurPlaceId] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactTel, setContactTel] = useState("");
  // Changer de client invalide le contact choisi (il appartient à
  // l'ancien client) — on repart à « Aucun ». Le DEVIS choisi aussi
  // (audit 2026-08-17) : sinon il restait sélectionné mais INVISIBLE
  // (filtré de la liste) et s'attachait au mauvais client.
  useEffect(() => {
    setContactSurPlaceId("");
    setContactNom("");
    setContactRole("");
    setContactTel("");
    setNouveauDevisId("");
    setUnitesChoisies([]);
  }, [nouveauClientId]);
  // 🔧 UNITÉS CONCERNÉES (2026-08-25, demande du propriétaire) : le
  // carnet d'équipements du client — relevé visite après visite sur les
  // bons signés — est offert à la création de la tâche. Cocher une
  // unité dit au technicien LAQUELLE travailler quand il y en a trois
  // sur le toit, et pré-remplit sa section « Unité vérifiée » (fini le
  // numéro de série retapé de travers). Clés `modele|serie`.
  const [unitesChoisies, setUnitesChoisies] = useState([]);
  const unitesConnuesDuClient = (clientId) => {
    const fiche = clients.find((x) => x.id === clientId);
    if (!fiche) return [];
    const unites = [];
    (bons || [])
      .filter((b) => b.client === fiche.nom)
      .forEach((b) => {
        const listeU =
          Array.isArray(b.unites) && b.unites.length > 0
            ? b.unites
            : b.modeleUnite || b.serieUnite
              ? [{ modele: b.modeleUnite, serie: b.serieUnite }]
              : [];
        listeU.forEach((ub) => {
          if (!(ub.modele || ub.serie)) return;
          const cle = `${ub.modele || ""}|${ub.serie || ""}`;
          const existe = unites.find((u) => u.cle === cle);
          if (existe) {
            // La plus récente gagne l'emplacement manquant.
            if (ub.emplacement && !existe.emplacement) existe.emplacement = ub.emplacement;
          } else {
            unites.push({ cle, modele: ub.modele || "", serie: ub.serie || "", emplacement: ub.emplacement || "" });
          }
        });
      });
    return unites;
  };
  // TRANSITION QUICKBOOKS : numéro d'un devis EXISTANT (hors application)
  // à attacher à la tâche — il suit jusqu'au bon de travail et à la
  // facturation.
  const [numeroDevisExistant, setNumeroDevisExistant] = useState("");
  // 🔎 Vérification du numéro tapé, DANS QuickBooks, au moment de la
  // création (2026-08-25) : une faute de frappe découverte à la
  // facturation, trois semaines plus tard, est dix fois plus chère
  // qu'ici. { etat: "cherche"|"trouve"|"introuvable"|"hors_ligne",
  // total?, nbLignes?, clientNomQbo? } — null = pas encore vérifié.
  const [verifDevisQbo, setVerifDevisQbo] = useState(null);
  const verifierDevisQbo = async () => {
    const numero = numeroDevisExistant.trim();
    if (!numero) return;
    setVerifDevisQbo({ etat: "cherche" });
    const r = await lireEstimateQbo(numero);
    if (r?.trouve) {
      setVerifDevisQbo({
        etat: "trouve",
        total: Number(r.total) || 0,
        nbLignes: (r.lignes || []).length,
        clientNomQbo: r.clientNomQbo || null,
      });
    } else if (r?.trouve === false) {
      setVerifDevisQbo({ etat: "introuvable" });
    } else {
      setVerifDevisQbo({ etat: "hors_ligne" });
    }
  };
  // Filtres de recherche des listes déroulantes (la liste RESTE — le
  // filtre la raccourcit seulement).
  const [filtreClientTache, setFiltreClientTache] = useState("");
  // 📋 Liste ouverte au clic (2026-08-25) — même raison que le devis :
  // quand on a oublié le nom, il n'y a pas de première lettre à taper.
  const [listeClientsTacheOuverte, setListeClientsTacheOuverte] = useState(false);
  const [filtreAdresseTache, setFiltreAdresseTache] = useState("");
  // Appartement / unité d'une nouvelle adresse de travaux.
  const [nouvelleAdresseApp, setNouvelleAdresseApp] = useState("");
  const [nouvelleDureeHeures, setNouvelleDureeHeures] = useState(1);
  const [nouvelleDureeJours, setNouvelleDureeJours] = useState(0);
  const [nouveauSauterWeekend, setNouveauSauterWeekend] = useState(false);
  // Description des travaux — saisissable dès la création (avant, il
  // fallait rouvrir la fenêtre d'édition pour en écrire une).
  const [nouvelleDescription, setNouvelleDescription] = useState("");

  // Filtrage dynamique : si un client est choisi, ne montrer que SES
  // projets ; sinon, montrer tous les projets actifs (on exclut
  // "Terminé" — un projet clos n'a plus de raison de recevoir de
  // nouvelles tâches).
  const projetsDisponibles = (projets || []).filter((p) => {
    if (p.statut === "Terminé") return false;
    if (nouveauClientId) return p.clientId === nouveauClientId;
    return true;
  });

  const jourKey = dateISO(jourAffiche);
  // ---- Les trois groupes de rangées + en-têtes intercalés ----
  const groupeTerrain = (employes || []).filter((e) => !e.estBureau && !e.estSousTraitant);
  const groupeBureau = (employes || []).filter((e) => e.estBureau);
  const groupeST = (employes || []).filter((e) => e.estSousTraitant);
  const entreesDuJourPour = (groupe) =>
    groupe.reduce((n, e) => n + tachesDuJourPourEmploye(planning, jourKey, e.id).length, 0);
  const rangeesAgenda = [
    ...groupeTerrain,
    ...(groupeBureau.length > 0 ? [{ enteteSection: "bureau" }] : []),
    ...(bureauOuvert ? groupeBureau : []),
    { enteteSection: "st" },
    ...(stOuvert ? groupeST : []),
  ];
  // Couleurs et icônes des blocs de SOUS-TRAITANTS, par statut.
  const ST_COULEURS = {
    prevu: ["border-amber-400 bg-amber-50", "bg-amber-100 text-amber-900", "bg-amber-500"],
    present: ["border-emerald-500 bg-emerald-50", "bg-emerald-100 text-emerald-900", "bg-emerald-500"],
    absent: ["border-red-400 bg-red-50", "bg-red-100 text-red-800", "bg-red-500"],
  };
  const ST_ICONES = { prevu: "⏳", present: "✅", absent: "❌" };
  const stAConfirmer = (tacheId, courrielSt, dateIso) =>
    statutBlocST(tacheId, courrielSt) === "prevu" && dateIso < dateISO(new Date());
  const renderEnteteSection = (type) => {
    const estBureauSec = type === "bureau";
    const ouvert = estBureauSec ? bureauOuvert : stOuvert;
    const groupe = estBureauSec ? groupeBureau : groupeST;
    const nbEntrees = entreesDuJourPour(groupe);
    return (
      // ⚠️ COLLANT GAUCHE/DROITE (retour de tests 2026-08-19) : cette
      // rangée vit DANS la grille à défilement horizontal — sans sticky,
      // « Personnel de bureau » et « Sous-traitants » partaient hors
      // écran dès qu'on défilait vers les heures d'après-midi.
      <div key={`entete-${type}`} className="flex items-center justify-between gap-2 border-t-2 border-slate-200 bg-slate-100/80 px-3 py-1.5">
        <button
          onClick={() => basculerSection(type)}
          className="sticky left-3 z-[1] flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600"
        >
          <ChevronDown size={13} className={`shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`} />
          {estBureauSec ? "🗂️ Personnel de bureau" : "🤝 Sous-traitants"} ({groupe.length})
          {!ouvert && nbEntrees > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-700">
              {nbEntrees} entrée{nbEntrees > 1 ? "s" : ""} aujourd&apos;hui
            </span>
          )}
        </button>
        {!estBureauSec && !lectureSeule && (
          <button
            onClick={() => setModalFicheST({ nom: "", specialite: "", telephone: "", note: "", clientId: "" })}
            className="sticky right-3 z-[1] shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600"
          >
            ➕ Sous-traitant
          </button>
        )}
      </div>
    );
  };
  const jourLabel = jourAffiche.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const moisLabel = jourAffiche.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });

  const semaine = Array.from({ length: 7 }, (_, i) => ajouterJours(jourAffiche, i - jourAffiche.getDay() + 1));
  const mois = joursDuMois(jourAffiche);
  const joursAffiches = vue === "semaine" ? semaine : vue === "mois" ? mois : [];

  const reculer = () => setJourAffiche(vue === "mois" ? new Date(jourAffiche.getFullYear(), jourAffiche.getMonth() - 1, 1) : ajouterJours(jourAffiche, vue === "semaine" ? -7 : -1));
  const avancer = () => setJourAffiche(vue === "mois" ? new Date(jourAffiche.getFullYear(), jourAffiche.getMonth() + 1, 1) : ajouterJours(jourAffiche, vue === "semaine" ? 7 : 1));

  const majDureeTache = (id, champs) => {
    setTachesAttente((prev) => prev.map((t) => (t.id === id ? { ...t, ...champs } : t)));
  };

  // Choisir un client depuis les SUGGESTIONS : mêmes effets que
  // l'ancien menu (adresse, projet et destinataires du dépôt suivent).
  const choisirClientTache = (id) => {
    setNouveauClientId(id);
    setAdresseTravauxId("");
    setNouvelleAdresseTravaux(null);
    setFiltreAdresseTache("");
    setNouveauProjetId("");
    const fiche = clients.find((c) => c.id === id);
    const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
    const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
    setDepotEmails(defauts.length > 0 ? defauts : tous.slice(0, 1));
    setDepotExtra("");
  };

  // 👯 GARDE ANTI-DOUBLON (2026-08-21, vécu) : « Déconnexion de 2 unités
  // au toit » a été créée DEUX fois pour le même client, la même
  // journée, à la même adresse — six heures d'écart, aucun signal.
  // Résultat : deux cartes strictement identiques sur le téléphone de
  // deux techniciens le matin même. L'ADRESSE fait partie de la
  // comparaison : le même client peut très bien avoir deux vraies jobs
  // le même jour à deux adresses différentes (c'était le cas ici).
  const tachesExistantesDuJour = (dateIso) => {
    const vues = new Map();
    (tachesAttente || []).forEach((t) => vues.set(`att-${t.id}`, { ...t, dateVue: null }));
    Object.entries(planning || {}).forEach(([cle, cellule]) => {
      const [dateCle] = cle.split("|");
      if (dateIso && dateCle !== dateIso) return;
      listeCellule(cellule).forEach((t) => {
        if (!t || t.est_tache_systeme) return;
        vues.set(`${t.id}|${dateCle}`, { ...t, dateVue: dateCle });
      });
    });
    return [...vues.values()];
  };
  const normaliserTexte = (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ");

  const creerTache = (doublonAccepte = false) => {
    if (lectureSeule || !nouveauTitre.trim()) return;
    const client = clients.find((c) => c.id === nouveauClientId);
    if (!doublonAccepte) {
      const adresseVisee = normaliserTexte(
        (adresseTravauxDifferente && (nouvelleAdresseTravaux?.label || client?.adresses?.find((a) => a.id === adresseTravauxId)?.ligne1)) ||
          client?.adresses?.[0]?.ligne1 ||
          ""
      );
      const jumelle = tachesExistantesDuJour(nouvelleDate || null).find((t) => {
        if (normaliserTexte(t.titre) !== normaliserTexte(nouveauTitre)) return false;
        const memeClient = nouveauClientId ? t.clientId === nouveauClientId : normaliserTexte(t.clientNom) === normaliserTexte(client?.nom);
        if (!memeClient) return false;
        const adresseAutre = normaliserTexte(t.adresseTravaux || t.adresseIntervention || "");
        return adresseAutre === adresseVisee;
      });
      if (jumelle) {
        setDoublonTache({ titre: nouveauTitre.trim(), client: client?.nom || "", date: nouvelleDate || "", adresse: adresseVisee });
        return;
      }
    }
    const nouvelle = {
      id: `tache-manuelle-${Date.now()}`,
      clientId: nouveauClientId || null,
      clientNom: client?.nom || "",
      // SECTEUR CCQ — hérité du projet choisi (Commercial par défaut).
      // C'est lui qui décidera du taux coûtant FIGÉ de chaque heure.
      secteur: nouveauSecteur === "residentiel" ? "residentiel" : "commercial",
      // Courriels du client transmis AVEC la tâche : le technicien peut
      // ainsi choisir à quelles adresses envoyer le bon de travail signé
      // (choix multiple) sans avoir accès au dossier client complet.
      clientCourriels: (client?.courriels || []).map((c) => ({ id: c.id, email: c.email, label: c.label, defaut: !!c.defaut })),
      // Téléphone du client transmis aussi (retour de tests 2026-08-17) :
      // le technicien sur place doit pouvoir appeler sans passer par le
      // bureau — bouton d'appel direct dans sa fiche de tâche.
      clientTelephone: client?.telephone || null,
      titre: nouveauTitre.trim(),
      typeTache: nouveauType,
      statut: "a_planifier",
      heures: nouvelleDureeHeures,
      jours: nouvelleDureeJours,
      sauterWeekend: nouveauSauterWeekend,
      description: nouvelleDescription.trim(),
      // 📎 Photos et plans joints par le bureau — le technicien les
      // ouvre sur son téléphone, sans rappeler pour « c'est où déjà ? ».
      piecesJointes: nouvellesPiecesJointes,
      // Projet lié — optionnel ("" = Aucun / Projet général, hors
      // rentabilité). Dès qu'un projet est choisi, cette tâche (et ses
      // heures une fois travaillée) sera prise en compte par
      // calculerRentabiliteProjet pour ce projet.
      projetId: nouveauProjetId || null,
      // Adresse des travaux — distincte de l'adresse de facturation du
      // client quand ce n'est pas la même. `null` = même adresse que la
      // facturation. Transmise à QuickBooks au moment de la facturation
      // (champ "Ship To" / adresse de livraison de la facture).
      // Une COURSE n'a pas de client : son adresse est tapée librement.
      adresseTravaux: nouveauType === "course" ? adresseCourseLibre.trim() || null : null,
      // ---- COMPTABILISATION DES HEURES ----
      // `nonFacturable` : rien ne partira en facturation à la fin.
      // `sansHeures`    : congé — aucun chronomètre, aucune heure.
      // `categorieHeures` décide où le temps atterrit dans le coût :
      //   "projet"      → coût direct du projet (comme un technicien)
      //   "administratif" → frais généraux de l'entreprise
      //   "divers"      → payé, mais ni projet ni administratif
      nonFacturable: estTypeNonFacturable(nouveauType),
      sansHeures: estTypeSansHeures(nouveauType),
      categorieHeures: estTypeSansHeures(nouveauType)
        ? "aucune"
        : nouveauType === "shop"
        ? (nouveauProjetId ? "projet" : "divers")
        : nouveauType === "divers" || nouveauType === "course"
        ? "divers"
        : estTypeAdministratif(nouveauType) && !tempsSurProjet
        ? "administratif"
        : "projet",
    };

    if (adresseTravauxDifferente) {
      if (nouvelleAdresseTravaux) {
        // Appartement/unité ajouté à l'adresse choisie (retour de tests).
        nouvelle.adresseTravaux = `${nouvelleAdresseTravaux.label}${nouvelleAdresseApp.trim() ? `, app. ${nouvelleAdresseApp.trim()}` : ""}`;
        // 🚪 L'unité voyage AUSSI à part : l'app technicien l'affiche en
        // évidence, et le lien Google Maps reste SANS elle (Maps se perd
        // avec « app. 4 » dans une recherche).
        if (nouvelleAdresseApp.trim()) nouvelle.adresseUnite = nouvelleAdresseApp.trim();
        // 📌 ADRESSE AU DOSSIER (retour de tests 2026-08-17) : avant,
        // l'adresse tapée partait avec la tâche seulement — jamais
        // offerte à la tâche suivante du même client. Anti-doublon :
        // une adresse déjà au dossier n'est pas dupliquée.
        if (enregistrerAdresseFiche && client) {
          const ligne1 = nouvelleAdresseTravaux.label;
          const dejaAuDossier = (client.adresses || []).some(
            (a) => (a.ligne1 || "").trim().toLowerCase() === ligne1.trim().toLowerCase()
          );
          if (!dejaAuDossier) {
            const entree = {
              id: `adr-${Date.now()}`,
              nom: "Chantier",
              ligne1,
              ...(nouvelleAdresseApp.trim() ? { appartement: nouvelleAdresseApp.trim() } : {}),
            };
            setClients((prev) => prev.map((x) => (x.id === client.id ? { ...x, adresses: [...(x.adresses || []), entree] } : x)));
            ajouterJournal(`📌 Adresse « ${ligne1} » enregistrée au dossier de ${client.nom}`);
          }
        }
      } else if (adresseTravauxId) {
        const a = client?.adresses?.find((x) => x.id === adresseTravauxId);
        if (a) {
          nouvelle.adresseTravaux = `${a.nom} — ${libelleAdresse(a)}`;
          if (a.appartement) nouvelle.adresseUnite = a.appartement;
        }
      }
    }

    // ADRESSE OÙ LE TECHNICIEN DOIT SE RENDRE — toujours remplie.
    // `adresseTravaux` reste à null quand c'est la même que la
    // facturation (c'est ce que QuickBooks attend), mais le technicien,
    // lui, a besoin d'une adresse dans TOUS les cas : son app n'a pas
    // accès au répertoire des clients pour aller la chercher.
    // Sans ce champ, il partait le matin sans savoir où aller.
    const adressePrincipale = client?.adresses?.[0];
    nouvelle.adresseIntervention =
      nouvelle.adresseTravaux ||
      (adressePrincipale ? `${adressePrincipale.nom} — ${adressePrincipale.ligne1}` : null);
    if (!nouvelle.adresseUnite && adressePrincipale?.appartement && !nouvelle.adresseTravaux) {
      nouvelle.adresseUnite = adressePrincipale.appartement;
    }

    // 📇 CONTACT SUR PLACE — attaché à la tâche. « Nouveau » est AUSSI
    // enregistré au carnet du client (réutilisable à la prochaine tâche).
    if (contactSurPlaceId === "nouveau" && contactNom.trim() && contactTel.trim()) {
      const fiche = { id: `ct-${Date.now()}`, nom: contactNom.trim(), role: contactRole.trim(), telephone: contactTel.trim() };
      nouvelle.contactSurPlace = { ...fiche };
      if (client) {
        setClients((prev) => prev.map((x) => (x.id === client.id ? { ...x, contacts: [...(x.contacts || []), fiche] } : x)));
        ajouterJournal(`📇 Contact « ${fiche.nom} » ajouté au carnet de ${client.nom}`);
      }
    } else if (contactSurPlaceId && contactSurPlaceId !== "nouveau" && client) {
      const c = (client.contacts || []).find((x) => x.id === contactSurPlaceId);
      if (c) nouvelle.contactSurPlace = { id: c.id, nom: c.nom, role: c.role || "", telephone: c.telephone || "" };
    }

    if (nouveauType === "devis" || nouveauType === "entretien_contrat") {
      // Ceinture-bretelles : un devis d'un AUTRE client ne s'attache
      // jamais (le sélecteur filtre déjà, ceci couvre tout état résiduel).
      const devis = devisListe.find(
        (d) => d.id === nouveauDevisId && (!nouveauClientId || !d.clientId || d.clientId === nouveauClientId)
      );
      // « Travaux avec devis » accepte AUSSI un numéro tapé à la main
      // (devis fait hors de l'app — retour de tests 2026-08-17). Le
      // contrat d'entretien, lui, exige un vrai contrat de la liste.
      if (!devis && nouveauType === "devis" && numeroDevisExistant.trim()) {
        nouvelle.devisNumero = numeroDevisExistant.trim();
      } else if (!devis) {
        return; // un devis/contrat doit être sélectionné pour ces types
      }
      if (devis) {
        nouvelle.devisNumero = devis.numero;
        // Texte du devis transmis sur la tâche, SANS les prix — ajouté à la
        // suite de la description saisie manuellement (si elle existe).
        // UN ITEM PAR LIGNE pour rester facile à lire.
        const texteDevis = devis.lignes.map((l) => `${l.quantite} × ${l.nom}`).join("\n");
        nouvelle.description = nouvelleDescription.trim() ? `${nouvelleDescription.trim()}\n${texteDevis}` : texteDevis;
        // Lignes du devis SANS AUCUN PRIX ni total — pour la fenêtre
        // « Voir le devis » de l'app technicien. Les montants ne quittent
        // jamais l'admin : seuls nom, quantité et unité sont transmis.
        nouvelle.devisLignes = devis.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, unite: l.unite || "" }));
        if (nouveauType === "entretien_contrat") {
          nouvelle.frequenceFacturationAnnuelle = nouvelleFrequence;
        }
      }
    }

    // TRANSITION QUICKBOOKS : un numéro de devis EXISTANT (hors app)
    // s'attache à n'importe quel type de tâche — il suivra jusqu'au bon
    // de travail et à la facturation. Le devis choisi dans l'app garde
    // priorité s'il y en a un.
    if (!nouvelle.devisNumero && numeroDevisExistant.trim()) {
      nouvelle.devisNumero = numeroDevisExistant.trim();
    }

    const projetLie = projetsDisponibles.find((p) => p.id === nouveauProjetId);
    const suffixeProjet = projetLie ? ` — lié au projet "${projetLie.nom}"` : "";
    const libelleType =
      nouveauType === "devis"
        ? `Travaux avec devis #${nouvelle.devisNumero}`
        : nouveauType === "entretien_contrat"
        ? `Entretien selon contrat #${nouvelle.devisNumero}, ${nouvelleFrequence} factures/an`
        : TYPES_TACHE.find((t) => t.id === nouveauType).label;

    // 👥 Techniciens EN PLUS cochés SANS date (2026-08-17) : mémorisés
    // sur la tâche avec leurs choix 💰/🤝 — ils s'assigneront d'un coup
    // dès qu'elle entrera à l'horaire (dépôt payé, glisser-déposer ou
    // édition). Avec date + technicien, le chemin direct plus bas les
    // assigne immédiatement, comme avant.
    const enPlusPrevus = nouveauxEmployesEnPlus.filter((id) => id && id !== nouveauEmployeId);
    if (!(nouvelleDate && nouveauEmployeId) && enPlusPrevus.length > 0) {
      nouvelle.equipePrevue = enPlusPrevus.map((id) => ({ employeId: id, facturable: facturablesEnPlus[id] }));
    }

    // 🗺️ ZONE DE L'APPEL — enregistrée AVEC OU SANS dépôt (2026-08-25) :
    // elle détermine le prix de base et la règle du temps inclus (zones
    // = temps chez le client seulement ; hors zone = transport compris).
    // Avant, elle ne s'écrivait que dans la branche dépôt : un appel
    // sans dépôt partait sans zone et la facturation devinait.
    if (nouveauType === "appel_service") {
      nouvelle.zoneAppel = zoneAppelChoix === "hors_zone" ? "hors_zone" : zoneAppelChoix || null;
    }

    // 🔧 Unités cochées : elles voyagent avec la tâche (donnees) — la
    // fiche du technicien les affiche et « Unité vérifiée » se
    // pré-remplit avec le VRAI numéro de série au lieu d'une saisie.
    if (unitesChoisies.length > 0) {
      const connues = unitesConnuesDuClient(nouveauClientId);
      nouvelle.unites = connues
        .filter((u) => unitesChoisies.includes(u.cle))
        .map((u) => ({ modele: u.modele, serie: u.serie, ...(u.emplacement ? { emplacement: u.emplacement } : {}) }));
    }

    // Dépôt préalable : la tâche porte l'info et le dépôt est créé
    // (24 h pour payer). Une tâche avec dépôt en attente NE PEUT PAS
    // être placée dans l'horaire — même si date/technicien sont saisis.
    const montantDepot = parseFloat(depotMontant) || 0;
    if (depotRequis && montantDepot > 0) {
      nouvelle.depotRequis = true;
      nouvelle.depotMontant = montantDepot;
      // Technicien / date souhaités par le client, MÉMORISÉS sur la tâche
      // sans la placer : dès que le dépôt est payé, un clic suffit pour
      // l'envoyer à l'horaire avec le bon technicien.
      nouvelle.technicienPrevu = nouveauEmployeId || null;
      nouvelle.datePrevue = nouvelleDate || null;
      nouvelle.heurePrevue = nouvelleHeureDebut || null;
      // Plus de « prospect » séparé : un client pas encore enregistré se
      // crée via « ➕ Nouveau client… » en haut de la liste Client — sa
      // fiche complète et validée sert au dépôt (et à QuickBooks).
      onCreerDepot?.(nouvelle.id, {
        montantHT: montantDepot,
        isProspect: false,
        prospect: null,
        // Facture de dépôt QuickBooks + courriel au client (point 9
        // des retours de tests) — traités par creerDepotPourTache.
        clientId: nouvelle.clientId || null,
        clientNom: client?.nom || nouvelle.clientNom || "",
        zone: nouvelle.zoneAppel === "hors_zone" ? "hors zone" : nouvelle.zoneAppel,
        joursLimite: 1,
        courriels: [...new Set([...depotEmails, ...(depotExtra.trim() ? [depotExtra.trim()] : [])])],
        // 📝 L'OBJET DE LA VISITE SUIT (2026-08-25, retour du
        // propriétaire) : la facture disait « Dépôt — appel de service »
        // sans jamais dire POURQUOI on vient. Titre + description de la
        // tâche voyagent jusqu'à la ligne de facture et au courriel.
        titre: nouvelle.titre || "",
        descriptionTravaux: nouvelle.description || "",
      });
      // 📌 COURRIEL AU DOSSIER (2026-08-24) : l'« autre adresse » tapée
      // pour la demande de dépôt s'ajoute à la fiche du client — sinon
      // il fallait la retaper à chaque tâche. Anti-doublon, et jamais
      // « par défaut » : les adresses déjà cochées gardent leur rang.
      const extraCourriel = depotExtra.trim().toLowerCase();
      if (depotExtraAuDossier && client && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraCourriel)) {
        const dejaAuDossier = (client.courriels || []).some(
          (c) => String(typeof c === "string" ? c : c?.email || "").trim().toLowerCase() === extraCourriel
        );
        if (!dejaAuDossier) {
          const entree = { id: `cc-${Date.now()}`, label: "", email: extraCourriel, defaut: false };
          setClients((prev) =>
            prev.map((x) => (x.id === client.id ? { ...x, courriels: [...(x.courriels || []), entree] } : x))
          );
          ajouterJournal(`📌 Courriel « ${extraCourriel} » ajouté au dossier de ${client.nom}`);
        }
      }
      setTachesAttente((prev) => [nouvelle, ...prev]);
      const nomPrevu = nouveauEmployeId ? employes.find((e) => e.id === nouveauEmployeId)?.nom : "";
      ajouterJournal(
        `📋 Tâche créée — ${libelleType} — EN ATTENTE DE DÉPÔT avant planification${nomPrevu ? ` (technicien prévu : ${nomPrevu})` : ""}`
      );
    } else if (nouvelleDate && nouveauEmployeId) {
      // Positionnement direct dans la grille si DATE + TECHNICIEN sont
      // tous les deux renseignés dès la création — sinon, comme avant,
      // la tâche atterrit dans "Tâches en attente".
      assigner(nouvelle, nouveauEmployeId, new Date(`${nouvelleDate}T00:00:00`), nouvelleHeureDebut);
      // MULTI-TECHNICIENS : chaque coché EN PLUS reçoit la MÊME tâche
      // partagée (id identique = heures additionnées, une facturation).
      const enPlus = nouveauxEmployesEnPlus.filter((id) => id && id !== nouveauEmployeId);
      // Chaque technicien EN PLUS part avec SON choix 💰/🤝 fait dans le
      // formulaire (obligatoire — le bouton Créer le garantit).
      enPlus.forEach((id) => assigner(nouvelle, id, new Date(`${nouvelleDate}T00:00:00`), nouvelleHeureDebut, facturablesEnPlus[id]));
      const nomsEquipe = [nouveauEmployeId, ...enPlus]
        .map((id) => employes.find((e) => e.id === id)?.nom)
        .filter(Boolean)
        .join(", ");
      ajouterJournal(
        `📋 Tâche créée et placée directement dans l'horaire — ${libelleType} (${client?.nom})${suffixeProjet}${enPlus.length > 0 ? ` — équipe : ${nomsEquipe}` : ""}`
      );
    } else {
      setTachesAttente((prev) => [nouvelle, ...prev]);
      ajouterJournal(`📋 Tâche créée — ${libelleType} (${client?.nom})${suffixeProjet}`);
    }

    setDepotMontant("");
    setZoneAppelChoix("");
    setDepotEmails([]);
    setDepotExtra("");
    setNouveauTitre("");
    setNouvellesPiecesJointes([]);
    setNouvelleDescription("");
    setNouveauDevisId("");
    setNouvelleFrequence(4);
    setNouveauProjetId("");
    setAdresseTravauxDifferente(false);
    setAdresseTravauxId("");
    setNouvelleAdresseTravaux(null);
    setNouvelleDate("");
    setNouvelleHeureDebut(HEURE_PAR_DEFAUT);
    // Le CLIENT repart vide lui aussi (bogue vécu : le dernier client
    // restait « collé » d'une création à l'autre — exactement l'erreur
    // que la règle « aucun client présélectionné » devait empêcher).
    setNouveauClientId("");
    setNouveauEmployeId("");
    setNouveauxEmployesEnPlus([]);
    setFacturablesEnPlus({});
    setNouveauSecteur("");
    setEnregistrerAdresseFiche(true);
    setContactSurPlaceId("");
    setContactNom("");
    setContactRole("");
    setContactTel("");
    setNumeroDevisExistant("");
    setVerifDevisQbo(null);
    setUnitesChoisies([]);
    setFiltreClientTache("");
    setFiltreAdresseTache("");
    setNouvelleAdresseApp("");
    setNouvelleDureeHeures(1);
    setNouvelleDureeJours(0);
    setNouveauSauterWeekend(false);
    setFormulaireOuvert(false);
  };

  // Fonction unique d'assignation — utilisée par la vue Jour (glisser-
  // déposer sur une heure précise) ET les vues Semaine/Mois (glisser-
  // déposer sur un jour). Respecte toujours tache.jours ET tache.heures,
  // peu importe la vue utilisée pour l'assignation — avant ce correctif,
  // seule assignerJours (Semaine/Mois) en tenait compte, donc assigner
  // une tâche multi-jours depuis la vue Jour (la vue par défaut) la
  // limitait silencieusement à une seule journée.
  // `facturablePredetermine` (facultatif) : true/false quand le choix
  // 💰/🤝 a DÉJÀ été fait (cases de la création de tâche) — la fenêtre
  // après coup ne s'ouvre alors pas. Absent : comportement habituel
  // (question posée dès qu'un 2e technicien rejoint la tâche).
  const assigner = (tacheParam, employeId, dateDepart, heureDepart, facturablePredetermine) => {
    if (lectureSeule) return;
    // 👥 ÉQUIPE PRÉVUE (cochée à la création SANS date, 2026-08-17) :
    // détachée de l'objet dès l'entrée — elle ne doit ni vivre dans les
    // cases de la grille ni voyager dans `donnees` (sinon chaque
    // déplacement futur ré-assignerait les coéquipiers). Elle sert UNE
    // fois, à la fin de cette assignation, pour placer le reste de
    // l'équipe d'un coup avec leurs choix 💰/🤝.
    const { equipePrevue, ...tache } = tacheParam || {};
    // Blocage strict : impossible d'assigner tant que le dépôt requis
    // n'est pas payé (ou si le délai de 24 h l'a annulé).
    if (depotBloque(tache.id)) {
      const d = depotDe(tache.id);
      ajouterJournal(
        `⛔ "${tache.titre || tache.clientNom}" non planifiable — dépôt ${d?.statut === "annule_delai" ? "annulé (délai de 24 h dépassé)" : "en attente de paiement"}`
      );
      return;
    }
    // L'employé doit exister dans la grille : sinon les cases seraient
    // écrites sur une ligne invisible (identifiant périmé) et la tâche
    // « disparaîtrait » sans explication ni envoi au technicien.
    const employe = employes.find((e) => e.id === employeId);
    if (!employe) {
      ajouterJournal(
        `⚠️ "${tache.titre || tache.clientNom}" non planifiée — technicien introuvable dans l'agenda. Réassigne-la par glisser-déposer sur la bonne ligne.`
      );
      return;
    }
    // Nombre de jours choisi sur la tâche (0 = pas de jour "réservé" à
    // l'avance ; 1 ou plus = un nombre de jours précis est sélectionné).
    const nbJoursSpecifie = tache.jours ?? 1;
    // Dès qu'un nombre de jours est sélectionné (>= 1), la tâche bloque
    // TOUTES les cases horaires de la journée pour l'employé assigné —
    // le champ "Heures / jour" ne sert alors qu'à titre indicatif. Le
    // blocage partiel (seulement N heures) ne s'applique que si jours
    // est explicitement mis à 0.
    const blocageJourComplet = nbJoursSpecifie >= 1;
    const joursCibles = calculerJoursCibles(dateDepart, nbJoursSpecifie, tache.sauterWeekend);
    const indexDepart = heureDepart ? Math.max(0, indexCaseHeure(heureDepart)) : 0;
    // ⏰ BOGUE DE MINUIT (corrigé 2026-08-17, vécu) : « journée complète »
    // partait de la case 00:00 — la barre commençait à minuit hors de
    // l'écran (la tâche semblait disparue) et le technicien recevait
    // « 00:00 » comme heure de début. Le blocage part maintenant de
    // l'heure CHOISIE jusqu'à la fin de la journée.
    // tache.heures peut valoir 0 (saisi explicitement) — on ne le
    // remplace plus par 1 via `|| 1`. Math.max(0, ...) plutôt que
    // Math.max(1, ...) : 0 case horaire bloquée est un résultat valide
    // si l'utilisateur a choisi 0 heure et 0 jour.
    const nbHeuresSpecifie = tache.heures ?? 1;
    const nbHeures = Math.max(0, Math.min(nbHeuresSpecifie, HEURES.length - indexDepart));
    const heuresCibles = blocageJourComplet ? HEURES.slice(indexDepart) : HEURES.slice(indexDepart, indexDepart + nbHeures);

    setPlanning((prev) => {
      const copie = { ...prev };
      joursCibles.forEach((d) => {
        heuresCibles.forEach((h) => {
          // Statut explicite "planifiee" dès qu'une tâche atterrit dans
          // l'horaire — que ce soit par glisser-déposer ou via la
          // modale d'édition rapide, elle n'est plus "à planifier".
          // AJOUT à la case (jamais d'écrasement) : une tâche déposée sur
          // une plage occupée s'empile au lieu de faire disparaître
          // l'autre.
          const cle = `${dateISO(d)}|${employeId}|${h}`;
          copie[cle] = [
            ...listeCellule(copie[cle]).filter((x) => x.id !== tache.id),
            { ...tache, employeId, statut: "planifiee" },
          ];
        });
      });
      return recalculerTransports(copie);
    });
    setTachesAttente((prev) => prev.filter((t) => t.id !== tache.id));
    const derniereDate = joursCibles[joursCibles.length - 1];
    const detailJours = joursCibles.length > 1 ? `du ${dateISO(dateDepart)} au ${dateISO(derniereDate)}${tache.sauterWeekend ? " (fins de semaine sautées)" : ""}` : `le ${dateISO(dateDepart)}`;
    const detailHeures = blocageJourComplet
      ? `journée bloquée à partir de ${heureDepart || heuresCibles[0] || "07:00"}`
      : nbHeures > 0
      ? `à partir de ${heuresCibles[0]} (${nbHeures} h/jour)`
      : "aucune case horaire bloquée (0 h)";
    ajouterJournal(
      `✅ "${tache.titre || tache.clientNom}" assignée à ${employe?.nom || employeId} ${detailJours} — ${detailHeures} — mise à jour envoyée à son app mobile`
    );
    // Écriture réelle dans Supabase (taches_assignees) : l'app technicien
    // du courriel correspondant la voit en direct. Jamais pour les
    // transports système (chaque app les génère localement).
    if (!tache.est_tache_systeme) {
      if (!employe?.courriel) {
        // Sans courriel dans le Répertoire, impossible de savoir quelle
        // app technicien doit recevoir la tâche — on le dit clairement.
        ajouterJournal(
          `⚠️ "${tache.titre || tache.clientNom}" reste dans l'agenda mais N'A PAS été envoyée à l'app technicien — ${employe?.nom || employeId} n'a pas de courriel dans le Répertoire`
        );
      } else {
        // 2e technicien et plus : le choix 💰/🤝 est OBLIGATOIRE. S'il a
        // déjà été fait à la création (cases à cocher), on l'applique
        // directement — sinon la question s'ouvre juste après
        // (l'assignation part facturable en attendant la réponse).
        const choixDejaFait = facturablePredetermine === true || facturablePredetermine === false;
        // « conserver » (audit 2026-08-17) : modification ou déplacement
        // d'une assignation EXISTANTE — on ne repose pas la question et
        // on n'écrit pas facturable (le choix déjà en base reste).
        const conserverChoix = facturablePredetermine === "conserver";
        if (autreTechnicienALaTache(tache.id, employeId) && !conserverChoix && !employe.estSousTraitant) {
          if (choixDejaFait) {
            onMajFacturable?.(tache.id, employe.courriel, facturablePredetermine);
            ajouterJournal(
              facturablePredetermine
                ? `💰 ${employe.nom} ajouté sur « ${tache.titre || tache.clientNom || "cette tâche"} » — FACTURABLE au client.`
                : `🤝 ${employe.nom} ajouté sur « ${tache.titre || tache.clientNom || "cette tâche"} » — NON facturable (aide interne) : ses heures ne seront pas comptées dans la facturation.`
            );
          } else {
            setChoixFacturable({ tacheId: tache.id, titre: tache.titre || tache.clientNom || "cette tâche", employe });
          }
        }
        assignerTacheSupabase(tache, employe, {
          // L'heure CHOISIE d'abord (quarts d'heure conservés) — jamais
          // la première case de la grille (c'était le bogue de minuit).
          heureDebut: heureDepart || heuresCibles[0] || null,
          date: dateISO(dateDepart),
          // Le choix fait à la création part avec l'assignation même ;
          // sans choix explicite, la clé est OMISE — la valeur en base
          // reste (nouvelle ligne : défaut true de la base).
          ...(choixDejaFait ? { facturable: facturablePredetermine } : {}),
        }).then(() => {
          // 🔔 Notification push au technicien — un bonus, jamais un
          // bloqueur : l'échec est silencieux (la tâche est déjà chez lui
          // par la synchronisation temps réel de toute façon). Jamais
          // pour un sous-traitant (pas d'application, pas d'abonnement).
          if (estCourrielST(employe.courriel)) return;
          envoyerPushA(
            employe.courriel,
            "📋 Nouvelle tâche",
            `${tache.titre || tache.clientNom || "Tâche"} — ${dateISO(dateDepart)}${heureDepart ? ` à ${heureDepart}` : ""}`
          );
        }).catch((e) => {
          // Échec d'écriture Supabase (hors-ligne, table/colonne absente,
          // droits) — visible dans le Journal au lieu d'un silence total.
          ajouterJournal(
            `⚠️ "${tache.titre || tache.clientNom}" reste dans l'agenda mais N'A PAS été envoyée à l'app technicien — erreur de synchronisation : ${e?.message || "connexion impossible"}`
          );
        });
      }
    }
    // 👥 Le reste de l'équipe prévue s'assigne maintenant, d'un coup —
    // chacun avec le choix 💰/🤝 fait à la création. L'objet transmis
    // est déjà nettoyé (pas d'equipePrevue) : aucune récursion infinie.
    if (Array.isArray(equipePrevue) && equipePrevue.length > 0) {
      equipePrevue
        .filter((m) => m.employeId && m.employeId !== employeId)
        .forEach((m) => assigner(tache, m.employeId, dateDepart, heureDepart, m.facturable));
    }
  };

  // Redimensionne une tâche déjà placée dans la grille (vue Jour) en
  // faisant glisser la poignée à droite de son bloc — change le
  // nombre d'heures qu'elle occupe pour CE technicien, ce jour-là,
  // sans toucher aux autres jours si la tâche est aussi assignée
  // ailleurs (contrats/multi-jours).
  const redimensionnerTache = (tache, employeId, jourCible, heureDebut, nouvellesHeures) => {
    if (lectureSeule) return;
    const indexDepart = Math.max(0, indexCaseHeure(heureDebut));
    const nbHeures = Math.max(1, Math.min(nouvellesHeures, HEURES.length - indexDepart));
    const heuresCibles = HEURES.slice(indexDepart, indexDepart + nbHeures);
    setPlanning((prev) => {
      const copie = { ...prev };
      // Retire d'abord TOUTES les anciennes cases horaires de cette
      // tâche pour ce technicien ce jour-là (elle pouvait occuper plus
      // ou moins d'heures qu'après le redimensionnement) — sans toucher
      // aux AUTRES tâches empilées sur les mêmes cases.
      HEURES.forEach((h) => {
        const cle = `${jourCible}|${employeId}|${h}`;
        const restants = listeCellule(copie[cle]).filter((x) => x.id !== tache.id);
        if (restants.length) copie[cle] = restants;
        else delete copie[cle];
      });
      heuresCibles.forEach((h) => {
        const cle = `${jourCible}|${employeId}|${h}`;
        copie[cle] = [
          ...listeCellule(copie[cle]),
          { ...tache, employeId, heures: nbHeures, jours: 0, statut: "planifiee" },
        ];
      });
      return recalculerTransports(copie);
    });
    const employe = employes.find((e) => e.id === employeId);
    // 💾 ENREGISTRÉ POUR VRAI (2026-08-22) : le redimensionnement ne
    // touchait QUE la grille de l'écran. Le Journal annonçait « mise à
    // jour envoyée à son app mobile » — c'était faux : le technicien
    // gardait l'ancienne durée, et la nouvelle disparaissait au premier
    // rechargement. Le choix « conserver » laisse intact le 💰/🤝 déjà
    // décidé pour cette assignation.
    if (employe?.courriel) {
      assignerTacheSupabase(
        { ...tache, heures: nbHeures, jours: 0 },
        employe,
        { date: jourCible, heureDebut }
      )
        .then(() => {
          ajouterJournal(
            `↔️ "${tache.titre || tache.clientNom}" redimensionnée à ${nbHeures} h (${employe.nom}, ${jourCible}) — mise à jour envoyée à son app mobile`
          );
        })
        .catch((e) => {
          ajouterJournal(
            `⚠️ "${tache.titre || tache.clientNom}" redimensionnée à l'écran mais N'A PAS été enregistrée — ${employe.nom} garde l'ancienne durée : ${e?.message || "connexion impossible"}`
          );
        });
    } else {
      ajouterJournal(
        `⚠️ "${tache.titre || tache.clientNom}" redimensionnée à ${nbHeures} h (${employe?.nom || employeId}, ${jourCible}) — PAS envoyée à l'app mobile : aucun courriel au Répertoire`
      );
    }
  };

  // ------------------------------------------------------------
  // ANNULATION DÉFINITIVE D'UNE TÂCHE (règles validées avec le
  // propriétaire, 2026-08-07) :
  //   • Admins : toujours, avec avertissements si dépôt/pièce en jeu.
  //   • Répartiteur : SEULEMENT si aucun dépôt ni pièce en commande
  //     n'est lié — sinon réservé aux administrateurs.
  //   • Chargé de projet / lecture seule : aucun bouton.
  //   • App technicien : la fonction n'y existe pas, point.
  //   • Travail déjà exécuté (bon envoyé) : annulation refusée — ça se
  //     facture ou se crédite, ça ne disparaît pas.
  // Double vérification à l'écran (raison obligatoire + confirmation
  // rouge) — voir ModalEditionTache. Trace complète au journal.
  // ------------------------------------------------------------
  const estAdminAgenda = role === "Admin principal" || role === "Admin régulier";
  const estRepartiteurAgenda = role === "Répartiteur";
  // Pièce encore en jeu pour cette tâche (retour bloqué ou pose à
  // venir) — une pièce annulée ne compte plus.
  const pieceLieeATache = (tacheId) =>
    (pieces || []).find((p) => (p.tacheRetourId === tacheId || p.tacheOrigineId === tacheId) && p.statut !== "annulee");
  const contexteAnnulation = (tache) => {
    if (!tache) return { permise: false, bloqueeRaison: null, avertissements: [] };
    const depot = depotDe(tache.id);
    const piece = pieceLieeATache(tache.id);
    const avertissements = [];
    if (depot) {
      const paye = depot.statut === "paye" || depot.statut === "paye_manuel";
      avertissements.push(
        `💰 Un dépôt ${paye ? "PAYÉ" : "non payé"} est rattaché à cette tâche — décide de son sort (remboursement ou conservé, selon ta politique) en annulant.`
      );
    }
    if (piece) {
      avertissements.push(`🔧 La pièce « ${piece.pieceRequise} » est liée à cette tâche — pense à l'annuler ou la réaffecter dans l'onglet Pièces.`);
    }
    const sensible = !!depot || !!piece;
    const permise = estAdminAgenda || (estRepartiteurAgenda && !sensible);
    const bloqueeRaison =
      !permise && estRepartiteurAgenda
        ? "🔒 Un dépôt ou une pièce en commande est lié à cette tâche — son annulation est réservée aux administrateurs."
        : null;
    return { permise, bloqueeRaison, avertissements };
  };
  const peutOuvrirAnnulation = !lectureSeule && (estAdminAgenda || estRepartiteurAgenda);
  const annulerTacheDefinitivement = (tache, raison) => {
    if (!peutOuvrirAnnulation || !contexteAnnulation(tache).permise) {
      ajouterJournal("⛔ Tentative d'annulation de tâche refusée — rôle non autorisé");
      return;
    }
    // 1. Prévenir l'app mobile de chaque technicien concerné.
    techniciensPourTache(planning, tache.id, employes).forEach((t) => {
      const emp = employes.find((e) => e.id === t.employeId);
      retirerTacheSupabase(tache.id, emp?.courriel).catch(() => {});
    });
    // 2. Retirer TOUTES ses cases de l'horaire (tous techniciens, tous
    //    jours) et recalculer les transports.
    setPlanning((prev) => {
      const copie = { ...prev };
      Object.keys(copie).forEach((cle) => {
        const restants = listeCellule(copie[cle]).filter((x) => x.id !== tache.id);
        if (restants.length) copie[cle] = restants;
        else delete copie[cle];
      });
      return recalculerTransports(copie);
    });
    // 3. Retirer de la file d'attente — la persistance Supabase supprime
    //    la ligne automatiquement (voir l'effet de synchronisation).
    setTachesAttente((prev) => prev.filter((t) => t.id !== tache.id));
    // 4. La trace : qui (rôle), quoi, pourquoi — et les suites à donner.
    const depot = depotDe(tache.id);
    const piece = pieceLieeATache(tache.id);
    ajouterJournal(
      `🗑️ Tâche "${tache.titre || tache.clientNom}" ANNULÉE définitivement (${role}) — raison : ${raison}` +
        (depot ? " · ⚠️ un dépôt y était rattaché : à traiter" : "") +
        (piece ? ` · ⚠️ pièce liée « ${piece.pieceRequise} » : voir l'onglet Pièces` : "")
    );
  };

  // Modifie une tâche DÉJÀ planifiée, cliquée directement dans le
  // calendrier — retire d'abord toutes ses anciennes cases horaires
  // (chez l'ancien technicien, sur tous les jours qu'elle occupait si
  // elle était multi-jours), puis la replace via assigner() avec les
  // nouvelles valeurs. Fonctionne aussi pour un simple changement de
  // détail/description sans déplacer la date ou l'heure.
  // 🏗️/📄 LE PASSÉ SUIT LE NOUVEAU RATTACHEMENT (2026-08-22).
  // Les heures déjà pointées et le bon de travail déjà créé gardent une
  // COPIE du projet/devis prise à leur enregistrement. Sans cette
  // reprise, rattacher une tâche déjà travaillée laisserait la
  // rentabilité du projet fausse — en silence. Appelé UNE fois par
  // modification (le rattachement appartient à la tâche, pas à la
  // personne), et jamais bloquant : un échec réseau est dit au journal.
  const appliquerRattachements = async (tache, champs) => {
    const nomProjet = champs.projetId
      ? (projets || []).find((p) => p.id === champs.projetId)?.nom || "projet"
      : null;
    try {
      if (champs.projetId !== undefined) {
        const apercu = await heuresRattachablesA(tache.id);
        const n = await rattacherProjetAuxHeures(tache.id, champs.projetId);
        if (n > 0) {
          ajouterJournal(
            champs.projetId
              ? `🏗️ « ${tache.titre || tache.clientNom} » rattachée au projet « ${nomProjet} » — ${n} entrée${n > 1 ? "s" : ""} d'heures (${apercu.heures.toFixed(2)} h) ajoutée${n > 1 ? "s" : ""} à ses coûts réels.`
              : `🏗️ « ${tache.titre || tache.clientNom} » détachée de son projet — ${n} entrée${n > 1 ? "s" : ""} d'heures (${apercu.heures.toFixed(2)} h) retirée${n > 1 ? "s" : ""} des coûts du projet.`
          );
        } else {
          ajouterJournal(
            champs.projetId
              ? `🏗️ « ${tache.titre || tache.clientNom} » rattachée au projet « ${nomProjet} » (aucune heure pointée pour l'instant).`
              : `🏗️ « ${tache.titre || tache.clientNom} » détachée de son projet.`
          );
        }
      }
      if (champs.devisNumero !== undefined) {
        ajouterJournal(
          champs.devisNumero
            ? `📄 Devis #${champs.devisNumero} rattaché à « ${tache.titre || tache.clientNom} » — il suivra jusqu'à la facturation.`
            : `📄 Devis retiré de « ${tache.titre || tache.clientNom} ».`
        );
      }
      // Le bon de travail déjà créé (s'il existe) suit les deux.
      await rattacherAuBon(tache.id, {
        ...(champs.projetId !== undefined ? { projetId: champs.projetId } : {}),
        ...(champs.devisNumero !== undefined ? { devisNumero: champs.devisNumero } : {}),
      });
      // Pas de rechargement à la main : `travaux_effectues` et
      // `bons_travail` sont écoutés en Realtime — les coûts du projet et
      // la facturation se rafraîchissent d'eux-mêmes, ici comme sur les
      // autres postes ouverts.
    } catch (e) {
      ajouterJournal(
        `⚠️ Rattachement de « ${tache.titre || tache.clientNom} » NON enregistré (${e?.message || "connexion impossible"}) — réessaie : les heures déjà pointées n'ont pas suivi.`
      );
    }
  };

  // 🏗️ Rattache une tâche à un projet SANS toucher au reste (durée,
  // date, technicien) — utilisé par « Créer un projet à partir de cette
  // tâche ». Passer par modifierTachePlanifiee effacerait les champs
  // qu'on ne lui transmet pas ; ici on ne change QUE le projet.
  const rattacherTacheAuProjet = (tache, projetId) => {
    setPlanning((prev) => {
      const copie = { ...prev };
      Object.keys(copie).forEach((cle) => {
        const liste = listeCellule(copie[cle]);
        if (!liste.some((x) => x.id === tache.id)) return;
        copie[cle] = liste.map((x) => (x.id === tache.id ? { ...x, projetId } : x));
      });
      return copie;
    });
    // Chaque technicien de la tâche reçoit la fiche mise à jour.
    (techniciensPourTache(planning, tache.id, employes) || []).forEach((t) => {
      const emp = employes.find((e) => e.id === t.employeId);
      if (!emp?.courriel) return;
      majDonneesAssignation(tache.id, emp.courriel, { projetId }).catch(() => {});
    });
    appliquerRattachements(tache, { projetId });
  };

  const modifierTachePlanifiee = (tache, ancienEmployeId, champs) => {
    if (lectureSeule) return;
    // Synchro Supabase : si la tâche change de technicien (ou retourne en
    // attente), on retire l'ancienne assignation. Si c'est le même
    // technicien, l'upsert de assigner() écrasera simplement sa ligne.
    if (champs.employeId !== ancienEmployeId) {
      const ancienEmploye = employes.find((e) => e.id === ancienEmployeId);
      retirerTacheSupabase(tache.id, ancienEmploye?.courriel).catch(() => {});
    }
    setPlanning((prev) => {
      const copie = { ...prev };
      Object.keys(copie).forEach((cle) => {
        const [, empCle] = cle.split("|");
        if (empCle !== ancienEmployeId) return;
        const restants = listeCellule(copie[cle]).filter((x) => x.id !== tache.id);
        if (restants.length) copie[cle] = restants;
        else delete copie[cle];
      });
      return recalculerTransports(copie);
    });
    const tacheMiseAJour = {
      ...tache,
      heures: champs.heures,
      jours: champs.jours,
      sauterWeekend: champs.sauterWeekend,
      description: champs.description,
      // Contact sur place : suit la modification (null = retiré) ; si la
      // modale ne l'a pas touché (undefined), l'existant est conservé.
      contactSurPlace: champs.contactSurPlace !== undefined ? champs.contactSurPlace : tache.contactSurPlace || null,
      // 🏗️/📄 Rattachements après coup (2026-08-22) — clés absentes =
      // rien à changer (voir la modale : elles ne partent que modifiées).
      ...(champs.projetId !== undefined ? { projetId: champs.projetId } : {}),
      ...(champs.devisNumero !== undefined ? { devisNumero: champs.devisNumero } : {}),
    };
    if (champs.employeId) {
      // « conserver » : une modification/un déplacement ne repose jamais
      // la question 💰/🤝 et n'écrase pas le choix déjà enregistré.
      assigner(tacheMiseAJour, champs.employeId, new Date(`${champs.date}T00:00:00`), champs.heureDebut, "conserver");
    } else {
      // Technicien retiré — la tâche retourne dans "Tâches en attente"
      // plutôt que de disparaître.
      setTachesAttente((prev) => [tacheMiseAJour, ...prev]);
      ajouterJournal(`↩️ "${tache.titre || tache.clientNom}" retirée de l'horaire — retour dans les tâches en attente`);
    }
  };

  // Enregistrement depuis la modale d'édition rapide (clic sur une
  // carte "en attente"). Met toujours à jour la durée ; assigne EN
  // PLUS dans l'horaire si un technicien a été choisi — même chemin
  // que le glisser-déposer (assigner), donc même comportement garanti
  // (statut "planifiee", retrait de la liste d'attente, journal).
  // En prod : `setTachesAttente`/`setPlanning` seraient remplacés par
  // les appels Supabase correspondants (voir lib/supabase/taches.js —
  // creerTache/assignerTache), avec une synchronisation Realtime pour
  // que l'app technicien voie la tâche apparaître instantanément.
  const enregistrerEditionRapide = (tacheId, { heures, jours, sauterWeekend, employeId, employeIds, date, heureDebut, description, contactSurPlace }) => {
    if (lectureSeule) return;
    const tache = tachesAttente.find((t) => t.id === tacheId);
    if (!tache) return;
    const tacheMiseAJour = {
      ...tache,
      heures,
      jours,
      sauterWeekend,
      description: description ?? tache.description,
      contactSurPlace: contactSurPlace !== undefined ? contactSurPlace : tache.contactSurPlace || null,
    };
    // Assignation multiple : tous les techniciens cochés reçoivent la
    // tâche (même date/heure/durée) — chacun reste ensuite ajustable
    // individuellement en cliquant son bloc dans la grille.
    const cibles = employeIds && employeIds.length > 0 ? employeIds : employeId ? [employeId] : [];
    if (cibles.length > 0) {
      // assigner() retire déjà la tâche de tachesAttente et l'écrit
      // dans planning — on lui passe la version à jour (nouvelle
      // durée) pour que l'assignation reflète les derniers champs
      // édités, pas l'ancienne durée.
      cibles.forEach((id) => assigner(tacheMiseAJour, id, new Date(`${date}T00:00:00`), heureDebut));
    } else {
      setTachesAttente((prev) => prev.map((t) => (t.id === tacheId ? tacheMiseAJour : t)));
      ajouterJournal(`✏️ Durée mise à jour pour "${tache.titre || tache.clientNom}" (${heures} h/jour, ${jours} jour${jours > 1 ? "s" : ""})`);
    }
    setTacheEnEditionId(null);
  };

  // 🖱️ DÉPLACER UNE TÂCHE DÉJÀ PLACÉE (demande du propriétaire,
  // 2026-08-17) : attraper un bloc et le déposer sur une autre heure,
  // un autre technicien ou un autre jour — sans ouvrir la modale. En
  // dessous : EXACTEMENT le même chemin que « Enregistrer les
  // modifications » (modifierTachePlanifiee), donc mêmes garanties
  // (Supabase, temps réel, journal). Durée, jours, description et
  // contact voyagent intacts.
  const deplacerTache = (tacheId, ancienEmployeId, employeCibleId, dateCible, heureCible) => {
    if (lectureSeule) return;
    // Retrouver l'objet tâche dans la grille (sa version la plus à jour)
    // ET sa première case horaire actuelle : un dépôt sur un JOUR
    // (vue Semaine/Mois, heureCible null) conserve l'heure existante —
    // avant, elle retombait à 07:00 sans avertir (audit 2026-08-17).
    let tache = null;
    let heureActuelle = null;
    Object.keys(planning).forEach((cle) => {
      const [, empCle, hCle] = cle.split("|");
      if (empCle !== String(ancienEmployeId)) return;
      const t = listeCellule(planning[cle]).find((x) => x.id === tacheId);
      if (!t) return;
      if (!tache) tache = t;
      if (heureActuelle === null || hCle < heureActuelle) heureActuelle = hCle;
    });
    if (!tache || tache.est_tache_systeme) return;
    // ON NE DÉPLACE PAS LE PASSÉ : des heures déjà pointées sur cette
    // tâche par ce technicien = déplacement refusé, expliqué au journal.
    const ancienEmploye = employes.find((x) => x.id === ancienEmployeId);
    if (travailTermine(tache, ancienEmploye)) {
      ajouterJournal(
        `⛔ « ${tache.titre || tache.clientNom} » n'a pas été déplacée — ${ancienEmploye?.nom || "le technicien"} y a déjà des heures enregistrées. Passe par la fiche de la tâche au besoin.`
      );
      return;
    }
    const dateStr = typeof dateCible === "string" ? dateCible : dateISO(dateCible);
    modifierTachePlanifiee(tache, ancienEmployeId, {
      heures: tache.heures,
      jours: tache.jours,
      sauterWeekend: tache.sauterWeekend,
      description: tache.description,
      employeId: employeCibleId,
      date: dateStr,
      // Dépôt sur une case horaire = nouvelle heure ; dépôt sur un jour
      // = l'heure ACTUELLE suit la tâche.
      heureDebut: heureCible || heureActuelle || HEURE_PAR_DEFAUT,
    });
  };

  // 🏢 FERMER LA TÂCHE POUR UN TECHNICIEN QUI A OUBLIÉ (2026-08-17).
  // L'admin déclare début/fin depuis la fiche de la tâche : la ligne
  // d'heures s'écrit au nom du TECHNICIEN (taux figé de son secteur),
  // sa carte se ferme sur son téléphone (marque fermetureBureau, même
  // canal temps réel que la fermeture d'équipe), et la facturation est
  // créée SEULEMENT si demandé (bon sans signature — alerte au bureau).
  // Jamais offert quand des heures existent déjà : on ne réécrit pas
  // ce que le technicien a pointé.
  const fermerTachePourTechnicien = async (tache, employe, jour, { debutHM, finHM, creerBon }) => {
    if (lectureSeule) return;
    const nbJours = Math.max(1, Number(tache.jours) || 1);
    // Chantier multi-jours : les heures se rangent sous la clé de LA
    // journée ouverte (id::AAAA-MM-JJ) — même règle que le téléphone.
    const cleHeures = nbJours > 1 ? `${tache.id}::${jour}` : tache.id;
    const debutTs = new Date(`${jour}T${debutHM}:00`).getTime();
    const finTs = new Date(`${jour}T${finHM}:00`).getTime();
    const heures = Math.max(0, (finTs - debutTs) / 3600000);
    try {
      await enregistrerTravailPourEmploye(
        {
          tacheId: cleHeures,
          secteur: tache.secteur || "commercial",
          titre: tache.titre || tache.clientNom || undefined,
          clientNom: tache.clientNom || null,
          date: jour,
          heures,
          estTransport: false,
          categorieHeures: tache.categorieHeures || "projet",
          kilometres: null,
          projetId: tache.projetId || null,
          noteTerrain: "",
          noteInterne: `🏢 FERMÉE PAR LE BUREAU — heures déclarées par l'administration (${debutHM} → ${finHM}) : le technicien avait oublié de fermer.`,
          debutReel: debutTs,
          finReelle: finTs,
          photosAvant: [],
          photosApres: [],
        },
        employe
      );
      // Avis au téléphone du technicien (sa carte se ferme) — meilleur
      // effort : un échec ici ne bloque pas la paie déjà écrite.
      majDonneesAssignation(tache.id, employe.courriel, {
        fermetureBureau: { par: "le bureau", a: new Date().toISOString(), debut: debutHM, fin: finHM, jour },
      }).catch(() => {});
      if (creerBon && !tache.nonFacturable) {
        await enregistrerBonTravailBureau(
          {
            tacheId: tache.id,
            titre: tache.titre || tache.clientNom || "Travail complété",
            clientNom: tache.clientNom || null,
            description: `${tache.description || ""}${tache.description ? "\n" : ""}(Fermée par le bureau — sans signature ni photos.)`,
            date: jour,
            heures,
            typeTache: tache.typeTache || null,
            secteur: tache.secteur || "commercial",
            devisNumero: tache.devisNumero || null,
            adresseTravaux: tache.adresseTravaux || tache.adresseIntervention || null,
            projetId: tache.projetId || null,
            photosAvant: [],
            photosApres: [],
            courrielsEnvoi: [],
            signeParNom: "",
            signeParCollegue: false,
            clientAbsent: false,
            unites: [],
            pieceACommander: false,
            pieceRequise: null,
          },
          employe
        );
      }
      ajouterJournal(
        `🏢 « ${tache.titre || tache.clientNom} » fermée par le bureau pour ${employe.nom || employe.courriel} — ${debutHM} → ${finHM} (${heures.toFixed(2)} h)${creerBon && !tache.nonFacturable ? " — demande de facturation créée (bon NON signé)" : " — paie seulement, rien en facturation"}.`
      );
    } catch (e) {
      ajouterJournal(
        `⚠️ Fermeture par le bureau ÉCHOUÉE pour « ${tache.titre || tache.clientNom} » (${employe.nom || employe.courriel}) — ${e?.message || "connexion impossible"}. Réessaie.`
      );
    }
  };

  const onDropHeure = (e, employeId, heure) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const objet = JSON.parse(data);
    // Bloc déjà placé qu'on déplace — sinon, tâche en attente qu'on assigne.
    if (objet?.deplacement) {
      deplacerTache(objet.tacheId, objet.employeId, employeId, dateISO(jourAffiche), heure);
      return;
    }
    assigner(objet, employeId, jourAffiche, heure);
  };

  const onDropJour = (e, employeId, date) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const objet = JSON.parse(data);
    if (objet?.deplacement) {
      // heure null = « garde l'heure actuelle de la tâche ».
      deplacerTache(objet.tacheId, objet.employeId, employeId, date, null);
      return;
    }
    assigner(objet, employeId, date, HEURE_PAR_DEFAUT);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={reculer} aria-label="Précédent" className="rounded-lg border border-slate-200 p-1.5"><ChevronLeft size={16} /></button>
          {/* Largeur FIXE + texte centré : la longueur de la date varie
              (« mardi 28 juillet » vs « mercredi 24 septembre ») et sans
              largeur fixe, les flèches se déplaçaient à chaque clic. */}
          <h2 className="min-w-[230px] text-center text-sm font-extrabold capitalize text-slate-800">{vue === "mois" ? moisLabel : jourLabel}</h2>
          <button onClick={avancer} aria-label="Suivant" className="rounded-lg border border-slate-200 p-1.5"><ChevronRight size={16} /></button>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVue(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${vue === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* 📱 LISTE ou GRILLE — TÉLÉPHONE SEULEMENT (2026-08-22).
            Avant, la largeur de l'écran décidait toute seule : sous
            768 px, la grille disparaissait, point. Le choix appartient
            maintenant à la personne. Au bureau l'interrupteur ne
            s'affiche pas — la grille y est toujours le bon choix, et
            c'est un bouton de moins à l'écran. */}
        <div className="flex rounded-lg border border-slate-200 p-0.5 md:hidden">
          {[["liste", "📋 Liste"], ["grille", "▦ Grille"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => choisirModeAgenda(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${modeAgendaMobile === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {TYPES_TACHE.map((t) => (
          <div key={t.id} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${COULEUR_TYPE_TACHE[t.id].pastille}`} />
            {t.label}
          </div>
        ))}
      </div>

      {vue === "jour" && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto">
          {semaine.map((d) => (
            <button
              key={dateISO(d)}
              onClick={() => setJourAffiche(d)}
              className={`flex min-w-[52px] flex-col items-center rounded-xl px-2 py-1.5 text-xs font-bold ${
                dateISO(d) === jourKey ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              <span>{d.toLocaleDateString("fr-CA", { weekday: "short" })}</span>
              <span className="tabular-nums">{d.getDate()}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* PANNEAU TÂCHES EN ATTENTE */}
        <div className="lg:w-80 lg:shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Tâches en attente ({tachesAttente.length})
            </h3>
            {!lectureSeule && (
              <Button onClick={() => { setFormulaireOuvert((v) => !v); setEtapeTypeTache(false); }} className="min-h-0 gap-1 px-2 py-1 text-[11px]">
                <Plus size={12} /> Nouvelle tâche
              </Button>
            )}
          </div>

          {/* ONGLETS : prêtes / dépôt impayé / pièce en commande. */}
          <div className="mb-2 flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setOngletAttente("pretes")}
              className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold ${
                ongletAttente === "pretes" ? "bg-[#131B2E] text-white" : "text-slate-500"
              }`}
            >
              ✅ Prêtes
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${ongletAttente === "pretes" ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
                {tachesPretes.length}
              </span>
            </button>
            <button
              onClick={() => setOngletAttente("bloquees")}
              className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold ${
                ongletAttente === "bloquees" ? "bg-amber-600 text-white" : "text-slate-500"
              }`}
            >
              🔒 Dépôt
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${ongletAttente === "bloquees" ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
                {tachesBloquees.length}
              </span>
            </button>
            <button
              onClick={() => setOngletAttente("pieces")}
              className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold ${
                ongletAttente === "pieces" ? "bg-sky-600 text-white" : piecesEnRetard > 0 ? "text-red-600" : "text-slate-500"
              }`}
            >
              🔧 Pièces
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${
                  ongletAttente === "pieces"
                    ? "bg-white/25"
                    : piecesEnRetard > 0
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {tachesPiece.length}
              </span>
            </button>
          </div>

          {lectureSeule && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
              <Lock size={12} className="shrink-0" /> Consultation seulement — ton rôle ne permet pas de modifier l'horaire.
            </p>
          )}

          {formulaireOuvert && !lectureSeule && (
            /* FENÊTRE SPACIEUSE (2026-08-18) : le formulaire sort de la
               colonne étroite — grande fenêtre centrée (2 colonnes sur
               ordinateur, plein écran sur téléphone), en-tête et pied
               COLLANTS (le bouton Créer toujours visible). Aucune
               logique ne change : mêmes champs, mêmes règles. */
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6"
              onClick={() => setFormulaireOuvert(false)}
            >
              <div
                className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white md:max-h-[88vh] md:max-w-3xl md:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    ➕ Nouvelle tâche
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{TYPE_INFO(nouveauType)?.label}</span>
                  </h3>
                  <button onClick={() => setFormulaireOuvert(false)} aria-label="Fermer">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4 md:columns-2 md:gap-x-6 md:space-y-0 md:[&>*]:mb-3 md:[&>*]:break-inside-avoid">
              <>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Type de tâche</label>
                <select
                  value={nouveauType}
                  onChange={(e) => setNouveauType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  {TYPES_TACHE.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  {TYPES_TACHE.find((t) => t.id === nouveauType)?.description}
                </p>

                {/* TEMPS SUR LE PROJET — seulement pour les visites.
                    Une visite de soumission qu'on ne remporte pas est un
                    coût de vente ; une visite sur un chantier en cours
                    appartient à ce projet. Toi seul le sais. */}
                {estTypeAdministratif(nouveauType) && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <input
                      type="checkbox"
                      checked={tempsSurProjet}
                      onChange={(e) => setTempsSurProjet(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
                    />
                    <span className="text-[10px] leading-snug text-slate-600">
                      <span className="font-bold text-slate-800">Temps comptabilisé sur le projet</span>
                      <br />
                      {tempsSurProjet
                        ? "Ces heures entreront dans le coût du projet choisi."
                        : "Décoché : les heures vont aux frais ADMINISTRATIFS de l'entreprise, pas au coût d'un projet."}
                    </span>
                  </label>
                )}

                {nouveauType === "conge" && (
                  <p className="mt-2 rounded-lg bg-zinc-100 px-2 py-1.5 text-[10px] leading-snug text-zinc-600">
                    🚫 Aucun chronomètre, aucune heure. La journée est simplement bloquée à l&apos;agenda pour qu&apos;on
                    n&apos;y place pas de travail.
                  </p>
                )}
              </div>
              {/* CLIENT EN DEUXIÈME (demande du propriétaire, 2026-08-17) :
                  c'est lui qui décide de tout le reste — devis offerts,
                  contact sur place, adresses enregistrées, courriels du
                  dépôt. On le choisit donc juste après le type. */}
              {!estTypeSansClient(nouveauType) && (
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Client</label>
                {/* ➕ TOUJOURS PREMIER À L'ÉCRAN (demande du propriétaire,
                    2026-08-17) : créer un client est l'action la plus
                    fréquente à rater — elle ne se cache plus dans un menu. */}
                <button
                  type="button"
                  onClick={() => setModalNouveauClientTache(true)}
                  className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-600 active:scale-[0.99]"
                >
                  ➕ Nouveau client…
                </button>
                {/* SUGGESTIONS VISIBLES : la liste rétrécit à chaque
                    lettre, sous les yeux — plus de menu à ouvrir. Les
                    noms qui commencent pareil se départagent à mesure. */}
                <input
                  value={filtreClientTache}
                  onChange={(e) => setFiltreClientTache(e.target.value)}
                  onFocus={() => setListeClientsTacheOuverte(true)}
                  onBlur={() => setTimeout(() => setListeClientsTacheOuverte(false), 200)}
                  placeholder="🔍 Clique pour la liste, ou tape le nom…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                />
                {(listeClientsTacheOuverte || filtreClientTache.trim() !== "") && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {clients
                      .filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientTache.trim().toLowerCase()))
                      .sort((a, b) => nomAffichageClient(a).localeCompare(nomAffichageClient(b), "fr"))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { choisirClientTache(c.id); setFiltreClientTache(""); setListeClientsTacheOuverte(false); }}
                          className="block w-full border-b border-slate-100 px-2 py-2 text-left text-xs font-semibold text-slate-700 last:border-0 active:bg-orange-50"
                        >
                          {/* truncate : un nom accidentellement TRÈS long
                              (texte collé — vécu 2026-08-17) reste sur
                              UNE ligne au lieu d'inonder la liste. */}
                          <span className="block truncate">{nomAffichageClient(c)}</span>
                        </button>
                      ))}
                    {clients.filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientTache.trim().toLowerCase())).length === 0 && (
                      <p className="px-2 py-2 text-[11px] text-slate-400">
                        Aucun client trouvé — crée-le avec « ➕ Nouveau client… » juste au-dessus.
                      </p>
                    )}
                  </div>
                )}
                {(() => {
                  const c = clients.find((x) => x.id === nouveauClientId);
                  return c ? (
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#FF6A13] bg-orange-50 px-2 py-1.5">
                      <span className="min-w-0 truncate text-xs font-bold text-slate-800">{nomAffichageClient(c)}</span>
                      <button
                        type="button"
                        onClick={() => setClientEnEditionAgenda(c.id)}
                        title="Modifier la fiche du client (téléphone, entreprise, contacts...)"
                        className="shrink-0 text-slate-400 hover:text-slate-700"
                        aria-label="Modifier la fiche du client"
                      >
                        <Pencil size={12} />
                      </button>
                      <button type="button" onClick={() => choisirClientTache("")} className="shrink-0 text-[10px] font-bold text-slate-400 underline underline-offset-2">
                        changer
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] font-bold text-amber-600">— Choisis le client (tape son nom, ou crée-le avec ➕) —</p>
                  );
                })()}
              </div>
              )}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Titre / description courte</label>
                <input
                  value={nouveauTitre}
                  onChange={(e) => setNouveauTitre(e.target.value)}
                  placeholder="Ex: Appel de service — bruit anormal"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                />
              </div>
              {nouveauType === "course" && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse de la course (facultatif)</label>
                  {/* La MÊME autocomplétion Google que partout ailleurs —
                      une adresse proprement choisie fait un vrai lien de
                      navigation sur le téléphone du technicien. */}
                  {adresseCourseLibre ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5">
                      <span className="min-w-0 truncate text-xs font-semibold text-slate-700">📍 {adresseCourseLibre}</span>
                      <button
                        type="button"
                        onClick={() => setAdresseCourseLibre("")}
                        className="shrink-0 text-[10px] font-bold text-slate-400 underline underline-offset-2"
                      >
                        changer
                      </button>
                    </div>
                  ) : (
                    <AutocompleteAdresse onSelection={(place) => setAdresseCourseLibre(place.label)} />
                  )}
                </div>
              )}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                  Description des travaux <span className="font-normal text-orange-600">(visible au technicien)</span>
                </label>
                <textarea
                  value={nouvelleDescription}
                  onChange={(e) => setNouvelleDescription(e.target.value)}
                  rows={2}
                  placeholder="Ce qu'il y a à faire sur cette tâche, instructions particulières..."
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                />
                {(nouveauType === "devis" || nouveauType === "entretien_contrat") && (
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    Le contenu du devis (quantités × items, sans les prix) s'ajoutera automatiquement à cette description.
                  </p>
                )}
              </div>

              {/* 📎 PHOTOS ET PLANS — le technicien les aura dans sa poche. */}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                  📎 Photos et plans <span className="font-normal text-orange-600">(visibles au technicien)</span>
                </label>
                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-[11px] font-semibold ${televersementJointe ? "border-slate-200 text-slate-300" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                  {televersementJointe ? "Téléversement…" : "➕ Ajouter des images ou des PDF"}
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    disabled={televersementJointe}
                    className="hidden"
                    onChange={(e) => {
                      const fichiers = Array.from(e.target.files || []);
                      e.target.value = "";
                      if (fichiers.length > 0) ajouterPiecesJointes(fichiers);
                    }}
                  />
                </label>
                {nouvellesPiecesJointes.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {nouvellesPiecesJointes.map((pj, idx) => (
                      <div key={pj.url} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px]">
                        {pj.type === "image" ? (
                          // Vignette cliquable — on vérifie ce qu'on envoie.
                          <a href={pj.url} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={pj.url} alt={pj.nom} loading="lazy" decoding="async" className="h-8 w-8 rounded object-cover" />
                          </a>
                        ) : (
                          <span className="shrink-0 text-base">📄</span>
                        )}
                        <a href={pj.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold text-slate-600 hover:underline">
                          {pj.nom}
                        </a>
                        <button
                          onClick={() => setNouvellesPiecesJointes((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 text-slate-400 hover:text-red-600"
                          aria-label="Retirer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 📇 CONTACT SUR PLACE — la personne à voir sur le
                  chantier, choisie dans le carnet du client ou créée ici
                  (et mémorisée au carnet). Le technicien la verra avec
                  un bouton d'appel direct. */}
              {!estTypeSansClient(nouveauType) && nouveauClientId && (() => {
                const clientChoisi = clients.find((c) => c.id === nouveauClientId);
                const carnet = clientChoisi?.contacts || [];
                return (
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                      Contact sur place <span className="font-normal normal-case text-slate-400">— optionnel (chargé de projet, concierge…)</span>
                    </label>
                    <select
                      value={contactSurPlaceId}
                      onChange={(e) => setContactSurPlaceId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value="">Aucun — le technicien verra le numéro de la fiche client</option>
                      {carnet.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}{c.role ? ` — ${c.role}` : ""}{c.telephone ? ` (${c.telephone})` : ""}
                        </option>
                      ))}
                      <option value="nouveau">➕ Nouveau contact…</option>
                    </select>
                    {contactSurPlaceId === "nouveau" && (
                      <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            value={contactNom}
                            onChange={(e) => setContactNom(e.target.value)}
                            placeholder="Nom (ex. : Marc Tremblay)"
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={contactRole}
                            onChange={(e) => setContactRole(e.target.value)}
                            placeholder="Rôle (chargé de projet…)"
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <input
                          value={contactTel}
                          onChange={(e) => setContactTel(e.target.value)}
                          placeholder="Téléphone"
                          className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <p className="mt-1 text-[9px] text-slate-400">
                          Sera enregistré au carnet de {nomAffichageClient(clientChoisi) || "ce client"} — offert automatiquement à la prochaine tâche.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 🔧 UNITÉS CONCERNÉES — le carnet d'équipements du client
                  (relevé sur les bons passés). Cocher = le technicien
                  saura LAQUELLE travailler, et sa section « Unité
                  vérifiée » arrivera pré-remplie. Rien de coché = comme
                  avant. Un client jamais visité n'a pas de carnet : la
                  section ne s'affiche pas, le carnet se bâtit tout seul
                  au fil des visites. */}
              {!estTypeSansClient(nouveauType) && nouveauClientId && (() => {
                const connues = unitesConnuesDuClient(nouveauClientId);
                if (connues.length === 0) return null;
                return (
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                      🔧 Unité(s) concernée(s) <span className="font-normal normal-case text-slate-400">— relevées lors de visites passées, optionnel</span>
                    </label>
                    <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                      {connues.map((u) => (
                        <label key={u.cle} className="flex items-start gap-1.5 rounded px-1 py-0.5 text-[11px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={unitesChoisies.includes(u.cle)}
                            onChange={() =>
                              setUnitesChoisies((prev) =>
                                prev.includes(u.cle) ? prev.filter((x) => x !== u.cle) : [...prev, u.cle]
                              )
                            }
                            className="mt-0.5 shrink-0 accent-[#131B2E]"
                          />
                          <span className="min-w-0">
                            {u.emplacement ? <span className="mr-1 rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold text-slate-600">📍 {u.emplacement}</span> : null}
                            <span className="font-semibold">{u.modele || "Modèle non relevé"}</span>
                            {u.serie ? <span className="text-slate-500"> · Nº {u.serie}</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-400">
                      Le technicien verra l&apos;unité en évidence sur sa fiche de tâche, et sa section « Unité vérifiée » sera pré-remplie.
                    </p>
                  </div>
                );
              })()}

              {/* SECTEUR CCQ — commercial/résidentiel : décide du taux
                  coûtant. Hérité du projet choisi, changeable ici.
                  Course et congé : sans objet, masqué. */}
              {!estTypeSansClient(nouveauType) && (
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Secteur (taux CCQ)</label>
                <div className="flex gap-1.5">
                  {[["commercial", "🏢 Commercial"], ["residentiel", "🏠 Résidentiel"]].map(([val, lib]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNouveauSecteur(val)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                        nouveauSecteur === val ? "border-[#131B2E] bg-[#131B2E] text-white" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {lib}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Projet lié (optionnel)</label>
                <select
                  value={nouveauProjetId}
                  onChange={(e) => setNouveauProjetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Aucun / Projet général</option>
                  {projetsDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                {nouveauClientId && projetsDisponibles.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">Ce client n'a aucun projet actif — la tâche restera hors-projet.</p>
                )}
                {nouveauProjetId && (
                  <p className="mt-1 text-[10px] text-emerald-600">
                    Les heures de cette tâche compteront dans la rentabilité de ce projet.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <input
                    type="checkbox"
                    checked={adresseTravauxDifferente}
                    onChange={(e) => {
                      setAdresseTravauxDifferente(e.target.checked);
                      setAdresseTravauxId("");
                      setNouvelleAdresseTravaux(null);
                    }}
                    className="h-3.5 w-3.5 accent-[#FF6A13]"
                  />
                  Adresse des travaux différente de l'adresse de facturation
                </label>
                {adresseTravauxDifferente && (
                  <div className="space-y-2 rounded-lg bg-slate-50 p-2">
                    {(() => {
                      const client = clients.find((c) => c.id === nouveauClientId);
                      if ((client?.adresses || []).length === 0) return null;
                      // La liste montre UNIQUEMENT les adresses de CE
                      // client — son nom est affiché pour qu'aucun doute
                      // ne subsiste (retour de tests : « adresses
                      // mélangées »). Filtre au-dessus, liste conservée.
                      const f = filtreAdresseTache.trim().toLowerCase();
                      const adressesFiltrees = client.adresses.filter(
                        (a) => !f || a.id === adresseTravauxId || `${a.nom} ${a.ligne1} ${a.appartement || ""}`.toLowerCase().includes(f)
                      );
                      return (
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Adresses enregistrées de {nomAffichageClient(client)}
                          </p>
                          <input
                            value={filtreAdresseTache}
                            onChange={(e) => setFiltreAdresseTache(e.target.value)}
                            placeholder="🔍 Filtrer les adresses…"
                            className="mb-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                          />
                          <select
                            value={adresseTravauxId}
                            onChange={(e) => { setAdresseTravauxId(e.target.value); setNouvelleAdresseTravaux(null); }}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">— Choisir une adresse enregistrée —</option>
                            {adressesFiltrees.map((a) => (
                              <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-slate-400">Ou saisir une nouvelle adresse :</p>
                    <AutocompleteAdresse
                      onSelection={(place) => { setNouvelleAdresseTravaux(place); setAdresseTravauxId(""); }}
                    />
                    <input
                      value={nouvelleAdresseApp}
                      onChange={(e) => setNouvelleAdresseApp(e.target.value)}
                      placeholder="App. / unité (optionnel) — ex. : 4B"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:w-52"
                    />
                    {nouvelleAdresseTravaux && (
                      <>
                        <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                          <Check size={12} /> {nouvelleAdresseTravaux.label}
                          {nouvelleAdresseApp.trim() ? `, app. ${nouvelleAdresseApp.trim()}` : ""}
                        </p>
                        {/* 📌 Cochée d'avance : l'adresse rejoint le dossier
                            du client et sera offerte dans la liste à la
                            prochaine tâche (anti-doublon à la création). */}
                        {nouveauClientId && (
                          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={enregistrerAdresseFiche}
                              onChange={(e) => setEnregistrerAdresseFiche(e.target.checked)}
                              className="h-3.5 w-3.5 accent-[#FF6A13]"
                            />
                            📌 Enregistrer cette adresse au dossier de {nomAffichageClient(clients.find((c) => c.id === nouveauClientId)) || "ce client"}
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>



              {(nouveauType === "devis" || nouveauType === "entretien_contrat" || nouveauType === "appel_service") && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                    {nouveauType === "entretien_contrat" ? "Devis / contrat à facturer" : nouveauType === "appel_service" ? "Devis à lier (optionnel — ex : devis fait après la 1re visite)" : "Devis à facturer"}
                  </label>
                  <select
                    value={nouveauDevisId}
                    onChange={(e) => {
                      setNouveauDevisId(e.target.value);
                      // Contrat d'entretien : la fréquence choisie sur le
                      // devis est reprise automatiquement (modifiable).
                      const d = devisListe.find((x) => x.id === e.target.value);
                      if (d?.estContrat && d.frequenceFacturationAnnuelle) setNouvelleFrequence(d.frequenceFacturationAnnuelle);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="" disabled>Sélectionner un devis...</option>
                    {devisListe
                      .slice()
                      // 🎯 SEULEMENT les devis DU CLIENT choisi (retour de
                      // tests 2026-08-17) : la liste montrait les devis de
                      // TOUS les clients — risque de lier le mauvais devis
                      // à la tâche. Sans client choisi, liste complète.
                      .filter((d) => !nouveauClientId || d.clientId === nouveauClientId)
                      // Pour une tâche « Entretien selon contrat », les
                      // CONTRATS apparaissent en premier, clairement marqués.
                      .sort((a, b) => (nouveauType === "entretien_contrat" ? (b.estContrat ? 1 : 0) - (a.estContrat ? 1 : 0) : 0))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.estContrat ? `📄 CONTRAT ${d.frequenceFacturationAnnuelle}×/an — ` : ""}{d.numero} — {d.clientNom}
                        </option>
                      ))}
                  </select>
                  {!nouveauClientId && devisListe.length > 0 && (
                    <p className="mt-1 text-[10px] text-slate-400">Choisis d&apos;abord le client plus bas : la liste ne montrera que SES devis.</p>
                  )}
                  {nouveauClientId && devisListe.filter((d) => d.clientId === nouveauClientId).length === 0 && (
                    <p className="mt-1 text-[10px] text-amber-600">
                      Aucun devis au dossier de ce client{nouveauType !== "entretien_contrat" ? " — entre un numéro manuellement ci-dessous, ou crée le devis dans l'onglet Devis" : " — crée d'abord le contrat dans l'onglet Devis"}.
                    </p>
                  )}
                  {devisListe.length === 0 && (
                    <p className="mt-1 text-[10px] text-red-500">Aucun devis disponible — crée-en un dans l'onglet Devis.</p>
                  )}
                </div>
              )}

              {nouveauType === "entretien_contrat" && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Fréquence de facturation</label>
                  <select
                    value={nouvelleFrequence}
                    onChange={(e) => setNouvelleFrequence(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    {FREQUENCES_CONTRAT.map((f) => (
                      <option key={f} value={f}>{f === 1 ? "1 facture par an (paiement complet)" : `${f} factures par an`}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nº DE DEVIS EXISTANT (transition QuickBooks) — pour les
                  jobs vendues avec un devis d'AVANT l'application. Offert
                  AUSSI pour « Travaux avec devis » (retour de tests
                  2026-08-17) : un devis fait hors de l'app se tape à la
                  main quand il n'est pas dans la liste. Pas pour les
                  contrats d'entretien (la fréquence vient du contrat). */}
              {nouveauType !== "entretien_contrat" && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                    {nouveauType === "devis" ? "…ou entre un Nº de devis manuellement (devis fait hors de l'app)" : "Nº de devis existant (QuickBooks)"} <span className="font-normal normal-case text-slate-400">— optionnel</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      value={numeroDevisExistant}
                      onChange={(e) => {
                        setNumeroDevisExistant(e.target.value);
                        setVerifDevisQbo(null); // le numéro change — la vérification d'avant ne vaut plus
                      }}
                      placeholder="Ex. : 1057 ou DEV-2024-312"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:w-64"
                    />
                    <button
                      type="button"
                      onClick={verifierDevisQbo}
                      disabled={!numeroDevisExistant.trim() || verifDevisQbo?.etat === "cherche"}
                      className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"
                    >
                      {verifDevisQbo?.etat === "cherche" ? "…" : "🔎 Vérifier"}
                    </button>
                  </div>
                  {/* Le verdict — une faute de frappe attrapée ICI coûte
                      dix fois moins cher qu'à la facturation. */}
                  {verifDevisQbo?.etat === "trouve" && (
                    <p className="mt-0.5 rounded bg-emerald-50 px-1.5 py-1 text-[9px] font-bold text-emerald-700">
                      ✓ Trouvé dans QuickBooks — {verifDevisQbo.nbLignes} ligne{verifDevisQbo.nbLignes > 1 ? "s" : ""},
                      total {verifDevisQbo.total.toFixed(2)} $ HT{verifDevisQbo.clientNomQbo ? ` · client : ${verifDevisQbo.clientNomQbo}` : ""}.
                      Le solde et la facturation progressive s&apos;appuieront dessus.
                    </p>
                  )}
                  {verifDevisQbo?.etat === "introuvable" && (
                    <p className="mt-0.5 rounded bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700">
                      ⚠️ Aucun devis à ce numéro dans QuickBooks — vérifie le numéro. Tu peux créer la tâche quand même :
                      le numéro suivra comme référence, sans montant ni lignes.
                    </p>
                  )}
                  {verifDevisQbo?.etat === "hors_ligne" && (
                    <p className="mt-0.5 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-semibold text-slate-500">
                      QuickBooks injoignable pour vérifier — la facturation réessaiera toute seule au moment venu.
                    </p>
                  )}
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    {nouveauType === "devis"
                      ? "Le numéro suivra la tâche jusqu'au bon de travail et à la facturation. S'il existe dans QuickBooks, son total et ses lignes seront relus à la facturation (solde anti-dépassement compris) — écris quand même l'essentiel dans la description pour le technicien."
                      : "Pour la transition : le numéro suivra la tâche jusqu'au bon de travail et à la facturation, et son contenu sera relu depuis QuickBooks au moment de facturer."}
                  </p>
                </div>
              )}

              <div className="border-t border-slate-100 pt-2">
                <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">Planification (optionnel)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date</label>
                    <input
                      type="date"
                      value={nouvelleDate}
                      onChange={(e) => setNouvelleDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heure de début</label>
                    <select
                      value={nouvelleHeureDebut}
                      onChange={(e) => setNouvelleHeureDebut(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heures / jour</label>
                    <input
                      type="number" min={0} max={HEURES.length} value={nouvelleDureeHeures}
                      onChange={(e) => { const v = parseInt(e.target.value); setNouvelleDureeHeures(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nombre de jours</label>
                    <input
                      type="number" min={0} value={nouvelleDureeJours}
                      onChange={(e) => { const v = parseInt(e.target.value); setNouvelleDureeJours(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
                {nouvelleDureeJours > 1 && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={nouveauSauterWeekend}
                      onChange={(e) => setNouveauSauterWeekend(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    Sauter les samedis et dimanches
                  </label>
                )}
                <div className="mt-1.5">
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Technicien attribué</label>
                  <select
                    value={nouveauEmployeId}
                    onChange={(e) => setNouveauEmployeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">— Laisser en attente (ne pas assigner) —</option>
                    {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
                  </select>
                </div>
                {/* MULTI-TECHNICIENS (retour de tests) : les cochés
                    rejoignent la MÊME tâche, planifiés d'un seul coup.
                    ⚠️ SANS DATE AUSSI (retour de tests 2026-08-17) : la
                    section n'apparaissait qu'avec une date — impossible
                    d'ajouter un 2e technicien sur un appel avec dépôt
                    (encore sans date). Sans date, les cochés sont
                    MÉMORISÉS sur la tâche et s'assignent d'un coup dès
                    qu'elle entre à l'horaire. */}
                {nouveauEmployeId && employes.filter((e) => e.id !== nouveauEmployeId).length > 0 && (
                  <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Ajouter d&apos;autres techniciens sur la même tâche
                    </p>
                    {!nouvelleDate && (
                      <p className="mb-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-700">
                        Sans date : ils seront assignés automatiquement avec la tâche quand elle sera placée à l&apos;horaire.
                      </p>
                    )}
                    <div className="space-y-1">
                      {employes
                        .filter((e) => e.id !== nouveauEmployeId)
                        .map((e) => {
                          const coche = nouveauxEmployesEnPlus.includes(e.id);
                          const choix = facturablesEnPlus[e.id]; // true | false | undefined
                          return (
                            <div key={e.id}>
                              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={coche}
                                  onChange={() => {
                                    setNouveauxEmployesEnPlus((prev) =>
                                      prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]
                                    );
                                    // Décoché = son choix 💰/🤝 s'efface
                                    // aussi (pas de choix fantôme si on
                                    // le recoche plus tard).
                                    setFacturablesEnPlus((prev) => {
                                      const maj = { ...prev };
                                      delete maj[e.id];
                                      return maj;
                                    });
                                  }}
                                  className="h-3.5 w-3.5 accent-[#131B2E]"
                                />
                                {e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}
                              </label>
                              {/* 🤝 SOUS-TRAITANT en renfort (2026-08-19) :
                                  pas de question 💰/🤝 (il n'est ni payé ni
                                  dans l'équipe de signature) — son bloc sur
                                  SA rangée sert au suivi Présent/Pas venu
                                  et au coût réel du projet. */}
                              {coche && e.estSousTraitant && (
                                <p className="mt-1 pl-5 text-[10px] leading-snug text-slate-500">
                                  Suivi Présent/Pas venu sur sa rangée — jamais compté dans l&apos;équipe de signature ni dans la paie.
                                </p>
                              )}
                              {/* CHOIX OBLIGATOIRE fait ICI (2026-08-17) —
                                  aucune présélection : facturable au client,
                                  ou aide interne non facturable. */}
                              {coche && !e.estSousTraitant && (
                                <div className="mt-1 flex gap-1.5 pl-5">
                                  <button
                                    type="button"
                                    onClick={() => setFacturablesEnPlus((prev) => ({ ...prev, [e.id]: true }))}
                                    className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                      choix === true ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-600"
                                    }`}
                                  >
                                    💰 Facturable
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFacturablesEnPlus((prev) => ({ ...prev, [e.id]: false }))}
                                    className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                      choix === false ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 bg-white text-slate-600"
                                    }`}
                                  >
                                    🤝 Non facturable (aide)
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <p className="mt-1 text-[9px] text-slate-400">
                      Même job à plusieurs bras : heures additionnées, UNE facturation. Chacun reste ajustable
                      individuellement ensuite dans l&apos;agenda.
                    </p>
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  {depotRequis
                    ? nouveauEmployeId
                      ? "Le technicien choisi sera RÉSERVÉ sur la tâche, mais elle restera en attente tant que le dépôt n'est pas payé."
                      : "Dépôt requis : la tâche ira dans « Tâches en attente » jusqu'au paiement. Tu peux quand même choisir le technicien prévu ci-dessus."
                    : nouvelleDate && nouveauEmployeId
                    ? `Sera placée directement dans l'horaire à ${nouvelleHeureDebut}.`
                    : "Sans date ET technicien, la tâche ira dans « Tâches en attente »."}
                </p>
              </div>

              {/* 🗺️ ZONE DE TARIFICATION — TOUJOURS, dépôt ou pas.
                  C'est elle qui dit à la facturation le prix de base de
                  l'appel ET la règle du temps inclus. Obligatoire pour
                  un appel de service, comme le secteur CCQ. */}
              {nouveauType === "appel_service" && (
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <label className="mb-0.5 block text-xs font-bold text-slate-700">
                    🗺️ Zone de tarification <span className="font-normal text-slate-400">(règle de facturation de l&apos;appel)</span>
                  </label>
                  <select
                    value={zoneAppelChoix}
                    onChange={(e) => {
                      const v = e.target.value;
                      setZoneAppelChoix(v);
                      // Le montant du dépôt SUIT la zone (saisie libre hors zone).
                      setDepotMontant(v === "hors_zone" || v === "" ? "" : String(Number(prixDepots?.[v]) || 0));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    <option value="">— Choisir la zone —</option>
                    {zonesEffectives(prixDepots).filter((z) => Number(prixDepots?.[z]) > 0).map((z) => {
                      const p = Number(prixDepots[z]);
                      return (
                        <option key={z} value={z}>
                          {z} — {p.toFixed(2)} $ HT ({taxesDepot(p, configEnt).total.toFixed(2)} $ taxes incl.) — transport inclus, {Number(prixDepots?.minutes_incluses) || 90} min chez le client
                        </option>
                      );
                    })}
                    <option value="hors_zone">
                      Hors zone — tarif sur mesure — {Number(prixDepots?.minutes_incluses_hors_zone) || 180} min totales, transport compté
                    </option>
                  </select>
                  <p className="mt-1 text-[9px] leading-snug text-slate-400">
                    La comptabilité s&apos;en sert même sans dépôt : prix de base de l&apos;appel et calcul du temps
                    supplémentaire (temps réel sur place seulement — jamais le bloc d&apos;agenda).
                  </p>
                </div>
              )}

              {/* DÉPÔT PRÉALABLE */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <label className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <input
                    type="checkbox"
                    checked={depotRequis}
                    onChange={(e) => {
                      setDepotRequis(e.target.checked);
                      // Cocher APRÈS avoir choisi la zone : le montant suit.
                      if (e.target.checked && zoneAppelChoix && zoneAppelChoix !== "hors_zone") {
                        setDepotMontant(String(Number(prixDepots?.[zoneAppelChoix]) || 0));
                      }
                    }}
                    className="h-4 w-4 accent-[#131B2E]"
                  />
                  💰 Dépôt requis avant planification
                </label>
                {depotRequis && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold text-amber-800">Montant du dépôt (HT $)</label>
                      {!zoneAppelChoix && (
                        <p className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-800">
                          Choisis d&apos;abord la <span className="font-bold">zone de tarification</span> ci-dessus — le montant du dépôt suivra tout seul.
                        </p>
                      )}
                      {zoneAppelChoix && zoneAppelChoix !== "hors_zone" && (
                        <p className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">
                          {zoneAppelChoix} — <span className="tabular-nums">{(Number(prixDepots?.[zoneAppelChoix]) || 0).toFixed(2)} $ HT</span> (liste de prix)
                        </p>
                      )}
                      {zonesEffectives(prixDepots).every((z) => !(Number(prixDepots?.[z]) > 0)) && (
                        <p className="mt-1 text-[9px] text-amber-700">
                          Aucun prix de zone configuré — l&apos;Admin principal peut les définir dans Utilisateurs → « Liste de prix — dépôts ».
                        </p>
                      )}
                      {zoneAppelChoix === "hors_zone" && (
                        <InputNombreDecimal
                          valeur={depotMontant || 0}
                          onChange={(v) => setDepotMontant(String(v))}
                          className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
                        />
                      )}
                      {parseFloat(depotMontant) > 0 && (() => {
                        const t = taxesDepot(depotMontant, configEnt);
                        return (
                          <p className="mt-1 text-[10px] text-amber-800 tabular-nums">
                            + TPS {t.tps.toFixed(2)} $ + TVQ {t.tvq.toFixed(2)} $ = <span className="font-bold">{t.total.toFixed(2)} $ à percevoir</span> · payable sous 24 h
                          </p>
                        );
                      })()}
                    </div>
                    {/* DESTINATAIRES DE LA DEMANDE DE DÉPÔT — le courriel
                        (avec le Nº de la facture QuickBooks) part à la
                        création de la tâche. Adresses par défaut du
                        client précochées ; « autre adresse » en secours. */}
                    {(() => {
                      const fiche = clients.find((c) => c.id === nouveauClientId);
                      const contacts = (fiche?.courriels || [])
                        .map((c) => (typeof c === "string" ? { email: c } : c))
                        .filter((c) => c?.email);
                      return (
                        <div className="rounded-lg border border-amber-200 bg-white p-2">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            ✉️ Envoyer la demande de dépôt à :
                          </p>
                          {contacts.length === 0 && (
                            <p className="mb-1 text-[10px] font-semibold text-amber-700">
                              Ce client n&apos;a aucun courriel dans sa fiche — inscris une adresse ci-dessous, ou aucune (tu l&apos;appelleras).
                            </p>
                          )}
                          {contacts.map((c) => (
                            <label key={c.email} className="mb-0.5 flex items-center gap-1.5 text-[11px] text-slate-700">
                              <input
                                type="checkbox"
                                checked={depotEmails.includes(c.email)}
                                onChange={() =>
                                  setDepotEmails((prev) =>
                                    prev.includes(c.email) ? prev.filter((x) => x !== c.email) : [...prev, c.email]
                                  )
                                }
                              />
                              {c.email}
                              {c.label ? <span className="text-[10px] text-slate-400">({c.label})</span> : null}
                            </label>
                          ))}
                          <input
                            value={depotExtra}
                            onChange={(e) => setDepotExtra(e.target.value)}
                            placeholder="Autre adresse (optionnel)"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          {/* 📌 Même réflexe que l'adresse de chantier :
                              une adresse tapée ici servira encore — on
                              l'offre à la fiche plutôt que de la perdre. */}
                          {depotExtra.trim() && nouveauClientId && (
                            <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={depotExtraAuDossier}
                                onChange={(e) => setDepotExtraAuDossier(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#FF6A13]"
                              />
                              📌 Ajouter ce courriel au dossier de {nomAffichageClient(fiche) || "ce client"}
                            </label>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-[10px] font-semibold text-amber-800">
                      💡 Client pas encore enregistré ? Choisis <span className="font-bold">« ➕ Nouveau client… »</span> en haut de la liste Client — sa fiche complète sera créée et validée du même coup.
                    </p>
                    <p className="text-[9px] leading-snug text-amber-700">
                      La tâche restera bloquée hors agenda tant que le dépôt n&apos;est pas payé (ou confirmé manuellement).
                      À la création : la facture de dépôt est créée dans QuickBooks (Sandbox pendant les tests) et la
                      demande part aux adresses cochées.
                    </p>
                  </div>
                )}
              </div>

              {/* Garde-fou : dépôt coché SANS montant = création bloquée.
                  Sinon la tâche filerait à l'agenda comme si aucun dépôt
                  n'était exigé (c'est exactement le trou qui permettait de
                  planifier un appel de service non payé). */}
              </>
                </div>
                <div className="shrink-0 border-t border-slate-200 px-4 py-3">
                    {depotRequis && !(parseFloat(depotMontant) > 0) && (
                      <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-700">
                        ⚠️ Choisis un montant de dépôt (liste de prix ou tarif sur mesure) pour pouvoir créer la tâche.
                      </p>
                    )}
                    {/* LE BOUTON GRIS S'EXPLIQUE (règle de la maison) : la
                        liste des raisons s'affiche au lieu de laisser
                        deviner. Un devis TAPÉ À LA MAIN débloque aussi le
                        type « Travaux avec devis » (2026-08-17). */}
                    {(() => {
                      const raisons = [];
                      if (!nouveauTitre.trim()) raisons.push("un titre");
                      // Secteur CCQ : obligatoire, AUCUNE présélection
                      // (2026-08-17) — il fige le taux coûtant de chaque
                      // heure. Sans objet pour course/congé (masqué).
                      if (!estTypeSansClient(nouveauType) && !nouveauSecteur) raisons.push("le secteur (taux CCQ — Commercial ou Résidentiel)");
                      // 🗺️ Zone OBLIGATOIRE pour un appel de service — avec
                      // ou sans dépôt : c'est elle qui dit à la comptabilité
                      // le prix de base et la règle du temps inclus.
                      if (nouveauType === "appel_service" && !zoneAppelChoix) raisons.push("la zone de tarification de l'appel");
                      if (nouveauType === "devis" && !nouveauDevisId && !numeroDevisExistant.trim()) raisons.push("un devis (de la liste, ou un numéro tapé à la main)");
                      if (nouveauType === "entretien_contrat" && !nouveauDevisId) raisons.push("un contrat de la liste");
                      if (depotRequis && !(parseFloat(depotMontant) > 0)) raisons.push("un montant de dépôt");
                      // « Nouveau contact » choisi mais incomplet : on ne
                      // crée pas une tâche avec un contact fantôme.
                      if (contactSurPlaceId === "nouveau" && (!contactNom.trim() || !contactTel.trim()))
                        raisons.push("le nom et le téléphone du nouveau contact sur place");
                      // Choix 💰/🤝 obligatoire pour chaque technicien
                      // supplémentaire coché (2026-08-17) — les SOUS-
                      // TRAITANTS en sont exemptés (2026-08-19) : la
                      // question n'a pas de sens pour eux.
                      nouveauxEmployesEnPlus
                        .filter((id) => id !== nouveauEmployeId && facturablesEnPlus[id] !== true && facturablesEnPlus[id] !== false)
                        .forEach((id) => {
                          const fiche = employes.find((e) => e.id === id);
                          if (fiche?.estSousTraitant) return;
                          raisons.push(`le choix facturable ou non pour ${fiche?.nom || "un technicien ajouté"}`);
                        });
                      return (
                        <>
                          {raisons.length > 0 && (
                            <p className="mb-2 rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500">
                              Pour créer la tâche, il manque : {raisons.join(" · ")}.
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => creerTache(false)}
                              disabled={raisons.length > 0}
                              className="min-h-0 flex-1 py-2.5 text-xs"
                            >
                              Créer la tâche
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tachesAttenteAffichees.map((t) => (
              <div
                key={t.id}
                /* `estBloquee` couvre les DEUX raisons : dépôt impayé ET
                   pièce pas encore reçue. Avec `depotBloque` seul, une
                   tâche en attente de pièce restait glissable vers
                   l'agenda — on aurait envoyé un technicien poser une
                   pièce encore chez le fournisseur. */
                draggable={!lectureSeule && !estBloquee(t)}
                onDragStart={(e) => !lectureSeule && !estBloquee(t) && e.dataTransfer.setData("text/plain", JSON.stringify(t))}
                className={`rounded-xl border border-l-4 bg-white p-3 ${
                  depotDe(t.id)?.statut === "annule_delai"
                    ? "border-red-300 opacity-60"
                    : pieceBloque(t.id)
                    ? "border-sky-400"
                    : depotBloque(t.id)
                    ? "border-amber-300"
                    : "border-slate-200"
                } ${lectureSeule || estBloquee(t) ? "" : "cursor-grab active:cursor-grabbing"}`}
              >
                {/* EN-TÊTE COMPACT (2026-08-18) : une ligne — pastille,
                    titre, chips d'état, chevron. Le clic DÉPLIE ; le ✏️
                    ouvre l'édition rapide ; le glisser-déposer reste sur
                    toute la carte, compacte ou dépliée. */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTacheDepliee(tacheDepliee === t.id ? null : t.id)}
                    className="min-w-0 flex-1 rounded-lg p-1 text-left hover:bg-slate-50"
                    title={tacheDepliee === t.id ? "Replier" : "Voir le détail"}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${(COULEUR_TYPE_TACHE[t.typeTache] || COULEUR_TYPE_DEFAUT).pastille}`} />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{t.titre || t.clientNom}</p>
                      {t.statut === "en_attente_materiel" && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">MATÉRIEL</span>
                      )}
                      {pieceBloque(t.id) && (
                        <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700" title="En attente d'une pièce">🔧</span>
                      )}
                      {depotBloque(t.id) && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Dépôt impayé">🔒</span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`shrink-0 text-slate-300 transition-transform ${tacheDepliee === t.id ? "rotate-180" : ""}`}
                      />
                    </div>
                    {tacheDepliee !== t.id && t.clientNom && t.titre && (
                      <p className="ml-3.5 truncate text-[10px] text-slate-400">{t.clientNom}</p>
                    )}
                  </button>
                  {!lectureSeule && (
                    <button
                      onClick={() => setTacheEnEditionId(t.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-slate-50 hover:text-slate-600"
                      title="Édition rapide (date, heure, durée, technicien)"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
                {tacheDepliee === t.id && (
                <>
                <div className="mt-1">
                {(t.piecesJointes || []).length > 0 && (
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    📎 {t.piecesJointes.length} document{t.piecesJointes.length > 1 ? "s" : ""} joint{t.piecesJointes.length > 1 ? "s" : ""} pour le technicien
                  </p>
                )}
                {/* EN ATTENTE D'UNE PIÈCE — la raison du blocage doit
                    être écrite sur la carte. Une tâche bloquée sans
                    explication pousse à chercher pourquoi, ou pire à
                    la débloquer de force. */}
                {(() => {
                  const pc = (pieces || []).find((x) => x.tacheRetourId === t.id);
                  if (!pc) return null;
                  // PIÈCE ANNULÉE : la tâche reste bloquée ICI jusqu'à ce
                  // qu'un humain tranche — supprimer la tâche, ou la
                  // garder sans pièce (le client a pu changer d'idée).
                  // Avant, l'annulation déverrouillait la tâche : on
                  // risquait de céduler la pose d'une pièce inexistante.
                  if (pc.statut === "annulee") {
                    return (
                      <div className="mt-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-bold leading-snug text-red-700">
                        <p>❌ Pièce ANNULÉE{pc.annuleRaison ? ` — ${pc.annuleRaison}` : ""}</p>
                        <p className="mt-0.5 font-semibold opacity-80">Que faire de cette tâche de retour ?</p>
                        {!lectureSeule && (
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              onClick={() => {
                                setTachesAttente((prev) => prev.filter((x) => x.id !== t.id));
                                ajouterJournal(`🗑️ Tâche de retour supprimée (pièce annulée) — ${t.titre} · ${t.clientNom}.`);
                              }}
                              className="rounded-lg bg-red-600 px-2 py-1 font-extrabold text-white hover:bg-red-700"
                            >
                              Supprimer la tâche
                            </button>
                            <button
                              onClick={() => onDetacherPiece?.(pc.id, t)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-extrabold text-slate-600 hover:bg-slate-50"
                            >
                              Garder (sans pièce)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  const recue = pc.statut === "recue";
                  const attendPaiement = recue && pc.paiementRequis && !pc.paiementRecu;
                  const prevue = pc.dateReceptionPrevue
                    ? new Date(`${pc.dateReceptionPrevue}T00:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })
                    : null;
                  return (
                    <div
                      className={`mt-1.5 rounded-lg px-2 py-1 text-[10px] font-bold leading-snug ${
                        recue && !attendPaiement
                          ? "bg-emerald-50 text-emerald-700"
                          : pc.enRetard
                            ? "bg-red-50 text-red-700"
                            : "bg-sky-50 text-sky-800"
                      }`}
                    >
                      <p>
                        {attendPaiement
                          ? `💰 Pièce reçue — en attente du PAIEMENT du client`
                          : recue
                          ? `📦 Pièce reçue — planifiable`
                          : pc.statut === "commandee"
                          ? `📦 COMMANDÉE — ${pc.pieceRequise}`
                          : `🔧 À COMMANDER — ${pc.pieceRequise}`}
                      </p>
                      {/* LE DÉTAIL SUIT LA TÂCHE. C'est ici qu'on répond au
                          client qui appelle « elle arrive quand, ma pièce ? »
                          — sans avoir à ouvrir un autre onglet. */}
                      {!recue && (
                        <p className="mt-0.5 font-semibold opacity-80">
                          {pc.fournisseurNom ? `${pc.fournisseurNom}` : "Fournisseur à choisir"}
                          {pc.numeroBc ? ` · ${pc.numeroBc}` : ""}
                          {prevue
                            ? ` · ${pc.enRetard ? "⚠️ attendue le" : "prévue le"} ${prevue}`
                            : pc.statut === "commandee"
                              ? " · aucune date confirmée"
                              : ""}
                          {pc.jours > 0 ? ` · ${pc.jours} jour${pc.jours > 1 ? "s" : ""}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* STATUT DU DÉPÔT */}
                {depotDe(t.id) && (() => {
                  const d = depotDe(t.id);
                  const tD = taxesDepot(d.montantHT, configEnt);
                  if (d.statut === "annule_delai") {
                    return (
                      <p className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                        ⏰ ANNULÉE — dépôt non payé sous 24 h
                      </p>
                    );
                  }
                  if (d.statut === "paye" || d.statut === "paye_manuellement") {
                    return (
                      <p className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                        💰 DÉPÔT REÇU{d.modePaiement ? ` (${d.modePaiement})` : ""} — planifiable
                      </p>
                    );
                  }
                  const heuresRestantes = Math.max(0, Math.round((new Date(d.dateLimite).getTime() - Date.now()) / 3600000));
                  return (
                    <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                      🔒 EN ATTENTE DE DÉPÔT — {tD.total.toFixed(2)} $ · expire dans ~{heuresRestantes} h
                    </p>
                  );
                })()}
                {/* TECHNICIEN RÉSERVÉ D'AVANCE (choisi à la création,
                    en attendant le paiement du dépôt) */}
                {t.technicienPrevu && (
                  <p className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                    👤 Technicien prévu : {employes.find((e) => e.id === t.technicienPrevu)?.nom || "?"}
                    {t.datePrevue ? ` · le ${t.datePrevue} à ${t.heurePrevue || "07:00"}` : ""}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.typeTache === "entretien_contrat" ? (
                    <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                      CONTRAT #{t.devisNumero} — {t.frequenceFacturationAnnuelle}×/an
                    </span>
                  ) : (
                    t.devisNumero && (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                        DEVIS #{t.devisNumero}
                      </span>
                    )
                  )}
                  {t.projetId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                      <Briefcase size={9} /> {(projets || []).find((p) => p.id === t.projetId)?.nom || "Projet"}
                    </span>
                  )}
                </div>
                {t.adresseTravaux && (
                  <div className="mt-1 flex items-start gap-1 text-[10px] text-slate-500">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span>Travaux : {t.adresseTravaux}</span>
                  </div>
                )}
                <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{t.description}</p>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heures / jour</label>
                    <input
                      type="number"
                      min={0}
                      max={HEURES.length}
                      value={t.heures ?? 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        majDureeTache(t.id, { heures: Number.isNaN(val) ? 1 : Math.max(0, val) });
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nombre de jours</label>
                    <input
                      type="number"
                      min={0}
                      value={t.jours ?? 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        majDureeTache(t.id, { jours: Number.isNaN(val) ? 1 : Math.max(0, val) });
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs tabular-nums"
                    />
                  </div>
                </div>

                {(t.jours ?? 1) >= 1 && (
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                    <Lock size={10} /> Bloque la journée complète de chaque technicien assigné
                  </p>
                )}

                {(t.jours ?? 1) > 1 && (
                  <label className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={!!t.sauterWeekend}
                      onChange={(e) => majDureeTache(t.id, { sauterWeekend: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    Sauter les samedis et dimanches
                  </label>
                )}

                {/* DÉBLOCAGE MANUEL DU DÉPÔT (admin) */}
                {!lectureSeule && depotDe(t.id)?.statut === "en_attente_paiement" && (
                  <Button
                    onClick={() => { setDepotModal({ tacheId: t.id, titre: t.titre || t.clientNom }); setDepotMode("Comptant"); }}
                    className="mt-2 w-full min-h-0 py-1.5 text-xs"
                  >
                    💰 Dépôt reçu manuellement…
                  </Button>
                )}
                {/* DÉPÔT PAYÉ + TECHNICIEN/DATE RÉSERVÉS D'AVANCE :
                    placement à l'horaire en un seul clic. */}
                {!lectureSeule &&
                  t.technicienPrevu &&
                  t.datePrevue &&
                  ["paye", "paye_manuellement"].includes(depotDe(t.id)?.statut) && (
                    <Button
                      onClick={() => {
                        assigner(t, t.technicienPrevu, new Date(`${t.datePrevue}T00:00:00`), t.heurePrevue || "07:00");
                        // Affiche tout de suite le jour où la tâche vient
                        // d'être placée — sinon l'agenda reste sur
                        // aujourd'hui et la tâche semble avoir disparu.
                        setJourAffiche(new Date(`${t.datePrevue}T00:00:00`));
                      }}
                      className="mt-2 w-full min-h-0 py-1.5 text-xs"
                    >
                      📅 Placer à l'horaire — {employes.find((e) => e.id === t.technicienPrevu)?.nom || "technicien prévu"} le {t.datePrevue}
                    </Button>
                  )}
                {!lectureSeule &&
                  t.technicienPrevu &&
                  !t.datePrevue &&
                  ["paye", "paye_manuellement"].includes(depotDe(t.id)?.statut) && (
                    <p className="mt-2 text-[10px] font-semibold text-emerald-700">
                      💰 Dépôt reçu — glisse la tâche sur la ligne de {employes.find((e) => e.id === t.technicienPrevu)?.nom || "son technicien"} dans l'agenda.
                    </p>
                  )}
                {/* RELANCE APRÈS ANNULATION — le client a rappelé : nouveau
                    dépôt, nouveau délai de 24 h. L'ancienne facture QBO est
                    annulée par VOID (jamais Delete — règle gelée), une
                    NOUVELLE facture et un nouveau courriel partent. */}
                {!lectureSeule && depotDe(t.id)?.statut === "annule_delai" && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const d = depotDe(t.id);
                      if (d?.qboInvoiceId) {
                        const rv = await annulerFactureDepot(d.qboInvoiceId);
                        ajouterJournal(
                          rv?.annulee
                            ? `🧾 Ancienne facture de dépôt${d.qboDocNumber ? ` Nº ${d.qboDocNumber}` : ""} annulée par VOID`
                            : `⚠️ VOID de l'ancienne facture refusé (${rv?.erreur || "?"}) — vérifie dans QuickBooks`
                        );
                      }
                      const fiche = clients.find((c) => c.id === t.clientId);
                      const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
                      const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
                      onCreerDepot?.(t.id, {
                        montantHT: d.montantHT,
                        isProspect: d.isProspect,
                        prospect: d.isProspect
                          ? { nom: d.prospectNom, courriel: d.prospectCourriel, telephone: d.prospectTelephone, adresse: d.prospectAdresse }
                          : null,
                        clientId: t.clientId || null,
                        clientNom: t.clientNom || fiche?.nom || "",
                        zone: t.zoneAppel === "hors_zone" ? "hors zone" : t.zoneAppel,
                        joursLimite: 1,
                        courriels: defauts.length > 0 ? defauts : tous.slice(0, 1),
                        // La relance porte aussi l'objet de la visite.
                        titre: t.titre || "",
                        descriptionTravaux: t.description || "",
                      });
                      ajouterJournal(`🔄 Dépôt relancé pour « ${t.titre || t.clientNom} » — nouveau délai de 24 h`);
                    }}
                    className="mt-2 w-full min-h-0 py-1.5 text-xs"
                  >
                    🔄 Relancer le dépôt (nouveau 24 h)
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() =>
                    setAssignationMobile(
                      assignationMobile?.tacheId === t.id
                        ? null
                        : { tacheId: t.id, employeId: employes[0].id, heure: HEURE_PAR_DEFAUT, date: jourKey }
                    )
                  }
                  className="mt-2 w-full min-h-0 py-1.5 text-xs lg:hidden"
                >
                  Assigner
                </Button>

                {assignationMobile?.tacheId === t.id && (
                  <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 lg:hidden">
                    <select
                      value={assignationMobile.employeId}
                      onChange={(e) => setAssignationMobile({ ...assignationMobile, employeId: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
                    </select>
                    {vue === "jour" ? (
                      <select
                        value={assignationMobile.heure}
                        onChange={(e) => setAssignationMobile({ ...assignationMobile, heure: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    ) : (
                      <input
                        type="date"
                        value={assignationMobile.date}
                        onChange={(e) => setAssignationMobile({ ...assignationMobile, date: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    )}
                    <Button
                      onClick={() => {
                        if (vue === "jour") assigner(t, assignationMobile.employeId, jourAffiche, assignationMobile.heure);
                        // `T00:00:00` force l'interprétation en heure LOCALE :
                        // sans lui, "AAAA-MM-JJ" est lu en UTC et la tâche
                        // atterrirait la veille au Québec.
                        else assigner(t, assignationMobile.employeId, new Date(`${assignationMobile.date}T00:00:00`), HEURE_PAR_DEFAUT);
                        setAssignationMobile(null);
                      }}
                      className="w-full min-h-0 py-1.5 text-xs"
                    >
                      Confirmer l'assignation
                    </Button>
                  </div>
                )}
                </>
                )}
              </div>
            ))}
            {tachesAttenteAffichees.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                {tachesAttente.length === 0
                  ? "Aucune tâche en attente. Les devis acceptés apparaissent ici."
                  : ongletAttente === "bloquees"
                  ? "Aucune tâche bloquée par un dépôt — dès qu'un dépôt est payé, sa tâche passe dans « ✅ Prêtes »."
                  : ongletAttente === "pieces"
                  ? "Aucune pièce en commande. Quand un technicien coche « pièce à commander » sur un appel de service, le retour se range ici jusqu'à la réception."
                  : "Aucune tâche prête — regarde les onglets « 🔒 Dépôt » et « 🔧 Pièces »."}
              </p>
            )}
          </div>
          <p className="mt-3 hidden text-[11px] text-slate-400 lg:block">
            Glisse une tâche vers une case du calendrier pour l'assigner.
          </p>
        </div>

        {/* 📱 VUE LISTE — TÉLÉPHONE (2026-08-21, séance mobile)
            ------------------------------------------------------------
            La grille de 24 colonnes demande 640 px de large : sur un
            téléphone, c'est du défilement horizontal à l'aveugle. Même
            journée, mêmes données, présentée en LISTE par personne et
            dans l'ordre réel. Un tap ouvre la même fiche de tâche que
            sur l'ordinateur (elle est déjà pensée plein écran).

            2026-08-22 — RETOUR À LA LISTE DÉPLIÉE, après essai sur le
            terrain. On avait tenté des cartes repliées (un tap sur le
            nom pour ouvrir les tâches) : ça tenait dans un écran, mais
            ça se lisait moins bien. Le propriétaire préfère TOUT voir
            d'un seul défilement, sans geste à faire. Seule la bande du
            haut est conservée de cet essai — elle ne cache rien et
            répond à « combien de monde travaille aujourd'hui » pendant
            qu'on descend dans la liste. */}
        <div className={`${modeAgendaMobile === "grille" ? "hidden" : "flex-1 overflow-y-auto"} md:hidden`}>
          {vue !== "jour" && (
            <p className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-800">
              La vue {vue === "semaine" ? "Semaine" : "Mois"} ne se met pas en liste — seule la vue{" "}
              <span className="font-bold">Jour</span> le fait. Passe à <span className="font-bold">▦ Grille</span> pour
              la voir sur ton téléphone.
            </p>
          )}
          {(() => {
            // Un seul passage : on prépare les tâches de chacun, puis on
            // affiche. La bande du haut a besoin des mêmes comptes que
            // les rangées — inutile de balayer le planning deux fois.
            const fiches = rangeesAgenda.map((emp) => {
              if (emp.enteteSection) return { emp, entete: true };
              const entrees = tachesDuJourAvecHeure(planning, jourKey, emp.id).filter(
                (e) => !e.tache.est_tache_systeme
              );
              return { emp, entrees };
            });
            const occupes = fiches.filter((f) => !f.entete && f.entrees.length > 0).length;
            const libres = fiches.filter((f) => !f.entete && f.entrees.length === 0).length;
            return (
              <>
                {/* BANDEAU D'ÉTAT — une seule ligne collée en haut : elle
                    ne replie rien, ne demande aucun geste, et répond à
                    « combien de monde travaille aujourd'hui » pendant
                    qu'on descend dans la liste. */}
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    👷 {occupes} sur le terrain
                    {libres > 0 && (
                      <span className="font-semibold text-slate-400">
                        {" "}· {libres} libre{libres > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </div>

                {fiches.map((f) => {
                  if (f.entete) return renderEnteteSection(f.emp.enteteSection);
                  const { emp, entrees } = f;
                  return (
                    <div key={emp.id} className="border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5">
                        <span className="truncate text-xs font-extrabold text-slate-700">
                          {emp.estSousTraitant ? "🤝 " : ""}{emp.nom}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-slate-400">
                          {entrees.length === 0 ? "libre" : `${entrees.length} tâche${entrees.length > 1 ? "s" : ""}`}
                        </span>
                      </div>
                      {entrees.length > 0 && (
                        <div className="space-y-1.5 p-2">
                          {entrees.map(({ tache, heure }) => {
                            const reel = (travaux || []).find(
                              (x) =>
                                x.supabase &&
                                cleTacheDesHeures(x.tacheId) === tache.id &&
                                (x.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                                x.date === jourKey &&
                                x.debutReel &&
                                x.finReelle
                            );
                            const couleur = COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT;
                            return (
                              <button
                                key={tache.id}
                                onClick={() =>
                                  !lectureSeule &&
                                  (emp.estSousTraitant
                                    ? setModalStatutST({ tache, employe: emp, date: jourKey })
                                    : setTacheDetailOuverte({ tache, employe: emp, date: jourKey, heure }))
                                }
                                className={`block w-full rounded-xl border-l-4 p-2.5 text-left ${
                                  emp.estSousTraitant
                                    ? ST_COULEURS[statutBlocST(tache.id, emp.courriel)][0]
                                    : estTerminee(tache, emp)
                                      ? "border-emerald-500 bg-emerald-50"
                                      : estEnCours(tache, emp)
                                        ? "border-fuchsia-500 bg-fuchsia-50"
                                        : `bg-white ${couleur.bordurePastille}`
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold tabular-nums text-slate-500">{heure}</span>
                                  {emp.estSousTraitant ? (
                                    <span className="text-[10px]">{ST_ICONES[statutBlocST(tache.id, emp.courriel)]}</span>
                                  ) : estTerminee(tache, emp) ? (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">TERMINÉ</span>
                                  ) : estEnCours(tache, emp) ? (
                                    <span className="rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-700">EN COURS</span>
                                  ) : null}
                                  {reel && (
                                    <span className="ml-auto text-[10px] font-bold tabular-nums text-emerald-800">
                                      {heureLocaleHHMM(reel.debutReel)} → {heureLocaleHHMM(reel.finReelle)} · {(Number(reel.heures) || 0).toFixed(2)} h
                                    </span>
                                  )}
                                </span>
                                <span className="mt-1 block text-sm font-bold leading-snug text-slate-900">
                                  {tache.titre || tache.clientNom}
                                </span>
                                {tache.clientNom && tache.titre && (
                                  <span className="block text-[11px] text-slate-500">{tache.clientNom}</span>
                                )}
                                {(tache.adresseTravaux || tache.adresseIntervention) && (
                                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                    📍 {tache.adresseTravaux || tache.adresseIntervention}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* MODE GRILLE SUR TÉLÉPHONE — on dit tout de suite ce qui
            marche et ce qui ne marche pas. Le glisser-déposer utilise
            des événements de SOURIS que le doigt n'envoie pas : plutôt
            que de laisser quelqu'un s'acharner sur un bloc qui ne
            bouge pas, on nomme la limite et on donne le chemin qui
            fonctionne. */}
        {modeAgendaMobile === "grille" && (
          <p className="border-y border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] leading-snug text-slate-500 md:hidden">
            Glisse de côté pour parcourir la journée — la colonne des noms reste en place. Déplacer une tâche au doigt
            n&apos;est pas possible : tape le bloc et change la date ou le technicien dans sa fiche.
          </p>
        )}

        {/* GRILLE CALENDRIER — un technicien par rangée. Toujours au
            bureau ; sur le téléphone, seulement si « ▦ Grille » est
            choisi (elle se parcourt alors en glissant de côté, la
            colonne des noms reste collée à gauche). */}
        <div
          ref={grilleScrollRef}
          className={`${modeAgendaMobile === "grille" ? "block" : "hidden"} flex-1 overflow-x-auto md:block`}
        >
          {vue === "jour" ? (
            <div className="min-w-[640px]">
              <div className="grid" style={{ gridTemplateColumns: `120px repeat(${HEURES.length}, minmax(52px, 1fr))` }}>
                <div className="sticky left-0 z-10 bg-white" />
                {HEURES.map((h) => (
                  <div key={h} className="border-b border-slate-200 px-1 py-2 text-center text-[10px] font-semibold text-slate-400 tabular-nums">{h}</div>
                ))}
              </div>
              {rangeesAgenda.map((emp) => {
                if (emp.enteteSection) return renderEnteteSection(emp.enteteSection);
                // SEGMENTS : une entrée par tâche (id unique) de la journée,
                // avec sa case de départ (index) et sa durée (span) — les
                // cases contiennent maintenant des LISTES de tâches, donc
                // plusieurs segments peuvent se chevaucher.
                const segments = [];
                const parId = new Map();
                for (let i = 0; i < HEURES.length; i++) {
                  listeCellule(planning[`${jourKey}|${emp.id}|${HEURES[i]}`]).forEach((t) => {
                    const seg = parId.get(t.id);
                    if (seg) {
                      seg.fin = i;
                      seg.span = i - seg.index + 1;
                    } else {
                      const nouveau = { tache: t, index: i, fin: i, span: 1 };
                      parId.set(t.id, nouveau);
                      segments.push(nouveau);
                    }
                  });
                }
                // ⏱️ HEURES RÉELLES (2026-08-19, demande du propriétaire) :
                // une tâche TERMINÉE se replace sur la grille selon son
                // VRAI début/fin chronométrés — avant, trois tâches
                // planifiées à la même heure restaient empilées l'une sur
                // l'autre alors que la journée s'était déroulée en
                // séquence (7 h, 9 h, 13 h…).
                segments.forEach((seg) => {
                  if (seg.tache.est_tache_systeme) return;
                  const reel = (travaux || []).find(
                    (t) =>
                      t.supabase &&
                      cleTacheDesHeures(t.tacheId) === seg.tache.id &&
                      (t.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                      t.date === jourKey &&
                      t.debutReel &&
                      t.finReelle
                  );
                  if (!reel) return;
                  const d = new Date(reel.debutReel);
                  const f = new Date(new Date(reel.finReelle).getTime() - 60000);
                  const iDeb = Math.max(0, Math.min(HEURES.length - 1, d.getHours()));
                  const iFin = Math.max(iDeb, Math.min(HEURES.length - 1, f.getHours()));
                  seg.index = iDeb;
                  seg.fin = iFin;
                  seg.span = iFin - iDeb + 1;
                  // Conservé sur le segment : l'étiquette du bloc affiche
                  // les heures RÉELLES (début → fin · total pointé).
                  seg.reel = reel;
                });
                // 🚚 LES TRANSPORTS SYSTÈME SUIVENT LE MOUVEMENT (retour
                // de tests 2026-08-19) : une tâche replacée à son vrai
                // départ passait PAR-DESSUS le « Début de journée » resté
                // à l'heure planifiée — les deux blocs s'empilaient.
                // Début = la case juste AVANT la première vraie tâche
                // affichée ; Fin = juste APRÈS la dernière.
                {
                  const reelsAffiches = segments.filter((s) => !s.tache.est_tache_systeme);
                  if (reelsAffiches.length > 0) {
                    const premier = Math.min(...reelsAffiches.map((s) => s.index));
                    const dernier = Math.max(...reelsAffiches.map((s) => s.fin));
                    segments.forEach((seg) => {
                      if (!seg.tache.est_tache_systeme) return;
                      if (seg.tache.momentTransport === "debut") {
                        seg.index = Math.max(0, premier - 1);
                        seg.fin = seg.index;
                        seg.span = 1;
                      } else if (seg.tache.momentTransport === "fin") {
                        seg.index = Math.min(HEURES.length - 1, dernier + 1);
                        seg.fin = seg.index;
                        seg.span = 1;
                      }
                    });
                  }
                }
                // PISTES : les tâches qui se chevauchent s'empilent — chaque
                // segment prend la première piste libre. La rangée s'étire
                // en hauteur selon le nombre de pistes : AUCUNE tâche ne
                // peut être cachée, peu importe combien partagent la plage.
                const finsParPiste = [];
                segments.sort((a, b) => a.index - b.index || b.span - a.span);
                segments.forEach((seg) => {
                  let p = finsParPiste.findIndex((fin) => fin < seg.index);
                  if (p === -1) {
                    p = finsParPiste.length;
                    finsParPiste.push(seg.fin);
                  } else {
                    finsParPiste[p] = Math.max(finsParPiste[p], seg.fin);
                  }
                  seg.piste = p;
                });
                const nbPistes = Math.max(1, finsParPiste.length);

                return (
                  <div
                    key={emp.id}
                    className="grid border-t border-slate-100"
                    style={{
                      gridTemplateColumns: `120px repeat(${HEURES.length}, minmax(52px, 1fr))`,
                      gridTemplateRows: `repeat(${nbPistes}, minmax(52px, auto))`,
                    }}
                  >
                    <div
                      style={{ gridColumn: "1", gridRow: `1 / ${nbPistes + 1}` }}
                      className="sticky left-0 z-10 flex items-center border-r border-slate-100 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                    >
                      {emp.nom}
                    </div>
                    {/* CASES DE FOND — cibles de dépôt pleine hauteur, toujours
                        présentes même sous les blocs. */}
                    {HEURES.map((h, index) => {
                      const cle = `${jourKey}|${emp.id}|${h}`;
                      return (
                        <div
                          key={h}
                          data-heure-index={index}
                          data-emp={emp.id}
                          style={{ gridColumn: `${index + 2}`, gridRow: `1 / ${nbPistes + 1}` }}
                          onDragOver={(ev) => { ev.preventDefault(); setTacheSurvolee(cle); }}
                          onDragLeave={() => setTacheSurvolee(null)}
                          onDrop={(ev) => { onDropHeure(ev, emp.id, h); setTacheSurvolee(null); }}
                          className={`border-l border-slate-100 ${tacheSurvolee === cle ? "bg-orange-50" : ""}`}
                        />
                      );
                    })}
                    {/* BLOCS DE TÂCHES — par-dessus les cases, un par segment,
                        chacun sur SA piste. */}
                    {segments.map((seg) => {
                      const h = HEURES[seg.index];
                      const enRedimensionnement =
                        redim && redim.tache.id === seg.tache.id && redim.employeId === emp.id && redim.jourCible === jourKey;
                      const spanAffiche = enRedimensionnement ? redim.spanActuel : seg.span;
                      const peutRedimensionner = !lectureSeule && !seg.tache.est_tache_systeme && (seg.tache.jours ?? 0) < 1; // ni journée complète, ni tâche système, ni lecture seule
                      return (
                        <div
                          key={seg.tache.id}
                          style={{ gridColumn: `${seg.index + 2} / span ${spanAffiche}`, gridRow: `${seg.piste + 1}` }}
                          onMouseMove={(e) => setSurvol({ tache: seg.tache, employe: emp, heure: h, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setSurvol(null)}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            // Dépôt PAR-DESSUS un bloc existant : la tâche
                            // déposée s'empile sur la case horaire visée
                            // (calculée depuis la position de la souris).
                            const rect = ev.currentTarget.getBoundingClientRect();
                            const largeurCase = rect.width / spanAffiche;
                            const idx = Math.min(
                              HEURES.length - 1,
                              seg.index + Math.max(0, Math.floor((ev.clientX - rect.left) / largeurCase))
                            );
                            onDropHeure(ev, emp.id, HEURES[idx]);
                            setTacheSurvolee(null);
                          }}
                          className={`relative z-[1] m-0.5 rounded-lg border-l-4 p-0.5 ${emp.estSousTraitant ? ST_COULEURS[statutBlocST(seg.tache.id, emp.courriel)][0] : estTerminee(seg.tache, emp) ? "border-emerald-500 bg-emerald-50" : estEnCours(seg.tache, emp) ? "border-fuchsia-500 bg-fuchsia-50" : seg.tache.est_tache_systeme ? "border-slate-400 bg-slate-100" : `${(COULEUR_TYPE_TACHE[seg.tache.typeTache] || COULEUR_TYPE_DEFAUT).clair} ${(COULEUR_TYPE_TACHE[seg.tache.typeTache] || COULEUR_TYPE_DEFAUT).bordurePastille}`}`}
                        >
                          {/* 🖱️ Clic simple = ouvrir la fiche ; clic
                              maintenu + déplacement = déplacer le bloc
                              (autre heure, autre technicien). */}
                          <button
                            draggable={!lectureSeule && !seg.tache.est_tache_systeme}
                            onDragStart={(ev) => {
                              ev.dataTransfer.setData(
                                "text/plain",
                                JSON.stringify({ deplacement: true, tacheId: seg.tache.id, employeId: emp.id })
                              );
                              ev.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => !redim && !lectureSeule && !seg.tache.est_tache_systeme && (emp.estSousTraitant ? setModalStatutST({ tache: seg.tache, employe: emp, date: jourKey }) : setTacheDetailOuverte({ tache: seg.tache, employe: emp, date: jourKey, heure: h }))}
                            className={`flex h-full w-full items-start gap-1 rounded-lg p-1 text-left text-[9px] font-semibold leading-tight ${
                              emp.estSousTraitant
                                ? ST_COULEURS[statutBlocST(seg.tache.id, emp.courriel)][1]
                                : estTerminee(seg.tache, emp)
                                ? "bg-emerald-100 text-emerald-900"
                                : estEnCours(seg.tache, emp)
                                ? "bg-fuchsia-100 text-fuchsia-900"
                                : seg.tache.est_tache_systeme
                                ? "bg-slate-200 text-slate-600"
                                : `text-black ${(COULEUR_TYPE_TACHE[seg.tache.typeTache] || COULEUR_TYPE_DEFAUT).fond}`
                            } ${enRedimensionnement ? "ring-2 ring-[#FF6A13]" : ""}`}
                          >
                            {emp.estSousTraitant && (
                              <span className="mt-px shrink-0 text-[9px]">
                                {ST_ICONES[statutBlocST(seg.tache.id, emp.courriel)]}
                                {stAConfirmer(seg.tache.id, emp.courriel, jourKey) && (
                                  <span className="ml-1 animate-pulse rounded bg-amber-200 px-1 text-[8px] font-extrabold text-amber-800">à confirmer</span>
                                )}
                              </span>
                            )}
                            {!emp.estSousTraitant && estTerminee(seg.tache, emp) && <Check size={10} className="mt-px shrink-0 text-emerald-600" />}
                            {!emp.estSousTraitant && estEnCours(seg.tache, emp) && <span className="mt-0.5 block h-2 w-2 shrink-0 animate-pulse rounded-full bg-fuchsia-500" />}
                            {seg.tache.est_tache_systeme && <Car size={10} className="mt-px shrink-0" />}
                            <span className="min-w-0">
                              {seg.tache.titre || seg.tache.clientNom}
                              {/* ⏱️ Tâche TERMINÉE : les heures RÉELLES
                                  chronométrées remplacent la durée
                                  planifiée — début → fin · total pointé
                                  (demande du propriétaire, 2026-08-19). */}
                              {seg.reel && seg.reel.debutReel && seg.reel.finReelle ? (
                                <span className="ml-1 font-bold text-emerald-800">
                                  · {heureLocaleHHMM(seg.reel.debutReel)} → {heureLocaleHHMM(seg.reel.finReelle)} · {(Number(seg.reel.heures) || 0).toFixed(2)} h
                                </span>
                              ) : (
                                spanAffiche > 1 && <span className="ml-1 opacity-60">· {spanAffiche} h</span>
                              )}
                              {seg.tache.description && spanAffiche >= 2 && (
                                <span className="mt-0.5 line-clamp-2 text-[8px] font-normal leading-tight opacity-75">
                                  {seg.tache.description}
                                </span>
                              )}
                              {travailTermine(seg.tache, emp)?.noteTerrain && spanAffiche >= 2 && (
                                <span className="mt-0.5 line-clamp-2 text-[8px] font-normal italic leading-tight text-emerald-800">
                                  📝 Note du technicien : {travailTermine(seg.tache, emp).noteTerrain}
                                </span>
                              )}
                            </span>
                          </button>
                          {peutRedimensionner && (
                            <div
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                // Mesure RÉELLE du bloc à l'écran : la durée suit
                                // ensuite la distance parcourue par la souris.
                                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                                setRedim({
                                  tache: seg.tache,
                                  employeId: emp.id,
                                  jourCible: jourKey,
                                  heureDebut: h,
                                  indexDebut: seg.index,
                                  spanInitial: seg.span,
                                  spanActuel: seg.span,
                                  origineX: rect.left,
                                  largeurCase: rect.width / seg.span,
                                });
                              }}
                              title="Glisser pour changer la durée"
                              className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize touch-none rounded-r-lg hover:bg-black/10"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={vue === "mois" ? "min-w-[900px]" : "min-w-[640px]"}>
              <div className="grid" style={{ gridTemplateColumns: `120px repeat(${joursAffiches.length}, minmax(${vue === "mois" ? 34 : 84}px, 1fr))` }}>
                <div className="sticky left-0 z-10 bg-white" />
                {joursAffiches.map((d) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div key={dateISO(d)} className={`border-b border-slate-200 px-1 py-2 text-center text-[10px] font-semibold tabular-nums ${weekend ? "text-orange-400" : "text-slate-400"}`}>
                      {vue === "semaine" ? d.toLocaleDateString("fr-CA", { weekday: "short" }) : ""}
                      <div>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {rangeesAgenda.map((emp) => {
                if (emp.enteteSection) return renderEnteteSection(emp.enteteSection);
                return (
                <div key={emp.id} className="grid border-t border-slate-100" style={{ gridTemplateColumns: `120px repeat(${joursAffiches.length}, minmax(${vue === "mois" ? 34 : 84}px, 1fr))` }}>
                  <div className="sticky left-0 z-10 flex items-center border-r border-slate-100 bg-white px-2 py-2 text-xs font-bold text-slate-700">{emp.nom}</div>
                  {joursAffiches.map((d) => {
                    const cleSurvol = `${dateISO(d)}|${emp.id}|jour`;
                    // TOUTES les tâches du jour — empilées verticalement en
                    // vue Semaine, pastilles côte à côte en vue Mois : aucune
                    // tâche n'est cachée quand elles partagent la journée.
                    // ⏱️ ORDRE CHRONOLOGIQUE RÉEL dans la pile du jour.
                    // ------------------------------------------------
                    // Corrigé le 2026-08-22 (photo du propriétaire : le
                    // « Transport — Début de journée » se retrouvait SOUS
                    // la tâche de Dominic). Le tri se faisait sur
                    // `tache.heure`, un champ que SEULS les blocs de
                    // transport portent : les vraies tâches, sans heure,
                    // remontaient toutes en tête et les deux transports
                    // tombaient au fond, dans l'ordre début-puis-fin.
                    // On prend maintenant l'heure de la CASE (celle de la
                    // grille, qui existe pour tout le monde), remplacée
                    // par l'heure RÉELLE quand la tâche a été pointée —
                    // tout le monde sur le même axe de temps.
                    const entreesJour = tachesDuJourAvecHeure(planning, dateISO(d), emp.id);
                    const minutesDe = ({ tache, heure }) => {
                      const r = (travaux || []).find(
                        (x) =>
                          x.supabase &&
                          cleTacheDesHeures(x.tacheId) === tache.id &&
                          (x.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                          x.date === dateISO(d) &&
                          x.debutReel
                      );
                      if (r) {
                        const dte = new Date(r.debutReel);
                        return dte.getHours() * 60 + dte.getMinutes();
                      }
                      const [hh, mm] = String(heure || "00:00").split(":");
                      return (Number(hh) || 0) * 60 + (Number(mm) || 0);
                    };
                    entreesJour.sort((a, b) => minutesDe(a) - minutesDe(b));
                    const tachesJour = entreesJour.map((e) => e.tache);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={dateISO(d)}
                        onDragOver={(ev) => { ev.preventDefault(); setTacheSurvolee(cleSurvol); }}
                        onDragLeave={() => setTacheSurvolee(null)}
                        onDrop={(ev) => { onDropJour(ev, emp.id, d); setTacheSurvolee(null); }}
                        onMouseLeave={() => setSurvol(null)}
                        className={`min-h-[44px] border-l border-slate-100 p-1 ${
                          tacheSurvolee === cleSurvol ? "bg-orange-50" : tachesJour.length === 0 && weekend ? "bg-slate-50" : ""
                        } ${vue === "mois" ? "flex flex-wrap content-center items-center justify-center gap-0.5" : "space-y-0.5"}`}
                      >
                        {tachesJour.map((tache) =>
                          vue === "mois" ? (
                            <button
                              key={tache.id}
                              onClick={() => !lectureSeule && !tache.est_tache_systeme && (emp.estSousTraitant ? setModalStatutST({ tache, employe: emp, date: dateISO(d) }) : setTacheDetailOuverte({ tache, employe: emp, date: dateISO(d), heure: HEURE_PAR_DEFAUT }))}
                              onMouseMove={(e) => setSurvol({ tache, employe: emp, heure: HEURE_PAR_DEFAUT, x: e.clientX, y: e.clientY })}
                              className="p-0.5"
                            >
                              <span className={`block h-2 w-2 rounded-full ${emp.estSousTraitant ? ST_COULEURS[statutBlocST(tache.id, emp.courriel)][2] : estTerminee(tache, emp) ? "bg-emerald-500" : estEnCours(tache, emp) ? "animate-pulse bg-fuchsia-500" : tache.est_tache_systeme ? "bg-slate-400" : (COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT).pastille}`} />
                            </button>
                          ) : (
                            <button
                              key={tache.id}
                              draggable={!lectureSeule && !tache.est_tache_systeme}
                              onDragStart={(ev) => {
                                ev.dataTransfer.setData(
                                  "text/plain",
                                  JSON.stringify({ deplacement: true, tacheId: tache.id, employeId: emp.id })
                                );
                                ev.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => !lectureSeule && !tache.est_tache_systeme && (emp.estSousTraitant ? setModalStatutST({ tache, employe: emp, date: dateISO(d) }) : setTacheDetailOuverte({ tache, employe: emp, date: dateISO(d), heure: HEURE_PAR_DEFAUT }))}
                              onMouseMove={(e) => setSurvol({ tache, employe: emp, heure: HEURE_PAR_DEFAUT, x: e.clientX, y: e.clientY })}
                              className={`block w-full rounded-lg border-l-4 p-1 text-left text-[9px] font-semibold leading-tight ${
                                emp.estSousTraitant
                                  ? `${ST_COULEURS[statutBlocST(tache.id, emp.courriel)][0]} ${ST_COULEURS[statutBlocST(tache.id, emp.courriel)][1]}`
                                  : estTerminee(tache, emp)
                                  ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                                  : estEnCours(tache, emp)
                                  ? "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-900"
                                  : tache.est_tache_systeme
                                  ? "border-slate-400 bg-slate-200 text-slate-600"
                                  : `border-transparent text-black ${(COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT).fond}`
                              }`}
                            >
                              <span className="flex items-start gap-1">
                                {emp.estSousTraitant && (
                                  <span className="mt-px shrink-0 text-[9px]">
                                    {ST_ICONES[statutBlocST(tache.id, emp.courriel)]}
                                    {stAConfirmer(tache.id, emp.courriel, dateISO(d)) && (
                                      <span className="ml-1 animate-pulse rounded bg-amber-200 px-1 text-[8px] font-extrabold text-amber-800">à confirmer</span>
                                    )}
                                  </span>
                                )}
                                {!emp.estSousTraitant && estTerminee(tache, emp) && <Check size={9} className="mt-px shrink-0 text-emerald-600" />}
                                {!emp.estSousTraitant && estEnCours(tache, emp) && <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-fuchsia-500" />}
                                {tache.est_tache_systeme && <Car size={9} className="mt-px shrink-0" />}
                                <span className="min-w-0">
                                  {tache.titre || tache.clientNom}
                                  {/* ⏱️ Heures RÉELLES du bloc terminé —
                                      début → fin · total pointé, pour CE
                                      technicien et CETTE journée. */}
                                  {(() => {
                                    const r = (travaux || []).find(
                                      (x) =>
                                        x.supabase &&
                                        cleTacheDesHeures(x.tacheId) === tache.id &&
                                        (x.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                                        x.date === dateISO(d) &&
                                        x.debutReel &&
                                        x.finReelle
                                    );
                                    return r ? (
                                      <span className="ml-1 font-bold text-emerald-800">
                                        · {heureLocaleHHMM(r.debutReel)} → {heureLocaleHHMM(r.finReelle)} · {(Number(r.heures) || 0).toFixed(2)} h
                                      </span>
                                    ) : null;
                                  })()}
                                  {tache.description && (
                                    <span className="mt-0.5 line-clamp-2 text-[8px] font-normal leading-tight opacity-75">
                                      {tache.description}
                                    </span>
                                  )}
                                  {travailTermine(tache, emp)?.noteTerrain && (
                                    <span className="mt-0.5 line-clamp-2 text-[8px] font-normal italic leading-tight text-emerald-800">
                                      📝 Note du technicien : {travailTermine(tache, emp).noteTerrain}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {survol && !redim && (() => {
        const client = (clients || []).find((c) => c.id === survol.tache.clientId) || (clients || []).find((c) => c.nom === survol.tache.clientNom);
        const adresse = survol.tache.adresseTravaux || (client?.adresses?.[0] ? `${client.adresses[0].nom} — ${client.adresses[0].ligne1}` : null);
        const couleur = COULEUR_TYPE_TACHE[survol.tache.typeTache] || COULEUR_TYPE_DEFAUT;
        // Décale l'infobulle du curseur (jamais pile dessous) et
        // l'empêche de sortir de l'écran à droite/en bas.
        const decalage = 14;
        const largeurEstimee = 240;
        const gauche = Math.min(survol.x + decalage, window.innerWidth - largeurEstimee - 12);
        return (
          <div
            className="pointer-events-none fixed z-[60] w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            style={{ left: gauche, top: survol.y + decalage }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${couleur.pastille}`} />
              <p className="text-xs font-bold text-slate-900">{survol.tache.titre || survol.tache.clientNom}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {survol.employe.nom}
              {vue === "jour" && <> · {survol.heure}</>}
              {(survol.tache.heures ?? 1) > 1 ? ` (${survol.tache.heures} h)` : ""}
            </p>
            {(client?.nom || survol.tache.clientNom) && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-600">
                <User size={11} className="shrink-0 text-slate-400" /> {client?.nom || survol.tache.clientNom}
              </p>
            )}
            {adresse && (
              <p className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-600">
                <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" /> {adresse}
              </p>
            )}
            {survol.tache.description && (
              <p className="mt-1.5 whitespace-pre-line border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">{survol.tache.description}</p>
            )}
            {(() => {
              const tr = travailTermine(survol.tache, survol.employe);
              if (!tr) return null;
              return (
                <div className="mt-1.5 border-t border-emerald-100 pt-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    Terminée · {tr.heures?.toFixed ? tr.heures.toFixed(2) : tr.heures} h réelles
                  </p>
                  {survol.tache.typeTache === "appel_service" && (() => {
                    // Zones 1-2-3 : temps chez le client seulement (transport
                    // inclus dans le prix). Hors zone : transport aller-retour
                    // (entrepôt) + sur place comptent dans le temps inclus.
                    const horsZone = survol.tache.zoneAppel === "hors_zone";
                    const inclusH = (horsZone ? Number(prixDepots?.minutes_incluses_hors_zone) || 180 : Number(prixDepots?.minutes_incluses) || 90) / 60;
                    const tauxV = Number(prixDepots?.taux_horaire_vendant) || 0;
                    const heuresTransport = horsZone
                      ? (travaux || [])
                          .filter((t) => t.supabase && t.estTransport && t.employeEmail === tr.employeEmail && t.date === tr.date)
                          .reduce((s, t) => s + (t.heures || 0), 0)
                      : 0;
                    const totalH = (tr.heures || 0) + heuresTransport;
                    // Dépassement facturé par TRANCHES DE 15 MIN entamées —
                    // même règle que la boîte en direct de l'app technicien.
                    const extraMinReel = Math.max(0, Math.round((totalH - inclusH) * 60 * 100) / 100);
                    const trancheMin = Number(configEnt?.trancheFacturationMin) || 15;
                    const extraFactMin = Math.ceil(extraMinReel / trancheMin) * trancheMin;
                    const extraFactH = extraFactMin / 60;
                    const detail = horsZone ? ` (total ${totalH.toFixed(2)} h dont ${heuresTransport.toFixed(2)} h transport)` : "";
                    if (extraMinReel <= 0) {
                      return <p className="mt-0.5 text-[10px] text-emerald-700">✔ Dans le temps inclus ({Math.round(inclusH * 60)} min{horsZone ? ", transport compris" : ""}){detail}</p>;
                    }
                    return (
                      <p className="mt-0.5 text-[10px] font-bold text-amber-700 tabular-nums">
                        ⏱️ Dépassement : {Math.ceil(extraMinReel)} min → facturable {extraFactMin} min (tranches de {Number(configEnt?.trancheFacturationMin) || 15})
                        {tauxV > 0
                          ? ` × ${tauxV.toFixed(2)} $/h = ${(extraFactH * tauxV).toFixed(2)} $ HT (${taxesDepot(extraFactH * tauxV, configEnt).total.toFixed(2)} $ taxes incl.)`
                          : " — définis le taux vendant dans Tarifs"}
                        {detail}
                      </p>
                    );
                  })()}
                  {tr.noteTerrain && (
                    <p className="mt-0.5 text-[11px] italic text-emerald-800">
                      📝 <span className="font-bold not-italic">Note du technicien :</span> {tr.noteTerrain}
                    </p>
                  )}
                  {tr.noteInterne && (
                    <p className="mt-0.5 text-[11px] italic text-slate-600">
                      🔒 <span className="font-bold not-italic">Note interne :</span> {tr.noteInterne}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* MODALE — DÉPÔT REÇU MANUELLEMENT */}
      {depotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setDepotModal(null))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-slate-900">Dépôt reçu manuellement</h3>
            <p className="mt-1 text-xs text-slate-500">
              « {depotModal.titre} » — confirme le paiement reçu hors QuickBooks. L'action sera consignée au journal (avec ton nom).
            </p>
            {depotDe(depotModal.tacheId) && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 tabular-nums">
                Montant attendu : {taxesDepot(depotDe(depotModal.tacheId).montantHT, configEnt).total.toFixed(2)} $ (taxes incluses)
              </p>
            )}
            <label className="mt-3 mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Mode de paiement</label>
            <select value={depotMode} onChange={(e) => setDepotMode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold">
              <option>Comptant</option>
              <option>Chèque</option>
              <option>Interac</option>
            </select>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDepotModal(null)} className="min-h-0 py-2 text-xs">Annuler</Button>
              <Button
                onClick={() => { onDepotPaye?.(depotModal.tacheId, depotMode); setDepotModal(null); }}
                className="min-h-0 py-2 text-xs"
              >
                Confirmer — débloquer la tâche
              </Button>
            </div>
          </div>
        </div>
      )}

      {tacheDetailOuverte && (
        <ModalEditionTache
          tache={tacheDetailOuverte.tache}
          clients={clients}
          dateInitiale={tacheDetailOuverte.date}
          heureInitiale={tacheDetailOuverte.heure}
          employeIdInitial={tacheDetailOuverte.employe.id}
          employes={employes}
          travailFait={travailTermine(tacheDetailOuverte.tache, tacheDetailOuverte.employe)}
          techniciensSurTache={techniciensPourTache(planning, tacheDetailOuverte.tache.id, employes)}
          onAjouterTechnicien={({ employeId, date, heureDebut, heures, jours, dupliquer }) => {
            // « Ajouter » = même tâche partagée (id identique) ; « Dupliquer »
            // = copie indépendante (nouvel id). Dans les deux cas, le
            // technicien reçoit SON horaire (date/heure/durée saisis), et
            // les transports Début/Fin se recalculent automatiquement.
            const base = dupliquer
              ? { ...tacheDetailOuverte.tache, id: `${tacheDetailOuverte.tache.id}-copie-${Date.now()}` }
              : tacheDetailOuverte.tache;
            assigner({ ...base, heures, jours }, employeId, new Date(`${date}T00:00:00`), heureDebut);
            setTacheDetailOuverte(null);
          }}
          projets={projets}
          devisListe={devisListe}
          onCreerProjetDepuisTache={(t) => {
            // 🏗️ « Créer un projet à partir de cette tâche » : un projet
            // n'est pas qu'un dossier, c'est un BUDGET — impossible à
            // deviner depuis une tâche. On pré-remplit donc ce qu'on sait
            // (client, adresse, secteur, nom, date) et l'humain n'a plus
            // qu'à entrer les montants. Le rattachement de la tâche se
            // fait ensuite au retour (voir projetDepuisTache).
            setProjetDepuisTache(t);
            setTacheDetailOuverte(null);
          }}
          onFermer={() => setTacheDetailOuverte(null)}
          onEnregistrer={(champs) => {
            modifierTachePlanifiee(tacheDetailOuverte.tache, tacheDetailOuverte.employe.id, champs);
            // Rattachements : UNE fois pour la tâche (pas par technicien).
            if (champs.projetId !== undefined || champs.devisNumero !== undefined) {
              appliquerRattachements(tacheDetailOuverte.tache, champs);
            }
            // Modification groupée : chaque technicien coché reçoit les
            // mêmes date/heure/durée/description — sur SES plages (son
            // instance est déplacée/mise à jour, pas celle des autres).
            (champs.autresCibles || []).forEach((empId) => {
              if (empId === tacheDetailOuverte.employe.id) return;
              modifierTachePlanifiee(tacheDetailOuverte.tache, empId, { ...champs, employeId: empId });
            });
            setTacheDetailOuverte(null);
          }}
          onRetirerHoraire={
            lectureSeule
              ? undefined
              : (champs) => {
                  modifierTachePlanifiee(tacheDetailOuverte.tache, tacheDetailOuverte.employe.id, {
                    ...champs,
                    employeId: null,
                    date: tacheDetailOuverte.date,
                    heureDebut: tacheDetailOuverte.heure,
                  });
                  setTacheDetailOuverte(null);
                }
          }
          annulation={contexteAnnulation(tacheDetailOuverte.tache)}
          onFermerPourTechnicien={
            lectureSeule
              ? undefined
              : (champs) => {
                  fermerTachePourTechnicien(tacheDetailOuverte.tache, tacheDetailOuverte.employe, tacheDetailOuverte.date, champs);
                  setTacheDetailOuverte(null);
                }
          }
          onAnnulerTache={
            peutOuvrirAnnulation
              ? (raison) => {
                  annulerTacheDefinitivement(tacheDetailOuverte.tache, raison);
                  setTacheDetailOuverte(null);
                }
              : undefined
          }
        />
      )}
      {tacheEnEditionId && (
        <ModalEditionTache
          employes={employes}
          tache={tachesAttente.find((t) => t.id === tacheEnEditionId)}
          clients={clients}
          onFermer={() => setTacheEnEditionId(null)}
          onEnregistrer={(champs) => enregistrerEditionRapide(tacheEnEditionId, champs)}
          annulation={contexteAnnulation(tachesAttente.find((t) => t.id === tacheEnEditionId))}
          onAnnulerTache={
            peutOuvrirAnnulation
              ? (raison) => {
                  annulerTacheDefinitivement(tachesAttente.find((t) => t.id === tacheEnEditionId), raison);
                  setTacheEnEditionId(null);
                }
              : undefined
          }
        />
      )}
      {/* 👯 TÂCHE JUMELLE — même titre, même client, même journée, MÊME
          ADRESSE : on demande avant de créer une seconde fois. Deux
          jobs le même jour à des adresses différentes ne déclenchent
          rien (cas légitime, vécu le 21 août). */}
      {doublonTache && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-base font-extrabold text-amber-700">👯 Cette tâche existe déjà</p>
            <p className="mt-2 text-[13px] leading-snug text-slate-700">
              « <span className="font-bold">{doublonTache.titre}</span> » est déjà à l&apos;horaire pour{" "}
              <span className="font-bold">{doublonTache.client || "ce client"}</span>
              {doublonTache.date ? ` le ${doublonTache.date}` : ""}, à la <span className="font-bold">même adresse</span>.
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
              Si tu la crées quand même, tes techniciens verront <span className="font-bold">deux cartes identiques</span> sur
              leur téléphone. Vérifie d&apos;abord dans l&apos;agenda.
            </p>
            <div className="mt-4 space-y-2">
              <Button variant="outline" onClick={() => setDoublonTache(null)} className="w-full">
                Annuler — je vais vérifier
              </Button>
              <button
                onClick={() => { setDoublonTache(null); creerTache(true); }}
                className="min-h-[44px] w-full rounded-xl text-[12px] font-bold text-slate-500"
              >
                C&apos;est une vraie deuxième job — créer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ FICHE CLIENT modifiable depuis la création de tâche (même
          fenêtre que l'onglet Clients — une seule logique). */}
      {clientEnEditionAgenda && (() => {
        const c = clients.find((x) => x.id === clientEnEditionAgenda);
        if (!c) return null;
        return (
          <ModalEditionClient
            client={c}
            onFermer={() => setClientEnEditionAgenda(null)}
            onEnregistrer={(champs) => {
              setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...champs } : x)));
              ajouterJournal(`✏️ Fiche client modifiée : ${champs.entreprise && champs.nomAffichage !== "nom" ? champs.entreprise : champs.nom}`);
            }}
          />
        );
      })()}

      {/* FENÊTRE — NOUVEAU CLIENT depuis la création de tâche (composant
          partagé avec l'onglet Devis, mêmes validations QuickBooks). */}
      {/* 🤝 FICHE SOUS-TRAITANT — création/édition, avec lien FACULTATIF
          vers une fiche client (même identité, deux rôles : ce qu'il te
          facture = coût, ce que tu lui factures = revenu — jamais
          mélangés). Un sous-traitant pur ne crée RIEN dans les clients. */}
      {modalFicheST && (() => {
        const f = modalFicheST;
        const clientsTries = (clients || []).slice().sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
        const clientLie = clientsTries.find((c) => c.id === f.clientId);
        // Suggestion automatique : le nom tapé ressemble à un client ?
        const nomTape = (f.nom || "").trim().toLowerCase();
        const suggestion =
          !f.clientId && nomTape.length >= 3
            ? clientsTries.find((c) => {
                const n = (c.nom || "").toLowerCase();
                return n.includes(nomTape) || nomTape.includes(n);
              })
            : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setModalFicheST(null))(); }}>
            <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-extrabold text-slate-900">🤝 {f.id ? "Modifier le sous-traitant" : "Nouveau sous-traitant"}</h3>
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Nom de l&apos;entreprise</label>
                  <input value={f.nom} onChange={(e) => setModalFicheST({ ...f, nom: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  {suggestion && (
                    <button
                      onClick={() => setModalFicheST({ ...f, clientId: suggestion.id })}
                      className="mt-1.5 w-full rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-left text-[11px] font-bold text-sky-800"
                    >
                      🔗 « {suggestion.nom} » existe dans tes clients — lier ce sous-traitant à sa fiche ?
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Spécialité</label>
                    <input value={f.specialite} onChange={(e) => setModalFicheST({ ...f, specialite: e.target.value })} placeholder="Électricien, plombier…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
                    <input type="tel" value={f.telephone} onChange={(e) => setModalFicheST({ ...f, telephone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Aussi un client ?</label>
                  <select
                    value={f.clientId || ""}
                    onChange={(e) => setModalFicheST({ ...f, clientId: e.target.value || "" })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Aucun lien (sous-traitant seulement) —</option>
                    {clientsTries.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    {clientLie
                      ? `🔗 Lié à la fiche client « ${clientLie.nom} » — ses coordonnées font foi (une seule source de vérité).`
                      : "Lier seulement si cette entreprise est AUSSI ton client — sinon laisse « aucun lien » : ta liste de clients reste propre."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Note</label>
                  <input value={f.note} onChange={(e) => setModalFicheST({ ...f, note: e.target.value })} placeholder="Taux habituel, particularités…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <Button
                  onClick={() => {
                    onEnregistrerSousTraitant?.({
                      id: f.id || String(Date.now()),
                      nom: f.nom.trim(),
                      specialite: f.specialite.trim(),
                      telephone: f.telephone.trim(),
                      note: f.note.trim(),
                      clientId: f.clientId || null,
                      actif: true,
                    });
                    setModalFicheST(null);
                    if (!stOuvert) basculerSection("st");
                  }}
                  disabled={!f.nom.trim()}
                  className="w-full"
                >
                  Enregistrer le sous-traitant
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🤝 STATUT D'UN BLOC SOUS-TRAITANT — Présent / Pas venu (+ note,
          + montant facturé qui alimente les coûts réels du projet lié). */}
      {modalStatutST && (() => {
        const { tache, employe, date } = modalStatutST;
        const a = (assignationsST || []).find((x) => x.tache_id === tache.id && x.employe_email === employe.courriel);
        const d = a?.donnees || {};
        const statut = d.stStatut || "prevu";
        const note = modalStatutST.note ?? d.stNote ?? "";
        const montant = modalStatutST.montant ?? (d.stMontant || "");
        const ficheSt = (sousTraitants || []).find((x) => `st-${x.id}` === employe.id);
        const projetLie = (projets || []).find((p) => p.id === tache.projetId);
        const valider = (nouveau) => {
          const montantNum = Math.max(0, Number(montant) || 0);
          onStatutST?.(
            tache.id,
            employe.courriel,
            { stStatut: nouveau, stNote: String(note || ""), stMontant: montantNum, stStatutLe: new Date().toISOString() },
            `🤝 ${employe.nom} — « ${tache.titre || tache.clientNom || "tâche"} » (${date}) : ${
              nouveau === "present" ? "PRÉSENT ✅" : nouveau === "absent" ? "PAS VENU ❌" : "remis à « prévu »"
            }`
          );
          if (nouveau === "present" && montantNum > 0 && tache.projetId) {
            onAjouterCoutSousTraitant?.(tache.projetId, employe.nom, montantNum, `${tache.id}|${employe.courriel}`);
          }
          setModalStatutST(null);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setModalStatutST(null))(); }}>
            <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-extrabold text-slate-900">🤝 {employe.nom}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {tache.titre || tache.clientNom || "Tâche"}{tache.clientNom && tache.titre ? ` — ${tache.clientNom}` : ""} · {date}
                {ficheSt?.telephone ? ` · 📞 ${ficheSt.telephone}` : ""}
              </p>
              <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">
                Statut actuel : {ST_ICONES[statut]} {statut === "present" ? "Présent" : statut === "absent" ? "Pas venu" : "Prévu — à confirmer après la visite"}
              </p>
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Note (facultative)</label>
                  <input
                    value={note}
                    onChange={(e) => setModalStatutST({ ...modalStatutST, note: e.target.value })}
                    placeholder="Arrivé à 9 h, travaux du sous-sol faits…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Montant qu&apos;il TE facture ($, avant taxes)</label>
                  <InputNombreDecimal
                    valeur={montant || 0}
                    onChange={(v) => setModalStatutST({ ...modalStatutST, montant: v })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    {projetLie
                      ? `S'ajoute aux coûts réels du projet « ${projetLie.nom} » en marquant Présent.`
                      : "Aucun projet lié à cette tâche — le montant est noté sur le bloc, sans coût de projet."}
                  </p>
                </div>
                <button onClick={() => valider("present")} className="min-h-[48px] w-full rounded-xl bg-emerald-600 text-sm font-extrabold text-white active:scale-[0.99]">
                  ✅ Présent — il est venu faire les travaux
                </button>
                <button onClick={() => valider("absent")} className="min-h-[48px] w-full rounded-xl border-2 border-red-300 bg-red-50 text-sm font-extrabold text-red-700 active:scale-[0.99]">
                  ❌ Pas venu
                </button>
                {statut !== "prevu" && (
                  <button onClick={() => valider("prevu")} className="min-h-[44px] w-full rounded-xl border border-slate-300 text-xs font-bold text-slate-600 active:scale-[0.99]">
                    ↩︎ Remettre « prévu »
                  </button>
                )}
                {ficheSt && !lectureSeule && (
                  <button
                    onClick={() => { setModalStatutST(null); setModalFicheST({ ...ficheSt }); }}
                    className="min-h-[40px] w-full rounded-xl text-[11px] font-bold text-slate-400 active:scale-[0.99]"
                  >
                    ✏️ Modifier la fiche du sous-traitant
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🏗️ CRÉER UN PROJET À PARTIR D'UNE TÂCHE (2026-08-22) — un projet
          est un BUDGET, pas un simple dossier : impossible de le deviner
          depuis une tâche. On pré-remplit ce qu'on sait, l'humain entre
          les montants, et la tâche (heures déjà pointées comprises) est
          rattachée au nouveau projet. La ventilation fine (transport,
          matériaux, sous-traitants) reste ajustable dans Projets. */}
      {projetDepuisTache && (
        <ModalProjetDepuisTache
          tache={projetDepuisTache}
          clients={clients}
          onFermer={() => setProjetDepuisTache(null)}
          onCreer={(projet) => {
            const t = projetDepuisTache;
            setProjetDepuisTache(null);
            onCreerProjet?.(projet);
            // La tâche rejoint son nouveau projet, avec son passé.
            rattacherTacheAuProjet(t, projet.id);
          }}
        />
      )}

      {choixFacturable && (
        <ModalChoixFacturable
          info={choixFacturable}
          onChoisir={(facturable) => {
            const c = choixFacturable;
            setChoixFacturable(null);
            majFacturableAssignation(c.tacheId, c.employe?.courriel, facturable).catch(() =>
              ajouterJournal("⚠️ Choix facturable NON enregistré (snippet 71 manquant ?) — réessaie en redéposant le technicien.")
            );
            onMajFacturable?.(c.tacheId, c.employe?.courriel, facturable);
            ajouterJournal(
              facturable
                ? `💰 ${c.employe?.nom || "Technicien"} ajouté sur « ${c.titre} » — FACTURABLE au client.`
                : `🤝 ${c.employe?.nom || "Technicien"} ajouté sur « ${c.titre} » — NON facturable (aide interne) : ses heures ne seront pas comptées dans la facturation.`
            );
          }}
        />
      )}
      {modalNouveauClientTache && (
        <ModalNouveauClient
          clients={clients}
          setClients={setClients}
          ajouterJournal={ajouterJournal}
          onFermer={() => setModalNouveauClientTache(false)}
          onSelection={(id) => {
            setNouveauClientId(id);
            setAdresseTravauxId("");
            setNouvelleAdresseTravaux(null);
            setNouveauProjetId("");
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// ONGLET FACTURATION
// ============================================================
// ============================================================
// MODAL DE FACTURATION PROGRESSIVE (travaux avec devis)
// ============================================================
function ModalFacturationDevis({ bon, devis, onFermer, onEmettre, tousLesBons }) {
  const contrat = bon.type === "entretien_contrat";
  const [type, setType] = useState(contrat ? "echeance" : "complete");
  const [pourcentage, setPourcentage] = useState(100);
  // Progression par ligne du devis — clé = ligne.uid, valeur =
  // { progressType: 'percent' | 'amount', progressPercent, billedAmount }.
  // Chaque ligne a son propre mode d'ajustement, indépendant des autres.
  const [lignesProgression, setLignesProgression] = useState({});

  // ============================================================
  // LE SOLDE SUIT LE DEVIS, PAS LE BON DE TRAVAIL
  // ------------------------------------------------------------
  // Avant, le cumul se lisait sur CE bon uniquement. Conséquence : un
  // chantier facturé 6 000 $ à la première visite, puis repris plus
  // tard par quelqu'un d'autre, créait un NOUVEAU bon sans historique —
  // qui proposait de facturer les 10 000 $ du devis une deuxième fois.
  // 16 000 $ facturés pour un contrat de 10 000 $.
  //
  // On additionne donc TOUT ce qui a été facturé contre ce devis, quelle
  // que soit la tâche, le technicien ou la date.
  const montantCumule = devis?.numero
    ? (tousLesBons || [])
        .filter((b) => b.devisNumero === devis.numero)
        .reduce((s, b) => s + (b.facturesEmises || []).reduce((x, f) => x + f.montant, 0), 0)
    : (bon.facturesEmises || []).reduce((s, f) => s + f.montant, 0);
  const montantDevis = devis ? devis.totalVendant : bon.montant;
  const montantRestant = Math.max(0, montantDevis - montantCumule);
  const frequence = bon.frequenceFacturationAnnuelle || 4;
  const montantEcheance = Math.min(montantRestant, montantDevis / frequence);

  // Récupère (ou initialise) l'état de progression d'une ligne.
  const progressionLigne = (l) =>
    lignesProgression[l.uid] || { progressType: "percent", progressPercent: 0, billedAmount: 0 };

  // Règle de calcul bidirectionnelle (section 2 des règles de gestion) :
  // modifier le % recalcule le montant, modifier le montant recalcule
  // le %. Chacun est plafonné à la valeur totale HT de SA PROPRE ligne
  // (totalHT = quantite × prix_vendant), jamais au-delà.
  const majPourcentageLigne = (l, pctBrut) => {
    const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
    const progressPercent = Math.max(0, Math.min(100, pctBrut));
    const billedAmount = Math.round(totalHT * (progressPercent / 100) * 100) / 100;
    setLignesProgression((prev) => ({ ...prev, [l.uid]: { progressType: "percent", progressPercent, billedAmount } }));
  };

  const majMontantLigne = (l, montantBrut) => {
    const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
    const billedAmount = Math.max(0, Math.min(totalHT, montantBrut));
    const progressPercent = totalHT > 0 ? Math.round((billedAmount / totalHT) * 10000) / 100 : 0;
    setLignesProgression((prev) => ({ ...prev, [l.uid]: { progressType: "amount", progressPercent, billedAmount } }));
  };

  const montantSurMesure = devis
    ? devis.lignes.reduce((s, l) => s + progressionLigne(l).billedAmount, 0)
    : 0;

  const montantCalcule =
    type === "complete"
      ? montantRestant
      : type === "echeance"
      ? montantEcheance
      : type === "pourcentage"
      ? Math.min(montantRestant, (pourcentage / 100) * montantDevis)
      : montantSurMesure;

  // Le montant à facturer ne peut jamais dépasser le solde restant du
  // devis/contrat, quelle que soit l'option choisie — c'est ce qui
  // garantit qu'on ne dépasse jamais le montant initial, même en
  // cumulant plusieurs factures progressives dans le temps.
  const depasse = montantCalcule > montantRestant + 0.01;
  const peutEmettre = montantCalcule > 0.005 && !depasse;

  // Taxes affichées à titre indicatif sur cette facture progressive
  // (mêmes taux que partout : ceux des Paramètres de l'entreprise).
  const configEnt = useEntreprise();
  const { tps: tpsCalculee, tvq: tvqCalculee, total: totalTtcCalcule } = calculerTaxes(montantCalcule, configEnt);

  const confirmer = () => {
    if (!peutEmettre) return;
    onEmettre({
      montant: Math.round(montantCalcule * 100) / 100,
      type,
      detail:
        type === "pourcentage"
          ? `${pourcentage}%`
          : type === "echeance"
          ? `1/${frequence}`
          : type === "sur_mesure"
          ? "Items sélectionnés"
          : "Complète",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Facturation — {bon.projet}</h3>
            <p className="text-xs text-slate-500">
              {contrat ? `Contrat #${bon.devisNumero} — ${frequence} factures/an` : `Devis #${bon.devisNumero}`}
            </p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {!devis && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            {contrat ? "Contrat" : "Devis"} #{bon.devisNumero} introuvable dans l&apos;onglet Devis et dans QuickBooks — plafond basé sur le montant du bon de travail ({bon.montant.toFixed(2)} $) à la place.
          </div>
        )}
        {/* 🔎 Devis retrouvé DANS QUICKBOOKS (transition — devis fait
            avant l'application) : le solde et les lignes viennent de
            l'estimate. On le dit — l'admin doit savoir d'où sortent
            les chiffres qu'il plafonne. */}
        {devis?.sourceQbo && (
          <div className="mb-3 rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">
            🔎 Devis #{devis.numero} lu depuis <span className="font-bold">QuickBooks</span> ({(devis.lignes || []).length} ligne{(devis.lignes || []).length > 1 ? "s" : ""},
            total {devis.totalVendant.toFixed(2)} $ HT) — le solde restant et la facturation progressive se calculent sur lui.
            Si l&apos;estimate change dans QuickBooks, rouvre cette fenêtre pour relire.
          </div>
        )}

        <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Montant total du {contrat ? "contrat" : "devis"}</span>
            <span className="tabular-nums font-semibold">{montantDevis.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Cumul déjà facturé</span>
            <span className="tabular-nums font-semibold">{montantCumule.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800">
            <span>Solde restant disponible</span>
            <span className="tabular-nums">{montantRestant.toFixed(2)} $</span>
          </div>
        </div>

        <div className="mb-3 space-y-2">
          <label className="block text-xs font-bold text-slate-500">Option de facturation</label>
          {[
            ...(contrat
              ? [[
                  "echeance",
                  "Facturation selon échéance du contrat",
                  frequence === 1
                    ? "montant complet en une seule facture annuelle"
                    : `1/${frequence} du montant total (${frequence} factures par an)`,
                ]]
              : []),
            ["complete", "Facturation complète", "Facture le solde restant en une fois"],
            ["pourcentage", "Facturation par pourcentage", `Facture un % du montant total du ${contrat ? "contrat" : "devis"}`],
            ["sur_mesure", "Facturation sur mesure par item", "Choisir les items et quantités à facturer"],
          ].map(([id, label, desc]) => (
            <label
              key={id}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${
                type === id ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="typeFacturation"
                checked={type === id}
                onChange={() => setType(id)}
                className="mt-0.5 accent-[#FF6A13]"
              />
              <div>
                <p className="text-xs font-bold text-slate-800">{label}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
                {id === "echeance" && <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-800">{montantEcheance.toFixed(2)} $</p>}
              </div>
            </label>
          ))}
        </div>

        {type === "pourcentage" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold text-slate-500">Pourcentage à facturer</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                value={pourcentage}
                onChange={(e) => setPourcentage(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-bold tabular-nums"
              />
              <span className="text-sm text-slate-500">% du devis</span>
              <span className="ml-auto text-sm font-bold tabular-nums text-slate-800">{montantCalcule.toFixed(2)} $</span>
            </div>
          </div>
        )}

        {type === "sur_mesure" && (
          <div className="mb-3 space-y-2">
            {!devis ? (
              <p className="text-xs text-slate-400">Détail des items indisponible — devis introuvable.</p>
            ) : (
              <>
                {devis.lignes.map((l) => {
                  const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
                  const prog = progressionLigne(l);
                  return (
                    <div key={l.uid} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{l.nom}</p>
                          <p className="text-[10px] text-slate-400">
                            {(Number(l.prix_vendant) || 0).toFixed(2)} $ × {l.quantite} — Total ligne : <span className="font-semibold text-slate-600">{totalHT.toFixed(2)} $</span>
                          </p>
                        </div>
                        {/* Bascule du mode d'ajustement de CETTE ligne */}
                        <div className="flex shrink-0 rounded-lg border border-slate-200 p-0.5">
                          {["percent", "amount"].map((m) => (
                            <button
                              key={m}
                              onClick={() =>
                                m === "percent" ? majPourcentageLigne(l, prog.progressPercent) : majMontantLigne(l, prog.billedAmount)
                              }
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                prog.progressType === m ? "bg-[#131B2E] text-white" : "text-slate-400"
                              }`}
                            >
                              {m === "percent" ? "%" : "$"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step="1"
                          value={prog.progressPercent}
                          onChange={(e) => majPourcentageLigne(l, parseFloat(e.target.value) || 0)}
                          className="flex-1 accent-[#131B2E]"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="1"
                          value={prog.progressPercent}
                          onChange={(e) => majPourcentageLigne(l, parseFloat(e.target.value) || 0)}
                          className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-right tabular-nums"
                        />
                        <span className="text-slate-400">%</span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">Montant HT facturé pour cette situation</span>
                        <div className="flex w-24 items-center gap-0.5">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            min={0}
                            max={totalHT}
                            step="0.01"
                            value={prog.billedAmount}
                            onChange={(e) => majMontantLigne(l, parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-300 px-1.5 py-1 text-right font-bold tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="px-1 text-[10px] text-slate-400">
                  Ajuster le % ou le montant recalcule automatiquement l'autre — chaque ligne est plafonnée à son propre montant total.
                </p>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-800">
                  <span>Sous-total HT sélectionné</span>
                  <span className="tabular-nums">{montantSurMesure.toFixed(2)} $</span>
                </div>
              </>
            )}
          </div>
        )}

        {depasse && (
          <p className="mb-2 text-xs font-semibold text-red-600">
            Ce montant dépasse le solde restant du devis ({montantRestant.toFixed(2)} $) — impossible de dépasser le montant initial du devis.
          </p>
        )}

        {montantCalcule > 0 && (
          <div className="mb-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total HT facturé</span><span className="tabular-nums">{montantCalcule.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span><span className="tabular-nums">{tpsCalculee.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span><span className="tabular-nums">{tvqCalculee.toFixed(2)} $</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-slate-800">
              <span>Total TTC facturé</span><span className="tabular-nums">{totalTtcCalcule.toFixed(2)} $</span>
            </div>
          </div>
        )}

        <Button disabled={!peutEmettre} onClick={confirmer} className="w-full">
          Valider et envoyer cette facture ({montantCalcule.toFixed(2)} $ HT)
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// RÉVISION D'UN PRIX NON LISTÉ — l'admin ouvre la tâche
// manuellement, ajuste le prix ET la description, puis doit
// explicitement attester avoir tout validé avant que la tâche ne
// devienne éligible à l'envoi au client (fenêtre contextuelle de
// confirmation obligatoire — pas de déblocage silencieux).
// ============================================================
function ModalReviserPrixNonListe({ bon, onFermer, onConfirmer, depotPaye, piecePrepayee, lignesSuggerees }) {
  // Config entreprise (contexte) — la tranche de facturation s'affiche
  // dans le texte d'aide du temps supplémentaire.
  const configEnt = useEntreprise();
  // Liste de prix — le sélecteur d'items en a besoin. Elle manquait :
  // ouvrir la révision de prix plantait l'écran.
  const catalogue = useCatalogue();
  // Items séparés, chacun avec sa propre description et son propre
  // prix — au démarrage, soit les items déjà enregistrés sur ce bon
  // (s'il a déjà été révisé une fois), soit une seule ligne de départ
  // pré-remplie avec le montant global existant.
  //
  // APPEL PAYÉ D'AVANCE : la ligne de déduction du dépôt s'ajoute toute
  // seule (en négatif, hors taxes — les taxes du dépôt ont déjà été
  // perçues sur ce montant, celles de la facture se calculeront sur le
  // net). Compter sur la mémoire de la personne pour la taper à la
  // main, c'est exactement comme ça qu'un client paie deux fois.
  const [items, setItems] = useState(() => {
    if (bon.lignesNonListees?.length) return bon.lignesNonListees;
    const base = [{ id: `item-${Date.now()}`, description: bon.description || "", prix: bon.montant }];
    // BLOC 4 — temps supplémentaire calculé d'avance (heures réelles,
    // tranches de 15 min, taux réduit du passager). Le détail du calcul
    // est ÉCRIT dans la description : un client qui voit le calcul
    // conteste moins qu'un client qui voit un montant sorti de nulle part.
    (lignesSuggerees || []).forEach((l, i) => {
      base.push({ id: `supp-${Date.now()}-${i}`, description: l.description, prix: l.prix });
    });
    if (depotPaye) {
      base.push({
        id: `depot-${Date.now()}`,
        description: `Dépôt perçu d'avance${depotPaye.payeLe ? ` le ${new Date(depotPaye.payeLe).toLocaleDateString("fr-CA")}` : ""} — appel de service payé d'avance`,
        prix: -(Number(depotPaye.montantHT) || 0),
      });
    }
    // BLOC 3 — pièce déjà payée par le client (option « payer avant la
    // commande ») : déduite d'office pour ne JAMAIS être chargée deux fois.
    if (piecePrepayee) {
      base.push({
        id: `piece-${Date.now()}`,
        description: `Pièce payée d'avance par le client — ${piecePrepayee.pieceRequise}`,
        prix: -(Number(piecePrepayee.montantPiece) || 0),
      });
    }
    return base;
  });
  const [attestation, setAttestation] = useState(false);

  const total = items.reduce((s, it) => s + (parseFloat(it.prix) || 0), 0);
  // ============================================================
  // CE QUI BLOQUE VRAIMENT UNE FACTURE (revu le 2026-08-24)
  // ------------------------------------------------------------
  // Avant : CHAQUE ligne devait porter un prix ≠ 0. La règle visait un
  // oubli de montant, mais elle ne faisait pas la différence entre
  // « j'ai oublié le prix » et « cette ligne EXPLIQUE au client ce qui
  // a été fait ». Le bureau écrit le déroulement du chantier sur une
  // ligne à 0 $ et la ligne facturable en dessous : c'est légitime, et
  // c'était refusé.
  //
  // Ce qui reste interdit, et pour de vraies raisons :
  //   • une description vide — une ligne muette sur la facture ;
  //   • un total à zéro ou négatif — on n'émet pas ça, jamais.
  // Un prix négatif sur UNE ligne reste permis (déduction de dépôt).
  const descriptionVide = items.some((it) => it.description.trim().length === 0);
  const nbLignesExplication = items.filter((it) => (parseFloat(it.prix) || 0) === 0).length;
  const peutValider = items.length > 0 && !descriptionVide && total > 0 && attestation;
  // Le bouton gris DIT pourquoi il est gris (règle du projet — et c'est
  // exactement là-dessus que le propriétaire a buté le 24 août).
  const raisonsBlocage = [
    descriptionVide ? "Une ligne n'a pas de description — le client verrait un montant sans explication." : null,
    total <= 0 ? "Le total doit être positif : au moins une ligne doit porter un montant à facturer." : null,
    !attestation ? "Coche la case de confirmation ci-dessus." : null,
  ].filter(Boolean);

  const majItem = (id, champs) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...champs } : it)));
  };

  const ajouterItem = () => {
    setItems((prev) => [...prev, { id: `item-${Date.now()}`, description: "", prix: 0 }]);
  };

  // Ajoute un item pré-rempli à partir du catalogue de produits
  // existant — l'admin peut ensuite ajuster la description ou le prix
  // au besoin, sans repartir d'une case vide.
  // 📝 LA DESCRIPTION COMPLÈTE SUIT (2026-08-24, retour du propriétaire).
  // Seul le NOM du produit était recopié : « Midea 28 18000 BTU » au lieu
  // des modèles, de la garantie et de ce qui est inclus. Or ce texte-ci
  // n'est pas une note interne — c'est ce que le CLIENT lit sur sa
  // facture. Il fallait donc le retaper à la main, ou le client recevait
  // une ligne muette pour 5 050 $.
  const ajouterDepuisCatalogue = (produit) => {
    if (!produit) return;
    const detail = String(produit.description || "").trim();
    const nom = String(produit.nom || "").trim();
    // Nom en tête, détail en dessous — sauf si le détail répète déjà le
    // nom (certaines fiches du catalogue commencent par leur propre nom).
    const texte = !detail ? nom : detail.toUpperCase().startsWith(nom.toUpperCase()) ? detail : `${nom}\n${detail}`;
    setItems((prev) => [...prev, { id: `item-${Date.now()}`, description: texte, prix: produit.prix_vendant ?? 0 }]);
  };

  const retirerItem = (id) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Réviser le prix non listé</h3>
            <p className="text-xs text-slate-500">{bon.projet} · {bon.client}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          Ce travail contient un prix qui n'existe pas dans le catalogue — vérifie chaque item avant d'autoriser l'envoi au client.
        </div>

        {depotPaye && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            💰 Ce client a DÉJÀ payé un dépôt de {(Number(depotPaye.montantHT) || 0).toFixed(2)} $ + taxes
            {depotPaye.payeLe ? ` le ${new Date(depotPaye.payeLe).toLocaleDateString("fr-CA")}` : ""} (appel payé d'avance).
            La ligne de déduction a été ajoutée automatiquement — ne l'enlève pas, sinon le client paierait deux fois.
          </div>
        )}
        {piecePrepayee && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            💰 La pièce « {piecePrepayee.pieceRequise} » a DÉJÀ été payée par le client
            ({(Number(piecePrepayee.montantPiece) || 0).toFixed(2)} $ HT) avant la commande.
            La déduction est ajoutée automatiquement — ne facture pas la pièce une deuxième fois.
          </div>
        )}
        {(lignesSuggerees || []).length > 0 && !bon.lignesNonListees?.length && (
          <div className="mb-3 rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">
            ⏱️ Le temps au-delà du temps inclus a été calculé automatiquement (tranches de {Number(configEnt?.trancheFacturationMin) || 15} min entamées,
            taux réduit pour un passager du même camion). Les lignes sont modifiables ou effaçables — c'est toi qui as le dernier mot.
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500">Items à facturer (description + prix séparés)</label>
            {items.map((it, i) => (
              <div key={it.id} className="rounded-xl border border-slate-200 p-2.5">
                <div className="flex items-start gap-2">
                  {/* Hauteur suivant le texte : une description de
                      catalogue fait plusieurs lignes (modèles, garantie,
                      ce qui est inclus) et se lisait par une fente de
                      deux lignes. Plafonnée à 30 rangées — au-delà, la
                      barre de défilement reprend. */}
                  <textarea
                    value={it.description}
                    onChange={(e) => majItem(it.id, { description: e.target.value })}
                    rows={hauteurDescription(it.description)}
                    placeholder={`Description de l'item ${i + 1}...`}
                    className="w-full resize-y rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm leading-snug"
                  />
                  {items.length > 1 && (
                    <button onClick={() => retirerItem(it.id)} className="mt-1 shrink-0 text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Prix ($)</span>
                  <input
                    type="number" min={0} step="0.01" value={it.prix}
                    onChange={(e) => majItem(it.id, { prix: parseFloat(e.target.value) || 0 })}
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-bold tabular-nums"
                  />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-1.5">
              <SelecteurItem catalogue={catalogue} onChoisir={ajouterDepuisCatalogue} libelle="Depuis le catalogue…" />
              <Button variant="outline" onClick={ajouterItem} className="min-h-0 gap-1.5 py-2 text-xs">
                <Plus size={13} /> Item personnalisé
              </Button>
            </div>
          </div>

          {/* Une ligne à 0 $ est VOULUE la plupart du temps (elle
              explique le travail au client) — mais si c'est un prix
              oublié, il faut le voir. On le nomme sans bloquer. */}
          {nbLignesExplication > 0 && (
            <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-slate-500">
              📝 {nbLignesExplication} ligne{nbLignesExplication > 1 ? "s" : ""} à 0 $ — elle
              {nbLignesExplication > 1 ? "s apparaîtront" : " apparaîtra"} sur la facture du client comme
              explication, sans montant. Si c&apos;est un prix oublié, c&apos;est le moment de le voir.
            </p>
          )}

          <div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
            <span>Total à facturer (HT)</span>
            <span className="tabular-nums">{total.toFixed(2)} $</span>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} className="mt-0.5 accent-[#131B2E]" />
            <span className="text-xs font-semibold text-amber-800">
              Je confirme avoir vérifié et validé chaque item et son prix — prêt pour l'envoi au client.
            </span>
          </label>

          {raisonsBlocage.length > 0 && (
            <ul className="space-y-0.5 text-[11px] font-semibold leading-snug text-slate-400">
              {raisonsBlocage.map((r) => <li key={r}>• {r}</li>)}
            </ul>
          )}
          <Button disabled={!peutValider} onClick={() => onConfirmer(items, total)} className="w-full">
            Valider et débloquer pour l&apos;envoi
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APERÇU DE LA FACTURE — VERSION CLIENT
// ------------------------------------------------------------
// Même principe que le devis et le bon de travail : coordonnées
// d'entreprise complètes, description du travail facturé, ventilation
// TPS/TVQ. S'il y a des factures progressives déjà émises, montre la
// dernière ; sinon, montre le montant total à facturer.
// ============================================================
function ApercuFactureClient({ bon, onFermer }) {
  const fiche = (useClients() || []).find((c) => c.nom === bon.client);
  // Devis d'origine — c'est lui qui porte le détail que le client a
  // accepté. Sans ça, la facture ne montrait qu'un montant global.
  const devisFacture = (useDevis() || []).find((d) => d.numero === bon.devisNumero);
  const derniereFacture = (bon.facturesEmises || [])[bon.facturesEmises?.length - 1];
  const montant = derniereFacture?.montant ?? bon.montant;
  const numero = derniereFacture?.numeroFactureQb || "À émettre";
  const date = derniereFacture?.date || bon.date;
  const configEnt = useEntreprise();
  const { tps, tvq, total } = calculerTaxes(montant, configEnt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-500">Aperçu — version envoyée au client</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-sm">
          <EnTeteEntreprise />
          <p className="mt-3 text-lg font-extrabold text-[#131B2E]">FACTURE {numero}</p>
          <p className="text-xs text-slate-500">Date : {date}</p>
          <AdressesDocument
            clientNom={bon.client}
            adresseFacturation={adresseFacturationClient(fiche)}
            adresseTravaux={bon.adresseTravaux}
          />

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Description</p>
            {/* FACTURE ISSUE D'UN DEVIS : on reprend LES LIGNES DU DEVIS.
                La facture n'affichait qu'un mot tapé au moment de
                facturer (« Complète ») et un montant. Le client
                recevait 19 430 $ sans savoir pour quoi — alors qu'il
                avait accepté un devis détaillé. Reprendre ses lignes,
                c'est lui montrer exactement ce qu'il a approuvé. */}
            {devisFacture?.lignes?.length > 0 && !(bon.lignesNonListees?.length > 0) ? (
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {devisFacture.lignes.map((l) => (
                    <tr key={l.uid} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-2 text-slate-700">
                        <span className="font-semibold">{l.nom}</span>
                        {l.description ? (
                          <span className="mt-0.5 block whitespace-pre-line text-[10px] leading-snug text-slate-500">
                            {l.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-center tabular-nums text-slate-500">{l.quantite}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold text-slate-800">
                        {((Number(l.prix_vendant) || 0) * (Number(l.quantite) || 0)).toFixed(2)} $
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : bon.lignesNonListees?.length > 0 ? (
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {/* Ligne à 0 $ = explication, pas un montant nul : on
                      laisse la colonne de droite VIDE. « 0.00 $ » à côté
                      d'un texte d'explication se lit comme une erreur de
                      facturation. Et `whitespace-pre-line` conserve les
                      retours de ligne du technicien. */}
                  {bon.lignesNonListees.map((it) => {
                    const montant = parseFloat(it.prix) || 0;
                    return (
                      <tr key={it.id} className="border-b border-slate-100 align-top">
                        <td className={`py-1 pr-2 whitespace-pre-line ${montant === 0 ? "text-slate-500" : "text-slate-700"}`}>
                          {it.description}
                        </td>
                        <td className="py-1 text-right tabular-nums font-semibold text-slate-800">
                          {montant === 0 ? "" : `${montant.toFixed(2)} $`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {derniereFacture?.detail || bon.description || bon.projet}
              </p>
            )}
          </div>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{montant.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span><span className="tabular-nums">{tps.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span><span className="tabular-nums">{tvq.toFixed(2)} $</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{total.toFixed(2)} $</span>
            </div>
          </div>

          <TermesConditions />

          <PiedDocument />
        </div>

        <BoutonPDF type="facture" bon={{ ...bon, adresseFacturation: bon?.adresseFacturation || adresseFacturationClient(fiche) }} />

        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — la facture réelle est générée et envoyée via QuickBooks, avec ce même contenu.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// FENÊTRE D'AVANT-ENVOI — le choix de paiement PAR FACTURE
// ------------------------------------------------------------
// Règle validée avec le propriétaire : pour tout ce qui n'est pas un
// dépôt d'appel de service, offrir la carte ou le virement est une
// DÉCISION HUMAINE, facture par facture — cases décochées par défaut,
// et les frais du marchand affichés en DOLLARS sur le montant réel
// (2,9 % sur 8 450 $, ça se juge mieux en voyant « ≈ 245 $ »).
// Ces frais ne s'ajoutent JAMAIS à la facture du client (LPC Québec).
// ============================================================
function ModalChoixPaiementFacture({ montant, clientNom, onFermer, onEmettre }) {
  const [carte, setCarte] = useState(false);
  const [virement, setVirement] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const fraisCarte = montant * 0.029 + 0.25;
  const fraisVirement = montant * 0.01;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-slate-900">💳 Paiement en ligne pour cette facture ?</h3>
        <p className="mt-1 text-xs text-slate-500">
          {montant.toFixed(2)} $ — {clientNom || "client"}. Les frais indiqués sont TON coût de marchand : ils ne
          s'ajoutent jamais à la facture du client (loi québécoise).
        </p>
        <div className="mt-3 space-y-2">
          <label className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${carte ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={carte} onChange={(e) => setCarte(e.target.checked)} className="h-4 w-4 accent-[#131B2E]" />
              Carte de crédit
            </span>
            <span className="tabular-nums text-slate-400">frais ≈ {fraisCarte.toFixed(2)} $</span>
          </label>
          <label className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${virement ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={virement} onChange={(e) => setVirement(e.target.checked)} className="h-4 w-4 accent-[#131B2E]" />
              Virement bancaire
            </span>
            <span className="tabular-nums text-slate-400">frais ≈ {fraisVirement.toFixed(2)} $</span>
          </label>
          {!carte && !virement && (
            <p className="text-[10px] text-slate-400">Rien de coché = le client paie par Interac ou chèque — aucuns frais.</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button
            loading={envoiEnCours}
            onClick={async () => {
              setEnvoiEnCours(true);
              await onEmettre({ carte, virement });
            }}
            className="min-h-0 py-2 text-xs"
          >
            Émettre la facture
          </Button>
        </div>
      </div>
    </div>
  );
}

function OngletFacturation({ bons, setBons, ajouterJournal, devisListe, clients, depots, pieces, inspections, prixDepots, estAdminPrincipal, onAjouterCourrielClient, facturablesAssignations = {}, assignationsST = [], onMarquerSTFacture, travaux = [], zonePourTache = null, achatsLibres = [], nomsEmployes = {} }) {
  // 📦 Éditeur du matériel de stock d'un bon — { bonId, items } | null.
  const [materielStockPour, setMaterielStockPour] = useState(null);
  const catalogueFacturation = useCatalogue();
  // (`configEnt` est déclaré plus bas dans ce composant — même portée.)
  // DÉPÔT DÉJÀ PAYÉ sur cette tâche (appel de service payé d'avance).
  // Sans ce raccord, la révision de prix demandait le PLEIN montant
  // comme si rien n'avait été payé — le client risquait de payer deux
  // fois. Le dépôt et le bon partagent le même identifiant de tâche.
  // `depots` est un ANNUAIRE par tâche ({ tacheId: depot }), pas une
  // liste — même lecture que depotDe() dans l'agenda. Le traiter comme
  // une liste plantait tout l'onglet Facturation.
  // 🕐 LES HEURES DE TOUTE L'ÉQUIPE (2026-08-27) — depuis la MÊME
  // source que la paie (travaux_effectues), pas depuis le bon : seul le
  // DERNIER technicien crée le bon, avec SES heures — la carte
  // sous-facturait chaque job d'équipe (Dominic 3 h + Philippe 4 h →
  // la carte montrait 4 h, et la révision proposait 4 h au client).
  // Clé exacte + clés « id::jour » des chantiers multi-jours ; dîner,
  // transports et heures administratives/divers exclus (le transport
  // réel a déjà son propre calcul dans la révision).
  const estLigneChantier = (t) =>
    t.supabase && !t.estTransport && (Number(t.heures) || 0) > 0 &&
    !/dîner|diner|lunch/i.test(t.titre || "") && (t.categorieHeures || "projet") === "projet";
  const travauxDeTache = (tacheId) =>
    tacheId ? (travaux || []).filter((t) => String(t.tacheId || "").split("::")[0] === tacheId && estLigneChantier(t)) : [];
  // Équipe ASSIGNÉE à la tâche — dérivée des clés de
  // facturablesAssignations (posées pour CHAQUE assignation au
  // chargement) ; les sous-traitants (st::) ne sont pas des techniciens
  // à attendre.
  const equipeAssignee = (tacheId) =>
    !tacheId
      ? []
      : Object.keys(facturablesAssignations)
          .filter((k) => k.startsWith(`${tacheId}|`))
          .map((k) => k.slice(String(tacheId).length + 1))
          .filter((c) => c && !c.startsWith("st::"));
  const depotPayePour = (tacheId) => {
    if (!tacheId) return null;
    const d = depots?.[tacheId];
    return d && (d.payeLe || String(d.statut || "").startsWith("paye")) ? d : null;
  };
  // PIÈCE PAYÉE D'AVANCE par le client (option « payer avant la
  // commande ») — même logique que le dépôt : déduite automatiquement
  // de la facture du retour pour ne JAMAIS être chargée deux fois.
  const piecePrepayeePour = (tacheId) => {
    if (!tacheId) return null;
    const p = (pieces || []).find((x) => x.tacheRetourId === tacheId);
    return p && p.paiementAvantCommande && p.paiementRecu && Number(p.montantPiece) > 0 ? p : null;
  };
  // BLOC 4 — TEMPS SUPPLÉMENTAIRE calculé d'avance pour les appels de
  // service : heures réelles de CHAQUE technicien, temps inclus du
  // dépôt, tranches de 15 minutes entamées, et taux réduit pour le
  // passager (il n'amène pas de camion — l'inspection du matin nous le
  // dit). Les lignes arrivent PRÉ-REMPLIES dans la révision, jamais
  // verrouillées : la machine calcule, l'humain décide.
  const lignesTempsSupp = (b) => {
    if (!b || b.type !== "appel_service") return [];
    const tauxV = Number(prixDepots?.taux_horaire_vendant) || 0;
    if (tauxV <= 0) return [];
    const camion = Number(configEnt?.coutCamionHoraire) || 0;
    // 🤝 Les techniciens déclarés NON FACTURABLES (choix du répartiteur
    // à l'assignation) sortent du calcul — leurs heures restent payées
    // et comptées aux coûts, mais jamais suggérées au client.
    const estNonFacturable = (s) =>
      facturablesAssignations[`${b.tacheId || ""}|${(s.employeEmail || "").toLowerCase()}`] === false;
    // Heures RÉELLES de toute l'équipe d'abord (2026-08-27) — le bon ne
    // porte que les heures du dernier technicien.
    const sources = ((b.lignesReelles && b.lignesReelles.length > 0 ? b.lignesReelles : b.lignesSource) || [b]).filter(
      (s) => (Number(s.heures) || 0) > 0 && !estNonFacturable(s)
    );
    if (sources.length === 0) return [];
    // 🗺️ LA RÈGLE SUIT LA ZONE (2026-08-25) — la même que l'info-bulle
    // de l'agenda, enfin appliquée ICI aussi :
    //   • Zones 1-2-3 : 90 min incluses CHEZ LE CLIENT (le transport est
    //     déjà dans le prix de zone) — temps du chronomètre seulement.
    //   • Hors zone : 180 min incluses AU TOTAL — le transport RÉEL du
    //     technicien ce jour-là compte dans le temps inclus.
    // Avant, la suggestion appliquait toujours la règle des zones : un
    // appel hors zone était suggéré avec la mauvaise règle, transport
    // jamais compté. Toujours du temps RÉEL pointé — jamais le bloc
    // d'agenda.
    const horsZone = (zonePourTache ? zonePourTache(b.tacheId) : null) === "hors_zone";
    const transportReelDe = (s) =>
      horsZone
        ? (travaux || [])
            .filter(
              (t) =>
                t.supabase &&
                t.estTransport &&
                (t.employeEmail || "").toLowerCase() === (s.employeEmail || "").toLowerCase() &&
                t.date === (s.date || b.date)
            )
            .reduce((somme, t) => somme + (Number(t.heures) || 0), 0)
        : 0;
    // Passager ce jour-là ? (déclaré le matin, pas déduit) → taux réduit.
    const estPassager = (nom, date) =>
      (inspections || []).some((i) => i.date === date && i.passagerDeNom && i.technicienNom === nom);
    // Le temps inclus appartient à L'APPEL, pas à chaque technicien : il
    // se consomme d'abord sur les heures au PLEIN taux (avantage client).
    const tries = sources
      .map((s) => ({
        nom: s.employeNom || "",
        heures: (Number(s.heures) || 0) + transportReelDe(s),
        passager: estPassager(s.employeNom, s.date || b.date),
      }))
      .sort((a, x) => (a.passager ? 1 : 0) - (x.passager ? 1 : 0));
    let inclusRestant =
      (horsZone ? Number(prixDepots?.minutes_incluses_hors_zone) || 180 : Number(prixDepots?.minutes_incluses) || 90) / 60;
    const lignes = [];
    tries.forEach((s) => {
      const consomme = Math.min(inclusRestant, s.heures);
      inclusRestant -= consomme;
      const extraH = s.heures - consomme;
      if (extraH <= 0.0001) return;
      // Tranches de 15 minutes ENTAMÉES — la règle validée.
      const trancheMin = Number(configEnt?.trancheFacturationMin) || 15;
      const factH = (Math.ceil(Math.round(extraH * 60) / trancheMin) * trancheMin) / 60;
      const taux = s.passager ? Math.max(0, tauxV - camion) : tauxV;
      lignes.push({
        description:
          `Temps supplémentaire${s.nom ? ` — ${s.nom}` : ""}${s.passager ? " (même camion)" : ""}${horsZone ? " (hors zone — transport compté)" : ""} : ` +
          `${factH.toFixed(2)} h × ${taux.toFixed(2)} $/h`,
        prix: Math.round(factH * taux * 100) / 100,
      });
    });
    return lignes;
  };
  const configEnt = useEntreprise();
  const [bonFacturationId, setBonFacturationId] = useState(null);
  // Fenêtre d'avant-envoi : { mode: "simple"|"progressive", bonId,
  // info?, montant, clientNom, courriels } — remplie quand le choix des
  // courriels est confirmé, juste AVANT l'émission réelle.
  const [paiementAConfirmer, setPaiementAConfirmer] = useState(null);
  // Bon en attente d'un envoi simple à QB ("Envoyer à QB") — le
  // sélecteur de courriel s'ouvre avant l'envoi réel.
  const [bonEnvoiCourrielId, setBonEnvoiCourrielId] = useState(null);
  const [bonEnvoiClientId, setBonEnvoiClientId] = useState(null);
  const [bonRetraitId, setBonRetraitId] = useState(null);
  // Détails d'une facture progressive déjà configurée dans
  // ModalFacturationDevis, en attente du choix du courriel avant
  // l'émission réelle vers QuickBooks.
  const [factureEnAttenteCourriel, setFactureEnAttenteCourriel] = useState(null); // { bonId, montant, type, detail }
  // Bon "prix non listé" en cours de révision manuelle par l'admin.
  const [bonAReviserId, setBonAReviserId] = useState(null);
  const [factureAperçuId, setFactureAperçuId] = useState(null);
  const bonAReviser = bons.find((b) => b.id === bonAReviserId) || null;

  const reviserPrixNonListe = (bonId, items, total) => {
    const b = bons.find((x) => x.id === bonId);
    setBons((prev) =>
      prev.map((x) =>
        x.id === bonId
          ? { ...x, montant: total, lignesNonListees: items, description: items.map((it) => it.description).join(" · "), prixNonListe: false }
          : x
      )
    );
    ajouterJournal(
      `✍️ Prix révisé et validé pour "${b?.projet}" — ${items.length} item${items.length > 1 ? "s" : ""} séparé${items.length > 1 ? "s" : ""}, total ${total.toFixed(2)} $. Débloqué pour l'envoi au client.`
    );
    setBonAReviserId(null);
  };

  // ============================================================
  // UN TRAVAIL = UNE FACTURE, MÊME À PLUSIEURS TECHNICIENS
  // ------------------------------------------------------------
  // La table des bons de travail porte une ligne PAR TECHNICIEN
  // (contrainte tache_id × employe_email). Marc et Sophie sur le même
  // appel de service produisaient donc DEUX demandes de facturation :
  // rien n'empêchait de facturer deux fois le même travail.
  //
  // On regroupe ici par tâche. Le client paie un TRAVAIL, pas des
  // techniciens : les heures s'additionnent, le montant reste unique.
  //
  // Au passage, une tâche rattachée à un DEVIS récupère le montant
  // déjà négocié — elle n'a rien à faire dans la pile « prix à réviser ».
  const bonsGroupes = useMemo(() => {
    const parTache = new Map();
    (bons || []).forEach((b) => {
      const cle = b.tacheId || b.id;
      const existant = parTache.get(cle);
      if (!existant) {
        parTache.set(cle, {
          ...b,
          lignesSource: [b],
          heures: Number(b.heures) || 0,
          equipe: b.employeNom ? [{ nom: b.employeNom, heures: Number(b.heures) || 0, courriel: b.employeEmail || "" }] : [],
        });
        return;
      }
      // Heures cumulées de toute l'équipe, un seul montant.
      existant.heures += Number(b.heures) || 0;
      existant.lignesSource.push(b);
      if (b.employeNom) existant.equipe.push({ nom: b.employeNom, heures: Number(b.heures) || 0, courriel: b.employeEmail || "" });
      // Photos et signatures : on garde tout ce qui existe.
      existant.photosAvantUrls = [...(existant.photosAvantUrls || []), ...(b.photosAvantUrls || [])];
      existant.photosApresUrls = [...(existant.photosApresUrls || []), ...(b.photosApresUrls || [])];
      existant.signeParNom = existant.signeParNom || b.signeParNom;
      existant.clientAbsent = existant.clientAbsent || b.clientAbsent;
      // Si UNE des lignes est déjà facturée, le travail l'est.
      if (b.statutQb !== "en_attente") existant.statutQb = b.statutQb;
    });

    return [...parTache.values()].map((b) => {
      // 🕐 Les heures de la carte = TOUTES les heures de chantier de la
      // tâche (source paie), détaillées par technicien — le bon, lui,
      // ne porte que celles du dernier (2026-08-27).
      let enrichi = b;
      const reelles = travauxDeTache(b.tacheId);
      if (reelles.length > 0) {
        const parEmp = new Map();
        reelles.forEach((t) => {
          const cle = (t.employeEmail || t.employeNom || "?").toLowerCase();
          const e = parEmp.get(cle) || { nom: t.employeNom || t.employeEmail || "?", courriel: t.employeEmail || "", heures: 0 };
          e.heures += Number(t.heures) || 0;
          parEmp.set(cle, e);
        });
        const equipe = [...parEmp.values()];
        enrichi = {
          ...b,
          equipe,
          heures: Math.round(equipe.reduce((somme, e) => somme + e.heures, 0) * 100) / 100,
          lignesReelles: reelles,
          // 👥 Les PHOTOS de toute l'équipe (2026-08-27) : le bon ne
          // porte que celles du dernier à fermer — la galerie de la
          // carte compose l'union avec celles enregistrées par chaque
          // technicien (y compris celles arrivées APRÈS l'envoi du bon,
          // par le rattrapage réseau).
          photosAvantUrls: [...new Set([...(b.photosAvantUrls || []), ...reelles.flatMap((t) => t.photosAvantUrls || [])])],
          photosApresUrls: [...new Set([...(b.photosApresUrls || []), ...reelles.flatMap((t) => t.photosApresUrls || [])])],
        };
      }
      // Le montant d'un devis accepté est déjà connu — on le reprend.
      if (!enrichi.devisNumero || !enrichi.prixNonListe) return enrichi;
      const devis = (devisListe || []).find((d) => d.numero === enrichi.devisNumero);
      if (!devis) return enrichi;
      return { ...enrichi, montant: Number(devis.totalVendant) || 0, prixNonListe: false };
    });
  }, [bons, devisListe]);

  const enAttente = bonsGroupes.filter((b) => b.statutQb === "en_attente");
  const rouges = enAttente.filter((b) => b.prixNonListe).length;
  const bleus = enAttente.filter((b) => !b.prixNonListe && b.type === "devis").length;
  const violets = enAttente.filter((b) => !b.prixNonListe && b.type === "entretien_contrat").length;
  const gris = enAttente.filter((b) => !b.prixNonListe && b.type === "appel_service").length;
  const retires = bonsGroupes.filter((b) => b.statutQb === "retire").length;
  const jaunes = enAttente.filter((b) => !b.prixNonListe && b.type !== "devis" && b.type !== "entretien_contrat" && b.type !== "appel_service").length;

  // Catégorie d'un bon — reprend exactement la même logique que les 5
  // encadrés ci-dessus, pour que le filtrage par clic reste toujours
  // cohérent avec les compteurs affichés.
  const categorieBon = (b) => {
    if (b.statutQb === "retire") return "retire";
    if (b.prixNonListe) return "rouge";
    if (b.type === "entretien_contrat") return "violet";
    if (b.type === "devis") return "bleu";
    if (b.type === "appel_service") return "gris";
    return "jaune";
  };

  // Filtre multi-sélection sur les encadrés — clic pour activer/
  // désactiver une catégorie, plusieurs en même temps possible (union :
  // montre tout ce qui correspond à AU MOINS une des catégories
  // cochées). Aucun filtre actif = tout s'affiche, comme avant.
  const [filtresActifs, setFiltresActifs] = useState([]);
  const basculerFiltre = (categorie) => {
    setFiltresActifs((prev) => (prev.includes(categorie) ? prev.filter((c) => c !== categorie) : [...prev, categorie]));
  };
  const bonsAffiches = filtresActifs.length === 0 ? bonsGroupes.filter((b) => categorieBon(b) !== "retire") : bonsGroupes.filter((b) => filtresActifs.includes(categorieBon(b)));
  // 📄 Pagination (2026-08-26) : 10 cartes par page — les plus grosses
  // cartes de l'application s'empilaient sans fin. Changer de filtre
  // ramène page 1 ; la borne Math.min évite toute page vide.
  const [pageFact, setPageFact] = useState(1);
  const refListeFact = useRef(null);
  useEffect(() => { setPageFact(1); }, [filtresActifs]);
  const pageFactEff = Math.min(pageFact, Math.max(1, Math.ceil(bonsAffiches.length / ITEMS_PAR_PAGE)));
  const bonsPageines = bonsAffiches.slice((pageFactEff - 1) * ITEMS_PAR_PAGE, pageFactEff * ITEMS_PAR_PAGE);
  // Factures dont l'envoi par QuickBooks n'est pas (encore) confirmé au
  // registre — l'alerte passive de l'onglet.
  // En mode MANUEL (choix de l'entreprise), « pas envoyé » n'est pas un
  // problème — l'alerte ne compte qu'en mode automatique.
  const envoisAConfirmer =
    configEnt?.envoiAutoFactureQb === true
      ? bonsGroupes.reduce(
          (s, x) => s + (x.facturesEmises || []).filter((f) => f.qboInvoiceId && f.envoiQb?.statut !== "envoyee").length,
          0
        )
      : 0;

  const bonFacturation = bons.find((b) => b.id === bonFacturationId) || null;
  // ============================================================
  // 🔎 DEVIS QUICKBOOKS RECONNU (2026-08-25) — TRANSITION.
  // ------------------------------------------------------------
  // Un numéro tapé à la main (devis fait dans QuickBooks avant
  // l'application) n'existait pas dans devisListe : le garde-fou
  // anti-dépassement se rabattait sur le montant du bon, la facture ne
  // montrait pas les lignes acceptées, et la facturation progressive
  // était impossible. À l'ouverture de la fenêtre, si le numéro est
  // inconnu de l'application, on va LIRE l'estimate dans QuickBooks et
  // on le sert au même moule qu'un devis maison. Mis en cache par
  // numéro (la fenêtre peut se rouvrir dix fois). Introuvable : la
  // fenêtre garde son comportement d'avant, et le Journal le dit.
  // ============================================================
  const [devisQboCache, setDevisQboCache] = useState({});
  const devisFacturation = bonFacturation
    ? devisListe.find((d) => d.numero === bonFacturation.devisNumero) ||
      devisQboCache[bonFacturation.devisNumero] ||
      null
    : null;
  useEffect(() => {
    if (!bonFacturation?.devisNumero) return;
    const numero = bonFacturation.devisNumero;
    if (devisListe.some((d) => d.numero === numero)) return; // devis maison — rien à chercher
    // Relu à CHAQUE ouverture de la fenêtre (pas de cache figé) : si le
    // comptable ajuste l'estimate dans QuickBooks entre deux factures,
    // le solde suit. Le cache ne sert qu'à afficher tout de suite
    // pendant que la relecture arrive.
    const dejaConnu = devisQboCache[numero] !== undefined;
    let annule = false;
    lireEstimateQbo(numero).then((r) => {
      if (annule) return;
      if (r?.trouve) {
        setDevisQboCache((prev) => ({
          ...prev,
          [numero]: {
            numero,
            sourceQbo: true,
            totalVendant: Number(r.total) || 0,
            // Même forme que les lignes d'un devis maison — la fenêtre
            // de facturation progressive n'y voit que du feu.
            lignes: (r.lignes || []).map((l, i) => ({
              uid: `qbo-${numero}-${i}`,
              nom: l.description,
              description: "",
              quantite: Number(l.quantite) || 1,
              prix_vendant: Number(l.prixUnitaire) || 0,
            })),
          },
        }));
        if (!dejaConnu) {
          ajouterJournal(
            `🔎 Devis ${numero} retrouvé dans QuickBooks (${(r.lignes || []).length} ligne${(r.lignes || []).length > 1 ? "s" : ""}, total ${(Number(r.total) || 0).toFixed(2)} $ HT) — solde et facturation progressive branchés dessus.`
          );
        }
      } else if (r?.trouve === false) {
        setDevisQboCache((prev) => ({ ...prev, [numero]: null }));
        if (!dejaConnu) {
          ajouterJournal(
            `🔎 Devis ${numero} INTROUVABLE dans QuickBooks — la facturation se fait sur le montant du bon (vérifie le numéro si un devis existe vraiment).`
          );
        }
      }
      // nonConnecte / simule / erreur réseau : silencieux — comportement
      // d'avant (montant du bon), rien de cassé.
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonFacturationId]);
  const bonEnvoiCourriel = bons.find((b) => b.id === bonEnvoiCourrielId) || null;
  const bonEnvoiClient = bons.find((b) => b.id === bonEnvoiClientId) || null;
  const bonRetrait = bonsGroupes.find((b) => b.id === bonRetraitId) || null;
  const bonFactureEnAttente = factureEnAttenteCourriel ? bons.find((b) => b.id === factureEnAttenteCourriel.bonId) : null;

  // Trouve le client d'un bon par son NOM (ces bons de démo n'ont
  // qu'un nom de client, pas d'id — en prod, `bons` porterait un vrai
  // clientId et cette étape de recherche par nom disparaîtrait).
  const trouverClientDuBon = (bon) => clients.find((c) => c.nom === bon?.client);

  // ------------------------------------------------------------
  // 📸 BON DE TRAVAIL AU CLIENT — le lien public (SANS prix).
  // ------------------------------------------------------------
  // Le client reçoit « vos travaux sont terminés » avec le lien vers
  // /bon/[jeton] : descriptif, photos avant/après avec légendes et
  // signature — ni soumission ni facture (décision du propriétaire,
  // 2026-08-15). Lien valide 90 jours (conservé s'il court toujours,
  // régénéré s'il est expiré), PDF téléchargeable sur la page. Le
  // journal ne dit « envoyé » que si c'est vrai.
  // ------------------------------------------------------------
  // RETRAIT DE FACTURATION — demande, validation, remise en pile.
  // ------------------------------------------------------------
  // La demande est ouverte à qui voit la facturation ; la VALIDATION
  // est réservée à l'Admin principal. Tout passe au journal — aucune
  // facture ne disparaît sans trace.
  // ⚠️ CIBLAGE (corrigé 2026-08-17, vécu) : le retrait s'applique par
  // TÂCHE (un travail à plusieurs techniciens se retire d'un bloc) —
  // mais un bon SANS identifiant de tâche (cartes de démonstration,
  // anciennes données) faisait « indéfini = indéfini » : demander le
  // retrait d'UNE carte l'affichait sur TOUTES. Sans tacheId, on cible
  // le bon lui-même, et rien ne part en base (aucune ligne à modifier).
  const memeCibleRetrait = (b) => (x) => (b.tacheId ? x.tacheId === b.tacheId : x.id === b.id);
  const demanderRetrait = async (b, raison, note) => {
    try {
      if (b.tacheId) await demanderRetraitFacturation(b.tacheId, raison, note);
      const cible = memeCibleRetrait(b);
      setBons((prev) => prev.map((x) => (cible(x) ? { ...x, retraitStatut: "demande", retraitRaison: raison, retraitNote: note || "" } : x)));
      ajouterJournal(`🕓 Retrait de facturation DEMANDÉ — ${b.client} : ${RAISONS_RETRAIT[raison] || raison}. Un Admin principal doit valider.`);
    } catch {
      ajouterJournal("⚠️ Demande de retrait NON enregistrée — réessaie.");
    }
  };
  const validerRetrait = async (b, approuve) => {
    try {
      if (b.tacheId) await validerRetraitFacturation(b.tacheId, approuve, b.retraitRaison);
      const cible = memeCibleRetrait(b);
      setBons((prev) => prev.map((x) => {
        if (!cible(x)) return x;
        if (!approuve) return { ...x, retraitStatut: null, retraitRaison: null, retraitNote: "" };
        if (b.retraitRaison === "travaux_en_cours") return { ...x, retraitStatut: "reporte" };
        return { ...x, retraitStatut: "retire", statutQb: "retire" };
      }));
      ajouterJournal(
        approuve
          ? b.retraitRaison === "travaux_en_cours"
            ? `🔄 Report APPROUVÉ — ${b.client} sera facturé à la prochaine journée de facturation.`
            : `🗂️ Retrait APPROUVÉ — ${b.client} sort de la facturation (${RAISONS_RETRAIT[b.retraitRaison] || b.retraitRaison}). Ses coûts restent comptés dans l'analyse.`
          : `↩️ Retrait REFUSÉ — le bon de ${b.client} reste à facturer.`
      );
    } catch {
      ajouterJournal("⚠️ Validation du retrait NON enregistrée — réessaie.");
    }
  };
  const remettreBonAFacturer = async (b) => {
    try {
      if (b.tacheId) await remettreAFacturer(b.tacheId);
      const cible = memeCibleRetrait(b);
      setBons((prev) => prev.map((x) => (cible(x) ? { ...x, retraitStatut: null, retraitRaison: null, retraitNote: "", statutQb: "en_attente" } : x)));
      ajouterJournal(`↩️ ${b.client} REMIS à facturer.`);
    } catch {
      ajouterJournal("⚠️ Remise à facturer NON enregistrée — réessaie.");
    }
  };

  // ------------------------------------------------------------
  // GARANTIE D'ENVOI QUICKBOOKS — PDF officiel, renvoi, vérification.
  // ------------------------------------------------------------
  const [verifEnvoisEnCours, setVerifEnvoisEnCours] = useState(false);
  const ouvrirPdfFacture = async (f) => {
    if (!f?.qboInvoiceId) return;
    const ok = await ouvrirFacturePdfQbo(f.qboInvoiceId);
    if (!ok) ajouterJournal("⚠️ PDF indisponible — QuickBooks non connecté ou facture introuvable.");
  };
  const appliquerEnvoiQb = (bonId, factureLigneId, envoiQb) => {
    setBons((prev) => prev.map((x) => {
      if (x.id !== bonId) return x;
      const liste = (x.facturesEmises || []).map((f) => (f.id === factureLigneId ? { ...f, envoiQb } : f));
      if (String(x.id).startsWith("sbb-")) {
        majFacturesEmises(String(x.id).slice(4), liste, x.statutQb === "envoye" ? "envoye" : "a_facturer").catch(() => {});
      }
      return { ...x, facturesEmises: liste };
    }));
  };
  const renvoyerFactureQb = async (b, f) => {
    const adresses = (f.courrielsEnvoi || []).filter(Boolean);
    if (adresses.length === 0) {
      ajouterJournal(`⚠️ Aucun destinataire noté sur la facture ${f.numeroFactureQb} — impossible de renvoyer.`);
      return;
    }
    const r = await envoyerFactureQbo(f.qboInvoiceId, adresses);
    if (r?.envoyee) {
      appliquerEnvoiQb(b.id, f.id, { statut: "envoyee", date: r.envoyeeLe || new Date().toISOString() });
      ajouterJournal(`✉️ Facture ${f.numeroFactureQb} ENVOYÉE par QuickBooks à ${adresses.join(", ")} — confirmé au registre.`);
    } else {
      appliquerEnvoiQb(b.id, f.id, { statut: "non_confirme", date: null });
      ajouterJournal(`⚠️ Facture ${f.numeroFactureQb} : envoi toujours NON confirmé${r?.erreur ? ` (${r.erreur})` : r?.nonConnecte ? " (QuickBooks non connecté)" : ""}.`);
    }
  };
  const verifierTousEnvois = async () => {
    const aVerifier = [];
    bons.forEach((x) => (x.facturesEmises || []).forEach((f) => {
      if (f.qboInvoiceId) aVerifier.push({ bonId: x.id, factureLigneId: f.id, qbId: f.qboInvoiceId });
    }));
    if (aVerifier.length === 0) {
      ajouterJournal("Aucune facture QuickBooks à vérifier — rien d'émis encore.");
      return;
    }
    setVerifEnvoisEnCours(true);
    const r = await verifierEnvoisQbo(aVerifier.map((x) => x.qbId));
    setVerifEnvoisEnCours(false);
    if (!r?.statuts) {
      ajouterJournal(`⚠️ Vérification impossible — ${r?.erreur || (r?.nonConnecte ? "QuickBooks non connecté" : r?.simule ? "QuickBooks non configuré ici" : "réessaie")}.`);
      return;
    }
    let ok = 0;
    let manquantes = 0;
    aVerifier.forEach((x) => {
      const s = r.statuts[x.qbId];
      if (!s) return;
      if (s.envoyee) { ok += 1; appliquerEnvoiQb(x.bonId, x.factureLigneId, { statut: "envoyee", date: s.envoyeeLe || new Date().toISOString() }); }
      else { manquantes += 1; appliquerEnvoiQb(x.bonId, x.factureLigneId, { statut: "non_confirme", date: null }); }
    });
    ajouterJournal(
      manquantes === 0
        ? `✅ Vérification des envois : ${ok} facture(s) confirmée(s) envoyée(s) par QuickBooks — rien ne s'est perdu.`
        : `⚠️ Vérification des envois : ${manquantes} facture(s) JAMAIS envoyée(s) par QuickBooks — bouton Renvoyer sur leur carte.`
    );
  };

  const envoyerBonAuClient = async (b, choix) => {
    const adresses = [...new Set((choix || []).map((cc) => cc.email))].filter(Boolean);
    if (adresses.length === 0) return;
    const rowId = String(b.id).startsWith("sbb-") ? String(b.id).slice(4) : null;
    if (!rowId) {
      ajouterJournal(`⚠️ Bon de « ${b.client} » pas encore synchronisé — impossible de créer le lien client.`);
      return;
    }
    try {
      const jeton = await assurerJetonBon(rowId);
      const r = await envoyerCourriel({
        a: adresses,
        sujet: `Vos travaux sont terminés — bon de travail (${configEnt.nomCommercial || configEnt.nomLegal})`,
        html: gabaritBonTravail({ config: configEnt, clientNom: b.client, lien: lienBonPublic(jeton), joursValidite: JOURS_VALIDITE_BON }),
      });
      if (r.envoye) {
        marquerBonEnvoyeClient(rowId).catch(() => {});
        setBons((prev) => prev.map((x) => (x.id === b.id ? { ...x, envoyeClientLe: new Date().toISOString() } : x)));
        ajouterJournal(`📸 Bon de travail de ${b.client} ENVOYÉ à ${adresses.join(", ")} — descriptif avec photos, sans prix, lien valide ${JOURS_VALIDITE_BON} jours.`);
      } else if (r.simule) {
        ajouterJournal(`🔧 Envoi SIMULÉ du bon au client (service de courriels non configuré) — le lien existe : ${lienBonPublic(jeton)}`);
      } else {
        ajouterJournal(`⚠️ Bon de travail de ${b.client} NON envoyé — ${r.erreur}`);
      }
    } catch {
      ajouterJournal("⚠️ Bon de travail NON envoyé — le lien n'a pas pu être créé. Réessaie.");
    }
  };

  // VRAIE FACTURE QUICKBOOKS (2026-08-15) — le numéro vient de
  // QuickBooks, plus jamais inventé. `paiements` = le choix HUMAIN fait
  // dans la fenêtre d'avant-envoi (carte/virement, décochés par défaut).
  // Un échec QuickBooks n'invente rien : le bon RESTE « en attente » et
  // le journal dit pourquoi — pas de numéro fictif sur un vrai échec.
  const envoyerQb = async (id, choixCourriels, paiements = {}) => {
    const destinataires = listeDestinataires(choixCourriels);
    const b = bons.find((x) => x.id === id);
    if (!b) return;
    const fiche = trouverClientDuBon(b);
    // Les lignes réelles de la révision (déductions incluses) — sinon le
    // montant global du bon.
    const lignes = b.lignesNonListees?.length
      ? b.lignesNonListees.map((l) => ({ description: l.description, montant: parseFloat(l.prix) || 0 }))
      : [{ description: b.projet || "Travaux", montant: Number(b.montant) || 0 }];
    const r = await creerFactureQbo({
      clientId: fiche?.id || null,
      clientNom: b.client,
      lignes,
      termePaiement: configEnt?.termePaiementDefaut || "Net 30",
      reference: b.projet || "travaux",
      paiementCarte: paiements.carte === true,
      paiementVirement: paiements.virement === true,
      // QuickBooks envoie lui-même SA facture — seulement si
      // l'entreprise a activé l'envoi automatique (Paramètres).
      envoyerA: configEnt?.envoiAutoFactureQb === true ? destinataires.map((c) => c.email) : [],
      adresseTravaux: b.adresseTravaux || null,
    });
    if (r?.erreur) {
      ajouterJournal(`⚠️ Facture QuickBooks NON créée pour "${b.projet}" : ${r.erreur} — le bon reste en attente`);
      return;
    }
    if (r?.nonConnecte) {
      ajouterJournal("🔌 QuickBooks non connecté — facture NON créée (Paramètres → Connexions). Le bon reste en attente.");
      return;
    }
    const numeroReel = r?.docNumber || r?.factureId || `QBINV-${Math.floor(10000 + Math.random() * 90000)}`;
    // La PREUVE d'envoi — lue du registre QuickBooks par la route.
    const envoiQbSimple = r?.envoiQb
      ? r.envoiQb.envoyee
        ? { statut: "envoyee", date: r.envoiQb.envoyeeLe || new Date().toISOString() }
        : { statut: "non_confirme", date: null }
      : null;
    const entree = {
      id: `fact-${Date.now()}`,
      montant: Number(b.montant) || lignes.reduce((x, l) => x + l.montant, 0),
      type: "complete",
      detail: "envoi direct",
      date: dateISO(new Date()),
      numeroFactureQb: numeroReel,
      qboInvoiceId: r?.factureId || null,
      courrielEnvoi: destinataires[0]?.email || null,
      courrielsEnvoi: destinataires.map((c) => c.email),
      envoiQb: envoiQbSimple,
    };
    const nouvelles = [...(b.facturesEmises || []), entree];
    setBons((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, statutQb: "envoye", facturesEmises: nouvelles, courrielFacturation: destinataires[0]?.email || null, courrielsFacturation: destinataires.map((c) => c.email) }
          : x
      )
    );
    // PERSISTANCE — les factures émises survivent enfin au rechargement.
    if (String(b.id).startsWith("sbb-")) {
      majFacturesEmises(String(b.id).slice(4), nouvelles, "envoye").catch(() =>
        ajouterJournal("⚠️ Facture émise affichée mais NON enregistrée en base — vérifie la connexion.")
      );
    }
    ajouterJournal(
      r?.creee
        ? `🧾 Facture QuickBooks Nº ${numeroReel} créée (Sandbox) pour "${b.projet}"${paiements.carte || paiements.virement ? ` — paiement en ligne offert : ${[paiements.carte ? "carte" : null, paiements.virement ? "virement" : null].filter(Boolean).join(" + ")}` : ""}${envoiQbSimple ? (envoiQbSimple.statut === "envoyee" ? ` — ✉️ ENVOYÉE par QuickBooks à ${libelleDestinataires(destinataires)} (confirmé au registre)` : " — ⚠️ envoi par QuickBooks NON CONFIRMÉ : bouton Renvoyer sur la carte") : destinataires.length > 0 ? ` — destinataires notés : ${libelleDestinataires(destinataires)}` : ""}`
        : `🧪 QuickBooks non configuré ici — numéro local ${numeroReel} (normal en développement)`
    );
    setBonEnvoiCourrielId(null);
  };

  // Émet une facture progressive pour un travail « avec devis » ou
  // « entretien selon contrat ». Le solde restant plafonne toujours le
  // montant possible (voir ModalFacturationDevis) — le statut ne passe
  // à « envoyé » que lorsque le cumul atteint le montant total du
  // devis/contrat.
  const emettreFacture = async (bonId, { montant, type, detail }, choixCourriels, paiements = {}) => {
    const destinataires = listeDestinataires(choixCourriels);
    // Le devis maison d'abord ; sinon le devis QuickBooks retrouvé par
    // numéro — son total sert au statut « envoyé » (cumul atteint).
    const numeroDevisBon = bons.find((b) => b.id === bonId)?.devisNumero;
    const devisCourant = devisListe.find((d) => d.numero === numeroDevisBon) || devisQboCache[numeroDevisBon] || null;
    // Chaque facture — complète OU partielle (par pourcentage, par item,
    // ou par échéance de contrat) — est envoyée individuellement à
    // QuickBooks et y crée sa propre facture, avec son propre numéro.
    // Une tâche facturée en plusieurs fois génère donc plusieurs
    // factures QuickBooks distinctes, toutes rattachées au même devis.
    // VRAIE facture QuickBooks — le numéro fictif ne sert plus que de
    // repli quand QuickBooks n'est pas configuré (développement local).
    const fiche = trouverClientDuBon(bons.find((x) => x.id === bonId) || {});
    const libelle = type === "pourcentage" ? `${detail}` : type === "echeance" ? `échéance (${detail})` : type === "sur_mesure" ? "sur mesure par item" : "complète";
    const rQbo = await creerFactureQbo({
      clientId: fiche?.id || null,
      clientNom: bons.find((x) => x.id === bonId)?.client || "",
      lignes: [{ description: `${bons.find((x) => x.id === bonId)?.projet || "Travaux"} — facturation ${libelle}`, montant }],
      termePaiement: configEnt?.termePaiementDefaut || "Net 30",
      reference: `${bons.find((x) => x.id === bonId)?.devisNumero || "travaux"}`,
      paiementCarte: paiements.carte === true,
      paiementVirement: paiements.virement === true,
      // QuickBooks envoie SA facture — seulement si l'entreprise a
      // activé l'envoi automatique. La route relit la preuve au registre.
      envoyerA: configEnt?.envoiAutoFactureQb === true ? destinataires.map((c) => c.email) : [],
      adresseTravaux: bons.find((x) => x.id === bonId)?.adresseTravaux || null,
    });
    if (rQbo?.erreur || rQbo?.nonConnecte) {
      ajouterJournal(
        rQbo?.nonConnecte
          ? "🔌 QuickBooks non connecté — facture NON créée (Paramètres → Connexions)."
          : `⚠️ Facture QuickBooks NON créée : ${rQbo.erreur} — rien n'a été émis`
      );
      return;
    }
    const numeroFactureQb = rQbo?.docNumber || rQbo?.factureId || `QBINV-${Math.floor(10000 + Math.random() * 90000)}`;
    // La PREUVE d'envoi — lue du registre QuickBooks par la route.
    const envoiQb = rQbo?.envoiQb
      ? rQbo.envoiQb.envoyee
        ? { statut: "envoyee", date: rQbo.envoiQb.envoyeeLe || new Date().toISOString() }
        : { statut: "non_confirme", date: null }
      : null;
    setBons((prev) =>
      prev.map((b) => {
        if (b.id !== bonId) return b;
        const nouvelles = [
          ...(b.facturesEmises || []),
          {
            id: `fact-${Date.now()}`,
            montant,
            type,
            detail,
            date: dateISO(new Date()),
            numeroFactureQb,
            qboInvoiceId: rQbo?.factureId || null,
            courrielEnvoi: destinataires[0]?.email || null,
            courrielsEnvoi: destinataires.map((c) => c.email),
            envoiQb,
          },
        ];
        const cumul = nouvelles.reduce((s, f) => s + f.montant, 0);
        const total = devisCourant ? devisCourant.totalVendant : b.montant;
        const complet = cumul >= total - 0.01;
        return { ...b, facturesEmises: nouvelles, statutQb: complet ? "envoye" : "en_attente" };
      })
    );
    const b = bons.find((x) => x.id === bonId);
    // PERSISTANCE — reconstruit la même liste que le setBons ci-dessus
    // (b est l'état AVANT ajout) et l'écrit en base avec le statut.
    if (b && String(b.id).startsWith("sbb-")) {
      const listePersistee = [
        ...(b.facturesEmises || []),
        { id: `fact-${Date.now()}`, montant, type, detail, date: dateISO(new Date()), numeroFactureQb, qboInvoiceId: rQbo?.factureId || null, courrielEnvoi: destinataires[0]?.email || null, courrielsEnvoi: destinataires.map((c) => c.email), envoiQb },
      ];
      const totalAttendu = devisCourant ? devisCourant.totalVendant : b.montant;
      const cumulPersiste = listePersistee.reduce((x, f) => x + f.montant, 0);
      majFacturesEmises(String(b.id).slice(4), listePersistee, cumulPersiste >= totalAttendu - 0.01 ? "envoye" : "a_facturer").catch(() =>
        ajouterJournal("⚠️ Facture émise affichée mais NON enregistrée en base — vérifie la connexion.")
      );
    }
    ajouterJournal(
      `🧾 Facture${rQbo?.creee ? " QuickBooks" : " (locale)"} Nº ${numeroFactureQb} de ${montant.toFixed(2)} $ (${libelle}) créée pour "${b?.projet}" — ${b?.type === "entretien_contrat" ? "contrat" : "devis"} #${b?.devisNumero}` +
        `${paiements.carte || paiements.virement ? ` — paiement en ligne : ${[paiements.carte ? "carte" : null, paiements.virement ? "virement" : null].filter(Boolean).join(" + ")}` : ""}` +
        (envoiQb
          ? envoiQb.statut === "envoyee"
            ? ` — ✉️ ENVOYÉE par QuickBooks à ${libelleDestinataires(destinataires)} (confirmé au registre)`
            : ` — ⚠️ envoi par QuickBooks NON CONFIRMÉ : bouton Renvoyer sur la carte`
          : destinataires.length > 0
            ? ` — destinataires notés : ${libelleDestinataires(destinataires)}`
            : "")
    );
    setBonFacturationId(null);
    setFactureEnAttenteCourriel(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      {/* 🤝 SOUS-TRAITANCE À FACTURER (2026-08-19) — la ceinture de
          sécurité : chaque visite de sous-traitant marquée « Présent »
          reste ici tant que le client n'a pas été facturé. */}
      {(() => {
        const aFacturer = (assignationsST || []).filter(
          (a) => a?.donnees?.stStatut === "present" && !a?.donnees?.stFacture
        );
        if (aFacturer.length === 0) return null;
        return (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
              🤝 Sous-traitance à facturer au client ({aFacturer.length})
            </p>
            <div className="mt-2 space-y-1.5">
              {aFacturer.map((a) => (
                <div key={`${a.tache_id}|${a.employe_email}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800">
                      {a.titre || "Tâche"}{a.client_nom ? ` — ${a.client_nom}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {a.employe_nom || "Sous-traitant"} · {a.date_debut}
                      {Number(a?.donnees?.stMontant) > 0 ? ` · il te facture ${Number(a.donnees.stMontant).toFixed(2)} $` : ""}
                      {a?.donnees?.stNote ? ` · 📝 ${a.donnees.stNote}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => onMarquerSTFacture?.(a.tache_id, a.employe_email)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                  >
                    ✓ Facturé au client
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-amber-700">
              Une visite disparaît d&apos;ici quand tu la marques facturée — rien ne s&apos;oublie.
            </p>
          </div>
        );
      })()}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <button
          onClick={() => basculerFiltre("rouge")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("rouge") ? "border-red-400 bg-red-50 ring-2 ring-red-300" : "border-red-100 bg-red-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-red-600 tabular-nums">{rouges}</p>
          <p className="text-xs font-semibold text-red-600">À réviser — prix non listé</p>
        </button>
        <button
          onClick={() => basculerFiltre("bleu")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("bleu") ? "border-blue-400 bg-blue-50 ring-2 ring-blue-300" : "border-blue-100 bg-blue-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-blue-600 tabular-nums">{bleus}</p>
          <p className="text-xs font-semibold text-blue-600">À valider — selon devis</p>
        </button>
        <button
          onClick={() => basculerFiltre("violet")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("violet") ? "border-purple-400 bg-purple-50 ring-2 ring-purple-300" : "border-purple-100 bg-purple-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-purple-600 tabular-nums">{violets}</p>
          <p className="text-xs font-semibold text-purple-600">À valider — contrat</p>
        </button>
        <button
          onClick={() => basculerFiltre("jaune")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("jaune") ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300" : "border-amber-100 bg-amber-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{jaunes}</p>
          <p className="text-xs font-semibold text-amber-600">Prêts — bon de commande</p>
        </button>
        <button
          onClick={() => basculerFiltre("gris")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("gris") ? "border-teal-400 bg-teal-100 ring-2 ring-teal-300" : "border-teal-200 bg-teal-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-teal-600 tabular-nums">{gris}</p>
          <p className="text-xs font-semibold text-teal-700">Appels de service</p>
        </button>
        <button
          onClick={() => basculerFiltre("retire")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("retire") ? "border-slate-400 bg-slate-100 ring-2 ring-slate-300" : "border-slate-200 bg-slate-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-slate-500 tabular-nums">{retires}</p>
          <p className="text-xs font-semibold text-slate-500">Retirés — garantie / maison</p>
        </button>
      </div>

      {/* GARANTIE D'ENVOI — le filet : compare nos factures au registre
          d'envoi de QuickBooks. Toute facture créée mais jamais partie
          remonte ici avec son bouton Renvoyer. */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="min-w-0 text-[11px] text-slate-500">
          {envoisAConfirmer > 0 ? (
            <span className="font-bold text-red-600">⚠️ {envoisAConfirmer} facture{envoisAConfirmer > 1 ? "s" : ""} dont l'envoi par QuickBooks n'est pas confirmé</span>
          ) : (
            <span>✉️ Envois par QuickBooks : aucun problème connu</span>
          )}
        </p>
        <button
          onClick={verifierTousEnvois}
          disabled={verifEnvoisEnCours}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 active:scale-95 disabled:opacity-50"
        >
          {verifEnvoisEnCours ? "Vérification…" : "🔎 Vérifier les envois"}
        </button>
      </div>

      {filtresActifs.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
          <span>{bonsAffiches.length} résultat{bonsAffiches.length > 1 ? "s" : ""} filtré{bonsAffiches.length > 1 ? "s" : ""}</span>
          <button onClick={() => setFiltresActifs([])} className="font-semibold text-slate-700 underline underline-offset-2">
            Effacer les filtres
          </button>
        </div>
      )}

      <div ref={refListeFact} className="space-y-2">
        {bonsPageines.map((b) => {
          const contrat = b.type === "entretien_contrat";
          const devisType = b.type === "devis";
          const enAttenteValidation = !b.prixNonListe && (devisType || contrat) && b.statutQb === "en_attente";
          const couleurPastille = b.prixNonListe
            ? "bg-red-500"
            : contrat
            ? "bg-purple-500"
            : devisType
            ? "bg-blue-500"
            : b.type === "appel_service"
            ? "bg-teal-500"
            : "bg-amber-400";
          const montantCumule = (b.facturesEmises || []).reduce((s, f) => s + f.montant, 0);
          const devisAssocie = devisType || contrat ? devisListe.find((d) => d.numero === b.devisNumero) : null;
          const montantDevisTotal = devisAssocie ? devisAssocie.totalVendant : b.montant;
          // 📱 flex-wrap (séance 3 mobile) : sur téléphone, la colonne
          // des montants/boutons passe SOUS le contenu au lieu de
          // l'écraser — même carte, deux étages.
          return (
            <div key={b.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${couleurPastille}`} />
              <div className="min-w-[230px] flex-1">
                <p className="text-sm font-bold text-slate-900">{b.projet}</p>
                <p className="text-xs text-slate-500">{b.client} · {b.date}</p>
                {/* ÉQUIPE — visible seulement quand ils sont plusieurs.
                    Les heures s'additionnent (elles vont au coût du
                    projet), mais le montant facturé reste unique : le
                    client paie un travail, pas des techniciens. */}
                {/* BON NON SIGNÉ — le filet. La signature est la preuve
                    que le client accepte les travaux ; la perdre (parce
                    qu'un collègue n'est pas venu, ou par oubli) doit
                    sauter aux yeux AVANT la facturation, pas après une
                    contestation. */}
                {/* CLIENT ABSENT (clause 10) : ce n'est PAS un oubli de
                    signature — les travaux sont réputés reçus. Info,
                    pas alerte : on facture normalement. */}
                {/* RETRAIT DE FACTURATION — les trois états, toujours
                    visibles LÀ où on facture : demande en attente
                    (l'Admin principal tranche ici même), report approuvé,
                    retrait approuvé (le bon vit sous l'encadré « Retirés »). */}
                {b.retraitStatut === "demande" && (
                  <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    🕓 <span className="font-extrabold">Retrait demandé :</span> {RAISONS_RETRAIT[b.retraitRaison] || b.retraitRaison}
                    {b.retraitNote ? <span className="block text-[10px]">Note : {b.retraitNote}</span> : null}
                    {b.retraitDemandePar ? <span className="block text-[10px] text-amber-700">Par {b.retraitDemandePar}</span> : null}
                    {estAdminPrincipal ? (
                      <span className="mt-1 flex gap-2">
                        <button onClick={() => validerRetrait(b, true)} className="rounded-lg bg-amber-600 px-2 py-1 text-[10px] font-bold text-white active:scale-95">
                          Approuver le retrait
                        </button>
                        <button onClick={() => validerRetrait(b, false)} className="rounded-lg border border-amber-400 px-2 py-1 text-[10px] font-bold text-amber-700 active:scale-95">
                          Refuser
                        </button>
                      </span>
                    ) : (
                      <span className="block text-[10px] font-bold">En attente d'un Admin principal.</span>
                    )}
                  </div>
                )}
                {b.retraitStatut === "reporte" && (
                  <p className="mt-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                    🔄 Reporté — sera facturé à la prochaine journée de facturation
                    {b.retraitValidePar ? ` (approuvé par ${b.retraitValidePar})` : ""}.
                  </p>
                )}
                {b.statutQb === "retire" && (
                  <p className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                    🗂️ Retiré de la facturation — {RAISONS_RETRAIT[b.retraitRaison] || b.retraitRaison}
                    {b.retraitValidePar ? ` · approuvé par ${b.retraitValidePar}` : ""}. Ses coûts restent comptés dans l'analyse.
                  </p>
                )}
                {b.clientAbsent ? (
                  <p className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                    ℹ️ Client absent à la fin des travaux — travaux réputés reçus (clause 10 des conditions).
                    Bon non signé, mention au dossier.
                  </p>
                ) : b.signeParCollegue && !b.signeParNom ? (
                  <p className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    ✍️ Signature recueillie par un collègue sur place (équipe de 2+) — un seul bon envoyé au client.
                  </p>
                ) : (
                  !b.signeParNom && (
                    <p className="mt-1 flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Bon de travail NON SIGNÉ par le client — à valider avant de facturer.
                    </p>
                  )
                )}
                {/* 🚧 TRAVAUX NON TERMINÉS — l'avertissement le plus fort
                    de la carte, placé AVANT tout le reste : facturer un
                    travail inachevé, c'est le rappel du client le
                    lendemain. Ce que le technicien a écrit sur le
                    terrain est repris mot pour mot — c'est là-dessus
                    que le retour se planifie. */}
                {b.travauxNonTermines && (
                  <p className="mt-1 whitespace-pre-line rounded-lg border-2 border-orange-400 bg-orange-50 px-2 py-1.5 text-[11px] leading-snug text-orange-900">
                    🚧 <span className="font-extrabold">TRAVAUX NON TERMINÉS — il faut retourner sur place.</span>
                    {b.resteAFaire && <span className="mt-1 block font-semibold">Reste à faire : {b.resteAFaire}</span>}
                    <span className="mt-1 block text-[10px]">
                      Les heures faites se facturent normalement — mais planifie le retour avant de fermer le dossier.
                    </span>
                  </p>
                )}
                {/* PIÈCE À COMMANDER — visible LÀ OÙ TU REGARDES DÉJÀ.
                    La réparation n'est pas finie : une 2e visite sera
                    facturée séparément, elle attend la pièce. */}
                {b.pieceACommander && (
                  <p className="mt-1 whitespace-pre-line rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
                    🔧 <span className="font-extrabold">Pièce à commander :</span> {b.pieceRequise}
                    {(b.modeleUnite || b.serieUnite) && (
                      <span className="block text-[10px] text-amber-700">
                        {b.modeleUnite}
                        {b.modeleUnite && b.serieUnite ? " · " : ""}
                        {b.serieUnite ? `Nº ${b.serieUnite}` : ""}
                      </span>
                    )}
                    <span className="block text-[10px]">Suivi dans l&apos;onglet « Pièces en commande ».</span>
                  </p>
                )}
                {/* Unité relevée sans pièce à commander — alimente quand
                    même le registre d'équipements du client. */}
                {!b.pieceACommander && (b.modeleUnite || b.serieUnite) && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Unité : {b.modeleUnite}
                    {b.modeleUnite && b.serieUnite ? " · " : ""}
                    {b.serieUnite ? `Nº ${b.serieUnite}` : ""}
                  </p>
                )}
                {(b.equipe || []).length > 1 && (
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                    <User size={11} className="shrink-0 text-slate-400" />
                    {b.equipe.map((t, i) => (
                      <span key={i} className="rounded-full bg-slate-100 px-1.5 py-0.5">
                        {t.nom} <span className="tabular-nums text-slate-400">{t.heures.toFixed(2)} h</span>
                        {facturablesAssignations[`${b.tacheId || ""}|${(t.courriel || "").toLowerCase()}`] === false && (
                          <span className="ml-0.5 font-bold text-slate-500" title="Déclaré NON facturable à l'assignation — heures payées mais jamais suggérées au client">🤝</span>
                        )}
                      </span>
                    ))}
                    <span className="font-bold tabular-nums text-slate-700">= {b.heures.toFixed(2)} h au total</span>
                  </p>
                )}
                {/* ⏳ ÉQUIPE INCOMPLÈTE (2026-08-27) : l'équipe assignée est
                    comparée à ceux dont les heures sont RENTRÉES — sans ce
                    badge, le bureau pouvait facturer un travail à moitié
                    compté sans aucun avertissement. S'éteint tout seul dès
                    que les heures du retardataire arrivent. */}
                {(() => {
                  const assignes = equipeAssignee(b.tacheId);
                  if (assignes.length < 2) return null;
                  const rentres = new Set((b.lignesReelles || []).map((t) => (t.employeEmail || "").toLowerCase()));
                  const manquants = assignes.filter((c) => !rentres.has(c));
                  if (manquants.length === 0) return null;
                  const noms = manquants.map((c) => nomsEmployes[c] || c).join(", ");
                  return (
                    <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-bold leading-snug text-amber-800">
                      ⏳ Équipe incomplète — {noms} n'{manquants.length > 1 ? "ont" : "a"} pas fermé sa tâche (0 h).
                      {" "}{manquants.length > 1 ? "Leurs" : "Ses"} heures manqueront à la facture si tu factures maintenant.
                    </p>
                  );
                })()}
                {b.adresseTravaux && (
                  <div className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-400">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span>Travaux : {b.adresseTravaux}</span>
                  </div>
                )}
                {/* 📦 MATÉRIEL AUX COÛTS (2026-08-25) — coût INTERNE de la
                    job, jamais sur un document client. Deux sources :
                    les items de STOCK au coût standard (forfait murale,
                    prise…) posés ici par le bureau, et les ACHATS
                    rattachés à la tâche (BC libre → tâche). */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMaterielStockPour({ bonId: (b.lignesSource?.[0]?.id || b.id), items: (b.lignesSource?.[0]?.materielStock || b.materielStock || []) })}
                    className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:border-slate-500"
                  >
                    📦 Matériel du stock{(() => {
                      const items = b.lignesSource?.[0]?.materielStock || b.materielStock || [];
                      const total = items.reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0);
                      return items.length > 0 ? ` : ${total.toFixed(2)} $ (${items.length})` : " — ajouter";
                    })()}
                  </button>
                  {(() => {
                    const achats = (achatsLibres || []).filter((a) => a.tacheId && a.tacheId === b.tacheId);
                    if (achats.length === 0) return null;
                    const total = achats.reduce((s, a) => s + (a.montantAttribue != null ? a.montantAttribue : a.montantHT), 0);
                    return (
                      <span
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                        title={achats.map((a) => `${a.numeroBc} — ${a.description} (${(a.montantAttribue != null ? a.montantAttribue : a.montantHT).toFixed(2)} $)`).join("\n")}
                      >
                        🧾 Achats rattachés : {total.toFixed(2)} $ ({achats.length} BC)
                      </span>
                    );
                  })()}
                </div>
                {/* DÉPÔT DÉJÀ PERÇU — écrit sur la carte, pas seulement
                    dans la fenêtre de révision : la personne qui balaie
                    la pile doit le voir AVANT d'ouvrir quoi que ce soit. */}
                {depotPayePour(b.tacheId) && (
                  <p className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    💰 Appel payé d'avance — dépôt de {depotPayePour(b.tacheId).montantHT.toFixed(2)} $ + taxes déjà perçu
                    {depotPayePour(b.tacheId).payeLe ? ` le ${new Date(depotPayePour(b.tacheId).payeLe).toLocaleDateString("fr-CA")}` : ""} · sera déduit de la facture
                  </p>
                )}
                <p className="mt-1 text-xs font-semibold">
                  {b.prixNonListe ? (
                    <span className="text-red-600">À facturer – Prix non listé</span>
                  ) : contrat ? (
                    <span className="text-purple-600">
                      À valider – Entretien contrat #{b.devisNumero} ({b.frequenceFacturationAnnuelle || 4}×/an)
                    </span>
                  ) : devisType ? (
                    <span className="text-blue-600">À valider – Selon devis #{b.devisNumero}</span>
                  ) : (
                    <span className="text-amber-600">À facturer – Selon bon de commande</span>
                  )}
                </p>
                {b.lignesNonListees?.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {b.lignesNonListees.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>{it.description}</span>
                        <span className="shrink-0 tabular-nums text-slate-600">{parseFloat(it.prix).toFixed(2)} $</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  b.description && <p className="mt-0.5 whitespace-pre-line text-[11px] text-slate-500">{b.description}</p>
                )}
                {(b.facturesEmises || []).length > 0 && (
                  <div className="mt-1.5 w-full max-w-[240px]">
                    {(devisType || contrat) && montantCumule > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-slate-500">
                          Cumul facturé : {montantCumule.toFixed(2)} $ / {montantDevisTotal.toFixed(2)} $
                        </p>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${contrat ? "bg-purple-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(100, (montantCumule / montantDevisTotal) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                    <FacturesEmisesListe bon={b} onPdf={ouvrirPdfFacture} onRenvoyer={renvoyerFactureQb} envoiAuto={configEnt?.envoiAutoFactureQb === true} />
                  </div>
                )}
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-bold tabular-nums text-slate-900">{b.montant.toFixed(2)} $</p>
                <div className="mt-0.5 space-y-0 text-[10px] text-slate-400">
                  <p className="tabular-nums">TPS ({tauxAffiche(configEnt.tauxTps)}%) : {calculerTaxes(b.montant, configEnt).tps.toFixed(2)} $</p>
                  <p className="tabular-nums">TVQ ({tauxAffiche(configEnt.tauxTvq)}%) : {calculerTaxes(b.montant, configEnt).tvq.toFixed(2)} $</p>
                  <p className="font-semibold tabular-nums text-slate-600">Total TTC : {calculerTaxes(b.montant, configEnt).total.toFixed(2)} $</p>
                </div>
                <button
                  onClick={() => setFactureAperçuId(b.id)}
                  className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 underline underline-offset-2"
                >
                  <FileText size={11} /> Voir version client
                </button>
                {/* 📸 LE BON AU CLIENT — le descriptif public (photos,
                    signature, SANS prix). Indépendant de la facturation :
                    le client peut voir ses travaux avant même la facture. */}
                {b.supabase && (
                  <button
                    onClick={() => setBonEnvoiClientId(b.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 underline underline-offset-2"
                  >
                    <Send size={11} /> Bon au client
                  </button>
                )}
                {b.envoyeClientLe && (
                  <p className="mt-0.5 text-[9px] font-bold text-emerald-600">
                    📸 Envoyé le {new Date(b.envoyeClientLe).toLocaleDateString("fr-CA")}
                  </p>
                )}
                {b.statutQb === "en_attente" && !b.retraitStatut && (
                  <button
                    onClick={() => setBonRetraitId(b.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600"
                  >
                    Retirer de la facturation
                  </button>
                )}
                {b.statutQb === "retire" && estAdminPrincipal && (
                  <button
                    onClick={() => remettreBonAFacturer(b)}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 underline underline-offset-2"
                  >
                    Remettre à facturer
                  </button>
                )}
                {b.statutQb === "retire" ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                    🗂️ Retiré
                  </span>
                ) : b.statutQb === "envoye" ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 size={12} /> Facturé
                  </span>
                ) : b.prixNonListe ? (
                  <Button onClick={() => setBonAReviserId(b.id)} className="mt-1 min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                    <AlertCircle size={11} /> Réviser
                  </Button>
                ) : enAttenteValidation ? (
                  <Button onClick={() => setBonFacturationId(b.id)} className="mt-1 min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                    <Check size={11} /> {montantCumule > 0 ? "Facturer le solde" : "Facturer"}
                  </Button>
                ) : (
                  <>
                    <span className="mb-1 flex items-center justify-end gap-1 text-[10px] font-bold text-amber-600">
                      <Cloud size={12} /> En attente de synchro QB
                    </span>
                    <Button onClick={() => setBonEnvoiCourrielId(b.id)} className="min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                      <Send size={11} /> Envoyer à QB
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {bonsAffiches.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Aucun résultat pour {filtresActifs.length > 1 ? "ces catégories" : "cette catégorie"}.
          </p>
        )}
        <BarrePagination total={bonsAffiches.length} page={pageFactEff} onPage={setPageFact} refHaut={refListeFact} libelle="bons" />
      </div>
      <p className="text-[11px] text-slate-400">
        Un bon de travail « Prix non listé » doit être ouvert et révisé manuellement par un admin (prix + description), avec confirmation explicite, avant de pouvoir être envoyé au client.
        Un travail « Selon devis » exige toujours une validation manuelle de l'admin avant l'envoi, avec possibilité de facturation progressive plafonnée au montant initial du devis.
      </p>

      {/* 📦 MATÉRIEL DU STOCK — items de catalogue au COÛT STANDARD
          posés sur le bon. C'est ici que la consommation d'entrepôt
          (forfait murale : 25' de conduit + support ; la prise de
          l'électricien) entre au coût de la job SANS chercher un vrai
          coût impossible à tracer. Coût interne — jamais au client. */}
      {materielStockPour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setMaterielStockPour(null); }}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">📦 Matériel du stock — coût interne</h3>
                <p className="text-xs text-slate-500">Coût standard du catalogue · n&apos;apparaît jamais sur un document client.</p>
              </div>
              <button onClick={() => setMaterielStockPour(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-1.5">
              {(materielStockPour.items || []).map((it) => (
                <div key={it.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{it.nom}</span>
                  <input
                    type="number"
                    min={0.25}
                    step="0.25"
                    value={it.quantite}
                    onChange={(e) =>
                      setMaterielStockPour((prev) => ({
                        ...prev,
                        items: prev.items.map((x) => (x.id === it.id ? { ...x, quantite: parseFloat(e.target.value) || 1 } : x)),
                      }))
                    }
                    className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
                  />
                  <span className="w-20 text-right text-xs tabular-nums text-slate-500">× {(Number(it.coutant) || 0).toFixed(2)} $</span>
                  <button
                    onClick={() => setMaterielStockPour((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== it.id) }))}
                    className="shrink-0 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {(materielStockPour.items || []).length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                  Aucun item — ajoute du catalogue (le coûtant standard suit tout seul).
                </p>
              )}
            </div>
            <div className="mt-2">
              <SelecteurItem
                catalogue={(catalogueFacturation || []).filter((i) => i.prix_coutant != null)}
                libelle="🔎 Ajouter du catalogue (coûtant standard)"
                onChoisir={(item) =>
                  setMaterielStockPour((prev) => ({
                    ...prev,
                    items: [...(prev.items || []), { id: `ms-${Date.now()}`, nom: item.nom, quantite: 1, coutant: Number(item.prix_coutant) || 0 }],
                  }))
                }
              />
            </div>
            <div className="mt-3 flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
              <span>Coût matériel (interne)</span>
              <span className="tabular-nums">
                {(materielStockPour.items || []).reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0).toFixed(2)} $
              </span>
            </div>
            <Button
              onClick={async () => {
                const { bonId, items } = materielStockPour;
                try {
                  await majMaterielStock(bonId, items);
                  setBons((prev) => prev.map((x) => (x.id === bonId ? { ...x, materielStock: items } : x)));
                  const total = items.reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0);
                  ajouterJournal(`📦 Matériel du stock enregistré sur le bon — ${items.length} item${items.length > 1 ? "s" : ""}, ${total.toFixed(2)} $ de coût standard (interne).`);
                  setMaterielStockPour(null);
                } catch (e) {
                  ajouterJournal(`⚠️ Matériel du stock NON enregistré (${e?.message || "erreur"}) — le snippet 77 est-il passé ?`);
                }
              }}
              className="mt-3 w-full"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {bonFacturation && (
        <ModalFacturationDevis
          tousLesBons={bons}
          bon={bonFacturation}
          devis={devisFacturation}
          onFermer={() => setBonFacturationId(null)}
          onEmettre={(info) => {
            setFactureEnAttenteCourriel({ bonId: bonFacturation.id, ...info });
            setBonFacturationId(null);
          }}
        />
      )}

      {bonRetrait && (
        <ModalRetraitFacturation
          bon={bonRetrait}
          onFermer={() => setBonRetraitId(null)}
          onDemander={(raison, note) => {
            setBonRetraitId(null);
            demanderRetrait(bonRetrait, raison, note);
          }}
        />
      )}

      {bonEnvoiClient && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(bonEnvoiClient)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(bonEnvoiClient)?.id, email)}
          contexte={`Bon de travail — descriptif avec photos, SANS prix (« ${bonEnvoiClient.projet} »)`}
          onFermer={() => setBonEnvoiClientId(null)}
          onConfirmer={(choix) => {
            setBonEnvoiClientId(null);
            envoyerBonAuClient(bonEnvoiClient, choix);
          }}
        />
      )}

      {bonEnvoiCourriel && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(bonEnvoiCourriel)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(bonEnvoiCourriel)?.id, email)}
          contexte={`Facture — "${bonEnvoiCourriel.projet}" (${bonEnvoiCourriel.montant.toFixed(2)} $)`}
          onFermer={() => setBonEnvoiCourrielId(null)}
          onConfirmer={(choix) => {
            setBonEnvoiCourrielId(null);
            setPaiementAConfirmer({
              mode: "simple",
              bonId: bonEnvoiCourriel.id,
              montant: Number(bonEnvoiCourriel.montant) || 0,
              clientNom: bonEnvoiCourriel.client,
              courriels: choix,
            });
          }}
        />
      )}

      {bonFactureEnAttente && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(bonFactureEnAttente)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(bonFactureEnAttente)?.id, email)}
          contexte={`Facture progressive — "${bonFactureEnAttente.projet}" (${factureEnAttenteCourriel.montant.toFixed(2)} $)`}
          onFermer={() => setFactureEnAttenteCourriel(null)}
          onConfirmer={(courrielChoisi) => {
            const { bonId, ...info } = factureEnAttenteCourriel;
            setFactureEnAttenteCourriel(null);
            setPaiementAConfirmer({
              mode: "progressive",
              bonId,
              info,
              montant: Number(info.montant) || 0,
              clientNom: bonFactureEnAttente?.client || "",
              courriels: courrielChoisi,
            });
          }}
        />
      )}

      {paiementAConfirmer && (
        <ModalChoixPaiementFacture
          montant={paiementAConfirmer.montant}
          clientNom={paiementAConfirmer.clientNom}
          onFermer={() => setPaiementAConfirmer(null)}
          onEmettre={async (paiements) => {
            const pa = paiementAConfirmer;
            if (pa.mode === "simple") await envoyerQb(pa.bonId, pa.courriels, paiements);
            else await emettreFacture(pa.bonId, pa.info, pa.courriels, paiements);
            setPaiementAConfirmer(null);
          }}
        />
      )}

      {bonAReviser && (
        <ModalReviserPrixNonListe
          bon={bonAReviser}
          depotPaye={depotPayePour(bonAReviser.tacheId)}
          piecePrepayee={piecePrepayeePour(bonAReviser.tacheId)}
          lignesSuggerees={lignesTempsSupp(bonsGroupes.find((b) => (b.tacheId || b.id) === (bonAReviser.tacheId || bonAReviser.id)) || bonAReviser)}
          onFermer={() => setBonAReviserId(null)}
          onConfirmer={(items, total) => reviserPrixNonListe(bonAReviser.id, items, total)}
        />
      )}
      {factureAperçuId && (
        <ApercuFactureClient
          bon={bons.find((b) => b.id === factureAperçuId)}
          onFermer={() => setFactureAperçuId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// JOURNAL D'AUTOMATISATION (visible en bas de l'app)
// ============================================================
function JournalAutomatisation({ entrees }) {
  // REPLIÉ PAR DÉFAUT en une seule ligne (la dernière action) — le journal
  // complet ne se déplie qu'à la demande, et la préférence est mémorisée.
  // La barre passe à l'orange quand la dernière entrée est un problème
  // (⚠️ erreur de synchro, ⛔ blocage) pour rester impossible à manquer.
  const [ouvert, setOuvert] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("ventilationdgl_journal_ouvert") === "1";
    } catch {
      return false;
    }
  });
  const basculer = () =>
    setOuvert((prev) => {
      const suivant = !prev;
      try {
        localStorage.setItem("ventilationdgl_journal_ouvert", suivant ? "1" : "0");
      } catch {}
      return suivant;
    });
  if (entrees.length === 0) return null;
  const aujourdhui = todayISO();
  const derniere = entrees[0];
  const alerte = /⚠️|⛔|❌/.test(derniere?.texte || "");
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-4 md:px-6">
      <button
        onClick={basculer}
        title={ouvert ? "Réduire le journal" : "Afficher le journal complet"}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
          alerte ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <span className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wide ${alerte ? "text-orange-600" : "text-slate-400"}`}>
          🕘 Journal
        </span>
        <span className={`min-w-0 flex-1 truncate text-xs ${alerte ? "font-semibold text-orange-800" : "text-slate-500"}`}>
          <span className="tabular-nums">{derniere.date && derniere.date !== aujourdhui ? `${derniere.date} ` : ""}{derniere.heure}</span> — {derniere.texte}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-slate-400">
          {ouvert ? "Réduire" : "Afficher"}
          {ouvert ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </span>
      </button>
      {ouvert && (
        <div className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {entrees.map((e) => (
            <p key={e.id} className="text-xs text-slate-600">
              <span className="tabular-nums text-slate-400">
                {e.date && e.date !== aujourdhui ? `${e.date} ` : ""}{e.heure}
              </span> — {e.texte}
              {e.par && <span className="text-slate-400"> — par {e.par}</span>}
            </p>
          ))}
          <p className="pt-1 text-right text-[10px] text-slate-400">
            {entrees.length} entrée{entrees.length > 1 ? "s" : ""} conservée{entrees.length > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP PRINCIPALE
// ============================================================
export default function App() {
  const [onglet, setOnglet] = useState("tableau-de-bord");
  // 💰/🤝 Drapeaux « facturable » par (tâche, technicien) — la clé est
  // `tacheId|courriel`. Rempli au chargement des assignations, mis à
  // jour au choix du répartiteur. La facturation s'en sert pour exclure
  // les heures des non-facturables du temps supplémentaire suggéré.
  const [facturablesAssignations, setFacturablesAssignations] = useState({});
  // ⏱️ STATUT EN DIRECT des assignations (« tacheId|courriel » →
  // « en_cours »/« planifiee ») — écrit par l'app technicien au Débuter
  // et au Terminer. Colore les blocs de l'agenda en rose vif « en cours » :
  // le bureau voit où chacun est rendu dans sa journée (2026-08-18).
  const [statutsAssignations, setStatutsAssignations] = useState({});
  // 🤝 SOUS-TRAITANTS (2026-08-19) : le répertoire (table
  // sous_traitants_app) et LEURS assignations (taches_assignees avec le
  // courriel synthétique « st::<id> ») — pour la section d'agenda, les
  // statuts Présent/Pas venu et la liste « Sous-traitance à facturer ».
  const [sousTraitants, setSousTraitants] = useState([]);
  const [assignationsST, setAssignationsST] = useState([]);
  // (le chargement vit plus bas, après la déclaration de `session` —
  // le référencer ici plantait la page entière : « Cannot access
  // before initialization », même piège que le 2026-08-17.)
  // ⬅️➡️ RECULER/AVANCER DU NAVIGATEUR (demande du propriétaire,
  // 2026-08-17) : chaque onglet s'inscrit dans l'adresse (#agenda…).
  // Reculer revient à l'onglet précédent au lieu de quitter l'appli ;
  // rafraîchir garde l'onglet ; un favori « #facturation » marche.
  // Un onglet invalide ou non permis est déjà filtré par la dérivation
  // `vue` (repli sur la première section permise) — aucun risque.
  useEffect(() => {
    const versOnglet = () => {
      const h = decodeURIComponent(window.location.hash.replace("#", ""));
      if (h) setOnglet(h);
    };
    versOnglet();
    window.addEventListener("hashchange", versOnglet);
    return () => window.removeEventListener("hashchange", versOnglet);
  }, []);
  useEffect(() => {
    const cible = `#${onglet}`;
    if (window.location.hash !== cible) window.history.pushState(null, "", cible);
  }, [onglet]);
  // RECHERCHE GLOBALE — tapée dans la barre d'en-tête (visible partout)
  // ou dans la page Recherche : même valeur, deux endroits.
  const [rechercheGlobale, setRechercheGlobale] = useState("");
  // Liste déroulante des résultats sous la barre d'en-tête — on reste
  // sur l'écran en cours, les résultats viennent à nous.
  const [listeRechercheOuverte, setListeRechercheOuverte] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false); // tiroir mobile du menu latéral
  // Menu latéral réduit (icônes seulement) — préférence mémorisée.
  const [menuReduit, setMenuReduit] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage?.getItem("ventilationdgl_menu_reduit") === "1";
    } catch {
      return false;
    }
  });
  const basculerMenuReduit = () =>
    setMenuReduit((v) => {
      const nouveau = !v;
      try {
        window.localStorage?.setItem("ventilationdgl_menu_reduit", nouveau ? "1" : "0");
      } catch {
        // stockage indisponible — la préférence vaut pour la session
      }
      return nouveau;
    });
  const [clients, setClients] = useState(CLIENTS_INIT);
  const [travaux, setTravaux] = useState(TRAVAUX_INIT);
  const [projets, setProjets] = useState(PROJETS_INIT);
  const [utilisateurs, setUtilisateurs] = useState(UTILISATEURS_INIT);
  const [tauxMetiers, setTauxMetiers] = useState(TAUX_METIERS_INIT);
  // Inspections & entretiens — VRAIES données Supabase (Phase 2). Le
  // chargement se fait plus bas, une fois la session déclarée.
  const [inspections, setInspections] = useState([]);
  const [entretiens, setEntretiens] = useState([]);
  const [devisListe, setDevisListe] = useState([]);
  // Cible d'une navigation venant de la RECHERCHE RAPIDE :
  // { clientId, numeroDevis } — ouvre le bon dossier et surligne le devis.
  const [cibleRecherche, setCibleRecherche] = useState(null);
  // Client visé par le bouton « + Créer un devis » d'une fiche client :
  // l'éditeur de devis s'ouvre avec lui déjà sélectionné.
  const [clientPourNouveauDevis, setClientPourNouveauDevis] = useState(null);

  // VISITES DE SOUMISSION SANS DEVIS — le suivi qui empêche une vente
  // de s'éteindre toute seule. Une visite est « réglée » dès qu'un devis
  // existe pour ce client APRÈS la date de la visite : inutile de
  // demander au technicien de rattacher quoi que ce soit à la main.
  const soumissionsSansDevis = useMemo(() => {
    const visites = (travaux || []).filter(
      (t) => t.supabase && /soumission/i.test(t.titre || "") && (t.categorieHeures || "projet") === "administratif"
    );
    const aujourdhui = new Date(`${dateISO(new Date())}T00:00:00`);
    return visites
      .filter((v) => {
        const devisApres = (devisListe || []).some(
          (d) => (d.clientNom || "") === (v.clientNom || "") && d.date >= v.date
        );
        return !devisApres;
      })
      .map((v) => ({
        id: v.id,
        clientNom: v.clientNom,
        titre: v.titre,
        date: v.date,
        jours: Math.max(0, Math.round((aujourdhui - new Date(`${v.date}T00:00:00`)) / 86400000)),
      }))
      .sort((a, b) => b.jours - a.jours);
  }, [travaux, devisListe]);
  const [tachesAttente, setTachesAttente] = useState([
    { id: "tache-seed1", clientNom: "Toitures Lavallée inc.", titre: "Réfection toiture - Chantier Nord", description: "3 × Membrane élastomère, 12 × Bardeau architectural", statut: "a_planifier", heures: 4, jours: 2, sauterWeekend: true, typeTache: "temps_materiel" },
  ]);
  const [planning, setPlanning] = useState({});
  const [bons, setBons] = useState(BONS_TRAVAIL_COMPLETES_INIT);
  // Répertoire des fournisseurs (matériaux, location, sous-traitance) —
  // sert à envoyer le bon de commande directement depuis l'app.
  const [fournisseurs, setFournisseurs] = useState([]);
  // Parc de véhicules — le technicien choisit son camion dans cette
  // liste au lieu de l'écrire (plus de camions fantômes).
  const [parcCamions, setParcCamions] = useState([]);
  // Carnet d'entretien du parc : réparations + entretiens réalisés.
  const [carnetVehicules, setCarnetVehicules] = useState([]);
  const [journal, setJournal] = useState([]);
  const journalInitialise = useRef(false);

  // --- Authentification Supabase ---
  const [session, setSession] = useState(null);
  // 🤝 Chargement du répertoire des sous-traitants + leurs assignations
  // (états déclarés plus haut, près des statuts d'assignations).
  useEffect(() => {
    if (!session) return;
    listerSousTraitants().then(setSousTraitants).catch(() => {});
    listerAssignationsSousTraitants().then(setAssignationsST).catch(() => {});
  }, [session]);
  const [authVerifie, setAuthVerifie] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthVerifie(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Accès personnalisés (table permissions_utilisateurs) — chargés à la
  // connexion ; sans entrée (ou table absente), on retombe sur les
  // défauts du rôle des métadonnées.
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

  // Persistance de l'AGENDA : l'horaire est reconstruit depuis les
  // assignations Supabase — la table fait foi. Re-tente à mesure que le
  // répertoire d'employés se charge (les courriels servent de lien), et
  // se recharge en DIRECT quand quelqu'un d'autre planifie.
  // Signal « répertoire des employés chargé » — déclaré ICI car l'effet
  // de reconstruction de l'agenda (juste dessous) en dépend.
  const [repertoireCharge, setRepertoireCharge] = useState(false);
  useEffect(() => {
    // On attend que le répertoire des employés soit chargé : sans lui,
    // les tâches se rattacheraient à une identité provisoire, puis
    // deviendraient invisibles quand la vraie fiche arrive (course).
    if (!session || !repertoireCharge) return;
    let annule = false;
    let minuterie = null;
    const charger = () =>
      listerToutesAssignations()
        .then((rows) => {
          if (annule || rows.length === 0) return;
          setFacturablesAssignations((prev) => {
            const maj = { ...prev };
            rows.forEach((r) => {
              maj[`${r.tache_id}|${(r.employe_email || "").toLowerCase()}`] = r.facturable !== false;
            });
            return maj;
          });
          setStatutsAssignations((prev) => {
            const maj = { ...prev };
            rows.forEach((r) => {
              maj[`${r.tache_id}|${(r.employe_email || "").toLowerCase()}`] = r.statut || "planifiee";
            });
            return maj;
          });
          const courrielSession = session.user?.email?.toLowerCase();
          const employesRef = [
            ...utilisateurs.map((u) => ({ id: u.id, courriel: u.courriel })),
            ...(courrielSession && !utilisateurs.some((u) => (u.courriel || "").toLowerCase() === courrielSession)
              ? [{ id: "compte-connecte", courriel: courrielSession }]
              : []),
            // 🤝 Les sous-traitants ont leur rangée aussi — sinon la
            // reconstruction de l'agenda jetterait leurs blocs.
            ...sousTraitants.map((st) => ({ id: `st-${st.id}`, courriel: COURRIEL_ST(st.id) })),
          ];
          setPlanning((prev) => fusionnerPlanningServeur(prev, rows, employesRef));
          // Les tâches déjà planifiées ne restent pas dans « en attente ».
          setTachesAttente((prev) => prev.filter((t) => !rows.some((r) => r.tache_id === t.id)));
        })
        .catch(() => {
          // table absente — l'agenda local continue seul
        });
    charger();
    // ⏱️ EN DIRECT — dès qu'une assignation change (créée par une
    // collègue à l'autre poste, retirée, déplacée), l'agenda se relit.
    // Court délai groupé : planifier une équipe écrit plusieurs lignes
    // coup sur coup, on ne recharge qu'une fois à la fin.
    const desabonner = sAbonnerTachesAssignees(() => {
      if (annule) return;
      clearTimeout(minuterie);
      minuterie = setTimeout(charger, 800);
    });
    return () => {
      annule = true;
      clearTimeout(minuterie);
      desabonner();
    };
  }, [session, repertoireCharge, utilisateurs, sousTraitants]);

  // Dépôts préalables — chargés depuis Supabase + Realtime. Un dépôt en
  // attente BLOQUE la planification de sa tâche ; après 24 h sans
  // paiement, il est annulé automatiquement (vérifié à l'ouverture puis
  // chaque minute). Le paiement QuickBooks réel arrive en Phase 4.
  const [depots, setDepots] = useState({});
  const depotsRef = useRef(depots);
  depotsRef.current = depots;
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const charger = async () => {
      try {
        const d = await listerDepots();
        if (!annule) setDepots(d);
      } catch {
        // table absente — le flux de dépôts reste local à la session
      }
    };
    charger();
    const desabonner = sAbonnerDepots(charger);
    return () => {
      annule = true;
      desabonner();
    };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const verifier = () => {
      const maintenant = Date.now();
      Object.values(depotsRef.current).forEach((d) => {
        if (d.statut === "en_attente_paiement" && d.dateLimite && new Date(d.dateLimite).getTime() < maintenant) {
          annulerDepotDelai(d.tacheId).catch(() => {});
          setDepots((prev) => ({ ...prev, [d.tacheId]: { ...prev[d.tacheId], statut: "annule_delai" } }));
          ajouterJournal(`⏰ Délai de 24 h dépassé — dépôt annulé, tâche non planifiable`);
          // Facture de dépôt QuickBooks : annulation par VOID (jamais
          // Delete — règle gelée). La séquence comptable reste pleine.
          if (d.qboInvoiceId) {
            annulerFactureDepot(d.qboInvoiceId)
              .then((rv) =>
                ajouterJournal(
                  rv?.annulee
                    ? `🧾 Facture de dépôt${d.qboDocNumber ? ` Nº ${d.qboDocNumber}` : ""} annulée par VOID dans QuickBooks`
                    : `⚠️ VOID de la facture de dépôt refusé (${rv?.erreur || "?"}) — annule-la à la main dans QuickBooks`
                )
              )
              .catch(() => {});
          }
        }
      });
    };
    verifier();
    const minuterie = setInterval(verifier, 60000);
    return () => clearInterval(minuterie);
  }, [session]);
  // Liste de prix des dépôts (par zone) — chargée depuis Supabase,
  // modifiable par l'Admin principal dans l'onglet Utilisateurs.
  const [prixDepots, setPrixDepots] = useState({ "Zone 1": 0, "Zone 2": 0, "Zone 3": 0, "Zone 4 (Montréal)": 0, taux_horaire_vendant: 0, minutes_incluses: 90, minutes_incluses_hors_zone: 180 });
  useEffect(() => {
    if (!session) return;
    listerPrixDepots()
      .then((parZone) => setPrixDepots((prev) => ({ ...prev, ...parZone })))
      .catch(() => {
        // table absente — liste locale seulement
      });
  }, [session]);

  // PIÈCES EN COMMANDE — le pont entre le diagnostic et la réparation.
  const [pieces, setPieces] = useState([]);
  // ⚠️ CAUSE RACINE DES DOUBLONS (2026-08-27) : tant que cette liste
  // n'a pas été chargée AU MOINS une fois du serveur, la création
  // automatique ne doit RIEN créer — sinon chaque rechargement de page
  // voyait « aucune pièce » et recréait toutes les demandes.
  const piecesChargeesRef = useRef(false);
  useEffect(() => {
    if (!session) return;
    const charger = () =>
      listerPieces()
        .then((liste) => {
          piecesChargeesRef.current = true;
          setPieces(liste);
        })
        .catch(() => {});
    charger();
    return sAbonnerPieces(charger);
  }, [session]);

  // 🧰 MATÉRIEL — commandes camion (technicien → bureau) et achats
  // libres (BC sans projet). Voir lib/supabase/materiel.js.
  const [commandesCamion, setCommandesCamion] = useState([]);
  const [achatsLibres, setAchatsLibres] = useState([]);
  useEffect(() => {
    if (!session) return;
    const charger = () => listerCommandesCamion().then(setCommandesCamion).catch(() => {});
    charger();
    listerAchatsLibres().then(setAchatsLibres).catch(() => {});
    return sAbonnerCommandesCamion(charger);
  }, [session]);
  // « ✓ Commande passée » — le seul geste du bureau ; la note (facultative)
  // part telle quelle sur le téléphone du technicien.
  const commandeCamionPassee = (id, note) => {
    const c = commandesCamion.find((x) => x.id === id);
    setCommandesCamion((prev) => prev.map((x) => (x.id === id ? { ...x, statut: "commandee", noteBureau: note || "" } : x)));
    marquerCommandeCamionPassee(id, note, session)
      .then(() => {
        ajouterJournal("🧰 Matériel camion COMMANDÉ pour " + (c?.technicienNom || "?") + (note ? " — note : " + note : ""));
        // 🔔 Le demandeur le sait sans ouvrir l'application.
        if (c?.technicienEmail) {
          envoyerPushA(c.technicienEmail, "🧰 Matériel commandé", note ? `Ta demande est commandée — ${note}` : "Ta demande de matériel est commandée.");
        }
      })
      .catch(() => ajouterJournal("⚠️ Commande camion NON marquée — réessaie."));
  };
  // BC LIBRE — numéro officiel ; projet choisi = coûts du projet
  // (mécanisme existant), sinon achat général (registre à part).
  const creerBcLibre = async ({ fournisseurNom, description, montantHT, projetId, tacheId, clientId, montantAttribue }) => {
    const numero = await numeroBonCommande().catch(() => "BC-" + Date.now());
    // 👤 ACHAT POUR UN CLIENT sans tâche ni projet (2026-08-26) : l'unité
    // commandée avant que la job soit à l'horaire. Le coût remonte dans
    // « par client » et QuickBooks suivra par le numéro de BC.
    if (!projetId && !tacheId && clientId) {
      const cl = (clients || []).find((c) => c.id === clientId);
      const attribueClient = Math.min(Number(montantAttribue ?? montantHT) || 0, Number(montantHT) || 0);
      await creerAchatLibre(
        {
          numeroBc: numero,
          fournisseurNom,
          description,
          montantHT,
          dateAchat: todayISO(),
          clientId,
          clientNom: cl?.nom || "",
          montantAttribue: attribueClient,
        },
        session
      ).catch(() => {});
      listerAchatsLibres().then(setAchatsLibres).catch(() => {});
      ajouterJournal(
        "🧾 BC " + numero + " créé et rattaché au client « " + (cl?.nom || clientId) + " » — " +
          attribueClient.toFixed(2) + " $ HT attribués au dossier sur " + (Number(montantHT) || 0).toFixed(2) + " $" +
          (attribueClient < (Number(montantHT) || 0) ? " (le reste demeure un achat de stock)" : "")
      );
      return numero;
    }
    if (projetId) {
      const bc = { id: "bc-" + Date.now(), numeroBC: numero, fournisseur: fournisseurNom || "", montantHT: Number(montantHT) || 0, statut: "En attente", date: todayISO(), description: description || "" };
      setProjets((prev) => prev.map((px) => (px.id === projetId ? { ...px, bonsCommande: [...(px.bonsCommande || []), bc] } : px)));
      const proj = projets.find((px) => px.id === projetId);
      ajouterJournal("🧾 BC " + numero + " créé et attribué au projet « " + (proj?.nom || projetId) + " » — " + (Number(montantHT) || 0).toFixed(2) + " $ HT");
    } else if (tacheId) {
      // 🔗 ACHAT POUR UNE JOB (2026-08-25) : la tâche et son client sont
      // recopiés sur l'achat — le coût suivra le client, projet ou pas.
      const t = tacheParId(tacheId);
      const attribue = Math.min(Number(montantAttribue ?? montantHT) || 0, Number(montantHT) || 0);
      await creerAchatLibre(
        {
          numeroBc: numero,
          fournisseurNom,
          description,
          montantHT,
          dateAchat: todayISO(),
          tacheId,
          tacheTitre: t?.titre || t?.clientNom || "",
          clientNom: t?.clientNom || "",
          montantAttribue: attribue,
        },
        session
      ).catch(() => {});
      listerAchatsLibres().then(setAchatsLibres).catch(() => {});
      ajouterJournal(
        "🧾 BC " + numero + " créé et rattaché à « " + (t?.titre || tacheId) + " »" + (t?.clientNom ? ` (${t.clientNom})` : "") +
          " — " + attribue.toFixed(2) + " $ HT attribués à la job sur " + (Number(montantHT) || 0).toFixed(2) + " $" +
          (attribue < (Number(montantHT) || 0) ? " (le reste demeure un achat de stock)" : "")
      );
    } else {
      await creerAchatLibre({ numeroBc: numero, fournisseurNom, description, montantHT, dateAchat: todayISO() }, session).catch(() => {});
      listerAchatsLibres().then(setAchatsLibres).catch(() => {});
      ajouterJournal("🧾 BC " + numero + " créé (achat général, sans projet) — " + (Number(montantHT) || 0).toFixed(2) + " $ HT");
    }
    return numero;
  };

  // ============================================================
  // ✏️ FICHE D'UN BON DE COMMANDE — modification, re-rattachement,
  // déménagement vers un projet, suppression (2026-08-26).
  // La liste était en lecture seule : tout changement passe désormais
  // par ici, TOUJOURS tracé au journal — déplacer un coût d'un dossier
  // à l'autre ne doit jamais se faire en silence.
  // ============================================================
  const majBcLibre = async (achat, champs, resume) => {
    try {
      await majAchatLibre(achat.id, champs);
      await listerAchatsLibres().then(setAchatsLibres);
      ajouterJournal("✏️ BC " + (achat.numeroBc || "?") + " modifié — " + (resume || "fiche mise à jour") + ".");
      return true;
    } catch (e) {
      ajouterJournal("⚠️ BC " + (achat.numeroBc || "?") + " NON modifié (" + (e?.message || "connexion impossible") + ") — réessaie." + (/client_id/.test(e?.message || "") ? " Le snippet SQL 79 est-il passé ?" : ""));
      return false;
    }
  };
  const supprimerBcLibre = async (achat) => {
    try {
      await supprimerAchatLibre(achat.id);
      await listerAchatsLibres().then(setAchatsLibres);
      ajouterJournal("🗑️ BC " + (achat.numeroBc || "?") + " supprimé (" + (achat.description || "sans description") + " — " + (Number(achat.montantHT) || 0).toFixed(2) + " $ HT).");
      return true;
    } catch (e) {
      ajouterJournal("⚠️ BC " + (achat.numeroBc || "?") + " NON supprimé (" + (e?.message || "connexion impossible") + ") — réessaie.");
      return false;
    }
  };
  // Rattacher à un PROJET après coup = DÉMÉNAGEMENT : les coûts de
  // projet vivent dans projet.bonsCommande (c'est là que l'appariement
  // QuickBooks des projets regarde), le bon quitte donc la liste libre.
  const demenagerBcVersProjet = async (achat, projetId) => {
    const proj = projets.find((px) => px.id === projetId);
    if (!proj) return false;
    const bc = {
      id: "bc-" + Date.now(),
      numeroBC: achat.numeroBc,
      fournisseur: achat.fournisseurNom || "",
      montantHT: Number(achat.montantHT) || 0,
      statut: "En attente",
      date: achat.dateAchat || todayISO(),
      description: achat.description || "",
    };
    setProjets((prev) => prev.map((px) => (px.id === projetId ? { ...px, bonsCommande: [...(px.bonsCommande || []), bc] } : px)));
    try {
      await supprimerAchatLibre(achat.id);
      await listerAchatsLibres().then(setAchatsLibres);
    } catch {
      // le bon est au projet — un doublon dans la liste libre se
      // supprime à la main, bien moins grave qu'un coût perdu
    }
    ajouterJournal(
      "🏗️ BC " + (achat.numeroBc || "?") + " déménagé : " +
        (achat.tacheId ? "Job « " + (achat.tacheTitre || achat.tacheId) + " »" : achat.clientId ? "Client « " + (achat.clientNom || achat.clientId) + " »" : "achat général") +
        " → Projet « " + proj.nom + " » — " + (Number(achat.montantHT) || 0).toFixed(2) + " $ HT."
    );
    return true;
  };
  // Retrouve une tâche par id, peu importe où elle vit (grille ou file
  // d'attente) — pour recopier titre et client sur un achat rattaché.
  const tacheParId = (id) => {
    for (const valeur of Object.values(planning)) {
      for (const t of listeCellule(valeur)) if (t?.id === id) return t;
    }
    return (tachesAttente || []).find((t) => t.id === id) || null;
  };

  // CRÉATION AUTOMATIQUE depuis les bons de travail : quand un
  // technicien coche « pièce à commander », la demande apparaît au
  // bureau sans que personne n'ait à la ressaisir. Le garde sur
  // `tacheOrigineId` empêche les doublons à chaque rechargement — et
  // `dejaCreees` évite d'en créer deux si l'effet se rejoue avant que
  // la liste ne soit rafraîchie.
  const dejaCreees = useRef(new Set());
  useEffect(() => {
    // Rien tant que la liste des pièces n'est pas VRAIMENT chargée —
    // c'est ce trou qui multipliait les demandes à chaque rechargement.
    if (!session || !piecesChargeesRef.current) return;
    const existantes = new Set(pieces.map((p) => p.tacheOrigineId).filter(Boolean));
    (bons || [])
      .filter((b) => b.pieceACommander && b.pieceRequise && b.tacheId)
      .filter((b) => !existantes.has(b.tacheId) && !dejaCreees.current.has(b.tacheId))
      .forEach((b) => {
        dejaCreees.current.add(b.tacheId);
        // TÂCHE DE RETOUR créée du même geste — un 2e appel de service,
        // facturé séparément (règle validée). Elle part dans la file
        // d'attente, BLOQUÉE tant que la pièce n'est pas reçue : le
        // personnel n'a plus qu'à appeler le client et la placer dès
        // que la pièce arrive. Sans ça, il fallait se souvenir de la
        // recréer à la main — et on l'oublie.
        const idRetour = `retour-${b.tacheId}-${Date.now()}`;
        const clientFiche = clients.find((c) => c.nom === b.client);
        const tacheRetour = {
          id: idRetour,
          titre: `Retour — ${b.pieceRequise}`,
          clientId: clientFiche?.id || null,
          clientNom: b.client,
          typeTache: "appel_service",
          description: `Pose de la pièce : ${b.pieceRequise}\nDiagnostic fait le ${b.date} par ${b.employeNom || "un technicien"}.`,
          heures: 2,
          jours: 0,
          statut: "en_attente",
          adresseTravaux: b.adresseTravaux || null,
          adresseIntervention: b.adresseTravaux || null,
          projetId: b.projetId || null,
          unites: b.unites || [],
          // COURRIELS DU CLIENT — sans eux, le technicien qui termine la
          // pose ne peut pas envoyer le bon signé : son écran d'envoi
          // serait vide. Toutes les tâches créées à la main les portent
          // (même forme qu'à la création dans l'agenda) ; celle-ci doit
          // les porter aussi.
          clientCourriels: (clientFiche?.courriels || []).map((c) => ({ id: c.id, email: c.email, label: c.label, defaut: !!c.defaut })),
          // Téléphone du client — même raison que les courriels : le
          // technicien doit pouvoir appeler le client depuis sa fiche.
          clientTelephone: clientFiche?.telephone || null,
          depotRequis: false,
          // Trace : d'où vient cette tâche.
          issueDePieceTacheId: b.tacheId,
          // Même secteur que la visite d'origine — la pose de la pièce
          // se paie au même taux CCQ que le diagnostic.
          secteur: b.secteur === "residentiel" ? "residentiel" : "commercial",
        };
        setTachesAttente((prev) => [tacheRetour, ...prev]);

        creerPiece(
          {
            tacheOrigineId: b.tacheId,
            tacheRetourId: idRetour,
            clientId: clientFiche?.id || null,
            clientNom: b.client,
            modele: b.unites?.[0]?.modele || b.modeleUnite,
            numeroSerie: b.unites?.[0]?.serie || b.serieUnite,
            pieceRequise: b.pieceRequise,
          },
          session
        )
          .then((p) => {
            setPieces((prev) => [p, ...prev]);
            ajouterJournal(
              `🔧 Pièce à commander — ${b.pieceRequise} pour ${b.client} (demandée par ${b.employeNom || "technicien"}). Tâche de retour créée, en attente de la pièce.`
            );
          })
          .catch(() => {
            dejaCreees.current.delete(b.tacheId);
            ajouterJournal(`⚠️ Demande de pièce NON enregistrée pour ${b.client} — vérifie que le SQL « 31 » a été lancé.`);
          });
      });
  }, [session, bons, pieces]);

  // CATALOGUE D'ITEMS — la liste de prix (289 items importés de
  // QuickBooks). Rechargée en direct : deux admins peuvent tarifer en
  // même temps sans s'écraser.
  const [catalogue, setCatalogue] = useState(CATALOGUE_REPLI);
  useEffect(() => {
    if (!session) return;
    const charger = () => listerCatalogue().then(setCatalogue).catch(() => {});
    charger();
    return sAbonnerCatalogue(charger);
  }, [session]);

  // CONFIGURATION DE L'ENTREPRISE (coordonnées, numéros officiels, taux
  // de taxes, règles de paie). Elle descend dans toute l'application par
  // le contexte, plus bas dans le rendu. Si la table n'existe pas encore
  // (SQL 23 non lancé), on reste sur CONFIG_DEFAUT — rien ne casse.
  const [configEntreprise, setConfigEntreprise] = useState(CONFIG_DEFAUT);
  useEffect(() => {
    if (!session) return;
    chargerEntreprise()
      .then(setConfigEntreprise)
      .catch(() => {
        // table absente — on garde les valeurs par défaut
      });
  }, [session]);

  // Coût du camion — modifié depuis l'onglet Tarifs (rangé avec les
  // autres coûtants), mais stocké avec la configuration d'entreprise.
  // 🧰 Masquer / réafficher un métier de la grille des taux — chaque
  // entreprise ne garde que SES métiers à l'écran (les taux restent).
  const masquerMetier = async (metier, masquer) => {
    const actuels = configEntreprise?.metiersMasques || [];
    const liste = masquer ? [...new Set([...actuels, metier])] : actuels.filter((m) => m !== metier);
    const nouvelle = { ...configEntreprise, metiersMasques: liste };
    setConfigEntreprise(nouvelle);
    try {
      await sauvegarderEntreprise(nouvelle);
      ajouterJournal(masquer ? `🧰 Métier « ${metier} » masqué de la grille (taux conservés).` : `🧰 Métier « ${metier} » réaffiché.`);
    } catch {
      ajouterJournal("⚠️ Masquage affiché mais NON enregistré (snippet 65 manquant ?) — réessaie.");
    }
  };

  const sauvegarderCoutCamion = async (valeur) => {
    const nouvelle = { ...configEntreprise, coutCamionHoraire: valeur };
    await sauvegarderEntreprise(nouvelle);
    setConfigEntreprise(nouvelle);
    ajouterJournal(`🚚 Coût du camion mis à ${valeur.toFixed(2)} $/h — appliqué aux journées à venir (les passées gardent leur taux figé).`);
  };

  const creerDepotPourTache = async (tacheId, infos) => {
    // DÉLAI DE PAIEMENT : celui de l'entreprise (Paramètres), sauf si un
    // délai explicite arrive (pièces : 7 jours). Libellé humain : « 36 h »
    // sous 2 jours, « N jours » au-delà.
    const heuresDelai = Number(configEntreprise?.delaiDepotHeures) || 24;
    const joursDelai = infos.joursLimite != null ? Number(infos.joursLimite) : heuresDelai / 24;
    const libelleDelai = joursDelai >= 2 ? `${Math.round(joursDelai)} jours` : `${Math.round(joursDelai * 24)} h`;
    const repli = {
      tacheId,
      statut: "en_attente_paiement",
      montantHT: Number(infos.montantHT) || 0,
      dateLimite: new Date(Date.now() + joursDelai * 24 * 60 * 60 * 1000).toISOString(),
      isProspect: !!infos.isProspect,
      prospectNom: infos.prospect?.nom || "",
      prospectCourriel: infos.prospect?.courriel || "",
      prospectTelephone: infos.prospect?.telephone || "",
      prospectAdresse: infos.prospect?.adresse || "",
    };
    setDepots((prev) => ({ ...prev, [tacheId]: repli }));
    creerDepot(tacheId, { ...infos, joursLimite: joursDelai }).catch(() => {
      // hors-ligne — le blocage local reste effectif pour la session
    });
    const t = taxesDepot(infos.montantHT, configEntreprise);
    ajouterJournal(
      `💰 Dépôt requis : ${t.ht.toFixed(2)} $ + taxes = ${t.total.toFixed(2)} $ — payable sous ${libelleDelai}`
    );

    // ------------------------------------------------------------
    // FACTURE DE DÉPÔT QUICKBOOKS + COURRIEL AU CLIENT (2026-08-10,
    // point 9 des retours de tests). Seulement quand la fiche client
    // est connue (appels de service) — les dépôts de déplacement des
    // pièces gardent leur propre courriel dans l'onglet Pièces.
    // Chaque étape journalise honnêtement ; un échec QuickBooks ne
    // bloque JAMAIS le dépôt lui-même (le verrou de planification est
    // déjà en place).
    // ------------------------------------------------------------
    if (!infos.clientNom) return;
    let facture = null;
    // Les destinataires et NOTRE message de réservation voyagent sur la
    // facture QuickBooks (CustomerMemo) — le client reçoit la facture
    // officielle avec le contexte dedans, si l'envoi auto est activé.
    const adressesDepot = [...new Set(infos.courriels || [])].filter(Boolean);
    // ⚠️ LES CONDITIONS VOYAGENT AVEC LA DEMANDE (2026-08-24) : la
    // politique d'annulation (préavis 24 h, dépôt non remboursable)
    // doit être VUE par le client AVANT qu'il paie — sinon le « non
    // remboursable » ne tient pas. Elle part aux DEUX endroits : sur la
    // facture QuickBooks (en production, c'est parfois le SEUL courriel
    // que le client reçoit) et dans notre courriel maison.
    // Le TEXTE COMPLET (les dix clauses) suit lui aussi : au long dans
    // notre courriel, et par le lien /conditions sur la facture
    // QuickBooks — son message est trop court pour dix clauses.
    const lienConditions = typeof window !== "undefined" ? `${window.location.origin}/conditions` : null;
    const conditionsDepot = conditionsDepotAppel(configEntreprise, lienConditions);
    // 📝 L'OBJET DE LA VISITE — « pourquoi on vient » — sur la facture
    // ET dans le courriel. « Dépôt — appel de service » tout court
    // disait au client qu'il paie, jamais pour quoi.
    const objetVisite = [String(infos.titre || "").trim(), String(infos.descriptionTravaux || "").trim()]
      .filter(Boolean)
      .join(" — ");
    const messageClientDepot =
      `Pour réserver votre appel de service${infos.zone ? ` (${infos.zone})` : ""}, un dépôt est requis sous ${libelleDelai}. ` +
      `Dès sa réception, votre rendez-vous est confirmé.\n\n${conditionsDepot}`;
    const r = await creerFactureDepot({
      tacheId,
      clientId: infos.clientId || null,
      clientNom: infos.clientNom,
      montantHT: Number(infos.montantHT) || 0,
      zone: infos.zone || null,
      joursLimite: joursDelai,
      // La ligne de la facture QuickBooks porte l'OBJET DE LA VISITE —
      // le client lit ce qu'il réserve, pas seulement qu'il paie.
      description:
        `Dépôt — appel de service${infos.zone ? ` (${infos.zone})` : ""} — ${infos.clientNom}` +
        (objetVisite ? `\nObjet de la visite : ${objetVisite}` : ""),
      envoyerA: adressesDepot,
      messageClient: messageClientDepot,
      envoyerAuto: configEntreprise?.envoiAutoFactureQb === true,
    });
    if (r?.creee) {
      facture = r;
      setDepots((prev) => ({ ...prev, [tacheId]: { ...prev[tacheId], qboInvoiceId: r.factureId, qboDocNumber: r.docNumber } }));
      majDepotFactureQbo(tacheId, { factureId: r.factureId, docNumber: r.docNumber }).catch(() => {});
      ajouterJournal(`🧾 Facture de dépôt QuickBooks Nº ${r.docNumber || r.factureId} créée${r.envoiQb ? (r.envoiQb.envoyee ? ` — ✉️ ENVOYÉE par QuickBooks à ${adressesDepot.join(", ")} (confirmé au registre)` : " — ⚠️ envoi par QuickBooks NON confirmé") : ""} — annulation par VOID seulement`);
      if (r.carteOfferte || r.virementOffert) {
        ajouterJournal(
          `💳 Paiement en ligne OFFERT sur cette facture : ${[r.carteOfferte ? "carte" : null, r.virementOffert ? "virement" : null].filter(Boolean).join(" + ")}${r.lienPaiement ? "" : " (lien à venir — QuickBooks Payments pas encore actif sur le compte)"}`
        );
      }
    } else if (r?.nonConnecte) {
      ajouterJournal("🔌 QuickBooks non connecté — le dépôt est actif, mais aucune facture n'a été créée (Paramètres → Connexions)");
    } else if (r?.simule) {
      ajouterJournal("🧪 QuickBooks non configuré ici — dépôt actif, facture non créée (normal en local)");
    } else if (r?.erreur) {
      ajouterJournal(`⚠️ Facture de dépôt QuickBooks NON créée : ${r.erreur} — le dépôt reste actif quand même`);
    }
    // Le courriel de demande de dépôt — aux destinataires choisis.
    const adresses = adressesDepot;
    if (adresses.length === 0) {
      ajouterJournal(`📞 Aucun courriel choisi pour le dépôt de ${infos.clientNom} — appelle le client pour le paiement`);
      return;
    }
    // RÈGLE VALIDÉE (2026-08-17) : en PRODUCTION QuickBooks avec envoi
    // confirmé, la facture officielle (taxée) suffit — notre courriel
    // maison se tait. En SANDBOX (fichier américain sans TPS/TVQ), les
    // DEUX partent : le nôtre porte les bons montants taxés.
    if (r?.environnement === "production" && r?.envoiQb?.envoyee) {
      return;
    }
    const rc = await envoyerCourriel({
      a: adresses,
      sujet: `Dépôt requis — réservation de votre appel de service (${configEntreprise.nomCommercial || configEntreprise.nomLegal})`,
      html: gabaritDemandePaiement({
        config: configEntreprise,
        clientNom: infos.clientNom,
        description:
          `Pour réserver votre appel de service${infos.zone ? ` (${infos.zone})` : ""}, un dépôt est requis sous ` +
          `${libelleDelai}. ` +
          `${facture?.docNumber ? `Référence : facture Nº ${facture.docNumber}. ` : ""}` +
          `Dès sa réception, votre rendez-vous est confirmé.` +
          `${objetVisite ? ` Objet de la visite : ${objetVisite}.` : ""}`,
        lignes: [{ etiquette: `Dépôt — appel de service${infos.zone ? ` (${infos.zone})` : ""}${infos.titre ? ` — ${String(infos.titre).trim()}` : ""}`, montant: t.ht }],
        tps: t.tps,
        tvq: t.tvq,
        total: t.total,
        lienPaiement: facture?.lienPaiement || null,
        conditions: conditionsDepot,
        lienConditions,
        // Les DIX clauses, au complet, dans le courriel même — le
        // client les a sous les yeux avant de payer, pas « sur demande ».
        termesHtml: termesHtmlCourriel(),
      }),
    });
    if (rc.envoye) {
      ajouterJournal(`✉️ Demande de dépôt de ${t.total.toFixed(2)} $ (taxes incl.) ENVOYÉE à ${adresses.join(", ")}`);
    } else if (rc.simule) {
      ajouterJournal("🔧 Demande de dépôt SIMULÉE (pas de service de courriels ici) — appelle le client");
    } else {
      ajouterJournal(`⚠️ Courriel de dépôt NON parti (${rc.erreur || "erreur"}) — appelle le client, le dépôt reste actif`);
    }
  };
  const depotPayeManuel = (tacheId, mode) => {
    setDepots((prev) => ({ ...prev, [tacheId]: { ...(prev[tacheId] || { tacheId }), statut: "paye_manuellement", modePaiement: mode } }));
    marquerDepotPayeManuellement(tacheId, mode, session?.user?.email).catch(() => {});
    ajouterJournal(`💰 Dépôt reçu manuellement (${mode}) — tâche débloquée pour la planification`);
  };

  // Travaux effectués (terrain -> bureau) — les tâches terminées par les
  // techniciens arrivent ici en direct (avec leur taux coûtant figé) et
  // alimentent les coûts réels des projets + le dossier client.
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const charger = async () => {
      try {
        const reels = await listerTravauxEffectues();
        if (!annule) {
          setTravaux((prev) => [...prev.filter((t) => !t.supabase), ...reels]);
        }
      } catch {
        // table absente — les travaux de démo continuent seuls
      }
    };
    charger();
    const desabonner = sAbonnerTravauxEffectues(charger);
    return () => {
      annule = true;
      desabonner();
    };
  }, [session]);

  // ⏱️ Le statut « en cours » arrive en DIRECT (Realtime) : dès qu'un
  // technicien pèse Débuter ou Terminer, son bloc d'agenda change de
  // couleur ici — sans recharger la page.
  useEffect(() => {
    if (!session) return;
    const desabonner = sAbonnerTachesAssignees((p) => {
      const ligne = p?.new;
      if (!ligne?.tache_id || !ligne?.employe_email) return;
      setStatutsAssignations((prev) => ({
        ...prev,
        [`${ligne.tache_id}|${ligne.employe_email.toLowerCase()}`]: ligne.statut || "planifiee",
      }));
      // 🤝 Assignation d'un sous-traitant modifiée (statut Présent/Pas
      // venu posé sur l'autre poste, nouveau bloc…) : la liste locale
      // suit en direct.
      if (estCourrielST(ligne.employe_email)) {
        setAssignationsST((prev) => {
          const restantes = prev.filter((a) => !(a.tache_id === ligne.tache_id && a.employe_email === ligne.employe_email));
          return [ligne, ...restantes];
        });
      }
    });
    return desabonner;
  }, [session]);

  // BONS DE TRAVAIL signés sur le terrain (terrain -> bureau) : dès que
  // le technicien clique « Terminer et envoyer », son bon arrive ici en
  // direct comme DEMANDE DE FACTURATION (onglet Facturation).
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const chargerBons = async () => {
      try {
        const reels = await listerBonsTravail();
        if (!annule) setBons((prev) => [...reels, ...prev.filter((b) => !b.supabase)]);
      } catch {
        // table absente (snippet 16 non exécuté) — les bons de démo continuent seuls
      }
    };
    chargerBons();
    const desabonnerBons = sAbonnerBonsTravail(chargerBons);
    return () => {
      annule = true;
      desabonnerBons();
    };
  }, [session]);

  // Répertoire des fournisseurs — chargé à la connexion.
  useEffect(() => {
    if (!session) return;
    listerFournisseurs()
      .then(setFournisseurs)
      .catch(() => {
        // table absente (snippet 17 non exécuté) — la liste reste vide,
        // le formulaire de BC permet quand même la saisie libre
      });
  }, [session]);

  // Parc de véhicules — chargé à la connexion.
  useEffect(() => {
    if (!session) return;
    listerCamions()
      .then(setParcCamions)
      .catch(() => {
        // table absente (snippet 18 non exécuté) — la liste des camions
        // reste déduite des inspections, comme avant
      });
  }, [session]);

  // CLIENTS · PROJETS · TÂCHES EN ATTENTE — chargés depuis Supabase à la
  // connexion + temps réel. Ces trois-là disparaissaient au rechargement.
  // Les données de démonstration ne servent plus que de repli si la table
  // est absente (snippet 22 non exécuté).
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const charger = () => {
      listerClients()
        .then((liste) => {
          if (!annule && liste.length > 0) setClients(liste);
        })
        .catch(() => {});
      listerProjets()
        .then((liste) => {
          if (!annule && liste.length > 0) setProjets(liste);
        })
        .catch(() => {});
      listerTachesAttente()
        .then((liste) => {
          if (!annule) setTachesAttente(liste);
        })
        .catch(() => {});
    };
    charger();
    const d1 = sAbonnerClients(charger);
    const d2 = sAbonnerProjets(charger);
    const d3 = sAbonnerTachesAttente(charger);
    return () => {
      annule = true;
      d1();
      d2();
      d3();
    };
  }, [session]);

  // ------------------------------------------------------------
  // SAUVEGARDE AUTOMATIQUE de clients / projets / tâches en attente.
  // Plutôt que d'appeler la persistance à chaque endroit qui modifie ces
  // listes (une dizaine), on compare ici avec le dernier état enregistré
  // et on n'écrit QUE ce qui a réellement changé. Aucun point de
  // mutation ne peut donc être oublié.
  // ------------------------------------------------------------
  const dejaEnregistre = useRef({ clients: {}, projets: {}, taches: {} });
  // ÉTAT, PAS UN REF. Avec un ref, rien ne se re-rendait quand le délai
  // de 2,5 s expirait : une tâche créée AVANT (typiquement la tâche de
  // retour, générée dès que les bons de travail arrivent) était vue par
  // l'effet alors qu'il refusait encore d'écrire, puis plus jamais —
  // elle vivait à l'écran et disparaissait au rechargement. En état, le
  // passage à `true` relance l'effet et rattrape tout ce qui attendait.
  const [persistanceActive, setPersistanceActive] = useState(false);
  useEffect(() => {
    // Laisse le temps au chargement initial de se faire avant d'écrire.
    if (!session) return;
    const t = setTimeout(() => setPersistanceActive(true), 2500);
    return () => clearTimeout(t);
  }, [session]);

  useEffect(() => {
    if (!session || !persistanceActive) return;
    const t = setTimeout(() => {
      const memoire = dejaEnregistre.current;
      const synchroniser = (liste, cle, sauvegarder, etiquette) => {
        (liste || []).forEach((element) => {
          const signature = JSON.stringify(element);
          if (memoire[cle][element.id] === signature) return;
          memoire[cle][element.id] = signature;
          sauvegarder(element).catch(() =>
            ajouterJournal(`⚠️ ${etiquette} « ${element.nom || element.titre || element.id} » affiché localement mais NON enregistré — vérifie la connexion.`)
          );
        });
      };
      synchroniser(clients, "clients", sauvegarderClient, "Client");
      synchroniser(projets, "projets", sauvegarderProjet, "Projet");
      synchroniser(tachesAttente, "taches", sauvegarderTacheAttente, "Tâche");
      // Tâches sorties de la file (placées à l'horaire ou supprimées).
      Object.keys(memoire.taches).forEach((id) => {
        if (!(tachesAttente || []).some((t) => t.id === id)) {
          delete memoire.taches[id];
          retirerTacheAttente(id).catch(() => {});
        }
      });
    }, 600); // regroupe les modifications rapprochées en une seule écriture
    return () => clearTimeout(t);
  }, [clients, projets, tachesAttente, session, persistanceActive]);

  // JOURNAL D'ACTIVITÉ — piste d'audit partagée (avant : navigateur seul).
  useEffect(() => {
    if (!session) return;
    listerJournal()
      .then((liste) => {
        if (liste.length > 0) setJournal(liste);
      })
      .catch(() => {
        // table absente — le journal local (localStorage) continue seul
      });
  }, [session]);

  // DEVIS — chargés depuis Supabase à la connexion + temps réel. Avant,
  // ils vivaient seulement en mémoire et disparaissaient au rechargement.
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const chargerDevis = () => {
      listerDevis()
        .then((liste) => {
          if (!annule) setDevisListe(liste);
        })
        .catch(() => {
          // table absente (snippet 21 non exécuté) — la liste reste locale
        });
    };
    chargerDevis();
    const desabonner = sAbonnerDevis(chargerDevis);
    return () => {
      annule = true;
      desabonner();
    };
  }, [session]);

  // Carnet d'entretien du parc — chargé à la connexion + temps réel.
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const chargerCarnet = () => {
      listerCarnetVehicules()
        .then((liste) => {
          if (!annule) setCarnetVehicules(liste);
        })
        .catch(() => {
          // table absente (snippet 19 non exécuté) — carnet vide
        });
    };
    chargerCarnet();
    const desabonner = sAbonnerCarnetVehicules(chargerCarnet);
    return () => {
      annule = true;
      desabonner();
    };
  }, [session]);

  // Grille RÉSIDENTIELLE (CCQ) — le même métier×niveau, l'autre secteur.
  const [tauxMetiersRes, setTauxMetiersRes] = useState({});
  // Grille des taux — chargée depuis Supabase à la connexion. La
  // sauvegarde est EXPLICITE (bouton « Sauvegarder les taux », réservé à
  // l'Admin principal, dans l'onglet Utilisateurs).
  useEffect(() => {
    if (!session) return;
    listerTaux()
      .then(({ com, res }) => {
        setTauxMetiers((prev) => {
          const fusion = { ...prev };
          Object.entries(com).forEach(([m, niveaux]) => {
            fusion[m] = { ...(fusion[m] || {}), ...niveaux };
          });
          return fusion;
        });
        // Grille RÉSIDENTIELLE — parallèle à la commerciale, mêmes clés.
        setTauxMetiersRes(res || {});
      })
      .catch(() => {
        // table absente — la grille locale continue seule
      });
  }, [session]);

  // Répertoire des employés — chargé depuis Supabase (persistant à
  // travers les rechargements) et fusionné avec les données de démo ;
  // les employés réels priment sur les fiches de démo de même id.
  // Le signal `repertoireCharge` (déclaré plus haut) est levé à la fin
  // de ce chargement : la reconstruction de l'agenda l'attend pour
  // rattacher les tâches aux bons employés (sinon course -> orphelines).
  useEffect(() => {
    if (!session) return;
    let annule = false;
    listerEmployes()
      .then((reels) => {
        if (annule) return;
        setUtilisateurs((prev) => {
          const idsReels = new Set(reels.map((r) => r.id));
          let fusion = [...prev.filter((u) => !idsReels.has(u.id)), ...reels];
          // Le compte CONNECTÉ obtient automatiquement sa fiche dans le
          // répertoire (persistée) s'il n'en a pas — il apparaît ainsi
          // dans l'onglet Utilisateurs ET dans l'agenda, et on peut lui
          // définir un métier/niveau (nécessaire au taux figé).
          const courrielSession = session.user?.email?.toLowerCase();
          if (courrielSession && !fusion.some((u) => (u.courriel || "").toLowerCase() === courrielSession)) {
            const fiche = {
              id: `u-${courrielSession}`,
              nom: session.user?.user_metadata?.nom || courrielSession.split("@")[0],
              courriel: courrielSession,
              telephone: "",
              nomUtilisateur: courrielSession.split("@")[0],
              typeAcces: "Admin principal",
              motDePasseCree: true,
            };
            fusion = [fiche, ...fusion];
            sauvegarderEmploye(fiche).catch(() => {});
          }
          return fusion;
        });
        setRepertoireCharge(true);
      })
      .catch(() => {
        // table absente — le répertoire de démo continue en local
        setRepertoireCharge(true);
      });
    return () => {
      annule = true;
    };
  }, [session]);

  // Chargement des inspections & entretiens depuis Supabase + mise à
  // jour en direct (Realtime). Repli sur les données de démo si la
  // table n'est pas accessible (policies pas encore lancées).
  useEffect(() => {
    if (!session) return;
    let annule = false;
    const charger = async () => {
      try {
        const [ins, ent] = await Promise.all([listerInspections(), listerEntretiens()]);
        if (!annule) {
          setInspections(ins);
          setEntretiens(ent);
        }
      } catch {
        if (!annule) {
          setInspections(INSPECTIONS_INIT);
          setEntretiens(ENTRETIENS_INIT);
        }
      }
    };
    charger();
    const desabonner = sAbonnerInspections(charger);
    return () => {
      annule = true;
      desabonner();
    };
  }, [session]);

  const compteurJournal = useRef(0);
  const ajouterJournal = (texte) => {
    const maintenant = new Date();
    const heure = maintenant.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
    const date = dateISO(maintenant);
    compteurJournal.current += 1;
    const id = `${Date.now()}-${compteurJournal.current}`;
    // Traçabilité (Loi 25) : chaque entrée consigne QUI a déclenché
    // l'action — le nom (métadonnées) ou le courriel du compte connecté.
    const par = session?.user?.user_metadata?.nom || session?.user?.email || "système";
    setJournal((prev) => [{ id, texte, heure, date, par }, ...prev].slice(0, PLAFOND_JOURNAL));
    // Piste d'audit PARTAGÉE : l'entrée part aussi en base (append-only),
    // pour survivre au changement de poste et être visible par tous.
    if (session) ajouterEntreeJournal({ texte, par, date, heure }, session).catch(() => {});
  };

  // Chargement de l'historique depuis localStorage APRÈS le montage.
  // On n'initialise PAS l'état directement avec localStorage : sinon le
  // serveur rend un journal vide et le client un journal plein → erreur
  // d'hydratation. On le charge donc une fois monté, côté client.
  useEffect(() => {
    const stocke = chargerJournalDepuisStockage();
    if (stocke.length > 0) setJournal(stocke);
  }, []);

  // Persistance de l'historique (audit trail) — jamais au tout premier
  // rendu (sinon on écraserait le stockage avec un journal vide avant
  // même de l'avoir chargé), puis à chaque changement réel ensuite.
  useEffect(() => {
    if (!journalInitialise.current) {
      journalInitialise.current = true;
      return;
    }
    sauvegarderJournal(journal);
  }, [journal]);

  const ajouterTacheAgenda = (tache) => {
    setTachesAttente((prev) => [tache, ...prev]);
  };

  const compteAlertes = bons.filter((b) => b.statutQb === "en_attente").length;

  // ------------------------------------------------------------
  // SYNCHRONISATION QUICKBOOKS — factures & dépenses par projet
  // Levé ici (plutôt que dans un onglet précis) pour que l'onglet
  // Clients ET le Hub Projets partagent la même source de vérité.
  // ------------------------------------------------------------
  const [transactionsQb, setTransactionsQb] = useState([]);
  const [syncQbEnCours, setSyncQbEnCours] = useState(false);
  // Attributions manuelles QuickBooks PERSISTÉES { quickbooksId: projetId }
  // — chargées de Supabase, ré-appliquées à chaque synchro pour survivre
  // au rafraîchissement.
  const [attributionsQb, setAttributionsQb] = useState({});
  const attributionsQbRef = useRef(attributionsQb);
  attributionsQbRef.current = attributionsQb;
  // 🔎 Miroirs à jour de `projets` et `clients` — lus par le SONDAGE
  // d'arrière-plan (voir plus bas). Passer par des réfs évite de
  // relancer la minuterie chaque fois qu'un projet ou un client change :
  // le sondage lit toujours les valeurs fraîches sans se réinstaller.
  const projetsRef = useRef(projets);
  projetsRef.current = projets;
  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const achatsLibresRef = useRef(achatsLibres);
  achatsLibresRef.current = achatsLibres;
  // 📅 Miroir de la config — le sondage d'arrière-plan lit la
  // date-plancher fraîche sans se réinstaller quand elle change.
  const configEntRef = useRef(configEntreprise);
  configEntRef.current = configEntreprise;
  useEffect(() => {
    if (!session) return;
    listerAttributionsQb()
      .then((a) => setAttributionsQb(a))
      .catch(() => {
        // table absente — les attributions restent locales à la session
      });
  }, [session]);

  const synchroniserQuickBooksProjets = async () => {
    // Conformité : la synchronisation QuickBooks est réservée aux rôles
    // administrateurs — garde en profondeur même si un bouton restait
    // cliquable par erreur (l'interface les désactive aussi).
    if (!peutSynchroniserQb) {
      ajouterJournal("⛔ Tentative de synchronisation QuickBooks refusée — rôle non autorisé");
      return;
    }
    setSyncQbEnCours(true);
    // VRAIES transactions d'abord (route serveur — Sandbox tant que la
    // bascule production n'est pas faite). Repli honnête : tant que les
    // clés ne sont pas posées, la démo continue de fonctionner.
    // 📅 La date-plancher des Paramètres voyage avec la demande : rien
    // n'est lu dans QuickBooks avant cette date.
    const reponse = await listerTransactionsQuickbooks(configEntreprise?.qbLectureDepuis);
    let brutes;
    let sourceReelle = false;
    if (Array.isArray(reponse.transactions)) {
      brutes = reponse.transactions;
      sourceReelle = true;
    } else if (reponse.simule) {
      brutes = await fetchQuickBooksTransactions();
      ajouterJournal("🧪 QuickBooks en MODE SIMULÉ (clés serveur absentes) — données de démonstration affichées");
    } else if (reponse.nonConnecte) {
      setSyncQbEnCours(false);
      ajouterJournal("🔌 QuickBooks n'est pas encore connecté — Paramètres → Connexions pour brancher l'entreprise");
      return;
    } else {
      setSyncQbEnCours(false);
      ajouterJournal(`⚠️ Synchronisation QuickBooks impossible : ${reponse.erreur || "erreur inconnue"}`);
      return;
    }
    // Attribution AUTOMATIQUE (Règle 1/2), PUIS on ré-applique par-dessus
    // les attributions MANUELLES enregistrées (la décision humaine prime
    // et survit au rafraîchissement).
    const manuelles = attributionsQbRef.current || {};
    const enrichies = brutes.map((t) => enrichirTransactionQb(t, manuelles, projets, clients, achatsLibres));
    setTransactionsQb(enrichies);
    // 🔗 RACCORD DES FICHES PAR NOM (2026-08-28) : une facture dont le
    // client QuickBooks porte le même nom qu'une fiche SANS lien pose le
    // lien quickbooksCustomerId sur la fiche — les prochaines synchros
    // (et les factures de dépôt) le trouveront directement.
    try {
      const dejaRaccordes = new Set();
      for (const t of brutes) {
        if (t.type !== "INVOICE" || !t.customerRefId || !t.clientNomQb) continue;
        if (dejaRaccordes.has(t.customerRefId)) continue;
        if (clients.some((c) => c.quickbooksCustomerId === t.customerRefId)) continue;
        const fiche = clientQbDeTransaction({ clientNomQb: t.clientNomQb }, clients);
        if (!fiche || fiche.quickbooksCustomerId) continue;
        dejaRaccordes.add(t.customerRefId);
        const ficheMaj = { ...fiche, quickbooksCustomerId: t.customerRefId };
        setClients((prev) => prev.map((c) => (c.id === fiche.id ? ficheMaj : c)));
        await sauvegarderClient(ficheMaj);
        ajouterJournal(`🔗 Fiche « ${fiche.nom} » reliée à son client QuickBooks (nº ${t.customerRefId}) — appariement par nom.`);
      }
    } catch {
      // le raccord est un bonus — un échec ne bloque jamais la synchro
    }
    // ⚠️ Écarts de prix BC ↔ facture réelle : UNE ligne agrégée par
    // synchro manuelle (le sondage d'arrière-plan, lui, reste muet —
    // les badges s'allument d'eux-mêmes dans Pièces en commande).
    const bcsAvecDepense = new Map();
    enrichies.forEach((t) => {
      if (t.type !== "EXPENSE") return;
      const num = String(t.cible?.bc || t.poNumber || "").trim().toUpperCase();
      if (num) bcsAvecDepense.set(num, Number(t.amountHT) || 0);
    });
    const nbEcarts = (achatsLibres || []).filter((a) => {
      const reel = a.numeroBc ? bcsAvecDepense.get(String(a.numeroBc).trim().toUpperCase()) : undefined;
      return reel !== undefined && Math.abs(reel - (Number(a.montantHT) || 0)) > 1;
    }).length;
    if (nbEcarts > 0) {
      ajouterJournal(`⚠️ ${nbEcarts} écart${nbEcarts > 1 ? "s" : ""} de prix BC ↔ facture QuickBooks — ouvre « Pièces en commande » (badges orange) pour valider.`);
    }
    const nbAssignees = enrichies.filter((t) => t.cible).length;
    const nbNonAssignees = enrichies.length - nbAssignees;
    ajouterJournal(
      `🔄 ${enrichies.length} transactions QuickBooks${sourceReelle ? "" : " (démo)"} synchronisées — ${nbAssignees} attribuées automatiquement, ${nbNonAssignees} en attente d'attribution manuelle`
    );
    setSyncQbEnCours(false);
  };

  // `cible` = { type: "projet"|"tache"|"client", id } — ou null pour
  // retirer l'attribution (retour à l'automatique). Trois familles
  // depuis le 2026-08-26 : un achat pour une job sans projet n'avait
  // avant AUCUNE destination possible.
  const assignerTransactionManuellement = (quickbooksId, cible) => {
    const valide = cible?.type && cible?.id ? cible : null;
    setTransactionsQb((prev) =>
      prev.map((t) =>
        t.quickbooksId === quickbooksId
          ? { ...t, cible: valide, projectId: valide?.type === "projet" ? valide.id : null }
          : t
      )
    );
    setAttributionsQb((prev) => {
      const suivant = { ...prev };
      if (valide) suivant[quickbooksId] = valide;
      else delete suivant[quickbooksId];
      return suivant;
    });
    // PERSISTANCE : la décision survit au rafraîchissement (table Supabase).
    enregistrerAttributionQb(quickbooksId, valide, session?.user?.email).catch(() =>
      ajouterJournal("⚠️ Attribution affichée mais NON enregistrée — passe le snippet SQL 78 (elle sera perdue au rafraîchissement).")
    );
    if (!valide) {
      ajouterJournal(`✋ Transaction QuickBooks ${quickbooksId} détachée — elle redevient à attribuer.`);
      return;
    }
    if (valide.type === "hors") {
      ajouterJournal(`🚫 Transaction QuickBooks ${quickbooksId} marquée « Hors Fluxya » — elle ne concerne aucune job (réversible dans le bloc des factures à rattacher).`);
      return;
    }
    const nom =
      valide.type === "projet"
        ? `projet « ${projets.find((x) => x.id === valide.id)?.nom || valide.id} »`
        : valide.type === "client"
        ? `client « ${clients.find((x) => x.id === valide.id)?.nom || valide.id} »`
        : `job « ${(bons || []).find((b) => b.tacheId === valide.id)?.projet || valide.id} »`;
    ajouterJournal(`✋ Transaction QuickBooks ${quickbooksId} rattachée manuellement au ${nom} — son coût y est maintenant compté.`);
  };

  // Badge de la navigation : nombre de projets à risque (dépassement,
  // perte, ou en retard). Mémorisé — sans quoi ce calcul (qui appelle
  // calculerRentabiliteProjet pour CHAQUE projet) se refaisait à
  // chaque rendu de App, même pour un changement sans rapport (changer
  // d'onglet, taper dans un champ ailleurs, ouvrir une modale).
  const compteRisqueProjets = useMemo(
    () =>
      projets.filter((p) => {
        const r = calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers);
        return r.depassementBudget || r.profitReel < 0 || projetEnRetard(p);
      }).length,
    [projets, travaux, transactionsQb]
  );

  // ============================================================
  // 💰 SONDAGE QUICKBOOKS EN ARRIÈRE-PLAN (option A, 2026-08-22)
  // ------------------------------------------------------------
  // Ferme la boucle comptable sans que personne ait à y penser :
  //   • DÉPÔTS — un client paie sa facture de dépôt dans QuickBooks ?
  //     La tâche se débloque toute seule (avant : elle attendait qu'un
  //     admin la débloque à la main, sans jamais savoir que l'argent
  //     était rentré).
  //   • ACHATS — les transactions se rafraîchissent aussi, plus
  //     espacées : c'était la seule limite du rattachement par numéro
  //     de BC, qui exigeait de peser sur le bouton.
  //
  // ⚠️ PLACÉ AVANT LES RETOURS ANTICIPÉS du composant : un hook
  // placé après un « return » conditionnel casse l'ordre des hooks de
  // React. Le rôle est donc résolu dans le corps de l'effet.
  //
  // Silencieux par nature : le journal ne parle QUE s'il se passe
  // quelque chose. Une panne réseau ou un QuickBooks non connecté ne
  // produit aucun bruit — le bouton manuel reste le chemin de secours.
  // ============================================================
  const sondageQbRef = useRef({ derniereTransactions: 0 });
  useEffect(() => {
    if (!session || !accesCharge) return;
    // Le droit est calculé ICI (et pas via `peutSynchroniserQb`) : ce
    // hook vit AVANT les retours anticipés du composant, donc avant que
    // le rôle soit résolu plus bas. Les hooks doivent toujours être
    // appelés dans le même ordre — jamais après un « return ».
    const { role: roleSonde } = permissionsEffectives(accesPerso, session);
    if (roleSonde !== 'Admin principal' && roleSonde !== 'Admin régulier') return;
    let annule = false;
    const INTERVALLE_DEPOTS = 3 * 60 * 1000; // 3 min — l'argent du client
    const INTERVALLE_TRANSACTIONS = 15 * 60 * 1000; // 15 min — les achats

    const sonder = async () => {
      if (annule || typeof document !== "undefined" && document.hidden) return;
      // 1) Les dépôts payés — le cœur de l'option A.
      try {
        const r = await sonderDepotsPayes();
        if (annule) return;
        (r?.payes || []).forEach((p) => {
          setDepots((prev) => ({
            ...prev,
            [p.tacheId]: {
              ...(prev[p.tacheId] || {}),
              statut: "paye",
              modePaiement: "QuickBooks",
              payeLe: new Date().toISOString(),
              payePar: "QuickBooks (paiement détecté)",
            },
          }));
          ajouterJournal(
            `💰 Dépôt PAYÉ détecté dans QuickBooks${p.docNumber ? ` (facture Nº ${p.docNumber})` : ""} — ${Number(p.montant || 0).toFixed(2)} $ : la tâche est maintenant planifiable.`
          );
        });
      } catch {
        // silencieux : réseau ou QuickBooks non connecté
      }
      // 2) Les transactions d'achat — plus espacées, elles bougent moins.
      const maintenant = Date.now();
      if (maintenant - sondageQbRef.current.derniereTransactions >= INTERVALLE_TRANSACTIONS) {
        sondageQbRef.current.derniereTransactions = maintenant;
        try {
          const r = await listerTransactionsQuickbooks(configEntRef.current?.qbLectureDepuis);
          if (annule || !Array.isArray(r?.transactions)) return;
          const manuelles = attributionsQbRef.current || {};
          setTransactionsQb(
            r.transactions.map((t) =>
              enrichirTransactionQb(t, manuelles, projetsRef.current || [], clientsRef.current || [], achatsLibresRef.current || [])
            )
          );
        } catch {
          // silencieux — le bouton « Synchroniser » reste là
        }
        // ⬇️ DESCENTE SILENCIEUSE DES CLIENTS (2026-08-29, même cadence) :
        // un client créé directement dans QuickBooks (par la comptable)
        // apparaît tout seul dans Fluxya en ~15 minutes — « si le client
        // appelle, qu'il soit facile à retrouver ». Idempotent côté
        // serveur ; le Realtime rafraîchit la liste ; on ne parle au
        // journal que s'il y a du NOUVEAU.
        try {
          const rc = await synchroniserClientsQbo({ descendre: true });
          if (!annule && (rc?.crees || 0) > 0) {
            ajouterJournal(
              `⬇️ ${rc.crees} nouveau${rc.crees > 1 ? "x" : ""} client${rc.crees > 1 ? "s" : ""} QuickBooks descendu${rc.crees > 1 ? "s" : ""} dans Fluxya — trouvable${rc.crees > 1 ? "s" : ""} dès maintenant à la création d'une tâche.`
            );
          }
        } catch {
          // silencieux — le bouton de l'onglet Clients reste là
        }
      }
    };

    sonder();
    const minuterie = setInterval(sonder, INTERVALLE_DEPOTS);
    return () => {
      annule = true;
      clearInterval(minuterie);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, accesCharge, accesPerso]);

  if (!authVerifie) {
    return <SqueletteAdmin />;
  }
  if (!session) {
    return <ConnexionAdmin />;
  }
  if (!accesCharge) {
    return <SqueletteAdmin />;
  }

  // --- Rôle + permissions effectifs (accès personnalisés > défauts du rôle) ---
  const { role, sousCategorie, sections: permissionsBrutes } = permissionsEffectives(accesPerso, session);
  // PARAMÈTRES — RÉSERVÉ À L'ADMIN PRINCIPAL, sans exception.
  // Verrou posé ici plutôt que dans la seule liste d'accès : même si la
  // section se retrouvait cochée pour quelqu'un d'autre (à la main dans
  // Gestion des accès, ou par une vieille ligne en base), elle reste
  // hors de portée. L'écran des Paramètres touche les coordonnées
  // envoyées aux clients, les taux de taxes et les règles de paie.
  const permissionsSelonRole =
    role === "Admin principal" ? permissionsBrutes : permissionsBrutes.filter((s) => s !== "parametres");
  // 🧩 MODULES À LA CARTE — la plateforme décide ce que CETTE entreprise
  // a dans son forfait ; personne (Admin principal compris) ne voit un
  // module absent. `null` = tous les modules (DGL, historique).
  const modulesEntreprise = Array.isArray(configEntreprise?.modules) ? configEntreprise.modules : null;
  const permissions = modulesEntreprise
    ? permissionsSelonRole.filter((s) => modulesEntreprise.includes(s))
    : permissionsSelonRole;
  // AUTORISATION « modifier la liste de prix ». Verrou posé ici, et pas
  // seulement dans l'écran des accès : même si la case se retrouvait
  // cochée pour un autre rôle, elle reste sans effet. Les prix du
  // catalogue servent à tous les devis de l'entreprise.
  const peutModifierListePrix = aAutorisation(role, permissionsBrutes, "modifier-liste-prix");
  // Synchronisation QuickBooks : réservée aux deux rôles administrateurs.
  const peutSynchroniserQb = role === "Admin principal" || role === "Admin régulier";
  const sectionsAdmin = ORDRE_SECTIONS.filter((s) => s !== "technicien" && permissions.includes(s));
  // Onglet effectif : si l'onglet courant n'est pas permis, on retombe sur le 1er autorisé.
  const vue = permissions.includes(onglet) && onglet !== "technicien" ? onglet : sectionsAdmin[0] || "tableau-de-bord";


  if (sectionsAdmin.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
        <p className="text-lg font-extrabold text-slate-800">Accès refusé</p>
        <p className="max-w-sm text-sm text-slate-500">Ton compte ({role}) n'a pas accès au panneau d'administration. Utilise plutôt l'application technicien.</p>
        <button onClick={() => supabase.auth.signOut()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Se déconnecter</button>
      </div>
    );
  }

  return (
    // La configuration de l'entreprise est fournie ici une seule fois :
    // tous les composants en dessous y accèdent par `useEntreprise()`.
    <ContexteEntreprise.Provider value={configEntreprise}>
    <ContexteCatalogue.Provider value={catalogue}>
    <ContexteClients.Provider value={clients}>
    <ContexteDevis.Provider value={devisListe}>
    <div className="flex min-h-screen bg-slate-50">
      <MenuLateral
        vue={vue}
        onChoisir={(id) => setOnglet(id)}
        permissions={permissions}
        badges={{
          facturation: compteAlertes,
          agenda: tachesAttente.length,
          projets: compteRisqueProjets,
          // Propositions d'ajustement d'heures en attente de validation.
          // Propositions en attente + journées bloquées : les deux
          // demandent une action de l'admin, les deux comptent au badge.
          pieces: pieces.filter((p) => p.statut !== "recue" && p.statut !== "annulee").length,
          paies:
            travaux.filter((t) => t.supabase && t.heuresProposees != null).length +
            joursBloques(travaux).size,
        }}
        courriel={session.user?.email}
        role={role}
        onDeconnexion={() => supabase.auth.signOut()}
        ouvert={menuOuvert}
        onFermer={() => setMenuOuvert(false)}
        reduit={menuReduit}
        onBasculerReduit={basculerMenuReduit}
      />

      <div className="flex min-w-0 flex-1 flex-col">
      {/* 📜 PORTE D'ENTENTE — première connexion d'une entreprise
          cliente (jamais pour le Propriétaire ni les employés). */}
      {configEntreprise?.statutPlateforme && configEntreprise.statutPlateforme !== "proprietaire" &&
        !configEntreprise.ententeAccepteeLe && role === "Admin principal" && session && (
        <EcranEntente
          config={configEntreprise}
          session={session}
          onAcceptee={(quand) => {
            setConfigEntreprise((prev) => ({ ...prev, ententeAccepteeLe: quand }));
            ajouterJournal("📜 Entente acceptée au nom de l'entreprise — bienvenue !");
          }}
        />
      )}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        {/* ☰ mobile : ouvre le tiroir. Sur bureau, la bascule du menu se
            fait via la flèche ‹/› dans le menu lui-même. */}
        <button onClick={() => setMenuOuvert(true)} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 md:hidden" aria-label="Ouvrir le menu">
          <Menu size={18} />
        </button>
        <h1 className="shrink-0 text-lg font-extrabold text-[#131B2E]">{LIBELLES_SECTIONS[vue] || "Administration"}</h1>
        {/* 📱 MON HORAIRE (2026-08-20, demande du propriétaire) : un
            admin travaille parfois sur un chantier comme les autres.
            Bascule d'un tap vers SON horaire du jour — la session
            voyage avec lui, aucun mot de passe à retaper. Visible
            seulement si le compte a bien l'accès technicien. */}
        {permissions.includes("technicien") && (
          <button
            onClick={() => {
              transporterSessionPourBascule("technicien");
              window.location.href = "/technicien";
            }}
            title="Ouvrir mon horaire du jour (app terrain)"
            className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            📱 <span className="hidden sm:inline">Mon horaire</span>
          </button>
        )}
        {/* 🔍 RECHERCHE GLOBALE — accessible de partout, comme demandé
            par le propriétaire : la recherche est une PORTE D'ENTRÉE,
            pas une destination. Première frappe = la page Recherche
            s'ouvre avec les résultats ; la barre reste sous les doigts
            (elle vit dans l'en-tête, qui ne se démonte jamais). */}
        {permissions.includes("recherche") && (
          // CENTRÉE dans l'espace libre (demande du propriétaire) : au
          // milieu de l'écran, l'œil la trouve sans la chercher — collée
          // au titre, elle se fondait dans le décor.
          <div className="flex min-w-0 flex-1 justify-center">
            <div className="relative w-full max-w-lg">
              <div className="flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-[#131B2E]">
                <Search size={15} className="shrink-0 text-slate-400" />
                <input
                  value={rechercheGlobale}
                  onChange={(e) => {
                    setRechercheGlobale(e.target.value);
                    setListeRechercheOuverte(!!e.target.value.trim());
                  }}
                  onFocus={() => setListeRechercheOuverte(!!rechercheGlobale.trim())}
                  onBlur={() => setTimeout(() => setListeRechercheOuverte(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setListeRechercheOuverte(false);
                    // Entrée = la page Recherche complète, pour qui aime ça.
                    if (e.key === "Enter" && rechercheGlobale.trim()) {
                      setListeRechercheOuverte(false);
                      setOnglet("recherche");
                    }
                  }}
                  placeholder="Recherche rapide — client, adresse, devis, produit…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                {rechercheGlobale && (
                  <button
                    onClick={() => {
                      setRechercheGlobale("");
                      setListeRechercheOuverte(false);
                    }}
                    aria-label="Effacer la recherche"
                  >
                    <X size={13} className="text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>

              {/* LISTE DÉROULANTE — les résultats viennent à toi, tu ne
                  quittes pas l'écran où tu travailles. `onMouseDown`
                  (pas onClick) : le clic doit gagner contre le blur du
                  champ, sinon la liste se ferme avant d'enregistrer. */}
              {listeRechercheOuverte && rechercheGlobale.trim() && (() => {
                const q = rechercheGlobale.trim().toLowerCase();
                const clientsTrouves = clients.filter((c) => correspond(c, rechercheGlobale)).slice(0, 6);
                const devisTrouves = devisListe
                  .filter(
                    (d) =>
                      (d.numero || "").toLowerCase().includes(q) ||
                      (d.clientNom || "").toLowerCase().includes(q) ||
                      (d.lignes || []).some((l) => (l.nom || "").toLowerCase().includes(q))
                  )
                  .slice(0, 4);
                const ouvrirClient = (c) => {
                  setCibleRecherche({ clientId: c.id, numeroDevis: null });
                  setOnglet("clients");
                  setListeRechercheOuverte(false);
                };
                const ouvrirDevis = (d) => {
                  setCibleRecherche({ clientId: d.clientId, numeroDevis: d.numero });
                  setOnglet("clients");
                  setListeRechercheOuverte(false);
                };
                return (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {clientsTrouves.length === 0 && devisTrouves.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-400">Aucun résultat pour « {rechercheGlobale.trim()} »</p>
                    ) : (
                      <>
                        {clientsTrouves.map((c) => (
                          <button
                            key={c.id}
                            onMouseDown={() => ouvrirClient(c)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <span className="shrink-0">👤</span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold text-slate-800">{c.nom}</span>
                              <span className="block truncate text-[10px] text-slate-400">
                                {c.telephone || c.adresses?.[0]?.ligne1 || c.courriels?.[0]?.email || "—"}
                              </span>
                            </span>
                          </button>
                        ))}
                        {devisTrouves.map((d) => (
                          <button
                            key={d.id}
                            onMouseDown={() => ouvrirDevis(d)}
                            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <span className="shrink-0">📄</span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold text-slate-800">Devis {d.numero}</span>
                              <span className="block truncate text-[10px] text-slate-400">{d.clientNom || "—"}</span>
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                    <button
                      onMouseDown={() => {
                        setListeRechercheOuverte(false);
                        setOnglet("recherche");
                      }}
                      className="w-full border-t border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold text-slate-500 hover:text-slate-800"
                    >
                      Voir tous les résultats →
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {vue === "tableau-de-bord" && (
        <OngletTableauDeBord
          projets={projets}
          travaux={travaux}
          achatsLibres={achatsLibres}
          transactionsQb={transactionsQb}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          parcCamions={parcCamions}
          clients={clients}
          compteAlertes={compteAlertes}
          compteAttente={tachesAttente.length}
          soumissionsSansDevis={soumissionsSansDevis}
          journal={journal}
          setOnglet={setOnglet}
          inspections={inspections}
          entretiens={entretiens}
          bons={bons}
          devisListe={devisListe}
          // 📱 « Aujourd'hui sur le terrain » (téléphone) : qui fait
          // quoi en ce moment. Vient de la grille + des statuts en
          // direct écrits par l'app technicien.
          planning={planning}
          statutsAssignations={statutsAssignations}
        />
      )}

      {vue === "inspections" && (
        <OngletInspectionsVehicules
          inspections={inspections}
          setInspections={setInspections}
          entretiens={entretiens}
          setEntretiens={setEntretiens}
          ajouterJournal={ajouterJournal}
          persisterPriseEnCharge={(id, note) => prendreEnChargeInspection(id, note, session.user?.email).catch(() => {})}
          persisterEntretien={({ camion, km }) => creerEntretien({ camion, km }).catch(() => {})}
          parcCamions={parcCamions}
          setParcCamions={setParcCamions}
          carnet={carnetVehicules}
          setCarnet={setCarnetVehicules}
          onEntreeCarnet={(entree) => ajouterEntreeCarnet(entree, session)}
          onAnomalieReparee={(id) => marquerAnomalieReparee(id).catch(() => {})}
        />
      )}

      {vue === "recherche" && (
        <OngletRecherche
          clients={clients}
          devisListe={devisListe}
          terme={rechercheGlobale}
          setTerme={setRechercheGlobale}
          onOuvrirDevis={(d) => {
            // Amène directement au devis : onglet Clients, dossier du
            // client ouvert, devis mis en évidence dans sa section.
            setCibleRecherche({ clientId: d.clientId, numeroDevis: d.numero });
            setOnglet("clients");
          }}
        />
      )}

      {vue === "clients" && (
        <OngletClients
          clients={clients}
          setClients={setClients}
          ajouterJournal={ajouterJournal}
          travaux={travaux}
          setTravaux={setTravaux}
          inspections={inspections}
          achatsLibres={achatsLibres}
          projets={projets}
          setProjets={setProjets}
          devisListe={devisListe}
          transactionsQb={transactionsQb}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          syncQbEnCours={syncQbEnCours}
          onSyncQuickBooksProjets={synchroniserQuickBooksProjets}
          peutSyncQb={peutSynchroniserQb}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          clientCible={cibleRecherche?.clientId}
          devisCible={cibleRecherche?.numeroDevis}
          onCreerDevis={(id) => { setClientPourNouveauDevis(id); setOnglet("devis"); }}
          bons={bons}
        />
      )}

      {vue === "projets" && (
        <OngletProjetsHub
          projets={projets}
          setProjets={setProjets}
          clients={clients}
          travaux={travaux}
          devisListe={devisListe}
          transactionsQb={transactionsQb}
          bonsTravail={bons}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          syncQbEnCours={syncQbEnCours}
          onSyncQuickBooks={synchroniserQuickBooksProjets}
          peutSyncQb={peutSynchroniserQb}
          onAssignerTransaction={assignerTransactionManuellement}
          ajouterJournal={ajouterJournal}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          inspections={inspections}
        />
      )}

      {vue === "devis" && (
        <OngletDevis
          clients={clients}
          setClients={setClients}
          devisListe={devisListe}
          setDevisListe={setDevisListe}
          persisterDevis={async (d) => {
            // Retourne true si le devis est BEL ET BIEN en base, false
            // sinon. L'appelant s'en sert pour ne JAMAIS envoyer le
            // courriel d'un devis qui n'a pas été enregistré (sinon le
            // client reçoit un lien mort — vécu avec DEV-3509).
            try {
              await sauvegarderDevis(d);
            } catch (e) {
              // L'erreur RÉELLE au journal (2026-08-17, vécu : une
              // colonne manquante a bloqué tous les devis pendant une
              // semaine et le message générique cachait la cause).
              ajouterJournal(`⚠️ Devis ${d.numero} affiché localement mais NON enregistré — erreur de la base : ${e?.message || "connexion impossible"}.`);
              return false;
            }
            // MIROIR QUICKBOOKS (décision du propriétaire : ses devis
            // vivaient dans QuickBooks — on préserve sa pratique). UN
            // estimate par dossier, mis à jour aux révisions. Un échec
            // ne bloque JAMAIS la sauvegarde du devis lui-même — le
            // miroir part en arrière-plan et n'affecte pas le retour.
            if (!d?.clientNom || !Array.isArray(d.lignes) || d.lignes.length === 0) return true;
            // 📝 Un BROUILLON ne va JAMAIS dans QuickBooks : pas de
            // numéro officiel, pas d'estimate — c'est une feuille de
            // travail. Le miroir se fera à la vraie création.
            if (d.statut === "brouillon") return true;
            const ficheClient = clients.find((c) => (c.nom || "").trim().toLowerCase() === (d.clientNom || "").trim().toLowerCase());
            creerEstimateQbo({
              clientId: ficheClient?.id || null,
              clientNom: d.clientNom,
              numero: d.numeroBase || d.numero,
              estimateId: d.qboEstimateId || null,
              lignes: d.lignes.map((l) => ({
                nom: undefined,
                description: l.nom || l.description || "",
                quantite: Number(l.quantite) || 1,
                prixUnitaire: Number(l.prix_vendant) || 0,
              })),
            })
              .then(async (r) => {
                if (r?.creee) {
                  if (r.estimateId && r.estimateId !== d.qboEstimateId) {
                    const avecEstimate = { ...d, qboEstimateId: r.estimateId };
                    setDevisListe((prev) => prev.map((x) => (x.id === d.id ? { ...x, qboEstimateId: r.estimateId } : x)));
                    await sauvegarderDevis(avecEstimate).catch(() => {});
                  }
                  if (!r.misAJour) ajouterJournal(`📋 Devis ${d.numeroBase || d.numero} créé dans QuickBooks (Sandbox — estimate Nº ${r.docNumber})`);
                } else if (r?.erreur) {
                  ajouterJournal(`⚠️ Devis ${d.numero} : miroir QuickBooks non fait (${r.erreur})`);
                }
                // simule / nonConnecte : silencieux — le devis de l'app
                // reste la référence, le miroir se fera plus tard.
              })
              .catch(() => {});
            // Le devis est enregistré — le miroir QuickBooks ci-dessus
            // tourne en arrière-plan sans bloquer ce retour.
            return true;
          }}
          ajouterJournal={ajouterJournal}
          ajouterTacheAgenda={ajouterTacheAgenda}
          setProjets={setProjets}
          onDevisTraite={(destination) => setOnglet(destination)}
          clientCible={clientPourNouveauDevis}
          peutModifierListePrix={peutModifierListePrix}
          onMajCoutCatalogue={async (item) => {
            const sauve = await sauvegarderItem(item);
            setCatalogue((prev) =>
              [...prev.filter((x) => x.id !== sauve.id), sauve].sort((a, b) => a.nom.localeCompare(b.nom))
            );
            ajouterJournal(`💲 Coût de «  » mis à jour dans la liste de prix depuis un devis.`);
          }}
        />
      )}
      {vue === "agenda" && (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) && (
        <div className="px-4 pt-3 md:px-6">
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            🔧 Véhicule{(parcCamions || []).filter((c) => c.actif && camionIndisponible(c)).length > 1 ? "s" : ""} indisponible
            {(parcCamions || []).filter((c) => c.actif && camionIndisponible(c)).length > 1 ? "s" : ""} aujourd'hui :{" "}
            {(parcCamions || [])
              .filter((c) => c.actif && camionIndisponible(c))
              .map((c) => `${c.nom}${c.indispoRaison ? ` (${c.indispoRaison})` : ""}${c.indispoFin ? ` — jusqu'au ${c.indispoFin}` : ""}`)
              .join(" · ")}
            . Prévois un autre véhicule ou un covoiturage pour les techniciens concernés.
          </p>
        </div>
      )}
      {vue === "agenda" && (
        <OngletAgenda
          onMajFacturable={(tacheId, courriel, val) =>
            setFacturablesAssignations((prev) => ({ ...prev, [`${tacheId}|${(courriel || "").toLowerCase()}`]: val }))
          }
          tachesAttente={tachesAttente}
          setTachesAttente={setTachesAttente}
          planning={planning}
          setPlanning={setPlanning}
          statutsAssignations={statutsAssignations}
          onCreerProjet={(p) => {
            setProjets((prev) => [...prev, p]);
            sauvegarderProjet(p).catch(() =>
              ajouterJournal(`⚠️ Projet « ${p.nom} » créé à l'écran mais NON enregistré — réessaie.`)
            );
          }}
          ajouterJournal={ajouterJournal}
          clients={clients}
          setClients={setClients}
          devisListe={devisListe}
          projets={projets}
          travaux={travaux}
          depots={depots}
          prixDepots={prixDepots}
          onCreerDepot={creerDepotPourTache}
          bons={bons}
          pieces={pieces}
          onDepotPaye={depotPayeManuel}
          onDetacherPiece={(pieceId, tache) => {
            // « Garder la tâche sans pièce » : le lien pièce→tâche est
            // coupé, la tâche redevient une tâche normale (planifiable).
            setPieces((prev) => prev.map((x) => (x.id === pieceId ? { ...x, tacheRetourId: null } : x)));
            majPiece(pieceId, { tache_retour_id: null }).catch(() =>
              ajouterJournal("⚠️ Détachement de la pièce non enregistré — réessaie.")
            );
            ajouterJournal(`✔️ Tâche « ${tache.titre} » conservée sans pièce — elle est de nouveau planifiable.`);
          }}
          lectureSeule={sousCategorie === "Chargé de projet"}
          /* Rôle effectif pour les règles d'annulation : les admins
             portent `role`, répartiteur/chargé de projet vivent dans
             `sousCategorie` — on donne à l'agenda la valeur qui compte. */
          role={role === "Admin principal" || role === "Admin régulier" ? role : sousCategorie}
          employes={(() => {
            // Rangées de l'agenda : le répertoire des employés + le compte
            // CONNECTÉ (ajouté d'office s'il n'a pas encore de fiche —
            // pratique pour qu'un admin principal s'assigne des tâches).
            // `estBureau` (métier de bureau) range la personne dans la
            // section repliable « Personnel de bureau » (2026-08-19).
            const liste = utilisateurs.map((u) => ({
              id: u.id,
              nom: u.nom,
              courriel: u.courriel,
              estBureau: estMetierBureau(u.metier),
            }));
            const courrielSession = session.user?.email?.toLowerCase();
            if (courrielSession && !liste.some((e) => (e.courriel || "").toLowerCase() === courrielSession)) {
              liste.unshift({
                id: "compte-connecte",
                nom: `${session.user?.user_metadata?.nom || courrielSession.split("@")[0]} (moi)`,
                courriel: courrielSession,
              });
            }
            // 🤝 Les sous-traitants — rangées de la section du bas.
            sousTraitants
              .filter((st) => st.actif !== false)
              .forEach((st) =>
                liste.push({
                  id: `st-${st.id}`,
                  nom: st.nom,
                  courriel: COURRIEL_ST(st.id),
                  estSousTraitant: true,
                  specialite: st.specialite,
                  clientIdLie: st.clientId || null,
                })
              );
            return liste;
          })()}
          sousTraitants={sousTraitants}
          assignationsST={assignationsST}
          onEnregistrerSousTraitant={async (st) => {
            try {
              await sauvegarderSousTraitant(st);
              setSousTraitants(await listerSousTraitants());
              ajouterJournal(`🤝 Sous-traitant « ${st.nom} » enregistré${st.clientId ? " (lié à une fiche client)" : ""}.`);
            } catch {
              ajouterJournal(`⚠️ Sous-traitant « ${st.nom} » NON enregistré — la table sous_traitants_app existe-t-elle (snippet SQL 75) ?`);
            }
          }}
          onStatutST={async (tacheId, courrielSt, complement, resume) => {
            // Statut Présent / Pas venu (+ note, + montant) — écrit dans
            // la fiche `donnees` de l'assignation du sous-traitant.
            try {
              await majDonneesAssignation(tacheId, courrielSt, complement);
              setAssignationsST((prev) =>
                prev.map((a) =>
                  a.tache_id === tacheId && a.employe_email === courrielSt
                    ? { ...a, donnees: { ...(a.donnees || {}), ...complement } }
                    : a
                )
              );
              if (resume) ajouterJournal(resume);
            } catch {
              ajouterJournal("⚠️ Statut du sous-traitant NON enregistré — réessaie.");
            }
          }}
          onAjouterCoutSousTraitant={(projetId, nomSt, montant, refUnique) => {
            // Le montant facturé PAR le sous-traitant entre aux coûts
            // réels du projet lié — sans double saisie ni doublon (la
            // référence unique tacheId|st est réécrite, jamais ajoutée
            // deux fois).
            setProjets((prev) =>
              prev.map((p) => {
                if (p.id !== projetId) return p;
                const existants = (p.sousTraitants || []).filter((x) => x.stRef !== refUnique);
                return { ...p, sousTraitants: [...existants, { nom: nomSt, facture: "", coutant: montant, stRef: refUnique }] };
              })
            );
            ajouterJournal(`🤝 ${montant.toFixed(2)} $ de sous-traitance (${nomSt}) ajoutés aux coûts réels du projet.`);
          }}
        />
      )}
      {vue === "facturation" && (
        <OngletFacturation
          bons={bons}
          setBons={setBons}
          // 👥 Courriel → nom : nomme le technicien manquant sur le badge
          // « équipe incomplète » (sinon on n'aurait que son courriel).
          nomsEmployes={Object.fromEntries(
            (utilisateurs || []).filter((u) => u.courriel).map((u) => [u.courriel.toLowerCase(), u.nom])
          )}
          assignationsST={assignationsST}
          onMarquerSTFacture={async (tacheId, courrielSt) => {
            try {
              await majDonneesAssignation(tacheId, courrielSt, { stFacture: true, stFactureLe: new Date().toISOString() });
              setAssignationsST((prev) =>
                prev.map((a) =>
                  a.tache_id === tacheId && a.employe_email === courrielSt
                    ? { ...a, donnees: { ...(a.donnees || {}), stFacture: true } }
                    : a
                )
              );
              ajouterJournal("🤝 Sous-traitance marquée FACTURÉE au client — retirée de la liste de rappel.");
            } catch {
              ajouterJournal("⚠️ Marquage « facturé » NON enregistré — réessaie.");
            }
          }}
          ajouterJournal={ajouterJournal}
          devisListe={devisListe}
          clients={clients}
          depots={depots}
          pieces={pieces}
          inspections={inspections}
          prixDepots={prixDepots}
          estAdminPrincipal={role === "Admin principal"}
          facturablesAssignations={facturablesAssignations}
          achatsLibres={achatsLibres}
          travaux={travaux}
          // 🗺️ Zone d'un appel retrouvée depuis l'agenda (les tâches y
          // portent leur fiche complète) — le bon de travail, lui, ne la
          // stocke pas. Repli : la file d'attente.
          zonePourTache={(tacheId) => {
            if (!tacheId) return null;
            for (const valeur of Object.values(planning)) {
              for (const t of listeCellule(valeur)) {
                if (t?.id === tacheId) return t.zoneAppel || null;
              }
            }
            return (tachesAttente || []).find((t) => t.id === tacheId)?.zoneAppel || null;
          }}
          onAjouterCourrielClient={(clientId, email) => {
            if (!clientId || !email) return;
            setClients((prev) =>
              prev.map((c) => {
                if (c.id !== clientId) return c;
                if ((c.courriels || []).some((cc) => (cc.email || "").toLowerCase() === email.toLowerCase())) return c;
                return { ...c, courriels: [...(c.courriels || []), { id: `cc-${Date.now()}`, label: "Ajouté à l'envoi", email, defaut: (c.courriels || []).length === 0 }] };
              })
            );
            ajouterJournal(`💾 ${email} ajouté à la fiche du client.`);
          }}
        />
      )}
      {vue === "paies" && (
        <OngletPaies
          travaux={travaux}
          utilisateurs={utilisateurs}
          // Droit sur les heures : admins = ajustement DIRECT ; répartiteur
          // = PROPOSITION à valider par un admin ; sinon consultation.
          droitHeures={
            role === "Admin principal" || role === "Admin régulier"
              ? "direct"
              : sousCategorie === "Répartiteur"
              ? "proposer"
              : null
          }
          onAjusterPlan={(ajustements) => {
            // `ajustements` = la ligne éditée + ses voisins réalloués
            // (calculés dans OngletPaies). Un seul geste, tout cohérent.
            // CORRECTION TARDIVE : si la ligne appartient à une semaine de
            // paie déjà passée, on note la date de correction et les heures
            // d'avant — la différence sera REPORTÉE sur la semaine courante
            // (colonne « Report ± »).
            const dimancheCourant = dimancheDeSemaineISO(new Date());
            const enrichir = (a) => {
              const t = a.travail;
              if (!t.date || dimancheDeSemaineISO(t.date) >= dimancheCourant) return a;
              const dejaCetteSemaine = t.corrigeLe && dimancheDeSemaineISO(t.corrigeLe) === dimancheCourant;
              return {
                ...a,
                corrigeLe: new Date().toISOString(),
                heuresAvantCorrection: dejaCetteSemaine && t.heuresAvantCorrection != null ? t.heuresAvantCorrection : Number(t.heures) || 0,
              };
            };
            const resume = ajustements
              .map((a) => `« ${a.travail.titre} » ${(Number(a.travail.heures) || 0).toFixed(2)} h → ${a.heures.toFixed(2)} h`)
              .join(" · ");
            const qui = `${ajustements[0]?.travail.employeNom || ajustements[0]?.travail.employeEmail} · ${ajustements[0]?.travail.date}`;
            const tardive = ajustements.some((a) => a.travail.date && dimancheDeSemaineISO(a.travail.date) < dimancheCourant);
            if (role === "Admin principal" || role === "Admin régulier") {
              const plan = ajustements.map(enrichir);
              setTravaux((prev) =>
                prev.map((t) => {
                  const a = plan.find((x) => x.travail.id === t.id);
                  return a
                    ? {
                        ...t,
                        heures: a.heures,
                        debutReel: a.debutReel !== undefined ? a.debutReel : t.debutReel,
                        finReelle: a.finReelle !== undefined ? a.finReelle : t.finReelle,
                        corrigeLe: a.corrigeLe !== undefined ? a.corrigeLe : t.corrigeLe,
                        heuresAvantCorrection: a.heuresAvantCorrection !== undefined ? a.heuresAvantCorrection : t.heuresAvantCorrection,
                        heuresProposees: null,
                        propositionPar: null,
                        groupeProposition: null,
                      }
                    : t;
                })
              );
              appliquerAjustementsHeures(plan.map((a) => ({ id: a.travail.id, heures: a.heures, debutReel: a.debutReel, finReelle: a.finReelle, corrigeLe: a.corrigeLe, heuresAvantCorrection: a.heuresAvantCorrection })))
                .then(() => ajouterJournal(`✏️ Heures ajustées (${qui}) : ${resume}. Paie, coûts de projets et agenda mis à jour.${tardive ? " Semaine de paie déjà passée → la différence est REPORTÉE sur la semaine courante (colonne Report ±)." : ""}`))
                .catch(() => ajouterJournal(`⚠️ Échec de l'ajustement d'heures (${qui}) — réessaie.`));
            } else {
              const nomEditeur = session?.user?.user_metadata?.nom || session?.user?.email || "répartiteur";
              const groupeLocal = `grp-local-${Date.now()}`;
              setTravaux((prev) =>
                prev.map((t) => {
                  const a = ajustements.find((x) => x.travail.id === t.id);
                  return a
                    ? { ...t, heuresProposees: a.heures, debutPropose: a.debutReel !== undefined ? a.debutReel : null, finPropose: a.finReelle !== undefined ? a.finReelle : null, propositionPar: nomEditeur, groupeProposition: groupeLocal }
                    : t;
                })
              );
              proposerAjustementsHeures(
                ajustements.map((a) => ({ id: a.travail.id, heures: a.heures, debutReel: a.debutReel, finReelle: a.finReelle })),
                nomEditeur
              )
                .then(() => ajouterJournal(`⏳ Modification d'heures PROPOSÉE par ${nomEditeur} (${qui}) : ${resume}. EN ATTENTE de validation par un administrateur.`))
                .catch(() => ajouterJournal(`⚠️ Échec de l'envoi de la proposition d'heures (${qui}) — réessaie.`));
            }
          }}
          onValiderGroupe={(lignes) => {
            // CORRECTION TARDIVE : la date qui compte est celle de la
            // VALIDATION — si la ligne appartient à une semaine de paie
            // passée, la différence part en Report ± sur la semaine courante.
            const dimancheCourant = dimancheDeSemaineISO(new Date());
            const lignesEnrichies = lignes.map((l) => {
              if (!l.date || dimancheDeSemaineISO(l.date) >= dimancheCourant) return l;
              const dejaCetteSemaine = l.corrigeLe && dimancheDeSemaineISO(l.corrigeLe) === dimancheCourant;
              return {
                ...l,
                corrigeLeAEcrire: new Date().toISOString(),
                heuresAvantCorrectionAEcrire: dejaCetteSemaine && l.heuresAvantCorrection != null ? l.heuresAvantCorrection : Number(l.heures) || 0,
              };
            });
            const tardive = lignesEnrichies.some((l) => l.corrigeLeAEcrire !== undefined && l.corrigeLeAEcrire !== null && l.corrigeLeAEcrire);
            const resume = lignes
              .map((l) => `« ${l.titre} » ${(Number(l.heures) || 0).toFixed(2)} h → ${(Number(l.heuresProposees) || 0).toFixed(2)} h`)
              .join(" · ");
            const qui = `${lignes[0]?.employeNom || lignes[0]?.employeEmail} · ${lignes[0]?.date}`;
            setTravaux((prev) =>
              prev.map((t) => {
                const l = lignesEnrichies.find((x) => x.id === t.id);
                return l
                  ? {
                      ...t,
                      heures: Number(l.heuresProposees) || t.heures,
                      debutReel: l.debutPropose || t.debutReel,
                      finReelle: l.finPropose || t.finReelle,
                      corrigeLe: l.corrigeLeAEcrire !== undefined ? l.corrigeLeAEcrire : t.corrigeLe,
                      heuresAvantCorrection: l.heuresAvantCorrectionAEcrire !== undefined ? l.heuresAvantCorrectionAEcrire : t.heuresAvantCorrection,
                      heuresProposees: null,
                      propositionPar: null,
                      debutPropose: null,
                      finPropose: null,
                      groupeProposition: null,
                    }
                  : t;
              })
            );
            validerGroupePropositions(lignesEnrichies)
              .then(() => ajouterJournal(`✅ Proposition VALIDÉE (${qui}) : ${resume} (proposée par ${lignes[0]?.propositionPar || "?"}).${tardive ? " Semaine de paie déjà passée → différence REPORTÉE sur la semaine courante (colonne Report ±)." : ""}`))
              .catch(() => ajouterJournal(`⚠️ Échec de la validation de la proposition (${qui}) — réessaie.`));
          }}
          onRefuserGroupe={(lignes) => {
            const qui = `${lignes[0]?.employeNom || lignes[0]?.employeEmail} · ${lignes[0]?.date}`;
            setTravaux((prev) =>
              prev.map((t) =>
                lignes.some((x) => x.id === t.id)
                  ? { ...t, heuresProposees: null, propositionPar: null, debutPropose: null, finPropose: null, groupeProposition: null }
                  : t
              )
            );
            refuserGroupePropositions(lignes)
              .then(() => ajouterJournal(`❌ Proposition REFUSÉE (${qui}) : les heures originales sont conservées (proposée par ${lignes[0]?.propositionPar || "?"}).`))
              .catch(() => ajouterJournal(`⚠️ Échec du refus de la proposition (${qui}) — réessaie.`));
          }}
          projets={projets}
          onDebloquerJournee={(email, date) => {
            // La journée redevient comptable. Geste tracé au journal :
            // c'est une décision qui remet des heures dans une paie.
            const nom = (utilisateurs || []).find((u) => (u.courriel || "").toLowerCase() === email)?.nom || email;
            setTravaux((prev) =>
              prev.map((t) =>
                (t.employeEmail || "").toLowerCase() === email && t.date === date
                  ? { ...t, jourBloque: false, bloqueRaison: "" }
                  : t
              )
            );
            debloquerJournee(email, date)
              .then(() => ajouterJournal(`🔓 Journée DÉBLOQUÉE : ${nom} · ${date} — les heures comptent de nouveau dans la paie.`))
              .catch(() => ajouterJournal(`⚠️ Échec du déblocage de la journée (${nom} · ${date}) — réessaie.`));
          }}
        />
      )}
      {vue === "tarifs" && (
        <OngletTarifs
          onSauvegarderCoutCamion={sauvegarderCoutCamion}
          metiersMasques={configEntreprise?.metiersMasques || []}
          onMasquerMetier={masquerMetier}
          tauxMetiers={tauxMetiers}
          setTauxMetiers={setTauxMetiers}
          onSauvegarderTaux={() => sauvegarderTaux(tauxMetiers, tauxMetiersRes)}
          tauxMetiersRes={tauxMetiersRes}
          setTauxMetiersRes={setTauxMetiersRes}
          prixDepots={prixDepots}
          setPrixDepots={setPrixDepots}
          onSauvegarderPrixDepots={() => sauvegarderPrixDepots(prixDepots)}
          estAdminPrincipal={role === "Admin principal"}
          ajouterJournal={ajouterJournal}
          catalogue={catalogue}
          onEnregistrerItem={async (item) => {
            const sauve = await sauvegarderItem(item);
            setCatalogue((prev) =>
              [...prev.filter((x) => x.id !== sauve.id), sauve].sort((a, b) => a.nom.localeCompare(b.nom))
            );
            ajouterJournal(`💲 Item de catalogue enregistré : ${sauve.nom}`);
          }}
          onDesactiverItem={async (item) => {
            await desactiverItem(item.id);
            setCatalogue((prev) => prev.filter((x) => x.id !== item.id));
            ajouterJournal(`🚫 Item retiré du catalogue : ${item.nom} (désactivé, jamais supprimé — récupérable dans « Items retirés »)`);
          }}
          onReactiverItem={async (item) => {
            await reactiverItem(item.id);
            setCatalogue((prev) =>
              [...prev.filter((x) => x.id !== item.id), { ...item, actif: true }].sort((a, b) => a.nom.localeCompare(b.nom))
            );
            ajouterJournal(`↩️ Item REMIS au catalogue : ${item.nom} — de nouveau proposé dans les devis.`);
          }}
        />
      )}

      {vue === "pieces" && (
        <OngletPieces
          pieces={pieces}
          clients={clients}
          commandesCamion={commandesCamion}
          onCommandePassee={commandeCamionPassee}
          achatsLibres={achatsLibres}
          transactionsQb={transactionsQb}
          onCreerBcLibre={creerBcLibre}
          onMajBcLibre={majBcLibre}
          onSupprimerBcLibre={supprimerBcLibre}
          onDemenagerBcVersProjet={demenagerBcVersProjet}
          projets={projets}
          // Tâches offertes au rattachement d'un achat : celles de la
          // grille + la file d'attente, dédupliquées, sans les tâches
          // système, les plus récentes d'abord.
          tachesPourAchat={(() => {
            const vues = new Map();
            for (const valeur of Object.values(planning)) {
              for (const t of listeCellule(valeur)) {
                if (t && !t.est_tache_systeme && !vues.has(t.id)) vues.set(t.id, { id: t.id, titre: t.titre || t.clientNom || t.id, clientNom: t.clientNom || "" });
              }
            }
            (tachesAttente || []).forEach((t) => {
              if (!vues.has(t.id)) vues.set(t.id, { id: t.id, titre: t.titre || t.clientNom || t.id, clientNom: t.clientNom || "" });
            });
            return [...vues.values()].sort((a, b) => (a.clientNom || "").localeCompare(b.clientNom || "", "fr"));
          })()}
          depots={depots}
          prixDepots={prixDepots}
          onCreerDepot={creerDepotPourTache}
          fournisseurs={fournisseurs}
          nomUtilisateur={session?.user?.user_metadata?.nom || session?.user?.email}
          /* COMMANDER est réservé aux administrateurs. Répartiteur et
             chargé de projet VOIENT la liste pour répondre au client,
             mais ne commandent pas : deux personnes qui commandent,
             c'est deux commandes. */
          peutCommander={role === "Admin principal" || role === "Admin régulier"}
          onMaj={(id, champs) => {
            const p = pieces.find((x) => x.id === id);
            // Miroir local des colonnes touchées : l'onglet Agenda lit le
            // MÊME `pieces`, donc la carte de la tâche de retour affiche
            // le fournisseur et la date sans attendre le rechargement.
            const prevue = champs.date_reception_prevue;
            setPieces((prev) =>
              prev.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      ...(champs.numero_bc !== undefined ? { numeroBc: champs.numero_bc || "" } : {}),
                      ...(champs.fournisseur_nom !== undefined ? { fournisseurNom: champs.fournisseur_nom || "" } : {}),
                      ...(prevue !== undefined
                        ? {
                            dateReceptionPrevue: prevue || null,
                            enRetard: !!prevue && prevue < dateISO(new Date()),
                          }
                        : {}),
                      ...(champs.statut ? { statut: champs.statut } : {}),
                      ...(champs.paiement_avant_commande !== undefined ? { paiementAvantCommande: !!champs.paiement_avant_commande } : {}),
                      ...(champs.paiement_requis !== undefined ? { paiementRequis: !!champs.paiement_requis } : {}),
                      ...(champs.paiement_recu !== undefined ? { paiementRecu: !!champs.paiement_recu } : {}),
                      ...(champs.montant_piece !== undefined ? { montantPiece: champs.montant_piece } : {}),
                      ...(champs.bc_envoye_le !== undefined ? { bcEnvoyeLe: champs.bc_envoye_le } : {}),
                      ...(champs.demande_paiement_le !== undefined ? { demandePaiementLe: champs.demande_paiement_le } : {}),
                      ...(champs.livraison_fixe !== undefined ? { livraisonFixe: !!champs.livraison_fixe } : {}),
                      ...(champs.reports_date !== undefined ? { reportsDate: champs.reports_date || [] } : {}),
                    }
                  : x
              )
            );
            majPiece(id, champs)
              .then(() => {
                if (champs.statut === "commandee") {
                  ajouterJournal(
                    `📦 Pièce COMMANDÉE : ${p?.pieceRequise} pour ${p?.clientNom}` +
                      `${champs.fournisseur_nom ? ` chez ${champs.fournisseur_nom}` : ""}` +
                      `${champs.numero_bc ? ` (${champs.numero_bc})` : ""}` +
                      `${prevue ? ` — réception prévue le ${prevue}` : " — aucune date confirmée"}`
                  );
                }
                if (champs.paiement_recu === true) {
                  ajouterJournal(
                    `💰 Paiement REÇU pour la pièce ${p?.pieceRequise} (${p?.clientNom})` +
                      `${p?.paiementAvantCommande ? " — la commande est débloquée." : " — la planification est débloquée."}`
                  );
                }
                if (champs.paiement_avant_commande === true) {
                  ajouterJournal(`💰 Pièce ${p?.pieceRequise} (${p?.clientNom}) : paiement du client exigé AVANT la commande.`);
                }
                if (champs.bc_envoye_le) {
                  ajouterJournal(`✉️ BC ${p?.numeroBc || ""} envoyé au fournisseur ${p?.fournisseurNom || ""} — ${p?.pieceRequise}.`);
                }
              })
              .catch(() => ajouterJournal("⚠️ Mise à jour de la pièce non enregistrée — réessaie."));
          }}
          onRecue={(id, parNom, sansCommande = false) => {
            const p = pieces.find((x) => x.id === id);
            setPieces((prev) => prev.map((x) => (x.id === id ? { ...x, statut: "recue", recuParNom: parNom, recuVia: "manuel", recuLe: new Date().toISOString() } : x)));
            marquerRecue(id, parNom, "manuel")
              .then(() =>
                ajouterJournal(
                  `📦 Pièce REÇUE${sansCommande ? " ⚠️ SANS commande préalable (prise au comptoir ?)" : ""} : ${p?.pieceRequise} pour ${p?.clientNom} — la tâche de retour peut être planifiée.`
                )
              )
              .catch(() => ajouterJournal("⚠️ Réception non enregistrée — réessaie."));
          }}
          onAnnuler={(id, raison) => {
            const p = pieces.find((x) => x.id === id);
            setPieces((prev) => prev.map((x) => (x.id === id ? { ...x, statut: "annulee", annuleRaison: raison } : x)));
            annulerPiece(id, raison)
              .then(() => ajouterJournal(`❌ Pièce ANNULÉE : ${p?.pieceRequise} pour ${p?.clientNom} — ${raison}`))
              .catch(() => ajouterJournal("⚠️ Annulation non enregistrée — réessaie."));
          }}
        />
      )}

      {vue === "parametres" && (
        <OngletParametres
          config={configEntreprise}
          estAdminPrincipal={role === "Admin principal"}
          ajouterJournal={ajouterJournal}
          onSauvegarder={async (nouvelle) => {
            await sauvegarderEntreprise(nouvelle);
            setConfigEntreprise(nouvelle);
          }}
        />
      )}

      {vue === "utilisateurs" && (
        <>
          {(role === "Admin principal" || role === "Admin régulier") && (
            <div className="mx-auto max-w-2xl px-4 pt-4 md:px-6">
              <GestionAcces utilisateurs={utilisateurs} estAdminPrincipal={role === "Admin principal"} />
            </div>
          )}
          <OngletUtilisateurs
            utilisateurs={utilisateurs}
            setUtilisateurs={setUtilisateurs}
            ajouterJournal={ajouterJournal}
            tauxMetiers={tauxMetiers}
            estAdminPrincipal={role === "Admin principal"}
            persisterUtilisateur={(u) => {
              sauvegarderEmploye(u).catch(() => {});
              // GESTION DES ACCÈS INTÉGRÉE À LA FICHE : le type d'accès +
              // le métier (sous-catégorie) de la fiche écrivent directement
              // l'entrée de permissions_utilisateurs — créer/modifier la
              // fiche règle les accès du même geste. Les cases ajustées
              // finement dans « Gestion des accès » sont conservées tant
              // que le type/métier ne change pas.
              (async () => {
                try {
                  const courriel = (u.courriel || "").trim().toLowerCase();
                  if (!courriel || !TYPES_ACCES.includes(u.typeAcces)) return;
                  // Un Admin régulier ne peut pas accorder un rôle d'administration.
                  if (role !== "Admin principal" && (u.typeAcces === "Admin principal" || u.typeAcces === "Admin régulier")) {
                    ajouterJournal(`⚠️ Accès NON modifiés pour ${u.nom} — seuls les Admins principaux peuvent accorder un rôle d'administration.`);
                    return;
                  }
                  const sous = u.typeAcces === "Administration bureau" ? u.metier : null;
                  // Les cases cochées DANS LA FICHE font foi ; à défaut,
                  // on conserve les accès existants du compte (si le
                  // type/métier n'a pas changé), sinon les défauts.
                  let sections;
                  if (Array.isArray(u.sectionsAcces)) {
                    sections = u.sectionsAcces;
                  } else {
                    const { data: existante } = await supabase
                      .from("permissions_utilisateurs")
                      .select("role, sous_categorie, sections")
                      .eq("email", courriel)
                      .maybeSingle();
                    const memeConfig = existante && existante.role === u.typeAcces && (existante.sous_categorie || null) === (sous || null);
                    sections =
                      memeConfig && Array.isArray(existante.sections) && existante.sections.length > 0
                        ? existante.sections
                        : permissionsPour(u.typeAcces, sous);
                  }
                  const { error } = await supabase.from("permissions_utilisateurs").upsert({
                    email: courriel,
                    role: u.typeAcces,
                    sous_categorie: sous,
                    sections,
                    updated_at: new Date().toISOString(),
                  });
                  if (error) throw error;
                  ajouterJournal(`🔐 Accès de ${u.nom} réglés depuis sa fiche : ${u.typeAcces}${sous ? ` · ${sous}` : ""} (effet à sa prochaine connexion)`);
                } catch {
                  ajouterJournal(`⚠️ Fiche de ${u.nom} enregistrée, mais la mise à jour de ses ACCÈS a échoué — vérifie la section Gestion des accès.`);
                }
              })();
            }}
            supprimerUtilisateur={(u) => {
              // SUPPRESSION DE LA FICHE + RÉVOCATION IMMÉDIATE DES ACCÈS :
              // la fiche disparaît du répertoire (et de l'agenda), et son
              // entrée d'accès est remplacée par « aucune section » — le
              // compte ne peut plus rien ouvrir dès sa prochaine connexion.
              setUtilisateurs((prev) => prev.filter((x) => x.id !== u.id));
              supprimerEmploye(u.id).catch(() => {});
              const courriel = (u.courriel || "").trim().toLowerCase();
              if (courriel) {
                supabase
                  .from("permissions_utilisateurs")
                  .upsert({ email: courriel, role: "Technicien", sous_categorie: null, sections: [], updated_at: new Date().toISOString() })
                  .then(({ error }) => {
                    if (error) ajouterJournal(`⚠️ Fiche de ${u.nom} supprimée, mais la révocation de ses accès a ÉCHOUÉ — retire-les dans Gestion des accès.`);
                  });
              }
              ajouterJournal(`🗑️ Fiche de ${u.nom} supprimée — tous ses accès sont révoqués (⛔ aucun accès).`);
            }}
          />
        </>
      )}

      <JournalAutomatisation entrees={journal} />

      <div className="py-3 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} {configEntreprise.nomLegal} — Tous droits réservés.
      </div>
      </div>
    </div>
    </ContexteDevis.Provider>
    </ContexteClients.Provider>
    </ContexteCatalogue.Provider>
    </ContexteEntreprise.Provider>
  );
}
