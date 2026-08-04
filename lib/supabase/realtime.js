// lib/supabase/realtime.js
//
// C'est ICI que se résout la limite la plus citée pendant le
// développement : tant que TechnicienPWA.jsx et AdminInterface.jsx
// utilisaient des useState locaux indépendants, une tâche créée côté
// admin n'apparaissait jamais côté technicien (et vice-versa). Avec
// ces abonnements Realtime, les deux apps lisent et écrivent dans les
// MÊMES tables Postgres, et chaque changement se propage en direct
// aux deux, sans rechargement de page.
//
// Chaque fonction retourne l'objet "channel" — appelle
// `supabase.removeChannel(channel)` dans le cleanup de ton useEffect
// pour éviter les abonnements fantômes.

import { supabase } from "./client";

// Utilisé par AdminInterface.jsx (agenda) — se déclenche quand une
// tâche est créée/assignée depuis N'IMPORTE QUELLE source (y compris
// une autre session admin ouverte ailleurs).
export function sAbonnerAuxTachesPlanifiees(onChangement) {
  return supabase
    .channel("taches_planifiees_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "taches_planifiees" }, onChangement)
    .subscribe();
}

// Utilisé par TechnicienPWA.jsx — le technicien voit apparaître une
// nouvelle tâche assignée par l'admin SANS avoir à rafraîchir la page.
export function sAbonnerAMesTaches(employeId, onChangement) {
  return supabase
    .channel(`mes_taches_${employeId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "taches_planifiees", filter: `employe_id=eq.${employeId}` },
      onChangement
    )
    .subscribe();
}

// Utilisé par AdminInterface.jsx (fiche client / Hub Projets) — un
// bon de travail envoyé côté technicien apparaît immédiatement dans
// l'historique du client et dans le calcul de rentabilité du projet.
export function sAbonnerAuxTravaux(onChangement) {
  return supabase
    .channel("travaux_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "travaux" }, onChangement)
    .subscribe();
}

// Utilisé par le Hub Projets — les cartes/jauges se mettent à jour en
// direct si un autre admin modifie le statut ou le budget.
export function sAbonnerAuxProjets(onChangement) {
  return supabase
    .channel("projets_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "projets" }, onChangement)
    .subscribe();
}

// Utilisé pour le panneau "Journal d'automatisation" — les nouvelles
// entrées apparaissent sans re-fetch, peu importe qui les a créées.
export function sAbonnerAuJournal(onNouvelleEntree) {
  return supabase
    .channel("journal_changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "journal_activite" }, onNouvelleEntree)
    .subscribe();
}

/*
EXEMPLE D'UTILISATION dans un composant React (remplace le pattern
`useState(DONNEES_INIT)` par un chargement initial + un abonnement) :

import { useEffect, useState } from "react";
import { listerTachesEnAttente } from "@/lib/supabase/taches";
import { sAbonnerAuxTachesPlanifiees } from "@/lib/supabase/realtime";
import { supabase } from "@/lib/supabase/client";

function OngletAgenda() {
  const [tachesAttente, setTachesAttente] = useState([]);

  useEffect(() => {
    let annule = false;
    listerTachesEnAttente().then((data) => { if (!annule) setTachesAttente(data); });

    const channel = sAbonnerAuxTachesPlanifiees(() => {
      // Re-fetch simple — pour une app de cette taille, plus fiable
      // que de fusionner manuellement le payload Realtime dans l'état.
      listerTachesEnAttente().then((data) => { if (!annule) setTachesAttente(data); });
    });

    return () => {
      annule = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // ... le reste du composant (JSX) ne change pas.
}
*/
