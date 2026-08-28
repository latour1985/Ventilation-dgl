// app/api/quickbooks/etat/route.js
//
// ÉTAT DE LA CONNEXION QUICKBOOKS — pour l'interface admin.
// Répond { configure, connecte, environnement, realmId, expireLe } —
// JAMAIS les jetons eux-mêmes. Requiert une session utilisateur valide
// (même verrou que /api/courriel).

import { configQuickbooksPresente, environnementQb, lireConnexionQb, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) {
    return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  }
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if (!configQuickbooksPresente()) {
    return Response.json({ configure: false, connecte: false, environnement: environnementQb() });
  }
  try {
    const connexion = await lireConnexionQb(entrepriseId);
    return Response.json({
      configure: true,
      connecte: !!connexion && new Date(connexion.refresh_expire_a).getTime() > Date.now(),
      // L'environnement de SA connexion (production/sandbox peuvent
      // coexister d'une entreprise à l'autre) — le défaut global sert
      // seulement tant que rien n'est branché.
      environnement: connexion?.environnement || environnementQb(),
      realmId: connexion?.realm_id || null,
      expireLe: connexion?.refresh_expire_a || null,
    });
  } catch {
    return Response.json({ configure: true, connecte: false, environnement: environnementQb() });
  }
}
