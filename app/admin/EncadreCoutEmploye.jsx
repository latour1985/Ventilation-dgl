"use client";

// app/admin/EncadreCoutEmploye.jsx
//
// 💵 « COÛT DU COMMISSIONNAIRE SUR L'ANNÉE » (2026-09-21, demande du
// propriétaire). Une seule carte : ce qu'il a coûté depuis le début de
// l'année (salaire + charges de l'employeur + camion), le rythme, la
// projection sur 12 mois, et le coût moyen par ramassage — pour juger
// s'il coûte moins cher que faire livrer ou qu'envoyer un technicien à
// 130 $/h. Écran ADMIN uniquement (jamais sur un document client).
// Frais généraux : ce coût n'est réparti à aucune job (décision JF).

import { useState } from "react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { coutAnnuelEmploye } from "@/lib/coutEmploye";
import { bornesPeriodeAnalyse } from "./partage";

const $ = (n) => `${(Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} $`;
const h = (n) => `${(Number(n) || 0).toFixed(1)} h`;

export function EncadreCoutEmploye({ utilisateur, travaux, inspections, achatsLibres = [], compact = false, onOuvrirParametres = null }) {
  const config = useEntreprise();
  const [detail, setDetail] = useState(false);
  if (!utilisateur?.courriel) return null;
  const { debut, fin } = bornesPeriodeAnalyse("fiscale", config?.debutAnneeFiscale);
  const c = coutAnnuelEmploye({
    courriel: utilisateur.courriel,
    travaux,
    inspections,
    achatsLibres,
    tauxFiche: Number(utilisateur.tauxHoraire) || 0,
    chargesPct: Number(config?.chargesEmployeurPct) || 0,
    coutCamionDefaut: Number(config?.coutCamionHoraire) || 0,
    debutAnneeISO: debut,
    aujourdhuiISO: fin,
  });
  if (!c) return null;
  const sansCharges = c.chargesPct <= 0;
  const sansTaux = c.tauxFiche <= 0 && c.salaire <= 0;
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
          💵 Coût de {utilisateur.nom} depuis le {new Date(`${debut}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
        </p>
        <button type="button" onClick={() => setDetail((v) => !v)} className="text-[10px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600">
          {detail ? "moins de détail" : "comment c'est calculé"}
        </button>
      </div>
      {c.joursTravailles === 0 ? (
        <p className="mt-2 text-xs text-slate-400">Aucune heure pointée cette année — le coût apparaîtra dès sa première journée.</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-400">Coût à ce jour</p>
              <p className="text-lg font-extrabold tabular-nums text-[#131B2E]">{$(c.total)}</p>
              <p className="text-[10px] text-slate-500">{h(c.heures)} · {c.joursTravailles} jour{c.joursTravailles > 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-400">Projection 12 mois</p>
              <p className="text-lg font-extrabold tabular-nums text-[#131B2E]">{$(c.projection12Mois)}</p>
              <p className="text-[10px] text-slate-500">au rythme de {h(c.heuresParSemaine)}/sem.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-400">Par semaine</p>
              <p className="text-lg font-extrabold tabular-nums text-[#131B2E]">{$(c.semaines > 0 ? c.total / c.semaines : 0)}</p>
              <p className="text-[10px] text-slate-500">{c.semaines} semaine{c.semaines > 1 ? "s" : ""} travaillée{c.semaines > 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-2.5">
              <p className="text-[9px] font-bold uppercase text-sky-700">🚚 Ramassages</p>
              <p className="text-lg font-extrabold tabular-nums text-sky-900">{c.ramassages}</p>
              <p className="text-[10px] text-sky-800">{c.coutParRamassage != null ? `${$(c.coutParRamassage)} par ramassage` : "aucun bon ramassé encore"}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Salaire <span className="font-bold tabular-nums">{$(c.salaire)}</span>
            {" + "}charges <span className="font-bold tabular-nums">{$(c.charges)}</span>
            {c.chargesPct > 0 ? <span className="text-slate-400"> ({c.chargesPct} %)</span> : null}
            {" + "}camion <span className="font-bold tabular-nums">{$(c.camion)}</span>
            {" = "}<span className="font-extrabold tabular-nums text-[#131B2E]">{$(c.total)}</span>
          </p>
        </>
      )}
      {(sansCharges || sansTaux) && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] leading-snug text-amber-800">
          {sansTaux ? "⚠️ Aucun taux horaire sur sa fiche — le coût est sous-évalué. " : ""}
          {sansCharges ? (
            <>
              ⚠️ Les charges de l&apos;employeur sont à 0 % — le coût est sous-évalué.{" "}
              {onOuvrirParametres ? <button type="button" onClick={onOuvrirParametres} className="font-bold underline underline-offset-2">Régler dans Paramètres</button> : "Règle-les dans Paramètres → Paie & heures."}
            </>
          ) : null}
        </p>
      )}
      {detail && (
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Heures réellement pointées (chantier, transport, divers — journées bloquées exclues) × taux figé de chaque ligne (sinon le taux de sa fiche) = salaire.
          Charges = salaire × le pourcentage des Paramètres. Camion = heures des jours où il conduisait × coût horaire du camion (inspection du matin ; passager = 0).
          Projection = coût par semaine travaillée depuis sa première journée de l&apos;année × 52. Frais généraux : rien de ce coût n&apos;est chargé aux jobs.
        </p>
      )}
    </div>
  );
}
