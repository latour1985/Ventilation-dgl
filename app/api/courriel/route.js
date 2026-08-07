// app/api/courriel/route.js
//
// PORTE D'ENVOI DES COURRIELS — la seule du système.
//
// Pourquoi une route serveur : la clé API de Resend ne doit JAMAIS
// voyager jusqu'au navigateur. Une clé exposée côté client, c'est
// n'importe qui sur Internet qui envoie des courriels au nom de
// ventilationdgl.com. Ici, la clé vit dans les variables d'environnement
// du serveur (Vercel), invisible du public.
//
// ------------------------------------------------------------
// VERROU ANTI-RELAIS
// ------------------------------------------------------------
// Sans vérification, cette route serait un « relais ouvert » : un
// spammeur pourrait y POSTer et expédier ce qu'il veut avec notre
// domaine. Chaque appel doit donc porter le jeton de session Supabase
// d'un utilisateur CONNECTÉ de l'application — on le valide auprès de
// Supabase avant d'envoyer quoi que ce soit.
//
// ------------------------------------------------------------
// MODE SIMULÉ
// ------------------------------------------------------------
// Tant que RESEND_API_KEY n'est pas configurée, la route répond
// { simule: true } au lieu d'échouer : l'interface fonctionne, le
// journal explique quoi faire, et RIEN ne part. Le jour où la clé est
// posée dans Vercel, tout se met à envoyer pour vrai — aucun autre
// changement.

const MAX_DESTINATAIRES = 10;

function courrielValide(adresse) {
  return typeof adresse === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse.trim());
}

// Valide le jeton de session auprès de Supabase. Retourne l'utilisateur
// (ou null) — jamais d'exception : un jeton invalide = un refus poli.
async function utilisateurDepuisJeton(jeton) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !cleAnon || !jeton) return null;
  try {
    const reponse = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: cleAnon, Authorization: `Bearer ${jeton}` },
      cache: "no-store",
    });
    if (!reponse.ok) return null;
    const u = await reponse.json();
    return u?.email ? u : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  // 1. Qui demande ? Un utilisateur connecté de l'application, ou dehors.
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) {
    return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  }

  // 2. La demande est-elle bien formée ?
  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const destinataires = (Array.isArray(corps?.a) ? corps.a : [corps?.a])
    .filter(courrielValide)
    .map((a) => a.trim())
    .slice(0, MAX_DESTINATAIRES);
  const sujet = String(corps?.sujet || "").trim().slice(0, 200);
  const html = String(corps?.html || "");
  if (destinataires.length === 0 || !sujet || !html) {
    return Response.json({ erreur: "Destinataire, sujet et contenu sont requis." }, { status: 400 });
  }
  // COPIE À L'EXPÉDITEUR (bons de commande) : celui qui commande reçoit
  // le courriel en copie, et la réponse du fournisseur lui revient
  // DIRECTEMENT — c'est lui qui corrigera la date dans l'application.
  // L'adresse vient du jeton de session validé, jamais du corps de la
  // demande : impossible de mettre en copie une adresse arbitraire.
  const copieExpediteur = corps?.copieExpediteur === true && courrielValide(utilisateur.email);

  // 3. Service configuré ? Sinon : mode simulé, honnête et sans échec.
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return Response.json({ simule: true });
  }

  // 4. Envoi réel via Resend. L'expéditeur DOIT appartenir au domaine
  //    vérifié chez Resend, sinon Resend refuse.
  const expediteur = process.env.COURRIEL_EXPEDITEUR || "Ventilation DGL inc. <info@ventilationdgl.com>";
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        from: expediteur,
        to: destinataires,
        subject: sujet,
        html,
        ...(copieExpediteur ? { cc: [utilisateur.email] } : {}),
        // Les réponses reviennent dans une vraie boîte, pas dans un trou
        // noir : celle de l'expéditeur (bons de commande — c'est lui qui
        // ajuste la date), avec la boîte générale en filet de sécurité.
        reply_to: copieExpediteur
          ? [utilisateur.email, process.env.COURRIEL_REPONSE || "info@ventilationdgl.com"]
          : process.env.COURRIEL_REPONSE || "info@ventilationdgl.com",
      }),
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      return Response.json(
        { erreur: resultat?.message || `Le service d'envoi a refusé (code ${reponse.status}).` },
        { status: 502 }
      );
    }
    return Response.json({ envoye: true, id: resultat?.id || null });
  } catch {
    return Response.json({ erreur: "Service d'envoi injoignable — réessaie." }, { status: 502 });
  }
}
