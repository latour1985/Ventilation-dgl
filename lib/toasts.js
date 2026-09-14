// lib/toasts.js
//
// 🔔 BULLES DE CONFIRMATION (2026-09-14, demande du propriétaire :
// « une confirmation visible après chaque action »). Jusqu'ici, la seule
// trace d'un enregistrement, d'un envoi ou d'une facture était une ligne
// du journal en bas de page — invisible quand l'écran est plein (« je
// suis sûr d'avoir fermé ces 2 tâches, pourquoi ça n'a pas marché ? »).
//
// Petit magasin sans dépendance : `notifier(texte)` d'un côté, le
// composant <Toasts/> qui s'abonne de l'autre. Le TON se déduit du texte
// (mêmes emojis que le journal) : ⚠️ ⛔ ❌ = problème (reste jusqu'au
// clic), ✅ 🧾 📄 ✉️ 💾 🔧 = succès, le reste = information.

const abonnes = new Set();
let compteur = 0;
let derniers = []; // { texte, quand } — anti-doublon 2 s

export function tonDuTexte(texte) {
  const t = String(texte || "");
  if (/⚠️|⛔|❌|🔒|🔌/.test(t)) return "probleme";
  if (/✅|🧾|📄|✉️|💾|🔧|🛒|🏗️|📌|🔁|💳|📍/.test(t)) return "succes";
  return "info";
}

export function notifier(texte, options = {}) {
  const propre = String(texte || "").trim();
  if (!propre) return;
  const maintenant = Date.now();
  derniers = derniers.filter((d) => maintenant - d.quand < 2000);
  if (derniers.some((d) => d.texte === propre)) return; // même message, 2 s → une seule bulle
  derniers.push({ texte: propre, quand: maintenant });
  compteur += 1;
  const bulle = {
    id: `${maintenant}-${compteur}`,
    texte: propre,
    ton: options.ton || tonDuTexte(propre),
    quand: maintenant,
  };
  abonnes.forEach((f) => f(bulle));
}

export function sAbonnerToasts(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
