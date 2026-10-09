// app/api/sauvegarde/route.js
//
// 💾 SAUVEGARDE AUTOMATIQUE HEBDOMADAIRE (2026-08-27).
//
// La ceinture de sécurité des données : chaque lundi matin (cron
// Vercel — voir vercel.json), toutes les tables de l'application sont
// exportées en UN fichier JSON daté, rangé dans le bucket PRIVÉ
// « sauvegardes » du stockage Supabase. Rotation : les 8 plus récentes
// sont conservées (deux mois d'historique), le reste est effacé.
//
// SÉCURITÉ :
//   • la route n'EXPOSE jamais les données — elle les range dans un
//     bucket privé et ne répond que par un résumé (nombre de lignes) ;
//   • seul le cron (qui envoie « Authorization: Bearer <CRON_SECRET> »)
//     ou un ADMIN connecté peuvent la déclencher — partout, y compris
//     sur la version d'essai où CRON_SECRET n'existe pas (2026-10-09) ;
//   • verrou anti-rafale : s'il existe déjà une sauvegarde de moins de
//     20 heures, on ne refait rien.
//
// Une ligne au journal d'activité confirme chaque passage — le bureau
// voit la ceinture se boucler sans ouvrir Supabase.

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";
import { jourQuebec } from "@/lib/jourQuebec";

// TOUTES les tables applicatives — la liste de l'export Loi 25
// (lib/supabase/plateforme.js) PLUS les tables arrivées depuis
// (achats, sous-traitants, commandes camion, mémoire fournisseurs,
// légendes de photos, abonnements push).
const TABLES = [
  "clients_app", "projets_app", "devis_app", "taches_attente", "taches_assignees",
  "travaux_effectues", "bons_travail", "depots", "prix_depots", "taux_metiers",
  "pieces_commandees", "inspections_vehicules", "entretiens_vehicules",
  "carnet_vehicules", "camions", "fournisseurs", "repertoire_employes",
  "permissions_utilisateurs", "compteurs", "journal_activite", "qb_attributions_manuelles",
  "achats_libres", "sous_traitants_app", "commandes_camion", "articles_fournisseurs",
  "photos_legendes", "push_abonnements",
  // Oubliées jusqu'au 2026-09-22 (revue complète) :
  "semaines_paie", "factures_maison", "factures_libres", "inventaire_articles", "modeles_etapes", "entreprises",
  // Oubliées jusqu'au 2026-10-09 (vérification de la sauvegarde) : notes
  // personnelles, registre des incidents et preuves de consentement (Loi 25),
  // demandes du site de vente, retours, module Inventaire, archive du journal.
  // (Volontairement EXCLUES : quickbooks_connexion et sage_connexion — des
  // jetons d'accès, qui ne doivent jamais dormir dans un fichier ; on
  // rebranche en 30 secondes. Et les compteurs techniques envois_courriel,
  // connexion_echecs.)
  "notes_perso", "incidents_confidentialite", "options_consentements", "demandes_fluxya",
  "retours_logiciel", "plateforme_config", "journal_archive",
  "inv_emplacements", "inv_stock", "inv_mouvements",
];

const BUCKET = "sauvegardes";
const A_CONSERVER = 8;

export async function GET(request) {
  // ---- Qui frappe à la porte ? ----
  const enTete = request.headers.get("authorization") || "";
  const secretCron = process.env.CRON_SECRET;
  const estCron = secretCron && enTete === `Bearer ${secretCron}`;
  let estAdmin = false;
  if (!estCron) {
    const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
    const utilisateur = jeton ? await utilisateurDepuisJeton(jeton) : null;
    // 🔐 GRAND SOIR : la sauvegarde exporte TOUTE la base — reservee aux
    // admins DGL (ou au sceau plateforme), jamais a une entreprise d'essai.
    // 🔒 RLS phase 3 : rôle lu de la table des permissions.
    estAdmin =
      !!utilisateur &&
      (await roleServeur(utilisateur)) !== "Technicien" &&
      (entrepriseDuCompte(utilisateur) === "dgl" || utilisateur.app_metadata?.plateforme === true);
    // 🛡️ (2026-10-09) Porte fermée à tout le reste, PARTOUT : avant, sans
    // CRON_SECRET (la version d'essai), n'importe qui pouvait la déclencher.
    if (!estAdmin) {
      return Response.json({ erreur: "Accès refusé." }, { status: 401 });
    }
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  const admin = clientSupabaseService();

  // ---- Verrou 20 h : pas deux sauvegardes la même journée ----
  try {
    const { data: existantes } = await admin.storage.from(BUCKET).list("", { limit: 100 });
    const recente = (existantes || []).find(
      (f) => f.created_at && Date.now() - new Date(f.created_at).getTime() < 20 * 60 * 60 * 1000
    );
    if (recente && !estAdmin) {
      return Response.json({ dejaFaite: true, fichier: recente.name });
    }
  } catch {
    // bucket absent — il sera créé plus bas
  }

  // ---- Collecte, table par table (pagination : rien n'est tronqué) ----
  const contenu = { application: "Fluxya", exporteLe: new Date().toISOString(), tables: {} };
  let totalLignes = 0;
  for (const table of TABLES) {
    try {
      const lignes = [];
      const PAGE = 1000;
      for (let depuis = 0; ; depuis += PAGE) {
        const { data, error } = await admin.from(table).select("*").range(depuis, depuis + PAGE - 1);
        if (error) throw error;
        lignes.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      contenu.tables[table] = lignes;
      totalLignes += lignes.length;
    } catch (e) {
      // table absente (snippet pas encore passé) — noté, jamais bloquant
      contenu.tables[table] = { erreur: String(e?.message || "table illisible") };
    }
  }

  // ---- Rangement dans le bucket privé (créé au premier passage) ----
  // Le jour du QUÉBEC (le serveur est en UTC — le soir, c'était déjà demain).
  const nomFichier = `sauvegarde-${jourQuebec()}.json`;
  const corps = JSON.stringify(contenu);
  try {
    await admin.storage.createBucket(BUCKET, { public: false });
  } catch {
    // existe déjà — parfait
  }
  const { error: erreurDepot } = await admin.storage
    .from(BUCKET)
    .upload(nomFichier, new Blob([corps], { type: "application/json" }), { upsert: true });
  if (erreurDepot) {
    return Response.json({ erreur: `Dépôt de la sauvegarde refusé : ${erreurDepot.message}` }, { status: 502 });
  }

  // ---- Rotation : les 8 plus récentes seulement ----
  let effacees = 0;
  try {
    const { data: toutes } = await admin.storage.from(BUCKET).list("", { limit: 200 });
    const triees = (toutes || [])
      .filter((f) => f.name?.startsWith("sauvegarde-"))
      .sort((a, b) => (b.name < a.name ? -1 : 1));
    const aEffacer = triees.slice(A_CONSERVER).map((f) => f.name);
    if (aEffacer.length > 0) {
      await admin.storage.from(BUCKET).remove(aEffacer);
      effacees = aEffacer.length;
    }
  } catch {
    // la rotation réessaiera la semaine prochaine
  }

  // ---- Trace au journal — la ceinture se boucle, le bureau le voit ----
  const tailleKo = Math.round(corps.length / 1024);
  // 🧾 Bilan par table (2026-10-09) — des COMPTES seulement, jamais de contenu.
  const parTable = Object.fromEntries(
    Object.entries(contenu.tables).map(([t, v]) => [t, Array.isArray(v) ? v.length : "illisible"])
  );
  const illisibles = Object.keys(parTable).filter((t) => parTable[t] === "illisible");
  try {
    await admin.from("journal_activite").insert({
      texte: `💾 Sauvegarde créée : ${nomFichier} — ${Object.keys(parTable).length} tables, ${totalLignes} lignes, ${tailleKo} Ko (8 copies conservées${effacees ? `, ${effacees} ancienne${effacees > 1 ? "s" : ""} effacée${effacees > 1 ? "s" : ""}` : ""})${illisibles.length ? `. ⚠️ Tables illisibles : ${illisibles.join(", ")}` : ""}.`,
    });
  } catch {
    // journal indisponible — la sauvegarde, elle, est faite
  }

  return Response.json({ fait: true, fichier: nomFichier, lignes: totalLignes, tailleKo, effacees, parTable, illisibles });
}
