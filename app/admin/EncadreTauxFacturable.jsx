"use client";

// app/admin/EncadreTauxFacturable.jsx
//
// 📊 « TAUX D'HEURES FACTURABLES » (2026-09-22, idée retenue par le
// propriétaire) — une barre par technicien : facturable / transport /
// non facturable, sur les 30 derniers jours ou la semaine en cours.
// Le détail des heures non facturables (pourquoi) s'ouvre au clic.
// Écran ADMIN seulement.
//
// 📋 2026-10-03 (demandes du propriétaire) : chaque catégorie du détail est
// une PASTILLE. La toucher ouvre une FENÊTRE (plein écran au téléphone)
// avec les tâches derrière le total — recherche, tri, CASES À COCHER et
// une seule barre d'action pour corriger plusieurs tâches d'un coup :
//   • 🤝 aide non facturable ↔ 💰 facturable (même interrupteur que
//     l'agenda et la révision de facture) ;
//   • administratif / shop-divers ↔ chantier (catégorie des heures).
// Garantie, visite de soumission, tâche non facturable : réglages de la
// TÂCHE entière — ils se corrigent dans sa fiche, pas ici. Courses,
// dîner, transport : jamais reclassés d'ici.
// Toujours une confirmation qui dit ce qui va changer (facture, coût).

import { useMemo, useState } from "react";
import { tauxFacturableParTechnicien } from "@/lib/tauxFacturable";
import { dateISO, dimancheDeSemaineISO, listeCellule } from "./partage";

const h = (n) => `${(Number(n) || 0).toFixed(1)} h`;
const dateCourte = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
// Lignes qui ne se reclassent jamais d'ici : courses internes, dîner, transport.
const estSpeciale = (base) => !base || /^(course-|lunch-|transport-)/.test(base);
const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const CLE_AIDE = "🤝 Aide non facturable";
const CATEGORIES_TACHE = ["Garantie", "Visite de soumission", "Tâche non facturable"];

// Les corrections : libellé du bouton et ce qu'elles changent.
const ACTIONS = {
  aide: {
    libelle: "🤝 Aide non facturable",
    effet: (nom) =>
      `${nom} passe en aide NON facturable sur ces tâches : son temps ne sera plus facturé au client (il reste compté dans le coût). Le réglage vaut pour toute la tâche, pas seulement la période affichée.`,
  },
  facturable: {
    libelle: "💰 Rendre facturable",
    effet: (nom) =>
      `${nom} redevient FACTURABLE sur ces tâches : son temps sera facturé au client. Le réglage vaut pour toute la tâche, pas seulement la période affichée.`,
  },
  chantier: {
    libelle: "Compter comme chantier",
    effet: () =>
      "Ces heures passent en CHANTIER : leur coût s'ajoute à la tâche (et à son projet) et elles comptent pour la facture. Dans « Heures de la semaine », seule la colonne change — le total payé reste le même.",
  },
  admin: {
    libelle: "Passer en administratif",
    effet: () =>
      "Ces heures passent en ADMINISTRATIF : leur coût sort de la tâche et du projet (frais général) et elles ne sont plus facturées. Dans « Heures de la semaine », seule la colonne change — le total payé reste le même.",
  },
};
const TEXTE_FACTURATION = {
  facturee: (n) => `${n} déjà facturée${n > 1 ? "s" : ""} : la facture envoyée ne change pas — seuls le rendement et le taux sont corrigés.`,
  retiree: (n) => `${n} retirée${n > 1 ? "s" : ""} de la facturation : rien ne sera facturé — le rendement et le taux sont corrigés.`,
  a_facturer: (n) => `${n} pas encore facturée${n > 1 ? "s" : ""} : la révision de la facture en tiendra compte (si elle est déjà validée, rouvre-la pour revoir le montant).`,
  sans_bon: (n) => `${n} sans bon à facturer pour l'instant : la correction comptera quand il arrivera.`,
};

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
  const [fenetre, setFenetre] = useState(null); // { email, cle } — fenêtre des tâches
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
  // sans tâche cliente, se regroupe par titre).
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
    return [...m.values()];
  };
  // Où en est la facturation de la tâche — dit dans la confirmation.
  const etatFacturation = (base) => {
    const siens = (bons || []).filter((b) => String(b.tacheId || "").split("::")[0] === base);
    if (siens.some((b) => b.statutQb === "envoye" || (b.facturesEmises || []).length > 0)) return "facturee";
    if (siens.length > 0 && siens.every((b) => b.statutQb === "retire")) return "retiree";
    if (siens.length > 0) return "a_facturer";
    return "sans_bon";
  };
  // Corrections permises pour une tâche, selon la catégorie de la pastille.
  const actionsPour = (r, cle, g) => {
    if (!peutCorriger || estSpeciale(g.base)) return [];
    const assignee = facturables[`${g.base}|${r.email}`] !== undefined; // l'interrupteur 💰/🤝 existe pour lui
    if (cle === "facturable") {
      return [...(assignee && onBasculerFacturable ? ["aide"] : []), ...(onReclasserHeures ? ["admin"] : [])];
    }
    if (cle === CLE_AIDE) return assignee && onBasculerFacturable ? ["facturable"] : [];
    if (cle === "Administratif" || cle === "Shop / divers") return onReclasserHeures ? ["chantier"] : [];
    return [];
  };
  const executerUne = async (r, cle, action, g) => {
    const infos = { nom: r.nom, titre: g.titre, heures: g.heures };
    if (action === "aide" || action === "facturable") {
      await onBasculerFacturable(g.base, r.email, action === "facturable", infos);
    } else {
      await onReclasserHeures(g.lignes, action === "chantier" ? "projet" : "administratif", {
        ...infos,
        projetId: action === "chantier" ? g.tache?.projetId || null : null,
        depuis: cle,
      });
    }
  };
  const changerPeriode = (v) => {
    setPeriode(v);
    setFenetre(null);
  };
  const rangFenetre = fenetre ? rangs.find((x) => x.email === fenetre.email) : null;

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
          return (
            <div key={r.email}>
              <button type="button" onClick={() => setOuvert(ouvert === r.email ? null : r.email)} className="w-full text-left">
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
                  <div className="flex flex-wrap gap-1.5">
                    {pastillesDe(r).map((p) => (
                      <button
                        key={p.cle}
                        type="button"
                        onClick={() => setFenetre({ email: r.email, cle: p.cle })}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums ${p.ton}`}
                      >
                        {p.libelle} {h(p.heures)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">Touche une catégorie pour voir ses tâches{peutCorriger ? " et corriger un classement" : ""}.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Heures PAYÉES (dîner et journées bloquées exclus). 🟢 chantier facturable · 🔵 transport (refacturé en partie seulement) · 🟠 administratif, shop, garantie, visites de soumission, aide 🤝 non facturable. Clique un nom pour le détail.
      </p>

      {fenetre && rangFenetre && (
        <FenetreTaches
          rang={rangFenetre}
          cle={fenetre.cle}
          libelle={
            (pastillesDe(rangFenetre).find((p) => p.cle === fenetre.cle) || {}).libelle ||
            ({ facturable: "🟢 Facturable", transport: "🔵 Transport" }[fenetre.cle] ?? (fenetre.cle === CLE_AIDE ? CLE_AIDE : `🟠 ${fenetre.cle}`))
          }
          periodeTexte={periode === "semaine" ? "cette semaine" : "30 derniers jours"}
          groupes={groupesDe(rangFenetre, fenetre.cle)}
          actionsDe={(g) => actionsPour(rangFenetre, fenetre.cle, g)}
          etatDe={(g) => etatFacturation(g.base)}
          peutCorriger={peutCorriger}
          onExecuter={(action, g) => executerUne(rangFenetre, fenetre.cle, action, g)}
          onFermer={() => setFenetre(null)}
        />
      )}
    </div>
  );
}

// Les pastilles d'un technicien (catégories non vides).
function pastillesDe(r) {
  return [
    { cle: "facturable", libelle: "🟢 Facturable", heures: r.facturable, ton: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    { cle: "transport", libelle: "🔵 Transport", heures: r.transport, ton: "border-sky-200 bg-sky-50 text-sky-800" },
    ...Object.entries(r.raisons)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ cle: k, libelle: k === CLE_AIDE ? k : `🟠 ${k}`, heures: v, ton: "border-amber-200 bg-amber-50 text-amber-800" })),
  ].filter((p) => p.heures > 0.04);
}

// ============================================================
// 🪟 FENÊTRE DES TÂCHES D'UNE CATÉGORIE — recherche, tri, cases à
// cocher, une barre d'action, une confirmation pour tout le lot.
// ============================================================
function FenetreTaches({ rang, cle, libelle, periodeTexte, groupes, actionsDe, etatDe, peutCorriger, onExecuter, onFermer }) {
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("heures"); // heures | date
  const [coches, setCoches] = useState(() => new Set());
  const [confirmation, setConfirmation] = useState(null); // action en attente de confirmation
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState(null); // { fait, total }
  const [message, setMessage] = useState(null); // { ton, texte }

  const totalHeures = groupes.reduce((s, g) => s + g.heures, 0);
  const q = sansAccents(recherche.trim());
  const visibles = groupes
    .filter((g) => !q || sansAccents(`${g.titre} ${g.client} ${[...g.dates].map(dateCourte).join(" ")}`).includes(q))
    .sort((a, b) => (tri === "date" ? [...b.dates].sort().pop().localeCompare([...a.dates].sort().pop()) : b.heures - a.heures));
  const corrigeables = visibles.filter((g) => actionsDe(g).length > 0);
  // Seules les tâches encore présentes comptent (une tâche corrigée quitte la catégorie).
  const cochesActives = groupes.filter((g) => coches.has(g.cle));
  const actionsOffertes = [...new Set(cochesActives.flatMap((g) => actionsDe(g)))];
  const pourAction = (action) => cochesActives.filter((g) => actionsDe(g).includes(action));
  const toutCoche = corrigeables.length > 0 && corrigeables.every((g) => coches.has(g.cle));

  const basculer = (k) =>
    setCoches((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const fermer = () => {
    if (!enCours) onFermer();
  };
  const executer = async () => {
    const action = confirmation;
    const lot = pourAction(action);
    if (!action || lot.length === 0 || enCours) return;
    setEnCours(true);
    setMessage(null);
    setProgression({ fait: 0, total: lot.length });
    let fait = 0;
    for (const g of lot) {
      try {
        await onExecuter(action, g);
        fait += 1;
        setProgression({ fait, total: lot.length });
        setCoches((prev) => {
          const n = new Set(prev);
          n.delete(g.cle);
          return n;
        });
      } catch (e) {
        setMessage({
          ton: "erreur",
          texte: `${fait > 0 ? `${fait} tâche${fait > 1 ? "s" : ""} corrigée${fait > 1 ? "s" : ""}, puis ` : ""}échec sur « ${g.titre} » : ${e?.message || "erreur"}. Les tâches restantes sont toujours cochées — réessaie.`,
        });
        setEnCours(false);
        setConfirmation(null);
        setProgression(null);
        return;
      }
    }
    setMessage({ ton: "succes", texte: `✅ ${fait} tâche${fait > 1 ? "s" : ""} corrigée${fait > 1 ? "s" : ""} — chaque correction est notée au journal.` });
    setEnCours(false);
    setConfirmation(null);
    setProgression(null);
  };

  // Résumé de la confirmation : tâches, heures, état de facturation.
  const resumeConfirmation = () => {
    const lot = pourAction(confirmation);
    const heures = lot.reduce((s, g) => s + g.heures, 0);
    const parEtat = {};
    lot.forEach((g) => {
      const e = etatDe(g);
      parEtat[e] = (parEtat[e] || 0) + 1;
    });
    return { lot, heures, parEtat };
  };

  return (
    <div
      className="fenetre-mobile fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) fermer();
      }}
    >
      <div className="panneau-mobile flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 pb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900">
              {rang.nom} — {libelle}
            </h3>
            <p className="text-xs text-slate-500">
              {groupes.length} tâche{groupes.length > 1 ? "s" : ""} · {h(totalHeures)} · {periodeTexte}
            </p>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Recherche + tri */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher une tâche, un client, une date…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-base outline-none focus:border-[#131B2E] sm:text-xs"
          />
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {[["heures", "Heures"], ["date", "Date"]].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTri(v)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${tri === v ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {CATEGORIES_TACHE.includes(cle) && (
            <p className="mb-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
              Réglage de la tâche entière — il se corrige dans sa fiche (agenda), pas ici.
            </p>
          )}
          {peutCorriger && corrigeables.length > 0 && (
            <label className="mb-1 flex cursor-pointer items-center gap-2 py-1 text-[11px] font-bold text-slate-600">
              <input
                type="checkbox"
                checked={toutCoche}
                onChange={() =>
                  setCoches((prev) => {
                    const n = new Set(prev);
                    if (toutCoche) corrigeables.forEach((g) => n.delete(g.cle));
                    else corrigeables.forEach((g) => n.add(g.cle));
                    return n;
                  })
                }
                className="h-4 w-4 accent-[#131B2E]"
              />
              Tout cocher{q ? " (résultats affichés)" : ""}
            </label>
          )}
          {visibles.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">{groupes.length === 0 ? "Plus rien dans cette catégorie." : "Aucune tâche ne correspond."}</p>
          )}
          <div className="divide-y divide-slate-100">
            {visibles.map((g) => {
              const peut = actionsDe(g).length > 0;
              const dates = [...g.dates].sort();
              const contenu = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-slate-700">
                      <span className="font-bold text-slate-800">{g.titre}</span>
                      {g.client && <span className="text-slate-500"> · {g.client}</span>}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {dates.length === 1 ? dateCourte(dates[0]) : `${dates.length} jours : ${dateCourte(dates[0])} → ${dateCourte(dates[dates.length - 1])}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-slate-800">{h(g.heures)}</span>
                </>
              );
              return peut ? (
                <label key={g.cle} className={`flex cursor-pointer items-start gap-2.5 py-2 ${coches.has(g.cle) ? "bg-blue-50/60" : ""}`}>
                  <input
                    type="checkbox"
                    checked={coches.has(g.cle)}
                    onChange={() => basculer(g.cle)}
                    disabled={enCours}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
                  />
                  {contenu}
                </label>
              ) : (
                <div key={g.cle} className="flex items-start gap-2.5 py-2">
                  {peutCorriger && <span className="mt-0.5 h-4 w-4 shrink-0" />}
                  {contenu}
                </div>
              );
            })}
          </div>
        </div>

        {/* Barre d'action / confirmation */}
        {(message || cochesActives.length > 0) && (
          <div className="border-t border-slate-200 bg-white px-4 py-3">
            {message && (
              <p className={`mb-2 text-[11px] font-semibold leading-snug ${message.ton === "erreur" ? "text-red-700" : "text-emerald-700"}`}>
                {message.ton === "erreur" ? "⚠️ " : ""}
                {message.texte}
              </p>
            )}
            {cochesActives.length > 0 && !confirmation && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">
                  {cochesActives.length} cochée{cochesActives.length > 1 ? "s" : ""} :
                </span>
                {actionsOffertes.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setConfirmation(a);
                      setMessage(null);
                    }}
                    className="rounded-lg bg-[#131B2E] px-3 py-1.5 text-[11px] font-extrabold text-white"
                  >
                    {ACTIONS[a].libelle} — {pourAction(a).length} tâche{pourAction(a).length > 1 ? "s" : ""}
                  </button>
                ))}
                <button type="button" onClick={() => setCoches(new Set())} className="text-[11px] font-bold text-slate-400 underline">
                  Tout décocher
                </button>
              </div>
            )}
            {confirmation &&
              (() => {
                const { lot, heures, parEtat } = resumeConfirmation();
                return (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                    <p className="text-[12px] font-extrabold text-slate-800">
                      {ACTIONS[confirmation].libelle} — {lot.length} tâche{lot.length > 1 ? "s" : ""} · {h(heures)} de {rang.nom}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-slate-700">{ACTIONS[confirmation].effet(rang.nom)}</p>
                    <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-slate-600">
                      {Object.entries(parEtat).map(([etat, n]) => (
                        <li key={etat}>• {TEXTE_FACTURATION[etat](n)}</li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={executer}
                        disabled={enCours}
                        className="rounded-lg bg-[#131B2E] px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-60"
                      >
                        {enCours && progression ? `Correction… ${progression.fait}/${progression.total}` : "Confirmer la correction"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmation(null)}
                        disabled={enCours}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    </div>
  );
}
