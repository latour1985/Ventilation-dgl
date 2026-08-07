// app/api/quickbooks/connexion/route.js
//
// DÉPART DE LA CONNEXION QUICKBOOKS (OAuth2).
//
// L'admin clique « Connecter QuickBooks » → cette route le redirige
// vers l'écran d'autorisation d'Intuit, où il choisit son entreprise
// (Sandbox pour l'instant) et approuve l'accès. Intuit le renvoie
// ensuite sur /api/quickbooks/callback avec un code à échanger.
//
// Anti-CSRF : un « state » aléatoire part avec la demande et revient
// dans le callback ; il est aussi posé en cookie HttpOnly. Si les deux
// ne correspondent pas au retour, quelqu'un a fabriqué la demande —
// on refuse.

import { configQuickbooksPresente, urlRedirectionQb } from "@/lib/quickbooksServeur";

export async function GET(request) {
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

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      // 10 minutes pour compléter l'écran Intuit — large.
      "Set-Cookie": `qb_state=${state}; Path=/api/quickbooks; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}
