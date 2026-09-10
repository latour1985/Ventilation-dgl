// lib/supabase/fermetureTechnicien.js
//
// 🛡️ FERMETURE TERRAIN TOUT-OU-RIEN (snippet 141, audit 2026-09-09).
//
// Le trou le plus grave trouvé à l'audit : quand le dernier technicien
// fermait sa tâche, le BON DE TRAVAIL partait tout de suite et ses
// HEURES seulement ~600 ms plus tard. Une coupure réseau entre les
// deux (un technicien sur un toit, ça arrive) laissait un bon
// facturable au bureau… sans aucune heure de paie pour le technicien,
// et ses collègues le voyaient « pas terminé » pour toujours.
//
// Ici, le bon ET les heures entrent dans UNE transaction Postgres
// (fermer_travaux_technicien) : soit les deux existent, soit aucun.
// Repli si le snippet n'est pas passé : les deux écritures d'avant,
// l'une après l'autre (bon d'abord — c'est la facturation).

import { supabase } from "./client";
import { construireLigneBon, enregistrerBonTravail } from "./bonsTravail";
import { construireLigneTravail, resoudreTauxFige, enregistrerTravailEffectue } from "./travauxEffectues";

export async function fermerTravauxTechnicien(chargeBon, chargeTravail, session) {
  const email = session?.user?.email?.toLowerCase() || null;
  const nom = session?.user?.user_metadata?.nom || (email ? email.split("@")[0] : null);
  const { tauxFige, secteurPaie } = await resoudreTauxFige(email, chargeTravail.secteur);
  const { data, error } = await supabase.rpc("fermer_travaux_technicien", {
    p_bon: construireLigneBon(chargeBon, email, nom),
    p_travail: construireLigneTravail(chargeTravail, email, nom, tauxFige, secteurPaie),
  });
  if (!error) return { bonRowId: data || null, heuresEcrites: true };
  const absente = error.code === "PGRST202" || /find the function|does not exist/i.test(String(error.message || ""));
  if (!absente) throw error;
  // Snippet pas encore passé : chemin d'avant, bon puis heures — mais
  // ENCHAÎNÉS ici (plus de délai de 600 ms entre les deux).
  const bonRowId = await enregistrerBonTravail(chargeBon, session);
  let heuresEcrites = true;
  try {
    await enregistrerTravailEffectue(chargeTravail, session);
  } catch {
    heuresEcrites = false; // l'appelant met les heures en file de rejeu
  }
  return { bonRowId, heuresEcrites };
}
