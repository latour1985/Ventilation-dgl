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

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

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

// GABARIT DU COURRIEL — aux couleurs FLUXYA (marque produit, rebranding
// 2026-08-18) ; l'employeur (Ventilation DGL inc.) reste nommé dans le
// texte. Contient la marche à suivre d'INSTALLATION Android/iPhone en 3
// étapes : constat terrain du 2026-08-18, une astuce d'une ligne ne
// suffit pas à un technicien peu à l'aise avec son téléphone.
function gabaritInvitation({ nom, lien, nouveau, urlApp }) {
  const hoteAffiche = String(urlApp || "").replace(/^https?:\/\//, "");
  const etapeInstallation = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#f0fdfa;border-radius:10px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 8px;color:#134e4a;font-size:13px;font-weight:bold;">2️⃣ Installe l'application sur ton téléphone</p>
            <p style="margin:0 0 8px;color:#334155;font-size:13px;line-height:1.6;">
              Ouvre cette adresse dans le navigateur de ton téléphone :<br/>
              📱 <a href="${urlApp}" style="color:#0d9488;font-weight:bold;">${hoteAffiche}</a>
            </p>
            <p style="margin:0 0 6px;color:#334155;font-size:12px;line-height:1.6;">
              <strong>Sur Android (Chrome)</strong> : touche les 3 petits points ⋮ en haut à droite,
              puis « Ajouter à l'écran d'accueil » (ou « Installer l'application »).
            </p>
            <p style="margin:0;color:#334155;font-size:12px;line-height:1.6;">
              <strong>Sur iPhone (Safari)</strong> : touche le bouton Partager
              (le carré avec la flèche vers le haut), puis « Sur l'écran d'accueil ».
            </p>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;color:#334155;font-size:13px;line-height:1.6;">
          3️⃣ Ouvre l'application <strong>Fluxya</strong> depuis ton écran d'accueil et
          connecte-toi avec ton courriel et ton mot de passe. C'est tout!
        </p>`;
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#134e4a;padding:18px 24px;">
        <span style="color:#ffffff;font-size:20px;font-weight:bold;">Fluxya</span>
        <span style="color:#99f6e4;font-size:12px;"> · l'application de Ventilation DGL inc.</span>
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${nom ? ` ${nom}` : ""},</p>
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
          ${nouveau
            ? "Ton accès à Fluxya, l'application de gestion de Ventilation DGL inc., est prêt. Voici les 3 étapes pour commencer :"
            : "Voici ton lien pour réinitialiser ton mot de passe de l'application Fluxya (Ventilation DGL inc.) :"}
        </p>
        <p style="margin:0 0 8px;color:#134e4a;font-size:13px;font-weight:bold;">${nouveau ? "1️⃣ Choisis ton mot de passe" : ""}</p>
        <p style="margin:0 0 16px;text-align:center;">
          <a href="${lien}" style="display:inline-block;background:#134e4a;color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
            Choisir mon mot de passe
          </a>
        </p>
        ${etapeInstallation}
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
  //
  // ANTI-CONSOMMATION AUTOMATIQUE (2026-08-10) : on n'envoie PAS le lien
  // « action_link » de Supabase (qui grille le jeton à usage unique dès
  // qu'un robot d'aperçu — RCS, Gmail, antivirus — le visite, avant même
  // le clic humain → « lien plus valide » à la 1re ouverture). On envoie
  // plutôt un lien vers NOTRE page, portant le jeton HACHÉ ; le jeton
  // n'est vérifié qu'au clic volontaire sur le bouton (verifyOtp). Les
  // robots d'aperçu chargent la page sans rien consommer.
  const origine = new URL(request.url).origin;
  let jetonHache = null;
  let idCompteInvite = null;
  let typeLien = "invite";
  let nouveau = true;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: courriel,
      options: {
        redirectTo: `${origine}/choisir-mot-de-passe`,
        data: { nom, role: roleNouveau, ...(sousCategorie ? { sous_categorie: sousCategorie } : {}) },
      },
    });
    if (error) throw error;
    jetonHache = data?.properties?.hashed_token || null;
    idCompteInvite = data?.user?.id || null;
  } catch (e) {
    const deja = /already|exist|registered/i.test(String(e?.message || ""));
    if (!deja) {
      return Response.json({ erreur: `Création du compte refusée : ${e?.message || "erreur inconnue"}` }, { status: 502 });
    }
    nouveau = false;
    typeLien = "recovery";
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: courriel,
      options: { redirectTo: `${origine}/choisir-mot-de-passe` },
    });
    if (error) {
      return Response.json({ erreur: `Lien de réinitialisation refusé : ${error.message}` }, { status: 502 });
    }
    jetonHache = data?.properties?.hashed_token || null;
    idCompteInvite = data?.user?.id || null;
  }
  // 🔐 GRAND SOIR (2026-09-04) : le nouveau compte HERITE de
  // l'entreprise de son INVITEUR (app_metadata, scellee serveur) —
  // sans cette etiquette, les cloisons RLS ne lui montreraient rien.
  //
  // 🚧 COLMATAGE (2026-09-06) : un compte EXISTANT qui appartient deja
  // a une AUTRE entreprise ne se fait JAMAIS re-etiqueter — l'ancienne
  // version arrachait le compte a sa bulle (inviter le courriel d'un
  // admin d'une autre compagnie l'aurait VOLE, lui et son acces).
  // Meme refus pour un courriel d'operateur de la console (acces
  // separes). La re-invitation d'un compte de SA propre entreprise,
  // elle, passe toujours (mot de passe oublie / relance).
  if (idCompteInvite) {
    const entrepriseInviteur = entrepriseDuCompte(utilisateur);
    try {
      const { data: fiche } = await admin.auth.admin.getUserById(idCompteInvite);
      const meta = fiche?.user?.app_metadata || {};
      if (!nouveau && meta.entreprise_id && meta.entreprise_id !== entrepriseInviteur) {
        return Response.json(
          { erreur: "Ce courriel appartient déjà à un compte d'une AUTRE entreprise — impossible de l'inviter ici. Chaque personne garde sa bulle : utilise un courriel différent." },
          { status: 400 }
        );
      }
      if (!nouveau && meta.plateforme === true && !meta.entreprise_id) {
        return Response.json(
          { erreur: "Ce courriel est un opérateur de la console Fluxya — les accès sont séparés : utilise un courriel dédié à l'entreprise." },
          { status: 400 }
        );
      }
      await admin.auth.admin.updateUserById(idCompteInvite, {
        app_metadata: { ...meta, entreprise_id: entrepriseInviteur },
      });
    } catch {
      // etiquette non posee — l'invitation part quand meme, un passage
      // du snippet d'etiquetage rattrapera le compte
    }
  }
  if (!jetonHache) {
    return Response.json({ erreur: "Le lien n'a pas pu être fabriqué — réessaie." }, { status: 502 });
  }
  const lien = `${origine}/choisir-mot-de-passe?jeton=${encodeURIComponent(jetonHache)}&type=${typeLien}`;

  // 4. Envoyer l'invitation — Resend en prod, lien remis à l'admin en
  //    mode simulé (local).
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return Response.json({ simule: true, nouveau, lien });
  }
  // 📧 AU NOM DE L'ENTREPRISE (niveau 1, 2026-08-19) : le nouvel employé
  // reçoit l'invitation au nom de SON entreprise — même mécanique que la
  // porte d'envoi générale (/api/courriel).
  let nomEntreprise = "";
  let repondreEntreprise = "";
  try {
    const { data: ent } = await clientSupabaseService()
      .from("entreprises")
      .select("nom_commercial, nom_legal, courriel_facturation, courriel")
      .order("created_at")
      .limit(1);
    nomEntreprise = ent?.[0]?.nom_commercial || ent?.[0]?.nom_legal || "";
    repondreEntreprise = ent?.[0]?.courriel_facturation || ent?.[0]?.courriel || "";
  } catch {
    // fiche indisponible — les valeurs de repli s'appliquent
  }
  const adresseExpedition =
    process.env.COURRIEL_ADRESSE_EXPEDITION ||
    (process.env.COURRIEL_EXPEDITEUR || "").match(/<([^>]+)>/)?.[1] ||
    "info@ventilationdgl.com";
  const expediteur = nomEntreprise
    ? `"${nomEntreprise.replace(/"/g, "'")}" <${adresseExpedition}>`
    : process.env.COURRIEL_EXPEDITEUR || `Ventilation DGL inc. <${adresseExpedition}>`;
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        from: expediteur,
        to: [courriel],
        subject: nouveau
          ? `Ton accès à l'application Fluxya${nomEntreprise ? ` (${nomEntreprise})` : ""} — choisis ton mot de passe`
          : `Réinitialisation de ton mot de passe — Fluxya${nomEntreprise ? ` (${nomEntreprise})` : ""}`,
        html: gabaritInvitation({ nom, lien, nouveau, urlApp: `${origine}/technicien` }),
        reply_to: repondreEntreprise || process.env.COURRIEL_REPONSE || "info@ventilationdgl.com",
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
