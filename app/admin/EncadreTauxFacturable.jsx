"use client";

// app/admin/EncadreTauxFacturable.jsx
//
// 📊 « TAUX D'HEURES FACTURABLES » (2026-09-22, idée retenue par le
// propriétaire) — une barre par technicien : facturable / transport /
// non facturable, sur les 30 derniers jours ou la semaine en cours.
// Le détail des heures non facturables (pourquoi) s'ouvre au clic.
// Écran ADMIN seulement.

import { useMemo, useState } from "react";
import { tauxFacturableParTechnicien } from "@/lib/tauxFacturable";
import { dateISO, dimancheDeSemaineISO, listeCellule } from "./partage";

const h = (n) => `${(Number(n) || 0).toFixed(1)} h`;

export function EncadreTauxFacturable({ travaux = [], planning = {}, tachesAttente = [], facturables = {} }) {
  const [periode, setPeriode] = useState("30j"); // 30j | semaine
  const [ouvert, setOuvert] = useState(null); // courriel dont le détail est ouvert
  const aujourdhui = dateISO(new Date());
  const debut = periode === "semaine" ? dimancheDeSemaineISO(new Date()) : dateISO(new Date(Date.now() - 29 * 86400000));
  const tachesParId = useMemo(() => {
    const m = new Map();
    Object.values(planning || {}).forEach((c) => listeCellule(c).forEach((t) => { if (t?.id && !m.has(String(t.id))) m.set(String(t.id), t); }));
    (tachesAttente || []).forEach((t) => { if (t?.id && !m.has(String(t.id))) m.set(String(t.id), t); });
    return m;
  }, [planning, tachesAttente]);
  const rangs = useMemo(
    () => tauxFacturableParTechnicien({ travaux, tacheParId: (id) => tachesParId.get(String(id)) || null, facturables, debutISO: debut, finISO: aujourdhui }),
    [travaux, tachesParId, facturables, debut, aujourdhui]
  );
  const equipe = rangs.reduce((s, r) => ({ facturable: s.facturable + r.facturable, total: s.total + r.total }), { facturable: 0, total: 0 });
  if (rangs.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          📊 Heures facturables{" "}
          <span className="normal-case text-slate-400">
            — équipe : <span className="font-extrabold text-slate-700">{equipe.total > 0 ? Math.round((equipe.facturable / equipe.total) * 100) : 0} %</span>
          </span>
        </h3>
        <div className="flex gap-1">
          {[["30j", "30 jours"], ["semaine", "Cette semaine"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setPeriode(v)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${periode === v ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-600"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {rangs.map((r) => {
          const pct = (x) => (r.total > 0 ? (x / r.total) * 100 : 0);
          const taux = Math.round(r.taux * 100);
          return (
            <div key={r.email}>
              <button type="button" onClick={() => setOuvert(ouvert === r.email ? null : r.email)} className="w-full text-left">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="font-bold text-slate-800">{r.nom}</span>
                  <span className="tabular-nums text-slate-500">
                    <span className={`font-extrabold ${taux >= 75 ? "text-emerald-700" : taux >= 55 ? "text-amber-700" : "text-red-700"}`}>{taux} %</span> · {h(r.facturable)} / {h(r.total)}
                  </span>
                </div>
                <div className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${pct(r.facturable)}%` }} title={`Facturable : ${h(r.facturable)}`} />
                  <div className="bg-sky-300" style={{ width: `${pct(r.transport)}%` }} title={`Transport : ${h(r.transport)}`} />
                  <div className="bg-amber-400" style={{ width: `${pct(r.nonFacturable)}%` }} title={`Non facturable : ${h(r.nonFacturable)}`} />
                </div>
              </button>
              {ouvert === r.email && (
                <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] leading-snug text-slate-600">
                  🟢 Facturable {h(r.facturable)} · 🔵 Transport {h(r.transport)} · 🟠 Non facturable {h(r.nonFacturable)}
                  {Object.keys(r.raisons).length > 0 && (
                    <> — {Object.entries(r.raisons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${h(v)}`).join(" · ")}</>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Heures PAYÉES (dîner et journées bloquées exclus). 🟢 chantier facturable · 🔵 transport (refacturé en partie seulement) · 🟠 administratif, shop, garantie, visites de soumission, aide 🤝 non facturable. Clique un nom pour le détail.
      </p>
    </div>
  );
}
