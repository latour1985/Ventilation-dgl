// lib/supabase/inventaire.js
//
// 📦 INVENTAIRE COURANT (2026-09-04, demande du propriétaire) — la
// liste vivante de ce qui dort à l'atelier : nom, quantité, unité,
// emplacement. Chaque ajustement passe par ici et s'écrit au journal
// par l'appelant (« qui a bougé quoi » — la règle maison).
// Table `inventaire_articles` (snippet 126) — cloisonnée par entreprise
// comme tout le reste (poser_entreprise_id + RLS).

import { supabase } from "./client";
import { lireParPages } from "./lireParPages";

export async function listerInventaire() {
  // 📚 Par pages, ordre stable — règle des tables qui grossissent.
  const data = await lireParPages(() =>
    supabase.from("inventaire_articles").select("*").order("nom", { ascending: true }).order("id", { ascending: true })
  );
  return (data || []).map((row) => ({
    id: row.id,
    nom: row.nom || "",
    quantite: Number(row.quantite) || 0,
    unite: row.unite || "",
    emplacement: row.emplacement || "",
    // 🛒 Seuil « à commander » (snippet 129) — 0 ou vide = pas d'alerte.
    seuilAlerte: Number(row.seuil_alerte) || 0,
    majLe: row.updated_at || null,
  }));
}

export async function sauvegarderArticleInventaire(a) {
  const ligne = {
    id: a.id,
    nom: a.nom,
    quantite: Number(a.quantite) || 0,
    unite: a.unite || null,
    emplacement: a.emplacement || null,
    seuil_alerte: Number(a.seuilAlerte) > 0 ? Number(a.seuilAlerte) : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("inventaire_articles").upsert(ligne);
  // ⚠️ FILET COLONNE MANQUANTE : tant que le snippet 129 n'est pas
  // passé, le reste de l'article continue de s'enregistrer normalement.
  if (error && (error.code === "PGRST204" || /seuil_alerte/.test(error.message || ""))) {
    const { seuil_alerte: _sansSeuil, ...sansColonneRecente } = ligne;
    const { error: e2 } = await supabase.from("inventaire_articles").upsert(sansColonneRecente);
    if (e2) throw e2;
    return;
  }
  if (error) throw error;
}

export async function supprimerArticleInventaire(id) {
  const { error } = await supabase.from("inventaire_articles").delete().eq("id", id);
  if (error) throw error;
}
