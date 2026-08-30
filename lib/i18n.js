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

  // ---- En-tête ----
  "Mon horaire": "My schedule",
  "Recherche rapide — client, adresse, devis, produit…": "Quick search — client, address, quote, product…",

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

  // ---- Tableau de bord ----
  "Marge moyenne": "Average margin",
  "Projets à risque": "Projects at risk",
  "Heures aujourd'hui": "Hours today",
  "Journal d'activité": "Activity log",
  "Aujourd'hui sur le terrain": "In the field today",

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
