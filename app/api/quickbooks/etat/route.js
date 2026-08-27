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
  // 🔐 GRAND SOIR (2026-09-04) : la comptabilite branchee est celle de
  // DGL — les entreprises d'essai n'ont pas (encore) de connexion
  // QuickBooks a elles. Refus net plutot que de servir les chiffres
  // d'une autre entreprise.
  if (entrepriseDuCompte(utilisateur) !== "dgl") {
    return Response.json({ erreur: "La connexion comptable n'est pas encore offerte a votre entreprise." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) {
    return Response.json({ configure: false, connecte: false, environnement: environnementQb() });
  }
  try {
    const connexion = await lireConnexionQb();
    return Response.json({
      configure: true,
      connecte: !!connexion && new Date(connexion.refresh_expire_a).getTime() > Date.now(),
      environnement: environnementQb(),
      realmId: connexion?.realm_id || null,
      expireLe: connexion?.refresh_expire_a || null,
    });
  } catch {
    return Response.json({ configure: true, connecte: false, environnement: environnementQb() });
  }
}
