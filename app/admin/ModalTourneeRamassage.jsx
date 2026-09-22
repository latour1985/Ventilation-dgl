"use client";

// app/admin/ModalTourneeRamassage.jsx
//
// 🚚 FICHE D'UNE TOURNÉE DE RAMASSAGE (2026-09-21, demande du
// propriétaire). La tournée n'a pas de formulaire « heures / jours /
// description » : elle est CALCULÉE à partir des bons de commande
// marqués ramassage. Sa fiche montre les arrêts (un par fournisseur) et,
// pour chaque bon, permet de changer le JOUR ou la PERSONNE — le bon
// quitte alors cette tournée pour rejoindre (ou créer) la bonne.

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "./partage";

export function ModalTourneeRamassage({ tache, date, employe, employes, onFermer, onMajRamassageBc, lectureSeule = false }) {
  const [edition, setEdition] = useState(null); // { numero, date, ramassePar }
  const bons = Array.isArray(tache?.ramassages) ? tache.ramassages : [];
  const arrets = [];
  bons.forEach((b) => {
    let a = arrets.find((x) => x.fournisseur.toLowerCase() === String(b.fournisseur || "").toLowerCase());
    if (!a) { a = { fournisseur: b.fournisseur || "Fournisseur", adresse: b.adresse || "", telephone: b.telephone || "", bons: [] }; arrets.push(a); }
    a.bons.push(b);
  });
  // Tout employé peut ramasser (2026-09-21) — sauf les sous-traitants (pas d'app).
  const candidats = (employes || []).filter((e) => e.courriel && !e.estSousTraitant).sort((x, y) => (y.estCommissionnaire ? 1 : 0) - (x.estCommissionnaire ? 1 : 0));
  const appliquer = (b) => {
    if (!edition) return;
    const champs = {};
    if (edition.date && edition.date !== date) champs.date = edition.date;
    if (edition.ramassePar && edition.ramassePar !== (employe?.courriel || "").toLowerCase()) champs.ramassePar = edition.ramassePar;
    if (Object.keys(champs).length > 0) onMajRamassageBc?.(b.numero, champs);
    setEdition(null);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🚚 Tournée de ramassage</h3>
            <p className="text-xs text-slate-500">
              {employe?.nom || "—"} · {date ? new Date(`${date}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }) : ""}
              {" · "}{bons.length} bon{bons.length > 1 ? "s" : ""} · {arrets.length} arrêt{arrets.length > 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <p className="mb-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
          Cette tournée se construit toute seule à partir des bons de commande « ramassage ». Pour la déplacer au complet : glisse son bloc dans l&apos;agenda. Pour un seul bon : « changer » ci-dessous.
        </p>

        <div className="space-y-2">
          {arrets.map((a) => (
            <div key={a.fournisseur} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-extrabold text-slate-800">🏭 {a.fournisseur}</p>
              {a.adresse ? <p className="text-[11px] text-slate-500">📍 {a.adresse}</p> : <p className="text-[11px] italic text-amber-600">Fiche fournisseur sans adresse — à compléter dans Pièces → Fournisseurs.</p>}
              <div className="mt-1.5 space-y-1.5">
                {a.bons.map((b) => (
                  <div key={b.numero} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-bold text-slate-800">🧾 {b.numero}{b.pourJob ? <span className="ml-1.5 font-normal text-slate-500">pour {b.pourJob}</span> : null}</span>
                      {!lectureSeule && onMajRamassageBc && (
                        <button
                          type="button"
                          onClick={() => setEdition(edition?.numero === b.numero ? null : { numero: b.numero, date: date || "", ramassePar: (employe?.courriel || "").toLowerCase() })}
                          className="text-[10px] font-semibold text-blue-600 underline underline-offset-2"
                        >
                          {edition?.numero === b.numero ? "fermer" : "changer jour / personne"}
                        </button>
                      )}
                    </div>
                    {b.texte ? <p className="mt-0.5 whitespace-pre-wrap leading-snug text-slate-600">{b.texte.split("\n").slice(0, 4).join("\n")}{b.texte.split("\n").length > 4 ? "…" : ""}</p> : null}
                    <p className="mt-0.5 text-[10px] text-slate-500">📦 Déposer : <span className="font-semibold text-slate-700">{b.depotA || "Atelier"}</span></p>
                    {edition?.numero === b.numero && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
                        <input type="date" value={edition.date} onChange={(e) => setEdition((p) => ({ ...p, date: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                        <select value={edition.ramassePar} onChange={(e) => setEdition((p) => ({ ...p, ramassePar: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                          {candidats.map((e) => (
                            <option key={e.id} value={String(e.courriel).toLowerCase()}>{e.estCommissionnaire ? "🚚 " : ""}{e.nom}</option>
                          ))}
                        </select>
                        <Button onClick={() => appliquer(b)} className="min-h-0 px-3 py-1 text-xs">OK</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {arrets.length === 0 && <p className="text-xs text-slate-400">Aucun bon dans cette tournée — elle disparaîtra d&apos;elle-même.</p>}
        </div>
      </div>
    </div>
  );
}
