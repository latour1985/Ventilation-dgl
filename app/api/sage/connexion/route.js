// app/api/sage/connexion/route.js
//
// DÉPART DE LA CONNEXION SAGE BUSINESS CLOUD (OAuth2) — le MÊME moule
// que /api/quickbooks/connexion : l'admin clique « Connecter Sage »,
// reçoit l'adresse d'autorisation Sage et s'y rend ; Sage revient sur
// /api/sage/callback avec un code à échanger. Anti-CSRF par cookie
// HttpOnly `state:entreprise` — le callback range les jetons dans SA
// case, jamais celle d'une autre entreprise.

import { utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";
import { configSagePresente, urlRedirectionSage } from "@/lib/sageServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if ((await roleServeur(utilisateur)) === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if (!configSagePresente()) {
    return Response.json(
      { erreur: "Sage n'est pas configuré — pose SAGE_CLIENT_ID, SAGE_CLIENT_SECRET et SUPABASE_SERVICE_ROLE_KEY d'abord." },
      { status: 503 }
    );
  }
  const state = crypto.randomUUID();
  // L'écran d'autorisation Sage — filter=apiv3.1 le limite à l'API
  // Accounting, scope full_access = lecture + écriture (factures).
  const url = new URL("https://www.sageone.com/oauth2/auth/central");
  url.searchParams.set("filter", "apiv3.1");
  url.searchParams.set("client_id", process.env.SAGE_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "full_access");
  url.searchParams.set("redirect_uri", urlRedirectionSage(request));
  url.searchParams.set("state", state);

  return new Response(JSON.stringify({ url: url.toString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `sage_state=${state}:${entrepriseId}; Path=/api/sage; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}
