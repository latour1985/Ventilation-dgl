"use client";

// PAGE PUBLIQUE D'ACCEPTATION D'UN DEVIS
// ============================================================
// La PREMIÈRE page de l'application accessible sans mot de passe.
// Le client arrive par un lien, lit son devis et les conditions,
// coche une case OBLIGATOIRE, et répond.
//
// Trois réponses possibles — et la troisième compte autant que les deux
// autres : un client qui ne peut que dire « oui » ferme l'onglet et on
// reste sans nouvelle. « Demander une modification » ramène l'échange
// au bureau au lieu de le laisser mourir.
//
// Ce qui donne sa valeur de preuve : la case est obligatoire, et on
// enregistre le TEXTE EXACT des conditions affichées ce jour-là (voir
// lib/conditionsTexte.js). Si les clauses changent plus tard, on pourra
// toujours montrer ce que cette personne a lu.
//
// Les PRIX COÛTANTS n'existent pas sur cette page : la fonction
// Postgres qui sert les données les retire à la source.

import { useEffect, useState } from "react";
import { use } from "react";
import { CheckCircle2, AlertTriangle, Loader2, FileText } from "lucide-react";
import { chargerDevisPublic, repondreDevis } from "@/lib/supabase/devisPublic";
import { CONDITIONS_TEXTE, VERSION_CONDITIONS } from "@/lib/conditionsTexte";
import { CONFIG_DEFAUT, chargerEntreprise, calculerTaxes } from "@/lib/supabase/entreprise";

const argent = (n) => `${(Number(n) || 0).toFixed(2)} $`;

export default function PageDevisPublic({ params }) {
  const { jeton } = use(params);
  const [devis, setDevis] = useState(null);
  const [config, setConfig] = useState(CONFIG_DEFAUT);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [accepte, setAccepte] = useState(false);
  const [nom, setNom] = useState("");
  const [message, setMessage] = useState("");
  const [modeModif, setModeModif] = useState(false);
  const [envoi, setEnvoi] = useState("");
  const [fait, setFait] = useState(null);

  useEffect(() => {
    Promise.all([chargerDevisPublic(jeton), chargerEntreprise().catch(() => CONFIG_DEFAUT)])
      .then(([d, c]) => {
        setConfig(c || CONFIG_DEFAUT);
        if (!d) setErreur("Ce lien n'est pas valide. Vérifie l'adresse ou communique avec nous.");
        else setDevis(d);
      })
      .catch(() => setErreur("Impossible de charger ce devis. Réessaie dans quelques minutes."))
      .finally(() => setChargement(false));
  }, [jeton]);

  const repondre = async (reponse) => {
    if (reponse === "accepte" && (!accepte || nom.trim().length < 3)) return;
    if (reponse !== "accepte" && nom.trim().length < 3) return;
    setEnvoi("envoi");
    try {
      const ok = await repondreDevis({
        jeton,
        reponse,
        nom: nom.trim(),
        message,
        // Le texte exact affiché — c'est la pièce à conviction.
        version: VERSION_CONDITIONS,
        texte: reponse === "accepte" ? CONDITIONS_TEXTE : null,
      });
      if (!ok) {
        setErreur("Ce devis a déjà reçu une réponse, ou le lien est expiré. Communique avec nous.");
        setEnvoi("");
        return;
      }
      setFait(reponse);
    } catch {
      setErreur("L'envoi a échoué. Vérifie ta connexion et réessaie.");
      setEnvoi("");
    }
  };

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Chargement du devis…
      </div>
    );
  }

  if (erreur && !devis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-amber-500" />
          <p className="mt-3 text-sm font-bold text-slate-800">{erreur}</p>
          {config.telephone && <p className="mt-2 text-sm text-slate-500">{config.telephone}</p>}
        </div>
      </div>
    );
  }

  // Réponse déjà donnée (par ce clic-ci ou lors d'une visite précédente).
  const dejaRepondu = fait || devis.reponseClient;
  const taxes = calculerTaxes(devis.totalVendant, config);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* EN-TÊTE ENTREPRISE */}
        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-center gap-3">
            <img src="/logo-dgl.png" alt="" className="h-11 w-auto" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <div>
              <p className="text-sm font-extrabold text-[#131B2E]">{config.nomLegal}</p>
              <p className="text-[11px] text-slate-500">
                {[config.telephone, config.courriel].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold text-[#131B2E]">DEVIS {devis.numero}</h1>
          <p className="text-xs text-slate-500">Date : {devis.date}</p>
          <p className="mt-2 text-xs text-slate-500">Préparé pour</p>
          <p className="text-sm font-bold text-slate-800">{devis.clientNom}</p>
        </div>

        {/* LIGNES */}
        <div className="rounded-2xl bg-white p-5">
          {devis.lignes.map((l) => (
            <div key={l.uid} className="border-b border-slate-100 py-2.5 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{l.nom}</p>
                  {l.description ? (
                    <p className="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-slate-500">{l.description}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-slate-400">{l.quantite} × {argent(l.prix_vendant)}</p>
                  <p className="text-sm font-bold tabular-nums text-slate-900">
                    {argent((Number(l.prix_vendant) || 0) * (Number(l.quantite) || 0))}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{argent(devis.totalVendant)}</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS</span><span className="tabular-nums">{argent(taxes.tps)}</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ</span><span className="tabular-nums">{argent(taxes.tvq)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-lg font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{argent(taxes.total)}</span>
            </div>
          </div>
        </div>

        {/* CONDITIONS — affichées EN ENTIER, pas derrière un lien.
            Une case cochée à côté d'un lien « voir les conditions » ne
            prouve rien ; le texte doit être sous ses yeux. */}
        <div className="rounded-2xl bg-white p-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <FileText size={13} /> Termes et conditions générales
          </p>
          <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            {CONDITIONS_TEXTE}
          </div>
        </div>

        {/* RÉPONSE */}
        {dejaRepondu ? (
          <div className="rounded-2xl bg-white p-6 text-center">
            {dejaRepondu === "accepte" ? (
              <>
                <CheckCircle2 size={34} className="mx-auto text-emerald-500" />
                <p className="mt-3 text-lg font-extrabold text-slate-900">Devis accepté</p>
                <p className="mt-1 text-sm text-slate-500">
                  Merci ! Nous avons reçu votre acceptation et communiquerons avec vous pour la suite.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 size={34} className="mx-auto text-blue-500" />
                <p className="mt-3 text-lg font-extrabold text-slate-900">
                  {dejaRepondu === "refuse" ? "Réponse enregistrée" : "Demande transmise"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {dejaRepondu === "refuse"
                    ? "Merci de nous avoir répondu."
                    : "Nous avons reçu votre demande et vous reviendrons avec une version révisée."}
                </p>
              </>
            )}
          </div>
        ) : devis.expire ? (
          <div className="rounded-2xl bg-white p-6 text-center">
            <AlertTriangle size={28} className="mx-auto text-amber-500" />
            <p className="mt-3 text-sm font-bold text-slate-800">Ce devis est expiré</p>
            <p className="mt-1 text-sm text-slate-500">
              Nos prix sont valides 30 jours. Communique avec nous pour une mise à jour.
            </p>
            {config.telephone && <p className="mt-2 text-sm font-bold text-slate-700">{config.telephone}</p>}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-5">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Votre nom {modeModif ? "" : "(signature électronique)"}
            </label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Prénom et nom"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A13]"
            />

            {modeModif ? (
              <>
                <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Ce que vous aimeriez changer
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex. : retirer le thermostat, ajouter une sortie au sous-sol…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A13]"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setModeModif(false)}
                    className="min-h-[48px] rounded-xl border border-slate-300 text-sm font-bold text-slate-600"
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => repondre("modification")}
                    disabled={nom.trim().length < 3 || envoi === "envoi"}
                    className="min-h-[48px] rounded-xl bg-[#131B2E] text-sm font-extrabold text-white disabled:opacity-40"
                  >
                    {envoi === "envoi" ? "Envoi…" : "Envoyer ma demande"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={accepte}
                    onChange={(e) => setAccepte(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#131B2E]"
                  />
                  <span className="text-[13px] font-semibold leading-snug text-slate-700">
                    J&apos;ai lu et j&apos;accepte les termes et conditions générales ci-dessus.
                  </span>
                </label>

                <button
                  onClick={() => repondre("accepte")}
                  disabled={!accepte || nom.trim().length < 3 || envoi === "envoi"}
                  className="mt-3 min-h-[54px] w-full rounded-xl bg-emerald-600 text-base font-extrabold text-white active:scale-[0.99] disabled:opacity-40"
                >
                  {envoi === "envoi" ? "Envoi…" : "✓ Accepter ce devis"}
                </button>
                {!accepte && (
                  <p className="mt-1.5 text-center text-[11px] text-slate-400">
                    Coche la case et écris ton nom pour accepter.
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setModeModif(true)}
                    className="min-h-[44px] rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                  >
                    Demander une modification
                  </button>
                  <button
                    onClick={() => repondre("refuse")}
                    disabled={nom.trim().length < 3 || envoi === "envoi"}
                    className="min-h-[44px] rounded-xl border border-slate-300 text-xs font-bold text-slate-500 disabled:opacity-40"
                  >
                    Refuser ce devis
                  </button>
                </div>
              </>
            )}

            {erreur && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{erreur}</p>
            )}
          </div>
        )}

        <p className="pb-6 text-center text-[10px] text-slate-400">
          © {new Date().getFullYear()} {config.nomLegal}
        </p>
      </div>
    </div>
  );
}
