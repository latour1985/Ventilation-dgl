// app/api/quickbooks/connexion/route.js
//
// DÉPART DE LA CONNEXION QUICKBOOKS (OAuth2).
//
// L'admin clique « Connecter QuickBooks » → l'interface appelle cette
// route AVEC son jeton, reçoit l'adresse d'autorisation Intuit et s'y
// rend. Intuit renvoie ensuite sur /api/quickbooks/callback avec un
// code à échanger.
//
// 🔐 GRAND SOIR (2026-09-04) : la route exigeait… rien. N'importe qui
// (dont un admin d'entreprise-test) pouvait lancer l'OAuth et, en
// complétant l'écran Intuit avec SON QuickBooks, ÉCRASER la connexion
// comptable de DGL (une seule ligne en base tant que le multi-connexion
// n'existe pas). Maintenant : jeton requis, rôle bureau, et entreprise
// « dgl » seulement — la comptabilité branchée est celle de DGL, point.
//
// Anti-CSRF : un « state » aléatoire part avec la demande et revient
// dans le callback ; il est aussi posé en cookie HttpOnly. Si les deux
// ne correspondent pas au retour, quelqu'un a fabriqué la demande —
// on refuse.

import { configQuickbooksPresente, urlRedirectionQb, utilisateurDepuisJeton, entrepriseDuCompte, environnementQb, clesIntuit } from "@/lib/quickbooksServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  // 🏢 MULTI-QUICKBOOKS (2026-09-08) : le verrou « DGL seulement » du
  // grand soir saute — CHAQUE entreprise branche maintenant SON propre
  // QuickBooks. L'identité de l'entreprise voyage dans le cookie
  // anti-CSRF : le callback rangera les jetons dans SA case, jamais
  // celle d'une autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if (!configQuickbooksPresente()) {
    return Response.json(
      { erreur: "QuickBooks n'est pas configuré — pose QB_CLIENT_ID, QB_CLIENT_SECRET et SUPABASE_SERVICE_ROLE_KEY d'abord." },
      { status: 503 }
    );
  }
  // 🧪 CONNEXION SANDBOX SUR DEMANDE (2026-08-31, retour du
  // propriétaire : « sur l'essai je n'ai pas accès au sandbox ») —
  // depuis la bascule production, toute nouvelle connexion partait en
  // production. `?environnement=sandbox` permet de relier une entreprise
  // de TEST (Miroir) à un fichier Sandbox Intuit — à condition que les
  // clés de développement soient posées dans Vercel.
  const envDemande = new URL(request.url).searchParams.get("environnement") === "sandbox" ? "sandbox" : environnementQb();
  if (envDemande === "sandbox" && environnementQb() === "production" && !process.env.QB_CLIENT_ID_SANDBOX) {
    return Response.json(
      { erreur: "Clés Sandbox absentes — pose QB_CLIENT_ID_SANDBOX et QB_CLIENT_SECRET_SANDBOX (clés de développement Intuit) dans Vercel d'abord." },
      { status: 503 }
    );
  }
  const state = crypto.randomUUID();
  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", clesIntuit(envDemande).id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  url.searchParams.set("redirect_uri", urlRedirectionQb(request));
  url.searchParams.set("state", state);

  // L'interface reçoit l'adresse et s'y rend elle-même — le cookie
  // anti-CSRF est posé sur CETTE réponse (même origine, il suit).
  return new Response(JSON.stringify({ url: url.toString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // 10 minutes pour compléter l'écran Intuit — large. Le cookie
      // porte `state:entreprise` — le state venant d'Intuit doit
      // correspondre, ET l'entreprise vient du cookie HttpOnly (jamais
      // d'un paramètre que quelqu'un pourrait forger).
      // Le cookie porte `state:entreprise:environnement` — le callback
      // rangera la connexion dans le BON environnement, jamais deviné.
      "Set-Cookie": `qb_state=${state}:${entrepriseId}:${envDemande}; Path=/api/quickbooks; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}
