"use client";

// app/admin/OngletAide.jsx
//
// 💬 AIDE & SUGGESTIONS (2026-09-06 — retour du propriétaire pendant le
// test à blanc : « je ne vois pas où écrire pour les questions… faire
// un onglet aide et suggestion dans le menu à gauche »).
//
// UN SEUL endroit, toujours visible dans le menu (aucun module ne peut
// le retirer — c'est la ligne de vie vers le fabricant) :
//   1. ✍️ ÉCRIRE À FLUXYA — l'admin pose sa question / signale un bug /
//      propose une idée, DIRECTEMENT (pas de triage : l'admin EST le
//      triage de son entreprise — son message part « transmis ») ;
//   2. le TRIAGE des signalements des techniciens (déménagé du Tableau
//      de bord) : Réglé à l'interne / Transmettre à Fluxya / Refuser ;
//   3. le SUIVI : chaque message affiche son statut et la réponse de
//      Fluxya quand elle arrive.

import { useEffect, useState } from "react";
import {
  COURRIEL_PLATEFORME,
  LIBELLES_STATUT_RETOUR,
  creerRetourAdmin,
  listerRetoursEntreprise,
  majRetour,
  sAbonnerRetours,
} from "@/lib/supabase/retours";
import { envoyerCourriel } from "@/lib/courriels";

const TYPES_MESSAGE = [
  ["question", "❓ Question"],
  ["bug", "🐛 Problème / bug"],
  ["idee", "💡 Idée / suggestion"],
];

export function OngletAide({ session, nomAdmin, ajouterJournal }) {
  const [retours, setRetours] = useState([]);
  const [reponses, setReponses] = useState({});
  const [type, setType] = useState("question");
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const charger = () => listerRetoursEntreprise().then(setRetours).catch(() => {});
    charger();
    return sAbonnerRetours(charger);
  }, []);

  const courrielSession = (session?.user?.email || "").toLowerCase();
  const nouveaux = retours.filter((r) => r.statut === "nouveau" && r.auteurEmail !== courrielSession);
  const lesMiens = retours.filter((r) => r.auteurEmail === courrielSession);
  const desTechniciens = retours.filter((r) => r.auteurEmail !== courrielSession);

  // ✍️ L'admin écrit à Fluxya — part directement « transmis ».
  const envoyer = async () => {
    const texte = message.trim();
    if (!texte) return;
    setEnvoiEnCours(true);
    setConfirmation("");
    try {
      await creerRetourAdmin({ type, message: texte }, session);
      ajouterJournal?.(`💬 Message envoyé à Fluxya (${TYPES_MESSAGE.find(([t]) => t === type)?.[1] || type}).`);
      envoyerCourriel({
        a: [COURRIEL_PLATEFORME],
        sujet: `Fluxya — message d'un admin (${type})`,
        html: `<p><strong>${nomAdmin || courrielSession}</strong> :</p><p style="white-space:pre-line;">${texte}</p><p>À traiter dans la console : onglet 💬 Retours.</p>`,
      }).catch(() => {});
      setMessage("");
      setConfirmation("✓ Envoyé à Fluxya — tu suivras la réponse ici, dans « Mes messages ».");
    } catch {
      setConfirmation("⚠️ Envoi impossible — réessaie (le snippet SQL 82 est-il passé ?).");
    }
    setEnvoiEnCours(false);
  };

  // Le triage des signalements des techniciens (2e étage du circuit).
  const agir = async (r, statut) => {
    const mot = (reponses[r.id] || "").trim();
    try {
      if (statut === "transmis") {
        await majRetour(r.id, { statut: "transmis", transmisPar: nomAdmin || null, commentaireTransmission: mot });
        ajouterJournal?.(`➡️ Retour de ${r.auteurNom || r.auteurEmail} (${r.type === "idee" ? "idée" : "bug"}) TRANSMIS à Fluxya${mot ? ` — « ${mot} »` : ""}.`);
        envoyerCourriel({
          a: [COURRIEL_PLATEFORME],
          sujet: `Fluxya — retour transmis (${r.type === "idee" ? "idée" : "bug"})`,
          html: `<p><strong>${r.auteurNom || r.auteurEmail}</strong> (${r.entrepriseId}) :</p><p style="white-space:pre-line;">${r.message}</p>${mot ? `<p>💼 Mot de l'admin : ${mot}</p>` : ""}<p>À traiter dans la console : onglet 💬 Retours.</p>`,
        }).catch(() => {});
      } else {
        await majRetour(r.id, { statut, reponseAdmin: mot });
        ajouterJournal?.(
          statut === "regle-interne"
            ? `✅ Retour de ${r.auteurNom || r.auteurEmail} réglé à l'interne${mot ? ` — « ${mot} »` : ""}.`
            : `❌ Retour de ${r.auteurNom || r.auteurEmail} refusé${mot ? ` — « ${mot} »` : ""}.`
        );
      }
    } catch {
      ajouterJournal?.("⚠️ Retour NON enregistré — le snippet SQL 82 est-il passé ?");
    }
  };

  const iconeType = (t) => (t === "idee" ? "💡" : t === "question" ? "❓" : "🐛");
  const CarteRetour = ({ r, avecTriage }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold text-slate-800">
            {iconeType(r.type)} {r.auteurNom || r.auteurEmail}
            <span className="ml-1.5 font-normal text-slate-400">{r.creeLe ? new Date(r.creeLe).toLocaleDateString("fr-CA") : ""}</span>
          </p>
          <p className="mt-0.5 whitespace-pre-line text-xs text-slate-700">{r.message}</p>
          {r.reponseAdmin && !avecTriage && (
            <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-600">↩️ Réponse du bureau : {r.reponseAdmin}</p>
          )}
          {r.reponseFluxya && (
            <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-600">↩️ Réponse de Fluxya : {r.reponseFluxya}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
          r.statut === "nouveau" ? "bg-blue-100 text-blue-700"
          : r.statut === "regle" || r.statut === "regle-interne" ? "bg-emerald-100 text-emerald-700"
          : r.statut.startsWith("refuse") ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
        }`}>
          {LIBELLES_STATUT_RETOUR[r.statut] || r.statut}
        </span>
      </div>
      {avecTriage && r.statut === "nouveau" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          <input
            value={reponses[r.id] || ""}
            onChange={(ev) => setReponses((p) => ({ ...p, [r.id]: ev.target.value }))}
            placeholder="Mot au technicien / commentaire pour Fluxya (facultatif)"
            className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[11px]"
          />
          <button onClick={() => agir(r, "regle-interne")} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white">
            ✅ Réglé à l&apos;interne
          </button>
          <button onClick={() => agir(r, "transmis")} className="rounded-md bg-[#131B2E] px-2.5 py-1.5 text-[10px] font-bold text-white">
            ➡️ Transmettre à Fluxya
          </button>
          <button onClick={() => agir(r, "refuse-interne")} className="rounded-md border border-red-300 px-2.5 py-1.5 text-[10px] font-bold text-red-600">
            ❌ Refuser
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold text-slate-900">Aide &amp; suggestions</h2>
        <span className="text-xs text-slate-400">La ligne directe avec Fluxya</span>
      </div>

      {/* ✍️ ÉCRIRE À FLUXYA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">✍️ Écrire à Fluxya</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Une question, un problème, une idée d&apos;amélioration — ton message part directement chez Fluxya et tu suis la réponse ici.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TYPES_MESSAGE.map(([t, label]) => (
            <button key={t} onClick={() => setType(t)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${type === t ? "border-[#131B2E] bg-[#131B2E] text-white" : "border-slate-300 bg-white text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(ev) => setMessage(ev.target.value)}
          rows={4}
          placeholder="Décris ta question, ton problème ou ton idée — plus c'est précis, plus la réponse est rapide."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={envoyer} disabled={envoiEnCours || !message.trim()}
            className="rounded-xl bg-[#131B2E] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {envoiEnCours ? "Envoi…" : "Envoyer à Fluxya"}
          </button>
          {confirmation && <p className="text-[11px] font-bold text-slate-600">{confirmation}</p>}
        </div>
      </div>

      {/* 💬 LE TRIAGE — signalements des techniciens (2e étage du circuit) */}
      <div className={`rounded-2xl border p-3 ${nouveaux.length > 0 ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
        <p className={`text-xs font-extrabold uppercase tracking-wide ${nouveaux.length > 0 ? "text-blue-700" : "text-slate-500"}`}>
          💬 Signalements de l&apos;équipe{nouveaux.length > 0 ? ` — ${nouveaux.length} à trier` : ""}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          Les techniciens signalent avec leur bouton 💬 — toi seul décides : réglé à l&apos;interne, transmis à Fluxya, ou refusé.
        </p>
        {desTechniciens.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-[11px] text-slate-400">
            Aucun signalement de l&apos;équipe pour l&apos;instant.
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {desTechniciens.slice(0, 30).map((r) => <CarteRetour key={r.id} r={r} avecTriage />)}
          </div>
        )}
      </div>

      {/* 📨 MES MESSAGES — suivi des envois de l'admin */}
      {lesMiens.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">📨 Mes messages</p>
          <div className="mt-2 space-y-1.5">
            {lesMiens.slice(0, 30).map((r) => <CarteRetour key={r.id} r={r} avecTriage={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}
