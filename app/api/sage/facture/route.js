// app/api/sage/facture/route.js
//
// COPIE COMPTABLE D'UNE FACTURE DANS SAGE — phase 3 du chantier
// (2026-09-07). La facture CLIENT est la facture MAISON de Fluxya
// (numérotation, page publique, courriel) ; cette route pousse son
// pendant comptable : une sales_invoice Sage au nom du contact relié,
// avec notre numéro en référence. Montants HT, taux Sage à 0 % — les
// taxes du régime vivent sur la facture maison (voir lib/sageServeur).

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";
import { configSagePresente, jetonAccesValideSage, creerFactureSage } from "@/lib/sageServeur";

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
  const brutes = Array.isArray(corps?.lignes) ? corps.lignes.filter((l) => l && Number.isFinite(Number(l.prixUnitaire))) : [];
  if (brutes.length === 0) return Response.json({ erreur: "Aucune ligne de facture." }, { status: 400 });
  // 🛡️ (audit 2026-10-05) Les lignes NÉGATIVES (dépôt déduit, rabais, pièce
  // payée d'avance) étaient retirées en silence : Sage recevait un montant
  // PLUS ÉLEVÉ que la facture du client. Avec une déduction, la copie
  // comptable devient UNE ligne au total net — le montant est toujours exact.
  const montantLigne = (l) =>
    Number.isFinite(Number(l.montant)) ? Number(l.montant) : (Number(l.quantite) > 0 ? Number(l.quantite) : 1) * Number(l.prixUnitaire);
  let lignes = brutes;
  if (brutes.some((l) => montantLigne(l) < 0)) {
    const net = Math.round(brutes.reduce((s, l) => s + montantLigne(l), 0) * 100) / 100;
    if (net <= 0) return Response.json({ erreur: "Total net nul ou négatif — rien à copier dans Sage." }, { status: 400 });
    lignes = [{ description: `Facture ${String(corps?.reference || "").slice(0, 40)} — total net (déductions incluses)`.replace("  ", " "), quantite: 1, prixUnitaire: net }];
  }

  let acces;
  try {
    acces = await jetonAccesValideSage(entrepriseId);
  } catch (e) {
    return Response.json({ erreur: `Jeton Sage : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  const admin = clientSupabaseService();
  try {
    // 🔒 La fiche invoquée doit appartenir à l'entreprise du demandeur.
    let clientId = corps?.clientId || null;
    if (clientId) {
      const { data } = await admin
        .from("clients_app")
        .select("id")
        .eq("id", clientId)
        .eq("entreprise_id", entrepriseId)
        .maybeSingle();
      if (!data) clientId = null;
    }
    const r = await creerFactureSage(acces, admin, {
      clientId,
      clientNom: corps?.clientNom || "",
      lignes,
      reference: corps?.reference || null,
      date: corps?.date || null,
    });
    return Response.json(r);
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "Sage injoignable — réessaie.") }, { status: 502 });
  }
}
