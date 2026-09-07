// app/api/sage/etat/route.js
//
// ÉTAT DE LA CONNEXION SAGE de l'entreprise du demandeur — jamais les
// jetons eux-mêmes. Même moule que /api/quickbooks/etat :
// { configure, connecte, businessNom, expireLe }.

import { utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";
import { configSagePresente, lireConnexionSage } from "@/lib/sageServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if ((await roleServeur(utilisateur)) === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configSagePresente()) return Response.json({ configure: false, connecte: false });
  try {
    const connexion = await lireConnexionSage(entrepriseDuCompte(utilisateur));
    if (!connexion) return Response.json({ configure: true, connecte: false });
    // Connecté = le refresh token est encore vivant (31 jours, renouvelé
    // à chaque usage) — le jeton d'accès de 5 min, lui, expire tout le
    // temps, ce n'est pas un signe de débranchement.
    const vivant = new Date(connexion.refresh_expire_a).getTime() > Date.now();
    return Response.json({
      configure: true,
      connecte: vivant,
      businessNom: connexion.business_nom || null,
      expireLe: connexion.refresh_expire_a || null,
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "Lecture impossible.") }, { status: 502 });
  }
}
