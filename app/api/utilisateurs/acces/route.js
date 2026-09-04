// app/api/utilisateurs/acces/route.js
//
// 🗄️ DÉSACTIVATION / RÉACTIVATION D'UN EMPLOYÉ (2026-09-05).
//
// La fiche RH reste dans le répertoire (historique, heures passées
// intactes) — ICI on ferme la PORTE : le compte est banni côté serveur
// (Supabase Auth), donc même avec son mot de passe, l'ex-employé ne
// rentre plus. Réactiver lève le ban.
//
// Gardes : appelant admin (principal ou régulier) de la MÊME entreprise
// que la cible ; un Admin régulier ne touche pas au compte d'un
// administrateur ; personne ne se désactive soi-même.

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";

const ROLES_ADMINS = ["Admin principal", "Admin régulier"];

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const appelant = await utilisateurDepuisJeton(jeton);
  if (!appelant) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🔒 RLS phase 3 : rôle lu de la table des permissions, jamais du
  // profil falsifiable — la porte des comptes est la plus sensible.
  const roleAppelant = await roleServeur(appelant);
  if (!ROLES_ADMINS.includes(roleAppelant)) {
    return Response.json({ erreur: "Réservé aux administrateurs." }, { status: 403 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const action = corps?.action === "reactiver" ? "reactiver" : corps?.action === "desactiver" ? "desactiver" : null;
  const courriel = String(corps?.courriel || "").trim().toLowerCase();
  if (!action || !courriel) return Response.json({ erreur: "Action et courriel requis." }, { status: 400 });
  if (courriel === (appelant.email || "").toLowerCase()) {
    return Response.json({ erreur: "On ne se désactive pas soi-même." }, { status: 400 });
  }

  const admin = clientSupabaseService();
  // Retrouver le compte par courriel (pagination large).
  let cible = null;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return Response.json({ erreur: error.message }, { status: 502 });
    cible = (data?.users || []).find((c) => (c.email || "").toLowerCase() === courriel) || null;
    if (cible || !data?.users || data.users.length < 200 || page >= 10) break;
    page++;
  }
  if (!cible) {
    // Pas de compte = rien à bannir (fiche sans invitation acceptée) —
    // la désactivation de la FICHE, elle, est déjà faite par l'appelant.
    return Response.json({ fait: true, sansCompte: true });
  }
  // 🔐 Cloisons : on ne touche qu'aux comptes de SA propre entreprise.
  if (entrepriseDuCompte(cible) !== entrepriseDuCompte(appelant)) {
    return Response.json({ erreur: "Ce compte n'appartient pas à votre entreprise." }, { status: 403 });
  }
  // Le rôle de la CIBLE aussi vient de la table (un admin dont le
  // profil dirait « Technicien » resterait protégé).
  const roleCible = await roleServeur(cible);
  if (ROLES_ADMINS.includes(roleCible) && roleAppelant !== "Admin principal") {
    return Response.json({ erreur: "Seul l'Admin principal peut désactiver un administrateur." }, { status: 403 });
  }

  // BAN de très longue durée = porte fermée ; "none" = porte rouverte.
  const { error } = await admin.auth.admin.updateUserById(cible.id, {
    ban_duration: action === "desactiver" ? "87600h" : "none",
  });
  if (error) return Response.json({ erreur: error.message }, { status: 502 });

  // 🔌 SESSIONS COUPÉES SUR-LE-CHAMP (2026-09-06) : le ban bloque les
  // NOUVELLES connexions et le renouvellement, mais un téléphone déjà
  // connecté garderait son jeton d'accès jusqu'à ~1 h. On révoque donc
  // aussi tous ses jetons de renouvellement — à la prochaine action de
  // l'app, la session meurt au lieu de se renouveler. Non bloquant :
  // si l'appel échoue, le ban fait le travail dans l'heure.
  let sessionsCoupees = false;
  if (action === "desactiver") {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${cible.id}/logout`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      sessionsCoupees = r.ok;
    } catch {
      sessionsCoupees = false;
    }
  }
  return Response.json({ fait: true, sessionsCoupees });
}
