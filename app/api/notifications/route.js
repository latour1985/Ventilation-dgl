// app/api/notifications/route.js
//
// LA PORTE DES NOTIFICATIONS PUSH (2026-08-18).
//   { action: "abonner", abonnement }  — un utilisateur CONNECTÉ
//     enregistre l'abonnement push de SON appareil (clé : son courriel).
//   { action: "envoyer", courriel, titre, corps, url } — le BUREAU
//     (jamais un technicien) envoie une notification au courriel visé.
// L'envoi est signé avec les clés VAPID (variables d'environnement) et
// un abonnement expiré (410/404) est effacé tout seul.

import webpush from "web-push";
import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur?.email) return Response.json({ erreur: "Connexion requise." }, { status: 401 });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  const admin = clientSupabaseService();

  // ---- ABONNER : chacun enregistre l'abonnement de SON appareil ----
  if (corps?.action === "abonner") {
    const abonnement = corps?.abonnement;
    if (!abonnement?.endpoint) return Response.json({ erreur: "Abonnement invalide." }, { status: 400 });
    const { error } = await admin.from("push_abonnements").upsert({
      courriel: utilisateur.email.toLowerCase(),
      abonnement,
      updated_at: new Date().toISOString(),
    });
    if (error) return Response.json({ erreur: `Enregistrement refusé : ${error.message}` }, { status: 502 });
    return Response.json({ ok: true });
  }

  // ---- ENVOYER : réservé au bureau ----
  if (corps?.action === "envoyer") {
    if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
      return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
    }
    const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const clePrivee = process.env.VAPID_PRIVATE_KEY;
    if (!clePublique || !clePrivee) return Response.json({ simule: true });

    const courriel = String(corps?.courriel || "").trim().toLowerCase();
    if (!courriel) return Response.json({ erreur: "Courriel requis." }, { status: 400 });

    const { data: ligne } = await admin
      .from("push_abonnements")
      .select("abonnement")
      .eq("courriel", courriel)
      .maybeSingle();
    if (!ligne?.abonnement) return Response.json({ sansAbonnement: true });

    webpush.setVapidDetails(process.env.VAPID_SUJET || "mailto:info@ventilationdgl.com", clePublique, clePrivee);
    try {
      await webpush.sendNotification(
        ligne.abonnement,
        JSON.stringify({
          titre: String(corps?.titre || "Fluxya").slice(0, 80),
          corps: String(corps?.corps || "").slice(0, 200),
          url: String(corps?.url || "/technicien").slice(0, 200),
        })
      );
      return Response.json({ envoye: true });
    } catch (e) {
      // Abonnement mort (application désinstallée, permission retirée) :
      // on l'efface — le technicien réactivera depuis son écran d'accueil.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await admin.from("push_abonnements").delete().eq("courriel", courriel);
        return Response.json({ sansAbonnement: true, expire: true });
      }
      return Response.json({ erreur: String(e?.message || "Envoi refusé.") }, { status: 502 });
    }
  }

  return Response.json({ erreur: "Action inconnue." }, { status: 400 });
}
