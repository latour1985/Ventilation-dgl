"use client";

// PAGE « CHOISIR MON MOT DE PASSE » — l'atterrissage des liens
// d'invitation ET de réinitialisation.
//
// ANTI-CONSOMMATION AUTOMATIQUE (2026-08-10) : le lien porte un jeton
// HACHÉ dans l'adresse (?jeton=...&type=invite|recovery). On ne le
// vérifie (verifyOtp) QU'AU CLIC de l'employé sur le bouton — jamais au
// chargement. Ainsi, les robots d'aperçu (RCS, Gmail, antivirus) qui
// visitent le lien pour générer une vignette ne grillent pas le jeton à
// usage unique : c'est ce qui causait « lien plus valide » à la 1re
// ouverture.
//
// Compatibilité : si on arrive plutôt avec une session déjà ouverte
// (ancien lien, ou l'utilisateur revient), on montre directement le
// formulaire.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ChoisirMotDePasse() {
  const [etat, setEtat] = useState("verification"); // verification | a_confirmer | pret | verification_en_cours | enregistrement | reussi | sans_session
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [jeton, setJeton] = useState(null);
  const [typeJeton, setTypeJeton] = useState("invite");

  useEffect(() => {
    let actif = true;
    // 1) Un jeton dans l'adresse ? On attend le clic (anti-robot).
    const params = new URLSearchParams(window.location.search);
    const j = params.get("jeton");
    const t = params.get("type") || "invite";
    if (j) {
      setJeton(j);
      setTypeJeton(t);
      setEtat("a_confirmer");
      return () => {
        actif = false;
      };
    }
    // 2) Sinon : peut-être une session déjà ouverte (ancien lien à hash,
    //    ou retour de l'utilisateur). On laisse un instant puis on tranche.
    const verifier = async () => {
      const { data } = await supabase.auth.getSession();
      if (actif && data?.session) setEtat("pret");
    };
    verifier();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (actif && session) setEtat("pret");
    });
    const delai = setTimeout(() => {
      if (actif) setEtat((e) => (e === "verification" ? "sans_session" : e));
    }, 4000);
    return () => {
      actif = false;
      sub?.subscription?.unsubscribe();
      clearTimeout(delai);
    };
  }, []);

  // Vérifie le jeton (verifyOtp) — appelé au CLIC, jamais au chargement.
  const confirmerAcces = async () => {
    setErreur("");
    setEtat("verification_en_cours");
    const { error } = await supabase.auth.verifyOtp({ token_hash: jeton, type: typeJeton });
    if (error) {
      setEtat("sans_session");
      return;
    }
    setEtat("pret");
  };

  const enregistrer = async () => {
    setErreur("");
    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit avoir au moins 8 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setEtat("enregistrement");
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    if (error) {
      setEtat("pret");
      setErreur(error.message || "Enregistrement refusé — réessaie.");
      return;
    }
    setEtat("reussi");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-lg font-extrabold text-slate-900">Ventilation DGL inc.</p>

        {etat === "verification" && <p className="mt-3 text-sm text-slate-500">Un instant…</p>}

        {etat === "a_confirmer" && (
          <div className="mt-3">
            <p className="text-sm text-slate-600">
              Bienvenue ! Clique ci-dessous pour activer ton accès et choisir ton mot de passe.
            </p>
            <button
              onClick={confirmerAcces}
              className="mt-4 min-h-[48px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99]"
            >
              Activer mon accès
            </button>
          </div>
        )}

        {etat === "verification_en_cours" && <p className="mt-3 text-sm text-slate-500">Activation en cours…</p>}

        {etat === "sans_session" && (
          <div className="mt-3">
            <p className="text-sm font-bold text-red-600">Ce lien n&apos;est plus valide.</p>
            <p className="mt-1 text-sm text-slate-600">
              Il a peut-être expiré ou déjà servi. Demande une nouvelle invitation à l&apos;administration,
              un nouveau lien te sera envoyé.
            </p>
          </div>
        )}

        {(etat === "pret" || etat === "enregistrement") && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">Choisis ton mot de passe pour l&apos;application :</p>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nouveau mot de passe (8 caractères et plus)</label>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Répète le mot de passe</label>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            {erreur && <p className="text-xs font-semibold text-red-600">{erreur}</p>}
            <button
              onClick={enregistrer}
              disabled={etat === "enregistrement"}
              className="min-h-[48px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white active:scale-[0.99] disabled:opacity-60"
            >
              {etat === "enregistrement" ? "Enregistrement…" : "Enregistrer mon mot de passe"}
            </button>
          </div>
        )}

        {etat === "reussi" && (
          <div className="mt-3">
            <p className="text-sm font-bold text-emerald-700">✅ Mot de passe enregistré !</p>
            <p className="mt-1 text-sm text-slate-600">Tu peux maintenant ouvrir ton application :</p>
            <div className="mt-3 space-y-2">
              <a href="/technicien" className="block rounded-xl bg-[#131B2E] py-3 text-center text-sm font-extrabold text-white">
                Application technicien
              </a>
              <a href="/admin" className="block rounded-xl border border-slate-300 py-3 text-center text-sm font-bold text-slate-700">
                Portail d&apos;administration
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
