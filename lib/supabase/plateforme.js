// lib/supabase/plateforme.js
//
// LA PLATEFORME — le registre des entreprises clientes (3e interface,
// /plateforme). Séparée de l'admin DGL : un futur employé du logiciel
// gérera les entreprises SANS jamais voir leur contenu opérationnel.
//
// PRINCIPE DE MINIMISATION (Loi 25, et argument de confiance auprès des
// fondateurs) : la plateforme lit la FICHE des entreprises (nom, statut,
// dates) — jamais leurs clients, salaires ou travaux. La seule
// exception est l'EXPORT COMPLET, un geste explicite prévu par
// l'entente (« leurs données leur appartiennent ») et journalisé.

import { supabase } from "./client";

// ------------------------------------------------------------
// REGISTRE DES ENTREPRISES
// ------------------------------------------------------------
export async function listerEntreprisesPlateforme() {
  const { data, error } = await supabase
    .from("entreprises")
    .select("id, nom_legal, nom_commercial, courriel, statut_plateforme, gratuit_jusqua, suspendue, created_at, modules")
    .order("created_at");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    nom: r.nom_commercial || r.nom_legal || r.id,
    courriel: r.courriel || "",
    statut: r.statut_plateforme || "proprietaire",
    gratuitJusqua: r.gratuit_jusqua || null,
    suspendue: !!r.suspendue,
    modules: Array.isArray(r.modules) ? r.modules : null,
    creeLe: r.created_at || null,
  }));
}

export async function majEntreprisePlateforme(id, champs) {
  const { error } = await supabase.from("entreprises").update(champs).eq("id", id);
  if (error) throw error;
}

// Le VERROU D'ISOLATION — la création d'entreprises est refusée tant
// que le grand soir (RLS multi-locataires + test-sonde) n'a pas été
// passé et le drapeau basculé à « oui ».
export async function verrouIsolation() {
  const { data } = await supabase.from("plateforme_config").select("valeur").eq("cle", "isolation_activee").maybeSingle();
  return data?.valeur === "oui";
}

// ------------------------------------------------------------
// REGISTRE DES INCIDENTS DE CONFIDENTIALITÉ — obligation Loi 25.
// Tenu même vide ; un incident « sérieux » exige de notifier la
// Commission d'accès à l'information et les personnes touchées.
// ------------------------------------------------------------
export async function listerIncidents() {
  const { data, error } = await supabase
    .from("incidents_confidentialite")
    .select("*")
    .order("date_incident", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function creerIncident(incident, session) {
  const { error } = await supabase.from("incidents_confidentialite").insert({
    date_incident: incident.dateIncident,
    description: incident.description,
    gravite: incident.gravite || "faible",
    mesures: incident.mesures || null,
    personnes_touchees: incident.personnesTouchees || null,
    notifie_cai: !!incident.notifieCai,
    notifie_personnes: !!incident.notifiePersonnes,
    cree_par: session?.user?.email || null,
  });
  if (error) throw error;
}

// ------------------------------------------------------------
// EXPORT COMPLET D'UNE ENTREPRISE — droit à la portabilité (Loi 25)
// et promesse de l'entente fondateurs. Rassemble toutes les lignes
// étiquetées à cette entreprise, table par table, en un seul objet
// téléchargeable (JSON lisible par n'importe quel outil).
// ------------------------------------------------------------
const TABLES_ENTREPRISE = [
  "clients_app", "projets_app", "devis_app", "taches_attente", "taches_assignees",
  "travaux_effectues", "bons_travail", "depots", "prix_depots", "taux_metiers",
  "pieces_commandees", "inspections_vehicules", "entretiens_vehicules",
  "carnet_vehicules", "camions", "fournisseurs", "repertoire_employes",
  "permissions_utilisateurs", "compteurs", "journal_activite", "qb_attributions_manuelles",
];

export async function exporterEntreprise(entrepriseId) {
  const exportation = {
    entreprise: entrepriseId,
    genere_le: new Date().toISOString(),
    note: "Export complet des données — Loi 25 (portabilité). Les données appartiennent à l'entreprise.",
    tables: {},
  };
  for (const table of TABLES_ENTREPRISE) {
    const { data, error } = await supabase.from(table).select("*").eq("entreprise_id", entrepriseId).limit(10000);
    exportation.tables[table] = error ? { erreur: error.message } : data || [];
  }
  return exportation;
}
