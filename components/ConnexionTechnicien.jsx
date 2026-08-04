// components/ConnexionTechnicien.jsx
//
// Écran de connexion de l'app technicien (mobile), branché sur Supabase Auth.
// Remplace l'ancien "mode développement". La vraie authentification est
// gérée par Supabase — aucune vérification de mot de passe côté client.

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ConnexionTechnicien() {
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const seConnecter = async (e) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: courriel.trim(),
      password: motDePasse,
    });
    setChargement(false);
    if (error) setErreur("Courriel ou mot de passe incorrect.");
  };

  return (
    <div className="flex h-full flex-col bg-[#131B2E] text-white">
      <div className="flex flex-1 flex-col justify-center px-6">
        <div className="mb-8 flex items-center gap-3">
          {/* Logo de l'entreprise (version blanche pour le fond marine). */}
          <img src="/logo-dgl-blanc.png" alt="Ventilation DGL inc." className="h-14 w-auto shrink-0" />
          <div>
            <p className="text-base font-extrabold">Ventilation DGL inc.</p>
            <p className="text-xs text-slate-400">Application technicien</p>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold">Connexion</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">Connecte-toi pour voir ton horaire du jour.</p>

        <form onSubmit={seConnecter} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Courriel</label>
            <input
              type="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              required
              placeholder="ton.courriel@ventilationdgl.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6A13] focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              placeholder="ton mot de passe"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6A13] focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {erreur && (
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300">{erreur}</p>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full rounded-xl bg-[#FF6A13] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {chargement ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
      <p className="pb-6 text-center text-[10px] text-slate-500">© {new Date().getFullYear()} Ventilation DGL inc.</p>
    </div>
  );
}
