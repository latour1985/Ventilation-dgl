// app/api/contact-entreprise/route.js
//
// 📞 MESSAGE D'UN CLIENT DEPUIS UNE PAGE PUBLIQUE (2026-09-10, suite du
// bouton « Contacter l'entreprise ») : le lien mailto: ouvrait le
// sélecteur d'applications de Windows — laid et bloquant pour un client
// qui lit son devis dans Gmail. Ici, le client écrit son message SUR la
// page ; Fluxya l'envoie par courriel à l'entreprise, et le bouton
// « Répondre » de l'entreprise répond directement au client.
//
// ------------------------------------------------------------
// SÉCURITÉ — pas de session, mais pas un relais ouvert non plus :
// ------------------------------------------------------------
// 1. Le JETON du document fait office de clé : seul le client qui a
//    reçu le courriel le possède. Jeton inconnu = refus, rien ne part.
// 2. Le destinataire n'est JAMAIS dans la demande : c'est le courriel
//    de l'ENTREPRISE du document, lu en base. Impossible de spammer
//    un tiers par cette porte.
// 3. Champ-piège (honeypot) « siteWeb » : un robot qui le remplit est
//    éconduit avec un faux succès.
// 4. Petit frein par jeton (mémoire d'instance) : 5 messages/heure.
// 5. Message plafonné et ÉCHAPPÉ — il voyage comme du texte, jamais
//    comme du HTML actif.

import { clientSupabaseService } from "@/lib/quickbooksServeur";

const courrielValide = (a) => typeof a === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.trim());
const echapperHtml = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Frein simple par jeton — mémoire de l'instance serverless : suffisant
// pour décourager la boucle, sans table ni snippet.
const derniersEnvois = new Map();
function tropFrequent(jeton) {
  const maintenant = Date.now();
  const liste = (derniersEnvois.get(jeton) || []).filter((t) => maintenant - t < 60 * 60 * 1000);
  if (liste.length >= 5) return true;
  liste.push(maintenant);
  derniersEnvois.set(jeton, liste);
  return false;
}

// Retrouve le document par son jeton — le TYPE dit dans quelle table
// regarder. Retourne { entrepriseId, etiquette } ou null.
async function documentDuJeton(admin, type, jeton) {
  if (type === "devis") {
    const { data } = await admin
      .from("devis_app")
      .select("entreprise_id, numero, client_nom")
      .eq("jeton_public", jeton)
      .maybeSingle();
    return data ? { entrepriseId: data.entreprise_id, etiquette: `devis ${data.numero} (${data.client_nom || "client"})` } : null;
  }
  if (type === "bon") {
    const { data } = await admin
      .from("bons_travail")
      .select("entreprise_id, titre, client_nom, date_travail")
      .eq("jeton_public", jeton)
      .limit(1)
      .maybeSingle();
    return data
      ? { entrepriseId: data.entreprise_id, etiquette: `bon de travail « ${data.titre || "travaux"} » du ${data.date_travail || "?"} (${data.client_nom || "client"})` }
      : null;
  }
  if (type === "facture") {
    const { data } = await admin
      .from("factures_maison")
      .select("entreprise_id, numero, client_nom")
      .eq("jeton_public", jeton)
      .maybeSingle();
    return data ? { entrepriseId: data.entreprise_id, etiquette: `facture ${data.numero} (${data.client_nom || "client"})` } : null;
  }
  return null;
}

export async function POST(request) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  // Honeypot : un humain ne voit pas ce champ — un robot le remplit.
  if (String(corps?.siteWeb || "").trim() !== "") {
    return Response.json({ envoye: true });
  }
  const type = ["devis", "bon", "facture"].includes(corps?.type) ? corps.type : null;
  const jeton = String(corps?.jeton || "").trim();
  const message = String(corps?.message || "").trim().slice(0, 2000);
  const repondreA = String(corps?.repondreA || "").trim();
  const nomClient = String(corps?.nom || "").trim().slice(0, 120);
  if (!type || jeton.length < 16 || message.length < 5) {
    return Response.json({ erreur: "Message trop court ou demande incomplète." }, { status: 400 });
  }
  if (tropFrequent(jeton)) {
    return Response.json({ erreur: "Trop de messages d'un coup — attends un peu puis réessaie." }, { status: 429 });
  }

  const admin = clientSupabaseService();
  let doc;
  try {
    doc = await documentDuJeton(admin, type, jeton);
  } catch {
    return Response.json({ erreur: "Service indisponible — réessaie." }, { status: 502 });
  }
  if (!doc) return Response.json({ erreur: "Lien invalide ou expiré." }, { status: 404 });

  // L'ENTREPRISE DU DOCUMENT — destinataire ET signature, lus en base.
  let ent = null;
  try {
    const { data } = await admin
      .from("entreprises")
      .select("nom_commercial, nom_legal, courriel_facturation, courriel")
      .eq("id", doc.entrepriseId)
      .maybeSingle();
    ent = data || null;
  } catch {
    ent = null;
  }
  const destinataire = ent?.courriel_facturation || ent?.courriel || "";
  if (!courrielValide(destinataire)) {
    return Response.json({ erreur: "Cette entreprise n'a pas de courriel configuré — utilisez le téléphone." }, { status: 400 });
  }
  const nomEntreprise = ent?.nom_commercial || ent?.nom_legal || "votre entreprise";

  const cle = process.env.RESEND_API_KEY;
  if (!cle) return Response.json({ envoye: true, simule: true });

  const adresseExpedition =
    process.env.COURRIEL_ADRESSE_EXPEDITION ||
    (process.env.COURRIEL_EXPEDITEUR || "").match(/<([^>]+)>/)?.[1] ||
    "notifications@fluxya.ca";
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;max-width:560px">
      <p style="font-size:16px;font-weight:bold;margin:0 0 4px">💬 Message d'un client depuis Fluxya</p>
      <p style="margin:0 0 12px;color:#64748b">À propos du ${echapperHtml(doc.etiquette)}.</p>
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;white-space:pre-wrap">${echapperHtml(message)}</div>
      <p style="margin:12px 0 0">${nomClient ? `— ${echapperHtml(nomClient)}` : ""}${courrielValide(repondreA) ? `<br>Répondre à : <a href="mailto:${echapperHtml(repondreA)}">${echapperHtml(repondreA)}</a> (le bouton Répondre fonctionne directement)` : "<br>⚠️ Le client n'a pas laissé de courriel — voir le dossier pour le joindre."}</p>
    </div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        from: `"Fluxya — message client" <${adresseExpedition}>`,
        to: [destinataire],
        subject: `💬 Question d'un client — ${doc.etiquette}`.slice(0, 200),
        html,
        ...(courrielValide(repondreA) ? { reply_to: repondreA.trim() } : {}),
      }),
    });
    if (!r.ok) {
      return Response.json({ erreur: "L'envoi a été refusé — réessaie ou utilisez le téléphone." }, { status: 502 });
    }
    return Response.json({ envoye: true, entreprise: nomEntreprise });
  } catch {
    return Response.json({ erreur: "Service d'envoi injoignable — réessaie." }, { status: 502 });
  }
}
