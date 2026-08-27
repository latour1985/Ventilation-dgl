// app/api/journal/route.js
//
// JOURNAL D'ACTIVITÉ — piste d'audit partagée (Loi 25).
//
// Vérifié par sonde le 2026-08-17 : la table journal_activite est
// SCELLÉE par la RLS pour tous les comptes connectés (ni lecture ni
// écriture) — c'est pourquoi la piste d'audit restait vide depuis le
// début, chaque échec étant avalé en silence. Plutôt que d'ouvrir la
// table, cette route fait le pont avec la clé service :
//
//   • { action: "ajouter", texte } — toute personne CONNECTÉE ajoute
//     une entrée. L'auteur est déterminé PAR LE SERVEUR depuis le jeton
//     (jamais fourni par le client) : une piste d'audit ne se maquille
//     pas. Append-only : aucune modification, aucune suppression.
//   • { action: "lister", limite } — réservé à l'administration/bureau
//     (pas aux Techniciens), comme l'onglet Journal lui-même.

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  const admin = clientSupabaseService();

  if (corps?.action === "ajouter") {
    const texte = String(corps?.texte || "").trim().slice(0, 2000);
    if (!texte) return Response.json({ erreur: "Texte requis." }, { status: 400 });
    // L'auteur vient du JETON vérifié — le nom du compte, sinon son
    // courriel. Ajouté au texte : la table n'a pas de colonne de nom.
    const nom = utilisateur.user_metadata?.nom || utilisateur.email;
    const { error } = await admin.from("journal_activite").insert({
      texte: `${texte} — par ${nom}`,
      created_by: utilisateur.id,
      // 🔐 GRAND SOIR : la ligne nait dans l'entreprise de l'appelant.
      entreprise_id: entrepriseDuCompte(utilisateur),
    });
    if (error) return Response.json({ erreur: error.message }, { status: 502 });
    return Response.json({ ok: true });
  }

  if (corps?.action === "lister") {
    // ⚠️ RÔLE LU EN BASE, PAS DANS LE PROFIL (audit 2026-08-17) :
    // user_metadata est modifiable par l'utilisateur lui-même
    // (auth.updateUser) — un technicien pouvait s'auto-promouvoir et
    // lire la piste d'audit. La table permissions_utilisateurs, elle,
    // n'est modifiable que par un Admin principal (RLS) : c'est ELLE
    // qui fait foi ; le profil ne sert que de repli si aucune fiche.
    let roleReel = String(utilisateur.user_metadata?.role || "").trim();
    try {
      const { data: fiche } = await admin
        .from("permissions_utilisateurs")
        .select("role")
        .eq("email", (utilisateur.email || "").toLowerCase())
        .maybeSingle();
      if (fiche?.role) roleReel = String(fiche.role).trim();
    } catch {
      // table indisponible — le repli (profil) s'applique
    }
    if (roleReel === "Technicien") {
      return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
    }
    const limite = Math.min(500, Math.max(1, parseInt(corps?.limite) || 300));
    const { data, error } = await admin
      .from("journal_activite")
      .select("id, texte, created_at")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) return Response.json({ erreur: error.message }, { status: 502 });
    return Response.json({ lignes: data || [] });
  }

  return Response.json({ erreur: "Action inconnue." }, { status: 400 });
}
