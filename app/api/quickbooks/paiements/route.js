// app/api/quickbooks/paiements/route.js
//
// LES PAIEMENTS REDESCENDENT DE QUICKBOOKS (chantier approuvé
// 2026-09-04) — deux lectures, jamais d'écriture :
//
//   • { action: "solde", ids: [...] }
//     Le solde RÉEL d'un lot de factures (payée ? en retard ?) — lu du
//     registre QuickBooks, pour badger les factures émises par Fluxya.
//
//   • { action: "ouvertes" }
//     TOUTES les factures au solde ouvert de l'entreprise (même celles
//     faites directement dans QuickBooks) — le tableau « Comptes à
//     recevoir ».
//
// La vérité vient du registre QuickBooks — jamais d'une supposition.

import {
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  requeteQbo,
  clientSupabaseService,
  entrepriseDuCompte,
} from "@/lib/quickbooksServeur";

// Une facture QuickBooks → l'essentiel pour l'écran. Le statut se
// DÉDUIT des chiffres (solde nul = payée ; solde + échéance passée =
// en retard) : QuickBooks n'a pas de champ « en retard ».
function resumeFacture(f) {
  const total = Number(f?.TotalAmt) || 0;
  const solde = Number(f?.Balance) || 0;
  const echeance = f?.DueDate || null;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return {
    id: f?.Id,
    numero: f?.DocNumber || "",
    client: f?.CustomerRef?.name || "",
    date: f?.TxnDate || null,
    echeance,
    total,
    solde,
    payee: solde <= 0,
    enRetard: solde > 0 && !!echeance && echeance < aujourdhui,
  };
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  const entrepriseId = entrepriseDuCompte(utilisateur);
  // 🔒 Le rôle se lit dans la TABLE des permissions (RLS phase 2,
  // snippet 128) — user_metadata est modifiable par l'utilisateur
  // lui-même, on ne s'y fie plus. Sans ligne : Technicien.
  const admin = clientSupabaseService();
  const { data: ligneRole } = await admin
    .from("permissions_utilisateurs")
    .select("role")
    .eq("email", (utilisateur.email || "").toLowerCase())
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if ((ligneRole?.role || "Technicien") === "Technicien") {
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
    if (corps?.action === "solde") {
      const propres = (Array.isArray(corps?.ids) ? corps.ids : [])
        .map((x) => String(x || "").replace(/[^0-9]/g, ""))
        .filter(Boolean)
        .slice(0, 200);
      const factures = {};
      // Par lots de 40 : la clause « in » de QuickBooks a une limite.
      for (let i = 0; i < propres.length; i += 40) {
        const liste = propres.slice(i, i + 40).map((x) => `'${x}'`).join(",");
        // `select *` obligatoire : QuickBooks refuse les champs
        // complexes (CustomerRef…) nommés dans la projection.
        const reponse = await requeteQbo(acces, `select * from Invoice where Id in (${liste})`);
        for (const f of reponse?.Invoice || []) factures[f.Id] = resumeFacture(f);
      }
      return Response.json({ factures });
    }

    if (corps?.action === "ouvertes") {
      const ouvertes = [];
      // Pages de 100, plafond 500 : bien au-delà du carnet normal d'une
      // PME — et si on frôle le plafond, l'écran le dit (tronque).
      for (let position = 1; position <= 401; position += 100) {
        const reponse = await requeteQbo(
          acces,
          `select * from Invoice where Balance > '0' startposition ${position} maxresults 100`
        );
        const page = reponse?.Invoice || [];
        for (const f of page) ouvertes.push(resumeFacture(f));
        if (page.length < 100) break;
      }
      // Les retards d'abord (les plus vieux en tête), puis par échéance.
      ouvertes.sort((a, b) => {
        if (a.enRetard !== b.enRetard) return a.enRetard ? -1 : 1;
        return String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"));
      });
      return Response.json({ ouvertes, tronque: ouvertes.length >= 500 });
    }

    return Response.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
