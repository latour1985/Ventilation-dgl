// lib/supabase/client.js
//
// Client Supabase unique pour le navigateur (technicien PWA + admin).
// Utilise les variables d'environnement publiques Next.js — jamais la
// clé de service (service_role) côté client, seulement l'anon key
// (protégée par les policies RLS définies dans schema.sql).
//
// .env.local requis :
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Erreur explicite plutôt qu'un crash silencieux plus loin dans
  // l'app — plus facile à diagnostiquer en déploiement.
  throw new Error(
    "Variables d'environnement Supabase manquantes : vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local"
  );
}

// ------------------------------------------------------------
// OÙ VIT LA SESSION (décision du propriétaire, 2026-08-17) :
// ------------------------------------------------------------
// • BUREAU (/admin, /plateforme) : la session meurt avec la FENÊTRE
//   (sessionStorage). Fermer l'onglet = reconnexion exigée — données
//   sensibles (prix, paies), ordinateurs parfois partagés. Chaque
//   nouvel onglet demande aussi sa connexion : c'est voulu.
// • TECHNICIEN (et le reste) : la session SURVIT (localStorage). Le
//   technicien ouvre/ferme l'application 20 fois par jour avec des
//   gants — son téléphone a déjà son propre verrou.
// Les pages publiques (devis, bon) n'ont pas de session : sans effet.
const estBureau = () =>
  typeof window !== "undefined" &&
  (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/plateforme"));

const stockageSelonPage = {
  getItem: (cle) => {
    if (typeof window === "undefined") return null;
    return estBureau() ? window.sessionStorage.getItem(cle) : window.localStorage.getItem(cle);
  },
  setItem: (cle, valeur) => {
    if (typeof window === "undefined") return;
    if (estBureau()) window.sessionStorage.setItem(cle, valeur);
    else window.localStorage.setItem(cle, valeur);
  },
  removeItem: (cle) => {
    if (typeof window === "undefined") return;
    if (estBureau()) window.sessionStorage.removeItem(cle);
    else window.localStorage.removeItem(cle);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: stockageSelonPage,
  },
});
