"use client";

// components/SansZoomAutoIos.jsx
//
// 🔍 PLUS DE ZOOM AUTOMATIQUE SUR IPHONE (2026-10-02, demande du
// propriétaire). Safari iOS zoome tout seul quand on touche un champ écrit
// à moins de 16 px — presque tous les champs des fiches. On ajoute
// « maximum-scale=1 » à la balise viewport, SEULEMENT sur iPhone / iPad :
//   - iOS cesse le zoom automatique, mais le pincement à deux doigts reste
//     permis (Safari l'impose pour l'accessibilité depuis iOS 10) ;
//   - Android n'a pas ce zoom automatique, et la même consigne y bloquerait
//     le pincement : on n'y touche donc pas.
// Rien ne s'affiche ; la balise est remise comme avant si on quitte l'écran.

import { useEffect } from "react";

export default function SansZoomAutoIos() {
  useEffect(() => {
    const ua = navigator.userAgent || "";
    // L'iPad récent se présente comme un Mac : on le reconnaît au tactile.
    const estIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!estIos) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const avant = meta.getAttribute("content") || "";
    if (/maximum-scale/i.test(avant)) return;
    meta.setAttribute("content", `${avant}${avant ? ", " : ""}maximum-scale=1`);
    return () => meta.setAttribute("content", avant);
  }, []);
  return null;
}
