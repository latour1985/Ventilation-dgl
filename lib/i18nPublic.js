// lib/i18nPublic.js
//
// 🌎 Petits outils de langue des PAGES ENVOYÉES AUX CLIENTS (devis, bon de
// travail, facture — 2026-10-03). Les phrases passent par le dictionnaire
// de lib/i18n.js ; ici, ce qui n'est pas une phrase : les montants, les
// noms de taxes et le lien qui porte la langue du client.

// 1 234,50 $ en français (usage québécois simplifié de l'app : « 1234.50 $ »),
// $1234.50 en anglais.
export function argentSelonLangue(n, langue) {
  const v = (Number(n) || 0).toFixed(2);
  return langue === "en" ? `$${v}` : `${v} $`;
}

// TPS / TVQ / TVH → GST / QST / HST en anglais.
export function nomTaxe(code, langue) {
  if (langue !== "en") return code;
  return { TPS: "GST", TVQ: "QST", TVH: "HST" }[String(code || "").toUpperCase()] || code;
}

// Langue de communication d'une fiche client : « en » ou « fr » (défaut).
export function langueClient(client) {
  return client?.langue === "en" ? "en" : "fr";
}

// Langue d'un client retrouvé dans la liste — par son id, sinon son nom
// (les bons portent parfois seulement le nom).
export function langueDuClient(clients, { id = null, nom = "" } = {}) {
  const liste = clients || [];
  const c = (id && liste.find((x) => x.id === id)) || (nom && liste.find((x) => x.nom === nom)) || null;
  return langueClient(c);
}

// Ajoute « ?lang=en » au lien d'un document quand le client est anglophone.
// Rien n'est ajouté en français : les anciens liens restent identiques.
export function lienSelonLangue(lien, langue) {
  if (!lien || langue !== "en") return lien;
  return `${lien}${lien.includes("?") ? "&" : "?"}lang=en`;
}
