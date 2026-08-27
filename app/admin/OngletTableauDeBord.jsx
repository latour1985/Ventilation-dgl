"use client";

// app/admin/OngletTableauDeBord.jsx
//
// TABLEAU DE BORD (accueil, vue d'ensemble du jour) — tranche T12b du
// decoupage de page.jsx (2026-09-01). Extraction MECANIQUE : aucun
// comportement ne change — seuls des export/import s'ajoutent.

import { useEffect, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { listerRetoursEntreprise, majRetour, sAbonnerRetours, LIBELLES_STATUT_RETOUR, COURRIEL_PLATEFORME } from "@/lib/supabase/retours";
import { envoyerCourriel } from "@/lib/courriels";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { camionIndisponible } from "@/lib/supabase/camions";
import { ModalAnalyseRentabilite } from "./ModalAnalyseRentabilite";
import { calculerRentabiliteProjet, camionsEntretienDu, cleTacheDesHeures, couleurSanteBudget, estMetierBureau, evaluerSanteProjet, tachesDuJourPourEmploye, todayISO } from "./partage";

export function OngletTableauDeBord({ projets, travaux, transactionsQb, utilisateurs, tauxMetiers, clients, compteAlertes, compteAttente, journal, setOnglet, inspections, entretiens, soumissionsSansDevis, bons, devisListe, parcCamions, planning, statutsAssignations, achatsLibres = [], nomAdmin, ajouterJournal }) {
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

      {/* 💬 RETOURS DE L'ÉQUIPE — 2e étage du circuit (2026-09-02) : les
          signalements des techniciens arrivent ICI ; l'admin trie —
          réglé à l'interne, refusé, ou TRANSMIS à Fluxya. */}
      <SectionRetoursEquipe nomAdmin={nomAdmin} ajouterJournal={ajouterJournal} />

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


// ============================================================
// 💬 RETOURS DE L'ÉQUIPE (2026-09-02) — le TRIAGE de l'admin.
// ------------------------------------------------------------
// Circuit en 2 étages validé par le propriétaire : le technicien
// signale à SON bureau ; l'admin trie ici — « Réglé à l'interne »
// (formation, malentendu — mort là), « Refuser » (avec un mot), ou
// « ➡️ Transmettre à Fluxya » (vrai bug / bonne idée, avec son
// commentaire par-dessus). La console plateforme ne reçoit QUE le
// transmis — Fluxya n'a jamais à filtrer l'insignifiant. Le statut
// revient au technicien sur son bouton 💬.
// ============================================================
function SectionRetoursEquipe({ nomAdmin, ajouterJournal }) {
  const [retours, setRetours] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [reponses, setReponses] = useState({});
  useEffect(() => {
    const charger = () => listerRetoursEntreprise().then(setRetours).catch(() => {});
    charger();
    return sAbonnerRetours(charger);
  }, []);
  const nouveaux = retours.filter((r) => r.statut === "nouveau");
  const enSuivi = retours.filter((r) => ["transmis", "en-cours", "regle", "refuse"].includes(r.statut));
  if (retours.length === 0) return null;

  const agir = async (r, statut) => {
    const mot = (reponses[r.id] || "").trim();
    try {
      if (statut === "transmis") {
        await majRetour(r.id, { statut: "transmis", transmisPar: nomAdmin || null, commentaireTransmission: mot });
        ajouterJournal?.(`➡️ Retour de ${r.auteurNom || r.auteurEmail} (${r.type === "idee" ? "idée" : "bug"}) TRANSMIS à Fluxya${mot ? ` — « ${mot} »` : ""}.`);
        // Avis au fabricant — fire-and-forget : l'échec du courriel ne
        // bloque jamais la transmission (la console la voit de toute façon).
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

  return (
    <div className={`rounded-2xl border p-3 ${nouveaux.length > 0 ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <button onClick={() => setOuvert(!ouvert)} className="flex w-full items-center justify-between text-left">
        <p className={`text-xs font-extrabold uppercase tracking-wide ${nouveaux.length > 0 ? "text-blue-700" : "text-slate-500"}`}>
          💬 Retours de l&apos;équipe{nouveaux.length > 0 ? ` — ${nouveaux.length} à trier` : ""}
        </p>
        <span className="text-[11px] font-bold text-slate-400">{ouvert ? "▲ Replier" : "▼ Ouvrir"}</span>
      </button>
      {!ouvert && nouveaux.length === 0 && (
        <p className="mt-0.5 text-[10px] text-slate-400">Signalements et idées des techniciens — tout est trié.</p>
      )}
      {(ouvert || nouveaux.length > 0) && (
        <div className="mt-2 space-y-1.5">
          {(ouvert ? retours : nouveaux).slice(0, ouvert ? 30 : 5).map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold text-slate-800">
                    {r.type === "idee" ? "💡" : "🐛"} {r.auteurNom || r.auteurEmail}
                    <span className="ml-1.5 font-normal text-slate-400">{r.creeLe ? new Date(r.creeLe).toLocaleDateString("fr-CA") : ""}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-slate-700">{r.message}</p>
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
              {r.statut === "nouveau" && (
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
          ))}
          {!ouvert && enSuivi.length > 0 && (
            <p className="text-[10px] text-slate-400">+ {enSuivi.length} en suivi chez Fluxya — clique « Ouvrir » pour tout voir.</p>
          )}
        </div>
      )}
    </div>
  );
}
