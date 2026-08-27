// lib/supabase/devisPublic.js
//
// ACCEPTATION D'UN DEVIS PAR LE CLIENT — page publique, sans connexion.
//
// ------------------------------------------------------------
// LA TABLE RESTE FERMÉE
// ------------------------------------------------------------
// Aucun accès anonyme n'est ouvert sur `devis_app`. Tout passe par deux
// fonctions Postgres (snippet SQL 29) :
//
//   • devis_public(jeton)   — reconstruit les lignes SANS prix coûtant.
//     Le coût ne peut donc pas fuir, même si la page se trompait.
//   • repondre_devis(...)   — enregistre la réponse UNE SEULE FOIS.
//
// Sans ça, ouvrir la table en lecture anonyme laisserait fuir tes marges
// et permettrait d'énumérer tous tes devis.

import { supabase } from "./client";

// ⏳ VALIDITÉ DU LIEN : 1 AN (2026-08-28, demande du propriétaire — des
// clients reviennent un an plus tard pour ajuster le devis). À ne pas
// confondre avec la clause 1 « prix valides 30 jours » : après 30 jours
// le client VOIT encore son devis et peut demander une mise à jour,
// mais le bouton « Accepter » se ferme (un vieux prix ne s'accepte pas
// tout seul). Garder le lien vivant ne coûte RIEN : le devis est en
// base pour toujours de toute façon — seul ce chiffre change.
export const JOURS_VALIDITE_LIEN_DEVIS = 365;
export const JOURS_VALIDITE_PRIX_DEVIS = 30;

// Jeton long et aléatoire — c'est lui qui protège le lien. Il ne doit
// jamais être dérivé du numéro de devis, qui serait devinable.
export function genererJeton() {
  const octets = new Uint8Array(24);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

// Lien à envoyer au client. Sur l'ordinateur de développement, il pointe
// vers localhost — d'où la lecture de l'adresse courante.
export function lienDevisPublic(jeton) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/devis/${jeton}`;
}

export async function chargerDevisPublic(jeton) {
  const { data, error } = await supabase.rpc("devis_public", { p_jeton: jeton });
  if (error) throw error;
  const d = Array.isArray(data) ? data[0] : data;
  if (!d) return null;
  return {
    numero: d.numero,
    clientNom: d.client_nom,
    date: d.date_emission,
    lignes: Array.isArray(d.lignes) ? d.lignes : [],
    totalVendant: Number(d.total_vendant) || 0,
    statut: d.statut,
    reponseClient: d.reponse_client || null,
    reponduLe: d.repondu_le || null,
    expire: !!d.expire,
  };
}

// `reponse` = "accepte" | "refuse" | "modification".
// Retourne false si le devis a DÉJÀ reçu une réponse ou si le lien est
// expiré — on ne réécrit jamais une acceptation.
export async function repondreDevis({ jeton, reponse, nom, message, version, texte }) {
  const { data, error } = await supabase.rpc("repondre_devis", {
    p_jeton: jeton,
    p_reponse: reponse,
    p_nom: nom,
    p_message: message || null,
    p_version: version || null,
    p_texte: texte || null,
  });
  if (error) throw error;
  return data === true;
}
