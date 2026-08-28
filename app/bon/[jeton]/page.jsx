"use client";

// PAGE PUBLIQUE DU BON DE TRAVAIL
// ============================================================
// Le client arrive par le lien reçu par courriel et voit un DESCRIPTIF
// de ses travaux : description, photos avant/après (avec les légendes
// posées par l'équipe), signature. Un clic sur une photo ouvre la même
// visionneuse que dans les applications (flèches + glissement de
// doigt), en lecture seule.
//
// JAMAIS de prix ni d'heures sur cette page — ni soumission ni facture
// (décision du propriétaire, 2026-08-15). Et ce n'est pas qu'une
// convention d'affichage : la fonction Postgres bon_travail_public ne
// transmet même pas ces champs (snippet SQL 60).
//
// Le lien vit 90 jours ; le bouton « Télécharger (PDF) » donne au
// client une copie permanente (photos incluses, toujours sans prix).

import { useState, useEffect } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Loader2, FileCheck2, MapPin, Wrench } from "lucide-react";
import { chargerBonPublic, JOURS_VALIDITE_BON } from "@/lib/supabase/bonPublic";
import { ligneAccreditations } from "@/lib/supabase/devisPublic";
import VisionneusePhotos from "@/components/VisionneusePhotos";

// @react-pdf/renderer ne tourne que dans le navigateur.
const BoutonPDFPublic = dynamic(() => import("@/components/pdf/BoutonPDFPublic"), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-xl bg-slate-200 py-3 text-center text-[13px] font-bold text-slate-400">
      Préparation du PDF…
    </div>
  ),
});

export default function PageBonPublic({ params }) {
  const { jeton } = use(params);
  const [bon, setBon] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [visionneuseIndex, setVisionneuseIndex] = useState(null);

  useEffect(() => {
    chargerBonPublic(jeton)
      .then((b) => {
        if (!b) setErreur("Ce lien n'est pas valide. Vérifiez l'adresse ou communiquez avec nous.");
        else setBon(b);
      })
      .catch(() => setErreur("Impossible de charger ce bon de travail. Réessayez dans quelques minutes."))
      .finally(() => setChargement(false));
  }, [jeton]);

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Chargement du bon de travail…
      </div>
    );
  }

  if (erreur || !bon) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-amber-500" />
          <p className="mt-3 text-sm font-bold text-slate-800">{erreur || "Ce lien n'est pas valide."}</p>
        </div>
      </div>
    );
  }

  if (bon.expire) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-amber-500" />
          <p className="mt-3 text-sm font-bold text-slate-800">Ce lien est expiré</p>
          <p className="mt-1 text-sm text-slate-500">
            Le bon de travail reste disponible {JOURS_VALIDITE_BON} jours après son envoi.
            Communiquez avec nous pour en recevoir une nouvelle copie.
          </p>
          {bon.entreprise?.telephone && (
            <p className="mt-2 text-sm font-bold text-slate-700">{bon.entreprise.telephone}</p>
          )}
        </div>
      </div>
    );
  }

  const unites = (bon.unites || []).filter((u) => (u.modele || "").trim() || (u.serie || "").trim() || (u.emplacement || "").trim());
  // La liste unique pour la visionneuse : avant puis après, étiquetées.
  const photos = [
    ...bon.photosAvant.map((u, i) => ({ url: u, etiquette: `Avant ${i + 1}/${bon.photosAvant.length}` })),
    ...bon.photosApres.map((u, i) => ({ url: u, etiquette: `Après ${i + 1}/${bon.photosApres.length}` })),
  ];

  const grille = (titre, urls, decalage) =>
    urls.length > 0 && (
      <div className="rounded-2xl bg-white p-5">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{titre}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((u, i) => (
            <button
              key={u + i}
              onClick={() => setVisionneuseIndex(decalage + i)}
              className="relative block aspect-square w-full overflow-hidden rounded-lg border border-slate-200"
            >
              <img src={u} alt={`${titre} ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              {bon.legendes[u] && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-left text-[10px] text-white">
                  📝 {bon.legendes[u]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* EN-TÊTE ENTREPRISE */}
        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-center gap-3">
            {/* Logo : celui de l'entreprise (snippet 92) ; le logo DGL du
                dossier public ne sert qu'à DGL (ou en filet quand l'id
                n'a pas voyagé) — un client sans logo n'affiche RIEN. */}
            {(bon.entreprise.logo || !bon.entreprise.id || bon.entreprise.id === "dgl") && (
              <img
                src={bon.entreprise.logo || "/logo-dgl.png"}
                alt=""
                className="h-11 w-auto"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
            <div>
              <p className="text-sm font-extrabold text-[#131B2E]">{bon.entreprise.nomLegal}</p>
              <p className="text-[11px] text-slate-500">
                {[bon.entreprise.telephone, bon.entreprise.courriel, bon.entreprise.siteWeb].filter(Boolean).join(" · ")}
              </p>
              {/* 🪪 RBQ + associations — le bon voyageait déjà avec le
                  RBQ sans jamais l'afficher (snippet 97 pour les
                  associations). */}
              {ligneAccreditations(bon.entreprise.numeroRbq, bon.entreprise.associations) && (
                <p className="text-[11px] font-semibold text-slate-600">
                  {ligneAccreditations(bon.entreprise.numeroRbq, bon.entreprise.associations)}
                </p>
              )}
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold text-[#131B2E]">BON DE TRAVAIL</h1>
          <p className="text-xs text-slate-500">Travaux réalisés le {bon.date}</p>
          {/* LES DEUX ADRESSES — facturation (fiche client) et travaux.
              La facturation ne s'affiche que si elle existe : celle du
              client ou rien, jamais la nôtre (règle gelée). */}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Facturé à</p>
              <p className="text-sm font-bold text-slate-800">{bon.clientNom}</p>
              {bon.adresseFacturation && (
                <p className="text-xs text-slate-500">{bon.adresseFacturation}</p>
              )}
            </div>
            {bon.adresseTravaux && (
              <div>
                <p className="text-xs text-slate-500">Adresse des travaux</p>
                <p className="mt-0.5 flex items-start gap-1 text-xs font-semibold text-slate-700">
                  <MapPin size={13} className="mt-0.5 shrink-0" /> {bon.adresseTravaux}
                </p>
              </div>
            )}
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Ce lien est disponible pendant {JOURS_VALIDITE_BON} jours. Pour conserver le document,
            utilisez le bouton « Télécharger (PDF) » au bas de la page.
          </p>
        </div>

        {/* DESCRIPTION */}
        <div className="rounded-2xl bg-white p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Description des travaux</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {bon.description || bon.titre || "Voir les photos ci-dessous."}
          </p>
          {unites.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Équipement vérifié</p>
              {unites.map((u, i) => (
                <p key={i} className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                  <Wrench size={12} className="shrink-0 text-slate-400" />
                  {u.emplacement ? `${u.emplacement} — ` : ""}{u.modele || "—"}{u.serie ? ` · Nº de série ${u.serie}` : ""}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* PHOTOS — un clic ouvre la visionneuse (lecture seule) */}
        {grille("Photos avant travaux", bon.photosAvant, 0)}
        {grille("Photos après travaux", bon.photosApres, bon.photosAvant.length)}

        {/* SIGNATURE */}
        <div className="rounded-2xl bg-white p-5">
          {bon.clientAbsent ? (
            <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-[12px] font-semibold text-slate-600">
              <FileCheck2 size={15} className="shrink-0" /> Client absent à la fin des travaux — bon transmis sans signature.
            </p>
          ) : bon.signeParNom ? (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-[12px] font-semibold text-emerald-700">
              <FileCheck2 size={15} className="shrink-0" /> Signé électroniquement par : {bon.signeParNom}
            </p>
          ) : bon.signeParCollegue ? (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-[12px] font-semibold text-emerald-700">
              <FileCheck2 size={15} className="shrink-0" /> Signature recueillie sur place auprès de notre équipe à la fin de l&apos;intervention.
            </p>
          ) : (
            <p className="text-[12px] text-slate-500">Bon transmis par notre équipe à la fin de l&apos;intervention.</p>
          )}

          <div className="mt-4">
            <BoutonPDFPublic bon={bon} />
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            Document descriptif des travaux réalisés — ne constitue ni une soumission ni une facture.
          </p>
          <p className="mt-1 text-center text-[10px] text-slate-300">Propulsé par Fluxya</p>
        </div>
      </div>

      {visionneuseIndex != null && (
        <VisionneusePhotos
          photos={photos}
          indexDepart={visionneuseIndex}
          legendes={bon.legendes}
          onFermer={() => setVisionneuseIndex(null)}
        />
      )}
    </div>
  );
}
