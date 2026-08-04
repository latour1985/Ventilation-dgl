// lib/supabase/carnetVehicules.js
//
// CARNET D'ENTRETIEN du parc de véhicules — la trace de TOUT ce qui a
// été fait sur chaque camion : réparations (suite à une anomalie) et
// entretiens périodiques. Chaque entrée dit quoi, quand, à quel
// kilométrage, chez qui et pour combien.
//
// Les coûts servent au suivi du PARC (quel camion coûte cher, lequel
// remplacer) — ils n'entrent pas dans la rentabilité des projets, un
// camion n'appartenant à aucun chantier.

import { supabase } from "./client";

function versUi(row) {
  return {
    id: row.id,
    camion: row.camion,
    type: row.type, // "reparation" | "entretien"
    date: row.date_travaux,
    description: row.description || "",
    cout: row.cout != null ? Number(row.cout) : null,
    garage: row.garage || "",
    km: row.kilometrage != null ? Number(row.kilometrage) : null,
    inspectionId: row.inspection_id || null,
    parNom: row.par_nom || "",
  };
}

export async function listerCarnetVehicules() {
  const { data, error } = await supabase
    .from("carnet_vehicules")
    .select("*")
    .order("date_travaux", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(versUi);
}

// `entree` = { camion, type, description, cout, garage, km, inspectionId }
export async function ajouterEntreeCarnet(entree, session) {
  // Date LOCALE (Québec), jamais UTC — même règle que partout ailleurs.
  const d = new Date();
  const dateLocale = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { error } = await supabase.from("carnet_vehicules").insert({
    camion: entree.camion,
    type: entree.type,
    date_travaux: entree.date || dateLocale,
    description: entree.description || null,
    cout: entree.cout != null && entree.cout !== "" ? Number(entree.cout) : null,
    garage: entree.garage || null,
    kilometrage: entree.km != null ? Number(entree.km) : null,
    inspection_id: entree.inspectionId || null,
    par_nom: session?.user?.user_metadata?.nom || session?.user?.email || null,
  });
  if (error) throw error;
}

export function sAbonnerCarnetVehicules(onChangement) {
  const canal = supabase
    .channel("carnet-vehicules")
    .on("postgres_changes", { event: "*", schema: "public", table: "carnet_vehicules" }, onChangement)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
