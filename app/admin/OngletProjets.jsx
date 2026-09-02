"use client";

// app/admin/OngletProjets.jsx
//
// PROJETS & RENTABILITÉ (hub, fiche de projet, BC de projet) —
// tranche T9b du découpage de page.jsx (2026-09-01). Extraction
// MÉCANIQUE : aucun comportement ne change, le code est déplacé tel
// quel — seuls des export/import s'ajoutent.

import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { AlertCircle, AlertTriangle, BarChart3, Car, CheckCircle2, Clock, Cloud, LayoutGrid, List, Lock, MapPin, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { envoyerCourriel, gabaritBcSimple } from "@/lib/courriels";
import { numeroBonCommande } from "@/lib/supabase/compteurs";
import { sauvegarderFournisseur } from "@/lib/supabase/fournisseurs";
import { poserCopieBc } from "@/lib/supabase/entreprise";
import { AutocompleteAdresse, Button, SelecteurItem, useCatalogue, calculerRentabiliteProjet, correspond, couleurSanteBudget, evaluerSanteProjet, libelleAdresse, nomAffichageClient, projetEnRetard, genererNumeroSecours, todayISO } from "./partage";
import { lireEstimateQbo } from "@/lib/quickbooksClient";

// Projets / chantiers au long cours — lient un client, des tâches de
// terrain (via `travaux[].projetId`), des bons de commande fournisseur
// et un budget, pour calculer la rentabilité réelle. En prod, ceci vit
// dans une table Supabase `projets` avec des clés étrangères vers
// `clients`, `travaux` et `bons_commande`.
export const STATUTS_PROJET = ["À planifier", "En cours", "Facturation d'acompte", "Terminé"];


export function calculerAvancementCalendrier(projet) {
  if (!projet.dateDebut || !projet.dateFin) return null;
  const debut = new Date(projet.dateDebut).getTime();
  const fin = new Date(projet.dateFin).getTime();
  if (!(fin > debut)) return null;
  const pct = ((Date.now() - debut) / (fin - debut)) * 100;
  return Math.max(0, Math.min(100, pct));
}


export const ONGLETS_PROJET = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "achats", label: "Bons de commande" },
  { id: "temps", label: "Feuille de temps" },
  // 📥 Onglet à part (2026-08-31, retour du propriétaire : « matériaux
  // déjà facturés n'a pas rapport dans Feuille de temps ») — regroupe
  // heures travaillées, matériaux achetés et montants facturés d'AVANT
  // Fluxya (ou sans bon de commande). Tout se cumule dans le projet.
  { id: "reprise", label: "Avant Fluxya" },
  { id: "facturation", label: "Facturation" },
];


export function OngletApercuProjet({ projet, r, sante, onChangerStatut, onSyncQuickBooks, syncQbEnCours, peutSyncQb }) {
  // Utilise la ventilation calculée par calculerRentabiliteProjet (même
  // logique par employé que r.coutMainOeuvre) — plus de recalcul au taux fixe.
  const coutMainOeuvreChantier = r.coutMainOeuvreChantier || 0;
  const coutTransport = r.coutTransport || 0;
  const donneesComparaison = useMemo(
    () => [
      { nom: "Budget", montant: Math.round(projet.budgetTotal) },
      { nom: "Coût réel", montant: Math.round(r.coutTotalReel) },
    ],
    [projet.budgetTotal, r.coutTotalReel]
  );
  const donneesRepartition = useMemo(
    () =>
      [
        { nom: "Main-d'œuvre", valeur: Math.round(coutMainOeuvreChantier) },
        { nom: "Matériaux", valeur: Math.round(r.coutMateriaux) },
        { nom: "Transport", valeur: Math.round(coutTransport) },
        // Bloc 5 — le camion est un coût comme les autres : 15 $/h pour
        // chaque heure d'un technicien qui en avait un ce jour-là.
        { nom: "Camion", valeur: Math.round(r.coutCamion || 0) },
      ].filter((d) => d.valeur > 0),
    [coutMainOeuvreChantier, r.coutMateriaux, coutTransport, r.coutCamion]
  );
  const COULEURS_REPARTITION = ["#131B2E", "#FF6A13", "#3B82F6", "#0EA5E9"];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        {/* Le statut (choisi par toi) et la SANTÉ (calculée) sont deux
            choses différentes. La pastille nue collée au menu laissait
            croire qu'elle suivait le statut — elle porte maintenant son
            nom (retour du propriétaire, 2026-08-28). */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projet.statut}
            onChange={(e) => onChangerStatut(projet.id, e.target.value)}
            title="Étape du projet — sert aux colonnes du tableau et aux filtres. « Terminé » retire le projet des listes de sélection et arrête les alertes de retard."
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700"
          >
            {STATUTS_PROJET.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span
            title="Calculée automatiquement : rouge si dépassement de budget, retard ou perte ; jaune si 75 % du budget est dépensé ou si l'échéance est dans moins de 7 jours."
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${sante.fond} ${sante.texte}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${sante.pastille}`} />
            {sante.niveau === "rouge" ? "Santé : à risque" : sante.niveau === "jaune" ? "Santé : à surveiller" : "Santé : bonne"}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={peutSyncQb ? onSyncQuickBooks : undefined}
          disabled={!peutSyncQb}
          loading={syncQbEnCours}
          title={peutSyncQb ? undefined : "Réservé aux administrateurs"}
          className="min-h-0 gap-1.5 px-2.5 py-1.5 text-xs"
        >
          {!syncQbEnCours && (peutSyncQb ? <RefreshCw size={12} /> : <Lock size={12} />)} Synchroniser QuickBooks
        </Button>
      </div>

      {/* BARRE DE PROGRESSION FINANCIÈRE */}
      <div className={`mb-4 rounded-xl p-3.5 ${sante.niveau === "rouge" ? "bg-red-50" : sante.niveau === "jaune" ? "bg-amber-50" : "bg-slate-50"}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-600">Budget dépensé</span>
          {r.depassementBudget && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
              <AlertCircle size={11} /> Dépassement de budget
            </span>
          )}
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`}
            style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
          <span className={`font-semibold ${couleurSanteBudget(r.pourcentageDepense).texte}`}>
            {r.coutTotalReel.toFixed(2)} $ dépensé ({r.pourcentageDepense.toFixed(0)}%)
          </span>
          <span>Budget : {projet.budgetTotal.toFixed(2)} $</span>
        </div>
      </div>

      {/* RENTABILITÉ */}
      <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
        <div className="flex justify-between text-slate-500"><span>Coût matériaux/achats (BC)</span><span className="tabular-nums">{r.coutMateriaux.toFixed(2)} $</span></div>
        <div className="flex justify-between text-slate-500"><span>Heures de travail sur chantier</span><span className="tabular-nums">{r.heuresChantier} h</span></div>
        <div className="flex justify-between text-slate-500"><span>Heures de transport imputées</span><span className="tabular-nums">{r.heuresTransport} h</span></div>
        {r.kilometrageTransport > 0 && (
          <div className="flex justify-between text-slate-500"><span>Kilométrage transport</span><span className="tabular-nums">{r.kilometrageTransport.toFixed(1)} km</span></div>
        )}
        <div className="flex justify-between font-semibold text-slate-600"><span>Total heures projet</span><span className="tabular-nums">{r.totalHeures} h</span></div>
        {/* Le coût d'une heure vient du taux FIGÉ à la saisie (sinon du
            taux de la fiche, sinon de la grille CCQ) — jamais d'un taux
            unique de projet : l'ancienne étiquette « X h × 45,00 $ »
            annonçait un calcul qui n'avait plus lieu. */}
        <div className="flex justify-between text-slate-500"><span>Coût main-d&apos;œuvre ({r.totalHeures} h, taux réels)</span><span className="tabular-nums">{r.coutMainOeuvre.toFixed(2)} $</span></div>
        {(r.coutCamion || 0) > 0 && (
          <div className="flex justify-between text-slate-500"><span>Coût camion (heures avec véhicule)</span><span className="tabular-nums">{r.coutCamion.toFixed(2)} $</span></div>
        )}
        {/* 📋 Heures ADMINISTRATIVES liées au projet (mesures, visites de
            soumission…) — affichées pour mémoire, JAMAIS dans le coût :
            elles restent aux frais généraux de l'entreprise. */}
        {(r.heuresAdminLiees || 0) > 0 && (
          <div className="flex justify-between text-slate-400">
            <span>📋 Heures administratives liées (visites, mesures) — non comptées au coût</span>
            <span className="tabular-nums">{r.heuresAdminLiees} h</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-700"><span>Coût total réel</span><span className="tabular-nums">{r.coutTotalReel.toFixed(2)} $</span></div>
        {/* 💰 PRÉVU vs RÉEL (2026-08-28) : le coûtant attendu vient du
            devis (ou de la tâche) à la création du projet. Sans lui, on
            ne montre rien — jamais un écart calculé sur du vide. */}
        {Number(projet.budgetPrevu?.totalCoutant) > 0 && (() => {
          const bp = projet.budgetPrevu;
          const prevu = Number(bp.totalCoutant);
          const ecart = r.coutTotalReel - prevu;
          // 🔎 LE DÉTAIL quand il a été saisi : savoir OÙ ça a dépassé
          // (les heures ? le matériel ?) est ce qui fait apprendre pour
          // la soumission suivante.
          const moPrevu = Number(bp.mainOeuvreChantier?.coutant) || 0;
          const matPrevu = Number(bp.materiaux?.coutant) || 0;
          const heuresPrevues = Number(bp.mainOeuvreChantier?.heures) || 0;
          const ligneEcart = (libelle, prevuLigne, reelLigne, complement) => {
            const d = reelLigne - prevuLigne;
            return (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span className="pl-2">↳ {libelle}{complement ? ` ${complement}` : ""}</span>
                <span className="tabular-nums">
                  {prevuLigne.toFixed(2)} $ → {reelLigne.toFixed(2)} $
                  <span className={`ml-1.5 font-bold ${d > 0 ? "text-red-600" : "text-emerald-600"}`}>{d > 0 ? "+" : ""}{d.toFixed(2)}</span>
                </span>
              </div>
            );
          };
          return (
            <>
              <div className="flex justify-between text-slate-500"><span>Coûtant prévu{bp.source ? ` (${bp.source})` : ""}</span><span className="tabular-nums">{prevu.toFixed(2)} $</span></div>
              {bp.detaille && moPrevu > 0 && ligneEcart(
                "Main-d'œuvre",
                moPrevu,
                r.coutMainOeuvre,
                heuresPrevues > 0 ? `(${heuresPrevues} h prévues → ${r.totalHeures} h)` : ""
              )}
              {bp.detaille && matPrevu > 0 && ligneEcart("Matériaux", matPrevu, r.coutMateriaux)}
              <div className={`flex justify-between font-semibold ${ecart > 0 ? "text-red-600" : "text-emerald-600"}`}>
                <span>{ecart > 0 ? "Dépassement du coûtant prévu" : "Sous le coûtant prévu"}</span>
                <span className="tabular-nums">{ecart > 0 ? "+" : ""}{ecart.toFixed(2)} $</span>
              </div>
            </>
          );
        })()}
        <div className="flex justify-between font-bold text-slate-800"><span>Budget initial</span><span className="tabular-nums">{projet.budgetTotal.toFixed(2)} $</span></div>
        <div className={`flex justify-between border-t border-slate-200 pt-1 text-sm font-extrabold ${r.profitReel < 0 ? "text-red-600" : "text-emerald-600"}`}>
          <span>Profit réel ({r.pourcentageMarge.toFixed(1)}%)</span><span className="tabular-nums">{r.profitReel.toFixed(2)} $</span>
        </div>
      </div>

      {/* RAPPORTS — GRAPHIQUES DE RENTABILITÉ */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <BarChart3 size={12} /> Rapports
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 p-2">
            <p className="mb-1 text-center text-[10px] font-semibold text-slate-500">Budget vs coût réel</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={donneesComparaison} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="nom" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v) => `${v} $`} />
                <Bar dataKey="montant" radius={[4, 4, 0, 0]}>
                  {donneesComparaison.map((entree, i) => (
                    <Cell key={i} fill={i === 1 && r.depassementBudget ? "#EF4444" : i === 1 ? "#10B981" : "#131B2E"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-slate-200 p-2">
            <p className="mb-1 text-center text-[10px] font-semibold text-slate-500">Répartition des dépenses</p>
            {donneesRepartition.length === 0 ? (
              <p className="flex h-[140px] items-center justify-center text-center text-[10px] text-slate-400">Aucune dépense enregistrée pour l'instant.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={donneesRepartition} dataKey="valeur" nameKey="nom" innerRadius={30} outerRadius={50} paddingAngle={2}>
                    {donneesRepartition.map((entree, i) => (
                      <Cell key={i} fill={COULEURS_REPARTITION[i % COULEURS_REPARTITION.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} $`} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



// ============================================================
// 📥 REPRISE DE CHANTIER (2026-08-28)
// ------------------------------------------------------------
// Demande du propriétaire : « j'ajoute Fluxya à mon infrastructure —
// est-ce qu'on pourrait ajouter des factures déjà produites ou des
// heures dans le projet pour comptabiliser ? »
//
// Un chantier commencé AVANT Fluxya affichait une rentabilité fausse :
// tout le travail et tout l'argent du début manquaient. Ce bloc les
// rentre à la main, une fois, et les garde IDENTIFIABLES (jamais mêlés
// aux heures pointées ni aux factures QuickBooks) :
//   • heures déjà travaillées → entrent dans le coût main-d'œuvre,
//     SANS créer de fausse tâche dans l'agenda ni toucher aux paies ;
//   • montants déjà facturés → entrent dans le facturé du projet.
// Les deux vivent dans projets_app.reprise (snippet 101).
// ============================================================
function BlocRepriseChantier({ projet, r, onMajReprise, ajouterJournal }) {
  const reprise = projet.reprise || {};
  const heures = reprise.heures || [];
  const factures = reprise.factures || [];
  // 🧱 Matériaux déjà achetés (2026-08-31, demande du propriétaire :
  // « il manque matériaux avant Fluxya ou sans bon de commande »).
  const materiaux = reprise.materiaux || [];
  const [formHeures, setFormHeures] = useState(null); // { qui, heures, taux, date, note }
  const [formFacture, setFormFacture] = useState(null); // { montant, date, note }
  const [formMateriau, setFormMateriau] = useState(null); // { fournisseur, montant, date, note }

  const enregistrer = (suivant, texteJournal) => {
    onMajReprise?.(suivant);
    ajouterJournal?.(texteJournal);
  };

  const ajouterHeures = () => {
    const f = formHeures;
    if (!f || !(Number(f.heures) > 0)) return;
    const entree = {
      id: "rh-" + Date.now(),
      qui: (f.qui || "").trim() || "Équipe",
      heures: Number(f.heures) || 0,
      taux: Number(f.taux) || 0,
      date: f.date || todayISO(),
      note: (f.note || "").trim(),
    };
    enregistrer(
      { ...reprise, heures: [...heures, entree] },
      `📥 Reprise — ${entree.heures} h de ${entree.qui} ajoutées au projet « ${projet.nom} » (${(entree.heures * entree.taux).toFixed(2)} $ de coût)${entree.note ? ` : ${entree.note}` : ""}`
    );
    setFormHeures(null);
  };

  const ajouterFacture = () => {
    const f = formFacture;
    if (!f || !(Number(f.montant) > 0)) return;
    const entree = {
      id: "rf-" + Date.now(),
      montant: Number(f.montant) || 0,
      date: f.date || todayISO(),
      note: (f.note || "").trim(),
    };
    enregistrer(
      { ...reprise, factures: [...factures, entree] },
      `📥 Reprise — ${entree.montant.toFixed(2)} $ déjà facturés ajoutés au projet « ${projet.nom} »${entree.note ? ` : ${entree.note}` : ""}`
    );
    setFormFacture(null);
  };

  const ajouterMateriau = () => {
    const f = formMateriau;
    if (!f || !(Number(f.montant) > 0)) return;
    const entree = {
      id: "rm-" + Date.now(),
      fournisseur: (f.fournisseur || "").trim(),
      montant: Number(f.montant) || 0,
      date: f.date || todayISO(),
      note: (f.note || "").trim(),
    };
    enregistrer(
      { ...reprise, materiaux: [...materiaux, entree] },
      `📥 Reprise — ${entree.montant.toFixed(2)} $ de matériaux${entree.fournisseur ? ` (${entree.fournisseur})` : ""} ajoutés au coût du projet « ${projet.nom} »${entree.note ? ` : ${entree.note}` : ""}`
    );
    setFormMateriau(null);
  };
  const retirerMateriau = (id) => {
    const cible = materiaux.find((m) => m.id === id);
    enregistrer(
      { ...reprise, materiaux: materiaux.filter((m) => m.id !== id) },
      `📥 Reprise — matériaux retirés du projet « ${projet.nom} »${cible ? ` (${cible.montant.toFixed(2)} $${cible.fournisseur ? `, ${cible.fournisseur}` : ""})` : ""}`
    );
  };

  const retirerHeures = (id) => {
    const cible = heures.find((h) => h.id === id);
    enregistrer(
      { ...reprise, heures: heures.filter((h) => h.id !== id) },
      `📥 Reprise — ligne d'heures retirée du projet « ${projet.nom} »${cible ? ` (${cible.heures} h, ${cible.qui})` : ""}`
    );
  };
  const retirerFacture = (id) => {
    const cible = factures.find((x) => x.id === id);
    enregistrer(
      { ...reprise, factures: factures.filter((x) => x.id !== id) },
      `📥 Reprise — montant déjà facturé retiré du projet « ${projet.nom} »${cible ? ` (${cible.montant.toFixed(2)} $)` : ""}`
    );
  };

  const rien = heures.length === 0 && factures.length === 0 && materiaux.length === 0;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        📥 Reprise de chantier <span className="normal-case text-slate-400">— ce qui a été fait AVANT Fluxya</span>
      </p>
      {rien && !formHeures && !formFacture && !formMateriau && (
        <p className="mb-2 text-[11px] leading-snug text-slate-400">
          Chantier commencé avant Fluxya ? Entre ici les heures déjà travaillées, les matériaux déjà achetés
          et les montants déjà facturés : la rentabilité du projet devient complète. Rien n&apos;est envoyé au
          client ni aux paies.
        </p>
      )}

      {/* ⏱️ HEURES DÉJÀ TRAVAILLÉES */}
      {heures.length > 0 && (
        <div className="mb-1.5 space-y-1">
          {heures.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
              <span className="min-w-0">
                ⏱️ <span className="font-bold">{h.heures} h</span> · {h.qui}
                <span className="text-slate-400"> · {h.date}{h.note ? ` · ${h.note}` : ""}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-bold tabular-nums text-slate-700">{(h.heures * h.taux).toFixed(2)} $</span>
                <button onClick={() => retirerHeures(h.id)} title="Retirer" className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
      {formHeures ? (
        <div className="mb-1.5 rounded-lg border border-slate-200 p-2">
          <div className="grid gap-1.5 sm:grid-cols-2">
            <input value={formHeures.qui} onChange={(e) => setFormHeures({ ...formHeures, qui: e.target.value })}
              placeholder="Qui ? (ex. : Équipe, Dominic)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="date" value={formHeures.date} onChange={(e) => setFormHeures({ ...formHeures, date: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400">Heures</span>
            <InputNombreDecimal valeur={formHeures.heures} onChange={(v) => setFormHeures({ ...formHeures, heures: v })}
              className="w-[74px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <span className="text-[10px] text-slate-400">×</span>
            <span className="text-[10px] font-bold text-slate-400">Taux coûtant</span>
            <InputNombreDecimal valeur={formHeures.taux} onChange={(v) => setFormHeures({ ...formHeures, taux: v })}
              className="w-[86px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <span className="text-[10px] font-bold text-slate-400">$</span>
            <span className="ml-auto text-xs font-bold tabular-nums text-slate-700">
              {((Number(formHeures.heures) || 0) * (Number(formHeures.taux) || 0)).toFixed(2)} $
            </span>
          </div>
          <input value={formHeures.note} onChange={(e) => setFormHeures({ ...formHeures, note: e.target.value })}
            placeholder="Note (ex. : semaines du 3 au 21 juin, avant Fluxya)"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="mt-1.5 flex gap-1.5">
            <Button onClick={ajouterHeures} disabled={!(Number(formHeures.heures) > 0)} className="min-h-0 px-3 py-1 text-[11px]">Ajouter</Button>
            <Button variant="outline" onClick={() => setFormHeures(null)} className="min-h-0 px-3 py-1 text-[11px]">Annuler</Button>
          </div>
        </div>
      ) : null}

      {/* 🧱 MATÉRIAUX DÉJÀ ACHETÉS (avant Fluxya, ou sans BC) */}
      {materiaux.length > 0 && (
        <div className="mb-1.5 space-y-1">
          {materiaux.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px]">
              <span className="min-w-0">
                🧱 <span className="font-bold">{m.montant.toFixed(2)} $</span> de matériaux{m.fournisseur ? ` · ${m.fournisseur}` : ""}
                <span className="text-slate-400"> · {m.date}{m.note ? ` · ${m.note}` : ""}</span>
              </span>
              <button onClick={() => retirerMateriau(m.id)} title="Retirer" className="shrink-0 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {formMateriau ? (
        <div className="mb-1.5 rounded-lg border border-slate-200 p-2">
          <div className="grid gap-1.5 sm:grid-cols-2">
            <input value={formMateriau.fournisseur} onChange={(e) => setFormMateriau({ ...formMateriau, fournisseur: e.target.value })}
              placeholder="Fournisseur (ex. : Descair)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="date" value={formMateriau.date} onChange={(e) => setFormMateriau({ ...formMateriau, date: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400">Montant (HT)</span>
            <InputNombreDecimal valeur={formMateriau.montant} onChange={(v) => setFormMateriau({ ...formMateriau, montant: v })}
              className="w-[100px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <span className="text-[10px] font-bold text-slate-400">$</span>
          </div>
          <input value={formMateriau.note} onChange={(e) => setFormMateriau({ ...formMateriau, note: e.target.value })}
            placeholder="Note (ex. : acheté avant Fluxya, ou payé sans bon de commande)"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="mt-1.5 flex gap-1.5">
            <Button onClick={ajouterMateriau} disabled={!(Number(formMateriau.montant) > 0)} className="min-h-0 px-3 py-1 text-[11px]">Ajouter</Button>
            <Button variant="outline" onClick={() => setFormMateriau(null)} className="min-h-0 px-3 py-1 text-[11px]">Annuler</Button>
          </div>
        </div>
      ) : null}

      {/* 🧾 MONTANTS DÉJÀ FACTURÉS */}
      {factures.length > 0 && (
        <div className="mb-1.5 space-y-1">
          {factures.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px]">
              <span className="min-w-0">
                🧾 <span className="font-bold">{f.montant.toFixed(2)} $</span> déjà facturés
                <span className="text-slate-400"> · {f.date}{f.note ? ` · ${f.note}` : ""}</span>
              </span>
              <button onClick={() => retirerFacture(f.id)} title="Retirer" className="shrink-0 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {formFacture ? (
        <div className="mb-1.5 rounded-lg border border-slate-200 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400">Montant facturé (HT)</span>
            <InputNombreDecimal valeur={formFacture.montant} onChange={(v) => setFormFacture({ ...formFacture, montant: v })}
              className="w-[100px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <span className="text-[10px] font-bold text-slate-400">$</span>
            <input type="date" value={formFacture.date} onChange={(e) => setFormFacture({ ...formFacture, date: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <input value={formFacture.note} onChange={(e) => setFormFacture({ ...formFacture, note: e.target.value })}
            placeholder="Note (ex. : facture 1042 faite dans QuickBooks avant Fluxya)"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="mt-1.5 flex gap-1.5">
            <Button onClick={ajouterFacture} disabled={!(Number(formFacture.montant) > 0)} className="min-h-0 px-3 py-1 text-[11px]">Ajouter</Button>
            <Button variant="outline" onClick={() => setFormFacture(null)} className="min-h-0 px-3 py-1 text-[11px]">Annuler</Button>
          </div>
        </div>
      ) : null}

      {(r?.heuresReprise > 0 || r?.factureReprise > 0 || r?.coutMateriauxReprise > 0) && (
        <p className="mb-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
          Compté dans ce projet :{" "}
          {[
            r.heuresReprise > 0 ? `${r.heuresReprise} h reprises (${r.coutReprise.toFixed(2)} $ de coût)` : null,
            r.coutMateriauxReprise > 0 ? `${r.coutMateriauxReprise.toFixed(2)} $ de matériaux repris` : null,
            r.factureReprise > 0 ? `${r.factureReprise.toFixed(2)} $ déjà facturés` : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {!formHeures && (
          <Button variant="outline" onClick={() => setFormHeures({ qui: "", heures: "", taux: "", date: todayISO(), note: "" })} className="min-h-0 gap-1 px-2.5 py-1 text-[11px]">
            <Plus size={11} /> Heures déjà travaillées
          </Button>
        )}
        {!formMateriau && (
          <Button variant="outline" onClick={() => setFormMateriau({ fournisseur: "", montant: "", date: todayISO(), note: "" })} className="min-h-0 gap-1 px-2.5 py-1 text-[11px]">
            <Plus size={11} /> Matériaux déjà achetés
          </Button>
        )}
        {!formFacture && (
          <Button variant="outline" onClick={() => setFormFacture({ montant: "", date: todayISO(), note: "" })} className="min-h-0 gap-1 px-2.5 py-1 text-[11px]">
            <Plus size={11} /> Montant déjà facturé
          </Button>
        )}
      </div>
    </div>
  );
}


export function OngletBonsCommandeProjet({ projet, onAjouterBC, onMajMateriel, r, transactionsQb, fournisseurs, setFournisseurs, ajouterJournal, clients }) {
  // Papier en-tête de l'entreprise pour le courriel du BC.
  const configBc = useEntreprise();
  // 🧱 MATÉRIEL DU STOCK — pris sur la tablette du bureau, attribué à ce
  // projet (décision du propriétaire : bureau seulement, catalogue OU
  // coût manuel au choix — la liste de produits est grande).
  const catalogueStock = useCatalogue();
  const [stockForm, setStockForm] = useState(null); // {description, quantite, coutUnitaire, tacheTitre}
  const ajouterStock = () => {
    const f = stockForm;
    if (!f || !(f.description || "").trim() || !(Number(f.coutUnitaire) >= 0) || !(Number(f.quantite) > 0)) return;
    const quantite = Number(f.quantite) || 1;
    const coutUnitaire = Number(f.coutUnitaire) || 0;
    const entree = {
      id: "mat-" + Date.now(),
      description: f.description.trim(),
      quantite,
      coutUnitaire,
      coutTotal: Math.round(quantite * coutUnitaire * 100) / 100,
      tacheTitre: (f.tacheTitre || "").trim() || null,
      date: todayISO(),
    };
    onMajMateriel?.([...(projet.materielStock || []), entree]);
    ajouterJournal("🧱 Matériel du stock ajouté au projet « " + projet.nom + " » : " + entree.description + " ×" + quantite + " = " + entree.coutTotal.toFixed(2) + " $");
    setStockForm(null);
  };
  const tachesDuProjet = [...new Set((r?.travauxDuProjet || []).map((t) => t.titre).filter(Boolean))];
  // Dépenses QuickBooks de ce projet, indexées par numéro de BC — sert à
  // montrer quels BC ont déjà leur facture fournisseur réelle (le montant
  // de QuickBooks fait alors foi, jamais additionné au montant saisi).
  const depensesParBc = new Map(
    (transactionsQb || [])
      .filter((t) => t.projectId === projet.id && t.type === "EXPENSE" && (t.poNumber || t.cible?.bc))
      .map((t) => [String(t.cible?.bc || t.poNumber).trim().toUpperCase(), t])
  );
  const [bcFournisseurId, setBcFournisseurId] = useState("");
  const [bcMontant, setBcMontant] = useState("");
  const [bcNumero, setBcNumero] = useState("");
  const [bcDescription, setBcDescription] = useState("");
  const [bcLivraison, setBcLivraison] = useState(""); // 📦 date souhaitée
  const [modalFournisseur, setModalFournisseur] = useState(false);
  // Envoi du BC au fournisseur : choix des adresses avant création.
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const [courrielsChoisis, setCourrielsChoisis] = useState([]);
  // 📧 Copie (CC) optionnelle du BC (2026-09-03, demande du
  // propriétaire) : une adresse de plus reçoit le courriel — et peut
  // devenir PERMANENTE (ex. commande@...) via la case « retenir ».
  const [bcCopieA, setBcCopieA] = useState("");
  const [bcRetenirCopie, setBcRetenirCopie] = useState(false);
  const copieValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bcCopieA.trim());

  const fournisseurChoisi = (fournisseurs || []).find((f) => f.id === bcFournisseurId) || null;
  const adresseLivraison =
    projet.adresseLivraison ||
    (clients || []).find((c) => c.id === projet.clientId)?.adresses?.[0]?.ligne1 ||
    null;

  const choisirFournisseur = (id) => {
    setBcFournisseurId(id);
    const f = (fournisseurs || []).find((x) => x.id === id);
    setCourrielsChoisis((f?.courriels || []).filter((c) => c.defaut).map((c) => c.email));
  };

  // Étape 1 : si le fournisseur a des courriels, proposer l'envoi.
  const demarrerAjoutBC = () => {
    if (!fournisseurChoisi) return;
    if ((fournisseurChoisi.courriels || []).length > 0) {
      // L'adresse permanente de l'entreprise préremplit la copie.
      setBcCopieA(configBc.courrielCopieBc || "");
      setBcRetenirCopie(false);
      setEnvoiOuvert(true);
      return;
    }
    creerBC([]);
  };

  // Étape 2 : création du BC + VRAI envoi du bon au fournisseur.
  // ⚠️ RÉPARÉ le 2026-08-30 : depuis les débuts, l'« envoi » était
  // simulé — le statut et le journal disaient « 📧 envoyé » sans
  // qu'aucun courriel ne parte. Le vrai service d'envoi est branché,
  // et le statut ne dit plus que la vérité.
  const creerBC = async (destinataires) => {
    setEnvoiOuvert(false);
    // Numéro saisi à la main, sinon prochain numéro SÉQUENTIEL de la base.
    let numero = bcNumero.trim();
    if (!numero) {
      try {
        numero = await numeroBonCommande();
      } catch {
        numero = genererNumeroSecours("BC");
        ajouterJournal?.("⚠️ Numéro de BC séquentiel indisponible — numéro de secours attribué, à corriger manuellement.");
      }
    }
    // 📦 La livraison souhaitée voyage DANS la description — elle suit
    // le bon partout (fiche du projet, courriel, journal).
    const livraisonBc = bcLivraison
      ? `\n📦 Livraison souhaitée : ${new Date(`${bcLivraison}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
      : "";
    const descriptionBc = `${bcDescription.trim()}${livraisonBc}`;
    let envoiReussi = false;
    // 📧 Copie choisie à l'envoi (facultative). « Retenir » l'enregistre
    // comme adresse PERMANENTE de l'entreprise (ex. commande@...) — les
    // prochains BC la prérempliront tout seuls. Retenir avec le champ
    // VIDE efface l'adresse permanente.
    const copieCourante = bcCopieA.trim();
    if (bcRetenirCopie && copieCourante !== (configBc.courrielCopieBc || "")) {
      try {
        await poserCopieBc(configBc.id, copieCourante);
        ajouterJournal?.(
          copieCourante
            ? `📧 Adresse de copie permanente des bons de commande enregistrée : ${copieCourante}.`
            : "📧 Adresse de copie permanente des bons de commande effacée."
        );
      } catch {
        ajouterJournal?.("⚠️ Adresse de copie NON retenue (connexion ?) — la copie part quand même sur CE bon.");
      }
    }
    if (destinataires.length > 0) {
      const r = await envoyerCourriel({
        a: destinataires,
        sujet: `Bon de commande ${numero} — ${configBc.nomLegal}`,
        html: gabaritBcSimple({ config: configBc, numeroBc: numero, description: descriptionBc, adresseLivraison }),
        // La réponse du fournisseur (« pas en stock avant le 12 »)
        // revient à celui qui a commandé.
        copieExpediteur: true,
        copieA: copieCourante ? [copieCourante] : [],
      });
      envoiReussi = !!r.envoye;
      if (!envoiReussi) {
        ajouterJournal?.(
          r.simule
            ? "⚠️ Service d'envoi pas encore configuré (clé Resend absente) — le BC est créé mais AUCUN courriel n'est parti."
            : `⚠️ Envoi du BC ${numero} refusé (${r.erreur || "réessaie"}) — le BC est créé, envoie-le à la main.`
        );
      }
    }
    onAjouterBC(projet.id, {
      id: `bc-${Date.now()}`,
      numeroBC: numero,
      fournisseur: fournisseurChoisi?.nom || "",
      fournisseurId: fournisseurChoisi?.id || null,
      description: descriptionBc,
      // Le MONTANT est optionnel : un BC créé sans montant (0 $) se
      // remplira tout seul quand la facture fournisseur portant le même
      // numéro arrivera de QuickBooks (voir calculerRentabiliteProjet).
      montantHT: parseFloat(bcMontant) || 0,
      statut: envoiReussi ? "Envoyé au fournisseur" : "En attente",
      courrielsEnvoi: envoiReussi ? destinataires : [],
      date: todayISO(),
    });
    ajouterJournal?.(
      envoiReussi
        ? `📧 Bon de commande ${numero} envoyé à ${fournisseurChoisi?.nom} (${destinataires.join(", ")}) — ${descriptionBc || "sans description"}${adresseLivraison ? ` · livraison : ${adresseLivraison}` : ""}`
        : `📋 Bon de commande ${numero} créé pour ${fournisseurChoisi?.nom || "fournisseur"} — aucun courriel envoyé`
    );
    setBcFournisseurId("");
    setBcMontant("");
    setBcNumero("");
    setBcDescription("");
    setBcLivraison("");
    setCourrielsChoisis([]);
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Bons de commande</p>
      <div className="space-y-1.5">
        {(projet.bonsCommande || []).map((bc) => {
          const depenseQb = depensesParBc.get(String(bc.numeroBC || "").trim().toUpperCase());
          const montantAffiche = depenseQb ? Number(depenseQb.amountHT) || 0 : Number(bc.montantHT) || 0;
          return (
            <div key={bc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{bc.numeroBC} — {bc.fournisseur}</p>
                {bc.description && <p className="mt-0.5 whitespace-pre-line text-[11px] text-slate-600">{bc.description}</p>}
                <p className="text-[10px] text-slate-400">{bc.date} · {bc.statut}</p>
                {bc.courrielsEnvoi?.length > 0 && (
                  <p className="mt-0.5 text-[10px] font-semibold text-blue-600">📧 Envoyé à {bc.courrielsEnvoi.join(", ")}</p>
                )}
                {depenseQb ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-bold text-emerald-600">
                      ✓ Montant réel de QuickBooks ({depenseQb.status === "PAID" ? "payée" : "à payer"})
                    </p>
                    {Number(bc.montantHT) > 0 && Math.abs(Number(bc.montantHT) - montantAffiche) > 1 && (
                      <p className="mt-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        ⚠️ Écart de prix — BC : {Number(bc.montantHT).toFixed(2)} $ · QuickBooks : {montantAffiche.toFixed(2)} $ ({montantAffiche > Number(bc.montantHT) ? "+" : ""}{(montantAffiche - Number(bc.montantHT)).toFixed(2)} $) — le prix est-il bon ?
                      </p>
                    )}
                  </>
                ) : Number(bc.montantHT) === 0 ? (
                  <p className="mt-0.5 text-[10px] font-bold text-amber-600">⏳ En attente de la facture QuickBooks (BC {bc.numeroBC})</p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-slate-400">Estimation saisie — sera remplacée par le montant de QuickBooks</p>
                )}
              </div>
              <span className={`shrink-0 font-bold tabular-nums ${depenseQb ? "text-emerald-700" : montantAffiche === 0 ? "text-amber-600" : "text-slate-700"}`}>
                {montantAffiche.toFixed(2)} $
              </span>
            </div>
          );
        })}
        {(projet.bonsCommande || []).length === 0 && <p className="text-xs text-slate-400">Aucun bon de commande pour l'instant.</p>}
      </div>
      {/* 🧱 MATÉRIEL DU STOCK — déjà payé, sur la tablette : un coût du
          projet sans bon de commande. Catalogue (coûtant auto) OU saisie
          manuelle, tâche précise facultative. */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">🧱 Matériel du stock (sans commande)</p>
        {(projet.materielStock || []).map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 text-xs last:border-0">
            <span className="min-w-0 truncate text-slate-700">
              {m.description} <span className="text-slate-400">×{m.quantite}</span>
              {m.tacheTitre && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{m.tacheTitre}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-bold tabular-nums text-slate-700">{(Number(m.coutTotal) || 0).toFixed(2)} $</span>
              <button
                onClick={() => onMajMateriel?.((projet.materielStock || []).filter((x) => x.id !== m.id))}
                className="text-slate-300 hover:text-red-500"
                aria-label="Retirer"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        ))}
        {(projet.materielStock || []).length === 0 && !stockForm && (
          <p className="text-xs text-slate-400">Rien pour l'instant — « 4 paquets de tuyaux pris au bureau », c'est ici.</p>
        )}
        {stockForm ? (
          <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2">
            <SelecteurItem
              catalogue={catalogueStock}
              libelle="🔎 Choisir du catalogue (coûtant automatique)"
              onChoisir={(item) =>
                setStockForm((f) => ({
                  ...f,
                  description: item.nom,
                  coutUnitaire: item.prix_coutant != null ? item.prix_coutant : f.coutUnitaire,
                }))
              }
            />
            <input
              value={stockForm.description}
              onChange={(e) => setStockForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="ou description libre — ex : paquet de tuyaux 6po"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                Qté
                <input type="number" min={1} value={stockForm.quantite}
                  onChange={(e) => setStockForm((f) => ({ ...f, quantite: e.target.value }))}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                Coût unitaire
                <InputNombreDecimal valeur={Number(stockForm.coutUnitaire) || 0}
                  onChange={(v) => setStockForm((f) => ({ ...f, coutUnitaire: v }))}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                $
              </span>
              <span className="text-[11px] font-bold tabular-nums text-slate-600">
                = {((Number(stockForm.quantite) || 0) * (Number(stockForm.coutUnitaire) || 0)).toFixed(2)} $
              </span>
            </div>
            {tachesDuProjet.length > 0 && (
              <select
                value={stockForm.tacheTitre || ""}
                onChange={(e) => setStockForm((f) => ({ ...f, tacheTitre: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="">Projet en général (aucune tâche précise)</option>
                {tachesDuProjet.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <div className="flex gap-1.5">
              <Button onClick={ajouterStock}
                disabled={!(stockForm.description || "").trim() || !(Number(stockForm.quantite) > 0)}
                className="min-h-0 flex-1 py-1.5 text-xs">
                Ajouter au projet
              </Button>
              <Button variant="outline" onClick={() => setStockForm(null)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setStockForm({ description: "", quantite: 1, coutUnitaire: 0, tacheTitre: "" })}
            className="mt-2 min-h-0 w-full py-1.5 text-xs">
            ➕ Matériel utilisé (du stock)
          </Button>
        )}
      </div>

      {/* NOUVEAU BON DE COMMANDE — le fournisseur vient du répertoire, la
          description part dans le courriel, et le BC peut être envoyé
          directement au fournisseur à sa création. */}
      <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nouveau bon de commande</p>
        <select
          value={bcFournisseurId}
          onChange={(e) => {
            if (e.target.value === "__nouveau__") {
              setModalFournisseur(true);
              return;
            }
            choisirFournisseur(e.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold"
        >
          <option value="">— Choisir un fournisseur —</option>
          <option value="__nouveau__">➕ Nouveau fournisseur…</option>
          {(fournisseurs || []).map((f) => (
            <option key={f.id} value={f.id}>{f.nom}</option>
          ))}
        </select>
        <textarea
          value={bcDescription}
          onChange={(e) => setBcDescription(e.target.value)}
          rows={2}
          placeholder="Ce qui est commandé (ex : 12 × membrane élastomère, livraison au chantier)"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <input value={bcNumero} onChange={(e) => setBcNumero(e.target.value)} placeholder="N° BC (auto si vide)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <input
            type="number" min={0} step="0.01" value={bcMontant} onChange={(e) => setBcMontant(e.target.value)}
            placeholder="Montant avant taxes $ (optionnel)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        {/* 📦 Livraison souhaitée — notée sur le bon et écrite dans le
            courriel au fournisseur (2026-09-03). */}
        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
          Livraison souhaitée
          <input
            type="date"
            value={bcLivraison}
            onChange={(e) => setBcLivraison(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </label>
        <Button variant="outline" onClick={demarrerAjoutBC} disabled={!fournisseurChoisi} className="w-full min-h-0 py-1.5 text-xs">
          <Plus size={12} /> {fournisseurChoisi && (fournisseurChoisi.courriels || []).length > 0 ? "Créer et envoyer le BC" : "Ajouter le BC"}
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
        Montant <span className="font-bold">avant taxes</span> (les taxes payées aux fournisseurs sont récupérables, donc jamais comptées comme coût).
        Tu peux le laisser vide : il se remplira automatiquement quand la facture fournisseur portant ce numéro de BC arrivera de QuickBooks.
      </p>

      {modalFournisseur && (
        <ModalNouveauFournisseur
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
          onFermer={() => setModalFournisseur(false)}
          onSelection={choisirFournisseur}
        />
      )}

      {/* ENVOI DU BON DE COMMANDE AU FOURNISSEUR — choix multiple des
          adresses + aperçu de ce qui part. */}
      {envoiOuvert && fournisseurChoisi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setEnvoiOuvert(false))(); }}>
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-slate-900">📧 Envoyer le bon de commande</h3>
            <p className="mt-0.5 text-xs text-slate-500">À {fournisseurChoisi.nom} — coche une ou plusieurs adresses.</p>
            <div className="mt-3 space-y-1.5">
              {(fournisseurChoisi.courriels || []).map((c) => (
                <label
                  key={c.email}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 ${
                    courrielsChoisis.includes(c.email) ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={courrielsChoisis.includes(c.email)}
                    onChange={() =>
                      setCourrielsChoisis((prev) => (prev.includes(c.email) ? prev.filter((x) => x !== c.email) : [...prev, c.email]))
                    }
                    className="h-4 w-4 shrink-0 accent-[#FF6A13]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-800">{c.email}</span>
                    <span className="block text-[11px] text-slate-500">{c.label}{c.defaut ? " · défaut" : ""}</span>
                  </span>
                </label>
              ))}
            </div>
            {/* Aperçu de ce qui sera envoyé */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              <p className="font-bold text-slate-800">Bon de commande {bcNumero.trim() || "(numéro automatique)"}</p>
              <p className="mt-1 whitespace-pre-wrap">{bcDescription.trim() || "— aucune description saisie —"}</p>
              {bcLivraison && (
                <p className="mt-1">📦 Livraison souhaitée : {new Date(`${bcLivraison}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              )}
              {adresseLivraison && <p className="mt-1">📍 Livraison : {adresseLivraison}</p>}
              <p className="mt-1 text-slate-400">Projet : {projet.nom}</p>
            </div>
            {/* 📧 COPIE (CC) FACULTATIVE — en plus de la copie automatique
                à celui qui commande. « Retenir » = adresse permanente de
                l'entreprise (chaque compagnie a LA SIENNE). */}
            <div className="mt-3 rounded-xl border border-slate-200 p-3">
              <label className="mb-1 block text-[11px] font-bold text-slate-500">Copie (CC) — optionnel</label>
              <input
                value={bcCopieA}
                onChange={(e) => setBcCopieA(e.target.value)}
                placeholder="ex. commande@tonentreprise.com"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              />
              {bcCopieA.trim() && !copieValide && (
                <p className="mt-1 text-[10px] text-red-500">Adresse invalide — la copie ne partira pas.</p>
              )}
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={bcRetenirCopie}
                  onChange={(e) => setBcRetenirCopie(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[#FF6A13]"
                />
                Retenir cette adresse pour tous les prochains bons de commande
              </label>
              <p className="mt-1 text-[10px] text-slate-400">
                Celui qui envoie reçoit déjà une copie automatiquement — ceci en ajoute une de plus.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <Button onClick={() => creerBC(courrielsChoisis)} disabled={courrielsChoisis.length === 0 || (!!bcCopieA.trim() && !copieValide)} className="w-full">
                Envoyer le BC{courrielsChoisis.length > 1 ? ` (${courrielsChoisis.length} adresses)` : ""}
              </Button>
              <Button variant="outline" onClick={() => creerBC([])} className="w-full">
                Créer sans envoyer de courriel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function OngletTempsProjet({ r }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
        Tâches & heures ({r.heuresChantier} h chantier + {r.heuresTransport} h transport = {r.totalHeures} h)
      </p>
      <div className="space-y-1.5">
        {r.travauxDuProjet.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              {t.estTransport && <Car size={12} className="shrink-0 text-slate-400" />}
              <div>
                <p className="font-semibold text-slate-800">{t.titre}</p>
                <p className="text-[10px] text-slate-400">{t.date}{t.estTransport ? " · imputation automatique" : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold tabular-nums text-slate-700">{t.heures || 0} h</p>
              {t.estTransport && t.distanceKm > 0 && (
                <p className="text-[10px] tabular-nums text-slate-400">{t.distanceKm.toFixed(1)} km</p>
              )}
            </div>
          </div>
        ))}
        {r.travauxDuProjet.length === 0 && <p className="text-xs text-slate-400">Aucune tâche rattachée à ce projet pour l'instant.</p>}
      </div>

      {/* 📋 HEURES ADMINISTRATIVES LIÉES (2026-09-03, demande du
          propriétaire) — les visites/mesures rattachées au projet mais
          comptées aux frais généraux : visibles ici POUR MÉMOIRE, avec
          la mention claire qu'elles ne touchent pas au coût du projet. */}
      {(r.travauxAdminLies || []).length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
            📋 Heures administratives liées ({r.heuresAdminLiees} h) — non comptées dans le coût du projet
          </p>
          <div className="space-y-1.5">
            {r.travauxAdminLies.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-600">{t.titre}</p>
                  <p className="text-[10px] text-slate-400">
                    {t.employeNom ? `${t.employeNom} · ` : ""}{t.date}
                    {t.categorieHeures === "administratif" ? " · frais administratifs" : " · divers"}
                  </p>
                </div>
                <p className="font-bold tabular-nums text-slate-500">{t.heures || 0} h</p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Ces heures sont payées (feuille de temps) mais restent aux frais généraux de l&apos;entreprise — une
            visite de soumission ne gonfle pas le coût du contrat.
          </p>
        </div>
      )}
    </div>
  );
}


export function OngletFacturationProjet({ r, devisDuClient }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Finances — Factures & dépenses QuickBooks ({r.transactionsDuProjet.length})
        </p>
        {r.transactionsDuProjet.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune transaction QuickBooks synchronisée pour ce projet. Clique "Synchroniser QuickBooks" dans l'onglet Vue d'ensemble.</p>
        ) : (
          <div className="space-y-1.5">
            {r.transactionsDuProjet.map((t) => (
              <div key={t.quickbooksId} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                <div className="flex items-center gap-2">
                  {t.type === "INVOICE" ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">VENTE</span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">DÉPENSE</span>
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">{t.quickbooksId}</p>
                    <p className="text-[10px] text-slate-400">{t.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-slate-700">{t.amountHT.toFixed(2)} $ HT</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    t.status === "PAID" ? "bg-emerald-100 text-emerald-700" : t.status === "UNPAID" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                  }`}>
                    {t.status === "PAID" ? <CheckCircle2 size={10} /> : t.status === "UNPAID" ? <AlertTriangle size={10} /> : <Cloud size={10} />}
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-[11px] font-semibold text-slate-500">
              <span>Total facturé réel (encaissé/à encaisser)</span>
              <span className="tabular-nums">{r.totalFactureReel.toFixed(2)} $</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Facturation progressive</p>
        {devisDuClient.length === 0 ? (
          <p className="text-xs text-slate-400">Aucun devis pour ce client — voir l'onglet Devis pour en créer un, puis l'onglet Facturation pour les acomptes.</p>
        ) : (
          <div className="space-y-1">
            {devisDuClient.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                <span className="font-semibold text-slate-800">{d.numero}</span>
                <span className="tabular-nums text-slate-600">{d.totalVendant.toFixed(2)} $</span>
              </div>
            ))}
            <p className="text-[10px] text-slate-400">Voir l'onglet Facturation pour émettre les acomptes/factures de situation.</p>
          </div>
        )}
      </div>
    </div>
  );
}


export function ModalDetailProjet({ projet, travaux, devisListe, transactionsQb, clients, utilisateurs, tauxMetiers, onFermer, onAjouterBC, onMajMateriel, onMajReprise, onChangerStatut, onRenommer, onSyncQuickBooks, onAssignerTransaction, syncQbEnCours, peutSyncQb, fournisseurs, setFournisseurs, ajouterJournal, inspections }) {
  const [ongletActif, setOngletActif] = useState("apercu");
  const configProj = useEntreprise();
  const r = useMemo(
    () => calculerRentabiliteProjet(projet, travaux, transactionsQb, utilisateurs, tauxMetiers, inspections || [], Number(configProj?.coutCamionHoraire) || 0),
    [projet, travaux, transactionsQb, utilisateurs, tauxMetiers, inspections, configProj]
  );
  const sante = useMemo(() => evaluerSanteProjet(projet, r), [projet, r]);
  const devisDuClient = useMemo(() => devisListe.filter((d) => d.clientId === projet.clientId), [devisListe, projet.clientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* max-w-2xl (2026-08-31) : avec 5 onglets, la fenêtre max-w-lg
          forçait un défilement horizontal des onglets — tout doit se
          voir d'un coup (retour du propriétaire). */}
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="p-5 pb-0">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                {projet.nom}
                {/* ✏️ RENOMMER (2026-08-31, « j'ai fait une erreur sur le
                    nom ») — tout se corrige après coup, comme les fiches. */}
                {onRenommer && (
                  <button
                    onClick={() => {
                      const nouveau = window.prompt("Nouveau nom du projet :", projet.nom);
                      if (nouveau && nouveau.trim() && nouveau.trim() !== projet.nom) onRenommer(nouveau.trim());
                    }}
                    title="Corriger le nom du projet"
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    ✏️
                  </button>
                )}
              </h3>
              <p className="text-xs text-slate-500">{projet.dateDebut} → {projet.dateFin}</p>
              {projet.adresseTravaux && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin size={11} /> {projet.adresseTravaux}
                </p>
              )}
            </div>
            <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
          </div>

          {/* ONGLETS */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {ONGLETS_PROJET.map((o) => (
              <button
                key={o.id}
                onClick={() => setOngletActif(o.id)}
                className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold ${
                  ongletActif === o.id ? "border-[#131B2E] text-[#131B2E]" : "border-transparent text-slate-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {ongletActif === "apercu" && (
            <>
              <OngletApercuProjet projet={projet} r={r} sante={sante} onChangerStatut={onChangerStatut} onSyncQuickBooks={onSyncQuickBooks} syncQbEnCours={syncQbEnCours} peutSyncQb={peutSyncQb} />
              {/* 📋 DEVIS RATTACHÉS (2026-08-30, devis multiples par
                  projet) : l'original ET les extras — le budget du projet
                  est leur somme, chacun reste consultable. */}
              {(() => {
                const rattaches = (devisListe || []).filter((d) => d.projetId === projet.id && d.versionActive !== false);
                if (rattaches.length === 0) return null;
                return (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      📋 Devis rattachés ({rattaches.length})
                    </p>
                    <div className="space-y-1">
                      {rattaches.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs">
                          <span className="min-w-0 truncate font-bold text-slate-800">
                            {d.numero}
                            {d.lignes?.[0]?.nom ? <span className="ml-1.5 font-normal text-slate-500">📌 {d.lignes[0].nom}</span> : null}
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-slate-700">{(Number(d.totalVendant) || 0).toFixed(2)} $</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400">Le budget du projet est la somme de ces devis (extras compris).</p>
                  </div>
                );
              })()}
            </>
          )}
          {ongletActif === "achats" && <OngletBonsCommandeProjet projet={projet} onAjouterBC={onAjouterBC} onMajMateriel={onMajMateriel} r={r} transactionsQb={transactionsQb} fournisseurs={fournisseurs} setFournisseurs={setFournisseurs} ajouterJournal={ajouterJournal} clients={clients} />}
          {ongletActif === "temps" && <OngletTempsProjet r={r} />}
          {ongletActif === "reprise" && (
            <BlocRepriseChantier projet={projet} r={r} onMajReprise={onMajReprise} ajouterJournal={ajouterJournal} />
          )}
          {ongletActif === "facturation" && <OngletFacturationProjet r={r} devisDuClient={devisDuClient} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ============================================================
// 🏗️ NOUVEAU PROJET DEPUIS LE HUB (2026-09-03, demande du propriétaire :
// « créer un projet à partir de là, ajouter un client, ou aller
// chercher un devis dans QuickBooks avec le bon montant »).
// Le chemin RAPIDE : client (existant, ou fiche express), nom, adresse,
// budget GLOBAL (vendu + coût projeté — les projets à la tonne), et
// l'import d'un devis QuickBooks par numéro qui remplit le montant.
// La ventilation détaillée par poste reste offerte au dossier client.
// ============================================================
function ModalNouveauProjetRapide({ clients, setClients, ajouterJournal, onFermer, onCreer }) {
  const nb = (v) => Number(v) || 0;
  const [clientId, setClientId] = useState("");
  const [recherche, setRecherche] = useState("");
  const client = (clients || []).find((c) => c.id === clientId) || null;
  const resultats = (() => {
    const t = recherche.trim().toLowerCase();
    const base = clients || [];
    return (t ? base.filter((c) => correspond(c, t)) : base).slice(0, 8);
  })();
  // Fiche EXPRESS d'un client absent — le minimum vital ; le dossier se
  // complète ensuite dans l'onglet Clients (adresses, courriels…).
  const [expressOuvert, setExpressOuvert] = useState(false);
  const [expressNom, setExpressNom] = useState("");
  const [expressTel, setExpressTel] = useState("");
  const [expressCourriel, setExpressCourriel] = useState("");
  const creerClientExpress = () => {
    if (!expressNom.trim() || !setClients) return;
    const fiche = {
      id: `c-${Date.now()}`,
      nom: expressNom.trim(),
      entreprise: null,
      courriels: expressCourriel.trim() ? [{ id: `cc-${Date.now()}`, label: "Principal", email: expressCourriel.trim(), defaut: true }] : [],
      telephone: expressTel.trim() || null,
      adresses: [],
      contacts: [],
    };
    setClients((prev) => [...prev, fiche]);
    setClientId(fiche.id);
    setExpressOuvert(false);
    ajouterJournal(`👤 Fiche express créée pour « ${fiche.nom} » — complète son dossier (adresse, courriels) dans l'onglet Clients.`);
  };

  const [nom, setNom] = useState("");
  const [adresseId, setAdresseId] = useState("");
  const [nouvelleAdresse, setNouvelleAdresse] = useState(null);
  const [secteur, setSecteur] = useState("commercial");
  const [debut, setDebut] = useState(todayISO());
  const [fin, setFin] = useState("");
  const [globalFacture, setGlobalFacture] = useState("");
  const [globalCoutant, setGlobalCoutant] = useState("");
  const marge = nb(globalFacture) - nb(globalCoutant);
  const margePct = nb(globalFacture) > 0 ? (marge / nb(globalFacture)) * 100 : 0;

  // 📥 IMPORT D'UN DEVIS QUICKBOOKS par numéro : la lecture existante
  // (route estimate, action « lire ») ramène les lignes — leur total
  // devient le prix vendu, le nom se propose tout seul.
  const [devisQbNumero, setDevisQbNumero] = useState("");
  const [devisQbEtat, setDevisQbEtat] = useState(""); // "" | "cherche" | message
  const importerDevisQb = async () => {
    const numero = devisQbNumero.trim();
    if (!numero) return;
    setDevisQbEtat("cherche");
    const r = await lireEstimateQbo(numero);
    if (r?.trouve) {
      const total = (r.lignes || []).reduce((s, l) => s + (Number(l.quantite) || 1) * (Number(l.prixUnitaire) || 0), 0);
      setGlobalFacture(Math.round(total * 100) / 100);
      if (!nom.trim()) setNom(`Devis ${numero}`);
      setDevisQbEtat(`✅ Devis ${numero} trouvé — ${(r.lignes || []).length} ligne${(r.lignes || []).length > 1 ? "s" : ""}, ${total.toFixed(2)} $ posé comme prix vendu.`);
    } else {
      setDevisQbEtat(r?.nonConnecte ? "🔌 QuickBooks non connecté." : r?.erreur ? `⚠️ ${r.erreur}` : `Devis ${numero} introuvable dans QuickBooks.`);
    }
  };

  const creer = () => {
    if (!client || !nom.trim() || nb(globalFacture) <= 0) return;
    let adresseTravaux = null;
    if (nouvelleAdresse) adresseTravaux = nouvelleAdresse.label;
    else if (adresseId) {
      const a = client?.adresses?.find((x) => x.id === adresseId);
      if (a) adresseTravaux = `${a.nom} — ${libelleAdresse(a)}`;
    }
    onCreer(
      {
        id: `projet-${Date.now()}`,
        nom: nom.trim(),
        clientId: client.id,
        adresseTravaux,
        dateDebut: debut,
        dateFin: fin,
        secteur: secteur === "residentiel" ? "residentiel" : "commercial",
        statut: "À planifier",
        budgetTotal: nb(globalFacture),
        tauxHoraireCoutant: 45,
        bonsCommande: [],
        ...(devisQbNumero.trim() && devisQbEtat.startsWith("✅") ? { devisNumero: devisQbNumero.trim() } : {}),
        budgetPrevu: {
          modeSimple: true,
          mainOeuvreChantier: { heures: 0, facture: 0, coutant: 0 },
          transport: { heures: 0, facture: 0, coutant: 0 },
          materiaux: { facture: 0, coutant: 0 },
          sousTraitants: [],
          totalFacture: nb(globalFacture),
          totalCoutant: nb(globalCoutant),
          marge,
        },
      },
      client.nom
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🏗️ Nouveau projet</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Budget global (vendu à la tonne, au forfait…) — pour la ventilation détaillée par poste, passe par le dossier du client.
            </p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 pt-3">
          {/* CLIENT */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Client *</label>
            {client ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-[#FF6A13] bg-orange-50 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-bold text-slate-800">{nomAffichageClient(client)}</span>
                <button onClick={() => { setClientId(""); setRecherche(""); setAdresseId(""); }} className="shrink-0 text-[11px] font-bold text-slate-500 underline">changer</button>
              </div>
            ) : expressOuvert ? (
              <div className="space-y-1.5 rounded-xl border border-dashed border-slate-300 p-2.5">
                <input value={expressNom} onChange={(e) => setExpressNom(e.target.value)} placeholder="Nom du client ou de l'entreprise *" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={expressTel} onChange={(e) => setExpressTel(e.target.value)} placeholder="Téléphone" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                  <input value={expressCourriel} onChange={(e) => setExpressCourriel(e.target.value)} placeholder="Courriel" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="outline" onClick={() => setExpressOuvert(false)} className="min-h-0 py-1.5 text-[11px]">Annuler</Button>
                  <Button onClick={creerClientExpress} disabled={!expressNom.trim()} className="min-h-0 py-1.5 text-[11px]">Créer la fiche express</Button>
                </div>
                <p className="text-[9px] text-slate-400">Le minimum pour démarrer — complète le dossier (adresse, courriels) dans l&apos;onglet Clients.</p>
              </div>
            ) : (
              <>
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Cherche un client par nom, entreprise ou téléphone…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="mt-0.5 max-h-[130px] overflow-y-auto rounded-lg border border-slate-200">
                  {resultats.map((c) => (
                    <button key={c.id} onClick={() => setClientId(c.id)} className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-orange-50">
                      <span className="min-w-0 truncate">{nomAffichageClient(c)}</span>
                      <span className="shrink-0 text-[10px] font-bold text-[#FF6A13]">choisir →</span>
                    </button>
                  ))}
                </div>
                {setClients && (
                  <button onClick={() => { setExpressOuvert(true); setExpressNom(recherche.trim()); }} className="mt-1 text-[11px] font-bold text-slate-500 underline underline-offset-2">
                    ➕ Client absent de la liste ? Créer une fiche express…
                  </button>
                )}
              </>
            )}
          </div>

          {/* 📥 DEVIS QUICKBOOKS */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <label className="mb-1 block text-[10px] font-bold text-slate-500">📥 Importer un devis QuickBooks (facultatif)</label>
            <div className="flex gap-1.5">
              <input value={devisQbNumero} onChange={(e) => setDevisQbNumero(e.target.value)} placeholder="Nº du devis — ex : 1042 ou DEV-3520" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              <Button variant="outline" onClick={importerDevisQb} loading={devisQbEtat === "cherche"} loadingText="…" className="min-h-0 shrink-0 px-2.5 py-1.5 text-[11px]">
                Chercher
              </Button>
            </div>
            {devisQbEtat && devisQbEtat !== "cherche" && <p className="mt-1 text-[10px] font-semibold text-slate-600">{devisQbEtat}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Nom du projet *</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Conduits sous dalle — 12 tonnes" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          {/* ADRESSE DES TRAVAUX */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Adresse des travaux</label>
            {(client?.adresses || []).length > 0 && (
              <select value={adresseId} onChange={(e) => { setAdresseId(e.target.value); setNouvelleAdresse(null); }} className="mb-1.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs">
                <option value="">— Choisir une adresse enregistrée —</option>
                {(client?.adresses || []).map((a) => <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>)}
              </select>
            )}
            <AutocompleteAdresse onSelection={(place) => { setNouvelleAdresse(place); setAdresseId(""); }} />
            {nouvelleAdresse && <p className="mt-1 text-[11px] font-bold text-emerald-700">✓ {nouvelleAdresse.label}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Secteur CCQ</label>
              <div className="flex rounded-lg border border-slate-200 p-0.5">
                {[["commercial", "🏢 Commercial"], ["residentiel", "🏠 Résidentiel"]].map(([id, lib]) => (
                  <button key={id} type="button" onClick={() => setSecteur(id)} className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-bold ${secteur === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}>{lib}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400">Début</label>
                <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400">Fin</label>
                <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs" />
              </div>
            </div>
          </div>

          {/* 🎯 BUDGET GLOBAL */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">🎯 Budget global ($)</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Prix vendu (total) $ *</label>
                <InputNombreDecimal valeur={globalFacture} onChange={setGlobalFacture} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coût total projeté $</label>
                <InputNombreDecimal valeur={globalCoutant} onChange={setGlobalCoutant} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs tabular-nums" />
              </div>
            </div>
            <p className="mt-1.5 text-right text-[11px] font-extrabold text-emerald-700 tabular-nums">
              Marge projetée : {marge.toFixed(0)} $ · {margePct.toFixed(0)} %
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button disabled={!client || !nom.trim() || nb(globalFacture) <= 0} onClick={creer} className="min-h-0 py-2 text-xs">
            Créer le projet
          </Button>
        </div>
      </div>
    </div>
  );
}

// HUB PROJETS & RENTABILITÉ — vue générale, recherche/filtres,
// cartes synthétiques de tous les projets
// ============================================================
export const FILTRES_STATUT_HUB = ["Tous", "À planifier", "En cours", "Facturation d'acompte", "Terminé", "En retard"];


export const CarteProjet = React.memo(function CarteProjet({ p, client, travaux, transactionsQb, utilisateurs, tauxMetiers, onOuvrir, draggable, onDragStart, compact }) {
  const r = useMemo(() => calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers), [p, travaux, transactionsQb, utilisateurs, tauxMetiers]);
  const avancementCalendrier = useMemo(() => calculerAvancementCalendrier(p), [p]);
  const enRetard = projetEnRetard(p);
  const enPerte = r.profitReel < 0;

  return (
    <button
      onClick={() => onOuvrir(p.id)}
      draggable={draggable}
      onDragStart={onDragStart}
      className={`w-full rounded-2xl border border-slate-200 bg-white text-left hover:border-slate-300 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-bold text-slate-900 ${compact ? "text-xs" : "text-sm"}`}>{p.nom}</p>
          <p className="text-[11px] text-slate-500">{client?.nom}{!compact && ` · ${p.statut}`}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {r.depassementBudget && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
              <AlertCircle size={10} /> {!compact && "Risque de dépassement"}
            </span>
          )}
          {enPerte && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
              <AlertCircle size={10} /> {!compact && "En perte"}
            </span>
          )}
          {enRetard && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              <Clock size={10} /> {!compact && "En retard"}
            </span>
          )}
        </div>
      </div>

      {/* Double barre de progression : budget vs calendrier */}
      <div className="mt-3 space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] font-semibold text-slate-400">
            <span>Budget consommé</span><span>{r.pourcentageDepense.toFixed(0)}%</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`} style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }} />
          </div>
        </div>
        {!compact && avancementCalendrier !== null && (
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-slate-400">
              <span>Avancement calendrier</span><span>{avancementCalendrier.toFixed(0)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${avancementCalendrier}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Chiffres clés */}
      <div className="mt-3 grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Budget</p>
          <p className="text-xs font-bold tabular-nums text-slate-800">{p.budgetTotal.toFixed(0)} $</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Coûts réels</p>
          <p className="text-xs font-bold tabular-nums text-slate-800">{r.coutTotalReel.toFixed(0)} $</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Profit</p>
          <p className={`text-xs font-bold tabular-nums ${enPerte ? "text-red-600" : "text-emerald-600"}`}>
            {r.profitReel.toFixed(0)} $ ({r.pourcentageMarge.toFixed(0)}%)
          </p>
        </div>
      </div>
    </button>
  );
});


export function OngletProjetsHub({ projets, setProjets, clients, setClients = null, travaux, devisListe, transactionsQb, bonsTravail = [], utilisateurs, tauxMetiers, syncQbEnCours, onSyncQuickBooks, onAssignerTransaction, ajouterJournal, peutSyncQb, fournisseurs, setFournisseurs, inspections }) {
  // 🏗️ « + Nouveau projet » depuis le hub (2026-09-03, demande du
  // propriétaire) — plus besoin de passer par le dossier client.
  const [nouveauProjetOuvert, setNouveauProjetOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("Tous");
  const [filtreClientId, setFiltreClientId] = useState("");
  const [projetOuvertId, setProjetOuvertId] = useState(null);
  const [assignationManuelleId, setAssignationManuelleId] = useState(null);
  const [vueAffichage, setVueAffichage] = useState("liste"); // "liste" | "kanban"
  const [colonneSurvolee, setColonneSurvolee] = useState(null);

  const projetOuvert = projets.find((p) => p.id === projetOuvertId) || null;
  // ============================================================
  // FACTURES QUICKBOOKS NON ASSIGNÉES — REPLIÉES PAR DÉFAUT
  // ------------------------------------------------------------
  // Retour du propriétaire (2026-08-24) : le bloc occupait tout le haut
  // de la page Projets, avec un triangle rouge par ligne — ça laissait
  // croire à un problème alors qu'il n'y en a pas. Et ça va empirer, pas
  // s'améliorer : le jour où le vrai QuickBooks remplace le Sandbox,
  // cette liste comptera des centaines de vraies factures.
  //
  // Deux décisions :
  //   • replié par défaut — rien n'est caché, une ligne suffit à dire
  //     combien il y en a, on déplie quand on vient FAIRE du classement ;
  //   • les factures à 0,00 $ sont écartées — un montant nul ne change
  //     aucune marge, le classer ne sert donc à rien.
  // ============================================================
  const [blocQbOuvert, setBlocQbOuvert] = useState(false);
  // 🔧 Les JOBS auxquelles on peut rattacher une dépense : les bons de
  // travail (une job facturable = un bon), les plus récents d'abord.
  // C'est la même clé `tacheId` que les achats saisis à la main.
  const jobsRattachables = useMemo(() => {
    const vues = new Set();
    return (bonsTravail || [])
      .filter((b) => b.tacheId && !vues.has(b.tacheId) && vues.add(b.tacheId))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 60)
      .map((b) => ({
        id: b.tacheId,
        libelle: `${b.date || ""} · ${b.projet || "Travail"}${b.client ? ` — ${b.client}` : ""}`,
      }));
  }, [bonsTravail]);

  const transactionsSansProjet = transactionsQb.filter((t) => !t.cible);
  // 📦 FILTRE PAR BC (2026-08-31, demande du propriétaire : « une
  // compagnie qui a 200 transactions par mois autres que des matériaux
  // va passer son temps à faire ça pour rien ») : quand le réglage est
  // actif (Paramètres → Connexions), seules les dépenses qui PORTENT un
  // Nº de bon de commande remontent — les autres restent à QuickBooks.
  const configHub = useEntreprise();
  const filtreBcActif = configHub?.achatsSeulementBc === true;
  const porteUnBc = (t) =>
    !!String(t.poNumber || "").trim() || /\bBC[\s-]?\d{2,}\b/i.test(String(t.referenceTexte || ""));
  const transactionsNonAssignees = transactionsSansProjet.filter(
    (t) => Math.abs(Number(t.amountHT) || 0) > 0 && (!filtreBcActif || porteUnBc(t))
  );
  const nbFiltreesSansBc = filtreBcActif
    ? transactionsSansProjet.filter((t) => Math.abs(Number(t.amountHT) || 0) > 0 && !porteUnBc(t)).length
    : 0;
  const nbQbMontantNul = transactionsSansProjet.filter((t) => Math.abs(Number(t.amountHT) || 0) === 0).length;
  // 🚫 Transactions marquées « Hors Fluxya » — sorties de la liste mais
  // jamais perdues : un petit tiroir permet de les remettre à classer.
  const transactionsHorsFluxya = transactionsQb.filter((t) => t.cible?.type === "hors");
  const [horsFluxyaOuvert, setHorsFluxyaOuvert] = useState(false);

  const ajouterBonCommandeProjet = (projetId, bc) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, bonsCommande: [...(p.bonsCommande || []), bc] } : p)));
    const p = projets.find((x) => x.id === projetId);
    ajouterJournal(`📦 BC ${bc.numeroBC} (${bc.montantHT.toFixed(2)} $) ajouté au projet "${p?.nom}"`);
  };

  const changerStatutProjet = (projetId, statut) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, statut } : p)));
  };

  const projetsFiltres = projets.filter((p) => {
    if (filtreClientId && p.clientId !== filtreClientId) return false;
    if (filtreStatut !== "Tous") {
      if (filtreStatut === "En retard" ? !projetEnRetard(p) : p.statut !== filtreStatut) return false;
    }
    if (recherche.trim()) {
      const client = clients.find((c) => c.id === p.clientId);
      const texte = `${p.nom} ${client?.nom || ""}`.toLowerCase();
      if (!texte.includes(recherche.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Projets &amp; Rentabilité</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNouveauProjetOuvert(true)} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
            <Plus size={12} /> Nouveau projet
          </Button>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setVueAffichage("liste")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${vueAffichage === "liste" ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              <List size={12} /> Liste
            </button>
            <button
              onClick={() => setVueAffichage("kanban")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${vueAffichage === "kanban" ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              <LayoutGrid size={12} /> Kanban
            </button>
          </div>
          <Button
            variant="outline"
            onClick={peutSyncQb ? onSyncQuickBooks : undefined}
            disabled={!peutSyncQb}
            loading={syncQbEnCours}
            title={peutSyncQb ? undefined : "Réservé aux administrateurs"}
            className="min-h-0 gap-1.5 px-2.5 py-1.5 text-xs"
          >
            {!syncQbEnCours && (peutSyncQb ? <RefreshCw size={12} /> : <Lock size={12} />)} Synchroniser QuickBooks
          </Button>
        </div>
      </div>

      {/* RECHERCHE & FILTRES */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom de projet ou client..."
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTRES_STATUT_HUB.map((s) => (
            <button
              key={s}
              onClick={() => setFiltreStatut(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                filtreStatut === s ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={filtreClientId}
          onChange={(e) => setFiltreClientId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>

      {/* FACTURES QUICKBOOKS NON ASSIGNÉES — repliées par défaut.
          (Le bloc reste visible tant qu'il existe des transactions
          « Hors Fluxya » : c'est là qu'on peut les remettre à classer.) */}
      {(transactionsNonAssignees.length > 0 || transactionsHorsFluxya.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <button
            type="button"
            onClick={() => setBlocQbOuvert((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-amber-700">
              <AlertTriangle size={13} className="shrink-0" />
              <span className="truncate">
                {transactionsNonAssignees.length} facture{transactionsNonAssignees.length > 1 ? "s" : ""} QuickBooks à
                rattacher à un projet, une job ou un client
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-amber-700">{blocQbOuvert ? "▲ Replier" : "▼ Ouvrir"}</span>
          </button>
          {!blocQbOuvert && (
            <p className="mt-1 text-[10px] leading-snug text-amber-600">
              Sert à calculer la marge réelle. Une dépense se rattache à un <span className="font-bold">projet</span>, à une{" "}
              <span className="font-bold">job</span> (le produit acheté pour une tâche précise) ou à un{" "}
              <span className="font-bold">client</span>. Rien d&apos;urgent : tant qu&apos;une facture n&apos;est pas
              rattachée, elle ne fausse aucun chiffre — elle n&apos;est simplement comptée nulle part.
              {nbQbMontantNul > 0 && ` (${nbQbMontantNul} facture${nbQbMontantNul > 1 ? "s" : ""} à 0,00 $ écartée${nbQbMontantNul > 1 ? "s" : ""} — un montant nul ne change aucune marge.)`}
              {/* Le filtre ne cache JAMAIS en silence : le compte des
                  laissées-de-côté s'affiche (règle maison). */}
              {nbFiltreesSansBc > 0 && ` 📦 Filtre actif : ${nbFiltreesSansBc} dépense${nbFiltreesSansBc > 1 ? "s" : ""} sans Nº de BC laissée${nbFiltreesSansBc > 1 ? "s" : ""} à QuickBooks (Paramètres → Connexions).`}
            </p>
          )}
          {blocQbOuvert && (
          <div className="mt-2 space-y-1.5">
            {transactionsNonAssignees.map((t) => {
              // 🎯 TROIS CIBLES (2026-08-26) : un achat fait pour une job
              // SANS projet n'avait aucune destination — il restait
              // orphelin et son coût n'apparaissait nulle part. La valeur
              // du menu est « type:id » pour tenir les trois familles.
              const choix = assignationManuelleId?.quickbooksId === t.quickbooksId ? assignationManuelleId.valeur : "";
              return (
                <div key={t.quickbooksId} className="rounded-lg border border-amber-200 bg-white p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex min-w-0 items-center gap-1 font-semibold text-slate-800">
                      <AlertTriangle size={11} className="shrink-0 text-red-500" />
                      {/* 👤 Le NOM d'abord (2026-08-28) : une carte « QBO-INV-1042 »
                          est inclassable — « Toitures Marleau · 12 mars » se classe
                          en une seconde. Le numéro QuickBooks passe en second. */}
                      <span className="truncate">
                        {(t.type === "INVOICE" ? t.clientNomQb : t.fournisseurNomQb) || t.quickbooksId}
                      </span>
                      <span className="shrink-0 text-[10px] font-normal text-slate-400">
                        · {t.type === "INVOICE" ? "Vente" : "Dépense"}{t.date ? ` · ${t.date}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-700">{t.amountHT.toFixed(2)} $ HT</span>
                  </div>
                  {((t.type === "INVOICE" ? t.clientNomQb : t.fournisseurNomQb) || t.poNumber || t.referenceTexte) && (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">
                      {t.quickbooksId}
                      {t.poNumber ? ` · Nº ${t.poNumber}` : ""}
                      {t.referenceTexte ? ` · ${String(t.referenceTexte).slice(0, 60)}` : ""}
                    </p>
                  )}
                  <div className="mt-1.5 flex gap-1.5">
                    <select
                      value={choix}
                      onChange={(e) => setAssignationManuelleId({ quickbooksId: t.quickbooksId, valeur: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                    >
                      <option value="">Rattacher à…</option>
                      {projets.length > 0 && (
                        <optgroup label="🏗️ Projets">
                          {projets.map((p) => <option key={p.id} value={`projet:${p.id}`}>{p.nom}</option>)}
                        </optgroup>
                      )}
                      {jobsRattachables.length > 0 && (
                        <optgroup label="🔧 Jobs (tâches)">
                          {jobsRattachables.map((j) => (
                            <option key={j.id} value={`tache:${j.id}`}>
                              {j.libelle}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {(clients || []).length > 0 && (
                        <optgroup label="👤 Clients (aucune job précise)">
                          {(clients || []).map((c) => <option key={c.id} value={`client:${c.id}`}>{c.nom}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!choix}
                      onClick={() => {
                        const [type, ...reste] = String(choix).split(":");
                        onAssignerTransaction(t.quickbooksId, { type, id: reste.join(":") });
                        setAssignationManuelleId(null);
                      }}
                      className="min-h-0 px-2 py-1 text-[11px]"
                    >
                      Assigner
                    </Button>
                    {/* 🚫 HORS FLUXYA (2026-08-28) : la transaction ne
                        concerne aucune job (essence, comptable, frais
                        généraux…) — elle sort de la liste sans entrer
                        dans aucune marge. Réversible en bas du bloc. */}
                    <Button
                      variant="outline"
                      onClick={() => onAssignerTransaction(t.quickbooksId, { type: "hors", id: "hors" })}
                      title="Cette transaction ne concerne aucune job — la sortir de la liste (récupérable)"
                      className="min-h-0 px-2 py-1 text-[11px] text-slate-500"
                    >
                      🚫 Hors Fluxya
                    </Button>
                  </div>
                </div>
              );
            })}
            {nbQbMontantNul > 0 && (
              <p className="pt-1 text-[10px] leading-snug text-amber-600">
                {nbQbMontantNul} facture{nbQbMontantNul > 1 ? "s" : ""} à 0,00 $ {nbQbMontantNul > 1 ? "sont" : "est"}{" "}
                écartée{nbQbMontantNul > 1 ? "s" : ""} de cette liste — un montant nul ne change aucune marge.
              </p>
            )}
            {transactionsHorsFluxya.length > 0 && (
              <div className="border-t border-amber-200 pt-1.5">
                <button
                  type="button"
                  onClick={() => setHorsFluxyaOuvert((v) => !v)}
                  className="text-[10px] font-bold text-amber-600 underline"
                >
                  🚫 {transactionsHorsFluxya.length} transaction{transactionsHorsFluxya.length > 1 ? "s" : ""} marquée{transactionsHorsFluxya.length > 1 ? "s" : ""} « Hors Fluxya » {horsFluxyaOuvert ? "▲" : "▼"}
                </button>
                {horsFluxyaOuvert && (
                  <div className="mt-1 space-y-1">
                    {transactionsHorsFluxya.map((t) => (
                      <div key={t.quickbooksId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <span className="min-w-0 truncate text-slate-500">
                          {(t.type === "INVOICE" ? t.clientNomQb : t.fournisseurNomQb) || t.quickbooksId}
                          {t.date ? ` · ${t.date}` : ""} · <span className="tabular-nums">{t.amountHT.toFixed(2)} $</span>
                        </span>
                        <button
                          onClick={() => onAssignerTransaction(t.quickbooksId, null)}
                          className="shrink-0 text-[10px] font-bold text-slate-500 underline"
                        >
                          Remettre à classer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      )}


      {/* CARTES PROJETS — vue Liste ou Kanban */}
      {vueAffichage === "liste" ? (
        <div className="space-y-3">
          {projetsFiltres.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              Aucun projet ne correspond à ces critères. Les projets se créent depuis la fiche client (onglet Clients).
            </p>
          )}
          {projetsFiltres.map((p) => (
            <CarteProjet
              key={p.id}
              p={p}
              client={clients.find((c) => c.id === p.clientId)}
              travaux={travaux}
              transactionsQb={transactionsQb}
              utilisateurs={utilisateurs}
              tauxMetiers={tauxMetiers}
              onOuvrir={setProjetOuvertId}
            />
          ))}
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex gap-3" style={{ minWidth: STATUTS_PROJET.length * 220 }}>
            {STATUTS_PROJET.map((statutColonne) => {
              const projetsColonne = projetsFiltres.filter((p) => p.statut === statutColonne);
              return (
                <div
                  key={statutColonne}
                  onDragOver={(e) => { e.preventDefault(); setColonneSurvolee(statutColonne); }}
                  onDragLeave={() => setColonneSurvolee(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const projetId = e.dataTransfer.getData("text/plain");
                    if (projetId) changerStatutProjet(projetId, statutColonne);
                    setColonneSurvolee(null);
                  }}
                  className={`w-[220px] shrink-0 rounded-xl p-2 ${colonneSurvolee === statutColonne ? "bg-orange-50" : "bg-slate-50"}`}
                >
                  <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-slate-600">
                    {statutColonne}
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] tabular-nums">{projetsColonne.length}</span>
                  </p>
                  <div className="space-y-2">
                    {projetsColonne.map((p) => (
                      <CarteProjet
                        key={p.id}
                        p={p}
                        client={clients.find((c) => c.id === p.clientId)}
                        travaux={travaux}
                        transactionsQb={transactionsQb}
                        utilisateurs={utilisateurs}
                        tauxMetiers={tauxMetiers}
                        onOuvrir={setProjetOuvertId}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                        compact
                      />
                    ))}
                    {projetsColonne.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[10px] text-slate-400">
                        Glisse un projet ici
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {nouveauProjetOuvert && (
        <ModalNouveauProjetRapide
          clients={clients}
          setClients={setClients}
          ajouterJournal={ajouterJournal}
          onFermer={() => setNouveauProjetOuvert(false)}
          onCreer={(nouveau, nomClient) => {
            setNouveauProjetOuvert(false);
            setProjets((prev) => [...prev, nouveau]);
            ajouterJournal(
              `🏗️ Projet "${nouveau.nom}" créé pour ${nomClient} — budget global ${Number(nouveau.budgetPrevu?.totalFacture || 0).toFixed(2)} $, coût projeté ${Number(nouveau.budgetPrevu?.totalCoutant || 0).toFixed(2)} $.`
            );
          }}
        />
      )}
      {projetOuvert && (
        <ModalDetailProjet
          inspections={inspections}
          onMajMateriel={(liste) => setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, materielStock: liste } : px)))}
          onMajReprise={(reprise) => setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, reprise } : px)))}
          onRenommer={(nom) => {
            const ancien = projetOuvert.nom;
            setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, nom } : px)));
            ajouterJournal(`✏️ Projet renommé : « ${ancien} » → « ${nom} ».`);
          }}
          projet={projetOuvert}
          travaux={travaux}
          devisListe={devisListe}
          transactionsQb={transactionsQb}
          clients={clients}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          onFermer={() => setProjetOuvertId(null)}
          onAjouterBC={ajouterBonCommandeProjet}
          onChangerStatut={changerStatutProjet}
          onSyncQuickBooks={onSyncQuickBooks}
          peutSyncQb={peutSyncQb}
          syncQbEnCours={syncQbEnCours}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
        />
      )}
    </div>
  );
}


export function ModalNouveauFournisseur({ fournisseurs, setFournisseurs, ajouterJournal, onFermer, onSelection }) {
  const [nom, setNom] = useState("");
  const [courrielsTexte, setCourrielsTexte] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [erreurs, setErreurs] = useState([]);
  const doublon = (fournisseurs || []).find((f) => f.nom.trim().toLowerCase() === nom.trim().toLowerCase() && nom.trim().length > 2);

  const creer = () => {
    if (!nom.trim()) return;
    // Une adresse par ligne (ou séparées par des virgules) — la première
    // devient l'adresse par défaut du fournisseur.
    const liste = courrielsTexte
      .split(/[\n,;]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    const invalides = liste.filter((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
    if (invalides.length > 0) {
      setErreurs([`Adresse(s) invalide(s) : ${invalides.join(", ")}`]);
      return;
    }
    const id = `f-${Date.now()}`;
    const nouveau = {
      id,
      nom: nom.trim(),
      courriels: liste.map((email, i) => ({ id: `fc-${Date.now()}-${i}`, email, label: i === 0 ? "Principal" : "Autre", defaut: i === 0 })),
      telephone: telephone.trim(),
      adresse: adresse.trim(),
      notes: "",
    };
    setFournisseurs((prev) => [...prev, nouveau]);
    sauvegarderFournisseur(nouveau).catch(() =>
      ajouterJournal(`⚠️ Fournisseur « ${nouveau.nom} » créé localement, mais NON enregistré (table fournisseurs absente ?).`)
    );
    ajouterJournal(`🏭 Fournisseur « ${nouveau.nom} » ajouté au répertoire${liste.length > 0 ? ` (${liste.length} adresse${liste.length > 1 ? "s" : ""} courriel)` : ""}`);
    onSelection?.(id);
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🏭 Nouveau fournisseur</h3>
            <p className="text-xs text-slate-500">Ajouté au répertoire et sélectionné pour ce bon de commande.</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-2">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du fournisseur *" className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Courriels — une adresse par ligne</label>
            <textarea
              value={courrielsTexte}
              onChange={(e) => setCourrielsTexte(e.target.value)}
              rows={3}
              placeholder={"achats@fournisseur.com\ncomptabilite@fournisseur.com"}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">La première adresse sera cochée par défaut à l'envoi des bons de commande.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse (optionnel)" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>
          {doublon && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
              ⚠️ « {doublon.nom} » existe déjà.
              <button onClick={() => { onSelection?.(doublon.id); onFermer(); }} className="ml-1 underline">L'utiliser plutôt</button>
            </div>
          )}
          {erreurs.length > 0 && (
            <ul className="space-y-0.5 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-600">
              {erreurs.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
          <Button onClick={creer} disabled={!nom.trim()} className="w-full">Créer le fournisseur et l'utiliser</Button>
        </div>
      </div>
    </div>
  );
}

// Fenêtre proposant de reporter au catalogue le coût saisi sur une
// ligne de devis. Le report est un geste qui touche TOUS les futurs
// devis de l'entreprise — d'où la confirmation explicite plutôt qu'un
// enregistrement silencieux.
