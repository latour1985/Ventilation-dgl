// app/api/sage/callback/route.js
//
// RETOUR DE L'ÉCRAN D'AUTORISATION SAGE.
//
// Sage revient ici avec ?code=...&state=... :
//   1. state vérifié contre le cookie posé au départ (anti-CSRF),
//   2. code échangé contre les jetons (access 5 min + refresh 31 j),
//   3. le « business » (dossier comptable) est lu et mémorisé — c'est
//      lui que toutes les futures écritures cibleront,
//   4. jetons rangés dans sage_connexion (clé service), retour /admin.

import { configSagePresente, echangerJetonsSage, sauverConnexionSage, urlRedirectionSage, requeteSage } from "@/lib/sageServeur";

function pageRetour(titre, detail, ok) {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Sage — ${ok ? "connecté" : "échec"}</title></head>
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
  if (!configSagePresente()) {
    return pageRetour("Configuration manquante", "Les clés Sage ne sont pas posées sur le serveur.", false);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("cookie") || "";
  const brutCookie = /(?:^|;\s*)sage_state=([^;]+)/.exec(cookies)?.[1] || "";
  const [stateAttendu, entrepriseId] = brutCookie.split(":");

  if (!code) {
    return pageRetour("Connexion annulée", "Sage n'a pas fourni de code d'autorisation. Réessaie depuis l'application.", false);
  }
  if (!state || !stateAttendu || state !== stateAttendu || !entrepriseId) {
    return pageRetour("Demande non reconnue", "Le jeton de sécurité ne correspond pas — recommence la connexion depuis l'application.", false);
  }

  try {
    const jetons = await echangerJetonsSage({
      grant_type: "authorization_code",
      code,
      redirect_uri: urlRedirectionSage(request),
    });
    // Le « business » (dossier comptable) autorisé — lu tout de suite et
    // mémorisé : toutes les écritures futures le cibleront (X-Business).
    let businessId = null;
    let businessNom = null;
    let pays = null;
    try {
      const r = await requeteSage({ accessToken: jetons.access_token, businessId: null }, "businesses");
      const premier = (r?.$items || [])[0];
      businessId = premier?.id || null;
      businessNom = premier?.name || null;
      pays = premier?.country_id || null;
    } catch {
      // Le business se relira à la première requête — la connexion
      // reste valable même si cette lecture-ci échoue.
    }
    await sauverConnexionSage({
      entrepriseId,
      accessToken: jetons.access_token,
      refreshToken: jetons.refresh_token,
      expiresIn: jetons.expires_in,
      refreshExpiresIn: jetons.refresh_token_expires_in,
      businessId,
      businessNom,
      pays,
    });
    return pageRetour(
      "Sage connecté",
      `L'entreprise est reliée à Sage Business Cloud${businessNom ? ` (dossier « ${businessNom} »)` : ""}. Les prochaines étapes du chantier brancheront les clients et les factures.`,
      true
    );
  } catch (e) {
    return pageRetour("Échec de la connexion", String(e?.message || "Erreur inconnue — réessaie."), false);
  }
}
