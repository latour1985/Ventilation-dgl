// lib/sageServeur.js
//
// OUTILS SERVEUR POUR SAGE BUSINESS CLOUD (Sage Accounting) — utilisés
// UNIQUEMENT par les routes /api/sage/*. Jamais importé côté
// navigateur : les jetons OAuth vivent côté serveur, comme QuickBooks.
//
// 🏗️ CHANTIER SAGE (2026-09-07, GO du propriétaire « on y va avec sage
// cloud ») — le MÊME moule que lib/quickbooksServeur.js, pièce par
// pièce : une connexion PAR ENTREPRISE (table sage_connexion, RLS sans
// politique = clé service seulement), échange OAuth2, jeton toujours
// valide à la demande. Le sélecteur « Système comptable » des
// Paramètres décide quelle comptabilité chaque entreprise utilise —
// QuickBooks continue de fonctionner exactement comme avant.
//
// ⚠️ PARTICULARITÉS SAGE (différences avec Intuit, à ne pas oublier) :
//   - jeton d'accès valide 5 MINUTES seulement (Intuit : 1 h) — le
//     rafraîchissement est la NORME, pas l'exception ;
//   - refresh token valide 31 jours (Intuit : ~100) et TOURNANT à
//     chaque usage — toujours re-sauvegarder le nouveau ;
//   - identifiants client passés DANS LE CORPS de l'échange (Intuit :
//     en-tête Basic) ;
//   - l'entreprise s'appelle un « business » (en-tête X-Business quand
//     le compte Sage en porte plusieurs) ;
//   - limites : 100 requêtes/minute, 2 500/jour par business.

import { createClient } from "@supabase/supabase-js";

export function configSagePresente() {
  return !!(process.env.SAGE_CLIENT_ID && process.env.SAGE_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// L'adresse de retour après l'écran d'autorisation Sage. Doit être
// déclarée À L'IDENTIQUE dans le portail développeur Sage
// (developer.sage.com → ton app → Redirect URIs), sinon Sage refuse.
export function urlRedirectionSage(request) {
  if (process.env.SAGE_REDIRECT_URI) return process.env.SAGE_REDIRECT_URI;
  const origine = new URL(request.url).origin;
  return `${origine}/api/sage/callback`;
}

function clientSupabaseServiceSage() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// La connexion Sage de CETTE entreprise — et d'aucune autre.
export async function lireConnexionSage(entrepriseId) {
  if (!entrepriseId) return null;
  const admin = clientSupabaseServiceSage();
  const { data } = await admin
    .from("sage_connexion")
    .select("*")
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  return data || null;
}

export async function sauverConnexionSage({ entrepriseId, accessToken, refreshToken, expiresIn, refreshExpiresIn, businessId, businessNom, pays, connectePar }) {
  if (!entrepriseId) throw new Error("Entreprise requise pour sauver une connexion Sage.");
  const admin = clientSupabaseServiceSage();
  const maintenant = Date.now();
  const { error } = await admin.from("sage_connexion").upsert(
    {
      entreprise_id: entrepriseId,
      access_token: accessToken,
      refresh_token: refreshToken,
      // Marge de 60 s sur un jeton de 5 min : rafraîchir un peu trop
      // tôt vaut toujours mieux qu'une requête refusée.
      access_expire_a: new Date(maintenant + (Number(expiresIn) - 60) * 1000).toISOString(),
      refresh_expire_a: new Date(maintenant + Number(refreshExpiresIn || 31 * 24 * 3600) * 1000).toISOString(),
      ...(businessId !== undefined ? { business_id: businessId } : {}),
      ...(businessNom !== undefined ? { business_nom: businessNom } : {}),
      ...(pays !== undefined ? { pays } : {}),
      ...(connectePar ? { connecte_par: connectePar } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entreprise_id" }
  );
  if (error) throw error;
}

// Échange auprès de Sage : code d'autorisation (1re connexion) ou
// refresh token (renouvellement). Sage veut client_id/client_secret
// DANS LE CORPS — pas en en-tête Basic comme Intuit.
export async function echangerJetonsSage(params) {
  const reponse = await fetch("https://oauth.accounting.sage.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env.SAGE_CLIENT_ID,
      client_secret: process.env.SAGE_CLIENT_SECRET,
      ...params,
    }).toString(),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error(resultat?.error_description || resultat?.error || `Sage a refusé (code ${reponse.status}).`);
  }
  return resultat;
}

// Retourne un jeton d'accès VALIDE : celui en base s'il n'est pas
// expiré (rare — 5 minutes de vie), sinon rafraîchi et re-sauvegardé
// (le refresh token TOURNE à chaque usage chez Sage aussi).
export async function jetonAccesValideSage(entrepriseId) {
  const connexion = await lireConnexionSage(entrepriseId);
  if (!connexion) return null;
  if (new Date(connexion.access_expire_a).getTime() > Date.now()) {
    return { accessToken: connexion.access_token, businessId: connexion.business_id || null };
  }
  if (new Date(connexion.refresh_expire_a).getTime() <= Date.now()) {
    return null; // Refresh expiré (31 jours sans usage) — reconnexion requise.
  }
  const jetons = await echangerJetonsSage({
    grant_type: "refresh_token",
    refresh_token: connexion.refresh_token,
  });
  await sauverConnexionSage({
    entrepriseId,
    accessToken: jetons.access_token,
    refreshToken: jetons.refresh_token,
    expiresIn: jetons.expires_in,
    refreshExpiresIn: jetons.refresh_token_expires_in,
  });
  return { accessToken: jetons.access_token, businessId: connexion.business_id || null };
}

// Requête à l'API Sage Accounting (v3.1). `chemin` sans le préfixe —
// ex. "businesses", "sales_invoices?...". L'en-tête X-Business cible le
// bon dossier quand le compte Sage en porte plusieurs.
export async function requeteSage(acces, chemin, options = {}) {
  const reponse = await fetch(`https://api.accounting.sage.com/v3.1/${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${acces.accessToken}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(acces.businessId ? { "X-Business": acces.businessId } : {}),
      ...(options.headers || {}),
    },
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const detail =
      resultat?.[0]?.$message || resultat?.$message || resultat?.message || `Sage a refusé (code ${reponse.status}).`;
    throw new Error(detail);
  }
  return resultat;
}
