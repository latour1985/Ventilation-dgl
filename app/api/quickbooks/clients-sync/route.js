// app/api/quickbooks/clients-sync/route.js
//
// SYNCHRONISATION DES CLIENTS vers QuickBooks — décision du
// propriétaire : TOUS les clients de l'application existent dans
// QuickBooks (c'était déjà sa pratique quand ses devis se faisaient
// dans QuickBooks — on préserve l'existant, on ne le change pas).
//
// Trois modes :
//   { clientId }  — UN client (appelé automatiquement à la création
//                   d'une fiche dans l'application) ;
//   { tous: true } — TOUS les clients pas encore reliés (le bouton
//                   « Synchroniser les clients » — rattrapage initial) ;
//   { descendre: true } — LE SENS INVERSE (2026-08-29, demande du
//                   propriétaire : « si le client appelle, qu'il soit
//                   facile à retrouver ») : lit TOUS les clients de
//                   QuickBooks, relie ceux qui existent déjà (par
//                   quickbooks_customer_id, sinon par NOM normalisé) et
//                   crée une fiche pour les autres. Idempotent : les
//                   fiches créées portent l'id déterministe
//                   « qbc-<idQuickBooks> » — repasser ne duplique rien.
//
// Idempotent : un client déjà relié (quickbooks_customer_id) est sauté ;
// un client portant le même nom chez QuickBooks est RELIÉ, pas dupliqué.

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  clientQboPour,
  mettreAJourClientQbo,
  requeteQbo, entrepriseDuCompte } from "@/lib/quickbooksServeur";

const MAX_PAR_PASSE = 100;

// Même normalisation que côté admin : minuscules, accents retirés,
// espaces réduits — « Raphaël  Gélinas » = « raphael gelinas ».
function nomNormalise(n) {
  return String(n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------
// LA DESCENTE : QuickBooks → Fluxya. Toute la liste (pagination
// STARTPOSITION — rien n'est tronqué même à 2 000 clients), puis trois
// familles : déjà reliés (rien à faire), homonymes (raccord du lien sur
// la fiche existante), inconnus (fiche créée avec courriel/téléphone/
// adresse de facturation). Les fiches naissent en UN upsert groupé.
// ------------------------------------------------------------
async function descendreClientsQbo(acces, admin, entrepriseId) {
  // 🏢 Multi-QuickBooks (2026-09-08) : la clé service voit toutes les
  // entreprises — on se borne aux fiches de L'ENTREPRISE DU DEMANDEUR
  // pour ne jamais raccorder la fiche d'une compagnie aux clients
  // QuickBooks d'une autre.
  const { data: fiches, error: erreurLecture } = await admin
    .from("clients_app")
    .select("id, nom, entreprise, quickbooks_customer_id")
    .eq("entreprise_id", entrepriseId);
  if (erreurLecture) throw new Error(`Lecture des fiches : ${erreurLecture.message}`);

  const dejaRelies = new Set((fiches || []).map((f) => f.quickbooks_customer_id).filter(Boolean));
  const parNom = new Map();
  (fiches || []).forEach((f) => {
    [f.nom, f.entreprise].forEach((n) => {
      const cle = nomNormalise(n);
      if (cle && !parNom.has(cle)) parNom.set(cle, f);
    });
  });

  const clientsQb = [];
  const PAGE = 500;
  for (let depart = 1; ; depart += PAGE) {
    const lu = await requeteQbo(
      acces,
      `select Id, DisplayName, CompanyName, PrimaryEmailAddr, PrimaryPhone, BillAddr from Customer startposition ${depart} maxresults ${PAGE}`
    );
    const page = lu?.Customer || [];
    clientsQb.push(...page);
    if (page.length < PAGE) break;
  }

  let relies = 0;
  const aCreer = [];
  for (const q of clientsQb) {
    const qbId = String(q.Id);
    const nomQb = (q.DisplayName || "").trim();
    if (!nomQb || dejaRelies.has(qbId)) continue;
    // Homonyme d'une fiche SANS lien → raccord (jamais de doublon).
    const fiche = parNom.get(nomNormalise(nomQb)) || parNom.get(nomNormalise(q.CompanyName));
    if (fiche) {
      if (!fiche.quickbooks_customer_id) {
        const { error } = await admin
          .from("clients_app")
          .update({ quickbooks_customer_id: qbId, sync_qb: "synchronise" })
          .eq("id", fiche.id)
          .is("quickbooks_customer_id", null);
        if (!error) {
          fiche.quickbooks_customer_id = qbId;
          relies++;
        }
      }
      continue;
    }
    // Inconnu de Fluxya → fiche neuve. Adresse de facturation en une
    // ligne lisible ; le courriel QuickBooks devient le contact défaut.
    const adresse = [q.BillAddr?.Line1, q.BillAddr?.City, q.BillAddr?.PostalCode].filter(Boolean).join(", ");
    const courriel = (q.PrimaryEmailAddr?.Address || "").trim();
    aCreer.push({
      id: `qbc-${qbId}`,
      nom: nomQb,
      entreprise: q.CompanyName && nomNormalise(q.CompanyName) !== nomNormalise(nomQb) ? q.CompanyName : null,
      courriels: courriel ? [{ id: `cc-qb-${qbId}`, label: "QuickBooks", email: courriel, defaut: true }] : [],
      telephone: q.PrimaryPhone?.FreeFormNumber || null,
      adresse_facturation: adresse || null,
      quickbooks_customer_id: qbId,
      sync_qb: "synchronise",
      // La fiche naît dans L'ENTREPRISE dont le QuickBooks descend.
      entreprise_id: entrepriseId,
    });
  }

  let crees = 0;
  // Lots de 200 : un upsert géant passe, mais des lots restent plus
  // digestes pour Supabase et pour le Realtime qui va suivre.
  for (let i = 0; i < aCreer.length; i += 200) {
    const lot = aCreer.slice(i, i + 200);
    const { error } = await admin.from("clients_app").upsert(lot, { onConflict: "id" });
    if (error) throw new Error(`Création des fiches : ${error.message}`);
    crees += lot.length;
  }
  return { totalQb: clientsQb.length, relies, crees };
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  let acces;
  try {
    acces = await jetonAccesValide(entrepriseId);
  } catch (e) {
    return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  const admin = clientSupabaseService();

  // 🡇 LE SENS INVERSE — QuickBooks → Fluxya (voir descendreClientsQbo).
  if (corps?.descendre === true) {
    try {
      const r = await descendreClientsQbo(acces, admin, entrepriseId);
      return Response.json(r);
    } catch (e) {
      return Response.json({ erreur: String(e?.message || "QuickBooks injoignable — réessaie.") }, { status: 502 });
    }
  }

  // La liste à traiter : un seul client, ou tous ceux pas encore reliés.
  let aTraiter = [];
  if (corps?.tous === true) {
    const { data, error } = await admin
      .from("clients_app")
      .select("id, nom, quickbooks_customer_id")
      .eq("entreprise_id", entrepriseId)
      .is("quickbooks_customer_id", null)
      .limit(MAX_PAR_PASSE);
    if (error) return Response.json({ erreur: `Lecture des clients : ${error.message}` }, { status: 502 });
    aTraiter = data || [];
  } else if (corps?.clientId) {
    const { data } = await admin
      .from("clients_app")
      .select("id, nom, quickbooks_customer_id")
      .eq("id", corps.clientId)
      .maybeSingle();
    if (data) aTraiter = [data];
  }
  if (aTraiter.length === 0) return Response.json({ fait: 0, sautes: 0, erreurs: [], termine: true });

  let fait = 0;
  let sautes = 0;
  const erreurs = [];
  for (const c of aTraiter) {
    if (c.quickbooks_customer_id) {
      // DÉJÀ RELIÉ : { forcer: true } pousse la fiche À JOUR (courriel,
      // téléphone, adresse) — appelé quand la fiche change dans l'app.
      if (corps?.forcer === true) {
        try {
          await mettreAJourClientQbo(acces, admin, c.id);
          fait++;
        } catch (e) {
          erreurs.push(`${c.nom} : ${e?.message || "erreur"}`);
        }
        continue;
      }
      sautes++;
      continue;
    }
    if (!String(c.nom || "").trim()) {
      sautes++;
      continue;
    }
    try {
      // clientQboPour relie par nom si le client existe déjà chez QBO,
      // sinon le crée — et mémorise l'id sur la fiche dans les deux cas.
      await clientQboPour(acces, admin, { clientId: c.id, clientNom: c.nom });
      fait++;
    } catch (e) {
      erreurs.push(`${c.nom} : ${e?.message || "erreur"}`);
      // Trop d'erreurs d'affilée = problème global (jeton, réseau) — on
      // arrête au lieu de marteler l'API pour rien.
      if (erreurs.length >= 5) break;
    }
  }
  return Response.json({
    fait,
    sautes,
    erreurs,
    // `termine` faux = il reste des clients (lot de 100) — l'interface
    // peut rappeler la route pour continuer.
    termine: aTraiter.length < MAX_PAR_PASSE,
  });
}
