"use client";

// components/VisionneusePhotos.jsx
//
// LA VISIONNEUSE DE PHOTOS — partagée par les DEUX applications.
//
// Demandes du propriétaire (2026-08-15) :
//   • flèches ← → pour passer d'une photo à l'autre sans fermer/rouvrir ;
//   • GLISSEMENT DE DOIGT sur le téléphone — ET les flèches restent :
//     un technicien avec des gants de travail rate son swipe une fois
//     sur deux, les grosses flèches tapables sont son filet ;
//   • légende (titre/détail) affichée — et modifiable si permis ;
//   • téléchargement de la photo (nom de fichier intelligible) ;
//   • le badge « 📁 importée » suit (origine gravée au nom du fichier).
//
// Clavier (bureau) : ← → naviguent, Échap ferme.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export default function VisionneusePhotos({
  photos, // [{ url, etiquette }] — etiquette ex. « Avant 2/5 »
  indexDepart = 0,
  onFermer,
  legendes = {}, // { url: texte }
  onLegende = null, // (url, texte) => void — null = lecture seule
  nomFichier = null, // (photo, index) => "client-avant-02.jpg"
}) {
  const [index, setIndex] = useState(indexDepart);
  const [brouillonLegende, setBrouillonLegende] = useState("");
  const [editionLegende, setEditionLegende] = useState(false);
  const toucheDepartX = useRef(null);

  const photo = photos[index] || null;
  const precedente = () => setIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  const suivante = () => setIndex((i) => (i < photos.length - 1 ? i + 1 : 0));

  // Clavier — bureau.
  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowLeft") precedente();
      if (e.key === "ArrowRight") suivante();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  // La légende suit la photo affichée ; l'édition se referme au changement.
  useEffect(() => {
    setEditionLegende(false);
    setBrouillonLegende(legendes[photo?.url] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photo?.url]);

  if (!photo) return null;

  // GLISSEMENT DE DOIGT — seuil de 50 px pour ignorer les tremblements.
  const surToucheDebut = (e) => {
    toucheDepartX.current = e.touches?.[0]?.clientX ?? null;
  };
  const surToucheFin = (e) => {
    const depart = toucheDepartX.current;
    toucheDepartX.current = null;
    if (depart == null) return;
    const delta = (e.changedTouches?.[0]?.clientX ?? depart) - depart;
    if (delta > 50) precedente();
    else if (delta < -50) suivante();
  };

  const telecharger = async () => {
    try {
      const reponse = await fetch(photo.url);
      const blob = await reponse.blob();
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(blob);
      lien.download = nomFichier ? nomFichier(photo, index) : `photo-${index + 1}.jpg`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch {
      window.open(photo.url, "_blank");
    }
  };

  const importee = String(photo.url || "").includes("-galerie");

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      onTouchStart={surToucheDebut}
      onTouchEnd={surToucheFin}
    >
      {/* Barre du haut : compteur, badges, actions */}
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white/80">
          <span className="tabular-nums">{index + 1} / {photos.length}</span>
          {photo.etiquette && <span className="rounded-full bg-white/15 px-2 py-0.5">{photo.etiquette}</span>}
          {importee && (
            <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] text-black" title="Importée de la galerie du téléphone — pas prise en direct dans l'application">
              📁 importée
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={telecharger} aria-label="Télécharger la photo" className="rounded-full bg-white/10 p-2.5 text-white active:scale-95">
            <Download size={18} />
          </button>
          <button onClick={onFermer} aria-label="Fermer" className="rounded-full bg-white/10 p-2.5 text-white active:scale-95">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* L'image + les flèches (grosses cibles — gants de travail) */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-1">
        {photos.length > 1 && (
          <button
            onClick={precedente}
            aria-label="Photo précédente"
            className="absolute left-1 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
          >
            <ChevronLeft size={30} />
          </button>
        )}
        <img src={photo.url} alt={photo.etiquette || ""} className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <button
            onClick={suivante}
            aria-label="Photo suivante"
            className="absolute right-1 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
          >
            <ChevronRight size={30} />
          </button>
        )}
      </div>

      {/* La LÉGENDE — affichée toujours, modifiable si permis */}
      <div className="p-3 pb-4">
        {editionLegende && onLegende ? (
          <div className="flex gap-2">
            <input
              value={brouillonLegende}
              onChange={(e) => setBrouillonLegende(e.target.value)}
              placeholder="Ex : fissure déjà présente à l'arrivée"
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40"
            />
            <button
              onClick={() => { onLegende(photo.url, brouillonLegende.trim()); setEditionLegende(false); }}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black active:scale-95"
            >
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => onLegende && setEditionLegende(true)}
            className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left text-sm text-white/90"
            disabled={!onLegende}
          >
            {legendes[photo.url]
              ? `📝 ${legendes[photo.url]}`
              : onLegende
                ? "＋ Ajouter un détail à cette photo…"
                : "Aucun détail sur cette photo."}
          </button>
        )}
      </div>
    </div>
  );
}
