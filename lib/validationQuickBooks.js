// lib/validationQuickBooks.js
//
// Validation des données AVANT tout envoi vers QuickBooks (conformité :
// éviter d'alimenter la comptabilité avec des données invalides).
// Les validateurs TPS/TVQ sont prêts pour le jour où les fiches clients
// porteront des numéros de taxes (clients commerciaux).

// Courriel : au moins un caractère avant le @, un domaine, et une
// extension d'au moins 2 lettres (ex. .ca, .com).
export function validerCourriel(courriel) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((courriel || "").trim());
}

// TPS/TVH : 9 chiffres + RT + 4 chiffres (ex. 123456789 RT0001).
export function validerNumeroTPS(numero) {
  return /^\d{9}\s?RT\d{4}$/i.test((numero || "").trim());
}

// TVQ : 10 chiffres + TQ + 4 chiffres (ex. 1234567890 TQ0001).
export function validerNumeroTVQ(numero) {
  return /^\d{10}\s?TQ\d{4}$/i.test((numero || "").trim());
}

// Adresse complète : une ligne d'adresse ET une ville.
export function validerAdresse(adresse) {
  if (!adresse) return false;
  const ligne = (adresse.ligne1 || adresse.label || "").trim();
  const ville = (adresse.ville || "").trim();
  return ligne.length > 0 && ville.length > 0;
}

// Erreurs bloquantes avant la création/l'envoi d'un client vers
// QuickBooks. Retourne une liste de messages clairs (vide = tout est bon).
export function erreursClientPourQuickBooks({ courriel, adresse }) {
  const erreurs = [];
  if (!validerCourriel(courriel)) {
    erreurs.push("Le courriel est invalide — format attendu : nom@domaine.ca");
  }
  if (!validerAdresse(adresse)) {
    erreurs.push("L'adresse de facturation est incomplète — choisis une adresse avec une ligne d'adresse et une ville.");
  }
  return erreurs;
}
