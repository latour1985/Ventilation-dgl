// app/api/quickbooks/facture-envoi/route.js
//
// LA GARANTIE « RIEN NE SE PERD » — deux actions sur l'envoi des
// factures QuickBooks :
//
//   • { action: "envoyer", factureId, courriels: [...] }
//     (Re)demande à QuickBooks d'envoyer SA facture officielle, puis
//     relit le statut réel dans sa réponse. Le bouton « Renvoyer ».
//
//   • { action: "verifier", ids: [...] }
//     Lit le statut d'envoi RÉEL d'un lot de factures dans le registre
//     QuickBooks. Le bouton « Vérifier les envois » : toute facture
//     créée mais jamais partie remonte immédiatement.
//
// La preuve vient toujours du registre QuickBooks — jamais d'une
// supposition de l'application.

import {
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  envoyerFactureParQb,
  statutsEnvoiFactures, entrepriseDuCompte } from "@/lib/quickbooksServeur";
// 🔒 RLS phase 3 : le rôle vient de la table des permissions.
import { roleServeur } from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if ((await roleServeur(utilisateur)) === "Technicien") {
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

  try {
    if (corps?.action === "envoyer") {
      const factureId = String(corps?.factureId || "").replace(/[^0-9]/g, "");
      const courriels = (Array.isArray(corps?.courriels) ? corps.courriels : [])
        .map((e) => String(e || "").trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (!factureId || courriels.length === 0) {
        return Response.json({ erreur: "Facture et courriels requis." }, { status: 400 });
      }
      const resultat = await envoyerFactureParQb(acces, factureId, courriels);
      return Response.json(resultat);
    }

    if (corps?.action === "verifier") {
      const statuts = await statutsEnvoiFactures(acces, Array.isArray(corps?.ids) ? corps.ids : []);
      return Response.json({ statuts });
    }

    return Response.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
