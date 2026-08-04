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

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
