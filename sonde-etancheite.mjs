// sonde-etancheite.mjs — LE TEST-SONDE DU GRAND SOIR (2026-09-04).
//
// Se connecte avec un compte-espion (une entreprise ÉTRANGÈRE, jamais
// « dgl ») et tente de lire CHAQUE table d'entreprise, puis d'écrire en
// se faisant passer pour DGL. Attendu : ZÉRO ligne lue partout, et
// toute écriture ré-étiquetée de force dans sa propre bulle.
//
// Préparation (une fois) :
//   1. Supabase → Authentication → Users → Add user :
//      courriel sonde@etancheite.test + mot de passe (auto-confirm).
//   2. Passer le snippet 86 (étiquette « sonde-entreprise-test »).
// Exécution :
//   node sonde-etancheite.mjs sonde@etancheite.test <motdepasse>
//
// La création d'entreprises réelles ne se permet QUE si ce script
// affiche « ÉTANCHÉITÉ CONFIRMÉE » sur toute la ligne.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Lit .env.local (jamais commité) pour l'URL et la clé anonyme — la
// même que le navigateur : la sonde n'a AUCUN privilège.
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const [courriel, motDePasse] = process.argv.slice(2);
if (!courriel || !motDePasse) {
  console.log("Usage : node sonde-etancheite.mjs <courriel-sonde> <motdepasse>");
  process.exit(1);
}

const TABLES_ENTREPRISE = [
  "clients_app", "projets_app", "devis_app", "taches_attente", "taches_assignees",
  "travaux_effectues", "bons_travail", "depots", "pieces_commandees", "achats_libres",
  "qb_attributions_manuelles", "journal_activite", "retours_logiciel", "commandes_camion",
  "photos_legendes", "articles_fournisseurs", "fournisseurs", "sous_traitants_app",
  "camions", "inspections_vehicules", "entretiens_vehicules", "carnet_vehicules",
  "catalogue_items", "taux_metiers", "prix_depots", "repertoire_employes",
  "permissions_utilisateurs", "compteurs", "push_abonnements",
];
const TABLES_VERROUILLEES = [
  "quickbooks_connexion", "connexion_echecs", "plateforme_config", "entreprises",
];

const { data: session, error: errConn } = await supabase.auth.signInWithPassword({ email: courriel, password: motDePasse });
if (errConn || !session?.session) {
  console.log("❌ Connexion de la sonde impossible :", errConn?.message || "?");
  process.exit(1);
}
const claims = session.session.user.app_metadata || {};
console.log(`🕵️ Sonde connectée : ${courriel} · entreprise revendiquée : ${claims.entreprise_id || "(aucune)"} · plateforme : ${claims.plateforme === true}`);
if (claims.entreprise_id === "dgl" || claims.plateforme === true) {
  console.log("❌ Ce compte est DGL ou plateforme — la sonde doit être une entreprise ÉTRANGÈRE (snippet 86).");
  process.exit(1);
}

let fuites = 0;

// ---- 1. LECTURE : chaque table doit rendre ZÉRO ligne. ----
for (const t of [...TABLES_ENTREPRISE, ...TABLES_VERROUILLEES]) {
  const { data, error } = await supabase.from(t).select("*").limit(3);
  if (error) {
    console.log(`  🔒 ${t} — accès refusé (${error.code || "erreur"}) : parfait`);
  } else if ((data || []).length === 0) {
    console.log(`  ✅ ${t} — 0 ligne visible`);
  } else {
    fuites++;
    console.log(`  🚨 FUITE ${t} — ${data.length} ligne(s) visibles ! Exemple :`, JSON.stringify(data[0]).slice(0, 160));
  }
}

// ---- 2. ÉCRITURE USURPÉE : s'inventer une ligne « dgl ». ----
const { data: ecrite, error: errEcrit } = await supabase
  .from("clients_app")
  .insert({ id: `sonde-${Date.now()}`, nom: "SONDE — à supprimer", entreprise_id: "dgl" })
  .select()
  .single();
if (errEcrit) {
  console.log(`  ✅ écriture usurpée « dgl » REFUSÉE (${errEcrit.code || errEcrit.message})`);
} else if (ecrite?.entreprise_id !== "dgl") {
  console.log(`  ✅ écriture acceptée mais RÉ-ÉTIQUETÉE de force → « ${ecrite.entreprise_id} » (le trigger l'emporte)`);
  await supabase.from("clients_app").delete().eq("id", ecrite.id);
} else {
  fuites++;
  console.log("  🚨 FUITE MAJEURE : la sonde a écrit une ligne étiquetée « dgl » !");
  await supabase.from("clients_app").delete().eq("id", ecrite.id);
}

console.log("");
if (fuites === 0) {
  console.log("🟢 ÉTANCHÉITÉ CONFIRMÉE — aucune fuite sur", TABLES_ENTREPRISE.length + TABLES_VERROUILLEES.length, "tables + test d'usurpation.");
  console.log("   Le verrou de création d'entreprises peut être levé (plateforme_config : isolation_activee = oui).");
} else {
  console.log(`🔴 ${fuites} FUITE(S) — NE PAS créer d'entreprise. Corriger, repasser le snippet 85, resonder.`);
  process.exit(1);
}
