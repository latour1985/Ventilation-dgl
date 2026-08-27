// app/api/plateforme/operateurs/route.js
//
// 👥 ÉQUIPE FLUXYA — les comptes qui portent le sceau plateforme.
//
// Hiérarchie validée par le propriétaire (2026-09-02) :
//   🔑 cle-principale (MAXIMUM 3 — lui + associés éventuels) : tout,
//      seuls à gérer l'équipe, le verrou, les exports, les pauses ;
//   🛠️ admin-regulier : abonnements + retours + incidents ;
//   📋 gestionnaire   : retours + incidents, abonnements en lecture ;
//   🎧 technicien     : retours seulement.
//
// Le niveau vit dans app_metadata (scellé serveur, comme le sceau du
// snippet 51) — le navigateur ne peut PAS se le donner. Un sceau sans
// niveau est traité comme cle-principale (compatibilité : le compte du
// propriétaire existait avant les niveaux).
//
// GET  → liste des opérateurs (clé principale seulement)
// POST → { action: "inviter", courriel, nom, niveau }
//        { action: "niveau", id, niveau }
//        { action: "revoquer", id }
// Garde-fous : jamais se révoquer soi-même ; jamais plus de 3 clés
// principales ; jamais moins d'une clé principale.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

const NIVEAUX = ["cle-principale", "admin-regulier", "gestionnaire", "technicien"];
const MAX_CLES_PRINCIPALES = 3;

function niveauDe(compte) {
  if (compte?.app_metadata?.plateforme !== true) return null;
  const n = compte.app_metadata?.plateforme_role;
  return NIVEAUX.includes(n) ? n : "cle-principale";
}

async function appelantClePrincipale(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return { erreur: Response.json({ erreur: "Connexion requise." }, { status: 401 }) };
  if (niveauDe(utilisateur) !== "cle-principale") {
    return { erreur: Response.json({ erreur: "Réservé aux clés principales." }, { status: 403 }) };
  }
  return { utilisateur };
}

async function listerComptesSceau(admin) {
  const comptes = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    comptes.push(...(data?.users || []));
    if (!data?.users || data.users.length < 200 || page >= 10) break;
    page++;
  }
  return comptes.filter((c) => c.app_metadata?.plateforme === true);
}

export async function GET(request) {
  const acces = await appelantClePrincipale(request);
  if (acces.erreur) return acces.erreur;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });
  try {
    const admin = clientSupabaseService();
    const operateurs = (await listerComptesSceau(admin)).map((c) => ({
      id: c.id,
      courriel: c.email,
      nom: c.user_metadata?.nom || "",
      niveau: niveauDe(c),
      derniereConnexion: c.last_sign_in_at || null,
      creeLe: c.created_at || null,
    }));
    return Response.json({ operateurs });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "Lecture impossible.") }, { status: 502 });
  }
}

export async function POST(request) {
  const acces = await appelantClePrincipale(request);
  if (acces.erreur) return acces.erreur;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const admin = clientSupabaseService();
  const comptes = await listerComptesSceau(admin).catch(() => null);
  if (!comptes) return Response.json({ erreur: "Lecture des comptes impossible." }, { status: 502 });
  const clesPrincipales = comptes.filter((c) => niveauDe(c) === "cle-principale");

  // ---- RÉVOCATION : le sceau tombe, la porte se referme. ----
  if (corps?.action === "revoquer") {
    const cible = comptes.find((c) => c.id === corps.id);
    if (!cible) return Response.json({ erreur: "Compte introuvable ou sans sceau." }, { status: 404 });
    if (cible.id === acces.utilisateur.id) {
      return Response.json({ erreur: "On ne se révoque pas soi-même — demande à une autre clé principale." }, { status: 400 });
    }
    if (niveauDe(cible) === "cle-principale" && clesPrincipales.length <= 1) {
      return Response.json({ erreur: "Impossible : il resterait zéro clé principale." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(cible.id, {
      app_metadata: { ...cible.app_metadata, plateforme: false, plateforme_role: null },
    });
    if (error) return Response.json({ erreur: error.message }, { status: 502 });
    return Response.json({ fait: true });
  }

  // ---- CHANGEMENT DE NIVEAU ----
  if (corps?.action === "niveau") {
    const niveau = NIVEAUX.includes(corps?.niveau) ? corps.niveau : null;
    if (!niveau) return Response.json({ erreur: "Niveau invalide." }, { status: 400 });
    const cible = comptes.find((c) => c.id === corps.id);
    if (!cible) return Response.json({ erreur: "Compte introuvable ou sans sceau." }, { status: 404 });
    if (niveau === "cle-principale" && niveauDe(cible) !== "cle-principale" && clesPrincipales.length >= MAX_CLES_PRINCIPALES) {
      return Response.json({ erreur: `Maximum ${MAX_CLES_PRINCIPALES} clés principales.` }, { status: 400 });
    }
    if (cible.id === acces.utilisateur.id && niveau !== "cle-principale") {
      return Response.json({ erreur: "On ne se rétrograde pas soi-même — demande à une autre clé principale." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(cible.id, {
      app_metadata: { ...cible.app_metadata, plateforme: true, plateforme_role: niveau },
    });
    if (error) return Response.json({ erreur: error.message }, { status: 502 });
    return Response.json({ fait: true });
  }

  // ---- INVITATION ----
  if (corps?.action === "inviter") {
    const courriel = String(corps?.courriel || "").trim().toLowerCase();
    const nom = String(corps?.nom || "").trim().slice(0, 120);
    const niveau = NIVEAUX.includes(corps?.niveau) ? corps.niveau : "technicien";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
      return Response.json({ erreur: "Courriel invalide." }, { status: 400 });
    }
    if (niveau === "cle-principale" && clesPrincipales.length >= MAX_CLES_PRINCIPALES) {
      return Response.json({ erreur: `Maximum ${MAX_CLES_PRINCIPALES} clés principales.` }, { status: 400 });
    }
    // Le lien — même mécanique anti-consommation que les invitations
    // d'employés : lien vers NOTRE page avec le jeton haché, vérifié
    // seulement au clic humain (les robots d'aperçu ne consomment rien).
    const origine = new URL(request.url).origin;
    let jetonHache = null;
    let typeLien = "invite";
    let idCompte = null;
    try {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "invite",
        email: courriel,
        options: { redirectTo: `${origine}/choisir-mot-de-passe`, data: { nom } },
      });
      if (error) throw error;
      jetonHache = data?.properties?.hashed_token || null;
      idCompte = data?.user?.id || null;
    } catch (e) {
      if (!/already|exist|registered/i.test(String(e?.message || ""))) {
        return Response.json({ erreur: `Création du compte refusée : ${e?.message || "erreur"}` }, { status: 502 });
      }
      typeLien = "recovery";
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: courriel,
        options: { redirectTo: `${origine}/choisir-mot-de-passe` },
      });
      if (error) return Response.json({ erreur: `Lien refusé : ${error.message}` }, { status: 502 });
      jetonHache = data?.properties?.hashed_token || null;
      idCompte = data?.user?.id || null;
    }
    if (!idCompte) {
      const existant = comptes.find((c) => (c.email || "").toLowerCase() === courriel);
      idCompte = existant?.id || null;
      if (!idCompte) {
        // Compte hors sceau — le retrouver dans la liste complète.
        let page = 1;
        for (;;) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const t = (data?.users || []).find((c) => (c.email || "").toLowerCase() === courriel);
          if (t) { idCompte = t.id; break; }
          if (!data?.users || data.users.length < 200 || page >= 10) break;
          page++;
        }
      }
    }
    if (!idCompte || !jetonHache) return Response.json({ erreur: "Le compte n'a pas pu être préparé — réessaie." }, { status: 502 });

    // LE SCEAU + LE NIVEAU — posés côté serveur, jamais ailleurs.
    const { data: fiche } = await admin.auth.admin.getUserById(idCompte);
    const { error: erreurSceau } = await admin.auth.admin.updateUserById(idCompte, {
      app_metadata: { ...(fiche?.user?.app_metadata || {}), plateforme: true, plateforme_role: niveau },
    });
    if (erreurSceau) return Response.json({ erreur: `Sceau refusé : ${erreurSceau.message}` }, { status: 502 });

    const lien = `${origine}/choisir-mot-de-passe?jeton=${encodeURIComponent(jetonHache)}&type=${typeLien}`;
    const cle = process.env.RESEND_API_KEY;
    if (!cle) return Response.json({ fait: true, simule: true, lien });
    const adresseExpedition =
      process.env.COURRIEL_ADRESSE_EXPEDITION ||
      (process.env.COURRIEL_EXPEDITEUR || "").match(/<([^>]+)>/)?.[1] ||
      "info@ventilationdgl.com";
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
        body: JSON.stringify({
          from: `"Fluxya" <${adresseExpedition}>`,
          to: [courriel],
          subject: "Accès à la console Fluxya",
          html: `<p>Bonjour${nom ? ` ${nom}` : ""},</p>
<p>Un accès à la <strong>console Fluxya</strong> (gestion de la plateforme) vient d'être créé pour toi.</p>
<p><a href="${lien}" style="display:inline-block;padding:12px 28px;background:#131B2E;color:#fff;font-weight:bold;border-radius:8px;text-decoration:none;">Choisir mon mot de passe</a></p>
<p>Ensuite, connecte-toi ici : <a href="${origine}/plateforme">${origine}/plateforme</a></p>
<p style="color:#64748b;font-size:12px;">Si tu n'attendais pas ce courriel, ignore-le.</p>`,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e) {
      return Response.json({ fait: true, courrielEchec: true, lien, erreur: String(e?.message || "").slice(0, 200) });
    }
    return Response.json({ fait: true });
  }

  return Response.json({ erreur: "Action inconnue." }, { status: 400 });
}
