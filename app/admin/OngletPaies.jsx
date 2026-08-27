"use client";

// app/admin/OngletPaies.jsx
//
// HEURES DE LA SEMAINE (paies) — tranche T1 du découpage de page.jsx
// (2026-08-28). Extraction MÉCANIQUE : aucun comportement ne change,
// le code est déplacé tel quel — seuls des export/import s'ajoutent.

import React, { useState, useRef, useEffect } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, Pencil, Phone } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { joursBloques, cleJour } from "@/lib/supabase/travauxEffectues";
import { HEURES, dateISO, ajouterJours, dimancheDeSemaineISO, ITEMS_PAR_PAGE, Button, DefilementHorizontal } from "./partage";

// ============================================================
// TABLEAU DE BORD (accueil — vue d'ensemble)
// ============================================================
// ============================================================
// ONGLET PAIES — compilation des heures par technicien, par
// semaine de paie (DIMANCHE à SAMEDI, hebdomadaire — choix du
// propriétaire). Source : travaux_effectues (heures réellement
// enregistrées par les techniciens au bouton « Terminer »).
// Heures seulement — AUCUN montant de salaire ici.
// ============================================================
export function OngletPaies({ travaux, utilisateurs, droitHeures, onAjusterPlan, onValiderGroupe, onRefuserGroupe, onDebloquerJournee, projets }) {
  // Journée dont on demande le déblocage (fenêtre de confirmation).
  const [deblocageDemande, setDeblocageDemande] = useState(null);
  // Détail des heures administratives d'un employé (quelles visites,
  // chez quel client, sur quel projet).
  const [detailAdmin, setDetailAdmin] = useState(null);
  // Avertissement avant de copier une paie incomplète (journée bloquée).
  const [avertissementPaieOuvert, setAvertissementPaieOuvert] = useState(false);
  // Règles de paie lues dans les Paramètres de l'entreprise (seuil des
  // heures supplémentaires, heure de bascule « Nuit ») — plus codées en
  // dur, pour qu'un changement de convention se règle dans l'écran.
  const configEnt = useEntreprise();
  const seuilSupp = Number(configEnt.seuilHeuresSupp) || 40;
  const heureNuit = Number(configEnt.heureBasculeNuit) || 16;
  // Ligne en cours d'édition dans le résumé d'une journée — on corrige
  // les HEURES DE DÉBUT/FIN (plus naturel que la durée) : { id, debut,
  // fin } au format HH:MM. Admins = effet immédiat, répartiteur =
  // proposition groupée à valider.
  const [editionLigne, setEditionLigne] = useState(null);
  const [erreurEdition, setErreurEdition] = useState("");
  // Dimanche de la semaine affichée (navigation ± 7 jours).
  const [dimancheAffiche, setDimancheAffiche] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // getDay() : 0 = dimanche
    return d;
  });
  const [detailEmail, setDetailEmail] = useState(null);
  // Détail d'une JOURNÉE précise : { email, iso } — ouvert au clic sur
  // la cellule d'un jour (le clic sur le NOM montre toute la semaine).
  const [detailJour, setDetailJour] = useState(null);
  const [copie, setCopie] = useState(false);

  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(dimancheAffiche, i));
  const isoJours = jours.map(dateISO);
  const debutISO = isoJours[0];
  const finISO = isoJours[6];

  // Heures réelles de la semaine — seules les lignes portant un courriel
  // d'employé comptent (celles envoyées par l'app technicien).
  const lignesSemaineBrutes = (travaux || []).filter((t) => t.employeEmail && t.date >= debutISO && t.date <= finISO);

  // JOURNÉES BLOQUÉES (chrono oublié fermé automatiquement) — la journée
  // entière du technicien sort de TOUS les totaux tant qu'un
  // administrateur ne l'a pas débloquée. Les lignes existent toujours
  // (on les montre dans le détail), elles ne sont simplement pas
  // comptées : aucune heure douteuse n'entre dans une paie.
  const bloques = joursBloques(travaux);
  const estBloque = (email, date) => bloques.has(cleJour(email, date));
  const lignesSemaine = lignesSemaineBrutes.filter((t) => !estBloque(t.employeEmail, t.date));
  // Résumé pour la bannière d'alerte : une entrée par journée bloquée.
  const journeesBloquees = [];
  lignesSemaineBrutes.forEach((t) => {
    if (!estBloque(t.employeEmail, t.date)) return;
    const cle = cleJour(t.employeEmail, t.date);
    if (journeesBloquees.some((j) => j.cle === cle)) return;
    journeesBloquees.push({
      cle,
      email: t.employeEmail,
      date: t.date,
      raison: (lignesSemaineBrutes.find((x) => x.jourBloque && cleJour(x.employeEmail, x.date) === cle) || {}).bloqueRaison || "",
    });
  });
  // Trois catégories SÉPARÉES : chantier, transport début/fin de journée,
  // et transport journalier (déplacements entre deux tâches).
  // La détection reconnaît les TROIS noms successifs de cette tâche —
  // « Transport journalier » et les anciens « Transport durant la
  // journée » / « Transport CCQ » — pour que les heures déjà
  // enregistrées sous un ancien nom continuent de compter.
  const estCcq = (t) => t.estTransport && /ccq|durant la journée|journalier/i.test(t.titre || "");
  // Dîner non payé : ligne de −30 min envoyée quand le technicien coche
  // « Lunch » avant son transport de fin de journée.
  const estLunch = (t) => !t.estTransport && /dîner|diner|lunch/i.test(t.titre || "");

  const heureLocaleDe = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // CLASSIFICATION DE LA JOURNÉE d'un technicien (règle validée) :
  // - SAM/DIM : tout le travail du samedi et du dimanche (prime sur tout) ;
  // - NUIT (lun-ven) : la PREMIÈRE intervention réelle du jour démarre à
  //   16 h 00 ou plus tard → toute la journée est classée Nuit ;
  // - JOUR : le reste — y compris un travail commencé avant 16 h qui se
  //   prolonge en soirée (simple prolongation), et les anciennes lignes
  //   sans heure de début réelle (complétées avant la capture).
  const classificationJournee = (lignesDuJour, iso) => {
    const js = new Date(`${iso}T00:00:00`).getDay();
    if (js === 0 || js === 6) return "weekend";
    const debuts = (lignesDuJour || []).filter((l) => l.debutReel && !estLunch(l)).map((l) => new Date(l.debutReel).getTime());
    if (debuts.length === 0) return "jour";
    return new Date(Math.min(...debuts)).getHours() >= heureNuit ? "nuit" : "jour";
  };

  // PLAN D'AJUSTEMENT par heures de début/fin : la journée reste une
  // ligne continue — déplacer une frontière réalloue le temps au voisin
  // (il gagne ce que la ligne cède, et inversement). Exceptions : un
  // voisin à 0 h (chrono oublié) n'est jamais touché, et un changement en
  // bordure de journée ajoute/retire du temps net. La durée de la ligne
  // bouge par DELTAS (les pauses du technicien restent respectées).
  const planAjustement = (travail, debutStr, finStr, lignesJour) => {
    const date = travail.date;
    const nouveauDebut = new Date(`${date}T${debutStr}:00`);
    const nouvelleFin = new Date(`${date}T${finStr}:00`);
    if (+nouvelleFin === +nouveauDebut) return { erreur: "La fin doit être différente du début." };
    // 🌙 PASSE MINUIT (bogue vécu 2026-08-19 : journée bloquée 11:26 →
    // 03:26 — « OK » refusait « la fin doit être après le début » et le
    // message s'affichait sous toute la liste : l'admin ne voyait rien
    // se passer). Une fin PLUS PETITE que le début veut dire « le
    // lendemain », exactement comme le chrono l'a vécu — la durée
    // s'affiche en direct à côté des champs, pas de surprise.
    if (nouvelleFin < nouveauDebut) nouvelleFin.setDate(nouvelleFin.getDate() + 1);
    const ISO = (d) => d.toISOString();
    // Ligne sans heures réelles enregistrées (complétée avant la capture) :
    // édition simple — durée = fin − début, aucun voisin touché.
    if (!travail.debutReel || !travail.finReelle) {
      const heures = Math.round(((nouvelleFin - nouveauDebut) / 3600000) * 100) / 100;
      return { ajustements: [{ travail, heures, debutReel: ISO(nouveauDebut), finReelle: ISO(nouvelleFin) }], apercu: [] };
    }
    const ancienDebut = new Date(travail.debutReel);
    const ancienneFin = new Date(travail.finReelle);
    const deltaDebut = (ancienDebut - nouveauDebut) / 3600000; // + = commence plus tôt
    const deltaFin = (nouvelleFin - ancienneFin) / 3600000; // + = finit plus tard
    const heuresLigne = Math.round(((Number(travail.heures) || 0) + deltaDebut + deltaFin) * 100) / 100;
    if (heuresLigne <= 0) return { erreur: "La correction rendrait cette ligne à 0 h ou moins." };
    const ajustements = [{ travail, heures: heuresLigne, debutReel: ISO(nouveauDebut), finReelle: ISO(nouvelleFin) }];
    const apercu = [];
    const chronologie = lignesJour
      .filter((l) => l.debutReel && l.finReelle && !estLunch(l))
      .sort((a, b) => new Date(a.debutReel) - new Date(b.debutReel));
    const idx = chronologie.findIndex((l) => l.id === travail.id);
    const prec = idx > 0 ? chronologie[idx - 1] : null;
    const suiv = idx >= 0 && idx < chronologie.length - 1 ? chronologie[idx + 1] : null;
    if (Math.abs(deltaDebut) > 0.004 && prec && (Number(prec.heures) || 0) > 0) {
      const h = Math.round(((Number(prec.heures) || 0) - deltaDebut) * 100) / 100;
      if (h <= 0) return { erreur: `Impossible : « ${prec.titre} » tomberait à ${h.toFixed(2)} h. Ajuste-la d'abord.` };
      ajustements.push({ travail: prec, heures: h, finReelle: ISO(nouveauDebut) });
      apercu.push(`« ${prec.titre} » : ${(Number(prec.heures) || 0).toFixed(2)} h → ${h.toFixed(2)} h`);
    }
    if (Math.abs(deltaFin) > 0.004 && suiv && (Number(suiv.heures) || 0) > 0) {
      const h = Math.round(((Number(suiv.heures) || 0) - deltaFin) * 100) / 100;
      if (h <= 0) return { erreur: `Impossible : « ${suiv.titre} » tomberait à ${h.toFixed(2)} h. Ajuste-la d'abord.` };
      ajustements.push({ travail: suiv, heures: h, debutReel: ISO(nouvelleFin) });
      apercu.push(`« ${suiv.titre} » : ${(Number(suiv.heures) || 0).toFixed(2)} h → ${h.toFixed(2)} h`);
    }
    return { ajustements, apercu };
  };
  const parEmploye = {};
  lignesSemaine.forEach((t) => {
    const cle = t.employeEmail.toLowerCase();
    const e = (parEmploye[cle] = parEmploye[cle] || { email: cle, parJour: {}, chantier: 0, transport: 0, transportCcq: 0, administratif: 0, divers: 0, diner: 0, nuit: 0, weekend: 0, report: 0, reportDetails: [], total: 0, residentiel: 0, residentielChantier: 0, residentielTransport: 0, details: [] });
    const h = Number(t.heures) || 0;
    e.parJour[t.date] = (e.parJour[t.date] || 0) + h;
    // ADMINISTRATIF et DIVERS passent AVANT le classement habituel :
    // ce sont des heures payées, mais qui ne sont ni du chantier ni du
    // transport. Sans ce test en premier, une visite de soumission
    // serait comptée comme du chantier et gonflerait un coût de projet.
    const cat = t.categorieHeures || "projet";
    if (estLunch(t)) e.diner += h;
    else if (cat === "administratif") e.administratif += h;
    else if (cat === "divers") e.divers += h;
    else if (estCcq(t)) e.transportCcq += h;
    else if (t.estTransport) e.transport += h;
    else e.chantier += h;
    // SECTEUR RÉSIDENTIEL — cumul séparé (chantier + transports) : la
    // paie doit savoir combien d'heures payer au taux résidentiel.
    // Les heures administratives/divers ne sont d'aucun secteur.
    if (t.secteur === "residentiel" && cat === "projet" && !estLunch(t)) {
      e.residentiel += h;
      // Détail chantier vs transport — les deux cellules du tableau
      // affichent chacune leur part résidentielle.
      if (t.estTransport) e.residentielTransport += h;
      else e.residentielChantier += h;
    }
    e.total += h;
    e.details.push(t);
  });
  // TOUTE L'ÉQUIPE apparaît — même les techniciens à 0 h cette semaine :
  // chaque personne du répertoire ayant un courriel a sa ligne. On voit
  // ainsi d'un coup d'œil qui n'a pas d'heures enregistrées.
  (utilisateurs || []).forEach((u) => {
    const cle = (u.courriel || "").toLowerCase();
    if (!cle || parEmploye[cle]) return;
    parEmploye[cle] = { email: cle, parJour: {}, chantier: 0, transport: 0, transportCcq: 0, administratif: 0, divers: 0, diner: 0, nuit: 0, weekend: 0, report: 0, reportDetails: [], total: 0, residentiel: 0, residentielChantier: 0, residentielTransport: 0, details: [] };
  });
  // REPORT ± : corrections TARDIVES validées PENDANT la semaine affichée
  // mais portant sur des lignes de semaines ANTÉRIEURES — la différence
  // (heures corrigées − heures d'avant) s'ajoute à la paie de cette
  // semaine, sans rouvrir la semaine déjà payée.
  (travaux || []).forEach((t) => {
    if (!t.supabase || !t.employeEmail || !t.corrigeLe || t.heuresAvantCorrection == null) return;
    if (dimancheDeSemaineISO(t.corrigeLe) !== debutISO) return; // report ∈ semaine affichée
    if (!(t.date < debutISO)) return; // la ligne vient bien d'une semaine antérieure
    const delta = Math.round(((Number(t.heures) || 0) - (Number(t.heuresAvantCorrection) || 0)) * 100) / 100;
    if (Math.abs(delta) < 0.005) return;
    const cle = t.employeEmail.toLowerCase();
    const e = (parEmploye[cle] = parEmploye[cle] || { email: cle, parJour: {}, chantier: 0, transport: 0, transportCcq: 0, administratif: 0, divers: 0, diner: 0, nuit: 0, weekend: 0, report: 0, reportDetails: [], total: 0, details: [] });
    e.report += delta;
    e.reportDetails.push({ titre: t.titre, date: t.date, delta });
  });
  // NUIT / SAM-DIM : classification PAR JOURNÉE (voir classificationJournee),
  // sommée en net (dîner inclus) — le reste des heures est du JOUR.
  Object.values(parEmploye).forEach((e) => {
    const parDate = {};
    e.details.forEach((t) => {
      (parDate[t.date] = parDate[t.date] || []).push(t);
    });
    Object.entries(parDate).forEach(([iso, lignes]) => {
      const classe = classificationJournee(lignes, iso);
      if (classe === "jour") return;
      const somme = lignes.reduce((s, t) => s + (Number(t.heures) || 0), 0);
      if (classe === "nuit") e.nuit += somme;
      else e.weekend += somme;
    });
  });
  const nomPour = (email, repli) =>
    (utilisateurs || []).find((u) => (u.courriel || "").toLowerCase() === email)?.nom || repli || email.split("@")[0];
  // Normes du travail (Québec) : au-delà de 40 h/semaine = heures
  // supplémentaires (taux et demi) — on sépare les deux totaux.
  const employesSemaine = Object.values(parEmploye)
    .map((e) => ({
      ...e,
      nom: nomPour(e.email, e.details[0]?.employeNom),
      regulieres: Math.min(e.total, seuilSupp),
      supplementaires: Math.max(0, e.total - seuilSupp),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  const labelSemaine = `du ${jours[0].toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} au ${jours[6].toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;

  // TOTAUX DE LA SEMAINE (toute l'équipe) — une ligne de compilation en
  // bas du tableau : chaque jour, chaque catégorie, et le grand total.
  const totauxEquipe = employesSemaine.reduce(
    (acc, e) => {
      isoJours.forEach((iso) => {
        if (e.parJour[iso]) acc.parJour[iso] = (acc.parJour[iso] || 0) + e.parJour[iso];
      });
      acc.chantier += e.chantier;
      acc.transport += e.transport;
      acc.transportCcq += e.transportCcq;
      acc.administratif += e.administratif;
      acc.divers += e.divers;
      acc.diner += e.diner;
      acc.nuit += e.nuit;
      acc.weekend += e.weekend;
      acc.report += e.report;
      acc.total += e.total;
      return acc;
    },
    { parJour: {}, chantier: 0, transport: 0, transportCcq: 0, administratif: 0, divers: 0, diner: 0, nuit: 0, weekend: 0, report: 0, total: 0 }
  );

  // 🕐 HORLOGE STANDARD (demande du propriétaire, 2026-08-19) : à
  // l'écran « 1 h 22 » se lit mieux que « 1.37 h ». L'export « Copier
  // pour la paie », lui, garde les DÉCIMALES — c'est ce que les
  // logiciels de paie attendent.
  const hM = (h) => {
    const totalMin = Math.round(Math.abs(Number(h) || 0) * 60);
    return `${Number(h) < 0 ? "-" : ""}${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, "0")}`;
  };
  // COLONNES VIDES MASQUÉES (2026-08-19) : la moitié des colonnes
  // n'affichait que des « — ». Une colonne n'apparaît que si au moins
  // un technicien y a des heures cette semaine. (Chantier, Transport et
  // TOTAL restent toujours là.)
  const colVisibles = {
    ccq: Math.abs(totauxEquipe.transportCcq) > 0.004,
    admin: Math.abs(totauxEquipe.administratif) > 0.004,
    divers: Math.abs(totauxEquipe.divers) > 0.004,
    diner: Math.abs(totauxEquipe.diner) > 0.004,
    nuit: Math.abs(totauxEquipe.nuit) > 0.004,
    weekend: Math.abs(totauxEquipe.weekend) > 0.004,
    report: Math.abs(totauxEquipe.report) > 0.004,
  };
  const nbColonnes = 11 + Object.values(colVisibles).filter(Boolean).length;

  // Copie le tableau en format tabulé — prêt à coller dans Excel ou
  // dans le logiciel de paie.
  // EXPORT DE PAIE — refuse de copier en SILENCE s'il reste une journée
  // bloquée dans la semaine. Sans ce garde-fou, l'admin copierait une
  // paie amputée d'une journée sans s'en rendre compte, et le technicien
  // découvrirait le manque sur son chèque. On avertit, on n'interdit pas.
  const copierPourLaPaie = (confirme = false) => {
    if (journeesBloquees.length > 0 && !confirme) {
      setAvertissementPaieOuvert(true);
      return;
    }
    const enTete = ["Technicien", ...jours.map((j) => j.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric" })), "Chantier", "dont Résidentiel", "Transport", "Transport journalier", "Administratif", "Divers", "Dîner", "Nuit", "Sam/Dim", "Report ±", "Régulières", `Supplémentaires (>${seuilSupp} h)`, "TOTAL À PAYER"].join("\t");
    const corps = employesSemaine
      .map((e) =>
        [
          e.nom,
          ...isoJours.map((iso) => (e.parJour[iso] ? e.parJour[iso].toFixed(2) : "")),
          e.chantier.toFixed(2),
          (e.residentiel || 0).toFixed(2),
          e.transport.toFixed(2),
          e.transportCcq.toFixed(2),
          e.administratif.toFixed(2),
          e.divers.toFixed(2),
          e.diner !== 0 ? e.diner.toFixed(2) : "",
          e.nuit !== 0 ? e.nuit.toFixed(2) : "",
          e.weekend !== 0 ? e.weekend.toFixed(2) : "",
          e.report !== 0 ? e.report.toFixed(2) : "",
          e.regulieres.toFixed(2),
          e.supplementaires > 0 ? e.supplementaires.toFixed(2) : "",
          (e.total + e.report).toFixed(2),
        ].join("\t")
      )
      .join("\n");
    const ligneTotaux = [
      "TOTAL ÉQUIPE",
      ...isoJours.map((iso) => (totauxEquipe.parJour[iso] ? totauxEquipe.parJour[iso].toFixed(2) : "")),
      totauxEquipe.chantier.toFixed(2),
      (totauxEquipe.residentiel || 0).toFixed(2),
      totauxEquipe.transport.toFixed(2),
      totauxEquipe.transportCcq.toFixed(2),
      totauxEquipe.administratif.toFixed(2),
      totauxEquipe.divers.toFixed(2),
      totauxEquipe.diner !== 0 ? totauxEquipe.diner.toFixed(2) : "",
      totauxEquipe.nuit !== 0 ? totauxEquipe.nuit.toFixed(2) : "",
      totauxEquipe.weekend !== 0 ? totauxEquipe.weekend.toFixed(2) : "",
      totauxEquipe.report !== 0 ? totauxEquipe.report.toFixed(2) : "",
      "",
      "",
      (totauxEquipe.total + totauxEquipe.report).toFixed(2),
    ].join("\t");
    navigator.clipboard
      ?.writeText(`Semaine de paie ${labelSemaine} (${debutISO} au ${finISO})\n${enTete}\n${corps}\n${ligneTotaux}`)
      .then(() => {
        setCopie(true);
        setTimeout(() => setCopie(false), 2500);
      })
      .catch(() => {});
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Heures de la semaine</h2>
          <p className="text-xs text-slate-400">Semaine de paie du dimanche au samedi · heures réelles enregistrées par les techniciens</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDimancheAffiche(ajouterJours(dimancheAffiche, -7))} aria-label="Semaine précédente" className="rounded-lg border border-slate-200 p-1.5"><ChevronLeft size={16} /></button>
          {/* Largeur fixe : les flèches ne bougent jamais (même règle que l'agenda). */}
          <span className="min-w-[190px] text-center text-sm font-extrabold text-slate-800">{labelSemaine}</span>
          <button onClick={() => setDimancheAffiche(ajouterJours(dimancheAffiche, 7))} aria-label="Semaine suivante" className="rounded-lg border border-slate-200 p-1.5"><ChevronRight size={16} /></button>
          <button
            onClick={() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); setDimancheAffiche(d); }}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600"
          >
            Cette semaine
          </button>
        </div>
      </div>

      {/* JOURNÉES BLOQUÉES — chrono oublié fermé automatiquement. Rouge
          et en premier : ces heures ne sont dans AUCUN total, donc le
          technicien n'est pas payé pour cette journée tant que ce n'est
          pas réglé. La marche à suivre est écrite dans la bannière —
          appeler, corriger, débloquer — pour qu'aucun admin n'ait à
          deviner quoi faire. */}
      {journeesBloquees.length > 0 && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-red-700">
            🔒 {journeesBloquees.length} journée{journeesBloquees.length > 1 ? "s" : ""} bloquée{journeesBloquees.length > 1 ? "s" : ""} — non comptée{journeesBloquees.length > 1 ? "s" : ""} dans la paie
          </p>
          <div className="mt-2 space-y-1.5">
            {journeesBloquees.map((j) => {
              const u = (utilisateurs || []).find((x) => (x.courriel || "").toLowerCase() === j.email);
              const labelDate = new Date(`${j.date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
              return (
                <div key={j.cle} className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800">
                      {nomPour(j.email)} — <span className="capitalize">{labelDate}</span>
                    </p>
                    <p className="text-[11px] text-slate-600">{j.raison}</p>
                    {u?.telephone ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-red-700">
                        <Phone size={11} className="shrink-0" /> {u.telephone}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      1. Appelle-le pour son heure de fin réelle · 2. Corrige ses heures en cliquant la cellule du jour · 3. Débloque.
                    </p>
                  </div>
                  {droitHeures === "direct" ? (
                    <Button
                      variant="outline"
                      onClick={() => setDeblocageDemande(j)}
                      className="min-h-0 px-3 py-1.5 text-[11px]"
                    >
                      🔓 Débloquer
                    </Button>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">Déblocage réservé aux administrateurs</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONFIRMATION DU DÉBLOCAGE — geste volontaire : on ne veut pas
          qu'un clic distrait remette des heures fausses dans la paie. */}
      {deblocageDemande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setDeblocageDemande(null))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={18} className="text-amber-600" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Débloquer cette journée ?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  As-tu bien <span className="font-bold">corrigé les heures</span> de {nomPour(deblocageDemande.email)} après
                  l&apos;avoir appelé ? Une fois débloquée, cette journée <span className="font-bold">compte dans la paie</span> avec
                  les heures actuellement enregistrées.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDeblocageDemande(null)} className="min-h-0 py-2 text-xs">Annuler</Button>
              <Button
                onClick={() => {
                  const j = deblocageDemande;
                  setDeblocageDemande(null);
                  onDebloquerJournee?.(j.email, j.date);
                }}
                className="min-h-0 py-2 text-xs"
              >
                Oui, débloquer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AVERTISSEMENT AVANT DE COPIER UNE PAIE INCOMPLÈTE */}
      {avertissementPaieOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setAvertissementPaieOuvert(false))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={18} className="text-red-600" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {journeesBloquees.length} journée{journeesBloquees.length > 1 ? "s" : ""} n&apos;{journeesBloquees.length > 1 ? "" : "est"}
                  {journeesBloquees.length > 1 ? "sont pas incluses" : " pas incluse"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Ces journées sont <span className="font-bold">bloquées</span> (chrono oublié) et ne comptent dans aucun total.
                  Si tu copies maintenant, {journeesBloquees.length > 1 ? "ces techniciens seront" : "ce technicien sera"} <span className="font-bold">sous-payé</span>.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {journeesBloquees.map((j) => (
                    <li key={j.cle} className="text-[11px] font-semibold text-red-700">
                      • {nomPour(j.email)} — {new Date(`${j.date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setAvertissementPaieOuvert(false)} className="min-h-0 py-2 text-xs">
                Je vais corriger
              </Button>
              <Button
                onClick={() => { setAvertissementPaieOuvert(false); copierPourLaPaie(true); }}
                className="min-h-0 py-2 text-xs"
              >
                Copier quand même
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AVIS AUX ADMINISTRATEURS — propositions d'ajustement d'heures du
          répartiteur, à VALIDER ou REFUSER. Tant que rien n'est validé,
          l'heure originale compte partout (paie, projets, agenda). */}
      {(() => {
        const propositions = (travaux || []).filter((t) => t.supabase && t.heuresProposees != null);
        if (propositions.length === 0) return null;
        // Les lignes d'une même correction partagent un groupe : elles se
        // valident ou se refusent D'UN BLOC (jamais une demi-correction).
        const groupes = {};
        propositions.forEach((t) => {
          const g = t.groupeProposition || t.id;
          (groupes[g] = groupes[g] || []).push(t);
        });
        return (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
              ⏳ {Object.keys(groupes).length} correction{Object.keys(groupes).length > 1 ? "s" : ""} d'heures en attente de validation
            </p>
            <div className="mt-2 space-y-1.5">
              {Object.entries(groupes).map(([g, lignes]) => (
                <div key={g} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {lignes.map((t) => (
                      <p key={t.id} className="text-[11px] text-slate-700">
                        <span className="tabular-nums text-slate-400">{t.date}</span> · <span className="font-bold">{t.employeNom || t.employeEmail}</span> · {t.titre} :{" "}
                        <span className="font-bold tabular-nums">
                          {hM(t.heures)} → {hM(t.heuresProposees)}
                        </span>
                        {t.debutPropose && t.finPropose && (
                          <span className="tabular-nums text-slate-400"> ({heureLocaleDe(t.debutPropose)} → {heureLocaleDe(t.finPropose)})</span>
                        )}
                      </p>
                    ))}
                    <p className="text-[10px] text-slate-400">proposée par {lignes[0]?.propositionPar || "?"}{lignes.length > 1 ? ` — ${lignes.length} lignes corrigées ensemble` : ""}</p>
                  </div>
                  {droitHeures === "direct" ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => onValiderGroupe?.(lignes)} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white">
                        ✅ Valider
                      </button>
                      <button onClick={() => onRefuserGroupe?.(lignes)} className="rounded-md border border-red-300 px-2.5 py-1.5 text-[10px] font-bold text-red-600">
                        ❌ Refuser
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600">En attente d'un administrateur</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {employesSemaine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Aucune heure enregistrée cette semaine — les heures apparaissent quand un technicien clique « Terminer » sur une tâche.
        </p>
      ) : (
        <>
          <DefilementHorizontal>
            <table className="w-full min-w-[1100px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  {/* COLONNE DES NOMS FIGÉE (sticky left-0) — en glissant
                      vers la droite pour voir les totaux, on garde le nom
                      du technicien sous les yeux. Même principe que la
                      colonne des employés dans l'agenda. Le fond opaque
                      est obligatoire : sans lui, les colonnes qui défilent
                      apparaîtraient par transparence en dessous. */}
                  <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 font-extrabold uppercase tracking-wide text-slate-500">Technicien</th>
                  {jours.map((j, i) => (
                    <th key={isoJours[i]} className="px-2 py-2 text-center font-bold capitalize text-slate-400">
                      {j.toLocaleDateString("fr-CA", { weekday: "short" })}<br />
                      <span className="font-extrabold text-slate-600">{j.getDate()}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-bold text-slate-500">Chantier</th>
                  <th className="px-2 py-2 text-right font-bold text-slate-500">Transport</th>
                  {colVisibles.ccq && <th className="px-2 py-2 text-right font-bold text-slate-500">Transport journalier</th>}
                  {colVisibles.admin && <th className="px-2 py-2 text-right font-bold text-sky-600">Administratif</th>}
                  {colVisibles.divers && <th className="px-2 py-2 text-right font-bold text-stone-500">Divers</th>}
                  {colVisibles.diner && <th className="px-2 py-2 text-right font-bold text-rose-500">Dîner</th>}
                  {colVisibles.nuit && <th className="px-2 py-2 text-right font-bold text-indigo-500">🌙 Nuit</th>}
                  {colVisibles.weekend && <th className="px-2 py-2 text-right font-bold text-sky-600">Sam/Dim</th>}
                  {colVisibles.report && <th className="px-2 py-2 text-right font-bold text-purple-600">Report ±</th>}
                  <th className="bg-slate-100 px-3 py-2 text-right font-extrabold text-slate-700">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {employesSemaine.map((e, idxEmp) => (
                  <React.Fragment key={e.email}>
                    <tr
                      onClick={() => setDetailEmail(detailEmail === e.email ? null : e.email)}
                      className={`group cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${idxEmp % 2 === 1 ? "bg-slate-50/60" : ""}`}
                      title="Cliquer pour voir le détail des tâches"
                    >
                      {/* Nom figé à gauche. Le survol de la ligne doit être
                          repris ici (group-hover) : le fond opaque de la
                          cellule masquerait sinon le hover de la ligne. */}
                      <td className={`sticky left-0 z-10 border-r border-slate-100 ${idxEmp % 2 === 1 ? "bg-slate-50" : "bg-white"} px-3 py-2.5 group-hover:bg-slate-50`}>
                        <p className="font-bold text-slate-800">{e.nom}</p>
                        <p className="text-[10px] text-slate-400">{e.email}</p>
                      </td>
                      {isoJours.map((iso) => {
                        const actif = detailJour && detailJour.email === e.email && detailJour.iso === iso;
                        // JOURNÉE BLOQUÉE : cadenas rouge au lieu des
                        // heures. Elle reste cliquable — l'admin doit
                        // pouvoir ouvrir le détail pour corriger.
                        const bloquee = estBloque(e.email, iso);
                        if (bloquee) {
                          return (
                            <td
                              key={iso}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setDetailJour(actif ? null : { email: e.email, iso });
                              }}
                              title="Journée bloquée — chrono oublié. Cliquer pour voir et corriger."
                              className={`cursor-pointer px-2 py-2.5 text-center text-[11px] font-extrabold ${
                                actif ? "bg-red-200 text-red-800" : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              🔒
                            </td>
                          );
                        }
                        return (
                          <td
                            key={iso}
                            onClick={(ev) => {
                              if (!e.parJour[iso]) return;
                              // Ne pas déclencher aussi le détail SEMAINE (clic de ligne).
                              ev.stopPropagation();
                              setDetailJour(actif ? null : { email: e.email, iso });
                            }}
                            title={e.parJour[iso] ? "Cliquer pour le détail de cette journée" : undefined}
                            className={`px-2 py-2.5 text-center tabular-nums ${e.parJour[iso] ? "cursor-pointer hover:bg-blue-50" : ""} ${
                              actif ? "bg-blue-100 font-extrabold text-blue-700" : "text-slate-600"
                            }`}
                          >
                            {e.parJour[iso] ? hM(e.parJour[iso]) : <span className="text-slate-200">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">
                        {(e.residentielChantier || 0) > 0.001 ? (
                          <>
                            <span className="block font-bold">🏢 {hM(e.chantier - e.residentielChantier)}</span>
                            <span className="block font-bold text-emerald-700" title="Heures de chantier payées au taux RÉSIDENTIEL">🏠 {hM(e.residentielChantier)}</span>
                          </>
                        ) : e.chantier > 0.004 ? (
                          hM(e.chantier)
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">
                        {(e.residentielTransport || 0) > 0.001 ? (
                          <>
                            <span className="block font-bold">🏢 {hM(e.transport - e.residentielTransport)}</span>
                            <span className="block font-bold text-emerald-700" title="Transports payés au taux RÉSIDENTIEL">🏠 {hM(e.residentielTransport)}</span>
                          </>
                        ) : e.transport > 0.004 ? (
                          hM(e.transport)
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                      {colVisibles.ccq && (
                        <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{e.transportCcq > 0.004 ? hM(e.transportCcq) : <span className="text-slate-200">—</span>}</td>
                      )}
                      {/* ADMINISTRATIF cliquable : ouvre le detail des
                          visites (quel client, quel projet on est alle
                          voir) — c est la question qu on se pose en
                          regardant un cumul d heures administratives. */}
                      {colVisibles.admin && (
                      <td
                        onClick={(ev) => { if (e.administratif > 0) { ev.stopPropagation(); setDetailAdmin(detailAdmin === e.email ? null : e.email); } }}
                        title={e.administratif > 0 ? "Voir les visites" : undefined}
                        className={`px-2 py-2.5 text-right tabular-nums ${e.administratif > 0 ? "cursor-pointer font-bold text-sky-700 hover:bg-sky-50" : "text-slate-200"}`}
                      >{e.administratif > 0 ? hM(e.administratif) : "—"}</td>
                      )}
                      {colVisibles.divers && (
                        <td className={`px-2 py-2.5 text-right tabular-nums ${e.divers > 0 ? "font-bold text-stone-600" : "text-slate-200"}`}>{e.divers > 0 ? hM(e.divers) : "—"}</td>
                      )}
                      {colVisibles.diner && (
                      <td className={`px-2 py-2.5 text-right tabular-nums ${e.diner < 0 ? "font-bold text-rose-600" : "text-slate-200"}`}>
                        {e.diner < 0 ? hM(e.diner) : "—"}
                      </td>
                      )}
                      {colVisibles.nuit && (
                      <td className={`px-2 py-2.5 text-right tabular-nums ${e.nuit !== 0 ? "font-bold text-indigo-600" : "text-slate-200"}`}>
                        {e.nuit !== 0 ? hM(e.nuit) : "—"}
                      </td>
                      )}
                      {colVisibles.weekend && (
                      <td
                        className={`px-2 py-2.5 text-right tabular-nums ${e.weekend !== 0 ? "font-bold text-sky-600" : "text-slate-200"}`}
                      >
                        {e.weekend !== 0 ? hM(e.weekend) : "—"}
                      </td>
                      )}
                      {colVisibles.report && (
                      <td
                        className={`px-2 py-2.5 text-right tabular-nums ${e.report !== 0 ? "font-bold text-purple-600" : "text-slate-200"}`}
                        title={
                          e.report !== 0
                            ? e.reportDetails.map((r) => `${r.date} · ${r.titre} : ${r.delta > 0 ? "+" : ""}${r.delta.toFixed(2)} h`).join("\n")
                            : undefined
                        }
                      >
                        {e.report !== 0 ? `${e.report > 0 ? "+" : ""}${hM(e.report)}` : "—"}
                      </td>
                      )}
                      <td className="bg-slate-100/60 px-3 py-2.5 text-right">
                        <span className="font-extrabold tabular-nums text-slate-900">{hM(e.total + e.report)}</span>
                        {e.report !== 0 && (
                          <p className="text-[10px] font-bold tabular-nums text-purple-600">
                            {hM(e.total)} trav. {e.report > 0 ? "+" : ""}{hM(e.report)} report
                          </p>
                        )}
                        {e.supplementaires > 0 && (
                          <p className="text-[10px] font-bold text-amber-600">
                            {hM(seuilSupp)} rég. + {hM(e.supplementaires)} sup.
                          </p>
                        )}
                      </td>
                    </tr>
                    {/* DÉTAIL DES HEURES ADMINISTRATIVES — quelles
                        visites, chez quel client, sur quel projet. La
                        question qu'on se pose devant un cumul d'heures
                        administratives, c'est « on est allés où ? ». */}
                    {detailAdmin === e.email && (() => {
                      const visites = e.details.filter((t) => (t.categorieHeures || "projet") === "administratif");
                      if (visites.length === 0) return null;
                      return (
                        <tr className="border-b-2 border-sky-200 bg-sky-50">
                          <td colSpan={nbColonnes} className="px-4 py-3">
                            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-sky-700">
                              🔎 Heures administratives de {e.nom} — {hM(e.administratif)}
                            </p>
                            <div className="space-y-1">
                              {visites.slice().sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
                                const projet = (projets || []).find((p) => p.id === t.projetId);
                                return (
                                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                                    <span className="min-w-0">
                                      <span className="text-[11px] font-bold text-slate-800">{t.titre}</span>
                                      {t.clientNom ? <span className="ml-1.5 text-[11px] text-slate-500">· {t.clientNom}</span> : null}
                                      {projet ? <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{projet.nom}</span> : null}
                                    </span>
                                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                                      {t.date} · <span className="font-bold text-slate-700">{hM(t.heures)}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-[10px] text-sky-700">
                              Ces heures sont PAYÉES mais n'entrent pas dans le coût des projets — elles sont un frais
                              général de l'entreprise.
                            </p>
                          </td>
                        </tr>
                      );
                    })()}

                    {detailEmail === e.email && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={nbColonnes} className="px-4 py-3">
                          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Détail des tâches de {e.nom}</p>
                          <div className="space-y-1">
                            {e.details
                              .slice()
                              .sort((a, b) => (a.date + (a.titre || "")).localeCompare(b.date + (b.titre || "")))
                              .map((t) => (
                                <p key={t.id} className="text-[11px] text-slate-600">
                                  <span className="tabular-nums text-slate-400">{t.date}</span> · {t.estTransport ? "🚚 " : ""}{t.titre || "Travail"}
                                  {t.clientNom ? ` — ${t.clientNom}` : ""} ·{" "}
                                  <span className="font-bold tabular-nums">{hM(t.heures)}</span>
                                </p>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {/* COMPILATION DE LA SEMAINE — toute l'équipe : total par
                  jour, par catégorie (Chantier / Transport / Transport
                  CCQ) et GRAND TOTAL. */}
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100">
                  {/* « Total équipe » figé lui aussi : c'est justement en
                      lisant les totaux qu'on a glissé vers la droite. */}
                  <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-100 px-3 py-2.5 font-extrabold uppercase tracking-wide text-slate-700">Total équipe</td>
                  {isoJours.map((iso) => (
                    <td key={iso} className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-700">
                      {totauxEquipe.parJour[iso] ? hM(totauxEquipe.parJour[iso]) : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-700">{hM(totauxEquipe.chantier)}</td>
                  <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-700">{hM(totauxEquipe.transport)}</td>
                  {colVisibles.ccq && <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-700">{hM(totauxEquipe.transportCcq)}</td>}
                  {colVisibles.admin && <td className="px-2 py-2.5 text-right font-bold tabular-nums text-sky-700">{hM(totauxEquipe.administratif)}</td>}
                  {colVisibles.divers && <td className="px-2 py-2.5 text-right font-bold tabular-nums text-stone-600">{hM(totauxEquipe.divers)}</td>}
                  {colVisibles.diner && (
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${totauxEquipe.diner < 0 ? "text-rose-600" : "text-slate-400"}`}>
                    {totauxEquipe.diner < 0 ? hM(totauxEquipe.diner) : "—"}
                  </td>
                  )}
                  {colVisibles.nuit && (
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${totauxEquipe.nuit !== 0 ? "text-indigo-600" : "text-slate-400"}`}>
                    {totauxEquipe.nuit !== 0 ? hM(totauxEquipe.nuit) : "—"}
                  </td>
                  )}
                  {colVisibles.weekend && (
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${totauxEquipe.weekend !== 0 ? "text-sky-600" : "text-slate-400"}`}>
                    {totauxEquipe.weekend !== 0 ? hM(totauxEquipe.weekend) : "—"}
                  </td>
                  )}
                  {colVisibles.report && (
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${totauxEquipe.report !== 0 ? "text-purple-600" : "text-slate-400"}`}>
                    {totauxEquipe.report !== 0 ? `${totauxEquipe.report > 0 ? "+" : ""}${hM(totauxEquipe.report)}` : "—"}
                  </td>
                  )}
                  <td className="bg-slate-200/70 px-3 py-2.5 text-right text-sm font-extrabold tabular-nums text-slate-900">{hM(totauxEquipe.total + totauxEquipe.report)}</td>
                </tr>
              </tfoot>
            </table>
          </DefilementHorizontal>

          {/* FENÊTRE — DÉTAIL D'UNE JOURNÉE (sortie du tableau le 2026-08-19). */}
                {/* DÉTAIL D'UNE JOURNÉE — ouvert au clic sur la cellule
                    d'un jour : déroulement de la journée avec une
                    étiquette de catégorie par entrée + récapitulatif. */}
                {detailJour && (() => {
                  const e = employesSemaine.find((x) => x.email === detailJour.email);
                  if (!e) return null;
                  const iso = detailJour.iso;
                  // Une journée BLOQUÉE n'est pas dans `details` (elle
                  // est exclue des totaux) — mais l'admin doit voir
                  // ses lignes pour les corriger. On les reprend
                  // alors directement dans les lignes brutes.
                  const jourBloqueIci = estBloque(e.email, iso);
                  const lignesJour = jourBloqueIci
                    ? lignesSemaineBrutes.filter((t) => t.date === iso && (t.employeEmail || "").toLowerCase() === e.email)
                    : e.details.filter((t) => t.date === iso);
                  if (lignesJour.length === 0) return null;
                  // Ordre lisible : Transport Début en premier, Fin en
                  // dernier (pas d'heure exacte sur les lignes — seulement
                  // des durées par tâche).
                  const rang = (t) => (/début/i.test(t.titre || "") ? 0 : /fin de journée/i.test(t.titre || "") ? 2 : 1);
                  // ORDRE CHRONOLOGIQUE (2026-08-19) : l'heure réelle de
                  // début d'abord — on voit d'un coup d'œil où une
                  // correction doit commencer et finir. Les lignes sans
                  // heure captée retombent sur l'ancien ordre logique.
                  const ordonnees = lignesJour.slice().sort((a, b) => {
                    const ta = a.debutReel ? new Date(a.debutReel).getTime() : null;
                    const tb = b.debutReel ? new Date(b.debutReel).getTime() : null;
                    if (ta != null && tb != null) return ta - tb;
                    if (ta != null) return -1;
                    if (tb != null) return 1;
                    return rang(a) - rang(b);
                  });
                  const catDe = (t) =>
                    estLunch(t)
                      ? { label: "DÎNER", cls: "bg-rose-100 text-rose-700" }
                      : estCcq(t)
                      ? { label: "TRANSP. JOURNALIER", cls: "bg-amber-100 text-amber-700" }
                      : t.estTransport
                      ? { label: t.secteur === "residentiel" ? "TRANSPORT 🏠" : "TRANSPORT", cls: "bg-slate-200 text-slate-600" }
                      : t.secteur === "residentiel"
                      ? { label: "CHANTIER 🏠 RÉS.", cls: "bg-emerald-200 text-emerald-800" }
                      : { label: "CHANTIER", cls: "bg-emerald-100 text-emerald-700" };
                  const tj = lignesJour.reduce(
                    (acc, t) => {
                      const h = Number(t.heures) || 0;
                      if (estLunch(t)) acc.diner += h;
                      else if (estCcq(t)) acc.ccq += h;
                      else if (t.estTransport) acc.transport += h;
                      else acc.chantier += h;
                      acc.total += h;
                      return acc;
                    },
                    { chantier: 0, transport: 0, ccq: 0, diner: 0, total: 0 }
                  );
                  const labelJour = new Date(`${iso}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => { setDetailJour(null); setEditionLigne(null); setErreurEdition(""); })(); }}>
                      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(ev) => ev.stopPropagation()}>
                        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-blue-700">
                          📅 <span className="capitalize">{labelJour}</span> — journée de {e.nom} ({hM(tj.total)})
                          {(() => {
                            // Badge de classification de la journée (règle Nuit/Sam-Dim).
                            const classe = classificationJournee(lignesJour, iso);
                            if (classe === "nuit")
                              return <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] text-indigo-700">🌙 NUIT — 1re intervention à {heureNuit} h+</span>;
                            if (classe === "weekend")
                              return <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] text-sky-700">SAM/DIM — fin de semaine</span>;
                            return null;
                          })()}
                        </p>
                        <div className="space-y-1.5">
                          {ordonnees.map((t) => {
                            const cat = catDe(t);
                            return (
                              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 py-1.5">
                                <p className="min-w-0 flex-1 truncate text-[11px] text-slate-700">
                                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${cat.cls}`}>{cat.label}</span>
                                  {t.titre || "Travail"}
                                  {t.clientNom ? ` — ${t.clientNom}` : ""}
                                </p>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {editionLigne?.id === t.id ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <input
                                        type="time"
                                        value={editionLigne.debut}
                                        onChange={(ev) => setEditionLigne({ ...editionLigne, debut: ev.target.value })}
                                        className="rounded-md border border-blue-300 px-1.5 py-1 text-[11px] tabular-nums"
                                      />
                                      <span className="text-[10px] text-slate-400">→</span>
                                      <input
                                        type="time"
                                        value={editionLigne.fin}
                                        onChange={(ev) => setEditionLigne({ ...editionLigne, fin: ev.target.value })}
                                        className="rounded-md border border-blue-300 px-1.5 py-1 text-[11px] tabular-nums"
                                      />
                                      {(() => {
                                        // Durée calculée EN DIRECT — et mention claire
                                        // quand la fin tombe le lendemain (passe minuit).
                                        const d0 = new Date(`${t.date}T${editionLigne.debut || "00:00"}:00`);
                                        const f0 = new Date(`${t.date}T${editionLigne.fin || "00:00"}:00`);
                                        const lendemain = f0 < d0;
                                        if (lendemain) f0.setDate(f0.getDate() + 1);
                                        const h = (f0 - d0) / 3600000;
                                        return (
                                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold tabular-nums ${lendemain ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                                            = {hM(h)}{lendemain ? " · 🌙 le lendemain" : ""}
                                          </span>
                                        );
                                      })()}
                                      <button
                                        onClick={() => {
                                          const plan = planAjustement(t, editionLigne.debut, editionLigne.fin, lignesJour);
                                          if (plan.erreur) {
                                            setErreurEdition(plan.erreur);
                                            return;
                                          }
                                          onAjusterPlan?.(plan.ajustements);
                                          setEditionLigne(null);
                                          setErreurEdition("");
                                        }}
                                        className="rounded-md bg-[#131B2E] px-2.5 py-1.5 text-[10px] font-bold text-white"
                                      >
                                        {droitHeures === "direct" ? "OK" : "Proposer"}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditionLigne(null);
                                          setErreurEdition("");
                                        }}
                                        aria-label="Annuler"
                                        className="rounded-md border border-slate-300 px-2 py-1.5 text-[10px] font-bold text-slate-500"
                                      >
                                        ✗
                                      </button>
                                      {/* L'erreur COLLÉE à la ligne éditée — avant, elle
                                          s'affichait sous toute la liste, hors de vue. */}
                                      {erreurEdition && (
                                        <span className="w-full text-[10px] font-bold text-red-600">⚠️ {erreurEdition}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      {t.debutReel && t.finReelle && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold tabular-nums text-slate-500">
                                          {heureLocaleDe(t.debutReel)} → {heureLocaleDe(t.finReelle)}
                                        </span>
                                      )}
                                      <p className="text-[11px] font-extrabold tabular-nums text-slate-800">{hM(t.heures)}</p>
                                      {t.corrigeLe && t.heuresAvantCorrection != null && (
                                        <span
                                          className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700"
                                          title={`Corrigée après la fermeture de cette semaine de paie (avant : ${(Number(t.heuresAvantCorrection) || 0).toFixed(2)} h) — la différence est reportée sur la semaine du ${dimancheDeSemaineISO(t.corrigeLe)}.`}
                                        >
                                          ✏️ reportée → sem. du {dimancheDeSemaineISO(t.corrigeLe)}
                                        </span>
                                      )}
                                      {t.heuresProposees != null && (
                                        <span
                                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700"
                                          title={`Proposé par ${t.propositionPar || "?"} — à valider par un administrateur`}
                                        >
                                          ⏳ → {hM(t.heuresProposees)}
                                        </span>
                                      )}
                                      {droitHeures && t.supabase && !estLunch(t) && (
                                        <button
                                          onClick={() => {
                                            // Point de départ : heures réelles si connues, sinon
                                            // 07:00 + durée (ligne d'avant la capture).
                                            const debut = heureLocaleDe(t.debutReel) || "07:00";
                                            const fin =
                                              heureLocaleDe(t.finReelle) ||
                                              (() => {
                                                const d = new Date(`${t.date}T${debut}:00`);
                                                d.setMinutes(d.getMinutes() + Math.round((Number(t.heures) || 1) * 60));
                                                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                                              })();
                                            setEditionLigne({ id: t.id, debut, fin });
                                            setErreurEdition("");
                                          }}
                                          title={droitHeures === "direct" ? "Corriger les heures de début/fin (effet immédiat)" : "Proposer une correction (validée par un administrateur)"}
                                          className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {erreurEdition && (
                          <p className="mt-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-600">
                            ⚠️ {erreurEdition}
                          </p>
                        )}
                        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-700">
                          <span>🟢 Chantier : <span className="tabular-nums">{hM(tj.chantier)}</span></span>
                          {lignesJour.some((t) => t.secteur === "residentiel") && (
                            <span className="text-emerald-700">🏠 Résidentiel : <span className="tabular-nums">{hM(lignesJour.filter((t) => t.secteur === "residentiel" && !estLunch(t)).reduce((s, t) => s + (Number(t.heures) || 0), 0))}</span></span>
                          )}
                          <span>⚪ Transport : <span className="tabular-nums">{hM(tj.transport)}</span></span>
                          <span>🟡 Transport journalier : <span className="tabular-nums">{hM(tj.ccq)}</span></span>
                          {tj.diner < 0 && (
                            <span className="text-rose-600">🍴 Dîner (non payé) : <span className="tabular-nums">{hM(tj.diner)}</span></span>
                          )}
                          <span>Σ Total du jour : <span className="tabular-nums">{hM(tj.total)}</span></span>
                        </p>
                        <button
                          onClick={() => { setDetailJour(null); setEditionLigne(null); setErreurEdition(""); }}
                          className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-300 text-xs font-bold text-slate-600"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                  );
                })()}


          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400">
              Heures régulières : jusqu'à {seuilSupp} h/semaine · au-delà = heures supplémentaires (taux et demi, normes du Québec). Clique le <span className="font-bold">nom</span> d'un technicien pour sa semaine complète, ou la <span className="font-bold">cellule d'un jour</span> pour le détail de cette journée.
            </p>
            <Button onClick={() => copierPourLaPaie()} className="min-h-0 px-4 py-2 text-xs">
              {copie ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier pour la paie</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

