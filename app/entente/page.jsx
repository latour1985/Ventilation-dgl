// app/entente/page.jsx
//
// ENTENTE D'UTILISATION DU LOGICIEL — page PUBLIQUE, sans connexion
// (2026-09-08). Exigée par le portail développeur Intuit pour
// débloquer les clés de PRODUCTION QuickBooks (« End-user license
// agreement URL ») — et de toute façon saine à publier : c'est le
// texte que chaque entreprise cliente accepte à sa première connexion.
//
// Le texte vient de lib/ententeTexte.js — LA source (même mécanique
// que /conditions et lib/termes.js) : l'écran d'acceptation, la
// consignation de version et cette page publient le même contenu.
// Version RÉGULIÈRE affichée (l'entente générale) ; les pionniers ont
// leur variante à l'acceptation, consignée avec sa propre version.

import { ENTENTE_REGULIERE, VERSION_ENTENTE_REGULIERE } from "@/lib/ententeTexte";
import Logo from "@/components/Logo";

export const metadata = { title: "Entente d'utilisation — Fluxya" };

export default function Entente() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 md:p-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-slate-900">Entente d&apos;utilisation du logiciel</h1>
          <Logo variant="icon" className="shrink-0" />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Fluxya · version {VERSION_ENTENTE_REGULIERE} · Chaque entreprise cliente accepte cette entente à sa
          première connexion ; la version acceptée est consignée à son dossier.
        </p>

        <div className="mt-6 space-y-5">
          {ENTENTE_REGULIERE.map((section) => (
            <section key={section.titre}>
              <h2 className="text-sm font-extrabold text-slate-900">{section.titre}</h2>
              <ul className="mt-1.5 space-y-1.5">
                {section.points.map((p, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-slate-600">
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Fluxya — exploité par Ventilation DGL inc. · 771 boul. Industriel, Blainville (Québec) ·{" "}
          <a href="/confidentialite" className="underline underline-offset-2">Politique de confidentialité</a> ·{" "}
          <a href="/conditions" className="underline underline-offset-2">Termes et conditions des travaux</a>
        </p>
      </div>
    </div>
  );
}
