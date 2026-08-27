"use client";

// app/admin/ModalAnalyseRentabilite.jsx
//
// ANALYSE DE RENTABILITÉ (coûtant/réel/marge, 4 angles) — tranche T4 du
// découpage de page.jsx (2026-08-28). Extraction MÉCANIQUE.

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { bornesPeriodeAnalyse, dateISO, ITEMS_PAR_PAGE } from "./partage";

export function ModalAnalyseRentabilite({ analyse, travaux, bons, devisListe, inspections, achatsLibres = [], transactionsQb = [], clients = [], onFermer }) {
  // 🧾 DÉPENSES QUICKBOOKS RATTACHÉES (2026-08-26) — l'écran ne les
  // recevait même pas : un achat fait dans QuickBooks pour une job
  // n'apparaissait donc dans AUCUN coût ici, quoi qu'on fasse.
  // Indexées par tâche et par client pour être lues sans re-balayer
  // toute la liste à chaque ligne du tableau.
  // 🧾 NUMÉROS DE BC dont la FACTURE RÉELLE est arrivée dans QuickBooks
  // (par « No de référence » exact, ou noyée dans le mémo — cible.bc).
  // LA RÈGLE, la même que pour les projets : le montant QuickBooks fait
  // foi, l'estimation du BC ne compte plus. Sans cette garde, le Midea
  // à 4500 $ comptait 9000 $ dans le coût de la job dès que la facture
  // Descair entrait dans QuickBooks (double compte, corrigé 2026-08-26).
  const bcsFacturesQb = useMemo(() => {
    const set = new Set();
    (transactionsQb || []).forEach((t) => {
      if (t.type !== "EXPENSE" || !t.cible) return;
      const num = t.cible.bc || t.poNumber;
      if (num) set.add(String(num).trim().toUpperCase());
    });
    return set;
  }, [transactionsQb]);
  const depensesQbParTache = useMemo(() => {
    const m = new Map();
    (transactionsQb || []).forEach((t) => {
      if (t.type !== "EXPENSE" || t.cible?.type !== "tache") return;
      m.set(t.cible.id, (m.get(t.cible.id) || 0) + (Number(t.amountHT) || 0));
    });
    return m;
  }, [transactionsQb]);
  // Rattachée à un CLIENT (aucune job précise) : le coût appartient au
  // dossier, pas à une tâche — il s'ajoute au total du client.
  const depensesQbParClient = useMemo(() => {
    const m = new Map();
    (transactionsQb || []).forEach((t) => {
      if (t.type !== "EXPENSE" || t.cible?.type !== "client") return;
      const nom = (clients || []).find((c) => c.id === t.cible.id)?.nom || null;
      if (!nom) return;
      m.set(nom, (m.get(nom) || 0) + (Number(t.amountHT) || 0));
    });
    // 🧾 ACHATS (BC libres) rattachés DIRECTEMENT à un client (2026-08-26,
    // snippet 79) — même logique : le coût appartient au dossier. La part
    // attribuée fait foi ; sans elle, tout le montant. GARDE ANTI-DOUBLE
    // COMPTE : si la dépense QuickBooks portant ce numéro de BC est déjà
    // rattachée (au client ou ailleurs), c'est ELLE qui fait foi — le
    // montant réel de la facture plutôt que l'estimation du BC.
    (achatsLibres || []).forEach((a) => {
      if (a.tacheId || !a.clientId) return;
      if (a.numeroBc && bcsFacturesQb.has(String(a.numeroBc).trim().toUpperCase())) return;
      const nom = a.clientNom || (clients || []).find((c) => c.id === a.clientId)?.nom || null;
      if (!nom) return;
      const montant = a.montantAttribue != null ? a.montantAttribue : a.montantHT;
      m.set(nom, (m.get(nom) || 0) + (Number(montant) || 0));
    });
    return m;
  }, [transactionsQb, clients, achatsLibres]);
  const configEnt = useEntreprise();
  const seuil = Number(configEnt?.seuilMargeAlerte) || 25;
  const camionDefaut = Number(configEnt?.coutCamionHoraire) || 0;
  const [periode, setPeriode] = useState("mois");
  // Période personnalisée « du… au… » (demande du propriétaire).
  const [persoDu, setPersoDu] = useState(() => dateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [persoAu, setPersoAu] = useState(() => dateISO(new Date()));
  const [vueTaches, setVueTaches] = useState("taches");

  // Coût camion d'une ligne d'heures : l'inspection du matin fait foi
  // (camion réel + taux FIGÉ ce jour-là), passager = zéro.
  const coutCamionDe = (t) => {
    const insp = (inspections || []).find(
      (i) => i.date === t.date && !i.sansVehicule && !i.passagerDeNom &&
        (i.technicienEmail && t.employeEmail ? i.technicienEmail === t.employeEmail : i.technicienNom === t.employeNom)
    );
    if (!insp) return 0;
    return (Number(t.heures) || 0) * (insp.coutCamionHoraire != null ? insp.coutCamionHoraire : camionDefaut);
  };
  const coutMoDe = (t) => (Number(t.heures) || 0) * (Number(t.tauxCoutantFige) || 0);

  // ---- CALCULS D'UNE PÉRIODE (réutilisés pour la tendance) ----
  const calculerPeriode = (bornes) => {
    const dedans = (d) => d && d >= bornes.debut && d <= bornes.fin;
    const travauxPeriode = (travaux || []).filter((t) => t.supabase !== false && dedans(t.date));
    const facturable = travauxPeriode.filter((t) => (t.categorieHeures || "projet") === "projet");
    const invisible = travauxPeriode.filter((t) => t.categorieHeures === "administratif" || t.categorieHeures === "divers");
    const coutMo = facturable.reduce((s, t) => s + coutMoDe(t) + coutCamionDe(t), 0);
    const coutInvisible = invisible.reduce((s, t) => s + coutMoDe(t), 0);
    const heuresInvisibles = invisible.reduce((s, t) => s + (Number(t.heures) || 0), 0);
    const revenus = (bons || []).reduce(
      (s, b) => s + (b.facturesEmises || []).filter((f) => dedans(f.date)).reduce((x, f) => x + (Number(f.montant) || 0), 0),
      0
    );
    // 📦 MATÉRIEL ET ACHATS (2026-08-26) — ces tuiles n'en tenaient
    // aucun compte (« avant matériaux — QuickBooks : Phase 4 »), alors
    // que le tableau du bas les comptait déjà : le MÊME écran affichait
    // donc deux vérités, et la marge du haut était toujours trop belle.
    // Le stock posé sur les bons, les achats rattachés à une job et les
    // dépenses QuickBooks rattachées entrent maintenant dans le calcul.
    const bonsPeriode = (bons || []).filter((b) => dedans(b.date));
    const tachesPeriode = new Set(bonsPeriode.map((b) => b.tacheId).filter(Boolean));
    const coutStock = bonsPeriode.reduce(
      (s, b) => s + (b.materielStock || []).reduce((x, it) => x + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0),
      0
    );
    const coutAchats = (achatsLibres || [])
      .filter((a) => a.tacheId && tachesPeriode.has(a.tacheId))
      .reduce((s, a) => s + (a.montantAttribue != null ? a.montantAttribue : a.montantHT), 0);
    // Dépenses QuickBooks rattachées (tâche de la période, ou client) —
    // datées par QuickBooks, donc filtrées sur la même période.
    const coutQb = (transactionsQb || [])
      .filter((t) => t.type === "EXPENSE" && dedans(t.date))
      .filter((t) => (t.cible?.type === "tache" && tachesPeriode.has(t.cible.id)) || t.cible?.type === "client")
      .reduce((s, t) => s + (Number(t.amountHT) || 0), 0);
    const coutMateriaux = coutStock + coutAchats + coutQb;
    const margeOp = revenus > 0 ? ((revenus - coutMo - coutMateriaux) / revenus) * 100 : null;
    return { revenus, coutMo, coutMateriaux, coutInvisible, heuresInvisibles, margeOp, travauxPeriode };
  };

  const debutFiscal = configEnt?.debutAnneeFiscale || "01-01";
  const bornes =
    periode === "perso"
      ? { debut: persoDu || "0000-01-01", fin: persoAu || "9999-12-31" }
      : bornesPeriodeAnalyse(periode, debutFiscal);
  const stats = calculerPeriode(bornes);
  // 🔁 COMPARATIF « à pareille date l'an passé » : les MÊMES bornes,
  // reculées d'un an. Jamais 9 mois contre 12 — ça mentirait.
  const reculerUnAn = (d) => {
    const [a, m, j] = String(d).split("-").map(Number);
    return dateISO(new Date(a - 1, m - 1, j));
  };
  const statsAnPasse =
    periode === "tout" ? null : calculerPeriode({ debut: reculerUnAn(bornes.debut), fin: reculerUnAn(bornes.fin) });
  const aDesDonneesAnPasse = !!statsAnPasse && (statsAnPasse.revenus > 0 || statsAnPasse.coutMo > 0 || statsAnPasse.coutInvisible > 0);
  // 📈 TENDANCE — toujours mois courant vs mois dernier, peu importe la
  // période affichée : c'est un repère fixe.
  const moisCourant = calculerPeriode(bornesPeriodeAnalyse("mois"));
  const moisDernier = calculerPeriode(bornesPeriodeAnalyse("mois-1"));
  const tendance =
    moisCourant.margeOp == null || moisDernier.margeOp == null
      ? null
      : Math.round((moisCourant.margeOp - moisDernier.margeOp) * 10) / 10;

  // ---- 📐 ESTIMÉ vs RÉEL — par devis facturé ----
  const estimeVsReel = (() => {
    const parDevis = new Map();
    (bons || []).forEach((b) => {
      if (!b.devisNumero || !(b.facturesEmises || []).length) return;
      const e = parDevis.get(b.devisNumero) || { tacheIds: [], facture: 0 };
      e.tacheIds.push(b.tacheId);
      e.facture += (b.facturesEmises || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
      parDevis.set(b.devisNumero, e);
    });
    const lignes = [];
    parDevis.forEach((e, numero) => {
      const devis = (devisListe || []).find((d) => d.numero === numero);
      if (!devis) return;
      const vendant = (devis.lignes || []).reduce((s, l) => s + (Number(l.prix_vendant) || 0) * (Number(l.quantite) || 1), 0);
      const coutant = (devis.lignes || []).filter((l) => !l.estRabais).reduce((s, l) => s + (Number(l.prix_coutant) || 0) * (Number(l.quantite) || 1), 0);
      if (vendant <= 0) return;
      const margeEstimee = ((vendant - coutant) / vendant) * 100;
      // Réel : facturé − main-d'œuvre/camion réels − matériaux (coûtant
      // du devis, en attendant les vraies dépenses QuickBooks).
      const travauxDuDevis = (travaux || []).filter((t) => e.tacheIds.some((id) => id && String(t.tacheId || "").split("::")[0] === id));
      const coutMoReel = travauxDuDevis
        .filter((t) => (t.categorieHeures || "projet") === "projet")
        .reduce((s, t) => s + coutMoDe(t) + coutCamionDe(t), 0);
      const margeReelle = e.facture > 0 ? ((e.facture - coutMoReel - coutant) / e.facture) * 100 : null;
      if (margeReelle == null) return;
      lignes.push({
        numero,
        clientNom: devis.clientNom || "",
        facture: e.facture,
        margeEstimee,
        margeReelle,
        ecart: Math.round((margeReelle - margeEstimee) * 10) / 10,
      });
    });
    return lignes.sort((a, b) => a.ecart - b.ecart);
  })();

  // ---- 📋 PAR TÂCHE — coûtant / réel / marge, période choisie ----
  // Une ligne par TÂCHE terminée (les bons d'équipe se regroupent).
  // Coût réel = heures réelles × taux gelé + camion (inspection) +
  // matériel au coûtant du devis quand la tâche y est rattachée (le
  // matériel de stock est compté au niveau du PROJET, pas ici).
  const parTacheLignes = (() => {
    const dedans = (d) => d && d >= bornes.debut && d <= bornes.fin;
    const parId = new Map();
    (bons || []).forEach((b) => {
      if (!b.tacheId || !dedans(b.date)) return;
      const facture = (b.facturesEmises || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
      const e = parId.get(b.tacheId);
      if (e) { e.facture += facture; return; }
      parId.set(b.tacheId, { ...b, facture });
    });
    return [...parId.values()]
      .map((b) => {
        const lignesHeures = (travaux || []).filter(
          (t) => String(t.tacheId || "").split("::")[0] === b.tacheId && (t.categorieHeures || "projet") === "projet"
        );
        const heures = lignesHeures.reduce((s, t) => s + (Number(t.heures) || 0), 0);
        const coutMo = lignesHeures.reduce((s, t) => s + coutMoDe(t) + coutCamionDe(t), 0);
        const devisLie = b.devisNumero ? (devisListe || []).find((d) => d.numero === b.devisNumero) : null;
        const coutMateriel = devisLie
          ? (devisLie.lignes || []).filter((l) => !l.estRabais).reduce((s, l) => s + (Number(l.prix_coutant) || 0) * (Number(l.quantite) || 1), 0)
          : 0;
        // 📦 Matériel du stock (coût standard sur le bon) + 🧾 achats
        // rattachés à la tâche (part attribuée) — snippet 77.
        const coutStock = (b.materielStock || []).reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0);
        const coutAchats = (achatsLibres || [])
          .filter((a) => a.tacheId && a.tacheId === b.tacheId)
          // 🛡️ Facture réelle arrivée dans QuickBooks → SON montant fait
          // foi (compté via coutQb) — l'estimation du BC s'efface.
          .filter((a) => !(a.numeroBc && bcsFacturesQb.has(String(a.numeroBc).trim().toUpperCase())))
          .reduce((s, a) => s + (a.montantAttribue != null ? a.montantAttribue : a.montantHT), 0);
        // 🧾 Dépense QuickBooks rattachée À CETTE TÂCHE (2026-08-26).
        const coutQb = depensesQbParTache.get(b.tacheId) || 0;
        const cout = coutMo + coutMateriel + coutStock + coutAchats + coutQb;
        const marge = b.facture > 0 ? ((b.facture - cout) / b.facture) * 100 : null;
        const statutTexte =
          b.statutQb === "retire"
            ? b.retraitRaison === "client_maison" ? "🏠 Maison" : "🛡️ Garantie"
            : b.retraitStatut === "reporte"
              ? "🔄 Reporté"
              : b.statutQb === "envoye" || b.facture > 0 ? "Facturé" : "À facturer";
        return { cle: b.tacheId, nom: b.projet, clientNom: b.client, date: b.date, heures, facture: b.facture, cout, marge, statutTexte };
      })
      .sort((a, b2) => (a.date < b2.date ? 1 : -1));
  })();
  const totauxTaches = parTacheLignes.reduce((s, l) => ({ facture: s.facture + l.facture, cout: s.cout + l.cout }), { facture: 0, cout: 0 });
  const parTacheClients = (() => {
    const m = new Map();
    parTacheLignes.forEach((l) => {
      const e = m.get(l.clientNom) || { clientNom: l.clientNom, jobs: 0, facture: 0, cout: 0 };
      e.jobs += 1; e.facture += l.facture; e.cout += l.cout;
      m.set(l.clientNom, e);
    });
    // 👤 Coûts rattachés au CLIENT lui-même (dépenses QuickBooks + BC
    // libres, 2026-08-26) : ils s'ajoutent à sa ligne — et un client qui
    // n'a AUCUNE job facturée apparaît quand même, un coût sans revenu
    // est justement ce qu'il faut voir.
    depensesQbParClient.forEach((montant, nom) => {
      const e = m.get(nom) || { clientNom: nom, jobs: 0, facture: 0, cout: 0 };
      e.cout += montant;
      m.set(nom, e);
    });
    return [...m.values()]
      .map((e) => ({ ...e, marge: e.facture > 0 ? ((e.facture - e.cout) / e.facture) * 100 : null }))
      .sort((a, b2) => b2.facture - a.facture);
  })();

  // ---- 🏆 PAR JOB (tous projets avec du facturé) ----
  const jobs = (analyse || [])
    .filter((x) => (x.r.totalFactureReel || 0) > 0)
    .map((x) => ({
      nom: x.p.nom,
      clientNom: x.p.clientNom || "",
      facture: x.r.totalFactureReel,
      cout: x.r.coutTotalReel,
      profit: x.r.profitReel,
      marge: x.r.pourcentageMarge,
    }))
    .sort((a, b) => b.marge - a.marge);
  const top5 = jobs.slice(0, 5);
  const flop5 = jobs.slice(-5).reverse();

  // ---- PAR CLIENT (agrégat des jobs) ----
  const parClient = (() => {
    const m = new Map();
    jobs.forEach((j) => {
      const cle = j.clientNom || "Sans client";
      const e = m.get(cle) || { clientNom: cle, facture: 0, cout: 0, jobs: 0 };
      e.facture += j.facture;
      e.cout += j.cout;
      e.jobs += 1;
      m.set(cle, e);
    });
    // 🧾 Dépenses QuickBooks rattachées au CLIENT lui-même (pas à une
    // job précise) : elles s'ajoutent à son total. Un client qui n'a
    // aucune job facturée dans la période apparaît quand même — un coût
    // sans revenu est justement ce qu'il faut voir.
    depensesQbParClient.forEach((montant, nom) => {
      const e = m.get(nom) || { clientNom: nom, facture: 0, cout: 0, jobs: 0 };
      e.cout += montant;
      m.set(nom, e);
    });
    return [...m.values()]
      .map((e) => ({ ...e, profit: e.facture - e.cout, marge: e.facture > 0 ? ((e.facture - e.cout) / e.facture) * 100 : 0 }))
      .sort((a, b) => b.facture - a.facture);
  })();

  // ---- PAR TECHNICIEN (période choisie) ----
  const parTechnicien = (() => {
    const m = new Map();
    stats.travauxPeriode.forEach((t) => {
      const cle = t.employeNom || t.employeEmail || "—";
      const e = m.get(cle) || { nom: cle, chantier: 0, transport: 0, invisible: 0, cout: 0 };
      const h = Number(t.heures) || 0;
      if (t.categorieHeures === "administratif" || t.categorieHeures === "divers") e.invisible += h;
      else if (t.estTransport) e.transport += h;
      else e.chantier += h;
      e.cout += coutMoDe(t) + coutCamionDe(t);
      m.set(cle, e);
    });
    return [...m.values()]
      .map((e) => {
        const total = e.chantier + e.transport + e.invisible;
        return { ...e, total, pctFacturable: total > 0 ? ((e.chantier + e.transport) / total) * 100 : 0 };
      })
      .sort((a, b) => b.total - a.total);
  })();

  const classeMarge = (m) => (m == null ? "text-slate-400" : m < seuil ? "text-red-600" : "text-emerald-700");
  const fmt$ = (v) => `${(Number(v) || 0).toFixed(0)} $`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 md:p-6" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">📊 Analyse de rentabilité</h3>
            <p className="text-[11px] text-slate-400">
              Marge sous <span className="font-bold text-red-600">{seuil} %</span> = rouge (seuil réglable dans Paramètres)
              {(periode === "fiscale" || periode === "fiscale-1") && (
                <span className="ml-1 font-semibold text-slate-500">· du {bornes.debut} au {bornes.fin}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold">
              <option value="mois">Ce mois-ci</option>
              <option value="mois-1">Le mois dernier</option>
              <option value="trimestre">3 derniers mois</option>
              <option value="annee">Cette année (calendrier)</option>
              <option value="fiscale">Année fiscale en cours</option>
              <option value="fiscale-1">Année fiscale précédente</option>
              <option value="perso">Du… au… (personnalisée)</option>
              <option value="tout">Tout</option>
            </select>
            {periode === "perso" && (
              <>
                <input type="date" value={persoDu} onChange={(e) => setPersoDu(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                <input type="date" value={persoAu} onChange={(e) => setPersoAu(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </>
            )}
            <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
          </div>
        </div>

        {/* TUILES GLOBALES */}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Revenus facturés</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900">{fmt$(stats.revenus)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Main-d'œuvre + camion</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900">{fmt$(stats.coutMo)}</p>
            {stats.coutMateriaux > 0 && (
              <p className="text-[10px] text-slate-500">+ {fmt$(stats.coutMateriaux)} matériel et achats</p>
            )}
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
            <p className="text-[9px] font-extrabold uppercase text-purple-500">👻 Coût invisible</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums text-purple-700">{fmt$(stats.coutInvisible)}</p>
            <p className="text-[10px] text-purple-500">{stats.heuresInvisibles.toFixed(1)} h admin + divers</p>
          </div>
          <div className={`rounded-xl border p-3 ${stats.margeOp != null && stats.margeOp < seuil ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-[9px] font-extrabold uppercase text-slate-500">Marge opérationnelle</p>
            <p className={`mt-0.5 text-xl font-extrabold tabular-nums ${classeMarge(stats.margeOp)}`}>
              {stats.margeOp == null ? "—" : `${stats.margeOp.toFixed(0)} %`}
            </p>
            {tendance != null && (
              <p className={`text-[10px] font-bold ${tendance > 0.5 ? "text-emerald-600" : tendance < -0.5 ? "text-red-600" : "text-slate-400"}`}>
                {tendance > 0.5 ? "↗" : tendance < -0.5 ? "↘" : "→"} {tendance > 0 ? "+" : ""}{tendance} pts vs mois dernier
              </p>
            )}
            <p className="text-[9px] text-slate-400">
              {stats.coutMateriaux > 0
                ? "main-d'œuvre, camion, matériel et achats rattachés"
                : "aucun matériel ni achat rattaché à cette période"}
            </p>
          </div>
        </div>

        {/* 🔁 COMPARATIF vs L'AN PASSÉ — mêmes bornes, un an plus tôt */}
        {statsAnPasse && (
          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              🔁 Comparatif — à pareille date l'an passé
              <span className="ml-1 font-semibold normal-case text-slate-400">({reculerUnAn(bornes.debut)} → {reculerUnAn(bornes.fin)})</span>
            </p>
            {!aDesDonneesAnPasse ? (
              <p className="mt-2 text-xs text-slate-400">
                Aucune donnée pour cette période l'an passé — normal, l'application est jeune. Ce tableau prendra vie tout seul l'an prochain.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                    <th className="py-1 pr-2 font-semibold" /><th className="py-1 pr-2 text-right font-semibold">Cette période</th>
                    <th className="py-1 pr-2 text-right font-semibold">L'an passé</th><th className="py-1 text-right font-semibold">Écart</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ["Revenus facturés", stats.revenus, statsAnPasse.revenus, "$"],
                      ["Main-d'œuvre + camion", stats.coutMo, statsAnPasse.coutMo, "$"],
                      ["👻 Coût invisible", stats.coutInvisible, statsAnPasse.coutInvisible, "$"],
                      ["Marge opérationnelle", stats.margeOp, statsAnPasse.margeOp, "pts"],
                    ].map(([nom, courant, passe, unite]) => {
                      const ecart =
                        unite === "pts"
                          ? courant != null && passe != null
                            ? Math.round((courant - passe) * 10) / 10
                            : null
                          : passe > 0
                            ? Math.round(((courant - passe) / passe) * 1000) / 10
                            : null;
                      // Un coût qui MONTE est une mauvaise nouvelle — la
                      // couleur suit le sens d'affaires, pas le signe.
                      const bonneNouvelle = nom.includes("Revenus") || nom.includes("Marge") ? ecart > 0 : ecart < 0;
                      const affiche = (v) => (v == null ? "—" : unite === "pts" ? v.toFixed(0) + " %" : v.toFixed(0) + " $");
                      return (
                        <tr key={nom} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 pr-2 font-bold text-slate-800">{nom}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{affiche(courant)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">{affiche(passe)}</td>
                          <td className={"py-1.5 text-right font-extrabold tabular-nums " + (ecart == null ? "text-slate-300" : bonneNouvelle ? "text-emerald-600" : "text-red-600")}>
                            {ecart == null ? "—" : (ecart > 0 ? "↗ +" : ecart < 0 ? "↘ " : "→ ") + ecart + (unite === "pts" ? " pts" : " %")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 📐 ESTIMÉ vs RÉEL */}
        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">📐 Marge estimée vs réelle — par devis facturé</p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Réel = facturé − main-d'œuvre/camion réels − matériaux au coûtant du devis (vraies dépenses : Phase 4). L'écart t'améliore pour le prochain devis.
          </p>
          {estimeVsReel.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Aucun devis facturé pour l'instant — cette table se remplira toute seule.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                  <th className="py-1 pr-2 font-semibold">Devis</th><th className="py-1 pr-2 font-semibold">Client</th>
                  <th className="py-1 pr-2 text-right font-semibold">Facturé</th><th className="py-1 pr-2 text-right font-semibold">Estimée</th>
                  <th className="py-1 pr-2 text-right font-semibold">Réelle</th><th className="py-1 text-right font-semibold">Écart</th>
                </tr></thead>
                <tbody>
                  {estimeVsReel.map((l) => (
                    <tr key={l.numero} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 font-bold text-slate-800">{l.numero}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{l.clientNom}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(l.facture)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">{l.margeEstimee.toFixed(0)} %</td>
                      <td className={`py-1.5 pr-2 text-right font-bold tabular-nums ${classeMarge(l.margeReelle)}`}>{l.margeReelle.toFixed(0)} %</td>
                      <td className={`py-1.5 text-right font-extrabold tabular-nums ${l.ecart < -3 ? "text-red-600" : l.ecart > 3 ? "text-emerald-600" : "text-slate-400"}`}>
                        {l.ecart > 0 ? "+" : ""}{l.ecart} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 🏆 TOP / FLOP */}
        {jobs.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[["🏆 Top 5 — meilleures marges", top5], ["🚨 Flop 5 — pires marges", flop5]].map(([titre, liste]) => (
              <div key={titre} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{titre}</p>
                {liste.map((j) => (
                  <div key={j.nom} className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="font-bold text-slate-800">{j.nom}</span>
                      <span className="text-slate-400"> · {j.clientNom}</span>
                    </span>
                    <span className={`shrink-0 font-extrabold tabular-nums ${classeMarge(j.marge)}`}>{j.marge.toFixed(0)} %</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* PAR CLIENT */}
        {parClient.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Par client — pour qui travaille-t-on vraiment ?</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                  <th className="py-1 pr-2 font-semibold">Client</th><th className="py-1 pr-2 text-right font-semibold">Jobs</th>
                  <th className="py-1 pr-2 text-right font-semibold">Facturé</th><th className="py-1 pr-2 text-right font-semibold">Profit</th>
                  <th className="py-1 text-right font-semibold">Marge</th>
                </tr></thead>
                <tbody>
                  {parClient.map((c) => (
                    <tr key={c.clientNom} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 font-bold text-slate-800">{c.clientNom}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">{c.jobs}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(c.facture)}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold tabular-nums ${c.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmt$(c.profit)}</td>
                      <td className={`py-1.5 text-right font-extrabold tabular-nums ${classeMarge(c.marge)}`}>{c.marge.toFixed(0)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 📋 PAR TÂCHE / PAR CLIENT — coûtant, réel, marge (période choisie) */}
        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">📋 Coût réel &amp; marge — {vueTaches === "taches" ? "par tâche" : "par client"}</p>
            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-[11px] font-bold">
              <button onClick={() => setVueTaches("taches")} className={vueTaches === "taches" ? "bg-[#131B2E] px-2.5 py-1 text-white" : "px-2.5 py-1 text-slate-600"}>Par tâche</button>
              <button onClick={() => setVueTaches("clients")} className={vueTaches === "clients" ? "bg-[#131B2E] px-2.5 py-1 text-white" : "px-2.5 py-1 text-slate-600"}>Par client</button>
            </div>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Coût réel = heures réelles × taux gelé + camion (inspection du jour){vueTaches === "taches" ? " + matériel au coûtant du devis quand la tâche y est rattachée" : ""}.
            Les retraits (garantie, maison) et reports restent visibles : ils ont coûté même s'ils ne rapportent rien.
          </p>
          {parTacheLignes.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Aucune tâche terminée dans la période choisie.</p>
          ) : vueTaches === "taches" ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                  <th className="py-1 pr-2 font-semibold">Tâche</th><th className="py-1 pr-2 font-semibold">Date</th>
                  <th className="py-1 pr-2 font-semibold">Statut</th><th className="py-1 pr-2 text-right font-semibold">Heures</th>
                  <th className="py-1 pr-2 text-right font-semibold">Facturé</th><th className="py-1 pr-2 text-right font-semibold">Coût réel</th>
                  <th className="py-1 text-right font-semibold">Marge</th>
                </tr></thead>
                <tbody>
                  {parTacheLignes.map((l) => (
                    <tr key={l.cle} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="font-bold text-slate-800">{l.nom}</span>
                        <span className="block text-[10px] text-slate-400">{l.clientNom}</span>
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums text-slate-500">{l.date}</td>
                      <td className="py-1.5 pr-2 text-[10px] font-bold text-slate-500">{l.statutTexte}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{l.heures.toFixed(1)} h</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{l.facture > 0 ? fmt$(l.facture) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(l.cout)}</td>
                      <td className={`py-1.5 text-right font-extrabold tabular-nums ${classeMarge(l.marge)}`}>
                        {l.marge == null ? "—" : `${l.marge.toFixed(0)} %`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-300 font-extrabold text-slate-800">
                    <td className="py-1.5 pr-2" colSpan={4}>Total ({parTacheLignes.length} tâche{parTacheLignes.length > 1 ? "s" : ""})</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(totauxTaches.facture)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(totauxTaches.cout)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${classeMarge(totauxTaches.facture > 0 ? ((totauxTaches.facture - totauxTaches.cout) / totauxTaches.facture) * 100 : null)}`}>
                      {totauxTaches.facture > 0 ? `${(((totauxTaches.facture - totauxTaches.cout) / totauxTaches.facture) * 100).toFixed(0)} %` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                  <th className="py-1 pr-2 font-semibold">Client</th><th className="py-1 pr-2 text-right font-semibold">Tâches</th>
                  <th className="py-1 pr-2 text-right font-semibold">Facturé</th><th className="py-1 pr-2 text-right font-semibold">Coût réel</th>
                  <th className="py-1 pr-2 text-right font-semibold">Profit</th><th className="py-1 text-right font-semibold">Marge</th>
                </tr></thead>
                <tbody>
                  {parTacheClients.map((c) => (
                    <tr key={c.clientNom} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 font-bold text-slate-800">{c.clientNom || "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">{c.jobs}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{c.facture > 0 ? fmt$(c.facture) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(c.cout)}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold tabular-nums ${c.facture - c.cout < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmt$(c.facture - c.cout)}</td>
                      <td className={`py-1.5 text-right font-extrabold tabular-nums ${classeMarge(c.marge)}`}>{c.marge == null ? "—" : `${c.marge.toFixed(0)} %`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAR TECHNICIEN */}
        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Par technicien — où va le temps ({periode === "tout" ? "tout" : "période choisie"})</p>
          <p className="mt-0.5 text-[10px] text-amber-600">
            ⚠️ Un outil de répartition du travail, pas un palmarès : celui qu'on envoie sur les diagnostics difficiles aura l'air « moins facturable » — c'est peut-être ton meilleur.
          </p>
          {parTechnicien.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Aucune heure saisie dans la période.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                  <th className="py-1 pr-2 font-semibold">Technicien</th><th className="py-1 pr-2 text-right font-semibold">Chantier</th>
                  <th className="py-1 pr-2 text-right font-semibold">Transport</th><th className="py-1 pr-2 text-right font-semibold">👻 Admin/divers</th>
                  <th className="py-1 pr-2 text-right font-semibold">Coût (MO+camion)</th><th className="py-1 text-right font-semibold">% facturable</th>
                </tr></thead>
                <tbody>
                  {parTechnicien.map((t) => (
                    <tr key={t.nom} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 font-bold text-slate-800">{t.nom}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{t.chantier.toFixed(1)} h</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-slate-500">{t.transport.toFixed(1)} h</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-purple-600">{t.invisible.toFixed(1)} h</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt$(t.cout)}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums text-slate-700">{t.pctFacturable.toFixed(0)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

