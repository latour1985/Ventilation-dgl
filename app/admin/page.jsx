"use client";

import React, { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import {
  FileText, Calendar, Bell, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft,
  ChevronRight, MapPin, Mail, FileCheck2, Clock, Send, X, Check,
  AlertCircle, Search, Users, UserPlus, RefreshCw, Phone, CreditCard,
  Camera, ClipboardList, UserCog, KeyRound, ShieldCheck, Lock, Loader2, User, Pencil, Briefcase, Car,
  Cloud, CheckCircle2, AlertTriangle, LayoutGrid, List, BarChart3, Menu, LogOut, Banknote, Copy, Settings, Package,
  LifeBuoy,
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
import { assignerTacheSupabase, retirerTacheSupabase, listerToutesAssignations, majFacturableAssignation, majDonneesAssignation, sAbonnerTachesAssignees, traiterPropositionProjetShop } from "@/lib/supabase/tachesAssignees";
import { listerSousTraitants, sauvegarderSousTraitant, listerAssignationsSousTraitants, COURRIEL_ST, estCourrielST } from "@/lib/supabase/sousTraitants";
import { listerEmployes, sauvegarderEmploye, supprimerEmploye } from "@/lib/supabase/repertoireEmployes";
import { listerTravauxEffectues, sAbonnerTravauxEffectues, appliquerAjustementsHeures, proposerAjustementsHeures, validerGroupePropositions, refuserGroupePropositions, joursBloques, cleJour, debloquerJournee, enregistrerTravailPourEmploye, rattacherProjetAuxHeures, heuresRattachablesA } from "@/lib/supabase/travauxEffectues";
import { listerBonsTravail, sAbonnerBonsTravail, majFacturesEmises, demanderRetraitFacturation, validerRetraitFacturation, remettreAFacturer, RAISONS_RETRAIT, enregistrerBonTravailBureau, rattacherAuBon, majMaterielStock } from "@/lib/supabase/bonsTravail";
import { listerFournisseurs, sauvegarderFournisseur } from "@/lib/supabase/fournisseurs";
import { listerCamions, sauvegarderCamion, camionIndisponible, declarerIndispoCamion, leverIndispoCamion } from "@/lib/supabase/camions";
import { numeroDevis, numeroBonCommande } from "@/lib/supabase/compteurs";
import { listerDevis, sauvegarderDevis, activerVersionDevis, sAbonnerDevis, supprimerDevis, reponsesClientATraiter } from "@/lib/supabase/devis";
import { LangueProvider, useLangue } from "@/lib/i18n";
import BoutonLangue from "@/components/BoutonLangue";
import { listerClients, sauvegarderClient, sAbonnerClients } from "@/lib/supabase/clients";
import { listerProjets, sauvegarderProjet, sAbonnerProjets } from "@/lib/supabase/projets";
import { listerTachesAttente, sauvegarderTacheAttente, retirerTacheAttente, sAbonnerTachesAttente } from "@/lib/supabase/taches";
import { listerJournal, ajouterEntreeJournal } from "@/lib/supabase/journal";
import { listerTaux, sauvegarderTaux } from "@/lib/supabase/tauxMetiers";
import { listerDepots, creerDepot, marquerDepotPayeManuellement, annulerDepotDelai, sAbonnerDepots, taxesDepot, majDepotFactureQbo } from "@/lib/supabase/depots";
import { ZONES_DEPOTS, listerPrixDepots, sauvegarderPrixDepots, zonesDepuis, supprimerZoneDepot } from "@/lib/supabase/prixDepots";
import { listerCatalogue, sauvegarderItem, enregistrerItemsEnLot, desactiverItem, listerCatalogueRetires, reactiverItem, margePourcent, profitDollars, vendantPourMarge, sAbonnerCatalogue } from "@/lib/supabase/catalogue";
import { googlePlacesDisponible, nouveauJeton, chercherAdresses, detailsAdresse } from "@/lib/googlePlaces";
import { genererJeton, lienDevisPublic, JOURS_VALIDITE_LIEN_DEVIS } from "@/lib/supabase/devisPublic";
import { listerCommandesCamion, marquerCommandeCamionPassee, sAbonnerCommandesCamion, creerAchatLibre, listerAchatsLibres, majAchatLibre, supprimerAchatLibre, listerMemoireFournisseurs, memoriserFournisseursArticles } from "@/lib/supabase/materiel";
import { televerserPieceJointeTache, listerLegendes, sauvegarderLegende } from "@/lib/supabase/photosTravaux";
import { envoyerPushA } from "@/lib/notificationsPush";
import VisionneusePhotos from "@/components/VisionneusePhotos";
import { envoyerCourriel, gabaritDevis, gabaritBonCommande, gabaritDemandePaiement, gabaritBonTravail, gabaritCommandeGroupee, gabaritBcSimple, conditionsDepotAppel } from "@/lib/courriels";
import { termesHtmlCourriel } from "@/lib/termes";
import { assurerJetonBon, lienBonPublic, marquerBonEnvoyeClient, JOURS_VALIDITE_BON } from "@/lib/supabase/bonPublic";
import { ententePourStatut } from "@/lib/ententeTexte";
import { etatQuickbooks, listerTransactionsQuickbooks, creerFactureDepot, annulerFactureDepot, creerFactureQbo, creerEstimateQbo, synchroniserClientsQbo, envoyerFactureQbo, verifierEnvoisQbo, ouvrirFacturePdfQbo, sonderDepotsPayes, lireEstimateQbo, refleterReponsesDevisQbo } from "@/lib/quickbooksClient";
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
import { OngletUtilisateurs, ModalProfilUtilisateur, GrilleAcces, ApercuCourrielConnexion } from "./OngletUtilisateurs";
import { transportQuotidienPayePour } from "./partage";
import { ContexteClients, useClients, ContexteDevis, useDevis, TERMES_FACTURATION, nomClientNormalise, nomAffichageClient, libelleAdresse, adresseFacturationClient, AutocompleteAdresse, AdressesDocument, BoutonPDF, GalerieAvantApres, projetEnRetard, evaluerSanteProjet, couleurSanteBudget, calculerRentabiliteProjet, ApercuDevisClient, ApercuBonTravailClient } from "./partage";
import { OngletClients, ModalEditionClient, ModalNouveauClient, DetailTravail, DevisDuClient, LigneProjetClient } from "./OngletClients";
import { ContexteCatalogue, useCatalogue, SelecteurItem } from "./partage";
import { STATUTS_PROJET, FILTRES_STATUT_HUB, ONGLETS_PROJET, calculerAvancementCalendrier, CarteProjet, OngletApercuProjet, OngletTempsProjet, OngletFacturationProjet, OngletBonsCommandeProjet, ModalDetailProjet, OngletProjetsHub, ModalNouveauFournisseur } from "./OngletProjets";
import { FREQUENCES_CONTRAT, LARGEUR_LIGNE_DESCRIPTION, hauteurDescription, listeDestinataires, libelleDestinataires, courrielDefautClient, ModalSelectionCourriel } from "./partage";
import { OngletDevis, ApercuBonCommande, ModalReportCatalogue, ModalTraiterDevis } from "./OngletDevis";
import { OngletFacturation, ModalFacturationDevis, ModalReviserPrixNonListe, ApercuFactureClient, FacturesEmisesListe, ModalChoixPaiementFacture, ModalRetraitFacturation } from "./OngletFacturation";
import { TYPES_TACHE, TYPE_INFO, estTypeSansClient, HEURES_QUART, HEURE_PAR_DEFAUT, listeCellule, cleTacheDesHeures, camionsEntretienDu, tachesDuJourPourEmploye } from "./partage";
import { ModalEditionTache } from "./ModalEditionTache";
import { OngletTableauDeBord } from "./OngletTableauDeBord";
import { OngletAide } from "./OngletAide";
import { listerRetoursEntreprise, sAbonnerRetours } from "@/lib/supabase/retours";
import { COULEUR_TYPE_TACHE, COULEUR_TYPE_DEFAUT, estTypeAdministratif, estTypeNonFacturable, estTypeSansHeures, heureLocaleHHMM, joursDuMois, calculerJoursCibles, compresserImageJointe, tacheTransportSysteme, recalculerTransports, tachesDuJourAvecHeure, techniciensPourTache, texteDevisPourDescription, ModalChoixFacturable, ModalProjetDepuisTache, OngletAgenda } from "./OngletAgenda";

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

const CATALOGUE_REPLI = [];

const CLIENTS_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

// 🧹 GRILLE VIDE AU DÉPART (retour du propriétaire, test à blanc
// 2026-09-06 : « partir vide et sélectionner les métiers qu'on veut à
// la place des métiers à retirer ») : une nouvelle entreprise n'a
// AUCUN métier pré-imposé — elle ajoute les siens dans Tarifs
// (suggestions CCQ en un clic + saisie libre). La grille de DGL, elle,
// vit dans la table taux_metiers et se charge par listerTaux.
const TAUX_METIERS_INIT = {};

const UTILISATEURS_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

// Historique des travaux par client — en prod, ceci vient d'une table
// Supabase `travaux` (liée aux bons de travail complétés par les
// techniciens et aux tâches planifiées dans l'agenda).
const TRAVAUX_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

const PROJETS_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

const EMPLOYES = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

const BONS_TRAVAIL_COMPLETES_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

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
  // 🧹 Données de démonstration PURGÉES (2026-09-06 — les fausses
  // factures QBO-INV-501… resurgissaient chez toute entreprise sans
  // vraie connexion QuickBooks). Sans clés : AUCUNE transaction.
  return [];
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

function MenuLateral({ vue, onChoisir, permissions, badges, courriel, role, onDeconnexion, ouvert, onFermer, reduit, onBasculerReduit }) {
  const { t } = useLangue();
  // 🏢 SENTIMENT D'APPARTENANCE (retour du propriétaire, 2026-09-06) :
  // l'en-tête du menu porte le NOM et le LOGO de L'ENTREPRISE connectée
  // — « propulsé par Fluxya » en plus discret dessous. Le client se
  // sent chez lui, la marque produit reste présente.
  const configMenu = useEntreprise();
  const nomEntrepriseMenu = configMenu?.nomCommercial || configMenu?.nomLegal || "";
  const logoEntrepriseMenu = configMenu?.logoDonnees || "";
  const groupes = [
    { titre: "Vue d'ensemble", items: [
      { id: "tableau-de-bord", label: "Tableau de bord", icone: LayoutGrid },
      // « Recherche » retirée du menu (retour de tests 2026-08-10) :
      // doublon exact de la recherche globale de l'en-tête, même moteur.
      // La page existe toujours si un vieux lien y mène.
    ]},
    { titre: "Clients & ventes", items: [
      { id: "clients", label: "Clients", icone: Users },
      { id: "devis", label: "Devis", icone: FileText, badge: badges?.devis },
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
    // 💬 AIDE & SUGGESTIONS — TOUJOURS visible (aucun module ni accès ne
    // le retire) : la ligne de vie vers Fluxya pour tout rôle bureau.
    { titre: "Support", items: [
      { id: "aide", label: "Aide & suggestions", icone: LifeBuoy, badge: badges?.aide },
    ]},
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.id === "aide" || permissions.includes(i.id)) }))
    .filter((g) => g.items.length > 0);

  // Bascule réduit/agrandi : flèche ‹ à droite de « Vue d'ensemble »
  // (menu ouvert) ou flèche › en haut du rail (menu réduit).
  const contenu = (estReduit, avecBascule) => (
    <>
      <div className={`flex items-center border-b border-white/10 py-4 ${estReduit ? "justify-center px-2" : "gap-2.5 px-4"}`}>
        {/* 🏢 L'ENTREPRISE d'abord (son logo + son nom), Fluxya en
            marque produit discrète dessous (retour 2026-09-06). */}
        {estReduit ? (
          logoEntrepriseMenu ? (
            <img src={logoEntrepriseMenu} alt={nomEntrepriseMenu} className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
          ) : (
            <Logo variant="icon" taille={32} className="shrink-0" />
          )
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            {logoEntrepriseMenu ? (
              <img src={logoEntrepriseMenu} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5" />
            ) : (
              <Logo variant="icon" taille={34} className="shrink-0" />
            )}
            <div className="min-w-0">
              {nomEntrepriseMenu ? (
                <>
                  <p className="truncate text-sm font-extrabold leading-tight text-white">{nomEntrepriseMenu}</p>
                  <p className="text-[9px] text-slate-500">propulsé par <span className="font-bold">Fluxya</span></p>
                </>
              ) : (
                <>
                  <Logo variant="compact" sombre />
                  <p className="text-[10px] text-slate-500">{t("Administration")}</p>
                </>
              )}
            </div>
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
                <p className="px-2.5 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{t(g.titre)}</p>
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
                  title={t(o.label)}
                  className={`relative flex w-full items-center rounded-lg py-2 text-left text-[13px] font-semibold ${
                    estReduit ? "justify-center px-0" : "gap-2.5 px-2.5"
                  } ${actif ? "bg-[#FF6A13] font-extrabold text-white" : "text-slate-300 hover:bg-white/5"}`}
                >
                  <Icone size={estReduit ? 17 : 15} className="shrink-0" />
                  {!estReduit && <span className="min-w-0 flex-1 truncate">{t(o.label)}</span>}
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
            <p className="text-[10px] text-slate-500">{t(role)}</p>
          </>
        )}
        <button
          onClick={onDeconnexion}
          title={t("Déconnexion")}
          className={`mt-2 rounded-lg border border-white/20 text-slate-300 hover:bg-white/5 ${
            estReduit ? "p-1.5" : "px-3 py-1 text-[10px] font-bold"
          }`}
        >
          {estReduit ? <LogOut size={14} /> : t("Déconnexion")}
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
const INSPECTIONS_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

const ENTRETIENS_INIT = []; // 🧹 données de démonstration PURGÉES (2026-09-05) — l'application est en vraie vie, tout vient de Supabase

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
function reconstruirePlanning(rows, employesRef, config) {
  // 🚗 Employes SANS transport debut/fin (2026-09-05) : l'agenda ne
  // fabrique pas leurs blocs systeme — regle d'entreprise + derogation
  // par fiche (transportQuotidienPayePour, un seul juge partout).
  const sansTransport = new Set(
    (employesRef || []).filter((e) => !transportQuotidienPayePour(e, config)).map((e) => String(e.id))
  );
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
  return recalculerTransports(planning, sansTransport);
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
function fusionnerPlanningServeur(prev, rows, employesRef, config) {
  const serveur = reconstruirePlanning(rows, employesRef, config);
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
  const sansTransportFusion = new Set(
    (employesRef || []).filter((e) => !transportQuotidienPayePour(e, config)).map((e) => String(e.id))
  );
  return recalculerTransports(fusion, sansTransportFusion);
}

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
// 🌎 Le fournisseur de langue enveloppe TOUTE l app : les hooks du
// composant principal (en-tete, menu) peuvent ainsi le consommer —
// rendu DANS le composant, il serait invisible pour ses propres hooks.
export default function App() {
  return (
    <LangueProvider>
      <AppAdmin />
    </LangueProvider>
  );
}

function AppAdmin() {
  const { t: tEnTete } = useLangue();
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
  // La PREMIÈRE écriture d'ancre REMPLACE l'entrée d'historique au lieu
  // d'en empiler une (polissage de l'audit 2026-08-17, fait 2026-09-02) :
  // avant, arriver sur /admin ajoutait « #tableau-de-bord » PAR-DESSUS
  // /admin — le premier « Reculer » revenait sur /admin nu (re-synchro
  // inutile) et il fallait reculer deux fois pour vraiment sortir.
  const premierHashPoseRef = useRef(false);
  useEffect(() => {
    const cible = `#${onglet}`;
    if (window.location.hash === cible) {
      premierHashPoseRef.current = true;
      return;
    }
    if (premierHashPoseRef.current) {
      window.history.pushState(null, "", cible);
    } else {
      premierHashPoseRef.current = true;
      window.history.replaceState(null, "", cible);
    }
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
  // 🗄️ ACTIFS SEULEMENT pour l'agenda, les paies, les selecteurs — les
  // employes desactives (2026-09-05) vivent dans le tiroir « Anciens
  // employes » d'Utilisateurs ; leurs heures PASSEES restent dans les
  // paies via les lignes de travaux elles-memes.
  // 👥 DÉDOUBLONNAGE PAR COURRIEL (2026-09-06 — « je suis toujours doublé
  // dans l'agenda ») : deux fiches portant le MÊME courriel, c'est la
  // même personne — elle ne doit apparaître qu'une fois dans l'agenda,
  // les paies et les sélecteurs. On garde la plus complète (celle qui
  // porte un métier / un niveau). Les fiches SANS courriel ne se
  // dédoublonnent pas (rien ne prouve que c'est la même personne).
  const utilisateursActifs = useMemo(() => {
    const actifs = utilisateurs.filter((u) => (u.statut || "actif") !== "inactif");
    const parCourriel = new Map();
    const resultat = [];
    actifs.forEach((u) => {
      const cle = (u.courriel || "").trim().toLowerCase();
      if (!cle) {
        resultat.push(u);
        return;
      }
      const dejaVu = parCourriel.get(cle);
      if (!dejaVu) {
        parCourriel.set(cle, u);
        resultat.push(u);
        return;
      }
      // Doublon : on garde la fiche la mieux remplie.
      const score = (f) => (f.metier ? 2 : 0) + (f.niveau ? 1 : 0) + (f.telephone ? 1 : 0);
      if (score(u) > score(dejaVu)) {
        parCourriel.set(cle, u);
        resultat[resultat.indexOf(dejaVu)] = u;
      }
    });
    return resultat;
  }, [utilisateurs]);
  const [tauxMetiers, setTauxMetiers] = useState(TAUX_METIERS_INIT);
  // Inspections & entretiens — VRAIES données Supabase (Phase 2). Le
  // chargement se fait plus bas, une fois la session déclarée.
  const [inspections, setInspections] = useState([]);
  const [entretiens, setEntretiens] = useState([]);
  const [devisListe, setDevisListe] = useState([]);
  // 💬 Reponses de clients qui attendent une action — sert a la pastille
  // du menu ET au bloc du tableau de bord. ⚠️ DECLARE APRES devisListe :
  // un etat reference avant sa declaration plante la page entiere
  // (« Cannot access before initialization » — piege deja paye ici).
  const reponsesClientsATraiter = useMemo(() => reponsesClientATraiter(devisListe), [devisListe]);
  // Cible d'une navigation venant de la RECHERCHE RAPIDE :
  // { clientId, numeroDevis } — ouvre le bon dossier et surligne le devis.
  const [cibleRecherche, setCibleRecherche] = useState(null);
  // ✏️ Devis à réviser demandé depuis le dossier client (onglet Clients) —
  // l'onglet Devis le prend et ouvre sa fenêtre d'édition.
  const [devisAReviser, setDevisAReviser] = useState(null);
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
  const [tachesAttente, setTachesAttente] = useState([]); // 🧹 tâche-semence de démo PURGÉE (2026-09-06)
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
          setPlanning((prev) => fusionnerPlanningServeur(prev, rows, employesRef, configEntreprise));
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
      // 💳 Le choix carte/virement fait DANS LA FENÊTRE (2026-08-30) —
      // absent = la route applique la règle automatique, comme avant.
      ...(typeof infos.paiementCarte === "boolean" ? { paiementCarte: infos.paiementCarte } : {}),
      ...(typeof infos.paiementVirement === "boolean" ? { paiementVirement: infos.paiementVirement } : {}),
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

  // 🚫 RATTRAPAGE DES DÉPÔTS ANNULÉS CÔTÉ QUICKBOOKS (2026-08-30). Le
  // retrait « en direct » du sondage ne suffisait pas : il ne touchait
  // que l'écran, et au rechargement la tâche revenait de la base — et
  // comme son dépôt n'était plus « en attente », elle se classait dans
  // « Prêtes » (vécu : « pourquoi la demande en attente de dépôt a été
  // transférée à prête ? »). Ici, dès que tâches et dépôts sont connus,
  // toute tâche en attente dont le dépôt est annulé côté QuickBooks est
  // retirée POUR DE BON — base comprise — avec sa ligne au journal.
  const depotsAnnulesTraites = useRef(new Set());
  useEffect(() => {
    if (!session) return;
    (tachesAttente || []).forEach((t) => {
      if (depots?.[t.id]?.statut !== "annule_qb") return;
      if (depotsAnnulesTraites.current.has(t.id)) return;
      depotsAnnulesTraites.current.add(t.id);
      retirerTacheAttente(t.id).catch(() => {});
      setTachesAttente((prev) => prev.filter((x) => x.id !== t.id));
      ajouterJournal(`🚫 Tâche « ${t.titre || t.id} » retirée de la file d'attente : sa facture de dépôt a été annulée dans QuickBooks.`);
    });
  }, [tachesAttente, depots, session]);

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

  // 💬 Badge « Aide & suggestions » — signalements des techniciens à
  // trier (l'admin les voit du menu sans ouvrir l'onglet).
  const [retoursATrier, setRetoursATrier] = useState(0);
  useEffect(() => {
    if (!session) return;
    const charger = () =>
      listerRetoursEntreprise()
        .then((liste) => setRetoursATrier(liste.filter((r) => r.statut === "nouveau").length))
        .catch(() => {});
    charger();
    return sAbonnerRetours(charger);
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
        // 🚫 FACTURE DE DÉPÔT ANNULÉE (VOID) DANS QUICKBOOKS (2026-08-29,
        // demande du propriétaire : « si on annule la facture côté
        // QuickBooks, la tâche doit s'annuler sur Fluxya aussi »).
        // Avant, un VOID mettait le solde à zéro et la tâche devenait
        // « prête » comme si le client avait payé — l'inverse du geste.
        (r?.annulees || []).forEach((a) => {
          setDepots((prev) => ({
            ...prev,
            [a.tacheId]: { ...(prev[a.tacheId] || {}), statut: "annule_qb" },
          }));
          // La tâche en attente de dépôt n'est assignée à personne : la
          // retirer de la file suffit (la persistance Supabase supprime
          // la ligne automatiquement — même mécanique que l'annulation
          // manuelle).
          setTachesAttente((prev) => prev.filter((t) => t.id !== a.tacheId));
          ajouterJournal(
            `🚫 Facture de dépôt${a.docNumber ? ` Nº ${a.docNumber}` : ""} ANNULÉE dans QuickBooks — la tâche liée est annulée dans Fluxya aussi (geste fait côté comptabilité).`
          );
        });
        // 🔄 PAIEMENT DE DÉPÔT ANNULÉ dans QuickBooks (la facture, elle,
        // existe toujours) : l'argent n'a jamais été perçu — le dépôt
        // RETOURNE « en attente de paiement » et la tâche quitte
        // « Prêtes » (vécu : paiement de test annulé après coup, la
        // tâche restait planifiable sans dépôt).
        (r?.reouvertes || []).forEach((x) => {
          setDepots((prev) => ({
            ...prev,
            [x.tacheId]: {
              ...(prev[x.tacheId] || {}),
              statut: "en_attente_paiement",
              modePaiement: null,
              payeLe: null,
              payePar: null,
              dateLimite: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
          }));
          ajouterJournal(
            `⚠️ Paiement du dépôt${x.docNumber ? ` (facture Nº ${x.docNumber})` : ""} ANNULÉ dans QuickBooks — la tâche RETOURNE en attente de dépôt (nouveau délai de 24 h). Renvoie la demande ou annule la tâche.`
          );
        });
        // ⚠️ ÉCHEC D'ÉCRITURE remonté par le sondage : la base a refusé
        // la mise à jour d'un dépôt. La vraie raison au journal — plus
        // jamais un blocage silencieux (vécu : contrainte de statuts
        // d'avant le snippet 108).
        (r?.echecs || []).forEach((x) => {
          ajouterJournal(
            `⚠️ Le sondage QuickBooks n'a pas pu mettre à jour le dépôt${x.docNumber ? ` de la facture Nº ${x.docNumber}` : ""} — la base répond : « ${x.erreur} ». Vérifie que le SQL « 108 - statut annule_qb » a été lancé.`
          );
        });
      } catch {
        // silencieux : réseau ou QuickBooks non connecté
      }
      // 1b) 🔁 Les RÉPONSES DE DEVIS redescendent dans QuickBooks
      // (2026-08-30) : acceptation → estimate « Accepted » (nom + date),
      // refus → « Rejected ». La preuve reste dans Fluxya ; QuickBooks
      // n'est que le reflet, tenu à jour sans que personne y pense.
      try {
        const rd = await refleterReponsesDevisQbo();
        if (annule) return;
        (rd?.transmis || []).forEach((x) => {
          ajouterJournal(
            x.reponse === "accepte"
              ? `📋 Estimate QuickBooks du devis ${x.numero} marqué « Accepté »${x.par ? ` (accepté par ${x.par})` : ""} — automatique.`
              : `📋 Estimate QuickBooks du devis ${x.numero} marqué « Rejeté » (refus du client) — automatique.`
          );
        });
        // Avertissements DÉDOUBLONNÉS par session : le sondage repasse
        // toutes les 3 minutes — sans ce garde, un échec persistant
        // remplirait le journal (qui est PERSISTÉ en base).
        const avisReponses = (sondageQbRef.current.avisReponses = sondageQbRef.current.avisReponses || new Set());
        (rd?.echecs || []).forEach((x) => {
          const cle = `echec-${x.numero}`;
          if (avisReponses.has(cle)) return;
          avisReponses.add(cle);
          ajouterJournal(`⚠️ Estimate du devis ${x.numero} : la réponse du client n'a pas pu être transmise à QuickBooks (${x.erreur}) — nouvel essai au prochain passage.`);
        });
        if (rd?.colonneAbsente && !avisReponses.has("colonne")) {
          avisReponses.add("colonne");
          ajouterJournal("⚠️ Reflet des réponses de devis vers QuickBooks INACTIF — passe le SQL « 110 - reponse transmise » dans Supabase.");
        }
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
  // « aide » est TOUJOURS permis (hors modules et accès — la ligne de vie vers Fluxya).
  const vue = onglet === "aide" ? "aide" : permissions.includes(onglet) && onglet !== "technicien" ? onglet : sectionsAdmin[0] || "tableau-de-bord";


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
          // 💬 Reponses de clients a traiter (modification demandee ou
          // devis accepte pas encore converti) — les refus, eux, sont
          // pour information : ils ne font pas clignoter le menu.
          devis: reponsesClientsATraiter.filter((r) => r.genre !== "refuse").length,
          agenda: tachesAttente.length,
          projets: compteRisqueProjets,
          // Propositions d'ajustement d'heures en attente de validation.
          // Propositions en attente + journées bloquées : les deux
          // demandent une action de l'admin, les deux comptent au badge.
          pieces: pieces.filter((p) => p.statut !== "recue" && p.statut !== "annulee").length,
          paies:
            travaux.filter((t) => t.supabase && t.heuresProposees != null).length +
            joursBloques(travaux).size,
          aide: retoursATrier,
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
            📱 <span className="hidden sm:inline">{tEnTete("Mon horaire")}</span>
          </button>
        )}
        <BoutonLangue />
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
                  placeholder={tEnTete("Recherche rapide — client, adresse, devis, produit…")}
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
          reponsesClients={reponsesClientsATraiter}
          nomAdmin={session?.user?.user_metadata?.nom || session?.user?.email}
          ajouterJournal={ajouterJournal}
          projets={projets}
          travaux={travaux}
          achatsLibres={achatsLibres}
          transactionsQb={transactionsQb}
          utilisateurs={utilisateursActifs}
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
          utilisateurs={utilisateursActifs}
          tauxMetiers={tauxMetiers}
          syncQbEnCours={syncQbEnCours}
          onSyncQuickBooksProjets={synchroniserQuickBooksProjets}
          peutSyncQb={peutSynchroniserQb}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          clientCible={cibleRecherche?.clientId}
          devisCible={cibleRecherche?.numeroDevis}
          onNouvelleVersionDevis={(d) => {
            setDevisAReviser(d);
            setOnglet("devis");
          }}
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
          utilisateurs={utilisateursActifs}
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
          devisAReviser={devisAReviser}
          onDevisReviserPris={() => setDevisAReviser(null)}
          projets={projets}
          clients={clients}
          setClients={setClients}
          // Grille CCQ : sert à pré-remplir le taux coûtant prévu d'un
          // projet créé depuis un devis (chiffre réel, pas un 45 $ inventé).
          tauxMetiers={tauxMetiers}
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
            const liste = utilisateursActifs.map((u) => ({
              id: u.id,
              nom: u.nom,
              courriel: u.courriel,
              transportQuotidien: u.transportQuotidien,
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
          // ➕ Facture libre : la liste des projets (rattachement) et le
          // nom de l'admin (traçabilité de l'attribution).
          projets={projets}
          nomAdmin={session?.user?.user_metadata?.nom || session?.user?.email}
          // Synchronisation lancée TOUT DE SUITE après une facture libre
          // rattachée à un projet : sans elle, le montant n'apparaissait
          // qu'au prochain clic manuel et on croyait que rien n'avait
          // marché (demande du propriétaire, 2026-08-28).
          onSynchroniserQb={synchroniserQuickBooksProjets}
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
          utilisateurs={utilisateursActifs}
          ajouterJournal={ajouterJournal}
          nomAdmin={session?.user?.user_metadata?.nom || session?.user?.email}
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
          // 📦 EN LOT — import d'une liste de prix / synchronisation
          // QuickBooks. Un catalogue, c'est 300 items d'un coup : les
          // envoyer un par un (avec une écriture de journal chacun)
          // saturait la base. Un envoi par tranche, UNE ligne au journal.
          onImporterItems={async (items, description) => {
            const sauves = await enregistrerItemsEnLot(items);
            setCatalogue((prev) => {
              const ids = new Set(sauves.map((s) => s.id));
              return [...prev.filter((x) => !ids.has(x.id)), ...sauves].sort((a, b) => a.nom.localeCompare(b.nom));
            });
            const ignores = sauves.ignores || [];
            ajouterJournal(
              `💲 Catalogue : ${sauves.length} item${sauves.length > 1 ? "s" : ""} enregistré${sauves.length > 1 ? "s" : ""}${description ? ` (${description})` : ""}` +
                (ignores.length > 0
                  ? ` — ⚠️ ${ignores.length} refusé${ignores.length > 1 ? "s" : ""} (nom déjà pris) : ${ignores.slice(0, 5).join(", ")}${ignores.length > 5 ? "…" : ""}`
                  : "")
            );
            return sauves;
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
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
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

      {vue === "aide" && (
        <OngletAide
          session={session}
          nomAdmin={session?.user?.user_metadata?.nom || session?.user?.email}
          ajouterJournal={ajouterJournal}
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
              // la fiche disparaît du répertoire (et de l'agenda), son
              // entrée d'accès est remplacée par « aucune section », ET —
              // colmatage 2026-09-06 (audit du propriétaire : « assure-toi
              // qu'ils sont vraiment bien retirés ») — son COMPTE est
              // BANNI côté serveur + sessions coupées, comme à la
              // désactivation. Avant, seule l'app se vidait : la personne
              // pouvait encore SE CONNECTER et, jeton en main, interroger
              // les données de l'entreprise directement.
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
                (async () => {
                  try {
                    const { data } = await supabase.auth.getSession();
                    const r = await fetch("/api/utilisateurs/acces", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` },
                      body: JSON.stringify({ action: "desactiver", courriel }),
                    }).then((x) => x.json());
                    ajouterJournal(
                      r?.fait
                        ? `🗑️ Fiche de ${u.nom} supprimée — accès révoqués ET compte banni${r.sansCompte ? " (aucun compte à bannir)" : r.sessionsCoupees ? " + sessions coupées" : ""} (⛔ aucun accès).`
                        : `⚠️ Fiche de ${u.nom} supprimée, mais le BANNISSEMENT du compte a échoué (${r?.erreur || "réessaie"}) — désactive-le depuis un autre profil ou réessaie.`
                    );
                  } catch {
                    ajouterJournal(`⚠️ Fiche de ${u.nom} supprimée, mais le bannissement du compte n'a pas pu partir — vérifie la connexion.`);
                  }
                })();
              } else {
                ajouterJournal(`🗑️ Fiche de ${u.nom} supprimée — aucun courriel sur la fiche, donc aucun compte à bannir.`);
              }
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
