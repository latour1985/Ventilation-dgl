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
//   • si CRON_SECRET est défini dans Vercel, seul le cron (qui envoie
//     « Authorization: Bearer <CRON_SECRET> ») ou un ADMIN connecté
//     peuvent la déclencher ; sans CRON_SECRET, le garde-fou reste le
//     verrou 20 h (au pire, un anonyme déclenche une sauvegarde de
//     plus — aucune donnée ne sort) ;
//   • verrou anti-rafale : s'il existe déjà une sauvegarde de moins de
//     20 heures, on ne refait rien.
//
// Une ligne au journal d'activité confirme chaque passage — le bureau
// voit la ceinture se boucler sans ouvrir Supabase.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

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
    estAdmin = !!utilisateur && String(utilisateur.user_metadata?.role || "").trim() !== "Technicien";
    // CRON_SECRET défini = porte fermée à tout le reste.
    if (secretCron && !estAdmin) {
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
  const n = new Date();
  const nomFichier = `sauvegarde-${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}.json`;
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
  try {
    await admin.from("journal_activite").insert({
      texte: `💾 Sauvegarde hebdomadaire créée : ${nomFichier} — ${totalLignes} lignes, ${tailleKo} Ko (8 copies conservées${effacees ? `, ${effacees} ancienne${effacees > 1 ? "s" : ""} effacée${effacees > 1 ? "s" : ""}` : ""}).`,
    });
  } catch {
    // journal indisponible — la sauvegarde, elle, est faite
  }

  return Response.json({ fait: true, fichier: nomFichier, lignes: totalLignes, tailleKo, effacees });
}
