"use client";

// app/admin/EncadreTauxFacturable.jsx
//
// 📊 « TAUX D'HEURES FACTURABLES » (2026-09-22, idée retenue par le
// propriétaire) — une barre par technicien : facturable / transport /
// non facturable, sur les 30 derniers jours ou la semaine en cours.
// Le détail des heures non facturables (pourquoi) s'ouvre au clic.
// Écran ADMIN seulement.
//
// 📋 2026-10-03 (demande du propriétaire) : chaque catégorie du détail est
// une PASTILLE — on la touche pour voir les TÂCHES derrière le total, et
// on CORRIGE une erreur de classement sur place :
//   • 🤝 aide non facturable ↔ 💰 facturable (même interrupteur que
//     l'agenda et la révision de facture) ;
//   • administratif / shop-divers ↔ chantier (catégorie des heures).
// Garantie, visite de soumission, tâche non facturable : réglages de la
// TÂCHE entière — ils se corrigent dans sa fiche, pas ici.
// Toujours une confirmation qui dit ce qui va changer (facture, coût).

import { useMemo, useState } from "react";
import { tauxFacturableParTechnicien } from "@/lib/tauxFacturable";
import { dateISO, dimancheDeSemaineISO, listeCellule } from "./partage";

const h = (n) => `${(Number(n) || 0).toFixed(1)} h`;
const dateCourte = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
// Lignes qui ne se reclassent jamais d'ici : courses internes, dîner, transport.
const estSpeciale = (base) => !base || /^(course-|lunch-|transport-)/.test(base);
const CLE_AIDE = "🤝 Aide non facturable";

export function EncadreTauxFacturable({
  travaux = [],
  planning = {},
  tachesAttente = [],
  facturables = {},
  bons = [],
  peutCorriger = false,
  onBasculerFacturable = null,
  onReclasserHeures = null,
}) {
  const [periode, setPeriode] = useState("30j"); // 30j | semaine
  const [ouvert, setOuvert] = useState(null); // courriel dont le détail est ouvert
  const [categorieOuverte, setCategorieOuverte] = useState(null); // pastille touchée
  const [confirmation, setConfirmation] = useState(null); // correction à confirmer
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const aujourdhui = dateISO(new Date());
  const debut = periode === "semaine" ? dimancheDeSemaineISO(new Date()) : dateISO(new Date(Date.now() - 29 * 86400000));
  const tachesParId = useMemo(() => {
    const m = new Map();
    Object.values(planning || {}).forEach((c) => listeCellule(c).forEach((t) => { if (t?.id && !m.has(String(t.id))) m.set(String(t.id), t); }));
    (tachesAttente || []).forEach((t) => { if (t?.id && !m.has(String(t.id))) m.set(String(t.id), t); });
    return m;
  }, [planning, tachesAttente]);
  const rangs = useMemo(
    () => tauxFacturableParTechnicien({ travaux, tacheParId: (id) => tachesParId.get(String(id)) || null, facturables, debutISO: debut, finISO: aujourdhui }),
    [travaux, tachesParId, facturables, debut, aujourdhui]
  );
  const equipe = rangs.reduce((s, r) => ({ facturable: s.facturable + r.facturable, total: s.total + r.total }), { facturable: 0, total: 0 });
  if (rangs.length === 0) return null;

  // Les tâches derrière une catégorie : une ligne par tâche (le transport,
  // sans tâche cliente, se regroupe par titre), la plus grosse en premier.
  const groupesDe = (r, cle) => {
    const m = new Map();
    r.lignes
      .filter((x) => x.categorie === cle)
      .forEach((x) => {
        const k = cle === "transport" ? x.ligne.titre || "Transport" : x.base || x.ligne.titre || "?";
        const g =
          m.get(k) ||
          {
            cle: k,
            base: x.base,
            tache: x.tache,
            titre: (cle === "transport" ? x.ligne.titre : x.tache?.titre || x.ligne.titre) || x.tache?.clientNom || "Travail",
            client: cle === "transport" ? "" : x.tache?.clientNom || x.ligne.clientNom || "",
            heures: 0,
            dates: new Set(),
            lignes: [],
          };
        g.heures += x.heures;
        g.dates.add(x.ligne.date);
        g.lignes.push(x.ligne);
        m.set(k, g);
      });
    return [...m.values()].sort((a, b) => b.heures - a.heures);
  };
  const datesTexte = (dates) => {
    const liste = [...dates].sort();
    if (liste.length === 1) return dateCourte(liste[0]);
    return `${liste.length} jours : ${dateCourte(liste[0])} → ${dateCourte(liste[liste.length - 1])}`;
  };
  // Où en est la facturation de la tâche — dit dans la confirmation.
  const etatFacturation = (base) => {
    const siens = (bons || []).filter((b) => String(b.tacheId || "").split("::")[0] === base);
    if (siens.some((b) => b.statutQb === "envoye" || (b.facturesEmises || []).length > 0)) return "facturee";
    if (siens.length > 0 && siens.every((b) => b.statutQb === "retire")) return "retiree";
    if (siens.length > 0) return "a_facturer";
    return "sans_bon";
  };
  const TEXTE_FACTURATION = {
    facturee: "⚠️ Tâche déjà facturée : la facture envoyée ne change pas — seuls le rendement et le taux sont corrigés.",
    retiree: "Tâche retirée de la facturation : rien ne sera facturé — le rendement et le taux sont corrigés.",
    a_facturer: "Tâche pas encore facturée : la révision de la facture en tiendra compte (si elle est déjà validée, rouvre-la pour revoir le montant).",
    sans_bon: "Pas encore de bon à facturer pour cette tâche : la correction comptera quand il arrivera.",
  };
  // Corrections offertes selon la catégorie de la pastille.
  const actionsPour = (r, cle, g) => {
    if (!peutCorriger || estSpeciale(g.base)) return [];
    const assignee = facturables[`${g.base}|${r.email}`] !== undefined; // l'interrupteur 💰/🤝 existe pour lui
    if (cle === "facturable") {
      return [
        ...(assignee && onBasculerFacturable ? [{ id: "aide", libelle: "🤝 Aide non facturable" }] : []),
        ...(onReclasserHeures ? [{ id: "admin", libelle: "Passer en administratif" }] : []),
      ];
    }
    if (cle === CLE_AIDE) return assignee && onBasculerFacturable ? [{ id: "facturable", libelle: "💰 Rendre facturable" }] : [];
    if (cle === "Administratif" || cle === "Shop / divers") return onReclasserHeures ? [{ id: "chantier", libelle: "Compter comme chantier" }] : [];
    return [];
  };
  const messageConfirmation = (c) => {
    const qui = `les ${h(c.groupe.heures)} de ${c.nom} sur « ${c.groupe.titre} »`;
    const Qui = `${qui.charAt(0).toUpperCase()}${qui.slice(1)}`;
    const lignesPaie = "Dans « Heures de la semaine », seule la colonne change — le total payé reste le même.";
    if (c.action === "aide")
      return [`🤝 ${Qui} : ${c.nom} passe en aide NON facturable sur cette tâche — son temps ne sera plus facturé au client (il reste compté dans le coût).`, "Le réglage vaut pour toute la tâche, pas seulement la période affichée."];
    if (c.action === "facturable")
      return [`💰 ${Qui} : ${c.nom} redevient FACTURABLE sur cette tâche — son temps sera facturé au client.`, "Le réglage vaut pour toute la tâche, pas seulement la période affichée."];
    if (c.action === "chantier")
      return [
        `${Qui} passeront en CHANTIER : leur coût s'ajoute à la tâche${c.groupe.tache?.projetId ? " et à son projet" : ""} et elles comptent pour la facture.`,
        `${c.groupe.lignes.length} ligne${c.groupe.lignes.length > 1 ? "s" : ""} d'heures de la période affichée. ${lignesPaie}`,
      ];
    return [
      `${Qui} passeront en ADMINISTRATIF : leur coût sort de la tâche et du projet (frais général) et elles ne sont plus facturées.`,
      `${c.groupe.lignes.length} ligne${c.groupe.lignes.length > 1 ? "s" : ""} d'heures de la période affichée. ${lignesPaie}`,
    ];
  };
  const executer = async () => {
    const c = confirmation;
    if (!c || enCours) return;
    setEnCours(true);
    setErreur("");
    try {
      const infos = { nom: c.nom, titre: c.groupe.titre, heures: c.groupe.heures };
      if (c.action === "aide" || c.action === "facturable") {
        await onBasculerFacturable(c.groupe.base, c.email, c.action === "facturable", infos);
      } else {
        await onReclasserHeures(c.groupe.lignes, c.action === "chantier" ? "projet" : "administratif", {
          ...infos,
          projetId: c.action === "chantier" ? c.groupe.tache?.projetId || null : null,
          depuis: c.cle,
        });
      }
      setConfirmation(null);
    } catch (e) {
      setErreur(e?.message || "Correction impossible — réessaie.");
    }
    setEnCours(false);
  };
  const changerPeriode = (v) => {
    setPeriode(v);
    setCategorieOuverte(null);
    setConfirmation(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          📊 Heures facturables{" "}
          <span className="normal-case text-slate-400">
            — équipe : <span className="font-extrabold text-slate-700">{equipe.total > 0 ? Math.round((equipe.facturable / equipe.total) * 100) : 0} %</span>
          </span>
        </h3>
        <div className="flex gap-1">
          {[["30j", "30 jours"], ["semaine", "Cette semaine"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => changerPeriode(v)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${periode === v ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-600"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {rangs.map((r) => {
          const pct = (x) => (r.total > 0 ? (x / r.total) * 100 : 0);
          const taux = Math.round(r.taux * 100);
          const pastilles = [
            { cle: "facturable", libelle: "🟢 Facturable", heures: r.facturable, ton: "border-emerald-200 bg-emerald-50 text-emerald-800", actif: "bg-emerald-600 text-white border-emerald-600" },
            { cle: "transport", libelle: "🔵 Transport", heures: r.transport, ton: "border-sky-200 bg-sky-50 text-sky-800", actif: "bg-sky-600 text-white border-sky-600" },
            ...Object.entries(r.raisons)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({ cle: k, libelle: k === CLE_AIDE ? k : `🟠 ${k}`, heures: v, ton: "border-amber-200 bg-amber-50 text-amber-800", actif: "bg-amber-500 text-white border-amber-500" })),
          ].filter((p) => p.heures > 0.04);
          const cleOuverte = ouvert === r.email ? categorieOuverte : null;
          return (
            <div key={r.email}>
              <button
                type="button"
                onClick={() => {
                  setOuvert(ouvert === r.email ? null : r.email);
                  setCategorieOuverte(null);
                  setConfirmation(null);
                  setErreur("");
                }}
                className="w-full text-left"
              >
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="font-bold text-slate-800">{r.nom}</span>
                  <span className="tabular-nums text-slate-500">
                    <span className={`font-extrabold ${taux >= 75 ? "text-emerald-700" : taux >= 55 ? "text-amber-700" : "text-red-700"}`}>{taux} %</span> · {h(r.facturable)} / {h(r.total)}
                  </span>
                </div>
                <div className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${pct(r.facturable)}%` }} title={`Facturable : ${h(r.facturable)}`} />
                  <div className="bg-sky-300" style={{ width: `${pct(r.transport)}%` }} title={`Transport : ${h(r.transport)}`} />
                  <div className="bg-amber-400" style={{ width: `${pct(r.nonFacturable)}%` }} title={`Non facturable : ${h(r.nonFacturable)}`} />
                </div>
              </button>
              {ouvert === r.email && (
                <div className="mt-1.5 rounded-lg bg-slate-50 p-2">
                  {/* Les pastilles : on touche pour voir les tâches. */}
                  <div className="flex flex-wrap gap-1.5">
                    {pastilles.map((p) => (
                      <button
                        key={p.cle}
                        type="button"
                        onClick={() => {
                          setCategorieOuverte(cleOuverte === p.cle ? null : p.cle);
                          setConfirmation(null);
                          setErreur("");
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums ${cleOuverte === p.cle ? p.actif : p.ton}`}
                      >
                        {p.libelle} {h(p.heures)}
                      </button>
                    ))}
                  </div>
                  {!cleOuverte && <p className="mt-1.5 text-[10px] text-slate-400">Touche une catégorie pour voir ses tâches.</p>}
                  {cleOuverte && (
                    <div className="mt-2 space-y-1.5">
                      {groupesDe(r, cleOuverte).map((g) => {
                        const actions = actionsPour(r, cleOuverte, g);
                        const enConfirmation = confirmation && confirmation.email === r.email && confirmation.groupe.cle === g.cle && confirmation.cle === cleOuverte;
                        return (
                          <div key={g.cle} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                              <p className="min-w-0 text-[11px] text-slate-700">
                                <span className="font-bold text-slate-800">{g.titre}</span>
                                {g.client && <span className="text-slate-500"> · {g.client}</span>}
                              </p>
                              <p className="text-[11px] font-extrabold tabular-nums text-slate-800">{h(g.heures)}</p>
                            </div>
                            <p className="text-[10px] text-slate-400">{datesTexte(g.dates)}</p>
                            {!enConfirmation && actions.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {actions.map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => {
                                      setConfirmation({ email: r.email, nom: r.nom, cle: cleOuverte, groupe: g, action: a.id });
                                      setErreur("");
                                    }}
                                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                                  >
                                    {a.libelle}
                                  </button>
                                ))}
                              </div>
                            )}
                            {!enConfirmation && actions.length === 0 && peutCorriger && ["Garantie", "Visite de soumission", "Tâche non facturable"].includes(cleOuverte) && (
                              <p className="mt-1 text-[10px] italic text-slate-400">Réglage de la tâche entière — se corrige dans sa fiche (agenda).</p>
                            )}
                            {enConfirmation && (
                              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
                                {messageConfirmation(confirmation).map((ligne, i) => (
                                  <p key={i} className={`text-[11px] leading-snug ${i === 0 ? "font-semibold text-slate-800" : "mt-1 text-slate-600"}`}>
                                    {ligne}
                                  </p>
                                ))}
                                <p className="mt-1 text-[11px] leading-snug text-slate-600">{TEXTE_FACTURATION[etatFacturation(g.base)]}</p>
                                {erreur && <p className="mt-1 text-[11px] font-bold text-red-700">⚠️ {erreur}</p>}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={executer}
                                    disabled={enCours}
                                    className="rounded-lg bg-[#131B2E] px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-60"
                                  >
                                    {enCours ? "Correction…" : "Confirmer la correction"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmation(null);
                                      setErreur("");
                                    }}
                                    disabled={enCours}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {groupesDe(r, cleOuverte).length === 0 && (
                        <p className="text-[10px] text-slate-400">Plus rien dans cette catégorie — la correction a été appliquée.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Heures PAYÉES (dîner et journées bloquées exclus). 🟢 chantier facturable · 🔵 transport (refacturé en partie seulement) · 🟠 administratif, shop, garantie, visites de soumission, aide 🤝 non facturable. Clique un nom pour le détail
        {peutCorriger ? ", puis une catégorie pour voir ses tâches et corriger un classement." : "."}
      </p>
    </div>
  );
}
