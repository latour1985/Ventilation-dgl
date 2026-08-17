// app/api/equipe/fermeture/route.js
//
// FERMETURE D'ÉQUIPE — « toute l'équipe a terminé » (2026-08-17).
//
// Quand le technicien qui ferme une tâche partagée déclare que TOUTE
// l'équipe a terminé, cette route pose une marque `equipeTerminee` dans
// la ligne d'assignation (taches_assignees.donnees) de chacun de ses
// coéquipiers. Leur téléphone la reçoit en direct (Realtime) et leur
// pose la question : « Avais-tu terminé en même temps ? »
//
// POURQUOI UNE ROUTE SERVEUR : la RLS interdit à un technicien d'écrire
// dans la ligne d'un collègue (vérifié par sonde le 2026-08-17) — et
// c'est très bien ainsi. Ici, la clé service écrit à sa place, mais
// SEULEMENT après avoir vérifié que le demandeur est réellement
// assigné à cette tâche. Même patron que les routes QuickBooks.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

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
  const tacheId = String(corps?.tacheId || "").trim();
  const jour = String(corps?.jour || "").trim() || null;
  if (!tacheId) return Response.json({ erreur: "Tâche requise." }, { status: 400 });

  const admin = clientSupabaseService();
  const monEmail = (utilisateur.email || "").toLowerCase();
  const { data: lignes, error } = await admin
    .from("taches_assignees")
    .select("id, employe_email, donnees")
    .eq("tache_id", tacheId);
  if (error) return Response.json({ erreur: error.message }, { status: 502 });

  // Garde : seul un membre de l'équipe de CETTE tâche peut déclarer.
  const maLigne = (lignes || []).find((l) => (l.employe_email || "").toLowerCase() === monEmail);
  if (!maLigne) return Response.json({ erreur: "Tu n'es pas assigné à cette tâche." }, { status: 403 });

  const nom = utilisateur.user_metadata?.nom || monEmail.split("@")[0];
  const marque = { par: nom, parEmail: monEmail, a: new Date().toISOString(), jour };

  let marques = 0;
  for (const l of lignes || []) {
    if ((l.employe_email || "").toLowerCase() === monEmail) continue;
    // Fusion : on AJOUTE la marque à la fiche existante, on n'écrase
    // jamais les autres informations de la tâche (adresse, courriels…).
    const { error: e2 } = await admin
      .from("taches_assignees")
      .update({ donnees: { ...(l.donnees || {}), equipeTerminee: marque } })
      .eq("id", l.id);
    if (!e2) marques++;
  }
  return Response.json({ marques });
}
