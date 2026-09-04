// app/api/quickbooks/estimates-reponses/route.js
//
// 🔁 LA RÉPONSE DU CLIENT REDESCEND DANS QUICKBOOKS (2026-08-30, GO du
// propriétaire : « il envoie la commande à Fluxya ET QuickBooks qu'il
// est accepté »).
//
// La PREUVE d'acceptation naît dans Fluxya (conditions vues, texte
// exact conservé, nom, date) — QuickBooks n'est que le REFLET : quand
// un client accepte ou refuse sur son lien, l'estimate du dossier passe
// à « Accepted » (avec AcceptedBy + AcceptedDate) ou « Rejected ».
//
// Appelée par le sondage des 3 minutes (même rythme que les dépôts).
// Un champ additif `qbo_reponse_transmise_le` (snippet 110) se souvient
// de ce qui a déjà été transmis : jamais de doublon, et un échec
// QuickBooks se réessaie tout seul au passage suivant.
//
// GARDE-FOUS :
//   • jamais sur un devis ANNULÉ (statut annule) — son estimate est déjà
//     « Rejected » par le chemin d'annulation, le sondage ne doit pas le
//     remettre « Accepted » sur la foi de l'ancienne réponse ;
//   • seulement la VERSION ACTIVE — une révision remet les compteurs.

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  requeteQbo,
  ecrireQbo,
  echapperQbo,
  utilisateurDepuisJeton,
  entrepriseDuCompte,
  clientQboPour,
  articleServiceQboPour,
  codeTaxeVente,
  proprietesTaxe,
} from "@/lib/quickbooksServeur";
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  const admin = clientSupabaseService();

  // Les réponses de clients pas encore reflétées dans QuickBooks.
  const { data: aTransmettre, error } = await admin
    .from("devis_app")
    .select("id, numero, numero_base, client_id, client_nom, lignes, qbo_estimate_id, reponse_client, repondu_par_nom, repondu_le")
    .eq("entreprise_id", entrepriseId)
    .neq("version_active", false)
    .neq("statut", "annule")
    .in("reponse_client", ["accepte", "refuse"])
    .is("qbo_reponse_transmise_le", null)
    .not("qbo_estimate_id", "is", null)
    .limit(20);
  if (error) {
    // Colonne absente (snippet 110 pas encore passé) : on le dit en
    // clair plutôt que d'échouer en silence à chaque passage.
    if (/qbo_reponse_transmise_le/.test(error.message || "")) {
      return Response.json({ colonneAbsente: true });
    }
    return Response.json({ erreur: error.message }, { status: 502 });
  }
  if (!aTransmettre || aTransmettre.length === 0) return Response.json({ transmis: [] });

  let acces;
  try {
    acces = await jetonAccesValide(entrepriseId);
  } catch {
    return Response.json({ nonConnecte: true });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  const transmis = [];
  const echecs = [];
  for (const d of aTransmettre) {
    const estimateId = String(d.qbo_estimate_id || "").replace(/[^0-9]/g, "");
    if (!estimateId) continue;
    const marquerFait = () =>
      admin
        .from("devis_app")
        .update({ qbo_reponse_transmise_le: new Date().toISOString() })
        .eq("id", d.id)
        .eq("entreprise_id", entrepriseId)
        .is("qbo_reponse_transmise_le", null);
    try {
      const lu = await requeteQbo(acces, `select Id, SyncToken from Estimate where Id = '${echapperQbo(estimateId)}' maxresults 1`);
      const est = lu?.Estimate?.[0];
      if (!est) {
        // Estimate supprimé côté QuickBooks : on note et on N'INSISTE
        // PAS (sinon le sondage réessaierait toutes les 3 minutes).
        await marquerFait();
        echecs.push({ numero: d.numero, erreur: "estimate introuvable dans QuickBooks" });
        continue;
      }
      const accepte = d.reponse_client === "accepte";
      const champsAcceptation = accepte
        ? {
            // Le NOM du client et la DATE de sa réponse — les champs
            // prévus par QuickBooks. La preuve complète (conditions
            // signées) reste dans Fluxya.
            AcceptedBy: String(d.repondu_par_nom || "").slice(0, 100) || undefined,
            AcceptedDate: d.repondu_le ? String(d.repondu_le).slice(0, 10) : undefined,
          }
        : {};
      // ✅ ACCEPTATION : l'estimate est RÉÉCRIT avec les LIGNES de la
      // version acceptée (2026-08-31 — avec les OPTIONS comparables, le
      // client peut choisir une version DIFFÉRENTE de la dernière
      // enregistrée : QuickBooks doit montrer « Accepté » sur les BONS
      // montants, jamais sur ceux d'une autre option).
      let reecritAvecLignes = false;
      if (accepte) {
        const lignesQbo = (Array.isArray(d.lignes) ? d.lignes : [])
          .map((l) => ({
            description: String(l?.nom || l?.description || "").slice(0, 2000),
            quantite: Number(l?.quantite) || 1,
            prixUnitaire: Number(l?.prix_vendant) || 0,
          }))
          .filter((l) => l.description && l.prixUnitaire !== 0);
        if (lignesQbo.length > 0) {
          const [customerId, itemId, codeTaxe] = await Promise.all([
            clientQboPour(acces, admin, { clientId: d.client_id || null, clientNom: d.client_nom || "" }),
            articleServiceQboPour(acces),
            codeTaxeVente(acces),
          ]);
          if (customerId && itemId) {
            await ecrireQbo(acces, "estimate", {
              Id: est.Id,
              SyncToken: est.SyncToken,
              CustomerRef: { value: customerId },
              DocNumber: String(d.numero_base || d.numero).slice(0, 21),
              PrivateNote: `Devis ${d.numero_base || d.numero} — accepté par le client via Fluxya`,
              ...proprietesTaxe(codeTaxe),
              TxnStatus: "Accepted",
              ...champsAcceptation,
              Line: lignesQbo.map((l) => ({
                DetailType: "SalesItemLineDetail",
                Amount: Math.round(l.quantite * l.prixUnitaire * 100) / 100,
                Description: l.description,
                SalesItemLineDetail: {
                  ItemRef: { value: itemId },
                  Qty: l.quantite,
                  UnitPrice: l.prixUnitaire,
                  ...(codeTaxe ? { TaxCodeRef: { value: codeTaxe } } : {}),
                },
              })),
            });
            reecritAvecLignes = true;
          }
        }
      }
      if (!reecritAvecLignes) {
        // Refus, ou repli si la réécriture complète est impossible
        // (client QBO introuvable…) : au moins le STATUT, en partiel.
        await ecrireQbo(acces, "estimate", {
          Id: est.Id,
          SyncToken: est.SyncToken,
          sparse: true,
          TxnStatus: accepte ? "Accepted" : "Rejected",
          ...champsAcceptation,
        });
      }
      await marquerFait();
      transmis.push({ numero: d.numero, reponse: d.reponse_client, par: d.repondu_par_nom || null });
    } catch (e) {
      // Échec d'écriture : PAS de marquage — le prochain passage réessaie.
      echecs.push({ numero: d.numero, erreur: String(e?.message || "QuickBooks injoignable") });
    }
  }

  return Response.json({ transmis, echecs });
}
