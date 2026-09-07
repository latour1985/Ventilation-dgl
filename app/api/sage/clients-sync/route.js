// app/api/sage/clients-sync/route.js
//
// SYNCHRONISATION DES CLIENTS vers Sage Business Cloud — phase 2 du
// chantier (2026-09-07), le MÊME contrat que /api/quickbooks/clients-sync :
//   { clientId }   — UN client ;
//   { tous: true } — TOUS les clients pas encore reliés (lots de 100) ;
//   { forcer: true } + { clientId } — pousse une fiche déjà reliée À JOUR.
// Idempotent : un client déjà relié (sage_contact_id) est sauté ; un
// homonyme chez Sage est RELIÉ, jamais dupliqué. La descente
// (Sage → Fluxya) viendra dans une phase ultérieure.
//
// ⚠️ Respect des limites Sage (100 req/min) : lots de 40 par passe,
// l'interface rappelle la route tant que `termine` est faux.

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";
import { configSagePresente, jetonAccesValideSage, contactSagePour, mettreAJourContactSage, requeteSage } from "@/lib/sageServeur";

const MAX_PAR_PASSE = 40;

// Même normalisation que côté admin : minuscules, accents retirés.
function nomNormalise(n) {
  return String(n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------
// 🡇 LA DESCENTE : Sage → Fluxya (2026-09-07, vécu par l'owner : « j'ai
// créé 2 contacts sur Sage et ils ne sont pas arrivés sur Fluxya »).
// Même moule que descendreClientsQbo : toute la liste des clients Sage
// (pages de 100), puis trois familles — déjà reliés (rien), homonymes
// (raccord du lien, jamais de doublon), inconnus (fiche créée avec
// courriel/téléphone/adresse). Idempotente : les fiches créées portent
// l'id déterministe « sgc-<entreprise>-<idSage> ».
// ------------------------------------------------------------
async function descendreClientsSage(acces, admin, entrepriseId) {
  const fiches = [];
  for (let depart = 0; ; depart += 1000) {
    const { data, error } = await admin
      .from("clients_app")
      .select("id, nom, entreprise, sage_contact_id")
      .eq("entreprise_id", entrepriseId)
      .range(depart, depart + 999);
    if (error) throw new Error(`Lecture des fiches : ${error.message}`);
    fiches.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const dejaRelies = new Set(fiches.map((f) => f.sage_contact_id).filter(Boolean));
  const parNom = new Map();
  fiches.forEach((f) => {
    [f.nom, f.entreprise].forEach((n) => {
      const cle = nomNormalise(n);
      if (cle && !parNom.has(cle)) parNom.set(cle, f);
    });
  });

  // Tous les clients Sage — attributes=all ramène courriel, téléphone
  // et adresse principale dans la même lecture (pas d'appel par fiche).
  const contactsSage = [];
  for (let page = 1; page <= 50; page++) {
    const lu = await requeteSage(
      acces,
      `contacts?contact_type_id=CUSTOMER&items_per_page=100&page=${page}&attributes=all`
    );
    const items = lu?.$items || [];
    contactsSage.push(...items);
    if (items.length < 100) break;
  }

  let relies = 0;
  const aCreer = [];
  for (const s of contactsSage) {
    const idSage = String(s.id || "");
    const nomSage = String(s.name || s.displayed_as || "").trim();
    if (!idSage || !nomSage || dejaRelies.has(idSage)) continue;
    const fiche = parNom.get(nomNormalise(nomSage));
    if (fiche) {
      // Homonyme d'une fiche SANS lien → raccord (jamais de doublon).
      if (!fiche.sage_contact_id) {
        const { error } = await admin
          .from("clients_app")
          .update({ sage_contact_id: idSage })
          .eq("id", fiche.id)
          .is("sage_contact_id", null);
        if (!error) {
          fiche.sage_contact_id = idSage;
          relies++;
        }
      }
      continue;
    }
    const adr = s.main_address || null;
    const adresse = adr
      ? [adr.address_line_1, adr.address_line_2, adr.city, adr.postal_code].filter(Boolean).join(", ")
      : "";
    const email = String(s.email || "").trim();
    aCreer.push({
      id: `sgc-${entrepriseId}-${idSage}`,
      nom: nomSage,
      courriels: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? [{ id: `cc-sg-${idSage}`, label: "Sage", email, defaut: true }]
        : [],
      telephone: s.telephone || s.mobile || null,
      adresse_facturation: adresse || null,
      sage_contact_id: idSage,
      entreprise_id: entrepriseId,
    });
  }

  let crees = 0;
  for (let i = 0; i < aCreer.length; i += 200) {
    const lot = aCreer.slice(i, i + 200);
    const { error } = await admin.from("clients_app").upsert(lot, { onConflict: "id" });
    if (error) throw new Error(`Création des fiches : ${error.message}`);
    crees += lot.length;
  }
  return { totalSage: contactsSage.length, relies, crees };
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if ((await roleServeur(utilisateur)) === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configSagePresente()) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  let acces;
  try {
    acces = await jetonAccesValideSage(entrepriseId);
  } catch (e) {
    return Response.json({ erreur: `Jeton Sage : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  const admin = clientSupabaseService();

  // 🡇 LE SENS INVERSE — Sage → Fluxya (voir descendreClientsSage).
  if (corps?.descendre === true) {
    try {
      const r = await descendreClientsSage(acces, admin, entrepriseId);
      return Response.json(r);
    } catch (e) {
      return Response.json({ erreur: String(e?.message || "Sage injoignable — réessaie.") }, { status: 502 });
    }
  }

  // La liste à traiter : un seul client, ou tous ceux pas encore reliés
  // — TOUJOURS bornée à l'entreprise du demandeur.
  let aTraiter = [];
  if (corps?.tous === true) {
    const { data, error } = await admin
      .from("clients_app")
      .select("id, nom, sage_contact_id")
      .eq("entreprise_id", entrepriseId)
      .is("sage_contact_id", null)
      .limit(MAX_PAR_PASSE);
    if (error) return Response.json({ erreur: `Lecture des clients : ${error.message}` }, { status: 502 });
    aTraiter = data || [];
  } else if (corps?.clientId) {
    const { data } = await admin
      .from("clients_app")
      .select("id, nom, sage_contact_id, entreprise_id")
      .eq("id", corps.clientId)
      .eq("entreprise_id", entrepriseId)
      .maybeSingle();
    if (data) aTraiter = [data];
  }
  if (aTraiter.length === 0) return Response.json({ fait: 0, sautes: 0, erreurs: [], termine: true });

  let fait = 0;
  let sautes = 0;
  const erreurs = [];
  for (const c of aTraiter) {
    if (c.sage_contact_id) {
      if (corps?.forcer === true) {
        try {
          await mettreAJourContactSage(acces, admin, c.id);
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
      await contactSagePour(acces, admin, { clientId: c.id, clientNom: c.nom });
      fait++;
    } catch (e) {
      erreurs.push(`${c.nom} : ${e?.message || "erreur"}`);
      // Trop d'erreurs d'affilée = problème global (jeton, réseau,
      // colonne sage_contact_id absente) — on arrête au lieu de
      // marteler l'API pour rien.
      if (erreurs.length >= 5) break;
    }
  }
  return Response.json({
    fait,
    sautes,
    erreurs,
    // `termine` faux = il reste des clients (lot de 40) — l'interface
    // rappelle la route pour continuer.
    termine: aTraiter.length < MAX_PAR_PASSE,
  });
}
