"use client";

// app/admin/ModalDoublonsClients.jsx
//
// 🔍 DOUBLONS POSSIBLES + FUSION VALIDÉE (2026-09-22, idée retenue par le
// propriétaire : « oui mais valider avant de fusionner »).
// Détection (rien n'est modifié) : même nom (sans accents, ponctuation ni
// « inc./ltée/enr. »), même téléphone, ou même courriel. Pour chaque paire :
// on choisit la fiche GARDÉE → « Voir ce qui sera déplacé » (aperçu du
// serveur, rien d'écrit) → « Fusionner » (confirmation). « Pas un doublon »
// retire la paire de la liste (mémorisé sur ce poste).

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "./partage";

const CLE_ECARTES = "fluxya_doublons_ecartes";
const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const nomNormalise = (n) =>
  sansAccents(n).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|ltee|ltd|enr|senc|corp|cie|co|la|le|les|the)\b/g, " ").replace(/\s+/g, " ").trim();
const telephone10 = (t) => String(t || "").replace(/\D/g, "").slice(-10);

function lireEcartes() {
  try { return new Set(JSON.parse(window.localStorage.getItem(CLE_ECARTES) || "[]")); } catch { return new Set(); }
}

export function ModalDoublonsClients({ clients = [], onFermer, ajouterJournal }) {
  const [ecartes, setEcartes] = useState(() => lireEcartes());
  const [choix, setChoix] = useState({}); // cléPaire → id gardé
  const [apercus, setApercus] = useState({}); // cléPaire → { chargement, apercu, erreur, confirmer, enCours, fait }

  const paires = useMemo(() => {
    const index = { nom: new Map(), tel: new Map(), courriel: new Map() };
    const vues = new Map();
    const ajouter = (a, b, raison) => {
      const [x, y] = a.id < b.id ? [a, b] : [b, a];
      const cle = `${x.id}|${y.id}`;
      if (ecartes.has(cle)) return;
      const p = vues.get(cle) || { cle, a: x, b: y, raisons: new Set() };
      p.raisons.add(raison);
      vues.set(cle, p);
    };
    (clients || []).forEach((c) => {
      const cles = [
        ["nom", nomNormalise(c.nom)],
        ["tel", telephone10(c.telephone).length === 10 ? telephone10(c.telephone) : ""],
        ...(c.courriels || []).map((e) => ["courriel", String(e?.email || "").trim().toLowerCase()]),
      ];
      cles.forEach(([type, v]) => {
        if (!v || (type === "nom" && v.length < 3)) return;
        const deja = index[type].get(v);
        if (deja && deja.id !== c.id) ajouter(deja, c, type === "nom" ? "même nom" : type === "tel" ? "même téléphone" : "même courriel");
        else if (!deja) index[type].set(v, c);
      });
    });
    // Les plus probables d'abord : « même nom » pèse lourd ; un courriel
    // partagé seul est souvent un propriétaire de plusieurs entreprises.
    const score = (p) => (p.raisons.has("même nom") ? 3 : 0) + p.raisons.size;
    return [...vues.values()].sort((p, q) => score(q) - score(p) || String(p.a.nom).localeCompare(String(q.a.nom), "fr"));
  }, [clients, ecartes]);

  const appeler = async (corps) => {
    const jeton = (await supabase.auth.getSession()).data?.session?.access_token;
    const r = await fetch("/api/clients/fusionner", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.erreur || "Réponse invalide du serveur.");
    return j;
  };
  const voirApercu = async (p) => {
    const garderId = choix[p.cle] || p.a.id;
    const fusionnerId = garderId === p.a.id ? p.b.id : p.a.id;
    setApercus((s) => ({ ...s, [p.cle]: { chargement: true } }));
    try {
      const { apercu } = await appeler({ garderId, fusionnerId, apercu: true });
      setApercus((s) => ({ ...s, [p.cle]: { apercu, garderId, fusionnerId } }));
    } catch (e) {
      setApercus((s) => ({ ...s, [p.cle]: { erreur: e.message } }));
    }
  };
  const fusionner = async (p) => {
    const a = apercus[p.cle];
    setApercus((s) => ({ ...s, [p.cle]: { ...a, enCours: true } }));
    try {
      await appeler({ garderId: a.garderId, fusionnerId: a.fusionnerId, confirmer: true });
      setApercus((s) => ({ ...s, [p.cle]: { ...a, enCours: false, fait: true } }));
      ajouterJournal?.(`🔗 Fiches fusionnées : « ${a.apercu.fusionner.nom} » → « ${a.apercu.garder.nom} ». La page va se recharger pour tout remettre à jour.`);
      // Rechargement : devis, projets, tâches et fiches se relisent d'un coup,
      // sans risque qu'un écran garde l'ancienne fiche en mémoire.
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setApercus((s) => ({ ...s, [p.cle]: { ...a, enCours: false, erreur: e.message } }));
    }
  };
  const ecarter = (p) => {
    const n = new Set(ecartes);
    n.add(p.cle);
    try { window.localStorage.setItem(CLE_ECARTES, JSON.stringify([...n])); } catch {}
    setEcartes(n);
  };

  const Carte = ({ c, garde, onGarder }) => (
    <button type="button" onClick={onGarder} className={`min-w-0 flex-1 rounded-xl border p-2.5 text-left text-[11px] ${garde ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
      <p className="font-extrabold text-slate-800">{garde ? "✅ Garder : " : ""}{c.nom}</p>
      {c.adresseFacturation ? <p className="truncate text-slate-500">📍 {c.adresseFacturation}</p> : null}
      {c.telephone ? <p className="text-slate-500">📞 {c.telephone}</p> : null}
      <p className="text-slate-400">
        {(c.courriels || []).length} courriel(s) · {(c.adresses || []).length} adresse(s){c.quickbooksCustomerId || c.qbCustomerId ? " · QuickBooks ✓" : ""}
      </p>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🔍 Doublons possibles ({paires.length})</h3>
            <p className="text-[11px] text-slate-500">Rien n&apos;est fusionné sans ton accord. Clique la fiche à GARDER, regarde l&apos;aperçu, puis confirme.</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        {paires.length === 0 && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">✓ Aucun doublon probable trouvé.</p>}
        <div className="space-y-3">
          {paires.map((p) => {
            const garde = choix[p.cle] || p.a.id;
            const ap = apercus[p.cle] || {};
            const d = ap.apercu?.deplaces;
            return (
              <div key={p.cle} className="rounded-xl border border-slate-200 p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">{[...p.raisons].join(" · ")}</p>
                <div className="flex gap-2">
                  <Carte c={p.a} garde={garde === p.a.id} onGarder={() => { setChoix((s) => ({ ...s, [p.cle]: p.a.id })); setApercus((s) => ({ ...s, [p.cle]: {} })); }} />
                  <Carte c={p.b} garde={garde === p.b.id} onGarder={() => { setChoix((s) => ({ ...s, [p.cle]: p.b.id })); setApercus((s) => ({ ...s, [p.cle]: {} })); }} />
                </div>
                {ap.erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">⚠️ {ap.erreur}</p>}
                {ap.fait ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800">✅ Fusionnées — la page se recharge…</p>
                ) : d ? (
                  <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">
                    <p className="font-bold">« {ap.apercu.fusionner.nom} » sera fusionnée dans « {ap.apercu.garder.nom} », puis SUPPRIMÉE :</p>
                    <p className="mt-0.5">
                      {d.devis} devis · {d.projets} projet(s) · {d.tachesAttente + d.tachesAgenda} tâche(s) · {d.achats + d.pieces} achat(s)/pièce(s) · {d.facturesLibres + d.facturesMaison} facture(s)
                      {d.bonsParNom + d.heuresParNom ? ` · ${d.bonsParNom} bon(s) et ${d.heuresParNom} ligne(s) d'heures renommés` : ""} ; + {ap.apercu.ajoutes.adresses} adresse(s), {ap.apercu.ajoutes.courriels} courriel(s), {ap.apercu.ajoutes.contacts} contact(s).
                    </p>
                    {ap.apercu.deuxQuickbooks && (
                      <p className="mt-1 font-bold text-red-700">⚠️ Les deux sont liées à QuickBooks : Fluxya garde #{ap.apercu.garder.quickbooks}. Fusionne aussi les deux clients dans QuickBooks (Clients → fusionner) pour que les factures suivent.</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button loading={ap.enCours} onClick={() => fusionner(p)} className="min-h-0 flex-1 bg-red-600 py-1.5 text-xs hover:bg-red-700">🔗 Fusionner (irréversible)</Button>
                      <Button variant="outline" onClick={() => setApercus((s) => ({ ...s, [p.cle]: {} }))} className="min-h-0 py-1.5 text-xs">Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" loading={ap.chargement} onClick={() => voirApercu(p)} className="min-h-0 py-1.5 text-xs">👀 Voir ce qui sera déplacé</Button>
                    <button type="button" onClick={() => ecarter(p)} className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600">Pas un doublon</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
