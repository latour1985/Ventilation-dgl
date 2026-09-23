"use client";

// app/admin/FileDuMatin.jsx
//
// ☀️ « MA FILE DU MATIN » (2026-09-22, idée retenue par le propriétaire).
// Ce qui demande une action AUJOURD'HUI, rassemblé en une liste triée par
// urgence, avec un bouton qui mène au bon endroit. Avant : ces infos
// vivaient dans 5 onglets. Rien à faire = rien d'affiché (sauf un « ✓ »).
// Aucun calcul nouveau : chaque ligne reprend une règle qui existe déjà
// ailleurs dans l'application (même définition que l'écran d'arrivée).

import { useMemo } from "react";
import { dateISO, listeCellule } from "./partage";

export function FileDuMatin({
  bons = [], devisListe = [], pieces = [], tachesAttente = [], achatsLibres = [], travaux = [], planning = {}, utilisateurs = [],
  soumissionsSansDevis = [], tachesDevisAFaire = [], ramassagesAttribuer = [], setOnglet, onPlanifierRetour = null,
}) {
  const aujourdhui = dateISO(new Date());
  const ilYa = (j) => dateISO(new Date(Date.now() - j * 86400000));

  const lignes = useMemo(() => {
    const L = [];
    // 1. Journées bloquées (chrono oublié) — la paie attend.
    const bloquees = new Set((travaux || []).filter((t) => t.supabase && t.jourBloque).map((t) => `${t.employeEmail}|${t.date}`));
    if (bloquees.size > 0) L.push({ cle: "bloquees", ton: "rouge", icone: "🔒", texte: `${bloquees.size} journée${bloquees.size > 1 ? "s" : ""} bloquée${bloquees.size > 1 ? "s" : ""} (chrono oublié) — appeler, corriger, débloquer`, action: "Heures", onglet: "paies" });

    // 2. Tâches pas fermées sur le téléphone (7 derniers jours).
    const clesHeures = new Set((travaux || []).filter((t) => t.supabase && t.tacheId && t.employeEmail).map((t) => `${t.tacheId}|${t.employeEmail.toLowerCase()}`));
    const courrielDe = new Map((utilisateurs || []).map((u) => [String(u.id), (u.courriel || "").toLowerCase()]));
    const pasFermees = new Map();
    const depuis = ilYa(7);
    Object.entries(planning || {}).forEach(([cle, cellule]) => {
      const [jour, empId] = cle.split("|");
      if (!(jour >= depuis && jour < aujourdhui)) return;
      const courriel = courrielDe.get(String(empId));
      if (!courriel) return;
      listeCellule(cellule).forEach((t) => {
        if (!t?.id || t.est_tache_systeme || t.sansHeures || (t.typeTache || t.type) === "conge" || String(t.id).startsWith("ramassage-")) return;
        const multi = Number(t.jours) > 1;
        const fermee = clesHeures.has(`${t.id}|${courriel}`) || (multi && clesHeures.has(`${t.id}::${jour}|${courriel}`));
        if (!fermee) pasFermees.set(`${t.id}|${courriel}|${multi ? jour : ""}`, t);
      });
    });
    if (pasFermees.size > 0) L.push({ cle: "pasfermees", ton: "rouge", icone: "⏳", texte: `${pasFermees.size} tâche${pasFermees.size > 1 ? "s" : ""} pas fermée${pasFermees.size > 1 ? "s" : ""} sur le téléphone (7 derniers jours) — aucune heure enregistrée`, action: "Agenda", onglet: "agenda" });

    // 3. Pièces reçues dont la visite de retour attend encore.
    const idsAttente = new Set((tachesAttente || []).map((t) => t.id));
    (pieces || [])
      .filter((p) => p.statut === "recue" && p.tacheRetourId && idsAttente.has(p.tacheRetourId))
      .forEach((p) => L.push({ cle: `retour-${p.id}`, ton: "ambre", icone: "📦", texte: `Pièce reçue — planifier le retour chez ${p.clientNom || "?"} (${p.pieceRequise || "pièce"})`, action: "Planifier", faire: onPlanifierRetour ? () => onPlanifierRetour(p) : null, onglet: "agenda" }));

    // 4. Livraisons en retard (BC libres + pièces).
    const retardAchats = (achatsLibres || []).filter((a) => !a.recuLe && a.livraisonSouhaitee && a.livraisonSouhaitee < aujourdhui).length;
    const retardPieces = (pieces || []).filter((p) => p.statut === "commandee" && p.dateReceptionPrevue && p.dateReceptionPrevue < aujourdhui).length;
    if (retardAchats + retardPieces > 0) L.push({ cle: "retard", ton: "ambre", icone: "🚚", texte: `${retardAchats + retardPieces} livraison${retardAchats + retardPieces > 1 ? "s" : ""} en retard — appeler le fournisseur`, action: "Pièces", onglet: "pieces" });

    // 5. Ramassages sans personne ou sans jour.
    const nbRam = (ramassagesAttribuer || []).reduce((s, g) => s + ((g.bons || []).length || 1), 0);
    if (nbRam > 0) L.push({ cle: "ramassages", ton: "ambre", icone: "🚚", texte: `${nbRam} ramassage${nbRam > 1 ? "s" : ""} à attribuer (personne ou jour)`, action: "Agenda", onglet: "agenda" });

    // 6. Travaux à facturer (un travail = une tâche, peu importe le nombre de techniciens).
    const aFacturer = new Set(
      (bons || []).filter((b) => b.statutQb === "en_attente" && !b.retraitStatut && (b.facturesEmises || []).filter((f) => !f.annuleeQb).length === 0).map((b) => String(b.tacheId || b.id).split("::")[0])
    );
    if (aFacturer.size > 0) L.push({ cle: "facturer", ton: "bleu", icone: "🧾", texte: `${aFacturer.size} travau${aFacturer.size > 1 ? "x" : ""} à réviser / facturer`, action: "Facturation", onglet: "facturation" });

    // 7. Devis envoyés il y a 7 jours et plus, sans réponse, pas relancés depuis 7 jours.
    const aRelancer = (devisListe || []).filter((d) => {
      if (d.statut !== "envoye" || d.reponseClient || d.versionActive === false || !(d.courrielsEnvoi || []).length) return false;
      if (!d.date || d.date > ilYa(7)) return false;
      const derniere = (d.relances || []).map((r) => String(r.date || "").slice(0, 10)).sort().pop();
      return !derniere || derniere <= ilYa(7);
    }).length;
    if (aRelancer > 0) L.push({ cle: "relancer", ton: "bleu", icone: "🔔", texte: `${aRelancer} devis sans réponse depuis 7 jours et plus — relancer`, action: "Devis", onglet: "devis" });

    // 8. Devis à faire (travaux planifiés sans devis + visites de soumission).
    const aFaire = (tachesDevisAFaire || []).length + (soumissionsSansDevis || []).length;
    if (aFaire > 0) L.push({ cle: "devisafaire", ton: "bleu", icone: "📄", texte: `${aFaire} devis à faire (visites de soumission, travaux planifiés sans devis)`, action: "Voir", onglet: "tableau-de-bord-bas" });

    return L;
  }, [bons, devisListe, pieces, tachesAttente, achatsLibres, travaux, planning, utilisateurs, soumissionsSansDevis, tachesDevisAFaire, ramassagesAttribuer, aujourdhui, onPlanifierRetour]);

  const tons = { rouge: "border-red-200 bg-red-50", ambre: "border-amber-200 bg-amber-50", bleu: "border-slate-200 bg-white" };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        ☀️ Ma file du matin {lignes.length > 0 ? <span className="normal-case text-slate-400">— {lignes.length} chose{lignes.length > 1 ? "s" : ""} à faire</span> : null}
      </h3>
      {lignes.length === 0 ? (
        <p className="text-xs font-semibold text-emerald-700">✓ Rien d&apos;urgent — tout est à jour.</p>
      ) : (
        <div className="space-y-1.5">
          {lignes.map((l) => (
            <div key={l.cle} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${tons[l.ton]}`}>
              <p className="min-w-0 text-[12px] font-semibold text-slate-800">{l.icone} {l.texte}</p>
              <button
                type="button"
                onClick={() => {
                  if (l.faire) return l.faire();
                  if (l.onglet === "tableau-de-bord-bas") return document.getElementById("encadres-devis-a-faire")?.scrollIntoView({ behavior: "smooth" });
                  setOnglet?.(l.onglet);
                }}
                className="shrink-0 rounded-lg bg-[#131B2E] px-2.5 py-1 text-[10px] font-extrabold text-white active:scale-95"
              >
                {l.action} →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
