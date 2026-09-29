"use client";

// components/DeconnexionInactivite.jsx
//
// 🔐 DÉCONNEXION APRÈS INACTIVITÉ — BUREAU SEULEMENT (2026-09-29, demande
// du propriétaire : « j'avais laissé ma session ouverte hier, ce matin elle
// l'était encore »). Aucun clic, touche, défilement ni toucher pendant le
// délai des Paramètres (30 min par défaut) → déconnexion. 2 minutes avant,
// une fenêtre « Es-tu toujours là ? » avec « Je suis là ».
//
// L'activité est PARTAGÉE entre les onglets Fluxya du navigateur
// (localStorage) : travailler dans l'onglet Devis garde l'onglet Agenda
// ouvert. La déconnexion d'un onglet ferme les autres (Supabase).
// L'app TECHNICIEN n'utilise jamais ce composant : ses chronos roulent
// pendant que le téléphone dort.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const CLE = "fluxya-derniere-activite";
const AVERTIR_AVANT_MS = 2 * 60 * 1000;

const lireActivitePartagee = () => {
  try {
    return Number(window.localStorage.getItem(CLE)) || 0;
  } catch {
    return 0;
  }
};

export default function DeconnexionInactivite({ delaiMin = 30 }) {
  const delaiMs = Math.max(0, Number(delaiMin) || 0) * 60 * 1000;
  const derniereRef = useRef(Date.now());
  const [resteMs, setResteMs] = useState(null); // null = pas d'avertissement

  useEffect(() => {
    if (!delaiMs) return;
    let dernierEcrit = 0;
    const noterActivite = () => {
      const maintenant = Date.now();
      derniereRef.current = maintenant;
      // Écrit au plus toutes les 15 s — la souris bouge sans arrêt.
      if (maintenant - dernierEcrit > 15000) {
        dernierEcrit = maintenant;
        try {
          window.localStorage.setItem(CLE, String(maintenant));
        } catch {}
      }
    };
    noterActivite();
    const evenements = ["mousedown", "mousemove", "keydown", "wheel", "touchstart", "scroll"];
    evenements.forEach((ev) => window.addEventListener(ev, noterActivite, { passive: true, capture: true }));
    const verifier = () => {
      const derniere = Math.max(derniereRef.current, lireActivitePartagee());
      const reste = delaiMs - (Date.now() - derniere);
      if (reste <= 0) {
        setResteMs(null);
        supabase.auth.signOut().finally(() => window.location.reload());
        return;
      }
      setResteMs(reste <= AVERTIR_AVANT_MS ? reste : null);
    };
    const minuterie = setInterval(verifier, 5000);
    // Ordinateur sorti de veille : on vérifie tout de suite au retour.
    const auRetour = () => {
      if (document.visibilityState === "visible") verifier();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      evenements.forEach((ev) => window.removeEventListener(ev, noterActivite, { capture: true }));
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [delaiMs]);

  if (resteMs == null) return null;
  const secondes = Math.max(0, Math.ceil(resteMs / 1000));
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center">
        <p className="text-3xl">⏳</p>
        <h3 className="mt-1 text-base font-extrabold text-slate-900">Es-tu toujours là ?</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          Aucune activité depuis un moment. Pour protéger les données, Fluxya se déconnecte dans{" "}
          <strong className="tabular-nums">
            {Math.floor(secondes / 60)}:{String(secondes % 60).padStart(2, "0")}
          </strong>
          .
        </p>
        <button
          onClick={() => {
            derniereRef.current = Date.now();
            try {
              window.localStorage.setItem(CLE, String(Date.now()));
            } catch {}
            setResteMs(null);
          }}
          className="mt-4 w-full rounded-xl bg-[#131B2E] py-2.5 text-sm font-bold text-white"
        >
          Je suis là
        </button>
      </div>
    </div>
  );
}
