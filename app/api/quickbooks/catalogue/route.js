// app/api/quickbooks/catalogue/route.js
//
// 🔄 LECTURE DU CATALOGUE D'ITEMS QUICKBOOKS (2026-08-28).
//
// Renvoie la liste des items (produits/services) de QuickBooks dans une
// forme simple — la COMPARAISON avec le catalogue Fluxya se fait côté
// admin, qui a déjà le catalogue en mémoire et montre à l'humain ce qui
// changerait AVANT d'appliquer quoi que ce soit (exigence du
// propriétaire : rien ne s'écrase sans autorisation).
//
// LECTURE SEULE côté QuickBooks. Pagination STARTPOSITION : rien n'est
// tronqué même à 2 000 items.

import { configQuickbooksPresente, jetonAccesValide, requeteQbo, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🔐 GRAND SOIR (2026-09-04) : la comptabilite branchee est celle de
  // DGL — les entreprises d'essai n'ont pas (encore) de connexion
  // QuickBooks a elles. Refus net plutot que de servir les chiffres
  // d'une autre entreprise.
  if (entrepriseDuCompte(utilisateur) !== "dgl") {
    return Response.json({ erreur: "La connexion comptable n'est pas encore offerte a votre entreprise." }, { status: 403 });
  }
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });

  let acces;
  try {
    acces = await jetonAccesValide();
  } catch {
    return Response.json({ nonConnecte: true });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  try {
    const items = [];
    const PAGE = 500;
    for (let depart = 1; ; depart += PAGE) {
      const lu = await requeteQbo(
        acces,
        `select Id, Name, Description, UnitPrice, PurchaseCost, Active, Type from Item startposition ${depart} maxresults ${PAGE}`
      );
      const page = lu?.Item || [];
      page.forEach((i) => {
        items.push({
          qbId: String(i.Id),
          nom: i.Name || "",
          description: i.Description || "",
          vendant: i.UnitPrice != null ? Number(i.UnitPrice) : null,
          coutant: i.PurchaseCost != null ? Number(i.PurchaseCost) : null,
          actif: i.Active !== false,
          type: i.Type || "",
        });
      });
      if (page.length < PAGE) break;
    }
    return Response.json({ items });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable — réessaie.") }, { status: 502 });
  }
}
