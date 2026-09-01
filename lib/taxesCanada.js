// lib/taxesCanada.js
//
// 🍁 RÉGIMES DE TAXES DE VENTE PAR PROVINCE (2026-09-02, demande du
// propriétaire pour la facturation maison : « mettre les codes de taxe
// de chaque province canadienne qui sont sélectionnables »).
//
// Chaque régime décrit LES LIGNES de taxes d'une facture : code affiché,
// taux, et l'ordre d'affichage. Taux en vigueur (vérifiés 2026) :
//   • TVH (taxe harmonisée) : Ontario 13 % ; N.-B., N.-É., Î.-P.-É. et
//     T.-N.-L. 15 % (la Nouvelle-Écosse est passée à 14 % le 1er avril
//     2025 — reflété ci-dessous) ;
//   • TPS 5 % + taxe provinciale : Québec (TVQ 9,975), C.-B. (TVP 7),
//     Saskatchewan (TVP 6), Manitoba (TVP 7) ;
//   • TPS seule 5 % : Alberta, Yukon, T.N.-O., Nunavut ;
//   • Exonéré : aucune taxe (client hors Canada, fourniture détaxée…).
// ⚠️ Les taux changent rarement mais changent (budgets provinciaux) —
// ils vivent ICI, à un seul endroit, pour être faciles à ajuster.

export const REGIMES_TAXES = [
  { id: "qc", nom: "Québec — TPS 5 % + TVQ 9,975 %", lignes: [{ code: "TPS", taux: 5 }, { code: "TVQ", taux: 9.975 }] },
  { id: "on", nom: "Ontario — TVH 13 %", lignes: [{ code: "TVH", taux: 13 }] },
  { id: "ns", nom: "Nouvelle-Écosse — TVH 14 %", lignes: [{ code: "TVH", taux: 14 }] },
  { id: "nb", nom: "Nouveau-Brunswick — TVH 15 %", lignes: [{ code: "TVH", taux: 15 }] },
  { id: "pe", nom: "Île-du-Prince-Édouard — TVH 15 %", lignes: [{ code: "TVH", taux: 15 }] },
  { id: "nl", nom: "Terre-Neuve-et-Labrador — TVH 15 %", lignes: [{ code: "TVH", taux: 15 }] },
  { id: "bc", nom: "Colombie-Britannique — TPS 5 % + TVP 7 %", lignes: [{ code: "TPS", taux: 5 }, { code: "TVP", taux: 7 }] },
  { id: "sk", nom: "Saskatchewan — TPS 5 % + TVP 6 %", lignes: [{ code: "TPS", taux: 5 }, { code: "TVP", taux: 6 }] },
  { id: "mb", nom: "Manitoba — TPS 5 % + TVP 7 %", lignes: [{ code: "TPS", taux: 5 }, { code: "TVP", taux: 7 }] },
  { id: "ab", nom: "Alberta — TPS 5 % seulement", lignes: [{ code: "TPS", taux: 5 }] },
  { id: "territoires", nom: "Yukon / T.N.-O. / Nunavut — TPS 5 %", lignes: [{ code: "TPS", taux: 5 }] },
  { id: "exonere", nom: "Exonéré — aucune taxe", lignes: [] },
];

export function regimeTaxes(id) {
  return REGIMES_TAXES.find((r) => r.id === id) || REGIMES_TAXES[0];
}

// Les lignes de taxes CALCULÉES d'une facture : [{ code, taux, montant }].
// Arrondi au sou par ligne de taxe — comme les factures papier.
export function calculerTaxesRegime(sousTotal, regimeId) {
  const st = Number(sousTotal) || 0;
  return regimeTaxes(regimeId).lignes.map((l) => ({
    code: l.code,
    taux: l.taux,
    // st × (taux/100), arrondi au sou : Math.round(st × taux) / 100.
    montant: Math.round(st * l.taux) / 100,
  }));
}

// Le numéro d'inscription à afficher à côté d'une ligne de taxe : la
// TPS et la TVH partagent le MÊME numéro fédéral (RT) ; la TVQ a le
// sien ; la TVP (provinces à taxe séparée) n'en affiche pas ici.
export function numeroPourTaxe(code, { numeroTps, numeroTvq } = {}) {
  if ((code === "TPS" || code === "TVH") && numeroTps) return numeroTps;
  if (code === "TVQ" && numeroTvq) return numeroTvq;
  return null;
}
