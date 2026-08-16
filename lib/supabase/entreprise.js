// lib/supabase/entreprise.js
//
// CONFIGURATION DE L'ENTREPRISE — coordonnées, numéros officiels, taux
// de taxes et règles de paie. Avant, tout cela était écrit en dur dans
// le code : changer un numéro de téléphone demandait une modification
// du code source.
//
// ------------------------------------------------------------
// CONÇU MULTI-ENTREPRISES DÈS LE DÉPART
// ------------------------------------------------------------
// La table `entreprises` contient UNE LIGNE PAR ENTREPRISE. Aujourd'hui
// il n'y en a qu'une (Ventilation DGL), et l'application charge la
// première. Le jour où l'application servira à d'autres entreprises,
// il suffira de rattacher chaque utilisateur à la sienne (colonne
// entreprise_id sur permissions_utilisateurs) et de remplacer
// `chargerEntreprise()` par une lecture filtrée sur ce rattachement —
// sans rien changer au reste de l'application.
//
// ⚠️ AVANT d'ouvrir à une deuxième entreprise : les politiques d'accès
// (RLS) doivent être resserrées pour que chaque entreprise ne voie QUE
// ses propres données. En mode test actuel, elles sont permissives.

import { supabase } from "./client";

// Valeurs par défaut — servent de repli si la table n'existe pas encore
// (snippet SQL 23 non exécuté) pour que rien ne casse.
export const CONFIG_DEFAUT = {
  id: "dgl",
  nomLegal: "Ventilation DGL inc.",
  nomCommercial: "",
  adresse: "771 Boul Industriel, Blainville QC J7C 3V3",
  telephone: "(450) 543-9855",
  telephoneUrgence: "",
  courriel: "info@ventilationdgl.com",
  courrielFacturation: "",
  siteWeb: "",
  numeroTps: "710702689 RT0001",
  numeroTvq: "1226324573 TQ0001",
  numeroRbq: "5768-7014-01",
  numeroNeq: "",
  membreCmmtq: true,
  // Taux de taxes — modifiables si la loi change (la TVQ a déjà changé).
  tauxTps: 5,
  tauxTvq: 9.975,
  termePaiementDefaut: "Net 30",
  noteFacture: "",
  // Règles de paie
  seuilHeuresSupp: 40,
  minutesDiner: 30,
  heureBasculeNuit: 16,
  premierJourSemaine: 0, // 0 = dimanche
  // Marge sous ce % = ROUGE dans l'analyse de rentabilité.
  seuilMargeAlerte: 25,
  // Début de l'année FISCALE ("MM-JJ") — bien des entreprises ne
  // finissent pas leur année le 31 décembre. L'analyse de rentabilité
  // offre « Année fiscale » calculée date à date depuis ce jalon.
  debutAnneeFiscale: "01-01",
  // Associations professionnelles affichées sur les documents — chaque
  // entreprise coche les SIENNES (cmmtq / cetaf / cmeq).
  associations: ["cmmtq"],
  // RÈGLES DES APPELS DE SERVICE — chaque entreprise a les siennes.
  appelsDepotDefaut: true, // dépôt auto-coché à la création d'un appel
  delaiDepotHeures: 24, // délai de paiement du dépôt
  trancheFacturationMin: 15, // tranches ENTAMÉES du temps supplémentaire
  // PAIEMENTS EN LIGNE (QuickBooks Payments) — pour les APPELS DE
  // SERVICE seulement (chemin automatique). Les autres factures
  // demanderont un choix À L'ENVOI (chantier 4). Défaut : tout ÉTEINT —
  // offrir un mode de paiement est un geste volontaire du propriétaire.
  // RÈGLE QUÉBEC : les frais du marchand ne s'ajoutent JAMAIS à la
  // facture du client (LPC) — ils sont un coût interne, d'où le seuil.
  paiementCarteAppels: false,
  paiementVirementAppels: false,
  // Au-dessus de ce montant HT, la carte s'éteint même sur le chemin
  // automatique (2,9 % sur un gros montant = frais déraisonnables).
  seuilCarteAppels: 2000,
  // Coût horaire d'un camion ($/h). Sert DEUX fois avec le même chiffre,
  // parce que c'est le même camion : (1) au coûtant des jobs — chaque
  // heure d'un technicien qui a un camion coûte ça de plus ; (2) au
  // facturable — le 2e technicien assis dans le camion d'un collègue se
  // facture au taux vendant MOINS ce montant (il n'amène pas de camion).
  coutCamionHoraire: 15,
};

function versUi(row) {
  return {
    id: row.id,
    nomLegal: row.nom_legal || CONFIG_DEFAUT.nomLegal,
    nomCommercial: row.nom_commercial || "",
    adresse: row.adresse || "",
    telephone: row.telephone || "",
    telephoneUrgence: row.telephone_urgence || "",
    courriel: row.courriel || "",
    courrielFacturation: row.courriel_facturation || "",
    siteWeb: row.site_web || "",
    numeroTps: row.numero_tps || "",
    numeroTvq: row.numero_tvq || "",
    numeroRbq: row.numero_rbq || "",
    numeroNeq: row.numero_neq || "",
    // Associations : la colonne moderne d'abord, sinon l'ancien booléen
    // CMMTQ (fiches d'avant le snippet 55).
    associations: Array.isArray(row.associations)
      ? row.associations
      : row.membre_cmmtq !== false
        ? ["cmmtq"]
        : [],
    membreCmmtq: (Array.isArray(row.associations) ? row.associations : row.membre_cmmtq !== false ? ["cmmtq"] : []).includes("cmmtq"),
    appelsDepotDefaut: row.appels_depot_defaut !== false,
    delaiDepotHeures: row.delai_depot_heures != null ? Number(row.delai_depot_heures) : CONFIG_DEFAUT.delaiDepotHeures,
    trancheFacturationMin: row.tranche_facturation_min != null ? Number(row.tranche_facturation_min) : CONFIG_DEFAUT.trancheFacturationMin,
    tauxTps: row.taux_tps != null ? Number(row.taux_tps) : CONFIG_DEFAUT.tauxTps,
    tauxTvq: row.taux_tvq != null ? Number(row.taux_tvq) : CONFIG_DEFAUT.tauxTvq,
    termePaiementDefaut: row.terme_paiement_defaut || "",
    noteFacture: row.note_facture || "",
    seuilHeuresSupp: row.seuil_heures_supp != null ? Number(row.seuil_heures_supp) : CONFIG_DEFAUT.seuilHeuresSupp,
    minutesDiner: row.minutes_diner != null ? Number(row.minutes_diner) : CONFIG_DEFAUT.minutesDiner,
    heureBasculeNuit: row.heure_bascule_nuit != null ? Number(row.heure_bascule_nuit) : CONFIG_DEFAUT.heureBasculeNuit,
    premierJourSemaine: row.premier_jour_semaine != null ? Number(row.premier_jour_semaine) : 0,
    seuilMargeAlerte: row.seuil_marge_alerte != null ? Number(row.seuil_marge_alerte) : CONFIG_DEFAUT.seuilMargeAlerte,
    debutAnneeFiscale: row.debut_annee_fiscale || CONFIG_DEFAUT.debutAnneeFiscale,
    // 🧩 Modules activés pour CETTE entreprise (null = tous — DGL).
    modules: Array.isArray(row.modules) ? row.modules : null,
    paiementCarteAppels: row.paiement_carte_appels === true,
    paiementVirementAppels: row.paiement_virement_appels === true,
    seuilCarteAppels: row.seuil_carte_appels != null ? Number(row.seuil_carte_appels) : CONFIG_DEFAUT.seuilCarteAppels,
    coutCamionHoraire: row.cout_camion_horaire != null ? Number(row.cout_camion_horaire) : CONFIG_DEFAUT.coutCamionHoraire,
  };
}

// Charge la configuration de l'entreprise. Voir la note multi-entreprises
// en tête de fichier pour le passage à plusieurs.
export async function chargerEntreprise() {
  const { data, error } = await supabase.from("entreprises").select("*").order("created_at").limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return CONFIG_DEFAUT;
  return versUi(data[0]);
}

export async function sauvegarderEntreprise(c) {
  const { error } = await supabase.from("entreprises").upsert({
    id: c.id || "dgl",
    nom_legal: c.nomLegal,
    nom_commercial: c.nomCommercial || null,
    adresse: c.adresse || null,
    telephone: c.telephone || null,
    telephone_urgence: c.telephoneUrgence || null,
    courriel: c.courriel || null,
    courriel_facturation: c.courrielFacturation || null,
    site_web: c.siteWeb || null,
    numero_tps: c.numeroTps || null,
    numero_tvq: c.numeroTvq || null,
    numero_rbq: c.numeroRbq || null,
    numero_neq: c.numeroNeq || null,
    membre_cmmtq: (Array.isArray(c.associations) ? c.associations : ["cmmtq"]).includes("cmmtq"),
    associations: Array.isArray(c.associations) ? c.associations : ["cmmtq"],
    appels_depot_defaut: c.appelsDepotDefaut !== false,
    delai_depot_heures: c.delaiDepotHeures ?? 24,
    tranche_facturation_min: c.trancheFacturationMin ?? 15,
    taux_tps: c.tauxTps ?? 5,
    taux_tvq: c.tauxTvq ?? 9.975,
    terme_paiement_defaut: c.termePaiementDefaut || null,
    note_facture: c.noteFacture || null,
    seuil_heures_supp: c.seuilHeuresSupp ?? 40,
    minutes_diner: c.minutesDiner ?? 30,
    heure_bascule_nuit: c.heureBasculeNuit ?? 16,
    premier_jour_semaine: c.premierJourSemaine ?? 0,
    seuil_marge_alerte: c.seuilMargeAlerte ?? 25,
    debut_annee_fiscale: c.debutAnneeFiscale || "01-01",
    modules: Array.isArray(c.modules) ? c.modules : null,
    paiement_carte_appels: !!c.paiementCarteAppels,
    paiement_virement_appels: !!c.paiementVirementAppels,
    seuil_carte_appels: c.seuilCarteAppels ?? 2000,
    cout_camion_horaire: c.coutCamionHoraire ?? 15,
  });
  if (error) throw error;
}

// Facteur multiplicateur taxes incluses (ex. 1.14975 pour 5 % + 9,975 %).
export function facteurTaxes(config) {
  const tps = (config?.tauxTps ?? 5) / 100;
  const tvq = (config?.tauxTvq ?? 9.975) / 100;
  return 1 + tps + tvq;
}

// Décomposition d'un montant hors taxes : { tps, tvq, total }.
export function calculerTaxes(montantHT, config) {
  const m = Number(montantHT) || 0;
  const tps = m * ((config?.tauxTps ?? 5) / 100);
  const tvq = m * ((config?.tauxTvq ?? 9.975) / 100);
  return { tps, tvq, total: m + tps + tvq };
}
