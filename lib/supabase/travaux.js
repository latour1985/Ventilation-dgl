// lib/supabase/travaux.js
//
// Remplace `taches`/majTache dans TechnicienPWA.jsx une fois le
// travail COMPLÉTÉ (voir remarque importante plus bas sur la
// distinction avec taches_planifiees). C'est aussi la cible réelle de
// la file d'attente hors-ligne : chaque action mise en file
// (ventilationdgl_file_attente_v1) doit, une fois synchronisée,
// appeler une des fonctions ci-dessous plutôt que le délai simulé de
// 400ms actuellement codé dans App() (TechnicienPWA.jsx).

import { supabase } from "./client";

// Crée l'entrée `travaux` définitive au moment où le technicien clique
// "TERMINER ET ENVOYER" — avant cela, le travail en cours reste local
// (état React + file d'attente), rien n'est écrit en base tant que ce
// n'est pas confirmé.
export async function envoyerBonDeTravail({
  clientId,
  projetId,
  tachePlanifieeId,
  titre,
  montant,
  heures,
  noteTerrain,
  noteInterne,
  estTransport,
  distanceKm,
  latDepart,
  lngDepart,
  latArrivee,
  lngArrivee,
}) {
  const { data, error } = await supabase
    .from("travaux")
    .insert({
      client_id: clientId,
      projet_id: projetId || null,
      tache_planifiee_id: tachePlanifieeId || null,
      titre,
      montant,
      heures,
      note_terrain: noteTerrain,
      note_interne: noteInterne,
      est_transport: !!estTransport,
      distance_km: distanceKm || null,
      lat_depart: latDepart || null,
      lng_depart: lngDepart || null,
      lat_arrivee: latArrivee || null,
      lng_arrivee: lngArrivee || null,
      statut: "complete",
      envoye: true,
      envoye_a: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Réouverture dans les 10 minutes (ou après réactivation admin) —
// équivalent du bouton "METTRE À JOUR L'ENVOI".
export async function mettreAJourBonDeTravail(travailId, champs) {
  const { error } = await supabase
    .from("travaux")
    .update({
      note_terrain: champs.noteTerrain,
      note_interne: champs.noteInterne,
      montant: champs.montant,
      envoye_a: new Date().toISOString(),
      modif_reactivee: champs.modifReactivee ?? false,
    })
    .eq("id", travailId);
  if (error) throw error;
}

// Bouton "Réactiver"/"Désactiver" côté admin (DetailTravail)
export async function reactiverModification(travailId, actif) {
  const { error } = await supabase.from("travaux").update({ modif_reactivee: actif }).eq("id", travailId);
  if (error) throw error;
}

// Photos et signature — upload dans Supabase Storage, puis on ne
// stocke que le CHEMIN en base (jamais l'image en base64).
export async function ajouterPhoto(travailId, typePhoto, fichier) {
  const chemin = `travaux/${travailId}/${typePhoto}-${Date.now()}.jpg`;
  const { error: erreurUpload } = await supabase.storage.from("photos-travaux").upload(chemin, fichier, {
    contentType: "image/jpeg",
  });
  if (erreurUpload) throw erreurUpload;

  const { error } = await supabase.from("travaux_photos").insert({
    travail_id: travailId,
    type_photo: typePhoto,
    chemin_stockage: chemin,
    taille_originale: fichier.size,
  });
  if (error) throw error;
}

export async function enregistrerSignature(travailId, nomSignataire, imageDataUrl, estDeuxiemeSignature = false) {
  const reponse = await fetch(imageDataUrl);
  const blob = await reponse.blob();
  const chemin = `travaux/${travailId}/signature-${Date.now()}.png`;
  const { error: erreurUpload } = await supabase.storage.from("signatures").upload(chemin, blob, {
    contentType: "image/png",
  });
  if (erreurUpload) throw erreurUpload;

  const { error } = await supabase.from("travaux_signatures").insert({
    travail_id: travailId,
    nom_signataire: nomSignataire,
    chemin_stockage: chemin,
    est_deuxieme_signature: estDeuxiemeSignature,
  });
  if (error) throw error;
}

/*
IMPORTANT — distinction taches_planifiees vs travaux :
Tout au long du développement de l'app (en mode simulé), une
limitation connue et documentée était que `tachesAttente`/`planning`
(le calendrier admin) et `taches` (l'app technicien) étaient DEUX
états React séparés sans pont réel. Avec Supabase, le pont se fait
ainsi :
  1. L'admin crée/assigne une tâche → écrite dans `taches_planifiees`.
  2. Le technicien, via `listerTachesDuJour()`, la voit apparaître
     dans son horaire (Realtime — voir realtime.js).
  3. Quand le technicien clique "TERMINER ET ENVOYER", on appelle
     `envoyerBonDeTravail()` qui écrit dans `travaux` (l'historique
     définitif, visible dans la fiche client et le calcul de
     rentabilité) ET met à jour `taches_planifiees.statut`.
C'est ce pont qui manquait dans la version simulée.
*/
