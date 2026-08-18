// components/ConnexionAdmin.jsx
//
// Écran de connexion de l'app admin, branché sur Supabase Auth.
// La vraie authentification (comptes, mots de passe, sessions) est gérée
// par Supabase — aucune vérification côté client, seulement l'appel sécurisé.

"use client";

import { useState } from "react";
import { seConnecterSurveille, demanderReinitialisation } from "@/lib/connexionSurveillee";
import Logo from "@/components/Logo";

export default function ConnexionAdmin() {
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [verrouMinutes, setVerrouMinutes] = useState(null);
  const [essaisRestants, setEssaisRestants] = useState(null);
  const [reinitEnvoyee, setReinitEnvoyee] = useState(false);

  const seConnecter = async (e) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const r = await seConnecterSurveille(courriel.trim(), motDePasse);
    setChargement(false);
    if (r.ok) return; // le succès est capté par onAuthStateChange
    if (r.verrouille) {
      setVerrouMinutes(r.minutes || 15);
      setErreur("");
      return;
    }
    setEssaisRestants(r.essaisRestants ?? null);
    setErreur(r.erreur || "Courriel ou mot de passe incorrect.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="bg-[#131B2E] px-6 pb-6 pt-7 text-white">
            {/* FLUXYA — marque produit neutre (brief 2026-08-18) :
                aucune mention d'entreprise sur l'écran de connexion. */}
            <div>
              <Logo variant="compact" sombre />
              <p className="mt-0.5 text-[11px] text-slate-400">Portail d'administration</p>
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

            {verrouMinutes != null && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-800">
                <p className="font-extrabold">🔒 Compte verrouillé après 3 essais.</p>
                <p className="mt-0.5">Réessaie dans {verrouMinutes} minute{verrouMinutes > 1 ? "s" : ""} — ou réinitialise ton mot de passe tout de suite :</p>
                {reinitEnvoyee ? (
                  <p className="mt-1.5 rounded bg-emerald-50 px-2 py-1.5 font-bold text-emerald-700">
                    📧 Courriel envoyé à {courriel.trim()} — clique le lien pour choisir un nouveau mot de passe (le verrou saute aussitôt).
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!courriel.trim()) return;
                      const ok = await demanderReinitialisation(courriel);
                      if (ok) setReinitEnvoyee(true);
                    }}
                    className="mt-1.5 w-full rounded-lg bg-red-600 px-3 py-2 font-extrabold text-white active:scale-[0.99]"
                  >
                    📧 Recevoir un courriel de réinitialisation
                  </button>
                )}
              </div>
            )}
            {erreur && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {erreur}
                {essaisRestants != null && essaisRestants > 0 && (
                  <span className="mt-0.5 block font-bold">⚠️ {essaisRestants} essai{essaisRestants > 1 ? "s" : ""} restant{essaisRestants > 1 ? "s" : ""} avant le verrouillage (15 min).</span>
                )}
              </p>
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
          Fluxya · application confidentielle — usage autorisé seulement.
        </p>
      </div>
    </div>
  );
}
