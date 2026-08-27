"use client";

// app/plateforme/page.jsx
//
// LA PLATEFORME — 3e interface, SÉPARÉE de l'admin DGL (décision du
// propriétaire) : gérer les ENTREPRISES clientes du logiciel sans
// jamais toucher à leur contenu. Un futur employé du logiciel aura le
// sceau « plateforme » sans aucun compte DGL ; les employés DGL, eux,
// ne voient même pas cette porte.
//
// SÉCURITÉ D'ACCÈS : le sceau vit dans app_metadata — la zone du compte
// que SEUL le serveur écrit (snippet SQL 51). Pas de sceau = écran de
// refus, même connecté. Ventilation DGL est structurellement une
// entreprise cliente comme les autres (la première).
//
// VERROU D'ISOLATION : tant que le « grand soir » (RLS multi-locataires
// + test-sonde d'étanchéité) n'est pas passé, la création d'entreprises
// est REFUSÉE — créer un 2e locataire avant les cloisons exposerait les
// données de DGL. Le drapeau se bascule en base, jamais d'ici.

import { useEffect, useState } from "react";
import { Building2, Lock, LogOut, Plus, ShieldAlert, Download, Pause, Play, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { seConnecterSurveille } from "@/lib/connexionSurveillee";
import {
  listerEntreprisesPlateforme,
  majEntreprisePlateforme,
  verrouIsolation,
  listerIncidents,
  creerIncident,
  exporterEntreprise,
  listerSiegesPlateforme,
  NIVEAUX_PLATEFORME,
  niveauPlateformeDe,
  listerOperateurs,
  gererOperateur,
} from "@/lib/supabase/plateforme";
import { listerRetoursTransmis, majRetour, sAbonnerRetours, LIBELLES_STATUT_RETOUR } from "@/lib/supabase/retours";

// 🧩 MODULES À LA CARTE — ce qu'une entreprise reçoit dans son forfait.
// Décision du propriétaire (2026-08-15) : les besoins diffèrent selon le
// domaine (un peintre n'a pas besoin des inspections de camions). Cocher
// = inclus. « Tous » (défaut) = l'entreprise voit tout.
const MODULES_CATALOGUE = [
  ["tableau-de-bord", "Tableau de bord"],
  ["recherche", "Recherche"],
  ["clients", "Clients"],
  ["projets", "Projets"],
  ["devis", "Devis"],
  ["agenda", "Agenda"],
  ["facturation", "Facturation"],
  ["inspections", "Véhicules / Inspections"],
  ["pieces", "Pièces en commande"],
  ["paies", "Heures de la semaine"],
  ["tarifs", "Tarifs"],
  ["parametres", "Paramètres"],
  ["utilisateurs", "Utilisateurs"],
  ["technicien", "App technicien (mobile)"],
];

const STATUTS = {
  proprietaire: { label: "Propriétaire", cls: "bg-slate-900 text-white" },
  fondateur: { label: "Pionnier", cls: "bg-amber-100 text-amber-800" },
  essai: { label: "Essai", cls: "bg-blue-100 text-blue-700" },
  payant: { label: "Payant", cls: "bg-emerald-100 text-emerald-700" },
};

function Bouton({ variant = "primary", className = "", children, ...props }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold min-h-[40px] px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles = {
    primary: "bg-[#131B2E] text-white hover:bg-slate-700",
    outline: "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Jours restants avant une date "AAAA-MM-JJ" (heure locale, règle gelée).
function joursAvant(dateStr) {
  if (!dateStr) return null;
  const cible = new Date(`${dateStr}T00:00:00`);
  const n = new Date();
  const aujourdhui = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((cible - aujourdhui) / 86400000);
}

export default function Plateforme() {
  const [session, setSession] = useState(null);
  const [authVerifie, setAuthVerifie] = useState(false);
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurConnexion, setErreurConnexion] = useState("");
  const [connexionEnCours, setConnexionEnCours] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setAuthVerifie(true);
    });
    const { data: ecouteur } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => ecouteur?.subscription?.unsubscribe();
  }, []);

  const connecter = async (e) => {
    e.preventDefault();
    setConnexionEnCours(true);
    setErreurConnexion("");
    const r = await seConnecterSurveille(courriel.trim(), motDePasse);
    setConnexionEnCours(false);
    if (r.verrouille) setErreurConnexion(`🔒 Compte verrouillé après 3 essais — réessaie dans ${r.minutes || 15} min, ou réinitialise ton mot de passe depuis /admin.`);
    else if (!r.ok) setErreurConnexion(r.erreur || "Courriel ou mot de passe refusé.");
  };

  // LE SCEAU — app_metadata, scellé côté serveur (snippet 51). Un compte
  // admin DGL ordinaire, même Admin principal, est refusé ici.
  const sceau = session?.user?.app_metadata?.plateforme === true;

  if (!authVerifie) {
    return <div className="flex min-h-screen items-center justify-center bg-[#131B2E] text-sm text-white/70">Chargement…</div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#131B2E] p-4">
        <form onSubmit={connecter} className="w-full max-w-sm rounded-2xl bg-white p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#131B2E]"><Building2 size={20} className="text-orange-400" /></span>
            <div>
              <h1 className="text-base font-extrabold text-slate-900">Plateforme</h1>
              <p className="text-[11px] text-slate-400">Gestion des entreprises clientes — accès restreint</p>
            </div>
          </div>
          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Courriel</label>
          <input value={courriel} onChange={(e) => setCourriel(e.target.value)} type="email" autoComplete="username"
            className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Mot de passe</label>
          <input value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} type="password" autoComplete="current-password"
            className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          {erreurConnexion && <p className="mb-3 text-xs font-bold text-red-600">{erreurConnexion}</p>}
          <Bouton type="submit" disabled={connexionEnCours || !courriel || !motDePasse} className="w-full">
            {connexionEnCours ? "Connexion…" : "Entrer"}
          </Bouton>
        </form>
      </div>
    );
  }

  if (!sceau) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#131B2E] p-6 text-center">
        <ShieldAlert size={40} className="text-orange-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">Accès réservé</h1>
          <p className="mt-1 max-w-sm text-sm text-white/60">
            Cette interface gère les entreprises clientes du logiciel. Ton compte ({session.user.email}) ne porte pas
            le sceau plateforme — il se donne côté serveur seulement.
          </p>
        </div>
        <Bouton variant="outline" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Se déconnecter</Bouton>
      </div>
    );
  }

  return <TableauPlateforme session={session} />;
}

function TableauPlateforme({ session }) {
  // 👥 NIVEAU DE L'OPÉRATEUR (2026-09-02) — décide ce que la console
  // montre : clé principale = tout ; admin régulier = abonnements +
  // retours + incidents ; gestionnaire = retours + incidents (abonnements
  // en lecture) ; technicien de support = retours seulement.
  const niveau = niveauPlateformeDe(session) || "technicien";
  const clePrincipale = niveau === "cle-principale";
  const peutModifierAbonnements = clePrincipale || niveau === "admin-regulier";
  const voitEntreprises = niveau !== "technicien";
  const [onglet, setOnglet] = useState(voitEntreprises ? "entreprises" : "retours");
  const [entreprises, setEntreprises] = useState([]);
  const [isolationOk, setIsolationOk] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [retours, setRetours] = useState([]);
  const [message, setMessage] = useState("");

  const charger = () => {
    if (voitEntreprises) {
      listerEntreprisesPlateforme().then(setEntreprises).catch(() => setMessage("Registre illisible — le snippet 51 est-il passé ?"));
      verrouIsolation().then(setIsolationOk).catch(() => {});
      listerIncidents().then(setIncidents).catch(() => {});
    }
    listerRetoursTransmis().then(setRetours).catch(() => {});
  };
  useEffect(() => {
    charger();
    const off = sAbonnerRetours(() => listerRetoursTransmis().then(setRetours).catch(() => {}));
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exporter = async (e) => {
    setMessage(`Export de ${e.nom} en cours…`);
    try {
      const donnees = await exporterEntreprise(e.id);
      const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${e.id}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`✓ Export de ${e.nom} téléchargé — remets-le à l'entreprise (ses données lui appartiennent).`);
    } catch {
      setMessage("⚠️ Export échoué — réessaie.");
    }
  };

  const basculerSuspension = async (e) => {
    const suspendre = !e.suspendue;
    if (suspendre && !window.confirm(`Suspendre « ${e.nom} » ? Ses données restent intactes ; seul l'accès sera coupé (au grand soir).`)) return;
    setEntreprises((prev) => prev.map((x) => (x.id === e.id ? { ...x, suspendue: suspendre } : x)));
    await majEntreprisePlateforme(e.id, { suspendue: suspendre }).catch(() => charger());
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-[#131B2E] px-4 py-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Building2 size={18} className="text-orange-400" /></span>
          <div>
            <h1 className="text-sm font-extrabold text-white">Plateforme — entreprises clientes</h1>
            <p className="text-[10px] text-white/50">
              {session.user.email} · {(NIVEAUX_PLATEFORME.find(([id]) => id === niveau) || [])[1] || "sceau plateforme ✓"}
            </p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10">
          <LogOut size={14} /> Quitter
        </button>
      </header>

      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          {[
            ...(voitEntreprises ? [["entreprises", "🏢 Entreprises"]] : []),
            ...(peutModifierAbonnements ? [["facturation", "💰 Facturation"]] : []),
            ["retours", `💬 Retours${retours.filter((r) => r.statut === "transmis").length > 0 ? ` (${retours.filter((r) => r.statut === "transmis").length})` : ""}`],
            ...(voitEntreprises ? [["incidents", "🔐 Incidents (Loi 25)"]] : []),
            ...(clePrincipale ? [["equipe", "👥 Équipe"]] : []),
          ].map(([id, label]) => (
            <button key={id} onClick={() => setOnglet(id)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-extrabold ${onglet === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>

        {message && <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">{message}</p>}

        {onglet === "entreprises" && voitEntreprises && (
          <SectionEntreprises
            entreprises={entreprises}
            isolationOk={isolationOk}
            peutModifier={peutModifierAbonnements}
            gestesLourds={clePrincipale}
            onExporter={exporter}
            onBasculerSuspension={basculerSuspension}
            onMaj={async (id, champs) => {
              setEntreprises((prev) => prev.map((x) => (x.id === id ? { ...x, ...champs } : x)));
              const bd = {};
              if (champs.statut) bd.statut_plateforme = champs.statut;
              if ("gratuitJusqua" in champs) bd.gratuit_jusqua = champs.gratuitJusqua || null;
              if ("modules" in champs) bd.modules = champs.modules;
              if ("prixBase" in champs) bd.prix_base = champs.prixBase === "" ? null : Number(champs.prixBase);
              if ("siegesInclus" in champs) bd.sieges_inclus = Number(champs.siegesInclus) || 4;
              if ("prixParSiege" in champs) bd.prix_par_siege = champs.prixParSiege === "" ? null : Number(champs.prixParSiege);
              if ("rabaisPourcent" in champs) bd.rabais_pourcent = Number(champs.rabaisPourcent) || 0;
              if ("promoPourcent" in champs) bd.promo_pourcent = Number(champs.promoPourcent) || 0;
              if ("promoMois" in champs) bd.promo_mois = Number(champs.promoMois) || 0;
              if ("envoiAutoFactureQb" in champs) bd.envoi_auto_facture_qb = champs.envoiAutoFactureQb === true;
              await majEntreprisePlateforme(id, bd).catch(() => charger());
            }}
          />
        )}
        {onglet === "facturation" && peutModifierAbonnements && <SectionFacturation entreprises={entreprises} />}
        {onglet === "retours" && (
          <SectionRetoursPlateforme retours={retours} session={session} onMaj={() => listerRetoursTransmis().then(setRetours).catch(() => {})} />
        )}
        {onglet === "incidents" && voitEntreprises && (
          <SectionIncidents incidents={incidents} session={session} onCree={charger} />
        )}
        {onglet === "equipe" && clePrincipale && <SectionEquipe session={session} />}
      </div>
    </div>
  );
}

// ============================================================
// 💬 RETOURS TRANSMIS PAR LES ENTREPRISES (2026-09-02)
// ------------------------------------------------------------
// Ne reçoit QUE ce qui a passé le triage des admins d'entreprise —
// le circuit en 2 étages validé par le propriétaire. Chaque retour se
// traite ici : En cours → Réglé / Refusé, avec une réponse que l'admin
// de l'entreprise verra dans sa section « Retours de l'équipe ».
// ============================================================
function SectionRetoursPlateforme({ retours, session, onMaj }) {
  const [reponses, setReponses] = useState({});
  const agir = async (r, statut) => {
    try {
      await majRetour(r.id, {
        statut,
        reponseFluxya: (reponses[r.id] ?? r.reponseFluxya) || "",
        traitePar: session?.user?.email || null,
      });
      onMaj();
    } catch {
      window.alert("Enregistrement impossible — le snippet 82 est-il passé ?");
    }
  };
  if (retours.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">Aucun retour transmis — les signalements des techniciens passent d&apos;abord par l&apos;admin de leur entreprise.</p>;
  }
  return (
    <div className="space-y-2.5">
      {retours.map((r) => (
        <div key={r.id} className={`rounded-2xl border bg-white p-4 ${r.statut === "transmis" ? "border-amber-300" : "border-slate-200"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-800">
                {r.type === "idee" ? "💡 Idée" : "🐛 Bug"} · <span className="text-slate-400">{r.entrepriseId}</span> · {r.auteurNom || r.auteurEmail}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.message}</p>
              {r.photoUrl && (
                <a href={r.photoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-bold text-blue-600 underline">📷 Voir la photo</a>
              )}
              {r.commentaireTransmission && (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                  💼 Mot de l&apos;admin ({r.transmisPar}) : {r.commentaireTransmission}
                </p>
              )}
              <p className="mt-1 text-[10px] text-slate-400">
                {r.contexte?.page ? `Écran : ${r.contexte.page} · ` : ""}{r.creeLe ? new Date(r.creeLe).toLocaleDateString("fr-CA") : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              r.statut === "regle" ? "bg-emerald-100 text-emerald-700" : r.statut === "refuse" ? "bg-red-100 text-red-600" : r.statut === "en-cours" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
            }`}>
              {LIBELLES_STATUT_RETOUR[r.statut] || r.statut}
            </span>
          </div>
          {r.statut !== "regle" && r.statut !== "refuse" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
              <input
                value={reponses[r.id] ?? r.reponseFluxya ?? ""}
                onChange={(ev) => setReponses((p) => ({ ...p, [r.id]: ev.target.value }))}
                placeholder="Réponse à l'entreprise (facultatif — visible par son admin)"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              {r.statut === "transmis" && (
                <Bouton variant="outline" onClick={() => agir(r, "en-cours")} className="min-h-0 px-3 py-1.5 text-xs">🔧 En cours</Bouton>
              )}
              <Bouton onClick={() => agir(r, "regle")} className="min-h-0 px-3 py-1.5 text-xs">✅ Réglé</Bouton>
              <Bouton variant="danger" onClick={() => agir(r, "refuse")} className="min-h-0 px-3 py-1.5 text-xs">❌ Refuser</Bouton>
            </div>
          )}
          {(r.statut === "regle" || r.statut === "refuse") && r.reponseFluxya && (
            <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">↩️ Réponse : {r.reponseFluxya}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 👥 ÉQUIPE FLUXYA (2026-09-02) — clés principales SEULEMENT.
// ------------------------------------------------------------
// Jusqu'à 3 clés principales (le propriétaire + associés éventuels),
// puis admin régulier, gestionnaire, technicien de support. Le sceau et
// le niveau se posent CÔTÉ SERVEUR (route operateurs) — révocation en
// deux clics, jamais soi-même, jamais la dernière clé principale.
// ============================================================
function SectionEquipe({ session }) {
  const [operateurs, setOperateurs] = useState(null);
  const [messageEq, setMessageEq] = useState("");
  const [invite, setInvite] = useState({ courriel: "", nom: "", niveau: "technicien" });
  const [enCours, setEnCours] = useState(false);
  const [revoquePour, setRevoquePour] = useState(null);
  const charger = () => {
    listerOperateurs().then((r) => {
      if (Array.isArray(r?.operateurs)) setOperateurs(r.operateurs);
      else setMessageEq(r?.erreur || "Liste indisponible.");
    });
  };
  useEffect(charger, []);
  const inviter = async () => {
    if (!invite.courriel.trim()) return;
    setEnCours(true);
    setMessageEq("");
    const r = await gererOperateur({ action: "inviter", ...invite, courriel: invite.courriel.trim() });
    setEnCours(false);
    if (r?.fait) {
      setMessageEq(
        r.simule || r.courrielEchec
          ? `✓ Compte préparé, mais le courriel n'est pas parti — remets ce lien à la personne : ${r.lien}`
          : `✓ Invitation envoyée à ${invite.courriel.trim()} — la personne choisit son mot de passe puis se connecte sur /plateforme.`
      );
      setInvite({ courriel: "", nom: "", niveau: "technicien" });
      charger();
    } else {
      setMessageEq(`⚠️ ${r?.erreur || "Invitation impossible — réessaie."}`);
    }
  };
  const changerNiveau = async (o, niveau) => {
    const r = await gererOperateur({ action: "niveau", id: o.id, niveau });
    if (r?.fait) charger();
    else setMessageEq(`⚠️ ${r?.erreur || "Changement refusé."}`);
  };
  const revoquer = async (o) => {
    setRevoquePour(null);
    const r = await gererOperateur({ action: "revoquer", id: o.id });
    if (r?.fait) {
      setMessageEq(`✓ Accès de ${o.courriel} révoqué — la porte est refermée.`);
      charger();
    } else setMessageEq(`⚠️ ${r?.erreur || "Révocation refusée."}`);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">➕ Inviter un membre de l&apos;équipe Fluxya</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={invite.courriel} onChange={(ev) => setInvite((p) => ({ ...p, courriel: ev.target.value }))}
            placeholder="courriel@exemple.com" className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
          <input value={invite.nom} onChange={(ev) => setInvite((p) => ({ ...p, nom: ev.target.value }))}
            placeholder="Nom" className="w-36 rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
          <select value={invite.niveau} onChange={(ev) => setInvite((p) => ({ ...p, niveau: ev.target.value }))}
            className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold">
            {NIVEAUX_PLATEFORME.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <Bouton onClick={inviter} disabled={enCours || !invite.courriel.trim()} className="min-h-0 px-4 py-2 text-xs">
            {enCours ? "Envoi…" : "Inviter"}
          </Bouton>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
          {NIVEAUX_PLATEFORME.map(([, label, desc]) => `${label} : ${desc}`).join(" · ")}
        </p>
      </div>

      {messageEq && <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 break-all">{messageEq}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white">
        {operateurs === null ? (
          <p className="p-5 text-center text-xs text-slate-400">Chargement de l&apos;équipe…</p>
        ) : (
          operateurs.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-800">{o.nom || o.courriel}{o.id === session?.user?.id ? " (toi)" : ""}</p>
                <p className="text-[10px] text-slate-400">
                  {o.courriel} · {o.derniereConnexion ? `dernière connexion ${new Date(o.derniereConnexion).toLocaleDateString("fr-CA")}` : "jamais connecté"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={o.niveau}
                  disabled={o.id === session?.user?.id}
                  onChange={(ev) => changerNiveau(o, ev.target.value)}
                  title={o.id === session?.user?.id ? "On ne change pas son propre niveau" : "Changer le niveau"}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] font-semibold disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {NIVEAUX_PLATEFORME.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                {o.id !== session?.user?.id && (
                  revoquePour === o.id ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      Révoquer ?
                      <button onClick={() => revoquer(o)} className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-extrabold text-white">Oui</button>
                      <button onClick={() => setRevoquePour(null)} className="text-[10px] underline">Non</button>
                    </span>
                  ) : (
                    <button onClick={() => setRevoquePour(o.id)} className="text-[10px] font-semibold text-slate-400 underline hover:text-red-600">
                      Révoquer l&apos;accès
                    </button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-400">
        Maximum 3 clés principales. La révocation retire le sceau côté serveur : la porte se referme instantanément,
        même si la personne connaît encore son mot de passe. Un opérateur n&apos;a AUCUN accès au contenu des
        entreprises — seulement à cette console, selon son niveau.
      </p>
    </div>
  );
}

function SectionEntreprises({ entreprises, isolationOk, peutModifier = true, gestesLourds = true, onExporter, onBasculerSuspension, onMaj }) {
  const [editionId, setEditionId] = useState(null);
  return (
    <div className="space-y-3">
      {/* LE VERROU — visible et expliqué : personne ne crée une 2e
          entreprise avant la preuve d'étanchéité. */}
      <div className={`rounded-2xl border p-4 ${isolationOk ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <p className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
          {isolationOk ? <Check size={15} className="text-emerald-600" /> : <Lock size={15} className="text-amber-600" />}
          {isolationOk ? "Isolation multi-entreprises ACTIVE" : "Création d'entreprises VERROUILLÉE"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {isolationOk
            ? "Les cloisons RLS sont en place et le test-sonde d'étanchéité est passé — la création d'entreprises est permise."
            : "Les cloisons entre entreprises (RLS multi-locataires) ne sont pas encore basculées — le « grand soir ». Créer une entreprise maintenant exposerait les données existantes. Le verrou se lève en base de données, après le test-sonde d'étanchéité, jamais d'ici."}
        </p>
        <Bouton disabled={!isolationOk} className="mt-3" title={isolationOk ? "" : "Verrouillé jusqu'au grand soir"}>
          <Plus size={15} /> Créer une entreprise
        </Bouton>
      </div>

      {entreprises.map((e) => {
        const st = STATUTS[e.statut] || STATUTS.essai;
        const jours = joursAvant(e.gratuitJusqua);
        const rappel = e.statut === "fondateur" && jours != null && jours <= 30;
        return (
          <div key={e.id} className={`rounded-2xl border bg-white p-4 ${e.suspendue ? "border-red-200 opacity-70" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{e.nom}</p>
                <p className="text-[11px] text-slate-400">
                  {e.courriel || "—"} · depuis {e.creeLe ? new Date(e.creeLe).toLocaleDateString("fr-CA") : "—"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {e.suspendue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">SUSPENDUE</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${st.cls}`}>{st.label}</span>
              </div>
            </div>

            {e.statut === "fondateur" && e.gratuitJusqua && (
              <p className={`mt-2 rounded-lg px-2 py-1 text-[11px] font-bold ${rappel ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-500"}`}>
                {jours >= 0
                  ? `${rappel ? "📅 RAPPEL — " : ""}Gratuit jusqu'au ${e.gratuitJusqua} (${jours} jour${jours > 1 ? "s" : ""} restants)${rappel ? " : appelle-le pour la transition au prix fondateur." : ""}`
                  : `⚠️ Gratuit ÉCHU depuis ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? "s" : ""} — transition au prix fondateur à régler.`}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {editionId === e.id ? (
                <>
                  <select
                    value={e.statut}
                    onChange={(ev) => {
                      // EXCLUSIVITÉ FONDATEUR — la clause « 1 an gratuit +
                      // 25 % à vie » est réservée aux 3 PREMIERS : la
                      // plateforme refuse un 4e statut pionnier.
                      if (ev.target.value === "fondateur") {
                        const dejaFondateurs = entreprises.filter((x) => x.statut === "fondateur" && x.id !== e.id).length;
                        if (dejaFondateurs >= 3) {
                          window.alert("Les 3 places de client pionnier sont prises — cette clause était exclusive aux 3 premiers et est maintenant révoquée. Utilise Essai ou Payant (avec promo au besoin).");
                          return;
                        }
                      }
                      onMaj(e.id, { statut: ev.target.value });
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    {Object.entries(STATUTS).map(([val, s]) => <option key={val} value={val}>{s.label}</option>)}
                  </select>
                  {e.statut === "fondateur" && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      gratuit jusqu'au
                      <input type="date" value={e.gratuitJusqua || ""} onChange={(ev) => onMaj(e.id, { gratuitJusqua: ev.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                    </span>
                  )}
                  <Bouton variant="outline" onClick={() => setEditionId(null)} className="min-h-0 px-3 py-1.5 text-xs">Fermer</Bouton>
                  {/* 🧩 MODULES — cocher ce que ce client reçoit. */}
                  <div className="w-full rounded-xl bg-slate-50 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">🧩 Modules du forfait</p>
                      {Array.isArray(e.modules) && (
                        <button
                          onClick={() => onMaj(e.id, { modules: null })}
                          className="text-[10px] font-bold text-blue-600 underline underline-offset-2"
                        >
                          Tout redonner
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {MODULES_CATALOGUE.map(([id, label]) => {
                        const inclus = !Array.isArray(e.modules) || e.modules.includes(id);
                        return (
                          <label key={id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${inclus ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-400"}`}>
                            <input
                              type="checkbox"
                              checked={inclus}
                              onChange={() => {
                                const base = Array.isArray(e.modules) ? e.modules : MODULES_CATALOGUE.map(([m]) => m);
                                const suivant = inclus ? base.filter((m) => m !== id) : [...base, id];
                                onMaj(e.id, { modules: suivant });
                              }}
                              className="h-3.5 w-3.5 accent-[#131B2E]"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[9px] leading-snug text-slate-400">
                      Un module décoché disparaît pour TOUTE l'entreprise, son admin principal compris. L'entreprise
                      voit le changement à sa prochaine connexion.
                    </p>
                  </div>
                  {/* 💰 PRIX — modifiables en tout temps (hausses annuelles,
                      ententes). Les changements s'appliquent aux calculs
                      des mois SUIVANTS — jamais rétroactifs. */}
                  <div className="w-full rounded-xl bg-slate-50 p-2.5">
                    <p className="mb-1.5 text-[10px] font-extrabold uppercase text-slate-400">💰 Prix de l'abonnement</p>
                    <div className="flex flex-wrap items-end gap-2 text-[11px]">
                      <span>
                        <label className="block text-[9px] font-bold uppercase text-slate-400">Base / mois ($)</label>
                        <input type="number" min={0} step="1" value={e.prixBase ?? ""}
                          onChange={(ev) => onMaj(e.id, { prixBase: ev.target.value })}
                          placeholder="à définir"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" />
                      </span>
                      <span>
                        <label className="block text-[9px] font-bold uppercase text-slate-400">Sièges inclus</label>
                        <input type="number" min={0} step="1" value={e.siegesInclus ?? 4}
                          onChange={(ev) => onMaj(e.id, { siegesInclus: ev.target.value })}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" />
                      </span>
                      <span>
                        <label className="block text-[9px] font-bold uppercase text-slate-400">$ / siège extra</label>
                        <input type="number" min={0} step="1" value={e.prixParSiege ?? ""}
                          onChange={(ev) => onMaj(e.id, { prixParSiege: ev.target.value })}
                          placeholder="à définir"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" />
                      </span>
                      <span>
                        <label className="block text-[9px] font-bold uppercase text-slate-400">Rabais % (pionnier : 25)</label>
                        <input type="number" min={0} max={100} step="1" value={e.rabaisPourcent ?? 0}
                          onChange={(ev) => onMaj(e.id, { rabaisPourcent: ev.target.value })}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" />
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-2 text-[11px]">
                      <span>
                        <label className="block text-[9px] font-bold uppercase text-slate-400">🏷️ Promo %</label>
                        <input type="number" min={0} max={100} step="1" value={e.promoPourcent ?? 0}
                          onChange={(ev) => onMaj(e.id, { promoPourcent: ev.target.value })}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" />
                      </span>
                      <span>
                        <label className="block text-[9px] font-bold uppercase text-slate-400">Durée (mois)</label>
                        <input type="number" min={0} step="1" value={e.promoMois ?? 0}
                          onChange={(ev) => onMaj(e.id, { promoMois: ev.target.value })}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" />
                      </span>
                      <span className="text-[9px] leading-snug text-slate-400">
                        La promo court APRÈS le 1er mois gratuit (offert à tout nouveau client), à partir de la
                        date de création du compte — puis retour au tarif régulier.
                      </span>
                    </div>
                    {/* 🧾 TYPE DE PROGRAMME DE FACTURATION — l'entreprise
                        peut aussi l'activer elle-même dans ses Paramètres. */}
                    <label className="mt-2 flex items-start gap-2 text-[11px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={e.envoiAutoFactureQb === true}
                        onChange={(ev) => onMaj(e.id, { envoiAutoFactureQb: ev.target.checked })}
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                      />
                      <span>
                        🧾 Envoi automatique des factures par QuickBooks
                        <span className="block text-[9px] font-normal leading-snug text-slate-400">
                          Coché : les factures partent toutes seules dès leur création. Décoché : créées dans QuickBooks
                          sans partir — l'entreprise envoie manuellement (et peut activer l'option elle-même dans ses Paramètres).
                        </span>
                      </span>
                    </label>
                    <p className="mt-1 text-[9px] leading-snug text-slate-400">
                      Le rabais pionnier s'applique à la base ET aux sièges extras — à vie (entente). Si une promo
                      est aussi active, LE MEILLEUR des deux s'applique. Pendant la période gratuite, rien n'est
                      facturé et les sièges sont illimités.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* 🔐 GESTION PAR NIVEAU (2026-09-02) : modifier =
                      clé principale ou admin régulier ; les GESTES
                      LOURDS (export, suspension) = clé principale
                      seulement ; gestionnaire = lecture. */}
                  {peutModifier ? (
                    <Bouton variant="outline" onClick={() => setEditionId(e.id)} className="min-h-0 px-3 py-1.5 text-xs">
                      Statut & modules… {Array.isArray(e.modules) ? `(🧩 ${e.modules.length}/${MODULES_CATALOGUE.length})` : ""}
                    </Bouton>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">🔒 Lecture seulement (niveau gestionnaire)</span>
                  )}
                  {gestesLourds && (
                    <Bouton variant="outline" onClick={() => onExporter(e)} className="min-h-0 px-3 py-1.5 text-xs">
                      <Download size={13} /> Exporter ses données
                    </Bouton>
                  )}
                  {gestesLourds && e.statut !== "proprietaire" && (
                    <Bouton variant={e.suspendue ? "outline" : "danger"} onClick={() => onBasculerSuspension(e)} className="min-h-0 px-3 py-1.5 text-xs">
                      {e.suspendue ? <><Play size={13} /> Réactiver</> : <><Pause size={13} /> Suspendre</>}
                    </Bouton>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-[10px] leading-relaxed text-slate-400">
        Minimisation (Loi 25) : cette interface lit la FICHE des entreprises — jamais leurs clients, salaires ou
        travaux. L'export complet est le seul accès au contenu : un geste explicite, à remettre à l'entreprise.
        La suspension coupe l'accès à la connexion au grand soir (pour l'instant, elle est consignée au registre).
      </p>
    </div>
  );
}

function SectionIncidents({ incidents, session, onCree }) {
  const [formOuvert, setFormOuvert] = useState(false);
  const [f, setF] = useState({ dateIncident: "", description: "", gravite: "faible", mesures: "", personnesTouchees: "", notifieCai: false, notifiePersonnes: false });
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async () => {
    if (!f.dateIncident || !f.description.trim()) return;
    setEnvoi(true);
    try {
      await creerIncident(f, session);
      setFormOuvert(false);
      setF({ dateIncident: "", description: "", gravite: "faible", mesures: "", personnesTouchees: "", notifieCai: false, notifiePersonnes: false });
      onCree();
    } finally {
      setEnvoi(false);
    }
  };

  const GRAVITES = { faible: "bg-slate-100 text-slate-600", moyen: "bg-amber-100 text-amber-800", serieux: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Registre des incidents de confidentialité</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Obligation de la Loi 25 : tenir ce registre même vide. Tout incident touchant des renseignements
          personnels s'y consigne. Si le risque de préjudice est <span className="font-bold">sérieux</span> :
          notifier la Commission d'accès à l'information ET les personnes touchées — coche les deux cases une fois fait.
        </p>
        {!formOuvert ? (
          <Bouton variant="outline" onClick={() => setFormOuvert(true)} className="mt-3 min-h-0 px-3 py-1.5 text-xs">
            <Plus size={13} /> Consigner un incident
          </Bouton>
        ) : (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              <span>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Date de l'incident</label>
                <input type="date" value={f.dateIncident} onChange={(e) => setF({ ...f, dateIncident: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </span>
              <span>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Gravité</label>
                <select value={f.gravite} onChange={(e) => setF({ ...f, gravite: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                  <option value="faible">Faible</option>
                  <option value="moyen">Moyen</option>
                  <option value="serieux">Sérieux (notifications requises)</option>
                </select>
              </span>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Description</label>
              <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2}
                placeholder="Ce qui s'est passé, quelles données, comment on l'a découvert…"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Mesures prises</label>
              <textarea value={f.mesures} onChange={(e) => setF({ ...f, mesures: e.target.value })} rows={2}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Personnes touchées</label>
              <input value={f.personnesTouchees} onChange={(e) => setF({ ...f, personnesTouchees: e.target.value })}
                placeholder="Ex. : employés de l'entreprise X (4 personnes)"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            {f.gravite === "serieux" && (
              <div className="rounded-lg bg-red-50 p-2">
                <label className="flex items-center gap-2 text-[11px] font-bold text-red-700">
                  <input type="checkbox" checked={f.notifieCai} onChange={(e) => setF({ ...f, notifieCai: e.target.checked })} />
                  Commission d'accès à l'information notifiée
                </label>
                <label className="mt-1 flex items-center gap-2 text-[11px] font-bold text-red-700">
                  <input type="checkbox" checked={f.notifiePersonnes} onChange={(e) => setF({ ...f, notifiePersonnes: e.target.checked })} />
                  Personnes touchées notifiées
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <Bouton onClick={soumettre} disabled={envoi || !f.dateIncident || !f.description.trim()} className="min-h-0 px-3 py-1.5 text-xs">
                Consigner
              </Bouton>
              <Bouton variant="outline" onClick={() => setFormOuvert(false)} className="min-h-0 px-3 py-1.5 text-xs">Annuler</Bouton>
            </div>
          </div>
        )}
      </div>

      {incidents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
          Aucun incident consigné — c'est la bonne nouvelle. Le registre existe, c'est ce que la loi demande.
        </p>
      ) : (
        incidents.map((i) => (
          <div key={i.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-slate-800">{i.date_incident}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${GRAVITES[i.gravite] || GRAVITES.faible}`}>
                {i.gravite.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{i.description}</p>
            {i.mesures && <p className="mt-1 text-[11px] text-slate-500"><span className="font-bold">Mesures :</span> {i.mesures}</p>}
            {i.personnes_touchees && <p className="text-[11px] text-slate-500"><span className="font-bold">Touchées :</span> {i.personnes_touchees}</p>}
            {i.gravite === "serieux" && (
              <p className="mt-1 text-[11px] font-bold text-red-600">
                CAI {i.notifie_cai ? "✓ notifiée" : "✗ À NOTIFIER"} · Personnes {i.notifie_personnes ? "✓ notifiées" : "✗ À NOTIFIER"}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// 💰 FACTURATION — l'outil de calcul intégré (règles du propriétaire) :
//   • siège ACTIF = invitation acceptée (au moins une connexion) ;
//   • les N premiers sièges (par ancienneté) sont INCLUS dans la base ;
//   • un siège activé EN COURS DE MOIS se facture AU PRORATA des jours
//     restants (jour d'activation inclus) ;
//   • rabais % appliqué à la base ET aux extras (fondateurs : 25 à vie) ;
//   • période gratuite : 0 $, sièges illimités.
// Les montants calculés se reportent dans les factures récurrentes
// QuickBooks (débit préautorisé) — l'humain garde la main sur l'argent.
// ============================================================
function SectionFacturation({ entreprises }) {
  const [sieges, setSieges] = useState(null);
  const [erreur, setErreur] = useState("");
  const n = new Date();
  const [mois, setMois] = useState(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    listerSiegesPlateforme().then((r) => {
      if (r?.sieges) setSieges(r.sieges);
      else setErreur(r?.erreur || "Lecture des sièges impossible.");
    });
  }, []);

  const [annee, moisNum] = mois.split("-").map(Number);
  const joursDansMois = new Date(annee, moisNum, 0).getDate();
  const debutMois = `${mois}-01`;
  const finMois = `${mois}-${String(joursDansMois).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Mois à facturer</p>
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
      </div>
      {erreur && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">⚠️ {erreur}</p>}
      {!sieges && !erreur && <p className="rounded-xl bg-white px-3 py-2 text-xs text-slate-400">Lecture des comptes…</p>}

      {sieges && entreprises.map((e) => {
        // ------------------------------------------------------------
        // LA PHASE DU MOIS AFFICHÉ (règles du propriétaire) :
        //   1. entente gratuite explicite (fondateurs an 1) → GRATUIT ;
        //   2. 1ER MOIS GRATUIT pour tout nouveau client — ancré sur la
        //      date de CRÉATION du compte (un mois jour pour jour) ;
        //   3. PROMO : X % pendant N mois APRÈS le mois gratuit ;
        //   4. ensuite : tarif régulier (rabais permanent s'il existe —
        //      fondateurs 25 % à vie). Promo + permanent = le MEILLEUR.
        // ------------------------------------------------------------
        const creation = e.creeLe ? new Date(e.creeLe) : null;
        const ajouterMoisLocal = (d, n2) => {
          const c2 = new Date(d);
          c2.setMonth(c2.getMonth() + n2);
          return c2;
        };
        const enISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const finGratuitNouveau = creation ? enISO(ajouterMoisLocal(creation, 1)) : null;
        const finPromo = creation ? enISO(ajouterMoisLocal(creation, 1 + (Number(e.promoMois) || 0))) : null;
        const gratuiteEntente = e.gratuitJusqua && e.gratuitJusqua >= debutMois;
        const gratuiteNouveau = !gratuiteEntente && finGratuitNouveau && debutMois <= finGratuitNouveau;
        const gratuite = gratuiteEntente || gratuiteNouveau;
        const promoActive =
          !gratuite && (Number(e.promoPourcent) || 0) > 0 && finPromo && debutMois <= finPromo;
        const rabaisEffectif = Math.max(
          Number(e.rabaisPourcent) || 0,
          promoActive ? Number(e.promoPourcent) || 0 : 0
        );
        const comptes = (sieges[e.id] || []).filter((c) => c.actif && c.activeLe);
        // Ancienneté : les plus vieux consomment les sièges inclus.
        const tries = [...comptes].sort((a, b) => String(a.activeLe).localeCompare(String(b.activeLe)));
        // Seuls comptent ce mois-ci : activés AVANT la fin du mois.
        const duMois = tries.filter((c) => String(c.activeLe).slice(0, 10) <= finMois);
        const inclus = duMois.slice(0, Math.max(0, e.siegesInclus ?? 4));
        const extras = duMois.slice(Math.max(0, e.siegesInclus ?? 4));
        const prixSiege = Number(e.prixParSiege) || 0;
        const facteurRabais = 1 - rabaisEffectif / 100;
        const lignes = extras.map((c) => {
          const dateAct = String(c.activeLe).slice(0, 10);
          const enCoursDeMois = dateAct >= debutMois && dateAct <= finMois;
          const jourAct = enCoursDeMois ? Number(dateAct.slice(8, 10)) : 1;
          const joursFactures = enCoursDeMois ? joursDansMois - jourAct + 1 : joursDansMois;
          const montant = prixSiege * (joursFactures / joursDansMois) * facteurRabais;
          return { email: c.email, dateAct, enCoursDeMois, joursFactures, montant };
        });
        const base = (Number(e.prixBase) || 0) * facteurRabais;
        const totalExtras = lignes.reduce((s2, l) => s2 + l.montant, 0);
        const total = gratuite ? 0 : base + totalExtras;
        const prixManquants = !gratuite && (e.prixBase == null || (extras.length > 0 && e.prixParSiege == null));
        return (
          <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{e.nom}</p>
                <p className="text-[11px] text-slate-400">
                  👥 {duMois.length} siège{duMois.length > 1 ? "s" : ""} actif{duMois.length > 1 ? "s" : ""} · {e.siegesInclus ?? 4} inclus
                  {rabaisEffectif > 0 && !gratuite && ` · rabais ${rabaisEffectif} %${promoActive && rabaisEffectif === (Number(e.promoPourcent) || 0) ? " (promo)" : ""}`}
                </p>
              </div>
              <p className={`text-lg font-extrabold tabular-nums ${gratuite ? "text-amber-600" : "text-slate-900"}`}>
                {gratuite ? "GRATUIT" : `${total.toFixed(2)} $`}
              </p>
            </div>
            {gratuite ? (
              <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                {gratuiteEntente
                  ? `🎁 Période pionnier — sièges illimités, 0 $ jusqu'au ${e.gratuitJusqua}.`
                  : `🎁 1er MOIS GRATUIT (nouveau client) — jusqu'au ${finGratuitNouveau}.`}
              </p>
            ) : (
              <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                {promoActive && (
                  <p className="rounded-lg bg-blue-50 px-2 py-1 font-bold text-blue-700">
                    🏷️ PROMO {e.promoPourcent} % active — jusqu'au {finPromo}, puis tarif régulier{(Number(e.rabaisPourcent) || 0) > 0 ? ` (rabais permanent ${e.rabaisPourcent} %)` : ""}.
                  </p>
                )}
                <div className="flex justify-between"><span>Base mensuelle{rabaisEffectif > 0 ? ` (−${rabaisEffectif} %)` : ""}</span><span className="tabular-nums">{base.toFixed(2)} $</span></div>
                {lignes.map((l) => (
                  <div key={l.email} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {l.email}
                      {l.enCoursDeMois && <span className="ml-1 text-emerald-700">· activé le {l.dateAct} → prorata {l.joursFactures}/{joursDansMois} j</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{l.montant.toFixed(2)} $</span>
                  </div>
                ))}
                {extras.length === 0 && <p className="text-slate-400">Aucun siège au-delà des inclus.</p>}
                {prixManquants && (
                  <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 font-bold text-red-600">⚠️ Prix non définis — ouvre « Statut & modules… » dans l'onglet Entreprises pour les fixer.</p>
                )}
                <p className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1 font-bold text-slate-700">
                  🧾 À reporter dans la facture récurrente QuickBooks : {total.toFixed(2)} $ + taxes
                </p>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[10px] leading-relaxed text-slate-400">
        Règles : 1er mois gratuit à la création du compte · promo X % pendant N mois ensuite (le meilleur du
        permanent et de la promo s'applique) · siège actif = invitation acceptée (une connexion) · les plus anciens consomment les sièges inclus ·
        activation en cours de mois = prorata des jours restants (jour d'activation inclus) · rabais appliqué à la
        base et aux extras · changements de prix appliqués aux mois suivants, jamais rétroactifs.
      </p>
    </div>
  );
}
