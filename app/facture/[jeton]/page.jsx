"use client";

// app/facture/[jeton]/page.jsx
//
// 🧾 FACTURE MAISON — PAGE PUBLIQUE (2026-09-02). Le client arrive par
// le lien reçu par courriel et voit LA FACTURE OFFICIELLE : identité
// complète de l'entreprise (logo, adresse, RBQ, numéros de taxes),
// lignes, taxes selon le régime de SA province, échéance, statut payé.
// « Imprimer / PDF » passe par l'impression du navigateur — le client
// garde sa copie. Aucun montant coûtant ne voyage ; page anonyme via la
// fonction Postgres facture_maison_public (jamais la table).

import { useEffect, useState } from "react";
import { use } from "react";
import { AlertTriangle, Loader2, Printer } from "lucide-react";
import { chargerFactureMaisonPublique, noterConsultationFactureMaison } from "@/lib/supabase/facturesMaison";
import { ligneAccreditations } from "@/lib/supabase/devisPublic";
import { numeroPourTaxe } from "@/lib/taxesCanada";

const argent = (n) => `${(Number(n) || 0).toFixed(2)} $`;

export default function PageFacturePublique({ params }) {
  const { jeton } = use(params);
  const [facture, setFacture] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!jeton) return;
    chargerFactureMaisonPublique(jeton)
      .then((f) => {
        if (!f) setErreur("Ce lien n'est pas valide. Vérifie l'adresse, ou demande un nouveau lien.");
        else {
          setFacture(f);
          // 👁️ Consultation notée (snippet 123) — jamais en aperçu bureau.
          if (typeof window !== "undefined" && !new URLSearchParams(window.location.search).has("apercu")) {
            noterConsultationFactureMaison(jeton);
          }
        }
      })
      .catch(() => setErreur("La facture n'a pas pu être chargée. Réessaie dans un moment."))
      .finally(() => setChargement(false));
  }, [jeton]);

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Chargement de la facture…
      </div>
    );
  }
  if (erreur || !facture) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-amber-500" />
          <p className="mt-3 text-sm font-bold text-slate-800">{erreur}</p>
        </div>
      </div>
    );
  }

  const e = facture.entreprise;
  const estCredit = facture.type === "credit";
  const payee = facture.statut === "payee";
  const annulee = facture.statut === "annulee";

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl space-y-4 print:space-y-3">
        {/* EN-TÊTE ENTREPRISE — identité complète, comme du papier à en-tête. */}
        <div className="rounded-2xl bg-white p-5 print:rounded-none print:p-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {e.logo && <img src={e.logo} alt="" className="h-11 w-auto" onError={(ev) => { ev.currentTarget.style.display = "none"; }} />}
              <div>
                <p className="text-sm font-extrabold text-[#131B2E]">{e.nom}</p>
                {e.adresse && <p className="text-[11px] text-slate-500">{e.adresse}</p>}
                <p className="text-[11px] text-slate-500">{[e.telephone, e.courriel, e.siteWeb].filter(Boolean).join(" · ")}</p>
                {ligneAccreditations(e.rbq, e.associations) && (
                  <p className="text-[11px] font-semibold text-slate-600">{ligneAccreditations(e.rbq, e.associations)}</p>
                )}
              </div>
            </div>
            {/* STATUT bien en évidence — payée en vert, annulée barrée. */}
            {payee && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">PAYÉE ✓</span>}
            {annulee && <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-extrabold text-slate-500">ANNULÉE</span>}
          </div>

          <h1 className="mt-4 text-2xl font-extrabold text-[#131B2E]">
            {estCredit ? "NOTE DE CRÉDIT" : "FACTURE"} {facture.numero}
          </h1>
          {estCredit && facture.numeroOrigine && (
            <p className="text-xs font-semibold text-slate-500">S'applique à la facture {facture.numeroOrigine}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-6 text-xs text-slate-500">
            <span>Date : {facture.dateEmission}</span>
            {!estCredit && facture.dateEcheance && <span>Échéance : {facture.dateEcheance}</span>}
            {facture.terme && <span>Conditions : {facture.terme}</span>}
          </div>
          <p className="mt-3 text-xs text-slate-500">{estCredit ? "Émise à" : "Facturé à"}</p>
          <p className="text-sm font-bold text-slate-800">{facture.clientNom}</p>
          {facture.clientAdresse && <p className="text-xs text-slate-600">{facture.clientAdresse}</p>}
        </div>

        {/* LIGNES */}
        <div className="rounded-2xl bg-white p-5 print:rounded-none print:p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-2">Description</th>
                <th className="py-1.5 pr-2 text-right">Qté</th>
                <th className="py-1.5 pr-2 text-right">Prix</th>
                <th className="py-1.5 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="whitespace-pre-wrap py-2 pr-2 text-slate-800">{l.description}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{l.quantite ?? 1}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{argent(l.prix_unitaire ?? l.prixUnitaire)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-slate-800">{argent(l.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-3 max-w-[260px] space-y-1 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{argent(facture.sousTotal)}</span></div>
            {/* Les lignes de taxes du RÉGIME de la facture, chacune avec
                son numéro d'inscription (obligation fiscale). */}
            {facture.taxes.map((t, i) => {
              const no = numeroPourTaxe(t.code, { numeroTps: e.numeroTps, numeroTvq: e.numeroTvq });
              return (
                <div key={i} className="flex justify-between text-slate-500">
                  <span>{t.code} {t.taux} %{no ? ` (nº ${no})` : ""}</span>
                  <span className="tabular-nums">{argent(t.montant)}</span>
                </div>
              );
            })}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{argent(facture.total)}</span>
            </div>
            {payee && facture.payeeLe && (
              <p className="text-right text-[10px] font-bold text-emerald-600">Payée le {String(facture.payeeLe).slice(0, 10)}</p>
            )}
          </div>
        </div>

        {/* NOTE + MODALITÉS DE PAIEMENT (Paramètres de l'entreprise) */}
        {(facture.note || e.noteFacture) && (
          <div className="rounded-2xl bg-white p-5 text-xs leading-relaxed text-slate-600 print:rounded-none print:p-0">
            {facture.note && <p className="whitespace-pre-wrap">{facture.note}</p>}
            {e.noteFacture && <p className={`whitespace-pre-wrap ${facture.note ? "mt-2 border-t border-slate-100 pt-2" : ""}`}>{e.noteFacture}</p>}
          </div>
        )}

        {/* IMPRESSION / PDF — l'impression du navigateur donne la copie
            PDF ; le bouton disparaît lui-même à l'impression. */}
        <div className="flex justify-center print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#131B2E] px-5 py-2.5 text-sm font-bold text-white active:scale-[0.99]"
          >
            <Printer size={15} /> Imprimer / Enregistrer en PDF
          </button>
        </div>

        <p className="pb-4 text-center text-[10px] text-slate-400 print:hidden">
          {e.nom} — document émis par Fluxya.
        </p>
      </div>
    </div>
  );
}
