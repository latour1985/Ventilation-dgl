// components/ConnexionAdmin.jsx
//
// Écran de connexion de l'app admin, branché sur Supabase Auth.
// La vraie authentification (comptes, mots de passe, sessions) est gérée
// par Supabase — aucune vérification côté client, seulement l'appel sécurisé.

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ConnexionAdmin() {
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
    // Le succès est capté par onAuthStateChange dans App — pas besoin de rediriger ici.
    if (error) setErreur("Courriel ou mot de passe incorrect.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="bg-[#131B2E] px-6 pb-6 pt-7 text-white">
            <div className="flex items-center gap-3">
              {/* Logo de l'entreprise (version blanche pour le fond marine). */}
              <img src="/logo-dgl-blanc.png" alt="Ventilation DGL inc." className="h-11 w-auto shrink-0" />
              <div>
                <p className="text-sm font-extrabold">Ventilation DGL inc.</p>
                <p className="text-[11px] text-slate-400">Portail d'administration</p>
              </div>
            </div>
            <h1 className="mt-5 text-xl font-extrabold">Connexion</h1>
            <p className="mt-0.5 text-xs text-slate-300">Accède à la gestion de tes projets, devis et véhicules.</p>
          </div>

          <form onSubmit={seConnecter} className="space-y-3 p-6">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Courriel</label>
              <input
                type="email"
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
                required
                placeholder="ton.courriel@ventilationdgl.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#FF6A13] focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Mot de passe</label>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                placeholder="ton mot de passe"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#FF6A13] focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {erreur && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erreur}</p>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full rounded-xl bg-[#131B2E] py-3 text-sm font-extrabold text-white hover:bg-[#0b1220] disabled:opacity-60"
            >
              {chargement ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[10px] text-slate-400">
          © {new Date().getFullYear()} Ventilation DGL inc. — Application confidentielle, usage interne.
        </p>
      </div>
    </div>
  );
}
