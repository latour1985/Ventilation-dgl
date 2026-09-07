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
import { configSagePresente, jetonAccesValideSage, contactSagePour, mettreAJourContactSage } from "@/lib/sageServeur";

const MAX_PAR_PASSE = 40;

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
