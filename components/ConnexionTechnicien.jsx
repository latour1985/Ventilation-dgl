// components/ConnexionTechnicien.jsx
//
// Écran de connexion de l'app technicien (mobile), branché sur Supabase Auth.
// Remplace l'ancien "mode développement". La vraie authentification est
// gérée par Supabase — aucune vérification de mot de passe côté client.

"use client";

import { useState } from "react";
import { seConnecterSurveille, demanderReinitialisation } from "@/lib/connexionSurveillee";
import Logo from "@/components/Logo";
import ChampMotDePasse from "@/components/ChampMotDePasse";
import BoutonLangue from "@/components/BoutonLangue";
import { useLangue } from "@/lib/i18n";

export default function ConnexionTechnicien() {
  const { t } = useLangue();
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
    <div className="flex h-full flex-col bg-[#131B2E] text-white">
      <div className="flex flex-1 flex-col justify-center px-6">
        <div className="mb-8 flex items-center gap-3">
          {/* FLUXYA — marque produit neutre (brief 2026-08-18). */}
          <div>
            <Logo variant="full" sombre className="mb-1 scale-90 origin-left" />
            <p className="text-xs text-slate-400">{t("Application technicien")}</p>
          </div>
          <BoutonLangue sombre className="ml-auto" />
        </div>

        <h1 className="text-2xl font-extrabold">{t("Connexion")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">{t("Connecte-toi pour voir ton horaire du jour.")}</p>

        <form onSubmit={seConnecter} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{t("Courriel")}</label>
            <input
              type="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              required
              placeholder={t("ton.courriel@ventilationdgl.com")}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6A13] focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{t("Mot de passe")}</label>
            <ChampMotDePasse
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              placeholder={t("ton mot de passe")}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6A13] focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {verrouMinutes != null && (
            <div className="rounded-lg bg-red-500/20 px-3 py-2.5 text-xs text-red-200">
              <p className="font-extrabold">{t("🔒 Compte verrouillé après 3 essais.")}</p>
              <p className="mt-0.5">{verrouMinutes > 1
                  ? t("Réessaie dans {n} minutes — ou réinitialise ton mot de passe :", { n: verrouMinutes })
                  : t("Réessaie dans 1 minute — ou réinitialise ton mot de passe :")}</p>
              {reinitEnvoyee ? (
                <p className="mt-1.5 rounded bg-emerald-500/20 px-2 py-1.5 font-bold text-emerald-300">
                  {t("📧 Courriel envoyé — clique le lien pour choisir un nouveau mot de passe (le verrou saute aussitôt).")}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!courriel.trim()) return;
                    const ok = await demanderReinitialisation(courriel);
                    if (ok) setReinitEnvoyee(true);
                  }}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg bg-red-600 px-3 font-extrabold text-white active:scale-[0.99]"
                >
                  {t("📧 Recevoir un courriel de réinitialisation")}
                </button>
              )}
            </div>
          )}
          {erreur && (
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300">
              {t(erreur)}
              {essaisRestants != null && essaisRestants > 0 && (
                <span className="mt-0.5 block font-bold">{essaisRestants > 1 ? t("⚠️ {n} essais restants avant le verrouillage (15 min).", { n: essaisRestants }) : t("⚠️ 1 essai restant avant le verrouillage (15 min).")}</span>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full rounded-xl bg-[#FF6A13] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {chargement ? t("Connexion…") : t("Se connecter")}
          </button>
        </form>
      </div>
      <p className="pb-6 text-center text-[10px] text-slate-500">Fluxya · © {new Date().getFullYear()} Ventilation DGL inc.</p>
    </div>
  );
}
