// lib/supabase/bonPublic.js
//
// LE BON DE TRAVAIL PUBLIC — le client reçoit un lien et voit un
// DESCRIPTIF de ses travaux : description, photos avant/après avec
// leurs légendes, signature. JAMAIS de prix ni d'heures — ce n'est ni
// une soumission ni une facture (décision du propriétaire, 2026-08-15).
//
// Même mécanique éprouvée que devisPublic.js : la table bons_travail
// reste FERMÉE aux anonymes — tout passe par la fonction Postgres
// bon_travail_public(jeton) (snippet SQL 60), qui ne retourne QUE les
// champs choisis. Même si la page avait un bogue, un prix ne peut pas
// fuir : il n'est jamais transmis.

import { supabase } from "./client";
import { genererJeton } from "./devisPublic";

// 90 jours — plus long que le devis (30) : un client peut vouloir
// revoir ses travaux des semaines plus tard (assurance, garantie).
export const JOURS_VALIDITE_BON = 90;

export function lienBonPublic(jeton) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/bon/${jeton}`;
}

// Donne au bon un jeton VALIDE — celui qui existe s'il court toujours,
// un neuf sinon. On ne régénère pas un jeton valide : le client qui
// reclique le lien d'un premier courriel doit encore tomber juste.
// `rowId` = l'identifiant de LIGNE bons_travail (le « sbb- » retiré).
export async function assurerJetonBon(rowId) {
  const { data, error } = await supabase
    .from("bons_travail")
    .select("jeton_public, jeton_expire_le")
    .eq("id", rowId)
    .single();
  if (error) throw error;

  const perime = !!data.jeton_expire_le && new Date(data.jeton_expire_le).getTime() < Date.now();
  if (data.jeton_public && !perime) return data.jeton_public;

  const jeton = genererJeton();
  const expire = new Date(Date.now() + JOURS_VALIDITE_BON * 24 * 60 * 60 * 1000).toISOString();
  const { error: erreurMaj } = await supabase
    .from("bons_travail")
    .update({ jeton_public: jeton, jeton_expire_le: expire })
    .eq("id", rowId);
  if (erreurMaj) throw erreurMaj;
  return jeton;
}

// Consigne l'envoi au client — la carte du bon peut alors l'afficher.
export async function marquerBonEnvoyeClient(rowId) {
  const { error } = await supabase
    .from("bons_travail")
    .update({ envoye_client_le: new Date().toISOString() })
    .eq("id", rowId);
  if (error) throw error;
}

// GARDE ANTI-DOUBLON : le client ne doit JAMAIS recevoir le bon deux
// fois (équipe de 2 qui ferme en même temps, « je termine seul » suivi
// du retour du collègue…). Avant tout envoi automatique, on vérifie si
// UN bon de cette tâche a déjà été transmis.
export async function bonDejaEnvoyeAuClient(tacheId) {
  if (!tacheId) return false;
  const { data, error } = await supabase
    .from("bons_travail")
    .select("id")
    .eq("tache_id", tacheId)
    .not("envoye_client_le", "is", null)
    .limit(1);
  if (error) return false; // dans le doute, on n'empêche pas l'envoi
  return (data || []).length > 0;
}

// 👁️ « Le client a consulté son bon » (snippet 123) — page publique,
// fire-and-forget, jamais en mode aperçu (bureau).
export function noterConsultationBon(jeton) {
  if (!jeton) return;
  supabase.rpc("noter_consultation_bon", { p_jeton: jeton }).then(
    () => {},
    () => {}
  );
}

// La page publique — via la fonction Postgres, jamais la table.
export async function chargerBonPublic(jeton) {
  const { data, error } = await supabase.rpc("bon_travail_public", { p_jeton: jeton });
  if (error) throw error;
  const b = Array.isArray(data) ? data[0] : data;
  if (!b) return null;
  return {
    entreprise: {
      nomLegal: b.entreprise_nom || "Ventilation DGL inc.",
      adresse: b.entreprise_adresse || "",
      telephone: b.entreprise_telephone || "",
      courriel: b.entreprise_courriel || "",
      numeroRbq: b.entreprise_rbq || "",
      // 🏢 Snippet 92 — id + logo voyagent avec le bon (la page est
      // anonyme, les cloisons RLS lui interdisent la fiche entreprise).
      id: b.entreprise_id || null,
      logo: b.entreprise_logo || null,
      // 🪪 Associations (snippet 97) — vide tant que le snippet n'est
      // pas passé, la page ne montre alors rien.
      associations: Array.isArray(b.entreprise_associations) ? b.entreprise_associations : [],
      // 🏢 Site web (snippet 99) — vide tant que le snippet n'est pas passé.
      siteWeb: b.entreprise_site_web || "",
      // 🪪 NEQ + numéros de taxes (snippet 100) — l'identité doit être la
      // MÊME sur tous les documents : un client les compare entre eux.
      neq: b.entreprise_neq || "",
      numeroTps: b.entreprise_numero_tps || "",
      numeroTvq: b.entreprise_numero_tvq || "",
    },
    titre: b.titre || "Travaux réalisés",
    clientNom: b.client_nom || "",
    // Adresse de facturation : celle de la fiche CLIENT, résolue à
    // l'affichage — jamais la nôtre (règle gelée), vide si absente.
    adresseFacturation: b.client_adresse_facturation || "",
    description: b.description || "",
    date: b.date_travail,
    adresseTravaux: b.adresse_travaux || "",
    photosAvant: Array.isArray(b.photos?.avant) ? b.photos.avant : [],
    photosApres: Array.isArray(b.photos?.apres) ? b.photos.apres : [],
    legendes: b.legendes && typeof b.legendes === "object" ? b.legendes : {},
    signeParNom: b.signe_par_nom || "",
    signeParCollegue: !!b.signe_par_collegue,
    clientAbsent: !!b.client_absent,
    unites: Array.isArray(b.unites) ? b.unites : [],
    expire: !!b.expire,
  };
}
