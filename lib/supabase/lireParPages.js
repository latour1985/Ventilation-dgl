// lib/supabase/lireParPages.js
//
// 📚 LECTURE PAR PAGES — l'antidote au plafond Supabase de 1 000 lignes
// (2026-09-03, bilan de santé). Le symptôme vécu : la liste des clients
// coupée à « M » en silence dès que la table a dépassé 1 000 fiches.
// Toutes les tables qui GROSSISSENT avec l'usage (heures pointées,
// tâches, bons, dépôts, devis, photos…) passent par ici : la boucle
// lit page par page jusqu'à la page courte — la liste est TOUJOURS
// complète, peu importe le volume.
//
// Usage :
//   const lignes = await lireParPages(() =>
//     supabase.from("travaux_effectues").select("*").order("date")
//   );
// ⚠️ TOUJOURS un .order(...) stable dans la requête : sans ordre, les
// pages peuvent se chevaucher ou se trouer d'une page à l'autre.

export async function lireParPages(construireRequete) {
  const PAGE = 1000;
  const tous = [];
  for (let depart = 0; ; depart += PAGE) {
    const { data, error } = await construireRequete().range(depart, depart + PAGE - 1);
    if (error) throw error;
    tous.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return tous;
}
