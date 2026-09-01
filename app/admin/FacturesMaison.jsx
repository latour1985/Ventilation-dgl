"use client";

// app/admin/FacturesMaison.jsx
//
// 🧾 FACTURATION MAISON — SANS QUICKBOOKS (2026-09-02, design approuvé
// le 2026-08-17). Le module au complet : création (client + lignes +
// RÉGIME DE TAXES par province canadienne), envoi par lien public,
// suivi payé/en retard, NOTES DE CRÉDIT rattachées (jamais de
// suppression), export comptable CSV (période ou « depuis le dernier
// export »). Monté par OngletFacturation ; volontairement autonome pour
// ne pas grossir encore ce fichier-là.

import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { envoyerCourriel, gabaritFactureMaison } from "@/lib/courriels";
import { REGIMES_TAXES, calculerTaxesRegime, regimeTaxes } from "@/lib/taxesCanada";
import {
  creerFactureMaison,
  listerFacturesMaison,
  majFactureMaison,
  lienFactureMaison,
  csvFacturesMaison,
  estEnRetard,
} from "@/lib/supabase/facturesMaison";
import { Button, ModalSelectionCourriel, SelecteurItem, adresseFacturationClient, correspond, listeDestinataires, nomAffichageClient } from "./partage";

const argent = (n) => `${(Number(n) || 0).toFixed(2)} $`;
const aujourdhuiISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Échéance calculée du terme (« Net 30 » → +30 jours ; comptant → aujourd'hui).
function echeanceDuTerme(terme) {
  const m = String(terme || "").match(/(\d+)/);
  const jours = m ? Math.min(120, Math.max(0, parseInt(m[1], 10))) : 0;
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// FENÊTRE DE CRÉATION — facture OU note de crédit (mêmes champs ;
// un crédit arrive prérempli des lignes INVERSÉES de sa facture).
// ============================================================
export function ModalFactureMaison({ clients, catalogue, configEnt, origine = null, onFermer, onContinuer }) {
  const estCredit = !!origine;
  const [clientId, setClientId] = useState(origine?.clientId || "");
  const [recherche, setRecherche] = useState("");
  const [regime, setRegime] = useState(origine?.regimeTaxes || "qc");
  const [terme, setTerme] = useState(configEnt?.termePaiementDefaut || "Net 30");
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState(() =>
    estCredit
      ? (origine.lignes || []).map((l, i) => ({
          uid: `cr-${i}`,
          description: l.description || "",
          quantite: l.quantite ?? 1,
          prix: -Math.abs(Number(l.prix_unitaire ?? l.prixUnitaire) || 0),
        }))
      : []
  );

  const client = (clients || []).find((c) => c.id === clientId) || (estCredit ? { id: null, nom: origine.clientNom } : null);
  const resultatsClients = useMemo(() => {
    const t = recherche.trim().toLowerCase();
    const base = clients || [];
    if (!t) return base.slice(0, 8);
    return base.filter((c) => correspond(c, t)).slice(0, 8);
  }, [clients, recherche]);

  // 📝 Nom ET description du produit (2026-09-03, retour du propriétaire :
  // « la description n'apparaît pas, seulement le titre ») — la ligne de
  // facture raconte le produit au complet, ajustable avant l'envoi.
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
  const taxes = calculerTaxesRegime(sousTotal, regime);
  const total = Math.round((sousTotal + taxes.reduce((s, t) => s + t.montant, 0)) * 100) / 100;
  // Facture : total positif obligatoire. Crédit : total NÉGATIF obligatoire.
  const peutContinuer = !!client && lignesValides.length > 0 && (estCredit ? total < 0 : total > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              {estCredit ? `↩️ Note de crédit sur la facture ${origine.numero}` : "🧾 Nouvelle facture (sans QuickBooks)"}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {estCredit
                ? "Corrige ou annule la facture d'origine — la séquence comptable reste pleine, rien ne s'efface."
                : "La facture officielle vit dans Fluxya : numéro sans trou, lien public au client, PDF, export comptable."}
            </p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 pt-3">
          {/* CLIENT (verrouillé sur un crédit : celui de la facture d'origine) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Client *</label>
            {estCredit ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">{origine.clientNom}</p>
            ) : client ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-[#FF6A13] bg-orange-50 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-bold text-slate-800">{nomAffichageClient(client)}</span>
                <button onClick={() => { setClientId(""); setRecherche(""); }} className="shrink-0 text-[11px] font-bold text-slate-500 underline">changer</button>
              </div>
            ) : (
              <>
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="🔍 Cherche un client par nom, entreprise ou téléphone…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[10px] font-semibold text-slate-400">👇 Clique sur le client pour le choisir</p>
                <div className="mt-0.5 max-h-[130px] overflow-y-auto rounded-lg border border-slate-200">
                  {resultatsClients.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-400">Aucun client trouvé — crée sa fiche dans l&apos;onglet Clients d&apos;abord.</p>
                  ) : (
                    resultatsClients.map((c) => (
                      <button key={c.id} onClick={() => setClientId(c.id)} className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-orange-50">
                        <span className="min-w-0 truncate">{nomAffichageClient(c)}</span>
                        <span className="shrink-0 text-[10px] font-bold text-[#FF6A13]">choisir →</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* LIGNES (sur un crédit : préremplies inversées, ajustables) */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-500">{estCredit ? "Lignes créditées *" : "Lignes de la facture *"}</label>
              <div className="flex gap-1.5">
                <SelecteurItem catalogue={catalogue} onChoisir={ajouterLigne} libelle="+ Du catalogue" />
                <Button variant="outline" onClick={() => ajouterLigne(null)} className="min-h-0 px-2.5 py-1 text-[11px]">+ Ligne libre</Button>
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
                        placeholder="Description (ex. : Contrat d'entretien annuel 2026)"
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
                      {/* Le champ accepte déjà les négatifs — nécessaires aux crédits. */}
                      <InputNombreDecimal valeur={l.prix} onChange={(v) => majLigne(l.uid, { prix: v })} className="w-[86px] rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      <span className="text-[10px] font-bold text-slate-400">$</span>
                      <span className="ml-auto text-xs font-bold tabular-nums text-slate-700">{((Number(l.quantite) || 0) * (Number(l.prix) || 0)).toFixed(2)} $</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🍁 RÉGIME DE TAXES — chaque province canadienne est offerte
              (demande du propriétaire). Défaut : Québec. */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Taxes appliquées</label>
              <select value={regime} onChange={(e) => setRegime(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs">
                {REGIMES_TAXES.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            </div>
            {!estCredit && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Conditions de paiement</label>
                <input value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Ex. : Net 30" className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Note sur la facture (facultatif)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder={estCredit ? "Raison du crédit — ex. : pièce retournée, erreur de facturation…" : "Contexte, référence, remerciement…"}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>

          {/* TOTAUX — les taxes du régime choisi, en direct. */}
          <div className="ml-auto max-w-[260px] space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{argent(sousTotal)}</span></div>
            {taxes.map((t, i) => (
              <div key={i} className="flex justify-between text-slate-500"><span>{t.code} {t.taux} %</span><span className="tabular-nums">{argent(t.montant)}</span></div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-extrabold text-slate-900"><span>Total</span><span className="tabular-nums">{argent(total)}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button
            disabled={!peutContinuer}
            onClick={() =>
              onContinuer({
                client,
                lignes: lignesValides.map((l) => ({
                  description: String(l.description).trim(),
                  quantite: Number(l.quantite) || 1,
                  prix_unitaire: Number(l.prix) || 0,
                  montant: Math.round((Number(l.quantite) || 0) * (Number(l.prix) || 0) * 100) / 100,
                })),
                sousTotal: Math.round(sousTotal * 100) / 100,
                taxes,
                regime,
                total,
                terme: estCredit ? "" : terme,
                note: note.trim(),
              })
            }
            className="min-h-0 py-2 text-xs"
          >
            Continuer — choisir les destinataires
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LA SECTION COMPLÈTE — montée dans l'onglet Facturation.
// ============================================================
export function SectionFacturesMaison({ clients, catalogue, configEnt, ajouterJournal, estAdminPrincipal, qbConnecte = null }) {
  const [factures, setFactures] = useState([]);
  const [tableAbsente, setTableAbsente] = useState(false);
  const [modalOuverte, setModalOuverte] = useState(false); // true = facture ; objet = crédit sur cette facture
  const [choixCourriels, setChoixCourriels] = useState(null); // { donnees, origine }
  const [paiementDe, setPaiementDe] = useState(null); // facture à marquer payée
  const [renvoiDe, setRenvoiDe] = useState(null);
  const [exportOuvert, setExportOuvert] = useState(false);

  useEffect(() => {
    listerFacturesMaison()
      .then(setFactures)
      .catch(() => setTableAbsente(true)); // snippet 119 pas passé — la section reste discrète
  }, []);

  const numeroDe = (id) => factures.find((f) => f.id === id)?.numero || "";

  // Création + envoi — la facture EXISTE dès la création (numéro pris) ;
  // l'envoi qui échoue laisse une facture « émise » avec bouton Renvoyer.
  const emettre = async (donnees, choix, origine) => {
    const destinataires = listeDestinataires(choix).map((c) => c.email);
    let creee;
    try {
      creee = await creerFactureMaison({
        type: origine ? "credit" : "facture",
        factureOrigineId: origine?.id || null,
        clientId: donnees.client?.id || null,
        clientNom: donnees.client?.nom || origine?.clientNom || "",
        clientAdresse: donnees.client ? adresseFacturationClient(donnees.client) : origine?.clientAdresse || "",
        courriels: destinataires,
        lignes: donnees.lignes,
        sousTotal: donnees.sousTotal,
        taxes: donnees.taxes,
        regimeTaxes: donnees.regime,
        total: donnees.total,
        terme: donnees.terme,
        dateEcheance: origine ? null : echeanceDuTerme(donnees.terme),
        note: donnees.note,
      });
    } catch (e) {
      ajouterJournal(`⚠️ ${origine ? "Note de crédit" : "Facture"} NON créée : ${e?.message || "erreur"} (le snippet 119 est-il passé ?)`);
      return;
    }
    setFactures((prev) => [creee, ...prev]);
    if (origine) {
      // La facture d'origine passe « annulée » quand le crédit la couvre
      // AU COMPLET — sinon elle reste telle quelle (crédit partiel).
      if (Math.abs(creee.total + origine.total) < 0.005 && origine.statut !== "payee") {
        majFactureMaison(origine.id, { statut: "annulee", annuleeLe: new Date().toISOString(), annulationNote: `Créditée par ${creee.numero}` })
          .then((maj) => setFactures((prev) => prev.map((f) => (f.id === origine.id ? maj : f))))
          .catch(() => {});
      }
    }
    const envoye = await envoyerLien(creee, destinataires);
    ajouterJournal(
      `🧾 ${origine ? `Note de crédit ${creee.numero} (sur ${origine.numero})` : `Facture ${creee.numero}`} — ${donnees.client?.nom || origine?.clientNom} · ${creee.total.toFixed(2)} $` +
        (envoye ? ` · envoyée à ${destinataires.join(", ")}` : " · ⚠️ courriel NON parti — bouton Renvoyer disponible")
    );
  };

  const envoyerLien = async (f, destinataires) => {
    if (!destinataires || destinataires.length === 0) return false;
    const lien = lienFactureMaison(f);
    if (!lien) return false;
    const r = await envoyerCourriel({
      a: destinataires,
      sujet: `${f.type === "credit" ? "Note de crédit" : "Facture"} ${f.numero} — ${configEnt?.nomCommercial || configEnt?.nomLegal || ""}`,
      html: gabaritFactureMaison({
        config: configEnt,
        numero: f.numero,
        clientNom: f.clientNom,
        total: `${Math.abs(f.total).toFixed(2)} $`,
        lien,
        echeance: f.dateEcheance,
        credit: f.type === "credit",
      }),
    }).catch(() => ({ envoye: false }));
    // Journal HONNÊTE : « envoyée » seulement si l'envoi a réussi.
    if (r?.envoye || r?.simule) {
      const maj = await majFactureMaison(f.id, { statut: f.statut === "payee" ? "payee" : "envoyee", envoyeeLe: new Date().toISOString(), courriels: destinataires }).catch(() => null);
      if (maj) setFactures((prev) => prev.map((x) => (x.id === f.id ? maj : x)));
      return true;
    }
    return false;
  };

  const marquerPayee = async (f, mode) => {
    try {
      const maj = await majFactureMaison(f.id, { statut: "payee", payeeLe: new Date().toISOString(), modePaiement: mode });
      setFactures((prev) => prev.map((x) => (x.id === f.id ? maj : x)));
      ajouterJournal(`💰 Facture ${f.numero} marquée PAYÉE (${mode}) — ${f.clientNom} · ${f.total.toFixed(2)} $.`);
    } catch {
      ajouterJournal(`⚠️ Facture ${f.numero} : le paiement n'a PAS été enregistré — réessaie.`);
    }
  };

  // EXPORT COMPTABLE — période choisie OU « depuis le dernier export ».
  const exporter = async ({ du, au, depuisDernier }) => {
    const aExporter = factures.filter((f) => {
      if (depuisDernier) return !f.exporteeLe;
      return (!du || (f.dateEmission || "") >= du) && (!au || (f.dateEmission || "") <= au);
    });
    if (aExporter.length === 0) {
      ajouterJournal("📤 Export comptable : aucune facture dans la sélection.");
      return;
    }
    const decorees = aExporter.map((f) => ({ ...f, factureOrigineNumero: f.factureOrigineId ? numeroDe(f.factureOrigineId) : "" }));
    const csv = csvFacturesMaison(decorees);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures-fluxya-${aujourdhuiISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Marquage « exportée » — c'est lui qui garantit zéro doublon au
    // prochain « depuis le dernier export ».
    const quand = new Date().toISOString();
    await Promise.all(aExporter.map((f) => majFactureMaison(f.id, { exporteeLe: quand }).catch(() => null)));
    setFactures((prev) => prev.map((f) => (aExporter.some((x) => x.id === f.id) ? { ...f, exporteeLe: quand } : f)));
    ajouterJournal(`📤 Export comptable : ${aExporter.length} document${aExporter.length > 1 ? "s" : ""} exporté${aExporter.length > 1 ? "s" : ""} (CSV téléchargé).`);
  };

  if (tableAbsente) return null;

  return (
    <>
      {/* 🧭 UN SEUL CHEMIN (2026-09-03, demande du propriétaire) : cette
          porte n'apparaît que pour une entreprise SANS QuickBooks — et
          elle devient alors LE chemin principal (bouton noir, message
          direct). Entreprise connectée : la porte disparaît (deux
          boutons de facture côte à côte = la mauvaise finit par sortir),
          mais les factures maison déjà créées restent listées plus bas. */}
      {estAdminPrincipal && qbConnecte === false && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="min-w-0 text-[11px] text-slate-500">
            Une vente au comptoir, un contrat, des frais ? Crée la facture officielle ici — numérotée, envoyée, suivie, exportable.
          </p>
          <Button onClick={() => setModalOuverte(true)} className="min-h-0 shrink-0 gap-1 px-2.5 py-1.5 text-[11px]">
            🧾 Nouvelle facture
          </Button>
        </div>
      )}

      {factures.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🧾 Factures maison ({factures.length})</p>
            <button onClick={() => setExportOuvert(true)} className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 active:scale-95">
              📤 Export comptable
            </button>
          </div>
          <div className="mt-1.5 space-y-1">
            {factures.slice(0, 20).map((f) => (
              <div key={f.id} className={`rounded-lg px-2 py-1.5 text-[11px] text-slate-600 ${f.statut === "annulee" ? "bg-slate-100 opacity-70" : f.type === "credit" ? "bg-amber-50" : "bg-slate-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="min-w-0">
                    <span className={`font-bold text-slate-800 ${f.statut === "annulee" ? "line-through" : ""}`}>{f.numero}</span>
                    {f.type === "credit" && <span className="text-amber-700"> · crédit{f.factureOrigineId ? ` sur ${numeroDe(f.factureOrigineId)}` : ""}</span>}
                    {" · "}{f.clientNom}
                    <span className="font-bold tabular-nums"> · {f.total.toFixed(2)} $</span>
                    <span className="text-slate-400"> · {f.dateEmission}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {f.statut === "payee" ? (
                      <span className="text-[10px] font-bold text-emerald-600">💰 Payée{f.modePaiement ? ` (${f.modePaiement})` : ""}</span>
                    ) : f.statut === "annulee" ? (
                      <span className="text-[10px] font-bold text-slate-500" title={f.annulationNote || ""}>❌ Annulée</span>
                    ) : estEnRetard(f) ? (
                      <span className="text-[10px] font-bold text-red-600">⏰ En retard</span>
                    ) : f.statut === "envoyee" ? (
                      <span className="text-[10px] font-bold text-emerald-600">✉️ Envoyée ✓</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700">📄 Émise — pas envoyée</span>
                    )}
                    {f.jetonPublic && (
                      <a href={lienFactureMaison(f)} target="_blank" rel="noreferrer" className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 active:scale-95">
                        👁️ Voir
                      </a>
                    )}
                    <button onClick={() => setRenvoiDe(f)} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 active:scale-95">
                      📧 {f.envoyeeLe ? "Renvoyer" : "Envoyer"}
                    </button>
                    {f.type === "facture" && f.statut !== "payee" && f.statut !== "annulee" && (
                      <button onClick={() => setPaiementDe(f)} className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 active:scale-95">
                        💰 Payée…
                      </button>
                    )}
                    {f.type === "facture" && f.statut !== "annulee" && estAdminPrincipal && (
                      <button onClick={() => setModalOuverte(f)} title="Émettre une note de crédit rattachée" className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber-700 active:scale-95">
                        ↩️ Crédit
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalOuverte && (
        <ModalFactureMaison
          clients={clients}
          catalogue={catalogue}
          configEnt={configEnt}
          origine={modalOuverte === true ? null : modalOuverte}
          onFermer={() => setModalOuverte(false)}
          onContinuer={(donnees) => {
            const origine = modalOuverte === true ? null : modalOuverte;
            setModalOuverte(false);
            setChoixCourriels({ donnees, origine });
          }}
        />
      )}
      {choixCourriels && (
        <ModalSelectionCourriel
          client={choixCourriels.donnees.client?.id ? choixCourriels.donnees.client : (clients || []).find((c) => c.nom === (choixCourriels.origine?.clientNom || "")) || choixCourriels.donnees.client}
          contexte={choixCourriels.origine ? "cette note de crédit" : "cette facture"}
          onFermer={() => setChoixCourriels(null)}
          onConfirmer={(choix) => {
            const { donnees, origine } = choixCourriels;
            setChoixCourriels(null);
            emettre(donnees, choix, origine);
          }}
        />
      )}
      {renvoiDe && (
        <ModalSelectionCourriel
          client={(clients || []).find((c) => c.id === renvoiDe.clientId || c.nom === renvoiDe.clientNom)}
          contexte={`le renvoi de la facture ${renvoiDe.numero}`}
          onFermer={() => setRenvoiDe(null)}
          onConfirmer={async (choix) => {
            const f = renvoiDe;
            setRenvoiDe(null);
            const destinataires = listeDestinataires(choix).map((c) => c.email);
            const ok = await envoyerLien(f, destinataires);
            ajouterJournal(ok ? `📧 Facture ${f.numero} renvoyée à ${destinataires.join(", ")}.` : `⚠️ Renvoi de ${f.numero} : le courriel n'est PAS parti — réessaie.`);
          }}
        />
      )}
      {paiementDe && (
        <ModalPaiementRecu facture={paiementDe} onFermer={() => setPaiementDe(null)} onConfirmer={(mode) => { const f = paiementDe; setPaiementDe(null); marquerPayee(f, mode); }} />
      )}
      {exportOuvert && <ModalExportComptable onFermer={() => setExportOuvert(false)} onExporter={(sel) => { setExportOuvert(false); exporter(sel); }} />}
    </>
  );
}

// Paiement reçu — le mode reste au dossier (et dans l'export comptable).
function ModalPaiementRecu({ facture, onFermer, onConfirmer }) {
  const [mode, setMode] = useState("Virement Interac");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-sm font-extrabold text-slate-900">💰 Paiement reçu — facture {facture.numero}</h3>
        <p className="mt-1 text-xs text-slate-500">{facture.clientNom} · {facture.total.toFixed(2)} $</p>
        <label className="mt-3 mb-1 block text-xs font-bold text-slate-500">Mode de paiement</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs">
          {["Virement Interac", "Chèque", "Comptant", "Carte de crédit", "Dépôt direct", "Autre"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button onClick={() => onConfirmer(mode)} className="min-h-0 py-2 text-xs">Marquer payée</Button>
        </div>
      </div>
    </div>
  );
}

// Export comptable — période OU « depuis le dernier export » (zéro doublon).
function ModalExportComptable({ onFermer, onExporter }) {
  const [depuisDernier, setDepuisDernier] = useState(true);
  const [du, setDu] = useState("");
  const [au, setAu] = useState(aujourdhuiISO());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-sm font-extrabold text-slate-900">📤 Export comptable (CSV)</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Le fichier s&apos;ouvre dans Excel — une ligne par facture et note de crédit, une colonne par taxe (TPS, TVQ, TVH, TVP).
        </p>
        <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={depuisDernier} onChange={(e) => setDepuisDernier(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#131B2E]" />
          <span>
            Depuis le dernier export
            <span className="block text-[10px] font-normal text-slate-400">Seulement ce qui n&apos;a jamais été exporté — aucun doublon possible chez le comptable.</span>
          </span>
        </label>
        {!depuisDernier && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Du</label>
              <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Au</label>
              <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button onClick={() => onExporter({ du, au, depuisDernier })} className="min-h-0 py-2 text-xs">Exporter</Button>
        </div>
      </div>
    </div>
  );
}
