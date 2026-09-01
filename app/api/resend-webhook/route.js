// app/api/resend-webhook/route.js
//
// 📮 REBONDS DE COURRIELS (2026-09-03, le « bonus » du suivi de
// consultation) : Resend nous PRÉVIENT quand un courriel rebondit
// (adresse inexistante, boîte pleine, rejeté comme pourriel) — le seul
// angle mort qui restait dans la chaîne « preuve d'envoi ». L'alerte
// atterrit au JOURNAL de l'entreprise concernée : « ⚠️ Le courriel à
// untel@… a REBONDI — vérifie l'adresse ».
//
// SÉCURITÉ : chaque appel est SIGNÉ par Resend (schéma Svix). Sans la
// signature valide, on refuse — sinon n'importe qui sur Internet
// pourrait écrire dans le journal. Le secret vit dans Vercel
// (RESEND_WEBHOOK_SECRET, commence par « whsec_ ») ; tant qu'il n'est
// pas configuré, la route répond 503 et ne traite RIEN.
//
// CONFIGURATION (une fois, dans le tableau de bord Resend) :
//   Webhooks → Add endpoint → https://fluxya.app/api/resend-webhook
//   Événements : email.bounced, email.complained, email.delivery_delayed
//   → copier le « Signing secret » dans Vercel (RESEND_WEBHOOK_SECRET).

import crypto from "node:crypto";
import { clientSupabaseService } from "@/lib/quickbooksServeur";

// Vérification de signature Svix : HMAC-SHA256 de « id.timestamp.corps »
// avec le secret (partie après « whsec_ », en base64). Comparaison en
// temps constant — on ne donne jamais d'indice sur la bonne signature.
function signatureValide(secret, id, timestamp, corps, signatures) {
  try {
    const cle = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
    const attendue = crypto.createHmac("sha256", cle).update(`${id}.${timestamp}.${corps}`).digest("base64");
    return String(signatures || "")
      .split(" ")
      .map((s) => s.split(",")[1] || "")
      .some((s) => {
        try {
          return s.length > 0 && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(attendue));
        } catch {
          return false;
        }
      });
  } catch {
    return false;
  }
}

const LIBELLES = {
  "email.bounced": "a REBONDI (adresse inexistante ou boîte en erreur)",
  "email.complained": "a été signalé comme POURRIEL par le destinataire",
  "email.delivery_delayed": "est RETARDÉ par le serveur du destinataire (nouvel essai en cours)",
};

export async function POST(request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Pas encore configuré — on le dit clairement au lieu d'accepter
    // des appels invérifiables.
    return Response.json({ erreur: "RESEND_WEBHOOK_SECRET absent — webhook inactif." }, { status: 503 });
  }
  const corps = await request.text();
  const ok = signatureValide(
    secret,
    request.headers.get("svix-id"),
    request.headers.get("svix-timestamp"),
    corps,
    request.headers.get("svix-signature")
  );
  if (!ok) return Response.json({ erreur: "Signature invalide." }, { status: 401 });

  let evenement;
  try {
    evenement = JSON.parse(corps);
  } catch {
    return Response.json({ erreur: "Corps illisible." }, { status: 400 });
  }
  const libelle = LIBELLES[evenement?.type];
  // Les autres événements (delivered, opened…) ne nous intéressent pas :
  // on répond 200 pour que Resend n'insiste pas.
  if (!libelle) return Response.json({ ignore: true });

  const donnees = evenement?.data || {};
  const destinataires = (Array.isArray(donnees.to) ? donnees.to : [donnees.to]).filter(Boolean).join(", ");
  const sujet = String(donnees.subject || "").slice(0, 120);
  const de = String(donnees.from || "");

  // 🏢 À QUELLE ENTREPRISE appartient ce courriel ? L'expéditeur porte
  // la réponse : l'adresse vérifiée d'une compagnie (étage 2) est
  // unique ; sinon le NOM AFFICHÉ (étage 1 — « Nom » <notifications@…>)
  // se compare aux fiches. En dernier recours : dgl (la plateforme).
  let entrepriseId = "dgl";
  try {
    const admin = clientSupabaseService();
    const { data: entreprises } = await admin
      .from("entreprises")
      .select("id, nom_commercial, nom_legal, courriel_expediteur_verifie")
      .limit(100);
    const adresseDe = (de.match(/<([^>]+)>/)?.[1] || de).toLowerCase().trim();
    const nomDe = (de.match(/^"?([^"<]+?)"?\s*</)?.[1] || "").toLowerCase().trim();
    const trouvee =
      (entreprises || []).find((e) => (e.courriel_expediteur_verifie || "").toLowerCase() === adresseDe) ||
      (entreprises || []).find(
        (e) => nomDe && [e.nom_commercial, e.nom_legal].some((n) => (n || "").toLowerCase().trim() === nomDe)
      );
    if (trouvee) entrepriseId = trouvee.id;

    const maintenant = new Date();
    await admin.from("journal_activite").insert({
      texte: `📮 Le courriel à ${destinataires || "?"} ${libelle}${sujet ? ` — « ${sujet} »` : ""}. Vérifie l'adresse du client et renvoie le document au besoin.`,
      par_nom: "suivi de livraison",
      date_locale: `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`,
      heure_locale: `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`,
      entreprise_id: entrepriseId,
    });
  } catch {
    // Le journal est un bonus — un échec ici ne fait jamais échouer le
    // webhook (Resend réessaierait en boucle pour rien).
  }
  return Response.json({ note: true });
}
