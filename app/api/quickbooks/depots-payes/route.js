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
//   { verifies, payes: [{ tacheId, docNumber, montant }] }

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  requeteQbo,
  utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

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
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
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
  if (!enAttente || enAttente.length === 0) return Response.json({ verifies: 0, payes: [] });

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
  const ids = enAttente.map((d) => `'${echapperQbo(d.qbo_depot_invoice_id)}'`).join(",");
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
  for (const d of enAttente) {
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

  return Response.json({ verifies: enAttente.length, payes, annulees, echecs });
}
