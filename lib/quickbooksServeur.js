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

// ============================================================
// 🏢 UN QUICKBOOKS PAR ENTREPRISE (2026-09-08, GO du propriétaire)
// ------------------------------------------------------------
// Avant : UNE connexion pour toute la plateforme, verrouillée « DGL
// seulement » au grand soir. Le verrou fermait la porte d'entrée, mais
// un dépôt créé par une entreprise-test écrivait quand même dans le
// QuickBooks branché (celui de DGL) — inacceptable avec de vrais
// clients : les factures du client A dans les livres du client B.
//
// Maintenant : chaque entreprise a SA ligne dans quickbooks_connexion
// (snippet 98, unique par entreprise_id), avec SON realm, SES jetons et
// SON environnement (sandbox/production). Toutes les routes résolvent
// l'entreprise DU DEMANDEUR et n'utilisent QUE sa connexion — même
// philosophie que le RLS, appliquée à la comptabilité. Une entreprise
// sans connexion reçoit { nonConnecte } — jamais les livres d'un autre.
// ============================================================

// Environnement PAR DÉFAUT pour les NOUVELLES connexions (variable
// Vercel). Chaque connexion mémorise le sien : DGL peut être en
// production pendant que Miroir reste en sandbox.
export function environnementQb() {
  return process.env.QB_ENVIRONNEMENT === "production" ? "production" : "sandbox";
}

// Clés Intuit PAR ENVIRONNEMENT : une app Intuit a des clés de
// développement (sandbox) ET des clés de production distinctes. Repli
// sur QB_CLIENT_ID/SECRET (les variables historiques) — à la bascule
// production de DGL : les clés prod deviennent QB_CLIENT_ID/SECRET et
// les clés sandbox déménagent dans QB_CLIENT_ID_SANDBOX/SECRET_SANDBOX
// pour que Miroir continue de fonctionner.
export function clesIntuit(env) {
  if (env === "production") {
    return {
      id: process.env.QB_CLIENT_ID_PRODUCTION || process.env.QB_CLIENT_ID,
      secret: process.env.QB_CLIENT_SECRET_PRODUCTION || process.env.QB_CLIENT_SECRET,
    };
  }
  return {
    id: process.env.QB_CLIENT_ID_SANDBOX || process.env.QB_CLIENT_ID,
    secret: process.env.QB_CLIENT_SECRET_SANDBOX || process.env.QB_CLIENT_SECRET,
  };
}

export function configQuickbooksPresente() {
  return !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Base API selon l'ENVIRONNEMENT DE LA CONNEXION (jamais le global) :
// c'est ce qui permet à deux entreprises de vivre dans des
// environnements différents en même temps.
export function urlBaseApiQb(env) {
  return env === "production"
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

// La connexion de CETTE entreprise — et d'aucune autre.
export async function lireConnexionQb(entrepriseId) {
  if (!entrepriseId) return null;
  const admin = clientSupabaseService();
  const { data } = await admin
    .from("quickbooks_connexion")
    .select("*")
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  return data || null;
}

export async function sauverConnexionQb({ entrepriseId, environnement, realmId, accessToken, refreshToken, expiresIn, refreshExpiresIn, connectePar }) {
  if (!entrepriseId) throw new Error("Entreprise requise pour sauver une connexion QuickBooks.");
  const admin = clientSupabaseService();
  const maintenant = Date.now();
  const { error } = await admin.from("quickbooks_connexion").upsert(
    {
      entreprise_id: entrepriseId,
      environnement: environnement || environnementQb(),
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
    { onConflict: "entreprise_id" }
  );
  if (error) throw error;
}

// Échange auprès d'Intuit : soit un code d'autorisation (1re connexion),
// soit un refresh token (renouvellement). Retourne le JSON d'Intuit.
export async function echangerJetonsIntuit(params, environnement) {
  const cles = clesIntuit(environnement || environnementQb());
  const identifiants = Buffer.from(`${cles.id}:${cles.secret}`).toString("base64");
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
// L'accès porte maintenant l'ENVIRONNEMENT de la connexion — les appels
// API en dérivent leur base (sandbox/production) sans jamais consulter
// le réglage global.
export async function jetonAccesValide(entrepriseId) {
  const connexion = await lireConnexionQb(entrepriseId);
  if (!connexion) return null;
  const env = connexion.environnement === "production" ? "production" : "sandbox";
  if (new Date(connexion.access_expire_a).getTime() > Date.now()) {
    return { accessToken: connexion.access_token, realmId: connexion.realm_id, environnement: env };
  }
  if (new Date(connexion.refresh_expire_a).getTime() <= Date.now()) {
    return null; // Refresh expiré (~100 jours sans usage) — reconnexion requise.
  }
  const jetons = await echangerJetonsIntuit({
    grant_type: "refresh_token",
    refresh_token: connexion.refresh_token,
  }, env);
  await sauverConnexionQb({
    entrepriseId,
    environnement: env,
    realmId: connexion.realm_id,
    accessToken: jetons.access_token,
    refreshToken: jetons.refresh_token,
    expiresIn: jetons.expires_in,
    refreshExpiresIn: jetons.x_refresh_token_expires_in,
  });
  return { accessToken: jetons.access_token, realmId: connexion.realm_id, environnement: env };
}

// 🪪 intuit_tid — l'identifiant de traçage qu'Intuit attache à CHAQUE
// réponse (2026-09-08). Quand une erreur QuickBooks survient, il est
// AJOUTÉ au message d'erreur : les routes le remontent au Journal, et
// c'est exactement ce que le soutien Intuit demande pour retrouver un
// appel dans leurs systèmes. Coût : zéro — l'en-tête est déjà là.
function detailErreurQbo(reponse, resultat) {
  const detail = resultat?.Fault?.Error?.[0]?.Message || `QuickBooks a refusé (code ${reponse.status}).`;
  const tid = reponse.headers?.get?.("intuit_tid");
  return tid ? `${detail} [intuit_tid: ${tid}]` : detail;
}

// Requête « query » à l'API QuickBooks (langage proche du SQL, lecture
// seule). Retourne le QueryResponse brut.
export async function requeteQbo(acces, requete) {
  const url = `${urlBaseApiQb(acces.environnement)}/v3/company/${acces.realmId}/query?query=${encodeURIComponent(requete)}&minorversion=75`;
  const reponse = await fetch(url, {
    headers: { Authorization: `Bearer ${acces.accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error(detailErreurQbo(reponse, resultat));
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
  const url = `${urlBaseApiQb(acces.environnement)}/v3/company/${acces.realmId}/${chemin}${chemin.includes("?") ? "&" : "?"}minorversion=75`;
  const reponse = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${acces.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corps),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error(detailErreurQbo(reponse, resultat));
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
  // 📧 CHAQUE ADRESSE A SON VERDICT (2026-09-04, vécu facture 4264 :
  // « Louise n'a pas reçu le courriel ») — avant, seule la DERNIÈRE
  // réponse était gardée : un échec au milieu de la liste passait pour
  // un envoi réussi. Chaque adresse est maintenant suivie, et les
  // ratées sont retournées pour finir au journal.
  const parAdresse = [];
  for (const courriel of (courriels || []).slice(0, 5)) {
    const url = `${urlBaseApiQb(acces.environnement)}/v3/company/${acces.realmId}/invoice/${factureId}/send?sendTo=${encodeURIComponent(courriel)}&minorversion=75`;
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${acces.accessToken}`,
        "Content-Type": "application/octet-stream",
        Accept: "application/json",
      },
    });
    const resultat = await reponse.json().catch(() => ({}));
    const facture = resultat?.Invoice || null;
    parAdresse.push({ courriel, ok: reponse.ok && facture?.EmailStatus === "EmailSent", facture });
  }
  const reussies = parAdresse.filter((x) => x.ok);
  const ratees = parAdresse.filter((x) => !x.ok).map((x) => x.courriel);
  const envoyee = reussies.length > 0 && ratees.length === 0;
  return {
    envoyee,
    envoyeeLe: reussies.length > 0 ? reussies[reussies.length - 1].facture?.DeliveryInfo?.DeliveryTime || new Date().toISOString() : null,
    // Adresses dont QuickBooks n'a PAS confirmé l'envoi — jamais tues.
    ratees,
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

// ============================================================
// CODE DE TAXE DE VENTE — obligatoire au Canada (2026-09-09).
// ------------------------------------------------------------
// Découvert à la bascule production : un fichier QuickBooks CANADIEN
// refuse toute facture dont les lignes n'ont pas de code de taxe
// (« Assurez-vous que toutes vos opérations comprennent un taux de
// TPS/TVH avant d'enregistrer », erreur 6000) — le Sandbox américain,
// lui, s'en fichait. On détecte donc le code de vente du FICHIER DE
// L'ENTREPRISE (multi-compagnies : chaque fichier a ses propres ids) :
//   1. « TPS/TVQ » (le combiné Québec — 5 % + 9,975 %) ;
//   2. sinon « TVH »/« HST » (autres provinces) ;
//   3. sinon « TPS »/« GST » seule ;
//   4. sinon AUCUN code (fichier américain type Sandbox) : les lignes
//      partent sans, exactement comme avant — jamais bloquant.
// Mis en cache par fichier : les codes de taxe ne changent à peu près
// jamais, inutile de requêter à chaque facture.
// ============================================================
const cacheCodesTaxeVente = new Map();
export async function codeTaxeVente(acces) {
  const cle = String(acces.realmId);
  if (cacheCodesTaxeVente.has(cle)) return cacheCodesTaxeVente.get(cle);
  let code = null;
  try {
    const lu = await requeteQbo(acces, `select * from TaxCode`);
    const actifs = (lu?.TaxCode || []).filter((t) => t.Active !== false);
    const parNom = (re) => actifs.find((t) => re.test(String(t.Name || "")));
    const choisi = parNom(/tps\s*\/\s*tvq/i) || parNom(/^\s*(tvh|hst)\b/i) || parNom(/^\s*(tps|gst)\s*$/i);
    code = choisi ? String(choisi.Id) : null;
  } catch {
    code = null; // taxes illisibles — la facture part sans code plutôt que d'être bloquée ici
  }
  cacheCodesTaxeVente.set(cle, code);
  return code;
}

// Les champs à ÉTALER dans le corps d'une facture/d'un devis quand le
// fichier a un code de taxe : chaque appelant fait
// `...proprietesTaxe(codeTaxe)` au niveau du document et ajoute
// TaxCodeRef sur chaque ligne de vente. TaxExcluded = nos montants sont
// HORS TAXES, QuickBooks ajoute la TPS/TVQ par-dessus (jamais l'inverse).
export function proprietesTaxe(codeTaxe) {
  return codeTaxe ? { GlobalTaxCalculation: "TaxExcluded" } : {};
}
