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
  entrepriseDuCompte,
  roleServeur,
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
  // 🔒 Le rôle se lit dans la TABLE des permissions — l'aide partagée
  // roleServeur (RLS phase 3) remplace la copie locale d'origine.
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

    // 💳 { action: "credits" } — NOTES DE CRÉDIT (CreditMemo) 2026-09-11.
    // Demande du propriétaire : les crédits/remboursements faits dans
    // QuickBooks doivent baisser le facturé dans l'analyse de
    // rentabilité (sinon les marges mentent). Lecture seule : nom du
    // client, montant HT (le sous-total avant taxes, pour rester
    // cohérent avec nos montants HT), date, et le lien éventuel vers une
    // facture (LinkedTxn) pour rattacher à la bonne job.
    if (corps?.action === "credits") {
      const credits = [];
      for (let position = 1; position <= 401; position += 100) {
        const reponse = await requeteQbo(
          acces,
          `select * from CreditMemo startposition ${position} maxresults 100`
        );
        const page = reponse?.CreditMemo || [];
        for (const c of page) {
          // Montant HT = TotalAmt − taxe (TxnTaxDetail) quand présent.
          const total = Number(c?.TotalAmt) || 0;
          const taxe = Number(c?.TxnTaxDetail?.TotalTax) || 0;
          const factureLiee = (c?.Line || [])
            .flatMap((l) => l?.LinkedTxn || [])
            .find((lt) => lt?.TxnType === "Invoice");
          credits.push({
            id: c?.Id,
            numero: c?.DocNumber || "",
            client: c?.CustomerRef?.name || "",
            date: c?.TxnDate || null,
            montantHT: Math.round((total - taxe) * 100) / 100,
            total,
            factureLieeId: factureLiee?.TxnId || null,
          });
        }
        if (page.length < 100) break;
      }
      return Response.json({ credits, tronque: credits.length >= 500 });
    }

    // ⏱️ { action: "delais" } — TEMPS DE PAIEMENT MOYEN PAR CLIENT
    // (2026-09-06, demande du propriétaire). Les PAIEMENTS des 12
    // derniers mois sont lus du registre, rattachés à leurs factures
    // (LinkedTxn), puis chaque facture SOLDÉE donne un délai : date du
    // dernier paiement − date d'émission. Moyenne et pire cas par
    // client. Lecture seule — la vérité vient du registre, jamais
    // d'une supposition.
    if (corps?.action === "delais") {
      const depuis = new Date();
      depuis.setMonth(depuis.getMonth() - 12);
      const dateDepuis = depuis.toISOString().slice(0, 10);
      // 1. Les paiements → date du DERNIER paiement par facture (une
      //    facture payée en deux fois est réglée au 2e versement).
      const paiementParFacture = new Map();
      for (let position = 1; position <= 401; position += 100) {
        const reponse = await requeteQbo(
          acces,
          `select * from Payment where TxnDate >= '${dateDepuis}' startposition ${position} maxresults 100`
        );
        const page = reponse?.Payment || [];
        for (const p of page) {
          const datePaiement = p?.TxnDate || null;
          if (!datePaiement) continue;
          for (const ligne of p?.Line || []) {
            for (const lien of ligne?.LinkedTxn || []) {
              if (lien?.TxnType !== "Invoice" || !lien?.TxnId) continue;
              const id = String(lien.TxnId).replace(/[^0-9]/g, "");
              if (!id) continue;
              const deja = paiementParFacture.get(id);
              if (!deja || datePaiement > deja) paiementParFacture.set(id, datePaiement);
            }
          }
        }
        if (page.length < 100) break;
      }
      // 2. Les factures correspondantes (émission, client, solde) —
      //    par lots de 40, la clause « in » de QuickBooks a une limite.
      const ids = [...paiementParFacture.keys()];
      const parClient = new Map();
      for (let i = 0; i < ids.length; i += 40) {
        const liste = ids.slice(i, i + 40).map((x) => `'${x}'`).join(",");
        const reponse = await requeteQbo(acces, `select * from Invoice where Id in (${liste})`);
        for (const f of reponse?.Invoice || []) {
          if ((Number(f?.Balance) || 0) > 0) continue; // encore un solde : pas réglée
          const emission = f?.TxnDate || null;
          const paiement = paiementParFacture.get(String(f?.Id));
          if (!emission || !paiement) continue;
          const jours = Math.round((Date.parse(paiement) - Date.parse(emission)) / 86400000);
          if (jours < 0) continue; // acompte daté avant la facture : ignoré
          const nom = f?.CustomerRef?.name || "Sans client";
          const e = parClient.get(nom) || { nom, nb: 0, totalJours: 0, pire: 0 };
          e.nb += 1;
          e.totalJours += jours;
          if (jours > e.pire) e.pire = jours;
          parClient.set(nom, e);
        }
      }
      const clientsDelais = [...parClient.values()]
        .map((e) => ({ nom: e.nom, nb: e.nb, moyenneJours: Math.round(e.totalJours / e.nb), pireJours: e.pire }))
        .sort((a, b) => b.moyenneJours - a.moyenneJours);
      const totalNb = clientsDelais.reduce((s, c) => s + c.nb, 0);
      const totalJours = [...parClient.values()].reduce((s, c) => s + c.totalJours, 0);
      return Response.json({
        clients: clientsDelais,
        global: totalNb > 0 ? { nb: totalNb, moyenneJours: Math.round(totalJours / totalNb) } : null,
        depuis: dateDepuis,
      });
    }

    return Response.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
