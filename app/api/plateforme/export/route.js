// app/api/plateforme/export/route.js
//
// EXPORT COMPLET D'UNE ENTREPRISE — droit à la portabilité (Loi 25)
// et promesse de l'entente fondateurs.
//
// AVANT (2026-09-06) : l'export lisait les tables depuis le NAVIGATEUR
// avec la clé publique — depuis les cloisons RLS du grand soir, les
// lignes d'une entreprise ÉTRANGÈRE ne remontent plus : l'export d'un
// client de la console rapportait des tables vides SANS le dire. La
// lecture se fait maintenant ICI, avec la clé service (qui voit tout),
// et reste réservée au sceau plateforme.
//
// SÉCURITÉ : sceau plateforme obligatoire (app_metadata, scellé
// serveur). L'export sert à REMETTRE ses données à l'entreprise — ses
// données lui appartiennent.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

// Les tables étiquetées par entreprise — la même liste que portait
// lib/supabase/plateforme.js avant la migration côté serveur.
const TABLES_ENTREPRISE = [
  "clients_app", "projets_app", "devis_app", "taches_attente", "taches_assignees",
  "travaux_effectues", "bons_travail", "depots", "prix_depots", "taux_metiers",
  "pieces_commandees", "inspections_vehicules", "entretiens_vehicules",
  "carnet_vehicules", "camions", "fournisseurs", "repertoire_employes",
  "permissions_utilisateurs", "compteurs", "journal_activite", "qb_attributions_manuelles",
];

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (utilisateur.app_metadata?.plateforme !== true) {
    return Response.json({ erreur: "Réservé à la plateforme." }, { status: 403 });
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const entrepriseId = String(corps?.entrepriseId || "").trim();
  if (!entrepriseId) return Response.json({ erreur: "Entreprise manquante." }, { status: 400 });

  try {
    const admin = clientSupabaseService();
    const exportation = {
      entreprise: entrepriseId,
      genere_le: new Date().toISOString(),
      genere_par: utilisateur.email || null,
      note: "Export complet des données — Loi 25 (portabilité). Les données appartiennent à l'entreprise.",
      tables: {},
    };
    for (const table of TABLES_ENTREPRISE) {
      // Pages de 1000 (limite d'une lecture Supabase) — l'ancienne
      // version coupait SILENCIEUSEMENT à 10 000 lignes ; ici la
      // troncature au-delà de 50 000 est écrite dans l'export.
      const lignes = [];
      let tronquee = false;
      for (let depart = 0; depart < 50000; depart += 1000) {
        const { data, error } = await admin
          .from(table)
          .select("*")
          .eq("entreprise_id", entrepriseId)
          .range(depart, depart + 999);
        if (error) {
          lignes.length = 0;
          exportation.tables[table] = { erreur: error.message };
          break;
        }
        lignes.push(...(data || []));
        if (!data || data.length < 1000) break;
        if (depart + 1000 >= 50000) tronquee = true;
      }
      if (!exportation.tables[table]) {
        exportation.tables[table] = tronquee ? { lignes, tronquee: "coupé à 50 000 lignes" } : lignes;
      }
    }
    return Response.json(exportation);
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "Export impossible.") }, { status: 502 });
  }
}
