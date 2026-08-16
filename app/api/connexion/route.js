// app/api/connexion/route.js
//
// LA PORTE DE CONNEXION SURVEILLÉE (2026-08-17).
// La connexion passe par ICI (plus jamais directement du navigateur à
// Supabase) pour que le compteur d'échecs vive CÔTÉ SERVEUR — un
// compteur dans le navigateur se contourne en parlant à l'API.
//
//   • 3 échecs -> verrou 15 minutes + réinitialisation offerte.
//     (Temporaire, pas définitif : un blocage permanent donnerait à un
//     farceur le pouvoir de verrouiller n'importe quel employé.)
//   • Bonne connexion -> compteur effacé.
//   • { action: "deverrouiller" } avec le jeton de RÉCUPÉRATION (page
//     choisir-mot-de-passe) -> verrou levé immédiatement après une
//     réinitialisation réussie.
//
// Si la table n'existe pas encore (snippet 68 non collé), la connexion
// fonctionne quand même — sans verrou. Rien ne casse en silence.

import { createClient } from "@supabase/supabase-js";
import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

const MAX_ESSAIS = 3;
const MINUTES_VERROU = 15;

export async function POST(request) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  const admin = clientSupabaseService();

  // ---- DÉVERROUILLAGE après réinitialisation réussie ----
  if (corps?.action === "deverrouiller") {
    const enTete = request.headers.get("authorization") || "";
    const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
    const utilisateur = await utilisateurDepuisJeton(jeton);
    if (!utilisateur?.email) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
    await admin.from("connexion_echecs").delete().eq("courriel", utilisateur.email.toLowerCase());
    return Response.json({ ok: true });
  }

  // ---- CONNEXION ----
  const courriel = String(corps?.courriel || "").trim().toLowerCase();
  const motDePasse = String(corps?.motDePasse || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel) || !motDePasse) {
    return Response.json({ erreur: "Courriel et mot de passe requis." }, { status: 400 });
  }

  // Le verrou d'abord — avant même de tenter quoi que ce soit.
  const { data: fiche } = await admin
    .from("connexion_echecs")
    .select("*")
    .eq("courriel", courriel)
    .maybeSingle();
  if (fiche?.verrou_jusqua && new Date(fiche.verrou_jusqua).getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((new Date(fiche.verrou_jusqua).getTime() - Date.now()) / 60000));
    return Response.json({ verrouille: true, minutes });
  }

  // La vraie tentative — avec la clé anonyme (mêmes droits que le
  // navigateur), session jamais gardée côté serveur.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email: courriel, password: motDePasse });

  if (error || !data?.session) {
    const echecs = (Number(fiche?.echecs) || 0) + 1;
    const verrou = echecs >= MAX_ESSAIS ? new Date(Date.now() + MINUTES_VERROU * 60000).toISOString() : null;
    await admin.from("connexion_echecs").upsert({
      courriel,
      // Le compteur repart à zéro quand le verrou tombe — sinon le
      // 4e essai re-verrouillerait instantanément après les 15 min.
      echecs: verrou ? 0 : echecs,
      dernier_echec: new Date().toISOString(),
      verrou_jusqua: verrou,
    });
    if (verrou) return Response.json({ verrouille: true, minutes: MINUTES_VERROU, vientDArriver: true });
    return Response.json({ erreur: "Courriel ou mot de passe incorrect.", essaisRestants: MAX_ESSAIS - echecs });
  }

  // Succès : compteur effacé, la session retourne au navigateur qui
  // l'installe chez lui (setSession) — la suite est identique à avant.
  if (fiche) await admin.from("connexion_echecs").delete().eq("courriel", courriel);
  return Response.json({
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  });
}
