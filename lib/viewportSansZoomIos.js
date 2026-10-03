// lib/viewportSansZoomIos.js
//
// 🔍 ZOOM iPHONE — RÉGLAGE ÉCRIT PAR LE SERVEUR (2026-10-02, vécu du
// propriétaire : page « zoomée » à la connexion, puis en passant de l'app
// technicien au bureau). Le correctif côté navigateur (SansZoomAutoIos)
// arrive APRÈS le chargement : sur l'iPhone, ce n'était pas assez fiable.
// Ici, la balise viewport porte « maximum-scale=1 » dès le HTML envoyé à
// un iPhone/iPod/iPad — avant tout JavaScript. Le pincement à deux doigts
// reste permis (Safari l'impose depuis iOS 10). Android et l'ordinateur
// reçoivent la balise d'origine, inchangée.
//
// Mêmes valeurs que app/layout.js (le segment remplace celles de la racine).
import { headers } from "next/headers";

export async function viewportSansZoomIos() {
  const ua = (await headers()).get("user-agent") || "";
  const estIos = /iPhone|iPad|iPod/i.test(ua);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#134e4a",
    ...(estIos ? { maximumScale: 1 } : {}),
  };
}
