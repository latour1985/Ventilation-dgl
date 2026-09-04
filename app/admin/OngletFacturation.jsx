"use client";

// app/admin/OngletFacturation.jsx
//
// FACTURATION (bons a facturer, facturation progressive, factures
// emises QuickBooks) — tranche T11 du decoupage de page.jsx
// (2026-09-01). Extraction MECANIQUE : aucun comportement ne change,
// le code est deplace tel quel — seuls des export/import s'ajoutent.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Cloud, FileText, MapPin, Plus, Send, Trash2, User, X } from "lucide-react";
import TermesConditions from "@/components/TermesConditions";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { calculerTaxes } from "@/lib/supabase/entreprise";
import { envoyerCourriel, gabaritBonTravail, gabaritFactureMaison } from "@/lib/courriels";
import { creerFactureQbo, annulerFactureQbo, envoyerFactureQbo, verifierEnvoisQbo, ouvrirFacturePdfQbo, lireEstimateQbo } from "@/lib/quickbooksClient";
import { listerFacturesLibres, enregistrerFactureLibre, majEnvoiFactureLibre, majFactureLibre, supprimerFactureLibreEnCreation } from "@/lib/supabase/facturesLibres";
import { creerFactureMaison, majFactureMaison, lienFactureMaison } from "@/lib/supabase/facturesMaison";
import { calculerTaxesRegime } from "@/lib/taxesCanada";
import { SectionFacturesMaison } from "./FacturesMaison";
import { majFacturesEmises, demanderRetraitFacturation, validerRetraitFacturation, remettreAFacturer, RAISONS_RETRAIT, majMaterielStock } from "@/lib/supabase/bonsTravail";
import { assurerJetonBon, lienBonPublic, marquerBonEnvoyeClient, JOURS_VALIDITE_BON } from "@/lib/supabase/bonPublic";
import { EnTeteEntreprise, PiedDocument } from "./OngletParametres";
import { AdressesDocument, BadgeConsultation, BarrePagination, BoutonPDF, Button, ITEMS_PAR_PAGE, ModalSelectionCourriel, SelecteurItem, adresseFacturationClient, correspond, dateISO, hauteurDescription, libelleDestinataires, listeDestinataires, nomAffichageClient, tauxAffiche, useCatalogue, useClients, useDevis } from "./partage";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { enregistrerAttributionQb } from "@/lib/supabase/quickbooks";

export function ModalRetraitFacturation({ bon, onFermer, onDemander }) {
  const [raison, setRaison] = useState("travaux_en_cours");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Retirer de la facturation</h3>
            <p className="text-xs text-slate-500">{bon.client} · {bon.projet}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>
        <p className="mb-2 text-[11px] text-slate-500">
          Choisis la raison — un <span className="font-bold">Admin principal</span> devra valider avant que le bon quitte la pile.
        </p>
        <div className="space-y-1.5">
          {Object.entries(RAISONS_RETRAIT).map(([cle, libelle]) => (
            <label
              key={cle}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${raison === cle ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"}`}
            >
              <input
                type="radio"
                name="raison-retrait"
                checked={raison === cle}
                onChange={() => setRaison(cle)}
                className="mt-0.5 h-4 w-4 accent-[#FF6A13]"
              />
              <span className="text-xs font-semibold text-slate-700">
                {cle === "travaux_en_cours" ? "🔄 " : cle === "garantie" ? "🛡️ " : "🏠 "}{libelle}
              </span>
            </label>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note facultative (ex : 2e visite prévue vendredi)"
          rows={2}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#FF6A13]"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={() => onDemander(raison, note.trim())}>Demander le retrait</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FACTURES ÉMISES D'UN BON — chaque ligne porte sa PREUVE d'envoi
// (registre QuickBooks), son PDF officiel et, au besoin, son bouton
// « Renvoyer ». Rien ne se perd : pas de preuve = alerte rouge.
// ============================================================
export function FacturesEmisesListe({ bon, onPdf, onRenvoyer, onRenvoyerVers = null, envoiAuto = true }) {
  return (
    <div className="mt-1.5 space-y-1">
      {(bon.facturesEmises || []).map((f) => (
        <div key={f.id} className="rounded-lg bg-slate-50 px-1.5 py-1 text-left text-[10px] text-slate-500">
          <p>
            <span className="font-semibold text-slate-600">{f.numeroFactureQb}</span> — {Number(f.montant).toFixed(2)} $ ({f.detail}) · {f.date}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {f.envoiQb?.statut === "envoyee" ? (
              <>
                <span className="font-bold text-emerald-600">✉️ Envoyée par QuickBooks ✓</span>
                {/* 📧 RENVOYER MÊME SI ENVOYÉE (2026-08-29, demande du
                    propriétaire) : « au cas où le client ne la reçoit
                    pas » — pourriel, mauvaise adresse. Ouvre le CHOIX des
                    destinataires : le cas classique est justement une
                    adresse à corriger. */}
                {onRenvoyerVers && (
                  <button onClick={() => onRenvoyerVers(bon, f)} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-bold text-slate-600 active:scale-95">
                    📧 Renvoyer
                  </button>
                )}
              </>
            ) : f.qboInvoiceId && !envoiAuto ? (
              <>
                <span className="font-bold text-slate-500">📄 Créée — envoi manuel</span>
                <button onClick={() => onRenvoyer(bon, f)} className="rounded bg-slate-700 px-1.5 py-0.5 font-bold text-white active:scale-95">
                  Envoyer par QuickBooks
                </button>
              </>
            ) : f.qboInvoiceId ? (
              <>
                <span className="font-bold text-red-600">⚠️ Envoi non confirmé</span>
                <button onClick={() => onRenvoyer(bon, f)} className="rounded bg-red-600 px-1.5 py-0.5 font-bold text-white active:scale-95">
                  Renvoyer
                </button>
              </>
            ) : (
              <span className="text-slate-400">facture locale (QuickBooks non connecté)</span>
            )}
            {f.qboInvoiceId && (
              <button onClick={() => onPdf(f)} className="font-semibold text-slate-500 underline underline-offset-2">
                📄 PDF
              </button>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 💰/🤝 TECHNICIEN FACTURABLE OU NON — le choix OBLIGATOIRE quand un
// 2e (3e, 4e…) technicien s'ajoute sur une tâche. Aucun bouton par
// défaut, pas de fermeture sans répondre : envoyer un 2e technicien ne
// décide JAMAIS tout seul s'il se facture. Le premier est toujours
// facturable. Coûts et paie ne changent pas — seule la facturation.
// ============================================================

// ============================================================
// ONGLET FACTURATION
// ============================================================
// ============================================================
// MODAL DE FACTURATION PROGRESSIVE (travaux avec devis)
// ============================================================
export function ModalFacturationDevis({ bon, devis, onFermer, onEmettre, tousLesBons }) {
  const contrat = bon.type === "entretien_contrat";

  // ============================================================
  // LE SOLDE SUIT LE DEVIS, PAS LE BON DE TRAVAIL
  // ------------------------------------------------------------
  // Avant, le cumul se lisait sur CE bon uniquement. Conséquence : un
  // chantier facturé 6 000 $ à la première visite, puis repris plus
  // tard par quelqu'un d'autre, créait un NOUVEAU bon sans historique —
  // qui proposait de facturer les 10 000 $ du devis une deuxième fois.
  // 16 000 $ facturés pour un contrat de 10 000 $.
  //
  // On additionne donc TOUT ce qui a été facturé contre ce devis, quelle
  // que soit la tâche, le technicien ou la date.
  // (Calculé AVANT les états : le champ « % » démarre au % restant.)
  const montantCumule = devis?.numero
    ? (tousLesBons || [])
        .filter((b) => b.devisNumero === devis.numero)
        .reduce((s, b) => s + (b.facturesEmises || []).reduce((x, f) => x + f.montant, 0), 0)
    : (bon.facturesEmises || []).reduce((s, f) => s + f.montant, 0);
  const montantDevis = devis ? devis.totalVendant : bon.montant;
  const montantRestant = Math.max(0, montantDevis - montantCumule);
  const frequence = bon.frequenceFacturationAnnuelle || 4;
  const montantEcheance = Math.min(montantRestant, montantDevis / frequence);
  // Le % encore facturable — plafond ET valeur de DÉPART du champ
  // (2026-08-30, retour du propriétaire : « pourquoi il n'applique pas
  // le % restant par défaut ? ») : à la 3e facture d'un devis facturé à
  // 82 %, le champ ouvre à 18 %, pas à un 100 % impossible.
  const pctMaxDevis = montantDevis > 0 ? Math.floor((montantRestant / montantDevis) * 10000) / 100 : 100;

  const [type, setType] = useState(contrat ? "echeance" : "complete");
  const [pourcentage, setPourcentage] = useState(() => Math.max(0, Math.min(100, pctMaxDevis)));
  // Progression par ligne du devis — clé = ligne.uid, valeur =
  // { progressType: 'percent' | 'amount', progressPercent, billedAmount }.
  // Chaque ligne a son propre mode d'ajustement, indépendant des autres.
  const [lignesProgression, setLignesProgression] = useState({});

  // Récupère (ou initialise) l'état de progression d'une ligne.
  const progressionLigne = (l) =>
    lignesProgression[l.uid] || { progressType: "percent", progressPercent: 0, billedAmount: 0 };

  // Règle de calcul bidirectionnelle (section 2 des règles de gestion) :
  // modifier le % recalcule le montant, modifier le montant recalcule
  // le %. Chacun est plafonné à la valeur totale HT de SA PROPRE ligne
  // (totalHT = quantite × prix_vendant), jamais au-delà.
  // 🧢 PLAFOND VIVANT PAR LIGNE (2026-08-30, demande du propriétaire :
  // « ajuster le 100 % au montant restant plutôt que de laisser dépasser
  // et simplement aviser »). Le curseur s'ARRÊTE tout seul au solde
  // restant du devis au lieu de monter à 100 % puis d'afficher un refus.
  // Le plafond est GLOBAL : ce que les AUTRES lignes réclament déjà
  // réduit ce qui reste disponible pour celle-ci — monter la ligne A
  // abaisse le maximum de la ligne B, jamais l'inverse d'un total juste.
  const plafondPourLigne = (l) => {
    const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
    const autresLignes = devis
      ? devis.lignes.reduce((s, x) => (x.uid === l.uid ? s : s + progressionLigne(x).billedAmount), 0)
      : 0;
    return Math.max(0, Math.min(totalHT, Math.round((montantRestant - autresLignes) * 100) / 100));
  };

  const majPourcentageLigne = (l, pctBrut) => {
    const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
    const demande = Math.round(totalHT * (Math.max(0, Math.min(100, pctBrut)) / 100) * 100) / 100;
    const billedAmount = Math.min(demande, plafondPourLigne(l));
    // Le % affiché reflète le montant RÉEL (plafonné) — jamais un chiffre
    // que la facture ne respecterait pas.
    const progressPercent = totalHT > 0 ? Math.round((billedAmount / totalHT) * 10000) / 100 : 0;
    setLignesProgression((prev) => ({ ...prev, [l.uid]: { progressType: "percent", progressPercent, billedAmount } }));
  };

  const majMontantLigne = (l, montantBrut) => {
    const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
    const billedAmount = Math.max(0, Math.min(plafondPourLigne(l), montantBrut));
    const progressPercent = totalHT > 0 ? Math.round((billedAmount / totalHT) * 10000) / 100 : 0;
    setLignesProgression((prev) => ({ ...prev, [l.uid]: { progressType: "amount", progressPercent, billedAmount } }));
  };

  const montantSurMesure = devis
    ? devis.lignes.reduce((s, l) => s + progressionLigne(l).billedAmount, 0)
    : 0;

  const montantCalcule =
    type === "complete"
      ? montantRestant
      : type === "echeance"
      ? montantEcheance
      : type === "pourcentage"
      ? Math.min(montantRestant, (pourcentage / 100) * montantDevis)
      : montantSurMesure;

  // Le montant à facturer ne peut jamais dépasser le solde restant du
  // devis/contrat, quelle que soit l'option choisie — c'est ce qui
  // garantit qu'on ne dépasse jamais le montant initial, même en
  // cumulant plusieurs factures progressives dans le temps.
  const depasse = montantCalcule > montantRestant + 0.01;
  const peutEmettre = montantCalcule > 0.005 && !depasse;

  // Taxes affichées à titre indicatif sur cette facture progressive
  // (mêmes taux que partout : ceux des Paramètres de l'entreprise).
  const configEnt = useEntreprise();
  const { tps: tpsCalculee, tvq: tvqCalculee, total: totalTtcCalcule } = calculerTaxes(montantCalcule, configEnt);

  const confirmer = () => {
    if (!peutEmettre) return;
    const montantFinal = Math.round(montantCalcule * 100) / 100;
    // 📋 LIGNES DÉTAILLÉES POUR QUICKBOOKS (2026-08-30, retour du
    // propriétaire : « la description ne se transmet pas au complet à
    // la facture ») : la facture reprend les items du devis — quantité,
    // nom ET description complète — au lieu d'une ligne générique.
    //   • sur mesure : une ligne par item facturé, à son montant (avec
    //     la portion si partielle) ;
    //   • complète SANS facture antérieure : chaque item du devis à son
    //     montant ;
    //   • sinon (pourcentage, échéance, complète après des partielles) :
    //     null — emettreFacture garde sa ligne unique au montant et
    //     ajoute le détail des travaux en lignes descriptives à 0 $.
    // Filet : si la somme des lignes ne retombe pas sur le montant (un
    // sou d'arrondi), on revient à la ligne unique — le total prime.
    const detailLigne = (l) => {
      const detail = String(l.description || "").trim();
      return `${l.quantite} × ${l.nom}${detail ? `\n${detail}` : ""}`;
    };
    let lignesFacture = null;
    if (devis && type === "sur_mesure") {
      lignesFacture = devis.lignes
        .map((l) => ({ l, prog: progressionLigne(l) }))
        .filter((x) => x.prog.billedAmount > 0.005)
        .map(({ l, prog }) => {
          const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
          const partiel = prog.billedAmount < totalHT - 0.005;
          return {
            description: `${detailLigne(l)}${partiel ? `\n(portion facturée : ${prog.progressPercent} % de ${totalHT.toFixed(2)} $)` : ""}`,
            montant: Math.round(prog.billedAmount * 100) / 100,
          };
        });
    } else if (devis && type === "complete" && montantCumule < 0.01) {
      lignesFacture = devis.lignes.map((l) => ({
        description: detailLigne(l),
        montant: Math.round(l.quantite * (Number(l.prix_vendant) || 0) * 100) / 100,
      }));
    }
    if (lignesFacture) {
      const somme = lignesFacture.reduce((s, l) => s + l.montant, 0);
      if (lignesFacture.length === 0 || Math.abs(somme - montantFinal) > 0.011) lignesFacture = null;
    }
    onEmettre({
      montant: montantFinal,
      type,
      lignesFacture,
      detail:
        type === "pourcentage"
          ? `${pourcentage}%`
          : type === "echeance"
          ? `1/${frequence}`
          : type === "sur_mesure"
          ? "Items sélectionnés"
          : "Complète",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Facturation — {bon.projet}</h3>
            <p className="text-xs text-slate-500">
              {contrat ? `Contrat #${bon.devisNumero} — ${frequence} factures/an` : `Devis #${bon.devisNumero}`}
            </p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {!devis && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            {contrat ? "Contrat" : "Devis"} #{bon.devisNumero} introuvable dans l&apos;onglet Devis et dans QuickBooks — plafond basé sur le montant du bon de travail ({bon.montant.toFixed(2)} $) à la place.
          </div>
        )}
        {/* 🔎 Devis retrouvé DANS QUICKBOOKS (transition — devis fait
            avant l'application) : le solde et les lignes viennent de
            l'estimate. On le dit — l'admin doit savoir d'où sortent
            les chiffres qu'il plafonne. */}
        {devis?.sourceQbo && (
          <div className="mb-3 rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">
            🔎 Devis #{devis.numero} lu depuis <span className="font-bold">QuickBooks</span> ({(devis.lignes || []).length} ligne{(devis.lignes || []).length > 1 ? "s" : ""},
            total {devis.totalVendant.toFixed(2)} $ HT) — le solde restant et la facturation progressive se calculent sur lui.
            Si l&apos;estimate change dans QuickBooks, rouvre cette fenêtre pour relire.
          </div>
        )}

        <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Montant total du {contrat ? "contrat" : "devis"}</span>
            <span className="tabular-nums font-semibold">{montantDevis.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Cumul déjà facturé</span>
            <span className="tabular-nums font-semibold">{montantCumule.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800">
            <span>Solde restant disponible</span>
            <span className="tabular-nums">{montantRestant.toFixed(2)} $</span>
          </div>
        </div>

        <div className="mb-3 space-y-2">
          <label className="block text-xs font-bold text-slate-500">Option de facturation</label>
          {[
            ...(contrat
              ? [[
                  "echeance",
                  "Facturation selon échéance du contrat",
                  frequence === 1
                    ? "montant complet en une seule facture annuelle"
                    : `1/${frequence} du montant total (${frequence} factures par an)`,
                ]]
              : []),
            ["complete", "Facturation complète", "Facture le solde restant en une fois"],
            ["pourcentage", "Facturation par pourcentage", `Facture un % du montant total du ${contrat ? "contrat" : "devis"}`],
            ["sur_mesure", "Facturation sur mesure par item", "Choisir les items et quantités à facturer"],
          ].map(([id, label, desc]) => (
            <label
              key={id}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${
                type === id ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="typeFacturation"
                checked={type === id}
                onChange={() => setType(id)}
                className="mt-0.5 accent-[#FF6A13]"
              />
              <div>
                <p className="text-xs font-bold text-slate-800">{label}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
                {id === "echeance" && <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-800">{montantEcheance.toFixed(2)} $</p>}
              </div>
            </label>
          ))}
        </div>

        {type === "pourcentage" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold text-slate-500">Pourcentage à facturer</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                value={pourcentage}
                // 🧢 Plafonné au solde restant (2026-08-30) : le champ
                // DÉMARRE au % restant et s'arrête de lui-même là — pas
                // de 100 % impossible rabattu en silence.
                onChange={(e) => setPourcentage(Math.max(0, Math.min(100, Math.min(pctMaxDevis, parseFloat(e.target.value) || 0))))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-bold tabular-nums"
              />
              <span className="text-sm text-slate-500">% du devis</span>
              <span className="ml-auto text-sm font-bold tabular-nums text-slate-800">{montantCalcule.toFixed(2)} $</span>
            </div>
            {montantDevis > 0 && montantRestant < montantDevis - 0.005 && (
              <p className="mt-1 text-[10px] font-semibold text-amber-700">
                Maximum : {pctMaxDevis.toFixed(0)} % — le solde restant du devis ({montantRestant.toFixed(2)} $) plafonne cette facture. Le champ démarre à ce maximum.
              </p>
            )}
          </div>
        )}

        {type === "sur_mesure" && (
          <div className="mb-3 space-y-2">
            {!devis ? (
              <p className="text-xs text-slate-400">Détail des items indisponible — devis introuvable.</p>
            ) : (
              <>
                {devis.lignes.map((l) => {
                  const totalHT = l.quantite * (Number(l.prix_vendant) || 0);
                  const prog = progressionLigne(l);
                  const plafond = plafondPourLigne(l);
                  const pctMax = totalHT > 0 ? Math.round((plafond / totalHT) * 10000) / 100 : 0;
                  return (
                    <div key={l.uid} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{l.nom}</p>
                          <p className="text-[10px] text-slate-400">
                            {(Number(l.prix_vendant) || 0).toFixed(2)} $ × {l.quantite} — Total ligne : <span className="font-semibold text-slate-600">{totalHT.toFixed(2)} $</span>
                          </p>
                          {/* 🧢 Le curseur s'arrête ici : ce qui reste
                              facturable sur le devis, moins ce que les
                              autres lignes réclament déjà. */}
                          {plafond < totalHT - 0.005 && (
                            <p className="mt-0.5 text-[10px] font-semibold text-amber-700">
                              Maximum : {plafond.toFixed(2)} $ ({pctMax.toFixed(0)} %) — le solde restant du devis plafonne cette ligne.
                            </p>
                          )}
                        </div>
                        {/* Bascule du mode d'ajustement de CETTE ligne */}
                        <div className="flex shrink-0 rounded-lg border border-slate-200 p-0.5">
                          {["percent", "amount"].map((m) => (
                            <button
                              key={m}
                              onClick={() =>
                                m === "percent" ? majPourcentageLigne(l, prog.progressPercent) : majMontantLigne(l, prog.billedAmount)
                              }
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                prog.progressType === m ? "bg-[#131B2E] text-white" : "text-slate-400"
                              }`}
                            >
                              {m === "percent" ? "%" : "$"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step="1"
                          value={prog.progressPercent}
                          onChange={(e) => majPourcentageLigne(l, parseFloat(e.target.value) || 0)}
                          className="flex-1 accent-[#131B2E]"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="1"
                          value={prog.progressPercent}
                          onChange={(e) => majPourcentageLigne(l, parseFloat(e.target.value) || 0)}
                          className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-right tabular-nums"
                        />
                        <span className="text-slate-400">%</span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">Montant HT facturé pour cette situation</span>
                        <div className="flex w-24 items-center gap-0.5">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            min={0}
                            max={totalHT}
                            step="0.01"
                            value={prog.billedAmount}
                            onChange={(e) => majMontantLigne(l, parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-300 px-1.5 py-1 text-right font-bold tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="px-1 text-[10px] text-slate-400">
                  Ajuster le % ou le montant recalcule automatiquement l'autre — chaque ligne est plafonnée à son propre montant total.
                </p>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-800">
                  <span>Sous-total HT sélectionné</span>
                  <span className="tabular-nums">{montantSurMesure.toFixed(2)} $</span>
                </div>
              </>
            )}
          </div>
        )}

        {depasse && (
          <p className="mb-2 text-xs font-semibold text-red-600">
            Ce montant dépasse le solde restant du devis ({montantRestant.toFixed(2)} $) — impossible de dépasser le montant initial du devis.
          </p>
        )}

        {montantCalcule > 0 && (
          <div className="mb-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total HT facturé</span><span className="tabular-nums">{montantCalcule.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span><span className="tabular-nums">{tpsCalculee.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span><span className="tabular-nums">{tvqCalculee.toFixed(2)} $</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-slate-800">
              <span>Total TTC facturé</span><span className="tabular-nums">{totalTtcCalcule.toFixed(2)} $</span>
            </div>
          </div>
        )}

        <Button disabled={!peutEmettre} onClick={confirmer} className="w-full">
          Valider et envoyer cette facture ({montantCalcule.toFixed(2)} $ HT)
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// RÉVISION D'UN PRIX NON LISTÉ — l'admin ouvre la tâche
// manuellement, ajuste le prix ET la description, puis doit
// explicitement attester avoir tout validé avant que la tâche ne
// devienne éligible à l'envoi au client (fenêtre contextuelle de
// confirmation obligatoire — pas de déblocage silencieux).
// ============================================================
export function ModalReviserPrixNonListe({ bon, onFermer, onConfirmer, depotPaye, piecePrepayee, lignesSuggerees, bonEnrichi = null, nbFacturables = null, onCouvertParDepot = null, onRetirerFacturation = null, facturables = {}, onBasculerFacturable = null, adresseRepli = null }) {
  // Config entreprise (contexte) — la tranche de facturation s'affiche
  // dans le texte d'aide du temps supplémentaire.
  const configEnt = useEntreprise();
  // Liste de prix — le sélecteur d'items en a besoin. Elle manquait :
  // ouvrir la révision de prix plantait l'écran.
  const catalogue = useCatalogue();
  // Items séparés, chacun avec sa propre description et son propre
  // prix — au démarrage, soit les items déjà enregistrés sur ce bon
  // (s'il a déjà été révisé une fois), soit une seule ligne de départ
  // pré-remplie avec le montant global existant.
  //
  // APPEL PAYÉ D'AVANCE : la ligne de déduction du dépôt s'ajoute toute
  // seule (en négatif, hors taxes — les taxes du dépôt ont déjà été
  // perçues sur ce montant, celles de la facture se calculeront sur le
  // net). Compter sur la mémoire de la personne pour la taper à la
  // main, c'est exactement comme ça qu'un client paie deux fois.
  const [items, setItems] = useState(() => {
    if (bon.lignesNonListees?.length) return bon.lignesNonListees;
    const base = [{ id: `item-${Date.now()}`, description: bon.description || "", prix: bon.montant }];
    // BLOC 4 — temps supplémentaire calculé d'avance (heures réelles,
    // tranches de 15 min, taux réduit du passager). Le détail du calcul
    // est ÉCRIT dans la description : un client qui voit le calcul
    // conteste moins qu'un client qui voit un montant sorti de nulle part.
    (lignesSuggerees || []).forEach((l, i) => {
      base.push({ id: `supp-${Date.now()}-${i}`, description: l.description, prix: l.prix });
    });
    if (depotPaye) {
      base.push({
        id: `depot-${Date.now()}`,
        description: `Dépôt perçu d'avance${depotPaye.payeLe ? ` le ${new Date(depotPaye.payeLe).toLocaleDateString("fr-CA")}` : ""} — appel de service payé d'avance`,
        prix: -(Number(depotPaye.montantHT) || 0),
      });
    }
    // BLOC 3 — pièce déjà payée par le client (option « payer avant la
    // commande ») : déduite d'office pour ne JAMAIS être chargée deux fois.
    if (piecePrepayee) {
      base.push({
        id: `piece-${Date.now()}`,
        description: `Pièce payée d'avance par le client — ${piecePrepayee.pieceRequise}`,
        prix: -(Number(piecePrepayee.montantPiece) || 0),
      });
    }
    return base;
  });
  const [attestation, setAttestation] = useState(false);

  // 🔁 RESYNCHRONISATION DES LIGNES SUGGÉRÉES (2026-09-04) : quand un
  // 💰/🤝 bascule dans le récit ci-contre, le parent recalcule
  // lignesSuggerees — les lignes auto (« supp- ») sont remplacées par
  // les fraîches, SANS toucher à la ligne de description, aux
  // déductions (dépôt/pièce) ni aux items ajoutés à la main. Une
  // révision déjà enregistrée (lignesNonListees) n'est jamais réécrite.
  // (Une ligne auto modifiée à la main est régénérée au prochain
  // basculement — le prix de vérité, c'est le calcul.)
  const cleSuggestions = JSON.stringify(lignesSuggerees || []);
  const premiereCleRef = useRef(cleSuggestions);
  useEffect(() => {
    if (bon.lignesNonListees?.length) return;
    if (premiereCleRef.current === cleSuggestions) return; // montage : rien à refaire
    premiereCleRef.current = cleSuggestions;
    setItems((prev) => {
      const sansAuto = prev.filter((it) => !String(it.id).startsWith("supp-"));
      const fraiches = (lignesSuggerees || []).map((l, i) => ({ id: `supp-${Date.now()}-${i}`, description: l.description, prix: l.prix }));
      // Les suggestions reprennent leur place : après la 1re ligne (la
      // description de la job), avant les déductions et ajouts manuels.
      return [...sansAuto.slice(0, 1), ...fraiches, ...sansAuto.slice(1)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleSuggestions]);

  const total = items.reduce((s, it) => s + (parseFloat(it.prix) || 0), 0);
  // ============================================================
  // CE QUI BLOQUE VRAIMENT UNE FACTURE (revu le 2026-08-24)
  // ------------------------------------------------------------
  // Avant : CHAQUE ligne devait porter un prix ≠ 0. La règle visait un
  // oubli de montant, mais elle ne faisait pas la différence entre
  // « j'ai oublié le prix » et « cette ligne EXPLIQUE au client ce qui
  // a été fait ». Le bureau écrit le déroulement du chantier sur une
  // ligne à 0 $ et la ligne facturable en dessous : c'est légitime, et
  // c'était refusé.
  //
  // Ce qui reste interdit, et pour de vraies raisons :
  //   • une description vide — une ligne muette sur la facture ;
  //   • un total à zéro ou négatif — on n'émet pas ça, jamais.
  // Un prix négatif sur UNE ligne reste permis (déduction de dépôt).
  const descriptionVide = items.some((it) => it.description.trim().length === 0);
  const nbLignesExplication = items.filter((it) => (parseFloat(it.prix) || 0) === 0).length;
  const peutValider = items.length > 0 && !descriptionVide && total > 0 && attestation;
  // Le bouton gris DIT pourquoi il est gris (règle du projet — et c'est
  // exactement là-dessus que le propriétaire a buté le 24 août).
  const raisonsBlocage = [
    descriptionVide ? "Une ligne n'a pas de description — le client verrait un montant sans explication." : null,
    total <= 0 ? "Le total doit être positif : au moins une ligne doit porter un montant à facturer." : null,
    !attestation ? "Coche la case de confirmation ci-dessus." : null,
  ].filter(Boolean);

  const majItem = (id, champs) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...champs } : it)));
  };

  const ajouterItem = () => {
    setItems((prev) => [...prev, { id: `item-${Date.now()}`, description: "", prix: 0 }]);
  };

  // Ajoute un item pré-rempli à partir du catalogue de produits
  // existant — l'admin peut ensuite ajuster la description ou le prix
  // au besoin, sans repartir d'une case vide.
  // 📝 LA DESCRIPTION COMPLÈTE SUIT (2026-08-24, retour du propriétaire).
  // Seul le NOM du produit était recopié : « Midea 28 18000 BTU » au lieu
  // des modèles, de la garantie et de ce qui est inclus. Or ce texte-ci
  // n'est pas une note interne — c'est ce que le CLIENT lit sur sa
  // facture. Il fallait donc le retaper à la main, ou le client recevait
  // une ligne muette pour 5 050 $.
  const ajouterDepuisCatalogue = (produit) => {
    if (!produit) return;
    const detail = String(produit.description || "").trim();
    const nom = String(produit.nom || "").trim();
    // Nom en tête, détail en dessous — sauf si le détail répète déjà le
    // nom (certaines fiches du catalogue commencent par leur propre nom).
    const texte = !detail ? nom : detail.toUpperCase().startsWith(nom.toUpperCase()) ? detail : `${nom}\n${detail}`;
    setItems((prev) => [...prev, { id: `item-${Date.now()}`, description: texte, prix: produit.prix_vendant ?? 0 }]);
  };

  const retirerItem = (id) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* 🖥️ DEUX PANNEAUX CÔTE À CÔTE (2026-09-03, demande du
          propriétaire : « difficile de facturer en remontant toujours de
          haut en bas ») — le DOSSIER à gauche (récit, notes, alertes),
          l'ACTION à droite (items, total, sorties), chacun avec son
          propre ascenseur : les notes du technicien restent sous les
          yeux pendant qu'on tape les prix. Sur écran étroit, tout
          retombe en une colonne comme avant. */}
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl bg-white lg:max-w-5xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-5 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Réviser le prix non listé</h3>
            <p className="text-xs text-slate-500">{bon.projet} · {bon.client}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        {/* ---- PANNEAU GAUCHE : LE DOSSIER (lecture) ---- */}
        <div className="p-5 pt-3 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-slate-100">
        <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          Ce travail contient un prix qui n'existe pas dans le catalogue — vérifie chaque item avant d'autoriser l'envoi au client.
        </div>

        {/* 📋 LE RÉCIT DE LA JOB (2026-09-03, demande du propriétaire :
            « ça me prend les détails et notes de la job ») — on fixe un
            prix avec le déroulement sous les yeux : la description des
            travaux, les heures 💰/🤝 de chaque technicien et leurs notes
            de terrain. Lecture seulement — rien ne part sur la facture
            sans passer par les lignes ci-dessous. */}
        {(() => {
          const be = bonEnrichi || bon;
          const notes = (be.lignesReelles || []).filter((t) => (t.noteTerrain || "").trim() || (t.noteInterne || "").trim());
          const equipe = be.equipe || [];
          if (!be.description && notes.length === 0 && equipe.length === 0) return null;
          return (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">📋 La job — détails et notes</p>
              {/* 📄 Devis associé · 📍 adresse des travaux · 💰 hommes
                  facturables (2026-09-03) — les repères de base pour
                  fixer un prix sans fouiller ailleurs. */}
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-slate-600">
                {be.devisNumero && <span>📄 Devis {be.devisNumero}</span>}
                {/* 📍 SANS adresse de travaux distincte (2026-09-06,
                    question du propriétaire : « pourquoi l'adresse
                    n'apparaît pas ? ») : la convention veut que null =
                    même adresse que la facturation — alors on MONTRE
                    l'adresse de facturation au lieu de rien. */}
                {be.adresseTravaux ? (
                  <span>📍 {be.adresseTravaux}</span>
                ) : adresseRepli ? (
                  <span>📍 {adresseRepli} <span className="font-normal text-slate-400">(adresse de facturation)</span></span>
                ) : null}
                {nbFacturables != null && equipe.length > 0 && (
                  <span className="text-emerald-700">💰 {nbFacturables} homme{nbFacturables > 1 ? "s" : ""} facturable{nbFacturables > 1 ? "s" : ""} sur {equipe.length}</span>
                )}
              </p>
              {be.description && (
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{be.description}</p>
              )}
              {equipe.length > 0 && (
                <div className="mt-1.5">
                  {/* 💰/🤝 BASCULABLE ICI MÊME (2026-09-04, demande du
                      propriétaire — le cas Pascale Lapointe : deux temps
                      supplémentaires alors qu'un seul homme devait être
                      facturable, et il fallait retourner dans l'agenda
                      pour le corriger). Un clic bascule, la base est mise
                      à jour, et les lignes de temps suggérées à droite se
                      recalculent immédiatement. */}
                  <div className="flex flex-wrap gap-1.5">
                    {equipe.map((e) => {
                      const email = (e.courriel || "").toLowerCase();
                      const fact = facturables[`${be.tacheId || ""}|${email}`] !== false;
                      const basculable = !!onBasculerFacturable && !!email;
                      return (
                        <button
                          key={email || e.nom}
                          type="button"
                          disabled={!basculable}
                          onClick={() => onBasculerFacturable?.(be.tacheId, e.courriel, !fact)}
                          title={basculable ? (fact ? "Cliquer pour passer NON facturable (aide interne)" : "Cliquer pour passer FACTURABLE") : ""}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                            fact ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-500"
                          } ${basculable ? "cursor-pointer hover:opacity-80" : ""}`}
                        >
                          {fact ? "💰" : "🤝"} {e.nom} · {e.heures.toFixed(2)} h
                        </button>
                      );
                    })}
                  </div>
                  {onBasculerFacturable && (
                    <p className="mt-1 text-[9px] text-slate-400">
                      Clique un technicien pour basculer 💰 facturable / 🤝 aide interne — les lignes de temps se recalculent.
                    </p>
                  )}
                </div>
              )}
              {notes.map((t, i) => (
                <div key={i} className="mt-1.5 rounded-lg bg-white p-2">
                  <p className="text-[10px] font-bold text-slate-500">📝 {t.employeNom || t.employeEmail || "Technicien"}</p>
                  {(t.noteTerrain || "").trim() && <p className="whitespace-pre-wrap text-[11px] text-slate-700">{t.noteTerrain}</p>}
                  {(t.noteInterne || "").trim() && (
                    <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-amber-700">🔒 Interne : {t.noteInterne}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {depotPaye && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            💰 Ce client a DÉJÀ payé un dépôt de {(Number(depotPaye.montantHT) || 0).toFixed(2)} $ + taxes
            {depotPaye.payeLe ? ` le ${new Date(depotPaye.payeLe).toLocaleDateString("fr-CA")}` : ""} (appel payé d'avance).
            La ligne de déduction a été ajoutée automatiquement — ne l'enlève pas, sinon le client paierait deux fois.
          </div>
        )}
        {piecePrepayee && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            💰 La pièce « {piecePrepayee.pieceRequise} » a DÉJÀ été payée par le client
            ({(Number(piecePrepayee.montantPiece) || 0).toFixed(2)} $ HT) avant la commande.
            La déduction est ajoutée automatiquement — ne facture pas la pièce une deuxième fois.
          </div>
        )}
        {(lignesSuggerees || []).length > 0 && !bon.lignesNonListees?.length && (
          <div className="mb-3 rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">
            ⏱️ Le temps au-delà du temps inclus a été calculé automatiquement (tranches de {Number(configEnt?.trancheFacturationMin) || 15} min entamées,
            taux réduit pour un passager du même camion). Les lignes sont modifiables ou effaçables — c'est toi qui as le dernier mot.
          </div>
        )}
        </div>

        {/* ---- PANNEAU DROIT : L'ACTION (items, total, sorties) ---- */}
        <div className="space-y-3 p-5 pt-3 lg:min-h-0 lg:overflow-y-auto">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500">Items à facturer (description + prix séparés)</label>
            {items.map((it, i) => (
              <div key={it.id} className="rounded-xl border border-slate-200 p-2.5">
                <div className="flex items-start gap-2">
                  {/* Hauteur suivant le texte : une description de
                      catalogue fait plusieurs lignes (modèles, garantie,
                      ce qui est inclus) et se lisait par une fente de
                      deux lignes. Plafonnée à 30 rangées — au-delà, la
                      barre de défilement reprend. */}
                  <textarea
                    value={it.description}
                    onChange={(e) => majItem(it.id, { description: e.target.value })}
                    rows={hauteurDescription(it.description)}
                    placeholder={`Description de l'item ${i + 1}...`}
                    className="w-full resize-y rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm leading-snug"
                  />
                  {items.length > 1 && (
                    <button onClick={() => retirerItem(it.id)} className="mt-1 shrink-0 text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {/* 🔢 QTÉ × PRIX UNITAIRE (2026-09-04, demande du
                    propriétaire) : remplir le prix unitaire fait
                    calculer le total tout seul (« 5 × 12,50 = 62,50 »)
                    et la quantité voyage jusqu'à la colonne Qté de
                    QuickBooks. Prix unitaire vide = mode simple, le
                    Prix se tape directement comme avant. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Qté</span>
                  <input
                    type="number" min={0} step="0.01" value={it.quantite ?? 1}
                    onChange={(e) => {
                      const q = parseFloat(e.target.value) || 0;
                      const pu = parseFloat(it.prixUnitaire) || 0;
                      majItem(it.id, { quantite: q, ...(pu > 0 ? { prix: Math.round(q * pu * 100) / 100 } : {}) });
                    }}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                  />
                  <span className="text-[11px] text-slate-400">× Prix unitaire ($)</span>
                  <input
                    type="number" min={0} step="0.01" value={it.prixUnitaire ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const pu = parseFloat(e.target.value) || 0;
                      const q = Number(it.quantite) > 0 ? Number(it.quantite) : 1;
                      majItem(it.id, { prixUnitaire: e.target.value === "" ? "" : pu, ...(pu > 0 ? { prix: Math.round(q * pu * 100) / 100, quantite: q } : {}) });
                    }}
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                  />
                  <span className="text-[11px] text-slate-400">= Prix ($)</span>
                  <input
                    type="number" min={0} step="0.01" value={it.prix}
                    readOnly={parseFloat(it.prixUnitaire) > 0}
                    title={parseFloat(it.prixUnitaire) > 0 ? "Calculé : quantité × prix unitaire (vide le prix unitaire pour taper le total à la main)" : ""}
                    onChange={(e) => majItem(it.id, { prix: parseFloat(e.target.value) || 0 })}
                    className={`w-28 rounded-lg border px-2 py-1 text-right text-sm font-bold tabular-nums ${parseFloat(it.prixUnitaire) > 0 ? "border-slate-200 bg-slate-50 text-slate-600" : "border-slate-300"}`}
                  />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-1.5">
              <SelecteurItem catalogue={catalogue} onChoisir={ajouterDepuisCatalogue} libelle="Depuis le catalogue…" />
              <Button variant="outline" onClick={ajouterItem} className="min-h-0 gap-1.5 py-2 text-xs">
                <Plus size={13} /> Item personnalisé
              </Button>
            </div>
          </div>

          {/* Une ligne à 0 $ est VOULUE la plupart du temps (elle
              explique le travail au client) — mais si c'est un prix
              oublié, il faut le voir. On le nomme sans bloquer. */}
          {nbLignesExplication > 0 && (
            <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-slate-500">
              📝 {nbLignesExplication} ligne{nbLignesExplication > 1 ? "s" : ""} à 0 $ — elle
              {nbLignesExplication > 1 ? "s apparaîtront" : " apparaîtra"} sur la facture du client comme
              explication, sans montant. Si c&apos;est un prix oublié, c&apos;est le moment de le voir.
            </p>
          )}

          <div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
            <span>Total à facturer (HT)</span>
            <span className="tabular-nums">{total.toFixed(2)} $</span>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} className="mt-0.5 accent-[#131B2E]" />
            <span className="text-xs font-semibold text-amber-800">
              Je confirme avoir vérifié et validé chaque item et son prix — prêt pour l'envoi au client.
            </span>
          </label>

          {raisonsBlocage.length > 0 && (
            <ul className="space-y-0.5 text-[11px] font-semibold leading-snug text-slate-400">
              {raisonsBlocage.map((r) => <li key={r}>• {r}</li>)}
            </ul>
          )}
          <Button disabled={!peutValider} onClick={() => onConfirmer(items, total)} className="w-full">
            Valider et débloquer pour l&apos;envoi
          </Button>

          {/* ✅ LE DÉPÔT COUVRE TOUT (2026-09-03, demande du
              propriétaire : « il ne faut pas faire une facture de
              -260 — le client tomberait en crédit dans QuickBooks »).
              Quand le dépôt PAYÉ égale le travail, il n'y a RIEN à
              facturer : la facture de dépôt déjà payée dans QuickBooks
              EST la facture officielle. Ce bouton ferme le bon sans
              créer quoi que ce soit — zéro crédit, zéro doublon. */}
          {depotPaye && onCouvertParDepot && (
            <button
              onClick={onCouvertParDepot}
              className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 py-2.5 text-xs font-extrabold text-emerald-800 active:scale-[0.99]"
            >
              ✅ Rien à facturer — le dépôt de {(Number(depotPaye.montantHT) || 0).toFixed(2)} $ couvre le travail au complet
            </button>
          )}

          {/* 🛡️ SORTIE « NON FACTURABLE » (2026-09-03, demande du
              propriétaire : « je n'ai pas l'option d'envoyer cette tâche
              dans non facturable sous garantie ») — le chemin existait
              sur la carte du bon, pas ici où la décision se prend.
              Ouvre la même fenêtre de retrait (garantie / client
              maison / travaux en cours), validation Admin principal
              comme toujours. */}
          {onRetirerFacturation && (
            <button
              onClick={onRetirerFacturation}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-600 active:scale-[0.99]"
            >
              🛡️ Ne pas facturer — retirer (garantie / client maison)…
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APERÇU DE LA FACTURE — VERSION CLIENT
// ------------------------------------------------------------
// Même principe que le devis et le bon de travail : coordonnées
// d'entreprise complètes, description du travail facturé, ventilation
// TPS/TVQ. S'il y a des factures progressives déjà émises, montre la
// dernière ; sinon, montre le montant total à facturer.
// ============================================================
export function ApercuFactureClient({ bon, onFermer }) {
  const fiche = (useClients() || []).find((c) => c.nom === bon.client);
  // Devis d'origine — c'est lui qui porte le détail que le client a
  // accepté. Sans ça, la facture ne montrait qu'un montant global.
  const devisFacture = (useDevis() || []).find((d) => d.numero === bon.devisNumero);
  const derniereFacture = (bon.facturesEmises || [])[bon.facturesEmises?.length - 1];
  const montant = derniereFacture?.montant ?? bon.montant;
  const numero = derniereFacture?.numeroFactureQb || "À émettre";
  const date = derniereFacture?.date || bon.date;
  const configEnt = useEntreprise();
  const { tps, tvq, total } = calculerTaxes(montant, configEnt);

  return (
    // Fermeture au clic sur le fond (retour du propriétaire 2026-08-30 :
    // « je dois obligatoirement peser sur le X ») — surligner du texte à
    // l'intérieur ne ferme pas (règle du 2026-08-19 : cible exacte).
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-500">Aperçu — version envoyée au client</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-sm">
          <EnTeteEntreprise />
          <p className="mt-3 text-lg font-extrabold text-[#131B2E]">FACTURE {numero}</p>
          <p className="text-xs text-slate-500">Date : {date}</p>
          <AdressesDocument
            clientNom={bon.client}
            adresseFacturation={adresseFacturationClient(fiche)}
            adresseTravaux={bon.adresseTravaux}
          />

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Description</p>
            {/* FACTURE ISSUE D'UN DEVIS : on reprend LES LIGNES DU DEVIS.
                La facture n'affichait qu'un mot tapé au moment de
                facturer (« Complète ») et un montant. Le client
                recevait 19 430 $ sans savoir pour quoi — alors qu'il
                avait accepté un devis détaillé. Reprendre ses lignes,
                c'est lui montrer exactement ce qu'il a approuvé. */}
            {devisFacture?.lignes?.length > 0 && !(bon.lignesNonListees?.length > 0) ? (
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {devisFacture.lignes.map((l) => (
                    <tr key={l.uid} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-2 text-slate-700">
                        <span className="font-semibold">{l.nom}</span>
                        {l.description ? (
                          <span className="mt-0.5 block whitespace-pre-line text-[10px] leading-snug text-slate-500">
                            {l.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-center tabular-nums text-slate-500">{l.quantite}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold text-slate-800">
                        {((Number(l.prix_vendant) || 0) * (Number(l.quantite) || 0)).toFixed(2)} $
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : bon.lignesNonListees?.length > 0 ? (
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {/* Ligne à 0 $ = explication, pas un montant nul : on
                      laisse la colonne de droite VIDE. « 0.00 $ » à côté
                      d'un texte d'explication se lit comme une erreur de
                      facturation. Et `whitespace-pre-line` conserve les
                      retours de ligne du technicien. */}
                  {bon.lignesNonListees.map((it) => {
                    const montant = parseFloat(it.prix) || 0;
                    return (
                      <tr key={it.id} className="border-b border-slate-100 align-top">
                        <td className={`py-1 pr-2 whitespace-pre-line ${montant === 0 ? "text-slate-500" : "text-slate-700"}`}>
                          {it.description}
                        </td>
                        <td className="py-1 text-right tabular-nums font-semibold text-slate-800">
                          {montant === 0 ? "" : `${montant.toFixed(2)} $`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {derniereFacture?.detail || bon.description || bon.projet}
              </p>
            )}
          </div>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{montant.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span><span className="tabular-nums">{tps.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span><span className="tabular-nums">{tvq.toFixed(2)} $</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{total.toFixed(2)} $</span>
            </div>
          </div>

          <TermesConditions />

          <PiedDocument />
        </div>

        <BoutonPDF type="facture" bon={{ ...bon, adresseFacturation: bon?.adresseFacturation || adresseFacturationClient(fiche) }} />

        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — la facture réelle est générée et envoyée via QuickBooks, avec ce même contenu.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// FENÊTRE D'AVANT-ENVOI — le choix de paiement PAR FACTURE
// ------------------------------------------------------------
// Règle validée avec le propriétaire : pour tout ce qui n'est pas un
// dépôt d'appel de service, offrir la carte ou le virement est une
// DÉCISION HUMAINE, facture par facture — cases décochées par défaut,
// et les frais du marchand affichés en DOLLARS sur le montant réel
// (2,9 % sur 8 450 $, ça se juge mieux en voyant « ≈ 245 $ »).
// Ces frais ne s'ajoutent JAMAIS à la facture du client (LPC Québec).
// ============================================================
// ❌ ANNULER UNE FACTURE LIBRE — la note est OBLIGATOIRE : c'est elle
// qui devient la preuve comptable dans QuickBooks (qui, quand, pourquoi
// — la comptable la lira dans le mémo interne de la facture annulée).
export function ModalAnnulationFactureLibre({ facture, onFermer, onAnnuler }) {
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">❌ Annuler la facture {facture.docNumber}</h3>
            <p className="text-xs text-slate-500">{facture.clientNom} · {facture.montantHT.toFixed(2)} $ HT</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>
        <p className="text-[11px] text-slate-500">
          La facture sera annulée dans QuickBooks (VOID — elle reste au registre à 0 $, jamais supprimée), et ta
          raison sera écrite dans son mémo interne : la preuve comptable voyage avec elle.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Raison de l'annulation (obligatoire) — ex : facturée en double, erreur de montant…"
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#FF6A13]"
        />
        {note.trim().length < 5 && (
          <p className="mt-1 text-[10px] text-slate-400">Écris la raison (au moins quelques mots) — elle sert de preuve comptable.</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Retour</Button>
          <Button
            variant="danger"
            disabled={note.trim().length < 5}
            loading={enCours}
            loadingText="Annulation…"
            onClick={async () => {
              setEnCours(true);
              await onAnnuler(note.trim());
            }}
            className="min-h-0 py-2 text-xs"
          >
            Annuler la facture
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ModalChoixPaiementFacture({ montant, clientNom, onFermer, onEmettre }) {
  const [carte, setCarte] = useState(false);
  const [virement, setVirement] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const fraisCarte = montant * 0.029 + 0.25;
  const fraisVirement = montant * 0.01;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-slate-900">💳 Paiement en ligne pour cette facture ?</h3>
        <p className="mt-1 text-xs text-slate-500">
          {montant.toFixed(2)} $ — {clientNom || "client"}. Les frais indiqués sont TON coût de marchand : ils ne
          s'ajoutent jamais à la facture du client (loi québécoise).
        </p>
        <div className="mt-3 space-y-2">
          <label className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${carte ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={carte} onChange={(e) => setCarte(e.target.checked)} className="h-4 w-4 accent-[#131B2E]" />
              Carte de crédit
            </span>
            <span className="tabular-nums text-slate-400">frais ≈ {fraisCarte.toFixed(2)} $</span>
          </label>
          <label className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${virement ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={virement} onChange={(e) => setVirement(e.target.checked)} className="h-4 w-4 accent-[#131B2E]" />
              Virement bancaire
            </span>
            <span className="tabular-nums text-slate-400">frais ≈ {fraisVirement.toFixed(2)} $</span>
          </label>
          {!carte && !virement && (
            <p className="text-[10px] text-slate-400">Rien de coché = le client paie par Interac ou chèque — aucuns frais.</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button
            loading={envoiEnCours}
            onClick={async () => {
              setEnvoiEnCours(true);
              await onEmettre({ carte, virement });
            }}
            className="min-h-0 py-2 text-xs"
          >
            Émettre la facture
          </Button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// ➕ FACTURE LIBRE — facturer SANS tâche ni bon de travail
// ------------------------------------------------------------
// Demande du propriétaire (2026-08-28) : « comment on peut créer une
// facture sans tâche ? ». Jusqu'ici, toute facture partait d'un bon de
// travail — donc d'un chantier. Or il y a de vrais cas sans chantier :
// vente de matériel au comptoir, contrat d'entretien facturé d'avance,
// frais d'annulation, refacturation d'une pièce.
//
// La route QuickBooks n'a JAMAIS eu besoin d'une tâche (client + lignes
// suffisent) : il ne manquait que cet écran.
//
// 🔗 RATTACHEMENT À UN PROJET (choix du propriétaire) : la facture peut
// compter dans la rentabilité d'un chantier en cours. On le fait avec
// la mécanique d'attribution qui existe déjà (qb_attributions_manuelles) —
// la facture créée porte l'identifiant « QBO-INV-<id> », exactement la
// forme que la synchronisation QuickBooks utilise. Sans projet choisi,
// elle est attribuée au CLIENT : elle ne tombe donc jamais dans la pile
// « factures QuickBooks à rattacher ».
// ============================================================
export function ModalFactureLibre({ clients, projets, catalogue, configEnt, onFermer, onContinuer }) {
  const [clientId, setClientId] = useState("");
  const [recherche, setRecherche] = useState("");
  const [projetId, setProjetId] = useState("");
  const [reference, setReference] = useState("");
  const [lignes, setLignes] = useState([]);

  const client = (clients || []).find((c) => c.id === clientId) || null;
  const resultatsClients = useMemo(() => {
    const t = recherche.trim().toLowerCase();
    const base = clients || [];
    if (!t) return base.slice(0, 8);
    // `correspond` prend la FICHE (elle cherche dans le nom, l'entreprise,
    // les courriels, le téléphone et l'adresse), pas une chaîne montée
    // à la main.
    return base.filter((c) => correspond(c, t)).slice(0, 8);
  }, [clients, recherche]);

  // Projets proposés : ceux DU CLIENT CHOISI, et ouverts seulement.
  // (2026-08-28 — « ne pas montrer les projets de tous les clients,
  // seulement ceux qui vont avec le nom du client ».) Rattacher une
  // facture au chantier d'un autre client fausserait SA rentabilité.
  // Rappel : un projet ne naît que d'un devis ACCEPTÉ (le bouton
  // « Traiter le devis » n'apparaît pas avant) ou d'une tâche réelle.
  const projetsOuverts = (projets || []).filter(
    (p) => p.statut !== "Terminé" && p.statut !== "Annulé" && client && p.clientId === client.id
  );

  // 📝 Nom ET description du produit (2026-09-03) — même règle que la
  // facture maison : la ligne raconte le produit au complet.
  const ajouterLigne = (item) =>
    setLignes((prev) => [
      ...prev,
      {
        uid: `l-${Date.now()}-${prev.length}`,
        description: item ? [item.nom, item.description].filter(Boolean).join("\n") : "",
        quantite: 1,
        prix: item?.prix_vendant ?? "",
      },
    ]);
  const majLigne = (uid, champs) => setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...champs } : l)));
  const retirerLigne = (uid) => setLignes((prev) => prev.filter((l) => l.uid !== uid));

  const lignesValides = lignes.filter((l) => String(l.description || "").trim());
  const sousTotal = lignesValides.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
  const taxes = calculerTaxes(sousTotal, configEnt);
  const peutContinuer = !!client && lignesValides.length > 0 && sousTotal > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">➕ Nouvelle facture</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Sans tâche ni bon de travail — vente au comptoir, contrat, frais, refacturation.
            </p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 pt-3">
          {/* CLIENT — une fiche existante seulement : facturer un nom
              libre créerait un client dans QuickBooks sans fiche ici,
              exactement le genre d'orphelin qu'on passe son temps à
              réconcilier. */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Client *</label>
            {client ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-[#FF6A13] bg-orange-50 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-bold text-slate-800">{nomAffichageClient(client)}</span>
                {/* Changer de client remet le projet à zéro : un chantier
                    d'un AUTRE client n'a plus de sens ici. */}
                <button onClick={() => { setClientId(""); setRecherche(""); setProjetId(""); }} className="shrink-0 text-[11px] font-bold text-slate-500 underline">changer</button>
              </div>
            ) : (
              <>
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="🔍 Cherche un client par nom, entreprise ou téléphone…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {/* ⚠️ Ces lignes ressemblaient à des champs remplis : on
                    croyait le client DÉJÀ choisi, et « Continuer » restait
                    gris sans dire pourquoi. Elles annoncent maintenant
                    qu'elles se cliquent. */}
                <p className="mt-1 text-[10px] font-semibold text-slate-400">👇 Clique sur le client pour le choisir</p>
                <div className="mt-0.5 max-h-[130px] overflow-y-auto rounded-lg border border-slate-200">
                  {resultatsClients.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-400">
                      Aucun client trouvé — crée sa fiche dans l&apos;onglet Clients d&apos;abord.
                    </p>
                  ) : (
                    resultatsClients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setClientId(c.id)}
                        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-orange-50"
                      >
                        <span className="min-w-0 truncate">{nomAffichageClient(c)}</span>
                        <span className="shrink-0 text-[10px] font-bold text-[#FF6A13]">choisir →</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* LIGNES */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-500">Lignes de la facture *</label>
              <div className="flex gap-1.5">
                <SelecteurItem catalogue={catalogue} onChoisir={ajouterLigne} libelle="+ Du catalogue" />
                <Button variant="outline" onClick={() => ajouterLigne(null)} className="min-h-0 px-2.5 py-1 text-[11px]">
                  + Ligne libre
                </Button>
              </div>
            </div>
            {lignes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[11px] text-slate-400">
                Aucune ligne — ajoute un produit du catalogue ou une ligne écrite à la main.
              </p>
            ) : (
              <div className="space-y-1.5">
                {lignes.map((l) => (
                  <div key={l.uid} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-start gap-1.5">
                      <textarea
                        value={l.description}
                        onChange={(e) => majLigne(l.uid, { description: e.target.value })}
                        rows={1}
                        placeholder="Description (ex. : Filtre 20x25 — vente comptoir)"
                        className="min-w-0 flex-1 resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <button onClick={() => retirerLigne(l.uid)} title="Retirer cette ligne" className="shrink-0 pt-1.5 text-slate-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">Qté</span>
                      <InputNombreDecimal valeur={l.quantite} onChange={(v) => majLigne(l.uid, { quantite: v })} className="w-[64px] rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      <span className="text-[10px] text-slate-400">×</span>
                      <InputNombreDecimal valeur={l.prix} onChange={(v) => majLigne(l.uid, { prix: v })} className="w-[86px] rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      <span className="text-[10px] font-bold text-slate-400">$</span>
                      <span className="ml-auto text-xs font-bold tabular-nums text-slate-700">
                        {((Number(l.quantite) || 0) * (Number(l.prix) || 0)).toFixed(2)} $
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RATTACHEMENT + RÉFÉRENCE */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">🔗 Rattacher à un projet</label>
              <select
                value={projetId}
                onChange={(e) => setProjetId(e.target.value)}
                disabled={!client}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">— aucun (facture indépendante) —</option>
                {projetsOuverts.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {!client
                  ? "Choisis d'abord le client — seuls SES chantiers en cours seront proposés."
                  : projetsOuverts.length === 0
                    ? `Aucun chantier en cours pour ${nomAffichageClient(client)}.`
                    : "Son montant entrera dans la rentabilité du projet — la synchronisation QuickBooks se fait toute seule après l'envoi."}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Référence (facultatif)</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex. : vente comptoir, contrat 2026"
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
              />
            </div>
          </div>

          {/* TOTAUX — les mêmes taux de taxes que partout ailleurs */}
          <div className="rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{sousTotal.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS</span><span className="tabular-nums">{taxes.tps.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ</span><span className="tabular-nums">{taxes.tvq.toFixed(2)} $</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-sm font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{taxes.total.toFixed(2)} $</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Les taxes sont calculées par QuickBooks sur la facture officielle — ce total est l&apos;aperçu.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 p-5 pt-3">
          {/* CE QUI MANQUE, ÉCRIT NOIR SUR BLANC — un bouton gris sans
              explication laisse croire qu'il est brisé (règle de la
              maison, apprise sur le bouton « Ajouter une zone »). */}
          {!peutContinuer && (
            <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800">
              Pour continuer, il manque :{" "}
              {[
                !client ? "choisir un client dans la liste" : null,
                lignesValides.length === 0 ? "au moins une ligne" : sousTotal <= 0 ? "un montant supérieur à 0 $" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button
            disabled={!peutContinuer}
            title={peutContinuer ? "" : "Choisis un client et ajoute au moins une ligne avec un montant"}
            onClick={() =>
              onContinuer({
                client,
                projetId: projetId || null,
                reference: reference.trim(),
                lignes: lignesValides.map((l) => ({
                  description: String(l.description).trim(),
                  montant: (Number(l.quantite) || 0) * (Number(l.prix) || 0),
                  quantite: Number(l.quantite) || 0,
                })),
                sousTotal,
              })
            }
          >
            Continuer →
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


export function OngletFacturation({ bons, setBons, ajouterJournal, devisListe, clients, depots, pieces, inspections, prixDepots, estAdminPrincipal, onAjouterCourrielClient, facturablesAssignations = {}, onBasculerFacturable = null, assignationsST = [], onMarquerSTFacture, travaux = [], zonePourTache = null, achatsLibres = [], nomsEmployes = {}, projets = [], nomAdmin = null, onSynchroniserQb = null, qbConnecte = null }) {
  // 📦 Éditeur du matériel de stock d'un bon — { bonId, items } | null.
  const [materielStockPour, setMaterielStockPour] = useState(null);
  const catalogueFacturation = useCatalogue();
  // ➕ Facture libre (sans tâche) — saisie, puis destinataires, puis
  // paiements : le même enchaînement que toutes les autres factures.
  const [factureLibreOuverte, setFactureLibreOuverte] = useState(false);
  const [courrielFactureLibre, setCourrielFactureLibre] = useState(null);
  // 🧾 Le registre des factures sans chantier — visibles, vérifiables,
  // renvoyables (la table est vide tant que le snippet 105 n'est pas passé).
  const [facturesLibres, setFacturesLibres] = useState([]);
  useEffect(() => {
    listerFacturesLibres().then(setFacturesLibres).catch(() => {});
  }, []);
  // ❌ ANNULATION D'UNE FACTURE LIBRE (2026-08-31, demande du
  // propriétaire) : VOID dans QuickBooks + NOTE COMPTABLE transférée
  // (mémo interne : qui, quand, pourquoi) + statut « annulée » ici.
  const [annulationLibre, setAnnulationLibre] = useState(null);
  const annulerFactureLibre = async (fl, note) => {
    const r = await annulerFactureQbo(fl.qboInvoiceId, note);
    if (r?.erreur) {
      ajouterJournal(`⚠️ Annulation de la facture ${fl.docNumber} REFUSÉE : ${r.erreur}`);
      return;
    }
    const patch = {
      statut: "annulee",
      annuleeLe: new Date().toISOString(),
      annulationNote: note || "",
      annuleePar: nomAdmin || "",
    };
    try {
      const maj = await majFactureLibre(fl.id, patch);
      setFacturesLibres((prev) => prev.map((x) => (x.id === fl.id ? maj : x)));
    } catch {
      setFacturesLibres((prev) => prev.map((x) => (x.id === fl.id ? { ...x, ...patch } : x)));
    }
    ajouterJournal(
      `❌ Facture ${fl.docNumber} (${fl.clientNom} · ${fl.montantHT.toFixed(2)} $ HT) ANNULÉE dans QuickBooks (VOID, trace comptable conservée)${note ? ` — raison : ${note}` : ""}.`
    );
  };

  const renvoyerFactureLibre = async (fl, choix) => {
    const adresses = listeDestinataires(choix).map((c) => c.email);
    if (adresses.length === 0 || !fl.qboInvoiceId) return;
    const r = await envoyerFactureQbo(fl.qboInvoiceId, adresses);
    const maj = {
      courriels: adresses,
      envoiStatut: r?.envoyee ? "envoyee" : "non_confirme",
      envoyeeLe: r?.envoyee ? r.envoyeeLe || new Date().toISOString() : null,
    };
    setFacturesLibres((prev) => prev.map((x) => (x.id === fl.id ? { ...x, ...maj } : x)));
    majEnvoiFactureLibre(fl.id, maj).catch(() => {});
    ajouterJournal(
      r?.envoyee
        ? `✉️ Facture ${fl.docNumber} RENVOYÉE par QuickBooks à ${adresses.join(", ")}.`
        : `⚠️ Facture ${fl.docNumber} : renvoi NON confirmé${r?.erreur ? ` (${r.erreur})` : ""} — réessaie.`
    );
  };
  const [renvoiLibre, setRenvoiLibre] = useState(null); // facture libre à renvoyer
  // 📅 Facture groupée : le groupe choisi passe par les deux mêmes
  // fenêtres que les autres factures (destinataires, puis paiements).
  const [groupeAFacturer, setGroupeAFacturer] = useState(null);
  const clientsFacturation = useClients();
  // (`configEnt` est déclaré plus bas dans ce composant — même portée.)
  // DÉPÔT DÉJÀ PAYÉ sur cette tâche (appel de service payé d'avance).
  // Sans ce raccord, la révision de prix demandait le PLEIN montant
  // comme si rien n'avait été payé — le client risquait de payer deux
  // fois. Le dépôt et le bon partagent le même identifiant de tâche.
  // `depots` est un ANNUAIRE par tâche ({ tacheId: depot }), pas une
  // liste — même lecture que depotDe() dans l'agenda. Le traiter comme
  // une liste plantait tout l'onglet Facturation.
  // 🕐 LES HEURES DE TOUTE L'ÉQUIPE (2026-08-27) — depuis la MÊME
  // source que la paie (travaux_effectues), pas depuis le bon : seul le
  // DERNIER technicien crée le bon, avec SES heures — la carte
  // sous-facturait chaque job d'équipe (Dominic 3 h + Philippe 4 h →
  // la carte montrait 4 h, et la révision proposait 4 h au client).
  // Clé exacte + clés « id::jour » des chantiers multi-jours ; dîner,
  // transports et heures administratives/divers exclus (le transport
  // réel a déjà son propre calcul dans la révision).
  const estLigneChantier = (t) =>
    t.supabase && !t.estTransport && (Number(t.heures) || 0) > 0 &&
    !/dîner|diner|lunch/i.test(t.titre || "") && (t.categorieHeures || "projet") === "projet";
  const travauxDeTache = (tacheId) =>
    tacheId ? (travaux || []).filter((t) => String(t.tacheId || "").split("::")[0] === tacheId && estLigneChantier(t)) : [];
  // Équipe ASSIGNÉE à la tâche — dérivée des clés de
  // facturablesAssignations (posées pour CHAQUE assignation au
  // chargement) ; les sous-traitants (st::) ne sont pas des techniciens
  // à attendre.
  const equipeAssignee = (tacheId) =>
    !tacheId
      ? []
      : Object.keys(facturablesAssignations)
          .filter((k) => k.startsWith(`${tacheId}|`))
          .map((k) => k.slice(String(tacheId).length + 1))
          .filter((c) => c && !c.startsWith("st::"));
  const depotPayePour = (tacheId) => {
    if (!tacheId) return null;
    const d = depots?.[tacheId];
    return d && (d.payeLe || String(d.statut || "").startsWith("paye")) ? d : null;
  };
  // PIÈCE PAYÉE D'AVANCE par le client (option « payer avant la
  // commande ») — même logique que le dépôt : déduite automatiquement
  // de la facture du retour pour ne JAMAIS être chargée deux fois.
  const piecePrepayeePour = (tacheId) => {
    if (!tacheId) return null;
    const p = (pieces || []).find((x) => x.tacheRetourId === tacheId);
    return p && p.paiementAvantCommande && p.paiementRecu && Number(p.montantPiece) > 0 ? p : null;
  };
  // BLOC 4 — TEMPS SUPPLÉMENTAIRE calculé d'avance pour les appels de
  // service : heures réelles de CHAQUE technicien, temps inclus du
  // dépôt, tranches de 15 minutes entamées, et taux réduit pour le
  // passager (il n'amène pas de camion — l'inspection du matin nous le
  // dit). Les lignes arrivent PRÉ-REMPLIES dans la révision, jamais
  // verrouillées : la machine calcule, l'humain décide.
  // 🧾 APPEL SANS DÉPÔT (2026-09-03, vécu par le propriétaire : la
  // révision suggérait 32,50 $ pour un appel complet) : quand AUCUN
  // dépôt n'a été payé d'avance, le PRIX DE BASE de l'appel (le prix de
  // zone que le dépôt aurait couvert) doit être facturé — il est donc
  // suggéré d'office, modifiable comme le reste. Hors zone : pas de
  // prix fixe, l'humain le tape (l'avertissement rouge le force déjà).
  // 👥 Les hommes FACTURABLES d'un bon (heures > 0, pas 🤝) — sert à
  // détecter le régime « appel à 2 hommes » (2026-09-04).
  const sourcesFacturables = (b) =>
    (((b.lignesReelles && b.lignesReelles.length > 0 ? b.lignesReelles : b.lignesSource) || [b])).filter(
      (s) =>
        (Number(s.heures) || 0) > 0 &&
        facturablesAssignations[`${b.tacheId || ""}|${(s.employeEmail || "").toLowerCase()}`] !== false
    );
  const lignesBaseAppel = (b) => {
    if (!b || b.type !== "appel_service") return [];
    // 👥 2 hommes facturables et plus : le prix de zone ne s'applique
    // plus — le régime « minimum d'heures » (lignesTempsSupp) fait tout.
    if (sourcesFacturables(b).length >= 2) return [];
    const zone = zonePourTache ? zonePourTache(b.tacheId) : null;
    if (!zone || zone === "hors_zone") return [];
    const prixZone = Number(prixDepots?.[zone]) || 0;
    if (prixZone <= 0) return [];
    // 💰 AVEC dépôt payé, la base se facture AUSSI (2026-09-06, vécu :
    // total à −227,50 $) — la déduction automatique du dépôt (−260)
    // n'a de sens que si la base qu'il couvrait est sur la facture :
    // base + surplus − dépôt = le surplus, l'histoire complète sur un
    // seul document. Sans dépôt : la base se facture tout court.
    return [
      {
        description: depotPayePour(b.tacheId)
          ? `Appel de service — ${zone}`
          : `Appel de service — ${zone} (aucun dépôt perçu d'avance)`,
        prix: prixZone,
      },
    ];
  };
  const lignesTempsSupp = (b) => {
    // ⏱️ TEMPS ET MATÉRIEL (2026-09-03, demande du propriétaire : « les
    // heures que les techs ont passées, selon qu'elles sont facturables
    // ou pas, doivent être comptabilisées ») : TOUTES les heures 💰 de
    // l'équipe sont suggérées au taux vendant — pas de temps inclus ni
    // de règle de zone (elles appartiennent aux appels de service). Le
    // 🤝 (aide interne) reste exclu, le passager au taux réduit.
    if (!b || (b.type !== "appel_service" && b.type !== "temps_materiel")) return [];
    const estTempsMateriel = b.type === "temps_materiel";
    const tauxV = Number(prixDepots?.taux_horaire_vendant) || 0;
    if (tauxV <= 0) return [];
    const camion = Number(configEnt?.coutCamionHoraire) || 0;
    // 🤝 Les techniciens déclarés NON FACTURABLES (choix du répartiteur
    // à l'assignation) sortent du calcul — leurs heures restent payées
    // et comptées aux coûts, mais jamais suggérées au client.
    const estNonFacturable = (s) =>
      facturablesAssignations[`${b.tacheId || ""}|${(s.employeEmail || "").toLowerCase()}`] === false;
    // Heures RÉELLES de toute l'équipe d'abord (2026-08-27) — le bon ne
    // porte que les heures du dernier technicien.
    const sources = ((b.lignesReelles && b.lignesReelles.length > 0 ? b.lignesReelles : b.lignesSource) || [b]).filter(
      (s) => (Number(s.heures) || 0) > 0 && !estNonFacturable(s)
    );
    if (sources.length === 0) return [];

    // ============================================================
    // 👥 APPEL À 2 HOMMES (2026-09-04, règle du propriétaire) : dès
    // 2 techniciens FACTURABLES sur un appel de service, le prix de
    // zone et le temps inclus disparaissent. Chaque homme est facturé
    //   max(minimum d'heures, SON aller-retour + SON temps sur place)
    // — le chauffeur au taux vendant, l'assistant (passager du même
    // camion) au taux vendant MOINS le camion. Au-delà du minimum :
    // mêmes taux, tranches de 15 minutes ENTAMÉES. Le minimum se règle
    // dans Tarifs (défaut 3 h) ; le dépôt perçu se déduit comme
    // toujours par la ligne automatique de la révision.
    // ============================================================
    // 🔧 TEMPS & MATÉRIEL — MINIMUM D'HEURES PAR HOMME (2026-09-04,
    // règle du propriétaire, précisée le même jour) : minimum (Tarifs,
    // défaut 3 h) PAR homme facturable quand
    //   • le technicien est SEUL sur la job (1 × minimum), ou
    //   • 2 hommes et plus sont FACTURABLES (minimum chacun).
    // Le SEUL cas sans minimum : plusieurs sur place mais UN seul
    // facturable (l'autre en 🤝 aide interne) — là, heures réelles.
    // Chauffeur au taux vendant, passager au taux moins camion. Pas de
    // transport compté : le minimum couvre le déplacement, c'est son rôle.
    const nbTravailleursTM = (((b.lignesReelles && b.lignesReelles.length > 0 ? b.lignesReelles : b.lignesSource) || [b]))
      .filter((s) => (Number(s.heures) || 0) > 0).length;
    if (estTempsMateriel && (sources.length >= 2 || nbTravailleursTM === 1)) {
      const minTM = Number(prixDepots?.minimum_heures_2_hommes_tm) > 0 ? Number(prixDepots.minimum_heures_2_hommes_tm) : 3;
      const trancheTM = Number(configEnt?.trancheFacturationMin) || 15;
      return sources
        .map((s) => ({
          nom: s.employeNom || "",
          heures: Number(s.heures) || 0,
          passager: (inspections || []).some((i) => i.date === (s.date || b.date) && i.passagerDeNom && i.technicienNom === s.employeNom),
        }))
        .sort((a, x) => (a.passager ? 1 : 0) - (x.passager ? 1 : 0))
        .map((s) => {
          const taux = s.passager ? Math.max(0, tauxV - camion) : tauxV;
          const arrondiH = (Math.ceil(Math.round(s.heures * 60) / trancheTM) * trancheTM) / 60;
          const factH = Math.max(minTM, arrondiH);
          return {
            description:
              `Main-d'œuvre — ${s.nom || "technicien"}${s.passager ? " (même camion)" : ""} : ${s.heures.toFixed(2)} h` +
              `${factH > arrondiH ? ` (minimum ${minTM} h appliqué)` : ""} = ${factH.toFixed(2)} h × ${taux.toFixed(2)} $/h`,
            prix: Math.round(factH * taux * 100) / 100,
          };
        });
    }
    if (!estTempsMateriel && sources.length >= 2) {
      const minH = Number(prixDepots?.minimum_heures_2_hommes) > 0 ? Number(prixDepots.minimum_heures_2_hommes) : 3;
      const trancheMin2 = Number(configEnt?.trancheFacturationMin) || 15;
      // Transport RÉEL du jour de CHAQUE homme — la règle 2 hommes
      // facture l'aller-retour explicitement, peu importe la zone.
      // (2026-09-06 : JF a évoqué de limiter l'A/R au hors-zone, puis a
      // dit « oublie ça » — la règle d'origine reste.)
      const transportDe = (s) =>
        (travaux || [])
          .filter(
            (t) =>
              t.supabase &&
              t.estTransport &&
              (t.employeEmail || "").toLowerCase() === (s.employeEmail || "").toLowerCase() &&
              t.date === (s.date || b.date)
          )
          .reduce((somme, t) => somme + (Number(t.heures) || 0), 0);
      return sources
        .map((s) => ({
          nom: s.employeNom || "",
          site: Number(s.heures) || 0,
          transport: transportDe(s),
          // (même règle qu'estPassager plus bas — déclaré après ce bloc)
          passager: (inspections || []).some((i) => i.date === (s.date || b.date) && i.passagerDeNom && i.technicienNom === s.employeNom),
        }))
        // Chauffeur d'abord — l'ordre des lignes suit la logique du client.
        .sort((a, x) => (a.passager ? 1 : 0) - (x.passager ? 1 : 0))
        .map((s) => {
          const taux = s.passager ? Math.max(0, tauxV - camion) : tauxV;
          const brutH = s.site + s.transport;
          const arrondiH = (Math.ceil(Math.round(brutH * 60) / trancheMin2) * trancheMin2) / 60;
          const factH = Math.max(minH, arrondiH);
          return {
            description:
              `Appel de service 2 techniciens — ${s.nom || "technicien"}${s.passager ? " (même camion)" : ""} : ` +
              `${s.site.toFixed(2)} h sur place + ${s.transport.toFixed(2)} h transport` +
              `${factH > arrondiH ? ` (minimum ${minH} h appliqué)` : ""} = ${factH.toFixed(2)} h × ${taux.toFixed(2)} $/h`,
            prix: Math.round(factH * taux * 100) / 100,
          };
        });
    }
    // 🗺️ LA RÈGLE SUIT LA ZONE (2026-08-25) — la même que l'info-bulle
    // de l'agenda, enfin appliquée ICI aussi :
    //   • Zones 1-2-3 : 90 min incluses CHEZ LE CLIENT (le transport est
    //     déjà dans le prix de zone) — temps du chronomètre seulement.
    //   • Hors zone : 180 min incluses AU TOTAL — le transport RÉEL du
    //     technicien ce jour-là compte dans le temps inclus.
    // Avant, la suggestion appliquait toujours la règle des zones : un
    // appel hors zone était suggéré avec la mauvaise règle, transport
    // jamais compté. Toujours du temps RÉEL pointé — jamais le bloc
    // d'agenda.
    const horsZone = (zonePourTache ? zonePourTache(b.tacheId) : null) === "hors_zone";
    const transportReelDe = (s) =>
      horsZone
        ? (travaux || [])
            .filter(
              (t) =>
                t.supabase &&
                t.estTransport &&
                (t.employeEmail || "").toLowerCase() === (s.employeEmail || "").toLowerCase() &&
                t.date === (s.date || b.date)
            )
            .reduce((somme, t) => somme + (Number(t.heures) || 0), 0)
        : 0;
    // Passager ce jour-là ? (déclaré le matin, pas déduit) → taux réduit.
    const estPassager = (nom, date) =>
      (inspections || []).some((i) => i.date === date && i.passagerDeNom && i.technicienNom === nom);
    // Le temps inclus appartient à L'APPEL, pas à chaque technicien : il
    // se consomme d'abord sur les heures au PLEIN taux (avantage client).
    const tries = sources
      .map((s) => ({
        nom: s.employeNom || "",
        heures: (Number(s.heures) || 0) + transportReelDe(s),
        passager: estPassager(s.employeNom, s.date || b.date),
      }))
      .sort((a, x) => (a.passager ? 1 : 0) - (x.passager ? 1 : 0));
    // Temps et matériel : AUCUNE minute incluse — chaque heure 💰 se
    // facture depuis la première (c'est la définition du T&M).
    let inclusRestant = estTempsMateriel
      ? 0
      : (horsZone ? Number(prixDepots?.minutes_incluses_hors_zone) || 180 : Number(prixDepots?.minutes_incluses) || 90) / 60;
    const lignes = [];
    tries.forEach((s) => {
      const consomme = Math.min(inclusRestant, s.heures);
      inclusRestant -= consomme;
      const extraH = s.heures - consomme;
      if (extraH <= 0.0001) return;
      // Tranches de 15 minutes ENTAMÉES — la règle validée.
      const trancheMin = Number(configEnt?.trancheFacturationMin) || 15;
      const factH = (Math.ceil(Math.round(extraH * 60) / trancheMin) * trancheMin) / 60;
      const taux = s.passager ? Math.max(0, tauxV - camion) : tauxV;
      lignes.push({
        description:
          `${estTempsMateriel ? "Main-d'œuvre" : "Temps supplémentaire"}${s.nom ? ` — ${s.nom}` : ""}${s.passager ? " (même camion)" : ""}${!estTempsMateriel && horsZone ? " (hors zone — transport compté)" : ""} : ` +
          `${factH.toFixed(2)} h × ${taux.toFixed(2)} $/h`,
        prix: Math.round(factH * taux * 100) / 100,
      });
    });
    return lignes;
  };
  const configEnt = useEntreprise();
  // ============================================================
  // 📧 COPIE INTERNE PAR LE CANAL FLUXYA (2026-09-04, vécu : la copie
  // QuickBooks de la facture 4264 pour Louise s'est perdue entre Intuit
  // et Gmail, sans trace). Les adresses cochées qui appartiennent au
  // DOMAINE de l'entreprise (@ventilationdgl.com…) reçoivent EN PLUS un
  // récapitulatif envoyé par NOTRE canal Resend — celui qu'on contrôle
  // et qu'on surveille (rebond → journal en 30 s). Le CLIENT, lui, ne
  // reçoit que la facture officielle QuickBooks — jamais de doublon.
  // Seules les adresses cochées reçoivent (la règle « ceux qui le
  // demandent ») — aucune copie globale.
  // ============================================================
  const domainesInternes = () =>
    new Set(
      [configEnt?.courriel, configEnt?.courrielFacturation]
        .filter(Boolean)
        .map((e) => String(e).split("@")[1]?.toLowerCase())
        .filter(Boolean)
    );
  const envoyerCopieInterne = async ({ numero, clientNom, totalHT, destinataires, lignes = null }) => {
    const doms = domainesInternes();
    if (doms.size === 0) return;
    const internes = (destinataires || [])
      .map((c) => (typeof c === "string" ? c : c?.email))
      .filter((e) => e && doms.has(String(e).split("@")[1]?.toLowerCase()));
    if (internes.length === 0) return;
    // 🧾 LE DÉTAIL COMPLET dans la copie interne (2026-09-06, vécu ×2 :
    // les courriels d'Intuit vers @ventilationdgl.com se perdent en
    // silence malgré « EmailSent » au registre — liste de suppression
    // Intuit). La copie Fluxya se suffit : lignes, taxes estimées,
    // total — personne à l'interne n'a besoin du courriel Intuit.
    const echap = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br/>");
    const tableauLignes =
      Array.isArray(lignes) && lignes.length > 0
        ? `<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">` +
          lignes
            .map(
              (l) =>
                `<tr><td style="border-bottom:1px solid #eee;padding:4px 8px 4px 0">${echap(l.description)}</td>` +
                `<td style="border-bottom:1px solid #eee;padding:4px 0;text-align:right;white-space:nowrap">${(Number(l.montant) || 0).toFixed(2)} $</td></tr>`
            )
            .join("") +
          `</table>`
        : "";
    const r = await envoyerCourriel({
      a: internes,
      sujet: `Copie interne — Facture ${numero} — ${clientNom}`,
      html:
        `<p><b>Copie interne Fluxya</b> — la facture officielle (avec le lien de paiement) part par QuickBooks au client.</p>` +
        `<p>Facture <b>Nº ${numero}</b> · ${echap(clientNom)}${Number(totalHT) > 0 ? ` · <b>${Number(totalHT).toFixed(2)} $ HT</b> (+ taxes)` : ""}</p>` +
        tableauLignes +
        `<p style="font-size:12px;color:#666">Destinataires choisis : ${(destinataires || []).map((c) => (typeof c === "string" ? c : c?.email)).filter(Boolean).join(", ")}</p>`,
    });
    ajouterJournal(
      r.envoye
        ? `📧 Copie interne de la facture ${numero} envoyée à ${internes.join(", ")} (canal Fluxya — un rebond se verrait au journal).`
        : `⚠️ Copie interne de la facture ${numero} NON envoyée à ${internes.join(", ")}${r.erreur ? ` (${r.erreur})` : ""} — la facture QuickBooks, elle, suit son cours.`
    );
  };
  const [bonFacturationId, setBonFacturationId] = useState(null);
  // Fenêtre d'avant-envoi : { mode: "simple"|"progressive", bonId,
  // info?, montant, clientNom, courriels } — remplie quand le choix des
  // courriels est confirmé, juste AVANT l'émission réelle.
  const [paiementAConfirmer, setPaiementAConfirmer] = useState(null);
  // Bon en attente d'un envoi simple à QB ("Envoyer à QB") — le
  // sélecteur de courriel s'ouvre avant l'envoi réel.
  const [bonEnvoiCourrielId, setBonEnvoiCourrielId] = useState(null);
  const [bonEnvoiClientId, setBonEnvoiClientId] = useState(null);
  const [bonRetraitId, setBonRetraitId] = useState(null);
  // Détails d'une facture progressive déjà configurée dans
  // ModalFacturationDevis, en attente du choix du courriel avant
  // l'émission réelle vers QuickBooks.
  const [factureEnAttenteCourriel, setFactureEnAttenteCourriel] = useState(null); // { bonId, montant, type, detail }
  // Bon "prix non listé" en cours de révision manuelle par l'admin.
  const [bonAReviserId, setBonAReviserId] = useState(null);
  const [factureAperçuId, setFactureAperçuId] = useState(null);
  const bonAReviser = bons.find((b) => b.id === bonAReviserId) || null;

  const reviserPrixNonListe = (bonId, items, total) => {
    const b = bons.find((x) => x.id === bonId);
    setBons((prev) =>
      prev.map((x) =>
        x.id === bonId
          ? { ...x, montant: total, lignesNonListees: items, description: items.map((it) => it.description).join(" · "), prixNonListe: false }
          : x
      )
    );
    ajouterJournal(
      `✍️ Prix révisé et validé pour "${b?.projet}" — ${items.length} item${items.length > 1 ? "s" : ""} séparé${items.length > 1 ? "s" : ""}, total ${total.toFixed(2)} $. Débloqué pour l'envoi au client.`
    );
    setBonAReviserId(null);
  };

  // ============================================================
  // UN TRAVAIL = UNE FACTURE, MÊME À PLUSIEURS TECHNICIENS
  // ------------------------------------------------------------
  // La table des bons de travail porte une ligne PAR TECHNICIEN
  // (contrainte tache_id × employe_email). Marc et Sophie sur le même
  // appel de service produisaient donc DEUX demandes de facturation :
  // rien n'empêchait de facturer deux fois le même travail.
  //
  // On regroupe ici par tâche. Le client paie un TRAVAIL, pas des
  // techniciens : les heures s'additionnent, le montant reste unique.
  //
  // Au passage, une tâche rattachée à un DEVIS récupère le montant
  // déjà négocié — elle n'a rien à faire dans la pile « prix à réviser ».
  const bonsGroupes = useMemo(() => {
    const parTache = new Map();
    (bons || []).forEach((b) => {
      const cle = b.tacheId || b.id;
      const existant = parTache.get(cle);
      if (!existant) {
        parTache.set(cle, {
          ...b,
          lignesSource: [b],
          heures: Number(b.heures) || 0,
          equipe: b.employeNom ? [{ nom: b.employeNom, heures: Number(b.heures) || 0, courriel: b.employeEmail || "" }] : [],
        });
        return;
      }
      // Heures cumulées de toute l'équipe, un seul montant.
      existant.heures += Number(b.heures) || 0;
      existant.lignesSource.push(b);
      if (b.employeNom) existant.equipe.push({ nom: b.employeNom, heures: Number(b.heures) || 0, courriel: b.employeEmail || "" });
      // Photos et signatures : on garde tout ce qui existe.
      existant.photosAvantUrls = [...(existant.photosAvantUrls || []), ...(b.photosAvantUrls || [])];
      existant.photosApresUrls = [...(existant.photosApresUrls || []), ...(b.photosApresUrls || [])];
      existant.signeParNom = existant.signeParNom || b.signeParNom;
      existant.clientAbsent = existant.clientAbsent || b.clientAbsent;
      // Si UNE des lignes est déjà facturée, le travail l'est.
      if (b.statutQb !== "en_attente") existant.statutQb = b.statutQb;
    });

    return [...parTache.values()].map((b) => {
      // 🕐 Les heures de la carte = TOUTES les heures de chantier de la
      // tâche (source paie), détaillées par technicien — le bon, lui,
      // ne porte que celles du dernier (2026-08-27).
      let enrichi = b;
      const reelles = travauxDeTache(b.tacheId);
      if (reelles.length > 0) {
        const parEmp = new Map();
        reelles.forEach((t) => {
          const cle = (t.employeEmail || t.employeNom || "?").toLowerCase();
          const e = parEmp.get(cle) || { nom: t.employeNom || t.employeEmail || "?", courriel: t.employeEmail || "", heures: 0 };
          e.heures += Number(t.heures) || 0;
          parEmp.set(cle, e);
        });
        const equipe = [...parEmp.values()];
        enrichi = {
          ...b,
          equipe,
          heures: Math.round(equipe.reduce((somme, e) => somme + e.heures, 0) * 100) / 100,
          lignesReelles: reelles,
          // 👥 Les PHOTOS de toute l'équipe (2026-08-27) : le bon ne
          // porte que celles du dernier à fermer — la galerie de la
          // carte compose l'union avec celles enregistrées par chaque
          // technicien (y compris celles arrivées APRÈS l'envoi du bon,
          // par le rattrapage réseau).
          photosAvantUrls: [...new Set([...(b.photosAvantUrls || []), ...reelles.flatMap((t) => t.photosAvantUrls || [])])],
          photosApresUrls: [...new Set([...(b.photosApresUrls || []), ...reelles.flatMap((t) => t.photosApresUrls || [])])],
        };
      }
      // Le montant d'un devis accepté est déjà connu — on le reprend.
      if (!enrichi.devisNumero || !enrichi.prixNonListe) return enrichi;
      const devis = (devisListe || []).find((d) => d.numero === enrichi.devisNumero);
      if (!devis) return enrichi;
      return { ...enrichi, montant: Number(devis.totalVendant) || 0, prixNonListe: false };
    });
  }, [bons, devisListe]);

  // 🧾 DEVIS SANS SOLDE (2026-09-03, retour du propriétaire : « pourquoi
  // ça reste là alors que la facturation a toute été faite ? ») —
  // PLUSIEURS bons peuvent pointer le MÊME devis, mais le statut
  // « envoyé » n'était posé que sur le bon d'où les factures sont
  // parties : ses jumeaux restaient dans « À valider » pour toujours,
  // avec un bouton qui ouvrait une fenêtre à 0,00 $. On calcule donc le
  // CUMUL PAR DEVIS (toutes tâches confondues — même règle que le
  // plafond anti-dépassement) : un bon dont le devis n'a plus de solde
  // est classé « Déjà facturés », peu importe qui a porté les factures.
  const devisSansSolde = (() => {
    const cumulParDevis = {};
    bonsGroupes.forEach((b) => {
      if (!b.devisNumero) return;
      cumulParDevis[b.devisNumero] =
        (cumulParDevis[b.devisNumero] || 0) + (b.facturesEmises || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
    });
    const sansSolde = new Set();
    Object.entries(cumulParDevis).forEach(([numero, cumul]) => {
      const d = (devisListe || []).find((x) => x.numero === numero);
      if (d && cumul >= (Number(d.totalVendant) || 0) - 0.01 && (Number(d.totalVendant) || 0) > 0) sansSolde.add(numero);
    });
    return sansSolde;
  })();

  // Catégorie d'un bon — reprend exactement la même logique que les
  // encadrés ci-dessous, pour que le filtrage par clic reste toujours
  // cohérent avec les compteurs affichés.
  const categorieBon = (b) => {
    if (b.statutQb === "retire") return "retire";
    if (b.statutQb === "envoye") return "facture";
    // Le devis de ce bon est facturé au complet (par ce bon ou un autre).
    if (b.devisNumero && devisSansSolde.has(b.devisNumero)) return "facture";
    if (b.prixNonListe) return "rouge";
    if (b.type === "entretien_contrat") return "violet";
    if (b.type === "devis") return "bleu";
    if (b.type === "appel_service") return "gris";
    return "jaune";
  };

  const parCategorie = {};
  bonsGroupes.forEach((b) => {
    const c = categorieBon(b);
    parCategorie[c] = (parCategorie[c] || 0) + 1;
  });
  const rouges = parCategorie.rouge || 0;
  const bleus = parCategorie.bleu || 0;
  const violets = parCategorie.violet || 0;
  const gris = parCategorie.gris || 0;
  const retires = parCategorie.retire || 0;
  const jaunes = parCategorie.jaune || 0;
  // ✅ DÉJÀ FACTURÉS (2026-09-02) — les bons complètement facturés (ou
  // dont le devis n'a plus de solde) sortent de la liste par défaut et
  // vivent dans leur propre encadré. Rien ne disparaît : un clic les montre.
  const dejaFactures = parCategorie.facture || 0;

  // Filtre multi-sélection sur les encadrés — clic pour activer/
  // désactiver une catégorie, plusieurs en même temps possible (union :
  // montre tout ce qui correspond à AU MOINS une des catégories
  // cochées). Aucun filtre actif = tout s'affiche, comme avant.
  const [filtresActifs, setFiltresActifs] = useState([]);
  const basculerFiltre = (categorie) => {
    setFiltresActifs((prev) => {
      const active = !prev.includes(categorie);
      // 📜 DÉFILER JUSQU'AUX CARTES (2026-09-04, vécu : « je clique sur
      // Retirés et rien ne se passe ») — la liste filtrée vit PLUS BAS
      // que l'écran (après le tableau À facturer et les factures sans
      // chantier) : le filtre marchait, mais rien de visible ne
      // bougeait. Activer un encadré amène maintenant l'œil dessus.
      if (active) {
        setTimeout(() => refListeFact.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
      return active ? [...prev, categorie] : prev.filter((c) => c !== categorie);
    });
  };
  const refListeFact = useRef(null);
  // 🔎 RECHERCHE RAPIDE (2026-09-03, demande du propriétaire : « disons
  // qu'il y en a 500 dans Déjà facturés et qu'on veut aller revoir ») —
  // cherche dans le titre de la job, le client, le numéro de devis ET
  // les numéros de facture QuickBooks. Accents et casse ignorés.
  const [rechercheFact, setRechercheFact] = useState("");
  const normaliserRecherche = (s) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const bonCorrespond = (b, terme) => {
    const t = normaliserRecherche(terme).trim();
    if (!t) return true;
    const texte = normaliserRecherche(
      [b.projet, b.client, b.devisNumero, b.description, ...(b.facturesEmises || []).map((f) => f.numeroFactureQb)].filter(Boolean).join(" ")
    );
    return t.split(/\s+/).every((mot) => texte.includes(mot));
  };
  // Vue par défaut : ni les retirés, ni les DÉJÀ FACTURÉS — le travail
  // à faire seulement. Les deux encadrés les ramènent d'un clic.
  // ⚠️ Une RECHERCHE tapée sans filtre actif fouille TOUT (facturés et
  // retirés compris) : quand on cherche « 1055 », on veut la trouver
  // même si sa carte est classée « Déjà facturés ».
  const bonsAffiches = (
    filtresActifs.length === 0
      ? rechercheFact.trim()
        ? bonsGroupes
        : bonsGroupes.filter((b) => categorieBon(b) !== "retire" && categorieBon(b) !== "facture")
      : bonsGroupes.filter((b) => filtresActifs.includes(categorieBon(b)))
  ).filter((b) => bonCorrespond(b, rechercheFact));
  // ============================================================
  // 📋 À FACTURER — PAR CLIENT ET PAR PROJET (2026-08-28)
  // ------------------------------------------------------------
  // Demande du propriétaire : « pour les gros projets on ne facture
  // qu'une fois par mois — et groupe les factures par client pour
  // trouver rapidement ce qu'il y a à faire, sans en oublier. »
  //
  // Ce tableau ne CACHE rien : les cartes détaillées restent en dessous.
  // Il répond à une seule question — « qu'est-ce que je dois facturer,
  // et à qui ? » — et donne le bouton qui fait UNE facture pour tout un
  // chantier (une ligne par bon, donc le client voit le détail du mois).
  // Après l'envoi, les bons passent « facturés » et quittent la pile :
  // impossible de les facturer deux fois.
  // ============================================================
  const resteAFacturerDe = (b) => {
    const cumule = (b.facturesEmises || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
    return Math.max(0, (Number(b.montant) || 0) - cumule);
  };
  const groupesAFacturer = useMemo(() => {
    // Tout ce qui n'est ni retiré ni déjà soldé. ⚠️ On garde les bons
    // « à réviser » (prix pas encore fixé, donc montant à 0) : les
    // exclure faisait disparaître le tableau entier quand toute la pile
    // attendait une révision — et c'est justement ceux-là qu'on ne doit
    // pas oublier. Ils sont comptés à part, jamais facturés à 0 $.
    const candidats = bonsGroupes.filter(
      (b) => categorieBon(b) !== "retire" && categorieBon(b) !== "facture"
    );
    const parClient = new Map();
    candidats.forEach((b) => {
      const client = (b.client || "").trim() || "— sans client —";
      if (!parClient.has(client)) parClient.set(client, new Map());
      const projet = (projets || []).find((p) => p.id === b.projetId) || null;
      const cleProjet = projet ? projet.id : "__hors__";
      const parProjet = parClient.get(client);
      if (!parProjet.has(cleProjet)) parProjet.set(cleProjet, { projet, bons: [] });
      parProjet.get(cleProjet).bons.push(b);
    });
    return [...parClient.entries()]
      .map(([client, parProjet]) => {
        const sousGroupes = [...parProjet.values()]
          .map((g) => ({
            ...g,
            total: g.bons.reduce((s, b) => s + resteAFacturerDe(b), 0),
            // Seuls ceux qui ont un montant partent dans une facture.
            facturables: g.bons.filter((b) => resteAFacturerDe(b) > 0),
            aReviser: g.bons.filter((b) => resteAFacturerDe(b) <= 0).length,
          }))
          // Les chantiers d'abord, « hors projet » en dernier.
          .sort((a, b) => (a.projet ? 0 : 1) - (b.projet ? 0 : 1) || b.total - a.total);
        return {
          client,
          sousGroupes,
          nbBons: sousGroupes.reduce((s, g) => s + g.bons.length, 0),
          total: sousGroupes.reduce((s, g) => s + g.total, 0),
        };
      })
      // Le plus gros montant en haut : ce qu'on ne veut surtout pas oublier.
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonsGroupes, projets]);
  const [groupesOuverts, setGroupesOuverts] = useState({});
  const totalAFacturer = groupesAFacturer.reduce((s, g) => s + g.total, 0);
  const nbBonsAFacturer = groupesAFacturer.reduce((s, g) => s + g.nbBons, 0);

  // 📄 Pagination (2026-08-26) : 10 cartes par page — les plus grosses
  // cartes de l'application s'empilaient sans fin. Changer de filtre
  // ramène page 1 ; la borne Math.min évite toute page vide.
  const [pageFact, setPageFact] = useState(1);
  useEffect(() => { setPageFact(1); }, [filtresActifs, rechercheFact]);
  const pageFactEff = Math.min(pageFact, Math.max(1, Math.ceil(bonsAffiches.length / ITEMS_PAR_PAGE)));
  const bonsPageines = bonsAffiches.slice((pageFactEff - 1) * ITEMS_PAR_PAGE, pageFactEff * ITEMS_PAR_PAGE);
  // Factures dont l'envoi par QuickBooks n'est pas (encore) confirmé au
  // registre — l'alerte passive de l'onglet.
  // En mode MANUEL (choix de l'entreprise), « pas envoyé » n'est pas un
  // problème — l'alerte ne compte qu'en mode automatique.
  const envoisAConfirmer =
    configEnt?.envoiAutoFactureQb === true
      ? bonsGroupes.reduce(
          (s, x) => s + (x.facturesEmises || []).filter((f) => f.qboInvoiceId && f.envoiQb?.statut !== "envoyee").length,
          0
        )
      : 0;

  const bonFacturation = bons.find((b) => b.id === bonFacturationId) || null;
  // ============================================================
  // 🔎 DEVIS QUICKBOOKS RECONNU (2026-08-25) — TRANSITION.
  // ------------------------------------------------------------
  // Un numéro tapé à la main (devis fait dans QuickBooks avant
  // l'application) n'existait pas dans devisListe : le garde-fou
  // anti-dépassement se rabattait sur le montant du bon, la facture ne
  // montrait pas les lignes acceptées, et la facturation progressive
  // était impossible. À l'ouverture de la fenêtre, si le numéro est
  // inconnu de l'application, on va LIRE l'estimate dans QuickBooks et
  // on le sert au même moule qu'un devis maison. Mis en cache par
  // numéro (la fenêtre peut se rouvrir dix fois). Introuvable : la
  // fenêtre garde son comportement d'avant, et le Journal le dit.
  // ============================================================
  const [devisQboCache, setDevisQboCache] = useState({});
  const devisFacturation = bonFacturation
    ? devisListe.find((d) => d.numero === bonFacturation.devisNumero) ||
      devisQboCache[bonFacturation.devisNumero] ||
      null
    : null;
  useEffect(() => {
    if (!bonFacturation?.devisNumero) return;
    const numero = bonFacturation.devisNumero;
    if (devisListe.some((d) => d.numero === numero)) return; // devis maison — rien à chercher
    // Relu à CHAQUE ouverture de la fenêtre (pas de cache figé) : si le
    // comptable ajuste l'estimate dans QuickBooks entre deux factures,
    // le solde suit. Le cache ne sert qu'à afficher tout de suite
    // pendant que la relecture arrive.
    const dejaConnu = devisQboCache[numero] !== undefined;
    let annule = false;
    lireEstimateQbo(numero).then((r) => {
      if (annule) return;
      if (r?.trouve) {
        setDevisQboCache((prev) => ({
          ...prev,
          [numero]: {
            numero,
            sourceQbo: true,
            totalVendant: Number(r.total) || 0,
            // Même forme que les lignes d'un devis maison — la fenêtre
            // de facturation progressive n'y voit que du feu.
            lignes: (r.lignes || []).map((l, i) => ({
              uid: `qbo-${numero}-${i}`,
              nom: l.description,
              description: "",
              quantite: Number(l.quantite) || 1,
              prix_vendant: Number(l.prixUnitaire) || 0,
            })),
          },
        }));
        if (!dejaConnu) {
          ajouterJournal(
            `🔎 Devis ${numero} retrouvé dans QuickBooks (${(r.lignes || []).length} ligne${(r.lignes || []).length > 1 ? "s" : ""}, total ${(Number(r.total) || 0).toFixed(2)} $ HT) — solde et facturation progressive branchés dessus.`
          );
        }
      } else if (r?.trouve === false) {
        setDevisQboCache((prev) => ({ ...prev, [numero]: null }));
        if (!dejaConnu) {
          ajouterJournal(
            `🔎 Devis ${numero} INTROUVABLE dans QuickBooks — la facturation se fait sur le montant du bon (vérifie le numéro si un devis existe vraiment).`
          );
        }
      }
      // nonConnecte / simule / erreur réseau : silencieux — comportement
      // d'avant (montant du bon), rien de cassé.
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonFacturationId]);
  const bonEnvoiCourriel = bons.find((b) => b.id === bonEnvoiCourrielId) || null;
  const bonEnvoiClient = bons.find((b) => b.id === bonEnvoiClientId) || null;
  const bonRetrait = bonsGroupes.find((b) => b.id === bonRetraitId) || null;
  const bonFactureEnAttente = factureEnAttenteCourriel ? bons.find((b) => b.id === factureEnAttenteCourriel.bonId) : null;

  // Trouve le client d'un bon par son NOM (ces bons de démo n'ont
  // qu'un nom de client, pas d'id — en prod, `bons` porterait un vrai
  // clientId et cette étape de recherche par nom disparaîtrait).
  const trouverClientDuBon = (bon) => clients.find((c) => c.nom === bon?.client);

  // ------------------------------------------------------------
  // 📸 BON DE TRAVAIL AU CLIENT — le lien public (SANS prix).
  // ------------------------------------------------------------
  // Le client reçoit « vos travaux sont terminés » avec le lien vers
  // /bon/[jeton] : descriptif, photos avant/après avec légendes et
  // signature — ni soumission ni facture (décision du propriétaire,
  // 2026-08-15). Lien valide 90 jours (conservé s'il court toujours,
  // régénéré s'il est expiré), PDF téléchargeable sur la page. Le
  // journal ne dit « envoyé » que si c'est vrai.
  // ------------------------------------------------------------
  // RETRAIT DE FACTURATION — demande, validation, remise en pile.
  // ------------------------------------------------------------
  // La demande est ouverte à qui voit la facturation ; la VALIDATION
  // est réservée à l'Admin principal. Tout passe au journal — aucune
  // facture ne disparaît sans trace.
  // ⚠️ CIBLAGE (corrigé 2026-08-17, vécu) : le retrait s'applique par
  // TÂCHE (un travail à plusieurs techniciens se retire d'un bloc) —
  // mais un bon SANS identifiant de tâche (cartes de démonstration,
  // anciennes données) faisait « indéfini = indéfini » : demander le
  // retrait d'UNE carte l'affichait sur TOUTES. Sans tacheId, on cible
  // le bon lui-même, et rien ne part en base (aucune ligne à modifier).
  const memeCibleRetrait = (b) => (x) => (b.tacheId ? x.tacheId === b.tacheId : x.id === b.id);
  const demanderRetrait = async (b, raison, note) => {
    try {
      if (b.tacheId) await demanderRetraitFacturation(b.tacheId, raison, note);
      const cible = memeCibleRetrait(b);
      setBons((prev) => prev.map((x) => (cible(x) ? { ...x, retraitStatut: "demande", retraitRaison: raison, retraitNote: note || "" } : x)));
      // 👑 L'ADMIN PRINCIPAL QUI DEMANDE VALIDE DU MÊME GESTE (2026-09-03,
      // vécu : « regarde ce que ça écrit » — le système lui demandait de
      // se valider lui-même). Le deux-temps reste ENTIER pour les autres
      // rôles : c'est le validateur qui clique, pas la validation qui saute.
      if (estAdminPrincipal) {
        await validerRetrait({ ...b, retraitRaison: raison, retraitNote: note || "" }, true);
        return;
      }
      ajouterJournal(`🕓 Retrait de facturation DEMANDÉ — ${b.client} : ${RAISONS_RETRAIT[raison] || raison}. Un Admin principal doit valider.`);
    } catch {
      ajouterJournal("⚠️ Demande de retrait NON enregistrée — réessaie.");
    }
  };
  const validerRetrait = async (b, approuve) => {
    try {
      if (b.tacheId) await validerRetraitFacturation(b.tacheId, approuve, b.retraitRaison);
      const cible = memeCibleRetrait(b);
      setBons((prev) => prev.map((x) => {
        if (!cible(x)) return x;
        if (!approuve) return { ...x, retraitStatut: null, retraitRaison: null, retraitNote: "" };
        if (b.retraitRaison === "travaux_en_cours") return { ...x, retraitStatut: "reporte" };
        return { ...x, retraitStatut: "retire", statutQb: "retire" };
      }));
      ajouterJournal(
        approuve
          ? b.retraitRaison === "travaux_en_cours"
            ? `🔄 Report APPROUVÉ — ${b.client} sera facturé à la prochaine journée de facturation.`
            : `🗂️ Retrait APPROUVÉ — ${b.client} sort de la facturation (${RAISONS_RETRAIT[b.retraitRaison] || b.retraitRaison}). Ses coûts restent comptés dans l'analyse.`
          : `↩️ Retrait REFUSÉ — le bon de ${b.client} reste à facturer.`
      );
    } catch {
      ajouterJournal("⚠️ Validation du retrait NON enregistrée — réessaie.");
    }
  };
  const remettreBonAFacturer = async (b) => {
    try {
      if (b.tacheId) await remettreAFacturer(b.tacheId);
      const cible = memeCibleRetrait(b);
      setBons((prev) => prev.map((x) => (cible(x) ? { ...x, retraitStatut: null, retraitRaison: null, retraitNote: "", statutQb: "en_attente" } : x)));
      ajouterJournal(`↩️ ${b.client} REMIS à facturer.`);
    } catch {
      ajouterJournal("⚠️ Remise à facturer NON enregistrée — réessaie.");
    }
  };

  // ------------------------------------------------------------
  // GARANTIE D'ENVOI QUICKBOOKS — PDF officiel, renvoi, vérification.
  // ------------------------------------------------------------
  const [verifEnvoisEnCours, setVerifEnvoisEnCours] = useState(false);
  const ouvrirPdfFacture = async (f) => {
    if (!f?.qboInvoiceId) return;
    const ok = await ouvrirFacturePdfQbo(f.qboInvoiceId);
    if (!ok) ajouterJournal("⚠️ PDF indisponible — QuickBooks non connecté ou facture introuvable.");
  };
  const appliquerEnvoiQb = (bonId, factureLigneId, envoiQb) => {
    setBons((prev) => prev.map((x) => {
      if (x.id !== bonId) return x;
      const liste = (x.facturesEmises || []).map((f) => (f.id === factureLigneId ? { ...f, envoiQb } : f));
      if (String(x.id).startsWith("sbb-")) {
        majFacturesEmises(String(x.id).slice(4), liste, x.statutQb === "envoye" ? "envoye" : "a_facturer").catch(() => {});
      }
      return { ...x, facturesEmises: liste };
    }));
  };
  // 📧 RENVOI AVEC CHOIX DES DESTINATAIRES (2026-08-29) — « au cas où le
  // client ne la reçoit pas » : la fenêtre habituelle s'ouvre avec les
  // courriels de la fiche (adresse à corriger, adresse à ajouter), la
  // facture repart par QuickBooks, et la fiche de la facture retient les
  // NOUVEAUX destinataires.
  const [renvoiVers, setRenvoiVers] = useState(null); // { bon, f } | null
  const executerRenvoiVers = async (choix) => {
    const { bon: b, f } = renvoiVers;
    setRenvoiVers(null);
    const adresses = listeDestinataires(choix).map((c) => c.email);
    if (adresses.length === 0) return;
    const r = await envoyerFactureQbo(f.qboInvoiceId, adresses);
    if (r?.envoyee) {
      setBons((prev) =>
        prev.map((x) => {
          if (x.id !== b.id) return x;
          const liste = (x.facturesEmises || []).map((fx) =>
            fx.id === f.id
              ? { ...fx, courrielsEnvoi: adresses, courrielEnvoi: adresses[0] || null, envoiQb: { statut: "envoyee", date: r.envoyeeLe || new Date().toISOString() } }
              : fx
          );
          if (String(x.id).startsWith("sbb-")) {
            majFacturesEmises(String(x.id).slice(4), liste, x.statutQb === "envoye" ? "envoye" : "a_facturer").catch(() => {});
          }
          return { ...x, facturesEmises: liste };
        })
      );
      envoyerCopieInterne({ numero: f.numeroFactureQb, clientNom: b.client || "", totalHT: f.montant, destinataires: adresses });
      ajouterJournal(`✉️ Facture ${f.numeroFactureQb} RENVOYÉE par QuickBooks à ${adresses.join(", ")}.`);
    } else {
      ajouterJournal(`⚠️ Facture ${f.numeroFactureQb} : le renvoi a échoué${r?.erreur ? ` (${r.erreur})` : r?.nonConnecte ? " (QuickBooks non connecté)" : ""} — réessaie.`);
    }
  };

  // ============================================================
  // 🧾 FACTURER UN BON SANS QUICKBOOKS (2026-09-06, GO du propriétaire)
  // ------------------------------------------------------------
  // Le chemin MAISON pour la pile « À facturer » : une entreprise sans
  // connexion QuickBooks émet sa facture officielle (numérotation
  // atomique, taxes du régime, page publique /facture/<jeton>) depuis
  // le MÊME bouton que les autres. Le bon sort de la pile exactement
  // comme avec QuickBooks — impossible de le facturer deux fois.
  // v1 : bons simples. Facture groupée et facturation progressive d'un
  // devis restent QuickBooks pour l'instant.
  // ============================================================
  // 🔢 Le Nº de suivi du CLIENT (PO) du projet lié — part dans le champ
  // « Nº de suivi » de la facture QuickBooks (2026-09-06).
  const suiviDuProjet = (projetId, projetNom = null) => {
    const p = (projets || []).find((x) => x.id === projetId) || (projetNom ? (projets || []).find((x) => x.nom === projetNom) : null);
    return (p?.numeroSuiviClient || "").trim() || null;
  };
  const echeanceDepuisTerme = (terme) => {
    const m = String(terme || "").match(/(\d+)/);
    if (!m) return null;
    const d = new Date(Date.now() + Number(m[1]) * 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const facturerBonMaison = async (id, choixCourriels) => {
    const b = bons.find((x) => x.id === id);
    if (!b) return;
    const fiche = trouverClientDuBon(b);
    const destinataires = listeDestinataires(choixCourriels).map((c) => c.email);
    const lignesMaison = b.lignesNonListees?.length
      ? b.lignesNonListees.map((l) => {
          const montant = Math.round((parseFloat(l.prix) || 0) * 100) / 100;
          const qte = Number(l.quantite) > 0 ? Number(l.quantite) : 1;
          return {
            description: l.description,
            quantite: qte,
            prix_unitaire: Number(l.prixUnitaire) > 0 ? Number(l.prixUnitaire) : Math.round((montant / qte) * 100) / 100,
            montant,
          };
        })
      : [{ description: b.projet || "Travaux", quantite: 1, prix_unitaire: Number(b.montant) || 0, montant: Number(b.montant) || 0 }];
    const sousTotal = Math.round(lignesMaison.reduce((s, l) => s + l.montant, 0) * 100) / 100;
    // Même défaut que la modale maison : Québec (TPS+TVQ) — le régime
    // se choisit dans « Nouvelle facture » pour les cas hors Québec.
    const regime = "qc";
    const taxes = calculerTaxesRegime(sousTotal, regime);
    const total = Math.round((sousTotal + taxes.reduce((s, t) => s + (Number(t.montant) || 0), 0)) * 100) / 100;
    let creee;
    try {
      creee = await creerFactureMaison({
        clientId: fiche?.id || null,
        clientNom: b.client || "",
        clientAdresse: fiche ? adresseFacturationClient(fiche) : "",
        courriels: destinataires,
        lignes: lignesMaison,
        sousTotal,
        taxes,
        regimeTaxes: regime,
        total,
        terme: configEnt?.termePaiementDefaut || "Net 30",
        dateEcheance: echeanceDepuisTerme(configEnt?.termePaiementDefaut || "Net 30"),
        note: b.devisNumero ? `Bon de travail — devis ${b.devisNumero}` : "Bon de travail",
      });
    } catch (e) {
      ajouterJournal(`⚠️ Facture maison NON créée pour « ${b.projet} » : ${e?.message || "erreur"} — le bon reste en attente.`);
      return;
    }
    const lien = lienFactureMaison(creee);
    let envoye = false;
    if (destinataires.length > 0 && lien) {
      const r = await envoyerCourriel({
        a: destinataires,
        sujet: `Facture ${creee.numero} — ${configEnt?.nomCommercial || configEnt?.nomLegal || ""}`,
        html: gabaritFactureMaison({
          config: configEnt,
          numero: creee.numero,
          clientNom: creee.clientNom,
          total: `${creee.total.toFixed(2)} $`,
          lien,
          echeance: creee.dateEcheance,
        }),
      }).catch(() => ({}));
      if (r?.envoye || r?.simule) {
        envoye = true;
        majFactureMaison(creee.id, { statut: "envoyee", envoyeeLe: new Date().toISOString(), courriels: destinataires }).catch(() => {});
      }
    }
    // Le bon sort de la pile — même mécanique que le chemin QuickBooks.
    const entree = {
      id: `fact-${Date.now()}`,
      montant: sousTotal,
      type: "complete",
      detail: "facture maison",
      date: dateISO(new Date()),
      numeroFactureQb: creee.numero,
      factureMaisonId: creee.id,
      courrielEnvoi: destinataires[0] || null,
      courrielsEnvoi: destinataires,
      envoiQb: envoye ? { statut: "envoyee", date: new Date().toISOString() } : null,
    };
    const nouvelles = [...(b.facturesEmises || []), entree];
    setBons((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, statutQb: "envoye", facturesEmises: nouvelles, courrielFacturation: destinataires[0] || null, courrielsFacturation: destinataires }
          : x
      )
    );
    if (String(b.id).startsWith("sbb-")) {
      majFacturesEmises(String(b.id).slice(4), nouvelles, "envoye").catch(() =>
        ajouterJournal("⚠️ Facture maison affichée mais NON enregistrée en base — vérifie la connexion.")
      );
    }
    ajouterJournal(
      `🧾 Facture MAISON ${creee.numero} — « ${b.projet} » (${b.client}) · ${sousTotal.toFixed(2)} $ HT` +
        (envoye
          ? ` · envoyée à ${destinataires.join(", ")}`
          : destinataires.length > 0
            ? " · ⚠️ courriel NON parti — bouton Renvoyer dans Factures maison"
            : " · aucun destinataire — le lien vit dans Factures maison")
    );
  };

  const renvoyerFactureQb = async (b, f) => {
    const adresses = (f.courrielsEnvoi || []).filter(Boolean);
    if (adresses.length === 0) {
      ajouterJournal(`⚠️ Aucun destinataire noté sur la facture ${f.numeroFactureQb} — impossible de renvoyer.`);
      return;
    }
    const r = await envoyerFactureQbo(f.qboInvoiceId, adresses);
    if (r?.envoyee) {
      appliquerEnvoiQb(b.id, f.id, { statut: "envoyee", date: r.envoyeeLe || new Date().toISOString() });
      envoyerCopieInterne({ numero: f.numeroFactureQb, clientNom: b.client || "", totalHT: f.montant, destinataires: adresses });
      ajouterJournal(`✉️ Facture ${f.numeroFactureQb} ENVOYÉE par QuickBooks à ${adresses.join(", ")} — confirmé au registre.`);
    } else {
      appliquerEnvoiQb(b.id, f.id, { statut: "non_confirme", date: null });
      ajouterJournal(`⚠️ Facture ${f.numeroFactureQb} : envoi toujours NON confirmé${r?.erreur ? ` (${r.erreur})` : r?.nonConnecte ? " (QuickBooks non connecté)" : ""}.`);
    }
  };
  const verifierTousEnvois = async () => {
    const aVerifier = [];
    bons.forEach((x) => (x.facturesEmises || []).forEach((f) => {
      if (f.qboInvoiceId) aVerifier.push({ bonId: x.id, factureLigneId: f.id, qbId: f.qboInvoiceId });
    }));
    if (aVerifier.length === 0) {
      ajouterJournal("Aucune facture QuickBooks à vérifier — rien d'émis encore.");
      return;
    }
    setVerifEnvoisEnCours(true);
    const r = await verifierEnvoisQbo(aVerifier.map((x) => x.qbId));
    setVerifEnvoisEnCours(false);
    if (!r?.statuts) {
      ajouterJournal(`⚠️ Vérification impossible — ${r?.erreur || (r?.nonConnecte ? "QuickBooks non connecté" : r?.simule ? "QuickBooks non configuré ici" : "réessaie")}.`);
      return;
    }
    let ok = 0;
    let manquantes = 0;
    aVerifier.forEach((x) => {
      const s = r.statuts[x.qbId];
      if (!s) return;
      if (s.envoyee) { ok += 1; appliquerEnvoiQb(x.bonId, x.factureLigneId, { statut: "envoyee", date: s.envoyeeLe || new Date().toISOString() }); }
      else { manquantes += 1; appliquerEnvoiQb(x.bonId, x.factureLigneId, { statut: "non_confirme", date: null }); }
    });
    ajouterJournal(
      manquantes === 0
        ? `✅ Vérification des envois : ${ok} facture(s) confirmée(s) envoyée(s) par QuickBooks — rien ne s'est perdu.`
        : `⚠️ Vérification des envois : ${manquantes} facture(s) JAMAIS envoyée(s) par QuickBooks — bouton Renvoyer sur leur carte.`
    );
  };

  const envoyerBonAuClient = async (b, choix) => {
    const adresses = [...new Set((choix || []).map((cc) => cc.email))].filter(Boolean);
    if (adresses.length === 0) return;
    const rowId = String(b.id).startsWith("sbb-") ? String(b.id).slice(4) : null;
    if (!rowId) {
      ajouterJournal(`⚠️ Bon de « ${b.client} » pas encore synchronisé — impossible de créer le lien client.`);
      return;
    }
    try {
      const jeton = await assurerJetonBon(rowId);
      const r = await envoyerCourriel({
        a: adresses,
        sujet: `Vos travaux sont terminés — bon de travail (${configEnt.nomCommercial || configEnt.nomLegal})`,
        html: gabaritBonTravail({ config: configEnt, clientNom: b.client, lien: lienBonPublic(jeton), joursValidite: JOURS_VALIDITE_BON }),
      });
      if (r.envoye) {
        marquerBonEnvoyeClient(rowId).catch(() => {});
        setBons((prev) => prev.map((x) => (x.id === b.id ? { ...x, envoyeClientLe: new Date().toISOString() } : x)));
        ajouterJournal(`📸 Bon de travail de ${b.client} ENVOYÉ à ${adresses.join(", ")} — descriptif avec photos, sans prix, lien valide ${JOURS_VALIDITE_BON} jours.`);
      } else if (r.simule) {
        ajouterJournal(`🔧 Envoi SIMULÉ du bon au client (service de courriels non configuré) — le lien existe : ${lienBonPublic(jeton)}`);
      } else {
        ajouterJournal(`⚠️ Bon de travail de ${b.client} NON envoyé — ${r.erreur}`);
      }
    } catch {
      ajouterJournal("⚠️ Bon de travail NON envoyé — le lien n'a pas pu être créé. Réessaie.");
    }
  };

  // VRAIE FACTURE QUICKBOOKS (2026-08-15) — le numéro vient de
  // QuickBooks, plus jamais inventé. `paiements` = le choix HUMAIN fait
  // dans la fenêtre d'avant-envoi (carte/virement, décochés par défaut).
  // Un échec QuickBooks n'invente rien : le bon RESTE « en attente » et
  // le journal dit pourquoi — pas de numéro fictif sur un vrai échec.
  // ➕ FACTURE LIBRE (2026-08-28) — même route QuickBooks que les
  // autres factures, mais sans bon de travail. Le rattachement à un
  // projet passe par la mécanique d'attribution existante : la facture
  // créée s'appelle « QBO-INV-<id> », exactement la forme que la
  // synchronisation QuickBooks produit — son montant entre donc dans la
  // rentabilité du projet à la prochaine synchro. Sans projet, elle est
  // attribuée au CLIENT : elle ne tombe jamais dans la pile « à
  // rattacher ».
  const emettreFactureLibre = async (donnees, choixCourriels, paiements = {}) => {
    const destinataires = listeDestinataires(choixCourriels);
    const lignes = (donnees.lignes || []).filter((l) => l.description && l.montant > 0);
    if (lignes.length === 0) return;
    const nomClient = donnees.client?.nom || "";
    const totalDemande = lignes.reduce((s, l) => s + l.montant, 0);

    // 🔒 VERROU ANTI-DOUBLON (2026-08-31 — factures 4251/4252 créées en
    // double chez un client) : si une facture IDENTIQUE (même client,
    // même montant) est encore « en création » ou « à vérifier », ou a
    // été confirmée il y a moins de 3 minutes, on REFUSE de réémettre —
    // le premier envoi a peut-être réussi côté QuickBooks sans que sa
    // réponse nous soit revenue.
    const jumelle = (facturesLibres || []).find(
      (fl) =>
        fl.clientNom === nomClient &&
        Math.abs(fl.montantHT - totalDemande) < 0.005 &&
        (fl.statut === "en_creation" ||
          fl.statut === "a_verifier" ||
          (fl.statut !== "annulee" && fl.creeLe && Date.now() - new Date(fl.creeLe).getTime() < 3 * 60 * 1000))
    );
    if (jumelle) {
      ajouterJournal(
        `🔒 Facture NON réémise pour ${nomClient} (${totalDemande.toFixed(2)} $ HT) : une facture identique ${jumelle.statut === "en_creation" || jumelle.statut === "a_verifier" ? "est peut-être déjà rendue chez QuickBooks — vérifie « Factures sans chantier » et QuickBooks avant de recommencer" : `vient d'être créée (nº ${jumelle.docNumber || "?"})`}.`
      );
      return;
    }

    // 1er temps : la facture s'INSCRIT AU REGISTRE avant de partir —
    // si la réponse de QuickBooks se perd en route, il reste une trace
    // « à vérifier » au lieu d'un doublon invisible.
    let brouillon = null;
    try {
      brouillon = await enregistrerFactureLibre({
        statut: "en_creation",
        clientId: donnees.client?.id || null,
        clientNom: nomClient,
        montantHT: totalDemande,
        courriels: destinataires.map((c) => c.email),
        projetId: (projets || []).find((p) => p.id === donnees.projetId)?.id || null,
        reference: donnees.reference || "",
      });
      setFacturesLibres((prev) => [brouillon, ...prev]);
    } catch {
      // Registre indisponible (snippet pas passé ?) — on continue sans
      // verrou plutôt que de bloquer la facturation.
    }

    const r = await creerFactureQbo({
      clientId: donnees.client?.id || null,
      clientNom: nomClient,
      lignes: lignes.map((l) => ({ description: l.description, montant: l.montant })),
      termePaiement: configEnt?.termePaiementDefaut || "Net 30",
      reference: donnees.reference || "Facture",
      paiementCarte: paiements.carte === true,
      paiementVirement: paiements.virement === true,
      // 📧 TOUJOURS envoyée : contrairement aux factures issues d'un bon
      // (qui ont leur propre bouton « Renvoyer »), ici l'utilisateur vient
      // de CHOISIR les destinataires dans une fenêtre dédiée — les ignorer
      // parce que l'envoi automatique est décoché ne produisait qu'une
      // facture muette que personne ne recevait.
      envoyerA: destinataires.map((c) => c.email),
      adresseTravaux: null,
    });
    // Le sort du brouillon suit la RÉPONSE : refus clair de QuickBooks =
    // rien n'a été créé là-bas, le brouillon s'efface ; réponse JAMAIS
    // revenue (réseau coupé, délai) = la facture existe PEUT-ÊTRE — le
    // brouillon devient « à vérifier » et le verrou bloque toute
    // réémission aveugle.
    const reponsePerdue = r?.erreur === "Réseau indisponible — réessaie.";
    if (r?.erreur || r?.nonConnecte) {
      if (brouillon) {
        if (reponsePerdue) {
          majFactureLibre(brouillon.id, { statut: "a_verifier" }).catch(() => {});
          setFacturesLibres((prev) => prev.map((fl) => (fl.id === brouillon.id ? { ...fl, statut: "a_verifier" } : fl)));
        } else {
          supprimerFactureLibreEnCreation(brouillon.id).catch(() => {});
          setFacturesLibres((prev) => prev.filter((fl) => fl.id !== brouillon.id));
        }
      }
      if (r?.nonConnecte) ajouterJournal("🔌 QuickBooks non connecté — facture libre NON créée (Paramètres → Connexions).");
      else if (reponsePerdue)
        ajouterJournal(
          `⚠️ Facture pour ${nomClient} : la réponse de QuickBooks n'est PAS revenue — elle est marquée « à vérifier » dans « Factures sans chantier ». VÉRIFIE dans QuickBooks avant de la refaire.`
        );
      else ajouterJournal(`⚠️ Facture libre NON créée pour ${nomClient} : ${r.erreur}`);
      return;
    }
    const total = lignes.reduce((s, l) => s + l.montant, 0);
    const numero = r?.docNumber || r?.factureId || "—";
    // Rattachement : projet choisi, sinon le dossier du client.
    const projetChoisi = (projets || []).find((p) => p.id === donnees.projetId) || null;
    if (r?.factureId) {
      const cible = projetChoisi
        ? { type: "projet", id: projetChoisi.id }
        : donnees.client?.id
          ? { type: "client", id: donnees.client.id }
          : null;
      if (cible) {
        await enregistrerAttributionQb(`QBO-INV-${r.factureId}`, cible, nomAdmin || null).catch(() =>
          ajouterJournal(`⚠️ Facture ${numero} créée, mais son rattachement n'a PAS été enregistré — rattache-la à la main dans la liste des factures QuickBooks.`)
        );
      }
    }
    // 🔄 SYNCHRO IMMÉDIATE quand la facture est rattachée à un projet :
    // l'attribution vient d'être posée, il ne manque plus que la
    // transaction elle-même pour que le montant apparaisse dans la
    // rentabilité. Non bloquant — un échec ne perd rien (le prochain
    // « Synchroniser QuickBooks » rattrape tout).
    if (projetChoisi && onSynchroniserQb) {
      await Promise.resolve(onSynchroniserQb()).catch(() => {});
    }
    const envoyee = r?.envoiQb?.envoyee;
    // 🧾 REGISTRE LOCAL (2026-08-29, 2 temps depuis 2026-08-31) : le
    // brouillon inscrit AVANT l'appel devient la facture confirmée.
    try {
      const confirmee = {
        qboInvoiceId: r?.factureId || null,
        docNumber: numero,
        envoiStatut: envoyee ? "envoyee" : "non_confirme",
        envoyeeLe: envoyee ? r?.envoiQb?.envoyeeLe || new Date().toISOString() : null,
        statut: "creee",
      };
      if (brouillon) {
        const enregistree = await majFactureLibre(brouillon.id, confirmee);
        setFacturesLibres((prev) => prev.map((fl) => (fl.id === brouillon.id ? enregistree : fl)));
      } else {
        const enregistree = await enregistrerFactureLibre({
          ...confirmee,
          clientId: donnees.client?.id || null,
          clientNom: nomClient,
          montantHT: total,
          courriels: destinataires.map((c) => c.email),
          projetId: projetChoisi?.id || null,
          reference: donnees.reference || "",
        });
        setFacturesLibres((prev) => [enregistree, ...prev]);
      }
    } catch {
      ajouterJournal(`⚠️ Facture ${numero} créée dans QuickBooks, mais NON inscrite au registre local (le snippet 117 est-il passé ?) — elle n'apparaîtra pas dans « Factures sans chantier ».`);
    }
    ajouterJournal(
      `🧾 Facture libre ${numero} créée pour ${nomClient} — ${total.toFixed(2)} $ HT` +
        (projetChoisi ? ` · rattachée au projet « ${projetChoisi.nom} » (montant intégré à sa rentabilité)` : " · sans projet") +
        (envoyee
          ? ` · envoyée par QuickBooks à ${destinataires.map((c) => c.email).join(", ")}`
          : " · ⚠️ envoi par QuickBooks NON confirmé — renvoie-la depuis QuickBooks")
    );
  };

  // 📅 UNE FACTURE POUR TOUT UN CHANTIER (2026-08-28) — la facturation
  // mensuelle des gros projets. UNE seule facture QuickBooks, mais UNE
  // LIGNE PAR BON (date + description + montant) : le client voit le
  // détail de son mois, et les N bons passent « facturés » d'un coup —
  // ils quittent la pile, donc plus de risque de facturer deux fois.
  const facturerGroupe = async (groupe, choixCourriels, paiements = {}) => {
    const destinataires = listeDestinataires(choixCourriels);
    const bonsDuGroupe = (groupe?.bons || []).filter((b) => resteAFacturerDe(b) > 0);
    if (bonsDuGroupe.length === 0) return;
    const clientNom = groupe.clientNom || bonsDuGroupe[0]?.client || "";
    const fiche = (clientsFacturation || []).find((c) => c.nom === clientNom) || null;
    // 🧾 LE DÉTAIL DE LA RÉVISION SUIT LA FACTURE (2026-09-04, vécu
    // facture 4264 : les prix et détails fixés dans la révision étaient
    // écrasés par UNE ligne plate par bon). Quand un bon révisé est
    // facturé AU COMPLET, ses lignes détaillées partent telles quelles
    // (préfixées de la date) — descriptions à 0 $ comprises, elles
    // expliquent le travail au client. Un bon facturé PARTIELLEMENT
    // garde la ligne plate : son détail ne correspondrait plus au reste.
    const lignes = bonsDuGroupe.flatMap((b) => {
      const reste = resteAFacturerDe(b);
      const details = Array.isArray(b.lignesNonListees) ? b.lignesNonListees : [];
      const totalDetails = details.reduce((s, l) => s + (parseFloat(l.prix) || 0), 0);
      if (details.length > 0 && Math.abs(totalDetails - reste) < 0.01) {
        return details.map((l) => ({
          description: [b.date, l.description].filter(Boolean).join(" — "),
          montant: parseFloat(l.prix) || 0,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
        }));
      }
      return [{ description: [b.date, b.projet || "Travaux"].filter(Boolean).join(" — "), montant: reste }];
    });
    const total = lignes.reduce((s, l) => s + l.montant, 0);
    const r = await creerFactureQbo({
      clientId: fiche?.id || null,
      clientNom,
      // 📅 Date du bon le plus récent du groupe (décision 2026-09-06) —
      // chaque ligne garde SA date de travaux. 🔢 Suivi du projet.
      dateFacture: bonsDuGroupe.map((x) => x.date).filter(Boolean).sort().slice(-1)[0] || null,
      numeroSuivi: suiviDuProjet(bonsDuGroupe[0]?.projetId, groupe.projetNom),
      lignes,
      termePaiement: configEnt?.termePaiementDefaut || "Net 30",
      reference: groupe.projetNom || "travaux",
      paiementCarte: paiements.carte === true,
      paiementVirement: paiements.virement === true,
      // 📧 TOUJOURS envoyée : contrairement aux factures issues d'un bon
      // (qui ont leur propre bouton « Renvoyer »), ici l'utilisateur vient
      // de CHOISIR les destinataires dans une fenêtre dédiée — les ignorer
      // parce que l'envoi automatique est décoché ne produisait qu'une
      // facture muette que personne ne recevait.
      envoyerA: destinataires.map((c) => c.email),
      adresseTravaux: bonsDuGroupe[0]?.adresseTravaux || null,
    });
    if (r?.erreur) {
      ajouterJournal(`⚠️ Facture groupée NON créée pour ${clientNom} : ${r.erreur} — les ${bonsDuGroupe.length} bons restent en attente`);
      return;
    }
    if (r?.nonConnecte) {
      ajouterJournal("🔌 QuickBooks non connecté — facture groupée NON créée. Les bons restent en attente.");
      return;
    }
    const numero = r?.docNumber || r?.factureId || "—";
    const envoiSimple = r?.envoiQb
      ? r.envoiQb.envoyee
        ? { statut: "envoyee", date: r.envoiQb.envoyeeLe || new Date().toISOString() }
        : { statut: "non_confirme", date: null }
      : null;
    // Chaque bon reçoit SA part de la facture commune — les montants
    // restent justes bon par bon, et le numéro les relie entre eux.
    const idsDuGroupe = new Set(bonsDuGroupe.map((b) => b.id));
    const partDe = new Map(bonsDuGroupe.map((b) => [b.id, resteAFacturerDe(b)]));
    setBons((prev) =>
      prev.map((x) => {
        if (!idsDuGroupe.has(x.id)) return x;
        const entree = {
          id: `fact-${Date.now()}-${x.id}`,
          montant: partDe.get(x.id) || 0,
          type: "complete",
          detail: `facture groupée ${numero}`,
          date: dateISO(new Date()),
          numeroFactureQb: numero,
          qboInvoiceId: r?.factureId || null,
          courrielEnvoi: destinataires[0]?.email || null,
          courrielsEnvoi: destinataires.map((c) => c.email),
          envoiQb: envoiSimple,
        };
        const nouvelles = [...(x.facturesEmises || []), entree];
        // Persistance — sinon les factures émises meurent au rechargement.
        if (String(x.id).startsWith("sbb-")) {
          majFacturesEmises(String(x.id).slice(4), nouvelles, "envoye").catch(() =>
            ajouterJournal(`⚠️ Facture ${numero} affichée sur « ${x.projet} » mais NON enregistrée — vérifie la connexion.`)
          );
        }
        return {
          ...x,
          statutQb: "envoye",
          facturesEmises: nouvelles,
          courrielFacturation: destinataires[0]?.email || null,
          courrielsFacturation: destinataires.map((c) => c.email),
        };
      })
    );
    envoyerCopieInterne({ numero, clientNom, totalHT: total, destinataires, lignes });
    ajouterJournal(
      `📅 Facture GROUPÉE ${numero} — ${clientNom}${groupe.projetNom ? ` · ${groupe.projetNom}` : ""} : ${bonsDuGroupe.length} bons réunis, ${total.toFixed(2)} $ HT` +
        (r?.envoiQb?.envoyee
          ? ` · envoyée à ${destinataires.map((c) => c.email).join(", ")}`
          : (r?.envoiQb?.ratees || []).length > 0
            ? ` · ⚠️ envoi NON confirmé pour ${r.envoiQb.ratees.join(", ")}${destinataires.length > r.envoiQb.ratees.length ? " (les autres adresses ont reçu)" : ""} — renvoie depuis QuickBooks ou corrige l'adresse`
            : " · ⚠️ envoi par QuickBooks NON confirmé — renvoie-la depuis QuickBooks")
    );
  };

  const envoyerQb = async (id, choixCourriels, paiements = {}) => {
    const destinataires = listeDestinataires(choixCourriels);
    const b = bons.find((x) => x.id === id);
    if (!b) return;
    const fiche = trouverClientDuBon(b);
    // Les lignes réelles de la révision (déductions incluses) — sinon le
    // montant global du bon.
    const lignes = b.lignesNonListees?.length
      ? b.lignesNonListees.map((l) => ({ description: l.description, montant: parseFloat(l.prix) || 0, quantite: l.quantite, prixUnitaire: l.prixUnitaire }))
      : [{ description: b.projet || "Travaux", montant: Number(b.montant) || 0 }];
    const r = await creerFactureQbo({
      clientId: fiche?.id || null,
      clientNom: b.client,
      // 📅 Date des travaux (décision du propriétaire, 2026-09-06 —
      // mise en garde taxes donnée) + 🔢 suivi du projet lié.
      dateFacture: b.date || null,
      numeroSuivi: suiviDuProjet(b.projetId),
      lignes,
      termePaiement: configEnt?.termePaiementDefaut || "Net 30",
      reference: b.projet || "travaux",
      paiementCarte: paiements.carte === true,
      paiementVirement: paiements.virement === true,
      // QuickBooks envoie lui-même SA facture — seulement si
      // l'entreprise a activé l'envoi automatique (Paramètres).
      envoyerA: configEnt?.envoiAutoFactureQb === true ? destinataires.map((c) => c.email) : [],
      adresseTravaux: b.adresseTravaux || null,
      // 🔗 Le bon vient d'un devis ? La facture référence son estimate
      // QuickBooks — la comptable voit devis → accepté → facturé.
      qboEstimateId: (b.devisNumero && devisListe.find((d) => d.numero === b.devisNumero)?.qboEstimateId) || null,
    });
    if (r?.erreur) {
      ajouterJournal(`⚠️ Facture QuickBooks NON créée pour "${b.projet}" : ${r.erreur} — le bon reste en attente`);
      return;
    }
    if (r?.nonConnecte) {
      ajouterJournal("🔌 QuickBooks non connecté — facture NON créée (Paramètres → Connexions). Le bon reste en attente.");
      return;
    }
    const numeroReel = r?.docNumber || r?.factureId || `QBINV-${Math.floor(10000 + Math.random() * 90000)}`;
    if (r?.lienEstimate === false) {
      ajouterJournal(`⚠️ Facture ${numeroReel} créée, mais QuickBooks a refusé le lien vers l'estimate du devis ${b.devisNumero || ""} — relie-les à la main dans QuickBooks si nécessaire.`);
    }
    // La PREUVE d'envoi — lue du registre QuickBooks par la route.
    const envoiQbSimple = r?.envoiQb
      ? r.envoiQb.envoyee
        ? { statut: "envoyee", date: r.envoiQb.envoyeeLe || new Date().toISOString() }
        : { statut: "non_confirme", date: null }
      : null;
    const entree = {
      id: `fact-${Date.now()}`,
      montant: Number(b.montant) || lignes.reduce((x, l) => x + l.montant, 0),
      type: "complete",
      detail: "envoi direct",
      date: dateISO(new Date()),
      numeroFactureQb: numeroReel,
      qboInvoiceId: r?.factureId || null,
      courrielEnvoi: destinataires[0]?.email || null,
      courrielsEnvoi: destinataires.map((c) => c.email),
      envoiQb: envoiQbSimple,
    };
    const nouvelles = [...(b.facturesEmises || []), entree];
    setBons((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, statutQb: "envoye", facturesEmises: nouvelles, courrielFacturation: destinataires[0]?.email || null, courrielsFacturation: destinataires.map((c) => c.email) }
          : x
      )
    );
    // PERSISTANCE — les factures émises survivent enfin au rechargement.
    if (String(b.id).startsWith("sbb-")) {
      majFacturesEmises(String(b.id).slice(4), nouvelles, "envoye").catch(() =>
        ajouterJournal("⚠️ Facture émise affichée mais NON enregistrée en base — vérifie la connexion.")
      );
    }
    if (r?.creee) {
      envoyerCopieInterne({ numero: numeroReel, clientNom: b.client || "", totalHT: entree.montant, destinataires, lignes });
    }
    ajouterJournal(
      r?.creee
        ? `🧾 Facture QuickBooks Nº ${numeroReel} créée pour "${b.projet}"${paiements.carte || paiements.virement ? ` — paiement en ligne offert : ${[paiements.carte ? "carte" : null, paiements.virement ? "virement" : null].filter(Boolean).join(" + ")}` : ""}${envoiQbSimple ? (envoiQbSimple.statut === "envoyee" ? ` — ✉️ ENVOYÉE par QuickBooks à ${libelleDestinataires(destinataires)} (confirmé au registre)` : (r?.envoiQb?.ratees || []).length > 0 ? ` — ⚠️ envoi NON confirmé pour ${r.envoiQb.ratees.join(", ")}${destinataires.length > r.envoiQb.ratees.length ? " (les autres ont reçu)" : ""} : bouton Renvoyer sur la carte` : " — ⚠️ envoi par QuickBooks NON CONFIRMÉ : bouton Renvoyer sur la carte") : destinataires.length > 0 ? ` — destinataires notés : ${libelleDestinataires(destinataires)}` : ""}`
        : `🧪 QuickBooks non configuré ici — numéro local ${numeroReel} (normal en développement)`
    );
    setBonEnvoiCourrielId(null);
  };

  // Émet une facture progressive pour un travail « avec devis » ou
  // « entretien selon contrat ». Le solde restant plafonne toujours le
  // montant possible (voir ModalFacturationDevis) — le statut ne passe
  // à « envoyé » que lorsque le cumul atteint le montant total du
  // devis/contrat.
  const emettreFacture = async (bonId, { montant, type, detail, lignesFacture }, choixCourriels, paiements = {}) => {
    const destinataires = listeDestinataires(choixCourriels);
    // Le devis maison d'abord ; sinon le devis QuickBooks retrouvé par
    // numéro — son total sert au statut « envoyé » (cumul atteint).
    const numeroDevisBon = bons.find((b) => b.id === bonId)?.devisNumero;
    const devisCourant = devisListe.find((d) => d.numero === numeroDevisBon) || devisQboCache[numeroDevisBon] || null;
    // Chaque facture — complète OU partielle (par pourcentage, par item,
    // ou par échéance de contrat) — est envoyée individuellement à
    // QuickBooks et y crée sa propre facture, avec son propre numéro.
    // Une tâche facturée en plusieurs fois génère donc plusieurs
    // factures QuickBooks distinctes, toutes rattachées au même devis.
    // VRAIE facture QuickBooks — le numéro fictif ne sert plus que de
    // repli quand QuickBooks n'est pas configuré (développement local).
    const fiche = trouverClientDuBon(bons.find((x) => x.id === bonId) || {});
    const libelle = type === "pourcentage" ? `${detail}` : type === "echeance" ? `échéance (${detail})` : type === "sur_mesure" ? "sur mesure par item" : "complète";
    // 📋 Les LIGNES de la facture : le détail du devis quand la modale
    // l'a fourni (sur mesure, complète) ; sinon la ligne unique au
    // montant + les items du devis en lignes DESCRIPTIVES à 0 $ (le
    // client voit sur quoi porte son pourcentage ou son échéance).
    const lignesEnvoyees =
      Array.isArray(lignesFacture) && lignesFacture.length > 0
        ? lignesFacture
        : [
            { description: `${bons.find((x) => x.id === bonId)?.projet || "Travaux"} — facturation ${libelle}`, montant },
            ...(devisCourant?.lignes || []).map((l) => ({
              description: `${l.quantite} × ${l.nom}${String(l.description || "").trim() ? `\n${String(l.description).trim()}` : ""}`,
              montant: 0,
            })),
          ];
    const rQbo = await creerFactureQbo({
      clientId: fiche?.id || null,
      clientNom: bons.find((x) => x.id === bonId)?.client || "",
      // 🔢 Suivi du projet lié — la facture progressive garde la date
      // d'émission (facturation périodique, pas une date de travaux).
      numeroSuivi: suiviDuProjet(bons.find((x) => x.id === bonId)?.projetId),
      lignes: lignesEnvoyees,
      termePaiement: configEnt?.termePaiementDefaut || "Net 30",
      reference: `${bons.find((x) => x.id === bonId)?.devisNumero || "travaux"}`,
      paiementCarte: paiements.carte === true,
      paiementVirement: paiements.virement === true,
      // QuickBooks envoie SA facture — seulement si l'entreprise a
      // activé l'envoi automatique. La route relit la preuve au registre.
      envoyerA: configEnt?.envoiAutoFactureQb === true ? destinataires.map((c) => c.email) : [],
      adresseTravaux: bons.find((x) => x.id === bonId)?.adresseTravaux || null,
      // 🔗 Facturation progressive d'un devis : chaque facture référence
      // l'estimate du dossier — devis → accepté → facturé, visible dans
      // QuickBooks, et l'estimate se ferme quand tout est facturé.
      qboEstimateId: devisCourant?.qboEstimateId || devisCourant?.estimateId || null,
    });
    if (rQbo?.erreur || rQbo?.nonConnecte) {
      ajouterJournal(
        rQbo?.nonConnecte
          ? "🔌 QuickBooks non connecté — facture NON créée (Paramètres → Connexions)."
          : `⚠️ Facture QuickBooks NON créée : ${rQbo.erreur} — rien n'a été émis`
      );
      return;
    }
    const numeroFactureQb = rQbo?.docNumber || rQbo?.factureId || `QBINV-${Math.floor(10000 + Math.random() * 90000)}`;
    if (rQbo?.lienEstimate === false) {
      ajouterJournal(`⚠️ Facture ${numeroFactureQb} créée, mais QuickBooks a refusé le lien vers l'estimate du devis ${numeroDevisBon || ""} — relie-les à la main dans QuickBooks si nécessaire.`);
    }
    // La PREUVE d'envoi — lue du registre QuickBooks par la route.
    const envoiQb = rQbo?.envoiQb
      ? rQbo.envoiQb.envoyee
        ? { statut: "envoyee", date: rQbo.envoiQb.envoyeeLe || new Date().toISOString() }
        : { statut: "non_confirme", date: null }
      : null;
    setBons((prev) =>
      prev.map((b) => {
        if (b.id !== bonId) return b;
        const nouvelles = [
          ...(b.facturesEmises || []),
          {
            id: `fact-${Date.now()}`,
            montant,
            type,
            detail,
            date: dateISO(new Date()),
            numeroFactureQb,
            qboInvoiceId: rQbo?.factureId || null,
            courrielEnvoi: destinataires[0]?.email || null,
            courrielsEnvoi: destinataires.map((c) => c.email),
            envoiQb,
          },
        ];
        const cumul = nouvelles.reduce((s, f) => s + f.montant, 0);
        const total = devisCourant ? devisCourant.totalVendant : b.montant;
        const complet = cumul >= total - 0.01;
        return { ...b, facturesEmises: nouvelles, statutQb: complet ? "envoye" : "en_attente" };
      })
    );
    const b = bons.find((x) => x.id === bonId);
    // PERSISTANCE — reconstruit la même liste que le setBons ci-dessus
    // (b est l'état AVANT ajout) et l'écrit en base avec le statut.
    if (b && String(b.id).startsWith("sbb-")) {
      const listePersistee = [
        ...(b.facturesEmises || []),
        { id: `fact-${Date.now()}`, montant, type, detail, date: dateISO(new Date()), numeroFactureQb, qboInvoiceId: rQbo?.factureId || null, courrielEnvoi: destinataires[0]?.email || null, courrielsEnvoi: destinataires.map((c) => c.email), envoiQb },
      ];
      const totalAttendu = devisCourant ? devisCourant.totalVendant : b.montant;
      const cumulPersiste = listePersistee.reduce((x, f) => x + f.montant, 0);
      majFacturesEmises(String(b.id).slice(4), listePersistee, cumulPersiste >= totalAttendu - 0.01 ? "envoye" : "a_facturer").catch(() =>
        ajouterJournal("⚠️ Facture émise affichée mais NON enregistrée en base — vérifie la connexion.")
      );
    }
    ajouterJournal(
      `🧾 Facture${rQbo?.creee ? " QuickBooks" : " (locale)"} Nº ${numeroFactureQb} de ${montant.toFixed(2)} $ (${libelle}) créée pour "${b?.projet}" — ${b?.type === "entretien_contrat" ? "contrat" : "devis"} #${b?.devisNumero}` +
        `${paiements.carte || paiements.virement ? ` — paiement en ligne : ${[paiements.carte ? "carte" : null, paiements.virement ? "virement" : null].filter(Boolean).join(" + ")}` : ""}` +
        (envoiQb
          ? envoiQb.statut === "envoyee"
            ? ` — ✉️ ENVOYÉE par QuickBooks à ${libelleDestinataires(destinataires)} (confirmé au registre)`
            : ` — ⚠️ envoi par QuickBooks NON CONFIRMÉ : bouton Renvoyer sur la carte`
          : destinataires.length > 0
            ? ` — destinataires notés : ${libelleDestinataires(destinataires)}`
            : "")
    );
    setBonFacturationId(null);
    setFactureEnAttenteCourriel(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      {/* 🤝 SOUS-TRAITANCE À FACTURER (2026-08-19) — la ceinture de
          sécurité : chaque visite de sous-traitant marquée « Présent »
          reste ici tant que le client n'a pas été facturé. */}
      {(() => {
        const aFacturer = (assignationsST || []).filter(
          (a) => a?.donnees?.stStatut === "present" && !a?.donnees?.stFacture
        );
        if (aFacturer.length === 0) return null;
        return (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
              🤝 Sous-traitance à facturer au client ({aFacturer.length})
            </p>
            <div className="mt-2 space-y-1.5">
              {aFacturer.map((a) => (
                <div key={`${a.tache_id}|${a.employe_email}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800">
                      {a.titre || "Tâche"}{a.client_nom ? ` — ${a.client_nom}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {a.employe_nom || "Sous-traitant"} · {a.date_debut}
                      {Number(a?.donnees?.stMontant) > 0 ? ` · il te facture ${Number(a.donnees.stMontant).toFixed(2)} $` : ""}
                      {a?.donnees?.stNote ? ` · 📝 ${a.donnees.stNote}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => onMarquerSTFacture?.(a.tache_id, a.employe_email)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                  >
                    ✓ Facturé au client
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-amber-700">
              Une visite disparaît d&apos;ici quand tu la marques facturée — rien ne s&apos;oublie.
            </p>
          </div>
        );
      })()}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        <button
          onClick={() => basculerFiltre("rouge")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("rouge") ? "border-red-400 bg-red-50 ring-2 ring-red-300" : "border-red-100 bg-red-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-red-600 tabular-nums">{rouges}</p>
          <p className="text-xs font-semibold text-red-600">À réviser — prix non listé</p>
        </button>
        <button
          onClick={() => basculerFiltre("bleu")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("bleu") ? "border-blue-400 bg-blue-50 ring-2 ring-blue-300" : "border-blue-100 bg-blue-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-blue-600 tabular-nums">{bleus}</p>
          <p className="text-xs font-semibold text-blue-600">À valider — selon devis</p>
        </button>
        <button
          onClick={() => basculerFiltre("violet")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("violet") ? "border-purple-400 bg-purple-50 ring-2 ring-purple-300" : "border-purple-100 bg-purple-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-purple-600 tabular-nums">{violets}</p>
          <p className="text-xs font-semibold text-purple-600">À valider — contrat</p>
        </button>
        <button
          onClick={() => basculerFiltre("jaune")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("jaune") ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300" : "border-amber-100 bg-amber-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{jaunes}</p>
          <p className="text-xs font-semibold text-amber-600">Prêts — bon de commande</p>
        </button>
        <button
          onClick={() => basculerFiltre("gris")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("gris") ? "border-teal-400 bg-teal-100 ring-2 ring-teal-300" : "border-teal-200 bg-teal-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-teal-600 tabular-nums">{gris}</p>
          <p className="text-xs font-semibold text-teal-700">Appels de service</p>
        </button>
        <button
          onClick={() => basculerFiltre("retire")}
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("retire") ? "border-slate-400 bg-slate-100 ring-2 ring-slate-300" : "border-slate-200 bg-slate-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-slate-500 tabular-nums">{retires}</p>
          <p className="text-xs font-semibold text-slate-500">Retirés — garantie / maison</p>
        </button>
        <button
          onClick={() => basculerFiltre("facture")}
          title="Bons complètement facturés — hors de la liste par défaut, un clic les montre"
          className={`rounded-xl border p-3 text-left transition-shadow ${
            filtresActifs.includes("facture") ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300" : "border-emerald-100 bg-emerald-50"
          }`}
        >
          <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{dejaFactures}</p>
          <p className="text-xs font-semibold text-emerald-700">✅ Déjà facturés</p>
        </button>
      </div>

      {/* 📋 À FACTURER — PAR CLIENT ET PAR PROJET.
          TOUJOURS affiché (même vide) : caché, on ne pouvait pas savoir
          s'il n'y avait rien à facturer ou si la section était brisée. */}
      {groupesAFacturer.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            📋 À facturer — par client et par projet
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Rien à facturer pour l&apos;instant. Dès qu&apos;un bon de travail est prêt, il apparaît ici, regroupé
            par client puis par chantier — avec le bouton qui réunit tout un mois en UNE facture.
          </p>
        </div>
      )}
      {groupesAFacturer.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              📋 À facturer — par client et par projet
            </p>
            <p className="text-[11px] font-bold tabular-nums text-slate-600">
              {groupesAFacturer.length} client{groupesAFacturer.length > 1 ? "s" : ""} · {nbBonsAFacturer} bon{nbBonsAFacturer > 1 ? "s" : ""} · {totalAFacturer.toFixed(2)} $
            </p>
          </div>
          <div className="space-y-1">
            {groupesAFacturer.map((g) => {
              const ouvert = groupesOuverts[g.client] !== false; // ouvert par défaut
              return (
                <div key={g.client} className="rounded-lg border border-slate-200">
                  <button
                    onClick={() => setGroupesOuverts((p) => ({ ...p, [g.client]: !ouvert }))}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0 truncate text-xs font-extrabold text-slate-800">
                      {ouvert ? "▾" : "▸"} {g.client}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-600">
                      {g.nbBons} bon{g.nbBons > 1 ? "s" : ""} · {g.total.toFixed(2)} $
                    </span>
                  </button>
                  {ouvert && (
                    <div className="border-t border-slate-100 px-2.5 py-1.5">
                      {g.sousGroupes.map((sg) => (
                        <div key={sg.projet?.id || "hors"} className="flex flex-wrap items-center justify-between gap-2 py-1">
                          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                            {sg.projet ? `🏗️ ${sg.projet.nom}` : "— hors projet —"}
                            <span className="ml-1.5 text-slate-400">
                              {sg.bons.length} bon{sg.bons.length > 1 ? "s" : ""} · {sg.total.toFixed(2)} $
                            </span>
                            {/* Les bons sans prix ne partent dans aucune
                                facture — mieux vaut le dire que de les
                                compter en silence. 🖱️ CLIQUABLE
                                (2026-09-03, « on ne peut pas créer la
                                facture directement en appuyant sur le
                                client ? ») : ouvre la révision du 1er bon
                                à réviser — heures 💰 pré-comptées au taux
                                vendant, tu ajustes, tu émets. */}
                            {sg.aReviser > 0 && (
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  const premier = sg.bons.find((b) => resteAFacturerDe(b) <= 0);
                                  if (premier) setBonAReviserId(premier.id);
                                }}
                                className="ml-1.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700 active:scale-95"
                              >
                                ✏️ {sg.aReviser} à réviser — cliquer pour fixer le prix
                              </button>
                            )}
                          </span>
                          {estAdminPrincipal && sg.facturables.length > 0 && (
                            <button
                              onClick={() =>
                                setGroupeAFacturer({
                                  bons: sg.facturables,
                                  clientNom: g.client,
                                  projetNom: sg.projet?.nom || null,
                                  total: sg.total,
                                  client: (clientsFacturation || []).find((c) => c.nom === g.client) || null,
                                })
                              }
                              title={
                                sg.bons.length > 1
                                  ? "UNE facture pour tous ces bons — une ligne par bon, le client voit le détail"
                                  : "Facturer ce bon"
                              }
                              className="shrink-0 rounded-lg bg-[#131B2E] px-2.5 py-1 text-[10px] font-bold text-white active:scale-95"
                            >
                              {sg.facturables.length > 1 ? `📅 Facturer les ${sg.facturables.length} d'un coup` : "Facturer"}
                            </button>
                          )}
                          {/* 📋 LE DÉTAIL DES BONS, ICI MÊME (2026-09-04,
                              demande du propriétaire : « pourquoi je vois
                              juste une des tâches s'il y en a 3 ? ») —
                              chaque bon du groupe est listé avec sa date
                              et son bouton : « Réviser » quand le prix
                              n'est pas fixé, sinon son montant. Plus
                              besoin de descendre chercher les cartes. */}
                          <div className="w-full space-y-0.5 pl-3">
                            {sg.bons.map((bx) => (
                              <div key={bx.id} className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                                <span className="min-w-0 flex-1 truncate text-slate-500">
                                  <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${bx.prixNonListe ? "bg-red-500" : "bg-emerald-500"}`} />
                                  {bx.projet || bx.description || "Travaux"} <span className="text-slate-400">· {bx.date}</span>
                                  {/* 📍 L'adresse du chantier (2026-09-04,
                                      demande du propriétaire) — on
                                      reconnaît la job par son chantier. */}
                                  {bx.adresseTravaux && (
                                    <span className="ml-1.5 text-[10px] text-slate-400">📍 {bx.adresseTravaux}</span>
                                  )}
                                </span>
                                {bx.prixNonListe ? (
                                  <button
                                    onClick={() => setBonAReviserId(bx.id)}
                                    className="shrink-0 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 active:scale-95"
                                  >
                                    ✏️ Réviser
                                  </button>
                                ) : (
                                  <span className="shrink-0 font-bold tabular-nums text-slate-600">{resteAFacturerDe(bx).toFixed(2)} $</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
            Une facture groupée réunit plusieurs bons en UN seul document (une ligne par bon, avec sa date).
            Les bons facturés quittent cette liste — impossible de les facturer deux fois.
          </p>
        </div>
      )}

      {/* ➕ FACTURER SANS TÂCHE — vente au comptoir, contrat, frais.
          🧭 UN SEUL CHEMIN (2026-09-03) : ce bouton QUICKBOOKS disparaît
          pour une entreprise SANS connexion — elle a le chemin maison,
          deux boutons de facture côte à côte invitent à créer la
          mauvaise. (qbConnecte null = état pas encore connu : on montre,
          comme avant.) */}
      {estAdminPrincipal && qbConnecte !== false && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="min-w-0 text-[11px] text-slate-500">
            Une vente au comptoir, un contrat, des frais ? Une facture peut partir sans chantier.
          </p>
          <Button onClick={() => setFactureLibreOuverte(true)} className="min-h-0 shrink-0 gap-1 px-2.5 py-1.5 text-[11px]">
            <Plus size={13} /> Nouvelle facture
          </Button>
        </div>
      )}

      {/* 🧾 FACTURATION MAISON — SANS QUICKBOOKS (2026-09-02) : pour les
          entreprises de la plateforme sans système comptable. Module
          autonome (FacturesMaison.jsx) : création multi-provinces, lien
          public, suivi payé/en retard, crédits, export comptable. */}
      <SectionFacturesMaison
        clients={clientsFacturation}
        catalogue={catalogueFacturation}
        configEnt={configEnt}
        ajouterJournal={ajouterJournal}
        estAdminPrincipal={estAdminPrincipal}
        qbConnecte={qbConnecte}
        onAjouterCourrielClient={onAjouterCourrielClient}
      />

      {/* 🧾 FACTURES SANS CHANTIER — le registre des factures libres :
          visibles, vérifiables, renvoyables (2026-08-29 : « j'ai créé
          2 factures et elles n'apparaissent pas »). */}
      {facturesLibres.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            🧾 Factures sans chantier ({facturesLibres.length})
          </p>
          <div className="mt-1.5 space-y-1">
            {facturesLibres.slice(0, 15).map((fl) => (
              <div key={fl.id} className={`rounded-lg px-2 py-1.5 text-[11px] text-slate-600 ${fl.statut === "annulee" ? "bg-slate-100 opacity-70" : fl.statut === "a_verifier" ? "border border-amber-300 bg-amber-50" : "bg-slate-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="min-w-0">
                    <span className={`font-bold text-slate-800 ${fl.statut === "annulee" ? "line-through" : ""}`}>{fl.docNumber || "—"}</span> · {fl.clientNom}
                    <span className="font-bold tabular-nums"> · {fl.montantHT.toFixed(2)} $</span>
                    {fl.reference && <span className="text-slate-400"> · {fl.reference}</span>}
                    <span className="text-slate-400"> · {fl.creeLe ? new Date(fl.creeLe).toLocaleDateString("fr-CA") : ""}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {fl.statut === "annulee" ? (
                      <span className="text-[10px] font-bold text-slate-500" title={fl.annulationNote || ""}>❌ Annulée{fl.annuleeLe ? ` le ${new Date(fl.annuleeLe).toLocaleDateString("fr-CA")}` : ""}</span>
                    ) : fl.statut === "en_creation" || fl.statut === "a_verifier" ? (
                      /* La réponse de QuickBooks n'est jamais revenue : la
                         facture y existe PEUT-ÊTRE — on le dit, on ne devine pas. */
                      <span className="text-[10px] font-bold text-amber-700">⏳ À vérifier dans QuickBooks — réponse jamais reçue</span>
                    ) : (
                      <>
                        {fl.envoiStatut === "envoyee" ? (
                          <span className="text-[10px] font-bold text-emerald-600">✉️ Envoyée ✓</span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-600">⚠️ Envoi non confirmé</span>
                        )}
                        {fl.qboInvoiceId && (
                          <button
                            onClick={() => setRenvoiLibre(fl)}
                            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 active:scale-95"
                          >
                            📧 Renvoyer
                          </button>
                        )}
                        {fl.qboInvoiceId && estAdminPrincipal && (
                          <button
                            onClick={() => setAnnulationLibre(fl)}
                            className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-red-600 active:scale-95"
                          >
                            ❌ Annuler
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ❌ Annulation d'une facture libre — note comptable OBLIGATOIRE :
          elle part dans QuickBooks (mémo interne) avant le VOID. */}
      {annulationLibre && (
        <ModalAnnulationFactureLibre
          facture={annulationLibre}
          onFermer={() => setAnnulationLibre(null)}
          onAnnuler={async (note) => {
            const fl = annulationLibre;
            setAnnulationLibre(null);
            await annulerFactureLibre(fl, note);
          }}
        />
      )}

      {/* Renvoi d'une facture libre — choix des destinataires. */}
      {renvoiLibre && (
        <ModalSelectionCourriel
          client={(clientsFacturation || []).find((c) => c.id === renvoiLibre.clientId || c.nom === renvoiLibre.clientNom)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.((clientsFacturation || []).find((c) => c.id === renvoiLibre.clientId || c.nom === renvoiLibre.clientNom)?.id, email)}
          contexte={`le renvoi de la facture ${renvoiLibre.docNumber}`}
          onFermer={() => setRenvoiLibre(null)}
          onConfirmer={(choix) => {
            const fl = renvoiLibre;
            setRenvoiLibre(null);
            renvoyerFactureLibre(fl, choix);
          }}
        />
      )}

      {/* GARANTIE D'ENVOI — le filet : compare nos factures au registre
          d'envoi de QuickBooks. Toute facture créée mais jamais partie
          remonte ici avec son bouton Renvoyer. 🧭 Cachée pour une
          entreprise sans QuickBooks — il n'y a rien à y vérifier. */}
      {qbConnecte !== false && (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="min-w-0 text-[11px] text-slate-500">
          {envoisAConfirmer > 0 ? (
            <span className="font-bold text-red-600">⚠️ {envoisAConfirmer} facture{envoisAConfirmer > 1 ? "s" : ""} dont l'envoi par QuickBooks n'est pas confirmé</span>
          ) : (
            <span>✉️ Envois par QuickBooks : aucun problème connu</span>
          )}
        </p>
        <button
          onClick={verifierTousEnvois}
          disabled={verifEnvoisEnCours}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 active:scale-95 disabled:opacity-50"
        >
          {verifEnvoisEnCours ? "Vérification…" : "🔎 Vérifier les envois"}
        </button>
      </div>
      )}

      {/* 🔎 Recherche rapide — job, client, nº de devis, nº de facture
          QuickBooks. Sans filtre actif, elle fouille TOUT (les « Déjà
          facturés » et les retirés compris). */}
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2">
        <span className="shrink-0 text-slate-400">🔎</span>
        <input
          value={rechercheFact}
          onChange={(e) => setRechercheFact(e.target.value)}
          placeholder="Rechercher — job, client, nº de devis, nº de facture QuickBooks…"
          className="w-full text-sm outline-none"
        />
        {rechercheFact && (
          <button onClick={() => setRechercheFact("")} className="shrink-0 text-xs font-bold text-slate-400 underline">
            Effacer
          </button>
        )}
      </div>

      {(filtresActifs.length > 0 || rechercheFact.trim()) && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
          <span>
            {bonsAffiches.length} résultat{bonsAffiches.length > 1 ? "s" : ""}
            {rechercheFact.trim() ? ` pour « ${rechercheFact.trim()} »` : " filtrés"}
          </span>
          <button onClick={() => { setFiltresActifs([]); setRechercheFact(""); }} className="font-semibold text-slate-700 underline underline-offset-2">
            Tout effacer
          </button>
        </div>
      )}

      <div ref={refListeFact} className="space-y-2">
        {bonsPageines.map((b) => {
          const contrat = b.type === "entretien_contrat";
          const devisType = b.type === "devis";
          const enAttenteValidation = !b.prixNonListe && (devisType || contrat) && b.statutQb === "en_attente";
          const couleurPastille = b.prixNonListe
            ? "bg-red-500"
            : contrat
            ? "bg-purple-500"
            : devisType
            ? "bg-blue-500"
            : b.type === "appel_service"
            ? "bg-teal-500"
            : "bg-amber-400";
          const montantCumule = (b.facturesEmises || []).reduce((s, f) => s + f.montant, 0);
          const devisAssocie = devisType || contrat ? devisListe.find((d) => d.numero === b.devisNumero) : null;
          const montantDevisTotal = devisAssocie ? devisAssocie.totalVendant : b.montant;
          // 📱 flex-wrap (séance 3 mobile) : sur téléphone, la colonne
          // des montants/boutons passe SOUS le contenu au lieu de
          // l'écraser — même carte, deux étages.
          return (
            <div key={b.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${couleurPastille}`} />
              <div className="min-w-[230px] flex-1">
                <p className="text-sm font-bold text-slate-900">{b.projet}</p>
                <p className="text-xs text-slate-500">{b.client} · {b.date}</p>
                {/* ÉQUIPE — visible seulement quand ils sont plusieurs.
                    Les heures s'additionnent (elles vont au coût du
                    projet), mais le montant facturé reste unique : le
                    client paie un travail, pas des techniciens. */}
                {/* BON NON SIGNÉ — le filet. La signature est la preuve
                    que le client accepte les travaux ; la perdre (parce
                    qu'un collègue n'est pas venu, ou par oubli) doit
                    sauter aux yeux AVANT la facturation, pas après une
                    contestation. */}
                {/* CLIENT ABSENT (clause 10) : ce n'est PAS un oubli de
                    signature — les travaux sont réputés reçus. Info,
                    pas alerte : on facture normalement. */}
                {/* RETRAIT DE FACTURATION — les trois états, toujours
                    visibles LÀ où on facture : demande en attente
                    (l'Admin principal tranche ici même), report approuvé,
                    retrait approuvé (le bon vit sous l'encadré « Retirés »). */}
                {b.retraitStatut === "demande" && (
                  <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    🕓 <span className="font-extrabold">Retrait demandé :</span> {RAISONS_RETRAIT[b.retraitRaison] || b.retraitRaison}
                    {b.retraitNote ? <span className="block text-[10px]">Note : {b.retraitNote}</span> : null}
                    {b.retraitDemandePar ? <span className="block text-[10px] text-amber-700">Par {b.retraitDemandePar}</span> : null}
                    {estAdminPrincipal ? (
                      <span className="mt-1 flex gap-2">
                        <button onClick={() => validerRetrait(b, true)} className="rounded-lg bg-amber-600 px-2 py-1 text-[10px] font-bold text-white active:scale-95">
                          Approuver le retrait
                        </button>
                        <button onClick={() => validerRetrait(b, false)} className="rounded-lg border border-amber-400 px-2 py-1 text-[10px] font-bold text-amber-700 active:scale-95">
                          Refuser
                        </button>
                      </span>
                    ) : (
                      <span className="block text-[10px] font-bold">En attente d'un Admin principal.</span>
                    )}
                  </div>
                )}
                {b.retraitStatut === "reporte" && (
                  <p className="mt-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                    🔄 Reporté — sera facturé à la prochaine journée de facturation
                    {b.retraitValidePar ? ` (approuvé par ${b.retraitValidePar})` : ""}.
                  </p>
                )}
                {b.statutQb === "retire" && (
                  <p className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                    🗂️ Retiré de la facturation — {RAISONS_RETRAIT[b.retraitRaison] || b.retraitRaison}
                    {b.retraitValidePar ? ` · approuvé par ${b.retraitValidePar}` : ""}. Ses coûts restent comptés dans l'analyse.
                  </p>
                )}
                {b.clientAbsent ? (
                  <p className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                    ℹ️ Client absent à la fin des travaux — travaux réputés reçus (clause 10 des conditions).
                    Bon non signé, mention au dossier.
                  </p>
                ) : b.signeParCollegue && !b.signeParNom ? (
                  <p className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    ✍️ Signature recueillie par un collègue sur place (équipe de 2+) — un seul bon envoyé au client.
                  </p>
                ) : (
                  !b.signeParNom && (
                    <p className="mt-1 flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Bon de travail NON SIGNÉ par le client — à valider avant de facturer.
                    </p>
                  )
                )}
                {/* 🚧 TRAVAUX NON TERMINÉS — l'avertissement le plus fort
                    de la carte, placé AVANT tout le reste : facturer un
                    travail inachevé, c'est le rappel du client le
                    lendemain. Ce que le technicien a écrit sur le
                    terrain est repris mot pour mot — c'est là-dessus
                    que le retour se planifie. */}
                {b.travauxNonTermines && (
                  <p className="mt-1 whitespace-pre-line rounded-lg border-2 border-orange-400 bg-orange-50 px-2 py-1.5 text-[11px] leading-snug text-orange-900">
                    🚧 <span className="font-extrabold">TRAVAUX NON TERMINÉS — il faut retourner sur place.</span>
                    {b.resteAFaire && <span className="mt-1 block font-semibold">Reste à faire : {b.resteAFaire}</span>}
                    <span className="mt-1 block text-[10px]">
                      Les heures faites se facturent normalement — mais planifie le retour avant de fermer le dossier.
                    </span>
                  </p>
                )}
                {/* PIÈCE À COMMANDER — visible LÀ OÙ TU REGARDES DÉJÀ.
                    La réparation n'est pas finie : une 2e visite sera
                    facturée séparément, elle attend la pièce. */}
                {b.pieceACommander && (
                  <p className="mt-1 whitespace-pre-line rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
                    🔧 <span className="font-extrabold">Pièce à commander :</span> {b.pieceRequise}
                    {(b.modeleUnite || b.serieUnite) && (
                      <span className="block text-[10px] text-amber-700">
                        {b.modeleUnite}
                        {b.modeleUnite && b.serieUnite ? " · " : ""}
                        {b.serieUnite ? `Nº ${b.serieUnite}` : ""}
                      </span>
                    )}
                    <span className="block text-[10px]">Suivi dans l&apos;onglet « Pièces en commande ».</span>
                  </p>
                )}
                {/* Unité relevée sans pièce à commander — alimente quand
                    même le registre d'équipements du client. */}
                {!b.pieceACommander && (b.modeleUnite || b.serieUnite) && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Unité : {b.modeleUnite}
                    {b.modeleUnite && b.serieUnite ? " · " : ""}
                    {b.serieUnite ? `Nº ${b.serieUnite}` : ""}
                  </p>
                )}
                {(b.equipe || []).length > 1 && (
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                    <User size={11} className="shrink-0 text-slate-400" />
                    {b.equipe.map((t, i) => (
                      <span key={i} className="rounded-full bg-slate-100 px-1.5 py-0.5">
                        {t.nom} <span className="tabular-nums text-slate-400">{t.heures.toFixed(2)} h</span>
                        {facturablesAssignations[`${b.tacheId || ""}|${(t.courriel || "").toLowerCase()}`] === false && (
                          <span className="ml-0.5 font-bold text-slate-500" title="Déclaré NON facturable à l'assignation — heures payées mais jamais suggérées au client">🤝</span>
                        )}
                      </span>
                    ))}
                    <span className="font-bold tabular-nums text-slate-700">= {b.heures.toFixed(2)} h au total</span>
                    {/* 💰 COMBIEN D'HOMMES À FACTURER (2026-09-03, demande
                        du propriétaire) — le compte des 💰 en un coup d'œil. */}
                    {(() => {
                      const nbFact = (b.equipe || []).filter(
                        (t) => facturablesAssignations[`${b.tacheId || ""}|${(t.courriel || "").toLowerCase()}`] !== false
                      ).length;
                      return (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">
                          💰 {nbFact} homme{nbFact > 1 ? "s" : ""} facturable{nbFact > 1 ? "s" : ""}
                        </span>
                      );
                    })()}
                  </p>
                )}
                {/* ⏳ ÉQUIPE INCOMPLÈTE (2026-08-27) : l'équipe assignée est
                    comparée à ceux dont les heures sont RENTRÉES — sans ce
                    badge, le bureau pouvait facturer un travail à moitié
                    compté sans aucun avertissement. S'éteint tout seul dès
                    que les heures du retardataire arrivent. */}
                {(() => {
                  const assignes = equipeAssignee(b.tacheId);
                  if (assignes.length < 2) return null;
                  const rentres = new Set((b.lignesReelles || []).map((t) => (t.employeEmail || "").toLowerCase()));
                  const manquants = assignes.filter((c) => !rentres.has(c));
                  if (manquants.length === 0) return null;
                  const noms = manquants.map((c) => nomsEmployes[c] || c).join(", ");
                  return (
                    <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-bold leading-snug text-amber-800">
                      ⏳ Équipe incomplète — {noms} n'{manquants.length > 1 ? "ont" : "a"} pas fermé sa tâche (0 h).
                      {" "}{manquants.length > 1 ? "Leurs" : "Ses"} heures manqueront à la facture si tu factures maintenant.
                    </p>
                  );
                })()}
                {b.adresseTravaux && (
                  <div className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-400">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span>Travaux : {b.adresseTravaux}</span>
                  </div>
                )}
                {/* 📄 LE DEVIS ASSOCIÉ (2026-09-03, « on ne voit pas le
                    devis associé ») — visible directement sur la carte. */}
                {b.devisNumero && (
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">📄 Devis {b.devisNumero}</p>
                )}
                {/* 📦 MATÉRIEL AUX COÛTS (2026-08-25) — coût INTERNE de la
                    job, jamais sur un document client. Deux sources :
                    les items de STOCK au coût standard (forfait murale,
                    prise…) posés ici par le bureau, et les ACHATS
                    rattachés à la tâche (BC libre → tâche). */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMaterielStockPour({ bonId: (b.lignesSource?.[0]?.id || b.id), items: (b.lignesSource?.[0]?.materielStock || b.materielStock || []) })}
                    className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:border-slate-500"
                  >
                    📦 Matériel du stock{(() => {
                      const items = b.lignesSource?.[0]?.materielStock || b.materielStock || [];
                      const total = items.reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0);
                      return items.length > 0 ? ` : ${total.toFixed(2)} $ (${items.length})` : " — ajouter";
                    })()}
                  </button>
                  {(() => {
                    const achats = (achatsLibres || []).filter((a) => a.tacheId && a.tacheId === b.tacheId);
                    if (achats.length === 0) return null;
                    const total = achats.reduce((s, a) => s + (a.montantAttribue != null ? a.montantAttribue : a.montantHT), 0);
                    return (
                      <span
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                        title={achats.map((a) => `${a.numeroBc} — ${a.description} (${(a.montantAttribue != null ? a.montantAttribue : a.montantHT).toFixed(2)} $)`).join("\n")}
                      >
                        🧾 Achats rattachés : {total.toFixed(2)} $ ({achats.length} BC)
                      </span>
                    );
                  })()}
                </div>
                {/* DÉPÔT DÉJÀ PERÇU — écrit sur la carte, pas seulement
                    dans la fenêtre de révision : la personne qui balaie
                    la pile doit le voir AVANT d'ouvrir quoi que ce soit. */}
                {depotPayePour(b.tacheId) && (
                  <p className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    💰 Appel payé d'avance — dépôt de {depotPayePour(b.tacheId).montantHT.toFixed(2)} $ + taxes déjà perçu
                    {depotPayePour(b.tacheId).payeLe ? ` le ${new Date(depotPayePour(b.tacheId).payeLe).toLocaleDateString("fr-CA")}` : ""} · sera déduit de la facture
                  </p>
                )}
                <p className="mt-1 text-xs font-semibold">
                  {b.prixNonListe ? (
                    <span className="text-red-600">À facturer – Prix non listé</span>
                  ) : contrat ? (
                    <span className="text-purple-600">
                      À valider – Entretien contrat #{b.devisNumero} ({b.frequenceFacturationAnnuelle || 4}×/an)
                    </span>
                  ) : devisType ? (
                    <span className="text-blue-600">À valider – Selon devis #{b.devisNumero}</span>
                  ) : (
                    <span className="text-amber-600">À facturer – Selon bon de commande</span>
                  )}
                </p>
                {b.lignesNonListees?.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {b.lignesNonListees.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>{it.description}</span>
                        <span className="shrink-0 tabular-nums text-slate-600">{parseFloat(it.prix).toFixed(2)} $</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  b.description && <p className="mt-0.5 whitespace-pre-line text-[11px] text-slate-500">{b.description}</p>
                )}
                {(b.facturesEmises || []).length > 0 && (
                  <div className="mt-1.5 w-full max-w-[240px]">
                    {(devisType || contrat) && montantCumule > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-slate-500">
                          Cumul facturé : {montantCumule.toFixed(2)} $ / {montantDevisTotal.toFixed(2)} $
                        </p>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${contrat ? "bg-purple-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(100, (montantCumule / montantDevisTotal) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                    <FacturesEmisesListe bon={b} onPdf={ouvrirPdfFacture} onRenvoyer={renvoyerFactureQb} onRenvoyerVers={(bn, fx) => setRenvoiVers({ bon: bn, f: fx })} envoiAuto={configEnt?.envoiAutoFactureQb === true} />
                  </div>
                )}
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-bold tabular-nums text-slate-900">{b.montant.toFixed(2)} $</p>
                <div className="mt-0.5 space-y-0 text-[10px] text-slate-400">
                  <p className="tabular-nums">TPS ({tauxAffiche(configEnt.tauxTps)}%) : {calculerTaxes(b.montant, configEnt).tps.toFixed(2)} $</p>
                  <p className="tabular-nums">TVQ ({tauxAffiche(configEnt.tauxTvq)}%) : {calculerTaxes(b.montant, configEnt).tvq.toFixed(2)} $</p>
                  <p className="font-semibold tabular-nums text-slate-600">Total TTC : {calculerTaxes(b.montant, configEnt).total.toFixed(2)} $</p>
                </div>
                <button
                  onClick={() => setFactureAperçuId(b.id)}
                  className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 underline underline-offset-2"
                >
                  <FileText size={11} /> Voir version client
                </button>
                {/* 📸 LE BON AU CLIENT — le descriptif public (photos,
                    signature, SANS prix). Indépendant de la facturation :
                    le client peut voir ses travaux avant même la facture. */}
                {b.supabase && (
                  <button
                    onClick={() => setBonEnvoiClientId(b.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 underline underline-offset-2"
                  >
                    <Send size={11} /> Bon au client
                  </button>
                )}
                {b.envoyeClientLe && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-emerald-600">
                    📸 Envoyé le {new Date(b.envoyeClientLe).toLocaleDateString("fr-CA")}
                    {/* 👁️ Le même badge que partout (2026-09-04) — a-t-il
                        OUVERT son bon ? Un bon jamais consulté avant la
                        facture, ça se relance autrement. */}
                    <BadgeConsultation consulteLe={b.consulteLe} consultations={b.consultations} derniereLe={b.derniereConsultationLe} className="text-[9px]" />
                  </p>
                )}
                {b.statutQb === "en_attente" && !b.retraitStatut && (
                  <button
                    onClick={() => setBonRetraitId(b.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600"
                  >
                    Retirer de la facturation
                  </button>
                )}
                {b.statutQb === "retire" && estAdminPrincipal && (
                  <button
                    onClick={() => remettreBonAFacturer(b)}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 underline underline-offset-2"
                  >
                    Remettre à facturer
                  </button>
                )}
                {b.statutQb === "retire" ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                    🗂️ Retiré
                  </span>
                ) : b.statutQb === "envoye" ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 size={12} /> Facturé
                  </span>
                ) : b.prixNonListe ? (
                  <Button onClick={() => setBonAReviserId(b.id)} className="mt-1 min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                    <AlertCircle size={11} /> Réviser
                  </Button>
                ) : enAttenteValidation ? (
                  <Button onClick={() => setBonFacturationId(b.id)} className="mt-1 min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                    <Check size={11} /> {montantCumule > 0 ? "Facturer le solde" : "Facturer"}
                  </Button>
                ) : qbConnecte === false ? (
                  /* 🧾 SANS QUICKBOOKS (2026-09-06) : le même geste émet
                     la facture MAISON — numérotée, taxée, page publique. */
                  <Button onClick={() => setBonEnvoiCourrielId(b.id)} className="min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                    🧾 Facturer (maison)
                  </Button>
                ) : (
                  <>
                    <span className="mb-1 flex items-center justify-end gap-1 text-[10px] font-bold text-amber-600">
                      <Cloud size={12} /> En attente de synchro QB
                    </span>
                    <Button onClick={() => setBonEnvoiCourrielId(b.id)} className="min-h-[40px] gap-1 px-3 py-1.5 text-[11px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]">
                      <Send size={11} /> Envoyer à QB
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {bonsAffiches.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Aucun résultat pour {filtresActifs.length > 1 ? "ces catégories" : "cette catégorie"}.
          </p>
        )}
        <BarrePagination total={bonsAffiches.length} page={pageFactEff} onPage={setPageFact} refHaut={refListeFact} libelle="bons" />
      </div>
      <p className="text-[11px] text-slate-400">
        Un bon de travail « Prix non listé » doit être ouvert et révisé manuellement par un admin (prix + description), avec confirmation explicite, avant de pouvoir être envoyé au client.
        Un travail « Selon devis » exige toujours une validation manuelle de l'admin avant l'envoi, avec possibilité de facturation progressive plafonnée au montant initial du devis.
      </p>

      {/* 📦 MATÉRIEL DU STOCK — items de catalogue au COÛT STANDARD
          posés sur le bon. C'est ici que la consommation d'entrepôt
          (forfait murale : 25' de conduit + support ; la prise de
          l'électricien) entre au coût de la job SANS chercher un vrai
          coût impossible à tracer. Coût interne — jamais au client. */}
      {materielStockPour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setMaterielStockPour(null); }}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">📦 Matériel du stock — coût interne</h3>
                <p className="text-xs text-slate-500">Coût standard du catalogue · n&apos;apparaît jamais sur un document client.</p>
              </div>
              <button onClick={() => setMaterielStockPour(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-1.5">
              {(materielStockPour.items || []).map((it) => (
                <div key={it.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{it.nom}</span>
                  <input
                    type="number"
                    min={0.25}
                    step="0.25"
                    value={it.quantite}
                    onChange={(e) =>
                      setMaterielStockPour((prev) => ({
                        ...prev,
                        items: prev.items.map((x) => (x.id === it.id ? { ...x, quantite: parseFloat(e.target.value) || 1 } : x)),
                      }))
                    }
                    className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
                  />
                  <span className="w-20 text-right text-xs tabular-nums text-slate-500">× {(Number(it.coutant) || 0).toFixed(2)} $</span>
                  <button
                    onClick={() => setMaterielStockPour((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== it.id) }))}
                    className="shrink-0 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {(materielStockPour.items || []).length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                  Aucun item — ajoute du catalogue (le coûtant standard suit tout seul).
                </p>
              )}
            </div>
            <div className="mt-2">
              <SelecteurItem
                catalogue={(catalogueFacturation || []).filter((i) => i.prix_coutant != null)}
                libelle="🔎 Ajouter du catalogue (coûtant standard)"
                onChoisir={(item) =>
                  setMaterielStockPour((prev) => ({
                    ...prev,
                    items: [...(prev.items || []), { id: `ms-${Date.now()}`, nom: item.nom, quantite: 1, coutant: Number(item.prix_coutant) || 0 }],
                  }))
                }
              />
            </div>
            <div className="mt-3 flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
              <span>Coût matériel (interne)</span>
              <span className="tabular-nums">
                {(materielStockPour.items || []).reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0).toFixed(2)} $
              </span>
            </div>
            <Button
              onClick={async () => {
                const { bonId, items } = materielStockPour;
                try {
                  await majMaterielStock(bonId, items);
                  setBons((prev) => prev.map((x) => (x.id === bonId ? { ...x, materielStock: items } : x)));
                  const total = items.reduce((s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1), 0);
                  ajouterJournal(`📦 Matériel du stock enregistré sur le bon — ${items.length} item${items.length > 1 ? "s" : ""}, ${total.toFixed(2)} $ de coût standard (interne).`);
                  setMaterielStockPour(null);
                } catch (e) {
                  ajouterJournal(`⚠️ Matériel du stock NON enregistré (${e?.message || "erreur"}) — le snippet 77 est-il passé ?`);
                }
              }}
              className="mt-3 w-full"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {bonFacturation && (
        <ModalFacturationDevis
          tousLesBons={bons}
          bon={bonFacturation}
          devis={devisFacturation}
          onFermer={() => setBonFacturationId(null)}
          onEmettre={(info) => {
            setFactureEnAttenteCourriel({ bonId: bonFacturation.id, ...info });
            setBonFacturationId(null);
          }}
        />
      )}

      {bonRetrait && (
        <ModalRetraitFacturation
          bon={bonRetrait}
          onFermer={() => setBonRetraitId(null)}
          onDemander={(raison, note) => {
            setBonRetraitId(null);
            demanderRetrait(bonRetrait, raison, note);
          }}
        />
      )}

      {bonEnvoiClient && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(bonEnvoiClient)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(bonEnvoiClient)?.id, email)}
          contexte={`Bon de travail — descriptif avec photos, SANS prix (« ${bonEnvoiClient.projet} »)`}
          onFermer={() => setBonEnvoiClientId(null)}
          onConfirmer={(choix) => {
            setBonEnvoiClientId(null);
            envoyerBonAuClient(bonEnvoiClient, choix);
          }}
        />
      )}

      {bonEnvoiCourriel && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(bonEnvoiCourriel)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(bonEnvoiCourriel)?.id, email)}
          contexte={`Facture — "${bonEnvoiCourriel.projet}" (${bonEnvoiCourriel.montant.toFixed(2)} $)`}
          onFermer={() => setBonEnvoiCourrielId(null)}
          onConfirmer={(choix) => {
            setBonEnvoiCourrielId(null);
            // 🧾 Sans QuickBooks : la facture MAISON part directement —
            // pas de fenêtre paiement en ligne (QuickBooks Payments
            // n'existe pas sans QuickBooks).
            if (qbConnecte === false) {
              facturerBonMaison(bonEnvoiCourriel.id, choix);
              return;
            }
            setPaiementAConfirmer({
              mode: "simple",
              bonId: bonEnvoiCourriel.id,
              montant: Number(bonEnvoiCourriel.montant) || 0,
              clientNom: bonEnvoiCourriel.client,
              courriels: choix,
            });
          }}
        />
      )}

      {bonFactureEnAttente && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(bonFactureEnAttente)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(bonFactureEnAttente)?.id, email)}
          contexte={`Facture progressive — "${bonFactureEnAttente.projet}" (${factureEnAttenteCourriel.montant.toFixed(2)} $)`}
          onFermer={() => setFactureEnAttenteCourriel(null)}
          onConfirmer={(courrielChoisi) => {
            const { bonId, ...info } = factureEnAttenteCourriel;
            setFactureEnAttenteCourriel(null);
            setPaiementAConfirmer({
              mode: "progressive",
              bonId,
              info,
              montant: Number(info.montant) || 0,
              clientNom: bonFactureEnAttente?.client || "",
              courriels: courrielChoisi,
            });
          }}
        />
      )}

      {paiementAConfirmer && (
        <ModalChoixPaiementFacture
          montant={paiementAConfirmer.montant}
          clientNom={paiementAConfirmer.clientNom}
          onFermer={() => setPaiementAConfirmer(null)}
          onEmettre={async (paiements) => {
            const pa = paiementAConfirmer;
            if (pa.mode === "groupe") await facturerGroupe(pa.groupe, pa.courriels, paiements);
            else if (pa.mode === "libre") await emettreFactureLibre(pa.donnees, pa.courriels, paiements);
            else if (pa.mode === "simple") await envoyerQb(pa.bonId, pa.courriels, paiements);
            else await emettreFacture(pa.bonId, pa.info, pa.courriels, paiements);
            setPaiementAConfirmer(null);
          }}
        />
      )}

      {/* 📧 RENVOI D'UNE FACTURE — choix des destinataires. */}
      {renvoiVers && (
        <ModalSelectionCourriel
          client={trouverClientDuBon(renvoiVers.bon)}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(trouverClientDuBon(renvoiVers.bon)?.id, email)}
          contexte={`le renvoi de la facture ${renvoiVers.f.numeroFactureQb}`}
          onFermer={() => setRenvoiVers(null)}
          onConfirmer={executerRenvoiVers}
        />
      )}

      {/* 📅 FACTURE GROUPÉE — mêmes fenêtres que les autres factures. */}
      {groupeAFacturer && (
        <ModalSelectionCourriel
          client={groupeAFacturer.client}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(groupeAFacturer.client?.id, email)}
          contexte={
            groupeAFacturer.bons.length > 1
              ? `cette facture groupée (${groupeAFacturer.bons.length} bons, ${groupeAFacturer.total.toFixed(2)} $)`
              : "cette facture"
          }
          onFermer={() => setGroupeAFacturer(null)}
          onConfirmer={(choix) => {
            const g = groupeAFacturer;
            setGroupeAFacturer(null);
            setPaiementAConfirmer({
              mode: "groupe",
              groupe: g,
              montant: g.total,
              clientNom: g.clientNom,
              courriels: choix,
            });
          }}
        />
      )}

      {/* ➕ FACTURE LIBRE — saisie, puis les DEUX mêmes fenêtres que
          toutes les autres factures : destinataires, puis paiements. */}
      {factureLibreOuverte && (
        <ModalFactureLibre
          clients={clientsFacturation}
          projets={projets}
          catalogue={catalogueFacturation}
          configEnt={configEnt}
          onFermer={() => setFactureLibreOuverte(false)}
          onContinuer={(donnees) => {
            setFactureLibreOuverte(false);
            setCourrielFactureLibre(donnees);
          }}
        />
      )}
      {courrielFactureLibre && (
        <ModalSelectionCourriel
          client={courrielFactureLibre.client}
          onAjouterFiche={(email) => onAjouterCourrielClient?.(courrielFactureLibre.client?.id, email)}
          contexte="cette facture"
          onFermer={() => setCourrielFactureLibre(null)}
          onConfirmer={(choix) => {
            const d = courrielFactureLibre;
            setCourrielFactureLibre(null);
            setPaiementAConfirmer({
              mode: "libre",
              donnees: d,
              montant: d.sousTotal,
              clientNom: d.client?.nom || "",
              courriels: choix,
            });
          }}
        />
      )}

      {bonAReviser && (
        <ModalReviserPrixNonListe
          bon={bonAReviser}
          onCouvertParDepot={() => {
            const b = bonAReviser;
            const depot = depotPayePour(b.tacheId);
            if (!depot) return;
            setBonAReviserId(null);
            // La facture de dépôt DÉJÀ PAYÉE dans QuickBooks devient la
            // preuve de facturation du bon — aucune nouvelle facture,
            // aucun crédit, le bon passe « Déjà facturés ».
            const entree = {
              id: `fact-${Date.now()}-${b.id}`,
              montant: 0,
              type: "complete",
              detail: `Couverte par le dépôt payé d'avance de ${(Number(depot.montantHT) || 0).toFixed(2)} $ HT${depot.qboDocNumber ? ` (facture nº ${depot.qboDocNumber})` : ""}`,
              date: dateISO(new Date()),
              numeroFactureQb: depot.qboDocNumber || null,
              qboInvoiceId: depot.qboInvoiceId || null,
              // La preuve d'envoi est celle du dépôt : facture émise et
              // payée — rien d'autre ne devait partir.
              envoiQb: { envoyee: true, envoyeeLe: depot.payeLe || null },
            };
            setBons((prev) =>
              prev.map((x) => {
                if (x.id !== b.id) return x;
                const nouvelles = [...(x.facturesEmises || []), entree];
                if (String(x.id).startsWith("sbb-")) {
                  majFacturesEmises(String(x.id).slice(4), nouvelles, "envoye").catch(() =>
                    ajouterJournal(`⚠️ « ${b.projet} » marqué couvert par le dépôt à l'écran, mais NON enregistré — vérifie la connexion.`)
                  );
                }
                return { ...x, statutQb: "envoye", facturesEmises: nouvelles };
              })
            );
            ajouterJournal(
              `✅ « ${b.projet} » (${b.client}) : RIEN à facturer — couvert au complet par le dépôt payé d'avance de ${(Number(depot.montantHT) || 0).toFixed(2)} $ HT${depot.qboDocNumber ? ` (facture nº ${depot.qboDocNumber})` : ""}. Aucune facture créée, aucun crédit.`
            );
          }}
          onRetirerFacturation={() => {
            const id = bonAReviser.id;
            setBonAReviserId(null);
            setBonRetraitId(id);
          }}
          depotPaye={depotPayePour(bonAReviser.tacheId)}
          piecePrepayee={piecePrepayeePour(bonAReviser.tacheId)}
          facturables={facturablesAssignations}
          adresseRepli={adresseFacturationClient(trouverClientDuBon(bonAReviser)) || null}
          onBasculerFacturable={
            onBasculerFacturable
              ? (tacheId, courriel, val) => {
                  onBasculerFacturable(tacheId, courriel, val);
                  const be = bonsGroupes.find((b) => (b.tacheId || b.id) === (bonAReviser.tacheId || bonAReviser.id));
                  const nom = (be?.equipe || []).find((e) => (e.courriel || "").toLowerCase() === (courriel || "").toLowerCase())?.nom || courriel;
                  ajouterJournal(
                    val
                      ? `💰 ${nom} passe FACTURABLE sur « ${bonAReviser.projet || bonAReviser.client} » (depuis la révision).`
                      : `🤝 ${nom} passe NON facturable (aide interne) sur « ${bonAReviser.projet || bonAReviser.client} » — ses heures ne seront pas suggérées au client.`
                  );
                }
              : null
          }
          lignesSuggerees={(() => {
            const be = bonsGroupes.find((b) => (b.tacheId || b.id) === (bonAReviser.tacheId || bonAReviser.id)) || bonAReviser;
            // Le prix de base de l'appel (si aucun dépôt) AVANT le temps
            // supplémentaire — l'ordre naturel d'une facture.
            return [...lignesBaseAppel(be), ...lignesTempsSupp(be)];
          })()}
          bonEnrichi={bonsGroupes.find((b) => (b.tacheId || b.id) === (bonAReviser.tacheId || bonAReviser.id)) || null}
          nbFacturables={(() => {
            const be = bonsGroupes.find((b) => (b.tacheId || b.id) === (bonAReviser.tacheId || bonAReviser.id));
            if (!be?.equipe) return null;
            return be.equipe.filter((t) => facturablesAssignations[`${be.tacheId || ""}|${(t.courriel || "").toLowerCase()}`] !== false).length;
          })()}
          onFermer={() => setBonAReviserId(null)}
          onConfirmer={(items, total) => reviserPrixNonListe(bonAReviser.id, items, total)}
        />
      )}
      {factureAperçuId && (
        <ApercuFactureClient
          bon={bons.find((b) => b.id === factureAperçuId)}
          onFermer={() => setFactureAperçuId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// JOURNAL D'AUTOMATISATION (visible en bas de l'app)
// ============================================================
