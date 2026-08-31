// lib/calendrierCcq.js
//
// 📅 CALENDRIER DE LA CONSTRUCTION (CCQ) — calculé, jamais téléchargé.
//
// Demande du propriétaire (2026-08-31) : « ajuster au calendrier de la
// CCQ pour les congés, vacances et jours fériés… que ces jours
// apparaissent automatiquement dans l'agenda pour ne pas céduler par
// erreur ». EN OPTION par entreprise (Paramètres → « Suivre le
// calendrier de la construction ») : bon pour les compagnies de
// construction, invisible pour les autres.
//
// Tout se CALCULE à partir des règles fixes de l'industrie — aucune
// dépendance à un fichier annuel :
//   • fériés chômés : dates civiles + Pâques (algorithme grégorien) +
//     RÈGLE DE REPORT (férié tombant la fin de semaine → jour ouvrable
//     suivant) ;
//   • vacances d'été : 2 semaines à partir du DERNIER dimanche de
//     juillet dont la semaine complète (dim→sam) tient encore en
//     juillet (vérifié contre les années publiées 2023-2025) ;
//   • vacances d'hiver : 2 semaines à partir du dimanche tombant le ou
//     précédant le 25 décembre (vérifié 2022-2025).
//
// ⚠️ Les dates officielles publiées par la CCQ peuvent, très rarement,
// différer (entente particulière) : l'agenda MARQUE les jours, l'humain
// décide toujours — rien n'est bloqué, on prévient.

// Ajoute n jours en heure LOCALE (jamais toISOString — décalage UTC).
function decale(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const iso = (a, m, j) => `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
const jourSemaine = (dateISO) => new Date(`${dateISO}T00:00:00`).getDay(); // 0 = dimanche

// Dimanche de Pâques (algorithme grégorien anonyme — exact pour toute année).
function paques(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(annee, mois, jour);
}

// Les fériés chômés de l'industrie, pour une année. Retourne
// [{ date: "AAAA-MM-JJ", nom }] — la date est CELLE DU CONGÉ (après
// report éventuel au jour ouvrable suivant).
export function joursFeriesCcq(annee) {
  const fixes = [
    [iso(annee, 1, 1), "Jour de l'An"],
    [iso(annee, 1, 2), "Lendemain du jour de l'An"],
    [iso(annee, 6, 24), "Fête nationale du Québec"],
    [iso(annee, 7, 1), "Fête du Canada"],
    [iso(annee, 12, 25), "Noël"],
  ];
  const p = paques(annee);
  const mobiles = [
    [decale(p, -2), "Vendredi saint"],
    [decale(p, 1), "Lundi de Pâques"],
  ];
  // Journée nationale des patriotes : le lundi qui précède le 25 mai.
  let patriotes = iso(annee, 5, 24);
  while (jourSemaine(patriotes) !== 1) patriotes = decale(patriotes, -1);
  mobiles.push([patriotes, "Journée nationale des patriotes"]);
  // Fête du Travail : 1er lundi de septembre.
  let travail = iso(annee, 9, 1);
  while (jourSemaine(travail) !== 1) travail = decale(travail, 1);
  mobiles.push([travail, "Fête du Travail"]);
  // Action de grâce : 2e lundi d'octobre.
  let grace = iso(annee, 10, 1);
  while (jourSemaine(grace) !== 1) grace = decale(grace, 1);
  grace = decale(grace, 7);
  mobiles.push([grace, "Action de grâce"]);

  // Report des fériés à DATE FIXE tombant la fin de semaine : jour
  // ouvrable suivant, sans jamais écraser un congé déjà pris (Jour de
  // l'An samedi + lendemain dimanche → lundi ET mardi).
  const pris = new Set(mobiles.map(([d]) => d));
  const feries = [...mobiles];
  for (const [dateBrute, nom] of fixes) {
    let d = dateBrute;
    while (jourSemaine(d) === 0 || jourSemaine(d) === 6 || pris.has(d)) d = decale(d, 1);
    pris.add(d);
    feries.push([d, nom + (d !== dateBrute ? " (reporté)" : "")]);
  }
  return feries
    .map(([date, nom]) => ({ date, nom }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

// Les 2 périodes de vacances de la construction d'une année civile.
// L'HIVER retourné est celui qui COMMENCE en décembre de cette année
// (il déborde sur janvier suivant).
export function vacancesConstructionCcq(annee) {
  // Été : dernier dimanche de juillet dont la semaine complète
  // (dim → sam) tient en juillet ; la période couvre 14 jours.
  let dimanche = iso(annee, 7, 31);
  while (jourSemaine(dimanche) !== 0) dimanche = decale(dimanche, -1);
  while (Number(decale(dimanche, 6).slice(5, 7)) !== 7) dimanche = decale(dimanche, -7);
  const ete = { debut: dimanche, fin: decale(dimanche, 13), nom: "Vacances de la construction (été)" };
  // Hiver : le dimanche le ou précédant le 25 décembre, 14 jours.
  let noel = iso(annee, 12, 25);
  while (jourSemaine(noel) !== 0) noel = decale(noel, -1);
  const hiver = { debut: noel, fin: decale(noel, 13), nom: "Vacances de la construction (hiver)" };
  return [ete, hiver];
}

// Caches par année — les dates ne changent jamais pour une année donnée.
const cacheFeries = new Map();
const cacheVacances = new Map();
function feriesDe(annee) {
  if (!cacheFeries.has(annee)) cacheFeries.set(annee, new Map(joursFeriesCcq(annee).map((f) => [f.date, f.nom])));
  return cacheFeries.get(annee);
}
function vacancesDe(annee) {
  if (!cacheVacances.has(annee)) cacheVacances.set(annee, vacancesConstructionCcq(annee));
  return cacheVacances.get(annee);
}

export function estFerieCcq(dateISO) {
  return feriesDe(Number(dateISO.slice(0, 4))).has(dateISO);
}

// Le marqueur d'une date pour l'agenda : férié d'abord (plus précis),
// sinon vacances (l'hiver de l'année PRÉCÉDENTE déborde sur janvier).
// Retourne { type: "ferie" | "vacances", nom } ou null.
export function marqueurCcq(dateISO) {
  const annee = Number(dateISO.slice(0, 4));
  const nomFerie = feriesDe(annee).get(dateISO);
  if (nomFerie) return { type: "ferie", nom: nomFerie };
  for (const a of [annee, annee - 1]) {
    for (const v of vacancesDe(a)) {
      if (dateISO >= v.debut && dateISO <= v.fin) return { type: "vacances", nom: v.nom };
    }
  }
  return null;
}
