"use client";

// app/admin/RechercheJournal.jsx
//
// 🔎 RECHERCHER DANS LE JOURNAL (2026-10-08, demande du propriétaire :
// « il faudrait une recherche rapide pour le journal »). Le panneau du
// bas n'affiche que les 300 dernières lignes (≈ 3 jours) ; le journal,
// lui, est conservé au complet (append-only, Loi 25). Cette fenêtre
// fouille TOUT l'historique par la route serveur /api/journal — bureau
// seulement, entreprise de l'appelant seulement.

import { useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { useLangue } from "@/lib/i18n";
import { rechercherJournal } from "@/lib/supabase/journal";

const PERIODES = [
  ["jour", "Aujourd'hui"],
  ["7j", "7 jours"],
  ["30j", "30 jours"],
  ["tout", "Tout"],
  ["dates", "Dates…"],
];
const TYPES = [
  ["", "Tout"],
  ["problemes", "⚠️ Problèmes"],
  ["bc", "🧾 Bons de commande"],
  ["facturation", "💰 Facturation"],
];

// Minuit LOCAL (règle de la maison : jamais toISOString pour une date
// calendrier) → instant ISO pour la base.
const minuitLocal = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
const isoDepuisJourLocal = (aaaammjj) => (aaaammjj ? new Date(`${aaaammjj}T00:00:00`).toISOString() : null);
const lendemainIso = (aaaammjj) => {
  if (!aaaammjj) return null;
  const d = new Date(`${aaaammjj}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

function bornes(periode, du, au) {
  const maintenant = new Date();
  if (periode === "jour") return { depuis: minuitLocal(maintenant), jusqua: null };
  if (periode === "7j" || periode === "30j") {
    const d = new Date(maintenant);
    d.setDate(d.getDate() - (periode === "7j" ? 6 : 29));
    return { depuis: minuitLocal(d), jusqua: null };
  }
  if (periode === "dates") return { depuis: isoDepuisJourLocal(du), jusqua: lendemainIso(au) };
  return { depuis: null, jusqua: null };
}

// Surligne les mots cherchés (insensible à la casse) — repère visuel
// dans les longues lignes du journal.
function Surligne({ texte, mots }) {
  if (!mots.length) return texte;
  const motif = new RegExp(`(${mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return String(texte)
    .split(motif)
    .map((morceau, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="rounded bg-amber-200 px-0.5 text-slate-900">
          {morceau}
        </mark>
      ) : (
        morceau
      )
    );
}

export default function RechercheJournal({ onFermer }) {
  const { t: tr } = useLangue();
  const [q, setQ] = useState("");
  const [periode, setPeriode] = useState("30j");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [type, setType] = useState("");
  const [lignes, setLignes] = useState([]);
  const [encore, setEncore] = useState(false);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState("");
  // Une frappe rapide lance plusieurs recherches : seule la DERNIÈRE
  // réponse a le droit d'afficher ses résultats.
  const numeroRef = useRef(0);
  const champRef = useRef(null);

  useEffect(() => {
    champRef.current?.focus();
  }, []);

  useEffect(() => {
    const surEchap = (e) => e.key === "Escape" && onFermer?.();
    window.addEventListener("keydown", surEchap);
    return () => window.removeEventListener("keydown", surEchap);
  }, [onFermer]);

  const chercher = async ({ suite = false } = {}) => {
    const numero = ++numeroRef.current;
    setCharge(true);
    setErreur("");
    try {
      const { depuis, jusqua } = bornes(periode, du, au);
      const avant = suite && lignes.length ? lignes[lignes.length - 1].horodatage : null;
      const r = await rechercherJournal({ q, depuis, jusqua, avant, type, limite: 100 });
      if (numero !== numeroRef.current) return;
      setLignes((prec) => (suite ? [...prec, ...r.lignes] : r.lignes));
      setEncore(r.encore);
    } catch {
      if (numero === numeroRef.current) setErreur(tr("Recherche impossible — vérifie la connexion et réessaie."));
    } finally {
      if (numero === numeroRef.current) setCharge(false);
    }
  };

  // Recherche automatique ~0,4 s après la dernière frappe ou au
  // changement d'un filtre.
  useEffect(() => {
    if (periode === "dates" && !du && !au) return undefined;
    const minuterie = setTimeout(() => chercher(), 400);
    return () => clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, periode, du, au, type]);

  const mots = q.trim().split(/\s+/).filter(Boolean);
  const aujourdhui = new Date().toLocaleDateString("fr-CA");
  const puce = (actif) =>
    `min-h-[36px] rounded-full border px-3 text-xs font-bold transition-colors ${
      actif ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
    }`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-3 md:items-center md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFermer?.();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="space-y-2.5 border-b border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">🔎 {tr("Rechercher dans le journal")}</h3>
            <button type="button" onClick={onFermer} aria-label={tr("Fermer")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-slate-500">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              ref={champRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && chercher()}
              placeholder={tr("BC-1086, nom d'un client, retrait, un employé…")}
              className="min-h-[44px] w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PERIODES.map(([cle, libelle]) => (
              <button key={cle} type="button" onClick={() => setPeriode(cle)} className={puce(periode === cle)}>
                {tr(libelle)}
              </button>
            ))}
          </div>
          {periode === "dates" && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <label className="flex items-center gap-1.5">
                {tr("Du")}
                <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="min-h-[36px] rounded-lg border border-slate-300 px-2 text-xs" />
              </label>
              <label className="flex items-center gap-1.5">
                {tr("au")}
                <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="min-h-[36px] rounded-lg border border-slate-300 px-2 text-xs" />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(([cle, libelle]) => (
              <button key={cle || "tout"} type="button" onClick={() => setType(cle)} className={puce(type === cle)}>
                {tr(libelle)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {erreur && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
          {!erreur && !charge && lignes.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">{tr("Aucune ligne ne correspond à cette recherche.")}</p>
          )}
          <div className="space-y-1.5">
            {lignes.map((e) => (
              <p key={e.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-snug text-slate-700">
                <span className="mr-1 whitespace-nowrap tabular-nums text-slate-400">
                  {e.date && e.date !== aujourdhui ? `${e.date} ` : ""}
                  {e.heure}
                </span>
                — <Surligne texte={e.texte} mots={mots} />
              </p>
            ))}
          </div>
          {charge && <p className="py-3 text-center text-xs font-bold text-slate-400">{tr("Recherche en cours…")}</p>}
          {!charge && encore && (
            <button
              type="button"
              onClick={() => chercher({ suite: true })}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:border-slate-500"
            >
              {tr("Afficher plus")}
            </button>
          )}
          {!charge && lignes.length > 0 && (
            <p className="pt-2 text-right text-[10px] text-slate-400">
              {tr("{n} ligne(s) affichée(s)", { n: lignes.length })}
              {encore ? ` — ${tr("il y en a d'autres")}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
