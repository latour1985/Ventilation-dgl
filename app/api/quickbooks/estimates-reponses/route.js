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
} from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  const admin = clientSupabaseService();

  // Les réponses de clients pas encore reflétées dans QuickBooks.
  const { data: aTransmettre, error } = await admin
    .from("devis_app")
    .select("id, numero, qbo_estimate_id, reponse_client, repondu_par_nom, repondu_le")
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
      await ecrireQbo(acces, "estimate", {
        Id: est.Id,
        SyncToken: est.SyncToken,
        sparse: true,
        TxnStatus: accepte ? "Accepted" : "Rejected",
        // Le NOM du client et la DATE de sa réponse — les champs prévus
        // par QuickBooks pour ça. La preuve complète (conditions signées)
        // reste dans Fluxya.
        ...(accepte
          ? {
              AcceptedBy: String(d.repondu_par_nom || "").slice(0, 100) || undefined,
              AcceptedDate: d.repondu_le ? String(d.repondu_le).slice(0, 10) : undefined,
            }
          : {}),
      });
      await marquerFait();
      transmis.push({ numero: d.numero, reponse: d.reponse_client, par: d.repondu_par_nom || null });
    } catch (e) {
      // Échec d'écriture : PAS de marquage — le prochain passage réessaie.
      echecs.push({ numero: d.numero, erreur: String(e?.message || "QuickBooks injoignable") });
    }
  }

  return Response.json({ transmis, echecs });
}
