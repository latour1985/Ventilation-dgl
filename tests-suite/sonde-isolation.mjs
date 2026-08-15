// tests-suite/sonde-isolation.mjs
//
// LE TEST-SONDE D'ÉTANCHÉITÉ — la condition de levée du verrou.
//
// Un compte-espion d'une entreprise B essaie de LIRE et d'ÉCRIRE dans
// les données de l'entreprise A (dgl), table par table. Résultat exigé :
// ZÉRO ligne lue, ZÉRO écriture acceptée, partout. Tant que cette sonde
// ne passe pas à 100 %, le verrou d'isolation de la plateforme reste
// fermé et AUCUNE entreprise cliente n'est créée.
//
// À exécuter LE GRAND SOIR, après la bascule des politiques RLS
// multi-locataires, puis après CHAQUE modification de politique :
//
//   1. Créer dans Supabase Auth un compte de test « sonde@exemple.com »
//      avec app_metadata: { "entreprise_id": "sonde-test" } (PAS dgl).
//   2. node tests-suite/sonde-isolation.mjs <URL_SUPABASE> <CLE_ANON> sonde@exemple.com <mot_de_passe>
//   3. Exigence : « ÉTANCHE » sur toutes les tables. Un seul « FUITE »
//      = le verrou reste fermé, on répare, on relance.

import { createClient } from "@supabase/supabase-js";

const [url, cleAnon, courriel, motDePasse] = process.argv.slice(2);
if (!url || !cleAnon || !courriel || !motDePasse) {
  console.log("Usage : node tests-suite/sonde-isolation.mjs <URL_SUPABASE> <CLE_ANON> <courriel_sonde> <mot_de_passe>");
  process.exit(1);
}

const TABLES = [
  "clients_app", "projets_app", "devis_app", "taches_attente", "taches_assignees",
  "travaux_effectues", "bons_travail", "depots", "prix_depots", "taux_metiers",
  "pieces_commandees", "inspections_vehicules", "entretiens_vehicules",
  "carnet_vehicules", "camions", "fournisseurs", "repertoire_employes",
  "permissions_utilisateurs", "compteurs", "journal_activite",
  "qb_attributions_manuelles", "entreprises", "quickbooks_connexion",
];

const supabase = createClient(url, cleAnon);
const { error: erreurConnexion } = await supabase.auth.signInWithPassword({ email: courriel, password: motDePasse });
if (erreurConnexion) {
  console.log(`✗ Connexion de la sonde refusée : ${erreurConnexion.message}`);
  process.exit(1);
}

let fuites = 0;
console.log("SONDE D'ISOLATION — l'espion (entreprise 'sonde-test') attaque les données de 'dgl'\n");

for (const table of TABLES) {
  // ATTAQUE 1 : lire les lignes de dgl.
  const { data, error } = await supabase.from(table).select("*").eq("entreprise_id", "dgl").limit(5);
  const lignesVues = error ? 0 : (data || []).length;
  // ATTAQUE 2 : écrire une ligne étiquetée dgl (doit être refusée).
  const { error: erreurEcriture } = await supabase.from(table).insert({ entreprise_id: "dgl" });
  const ecritureRefusee = !!erreurEcriture;

  const etanche = lignesVues === 0 && ecritureRefusee;
  if (!etanche) fuites++;
  console.log(
    `${etanche ? "✓ ÉTANCHE" : "✗ FUITE  "}  ${table.padEnd(28)} lecture: ${lignesVues} ligne(s) · écriture: ${ecritureRefusee ? "refusée" : "ACCEPTÉE ⚠️"}`
  );
}

console.log(
  fuites === 0
    ? "\n✅ 100 % ÉTANCHE — le verrou d'isolation peut être levé (plateforme_config → isolation_activee = 'oui')."
    : `\n⛔ ${fuites} table(s) qui FUIENT — le verrou RESTE FERMÉ. On répare les politiques et on relance la sonde.`
);
process.exit(fuites === 0 ? 0 : 1);
