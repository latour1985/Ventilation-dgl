"use client";

// app/admin/BarreNavigationBas.jsx
//
// 📱 BARRE DE NAVIGATION DU BAS — ADMIN SUR CELLULAIRE (étape 1,
// 2026-10-02, maquette validée par le propriétaire : « B avec la barre en
// bas »). Les quatre écrans de tous les jours sous le pouce ; « Plus »
// ouvre le menu complet (le même tiroir que ☰). Invisible à partir de
// 768 px : l'ordinateur garde son menu de gauche, rien d'autre.
//
// Rendue DANS l'en-tête collant (z-20) : les fenêtres de l'en-tête (tour
// guidé, notes, session expirée) passent ainsi par-dessus, et les fiches
// des onglets (z-50) aussi. z-30 < 40 : le raccourci Échap
// (RaccourcisClavier) ne la prend jamais pour une fenêtre à fermer.

import { Briefcase, Calendar, FileText, LayoutGrid, Menu, Package, Receipt, Users, Banknote } from "lucide-react";
import { useLangue } from "@/lib/i18n";

// Ordre de préférence : les 4 premiers écrans permis sont affichés.
const CANDIDATS = [
  { id: "agenda", label: "Agenda", icone: Calendar },
  { id: "clients", label: "Clients", icone: Users },
  { id: "devis", label: "Devis", icone: FileText },
  { id: "facturation", label: "Facturation", icone: Receipt },
  // Remplaçants, pour un rôle qui n'a pas accès à l'un des quatre.
  { id: "tableau-de-bord", label: "Accueil", icone: LayoutGrid },
  { id: "projets", label: "Projets", icone: Briefcase },
  { id: "pieces", label: "Pièces", icone: Package },
  { id: "paies", label: "Heures", icone: Banknote },
];

export default function BarreNavigationBas({ vue, onChoisir, permissions, badges, onPlus }) {
  const { t } = useLangue();
  const items = CANDIDATS.filter((c) => (permissions || []).includes(c.id)).slice(0, 4);
  const idsAffiches = new Set(items.map((i) => i.id));
  // Pastille rouge sur « Plus » : quelque chose attend dans un écran
  // qui n'est pas dans la barre (pièces, heures, aide…).
  const attenteAilleurs = Object.entries(badges || {}).some(([id, n]) => !idsAffiches.has(id) && Number(n) > 0);
  const plusActif = !idsAffiches.has(vue);

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((o) => {
          const Icone = o.icone;
          const actif = vue === o.id;
          const n = Number(badges?.[o.id]) || 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChoisir(o.id)}
              aria-current={actif ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-bold ${
                actif ? "text-[#FF6A13]" : "text-slate-500"
              }`}
            >
              <span className="relative">
                <Icone size={20} strokeWidth={actif ? 2.5 : 2} />
                {n > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[9px] font-extrabold leading-4 text-white">
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate px-0.5">{t(o.label)}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onPlus}
          className={`relative flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-bold ${
            plusActif ? "text-[#FF6A13]" : "text-slate-500"
          }`}
        >
          <span className="relative">
            <Menu size={20} strokeWidth={plusActif ? 2.5 : 2} />
            {attenteAilleurs && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />}
          </span>
          <span>{t("Plus")}</span>
        </button>
      </div>
    </nav>
  );
}
