// app/conditions/page.jsx
//
// TERMES ET CONDITIONS GÉNÉRALES — page PUBLIQUE, sans connexion
// (2026-08-24). Le message d'une facture QuickBooks est plafonné à
// ~900 caractères : impossible d'y écrire dix clauses. Il porte donc
// un LIEN vers cette page — le client qui reçoit la facture de dépôt
// peut lire l'intégralité des conditions AVANT de payer, ce qui est
// la condition même de leur opposabilité (un dépôt « non remboursable »
// dont la règle n'a jamais été montrée ne tient pas).
//
// Le texte vient de lib/termes.js — la même source que les documents
// (devis, bons) et le courriel de dépôt. Rien n'est recopié ici.

import TermesConditions from "@/components/TermesConditions";
import Logo from "@/components/Logo";

export const metadata = { title: "Termes et conditions — Ventilation DGL" };

export default function Conditions() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 md:p-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-slate-900">Termes et conditions générales</h1>
          <Logo variant="icon" className="shrink-0" />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Ventilation DGL inc. · Ces conditions s&apos;appliquent à nos devis, appels de service, dépôts de
          réservation et travaux.
        </p>

        <TermesConditions />

        <p className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Ventilation DGL inc. · 771 boul. Industriel, Blainville (Québec) · (450) 543-9855
        </p>
      </div>
    </div>
  );
}
