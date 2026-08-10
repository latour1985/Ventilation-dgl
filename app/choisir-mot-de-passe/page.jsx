"use client";

// PAGE « CHOISIR MON MOT DE PASSE » — l'atterrissage des liens
// d'invitation ET de réinitialisation.
//
// L'employé clique le lien reçu par courriel : Supabase le reconnaît
// (le jeton voyage dans l'adresse, la librairie le traite toute seule)
// et cette page lui demande simplement son nouveau mot de passe.
// Personne — ni l'admin, ni nous — ne voit jamais ce mot de passe.
//
// Lien expiré ou déjà utilisé : message clair, pas d'écran cassé.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ChoisirMotDePasse() {
  const [etat, setEtat] = useState("verification"); // verification | pret | sans_session | enregistrement | reussi
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    // La librairie Supabase lit le jeton du lien et ouvre la session —
    // on lui laisse un instant, puis on tranche.
    const verifier = async () => {
      const { data } = await supabase.auth.getSession();
      if (!actif) return;
      if (data?.session) setEtat("pret");
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

        {etat === "verification" && <p className="mt-3 text-sm text-slate-500">Vérification de ton lien…</p>}

        {etat === "sans_session" && (
          <div className="mt-3">
            <p className="text-sm font-bold text-red-600">Ce lien n&apos;est plus valide.</p>
            <p className="mt-1 text-sm text-slate-600">
              Il a peut-être expiré ou déjà servi. Demande une nouvelle invitation à l&apos;administration,
              un nouveau lien te sera envoyé par courriel.
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
