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

import webpush from "web-push";
import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

// Notification push à UN coéquipier — un bonus, jamais un bloqueur :
// sans abonnement ou sans clés VAPID, on passe simplement au suivant.
// Un abonnement mort (application désinstallée) est effacé au passage.
async function pousserA(admin, courriel, titre, corpsTexte) {
  const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const clePrivee = process.env.VAPID_PRIVATE_KEY;
  if (!clePublique || !clePrivee || !courriel) return;
  const { data: ligne } = await admin
    .from("push_abonnements")
    .select("abonnement")
    .eq("courriel", courriel)
    .maybeSingle();
  if (!ligne?.abonnement) return;
  webpush.setVapidDetails(process.env.VAPID_SUJET || "mailto:info@ventilationdgl.com", clePublique, clePrivee);
  try {
    await webpush.sendNotification(
      ligne.abonnement,
      JSON.stringify({ titre: titre.slice(0, 80), corps: corpsTexte.slice(0, 200), url: "/technicien" })
    );
  } catch (e) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from("push_abonnements").delete().eq("courriel", courriel);
    }
  }
}

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

  // 🚪 MODE « JE PARS EN PREMIER » (2026-08-18) : aucune marque écrite —
  // les coéquipiers n'ont PAS fini à leur place, ils continuent. On les
  // avertit seulement que la signature du client leur revient.
  if (corps?.mode === "pars_premier") {
    let avises = 0;
    for (const l of lignes || []) {
      const courriel = (l.employe_email || "").toLowerCase();
      if (courriel === monEmail) continue;
      await pousserA(
        admin,
        courriel,
        `🚪 ${nom} a quitté le chantier`,
        "C'est maintenant toi qui fais signer le client et qui envoies le bon de travail à la fin."
      );
      avises++;
    }
    return Response.json({ avises });
  }

  const marque = { par: nom, parEmail: monEmail, a: new Date().toISOString(), jour };

  let marques = 0;
  for (const l of lignes || []) {
    const courriel = (l.employe_email || "").toLowerCase();
    if (courriel === monEmail) continue;
    // Fusion : on AJOUTE la marque à la fiche existante, on n'écrase
    // jamais les autres informations de la tâche (adresse, courriels…).
    const { error: e2 } = await admin
      .from("taches_assignees")
      .update({ donnees: { ...(l.donnees || {}), equipeTerminee: marque } })
      .eq("id", l.id);
    if (!e2) {
      marques++;
      // 🔔 En plus de la fenêtre à l'ouverture de l'app : un push tout
      // de suite — le coéquipier sait qu'une confirmation l'attend.
      await pousserA(
        admin,
        courriel,
        `🤝 ${nom} a fermé la tâche pour l'équipe`,
        "Il a fait signer le client. Ouvre l'application pour confirmer (ou ajuster) tes heures."
      );
    }
  }
  return Response.json({ marques });
}
