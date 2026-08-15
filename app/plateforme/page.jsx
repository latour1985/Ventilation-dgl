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
import {
  listerEntreprisesPlateforme,
  majEntreprisePlateforme,
  verrouIsolation,
  listerIncidents,
  creerIncident,
  exporterEntreprise,
} from "@/lib/supabase/plateforme";

const STATUTS = {
  proprietaire: { label: "Propriétaire", cls: "bg-slate-900 text-white" },
  fondateur: { label: "Fondateur", cls: "bg-amber-100 text-amber-800" },
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
    const { error } = await supabase.auth.signInWithPassword({ email: courriel.trim(), password: motDePasse });
    setConnexionEnCours(false);
    if (error) setErreurConnexion("Courriel ou mot de passe refusé.");
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
  const [onglet, setOnglet] = useState("entreprises");
  const [entreprises, setEntreprises] = useState([]);
  const [isolationOk, setIsolationOk] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [message, setMessage] = useState("");

  const charger = () => {
    listerEntreprisesPlateforme().then(setEntreprises).catch(() => setMessage("Registre illisible — le snippet 51 est-il passé ?"));
    verrouIsolation().then(setIsolationOk).catch(() => {});
    listerIncidents().then(setIncidents).catch(() => {});
  };
  useEffect(charger, []);

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
            <p className="text-[10px] text-white/50">{session.user.email} · sceau plateforme ✓</p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10">
          <LogOut size={14} /> Quitter
        </button>
      </header>

      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-4 flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          {[["entreprises", "🏢 Entreprises"], ["incidents", "🔐 Incidents (Loi 25)"]].map(([id, label]) => (
            <button key={id} onClick={() => setOnglet(id)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-extrabold ${onglet === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>

        {message && <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">{message}</p>}

        {onglet === "entreprises" && (
          <SectionEntreprises
            entreprises={entreprises}
            isolationOk={isolationOk}
            onExporter={exporter}
            onBasculerSuspension={basculerSuspension}
            onMaj={async (id, champs) => {
              setEntreprises((prev) => prev.map((x) => (x.id === id ? { ...x, ...champs } : x)));
              const bd = {};
              if (champs.statut) bd.statut_plateforme = champs.statut;
              if ("gratuitJusqua" in champs) bd.gratuit_jusqua = champs.gratuitJusqua || null;
              await majEntreprisePlateforme(id, bd).catch(() => charger());
            }}
          />
        )}
        {onglet === "incidents" && (
          <SectionIncidents incidents={incidents} session={session} onCree={charger} />
        )}
      </div>
    </div>
  );
}

function SectionEntreprises({ entreprises, isolationOk, onExporter, onBasculerSuspension, onMaj }) {
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
                    onChange={(ev) => onMaj(e.id, { statut: ev.target.value })}
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
                </>
              ) : (
                <>
                  <Bouton variant="outline" onClick={() => setEditionId(e.id)} className="min-h-0 px-3 py-1.5 text-xs">Statut…</Bouton>
                  <Bouton variant="outline" onClick={() => onExporter(e)} className="min-h-0 px-3 py-1.5 text-xs">
                    <Download size={13} /> Exporter ses données
                  </Bouton>
                  {e.statut !== "proprietaire" && (
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
