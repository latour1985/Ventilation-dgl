// lib/supabase/depots.js
//
// Dépôts préalables : créés à la création d'une tâche « dépôt requis »,
// ils bloquent la planification tant qu'ils ne sont pas payés. Le
// paiement réel (facture QuickBooks + webhook) arrive en Phase 4 —
// d'ici là : déblocage manuel par l'admin (Comptant/Chèque/Interac) et
// annulation automatique après 24 h.

import { supabase } from "./client";

// Taxes d'un dépôt. Les taux viennent des Paramètres de l'entreprise
// (`config`) ; sans configuration fournie, on retombe sur les taux du
// Québec — c'est le même repli que partout ailleurs.
export function taxesDepot(montantHT, config) {
  const ht = Number(montantHT) || 0;
  const tps = ht * ((config?.tauxTps ?? 5) / 100);
  const tvq = ht * ((config?.tauxTvq ?? 9.975) / 100);
  return { ht, tps, tvq, total: ht + tps + tvq };
}

function versUi(row) {
  return {
    tacheId: row.tache_id,
    statut: row.statut,
    montantHT: Number(row.montant_ht) || 0,
    qboInvoiceId: row.qbo_depot_invoice_id || null,
    dateLimite: row.date_limite,
    isProspect: !!row.is_prospect,
    prospectNom: row.prospect_nom || "",
    prospectCourriel: row.prospect_courriel || "",
    prospectTelephone: row.prospect_telephone || "",
    prospectAdresse: row.prospect_adresse || "",
    modePaiement: row.mode_paiement || null,
    payeLe: row.paye_le || null,
    payePar: row.paye_par || null,
  };
}

export async function listerDepots() {
  const { data, error } = await supabase.from("depots").select("*");
  if (error) throw error;
  const parTache = {};
  (data || []).forEach((r) => {
    parTache[r.tache_id] = versUi(r);
  });
  return parTache;
}

// Création à la création de la tâche — date limite = maintenant + 24 h.
// `joursLimite` permet d'allonger le délai : pour les frais de
// déplacement d'une pièce DÉJÀ reçue, on donne 7 jours — la pièce est
// sur la tablette, on ne perd rien à attendre, contrairement à une
// réservation spontanée d'appel de service.
export async function creerDepot(tacheId, { montantHT, isProspect, prospect, joursLimite = 1 }) {
  const dateLimite = new Date(Date.now() + (Number(joursLimite) || 1) * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("depots").upsert({
    tache_id: tacheId,
    statut: "en_attente_paiement",
    montant_ht: Number(montantHT) || 0,
    date_limite: dateLimite,
    is_prospect: !!isProspect,
    prospect_nom: prospect?.nom || null,
    prospect_courriel: prospect?.courriel || null,
    prospect_telephone: prospect?.telephone || null,
    prospect_adresse: prospect?.adresse || null,
  });
  if (error) throw error;
  return dateLimite;
}

// Déblocage manuel par l'admin (paiement reçu hors QuickBooks).
export async function marquerDepotPayeManuellement(tacheId, modePaiement, parNom) {
  const { error } = await supabase
    .from("depots")
    .update({
      statut: "paye_manuellement",
      mode_paiement: modePaiement,
      paye_le: new Date().toISOString(),
      paye_par: parNom || "l'administrateur",
    })
    .eq("tache_id", tacheId);
  if (error) throw error;
}

// Annulation automatique — délai de 24 h dépassé sans paiement.
export async function annulerDepotDelai(tacheId) {
  const { error } = await supabase
    .from("depots")
    .update({ statut: "annule_delai" })
    .eq("tache_id", tacheId)
    .eq("statut", "en_attente_paiement"); // ne touche jamais un dépôt déjà payé
  if (error) throw error;
}

export function sAbonnerDepots(onChangement) {
  const canal = supabase
    .channel("depots")
    .on("postgres_changes", { event: "*", schema: "public", table: "depots" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
