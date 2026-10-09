"use client";

// components/DoubleAuth.jsx
//
// 🔐 DOUBLE AUTHENTIFICATION (2026-10-09 — décision du propriétaire :
// obligatoire pour l'Admin principal ET les Admins réguliers, avec une
// application comme Google Authenticator ou Microsoft Authenticator).
//
// La GARDE enveloppe une application (bureau, terrain, console) :
//   • pas connecté → l'application s'affiche (son propre écran de connexion) ;
//   • double authentification activée mais code pas encore entré →
//     écran « Entre le code de 6 chiffres » ;
//   • obligatoire pour ce compte et pas encore activée → écran d'activation
//     (code QR à scanner une seule fois) ;
//   • sinon → l'application.
// La base de données fait respecter la même règle (snippet 172) : un mot
// de passe volé ne suffit pas, même en contournant cet écran.
//
// Modes : "si-active" (app technicien : le code n'est demandé qu'aux comptes
// qui l'ont activée) · "admins" (bureau : obligatoire pour Admin principal et
// Admin régulier) · "plateforme" (console : obligatoire pour le sceau plateforme).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useLangue } from "@/lib/i18n";

const ROLES_OBLIGES = ["Admin principal", "Admin régulier"];

export default function GardeDoubleAuth({ mode = "si-active", children }) {
  const [statut, setStatut] = useState("verif"); // verif | ok | code | inscription

  const evaluer = useCallback(async () => {
    // Un changement d'état ne démonte JAMAIS l'application pour une erreur
    // passagère : en cas de doute (hors ligne), on garde l'état actuel —
    // la base, elle, garde la porte.
    const fixer = (nouveau) => setStatut((avant) => (avant === nouveau ? avant : nouveau));
    try {
      const { data: s } = await supabase.auth.getSession();
      const session = s?.session;
      if (!session) return fixer("ok");
      const { data: niveau, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (niveau?.currentLevel === "aal2") return fixer("ok");
      if (niveau?.nextLevel === "aal2") return fixer("code");
      let obligatoire = false;
      if (mode === "plateforme") {
        obligatoire = session.user?.app_metadata?.plateforme === true;
      } else if (mode === "admins") {
        const { data } = await supabase
          .from("permissions_utilisateurs")
          .select("role")
          .eq("email", String(session.user?.email || "").toLowerCase())
          .maybeSingle();
        obligatoire = ROLES_OBLIGES.includes(String(data?.role || "").trim());
      }
      fixer(obligatoire ? "inscription" : "ok");
    } catch {
      setStatut((avant) => (avant === "verif" ? "ok" : avant));
    }
  }, [mode]);

  useEffect(() => {
    evaluer();
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (["SIGNED_IN", "SIGNED_OUT", "MFA_CHALLENGE_VERIFIED", "USER_UPDATED"].includes(evenement)) evaluer();
    });
    return () => data?.subscription?.unsubscribe();
  }, [evaluer]);

  if (statut === "verif") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">…</div>;
  }
  if (statut === "code") return <EcranCode onReussi={evaluer} />;
  if (statut === "inscription") return <EcranInscription onReussi={evaluer} />;
  return children;
}

function Cadre({ titre, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">🔐 Fluxya</p>
        <h1 className="mt-1 text-lg font-extrabold text-slate-900">{titre}</h1>
        {children}
      </div>
    </div>
  );
}

function ChampCode({ valeur, onChange, onValider, enCours, libelle }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onValider();
      }}
      className="mt-4 space-y-3"
    >
      <input
        value={valeur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="000000"
        aria-label={libelle}
        className="w-full rounded-xl border border-slate-300 px-3 py-3 text-center text-2xl font-bold tracking-[0.4em] tabular-nums outline-none focus:border-slate-900"
      />
      <button
        type="submit"
        disabled={valeur.length !== 6 || enCours}
        className="min-h-[48px] w-full rounded-xl bg-[#131B2E] text-sm font-extrabold text-white disabled:opacity-40"
      >
        {enCours ? "…" : libelle}
      </button>
    </form>
  );
}

function LienDeconnexion() {
  const { t } = useLangue();
  return (
    <button type="button" onClick={() => supabase.auth.signOut()} className="mt-4 w-full text-center text-[11px] font-semibold text-slate-400 underline">
      {t("Se déconnecter")}
    </button>
  );
}

// ---- Chaque connexion : le code de 6 chiffres ----
function EcranCode({ onReussi }) {
  const { t } = useLangue();
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const valider = async () => {
    setEnCours(true);
    setErreur("");
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const facteur = (data?.totp || []).find((f) => f.status === "verified");
      if (!facteur) throw new Error("aucun");
      const { error: e2 } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteur.id, code });
      if (e2) {
        setErreur(t("Code refusé — vérifie l'heure de ton téléphone et entre le code affiché maintenant (il change aux 30 secondes)."));
        setCode("");
        return;
      }
      onReussi();
    } catch {
      setErreur(t("Vérification impossible — vérifie ta connexion et réessaie."));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Cadre titre={t("Entre ton code de sécurité")}>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t("Ouvre ton application d'authentification (Google Authenticator ou Microsoft Authenticator) et entre le code de 6 chiffres affiché pour Fluxya.")}
      </p>
      <ChampCode valeur={code} onChange={setCode} onValider={valider} enCours={enCours} libelle={t("Valider le code")} />
      {erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">⚠️ {erreur}</p>}
      <p className="mt-4 text-[10px] leading-snug text-slate-400">
        {t("Téléphone perdu ou changé ? Demande à l'Admin principal de réinitialiser ta double authentification (onglet Utilisateurs).")}
      </p>
      <LienDeconnexion />
    </Cadre>
  );
}

// ---- Une seule fois : l'activation (code QR) ----
function EcranInscription({ onReussi }) {
  const { t } = useLangue();
  const [inscription, setInscription] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        // Une activation commencée puis abandonnée bloquerait la nouvelle :
        // on l'efface d'abord (seules les NON vérifiées).
        const { data: liste } = await supabase.auth.mfa.listFactors();
        for (const f of liste?.all || []) {
          if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Fluxya ${new Date().toISOString().slice(0, 16)}` });
        if (error) throw error;
        if (!annule) setInscription({ id: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret });
      } catch (e) {
        if (!annule) {
          setErreur(
            /disabled|not enabled|mfa/i.test(String(e?.message || ""))
              ? t("La double authentification n'est pas activée pour ce projet (Supabase → Authentication → Multi-Factor → TOTP). Avise l'administrateur de Fluxya.")
              : t("Préparation impossible — vérifie ta connexion, puis recharge la page.")
          );
        }
      }
    })();
    return () => {
      annule = true;
    };
    // Une seule préparation par affichage (jamais relancée par un changement de langue).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valider = async () => {
    if (!inscription) return;
    setEnCours(true);
    setErreur("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: inscription.id, code });
      if (error) {
        setErreur(t("Code refusé — entre le code affiché MAINTENANT dans l'application (il change aux 30 secondes)."));
        setCode("");
        return;
      }
      onReussi();
    } catch {
      setErreur(t("Vérification impossible — vérifie ta connexion et réessaie."));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Cadre titre={t("Active ta double authentification")}>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t("Ton compte a accès à la gestion de l'entreprise : un code de ton téléphone est maintenant exigé en plus du mot de passe. Ça prend 2 minutes, une seule fois.")}
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
        <li>{t("Installe sur ton cellulaire l'application gratuite Google Authenticator ou Microsoft Authenticator.")}</li>
        <li>{t("Dans l'application, touche « + » puis « Scanner un code QR », et vise le code ci-dessous.")}</li>
        <li>{t("Entre le code de 6 chiffres que l'application affiche pour Fluxya.")}</li>
      </ol>
      <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
        {inscription?.qr ? <img src={inscription.qr} alt={t("Code QR à scanner")} className="h-44 w-44" /> : !erreur ? <span className="text-xs text-slate-400">…</span> : null}
      </div>
      {inscription?.secret && (
        <div className="mt-2 text-center">
          {secretVisible ? (
            <p className="break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-700">{inscription.secret}</p>
          ) : (
            <button type="button" onClick={() => setSecretVisible(true)} className="text-[11px] font-semibold text-slate-500 underline">
              {t("Impossible de scanner ? Afficher la clé à taper à la main")}
            </button>
          )}
        </div>
      )}
      <ChampCode valeur={code} onChange={setCode} onValider={valider} enCours={enCours} libelle={t("Activer")} />
      {erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">⚠️ {erreur}</p>}
      <LienDeconnexion />
    </Cadre>
  );
}
