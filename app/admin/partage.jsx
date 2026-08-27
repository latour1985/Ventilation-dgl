"use client";

// app/admin/partage.jsx
//
// LE SOCLE COMMUN de l'application d'administration — première tranche
// du DÉCOUPAGE de page.jsx (2026-08-28, ~24 300 lignes au départ).
// Ici vivent les constantes, les petits utilitaires PURS et les
// composants génériques que plusieurs onglets partagent. Extraction
// MÉCANIQUE : aucun comportement ne change, le code est déplacé tel
// quel — seuls des `export`/`import` s'ajoutent.

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { ZONES_DEPOTS, zonesDepuis } from "@/lib/supabase/prixDepots";
import { permissionsPour } from "@/lib/permissions";

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

export function BarrePagination({ total, page, onPage, refHaut = null, libelle = "items" }) {
  const nbPages = Math.max(1, Math.ceil(total / ITEMS_PAR_PAGE));
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

// MÉTIERS AJOUTÉS PAR L'ADMIN (électricien, plombier…) — la grille des
// taux est leur registre : tout métier qui y figure existe. Un métier
// absent de la table ci-dessus reçoit la structure CCQ standard — jamais
// de plantage sur un métier inconnu.
export const NIVEAUX_CCQ_DEFAUT = ["Apprenti 1", "Apprenti 2", "Apprenti 3", "Apprenti 4", "Compagnon"];

export const niveauxPourMetier = (m) => NIVEAUX_PAR_METIER[m] || NIVEAUX_CCQ_DEFAUT;
// Métiers de terrain effectifs = les deux fondateurs + ceux ajoutés dans
// la grille des taux (Tarifs). Les métiers de bureau n'y sont jamais.

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
