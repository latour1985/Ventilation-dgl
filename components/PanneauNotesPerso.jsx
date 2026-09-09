"use client";

// components/PanneauNotesPerso.jsx
//
// 📝 MES NOTES — le panneau du bloc-notes personnel à cocher (2026-09-09,
// demande №8 du propriétaire). PARTAGÉ entre l'admin et l'app
// technicien : le même bouton 📝, la même liste — chacun la sienne
// (RLS, snippet 138). Les notes cochées restent visibles barrées au bas
// de la liste (satisfaction de rayer !) et se suppriment d'un ✕.

import { useEffect, useState } from "react";
import { listerNotesPerso, ajouterNotePerso, basculerNotePerso, supprimerNotePerso } from "@/lib/supabase/notesPerso";

export default function PanneauNotesPerso({ ouvert, onFermer }) {
  const [notes, setNotes] = useState(null); // null = chargement
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!ouvert) return;
    let actif = true;
    setErreur(null);
    listerNotesPerso()
      .then((n) => { if (actif) setNotes(n); })
      .catch((e) => {
        if (!actif) return;
        setNotes([]);
        // Colonne/table absente = snippet pas passé — on le DIT.
        setErreur(/notes_perso/.test(String(e?.message)) ? "La table des notes n'existe pas encore — passe le SQL « 138 - Mes notes »." : String(e?.message || "Lecture impossible — réessaie."));
      });
    return () => { actif = false; };
  }, [ouvert]);

  if (!ouvert) return null;

  const ajouter = async () => {
    const propre = texte.trim();
    if (!propre || enCours) return;
    setEnCours(true);
    try {
      await ajouterNotePerso(propre);
      setTexte("");
      setNotes(await listerNotesPerso());
    } catch (e) {
      setErreur(String(e?.message || "Enregistrement impossible — réessaie."));
    } finally {
      setEnCours(false);
    }
  };
  const basculer = async (n) => {
    setNotes((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, fait: !n.fait } : x)));
    try { await basculerNotePerso(n.id, !n.fait); } catch { /* l'écran a déjà bougé — rechargé à la prochaine ouverture */ }
  };
  const supprimer = async (n) => {
    setNotes((prev) => (prev || []).filter((x) => x.id !== n.id));
    try { await supprimerNotePerso(n.id); } catch { /* idem */ }
  };

  const aFaire = (notes || []).filter((n) => !n.fait);
  const faites = (notes || []).filter((n) => n.fait);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900">📝 Mes notes</h3>
          <button onClick={onFermer} aria-label="Fermer" className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
          {erreur && <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-bold text-amber-800">⚠️ {erreur}</p>}
          {notes === null ? (
            <p className="py-4 text-center text-xs text-slate-400">Chargement…</p>
          ) : aFaire.length === 0 && faites.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Aucune note — écris la première ci-dessous. Personne d&apos;autre ne les voit.</p>
          ) : (
            <div className="space-y-1.5">
              {aFaire.map((n) => (
                <label key={n.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-2.5">
                  <input type="checkbox" checked={false} onChange={() => basculer(n)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A13]" />
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-snug text-slate-800">{n.texte}</span>
                  <button onClick={(e) => { e.preventDefault(); supprimer(n); }} className="shrink-0 text-slate-300 hover:text-red-600" aria-label="Supprimer">✕</button>
                </label>
              ))}
              {faites.length > 0 && (
                <p className="pt-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">✅ Faites</p>
              )}
              {faites.map((n) => (
                <label key={n.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5 opacity-70">
                  <input type="checkbox" checked onChange={() => basculer(n)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-snug text-slate-500 line-through">{n.texte}</span>
                  <button onClick={(e) => { e.preventDefault(); supprimer(n); }} className="shrink-0 text-slate-300 hover:text-red-600" aria-label="Supprimer">✕</button>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ajouter(); } }}
              rows={2}
              placeholder="Nouvelle note… (Entrée pour ajouter)"
              className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={ajouter}
              disabled={!texte.trim() || enCours}
              className="shrink-0 rounded-xl bg-[#131B2E] px-4 py-2.5 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
            >
              ➕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
