"use client";

// app/admin/FenetreCorrectionZone.jsx
//
// 🔁 CORRIGER LA ZONE D'UN APPEL DE SERVICE APRÈS COUP (2026-10-05,
// demande du propriétaire : « je me suis trompé de zone de facturation »).
// La zone fixe le prix de base de l'appel sur la facture finale ; le vrai
// enjeu, c'est le DÉPÔT déjà demandé ou payé. La fenêtre montre l'effet
// AVANT d'enregistrer et EXIGE que le client soit avisé dès qu'un dépôt
// existe (courriel, ou appel noté). La trace suit la tâche jusqu'à la
// révision de la facture.
//   • dépôt demandé, pas payé → la demande est remplacée (VOID de
//     l'ancienne facture + nouvelle demande au bon montant) ;
//   • dépôt payé → il ne bouge pas ; la facture finale fait la
//     différence. Surplus possible → on demande au client : crédit au
//     dossier ou remboursement (choix du propriétaire : « on pose la
//     question à chaque fois »).

import { useState } from "react";
import { X } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { taxesDepot } from "@/lib/supabase/depots";
import { territoireDe, CLE_NOTE_ZONES } from "@/lib/supabase/prixDepots";
import { zonesEffectives } from "./partage";

export const libelleZone = (z) => (z === "hors_zone" ? "Hors zone" : z || "aucune zone");
const argent = (n) => `${(Number(n) || 0).toFixed(2)} $`;
const courrielValide = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

// « aucun » | « attente » | « paye » — un dépôt annulé (délai, QuickBooks)
// ne demande plus rien au client : on le traite comme aucun dépôt.
export function etatDepotZone(depot) {
  if (!depot) return "aucun";
  if (depot.payeLe || ["paye", "paye_manuellement"].includes(depot.statut)) return "paye";
  if (depot.statut === "en_attente_paiement") return "attente";
  return "aucun";
}

// Une ligne lisible pour la trace : « client avisé par courriel (…) ».
export function resumeAvisZone(c) {
  const avis = c?.avis || {};
  if (avis.mode === "courriel") {
    return `client avisé par courriel (${(avis.adresses || []).join(", ")})${c.remplace ? " avec la nouvelle demande de dépôt" : ""}`;
  }
  if (avis.mode === "telephone") return `client avisé par téléphone — « ${avis.note || ""} »`;
  return c?.depot ? "⚠️ avis au client non noté" : "aucun avis (pas de dépôt)";
}

export function FenetreCorrectionZone({ tache, depot, client, prixDepots, onFermer, onConfirmer }) {
  const configEnt = useEntreprise();
  const zoneActuelle = tache?.zoneAppel || "";
  const etat = etatDepotZone(depot);
  const montantDepot = Number(depot?.montantHT) || 0;
  const prixDe = (z) => (z && z !== "hors_zone" ? Number(prixDepots?.[z]) || 0 : null);
  const zonesOffertes = zonesEffectives(prixDepots).filter((z) => Number(prixDepots?.[z]) > 0);

  const [zone, setZone] = useState("");
  const [remplacer, setRemplacer] = useState(true);
  const [montantRemplacement, setMontantRemplacement] = useState("");
  const [choixSurplus, setChoixSurplus] = useState("");
  const courrielsFiche = (client?.courriels || [])
    .map((c) => (typeof c === "string" ? { email: c, defaut: false } : c))
    .filter((c) => c?.email);
  const [modeAvis, setModeAvis] = useState(courrielsFiche.length > 0 ? "courriel" : "");
  const [adresses, setAdresses] = useState(() => {
    const defauts = courrielsFiche.filter((c) => c.defaut).map((c) => c.email);
    return defauts.length > 0 ? defauts : courrielsFiche.slice(0, 1).map((c) => c.email);
  });
  const [autreAdresse, setAutreAdresse] = useState("");
  const [noteTel, setNoteTel] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const prixAncien = prixDe(zoneActuelle);
  const prixNouveau = prixDe(zone);
  const remplace = etat === "attente" && remplacer;
  const montantNouveauDepot = parseFloat(String(montantRemplacement).replace(",", ".")) || 0;
  // Dépôt payé et nouvelle zone moins chère : surplus POSSIBLE (le temps
  // supplémentaire peut encore combler l'écart — on le saura à la facture).
  const surplusPossible = etat === "paye" && prixNouveau != null && prixNouveau < montantDepot - 0.005;
  const adressesFinales = [...new Set([...adresses, ...(courrielValide(autreAdresse) ? [autreAdresse.trim()] : [])])];
  const avisObligatoire = etat !== "aucun";

  const raisons = [
    !zone ? "Choisis la nouvelle zone." : null,
    remplace && montantNouveauDepot <= 0 ? "Entre le montant de la nouvelle demande de dépôt." : null,
    surplusPossible && !choixSurplus ? "Indique ce que préfère le client pour un surplus éventuel." : null,
    avisObligatoire && !modeAvis ? "Un dépôt existe : dis comment le client est avisé (courriel ou téléphone)." : null,
    modeAvis === "courriel" && adressesFinales.length === 0 ? "Coche au moins une adresse courriel." : null,
    autreAdresse.trim() && !courrielValide(autreAdresse) ? "L'autre adresse courriel n'est pas valide." : null,
    modeAvis === "telephone" && noteTel.trim().length < 3 ? "Écris une courte note de l'appel (à qui, quand)." : null,
  ].filter(Boolean);

  const confirmer = async () => {
    if (raisons.length > 0 || enCours) return;
    setEnCours(true);
    setErreur("");
    const r = await onConfirmer?.({
      zone,
      prixAncien,
      prixNouveau,
      etatDepot: etat,
      remplacer: remplace,
      montantRemplacement: remplace ? montantNouveauDepot : null,
      choixSurplus: surplusPossible ? choixSurplus : null,
      avis: {
        mode: modeAvis || null,
        adresses: modeAvis === "courriel" ? adressesFinales : [],
        note: modeAvis === "telephone" ? noteTel.trim().slice(0, 300) : "",
      },
    });
    if (r?.erreur) {
      setErreur(r.erreur);
      setEnCours(false);
      return;
    }
    onFermer?.();
  };

  const decrites = zonesOffertes.filter((z) => territoireDe(prixDepots, z));
  const noteGenerale = territoireDe(prixDepots, CLE_NOTE_ZONES);

  return (
    <div
      className="fenetre-mobile fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !enCours) onFermer?.(); }}
    >
      <div className="panneau-mobile max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🔁 Corriger la zone de l&apos;appel</h3>
            <p className="text-[11px] text-slate-500">{tache?.titre || tache?.clientNom}</p>
          </div>
          <button onClick={() => !enCours && onFermer?.()} aria-label="Fermer" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* 1 · LA NOUVELLE ZONE — mêmes choix et même légende qu'à la création. */}
        <p className="mb-1 text-xs font-bold text-slate-700">
          Zone actuelle : <span className="font-extrabold">{libelleZone(zoneActuelle)}</span>
          {prixAncien != null ? ` — ${argent(prixAncien)} HT` : ""}
        </p>
        <select
          value={zone}
          onChange={(e) => {
            const v = e.target.value;
            setZone(v);
            // Le montant de la nouvelle demande SUIT la zone (saisie libre hors zone).
            setMontantRemplacement(v && v !== "hors_zone" ? String(Number(prixDepots?.[v]) || 0) : "");
            setChoixSurplus("");
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold"
        >
          <option value="">— Nouvelle zone —</option>
          {zonesOffertes.filter((z) => z !== zoneActuelle).map((z) => (
            <option key={z} value={z}>
              {z} — {argent(prixDepots[z])} HT ({taxesDepot(Number(prixDepots[z]), configEnt).total.toFixed(2)} $ taxes incl.)
            </option>
          ))}
          {zoneActuelle !== "hors_zone" && (
            <option value="hors_zone">Hors zone — tarif sur mesure, transport compté</option>
          )}
        </select>
        {(decrites.length > 0 || noteGenerale) && (
          <div className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
            <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Territoires des zones</p>
            <ul className="mt-0.5 space-y-0.5">
              {decrites.map((z) => (
                <li key={z} className={`text-[10px] leading-snug ${zone === z ? "font-bold text-slate-900" : "text-slate-600"}`}>
                  {zone === z ? "👉 " : ""}<span className="font-bold">{z}</span> : {territoireDe(prixDepots, z)}
                </li>
              ))}
            </ul>
            {noteGenerale && <p className="mt-1 text-[10px] italic leading-snug text-slate-500">ℹ️ {noteGenerale}</p>}
          </div>
        )}

        {/* 2 · CE QUI VA SE PASSER — selon l'état du dépôt. */}
        {zone && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-bold">
              {libelleZone(zoneActuelle)}{prixAncien != null ? ` (${argent(prixAncien)})` : ""} → {libelleZone(zone)}
              {prixNouveau != null ? ` (${argent(prixNouveau)})` : " (tarif selon le temps total)"}
            </p>
            {etat === "aucun" && (
              <p>Aucun dépôt — seule la facture finale change : elle prendra le prix de base de la nouvelle zone.</p>
            )}
            {etat === "attente" && (
              <>
                <p>
                  💰 Demande de dépôt{depot?.qboDocNumber ? ` nº ${depot.qboDocNumber}` : ""} de <strong>{argent(montantDepot)} HT</strong> — pas encore payée.
                </p>
                <label className="flex items-start gap-2 font-semibold">
                  <input type="checkbox" checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FF6A13]" />
                  <span>
                    Remplacer la demande : annuler l&apos;ancienne facture{depot?.qboDocNumber ? ` nº ${depot.qboDocNumber}` : ""} et envoyer une
                    nouvelle demande au bon montant (nouveau délai de paiement).
                  </span>
                </label>
                {remplacer ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Nouveau dépôt :</span>
                    <input
                      inputMode="decimal"
                      value={montantRemplacement}
                      onChange={(e) => setMontantRemplacement(e.target.value)}
                      placeholder="0.00"
                      className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-base tabular-nums sm:text-sm"
                    />
                    <span>$ HT{montantNouveauDepot > 0 ? ` (${taxesDepot(montantNouveauDepot, configEnt).total.toFixed(2)} $ taxes incl.)` : ""}</span>
                  </div>
                ) : (
                  <p className="text-amber-700">La demande reste à {argent(montantDepot)} ; la facture finale fera la différence.</p>
                )}
              </>
            )}
            {etat === "paye" && (
              <>
                <p>
                  💰 Dépôt de <strong>{argent(montantDepot)} HT</strong> déjà payé{depot?.payeLe ? ` le ${String(depot.payeLe).slice(0, 10)}` : ""} — il ne bouge pas.
                </p>
                {prixNouveau == null ? (
                  <p>Hors zone : la facture finale se fera au temps total (transport compris), moins ce dépôt.</p>
                ) : prixNouveau > montantDepot + 0.005 ? (
                  <p className="font-semibold">
                    {`Le client paiera la différence de ${argent(prixNouveau - montantDepot)} HT sur la facture finale.`}
                  </p>
                ) : surplusPossible ? (
                  <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="font-semibold text-amber-900">
                      {`Le dépôt dépasse de ${argent(montantDepot - prixNouveau)} HT le prix de la nouvelle zone. ` +
                        "Si le temps supplémentaire ne comble pas l'écart, le client aura payé trop. Que préfère-t-il ?"}
                    </p>
                    {[
                      ["credit", "💳 Un crédit à son dossier (prochaine job)"],
                      ["remboursement", "💸 Un remboursement"],
                      ["a_decider", "❓ Je lui demanderai au moment de facturer"],
                    ].map(([v, lib]) => (
                      <label key={v} className="flex items-center gap-2 font-semibold text-amber-900">
                        <input type="radio" name="choix-surplus" checked={choixSurplus === v} onChange={() => setChoixSurplus(v)} className="h-4 w-4 accent-[#FF6A13]" />
                        {lib}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p>Même montant que le dépôt : rien à ajuster sur la facture finale.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* 3 · L'AVIS AU CLIENT — obligatoire dès qu'un dépôt existe. */}
        {zone && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3 text-xs">
            <p className="font-bold text-slate-700">
              Aviser le client {avisObligatoire ? <span className="text-red-600">(obligatoire — un dépôt existe)</span> : <span className="font-normal text-slate-400">(facultatif — aucun dépôt)</span>}
            </p>
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input type="radio" name="mode-avis" checked={modeAvis === "courriel"} onChange={() => setModeAvis("courriel")} className="h-4 w-4 accent-[#FF6A13]" />
              ✉️ {remplace ? "Envoyer la nouvelle demande de dépôt (avec la mention de la correction)" : "Envoyer l'avis par courriel"}
            </label>
            {modeAvis === "courriel" && (
              <div className="ml-6 space-y-1">
                {courrielsFiche.map((c) => (
                  <label key={c.email} className="flex items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={adresses.includes(c.email)}
                      onChange={(e) => setAdresses((prev) => (e.target.checked ? [...prev, c.email] : prev.filter((x) => x !== c.email)))}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    {c.email}{c.label ? <span className="text-slate-400"> · {c.label}</span> : null}
                  </label>
                ))}
                <input
                  value={autreAdresse}
                  onChange={(e) => setAutreAdresse(e.target.value)}
                  placeholder="Autre adresse (facultatif)"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-base sm:text-xs"
                />
              </div>
            )}
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input type="radio" name="mode-avis" checked={modeAvis === "telephone"} onChange={() => setModeAvis("telephone")} className="h-4 w-4 accent-[#FF6A13]" />
              📞 Client avisé par téléphone
            </label>
            {modeAvis === "telephone" && (
              <input
                value={noteTel}
                onChange={(e) => setNoteTel(e.target.value)}
                maxLength={300}
                placeholder="Ex. : parlé à Martine le 5 oct., d'accord"
                className="ml-6 w-[calc(100%-1.5rem)] rounded-lg border border-slate-300 px-2 py-1.5 text-base sm:text-xs"
              />
            )}
            {remplace && modeAvis === "telephone" && (
              <p className="ml-6 text-[10px] text-slate-500">La nouvelle demande de dépôt sera créée sans courriel — donne le montant au client par téléphone.</p>
            )}
            {!avisObligatoire && (
              <label className="flex items-center gap-2 font-semibold text-slate-500">
                <input type="radio" name="mode-avis" checked={modeAvis === ""} onChange={() => setModeAvis("")} className="h-4 w-4 accent-[#FF6A13]" />
                Pas d&apos;avis
              </label>
            )}
            <p className="text-[10px] text-slate-400">
              La correction et l&apos;avis restent notés sur la tâche et au journal — la révision de la facture les affichera.
            </p>
          </div>
        )}

        {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">⚠️ {erreur}</p>}
        {raisons.length > 0 && zone && (
          <ul className="mt-3 space-y-0.5 text-[11px] font-semibold leading-snug text-slate-400">
            {raisons.map((r) => <li key={r}>• {r}</li>)}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => !enCours && onFermer?.()}
            className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-600"
          >
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={raisons.length > 0 || enCours}
            className="flex-1 rounded-xl bg-[#FF6A13] py-2.5 text-xs font-extrabold text-white disabled:opacity-40"
          >
            {enCours ? "Correction en cours…" : "Confirmer la correction"}
          </button>
        </div>
      </div>
    </div>
  );
}
