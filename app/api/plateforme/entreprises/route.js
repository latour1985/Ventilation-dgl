// app/api/plateforme/entreprises/route.js
//
// 🏢 CRÉER UNE ENTREPRISE CLIENTE (2026-09-05 — après la sonde verte).
//
// Le geste d'embarquement d'un client Fluxya, en UNE action :
//   1. la FICHE de l'entreprise naît dans le registre (id = petit nom
//      unique dérivé du nom, ex. « ventilation-abc ») ;
//   2. SON admin principal est invité par courriel — son compte est
//      étiqueté à la NOUVELLE entreprise (app_metadata, scellé serveur,
//      jamais modifiable du navigateur) : dès sa première connexion,
//      les cloisons RLS ne lui montrent QUE sa bulle, vide et propre.
//
// Garde-fous :
//   • réservé aux 🔑 clés principales de la console ;
//   • REFUSÉ tant que le verrou d'isolation n'est pas levé
//     (plateforme_config : isolation_activee = 'oui' — posé en base
//     seulement après le test-sonde d'étanchéité) ;
//   • le courriel de l'admin doit être NEUF : un compte existant
//     appartient déjà à une entreprise (ré-étiqueter arracherait la
//     personne à sa bulle) ou à la console (accès séparés) ;
//   • maximum 3 entreprises « Pionnier » (clause exclusive) ;
//   • si une étape casse APRÈS la création de la fiche, tout est
//     défait (fiche effacée, compte effacé) — jamais d'entreprise à
//     moitié née, jamais de compte sans étiquette (le fallback 'dgl'
//     des routes service rendrait un compte non étiqueté dangereux).

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

function niveauDe(compte) {
  if (compte?.app_metadata?.plateforme !== true) return null;
  const n = compte.app_metadata?.plateforme_role;
  return ["cle-principale", "admin-regulier", "gestionnaire", "technicien"].includes(n) ? n : "cle-principale";
}

// Petit nom unique : minuscules sans accents, tirets, max 30 caractères.
function slugDe(nom) {
  const base = String(nom || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  return base || "entreprise";
}

async function chercherCompte(admin, courriel) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const t = (data?.users || []).find((c) => (c.email || "").toLowerCase() === courriel);
    if (t) return t;
    if (!data?.users || data.users.length < 200 || page >= 10) return null;
    page++;
  }
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const appelant = await utilisateurDepuisJeton(jeton);
  if (!appelant) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (niveauDe(appelant) !== "cle-principale") {
    return Response.json({ erreur: "Réservé aux clés principales." }, { status: 403 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  const nomLegal = String(corps?.nomLegal || "").trim().slice(0, 160);
  const nomCommercial = String(corps?.nomCommercial || "").trim().slice(0, 160) || null;
  const courrielEntreprise = String(corps?.courrielEntreprise || "").trim().toLowerCase().slice(0, 160) || null;
  const telephone = String(corps?.telephone || "").trim().slice(0, 40) || null;
  const adresse = String(corps?.adresse || "").trim().slice(0, 240) || null;
  const statut = ["essai", "fondateur", "payant"].includes(corps?.statut) ? corps.statut : "essai";
  const gratuitJusqua = /^\d{4}-\d{2}-\d{2}$/.test(String(corps?.gratuitJusqua || "")) ? corps.gratuitJusqua : null;
  const adminNom = String(corps?.adminNom || "").trim().slice(0, 120);
  const adminCourriel = String(corps?.adminCourriel || "").trim().toLowerCase();

  if (!nomLegal) return Response.json({ erreur: "Le nom légal de l'entreprise est requis." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminCourriel)) {
    return Response.json({ erreur: "Le courriel de l'admin de l'entreprise est invalide." }, { status: 400 });
  }

  const admin = clientSupabaseService();

  // 🔒 LE VERROU — jamais d'entreprise avant la preuve d'étanchéité.
  const { data: verrou } = await admin.from("plateforme_config").select("valeur").eq("cle", "isolation_activee").maybeSingle();
  if (verrou?.valeur !== "oui") {
    return Response.json({ erreur: "Verrouillé : l'isolation multi-entreprises n'est pas activée (le verrou se lève en base, après le test-sonde)." }, { status: 403 });
  }

  // ---- Le courriel de l'admin doit être NEUF ----
  let compteExistant;
  try {
    compteExistant = await chercherCompte(admin, adminCourriel);
  } catch (e) {
    return Response.json({ erreur: `Vérification des comptes impossible : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (compteExistant) {
    if (compteExistant.app_metadata?.plateforme === true) {
      return Response.json({ erreur: "Ce courriel est un opérateur de la console Fluxya — les accès sont SÉPARÉS : utilise un courriel dédié à l'entreprise." }, { status: 400 });
    }
    return Response.json({ erreur: `Ce courriel a déjà un compte (entreprise « ${compteExistant.app_metadata?.entreprise_id || "?"} »). L'admin d'une nouvelle entreprise doit avoir un courriel qui n'existe pas encore dans Fluxya.` }, { status: 400 });
  }

  // ---- La fiche : nom unique, petit nom unique ----
  const { data: existantes, error: erreurRegistre } = await admin.from("entreprises").select("id, nom_legal, statut_plateforme");
  if (erreurRegistre) return Response.json({ erreur: `Registre illisible : ${erreurRegistre.message}` }, { status: 502 });
  if ((existantes || []).some((e) => (e.nom_legal || "").trim().toLowerCase() === nomLegal.toLowerCase())) {
    return Response.json({ erreur: "Une entreprise porte déjà ce nom légal — elle existe probablement déjà (protège contre les doubles-clics)." }, { status: 400 });
  }
  if (statut === "fondateur" && (existantes || []).filter((e) => e.statut_plateforme === "fondateur").length >= 3) {
    return Response.json({ erreur: "Les 3 places de client pionnier sont prises — utilise Essai ou Payant." }, { status: 400 });
  }
  const idsPris = new Set((existantes || []).map((e) => e.id));
  let id = slugDe(nomCommercial || nomLegal);
  if (idsPris.has(id)) {
    let n = 2;
    while (idsPris.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }

  // 🏆 CLAUSE PIONNIER (les 3 premiers) : 1 AN GRATUIT (date par
  // défaut = aujourd'hui + 365 jours, ajustable dans la console) et
  // 25 % DE RABAIS À VIE — posés d'office à la création.
  const dansUnAn = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const { error: erreurCreation } = await admin.from("entreprises").insert({
    id,
    nom_legal: nomLegal,
    nom_commercial: nomCommercial,
    courriel: courrielEntreprise,
    telephone,
    adresse,
    statut_plateforme: statut,
    gratuit_jusqua: statut === "fondateur" ? gratuitJusqua || dansUnAn : gratuitJusqua,
    rabais_pourcent: statut === "fondateur" ? 25 : 0,
    suspendue: false,
  });
  if (erreurCreation) return Response.json({ erreur: `Création de la fiche refusée : ${erreurCreation.message}` }, { status: 502 });

  // Marche arrière commune : jamais d'entreprise à moitié née.
  const defaire = async (idCompte) => {
    if (idCompte) await admin.auth.admin.deleteUser(idCompte).catch(() => {});
    await admin.from("entreprises").delete().eq("id", id).catch(() => {});
  };

  // ---- L'invitation de SON admin — compte neuf, role Admin principal ----
  const origine = new URL(request.url).origin;
  let jetonHache = null;
  let idCompte = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: adminCourriel,
      options: {
        redirectTo: `${origine}/choisir-mot-de-passe`,
        data: { nom: adminNom, role: "Admin principal" },
      },
    });
    if (error) throw error;
    jetonHache = data?.properties?.hashed_token || null;
    idCompte = data?.user?.id || null;
  } catch (e) {
    await defaire(null);
    return Response.json({ erreur: `Création du compte admin refusée : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!idCompte || !jetonHache) {
    await defaire(idCompte);
    return Response.json({ erreur: "Le compte admin n'a pas pu être préparé — rien n'a été créé, réessaie." }, { status: 502 });
  }

  // 🏷️ L'ÉTIQUETTE — le cœur du geste : ce compte appartient à la
  // NOUVELLE entreprise. Sans elle, on défait tout (le fallback 'dgl'
  // des routes service rendrait un compte non étiqueté dangereux).
  const { data: fiche } = await admin.auth.admin.getUserById(idCompte);
  const { error: erreurEtiquette } = await admin.auth.admin.updateUserById(idCompte, {
    app_metadata: { ...(fiche?.user?.app_metadata || {}), entreprise_id: id, plateforme: false },
  });
  if (erreurEtiquette) {
    await defaire(idCompte);
    return Response.json({ erreur: `Étiquette refusée (${erreurEtiquette.message}) — tout a été défait, réessaie.` }, { status: 502 });
  }

  // ---- Le courriel de bienvenue ----
  const lien = `${origine}/choisir-mot-de-passe?jeton=${encodeURIComponent(jetonHache)}&type=invite`;
  const cle = process.env.RESEND_API_KEY;
  const reponseBase = { fait: true, id, adminCourriel };
  if (!cle) return Response.json({ ...reponseBase, simule: true, lien });
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
        to: [adminCourriel],
        subject: `${nomCommercial || nomLegal} est prête sur Fluxya`,
        html: `<p>Bonjour${adminNom ? ` ${adminNom}` : ""},</p>
<p>L'espace de <strong>${nomCommercial || nomLegal}</strong> vient d'être créé sur <strong>Fluxya</strong> — tu en es l'administrateur principal.</p>
<p><a href="${lien}" style="display:inline-block;padding:12px 28px;background:#131B2E;color:#fff;font-weight:bold;border-radius:8px;text-decoration:none;">Choisir mon mot de passe</a></p>
<p>Ensuite, connecte-toi ici : <a href="${origine}">${origine}</a></p>
<p style="color:#64748b;font-size:12px;">Si tu n'attendais pas ce courriel, ignore-le.</p>`,
      }),
    });
    if (!r.ok) throw new Error(await r.text());
  } catch (e) {
    // L'entreprise ET le compte existent — seul le courriel a échoué :
    // on remet le lien à copier-coller plutôt que de tout défaire.
    return Response.json({ ...reponseBase, courrielEchec: true, lien, erreur: String(e?.message || "").slice(0, 200) });
  }
  return Response.json(reponseBase);
}
