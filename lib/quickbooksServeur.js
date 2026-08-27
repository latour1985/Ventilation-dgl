// lib/quickbooksServeur.js
//
// OUTILS SERVEUR POUR QUICKBOOKS — utilisés UNIQUEMENT par les routes
// /api/quickbooks/*. Jamais importé côté navigateur : les jetons OAuth
// et la clé service Supabase ne doivent jamais quitter le serveur.
//
// ------------------------------------------------------------
// POURQUOI LA CLÉ SERVICE
// ------------------------------------------------------------
// La table quickbooks_connexion a la RLS activée SANS politique :
// invisible pour tous les utilisateurs de l'application, y compris les
// admins connectés. Seule la clé service (SUPABASE_SERVICE_ROLE_KEY,
// posée dans Vercel et .env.local — JAMAIS dans git) passe outre la
// RLS. C'est le même principe que la clé Resend : le navigateur ne la
// voit jamais.
//
// ------------------------------------------------------------
// MODE SIMULÉ
// ------------------------------------------------------------
// Tant que les variables QB_CLIENT_ID / QB_CLIENT_SECRET /
// SUPABASE_SERVICE_ROLE_KEY ne sont pas posées, les routes répondent
// { simule: true } : l'interface continue de fonctionner avec ses
// données de démonstration, sans erreur.

import { createClient } from "@supabase/supabase-js";

// Environnement : 'sandbox' (entreprise de test Intuit) tant que tout
// n'est pas validé — règle gelée du projet. La bascule production se
// fera en changeant UNE variable dans Vercel.
export function environnementQb() {
  return process.env.QB_ENVIRONNEMENT === "production" ? "production" : "sandbox";
}

export function configQuickbooksPresente() {
  return !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function urlBaseApiQb() {
  return environnementQb() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// L'adresse de retour après l'écran d'autorisation Intuit. Doit être
// déclarée À L'IDENTIQUE dans le portail développeur Intuit (Keys and
// credentials → Redirect URIs), sinon Intuit refuse.
export function urlRedirectionQb(request) {
  if (process.env.QB_REDIRECT_URI) return process.env.QB_REDIRECT_URI;
  const origine = new URL(request.url).origin;
  return `${origine}/api/quickbooks/callback`;
}

// Client Supabase ADMINISTRATEUR (clé service) — passe outre la RLS.
// Créé à la demande, jamais exporté vers le navigateur.
// 🏢 L'ENTREPRISE d'un compte (grand soir RLS, 2026-09-04) — lue de
// app_metadata (scellée serveur). Repli « dgl » : tous les comptes
// existants sont DGL, et un jeton émis avant l'étiquetage (< 1 h) ne
// porte pas encore la revendication.
export function entrepriseDuCompte(utilisateur) {
  return utilisateur?.app_metadata?.entreprise_id || "dgl";
}

export function clientSupabaseService() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Même verrou anti-relais que /api/courriel : chaque appel doit porter
// le jeton de session Supabase d'un utilisateur CONNECTÉ.
export async function utilisateurDepuisJeton(jeton) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !cleAnon || !jeton) return null;
  try {
    const reponse = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: cleAnon, Authorization: `Bearer ${jeton}` },
      cache: "no-store",
    });
    if (!reponse.ok) return null;
    const u = await reponse.json();
    return u?.email ? u : null;
  } catch {
    return null;
  }
}

export async function lireConnexionQb() {
  const admin = clientSupabaseService();
  const { data } = await admin
    .from("quickbooks_connexion")
    .select("*")
    .eq("environnement", environnementQb())
    .maybeSingle();
  return data || null;
}

export async function sauverConnexionQb({ realmId, accessToken, refreshToken, expiresIn, refreshExpiresIn, connectePar }) {
  const admin = clientSupabaseService();
  const maintenant = Date.now();
  const { error } = await admin.from("quickbooks_connexion").upsert(
    {
      environnement: environnementQb(),
      realm_id: realmId,
      access_token: accessToken,
      refresh_token: refreshToken,
      // Marge de 2 minutes : mieux vaut rafraîchir un peu trop tôt que
      // d'envoyer une requête avec un jeton expiré.
      access_expire_a: new Date(maintenant + (expiresIn - 120) * 1000).toISOString(),
      refresh_expire_a: new Date(maintenant + refreshExpiresIn * 1000).toISOString(),
      ...(connectePar ? { connecte_par: connectePar } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "environnement" }
  );
  if (error) throw error;
}

// Échange auprès d'Intuit : soit un code d'autorisation (1re connexion),
// soit un refresh token (renouvellement). Retourne le JSON d'Intuit.
export async function echangerJetonsIntuit(params) {
  const identifiants = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString("base64");
  const reponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${identifiants}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error(resultat?.error_description || resultat?.error || `Intuit a refusé (code ${reponse.status}).`);
  }
  return resultat;
}

// Retourne un jeton d'accès VALIDE : celui en base s'il n'est pas
// expiré, sinon rafraîchi via le refresh token (et re-sauvegardé —
// Intuit fait tourner les refresh tokens à chaque usage).
export async function jetonAccesValide() {
  const connexion = await lireConnexionQb();
  if (!connexion) return null;
  if (new Date(connexion.access_expire_a).getTime() > Date.now()) {
    return { accessToken: connexion.access_token, realmId: connexion.realm_id };
  }
  if (new Date(connexion.refresh_expire_a).getTime() <= Date.now()) {
    return null; // Refresh expiré (~100 jours sans usage) — reconnexion requise.
  }
  const jetons = await echangerJetonsIntuit({
    grant_type: "refresh_token",
    refresh_token: connexion.refresh_token,
  });
  await sauverConnexionQb({
    realmId: connexion.realm_id,
    accessToken: jetons.access_token,
    refreshToken: jetons.refresh_token,
    expiresIn: jetons.expires_in,
    refreshExpiresIn: jetons.x_refresh_token_expires_in,
  });
  return { accessToken: jetons.access_token, realmId: connexion.realm_id };
}

// Requête « query » à l'API QuickBooks (langage proche du SQL, lecture
// seule). Retourne le QueryResponse brut.
export async function requeteQbo(acces, requete) {
  const url = `${urlBaseApiQb()}/v3/company/${acces.realmId}/query?query=${encodeURIComponent(requete)}&minorversion=75`;
  const reponse = await fetch(url, {
    headers: { Authorization: `Bearer ${acces.accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const detail = resultat?.Fault?.Error?.[0]?.Message || `QuickBooks a refusé (code ${reponse.status}).`;
    throw new Error(detail);
  }
  return resultat?.QueryResponse || {};
}

// ============================================================
// ÉCRITURE VERS QUICKBOOKS — helpers partagés par toutes les routes
// (facture de dépôt, factures régulières, devis/estimates, clients).
// Sortis de facture-depot/route.js quand la facturation complète est
// arrivée (2026-08-15) : un seul exemplaire de chaque outil.
// ============================================================

// Appel d'écriture à l'API QuickBooks (POST JSON).
export async function ecrireQbo(acces, chemin, corps) {
  const url = `${urlBaseApiQb()}/v3/company/${acces.realmId}/${chemin}${chemin.includes("?") ? "&" : "?"}minorversion=75`;
  const reponse = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${acces.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corps),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const detail = resultat?.Fault?.Error?.[0]?.Message || `QuickBooks a refusé (code ${reponse.status}).`;
    throw new Error(detail);
  }
  return resultat;
}

// Guillemets échappés pour le langage de requête QBO.
export const echapperQbo = (s) => String(s || "").replace(/'/g, "\\'");

// ============================================================
// ENVOI D'UNE FACTURE PAR QUICKBOOKS — avec PREUVE.
// ------------------------------------------------------------
// C'est QuickBooks qui envoie SA facture officielle (PDF + bouton
// payer) au client, puis on RELIT le statut d'envoi dans sa réponse :
// la preuve vient du registre QuickBooks, jamais d'une supposition.
// Retourne { envoyee, envoyeeLe } — l'appelant affiche l'alerte et le
// bouton « Renvoyer » si envoyee est false. Rien ne se perd en silence.
// ============================================================
export async function envoyerFactureParQb(acces, factureId, courriels) {
  let dernier = null;
  for (const courriel of (courriels || []).slice(0, 5)) {
    const url = `${urlBaseApiQb()}/v3/company/${acces.realmId}/invoice/${factureId}/send?sendTo=${encodeURIComponent(courriel)}&minorversion=75`;
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${acces.accessToken}`,
        "Content-Type": "application/octet-stream",
        Accept: "application/json",
      },
    });
    const resultat = await reponse.json().catch(() => ({}));
    dernier = { ok: reponse.ok, facture: resultat?.Invoice || null };
  }
  const envoyee = !!dernier?.ok && dernier?.facture?.EmailStatus === "EmailSent";
  return {
    envoyee,
    envoyeeLe: envoyee ? dernier?.facture?.DeliveryInfo?.DeliveryTime || new Date().toISOString() : null,
  };
}

// Statut d'envoi RÉEL d'un lot de factures — lu du registre QuickBooks
// (bouton « Vérifier les envois » : le filet qui rattrape tout ce qui
// aurait dormi dans une craque).
export async function statutsEnvoiFactures(acces, ids) {
  const propres = (ids || []).map((x) => String(x || "").replace(/[^0-9]/g, "")).filter(Boolean).slice(0, 50);
  if (propres.length === 0) return {};
  const liste = propres.map((x) => `'${x}'`).join(",");
  // `select *` et non une liste de colonnes : QuickBooks REFUSE
  // (« Invalid query ») qu'on nomme un champ COMPLEXE comme DeliveryInfo
  // dans la projection. L'objet complet contient déjà EmailStatus et
  // DeliveryInfo.
  const reponse = await requeteQbo(acces, `select * from Invoice where Id in (${liste})`);
  const map = {};
  for (const f of reponse?.Invoice || []) {
    map[f.Id] = {
      envoyee: f.EmailStatus === "EmailSent",
      envoyeeLe: f.EmailStatus === "EmailSent" ? f?.DeliveryInfo?.DeliveryTime || null : null,
    };
  }
  return map;
}

// Retrouve ou crée le CLIENT QuickBooks. Retourne son id, et mémorise
// le lien sur la fiche de l'app pour les fois suivantes.
// LA FICHE COMPLÈTE vers QuickBooks (2026-08-17) — avant, seul le NOM
// partait : la fiche QuickBooks restait vide (pas de courriel = aucun
// envoi de facture possible). Maintenant : courriel par défaut,
// téléphone et adresse de facturation voyagent ensemble.
function payloadClientQbo(fiche) {
  const courriels = Array.isArray(fiche?.courriels) ? fiche.courriels : [];
  const courrielDefaut =
    courriels.find((c) => c?.defaut)?.email || courriels[0]?.email || null;
  return {
    DisplayName: String(fiche?.nom || "").slice(0, 100),
    ...(courrielDefaut ? { PrimaryEmailAddr: { Address: String(courrielDefaut).slice(0, 100) } } : {}),
    ...(fiche?.telephone ? { PrimaryPhone: { FreeFormNumber: String(fiche.telephone).slice(0, 30) } } : {}),
    ...(fiche?.adresse_facturation ? { BillAddr: { Line1: String(fiche.adresse_facturation).slice(0, 500) } } : {}),
  };
}

export async function clientQboPour(acces, admin, { clientId, clientNom }) {
  let fiche = null;
  if (clientId) {
    const { data } = await admin
      .from("clients_app")
      .select("quickbooks_customer_id, nom, courriels, telephone, adresse_facturation")
      .eq("id", clientId)
      .maybeSingle();
    if (data?.quickbooks_customer_id) return data.quickbooks_customer_id;
    fiche = data;
  }
  const trouve = await requeteQbo(acces, `select Id from Customer where DisplayName = '${echapperQbo(clientNom)}' maxresults 1`);
  let id = trouve?.Customer?.[0]?.Id || null;
  if (!id) {
    const cree = await ecrireQbo(acces, "customer", payloadClientQbo(fiche || { nom: clientNom }));
    id = cree?.Customer?.Id || null;
  }
  if (id && clientId) {
    await admin.from("clients_app").update({ quickbooks_customer_id: id, sync_qb: "synchronise" }).eq("id", clientId);
  }
  return id;
}

// MISE À JOUR de la fiche QuickBooks d'un client DÉJÀ relié — appelée
// quand la fiche change dans l'application (courriel corrigé, adresse…)
// pour que les deux ne divergent plus jamais. Mise à jour « sparse » :
// seuls nos champs bougent, le reste de la fiche QuickBooks est intact.
export async function mettreAJourClientQbo(acces, admin, clientId) {
  const { data: fiche } = await admin
    .from("clients_app")
    .select("quickbooks_customer_id, nom, courriels, telephone, adresse_facturation")
    .eq("id", clientId)
    .maybeSingle();
  if (!fiche?.quickbooks_customer_id) return false;
  const lu = await requeteQbo(acces, `select Id, SyncToken from Customer where Id = '${echapperQbo(fiche.quickbooks_customer_id)}' maxresults 1`);
  const existant = lu?.Customer?.[0];
  if (!existant) return false;
  await ecrireQbo(acces, "customer", {
    Id: existant.Id,
    SyncToken: existant.SyncToken,
    sparse: true,
    ...payloadClientQbo(fiche),
  });
  return true;
}

// Un article « Service » pour porter les lignes (QBO exige un article).
export async function articleServiceQboPour(acces) {
  const nomme = await requeteQbo(acces, `select Id, Name from Item where Name = 'Services' maxresults 1`);
  if (nomme?.Item?.[0]?.Id) return nomme.Item[0].Id;
  const premier = await requeteQbo(acces, `select Id, Name from Item where Type = 'Service' maxresults 1`);
  return premier?.Item?.[0]?.Id || null;
}
