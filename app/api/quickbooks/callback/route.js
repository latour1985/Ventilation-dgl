// app/api/quickbooks/callback/route.js
//
// RETOUR DE L'ÉCRAN D'AUTORISATION INTUIT.
//
// Intuit revient ici avec ?code=...&realmId=...&state=... :
//   1. on vérifie le state contre le cookie posé au départ (anti-CSRF),
//   2. on échange le code contre les jetons (access + refresh),
//   3. on les range dans quickbooks_connexion (clé service — invisible
//      du navigateur),
//   4. on renvoie l'admin vers /admin avec un petit mot de confirmation.

import { configQuickbooksPresente, echangerJetonsIntuit, sauverConnexionQb, urlRedirectionQb, environnementQb } from "@/lib/quickbooksServeur";

function pageRetour(titre, detail, ok) {
  // Page minimaliste : le callback arrive dans l'onglet du navigateur,
  // hors de l'application React — un lien ramène vers /admin.
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QuickBooks — ${ok ? "connecté" : "échec"}</title></head>
     <body style="font-family:Arial,sans-serif;background:#f1f5f9;display:flex;min-height:100vh;align-items:center;justify-content:center;">
       <div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;text-align:center;">
         <p style="font-size:40px;margin:0;">${ok ? "✅" : "⚠️"}</p>
         <h1 style="font-size:18px;color:#0f172a;">${titre}</h1>
         <p style="font-size:14px;color:#475569;line-height:1.5;">${detail}</p>
         <a href="/admin" style="display:inline-block;margin-top:16px;background:#131B2E;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">Retourner à l'application</a>
       </div>
     </body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request) {
  if (!configQuickbooksPresente()) {
    return pageRetour("Configuration manquante", "Les clés QuickBooks ne sont pas posées sur le serveur.", false);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("cookie") || "";
  // 🏢 MULTI-QUICKBOOKS (2026-09-08) : le cookie porte `state:entreprise`
  // — l'entreprise vient du cookie HttpOnly posé au départ de la
  // connexion (jamais d'un paramètre d'URL forgeable). Les jetons se
  // rangent dans SA case.
  const brutCookie = /(?:^|;\s*)qb_state=([^;]+)/.exec(cookies)?.[1] || "";
  const [stateAttendu, entrepriseId] = brutCookie.split(":");

  if (!code || !realmId) {
    return pageRetour("Connexion annulée", "Intuit n'a pas fourni de code d'autorisation. Réessaie depuis l'application.", false);
  }
  if (!state || !stateAttendu || state !== stateAttendu || !entrepriseId) {
    return pageRetour("Demande non reconnue", "Le jeton de sécurité ne correspond pas — recommence la connexion depuis l'application.", false);
  }

  try {
    // Une NOUVELLE connexion part dans l'environnement par défaut de la
    // plateforme (variable Vercel) — chaque connexion mémorise le sien.
    const env = environnementQb();
    const jetons = await echangerJetonsIntuit({
      grant_type: "authorization_code",
      code,
      redirect_uri: urlRedirectionQb(request),
    }, env);
    await sauverConnexionQb({
      entrepriseId,
      environnement: env,
      realmId,
      accessToken: jetons.access_token,
      refreshToken: jetons.refresh_token,
      expiresIn: jetons.expires_in,
      refreshExpiresIn: jetons.x_refresh_token_expires_in,
    });
    return pageRetour(
      "QuickBooks connecté",
      "L'entreprise est reliée à l'application. Tu peux maintenant lancer « Synchroniser QuickBooks » depuis un projet.",
      true
    );
  } catch (e) {
    return pageRetour("Échec de la connexion", String(e?.message || "Erreur inconnue — réessaie."), false);
  }
}
