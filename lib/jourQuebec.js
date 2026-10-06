// lib/jourQuebec.js
//
// 🕐 LE JOUR « AAAA-MM-JJ » À L'HEURE DU QUÉBEC (audit 2026-10-05).
// Les serveurs (Vercel, Supabase) tournent en UTC : après 20 h au Québec,
// `new Date().toISOString().slice(0, 10)` ou `getDate()` sur le serveur
// donnent DÉJÀ le lendemain — factures datées du lendemain, échéances
// décalées d'un jour, « en retard » le soir même. Cette fonction donne le
// jour civil québécois, sur le serveur comme dans le navigateur.

export function jourQuebec(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Le jour québécois dans `jours` jours (échéances « Net 30 », etc.).
// Calcul sur la DATE civile (pas en heures) : le changement d'heure ne
// décale jamais l'échéance d'un jour.
export function jourQuebecDans(jours, depuis = new Date()) {
  const [a, m, j] = jourQuebec(depuis).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + (Math.round(Number(jours)) || 0))).toISOString().slice(0, 10);
}
