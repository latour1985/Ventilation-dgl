"use client";

// ============================================================
// 🧪 BANDEAU « VERSION D'ESSAI » (2026-09-06)
// ------------------------------------------------------------
// Deux adresses servent maintenant l'application :
//   • PRODUCTION — fluxya.vercel.app / ventilation-dgl.vercel.app
//     (et fluxya.ca quand le DNS sera branché) : les clients.
//   • ESSAI — fluxya-essai.vercel.app : les nouvelles versions s'y
//     testent AVANT d'être promues en production.
//
// Le danger des deux adresses, c'est de les confondre — tester « la
// nouvelle affaire » sur la prod, ou pire, travailler pour vrai sur
// l'essai. Ce bandeau tranche : TOUTE adresse qui n'est pas une
// adresse de production connue porte le ruban ambré. La liste est
// INVERSÉE exprès (on nomme la production, pas l'essai) : une adresse
// de déploiement unique (ventilation-xxxx.vercel.app) ou un futur
// alias d'essai sont automatiquement marqués « essai » sans retoucher
// ce fichier. localhost est exempté (développement).
//
// pointer-events-none : le ruban n'avale aucun clic.
// ============================================================
import { useEffect, useState } from "react";

const HOTES_PRODUCTION = new Set([
  "fluxya.vercel.app",
  "ventilation-dgl.vercel.app",
  "fluxya.ca",
  "www.fluxya.ca",
  "fluxya.app",
  "www.fluxya.app",
]);

export default function BandeauEssai() {
  const [essai, setEssai] = useState(false);
  useEffect(() => {
    try {
      const hote = window.location.hostname;
      if (hote === "localhost" || hote === "127.0.0.1") return;
      if (!HOTES_PRODUCTION.has(hote)) setEssai(true);
    } catch {
      // hostname illisible — on n'affiche rien plutôt que de crier faux
    }
  }, []);
  if (!essai) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] bg-amber-400 py-0.5 text-center text-[11px] font-extrabold uppercase tracking-widest text-amber-950"
      role="status"
    >
      🧪 Version d&apos;essai — pas la production
    </div>
  );
}
