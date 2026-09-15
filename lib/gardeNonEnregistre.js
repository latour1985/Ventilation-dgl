// lib/gardeNonEnregistre.js
//
// 🛡️ GARDE « TRAVAIL NON ENREGISTRÉ » (2026-09-15, vécu par le
// propriétaire : une soumission perdue en cliquant sur un autre onglet).
// Un écran qui tient du contenu non enregistré (constructeur de devis,
// facture libre…) POSE une garde avec un message ; la navigation du menu
// la consulte avant de changer d'onglet et demande confirmation. L'écran
// la RETIRE dès que le contenu est enregistré, vidé ou démonté.
// Sans dépendance, hors React : n'importe quel composant peut s'en servir.

const gardes = new Map(); // cle -> message

export function poserGarde(cle, message) {
  if (message) gardes.set(cle, message);
  else gardes.delete(cle);
}

export function retirerGarde(cle) {
  gardes.delete(cle);
}

export function messagesGardes() {
  return [...gardes.values()];
}

// Confirme (ou non) une navigation. `true` = on peut y aller.
export function navigationPermise() {
  const m = messagesGardes();
  if (m.length === 0) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(
    `${m.join("\n")}\n\nChanger d'écran quand même ? (Le contenu reste mémorisé dans ce navigateur — tu pourras le reprendre en revenant.)`
  );
}
