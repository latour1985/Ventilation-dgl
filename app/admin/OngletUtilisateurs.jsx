"use client";

// app/admin/OngletUtilisateurs.jsx
//
// UTILISATEURS (fiches d'équipe, accès, invitation) — tranche T8 du
// découpage de page.jsx (2026-09-01). Extraction MÉCANIQUE : aucun
// comportement ne change, le code est déplacé tel quel — seuls des
// export/import s'ajoutent.

import { useEffect, useMemo, useState } from "react";
import { Briefcase, ChevronDown, KeyRound, Lock, Mail, Pencil, Phone, Search, Send, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { supabase } from "@/lib/supabase/client";
import { inviterEmploye } from "@/lib/comptesClient";
import { ORDRE_SECTIONS, LIBELLES_SECTIONS, AUTORISATIONS, LIBELLES_AUTORISATIONS, AIDES_AUTORISATIONS, ROLES_AVEC_AUTORISATIONS } from "@/lib/permissions";
import { Button, METIERS, TYPES_ACCES, COULEUR_TYPE_ACCES, accesParDefautPour, estMetierBureau, metiersPourTypeAcces, niveauxPourMetier } from "./partage";

export function GrilleAcces({ sections, onBasculer, desactive }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-500">Accès à l'application (coche / décoche librement)</label>
      <div className="grid grid-cols-2 gap-1.5">
        {ORDRE_SECTIONS.map((s) => (
          <label
            key={s}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
              sections.includes(s) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"
            } ${desactive ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={sections.includes(s)}
              disabled={desactive}
              onChange={() => onBasculer(s)}
              className="h-4 w-4 accent-[#131B2E]"
            />
            {LIBELLES_SECTIONS[s]}
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// APERÇU DU COURRIEL DE CONNEXION
// ============================================================
export function ApercuCourrielConnexion({ utilisateur, onFermer }) {
  const { nomLegal: nomEntreprise } = useEntreprise();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-[#FF6A13]" />
            <h3 className="text-sm font-extrabold">Lien de connexion envoyé</h3>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <p className="text-xs text-slate-400">À : {utilisateur.courriel}</p>
          <p className="mt-1 font-bold text-slate-800">Objet : Accès à l'application {nomEntreprise}</p>
          <p className="mt-2 text-slate-600">
            Bonjour {utilisateur.nom},<br /><br />
            Un accès ({utilisateur.typeAcces}) a été créé pour vous. Utilisez le lien ci-dessous pour vous connecter
            et créer votre mot de passe.
          </p>
          <p className="mt-2 truncate rounded-lg bg-slate-50 p-2 text-xs text-blue-600">
            https://app.ventilationdgl.com/connexion?u={utilisateur.nomUtilisateur}&jeton=xxxxxxxx
          </p>
          <p className="mt-2 text-xs text-slate-500">Nom d'utilisateur : <span className="font-bold">{utilisateur.nomUtilisateur}</span></p>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — l'envoi réel se fait via une fonction backend (service courriel transactionnel) avec un jeton à usage unique généré par Supabase Auth.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ONGLET UTILISATEURS
// ============================================================
// ============================================================
// FICHE PROFIL UTILISATEUR — ajout/modification des informations
// personnelles et du profil de l'employé
// ============================================================

// ============================================================
// ONGLET UTILISATEURS
// ============================================================
// ============================================================
// FICHE PROFIL UTILISATEUR — ajout/modification des informations
// personnelles et du profil de l'employé
// ============================================================
export function ModalProfilUtilisateur({ utilisateur, onFermer, onEnregistrer, onSupprimer, estAdminPrincipal, tauxMetiers }) {
  // Confirmation explicite avant suppression (2 clics).
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  // ENCADRÉ DE CHOIX (demande du propriétaire, 2026-08-18) : tout le
  // dossier de la personne dans UNE fenêtre — la fiche RH d'un côté,
  // les accès fins de l'autre (l'ancien panneau « Gestion des accès »
  // ne sert plus qu'aux accès sans fiche).
  const [ongletModal, setOngletModal] = useState("fiche");
  // La fiche d'un administrateur est INTOUCHABLE pour un Admin régulier
  // (même règle que dans Gestion des accès).
  const ficheAdministrateur = ["Admin principal", "Admin régulier", "Administrateur"].includes(utilisateur.typeAcces);
  const verrouillePourRegulier = !estAdminPrincipal && ficheAdministrateur;
  const [nom, setNom] = useState(utilisateur.nom || "");
  const [courriel, setCourriel] = useState(utilisateur.courriel || "");
  const [telephone, setTelephone] = useState(utilisateur.telephone || "");
  // Conversion des ANCIENNES valeurs de type d'accès (« Administrateur »,
  // « Employé ») vers les 5 rôles actuels — sans ça, une ancienne valeur
  // absente du menu semblait affichée correctement mais restait inchangée
  // à l'enregistrement.
  const [typeAcces, setTypeAcces] = useState(() => {
    const v = utilisateur.typeAcces;
    if (v === "Administrateur") return "Admin principal";
    if (v === "Employé") return "Technicien";
    // Anciens rôles autonomes → regroupés sous « Administration bureau ».
    if (v === "Chargé de projet" || v === "Répartiteur") return "Administration bureau";
    return TYPES_ACCES.includes(v) ? v : "Technicien";
  });
  // Métier NORMALISÉ selon le type d'accès converti : une fiche héritée
  // peut porter un métier qui n'est plus permis pour son type (ex. type
  // « Répartiteur » converti en Administration bureau avec un métier de
  // terrain) — on bascule alors sur le premier métier permis, sinon le
  // menu afficherait un choix trompeur sans changer la valeur.
  const [metier, setMetier] = useState(() => {
    const permis = metiersPourTypeAcces(typeAcces, tauxMetiers);
    return permis.includes(utilisateur.metier) ? utilisateur.metier : permis[0];
  });
  const [niveau, setNiveau] = useState(() => {
    const permis = metiersPourTypeAcces(typeAcces, tauxMetiers);
    const m = permis.includes(utilisateur.metier) ? utilisateur.metier : permis[0];
    const niveaux = niveauxPourMetier(m);
    return niveaux.includes(utilisateur.niveau) ? utilisateur.niveau : niveaux[0];
  });
  // Taux horaire INDIVIDUEL (métiers de bureau) et PRIME horaire
  // individuelle (métiers de terrain — s'ajoute à la grille CCQ).
  const [tauxHoraire, setTauxHoraire] = useState(utilisateur.tauxHoraire ?? 0);
  const [primeHoraire, setPrimeHoraire] = useState(utilisateur.primeHoraire ?? 0);
  // 💼 Droit acquis : payé au taux COMMERCIAL peu importe le secteur.
  const [toujoursCommercial, setToujoursCommercial] = useState(!!utilisateur.toujoursCommercial);
  const [poste, setPoste] = useState(utilisateur.poste || "");
  const [dateEmbauche, setDateEmbauche] = useState(utilisateur.dateEmbauche || "");
  const [adresse, setAdresse] = useState(utilisateur.adresse || "");
  const [notesRH, setNotesRH] = useState(utilisateur.notesRH || "");

  // GRILLE DES ACCÈS intégrée à la fiche : démarre sur les défauts du
  // type/métier, puis se remplace par les accès RÉELS du compte (table
  // permissions_utilisateurs) dès qu'ils sont chargés.
  const [sectionsAcces, setSectionsAcces] = useState(() => accesParDefautPour(
    (() => {
      const v = utilisateur.typeAcces;
      if (v === "Administrateur") return "Admin principal";
      if (v === "Employé") return "Technicien";
      if (v === "Chargé de projet" || v === "Répartiteur") return "Administration bureau";
      return TYPES_ACCES.includes(v) ? v : "Technicien";
    })(),
    utilisateur.metier
  ));
  useEffect(() => {
    const c = (utilisateur.courriel || "").trim().toLowerCase();
    if (!c) return;
    supabase
      .from("permissions_utilisateurs")
      .select("sections")
      .eq("email", c)
      .maybeSingle()
      .then(({ data }) => {
        if (Array.isArray(data?.sections)) setSectionsAcces(data.sections);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const basculerSectionAcces = (s) =>
    setSectionsAcces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const changerMetier = (m) => {
    setMetier(m);
    setNiveau(niveauxPourMetier(m)[0]);
    // Changer la sous-catégorie recharge ses accès par défaut.
    if (typeAcces === "Administration bureau") setSectionsAcces(accesParDefautPour(typeAcces, m));
  };

  // Le type d'accès et le métier restent cohérents : choisir
  // « Administration bureau » bascule sur un métier de bureau (sa
  // sous-catégorie), « Technicien » sur un métier de terrain.
  const changerTypeAcces = (t) => {
    setTypeAcces(t);
    const permis = metiersPourTypeAcces(t, tauxMetiers);
    const metierFinal = permis.includes(metier) ? metier : permis[0];
    if (metierFinal !== metier) {
      setMetier(metierFinal);
      setNiveau(niveauxPourMetier(metierFinal)[0]);
    }
    setSectionsAcces(accesParDefautPour(t, metierFinal));
  };

  const peutEnregistrer = nom.trim().length > 0 && courriel.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Profil de l'employé</h3>
            <p className="text-xs text-slate-500">@{utilisateur.nomUtilisateur}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {/* L'encadré de choix : Fiche employé ↔ Accès */}
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {[["fiche", "👤 Fiche employé"], ["acces", "🔑 Accès"]].map(([id, libelle]) => (
            <button
              key={id}
              onClick={() => setOngletModal(id)}
              className={`rounded-lg py-2 text-xs font-extrabold ${ongletModal === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {libelle}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {ongletModal === "fiche" && (<>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom complet</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Type d'accès</label>
              <select
                value={typeAcces}
                onChange={(e) => changerTypeAcces(e.target.value)}
                disabled={verrouillePourRegulier}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400"
              >
                {(estAdminPrincipal || verrouillePourRegulier ? TYPES_ACCES : TYPES_ACCES.filter((t) => t !== "Admin principal" && t !== "Admin régulier")).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">Enregistrer la fiche règle aussi les ACCÈS de ce compte (type + métier). Ajustements fins : onglet « 🔑 Accès » ci-dessus.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">
                Métier{typeAcces === "Administration bureau" ? " (sous-catégorie)" : ""}
              </label>
              <select value={metier} onChange={(e) => changerMetier(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                {metiersPourTypeAcces(typeAcces, tauxMetiers).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {estMetierBureau(metier) ? (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Taux horaire ($/h)</label>
                <InputNombreDecimal
                  valeur={tauxHoraire || 0}
                  onChange={(v) => setTauxHoraire(v)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                />
                <p className="mt-1 text-[10px] text-slate-400">Taux individuel — figé sur chaque heure au moment de la saisie.</p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Niveau</label>
                <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                  {niveauxPourMetier(metier).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
          {!estMetierBureau(metier) && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Prime horaire (+ $/h) — entente individuelle</label>
              <InputNombreDecimal
                valeur={primeHoraire || 0}
                onChange={(v) => setPrimeHoraire(v)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                S'ajoute à la grille CCQ (Tarifs). Taux coûtant réel = grille {metier} · {niveau} + prime. 0 = aucune entente.
              </p>
              <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700">
                <input type="checkbox" checked={toujoursCommercial} onChange={(e) => setToujoursCommercial(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#131B2E]" />
                <span>
                  💼 Payé au taux <span className="font-extrabold">COMMERCIAL en tout temps</span> (droit acquis)
                  <span className="block text-[10px] font-normal text-slate-400">
                    Même sur une tâche résidentielle, ses heures se figent au taux commercial — la feuille de temps suit sa paie réelle.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Courriel</label>
              <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
              <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Informations personnelles</p>
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Poste / fonction</label>
                <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Ex: Technicien senior" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Date d'embauche</label>
                  <input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Adresse</label>
                  <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Optionnel" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Notes internes (RH)</label>
                <textarea
                  value={notesRH}
                  onChange={(e) => setNotesRH(e.target.value)}
                  rows={3}
                  placeholder="Notes visibles seulement par les administrateurs"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          </>)}

          {/* ONGLET ACCÈS — la grille fine + les autorisations
              particulières (l'ancien panneau « Gestion des accès »,
              maintenant DANS le dossier de la personne). */}
          {ongletModal === "acces" && (<>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
            Le type d&apos;accès et le métier se choisissent dans la fiche — ici tu ajustes finement les sections
            visibles et les autorisations. Les changements prennent effet à sa <span className="font-bold">prochaine connexion</span>.
          </p>
          <GrilleAcces sections={sectionsAcces} onBasculer={basculerSectionAcces} desactive={verrouillePourRegulier} />
          {ROLES_AVEC_AUTORISATIONS.includes(typeAcces) && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Autorisations particulières</p>
              <div className="space-y-1.5">
                {AUTORISATIONS.map((a) => {
                  // L'Admin principal les possède d'office : case cochée
                  // et verrouillée plutôt que de laisser croire qu'on
                  // peut la lui retirer.
                  const impose = typeAcces === "Admin principal";
                  const coche = impose || sectionsAcces.includes(a);
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
                        disabled={impose || verrouillePourRegulier}
                        onChange={() => basculerSectionAcces(a)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
                      />
                      <span className="min-w-0">
                        {LIBELLES_AUTORISATIONS[a]}
                        {impose && <span className="ml-1 font-normal opacity-70">(toujours accordée à l&apos;Admin principal)</span>}
                        <span className="mt-0.5 block text-[10px] font-normal leading-snug opacity-80">{AIDES_AUTORISATIONS[a]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          </>)}

          <Button
            onClick={() =>
              onEnregistrer({
                nom,
                courriel,
                telephone,
                typeAcces,
                metier,
                niveau,
                // Métier de bureau : taux individuel (pas de prime) ;
                // métier de terrain : prime au-dessus de la grille CCQ.
                tauxHoraire: estMetierBureau(metier) ? Number(tauxHoraire) || 0 : null,
                primeHoraire: !estMetierBureau(metier) ? Number(primeHoraire) || 0 : null,
                toujoursCommercial: !estMetierBureau(metier) && toujoursCommercial,
                sectionsAcces,
                poste,
                dateEmbauche,
                adresse,
                notesRH,
              })
            }
            className="w-full"
            disabled={!peutEnregistrer || verrouillePourRegulier}
          >
            Enregistrer les modifications
          </Button>

          {verrouillePourRegulier && (
            <p className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
              <Lock size={12} className="shrink-0" /> Fiche d'un administrateur — modifiable par un Admin principal seulement.
            </p>
          )}

          {/* SUPPRESSION DE LA FICHE — retire l'employé du répertoire (et
              de l'agenda) et RÉVOQUE immédiatement tous ses accès.
              Confirmation en 2 clics. */}
          {onSupprimer && !verrouillePourRegulier && (
            confirmeSuppression ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                <p className="text-xs font-bold text-red-700">
                  Supprimer définitivement la fiche de {utilisateur.nom} ? Tous ses accès seront révoqués immédiatement (il ne pourra plus ouvrir ni l'admin ni l'app technicien).
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="danger" onClick={onSupprimer} className="min-h-0 flex-1 py-2 text-xs">
                    Oui, supprimer et révoquer les accès
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmeSuppression(false)} className="min-h-0 flex-1 py-2 text-xs">
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmeSuppression(true)} className="w-full min-h-0 border-red-200 py-2 text-xs text-red-600">
                <Trash2 size={13} /> Supprimer la fiche de l'employé…
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}


export function OngletUtilisateurs({ utilisateurs, setUtilisateurs, ajouterJournal, tauxMetiers, persisterUtilisateur, supprimerUtilisateur, estAdminPrincipal }) {
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [typeAcces, setTypeAcces] = useState("Technicien");
  const [metier, setMetier] = useState(METIERS[0]);
  const [niveau, setNiveau] = useState(niveauxPourMetier(METIERS[0])[0]);
  // Taux individuel (métiers de bureau) / prime au-dessus de la grille
  // CCQ (métiers de terrain) — saisis dès la création de la fiche.
  const [tauxHoraire, setTauxHoraire] = useState(0);
  const [primeHoraire, setPrimeHoraire] = useState(0);
  const [toujoursCommercial, setToujoursCommercial] = useState(false);
  const [courrielAperçu, setCourrielAperçu] = useState(null);
  const [utilisateurOuvertId, setUtilisateurOuvertId] = useState(null);
  // 🔎 LISTE MAÎTRISÉE (demande du propriétaire, 2026-08-18) : la liste
  // défilait à l'infini. Recherche + filtre par type d'accès, fiches
  // REPLIÉES (nom + rôle) — le détail et les boutons s'ouvrent au tap.
  const [rechercheU, setRechercheU] = useState("");
  const [filtreAcces, setFiltreAcces] = useState("tous");
  const [uDeplie, setUDeplie] = useState(null);
  const utilisateursAffiches = useMemo(() => {
    const q = rechercheU.trim().toLowerCase();
    return utilisateurs
      .filter((u) => filtreAcces === "tous" || u.typeAcces === filtreAcces)
      .filter(
        (u) =>
          !q ||
          [u.nom, u.nomUtilisateur, u.courriel, u.telephone, u.metier, u.poste]
            .filter(Boolean)
            .some((c) => String(c).toLowerCase().includes(q))
      )
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  }, [utilisateurs, rechercheU, filtreAcces]);

  // GRILLE DES ACCÈS dans le formulaire de création : suit le type
  // d'accès + métier choisis, ajustable case par case avant de créer.
  const [sectionsAcces, setSectionsAcces] = useState(accesParDefautPour("Technicien"));
  const basculerSectionAcces = (s) =>
    setSectionsAcces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const changerMetier = (m) => {
    setMetier(m);
    setNiveau(niveauxPourMetier(m)[0]); // le niveau doit rester valide pour le métier
    if (typeAcces === "Administration bureau") setSectionsAcces(accesParDefautPour(typeAcces, m));
  };

  // Type d'accès et métier restent cohérents (voir metiersPourTypeAcces).
  const changerTypeAcces = (t) => {
    setTypeAcces(t);
    const permis = metiersPourTypeAcces(t, tauxMetiers);
    const metierFinal = permis.includes(metier) ? metier : permis[0];
    if (metierFinal !== metier) {
      setMetier(metierFinal);
      setNiveau(niveauxPourMetier(metierFinal)[0]);
    }
    setSectionsAcces(accesParDefautPour(t, metierFinal));
  };

  const reinitialiserFormulaire = () => {
    setNom("");
    setTelephone("");
    setCourriel("");
    setNomUtilisateur("");
    setTypeAcces("Technicien");
    setMetier(METIERS[0]);
    setNiveau(niveauxPourMetier(METIERS[0])[0]);
    setTauxHoraire(0);
    setPrimeHoraire(0);
    setSectionsAcces(accesParDefautPour("Technicien"));
  };

  const peutCreer = nom.trim() && courriel.trim() && nomUtilisateur.trim();

  // RÉSULTAT D'UNE INVITATION — un seul interprète pour les trois
  // gestes (créer, renvoyer, réinitialiser). Le journal ne dit
  // « envoyé » que si c'est VRAI ; en mode simulé (local) ou si le
  // courriel rate, le lien est copié dans le presse-papier de l'admin
  // pour transmission manuelle — jamais de trou noir.
  const journaliserInvitation = async (r, cible, contexte) => {
    if (r?.envoye) {
      ajouterJournal(
        `📧 ${contexte} — ${r.nouveau ? `compte créé et invitation envoyée à ${cible.courriel} (il choisit son mot de passe via le lien)` : `lien de réinitialisation envoyé à ${cible.courriel}`}`
      );
    } else if (r?.lien) {
      let copie = false;
      try {
        await navigator.clipboard?.writeText(r.lien);
        copie = true;
      } catch {
        window.prompt("Copie ce lien et transmets-le à l'employé :", r.lien);
      }
      ajouterJournal(
        `🔗 ${contexte} — ${r.simule ? "service de courriels non configuré ici (normal en local)" : `courriel NON parti (${r.erreur || "erreur"})`} ; le lien « choisir mot de passe » de ${cible.courriel} ${copie ? "est COPIÉ dans ton presse-papier" : "t'a été montré"} — transmets-le-lui.`
      );
    } else {
      ajouterJournal(`⚠️ ${contexte} — compte de connexion NON créé pour ${cible.courriel} : ${r?.erreur || "erreur inconnue"}.`);
    }
  };

  const creerUtilisateur = async () => {
    if (!peutCreer) return;
    const nouvel = {
      id: `u-${Date.now()}`,
      nom: nom.trim(),
      telephone: telephone.trim(),
      courriel: courriel.trim(),
      nomUtilisateur: nomUtilisateur.trim().toLowerCase(),
      typeAcces,
      metier,
      niveau,
      tauxHoraire: estMetierBureau(metier) ? Number(tauxHoraire) || 0 : null,
      primeHoraire: !estMetierBureau(metier) ? Number(primeHoraire) || 0 : null,
      toujoursCommercial: !estMetierBureau(metier) && toujoursCommercial,
      sectionsAcces,
      motDePasseCree: false,
    };
    setUtilisateurs((prev) => [...prev, nouvel]);
    // Persistance Supabase : l'employé survit aux rechargements et
    // apparaît durablement dans l'agenda (et la synchro des tâches).
    persisterUtilisateur?.(nouvel);
    ajouterJournal(`👤 Fiche "${nouvel.nom}" créée (${typeAcces})`);
    setFormulaireOuvert(false);
    reinitialiserFormulaire();
    // Le VRAI compte de connexion + l'invitation — la route serveur
    // fait tout (Auth + rôle en métadonnées + courriel Resend).
    if (nouvel.courriel) {
      const r = await inviterEmploye({
        courriel: nouvel.courriel,
        nom: nouvel.nom,
        role: nouvel.typeAcces,
        sousCategorie: nouvel.typeAcces === "Administration bureau" ? nouvel.metier : null,
      });
      await journaliserInvitation(r, nouvel, "Invitation");
    } else {
      ajouterJournal(`⚠️ "${nouvel.nom}" n'a pas de courriel — aucun compte de connexion créé. Ajoute son courriel puis « Renvoyer le lien ».`);
    }
  };

  const envoyerLienConnexion = async (u) => {
    const r = await inviterEmploye({
      courriel: u.courriel,
      nom: u.nom,
      role: u.typeAcces,
      sousCategorie: u.typeAcces === "Administration bureau" ? u.metier : null,
    });
    await journaliserInvitation(r, u, `Lien de connexion pour ${u.nom}`);
  };

  const reinitialiserMotDePasse = async (id) => {
    setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, motDePasseCree: false } : u)));
    const u = utilisateurs.find((x) => x.id === id);
    if (!u) return;
    const r = await inviterEmploye({ courriel: u.courriel, nom: u.nom, role: u.typeAcces });
    await journaliserInvitation(r, u, `Réinitialisation du mot de passe de ${u.nom}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Utilisateurs</h2>

      {/* "NOUVEL UTILISATEUR" — toujours en premier */}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white">
        <button
          onClick={() => setFormulaireOuvert((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6A13]/10">
            <UserPlus size={18} className="text-[#FF6A13]" />
          </div>
          <span className="font-bold text-slate-800">Nouvel utilisateur</span>
        </button>

        {formulaireOuvert && (
          <div className="space-y-3 border-t border-slate-200 p-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom complet</label>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Type d'accès</label>
              <select
                value={typeAcces}
                onChange={(e) => changerTypeAcces(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                {(estAdminPrincipal ? TYPES_ACCES : TYPES_ACCES.filter((t) => t !== "Admin principal" && t !== "Admin régulier")).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">Créer la fiche règle aussi les ACCÈS de ce compte (type + métier). Ajustements fins : bouton Modifier de la fiche → onglet « 🔑 Accès ».</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">
                  Métier{typeAcces === "Administration bureau" ? " (sous-catégorie)" : ""}
                </label>
                <select
                  value={metier}
                  onChange={(e) => changerMetier(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  {metiersPourTypeAcces(typeAcces, tauxMetiers).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              {estMetierBureau(metier) ? (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Taux horaire ($/h)</label>
                  <InputNombreDecimal
                    valeur={tauxHoraire || 0}
                    onChange={(v) => setTauxHoraire(v)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Niveau</label>
                  <select
                    value={niveau}
                    onChange={(e) => setNiveau(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                  >
                    {niveauxPourMetier(metier).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {!estMetierBureau(metier) && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Prime horaire (+ $/h) — entente individuelle (0 = aucune)</label>
                <InputNombreDecimal
                  valeur={primeHoraire || 0}
                  onChange={(v) => setPrimeHoraire(v)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                />
                <p className="mt-1 text-[10px] text-slate-400">S'ajoute à la grille CCQ (onglet Tarifs) pour cet employé seulement.</p>
                <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700">
                  <input type="checkbox" checked={toujoursCommercial} onChange={(e) => setToujoursCommercial(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#131B2E]" />
                  <span>
                    💼 Payé au taux <span className="font-extrabold">COMMERCIAL en tout temps</span> (droit acquis)
                    <span className="block text-[10px] font-normal text-slate-400">
                      Même sur une tâche résidentielle, ses heures se figent au taux commercial — la feuille de temps suit sa paie réelle.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {/* GESTION DES ACCÈS directement à la création : la grille suit
                le type d'accès + métier, ajustable case par case. */}
            <GrilleAcces sections={sectionsAcces} onBasculer={basculerSectionAcces} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Courriel</label>
                <input
                  type="email"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom d'utilisateur</label>
              <input
                value={nomUtilisateur}
                onChange={(e) => setNomUtilisateur(e.target.value)}
                placeholder="Ex: jtremblay"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <Button onClick={creerUtilisateur} disabled={!peutCreer} className="w-full">
              Créer l'utilisateur et envoyer le lien de connexion
            </Button>
          </div>
        )}
      </div>

      {/* RECHERCHE + FILTRE — la liste défilait à l'infini (2026-08-18). */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={rechercheU}
            onChange={(e) => setRechercheU(e.target.value)}
            placeholder="Chercher un nom, courriel, téléphone, métier…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["tous", ...TYPES_ACCES.filter((t) => utilisateurs.some((u) => u.typeAcces === t))].map((t) => (
            <button
              key={t}
              onClick={() => setFiltreAcces(t)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                filtreAcces === t ? "bg-[#131B2E] text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {t === "tous"
                ? `Tous (${utilisateurs.length})`
                : `${t} (${utilisateurs.filter((u) => u.typeAcces === t).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* LISTE DES UTILISATEURS — fiches repliées : le détail (contacts,
          statut, boutons) s'ouvre au tap sur la ligne. */}
      <div className="space-y-2">
        {utilisateursAffiches.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-400">
            Aucun utilisateur ne correspond à cette recherche.
          </p>
        )}
        {utilisateursAffiches.map((u) => {
          const ouvert = uDeplie === u.id;
          return (
          <div key={u.id} className="rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => setUDeplie(ouvert ? null : u.id)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{u.nom}</p>
                <p className="truncate text-xs text-slate-400">
                  @{u.nomUtilisateur}
                  {u.metier ? ` · ${u.metier}` : u.poste ? ` · ${u.poste}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {!u.motDePasseCree && (
                  <span title="En attente de première connexion" className="h-2 w-2 rounded-full bg-amber-400" />
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${COULEUR_TYPE_ACCES[u.typeAcces] || "bg-slate-100 text-slate-600"}`}>
                  {u.typeAcces}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${ouvert ? "rotate-180" : ""}`} />
              </span>
            </button>
            {ouvert && (
              <div className="border-t border-slate-100 p-3.5 pt-2.5">
                <div className="space-y-0.5 text-xs text-slate-500">
                  {u.poste && <div className="flex items-center gap-1.5"><Briefcase size={11} /> {u.poste}</div>}
                  {u.courriel && <div className="flex items-center gap-1.5"><Mail size={11} /> {u.courriel}</div>}
                  {u.telephone && <div className="flex items-center gap-1.5"><Phone size={11} /> {u.telephone}</div>}
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={11} />
                    {u.motDePasseCree ? "Mot de passe déjà créé" : "En attente de première connexion"}
                  </div>
                  {u.metier && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={11} /> {u.metier} · {u.niveau}
                      {Number(tauxMetiers?.[u.metier]?.[u.niveau]) > 0
                        ? ` · ${Number(tauxMetiers[u.metier][u.niveau]).toFixed(2)} $/h`
                        : " · taux à saisir"}
                    </div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={() => setUtilisateurOuvertId(u.id)} className="min-h-0 py-1.5 text-xs">
                    <Pencil size={12} /> Modifier
                  </Button>
                  <Button variant="outline" onClick={() => reinitialiserMotDePasse(u.id)} className="min-h-0 py-1.5 text-xs">
                    <KeyRound size={12} /> Mot de passe
                  </Button>
                  <Button onClick={() => envoyerLienConnexion(u)} className="min-h-0 py-1.5 text-xs">
                    <Send size={12} /> Lien
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {courrielAperçu && <ApercuCourrielConnexion utilisateur={courrielAperçu} onFermer={() => setCourrielAperçu(null)} />}
      {utilisateurOuvertId && (
        <ModalProfilUtilisateur
          tauxMetiers={tauxMetiers}
          utilisateur={utilisateurs.find((u) => u.id === utilisateurOuvertId)}
          estAdminPrincipal={estAdminPrincipal}
          onFermer={() => setUtilisateurOuvertId(null)}
          onEnregistrer={(champs) => {
            const existant = utilisateurs.find((u) => u.id === utilisateurOuvertId);
            setUtilisateurs((prev) => prev.map((u) => (u.id === utilisateurOuvertId ? { ...u, ...champs } : u)));
            if (existant) persisterUtilisateur?.({ ...existant, ...champs });
            ajouterJournal(`✏️ Profil de ${champs.nom || existant?.nom} mis à jour`);
            setUtilisateurOuvertId(null);
          }}
          onSupprimer={() => {
            const existant = utilisateurs.find((u) => u.id === utilisateurOuvertId);
            if (existant) supprimerUtilisateur?.(existant);
            setUtilisateurOuvertId(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// TABLEAU DE BORD D'UN PROJET (rentabilité en temps réel)
// ============================================================
// ============================================================
// ONGLETS DU TABLEAU DE BORD PROJET — sous-composants extraits pour
// alléger ModalDetailProjet et permettre à chaque onglet de ne
// recevoir que les données dont il a besoin.
// ============================================================
