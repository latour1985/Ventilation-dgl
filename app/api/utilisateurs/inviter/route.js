// app/api/utilisateurs/inviter/route.js
//
// CRÉATION DU COMPTE DE CONNEXION D'UN EMPLOYÉ + INVITATION.
//
// C'est la pièce qui manquait depuis le début (le commentaire de
// lib/supabase/utilisateurs.js la prévoyait) : jusqu'ici, « Créer
// l'utilisateur » ne créait que la FICHE, et le « lien de connexion
// envoyé » était fictif. Cette route fait le vrai travail :
//   1. vérifie que l'appelant est un ADMIN connecté (jamais sur parole :
//      le rôle est lu côté serveur, pas reçu du navigateur) ;
//   2. crée le compte Supabase Auth de l'employé et fabrique son lien
//      « choisis ton mot de passe » (ou un lien de réinitialisation si
//      le compte existe déjà — même bouton pour inviter et réinviter) ;
//   3. envoie l'invitation par Resend, aux couleurs de l'entreprise.
//
// MODE SIMULÉ (local sans clé Resend) : le compte est créé quand même,
// et le lien est RETOURNÉ à l'admin pour qu'il le transmette lui-même.
// L'admin peut de toute façon réinitialiser n'importe quel mot de passe,
// lui remettre ce lien ne lui donne rien qu'il n'a pas déjà.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

const ROLES_ADMINS = ["Admin principal", "Admin régulier"];
const ROLES_VALIDES = ["Admin principal", "Admin régulier", "Administration bureau", "Technicien"];

function courrielValide(adresse) {
  return typeof adresse === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse.trim());
}

// Le rôle de l'appelant, résolu EXACTEMENT comme l'application le fait
// (lib/permissions.js) : un rôle CONNU est respecté, tout le reste —
// absent, vide, ou une vieille étiquette abîmée (« ChargÃ© de projet »
// avec espace parasite, vécu le 2026-08-10) — retombe sur « Admin
// principal », la règle du propriétaire. Être PLUS sévère que
// l'application ici avait bloqué le propriétaire lui-même.
const ROLES_CONNUS = ["Admin principal", "Admin régulier", "Administration bureau", "Technicien", "Chargé de projet", "Répartiteur"];
async function roleAppelant(admin, utilisateur) {
  let brut = null;
  try {
    const { data } = await admin
      .from("permissions_utilisateurs")
      .select("role")
      .eq("email", (utilisateur.email || "").toLowerCase())
      .maybeSingle();
    brut = data?.role || null;
  } catch {
    // table injoignable — on retombe sur les métadonnées
  }
  if (!brut) brut = utilisateur.user_metadata?.role || null;
  const propre = String(brut || "").trim();
  return ROLES_CONNUS.includes(propre) ? propre : "Admin principal";
}

function gabaritInvitation({ nom, lien, nouveau }) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#131B2E;padding:18px 24px;">
        <span style="color:#ffffff;font-size:18px;font-weight:bold;">Ventilation DGL inc.</span>
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${nom ? ` ${nom}` : ""},</p>
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
          ${nouveau
            ? "Ton accès à l'application de gestion de Ventilation DGL est prêt. Clique le bouton ci-dessous pour choisir ton mot de passe :"
            : "Voici ton lien pour réinitialiser ton mot de passe de l'application Ventilation DGL :"}
        </p>
        <p style="margin:0 0 16px;text-align:center;">
          <a href="${lien}" style="display:inline-block;background:#131B2E;color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
            Choisir mon mot de passe
          </a>
        </p>
        <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:1.6;">
          Ensuite, connecte-toi en tout temps avec ton courriel et ce mot de passe, à cette adresse :<br/>
          📱 <a href="https://ventilation-dgl.vercel.app/technicien" style="color:#131B2E;font-weight:bold;">ventilation-dgl.vercel.app/technicien</a><br/>
          <span style="color:#64748b;font-size:12px;">Astuce : ouvre cette adresse sur ton téléphone et ajoute-la à ton écran d'accueil — elle se comportera comme une application.</span>
        </p>
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
          Le lien du bouton est personnel et expire — s'il ne fonctionne plus, demande une nouvelle
          invitation à l'administration.
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export async function POST(request) {
  // 1. Qui demande ? Un utilisateur connecté…
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) {
    return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ simule: true, erreur: "Clé service absente — crée le compte dans le tableau de bord Supabase." });
  }
  const admin = clientSupabaseService();

  // …et un ADMIN. Le répartiteur et les techniciens n'invitent personne.
  const role = await roleAppelant(admin, utilisateur);
  if (!ROLES_ADMINS.includes(role)) {
    return Response.json({ erreur: "Création de comptes réservée aux administrateurs." }, { status: 403 });
  }

  // 2. La demande est-elle bien formée ?
  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const courriel = String(corps?.courriel || "").trim().toLowerCase();
  const nom = String(corps?.nom || "").trim().slice(0, 120);
  const roleNouveau = ROLES_VALIDES.includes(corps?.role) ? corps.role : "Technicien";
  const sousCategorie = String(corps?.sousCategorie || "").trim() || null;
  if (!courrielValide(courriel)) {
    return Response.json({ erreur: "Courriel invalide." }, { status: 400 });
  }
  // Personne ne peut créer un rôle plus fort que le sien : un Admin
  // régulier ne fabrique pas d'Admin principal.
  if (roleNouveau === "Admin principal" && role !== "Admin principal") {
    return Response.json({ erreur: "Seul l'Admin principal peut créer un autre Admin principal." }, { status: 403 });
  }

  // 3. Fabriquer le lien : invitation (nouveau compte, créé du même
  //    coup avec son rôle en métadonnées) — ou réinitialisation si le
  //    compte existe déjà (réinvitation / mot de passe oublié).
  const origine = new URL(request.url).origin;
  const redirection = `${origine}/choisir-mot-de-passe`;
  let lien = null;
  let nouveau = true;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: courriel,
      options: {
        redirectTo: redirection,
        data: { nom, role: roleNouveau, ...(sousCategorie ? { sous_categorie: sousCategorie } : {}) },
      },
    });
    if (error) throw error;
    lien = data?.properties?.action_link || null;
  } catch (e) {
    const deja = /already|exist|registered/i.test(String(e?.message || ""));
    if (!deja) {
      return Response.json({ erreur: `Création du compte refusée : ${e?.message || "erreur inconnue"}` }, { status: 502 });
    }
    nouveau = false;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: courriel,
      options: { redirectTo: redirection },
    });
    if (error) {
      return Response.json({ erreur: `Lien de réinitialisation refusé : ${error.message}` }, { status: 502 });
    }
    lien = data?.properties?.action_link || null;
  }
  if (!lien) {
    return Response.json({ erreur: "Le lien n'a pas pu être fabriqué — réessaie." }, { status: 502 });
  }

  // 4. Envoyer l'invitation — Resend en prod, lien remis à l'admin en
  //    mode simulé (local).
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return Response.json({ simule: true, nouveau, lien });
  }
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        from: process.env.COURRIEL_EXPEDITEUR || "Ventilation DGL inc. <info@ventilationdgl.com>",
        to: [courriel],
        subject: nouveau
          ? "Ton accès à l'application Ventilation DGL — choisis ton mot de passe"
          : "Réinitialisation de ton mot de passe — Ventilation DGL",
        html: gabaritInvitation({ nom, lien, nouveau }),
        reply_to: process.env.COURRIEL_REPONSE || "info@ventilationdgl.com",
      }),
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      // Compte créé mais courriel refusé : on remet le lien à l'admin
      // plutôt que de laisser l'employé dans les limbes.
      return Response.json({ envoye: false, nouveau, lien, erreur: resultat?.message || `Envoi refusé (code ${reponse.status}).` });
    }
    return Response.json({ envoye: true, nouveau });
  } catch {
    return Response.json({ envoye: false, nouveau, lien, erreur: "Service d'envoi injoignable." });
  }
}
