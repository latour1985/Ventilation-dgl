"use client";

// app/admin/OngletTableauDeBord.jsx
//
// TABLEAU DE BORD (accueil, vue d'ensemble du jour) — tranche T12b du
// decoupage de page.jsx (2026-09-01). Extraction MECANIQUE : aucun
// comportement ne change — seuls des export/import s'ajoutent.

import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { camionIndisponible } from "@/lib/supabase/camions";
import { ModalAnalyseRentabilite } from "./ModalAnalyseRentabilite";
import { calculerRentabiliteProjet, camionsEntretienDu, cleTacheDesHeures, couleurSanteBudget, estMetierBureau, evaluerSanteProjet, tachesDuJourPourEmploye, todayISO } from "./partage";

export function OngletTableauDeBord({ projets, travaux, transactionsQb, utilisateurs, tauxMetiers, clients, compteAlertes, compteAttente, journal, setOnglet, inspections, entretiens, soumissionsSansDevis, bons, devisListe, parcCamions, planning, statutsAssignations, achatsLibres = [] }) {
  const configTdb = useEntreprise();
  const analyse = projets.map((p) => {
    const r = calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers, inspections, Number(configTdb?.coutCamionHoraire) || 0);
    return { p, r, sante: evaluerSanteProjet(p, r) };
  });
  // Heures RÉELLES saisies aujourd'hui par les techniciens (chantier +
  // transport confondus) — date locale.
  const heuresAujourdhui = (travaux || [])
    .filter((t) => t.date === todayISO())
    .reduce((s, t) => s + (Number(t.heures) || 0), 0);
  // Camions dont l'entretien périodique est dû (10 000 km / 6 mois).
  const entretiensDus = camionsEntretienDu(inspections, entretiens);
  const aRisque = analyse.filter((x) => x.sante.niveau === "rouge");
  const rang = { rouge: 0, jaune: 1, vert: 2 };
  const aSurveiller = analyse
    .filter((x) => x.sante.niveau !== "vert")
    .sort((a, b) => rang[a.sante.niveau] - rang[b.sante.niveau]);
  const margeMoyenne = analyse.length ? analyse.reduce((s, x) => s + x.r.pourcentageMarge, 0) / analyse.length : 0;
  // 📊 Analyse de rentabilité — ouverte par la tuile « Marge moyenne ».
  const [analyseOuverte, setAnalyseOuverte] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold text-slate-900">Tableau de bord</h2>
        <span className="text-xs text-slate-400">Vue d'ensemble</span>
      </div>

      {/* 📱 AUJOURD'HUI SUR LE TERRAIN — TÉLÉPHONE (2026-08-21)
          ------------------------------------------------------------
          La première question d'un admin sur la route est toujours la
          même : « qui est où, et où en est-il ? ». Sur l'ordinateur,
          l'agenda y répond d'un coup d'œil ; sur un téléphone, il
          fallait ouvrir l'agenda et défiler. Ce bloc donne la réponse
          en haut de l'écran d'accueil, en direct (le rose « en cours »
          vient du chronomètre du technicien lui-même). */}
      {(() => {
        const jour = todayISO();
        const gens = (utilisateurs || []).filter((u) => !estMetierBureau(u.metier));
        const lignes = gens
          .map((u) => {
            const taches = tachesDuJourPourEmploye(planning || {}, jour, u.id).filter((t) => !t.est_tache_systeme);
            if (taches.length === 0) return null;
            const courriel = (u.courriel || "").toLowerCase();
            const heuresDuJour = (travaux || [])
              .filter((t) => t.date === jour && (t.employeEmail || "").toLowerCase() === courriel)
              .reduce((s, t) => s + (Number(t.heures) || 0), 0);
            const aDesHeures = (t) =>
              (travaux || []).some(
                (x) => x.supabase && cleTacheDesHeures(x.tacheId) === t.id && (x.employeEmail || "").toLowerCase() === courriel && x.date === jour
              );
            // ⚠️ LES HEURES TRANCHENT, PAS LE STATUT (2026-08-21) : le
            // marqueur « en cours » peut rester collé sur une tâche
            // fermée par un coéquipier (la remise à zéro ne partait pas
            // de ce chemin-là). Une tâche dont les heures sont au
            // bureau n'est JAMAIS « en cours ».
            const enCours = taches.find((t) => (statutsAssignations || {})[`${t.id}|${courriel}`] === "en_cours" && !aDesHeures(t));
            const finies = taches.filter(aDesHeures).length;
            return { u, taches, enCours, finies, heuresDuJour };
          })
          .filter(Boolean);
        if (lignes.length === 0) return null;
        return (
          <div className="rounded-2xl border border-slate-200 bg-white md:hidden">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              👷 Aujourd&apos;hui sur le terrain
            </p>
            <div className="divide-y divide-slate-100">
              {lignes.map(({ u, taches, enCours, finies, heuresDuJour }) => (
                <button
                  key={u.id}
                  onClick={() => setOnglet("agenda")}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{u.nom}</span>
                    {enCours ? (
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-fuchsia-500" />
                        <span className="truncate text-[11px] font-semibold text-fuchsia-700">
                          {enCours.titre || enCours.clientNom}
                        </span>
                      </span>
                    ) : (
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                        {finies >= taches.length ? "journée terminée" : `${taches.length - finies} tâche${taches.length - finies > 1 ? "s" : ""} à faire`}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-extrabold tabular-nums text-slate-700">
                      {finies}/{taches.length}
                    </span>
                    {heuresDuJour > 0 && (
                      <span className="block text-[10px] tabular-nums text-slate-400">{heuresDuJour.toFixed(2)} h</span>
                    )}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* TUILES KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <button onClick={() => setOnglet("agenda")} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-400">Heures aujourd'hui</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-blue-700">{heuresAujourdhui.toFixed(1)} h</p>
          <p className="mt-1 text-[11px] text-blue-400">saisies par les techniciens</p>
        </button>
        <button
          onClick={() => setOnglet("inspections")}
          className={`rounded-2xl border p-4 text-left active:scale-[0.99] ${
            entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className={`text-[10px] font-extrabold uppercase tracking-wide ${entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "text-orange-500" : "text-slate-400"}`}>
            Entretiens camions
          </p>
          <p className={`mt-1 text-3xl font-extrabold tabular-nums ${entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "text-orange-600" : "text-[#131B2E]"}`}>
            {entretiensDus.length + (parcCamions || []).filter((c) => c.actif && camionIndisponible(c)).length}
          </p>
          <p className={`mt-1 truncate text-[11px] ${entretiensDus.length > 0 || (parcCamions || []).some((c) => c.actif && camionIndisponible(c)) ? "text-orange-500" : "text-slate-400"}`}>
            {[
              ...entretiensDus,
              ...(parcCamions || []).filter((c) => c.actif && camionIndisponible(c)).map((c) => `🔧 ${c.nom} indisponible`),
            ].join(", ") || "aucun entretien dû"}
          </p>
        </button>
        <button onClick={() => setOnglet("projets")} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-red-400">Projets à risque</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-red-600">{aRisque.length}</p>
          <p className="mt-1 text-[11px] text-red-400">dépassement ou en perte</p>
        </button>
        <button onClick={() => setOnglet("facturation")} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-500">Factures en attente</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-amber-700">{compteAlertes}</p>
          <p className="mt-1 text-[11px] text-amber-600">à émettre / réviser</p>
        </button>
        <button onClick={() => setOnglet("agenda")} className="rounded-2xl border border-slate-200 bg-white p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Tâches à planifier</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#131B2E]">{compteAttente}</p>
          <p className="mt-1 text-[11px] text-slate-400">non assignées</p>
        </button>
        <button onClick={() => setAnalyseOuverte(true)} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left active:scale-[0.99]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-500">Marge moyenne</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-700">{margeMoyenne.toFixed(0)}%</p>
          <p className="mt-1 text-[11px] text-emerald-600">projets actifs · cliquer pour l'analyse</p>
        </button>
      </div>

      {analyseOuverte && (
        <ModalAnalyseRentabilite
          analyse={analyse}
          travaux={travaux}
          bons={bons}
          devisListe={devisListe}
          inspections={inspections}
          achatsLibres={achatsLibres}
          transactionsQb={transactionsQb}
          clients={clients}
          onFermer={() => setAnalyseOuverte(false)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        {/* VISITES DE SOUMISSION SANS DEVIS
            ------------------------------------------------------------
            Une visite faite mais jamais chiffrée, c'est une vente qui
            s'éteint toute seule. Le rappel MONTE LE TON avec les jours :
            visible dès le premier, rouge après trois. Un client qui
            attend une semaine a souvent déjà appelé un concurrent. */}
        {(soumissionsSansDevis || []).length > 0 && (
          <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
              <FileText size={13} /> {soumissionsSansDevis.length} visite{soumissionsSansDevis.length > 1 ? "s" : ""} de soumission sans devis
            </h3>
            <div className="space-y-1.5">
              {soumissionsSansDevis.map((v) => {
                const urgent = v.jours >= 3;
                return (
                  <div
                    key={v.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      urgent ? "border-red-300 bg-red-50" : "border-indigo-200 bg-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800">{v.clientNom || v.titre}</p>
                      <p className="text-[10px] text-slate-500">Visite du {v.date}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        urgent ? "bg-red-500 text-white" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {v.jours === 0 ? "aujourd'hui" : `${v.jours} jour${v.jours > 1 ? "s" : ""}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-indigo-700">
              Ces visites disparaîtront d'ici dès qu'un devis sera créé pour le client.
            </p>
          </div>
        )}

        {/* PROJETS À SURVEILLER */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Projets à surveiller</h3>
          {aSurveiller.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">Aucun projet à risque — tout est au vert. 🎉</p>
          ) : (
            <div className="space-y-1">
              {aSurveiller.map(({ p, r, sante }) => (
                <button key={p.id} onClick={() => setOnglet("projets")} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sante.pastille}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{p.nom}</p>
                    <p className="truncate text-[11px] text-slate-400">{clients.find((c) => c.id === p.clientId)?.nom} · {p.statut}</p>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="mb-0.5 flex justify-between text-[9px] font-bold text-slate-400"><span>Budget</span><span className="tabular-nums">{r.pourcentageDepense.toFixed(0)}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`} style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }} />
                    </div>
                  </div>
                  <span className={`w-12 shrink-0 text-right text-sm font-extrabold tabular-nums ${sante.texte}`}>{r.pourcentageMarge.toFixed(0)}%</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ACTIVITÉ RÉCENTE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Activité récente</h3>
          {journal.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune activité pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {journal.slice(0, 6).map((e) => (
                <div key={e.id} className="flex gap-2 text-[12px] leading-snug text-slate-600">
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-300">{e.heure}</span>
                  <span className="min-w-0">{e.texte}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

