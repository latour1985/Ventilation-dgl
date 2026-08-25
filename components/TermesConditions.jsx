// components/TermesConditions.jsx
//
// Bloc « Termes et conditions générales » affiché en bas des documents
// client (devis, facture, bon de travail) et sur la page publique
// /conditions. Styles volontairement compacts (fine print) pour tenir
// dans les aperçus de documents (largeur max-w-md).
//
// ⚠️ LE TEXTE NE VIT PLUS ICI (2026-08-24) : les clauses sont dans
// lib/termes.js — la source UNIQUE, partagée avec le courriel de
// demande de dépôt. Modifier une clause là-bas met à jour documents,
// courriel et page publique d'un coup. Deux copies d'un texte légal
// finissent toujours par diverger — on n'en garde qu'une.
//
// Props :
//  - signature : bool — affiche une ligne « Signature du client / Date »
//                sous les conditions (utilisé sur le devis).

import { TERMES_TITRE, TERMES_CLAUSES, TERMES_MERCI } from "@/lib/termes";

export default function TermesConditions({ signature = false }) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{TERMES_TITRE}</p>

      <ol className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-600">
        {TERMES_CLAUSES.map((c) => (
          <li key={c.titre}>
            <span className="font-bold text-slate-800">{c.titre}</span>
            {c.texte ? <> {c.texte}</> : null}
            {c.points && c.points.length > 0 && (
              <ul className="mt-1 space-y-1">
                {c.points.map((p) => (
                  <li key={p.label}>
                    <span className="font-semibold text-slate-700">{p.label}</span> {p.texte}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-2 text-center text-[10px] italic text-slate-500">{TERMES_MERCI}</p>

      {signature && (
        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <div className="h-6 border-b border-slate-300" />
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
              Signature du client
            </p>
          </div>
          <div className="flex-1">
            <div className="h-6 border-b border-slate-300" />
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">Date</p>
          </div>
        </div>
      )}
    </div>
  );
}
