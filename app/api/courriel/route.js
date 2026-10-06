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

import { clientSupabaseService, roleServeur } from "@/lib/quickbooksServeur";

const MAX_DESTINATAIRES = 10;
// 🛡️ (audit 2026-10-05) Le TECHNICIEN n'envoie que les courriels de
// l'app terrain (« en route », bon de travail) : quelques destinataires,
// ni copie ni pièce jointe. Et chaque compte a un plafond à l'heure —
// la porte ne peut plus servir à arroser Internet au nom de l'entreprise.
const MAX_DESTINATAIRES_TECHNICIEN = 5;
const PLAFOND_HEURE_TECHNICIEN = 20;
const PLAFOND_HEURE_BUREAU = 300;

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

  // 🛡️ (audit 2026-10-05) Un compte SANS entreprise n'envoie rien.
  if (!utilisateur.app_metadata?.entreprise_id) {
    return Response.json({ erreur: "Compte sans entreprise — envoi refusé." }, { status: 403 });
  }
  const estTechnicien = (await roleServeur(utilisateur)) === "Technicien";

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
    .slice(0, estTechnicien ? MAX_DESTINATAIRES_TECHNICIEN : MAX_DESTINATAIRES);
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
  const copieExpediteur = !estTechnicien && corps?.copieExpediteur === true && courrielValide(utilisateur.email);
  // 📧 COPIES SUPPLÉMENTAIRES (2026-09-03, bons de commande) : adresses
  // choisies par l'admin à l'envoi (ex. commande@...) — même niveau de
  // confiance que les destinataires eux-mêmes (l'admin connecté choisit
  // déjà librement « à qui »). Validées et plafonnées comme eux.
  const copiesSupplementaires = (!estTechnicien && Array.isArray(corps?.copieA) ? corps.copieA : [])
    .filter(courrielValide)
    .map((a) => a.trim())
    .slice(0, 3);

  // 3. Service configuré ? Sinon : mode simulé, honnête et sans échec.
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return Response.json({ simule: true });
  }

  // 4. Envoi réel via Resend. L'ADRESSE d'expédition DOIT appartenir au
  //    domaine vérifié chez Resend, sinon Resend refuse.
  //
  // 📧 AU NOM DE L'ENTREPRISE (décision du propriétaire, 2026-08-19 —
  // « niveau 1 », le modèle QuickBooks/Intuit) : le NOM AFFICHÉ dans la
  // boîte de réception est celui de L'ENTREPRISE utilisatrice (lu en
  // base, jamais du corps de la demande), l'adresse technique reste
  // celle du domaine vérifié (variable COURRIEL_ADRESSE_EXPEDITION —
  // passera à notifications@fluxya.ca quand son DNS sera vérifié), et
  // les RÉPONSES vont à l'adresse choisie par l'entreprise.
  // 🏢 L'ENTREPRISE DU DEMANDEUR — et aucune autre (2026-09-03, vécu :
  // le « .limit(1) » prenait la PREMIÈRE compagnie de la table, et les
  // courriels de Miroir partaient signés « Ventilation DGL inc. »).
  // Même règle que les routes QuickBooks : l'entreprise vient du JETON.
  const entrepriseId = String(utilisateur.app_metadata?.entreprise_id || "__aucune__"); // plus de repli DGL (revue 2026-09-22)
  let nomEntreprise = "";
  let repondreEntreprise = "";
  let expediteurVerifie = "";
  try {
    const { data: ent } = await clientSupabaseService()
      .from("entreprises")
      .select("nom_commercial, nom_legal, courriel_facturation, courriel, courriel_expediteur_verifie")
      .eq("id", entrepriseId)
      .maybeSingle();
    nomEntreprise = ent?.nom_commercial || ent?.nom_legal || "";
    repondreEntreprise = ent?.courriel_facturation || ent?.courriel || "";
    // 🥇 ÉTAGE 2 (par compagnie, plus tard) : une entreprise dont le
    // domaine est vérifié chez Resend envoie de SA vraie adresse —
    // consignée en base par NOUS (jamais saisie librement : Resend
    // refuserait, et on ne laisse personne se faire passer pour un
    // domaine qu'il ne contrôle pas).
    expediteurVerifie = ent?.courriel_expediteur_verifie || "";
  } catch {
    // fiche indisponible (ou colonne du snippet 122 pas encore passée)
    // — repli : relire sans la colonne pour garder le nom et la réponse.
    try {
      const { data: ent } = await clientSupabaseService()
        .from("entreprises")
        .select("nom_commercial, nom_legal, courriel_facturation, courriel")
        .eq("id", entrepriseId)
        .maybeSingle();
      nomEntreprise = ent?.nom_commercial || ent?.nom_legal || "";
      repondreEntreprise = ent?.courriel_facturation || ent?.courriel || "";
    } catch {
      // vraiment indisponible — les valeurs de repli s'appliquent
    }
  }
  // 🌐 ÉTAGE 1 (toutes les compagnies) : « Nom de la compagnie »
  // <notifications@fluxya.ca> — le nom affiché est le sien, le domaine
  // est celui de la plateforme (vérifié chez Resend), et les réponses
  // vont à SA boîte. Une adresse vérifiée par compagnie (étage 2)
  // l'emporte quand elle existe.
  const adresseExpedition =
    expediteurVerifie ||
    process.env.COURRIEL_ADRESSE_EXPEDITION ||
    (process.env.COURRIEL_EXPEDITEUR || "").match(/<([^>]+)>/)?.[1] ||
    "notifications@fluxya.ca";
  // Guillemets autour du nom : certains noms d'entreprise contiennent
  // une virgule ou un point — sans guillemets, l'en-tête serait invalide.
  const expediteur = nomEntreprise
    ? `"${nomEntreprise.replace(/"/g, "'")}" <${adresseExpedition}>`
    : process.env.COURRIEL_EXPEDITEUR || `Fluxya <${adresseExpedition}>`;
  const adresseReponse = repondreEntreprise || process.env.COURRIEL_REPONSE || adresseExpedition;
  // 📎 PIÈCES JOINTES (2026-09-15) : [{ nom, url }] → Resend les récupère
  // par l'URL. SEULEMENT des fichiers de NOTRE stockage (même hôte que
  // Supabase) — la route ne sert jamais à relayer un fichier étranger.
  // Au plus 5 ; nom nettoyé (pas de chemin, 120 caractères).
  const hoteStockage = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host; } catch { return ""; } })();
  const piecesJointes = (!estTechnicien && Array.isArray(corps?.piecesJointes) ? corps.piecesJointes : [])
    .filter((p) => p && typeof p.url === "string")
    .filter((p) => { try { return hoteStockage && new URL(p.url).host === hoteStockage; } catch { return false; } })
    .slice(0, 5)
    .map((p) => ({ filename: String(p.nom || "fichier").replace(/[\\/]/g, "_").slice(0, 120), path: p.url }));
  // 🛡️ PLAFOND À L'HEURE, par compte (snippet 165 : table envois_courriel).
  // Table absente (snippet pas encore passé) : pas de plafond, comme avant.
  const compte = String(utilisateur.email || "").toLowerCase();
  const service = clientSupabaseService();
  try {
    const depuis = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await service
      .from("envois_courriel")
      .select("id", { count: "exact", head: true })
      .eq("courriel", compte)
      .gte("envoye_le", depuis);
    if (!error && (count || 0) >= (estTechnicien ? PLAFOND_HEURE_TECHNICIEN : PLAFOND_HEURE_BUREAU)) {
      return Response.json({ erreur: "Trop de courriels envoyés dans la dernière heure — réessaie plus tard." }, { status: 429 });
    }
  } catch {
    // compteur injoignable — on n'empêche pas l'envoi
  }
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        from: expediteur,
        to: destinataires,
        subject: sujet,
        html,
        ...(piecesJointes.length > 0 ? { attachments: piecesJointes } : {}),
        ...((copieExpediteur || copiesSupplementaires.length > 0)
          ? {
              cc: [
                ...(copieExpediteur ? [utilisateur.email] : []),
                // Sans doublon : l'expéditeur déjà en copie ne l'est pas deux fois.
                ...copiesSupplementaires.filter((c) => c.toLowerCase() !== String(utilisateur.email || "").toLowerCase()),
              ],
            }
          : {}),
        // Les réponses reviennent dans une vraie boîte, pas dans un trou
        // noir : celle de l'expéditeur (bons de commande — c'est lui qui
        // ajuste la date), avec la boîte générale en filet de sécurité.
        reply_to: copieExpediteur ? [utilisateur.email, adresseReponse] : adresseReponse,
      }),
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      return Response.json(
        { erreur: resultat?.message || `Le service d'envoi a refusé (code ${reponse.status}).` },
        { status: 502 }
      );
    }
    // Compté APRÈS l'envoi réussi ; le ménage garde 2 jours d'historique.
    try {
      await service.from("envois_courriel").insert({ entreprise_id: entrepriseId, courriel: compte, nb_destinataires: destinataires.length });
      await service.from("envois_courriel").delete().eq("courriel", compte).lt("envoye_le", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
    } catch {
      // compteur indisponible — sans conséquence pour l'envoi déjà parti
    }
    return Response.json({ envoye: true, id: resultat?.id || null });
  } catch {
    return Response.json({ erreur: "Service d'envoi injoignable — réessaie." }, { status: 502 });
  }
}
