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

import { configQuickbooksPresente, urlRedirectionQb, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (entrepriseDuCompte(utilisateur) !== "dgl") {
    return Response.json({ erreur: "La connexion comptable n'est pas encore offerte à votre entreprise." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) {
    return Response.json(
      { erreur: "QuickBooks n'est pas configuré — pose QB_CLIENT_ID, QB_CLIENT_SECRET et SUPABASE_SERVICE_ROLE_KEY d'abord." },
      { status: 503 }
    );
  }
  const state = crypto.randomUUID();
  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", process.env.QB_CLIENT_ID);
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
      // 10 minutes pour compléter l'écran Intuit — large.
      "Set-Cookie": `qb_state=${state}; Path=/api/quickbooks; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}
