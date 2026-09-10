"use client";

// components/ContactEntreprise.jsx
//
// 📞 « CONTACTER L'ENTREPRISE » (2026-09-10, audit Copilot — retenu par
// le propriétaire) : sur chaque page publique (devis, bon de travail,
// facture), le client peut appeler ou écrire à l'entreprise — sans
// chercher les coordonnées en petit dans l'en-tête.
//
// ✉️ V2 (même jour, constat du propriétaire) : le lien mailto: ouvrait
// le sélecteur d'applications de Windows — laid et bloquant pour un
// client qui lit son devis dans Gmail. Quand la page fournit son JETON,
// « Écrire un message » ouvre un mini-formulaire ICI MÊME : Fluxya
// envoie le message par courriel à l'entreprise (/api/contact-entreprise,
// verrouillé par le jeton du document), et le bouton « Répondre » de
// l'entreprise répond directement au client. Sans jeton : repli mailto.
//
// Rien ne s'affiche si l'entreprise n'a ni téléphone ni courriel, et le
// bloc disparaît à l'impression (print:hidden) — il n'appartient pas au
// document officiel.

import { useState } from "react";

export default function ContactEntreprise({ nom, telephone, courriel, jeton, type }) {
  const tel = String(telephone || "").trim();
  const mail = String(courriel || "").trim();
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [nomClient, setNomClient] = useState("");
  const [repondreA, setRepondreA] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  if (!tel && !mail) return null;
  const formulairePossible = !!jeton && !!type && mail;

  const envoyer = async () => {
    setErreur("");
    if (message.trim().length < 5) {
      setErreur("Écris ton message d'abord (au moins quelques mots).");
      return;
    }
    setEnvoiEnCours(true);
    try {
      const r = await fetch("/api/contact-entreprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, type, message: message.trim(), nom: nomClient.trim(), repondreA: repondreA.trim(), siteWeb: "" }),
      });
      const res = await r.json().catch(() => ({}));
      if (r.ok && res?.envoye) {
        setEnvoye(true);
      } else {
        setErreur(res?.erreur || "Envoi impossible pour l'instant — réessaie, ou appelle-nous.");
      }
    } catch {
      setErreur("Envoi impossible pour l'instant — réessaie, ou appelle-nous.");
    }
    setEnvoiEnCours(false);
  };

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 text-center print:hidden">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Une question ? Contactez-nous</p>
      {nom ? <p className="mt-1 text-sm font-extrabold text-[#131B2E]">{nom}</p> : null}

      {envoye ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
          ✅ Message envoyé — nous vous répondrons rapidement{repondreA.trim() ? ` à ${repondreA.trim()}` : ""}.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            {tel && (
              <a
                href={`tel:${tel.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#131B2E] px-5 py-2.5 text-sm font-bold text-white active:scale-[0.99]"
              >
                📞 Appeler — {tel}
              </a>
            )}
            {mail && formulairePossible && (
              <button
                type="button"
                onClick={() => setOuvert((o) => !o)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 active:scale-[0.99]"
              >
                ✉️ {ouvert ? "Fermer le message" : "Écrire un message"}
              </button>
            )}
            {mail && !formulairePossible && (
              <a
                href={`mailto:${mail}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 active:scale-[0.99]"
              >
                ✉️ Écrire un courriel
              </a>
            )}
          </div>

          {ouvert && formulairePossible && (
            <div className="mt-3 text-left">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Votre question ou commentaire…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A13]"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  value={nomClient}
                  onChange={(e) => setNomClient(e.target.value)}
                  maxLength={120}
                  placeholder="Votre nom"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A13]"
                />
                <input
                  value={repondreA}
                  onChange={(e) => setRepondreA(e.target.value)}
                  type="email"
                  maxLength={160}
                  placeholder="Votre courriel (pour la réponse)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A13]"
                />
              </div>
              {erreur && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{erreur}</p>}
              <button
                type="button"
                onClick={envoyer}
                disabled={envoiEnCours}
                className="mt-2 w-full rounded-xl bg-[#FF6A13] px-5 py-2.5 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {envoiEnCours ? "Envoi…" : "Envoyer le message"}
              </button>
              <p className="mt-1.5 text-center text-[10px] text-slate-400">
                Votre message part par courriel à {nom || "l'entreprise"} — laissez votre courriel pour recevoir la réponse directement.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
