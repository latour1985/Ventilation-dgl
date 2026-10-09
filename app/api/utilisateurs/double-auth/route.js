// app/api/utilisateurs/double-auth/route.js
//
// 🔐 RÉINITIALISER LA DOUBLE AUTHENTIFICATION D'UN EMPLOYÉ (2026-10-09).
// Téléphone perdu ou changé : l'Admin principal efface les codes de
// l'employé ; à sa prochaine connexion, l'écran d'activation (code QR)
// réapparaît s'il est administrateur.
//   POST { courriel, action: "etat" | "reinitialiser" }
// SÉCURITÉ :
//   • réservé à l'Admin principal, connecté AVEC son propre code ;
//   • seulement un compte de SA propre entreprise ;
//   • jamais un compte de la console de la plateforme (il se réinitialise
//     dans Supabase) ni son propre compte (même raison).

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";

async function trouverCompte(admin, courriel) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = (data?.users || []).find((x) => String(x.email || "").toLowerCase() === courriel);
    if (u) return u;
    if (!data?.users || data.users.length < 200) return null;
  }
  return null;
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const appelant = await utilisateurDepuisJeton(jeton);
  if (!appelant) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if ((await roleServeur(appelant)) !== "Admin principal") {
    return Response.json({ erreur: "Réservé à l'Admin principal." }, { status: 403 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const courriel = String(corps?.courriel || "").trim().toLowerCase();
  if (!courriel) return Response.json({ erreur: "Courriel requis." }, { status: 400 });
  if (courriel === String(appelant.email || "").toLowerCase()) {
    return Response.json({ erreur: "Ton propre compte se réinitialise dans Supabase (Authentication → ton compte)." }, { status: 400 });
  }

  const admin = clientSupabaseService();
  try {
    const cible = await trouverCompte(admin, courriel);
    if (!cible) return Response.json({ etat: "aucun-compte" });
    const meta = cible.app_metadata || {};
    if (meta.entreprise_id !== entrepriseDuCompte(appelant)) {
      return Response.json({ erreur: "Ce compte n'appartient pas à ton entreprise." }, { status: 403 });
    }
    if (meta.plateforme === true) {
      return Response.json({ erreur: "Compte de la console Fluxya : il se réinitialise dans Supabase." }, { status: 403 });
    }
    const { data: facteurs, error } = await admin.auth.admin.mfa.listFactors({ userId: cible.id });
    if (error) throw error;
    const verifies = (facteurs?.factors || []).filter((f) => f.status === "verified");
    if (corps?.action !== "reinitialiser") return Response.json({ etat: verifies.length > 0 ? "activee" : "inactive" });

    for (const f of facteurs?.factors || []) {
      const { error: e2 } = await admin.auth.admin.mfa.deleteFactor({ userId: cible.id, id: f.id });
      if (e2) throw e2;
    }
    try {
      await admin.from("journal_activite").insert({
        entreprise_id: entrepriseDuCompte(appelant),
        texte: `🔐 Double authentification de ${courriel} RÉINITIALISÉE par ${appelant.email} — il activera un nouveau code à sa prochaine connexion.`,
      });
    } catch {
      // journal indisponible — la réinitialisation, elle, est faite
    }
    return Response.json({ reinitialisee: true, effaces: (facteurs?.factors || []).length });
  } catch (e) {
    return Response.json({ erreur: `Opération impossible : ${e?.message || "erreur"}` }, { status: 502 });
  }
}
