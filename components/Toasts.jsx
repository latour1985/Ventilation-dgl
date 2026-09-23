"use client";

// components/Toasts.jsx
//
// 🔔 Les bulles de confirmation, en haut à droite (voir lib/toasts.js).
// - succès / info : disparaissent seules après ~4 s ;
// - problème (⚠️) : restent jusqu'au clic — un échec ne doit pas
//   s'effacer tout seul ;
// - au plus 3 visibles : la plus vieille cède sa place ;
// - texte coupé à ~160 caractères : la bulle résume, le journal détaille.

import { useEffect, useState } from "react";
import { sAbonnerToasts } from "@/lib/toasts";

const DUREE_MS = 4200;
const MAX_VISIBLES = 3;

export default function Toasts() {
  const [bulles, setBulles] = useState([]);

  useEffect(() => {
    return sAbonnerToasts((b) => {
      // Une bulle ⚠️ n'est JAMAIS chassée par les suivantes (revue 2026-09-22 :
      // trois confirmations rapides effaçaient l'erreur avant qu'on la lise).
      setBulles((prev) => {
        const tous = [...prev, b];
        const problemes = tous.filter((x) => x.ton === "probleme");
        const autres = tous.filter((x) => x.ton !== "probleme").slice(-Math.max(1, MAX_VISIBLES - problemes.length));
        return tous.filter((x) => problemes.includes(x) || autres.includes(x)).slice(-6);
      });
      if (b.ton !== "probleme") {
        setTimeout(() => setBulles((prev) => prev.filter((x) => x.id !== b.id)), DUREE_MS);
      }
    });
  }, []);

  if (bulles.length === 0) return null;
  const fermer = (id) => setBulles((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[90] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      {bulles.map((b) => {
        const styles =
          b.ton === "probleme"
            ? "border-red-300 bg-red-50 text-red-900"
            : b.ton === "succes"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-slate-300 bg-white text-slate-800";
        const texte = b.texte.length > 160 ? `${b.texte.slice(0, 157)}…` : b.texte;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => fermer(b.id)}
            title={b.ton === "probleme" ? "Cliquer pour fermer" : "Fermer"}
            className={`pointer-events-auto w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold leading-snug shadow-lg ${styles}`}
          >
            {texte}
          </button>
        );
      })}
    </div>
  );
}
