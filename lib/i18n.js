"use client";

// lib/i18n.js
//
// 🌎 VERSION ANGLAISE PROGRESSIVE (2026-08-29 — GO du propriétaire :
// un testeur bilingue préfère l'anglais).
//
// LE PRINCIPE QUI REND ÇA SAIN : le FRANÇAIS EST LA CLÉ du dictionnaire.
//   t("Tableau de bord") → "Dashboard" si la traduction existe,
//   sinon → le texte français TEL QUEL.
// Une phrase pas encore traduite s'affiche donc en français — jamais de
// trou, jamais d'erreur. On traduit écran par écran, la couverture
// grandit à chaque session, et rien ne casse entre-temps.
//
// LIMITES ASSUMÉES (expliquées au propriétaire avant le GO) :
//   • conditions générales / entente = textes JURIDIQUES — jamais
//     traduits à la machine, ils restent en français avec une mention ;
//   • le journal (piste d'audit) reste en français : ce sont des
//     données enregistrées, pas de l'interface ;
//   • chaque nouveauté devra recevoir sa traduction (le repli français
//     couvre l'attente).
//
// Le choix de langue est mémorisé PAR NAVIGATEUR (localStorage) : chaque
// utilisateur garde le sien — l'admin en anglais, un technicien en
// français, dans la même entreprise.

import { createContext, useContext, useEffect, useState, createElement } from "react";

const CLE_STOCKAGE = "fluxya_langue";

// ------------------------------------------------------------
// LE DICTIONNAIRE — français → anglais.
// Trié par écran pour s'y retrouver ; une entrée absente = repli FR.
// ------------------------------------------------------------
export const DICO_EN = {
  // ---- Menu latéral / navigation ----
  "Vue d'ensemble": "Overview",
  "Tableau de bord": "Dashboard",
  "Clients & ventes": "Clients & sales",
  "Clients": "Clients",
  "Devis": "Quotes",
  "Facturation": "Billing",
  "Opérations": "Operations",
  "Agenda": "Schedule",
  "Projets": "Projects",
  "Véhicules": "Vehicles",
  "Pièces en commande": "Parts on order",
  "Administration": "Administration",
  "Heures de la semaine": "Weekly hours",
  "Tarifs": "Rates",
  "Utilisateurs": "Users",
  "Paramètres": "Settings",
  "Support": "Support",
  "Aide & suggestions": "Help & suggestions",
  "Déconnexion": "Log out",
  "Admin principal": "Main admin",
  "Admin régulier": "Admin",
  "Réduire le menu": "Collapse menu",
  "Agrandir le menu": "Expand menu",

  // ---- Agenda — coquille (tranche 2b, 2026-09-03) ----
  "Jour": "Day",
  "Semaine": "Week",
  "Mois": "Month",
  "Tâches en attente": "Pending tasks",
  "Nouvelle tâche": "New task",
  "Prêtes": "Ready",
  "Dépôt": "Deposit",
  "Pièces": "Parts",
  "Glisse une tâche vers une case du calendrier pour l'assigner.": "Drag a task onto a calendar slot to assign it.",
  "Personnel de bureau": "Office staff",
  "Sous-traitants": "Subcontractors",
  "Appel de service": "Service call",
  "Travaux avec devis": "Quoted work",
  "Travaux en temps et matériel": "Time & material work",
  "Entretien selon contrat": "Contract maintenance",
  "Visite de chantier": "Site visit",
  "Visite pour soumission": "Estimate visit",
  "Divers": "Miscellaneous",
  "Course / interne (sans client)": "Errand / internal (no client)",
  "Travail au shop": "Shop work",
  "Congé / absence": "Time off / absence",

  // ---- En-tête ----
  "Mon horaire": "My schedule",
  "Recherche rapide — client, devis, produit, commande…": "Quick search — client, quote, product, order…",

  // ---- Boutons et mots communs ----
  "Enregistrer": "Save",
  "Annuler": "Cancel",
  "Fermer": "Close",
  "Ajouter": "Add",
  "Supprimer": "Delete",
  "Modifier": "Edit",
  "Retour": "Back",
  "Continuer →": "Continue →",
  "Envoyer": "Send",
  "Rechercher": "Search",
  "Oui": "Yes",
  "Non": "No",
  "Terminé": "Done",
  "En cours": "In progress",
  "À planifier": "To schedule",
  "Aujourd'hui": "Today",
  "hier": "yesterday",
  "aujourd'hui": "today",

  // ---- Tableau de bord (tranche 2, 2026-08-30 — écran complet) ----
  "Marge moyenne": "Average margin",
  "Projets à risque": "Projects at risk",
  "Heures aujourd'hui": "Hours today",
  "Journal d'activité": "Activity log",
  "Aujourd'hui sur le terrain": "In the field today",
  "saisies par les techniciens": "entered by technicians",
  "Entretiens camions": "Truck maintenance",
  "aucun entretien dû": "no maintenance due",
  "indisponible": "out of service",
  "dépassement ou en perte": "over budget or losing money",
  "Factures en attente": "Invoices pending",
  "à émettre / réviser": "to issue / review",
  "Tâches à planifier": "Tasks to schedule",
  "non assignées": "unassigned",
  "projets actifs · cliquer pour l'analyse": "active projects · click for analysis",
  "journée terminée": "day complete",
  "tâche à faire": "task left",
  "tâches à faire": "tasks left",
  "visite de soumission sans devis": "quote visit without a quote",
  "visites de soumission sans devis": "quote visits without a quote",
  "Visite du": "Visit on",
  "jour": "day",
  "jours": "days",
  "Ces visites disparaîtront d'ici dès qu'un devis sera créé pour le client.":
    "These visits will disappear from here as soon as a quote is created for the client.",
  "Projets à surveiller": "Projects to watch",
  "Aucun projet à risque — tout est au vert. 🎉": "No project at risk — everything is green. 🎉",
  "Budget": "Budget",
  "Activité récente": "Recent activity",
  "Aucune activité pour le moment.": "No activity yet.",

  // ---- Réponses de tes clients (bloc partagé) ----
  "Réponses de tes clients": "Your clients' responses",
  "Modification demandée": "Change requested",
  "Accepté — à traiter": "Accepted — to process",
  "Refusé": "Declined",
  "attend ta réponse": "awaits your reply",
  "attendent ta réponse": "await your reply",
  "Voir le devis": "View the quote",
  "Nouvelle version": "New version",
  "Traiter le devis →": "Process the quote →",
  "Renvoyer le devis": "Resend the quote",
  "J'ai répondu": "I replied",
  "Pris en note": "Noted",
  "Erreur du client": "Client mistake",
  "▼ Ouvrir": "▼ Open",
  "▲ Replier": "▲ Collapse",
  "il y a {n} jours": "{n} days ago",
  "Aucune réponse en attente. Dès qu'un client accepte, refuse ou demande une modification, ça apparaît ici.":
    "No response waiting. As soon as a client accepts, declines or requests a change, it shows up here.",

  // ---- App technicien — accueil + minutage (tranche 3, 2026-09-04) ----
  "Bonjour,": "Hello,",
  "technicien": "technician",
  "Tes données sont sauvegardées localement et se synchroniseront au retour de la connexion.":
    "Your data is saved locally and will sync when the connection returns.",
  "Chrono encore parti": "Timer still running",
  "Tâche": "Task",
  "tourne depuis": "has been running for",
  "L'as-tu oublié ?": "Did you forget it?",
  "Corriger mon heure de fin": "Fix my end time",
  "Après": "After",
  "h pour un transport": "h for a transport",
  "la tâche se ferme seule et sa durée est plafonnée — le bureau devra corriger tes heures.":
    "the task closes itself and its duration is capped — the office will have to fix your hours.",
  "tâches complétées": "tasks completed",
  "🕐 Mes heures de la semaine": "🕐 My hours this week",
  "🚗 Course / déplacement (sans client)": "🚗 Errand / travel (no client)",
  "🏭 Travail au shop (atelier)": "🏭 Shop work (workshop)",
  "💬 Signaler un problème / proposer une idée": "💬 Report a problem / suggest an idea",
  "Activation…": "Enabling…",
  "🔔 Activer les notifications (nouvelle tâche, matériel…)": "🔔 Enable notifications (new task, material…)",
  "✅ Notifications activées — tu recevras les nouvelles tâches sur ce téléphone.":
    "✅ Notifications enabled — you'll receive new tasks on this phone.",
  "Notifications refusées — réactive-les dans les réglages du navigateur si tu changes d'idée.":
    "Notifications declined — re-enable them in your browser settings if you change your mind.",
  "Temps sur la tâche": "Time on task",
  "EN COURS": "IN PROGRESS",
  "EN PAUSE": "PAUSED",
  "TERMINÉ": "DONE",
  "Termine d'abord «": "First finish «",
  "» avant de commencer celle-ci — une seule tâche à la fois.": "» before starting this one — one task at a time.",
  "Fais d'abord ton inspection du véhicule (« Transport — Début de journée ») pour pouvoir démarrer. Tu peux quand même consulter les détails.":
    "Do your vehicle inspection first (“Transport — Start of day”) before you can start. You can still view the details.",
  "Débuter la tâche": "Start the task",
  "Pause (non compté)": "Pause (not counted)",
  "✍️ Terminer → signer": "✍️ Finish → sign",
  "Terminer": "Finish",
  "Reprendre": "Resume",
  "⏸️ En pause — le chrono est arrêté : ce temps ne sera ni compté sur la tâche ni facturé. Parti chercher du matériel ? Crée une 🚗 course (écran d'accueil) : ce déplacement restera payé sans être facturé au client.":
    "⏸️ Paused — the timer is stopped: this time won't be counted on the task or billed. Out picking up material? Create a 🚗 errand (home screen): that trip stays paid without being billed to the client.",
  "Cette tâche se termine par le bon de travail en bas (signature du client, client absent, ou collègue qui a fait signer) — la fermeture est automatique après l'envoi.":
    "This task is closed through the work order below (client signature, client absent, or a coworker who collected the signature) — it closes automatically after sending.",
  "Lancer le trajet (Google Maps)": "Start the trip (Google Maps)",
  "Quitter le chantier": "Leave the site",
  "Arrivé au chantier": "Arrived at the site",
  "Arrivé à l'entrepôt": "Arrived at the warehouse",

  // ---- App technicien — inspection du véhicule (tranche 4, 2026-09-04) ----
  "Horaire": "Schedule",
  "Inspection du véhicule": "Vehicle inspection",
  "À remplir avant de démarrer ta journée.": "Fill in before starting your day.",
  "Je conduis un camion": "I'm driving a truck",
  "👥 Je suis passager d'un collègue": "👥 I'm riding with a coworker",
  "🚶 Je n'ai pas de véhicule aujourd'hui": "🚶 I have no vehicle today",
  "Qui conduit le camion ?": "Who is driving the truck?",
  "— Choisis le conducteur —": "— Pick the driver —",
  "Pas d'inspection à faire : c'est le conducteur qui inspecte son camion. Ta journée démarre dès que tu confirmes.":
    "No inspection needed: the driver inspects his truck. Your day starts as soon as you confirm.",
  "Confirmer — passager de": "Confirm — riding with",
  "Numéro de camion": "Truck number",
  "— Choisis ton camion —": "— Pick your truck —",
  "Entre ton numéro de camion": "Enter your truck number",
  "Aucun camion au parc — préviens l'administration.": "No truck in the fleet — tell the office.",
  "Liste des camions non chargée — saisie manuelle en dépannage.": "Truck list not loaded — manual entry as a fallback.",
  "Kilométrage actuel": "Current mileage",
  "Vérifications rapides": "Quick checks",
  "Pneus": "Tires",
  "Freins": "Brakes",
  "Niveaux de fluides": "Fluid levels",
  "Bruit moteur": "Engine noise",
  "Lumières": "Lights",
  "Carrosserie / Propreté": "Body / Cleanliness",
  "Problème": "Problem",
  "Anomalie constatée (facultatif)": "Issue noticed (optional)",
  "Ex : feu arrière grillé": "E.g.: burnt-out tail light",
  "Photos de l'anomalie": "Photos of the issue",
  "📷 Une photo aide beaucoup le bureau à juger de l'urgence et à commander la bonne pièce.":
    "📷 A photo really helps the office judge the urgency and order the right part.",
  "Anomalie détectée — l'administration sera notifiée.": "Issue detected — the office will be notified.",
  "Soumettre l'inspection": "Submit the inspection",

  // ---- App technicien — bon de travail + signature (tranche 4) ----
  "Bon de travail": "Work order",
  "Bon de travail envoyé": "Work order sent",
  "Statut :": "Status:",
  "Temps travaillé :": "Time worked:",
  "En attente de révision de prix": "Awaiting price review",
  "Prêt à envoyer": "Ready to send",
  "Ajouter une note ou une photo": "Add a note or a photo",
  "Retour à l'horaire": "Back to schedule",
  "Retour automatique dans quelques secondes…": "Returning automatically in a few seconds…",
  "En ligne": "Online",
  "Hors ligne": "Offline",
  "Adresse des travaux": "Work address",
  "Produits / services": "Products / services",
  "Photos avant": "Before photos",
  "Photos après": "After photos",
  "Nom en lettres moulées": "Name in block letters",
  "(client absent)": "(client absent)",
  "Signature *": "Signature *",
  "2e signature *": "2nd signature *",
  "Effacer": "Clear",
  "La description (notes de terrain) est requise.": "The description (field notes) is required.",
  "Au moins une photo « après travaux » est requise.": "At least one “after work” photo is required.",
  "Tu as coché « travaux non terminés » — écris ce qui reste à faire.":
    "You checked “work not finished” — write what remains to be done.",
  "Le nom en lettres moulées et la signature sont requis.": "The name in block letters and the signature are required.",
  "La 2e signature client est requise pour valider la modification.": "The client's 2nd signature is required to validate the change.",
  "METTRE À JOUR L'ENVOI": "UPDATE THE SUBMISSION",
  "✓ TRAVAUX TERMINÉS": "✓ WORK COMPLETED",
  "TERMINER ET ENVOYER": "FINISH AND SEND",
  "Terminer ma journée — je reviens demain": "End my day — I'm coming back tomorrow",

  // ---- App technicien — Mes heures + course/shop/signaler (tranche 5, 2026-09-04) ----
  "🕐 Mes heures": "🕐 My hours",
  "Impossible de charger tes heures — vérifie ta connexion et réessaie.": "Couldn't load your hours — check your connection and try again.",
  "Chargement de tes heures…": "Loading your hours…",
  "Total de la semaine": "Week total",
  "Chantier": "Job site",
  "Transport": "Travel",
  "Transp. journée": "Daily travel",
  "Dîner": "Lunch",
  "Sam/Dim": "Sat/Sun",
  "h travaillées": "h worked",
  "h de correction reportée": "h of carried-over correction",
  "DÎNER": "LUNCH",
  "TRANSP. JOURNALIER": "DAILY TRAVEL",
  "TRANSPORT": "TRAVEL",
  "CHANTIER": "JOB SITE",
  "Travail": "Work",
  "💬 Signaler / suggérer": "💬 Report / suggest",
  "Ton message va au bureau — il vérifie, règle ou transmet au fabricant du logiciel.":
    "Your message goes to the office — they check, fix, or pass it on to the software maker.",
  "🐛 Quelque chose bugge": "🐛 Something's buggy",
  "💡 J'ai une idée": "💡 I have an idea",
  "Qu'est-ce qui bugge ? Où étais-tu dans l'app ?": "What's buggy? Where were you in the app?",
  "Ton idée pour améliorer l'application…": "Your idea to improve the app…",
  "Envoi…": "Sending…",
  "Envoyer au bureau": "Send to the office",
  "Mes signalements": "My reports",
  "🚗 Nouvelle course": "🚗 New errand",
  "Pour toi, aujourd'hui. Aucun client, rien à facturer — tes heures sont payées et le bureau la voit dans l'agenda.":
    "For you, today. No client, nothing to bill — your hours are paid and the office sees it in the schedule.",
  "Pour toi, aujourd'hui. Aucun client, rien à facturer — tes heures sont payées et le bureau le voit dans l'agenda.":
    "For you, today. No client, nothing to bill — your hours are paid and the office sees it in the schedule.",
  "Quoi ?": "What?",
  "Adresse (facultatif)": "Address (optional)",
  "Note (facultatif)": "Note (optional)",
  "Ex : porter le camion 4 au garage": "E.g.: bring truck 4 to the garage",
  "Ex : 123 rue du Garage, Blainville": "E.g.: 123 Garage Street, Blainville",
  "Détails utiles…": "Useful details…",
  "Création…": "Creating…",
  "Créer la course": "Create the errand",
  "✅ Course créée — elle apparaît dans ton horaire.": "✅ Errand created — it shows up in your schedule.",
  "🏭 Travail au shop": "🏭 Shop work",
  "Ex : fabrication de conduits, ménage du camion": "E.g.: duct fabrication, truck cleanup",
  "C'est pour un projet ? (facultatif)": "Is it for a project? (optional)",
  "Non — travail général au shop": "No — general shop work",
  "Créer la tâche": "Create the task",
  "✅ Tâche créée — elle apparaît dans ton horaire, pèse Débuter en arrivant.":
    "✅ Task created — it shows up in your schedule, hit Start when you arrive.",

  // ---- Connexion ----
  "Courriel": "Email",
  "Mot de passe": "Password",
  "Se connecter": "Log in",
  "Connexion en cours…": "Logging in…",
  "Mot de passe oublié ?": "Forgot password?",
};

// ------------------------------------------------------------
// LE CONTEXTE
// ------------------------------------------------------------
const ContexteLangue = createContext({
  langue: "fr",
  setLangue: () => {},
  t: (texte) => texte,
});

export function LangueProvider({ children }) {
  const [langue, setLangueEtat] = useState("fr");
  // Lecture APRÈS le premier rendu (localStorage n'existe pas au
  // prérendu serveur) — l'écran part en français puis bascule, ce qui
  // est invisible en pratique.
  useEffect(() => {
    try {
      if (localStorage.getItem(CLE_STOCKAGE) === "en") setLangueEtat("en");
    } catch {
      // stockage indisponible — on reste en français
    }
  }, []);
  const setLangue = (l) => {
    const propre = l === "en" ? "en" : "fr";
    setLangueEtat(propre);
    try {
      localStorage.setItem(CLE_STOCKAGE, propre);
    } catch {
      // pas grave : le choix vaudra pour la session en cours
    }
  };
  const t = (texte) => (langue === "en" ? DICO_EN[texte] ?? texte : texte);
  return createElement(ContexteLangue.Provider, { value: { langue, setLangue, t } }, children);
}

// Le crochet à utiliser partout : `const { t } = useLangue();`
export function useLangue() {
  return useContext(ContexteLangue);
}
