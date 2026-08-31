"use client";

// app/admin/OngletParametres.jsx
//
// PARAMÈTRES DE L'ENTREPRISE (coordonnées, taxes, paie, connexions) —
// tranche T7 du découpage de page.jsx (2026-08-28). Mécanique.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Lock, RefreshCw, X } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { calculerTaxes } from "@/lib/supabase/entreprise";
import { supabase } from "@/lib/supabase/client";
import { etatQuickbooks, synchroniserClientsQbo } from "@/lib/quickbooksClient";
import { listerCompteurs, reglerProchainNumero } from "@/lib/supabase/compteurs";
import { Button, tauxAffiche } from "./partage";

export function ChampParametre({ brouillon, champ, estAdminPrincipal, cle, libelle, aide, placeholder, type = "text", pas, unite }) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] font-bold text-slate-400">{libelle}</label>
      <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
        <input
          type={type}
          step={pas}
          min={type === "number" ? 0 : undefined}
          value={brouillon[cle] ?? ""}
          placeholder={placeholder}
          disabled={!estAdminPrincipal}
          onChange={(e) => champ(cle, type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          className="w-full bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
        />
        {unite ? <span className="shrink-0 text-[10px] text-slate-400">{unite}</span> : null}
      </div>
      {aide ? <p className="mt-0.5 text-[9px] leading-snug text-slate-400">{aide}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------
// CONNEXION QUICKBOOKS (Paramètres → Connexions)
// ------------------------------------------------------------
// Affiche l'état réel (lu de la route /api/quickbooks/etat — jamais
// les jetons) et le bouton de connexion. Le clic quitte l'application
// vers l'écran d'autorisation d'Intuit, qui ramène sur /admin ensuite.
// Défini au niveau MODULE (règle du fichier — jamais dans le rendu).

// ------------------------------------------------------------
// CONNEXION QUICKBOOKS (Paramètres → Connexions)
// ------------------------------------------------------------
// Affiche l'état réel (lu de la route /api/quickbooks/etat — jamais
// les jetons) et le bouton de connexion. Le clic quitte l'application
// vers l'écran d'autorisation d'Intuit, qui ramène sur /admin ensuite.
// Défini au niveau MODULE (règle du fichier — jamais dans le rendu).
export function CarteConnexionQuickbooks({ estAdminPrincipal }) {
  const [etatQb, setEtatQb] = useState(null); // null = vérification en cours
  // SYNCHRONISATION DES CLIENTS — le rattrapage initial : envoie vers
  // QuickBooks tous les clients pas encore reliés, par lots de 100.
  const [syncClients, setSyncClients] = useState(null); // null | "en_cours" | { fait, erreurs }
  const lancerSyncClients = async () => {
    setSyncClients("en_cours");
    let totalFait = 0;
    const toutesErreurs = [];
    // Boucle de lots : la route s'arrête à 100 par passe.
    for (let passe = 0; passe < 20; passe++) {
      const r = await synchroniserClientsQbo({ tous: true });
      if (r?.erreur || r?.nonConnecte || r?.simule) {
        setSyncClients({ fait: totalFait, erreurs: [r?.erreur || (r?.nonConnecte ? "QuickBooks non connecté" : "mode simulé — clés absentes")] });
        return;
      }
      totalFait += r?.fait || 0;
      toutesErreurs.push(...(r?.erreurs || []));
      if (r?.termine || toutesErreurs.length >= 5) break;
    }
    setSyncClients({ fait: totalFait, erreurs: toutesErreurs });
  };
  // ⚠️ ÉCHEC ≠ « pas configuré » (correctif 2026-08-28) : quand l'appel
  // échouait (session expirée, réseau), la réponse ne portait pas
  // `configure` — et l'écran annonçait « Mode simulé » alors que les
  // clés étaient bien là et que QuickBooks tournait en PRODUCTION.
  // On distingue maintenant les deux, avec un bouton pour revérifier.
  const [verifQbEnCours, setVerifQbEnCours] = useState(false);
  const verifierEtatQb = async () => {
    setVerifQbEnCours(true);
    const e = await etatQuickbooks();
    setEtatQb(e && typeof e === "object" ? e : { erreur: "Réponse illisible." });
    setVerifQbEnCours(false);
  };
  useEffect(() => {
    let actif = true;
    etatQuickbooks().then((e) => {
      if (actif) setEtatQb(e && typeof e === "object" ? e : { erreur: "Réponse illisible." });
    });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">QuickBooks</p>
      {/* Le texte suit l'environnement RÉEL de la connexion — annoncer
          « Sandbox » alors que la vraie comptabilité est branchée était
          trompeur (2026-08-28). */}
      <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
        Synchronise les factures et dépenses de la comptabilité vers la rentabilité des projets.
        {etatQb?.environnement === "production" ? (
          <span className="font-bold text-emerald-700"> Branché sur la VRAIE comptabilité (production).</span>
        ) : (
          " Sandbox (entreprise de test Intuit) tant que tout n'est pas validé — la vraie comptabilité n'est jamais touchée."
        )}
      </p>
      {etatQb === null ? (
        <p className="text-xs text-slate-400">Vérification de la connexion…</p>
      ) : etatQb.erreur ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-bold">⚠️ Impossible de vérifier la connexion QuickBooks</p>
          <p className="mt-0.5 text-[11px]">
            {etatQb.erreur} — ça ne veut PAS dire que QuickBooks est débranché : la vérification elle-même n&apos;a pas
            abouti (session expirée, réseau). Reconnecte-toi ou revérifie.
          </p>
          <button
            onClick={verifierEtatQb}
            disabled={verifQbEnCours}
            className="mt-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 disabled:opacity-50"
          >
            {verifQbEnCours ? "Vérification…" : "🔄 Revérifier"}
          </button>
        </div>
      ) : !etatQb.configure ? (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          🧪 <span className="font-bold">Mode simulé</span> — les clés QuickBooks ne sont pas encore posées sur le
          serveur (variables QB_CLIENT_ID, QB_CLIENT_SECRET et SUPABASE_SERVICE_ROLE_KEY). La synchronisation
          affiche des données de démonstration en attendant.
        </p>
      ) : etatQb.connecte ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          ✅ <span className="font-bold">Connecté</span> — environnement{" "}
          <span className="font-bold">{etatQb.environnement === "production" ? "PRODUCTION" : "Sandbox (test)"}</span>
          {etatQb.realmId ? <> · entreprise nº {etatQb.realmId}</> : null}
          {etatQb.expireLe ? (
            <>
              <br />
              Connexion valide jusqu&apos;au {new Date(etatQb.expireLe).toLocaleDateString("fr-CA")} — elle se
              renouvelle toute seule à chaque synchronisation.
            </>
          ) : null}
          {estAdminPrincipal && (
            <div className="mt-2 border-t border-emerald-200 pt-2">
              <Button
                variant="outline"
                onClick={lancerSyncClients}
                loading={syncClients === "en_cours"}
                loadingText="Synchronisation…"
                className="min-h-0 gap-1.5 px-3 py-1.5 text-xs"
              >
                <RefreshCw size={13} /> Synchroniser les clients vers QuickBooks
              </Button>
              {syncClients && syncClients !== "en_cours" && (
                <p className={`mt-1 text-[11px] font-semibold ${syncClients.erreurs.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {syncClients.fait} client{syncClients.fait > 1 ? "s" : ""} relié{syncClients.fait > 1 ? "s" : ""} ou créé{syncClients.fait > 1 ? "s" : ""}
                  {syncClients.erreurs.length > 0 ? ` · ${syncClients.erreurs.length} problème(s) : ${syncClients.erreurs[0]}` : " — tout le monde y est ✓"}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-emerald-700/70">
                Relie par NOM les clients que QuickBooks connaît déjà (aucun doublon), crée les autres. Les nouvelles
                fiches partent ensuite toutes seules à la création.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            🔌 Les clés sont posées, mais l&apos;entreprise n&apos;est pas encore reliée.
          </p>
          {estAdminPrincipal ? (
            // 🔐 La route exige maintenant le JETON (grand soir 2026-09-04)
            // — on la joint, on reçoit l'adresse Intuit, on s'y rend.
            <button
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const jeton = data?.session?.access_token;
                if (!jeton) return;
                try {
                  const r = await fetch("/api/quickbooks/connexion", { headers: { Authorization: `Bearer ${jeton}` } });
                  const rep = await r.json();
                  if (rep?.url) window.location.href = rep.url;
                  else window.alert(rep?.erreur || "Connexion impossible — réessaie.");
                } catch {
                  window.alert("Réseau indisponible — réessaie.");
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#131B2E] px-4 py-2.5 text-sm font-extrabold text-white active:scale-[0.99]"
            >
              <RefreshCw size={14} /> Connecter QuickBooks
            </button>
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Lock size={12} /> Connexion réservée à l&apos;Admin principal.
            </p>
          )}
          {/* 🧪 SANDBOX (2026-08-31, « sur l'essai je n'ai pas accès au
              sandbox ») : relier un FICHIER DE TEST Intuit — pour une
              entreprise d'essai comme Miroir, jamais pour la vraie
              comptabilité. Exige les clés de développement dans Vercel. */}
          {estAdminPrincipal && (
            <button
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const jeton = data?.session?.access_token;
                if (!jeton) return;
                try {
                  const r = await fetch("/api/quickbooks/connexion?environnement=sandbox", { headers: { Authorization: `Bearer ${jeton}` } });
                  const rep = await r.json();
                  if (rep?.url) window.location.href = rep.url;
                  else window.alert(rep?.erreur || "Connexion impossible — réessaie.");
                } catch {
                  window.alert("Réseau indisponible — réessaie.");
                }
              }}
              className="block text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600"
            >
              🧪 Connecter un fichier de TEST Intuit (Sandbox) — pour une entreprise d&apos;essai seulement
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// 🔢 NUMÉROTATION DES DOCUMENTS (2026-08-31, demande du propriétaire)
// ------------------------------------------------------------
// Une entreprise qui arrive d'un autre système veut CONTINUER sa
// numérotation (reprendre à DEV-4880, pas à DEV-1). Chaque entreprise
// règle SES compteurs (clé composite du snippet 107). On ne RECULE
// jamais : des numéros déjà émis existeraient en double. Les numéros de
// FACTURE ne sont pas ici — c'est QuickBooks qui les attribue (séquence
// comptable officielle).
// ============================================================
function BlocNumerotation({ estAdminPrincipal, ajouterJournal }) {
  const [compteurs, setCompteurs] = useState(null); // null = chargement
  const [saisies, setSaisies] = useState({});
  const [etatCle, setEtatCle] = useState({});
  useEffect(() => {
    listerCompteurs().then(setCompteurs).catch(() => setCompteurs([]));
  }, []);
  const LIGNES = [
    { cle: "devis", libelle: "Prochain numéro de devis", prefixe: "DEV" },
    { cle: "bon_commande", libelle: "Prochain numéro de bon de commande", prefixe: "BC" },
  ];
  const valeurDe = (cle) => Number((compteurs || []).find((c) => c.cle === cle)?.valeur) || 0;
  const appliquer = async (cle, prefixe) => {
    const prochain = Math.floor(Number(saisies[cle]));
    if (!Number.isFinite(prochain) || prochain < 1) return;
    if (prochain <= valeurDe(cle)) {
      setEtatCle((p) => ({
        ...p,
        [cle]: `Impossible de reculer : ${prefixe}-${valeurDe(cle)} est déjà émis — des numéros en double seraient créés.`,
      }));
      return;
    }
    try {
      await reglerProchainNumero(cle, prochain);
      setCompteurs((prev) => {
        const liste = prev || [];
        return liste.some((c) => c.cle === cle)
          ? liste.map((c) => (c.cle === cle ? { ...c, valeur: prochain - 1 } : c))
          : [...liste, { cle, valeur: prochain - 1 }];
      });
      setSaisies((p) => ({ ...p, [cle]: "" }));
      setEtatCle((p) => ({ ...p, [cle]: "ok" }));
      ajouterJournal?.(`🔢 Numérotation réglée : le prochain sera ${prefixe}-${prochain}.`);
    } catch (e) {
      setEtatCle((p) => ({ ...p, [cle]: `Échec — la base répond : « ${e?.message || "connexion impossible"} »` }));
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🔢 Numérotation des documents</p>
      <p className="mt-0.5 text-[10px] text-slate-400">
        Pour continuer la séquence d&apos;un ancien système. Les numéros de FACTURE, eux, viennent de QuickBooks (séquence comptable officielle).
      </p>
      {compteurs === null ? (
        <p className="mt-2 text-xs text-slate-400">Chargement…</p>
      ) : (
        <div className="mt-2 space-y-2">
          {LIGNES.map(({ cle, libelle, prefixe }) => (
            <div key={cle} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">{libelle}</label>
                <p className="text-[10px] text-slate-400">
                  Actuellement, le prochain sera <span className="font-bold text-slate-600">{prefixe}-{valeurDe(cle) + 1}</span>
                </p>
              </div>
              <input
                type="number"
                min="1"
                value={saisies[cle] ?? ""}
                disabled={!estAdminPrincipal}
                onChange={(e) => setSaisies((p) => ({ ...p, [cle]: e.target.value }))}
                placeholder={`Ex : ${valeurDe(cle) + 1}`}
                className="w-[120px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50"
              />
              <Button
                variant="outline"
                disabled={!estAdminPrincipal || !String(saisies[cle] ?? "").trim()}
                onClick={() => appliquer(cle, prefixe)}
                className="min-h-0 px-3 py-1.5 text-xs"
              >
                Appliquer
              </Button>
              {etatCle[cle] === "ok" && <span className="text-[11px] font-bold text-emerald-600">✓ Réglé</span>}
              {etatCle[cle] && etatCle[cle] !== "ok" && (
                <span className="w-full text-[10px] font-semibold text-red-600">{etatCle[cle]}</span>
              )}
            </div>
          ))}
          {!estAdminPrincipal && (
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
              <Lock size={11} /> Réglage réservé à l&apos;Admin principal.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function OngletParametres({ config, onSauvegarder, estAdminPrincipal, ajouterJournal }) {
  const [brouillon, setBrouillon] = useState(config);
  const [ongletActif, setOngletActif] = useState("entreprise");
  const [etat, setEtat] = useState(""); // "" | "enregistrement" | "ok" | "erreur"
  const [messageErreur, setMessageErreur] = useState("");
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [apercuOuvert, setApercuOuvert] = useState(false);

  // Si la configuration arrive (ou change) côté serveur pendant qu'on
  // est sur l'écran sans avoir rien touché, on suit.
  const signatureConfig = JSON.stringify(config);
  useEffect(() => {
    setBrouillon(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureConfig]);

  const modifie = JSON.stringify(brouillon) !== signatureConfig;
  const champ = (cle, valeur) => setBrouillon((p) => ({ ...p, [cle]: valeur }));

  const enregistrer = async () => {
    setConfirmationOuverte(false);
    setEtat("enregistrement");
    setMessageErreur("");
    try {
      await onSauvegarder(brouillon);
      setEtat("ok");
      ajouterJournal(`⚙️ Paramètres de l'entreprise mis à jour (${brouillon.nomLegal})`);
      setTimeout(() => setEtat(""), 2500);
    } catch (e) {
      setEtat("erreur");
      setMessageErreur(e?.message || "");
    }
  };

  // Raccourci pour ne pas répéter les mêmes propriétés à chaque champ.
  // (Le composant `ChampParametre` est défini HORS de cette fonction :
  // s'il était défini ici, React le recréerait à chaque frappe et le
  // curseur sortirait du champ après chaque lettre.)
  const propsChamp = { brouillon, champ, estAdminPrincipal };

  const ONGLETS = [
    { id: "entreprise", label: "Entreprise" },
    { id: "taxes", label: "Taxes & facturation" },
    { id: "paie", label: "Paie & heures" },
    { id: "connexions", label: "Connexions" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Paramètres</h2>

      {!estAdminPrincipal && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
          <Lock size={12} className="shrink-0" /> Consultation seulement — la modification des paramètres est réservée à l'Admin principal.
        </p>
      )}

      {/* Onglets internes */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOngletActif(o.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${
              ongletActif === o.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ---------------- 1. ENTREPRISE ---------------- */}
      {ongletActif === "entreprise" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Identité et coordonnées</p>
            <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
              C'est exactement ce qui s'imprime en haut de tes devis, bons de travail, bons de commande et factures.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ChampParametre {...propsChamp} cle="nomLegal" libelle="Raison sociale" placeholder="Ventilation DGL inc." />
              <ChampParametre {...propsChamp} cle="nomCommercial" libelle="Nom commercial (si différent)" placeholder="— facultatif —" />
              {/* 🖼️ LOGO DE L'ENTREPRISE (2026-09-06 — retour du
                  propriétaire : chaque client met LE SIEN). L'image est
                  réduite et compressée ici même, puis vit dans la fiche
                  de l'entreprise — elle s'imprime en haut des documents
                  et s'affiche dans le menu. */}
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Logo de l&apos;entreprise (documents et menu)</label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {brouillon.logoDonnees ? (
                    <img src={brouillon.logoDonnees} alt="Logo" className="h-12 w-auto max-w-[160px] rounded-lg border border-slate-200 bg-white object-contain p-1" />
                  ) : (
                    <span className="flex h-12 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">aucun logo</span>
                  )}
                  {estAdminPrincipal && (
                    <>
                      <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                        {brouillon.logoDonnees ? "Changer…" : "Téléverser…"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (ev) => {
                            const fichier = ev.target.files?.[0];
                            ev.target.value = "";
                            if (!fichier) return;
                            try {
                              const lu = await new Promise((res, rej) => {
                                const l = new FileReader();
                                l.onload = () => res(l.result);
                                l.onerror = rej;
                                l.readAsDataURL(fichier);
                              });
                              const img = await new Promise((res, rej) => {
                                const i = new Image();
                                i.onload = () => res(i);
                                i.onerror = rej;
                                i.src = lu;
                              });
                              // Réduction : 320 px max de large / 160 de
                              // haut — bien assez pour l'impression des
                              // en-têtes, minuscule en base.
                              const echelle = Math.min(1, 320 / img.width, 160 / img.height);
                              const canevas = document.createElement("canvas");
                              canevas.width = Math.round(img.width * echelle);
                              canevas.height = Math.round(img.height * echelle);
                              canevas.getContext("2d").drawImage(img, 0, 0, canevas.width, canevas.height);
                              // PNG pour garder la transparence des logos.
                              champ("logoDonnees", canevas.toDataURL("image/png"));
                            } catch {
                              window.alert("Image illisible — essaie un PNG ou un JPG.");
                            }
                          }}
                        />
                      </label>
                      {brouillon.logoDonnees && (
                        <button onClick={() => champ("logoDonnees", "")} className="text-[11px] font-bold text-red-500 underline underline-offset-2">
                          Retirer
                        </button>
                      )}
                    </>
                  )}
                  <p className="w-full text-[9px] text-slate-400 sm:w-auto sm:flex-1">PNG (fond transparent idéal) ou JPG — réduit automatiquement. N&apos;oublie pas « Enregistrer les paramètres ».</p>
                </div>
              </div>
              <div className="sm:col-span-2">
                <ChampParametre {...propsChamp} cle="adresse" libelle="Adresse complète" placeholder="771 Boul Industriel, Blainville QC J7C 3V3" />
              </div>
              <ChampParametre {...propsChamp} cle="telephone" libelle="Téléphone" placeholder="(450) 543-9855" />
              <ChampParametre {...propsChamp} cle="telephoneUrgence" libelle="Téléphone d'urgence" placeholder="— facultatif —" />
              <ChampParametre {...propsChamp} cle="courriel" libelle="Courriel général" placeholder="info@…" />
              <ChampParametre {...propsChamp} cle="courrielFacturation" libelle="Courriel de facturation" aide="Utilisé pour les envois liés à la facturation." placeholder="— facultatif —" />
              <div className="sm:col-span-2">
                <ChampParametre {...propsChamp} cle="siteWeb" libelle="Site web" placeholder="— facultatif —" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Numéros officiels</p>
            <p className="mt-0.5 mb-3 text-[11px] text-slate-400">Laisse un champ vide s'il ne s'applique pas — la ligne disparaît alors des documents.</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ChampParametre {...propsChamp} cle="numeroTps" libelle="Nº d'inscription TPS/TVH" placeholder="000000000 RT0001" />
              <ChampParametre {...propsChamp} cle="numeroTvq" libelle="Nº d'enregistrement TVQ" placeholder="0000000000 TQ0001" />
              <ChampParametre {...propsChamp} cle="numeroRbq" libelle="Licence RBQ" placeholder="0000-0000-00" />
              <ChampParametre {...propsChamp} cle="numeroNeq" libelle="NEQ (registre des entreprises)" placeholder="— facultatif —" />
            </div>
            {/* ASSOCIATIONS PROFESSIONNELLES — à la carte : chaque
                entreprise coche les SIENNES (une entreprise peut être
                membre de plusieurs). Affichées sur devis, bons, factures. */}
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Associations professionnelles (affichées sur les documents)</label>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {[["cmmtq", "CMMTQ", "Maîtres mécaniciens en tuyauterie"], ["cetaf", "CETAF", "Traitement de l'air et du froid"], ["cmeq", "CMEQ", "Maîtres électriciens"]].map(([id, sigle, nomLong]) => {
                  const liste = Array.isArray(brouillon.associations) ? brouillon.associations : ["cmmtq"];
                  const coche = liste.includes(id);
                  return (
                    <label key={id} className={`flex items-start gap-2 rounded-xl border p-2.5 ${coche ? "border-emerald-200 bg-emerald-50" : estAdminPrincipal ? "border-slate-200" : "border-slate-100 bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={!estAdminPrincipal}
                        onChange={() => champ("associations", coche ? liste.filter((x) => x !== id) : [...liste, id])}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <span className="text-[11px] leading-snug text-slate-600">
                        <span className="font-bold text-slate-800">{sigle}</span>
                        <br />{nomLong}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* (L'ancienne carte « Logo » — fichier /public/logo-dgl.png — a
              été remplacée par le téléversement dans « Identité et
              coordonnées » : chaque entreprise met LE SIEN, 2026-09-06.) */}
        </div>
      )}

      {/* ---------------- 2. TAXES & FACTURATION ---------------- */}
      {ongletActif === "taxes" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Taux de taxes</p>
            <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
              Appliqués partout : devis, factures, dépôts. Écris le pourcentage (ex. <span className="font-bold">9.975</span> pour 9,975 %).
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ChampParametre {...propsChamp} cle="tauxTps" libelle="TPS / TVH" type="number" pas="0.001" unite="%" />
              <ChampParametre {...propsChamp} cle="tauxTvq" libelle="TVQ" type="number" pas="0.001" unite="%" aide="Mets 0 si ta province n'a pas de taxe provinciale distincte." />
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
              Exemple sur <span className="font-bold">1 000,00 $</span> avant taxes :
              <span className="ml-1 tabular-nums">
                TPS {calculerTaxes(1000, brouillon).tps.toFixed(2)} $ · TVQ {calculerTaxes(1000, brouillon).tvq.toFixed(2)} $ ·
                <span className="font-bold"> total {calculerTaxes(1000, brouillon).total.toFixed(2)} $</span>
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Facturation</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <ChampParametre {...propsChamp} cle="termePaiementDefaut" libelle="Terme de paiement par défaut" placeholder="Net 30" />
            </div>
            <div className="mt-2.5">
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                Note et modalités de paiement (chèque, virement Interac…)
              </label>
              <textarea
                rows={4}
                value={brouillon.noteFacture ?? ""}
                disabled={!estAdminPrincipal}
                placeholder={"Ex. :\nChèque à l'ordre de Ventilation DGL inc. — 771 rue Exemple, Blainville.\nVirement Interac : paiements@ventilationdgl.com (réponse : dgl2026).\nIntérêt de 1,5 % par mois sur tout solde en souffrance."}
                onChange={(e) => champ("noteFacture", e.target.value)}
                className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none disabled:text-slate-400 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}
              />
              <p className="mt-0.5 text-[9px] leading-snug text-slate-400">
                Ce texte part sur les factures QuickBooks (message au client) et dans les courriels de demande de
                paiement. 💡 Conseil : active le <span className="font-bold">dépôt automatique Interac</span> à ta
                banque — plus besoin de partager une question/réponse.
              </p>
            </div>
          </div>

          {/* 💳 PAIEMENTS EN LIGNE (QuickBooks Payments)
              ------------------------------------------------------------
              APPELS DE SERVICE seulement — le chemin automatique. Les
              autres factures demanderont un choix À L'ENVOI (règle du
              propriétaire, chantier QuickBooks). Défaut : tout éteint.
              Les frais (≈2,9 % carte / ≈1 % virement) sont un coût du
              MARCHAND — au Québec (LPC), jamais ajoutés au client. */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">💳 Paiements en ligne — appels de service</p>
            <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
              Boutons « Payer en ligne » sur les factures de dépôt QuickBooks. Les frais par transaction sont à ta charge
              (jamais ajoutés au client — loi québécoise) : c'est pour ça que la carte se coupe toute seule au-dessus du seuil.
              Les autres types de factures demanderont ton choix à chaque envoi.
            </p>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${brouillon.paiementCarteAppels ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
                <input
                  type="checkbox"
                  checked={!!brouillon.paiementCarteAppels}
                  disabled={!estAdminPrincipal}
                  onChange={(e) => champ("paiementCarteAppels", e.target.checked)}
                  className="h-4 w-4 accent-[#131B2E]"
                />
                Carte de crédit (frais ≈ 2,9 % + 0,25 $ — à ta charge)
              </label>
              <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${brouillon.paiementVirementAppels ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
                <input
                  type="checkbox"
                  checked={!!brouillon.paiementVirementAppels}
                  disabled={!estAdminPrincipal}
                  onChange={(e) => champ("paiementVirementAppels", e.target.checked)}
                  className="h-4 w-4 accent-[#131B2E]"
                />
                Virement bancaire (frais ≈ 1 % — à ta charge)
              </label>
              <ChampParametre
                {...propsChamp}
                cle="seuilCarteAppels"
                libelle="Carte désactivée au-dessus de"
                type="number"
                pas="100"
                unite="$ HT"
                aide="Garde-fou du chemin automatique : au-dessus de ce montant, la carte s'éteint toute seule même si elle est activée — 2,9 % sur un gros dépôt, ça ne vaut pas la rapidité. Le virement (1 %) n'a pas de seuil."
              />
            </div>
          </div>
          <BlocNumerotation estAdminPrincipal={estAdminPrincipal} ajouterJournal={ajouterJournal} />
        </div>
      )}

      {/* ---------------- 3. PAIE & HEURES ---------------- */}
      {ongletActif === "paie" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Règles de calcul des heures</p>
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
            Ces règles pilotent l'onglet « Heures de la semaine » et l'app technicien.
          </p>
          {/* 🚗 TRANSPORT DEBUT/FIN DE JOURNEE (2026-09-05) — certaines
              compagnies vont directement au chantier : pas de transport
              paye. Derogation possible par employe (sa fiche). */}
          <label className="mb-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={brouillon.transportQuotidienPaye !== false}
              onChange={(e) => champ("transportQuotidienPaye", e.target.checked)}
              disabled={!estAdminPrincipal}
              className="mt-0.5 h-4 w-4 accent-[#131B2E]"
            />
            <span>
              🚗 Transport payé en début et fin de journée
              <span className="block text-[10px] font-normal leading-snug text-slate-400">
                Coché : l'agenda et le téléphone fabriquent les blocs « Transport — Début/Fin de journée » (payés). Décoché : les
                équipes partent de chez elles vers le chantier — aucun bloc, aucune heure de transport. Dérogation possible employé
                par employé (sa fiche, section terrain). Le transport journalier entre deux clients reste toujours payé.
              </span>
            </span>
          </label>
          {/* 📅 CALENDRIER CCQ (2026-08-31) — EN OPTION : bon pour les
              compagnies de construction seulement. Coché : fériés et
              vacances de la construction MARQUÉS dans l'agenda (pour ne
              pas céduler dessus par erreur) + case « sauter les jours
              fériés » à la création d'horaire. */}
          <label className="mb-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={brouillon.calendrierCcq === true}
              onChange={(e) => champ("calendrierCcq", e.target.checked)}
              disabled={!estAdminPrincipal}
              className="mt-0.5 h-4 w-4 accent-[#131B2E]"
            />
            <span>
              📅 Suivre le calendrier de la construction (CCQ)
              <span className="block text-[10px] font-normal leading-snug text-slate-400">
                Pour les compagnies de construction. Coché : les jours fériés chômés et les vacances de la construction
                (2 semaines l'été, 2 l'hiver) apparaissent automatiquement dans l'agenda — impossible de les oublier en
                cédulant — et l'horaire d'une tâche peut « sauter les jours fériés » comme il saute déjà les fins de
                semaine. Les dates se calculent toutes seules, année après année. Rien n'est bloqué : l'agenda marque,
                tu décides.
              </span>
            </span>
          </label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ChampParametre
              {...propsChamp}
              cle="seuilHeuresSupp"
              libelle="Seuil des heures supplémentaires"
              type="number"
              pas="0.5"
              unite="h/sem."
              aide="Au-delà : heures supplémentaires (taux et demi). Normes du Québec : 40 h."
            />
            <ChampParametre
              {...propsChamp}
              cle="minutesDiner"
              libelle="Dîner non payé"
              type="number"
              pas="5"
              unite="min"
              aide="Déduit quand le technicien coche « Lunch » à son transport de fin de journée."
            />
            <ChampParametre
              {...propsChamp}
              cle="heureBasculeNuit"
              libelle="Heure de bascule « Nuit »"
              type="number"
              pas="1"
              unite="h"
              aide="Du lundi au vendredi, si la 1re intervention démarre à cette heure ou plus tard, toute la journée est classée Nuit. Samedi/dimanche a toujours priorité."
            />
            <ChampParametre
              {...propsChamp}
              cle="seuilMargeAlerte"
              libelle="Seuil d'alerte de marge"
              type="number"
              pas="1"
              unite="%"
              aide="Dans l'analyse de rentabilité (tuile « Marge moyenne » du tableau de bord), toute marge SOUS ce pourcentage s'affiche en rouge — jobs, clients, devis. Mets-y ta marge minimum acceptable."
            />
            {/* 📸 ENVOI AUTOMATIQUE DU BON AU CLIENT — quand le
                technicien ferme la tâche, le descriptif public (photos,
                jamais de prix) part tout seul aux courriels cochés. */}
            <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${brouillon.envoiAutoBonClient !== false ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
              <input
                type="checkbox"
                checked={brouillon.envoiAutoBonClient !== false}
                disabled={!estAdminPrincipal}
                onChange={(e) => champ("envoiAutoBonClient", e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#131B2E]"
              />
              <span>
                📸 Envoi automatique du bon au client à la fermeture
                <span className="block text-[10px] font-normal text-slate-500">
                  Le client reçoit sur-le-champ le descriptif avec photos (lien 90 jours, jamais de prix) aux courriels cochés par le technicien sur place. Décoché : seul le bouton « Bon au client » du bureau envoie.
                </span>
              </span>
            </label>
            {/* 🧾 ENVOI AUTOMATIQUE DES FACTURES — le même réglage que la
                console plateforme : chaque entreprise décide. */}
            <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${brouillon.envoiAutoFactureQb === true ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
              <input
                type="checkbox"
                checked={brouillon.envoiAutoFactureQb === true}
                disabled={!estAdminPrincipal}
                onChange={(e) => champ("envoiAutoFactureQb", e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#131B2E]"
              />
              <span>
                🧾 Envoi automatique des factures par QuickBooks
                <span className="block text-[10px] font-normal text-slate-500">
                  Activé : chaque facture créée (appels, devis, contrats, dépôts, pièces) part immédiatement par QuickBooks aux courriels choisis, avec preuve au registre. Décoché : la facture est créée dans QuickBooks SANS partir — bouton « Envoyer par QuickBooks » sur chaque ligne quand tu es prêt.
                </span>
              </span>
            </label>
            {/* ANNÉE FISCALE — un jalon "mois + jour". L'analyse de
                rentabilité offre « Année fiscale » calculée date à date
                depuis ce jalon : les mêmes bornes que le comptable. */}
            {(() => {
              const [moisF, jourF] = String(brouillon.debutAnneeFiscale || "01-01").split("-").map((x) => parseInt(x, 10));
              const majFiscal = (m, j) =>
                champ("debutAnneeFiscale", `${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`);
              const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
              return (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Début de l'année fiscale</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={jourF || 1}
                      disabled={!estAdminPrincipal}
                      onChange={(e) => majFiscal(moisF || 1, Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      className={`w-16 rounded-lg border px-2 py-1.5 text-xs ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                    />
                    <select
                      value={moisF || 1}
                      disabled={!estAdminPrincipal}
                      onChange={(e) => majFiscal(Number(e.target.value), jourF || 1)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                    >
                      {MOIS.map((nom, i) => (
                        <option key={nom} value={i + 1}>{nom}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-0.5 text-[9px] leading-snug text-slate-400">
                    Ex. : année fiscale du 1er novembre au 31 octobre → inscris 1 novembre. L'analyse de rentabilité offrira « Année fiscale en cours » et « précédente », date à date — les mêmes bornes que ton comptable.
                  </p>
                </div>
              );
            })()}
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Premier jour de la semaine de paie</label>
              <select
                value={brouillon.premierJourSemaine ?? 0}
                disabled={!estAdminPrincipal}
                onChange={(e) => champ("premierJourSemaine", Number(e.target.value))}
                className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none disabled:text-slate-400 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}
              >
                <option value={0}>Dimanche</option>
                <option value={1}>Lundi</option>
              </select>
              <p className="mt-0.5 text-[9px] leading-snug text-slate-400">
                Actuellement, la compilation est bâtie dimanche → samedi. Changer ce choix demande un ajustement du tableau — à faire lors du passage multi-entreprises.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. CONNEXIONS ---------------- */}
      {ongletActif === "connexions" && (
        <div className="space-y-3">
          <CarteConnexionQuickbooks estAdminPrincipal={estAdminPrincipal} />

          {/* 📅 DATE-PLANCHER (2026-08-28, snippet SQL 81) — l'historique
              d'avant Fluxya reste dans QuickBooks : sans coûts en face,
              l'importer fabriquerait des marges fausses et des centaines
              de cartes « à rattacher ». Modifiable en tout temps. */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">📅 Historique lu dans QuickBooks</p>
            <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
              Les factures et dépenses d&apos;AVANT cette date restent dans QuickBooks — elles n&apos;apparaissent ni
              dans les listes à rattacher ni dans les marges. Mets la date où vous avez commencé à travailler pour
              vrai dans Fluxya. Tu peux la reculer plus tard si tu veux remonter plus loin.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">Ne rien lire avant le</label>
              <input
                type="date"
                value={brouillon.qbLectureDepuis || ""}
                onChange={(e) => champ("qbLectureDepuis", e.target.value)}
                disabled={!estAdminPrincipal}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none disabled:bg-slate-50 disabled:text-slate-400"
              />
              {brouillon.qbLectureDepuis && estAdminPrincipal && (
                <button
                  onClick={() => champ("qbLectureDepuis", "")}
                  className="text-[10px] font-semibold text-slate-400 underline"
                >
                  Effacer (revenir aux 12 derniers mois)
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              Sans date : l&apos;application lit les 12 derniers mois (le maximum). La date ne peut que resserrer cette
              fenêtre. N&apos;oublie pas « 💾 Enregistrer les paramètres » en bas.
            </p>
            {/* 📦 FILTRE PAR BC (2026-08-31, demande du propriétaire :
                « une compagnie qui a 200 transactions par mois autres que
                des matériaux va passer son temps à faire ça pour rien »). */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${brouillon.achatsSeulementBc ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
                <input
                  type="checkbox"
                  checked={!!brouillon.achatsSeulementBc}
                  disabled={!estAdminPrincipal}
                  onChange={(e) => champ("achatsSeulementBc", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#131B2E]"
                />
                <span>
                  📦 Ne remonter que les dépenses portant un Nº de bon de commande
                  <span className="mt-0.5 block text-[10px] font-normal leading-snug text-slate-500">
                    Les dépenses SANS Nº de BC (assurances, paiements d&apos;auto, frais bancaires…) restent dans QuickBooks — la liste
                    « à rattacher » ne montre plus que le matériel des chantiers. ⚠️ Le revers : un achat de matériel dont le Nº de BC a
                    été oublié ne sera pas vu — la discipline du « Nº de référence » devient la règle.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'action — visible sur les trois onglets */}
      {estAdminPrincipal && (
        <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
          <Button
            onClick={() => setConfirmationOuverte(true)}
            disabled={!modifie}
            loading={etat === "enregistrement"}
            className="min-h-0 px-4 py-2 text-xs"
          >
            💾 Enregistrer les paramètres
          </Button>
          <Button variant="outline" onClick={() => setApercuOuvert(true)} className="min-h-0 px-3 py-2 text-xs">
            👁️ Voir l'en-tête des documents
          </Button>
          {modifie && etat !== "ok" && (
            <span className="text-[11px] font-semibold text-amber-600">Modifications non enregistrées</span>
          )}
          {etat === "ok" && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={13} /> Enregistré</span>
          )}
          {etat === "erreur" && (
            <span className="text-[11px] font-bold text-red-600">
              Échec — vérifie que le SQL « 23 » a été lancé, puis réessaie. {messageErreur}
            </span>
          )}
        </div>
      )}

      {/* APERÇU EN DIRECT — l'en-tête tel qu'il sortira, avec le brouillon */}
      {apercuOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setApercuOuvert(false))(); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-sm font-extrabold text-slate-500">Aperçu — en-tête des documents</h3>
              <button onClick={() => setApercuOuvert(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              {/* On passe le BROUILLON : tu vois le résultat avant même d'enregistrer. */}
              <EnTeteEntreprise config={brouillon} />
              <p className="mt-3 text-lg font-extrabold text-[#131B2E]">DEVIS DEV-3500</p>
              <p className="text-xs text-slate-500">Exemple — sous-total 1 000,00 $</p>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">1 000,00 $</span></div>
                <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(brouillon.tauxTps)}%)</span><span className="tabular-nums">{calculerTaxes(1000, brouillon).tps.toFixed(2)} $</span></div>
                <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(brouillon.tauxTvq)}%)</span><span className="tabular-nums">{calculerTaxes(1000, brouillon).tvq.toFixed(2)} $</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
                  <span>Total</span><span className="tabular-nums">{calculerTaxes(1000, brouillon).total.toFixed(2)} $</span>
                </div>
              </div>
              <PiedDocument config={brouillon} />
            </div>
            {modifie && (
              <p className="mt-2 text-[11px] font-semibold text-amber-600">
                Cet aperçu montre tes modifications en cours — elles ne seront réelles qu'une fois enregistrées.
              </p>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION avant d'écrire */}
      {confirmationOuverte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setConfirmationOuverte(false))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={18} className="text-amber-600" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Enregistrer les paramètres ?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Ces informations apparaissent sur <span className="font-bold">les documents envoyés aux clients</span> et
                  entrent dans <span className="font-bold">les calculs de taxes et de paie</span>. Les documents déjà émis
                  ne changent pas ; les nouveaux utiliseront ces valeurs.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmationOuverte(false)} className="min-h-0 py-2 text-xs">Annuler</Button>
              <Button onClick={enregistrer} className="min-h-0 py-2 text-xs">Confirmer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// EN-TÊTE D'ENTREPRISE — coordonnées officielles affichées sur tous
// les documents envoyés au client (devis, bons de travail/commande).
// ------------------------------------------------------------
// LOGO CMMTQ : fichier officiel fourni par l'utilisateur (membre
// CMMTQ), placé dans /public/logo-cmmtq.png. Le fond blanc a été
// rendu transparent pour une intégration propre sur fond blanc comme
// coloré. Si le fichier venait à changer (ex. mise à jour du logo par
// la CMMTQ), il suffit de remplacer /public/logo-cmmtq.png par le
// nouveau fichier — aucun changement de code nécessaire.
// ============================================================
export function EnTeteEntreprise({ compact, config }) {
  // `config` permet de forcer une configuration (aperçu en direct dans
  // les Paramètres) ; sinon on prend celle de l'entreprise connectée.
  const ctx = useEntreprise();
  const e = config || ctx;
  return (
    <div className={`border-b border-slate-200 ${compact ? "pb-2" : "pb-3"}`}>
      {/* LOGO DE L'ENTREPRISE + raison sociale. Chaque entreprise
          téléverse LE SIEN (Paramètres → Entreprise) ; le fichier
          /public/logo-dgl.png ne sert plus qu'à DGL, en repli — un
          nouveau client sans logo n'affiche rien (2026-09-06). */}
      <div className="flex items-center gap-2.5">
        {(() => {
          const logo = e.logoDonnees || (e.statutPlateforme === "proprietaire" || !e.statutPlateforme ? "/logo-dgl.png" : null);
          return logo ? (
            <img
              src={logo}
              alt={e.nomLegal}
              className={`${compact ? "h-8" : "h-11"} w-auto shrink-0`}
              onError={(ev) => { ev.currentTarget.style.display = "none"; }}
            />
          ) : null;
        })()}
        <p className="text-sm font-extrabold text-[#131B2E]">{e.nomLegal}</p>
      </div>
      <div className={`mt-1.5 grid ${compact ? "grid-cols-1" : "grid-cols-2"} gap-x-4 gap-y-0.5 text-[10px] text-slate-500`}>
        {e.adresse ? <p>{e.adresse}</p> : null}
        {(e.telephone || e.courriel) ? <p>{[e.telephone, e.courriel].filter(Boolean).join(" · ")}</p> : null}
        {e.numeroTps ? <p>Nº d'inscription TPS/TVH : {e.numeroTps}</p> : null}
        {e.numeroTvq ? <p>Nº d'enregistrement TVQ : {e.numeroTvq}</p> : null}
        {e.numeroRbq ? <p>RBQ# {e.numeroRbq}</p> : null}
        {/* NEQ (2026-08-28) : le champ existait dans les Paramètres et se
            sauvegardait, mais n'était affiché NULLE PART. */}
        {e.numeroNeq ? <p>NEQ {e.numeroNeq}</p> : null}
        {e.membreCmmtq ? (
          <div className="flex items-center gap-1.5">
            {/* Le logo officiel (fourni par l'utilisateur, fond rendu
                transparent) inclut déjà le mot-symbole "CMMTQ" — on ne
                répète donc pas le nom en toutes lettres à côté, pour
                éviter la redondance. Hauteur alignée sur le reste du
                texte de l'en-tête (10px) plutôt que dominer visuellement. */}
            <span>Membre de la</span>
            <img
              src="/logo-cmmtq.png"
              alt="CMMTQ"
              className="h-3.5 w-auto align-middle"
              onError={(ev) => { ev.currentTarget.style.display = "none"; }}
            />
          </div>
        ) : null}
        {(e.associations || []).includes("cetaf") ? <p>Membre de la CETAF</p> : null}
        {(e.associations || []).includes("cmeq") ? <p>Membre de la CMEQ</p> : null}
      </div>
    </div>
  );
}

// ============================================================
// ADRESSES SUR UN DOCUMENT CLIENT
// ------------------------------------------------------------
// Deux adresses, deux rôles différents :
//   • FACTURÉ À  — où part la facture (siège social, comptabilité)
//   • TRAVAUX    — où l'équipe se rend
//
// Elles sont souvent différentes (un entrepreneur général facturé à
// Laval pour un chantier à Mirabel), et aucune n'apparaissait sur les
// devis, bons de travail ni factures. Un document sans adresse de
// facturation se fait retourner par la comptabilité du client.
//
// L'adresse des travaux ne s'affiche que si elle diffère : la répéter
// deux fois n'ajoute rien et allonge le document.

// Bas de page des documents — même raison sociale que l'en-tête.
export function PiedDocument({ config }) {
  const ctx = useEntreprise();
  const e = config || ctx;
  return (
    <p className="mt-3 text-center text-[10px] text-slate-400">
      © {new Date().getFullYear()} {e.nomLegal} — Tous droits réservés.
    </p>
  );
}

