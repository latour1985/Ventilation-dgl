"use client";

// app/admin/partage.jsx
//
// LE SOCLE COMMUN de l'application d'administration — première tranche
// du DÉCOUPAGE de page.jsx (2026-08-28, ~24 300 lignes au départ).
// Ici vivent les constantes, les petits utilitaires PURS et les
// composants génériques que plusieurs onglets partagent. Extraction
// MÉCANIQUE : aucun comportement ne change, le code est déplacé tel
// quel — seuls des `export`/`import` s'ajoutent.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, FileCheck2, Loader2, MapPin, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { ZONES_DEPOTS, zonesDepuis } from "@/lib/supabase/prixDepots";
import { permissionsPour } from "@/lib/permissions";
import { supabase } from "@/lib/supabase/client";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { calculerTaxes } from "@/lib/supabase/entreprise";
import { googlePlacesDisponible, nouveauJeton, chercherAdresses, detailsAdresse } from "@/lib/googlePlaces";
import { listerLegendes, sauvegarderLegende } from "@/lib/supabase/photosTravaux";
import TermesConditions from "@/components/TermesConditions";
import VisionneusePhotos from "@/components/VisionneusePhotos";
// ⚠️ Cycle assumé partage ↔ OngletParametres : les deux ne se lisent
// qu'au RENDU (composants), jamais à l'initialisation du module — le
// même patron que page.jsx ↔ modules extraits.
import { EnTeteEntreprise, PiedDocument } from "./OngletParametres";
import { SEUIL_ENTRETIEN_KM, SEUIL_ENTRETIEN_MOIS } from "./OngletInspectionsVehicules";

// ============================================================
// COMPOSANT BOUTON RÉUTILISABLE
// Variantes : primary (noir plein — validation/création/soumission),
// outline (bordure — action secondaire/filtre), danger (rouge —
// suppression). Gère aussi l'état loading (spinner) et disabled.
// En prod, ce composant vit dans components/ui/Button.jsx et est
// importé — ici, dans cet artefact autonome, il est défini localement
// dans chaque fichier (voir le fichier Button.jsx fourni séparément
// pour la version destinée à un vrai projet Next.js).
// ============================================================
export function Button({ variant = "primary", loading = false, loadingText = "Chargement...", disabled = false, className = "", children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold min-h-[44px] touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed";
  const variantes = {
    primary: "bg-black text-white hover:bg-zinc-800 active:bg-zinc-950 disabled:bg-zinc-300 disabled:text-zinc-500",
    outline: "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-zinc-300 disabled:text-zinc-500",
  };
  return (
    <button disabled={disabled || loading} className={`${base} ${variantes[variant]} ${className}`} {...props}>
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// InputNombreDecimal vit maintenant dans components/ (partagé avec l'app
// technicien) — importé en haut de ce fichier.


// ============================================================
// DONNÉES SIMULÉES (à remplacer par Supabase + API QuickBooks)
// Contrairement à l'app technicien, ici le prix_coutant EST
// exposé : c'est l'écran admin.
// ============================================================
// Repli tant que le catalogue Supabase n.est pas chargé (snippet 26).
// La vraie liste — 289 items importés de QuickBooks — vit maintenant
// dans la table `catalogue_items`, voir lib/supabase/catalogue.js.

// La grille couvre les 24h de la journée dans l'ordre chronologique
// naturel (00:00 → 23:00). L'ouverture par défaut fait défiler la
// vue Jour jusqu'à 7h00 (voir l'effet de scroll dans OngletAgenda),
// mais l'admin peut toujours se déplacer librement vers la gauche
// (heures plus tôt) ou la droite (heures plus tard) au besoin.
export const HEURES = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
// QUARTS D'HEURE (retour de tests 2026-08-10) : l'heure de début se
// choisit à 15 minutes près (09:15, 09:30…). La GRILLE, elle, reste en
// cases d'une heure : une tâche à 09:15 occupe la case de 9 h, et les
// minutes réelles restent affichées partout où l'heure apparaît.

// Case horaire d'une heure de début — tolère les quarts d'heure.
export const indexCaseHeure = (h) => HEURES.indexOf(`${String(h || "").slice(0, 2)}:00`);

// NOM AFFICHÉ d'un client (retour de tests 2026-08-10) : quand une fiche
// porte un nom ET une entreprise, l'admin choisit ce que les listes
// montrent — le nom, l'entreprise, ou les deux.

// Numéro de repli, utilisé UNIQUEMENT si la base est injoignable. La
// vraie numérotation est séquentielle et vient de Supabase (compteurs) —
// voir lib/supabase/compteurs.js. Le préfixe « HORS-LIGNE » rend le cas
// visible : ces numéros sont à corriger manuellement.
export function genererNumeroSecours(prefixe) {
  return `${prefixe}-HORS-LIGNE-${Date.now().toString().slice(-6)}`;
}
// Récupère le courriel par défaut d'un client (celui marqué `defaut`,
// sinon le premier de la liste) — utilisé partout où l'ancien champ
// unique `client.courriel` servait de repli avant l'envoi d'un
// document, quand aucune sélection explicite n'a encore été faite.

export function todayISO() {
  // Même règle que dateISO : la « date du jour » est la date LOCALE.
  return dateISO(new Date());
}

// Compression d'une image jointe à une tâche — mêmes réglages que l'app
// technicien (1600 px / qualité 80 %) : assez pour lire un plan annoté
// ou une plaque signalétique, sans téléverser des originaux de 8 Mo.

// Nombre de jours écoulés depuis une date "AAAA-MM-JJ". Au niveau MODULE
// parce que deux écrans s'en servent (la carte « État des véhicules » et
// le dossier d'un camion) : en le laissant local au premier, le second
// plantait sur « joursDepuis is not defined » dès qu'une anomalie était
// ouverte.
export function joursDepuis(d) {
  if (!d) return 0;
  return Math.max(0, Math.round((new Date(`${todayISO()}T00:00:00`) - new Date(`${String(d).slice(0, 10)}T00:00:00`)) / 86400000));
}

// Destinataires choisis dans ModalSelectionCourriel (choix MULTIPLE) —
// tolère aussi un objet seul (anciens appels). Retourne toujours une liste.

// DIMANCHE de la semaine de paie (dimanche→samedi) d'une date — accepte
// une date « AAAA-MM-JJ » ou un horodatage ISO complet. Sert à décider si
// une correction d'heures est TARDIVE (semaine de paie déjà passée) et à
// quelle semaine son report appartient.
export function dimancheDeSemaineISO(d) {
  const dt =
    typeof d === "string"
      ? d.includes("T")
        ? new Date(d) // horodatage complet → converti en heure locale
        : new Date(`${d}T00:00:00`) // date seule → minuit local
      : new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - dt.getDay());
  return dateISO(dt);
}

// ------------------------------------------------------------
// PERSISTANCE DU JOURNAL D'ACTIVITÉ (audit trail)
// ------------------------------------------------------------
// En prod, chaque entrée du journal correspond à une écriture dans
// une table Supabase `journal_audit` (append-only, jamais modifiable
// ni supprimable depuis le client), conformément à l'exigence Loi 25
// de traçabilité des accès/modifications. Ici, en attendant le
// branchement réel, on persiste au moins dans localStorage pour que
// l'historique survive à un rechargement de page plutôt que d'être
// perdu à chaque fois.

export function dateISO(d) {
  // Date LOCALE (Québec), jamais UTC : avec toISOString(), entre ~20 h et
  // minuit heure locale, la date bascule déjà sur « demain » — toutes les
  // clés de l'agenda (placements, drag & drop, envoi aux techniciens)
  // partaient alors sur le mauvais jour. L'app technicien calcule déjà
  // ses dates en local (isoLocal) : les deux doivent rester identiques.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

export function ajouterJours(d, n) {
  const copie = new Date(d);
  copie.setDate(copie.getDate() + n);
  return copie;
}

// ------------------------------------------------------------
// ADRESSE DE FACTURATION D'UN CLIENT — la règle du propriétaire :
// « l'adresse de facturation est l'adresse PRINCIPALE du client ».
// Ordre : le champ explicite (grand formulaire) → sinon la PREMIÈRE
// adresse de la fiche (la principale) → sinon rien (vrai manquant).
// Un client créé par un chemin rapide puis complété après coup n'affiche
// plus jamais « adresse manquante » alors que sa fiche en a une.
// ------------------------------------------------------------

export function moisDepuis(iso) {
  if (!iso) return Infinity;
  const d = new Date(`${iso}T00:00:00`);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

// Camions dont l'entretien périodique est DÛ (10 000 km depuis le dernier
// entretien OU 6 mois écoulés) — même règle que l'onglet Inspections,
// réutilisée par la tuile « Entretiens camions » du tableau de bord.

// PHOTOS D'UNE FICHE D'INSPECTION — vignettes cliquables (elles
// s'ouvrent en pleine taille dans un onglet). Une anomalie décrite par
// écrit reste vague ; la photo dit tout de suite s'il faut sortir le
// camion de la route ou attendre le prochain entretien.
export function PhotosInspection({ photos }) {
  const liste = (photos || []).filter(Boolean);
  if (liste.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Camera size={10} /> {liste.length} photo{liste.length > 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {liste.map((url, idx) => (
          <a
            key={url + idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Ouvrir en pleine taille"
            className="block overflow-hidden rounded-lg border border-slate-200 hover:border-slate-400"
          >
            <img src={url} alt={`Anomalie ${idx + 1}`} loading="lazy" decoding="async" className="h-16 w-20 object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ONGLET PIÈCES EN COMMANDE
// ------------------------------------------------------------
// Le pont entre le diagnostic et la réparation. Une pièce manquante
// bloque la 2e visite : tant qu'elle n'est pas arrivée (et payée si le
// paiement est exigé), la tâche de retour ne peut pas aller à l'horaire.
//
// DEUX NIVEAUX D'ACCÈS :
//   • Les administrateurs COMMANDENT (bon de commande, réception, annulation)
//   • Répartiteur et chargé de projet VOIENT seulement — pour répondre
//     au client qui appelle savoir où en est sa pièce. Voir n'est pas
//     commander : deux personnes qui commandent, c'est deux commandes.
//
// Le compteur de JOURS est ce qui fait relancer un fournisseur qui
// traîne : une pièce commandée depuis trois semaines doit crier.
// ============================================================
export const STATUTS_PIECE = {
  a_commander: { label: "À commander", cls: "bg-red-100 text-red-700 border-red-300" },
  commandee: { label: "Commandée", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  facture_recue: { label: "Facture reçue — vérifier", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  recue: { label: "Reçue", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  annulee: { label: "Annulée", cls: "bg-slate-100 text-slate-500 border-slate-300" },
};

// ============================================================
// 📄 BARRE DE PAGINATION RÉUTILISABLE (2026-08-26)
// ------------------------------------------------------------
// Demande du propriétaire : « 10 items max par page, puis 1 2 3 4… le
// nombre nécessaire ». Les longues listes (64 pièces empilées…)
// devenaient des murs à défiler. Utilisée par : Pièces en commande,
// Facturation, Devis, Clients, BC libres — 10 par page partout.
//   • moins de 2 pages → la barre ne s'affiche pas du tout ;
//   • plus de 9 pages → fenêtre condensée « 1 … 4 [5] 6 … 12 » (sinon
//     la barre serait elle-même un mur) ;
//   • changer de page remonte l'écran au haut de la liste (refHaut).
// L'appelant garde sa page dans SON état et BORNE lui-même la valeur
// (Math.min) : une liste qui rétrécit ne laisse jamais une page vide.
// ============================================================
export const ITEMS_PAR_PAGE = 10;

export function BarrePagination({ total, page, onPage, refHaut = null, libelle = "items", parPage = ITEMS_PAR_PAGE }) {
  const nbPages = Math.max(1, Math.ceil(total / parPage));
  if (nbPages <= 1) return null;
  const courante = Math.min(page, nbPages);
  const numeros = [];
  if (nbPages <= 9) {
    for (let i = 1; i <= nbPages; i++) numeros.push(i);
  } else {
    numeros.push(1);
    if (courante > 3) numeros.push("…g");
    for (let i = Math.max(2, courante - 1); i <= Math.min(nbPages - 1, courante + 1); i++) numeros.push(i);
    if (courante < nbPages - 2) numeros.push("…d");
    numeros.push(nbPages);
  }
  const aller = (p) => {
    onPage(Math.min(nbPages, Math.max(1, p)));
    refHaut?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => aller(courante - 1)}
          disabled={courante <= 1}
          aria-label="Page précédente"
          className="flex h-8 min-w-[32px] items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-30"
        >
          ◀
        </button>
        {numeros.map((n) =>
          typeof n === "string" ? (
            <span key={n} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={n}
              onClick={() => aller(n)}
              className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg px-1.5 text-xs font-bold ${
                n === courante ? "bg-[#131B2E] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          onClick={() => aller(courante + 1)}
          disabled={courante >= nbPages}
          aria-label="Page suivante"
          className="flex h-8 min-w-[32px] items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-30"
        >
          ▶
        </button>
      </div>
      <p className="text-[11px] tabular-nums text-slate-400">
        {total} {libelle} — page {courante} de {nbPages}
      </p>
    </div>
  );
}

// ============================================================
// 🔎 SÉLECTEUR DE RATTACHEMENT AVEC RECHERCHE (2026-08-26)
// ------------------------------------------------------------
// Les listes de clients et de tâches s'allongent : dérouler un <select>
// ne suffisait plus (demande du propriétaire). On TAPE quelques lettres
// — ou on clique pour voir toute la liste — et les familles restent
// groupées : Tâches (jobs) / Clients / Projets. La valeur garde le même
// encodage qu'avant : "" | "t:id" | "c:id" | "p:id".
// ============================================================
export function SelecteurCibleAchat({ valeur, onChoisir, taches = [], clients = [], projets = [], libelleRepli = "", className = "" }) {
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const boiteRef = useRef(null);
  // Clic hors de la boîte = fermeture (sans rien choisir).
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => {
      if (boiteRef.current && !boiteRef.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);
  const f = filtre.trim().toLowerCase();
  const garde = (texte) => !f || String(texte || "").toLowerCase().includes(f);
  // Plafond par famille : au-delà, taper une lettre de plus est plus
  // rapide que défiler — et la liste reste fluide.
  const tachesVisibles = taches.filter((t) => garde(`${t.clientNom} ${t.titre}`)).slice(0, 25);
  const clientsVisibles = clients.filter((c) => garde(c.nom)).slice(0, 25);
  const projetsVisibles = projets.filter((p) => garde(p.nom)).slice(0, 25);
  const libelle = (() => {
    if (!valeur) return "";
    if (valeur.startsWith("t:")) {
      const t = taches.find((x) => x.id === valeur.slice(2));
      return t ? `Tâche : ${t.clientNom ? `${t.clientNom} — ` : ""}${t.titre}` : libelleRepli || "Tâche rattachée";
    }
    if (valeur.startsWith("c:")) {
      const c = clients.find((x) => x.id === valeur.slice(2));
      return c ? `Client : ${c.nom}` : libelleRepli || "Client rattaché";
    }
    if (valeur.startsWith("p:")) {
      const p = projets.find((x) => x.id === valeur.slice(2));
      return p ? `Projet : ${p.nom}` : libelleRepli || "Projet";
    }
    return "";
  })();
  // Une cible choisie s'affiche en étiquette — le ✕ la retire (retour
  // à « achat général ») et rouvre la recherche.
  if (valeur) {
    return (
      <div className={`flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs ${className}`}>
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{libelle}</span>
        <button
          type="button"
          onClick={() => { onChoisir(""); setFiltre(""); setOuvert(false); }}
          title="Retirer — redevient un achat général (stock)"
          aria-label="Retirer le rattachement"
          className="shrink-0 text-slate-400 hover:text-red-500"
        >
          <X size={13} />
        </button>
      </div>
    );
  }
  const groupe = (titre, items, rendu, prefixe) =>
    items.length > 0 && (
      <div key={titre}>
        <p className="sticky top-0 bg-slate-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{titre}</p>
        {items.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => { onChoisir(`${prefixe}:${x.id}`); setOuvert(false); setFiltre(""); }}
            className="block w-full truncate px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-orange-50"
          >
            {rendu(x)}
          </button>
        ))}
      </div>
    );
  return (
    <div ref={boiteRef} className={`relative ${className}`}>
      <input
        value={filtre}
        onFocus={() => setOuvert(true)}
        onChange={(e) => { setFiltre(e.target.value); setOuvert(true); }}
        placeholder="Achat général — ou tape un client, une tâche, un projet…"
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
      {ouvert && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {tachesVisibles.length === 0 && clientsVisibles.length === 0 && projetsVisibles.length === 0 ? (
            <p className="px-2 py-2 text-center text-[11px] text-slate-400">Aucun résultat — l&apos;achat restera général (stock).</p>
          ) : (
            <>
              {groupe("Tâches (jobs)", tachesVisibles, (t) => `${t.clientNom ? `${t.clientNom} — ` : ""}${t.titre}`, "t")}
              {groupe("Clients", clientsVisibles, (c) => c.nom, "c")}
              {groupe("Projets", projetsVisibles, (p) => p.nom, "p")}
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// ANALYSE DE RENTABILITÉ — s'ouvre depuis la tuile « Marge moyenne »
// ------------------------------------------------------------
// Quatre angles (global · par job · par client · par technicien) et les
// cinq extras validés par le propriétaire : estimé-vs-réel, tendance,
// top/flop 5, coût invisible, seuil d'alerte réglable (Paramètres).
//
// HONNÊTETÉ DES CHIFFRES : main-d'œuvre et camion sont solides (taux
// figés, heures chronométrées). Les MATÉRIAUX réels attendent QuickBooks
// (Phase 4) — d'ici là, l'estimé-vs-réel utilise le coûtant du devis
// comme approximation des matériaux, et l'écran le dit.
// ============================================================
export function bornesPeriodeAnalyse(cle, debutFiscal = "01-01") {
  const n = new Date();
  const deb = (a, m, j) => dateISO(new Date(a, m, j));
  if (cle === "mois") return { debut: deb(n.getFullYear(), n.getMonth(), 1), fin: dateISO(n) };
  if (cle === "mois-1") return { debut: deb(n.getFullYear(), n.getMonth() - 1, 1), fin: deb(n.getFullYear(), n.getMonth(), 0) };
  if (cle === "trimestre") return { debut: deb(n.getFullYear(), n.getMonth() - 2, 1), fin: dateISO(n) };
  if (cle === "annee") return { debut: deb(n.getFullYear(), 0, 1), fin: dateISO(n) };
  if (cle === "fiscale" || cle === "fiscale-1") {
    // Le DERNIER jalon "MM-JJ" passé ouvre l'année fiscale courante.
    const [mois, jour] = String(debutFiscal || "01-01").split("-").map((x) => parseInt(x, 10));
    const m = (mois || 1) - 1;
    const j = jour || 1;
    const jalonCetteAnnee = new Date(n.getFullYear(), m, j);
    const debutCourante = jalonCetteAnnee <= n ? jalonCetteAnnee : new Date(n.getFullYear() - 1, m, j);
    if (cle === "fiscale") return { debut: dateISO(debutCourante), fin: dateISO(n) };
    const debutPrec = new Date(debutCourante.getFullYear() - 1, m, j);
    // La précédente finit la VEILLE du début de la courante.
    const finPrec = new Date(debutCourante.getTime() - 86400000);
    return { debut: dateISO(debutPrec), fin: dateISO(finPrec) };
  }
  return { debut: "0000-01-01", fin: "9999-12-31" };
}


// ============================================================
// DÉFILEMENT HORIZONTAL À DOUBLE BARRE — pour les tableaux plus larges
// que l'écran (Heures de la semaine). Demande du propriétaire : un
// « curseur gauche-droite » VISIBLE — la barre du bas seule vit au pied
// d'un tableau haut, hors de vue. Une barre jumelle vit donc AU-DESSUS,
// synchronisée dans les deux sens, et les deux sont toujours affichées.
// ============================================================
export function DefilementHorizontal({ children }) {
  const hautRef = useRef(null);
  const basRef = useRef(null);
  const fantomeRef = useRef(null);
  useEffect(() => {
    const haut = hautRef.current;
    const bas = basRef.current;
    const fantome = fantomeRef.current;
    if (!haut || !bas || !fantome) return;
    // Le fantôme donne à la barre du haut la largeur RÉELLE du tableau.
    const majLargeur = () => { fantome.style.width = `${bas.scrollWidth}px`; };
    majLargeur();
    const observateur = new ResizeObserver(majLargeur);
    observateur.observe(bas);
    if (bas.firstElementChild) observateur.observe(bas.firstElementChild);
    let verrou = false;
    const suitHaut = () => { if (verrou) return; verrou = true; bas.scrollLeft = haut.scrollLeft; verrou = false; };
    const suitBas = () => { if (verrou) return; verrou = true; haut.scrollLeft = bas.scrollLeft; verrou = false; };
    haut.addEventListener("scroll", suitHaut);
    bas.addEventListener("scroll", suitBas);
    return () => {
      observateur.disconnect();
      haut.removeEventListener("scroll", suitHaut);
      bas.removeEventListener("scroll", suitBas);
    };
  }, []);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* COLLANTE (demande du propriétaire, 2026-08-19) : en descendant
          dans un long tableau, la barre suivait le haut du tableau et
          sortait de l'écran — il fallait remonter (et perdre sa ligne)
          pour glisser gauche-droite. Elle reste maintenant collée au
          haut de la fenêtre tant que le tableau est à l'écran. */}
      <div ref={hautRef} className="barre-defilement sticky top-0 z-30 overflow-x-scroll rounded-t-2xl border-b border-slate-100 bg-white" aria-hidden="true">
        <div ref={fantomeRef} style={{ height: 1 }} />
      </div>
      <div ref={basRef} className="barre-defilement overflow-x-auto">{children}</div>
    </div>
  );
}


// ============================================================
// 📸 GALERIE AVANT/APRÈS — les photos d'un travail, au bureau.
// ------------------------------------------------------------
// Un clic ouvre la VISIONNEUSE (flèches ← → + clavier, légendes
// modifiables au bureau, téléchargement à la photo). « Tout (.zip) »
// par section : sauvegarde externe ou envoi à un assureur, fichiers
// nommés intelligiblement. Remplace les deux anciennes galeries
// dupliquées (facturation + aperçu du bon) — un seul exemplaire.
// ============================================================

// Affichage d'un taux : 9.975 → "9,975" (virgule décimale française).
export function tauxAffiche(t) {
  return String(t ?? 0).replace(".", ",");
}


// Types d'accès des fiches — alignés sur les 4 rôles du système de
// permissions (lib/permissions.js). « Administration bureau » regroupe le
// personnel de bureau : son MÉTIER (adjointe, chargé de projet,
// estimateur, répartiteur, directeur) sert de sous-catégorie et fixe ses
// accès par défaut. Étiquette informative sur la fiche ; les VRAIS accès
// se gèrent dans « Gestion des accès » (couche 3).
export const TYPES_ACCES = ["Admin principal", "Admin régulier", "Administration bureau", "Technicien"];

// Zones d'appels EFFECTIVES : celles des données ; à défaut (première
// ouverture, table vide) les quatre historiques de DGL.
export const zonesEffectives = (prixDepots) => {
  const z = zonesDepuis(prixDepots);
  return z.length > 0 ? z : ZONES_DEPOTS;
};

// Métiers et niveaux (les frigoristes ont un Apprenti 4, pas les ferblantiers).
// MÉTIERS DE TERRAIN (taux = grille CCQ selon niveau + prime horaire
// individuelle éventuelle) et MÉTIERS DE BUREAU (taux horaire individuel
// complet, saisi sur la fiche de chaque employé).
// Périodes d'apprentissage CCQ vérifiées (ccq.org, 2026-08) :
// Électricien 4 · Plombier (tuyauteur) 4 · Peintre 3 · Plâtrier 3 —
// périodes de 2 000 h chacune, puis Compagnon.
export const METIERS_TERRAIN = ["Frigoriste", "Ferblantier", "Électricien", "Plombier", "Peintre", "Plâtrier"];

export const METIERS_BUREAU = ["Adjointe administrative", "Chargé de projet", "Estimateur", "Répartiteur", "Directeur"];

export const METIERS = [...METIERS_TERRAIN, ...METIERS_BUREAU];

export const estMetierBureau = (m) => METIERS_BUREAU.includes(m);
// Métiers permis selon le type d'accès : « Administration bureau » choisit
// un métier de bureau (sa sous-catégorie d'accès), « Technicien » un métier
// de terrain ; les administrateurs peuvent porter n'importe quel métier.
// `tauxMetiers` (facultatif) apporte les métiers AJOUTÉS par l'admin —
// sans lui, seuls les métiers fondateurs apparaissent.
export const metiersPourTypeAcces = (typeAcces, tauxMetiers) =>
  typeAcces === "Administration bureau"
    ? METIERS_BUREAU
    : typeAcces === "Technicien"
      ? metiersTerrainDe(tauxMetiers)
      : [...metiersTerrainDe(tauxMetiers), ...METIERS_BUREAU];

// Accès par défaut selon le type d'accès + métier (la sous-catégorie
// d'« Administration bureau » est le métier de bureau).
export const accesParDefautPour = (typeAcces, metier) =>
  permissionsPour(typeAcces, typeAcces === "Administration bureau" ? metier : undefined);

// Grille des accès (cases à cocher) — intégrée aux fiches employés :
// visible et modifiable directement à la création et dans « Modifier ».

export const NIVEAUX_PAR_METIER = {
  Frigoriste: ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Apprenti 4", "Compagnon"],
  Ferblantier: ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Compagnon"],
  "Électricien": ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Apprenti 4", "Compagnon"],
  "Plombier": ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Apprenti 4", "Compagnon"],
  "Peintre": ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Compagnon"],
  "Plâtrier": ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Compagnon"],
  // Métiers de bureau : pas de niveaux CCQ — un seul « niveau » neutre.
  "Adjointe administrative": ["—"],
  "Chargé de projet": ["—"],
  "Estimateur": ["—"],
  "Répartiteur": ["—"],
  "Directeur": ["—"],
};
// MÉTIERS AJOUTÉS PAR L'ADMIN (électricien, plombier…) — la grille des
// taux est leur registre : tout métier qui y figure existe. Un métier
// absent de la table ci-dessus reçoit la structure CCQ standard — jamais
// de plantage sur un métier inconnu.
export const NIVEAUX_CCQ_DEFAUT = ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Apprenti 4", "Compagnon"];

export const niveauxPourMetier = (m) => NIVEAUX_PAR_METIER[m] || NIVEAUX_CCQ_DEFAUT;
// Métiers de terrain effectifs = les deux fondateurs + ceux ajoutés dans
// la grille des taux (Tarifs). Les métiers de bureau n'y sont jamais.
export const metiersTerrainDe = (tauxMetiers, masques = []) =>
  [...new Set([...METIERS_TERRAIN, ...Object.keys(tauxMetiers || {})])].filter(
    (m) => !estMetierBureau(m) && !(masques || []).includes(m)
  );
// Table centrale des taux horaires coûtants. Modifiée à un seul endroit
// (onglet Utilisateurs) — appliquée automatiquement à chaque technicien
// selon son métier + niveau, y compris lors des augmentations annuelles.
// Taux laissés à 0 : à saisir par l'administrateur.

export const COULEUR_TYPE_ACCES = {
  "Admin principal": "bg-red-100 text-red-700",
  "Admin régulier": "bg-orange-100 text-orange-700",
  "Administration bureau": "bg-blue-100 text-blue-700",
  "Technicien": "bg-slate-100 text-slate-600",
  // Anciennes valeurs (fiches créées avant l'alignement sur les rôles) :
  "Administrateur": "bg-red-100 text-red-700",
  "Employé": "bg-slate-100 text-slate-600",
  "Chargé de projet": "bg-blue-100 text-blue-700",
  "Répartiteur": "bg-blue-100 text-blue-700",
};

// Comptes utilisateurs internes — en prod, ceci vit dans Supabase Auth
// (jamais de mot de passe stocké en clair côté client ni dans cette
// table ; ici c'est un booléen de démonstration seulement).

// ============================================================
// ONGLET DEVIS
// ============================================================
// ============================================================
// ONGLET CLIENTS
// ============================================================
// ============================================================
// ONGLET RECHERCHE RAPIDE
// ============================================================
export function correspond(client, terme) {
  const t = terme.trim().toLowerCase();
  if (!t) return false;
  const champs = [
    client.nom,
    client.entreprise,
    ...(client.courriels || []).map((c) => c.email),
    client.telephone,
    client.adresseFacturation,
    ...(client.adresses || []).map((a) => `${a.nom} ${a.ligne1} ${a.codePostal || ""}`),
  ];
  return champs.some((c) => c && c.toLowerCase().includes(t));
}

// ============================================================
// LISTE DES DEVIS D'UN CLIENT — regroupée par DOSSIER (numeroBase) avec
// les onglets de versions. Réutilisée dans le dossier client et dans les
// résultats de recherche : un seul comportement partout.
// ============================================================


// RÉPERTOIRE DES CLIENTS — même raison : les aperçus de documents ont
// besoin de l'adresse de facturation, et ils sont trop imbriqués pour
// la recevoir en propriété depuis l'App.
export const ContexteClients = createContext([]);

export function useClients() {
  return useContext(ContexteClients) || [];
}

// LISTE DES DEVIS — la facture d'un devis doit pouvoir reprendre ses
// lignes détaillées, sinon le client reçoit un montant sans explication.
export const ContexteDevis = createContext([]);

export function useDevis() {
  return useContext(ContexteDevis) || [];
}

// Hauteur d'un champ de description pour qu'il montre TOUT son contenu
// sans barre de défilement interne.
//
// Une description QuickBooks fait souvent 15 lignes (modèles, garantie,
// numéros AHRI, subventions). Un champ plafonné à 6 lignes n'en montrait
// qu'un tiers, et il fallait faire défiler dans une boîte minuscule pour
// relire ce qu'on envoie au client — donc on ne le relisait pas.
//
// On compte les sauts de ligne ET les retours à la ligne automatiques
// (une ligne longue occupe plusieurs rangées à l'écran).

export const BoutonPDF = dynamic(() => import("@/components/pdf/BoutonPDF"), {
  ssr: false,
  loading: () => (
    <span className="mt-3 block text-center text-[11px] text-slate-400">Chargement du PDF…</span>
  ),
});


export const TERMES_FACTURATION = ["Comptant à la livraison", "Net 15", "Net 30", "Net 45", "Net 60"];


export function nomAffichageClient(c) {
  if (!c) return "";
  const nom = (c.nom || "").trim();
  const entreprise = (c.entreprise || "").trim();
  const mode = c.nomAffichage || "nom";
  if (mode === "entreprise") return entreprise || nom;
  if (mode === "nom-entreprise") return [nom, entreprise].filter(Boolean).join(" — ") || nom;
  return nom || entreprise;
}

// Heure locale « HH:MM » d'un horodatage — pour afficher les heures
// RÉELLES chronométrées sur les blocs terminés de l'agenda (2026-08-19).

// Étiquette d'une adresse de chantier — avec l'appartement s'il existe.
export function libelleAdresse(a) {
  if (!a) return "";
  return `${a.ligne1}${a.appartement ? `, app. ${a.appartement}` : ""}`;
}

// Génère une tâche de transport SYSTÈME (Début/Fin de journée). Ces
// tâches sont recalculées automatiquement (voir recalculerTransports) et
// ne doivent pas être supprimées à la main dans la grille.

// ============================================================
// CALCUL DE RENTABILITÉ D'UN PROJET (temps réel)
// ============================================================
// Avancement calendrier (temps écoulé entre dateDebut et dateFin),
// distinct de l'avancement budgétaire — utilisé pour la double barre
// de progression du Hub Projets.
// Jauge de santé budgétaire — code couleur à 3 paliers :
// vert (< 75% consommé), jaune (75-100%), rouge clignotant (> 100%,
// dépassement réel du budget).
export function couleurSanteBudget(pourcentageDepense) {
  if (pourcentageDepense > 100) {
    return { barre: "bg-red-500 animate-pulse", texte: "text-red-600", pastille: "bg-red-500 animate-pulse" };
  }
  if (pourcentageDepense >= 75) {
    return { barre: "bg-amber-500", texte: "text-amber-600", pastille: "bg-amber-500" };
  }
  return { barre: "bg-emerald-500", texte: "text-emerald-600", pastille: "bg-emerald-500" };
}


// "En retard" est un indicateur calculé (pas un statut choisi par
// l'admin) : la date de fin prévue est dépassée et le projet n'est
// pas marqué "Terminé".
export function projetEnRetard(projet) {
  if (!projet.dateFin || projet.statut === "Terminé") return false;
  return new Date(projet.dateFin).getTime() < Date.now();
}

// ------------------------------------------------------------
// SANTÉ GLOBALE D'UN PROJET — règle unifiée utilisée PARTOUT (Hub,
// Kanban, fiche client, tableau de bord) pour que le même projet
// affiche toujours la même couleur, peu importe l'endroit :
//   VERT  = sous-budget ET dans les temps
//   JAUNE = 75-100% du budget consommé OU échéance dans les 7 jours
//   ROUGE = dépassement de budget OU en retard OU en perte
// ------------------------------------------------------------
export function evaluerSanteProjet(projet, r) {
  const enRetard = projetEnRetard(projet);
  const enPerte = r.profitReel < 0;

  if (r.depassementBudget || enRetard || enPerte) {
    return { niveau: "rouge", pastille: "bg-red-500 animate-pulse", texte: "text-red-600", fond: "bg-red-100" };
  }

  let echeanceProche = false;
  if (projet.dateFin && projet.statut !== "Terminé") {
    const joursRestants = (new Date(projet.dateFin).getTime() - Date.now()) / 86400000;
    echeanceProche = joursRestants >= 0 && joursRestants <= 7;
  }

  if (r.pourcentageDepense >= 75 || echeanceProche) {
    return { niveau: "jaune", pastille: "bg-amber-500", texte: "text-amber-600", fond: "bg-amber-100" };
  }

  return { niveau: "vert", pastille: "bg-emerald-500", texte: "text-emerald-600", fond: "bg-emerald-100" };
}


export function calculerRentabiliteProjet(projet, travaux, transactionsQb, utilisateurs = [], tauxMetiers = {}, inspections = [], coutCamionDefaut = 0) {
  // Heures du projet — les heures ADMINISTRATIVES et DIVERSES en sont
  // exclues même si elles portent un projetId. Une visite de soumission
  // faite avant d'avoir vendu le contrat ne doit pas gonfler le coût de
  // ce contrat : elle est un frais de vente de l'entreprise.
  // (Ces heures restent PAYÉES — voir « Heures de la semaine ».)
  const travauxDuProjet = travaux.filter(
    (t) => t.projetId === projet.id && (t.categorieHeures || "projet") === "projet"
  );
  // Heures Totales du Projet = Heures Tâches Projet + Heures Transport
  // Aller/Retour imputées (voir la règle d'imputation automatique côté
  // app technicien, basée sur la chronologie de la journée). Les deux
  // catégories sont distinguées ici pour l'affichage, mais comptent
  // également dans le coût de main-d'œuvre.
  const travauxChantier = travauxDuProjet.filter((t) => !t.estTransport);
  const travauxTransport = travauxDuProjet.filter((t) => t.estTransport);
  const heuresChantier = travauxChantier.reduce((s, t) => s + (t.heures || 0), 0);
  const heuresTransport = travauxTransport.reduce((s, t) => s + (t.heures || 0), 0);
  const totalHeures = heuresChantier + heuresTransport;
  // Kilométrage total de transport rattaché au projet — capturé par
  // GPS au départ/arrivée de chaque trajet côté app technicien.
  const kilometrageTransport = travauxTransport.reduce((s, t) => s + (t.distanceKm || 0), 0);
  // Dépenses QuickBooks (achats/sous-traitance) rattachées à ce projet.
  // Les factures de vente QuickBooks rattachées → suivies séparément
  // comme "facturé réel" (encaissements réels vs budget), sans changer le
  // calcul du profit (qui reste basé sur le budget initial vendu).
  const transactionsDuProjet = (transactionsQb || []).filter((t) => t.projectId === projet.id);
  const depensesQb = transactionsDuProjet.filter((t) => t.type === "EXPENSE");
  const facturesQb = transactionsDuProjet.filter((t) => t.type === "INVOICE");
  // ------------------------------------------------------------
  // ANTI-DOUBLE-COMPTAGE : un bon de commande saisi dans l'app et la
  // facture fournisseur correspondante dans QuickBooks (même numéro de
  // BC) sont LA MÊME dépense. On ne les additionne jamais :
  // - BC apparié à une dépense QB → le montant RÉEL de QuickBooks fait
  //   foi (il remplace le montant saisi, qui n'était qu'une estimation ;
  //   un BC laissé à 0 se remplit donc tout seul) ;
  // - BC sans dépense QB → son montant saisi compte (estimation) ;
  // - dépense QB sans BC correspondant → s'ajoute normalement.
  // ------------------------------------------------------------
  const numeroBcNormalise = (v) => String(v || "").trim().toUpperCase();
  const depensesParNumeroBc = new Map();
  depensesQb.forEach((d) => {
    const num = numeroBcNormalise(d.poNumber);
    if (num) depensesParNumeroBc.set(num, d);
    // Le numéro était NOYÉ dans le mémo (factures fournisseurs) : la
    // règle d'attribution l'a retrouvé — même appariement.
    const numMemo = numeroBcNormalise(d.cible?.bc);
    if (numMemo) depensesParNumeroBc.set(numMemo, d);
  });
  const bcApparies = new Set();
  const coutMateriauxBC = (projet.bonsCommande || []).reduce((s, bc) => {
    const correspondance = depensesParNumeroBc.get(numeroBcNormalise(bc.numeroBC));
    if (correspondance) {
      bcApparies.add(correspondance.quickbooksId);
      return s + (Number(correspondance.amountHT) || 0); // montant RÉEL de QuickBooks
    }
    return s + (Number(bc.montantHT) || 0); // estimation saisie dans l'app
  }, 0);
  // Dépenses QuickBooks qui ne correspondent à AUCUN bon de commande.
  const coutMateriauxQb = depensesQb
    .filter((d) => !bcApparies.has(d.quickbooksId))
    .reduce((s, t) => s + (Number(t.amountHT) || 0), 0);
  // MATÉRIEL DU STOCK — déjà payé, pris sur la tablette du bureau et
  // attribué à ce projet (« 4 paquets de tuyaux ») : un vrai coût du
  // projet même sans bon de commande ni dépense QuickBooks.
  const coutMaterielStock = (projet.materielStock || []).reduce((s, m) => s + (Number(m.coutTotal) || 0), 0);
  const coutMateriaux = coutMateriauxBC + coutMateriauxQb + coutMaterielStock;
  const totalFactureReel = facturesQb.reduce((s, t) => s + t.amountHT, 0);
  // Coût de main-d'œuvre : idéalement calculé par employé (taux du métier
  // + niveau de celui qui a pointé les heures, lu dans la table centrale).
  // Tant qu'un « travail » ne porte pas d'employeId (avant l'app technicien
  // + Supabase), on retombe sur le taux unique du projet.
  const tauxDeEmploye = (t) => {
    // Priorité 1 : le taux FIGÉ à la saisie (spec contrôle de gestion) —
    // stocké sur la ligne quand le technicien a terminé la tâche.
    if (Number(t.tauxCoutantFige) > 0) return Number(t.tauxCoutantFige);
    const emp = utilisateurs.find((u) => u.id === t.employeId);
    // Priorité 2 : taux horaire INDIVIDUEL de la fiche (métiers de bureau).
    if (Number(emp?.tauxHoraire) > 0) return Number(emp.tauxHoraire);
    // Priorité 3 : grille CCQ (métier × niveau) + prime individuelle.
    const taux = emp && tauxMetiers?.[emp.metier]?.[emp.niveau];
    if (Number(taux) > 0) return Number(taux) + (Number(emp?.primeHoraire) || 0);
    return projet.tauxHoraireCoutant || 0;
  };
  // Ventilation du coût main-d'œuvre par catégorie, avec le MÊME taux par
  // employé que ci-dessus — garantit coutMainOeuvreChantier + coutTransport === coutMainOeuvre.
  const coutMainOeuvreChantier = travauxChantier.reduce((s, t) => s + (t.heures || 0) * tauxDeEmploye(t), 0);
  const coutTransport = travauxTransport.reduce((s, t) => s + (t.heures || 0) * tauxDeEmploye(t), 0);
  const coutMainOeuvre = coutMainOeuvreChantier + coutTransport;
  // ------------------------------------------------------------
  // COÛT DU CAMION (bloc 5) : chaque heure d'un technicien qui AVAIT un
  // camion ce jour-là (son inspection du matin le dit) coûte le taux
  // camion en plus — chantier ET transports, le camion roule toute la
  // journée. Passager ou sans véhicule : zéro (le camion du conducteur
  // coûte déjà, on ne compte jamais deux fois le même véhicule).
  // Taux FIGÉ sur l'inspection du matin ; à défaut (vieille inspection
  // d'avant ce champ, ou inspection introuvable), le taux courant des
  // Paramètres — on COMPTE le camion en cas de doute : un coûtant
  // légèrement surestimé est moins dangereux qu'une job qui a l'air
  // plus payante qu'elle l'est.
  const coutCamionDe = (t) => {
    const email = (t.employeEmail || "").toLowerCase();
    if (!email || !t.date) return coutCamionDefaut;
    const insp = inspections.find((i) => i.date === t.date && (i.technicienEmail || "").toLowerCase() === email);
    if (!insp) return coutCamionDefaut;
    if (insp.sansVehicule || insp.passagerDeNom) return 0;
    return insp.coutCamionHoraire != null ? insp.coutCamionHoraire : coutCamionDefaut;
  };
  const coutCamion = travauxDuProjet.reduce((s, t) => s + (t.heures || 0) * coutCamionDe(t), 0);
  // 📥 REPRISE DE CHANTIER (2026-08-28) — ce qui a été fait AVANT
  // Fluxya : heures déjà travaillées et montants déjà facturés,
  // saisis à la main sur le projet. Sans eux, un chantier repris en
  // cours de route affiche une rentabilité fausse (tout le travail du
  // début manque). Ils sont comptés à part pour rester identifiables.
  const reprise = projet.reprise || {};
  const heuresReprise = (reprise.heures || []).reduce((s, h) => s + (Number(h.heures) || 0), 0);
  const coutReprise = (reprise.heures || []).reduce(
    (s, h) => s + (Number(h.heures) || 0) * (Number(h.taux) || 0),
    0
  );
  const factureReprise = (reprise.factures || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
  // 🧱 Matériaux déjà achetés (avant Fluxya, ou sans bon de commande) —
  // saisis à la main sur le projet, comptés dans le coût réel.
  const coutMateriauxReprise = (reprise.materiaux || []).reduce((s, m) => s + (Number(m.montant) || 0), 0);
  const coutTotalReel = coutMateriaux + coutMainOeuvre + coutCamion + coutReprise + coutMateriauxReprise;
  const profitReel = projet.budgetTotal - coutTotalReel;
  const pourcentageMarge = projet.budgetTotal > 0 ? (profitReel / projet.budgetTotal) * 100 : 0;
  const pourcentageDepense = projet.budgetTotal > 0 ? (coutTotalReel / projet.budgetTotal) * 100 : 0;
  return {
    travauxDuProjet,
    travauxChantier,
    travauxTransport,
    heuresChantier,
    heuresTransport,
    kilometrageTransport,
    // Total des heures : celles pointées dans Fluxya + celles reprises.
    totalHeures: totalHeures + heuresReprise,
    heuresPointees: totalHeures,
    coutMateriauxBC,
    coutMateriauxQb,
    coutMaterielStock,
    coutMateriaux,
    transactionsDuProjet,
    // Facturé réel = les factures QuickBooks du projet + ce qui avait
    // déjà été facturé avant Fluxya (reprise).
    totalFactureReel: totalFactureReel + factureReprise,
    heuresReprise,
    coutReprise,
    factureReprise,
    coutMateriauxReprise,
    coutMainOeuvre,
    coutMainOeuvreChantier,
    coutTransport,
    coutCamion,
    coutTotalReel,
    profitReel,
    pourcentageMarge,
    pourcentageDepense,
    depassementBudget: coutTotalReel > projet.budgetTotal,
  };
}


export function adresseFacturationClient(client) {
  if (client?.adresseFacturation) return client.adresseFacturation;
  const principale = client?.adresses?.[0];
  if (!principale) return "";
  return [libelleAdresse(principale), principale.codePostal].filter(Boolean).join(", ");
}

// Nom normalisé pour la détection de DOUBLONS : minuscules, accents
// retirés, espaces réduits — « Raphaël  Gélinas » = « raphael gelinas ».
export function nomClientNormalise(nom) {
  return String(nom || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ============================================================
// NAVIGATION
// ============================================================
// ============================================================
// MENU LATÉRAL — navigation groupée (bureau : fixe à gauche ;
// mobile : tiroir ☰ par-dessus le contenu). Filtré par permissions.
// ============================================================

// ============================================================
// SAISIE D'ADRESSE — GOOGLE PLACES
// ------------------------------------------------------------
// Les suggestions viennent de la vraie API Google Places (restreinte
// au Canada). Avant, c'était une liste de 5 adresses fictives : aucune
// adresse réelle n'apparaissait, donc rien ne pouvait être sélectionné
// et la création d'un client restait bloquée sur « adresse incomplète ».
//
// Google renvoie la ville et le code postal DÉJÀ DÉCOUPÉS. C'est le
// vrai gain : ces champs partent sur les factures des clients, et les
// deviner dans une chaîne de texte finit toujours par produire une
// adresse fautive.
//
// SAISIE MANUELLE CONSERVÉE : si la clé manque, si le quota est
// dépassé, ou hors ligne, on retombe sur la saisie libre avec ville
// obligatoire. Créer un client ne doit jamais dépendre d'un tiers.
// ============================================================
export function AutocompleteAdresse({ onSelection }) {
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [googleEnPanne, setGoogleEnPanne] = useState(!googlePlacesDisponible());
  // Champs de repli, utilisés seulement en saisie manuelle.
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  // Jeton de session Google : une seule unité de facturation pour toute
  // la recherche + la sélection (voir lib/googlePlaces.js).
  const jetonRef = useRef(null);

  // Recherche différée de 300 ms : on n'interroge pas Google à chaque
  // lettre, on attend que le doigt s'arrête.
  useEffect(() => {
    if (googleEnPanne || texte.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let annule = false;
    setChargement(true);
    const minuterie = setTimeout(async () => {
      try {
        if (!jetonRef.current) jetonRef.current = await nouveauJeton();
        const res = await chercherAdresses(texte, jetonRef.current);
        if (!annule) setSuggestions(res);
      } catch {
        // Clé refusée, quota dépassé, hors ligne — on bascule en saisie
        // manuelle sans message technique incompréhensible.
        if (!annule) {
          setGoogleEnPanne(true);
          setSuggestions([]);
        }
      } finally {
        if (!annule) setChargement(false);
      }
    }, 300);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [texte, googleEnPanne]);

  const choisir = async (s) => {
    try {
      const details = await detailsAdresse(s, jetonRef.current);
      onSelection(details);
      setTexte(details.label);
    } catch {
      // Détails indisponibles : on garde au moins le texte de la
      // suggestion plutôt que de perdre le choix du client.
      onSelection({ label: s.texte, ligne1: s.texte, ville: "", codePostal: "" });
      setTexte(s.texte);
    }
    jetonRef.current = null; // le jeton meurt avec la sélection
    setSuggestions([]);
    setOuvert(false);
  };

  // Saisie manuelle : proposée quand Google est indisponible, ou quand
  // aucune suggestion ne correspond (adresse neuve, chantier sans
  // numéro civique…).
  const saisieLibre = texte.trim().length >= 5 && !chargement && suggestions.length === 0;

  const confirmerSaisieLibre = () => {
    if (!texte.trim() || !ville.trim()) return;
    onSelection({
      label: texte.trim(),
      ligne1: texte.trim(),
      ville: ville.trim(),
      codePostal: codePostal.trim(),
    });
    setOuvert(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setOuvert(true);
          }}
          placeholder="Commence à taper l'adresse…"
          className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-9 text-sm"
        />
        {chargement && (
          <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {ouvert && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => choisir(s)}
              className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-[#FF6A13]" />
              {s.texte}
            </button>
          ))}
        </div>
      )}

      {saisieLibre && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="mb-1.5 text-[10px] leading-snug text-slate-500">
            {googleEnPanne
              ? "Suggestions Google indisponibles — entre l'adresse à la main."
              : "Aucune suggestion ne correspond. Tu peux utiliser l'adresse telle quelle."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Ville *</label>
              <input
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Mirabel"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Code postal</label>
              <input
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value.toUpperCase())}
                placeholder="J7N 3V4"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none"
              />
            </div>
          </div>
          <Button onClick={confirmerSaisieLibre} disabled={!ville.trim()} className="mt-2 w-full min-h-0 py-2 text-xs">
            <Check size={13} /> Utiliser cette adresse
          </Button>
        </div>
      )}
    </div>
  );
}


export function GalerieAvantApres({ travail, enMarge = false }) {
  const [indexOuvert, setIndexOuvert] = useState(null);
  const [legendes, setLegendes] = useState({});
  const [zipEnCours, setZipEnCours] = useState("");

  const avant = travail.photosAvantUrls || [];
  const apres = travail.photosApresUrls || [];
  const photos = [
    ...avant.map((u, i) => ({ url: u, etiquette: `Avant ${i + 1}/${avant.length}`, section: "avant" })),
    ...apres.map((u, i) => ({ url: u, etiquette: `Après ${i + 1}/${apres.length}`, section: "apres" })),
  ];

  useEffect(() => {
    const urls = photos.map((p) => p.url);
    if (urls.length) listerLegendes(urls).then(setLegendes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travail.id]);

  const nomBase = `${String(travail.client || "photos").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${travail.date || ""}`;

  const telechargerZip = async (section) => {
    setZipEnCours(section);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const liste = photos.filter((p) => p.section === section);
      for (let i = 0; i < liste.length; i++) {
        const reponse = await fetch(liste[i].url);
        zip.file(`${nomBase}-${section}-${String(i + 1).padStart(2, "0")}.jpg`, await reponse.blob());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(blob);
      lien.download = `${nomBase}-${section}.zip`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch {
      // réseau — l'utilisateur peut télécharger photo par photo
    } finally {
      setZipEnCours("");
    }
  };

  const vignette = (p, indexGlobal) => (
    <button
      key={p.url + indexGlobal}
      onClick={() => setIndexOuvert(indexGlobal)}
      className="relative block aspect-square w-full overflow-hidden rounded-lg border border-slate-200"
      title="Ouvrir la visionneuse (flèches pour naviguer)"
    >
      <img src={p.url} alt={p.etiquette} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      {p.url.includes("-galerie") && (
        <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">📁 importée</span>
      )}
      {legendes[p.url] && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-left text-[8px] text-white">📝 {legendes[p.url]}</span>
      )}
    </button>
  );

  const section = (titre, cle, decalage, liste) => (
    liste.length > 0 && (
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{titre}</p>
          <button
            onClick={() => telechargerZip(cle)}
            disabled={zipEnCours !== ""}
            className="text-[10px] font-bold text-slate-400 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
          >
            {zipEnCours === cle ? "Préparation…" : "⬇️ Tout (.zip)"}
          </button>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {liste.map((p, i) => vignette(p, decalage + i))}
        </div>
      </div>
    )
  );

  return (
    <div className={`space-y-2 ${enMarge ? "mt-3" : ""}`}>
      {section("Photos avant travaux", "avant", 0, photos.filter((p) => p.section === "avant"))}
      {section("Photos après travaux", "apres", avant.length, photos.filter((p) => p.section === "apres"))}
      {indexOuvert != null && (
        <VisionneusePhotos
          photos={photos}
          indexDepart={indexOuvert}
          legendes={legendes}
          onFermer={() => setIndexOuvert(null)}
          onLegende={async (url, texte) => {
            setLegendes((prev) => ({ ...prev, [url]: texte }));
            const { data } = await supabase.auth.getSession();
            sauvegarderLegende(url, texte, data?.session).catch(() => {});
          }}
          nomFichier={(p, i) => `${nomBase}-${p.section}-${String(i + 1).padStart(2, "0")}.jpg`}
        />
      )}
    </div>
  );
}

// ============================================================
// 📜 ACCEPTATION DE L'ENTENTE — première connexion d'une entreprise
// cliente. L'admin principal coche « j'ai lu et j'accepte » au nom de
// son entreprise ; qui, quand et quelle version sont consignés. Le
// texte suit le STATUT : fondateur (1 an gratuit + 25 % à vie — les 3
// premiers seulement) ou régulier (la clause n'y apparaît JAMAIS).
// Le Propriétaire (DGL) est exempt. Les employés ne la voient pas —
// l'admin accepte pour l'entreprise, comme une signature de contrat.
// ============================================================

// ============================================================
// DÉTAIL D'UN TRAVAIL (passé ou à venir) — notes + photos
// ============================================================
// ============================================================
// APERÇU DU BON DE TRAVAIL — VERSION CLIENT
// ------------------------------------------------------------
// Ce que le client reçoit réellement : coordonnées d'entreprise,
// notes de terrain (jamais les notes internes), photos, montant s'il
// y a lieu, et confirmation de signature. Aucune information de coût
// interne ni note réservée à l'équipe n'apparaît ici.
// ============================================================
export function ApercuBonTravailClient({ travail, clients, onFermer }) {
  const client = (clients || []).find((c) => c.id === travail.clientId);
  const adresse = travail.adresseTravaux || (client?.adresses?.[0] ? `${client.adresses[0].nom} — ${libelleAdresse(client.adresses[0])}` : null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-500">Aperçu — version envoyée au client</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-sm">
          <EnTeteEntreprise />
          <p className="mt-3 text-lg font-extrabold text-[#131B2E]">BON DE TRAVAIL</p>
          <p className="text-xs text-slate-500">Date : {travail.date}</p>
          <AdressesDocument
            clientNom={client?.nom || travail.clientNom}
            adresseFacturation={adresseFacturationClient(client)}
            adresseTravaux={adresse}
          />

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Description des travaux</p>
            <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {travail.noteTerrain || travail.titre || "Détails à venir."}
            </p>
          </div>

          {/* PHOTOS RÉELLES du chantier (stockage Supabase) — avant/après. */}
          {(travail.photosAvantUrls?.length > 0 || travail.photosApresUrls?.length > 0) && (
            <GalerieAvantApres travail={travail} enMarge />
          )}
          {/* Repli — anciennes lignes de démonstration (libellés seulement). */}
          {!(travail.photosAvantUrls?.length > 0 || travail.photosApresUrls?.length > 0) && travail.photos?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Photos</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {travail.photos.map((label, i) => (
                  <div key={i} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 p-1.5 text-center">
                    <Camera size={16} className="text-slate-400" />
                    <span className="text-[9px] leading-tight text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {travail.montant != null && (
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
              <span>Montant</span><span className="tabular-nums">{travail.montant.toFixed(2)} $</span>
            </div>
          )}

          <TermesConditions />

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-700">
            <FileCheck2 size={14} className="shrink-0" /> Signé électroniquement par le client à la fin de l'intervention
          </div>

          <PiedDocument />
        </div>

        <BoutonPDF type="bon-travail" travail={travail} clients={clients} />

        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — les notes internes et informations de coût ne sont jamais incluses dans le document réellement envoyé.
        </p>
      </div>
    </div>
  );
}


export function AdressesDocument({ clientNom, adresseFacturation, adresseTravaux }) {
  const differente =
    adresseTravaux && adresseTravaux.trim() && adresseTravaux.trim() !== (adresseFacturation || "").trim();
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Facturé à</p>
        <p className="text-sm font-bold text-slate-800">{clientNom || "—"}</p>
        {adresseFacturation ? (
          <p className="whitespace-pre-line text-[11px] leading-snug text-slate-600">{adresseFacturation}</p>
        ) : (
          <p className="text-[11px] italic text-amber-600">Adresse de facturation manquante</p>
        )}
      </div>
      {differente && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Adresse des travaux</p>
          <p className="whitespace-pre-line text-[11px] leading-snug text-slate-600">{adresseTravaux}</p>
        </div>
      )}
    </div>
  );
}


export function ApercuDevisClient({ devis, onFermer }) {
  // Adresses lues dans la fiche du client au moment de l'affichage —
  // elles ne sont pas figées sur le devis. Une correction d'adresse se
  // reflète donc sur une réimpression, ce qui est souhaitable pour un
  // renvoi. Le devis reste inchangé pour tout le reste.
  const fiche = (useClients() || []).find((c) => c.id === devis.clientId || c.nom === devis.clientNom);
  // Taux de taxes lus dans les Paramètres de l'entreprise (plus codés
  // en dur : si Québec change la TVQ, on l'ajuste dans l'écran).
  const configEnt = useEntreprise();
  const sousTotal = devis.totalVendant;
  const { tps, tvq, total } = calculerTaxes(sousTotal, configEnt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-500">Aperçu — version envoyée au client</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-sm">
          <EnTeteEntreprise />
          <p className="mt-3 text-lg font-extrabold text-[#131B2E]">DEVIS {devis.numero}</p>
          <p className="text-xs text-slate-500">Date : {devis.date}</p>
          {/* Exactement la même source que le PDF (AdressesPDF) : cet écran
              s'annonce comme « la version envoyée au client », il ne doit
              rien afficher que le PDF n'aurait pas. */}
          <AdressesDocument
            clientNom={devis.clientNom}
            adresseFacturation={adresseFacturationClient(fiche)}
            adresseTravaux={devis.adresseTravaux}
          />

          <table className="mt-4 w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400">
                <th className="pb-1.5 font-semibold">Description</th>
                <th className="pb-1.5 text-center font-semibold">Qté</th>
                <th className="pb-1.5 text-right font-semibold">Prix</th>
                <th className="pb-1.5 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l) => (
                <tr key={l.uid} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-700">
                    <span className="font-semibold">{l.nom || "—"}</span>
                    {/* La description part chez le client : modèles,
                        garantie, ce qui est inclus. `whitespace-pre-line`
                        respecte les sauts de ligne de QuickBooks. */}
                    {l.description ? (
                      <span className="mt-0.5 block whitespace-pre-line text-[10px] leading-snug text-slate-500">
                        {l.description}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-center tabular-nums text-slate-500">{l.quantite}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">{(Number(l.prix_vendant) || 0).toFixed(2)} $</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-slate-800">
                    {((Number(l.prix_vendant) || 0) * l.quantite).toFixed(2)} $
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span className="tabular-nums">{sousTotal.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span><span className="tabular-nums">{tps.toFixed(2)} $</span></div>
            <div className="flex justify-between text-slate-500"><span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span><span className="tabular-nums">{tvq.toFixed(2)} $</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
              <span>Total</span><span className="tabular-nums">{total.toFixed(2)} $</span>
            </div>
          </div>

          <TermesConditions signature />

          <p className="mt-4 text-[10px] italic text-slate-400">
            Devis valide 30 jours. Aucune information de coût interne n'apparaît sur ce document.
          </p>
          <PiedDocument />
        </div>

        <BoutonPDF type="devis" devis={{ ...devis, adresseFacturation: devis?.adresseFacturation || adresseFacturationClient(fiche) }} />

        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — le PDF réel envoyé par courriel au client se génère et s'expédie via une fonction backend, avec ce même contenu.
        </p>
      </div>
    </div>
  );
}



// CATALOGUE D'ITEMS — comme la configuration d'entreprise, il circule
// par un contexte : il sert dans l'éditeur de devis ET dans la fenêtre
// de facturation, deux endroits profondément imbriqués.
export const ContexteCatalogue = createContext([]);

export function useCatalogue() {
  return useContext(ContexteCatalogue) || [];
}


export function SelecteurItem({ catalogue, onChoisir, libelle = "+ Ajouter un produit" }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const champRef = useRef(null);

  useEffect(() => {
    if (ouvert && champRef.current) champRef.current.focus();
  }, [ouvert]);

  const resultats = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = catalogue || [];
    if (!t) return base.slice(0, 40);
    return base.filter((i) => `${i.nom} ${i.categorie}`.toLowerCase().includes(t)).slice(0, 40);
  }, [catalogue, q]);

  if (!ouvert) {
    return (
      <Button variant="outline" onClick={() => setOuvert(true)} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
        <Search size={12} /> {libelle}
      </Button>
    );
  }

  return (
    // 📱 PLEIN ÉCRAN SUR TÉLÉPHONE (2026-08-21) : choisir un item dans
    // un catalogue de 289 produits demande de la place et de gros
    // boutons — sur un écran de 6 pouces, la petite fenêtre obligeait à
    // viser. Sur ordinateur, rien ne change (fenêtre centrée).
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 sm:p-4 sm:pt-16" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setOuvert(false))(); }}>
      <div className="flex h-full w-full max-w-md flex-col bg-white p-3 sm:h-auto sm:rounded-2xl sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-slate-300 px-2.5 py-2.5">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input ref={champRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un item…" className="w-full text-base outline-none sm:text-sm" />
          <button onClick={() => setOuvert(false)} aria-label="Fermer" className="p-1"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="mt-2 flex-1 overflow-y-auto sm:max-h-[55vh] sm:flex-none">
          {(catalogue || []).length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">
              Catalogue vide — lance le snippet SQL « 26 » pour importer ta liste de prix.
            </p>
          ) : resultats.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">Aucun item ne correspond à « {q} ».</p>
          ) : (
            resultats.map((i) => (
              <button
                key={i.id}
                onClick={() => { onChoisir(i); setOuvert(false); setQ(""); }}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-slate-100 px-2 py-2.5 text-left last:border-0 active:bg-orange-50 hover:bg-slate-50 sm:min-h-0 sm:py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 sm:text-xs">{i.nom}</span>
                  {i.categorie && <span className="block truncate text-[11px] text-slate-400 sm:text-[10px]">{i.categorie}</span>}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700 sm:text-xs">
                  {i.prix_vendant != null ? `${i.prix_vendant.toFixed(2)} $` : "—"}
                </span>
              </button>
            ))
          )}
        </div>
        {!q && (catalogue || []).length > 40 && (
          <p className="mt-1 text-[10px] text-slate-400">40 premiers sur {catalogue.length} — tape pour chercher.</p>
        )}
      </div>
    </div>
  );
}



export const LARGEUR_LIGNE_DESCRIPTION = 52; // caractères visibles par rangée

export function hauteurDescription(texte) {
  const contenu = String(texte || "");
  if (!contenu.trim()) return 2;
  const rangees = contenu
    .split("\n")
    .reduce((total, ligne) => total + Math.max(1, Math.ceil(ligne.length / LARGEUR_LIGNE_DESCRIPTION)), 0);
  // Plafond haut : au-delà, on garde une barre de défilement plutôt
  // qu'un champ qui repousserait les totaux hors de l'écran.
  return Math.min(30, Math.max(2, rangees));
}


export function courrielDefautClient(client) {
  if (!client?.courriels?.length) return null;
  return client.courriels.find((c) => c.defaut) || client.courriels[0];
}


export function listeDestinataires(choix) {
  if (!choix) return [];
  return Array.isArray(choix) ? choix.filter(Boolean) : [choix];
}
// « courriel1 (Principal), courriel2 (Comptabilité) » pour le journal.
export function libelleDestinataires(choix) {
  return listeDestinataires(choix)
    .map((c) => `${c.email}${c.label ? ` (${c.label})` : ""}`)
    .join(", ");
}


export function ModalSelectionCourriel({ client, contexte, onConfirmer, onFermer, onAjouterFiche = null }) {
  const courriels = client?.courriels || [];
  const [selectionIds, setSelectionIds] = useState(() => {
    const parDefaut = courrielDefautClient(client);
    return parDefaut ? [parDefaut.id] : [];
  });
  const basculer = (id) =>
    setSelectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selection = courriels.filter((cc) => selectionIds.includes(cc.id));
  // COURRIEL AJOUTÉ À LA MAIN — parfois le document doit aussi partir
  // ailleurs (assureur, gestionnaire d'immeuble, notaire…). Plusieurs
  // adresses possibles, séparées par une virgule ou un point-virgule.
  // Seules les adresses au format valide partent — jamais de rebond
  // silencieux à cause d'une coquille.
  const [extra, setExtra] = useState("");
  // 💾 L'adresse tapée peut rejoindre la FICHE du client — la prochaine
  // fois, elle sera dans la liste à cocher.
  const [ajouterAFiche, setAjouterAFiche] = useState(false);
  const extras = extra
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    .map((x, i) => ({ id: `extra-${i}`, email: x, label: "Ajouté à la main" }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Choisir les courriels de destination</h3>
            <p className="text-xs text-slate-500">{contexte}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {courriels.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
            {client?.nom} n'a aucun courriel enregistré — ajoute-en un dans sa fiche (onglet Clients), ou utilise le champ « autre adresse » ci-dessous pour cet envoi-ci.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-[11px] text-slate-400">Coche une ou plusieurs adresses — le document part à toutes en même temps.</p>
            <div className="space-y-1.5">
              {courriels.map((cc) => (
                <label
                  key={cc.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${
                    selectionIds.includes(cc.id) ? "border-[#FF6A13] bg-orange-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectionIds.includes(cc.id)}
                    onChange={() => basculer(cc.id)}
                    className="mt-0.5 h-4 w-4 accent-[#FF6A13]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{cc.email}</p>
                    <p className="text-[11px] text-slate-500">{cc.label}{cc.defaut ? " · défaut" : ""}</p>
                  </div>
                </label>
              ))}
            </div>
            {courriels.length > 1 && (
              <button
                onClick={() => setSelectionIds(selectionIds.length === courriels.length ? [] : courriels.map((cc) => cc.id))}
                className="mt-2 text-[11px] font-bold text-slate-500 underline underline-offset-2"
              >
                {selectionIds.length === courriels.length ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
          </>
        )}

        <div className="mt-3">
          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
            Envoyer aussi à une autre adresse (facultatif)
          </label>
          <input
            type="email"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="ex : assureur@exemple.com — virgule pour plusieurs"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#FF6A13]"
          />
          {extra.trim() !== "" && extras.length === 0 && (
            <p className="mt-0.5 text-[10px] font-bold text-amber-600">
              Adresse incomplète — vérifie le format (nom@domaine.com).
            </p>
          )}
          {extras.length > 0 && client && onAjouterFiche && (
            <label className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={ajouterAFiche}
                onChange={(e) => setAjouterAFiche(e.target.checked)}
                className="h-4 w-4 accent-[#FF6A13]"
              />
              💾 Ajouter cette adresse à la fiche de {client?.nom || "ce client"}
            </label>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button
            disabled={selection.length + extras.length === 0}
            onClick={() => {
              if (ajouterAFiche && onAjouterFiche) extras.forEach((x) => onAjouterFiche(x.email));
              onConfirmer([...selection, ...extras]);
            }}
          >
            Envoyer{selection.length + extras.length > 1 ? ` (${selection.length + extras.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRAITEMENT D'UN DEVIS ACCEPTÉ — choix explicite entre intervention
// directe (bon de travail unique) et nouveau projet d'envergure
// (le devis devient le budget initial + une tâche par ligne).
// ============================================================

export const FREQUENCES_CONTRAT = [1, 2, 3, 4];

// Couleurs distinctes par type de tâche, utilisées dans les cartes en
// attente et les cases du calendrier, pour les différencier d'un
// coup d'œil.


export const HEURES_QUART = HEURES.flatMap((h) => ["00", "15", "30", "45"].map((m) => `${h.slice(0, 2)}:${m}`));

// 📝 LE TEXTE D'UN DEVIS pour une description de tâche (2026-08-30,
// retour du propriétaire : « toute l'information de la description,
// pas seulement le titre »). Quantité × nom PUIS la description
// complète de chaque item — JAMAIS de prix (seule chose interdite).
// Une seule définition : l'injection à la sélection et le filet à la
// création doivent produire EXACTEMENT le même texte (l'anti-doublon
// compare les deux).

// Recalcule les transports système pour TOUT le planning : pour chaque
// (journée, technicien) ayant au moins une VRAIE tâche, place un Transport
// Début juste avant la première et un Transport Fin juste après la
// dernière ; retire les transports d'une journée qui n'a plus de vraie
// tâche. Idempotent — à rappeler après chaque changement du planning.
// Contenu d'une case du planning, TOUJOURS sous forme de liste : depuis
// que plusieurs tâches peuvent partager la même plage horaire (elles
// s'empilent à l'écran au lieu de s'écraser), chaque case contient un
// tableau de tâches. Ce petit assistant tolère aussi l'ancien format
// (une tâche seule) par prudence.
export function listeCellule(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}


// Heure de départ par défaut lors de la création/assignation d'une
// tâche — on ne veut pas qu'une nouvelle tâche démarre par défaut à
// minuit (HEURES[0]) : elle démarre à 7h du matin.
export const HEURE_PAR_DEFAUT = "07:00";


export function camionsEntretienDu(inspections, entretiens) {
  const camions = [...new Set((inspections || []).filter((i) => !i.sansVehicule && i.camion).map((i) => i.camion))];
  return camions.filter((camion) => {
    const lectures = (inspections || []).filter((i) => i.camion === camion && i.km != null);
    const kmActuel = lectures.length ? Math.max(...lectures.map((i) => i.km)) : 0;
    const dernier = (entretiens || []).filter((e) => e.camion === camion).sort((a, b) => b.date.localeCompare(a.date))[0];
    // 🚚 PREMIER CONTACT (2026-09-04, demande du propriétaire) : un camion
    // récent entre p. ex. à 41 600 km — sans entretien au carnet, l'ancien
    // calcul comparait à 0 km et à « jamais » : entretien dû instantanément.
    // SANS entretien enregistré, la PREMIÈRE lecture (km + date de la 1re
    // inspection) devient le point de départ : le prochain entretien vient
    // 10 000 km ou 6 mois PLUS TARD. Une seule fois — dès qu'un entretien
    // est au carnet, c'est lui qui fait foi, comme avant.
    let kmBase;
    let moisBase;
    if (dernier) {
      kmBase = dernier.km;
      moisBase = moisDepuis(dernier.date);
    } else {
      const premiere = lectures.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
      if (!premiere) return false;
      kmBase = premiere.km;
      moisBase = moisDepuis(premiere.date);
    }
    return kmActuel - kmBase >= SEUIL_ENTRETIEN_KM || moisBase >= SEUIL_ENTRETIEN_MOIS;
  });
}


// Utilisée par les vues Semaine/Mois : retrouve la tâche assignée à un
// employé pour une date donnée, peu importe à quelle heure précise
// elle a été déposée (une seule source de vérité — les clés horaires
// de `planning` — pour que toutes les vues restent synchronisées).
// Clé de tâche d'une ligne d'heures : un chantier de plusieurs jours
// range ses heures sous « id::AAAA-MM-JJ » — on remonte à l'identifiant
// de la tâche. (Au niveau MODULE depuis 2026-08-21 : le tableau de bord
// en a besoin lui aussi, il vivait dans l'agenda seulement.)
export function cleTacheDesHeures(tacheIdBrut) {
  return String(tacheIdBrut || "").split("::")[0];
}

// 📱 Tâches d'une journée AVEC leur heure de départ — pour la vue
// LISTE du téléphone (2026-08-21) : une grille de 24 colonnes est
// illisible sur un écran de 6 pouces, mais la journée se lit très bien
// en liste, dans l'ordre.

export function tachesDuJourPourEmploye(planning, dateStr, employeId) {
  // TOUTES les tâches du jour (uniques, dans l'ordre de leur première
  // heure) — les vues Semaine/Mois les empilent pour n'en perdre aucune.
  const vues = new Set();
  const liste = [];
  for (const h of HEURES) {
    listeCellule(planning[`${dateStr}|${employeId}|${h}`]).forEach((t) => {
      if (t && !vues.has(t.id)) {
        vues.add(t.id);
        liste.push(t);
      }
    });
  }
  return liste;
}


export const TYPES_TACHE = [
  { id: "appel_service", label: "Appel de service", description: "Facturation automatique depuis le bon de commande" },
  { id: "devis", label: "Travaux avec devis", description: "Facturation uniquement à partir d'un devis — validation admin requise" },
  { id: "temps_materiel", label: "Travaux en temps et matériel", description: "Facturation automatique depuis le bon de commande" },
  { id: "entretien_contrat", label: "Entretien selon contrat", description: "Facturation selon contrat — 1 à 4 factures par an" },
  // ---- TYPES NON FACTURABLES ----
  // Rien ne part en facturation : ces tâches n'apparaissent jamais dans
  // l'onglet Facturation, il n'y a donc rien à refuser ni à oublier.
  // Les heures restent PAYÉES — c'est la facturation qui change, pas la paie.
  { id: "visite_chantier", label: "Visite de chantier", description: "Non facturable — heures aux frais administratifs (ou au projet, au choix)", nonFacturable: true, admin: true },
  { id: "visite_soumission", label: "Visite pour soumission", description: "Non facturable — reste en attente tant qu'aucun devis n'y est rattaché", nonFacturable: true, admin: true, suiviDevis: true },
  { id: "divers", label: "Divers", description: "Non facturable — heures payées, hors projet et hors administratif", nonFacturable: true },
  // 🚗 COURSE / INTERNE — la même mécanique que la course créée par le
  // technicien (2026-08-17) : AUCUN client, juste une adresse. Porter
  // un camion au garage, aller chercher une pièce. Heures payées en
  // « divers », jamais facturable.
  { id: "course", label: "🚗 Course / interne (sans client)", description: "Aucun client — porter un camion au garage, chercher une pièce. Heures payées (divers), jamais facturable.", nonFacturable: true, sansClient: true },
  // 🏭 TRAVAIL AU SHOP (demande du propriétaire, 2026-08-19) — heures
  // payées à l'atelier : fabrication, préparation, ménage. Aucun client.
  // « Divers » par défaut ; LIÉ À UN PROJET, les heures comptent dans
  // SES coûts réels (fabriquer les conduits d'un chantier, c'est du
  // temps de chantier fait au shop).
  { id: "shop", label: "🏭 Travail au shop", description: "Aucun client — travail à l'atelier. Heures payées (divers — ou comptées au projet si un projet est lié). Jamais facturable.", nonFacturable: true, sansClient: true },
  // CONGÉ : ce n'est pas du travail. Aucun chronomètre, aucune heure —
  // seulement un marqueur qui bloque la journée dans l'agenda pour
  // qu'on n'y place pas de travail par erreur.
  { id: "conge", label: "Congé / absence", description: "Bloque l'agenda — aucune heure, aucun chronomètre", nonFacturable: true, sansHeures: true },
];

// Raccourcis lisibles, utilisés partout plutôt que de répéter les listes.
export const TYPE_INFO = (id) => TYPES_TACHE.find((t) => t.id === id) || null;

export const estTypeSansClient = (id) => !!TYPE_INFO(id)?.sansClient || id === "conge";


// 🚗 TRANSPORT DÉBUT/FIN DE JOURNÉE payé ? (2026-09-05) — UN seul juge
// pour l'agenda, le téléphone et les paies : la dérogation de la FICHE
// d'abord (toujours/jamais), le réglage de l'ENTREPRISE sinon. Le
// transport journalier CCQ entre deux clients n'est PAS touché — c'est
// du temps de travail, toujours payé.
export function transportQuotidienPayePour(employe, config) {
  const v = employe?.transportQuotidien;
  if (v === "oui") return true;
  if (v === "non") return false;
  return config?.transportQuotidienPaye !== false;
}
