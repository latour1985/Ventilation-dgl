"use client";

// app/admin/OptionsAbonnement.jsx
//
// 📦 OPTIONS PAYANTES ACTIVÉES PAR L'ENTREPRISE (2026-10-08, demande du
// propriétaire) — Paramètres → Options. L'Admin principal lit le
// descriptif et les conditions, CONSENT à l'augmentation, et active
// lui-même l'option ; la facturation suit seule (console Fluxya :
// prorata au mois d'activation). La preuve du consentement (qui, quand,
// prix, version et texte des conditions) est gardée en base, intouchable
// (snippet 171). 🧪 Version d'essai seulement pour l'instant.

import { useState } from "react";
import { useLangue } from "@/lib/i18n";
import { envoyerCourriel } from "@/lib/courriels";
import { COURRIEL_PLATEFORME } from "@/lib/supabase/retours";
import {
  conditionsInventaire,
  CONDITIONS_INVENTAIRE_VERSION,
  activerOptionInventaire,
  desactiverOptionInventaire,
  optionInventaireActive,
} from "@/lib/supabase/inventaireModule";

const argent = (n) => `${(Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const dateLongue = (iso) => (iso ? new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "");

const DESCRIPTIF = [
  "Emplacements : l'entrepôt, chaque camion, les chantiers.",
  "Entrées, sorties et transferts — chaque mouvement gardé à l'historique.",
  "Comptages physiques avec écarts en quantité et en $, ajustements datés et signés.",
  "Valeur du stock au coût moyen, seuils minimums et commandes suggérées.",
  "Scan des codes-barres et étiquettes QR au téléphone (app technicien).",
];

export default function OptionsAbonnement({ config, estAdminPrincipal, ajouterJournal, onConfigOptions }) {
  const { t: tr, langue } = useLangue();
  const [accepte, setAccepte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const prix = Number(config?.prixOptionInventaire ?? 50);
  const nomEntreprise = config?.nomCommercial || config?.nomLegal || "l'entreprise";
  const active = optionInventaireActive(config);
  const finProgrammee = active && config?.optionInventaireFinLe ? config.optionInventaireFinLe : null;
  const conditions = conditionsInventaire(prix);

  const aviserFluxya = (sujet, detail) =>
    envoyerCourriel({
      a: [COURRIEL_PLATEFORME],
      sujet: `Fluxya — ${sujet} (${nomEntreprise})`,
      html: `<p><strong>${nomEntreprise}</strong> (${config?.id || "?"}) — ${detail}</p><p>Prix : ${argent(prix)} / mois · conditions ${CONDITIONS_INVENTAIRE_VERSION}.</p><p>La console calcule le nouveau total du mois (onglet Facturation).</p>`,
    }).catch(() => {});

  const activer = async () => {
    setEnCours(true);
    setErreur("");
    setMessage("");
    try {
      const action = await activerOptionInventaire(prix);
      const maintenant = new Date().toISOString();
      if (action === "annulation_desactivation") {
        onConfigOptions?.({ optionInventaireFinLe: null });
        ajouterJournal?.(`📦 Option Inventaire : désactivation ANNULÉE — l'option reste active (${argent(prix)}/mois, conditions acceptées).`);
        aviserFluxya("option Inventaire conservée", "la désactivation programmée a été annulée ; l'option reste active.");
        setMessage(tr("C'est noté : l'option reste active."));
      } else {
        onConfigOptions?.({ optionInventaire: true, optionInventaireActiveLe: maintenant, optionInventaireFinLe: null });
        ajouterJournal?.(`📦 Option Inventaire ACTIVÉE — +${argent(prix)}/mois, conditions ${CONDITIONS_INVENTAIRE_VERSION} acceptées.`);
        aviserFluxya("option Inventaire ACTIVÉE", `l'option a été activée le ${new Date().toLocaleString("fr-CA")}.`);
        setMessage(tr("Option activée — l'onglet « Inventaire » est maintenant dans le menu, sous « Pièces en commande »."));
      }
      setAccepte(false);
    } catch (err) {
      setErreur(err?.message || tr("Activation refusée — réessaie."));
    } finally {
      setEnCours(false);
    }
  };

  const desactiver = async () => {
    if (!window.confirm(tr("Désactiver l'option Inventaire ? Elle reste accessible jusqu'à la fin du mois en cours, puis s'arrête. Les données sont conservées."))) return;
    setEnCours(true);
    setErreur("");
    setMessage("");
    try {
      const fin = await desactiverOptionInventaire();
      onConfigOptions?.({ optionInventaireFinLe: fin });
      ajouterJournal?.(`📦 Option Inventaire : désactivation programmée — fin le ${fin}.`);
      aviserFluxya("option Inventaire désactivée", `désactivation programmée, effet à la fin du mois (${fin}).`);
      setMessage(tr("Désactivation programmée : l'option s'arrête le {d}.", { d: dateLongue(fin) }));
    } catch (err) {
      setErreur(err?.message || tr("Désactivation refusée — réessaie."));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{tr("Options de l'abonnement")}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{tr("Des modules en supplément, activés par l'Admin principal. La facture mensuelle Fluxya s'ajuste toute seule.")}</p>
      </div>

      <div className={`rounded-2xl border-2 p-4 ${active ? "border-emerald-300 bg-emerald-50/40" : "border-orange-300 bg-orange-50/40"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-base font-extrabold text-slate-900">📦 {tr("Inventaire")}</p>
            <p className="text-sm font-bold text-slate-700">
              + {argent(prix)} {tr("/ mois, taxes en sus")}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
              finProgrammee ? "bg-amber-100 text-amber-800" : active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {finProgrammee
              ? tr("S'arrête le {d}", { d: dateLongue(finProgrammee) })
              : active
                ? config?.optionInventaireActiveLe
                  ? tr("Active depuis le {d}", { d: dateLongue(config.optionInventaireActiveLe) })
                  : tr("Active")
                : tr("Non activée")}
          </span>
        </div>

        <ul className="mt-3 space-y-1 text-[13px] text-slate-700">
          {DESCRIPTIF.map((d) => (
            <li key={d}>✓ {tr(d)}</li>
          ))}
        </ul>

        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-extrabold text-slate-700">📜 {tr("Conditions de l'option")}</p>
          {langue === "en" && <p className="mt-0.5 text-[10px] italic text-slate-500">{tr("Legal terms shown in French — the French version governs.")}</p>}
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] leading-snug text-slate-600">
            {conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {tr("Version des conditions :")} {CONDITIONS_INVENTAIRE_VERSION}
          </p>
        </div>

        {!estAdminPrincipal && (
          <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">🔒 {tr("Seul l'Admin principal peut activer ou désactiver une option.")}</p>
        )}

        {estAdminPrincipal && (!active || finProgrammee) && (
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 rounded-xl border border-slate-300 bg-white p-3 text-[13px] leading-snug text-slate-800">
              <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-orange-500" />
              <span>
                {finProgrammee
                  ? tr("Je garde l'option : l'abonnement Fluxya de {e} continue d'inclure {p} par mois, selon les conditions ci-dessus.", { e: nomEntreprise, p: argent(prix) })
                  : tr("J'accepte que l'abonnement Fluxya de {e} augmente de {p} par mois à partir d'aujourd'hui, selon les conditions ci-dessus.", { e: nomEntreprise, p: argent(prix) })}
              </span>
            </label>
            <button
              type="button"
              disabled={!accepte || enCours}
              onClick={activer}
              className="min-h-[48px] w-full rounded-xl bg-orange-500 text-sm font-extrabold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enCours ? tr("Un instant…") : finProgrammee ? tr("Garder l'option") : tr("Activer l'option")}
            </button>
          </div>
        )}

        {estAdminPrincipal && active && !finProgrammee && (
          <button
            type="button"
            disabled={enCours}
            onClick={desactiver}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-600 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            {tr("Désactiver l'option (effet à la fin du mois)")}
          </button>
        )}

        {erreur && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
        {message && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">✓ {message}</p>}
      </div>
      <p className="px-1 text-[10px] text-slate-400">🧪 {tr("Option en développement — visible seulement sur la version d'essai.")}</p>
    </div>
  );
}
