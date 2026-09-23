"use client";

// components/RaccourcisClavier.jsx
//
// ⌨️ ÉCHAP FERME, CTRL+ENTRÉE VALIDE (2026-09-14, demande du
// propriétaire). L'application a une cinquantaine de fenêtres (fiches,
// confirmations, choix de courriels…) et presque aucune n'écoutait le
// clavier. Plutôt que 50 correctifs, UN écouteur global qui vise la
// fenêtre la plus haute (le dernier voile « fixed inset-0 » du DOM) :
//   - Échap → son bouton « Fermer » (aria-label) s'il existe, sinon un
//     clic sur le voile (la plupart des fenêtres se ferment au clic
//     dehors). Les fenêtres qui demandent « quitter sans enregistrer ? »
//     gardent leur question : on ne fait que « cliquer » à leur place.
//   - Ctrl+Entrée (ou Cmd+Entrée) → le premier bouton d'action de la
//     fenêtre dont le texte commence par Enregistrer / Créer / Continuer /
//     Confirmer / Facturer / Valider / Envoyer / Convertir, s'il n'est pas
//     désactivé.
// Rien ne se passe sans fenêtre ouverte : la recherche rapide et les
// champs gardent leur propre comportement.

import { useEffect } from "react";

// Revue 2026-09-22 : (1) un emoji en tête (« 🔔 Envoyer la relance »)
// empêchait de reconnaître le bouton ; (2) « Marquer … » est RETIRÉ — dans
// la fenêtre du dossier, Ctrl+Entrée cliquait « Marquer accepté » au lieu
// d'envoyer la relance. Un changement d'état ne part plus au clavier.
const DEBUT_VALIDATION = /^[^\p{L}]*(enregistrer|créer|creer|continuer|confirmer|facturer|valider|envoyer|convertir|ouvrir la facture|appliquer)/iu;

function voileLePlusHaut() {
  const voiles = Array.from(document.querySelectorAll("div.fixed.inset-0")).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
    const z = parseInt(getComputedStyle(el).zIndex || "0", 10);
    return z >= 40 && el.getBoundingClientRect().height > 0;
  });
  return voiles[voiles.length - 1] || null;
}

function estVisible(el) {
  return !!el && el.getBoundingClientRect().height > 0 && !el.disabled;
}

export default function RaccourcisClavier() {
  useEffect(() => {
    const surTouche = (e) => {
      const voile = voileLePlusHaut();
      if (!voile) return;
      if (e.key === "Escape") {
        // Un menu déroulant natif ou un champ « datalist » ouvert gère
        // déjà Échap : on ne double pas.
        const actif = document.activeElement;
        if (actif && actif.tagName === "SELECT") return;
        // Dans un champ rempli : Échap SORT du champ (ferme une liste de
        // suggestions) sans fermer la fenêtre ni perdre la saisie — un 2e
        // Échap ferme (revue 2026-09-22).
        if (actif && (actif.tagName === "INPUT" || actif.tagName === "TEXTAREA") && String(actif.value || "").trim() && voile.contains(actif)) {
          e.preventDefault();
          actif.blur();
          return;
        }
        const fermer = voile.querySelector('button[aria-label="Fermer"]');
        e.preventDefault();
        if (fermer) {
          fermer.click();
        } else {
          // Clic « dehors » : les fenêtres l'écoutent en mousedown ET/OU click.
          voile.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          voile.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
        return;
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        const boutons = Array.from(voile.querySelectorAll("button")).filter(
          (b) => estVisible(b) && !b.dataset.pasRaccourci && DEBUT_VALIDATION.test((b.textContent || "").trim())
        );
        // Le DERNIER bouton d'action est en général celui du bas de la
        // fenêtre (le vrai « Enregistrer »), les autres sont des sous-étapes.
        const cible = boutons[boutons.length - 1];
        if (cible) {
          e.preventDefault();
          cible.click();
        }
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);
  return null;
}
