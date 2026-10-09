"use client";

// components/BoutonSauvegarde.jsx
//
// 💾 SAUVEGARDE À LA DEMANDE (2026-10-09, demande du propriétaire :
// « assure-toi que la sauvegarde fonctionne bien »). La sauvegarde
// automatique tourne chaque lundi matin ; ce bouton en fait une tout de
// suite — pour la vérifier, ou avant un gros changement. Le résultat
// affiche des COMPTES par table (jamais de contenu) : une table vide ou
// illisible saute aux yeux. Réservé à l'Admin principal de DGL (la route
// /api/sauvegarde refuse tout le monde d'autre).

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function BoutonSauvegarde() {
  const [etat, setEtat] = useState(null); // null | "encours" | { resultat } | { erreur }
  const [detailOuvert, setDetailOuvert] = useState(false);

  const lancer = async () => {
    setEtat("encours");
    try {
      const { data } = await supabase.auth.getSession();
      const jeton = data?.session?.access_token;
      if (!jeton) {
        setEtat({ erreur: "Session expirée — reconnecte-toi." });
        return;
      }
      const reponse = await fetch("/api/sauvegarde", { headers: { Authorization: `Bearer ${jeton}` } });
      const r = await reponse.json().catch(() => ({}));
      if (!reponse.ok || r.erreur) setEtat({ erreur: r.erreur || `Sauvegarde refusée (code ${reponse.status}).` });
      else if (r.simule) setEtat({ erreur: "La sauvegarde n'est pas configurée sur ce site." });
      else setEtat({ resultat: r });
    } catch {
      setEtat({ erreur: "Réseau indisponible — réessaie." });
    }
  };

  const r = etat?.resultat;
  const tables = r?.parTable ? Object.entries(r.parTable).sort(([a], [b]) => a.localeCompare(b)) : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">💾 Sauvegarde de sécurité</p>
      <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
        Une copie complète des données est faite automatiquement chaque lundi matin et rangée au Canada (8 semaines
        gardées). Ce bouton en fait une tout de suite — par exemple avant un gros changement.
      </p>
      <button
        type="button"
        onClick={lancer}
        disabled={etat === "encours"}
        className="rounded-lg bg-[#131B2E] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        {etat === "encours" ? "Sauvegarde en cours…" : "💾 Faire une sauvegarde maintenant"}
      </button>

      {etat?.erreur && (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">⚠️ {etat.erreur}</p>
      )}

      {r && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
          <p className="font-extrabold">✅ Sauvegarde créée : {r.fichier}</p>
          <p className="mt-0.5">
            {tables.length} tables · {Number(r.lignes || 0).toLocaleString("fr-CA")} lignes · {r.tailleKo} Ko
          </p>
          {Array.isArray(r.illisibles) && r.illisibles.length > 0 ? (
            <p className="mt-1 font-bold text-red-700">⚠️ Tables illisibles : {r.illisibles.join(", ")}</p>
          ) : (
            <p className="mt-1 font-bold">Toutes les tables ont été lues.</p>
          )}
          {tables.length > 0 && (
            <button type="button" onClick={() => setDetailOuvert((v) => !v)} className="mt-1 font-semibold underline">
              {detailOuvert ? "Masquer le détail" : "Voir le détail par table"}
            </button>
          )}
          {detailOuvert && (
            <ul className="mt-1 grid grid-cols-2 gap-x-4 tabular-nums">
              {tables.map(([t, n]) => (
                <li key={t} className={n === "illisible" ? "font-bold text-red-700" : ""}>
                  {t} : {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
