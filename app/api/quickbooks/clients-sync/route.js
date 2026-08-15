// app/api/quickbooks/clients-sync/route.js
//
// SYNCHRONISATION DES CLIENTS vers QuickBooks — décision du
// propriétaire : TOUS les clients de l'application existent dans
// QuickBooks (c'était déjà sa pratique quand ses devis se faisaient
// dans QuickBooks — on préserve l'existant, on ne le change pas).
//
// Deux modes :
//   { clientId }  — UN client (appelé automatiquement à la création
//                   d'une fiche dans l'application) ;
//   { tous: true } — TOUS les clients pas encore reliés (le bouton
//                   « Synchroniser les clients » — rattrapage initial).
//
// Idempotent : un client déjà relié (quickbooks_customer_id) est sauté ;
// un client portant le même nom chez QuickBooks est RELIÉ, pas dupliqué.

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  clientQboPour,
} from "@/lib/quickbooksServeur";

const MAX_PAR_PASSE = 100;

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
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
    acces = await jetonAccesValide();
  } catch (e) {
    return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  const admin = clientSupabaseService();

  // La liste à traiter : un seul client, ou tous ceux pas encore reliés.
  let aTraiter = [];
  if (corps?.tous === true) {
    const { data, error } = await admin
      .from("clients_app")
      .select("id, nom, quickbooks_customer_id")
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
