// app/api/quickbooks/depots-payes/route.js
//
// SONDAGE DES DÉPÔTS PAYÉS (option A, décidée le 2026-08-22).
//
// Le fil était déjà attaché aux DEUX bouts : la facture de dépôt émise
// dans QuickBooks laisse son identifiant dans `depots.qbo_depot_invoice_id`,
// et QuickBooks connaît le solde de cette facture. Ce qui manquait,
// c'était le pont : sans lui, un client pouvait payer son dépôt dans
// QuickBooks sans que l'application le sache — la tâche restait bloquée
// « en attente de paiement » jusqu'à ce qu'un humain la débloque à la
// main.
//
// Cette route ferme la boucle : elle relit le solde des factures de
// dépôt encore en attente et marque payés ceux dont le solde est à
// ZÉRO. Elle est appelée par l'application au démarrage puis toutes les
// quelques minutes (voir sonderDepotsPayes côté client).
//
// POURQUOI UN SONDAGE ET PAS UN WEBHOOK : un webhook Intuit exige une
// application configurée chez eux, une adresse publique et la
// vérification d'une signature — pour un gain de délai (secondes vs
// minutes) sans valeur ici. Un dépôt payé n'a pas besoin d'être connu
// à la seconde ; il doit être connu SANS QUE PERSONNE Y PENSE. Le
// webhook reste possible plus tard PAR-DESSUS, sans rien jeter.
//
// LECTURE SEULE CÔTÉ QUICKBOOKS : on n'écrit que dans notre base.
//
// Réponses possibles :
//   { simule: true }      — variables d'environnement absentes
//   { nonConnecte: true } — config posée mais OAuth pas encore fait
//   { verifies, payes: [{ tacheId, docNumber, montant }],
//     annulees, reouvertes, echecs } — voir les passages plus bas.

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  requeteQbo,
  utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";
// 🔒 RLS phase 3 : le rôle vient de la table des permissions.
import { roleServeur } from "@/lib/quickbooksServeur";

// Protection contre l'injection dans une requête QBO (mêmes guillemets
// simples que le reste des routes QuickBooks).
function echapperQbo(v) {
  return String(v || "").replace(/'/g, "''");
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);

  // Un TECHNICIEN n'a rien à faire ici : les dépôts sont une affaire de
  // bureau (et son application ne montre aucun montant d'argent).
  if ((await roleServeur(utilisateur)) === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }

  if (!configQuickbooksPresente()) return Response.json({ simule: true });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  const admin = clientSupabaseService();

  // Les dépôts qui ATTENDENT un paiement et qui ont une facture émise.
  // Un dépôt sans facture QuickBooks (paiement comptant prévu) ne nous
  // concerne pas : c'est le déblocage manuel qui s'en charge.
  const { data: enAttente, error } = await admin
    .from("depots")
    .select("tache_id, statut, montant_ht, qbo_depot_invoice_id, qbo_depot_doc_number")
    .eq("statut", "en_attente_paiement")
    // 🏢 Multi-QuickBooks : SEULEMENT les dépôts de l'entreprise du
    // demandeur — son sondage ne vérifie jamais les factures des autres.
    .eq("entreprise_id", entrepriseId)
    .not("qbo_depot_invoice_id", "is", null);
  if (error) return Response.json({ erreur: error.message }, { status: 502 });

  // 🔄 DÉPÔTS DÉJÀ PAYÉS À REVÉRIFIER (2026-08-30, vécu par le
  // propriétaire) : il avait payé une facture de dépôt pour tester (la
  // tâche est passée « prête »), PUIS annulé le paiement ET la facture
  // dans QuickBooks — et rien ne bougeait : un dépôt marqué « payé »
  // n'était plus jamais revérifié. On surveille donc AUSSI les dépôts
  // payés VIA QUICKBOOKS dont la tâche attend encore dans la file —
  // ensemble petit et borné (une fois la tâche planifiée ou sortie de
  // la file, la comptabilité redevient une affaire d'humains).
  // Un dépôt payé COMPTANT/CHÈQUE (confirmé à la main) n'est jamais
  // touché : annuler sa facture dans QuickBooks est du ménage
  // comptable, pas un désistement du client.
  let aReverifier = [];
  {
    const [{ data: fils }, { data: payesAvant }] = await Promise.all([
      admin.from("taches_attente").select("id").eq("entreprise_id", entrepriseId),
      admin
        .from("depots")
        .select("tache_id, statut, montant_ht, qbo_depot_invoice_id, qbo_depot_doc_number")
        .eq("statut", "paye")
        .eq("mode_paiement", "QuickBooks")
        .eq("entreprise_id", entrepriseId)
        .not("qbo_depot_invoice_id", "is", null),
    ]);
    const dansLaFile = new Set((fils || []).map((t) => t.id));
    aReverifier = (payesAvant || []).filter((d) => dansLaFile.has(d.tache_id));
  }

  if ((!enAttente || enAttente.length === 0) && aReverifier.length === 0) {
    return Response.json({ verifies: 0, payes: [] });
  }

  let acces;
  try {
    acces = await jetonAccesValide(entrepriseId);
  } catch {
    return Response.json({ nonConnecte: true });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  // Une SEULE requête pour toutes les factures en attente (« Id in
  // (...) ») plutôt qu'un aller-retour par dépôt : le sondage tourne en
  // arrière-plan, il doit rester léger. QuickBooks plafonne à 1000
  // résultats — largement au-dessus du nombre de dépôts en attente
  // qu'une entreprise peut avoir.
  const ids = [...(enAttente || []), ...aReverifier].map((d) => `'${echapperQbo(d.qbo_depot_invoice_id)}'`).join(",");
  let facturesParId = {};
  try {
    const lu = await requeteQbo(
      acces,
      `select Id, Balance, TotalAmt, DocNumber from Invoice where Id in (${ids}) maxresults 1000`
    );
    (lu?.Invoice || []).forEach((f) => {
      facturesParId[String(f.Id)] = f;
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable — réessaie.") }, { status: 502 });
  }

  const payes = [];
  const annulees = [];
  // ÉCHECS D'ÉCRITURE (2026-08-30) : quand la base refuse une mise à
  // jour (vécu : la contrainte de statuts ne connaissait pas
  // 'annule_qb' avant le snippet 108), le sondage continuait EN
  // SILENCE — la tâche restait bloquée sans que personne sache
  // pourquoi. On remonte désormais la vraie raison à l'écran.
  const echecs = [];
  for (const d of enAttente || []) {
    const facture = facturesParId[String(d.qbo_depot_invoice_id)];
    // Facture introuvable : on ne touche à RIEN. Elle a pu être
    // supprimée ou appartenir à un autre environnement (Sandbox vs
    // production) — dans le doute, on laisse l'humain décider plutôt
    // que de débloquer une tâche sur une supposition.
    if (!facture) continue;
    const solde = Number(facture.Balance) || 0;
    const total = Number(facture.TotalAmt) || 0;

    // ⚠️ FACTURE ANNULÉE (VOID) DANS QUICKBOOKS (2026-08-29) : un VOID
    // met le TOTAL à zéro — donc le solde aussi. L'ancien test « solde
    // à zéro = payé » DÉBLOQUAIT alors la tâche comme si le client
    // avait payé (vécu par le propriétaire : deux tâches devenues
    // « prêtes » après annulation des factures). Un vrai dépôt facturé
    // est TOUJOURS > 0 : total à zéro = annulée, jamais payée.
    if (total <= 0) {
      const { data: majA, error: eA } = await admin
        .from("depots")
        .update({ statut: "annule_qb" })
        .eq("tache_id", d.tache_id)
        .eq("statut", "en_attente_paiement")
        .eq("entreprise_id", entrepriseId)
        .select("tache_id");
      if (eA) {
        echecs.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null, erreur: eA.message });
        continue;
      }
      if (!majA || majA.length === 0) continue;
      annulees.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null });
      continue;
    }
    if (solde > 0) continue;

    // Solde à zéro sur un total réel = le client a payé. On débloque.
    // Garde anti-course : la mise à jour ne s'applique QUE si le dépôt
    // est toujours « en attente » — si un admin vient de le débloquer à
    // la main entre-temps, son geste (et son mode de paiement) reste.
    const { data: maj, error: e2 } = await admin
      .from("depots")
      .update({
        statut: "paye",
        mode_paiement: "QuickBooks",
        paye_le: new Date().toISOString(),
        paye_par: "QuickBooks (paiement détecté)",
      })
      .eq("tache_id", d.tache_id)
      .eq("statut", "en_attente_paiement")
      .eq("entreprise_id", entrepriseId)
      .select("tache_id");
    if (e2) {
      echecs.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null, erreur: e2.message });
      continue;
    }
    if (!maj || maj.length === 0) continue;

    payes.push({
      tacheId: d.tache_id,
      docNumber: d.qbo_depot_doc_number || null,
      montant: Number(facture.TotalAmt) || 0,
    });
  }

  // Second passage : les dépôts déjà PAYÉS via QuickBooks (tâche encore
  // dans la file). Deux gestes comptables possibles après coup :
  //   facture ANNULÉE (total à 0)  -> même chemin que le VOID : dépôt
  //                                   « annule_qb », la tâche s'annule ;
  //   paiement ANNULÉ seulement    -> la facture redevient IMPAYÉE
  //                                   (solde > 0) : le dépôt RETOURNE
  //                                   « en attente de paiement » — la
  //                                   tâche ne doit plus être « prête »,
  //                                   l'argent n'a jamais été perçu.
  const reouvertes = [];
  for (const d of aReverifier) {
    const facture = facturesParId[String(d.qbo_depot_invoice_id)];
    if (!facture) continue; // introuvable : on ne touche à rien (même prudence qu'en haut)
    const solde = Number(facture.Balance) || 0;
    const total = Number(facture.TotalAmt) || 0;
    if (total <= 0) {
      const { data: majA, error: eA } = await admin
        .from("depots")
        .update({ statut: "annule_qb" })
        .eq("tache_id", d.tache_id)
        .eq("statut", "paye")
        .eq("entreprise_id", entrepriseId)
        .select("tache_id");
      if (eA) {
        echecs.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null, erreur: eA.message });
        continue;
      }
      if (majA && majA.length > 0) annulees.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null });
      continue;
    }
    if (solde <= 0) continue; // toujours payée : rien à faire
    const { data: majR, error: eR } = await admin
      .from("depots")
      .update({
        statut: "en_attente_paiement",
        mode_paiement: null,
        paye_le: null,
        paye_par: null,
        // Nouveau délai de 24 h : l'ancien est probablement déjà échu.
        date_limite: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("tache_id", d.tache_id)
      .eq("statut", "paye")
      .eq("entreprise_id", entrepriseId)
      .select("tache_id");
    if (eR) {
      echecs.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null, erreur: eR.message });
      continue;
    }
    if (majR && majR.length > 0) reouvertes.push({ tacheId: d.tache_id, docNumber: d.qbo_depot_doc_number || null });
  }

  return Response.json({ verifies: (enAttente || []).length + aReverifier.length, payes, annulees, reouvertes, echecs });
}
