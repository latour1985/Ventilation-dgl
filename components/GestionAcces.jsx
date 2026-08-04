// components/GestionAcces.jsx
//
// Panneau de gestion des accès par utilisateur (couche 3) — visible
// UNIQUEMENT par l'Admin principal, dans l'onglet Utilisateurs.
// Chaque entrée (clé = courriel de connexion) définit un rôle + des
// sections cochées, enregistrés dans la table Supabase
// `permissions_utilisateurs`. Sans entrée : défauts du rôle des
// métadonnées. Les changements prennent effet à la reconnexion.

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ROLES, ROLES_HERITES, SOUS_CATEGORIES_BUREAU, ORDRE_SECTIONS, LIBELLES_SECTIONS, permissionsPour, AUTORISATIONS, LIBELLES_AUTORISATIONS, AIDES_AUTORISATIONS, ROLES_AVEC_AUTORISATIONS } from "@/lib/permissions";

// Rôles d'administration — SEUL un Admin principal peut les attribuer
// ou toucher aux accès de ceux qui les portent. Un Admin régulier peut
// donner les autres rôles (Chargé de projet, Répartiteur, Technicien),
// mais ne peut ni créer un administrateur ni modifier/retirer l'accès
// d'un administrateur existant.
const ROLES_ADMIN = ["Admin principal", "Admin régulier"];

export default function GestionAcces({ utilisateurs, estAdminPrincipal = false }) {
  const [entrees, setEntrees] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Technicien"); // Technicien par défaut
  // Sous-catégorie du rôle « Administration bureau » (= métier de bureau) :
  // la choisir remplit les accès par défaut de ce métier.
  const [sousCategorie, setSousCategorie] = useState(SOUS_CATEGORIES_BUREAU[0]);
  const [sections, setSections] = useState(permissionsPour("Technicien"));
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  const recharger = async () => {
    setChargement(true);
    const { data, error } = await supabase
      .from("permissions_utilisateurs")
      .select("*")
      .order("email");
    if (error) {
      setErreur("Impossible de charger les accès — vérifie que la table permissions_utilisateurs existe (schema.sql, section 16).");
    } else {
      setErreur("");
      setEntrees(data || []);
    }
    setChargement(false);
  };

  useEffect(() => {
    recharger();
  }, []);

  // Rôles attribuables selon QUI utilise le panneau : un Admin régulier
  // ne voit pas les rôles d'administration dans la liste.
  const rolesDisponibles = estAdminPrincipal ? ROLES : ROLES.filter((r) => !ROLES_ADMIN.includes(r));
  // Entrée verrouillée pour l'utilisateur courant ? (accès d'un
  // administrateur, consultable mais intouchable pour un Admin régulier)
  const estVerrouillee = (entree) => !estAdminPrincipal && ROLES_ADMIN.includes(entree?.role);

  // Changer le rôle recharge les cases par défaut de ce rôle — l'admin
  // peut ensuite cocher/décocher librement (accès sur mesure). Pour
  // « Administration bureau », c'est la SOUS-CATÉGORIE qui fixe les défauts.
  const changerRole = (r) => {
    setRole(r);
    if (r === "Administration bureau") {
      const sc = SOUS_CATEGORIES_BUREAU[0];
      setSousCategorie(sc);
      setSections(permissionsPour(r, sc));
    } else {
      setSections(permissionsPour(r));
    }
  };

  const changerSousCategorie = (sc) => {
    setSousCategorie(sc);
    setSections(permissionsPour("Administration bureau", sc));
  };

  const basculerSection = (s) => {
    setSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const ouvrirPour = (entree) => {
    if (estVerrouillee(entree)) return; // accès d'un administrateur — intouchable pour un Admin régulier
    setFormOuvert(true);
    setEmail(entree?.email || "");
    // Héritage : les anciens rôles autonomes (Chargé de projet,
    // Répartiteur) s'ouvrent comme « Administration bureau » avec la
    // sous-catégorie correspondante.
    let r = entree?.role;
    let sc = entree?.sous_categorie || SOUS_CATEGORIES_BUREAU[0];
    if (ROLES_HERITES.includes(r)) {
      sc = r;
      r = "Administration bureau";
    }
    if (!rolesDisponibles.includes(r)) r = "Technicien";
    setRole(r);
    setSousCategorie(SOUS_CATEGORIES_BUREAU.includes(sc) ? sc : SOUS_CATEGORIES_BUREAU[0]);
    setSections(
      Array.isArray(entree?.sections) && entree.sections.length > 0
        ? entree.sections
        : permissionsPour(r, r === "Administration bureau" ? sc : undefined)
    );
  };

  const enregistrer = async () => {
    const courriel = email.trim().toLowerCase();
    if (!courriel) return;
    // Garde défensive : un Admin régulier ne peut ni attribuer un rôle
    // d'administration, ni écraser l'entrée d'un administrateur existant.
    const entreeExistante = entrees.find((e) => e.email === courriel);
    if (!estAdminPrincipal && (ROLES_ADMIN.includes(role) || estVerrouillee(entreeExistante))) {
      setErreur("Réservé aux Admins principaux — seul un Admin principal peut créer un administrateur ou modifier ses accès.");
      return;
    }
    setEnregistrementEnCours(true);
    const { error } = await supabase.from("permissions_utilisateurs").upsert({
      email: courriel,
      role,
      // Sous-catégorie (= métier de bureau) seulement pour le rôle
      // « Administration bureau » — null pour les autres rôles.
      sous_categorie: role === "Administration bureau" ? sousCategorie : null,
      sections,
      updated_at: new Date().toISOString(),
    });
    setEnregistrementEnCours(false);
    if (error) {
      setErreur("Échec de l'enregistrement — réessaie ou vérifie la connexion Supabase.");
      return;
    }
    setFormOuvert(false);
    setEmail("");
    recharger();
  };

  const supprimer = async (courriel) => {
    // Garde défensive : impossible pour un Admin régulier de retirer
    // l'accès d'un administrateur.
    const entree = entrees.find((e) => e.email === courriel);
    if (estVerrouillee(entree)) return;
    const { error } = await supabase.from("permissions_utilisateurs").delete().eq("email", courriel);
    if (!error) recharger();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Gestion des accès</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {estAdminPrincipal
              ? "Personnalise le rôle et les sections de chaque utilisateur (prend effet à sa prochaine connexion)."
              : "Tu peux donner des accès (Chargé de projet, Répartiteur, Technicien) — la création d'administrateurs est réservée aux Admins principaux."}
          </p>
        </div>
        <button
          onClick={() => (formOuvert ? setFormOuvert(false) : ouvrirPour(null))}
          className="shrink-0 rounded-lg bg-[#131B2E] px-3 py-1.5 text-xs font-bold text-white"
        >
          {formOuvert ? "Fermer" : "+ Ajouter / modifier"}
        </button>
      </div>

      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erreur}</p>}

      {formOuvert && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Courriel de connexion</label>
              {(() => {
                // Liste déroulante : employés du dossier Utilisateurs +
                // entrées déjà configurées (sans doublons).
                const suggestions = [
                  ...(utilisateurs || [])
                    .filter((u) => u.courriel)
                    .map((u) => ({ courriel: u.courriel.toLowerCase(), etiquette: `${u.nom} — ${u.courriel}` })),
                  ...entrees
                    .filter((e) => !(utilisateurs || []).some((u) => u.courriel?.toLowerCase() === e.email))
                    .map((e) => ({ courriel: e.email, etiquette: e.email })),
                ];
                return (
                  <select
                    value={suggestions.some((s) => s.courriel === email.toLowerCase()) ? email.toLowerCase() : ""}
                    onChange={(e) => e.target.value && setEmail(e.target.value)}
                    className="mb-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                  >
                    <option value="">— Choisir un utilisateur —</option>
                    {suggestions.map((s) => (
                      <option key={s.courriel} value={s.courriel}>{s.etiquette}</option>
                    ))}
                  </select>
                );
              })()}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ou tape un courriel manuellement"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Rôle (défauts)</label>
              <select
                value={role}
                onChange={(e) => changerRole(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold"
              >
                {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {!estAdminPrincipal && (
                <p className="mt-1 text-[10px] text-slate-400">Les rôles d'administration ne peuvent être donnés que par un Admin principal.</p>
              )}
              {role === "Administration bureau" && (
                <div className="mt-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Sous-catégorie (métier de bureau)</label>
                  <select
                    value={sousCategorie}
                    onChange={(e) => changerSousCategorie(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold"
                  >
                    {SOUS_CATEGORIES_BUREAU.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">Choisir la sous-catégorie remplit les accès par défaut de ce métier (ajustables ci-dessous).</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Accès (coche / décoche librement)</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {/* « Paramètres » n'est proposé QUE pour l'Admin principal :
                  cet écran touche les coordonnées envoyées aux clients,
                  les taux de taxes et les règles de paie. Le cocher pour
                  un autre rôle n'aurait de toute façon aucun effet (le
                  verrou est aussi posé côté application) — autant ne pas
                  laisser croire que c'est possible. */}
              {ORDRE_SECTIONS.filter((s) => s !== "parametres" || role === "Admin principal").map((s) => (
                <label key={s} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${sections.includes(s) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}>
                  <input
                    type="checkbox"
                    checked={sections.includes(s)}
                    onChange={() => basculerSection(s)}
                    className="h-4 w-4 accent-[#131B2E]"
                  />
                  {LIBELLES_SECTIONS[s]}
                </label>
              ))}
            </div>
          </div>

          {/* AUTORISATIONS PARTICULIÈRES — des droits d'action, pas des
              onglets. Séparées visuellement pour qu'on ne les confonde
              pas avec l'accès à une page, et proposées uniquement aux
              deux rôles d'administration. */}
          {ROLES_AVEC_AUTORISATIONS.includes(role) && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Autorisations particulières
              </p>
              <div className="space-y-1.5">
                {AUTORISATIONS.map((a) => {
                  // L'Admin principal les possède d'office : on montre la
                  // case cochée et verrouillée plutôt que de laisser
                  // croire qu'on peut la lui retirer.
                  const impose = role === "Admin principal";
                  const coche = impose || sections.includes(a);
                  return (
                    <label
                      key={a}
                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                        coche ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={impose}
                        onChange={() => basculerSection(a)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
                      />
                      <span className="min-w-0">
                        {LIBELLES_AUTORISATIONS[a]}
                        {impose && <span className="ml-1 font-normal opacity-70">(toujours accordée à l&apos;Admin principal)</span>}
                        <span className="mt-0.5 block text-[10px] font-normal leading-snug opacity-80">
                          {AIDES_AUTORISATIONS[a]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={enregistrer}
            disabled={!email.trim() || enregistrementEnCours}
            className="w-full rounded-xl bg-[#131B2E] py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {enregistrementEnCours ? "Enregistrement…" : "Enregistrer ces accès"}
          </button>
        </div>
      )}

      <div className="mt-3">
        {chargement ? (
          <p className="text-xs text-slate-400">Chargement…</p>
        ) : entrees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
            Aucun accès personnalisé — chaque utilisateur suit les défauts de son rôle.
          </p>
        ) : (
          <div className="space-y-1.5">
            {entrees.map((e) => (
              <div key={e.email} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{e.email}</p>
                  <p className="truncate text-[10px] text-slate-400">
                    {e.role}
                    {e.sous_categorie ? ` · ${e.sous_categorie}` : ""} ·{" "}
                    {Array.isArray(e.sections) && e.sections.length === 0
                      ? "⛔ AUCUN ACCÈS (révoqués)"
                      : (Array.isArray(e.sections) && e.sections.length > 0 ? e.sections : permissionsPour(e.role, e.sous_categorie)).map((s) => LIBELLES_SECTIONS[s]).join(", ")}
                  </p>
                </div>
                {estVerrouillee(e) ? (
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500" title="Accès d'un administrateur — modifiable par un Admin principal seulement">
                    🔒 Admin principal requis
                  </span>
                ) : (
                  <>
                    <button onClick={() => ouvrirPour(e)} className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600">Modifier</button>
                    <button onClick={() => supprimer(e.email)} className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold text-red-500">Retirer</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
