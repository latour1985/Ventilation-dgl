"use client";

// app/admin/OngletAgenda.jsx
//
// AGENDA (grille de planification, creation de taches, glisser-deposer,
// transports systeme, fermeture par le bureau) — tranche T13, la
// derniere et la plus grosse du decoupage de page.jsx (2026-09-01).
// Extraction MECANIQUE : aucun comportement ne change, le code est
// deplace tel quel — seuls des export/import s'ajoutent.

import { useEffect, useRef, useState } from "react";
import { Briefcase, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Lock, MapPin, Pencil, Plus, User, X } from "lucide-react";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { assignerTacheSupabase, retirerTacheSupabase, majFacturableAssignation, majDonneesAssignation, traiterPropositionProjetShop } from "@/lib/supabase/tachesAssignees";
import { estCourrielST } from "@/lib/supabase/sousTraitants";
import { estFerieCcq, marqueurCcq } from "@/lib/calendrierCcq";
import { useLangue } from "@/lib/i18n";
import { taxesDepot } from "@/lib/supabase/depots";
import { televerserPieceJointeTache } from "@/lib/supabase/photosTravaux";
import { envoyerPushA } from "@/lib/notificationsPush";
import { pieceBloqueLaTache } from "@/lib/supabase/piecesCommandees";
import { enregistrerBonTravailBureau, rattacherAuBon } from "@/lib/supabase/bonsTravail";
import { enregistrerTravailPourEmploye, heuresRattachablesA, rattacherProjetAuxHeures } from "@/lib/supabase/travauxEffectues";
import { annulerFactureDepot, envoyerFactureQbo, lireEstimateQbo } from "@/lib/quickbooksClient";
import { ModalEditionTache } from "./ModalEditionTache";
import { ModalEditionClient, ModalNouveauClient } from "./OngletClients";
import { AutocompleteAdresse, Button, courrielDefautClient, FREQUENCES_CONTRAT, HEURES, HEURES_QUART, HEURE_PAR_DEFAUT, TYPES_TACHE, TYPE_INFO, ajouterJours, cleTacheDesHeures, dateISO, estTypeSansClient, indexCaseHeure, libelleAdresse, listeCellule, nomAffichageClient, tachesDuJourPourEmploye, todayISO, zonesEffectives, transportQuotidienPayePour } from "./partage";

export function texteDevisPourDescription(devis) {
  return (devis?.lignes || [])
    .map((l) => {
      const detail = String(l.description || "").trim();
      return `${l.quantite} × ${l.nom}${detail ? `\n${detail}` : ""}`;
    })
    .join("\n\n");
}

export function heureLocaleHHMM(horodatage) {
  const d = new Date(horodatage);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


export function tacheTransportSysteme(moment, employeId, dateISO, heure) {
  return {
    id: `transport-${moment}-${employeId}-${dateISO}`,
    type: "transport",
    momentTransport: moment,
    titre: moment === "debut" ? "Transport — Début de journée" : "Transport — Fin de journée",
    est_tache_systeme: true,
    employeId,
    heure,
    heures: 1,
    jours: 0,
    statut: "planifiee",
  };
}


// sansTransport (2026-09-05) : identifiants d'employes SANS transport
// debut/fin paye (reglage d'entreprise + derogation par fiche) — leurs
// blocs systeme ne sont pas fabriques. Le transport CCQ entre deux
// clients n'est pas concerne (toujours paye).
export function recalculerTransports(planning, sansTransport = new Set()) {
  const resultat = {};
  const groupes = {}; // `${date}|${employeId}` -> { date, employeId, indices: [] }
  Object.entries(planning).forEach(([cle, valeur]) => {
    // On retire les anciens transports système — ils seront replacés.
    const reelles = listeCellule(valeur).filter((t) => !t?.est_tache_systeme);
    if (reelles.length === 0) return;
    resultat[cle] = reelles;
    // 🏖️ Un CONGÉ n'est pas un déplacement (2026-09-02, demande du
    // propriétaire) : il reste affiché avec sa journée et son heure,
    // mais ne fabrique aucun bloc Transport Début/Fin. S'il partage la
    // journée avec une vraie tâche, les transports de la vraie tâche
    // s'installent normalement.
    const deplacements = reelles.filter((t) => t?.typeTache !== "conge" && t?.type !== "conge");
    if (deplacements.length === 0) return;
    const [date, employeId, heure] = cle.split("|");
    const g = `${date}|${employeId}`;
    if (!groupes[g]) groupes[g] = { date, employeId, indices: [] };
    const idx = HEURES.indexOf(heure);
    if (idx >= 0) groupes[g].indices.push(idx);
  });
  Object.values(groupes).forEach(({ date, employeId, indices }) => {
    if (indices.length === 0) return;
    // 🤝 SOUS-TRAITANTS : jamais de transports système (retour de tests
    // 2026-08-19) — on ne paie ni ne suit leur déplacement, leur rangée
    // ne montre que leurs blocs de présence.
    if (String(employeId).startsWith("st-")) return;
    // 🚗 Employe sans transport paye : pas de blocs Debut/Fin.
    if (sansTransport.has(String(employeId))) return;
    const idxDebut = Math.min(...indices) - 1; // la case juste avant la 1re tâche
    const idxFin = Math.max(...indices) + 1; // la case juste après la dernière
    if (idxDebut >= 0) {
      const cle = `${date}|${employeId}|${HEURES[idxDebut]}`;
      resultat[cle] = [...listeCellule(resultat[cle]), tacheTransportSysteme("debut", employeId, date, HEURES[idxDebut])];
    }
    if (idxFin < HEURES.length) {
      const cle = `${date}|${employeId}|${HEURES[idxFin]}`;
      resultat[cle] = [...listeCellule(resultat[cle]), tacheTransportSysteme("fin", employeId, date, HEURES[idxFin])];
    }
  });
  return resultat;
}

export function compresserImageJointe(file) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Fichier illisible"));
    lecteur.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const largeurMax = 1600;
        const echelle = Math.min(1, largeurMax / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * echelle;
        canvas.height = img.height * echelle;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve({ blob }) : reject(new Error("Compression échouée"))), "image/jpeg", 0.8);
      };
      img.src = e.target.result;
    };
    lecteur.readAsDataURL(file);
  });
}


export function ModalChoixFacturable({ info, onChoisir }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-sm font-extrabold text-slate-900">
          {info.employe?.nom || "Ce technicien"} s'ajoute sur « {info.titre} »
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Ses heures sont-elles <span className="font-extrabold">facturables au client</span> ?
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Le premier technicien est toujours facturable. Ta réponse ne change ni la paie ni les coûts —
          seulement le calcul de facturation. (Redéposer le technicien sur la tâche repose la question.)
        </p>
        <div className="mt-3 grid gap-2">
          <button
            onClick={() => onChoisir(true)}
            className="min-h-[48px] w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 text-sm font-extrabold text-emerald-800 active:scale-[0.99]"
          >
            💰 Facturable au client
          </button>
          <button
            onClick={() => onChoisir(false)}
            className="min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 text-sm font-extrabold text-slate-700 active:scale-[0.99]"
          >
            🤝 Non facturable (aide interne, apprenti…)
          </button>
        </div>
      </div>
    </div>
  );
}


export function joursDuMois(date) {
  const annee = date.getFullYear();
  const mois = date.getMonth();
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  return Array.from({ length: nbJours }, (_, i) => new Date(annee, mois, i + 1));
}


export function calculerJoursCibles(dateDepart, nbJours, sauterWeekend, sauterFeries = false) {
  const resultat = [];
  let curseur = new Date(dateDepart);
  let securite = 0;
  while (resultat.length < Math.max(1, nbJours) && securite < 60) {
    const jourSemaine = curseur.getDay(); // 0 = dimanche, 6 = samedi
    const weekendSaute = sauterWeekend && (jourSemaine === 0 || jourSemaine === 6);
    // 📅 Calendrier CCQ (2026-08-31) : la tâche enjambe aussi les jours
    // fériés chômés — même mécanique que les fins de semaine.
    const ferieSaute = sauterFeries && estFerieCcq(dateISO(curseur));
    if (!weekendSaute && !ferieSaute) {
      resultat.push(new Date(curseur));
    }
    curseur = ajouterJours(curseur, 1);
    securite += 1;
  }
  return resultat;
}


export function tachesDuJourAvecHeure(planning, dateStr, employeId) {
  const parId = new Map();
  for (const h of HEURES) {
    listeCellule(planning[`${dateStr}|${employeId}|${h}`]).forEach((t) => {
      if (t && !parId.has(t.id)) parId.set(t.id, { tache: t, heure: h });
    });
  }
  return [...parId.values()];
}


export const estTypeNonFacturable = (id) => !!TYPE_INFO(id)?.nonFacturable;

export const estTypeSansHeures = (id) => !!TYPE_INFO(id)?.sansHeures;

export const estTypeAdministratif = (id) => !!TYPE_INFO(id)?.admin;

export const COULEUR_TYPE_TACHE = {
  // Turquoise VIF : lisible avec le texte noir (l'ancien gris foncé ne se
  // lisait pas) et bien distinct des transports gris, du bleu des devis,
  // de l'orange temps & matériel et du mauve des contrats.
  appel_service: { fond: "bg-teal-400", pastille: "bg-teal-500", bordurePastille: "border-teal-500", texte: "text-teal-700", clair: "bg-teal-100" },
  devis: { fond: "bg-blue-600", pastille: "bg-blue-500", bordurePastille: "border-blue-500", texte: "text-blue-700", clair: "bg-blue-100" },
  temps_materiel: { fond: "bg-[#FF6A13]", pastille: "bg-[#FF6A13]", bordurePastille: "border-[#FF6A13]", texte: "text-[#B14E0E]", clair: "bg-orange-100" },
  entretien_contrat: { fond: "bg-purple-600", pastille: "bg-purple-500", bordurePastille: "border-purple-500", texte: "text-purple-700", clair: "bg-purple-100" },
  // NON FACTURABLES — teintes volontairement sourdes : elles ne
  // rapportent rien, elles ne doivent pas attirer l'œil comme un
  // contrat. Le congé est le plus effacé de tous : c'est une absence.
  visite_chantier: { fond: "bg-sky-500", pastille: "bg-sky-500", bordurePastille: "border-sky-500", texte: "text-sky-700", clair: "bg-sky-100" },
  visite_soumission: { fond: "bg-indigo-500", pastille: "bg-indigo-500", bordurePastille: "border-indigo-500", texte: "text-indigo-700", clair: "bg-indigo-100" },
  divers: { fond: "bg-stone-400", pastille: "bg-stone-400", bordurePastille: "border-stone-400", texte: "text-stone-700", clair: "bg-stone-100" },
  course: { fond: "bg-stone-500", pastille: "bg-stone-500", bordurePastille: "border-stone-500", texte: "text-stone-700", clair: "bg-stone-100" },
  // 🏭 Travail au shop — lime : la seule teinte encore libre qui reste
  // discrète (interne, non facturable) sans se confondre avec divers.
  shop: { fond: "bg-lime-400", pastille: "bg-lime-500", bordurePastille: "border-lime-500", texte: "text-lime-700", clair: "bg-lime-100" },
  conge: { fond: "bg-zinc-300", pastille: "bg-zinc-400", bordurePastille: "border-zinc-400", texte: "text-zinc-600", clair: "bg-zinc-100" },
};

export const COULEUR_TYPE_DEFAUT = COULEUR_TYPE_TACHE.temps_materiel;

// ============================================================
// MODAL DE DÉTAIL D'UNE TÂCHE DE L'AGENDA
// ============================================================

// Techniciens actuellement assignés à une tâche (balayage du planning),
// avec un résumé lisible de l'horaire propre de chacun — alimente la
// section « Appliquer la modification à… » de la modale d'édition.
export function techniciensPourTache(planning, tacheId, employes) {
  const infos = {};
  Object.entries(planning).forEach(([cle, valeur]) => {
    if (!listeCellule(valeur).some((t) => t?.id === tacheId)) return;
    const [dateCle, empId, heure] = cle.split("|");
    const e = (infos[empId] = infos[empId] || { employeId: empId, dates: new Set(), premiereHeure: heure, nbCases: 0 });
    e.dates.add(dateCle);
    if (heure < e.premiereHeure) e.premiereHeure = heure;
    e.nbCases++;
  });
  return Object.values(infos).map((e) => {
    const nbJours = e.dates.size;
    const heuresParJour = nbJours > 0 ? Math.round(e.nbCases / nbJours) : 0;
    const premiereDate = [...e.dates].sort()[0];
    return {
      employeId: e.employeId,
      nom: employes.find((x) => x.id === e.employeId)?.nom || e.employeId,
      detail: `${premiereDate} · ${e.premiereHeure} · ${heuresParJour >= HEURES.length ? "journée complète" : `${heuresParJour} h/jour`} · ${nbJours} jour${nbJours > 1 ? "s" : ""}`,
    };
  });
}

// ============================================================
// 🏗️ CRÉER UN PROJET À PARTIR D'UNE TÂCHE (2026-08-22)
// ------------------------------------------------------------
// Un projet n'est pas qu'un dossier : c'est un BUDGET (prévu vs réel)
// — rien de tout ça n'existe sur une tâche, la transformation ne peut
// donc pas être automatique. On pré-remplit ce qu'on SAIT (client,
// adresse, secteur, nom, date) et l'humain n'entre que les montants.
// La ventilation fine (transport, matériaux, sous-traitants) reste
// ajustable ensuite dans l'onglet Projets — ici on garde le strict
// minimum pour que la rentabilité soit juste dès le départ.
// ============================================================
export function ModalProjetDepuisTache({ tache, clients, onFermer, onCreer }) {
  const client = (clients || []).find((c) => c.id === tache.clientId) || (clients || []).find((c) => c.nom === tache.clientNom);
  const [nom, setNom] = useState(tache.titre || tache.clientNom || "Nouveau chantier");
  const [debut, setDebut] = useState(todayISO());
  const [fin, setFin] = useState("");
  const [facture, setFacture] = useState(0);
  const [moHeures, setMoHeures] = useState(0);
  const [moCoutant, setMoCoutant] = useState(0);
  const nb = (v) => Number(v) || 0;
  const totalFacture = nb(facture);
  const totalCoutant = nb(moCoutant);
  const marge = totalFacture - totalCoutant;
  const peutCreer = nom.trim().length > 0 && totalFacture > 0;

  const creer = () => {
    if (!peutCreer) return;
    onCreer({
      id: `projet-${Date.now()}`,
      nom: nom.trim(),
      clientId: client?.id || tache.clientId || null,
      adresseTravaux: tache.adresseTravaux || tache.adresseIntervention || null,
      dateDebut: debut,
      dateFin: fin || debut,
      // Le secteur CCQ vient de la tâche (commercial par défaut).
      secteur: tache.secteur === "residentiel" ? "residentiel" : "commercial",
      statut: "En cours", // du travail y est déjà rattaché
      budgetTotal: totalFacture,
      tauxHoraireCoutant: nb(moHeures) > 0 ? nb(moCoutant) / nb(moHeures) : 45,
      bonsCommande: [],
      budgetPrevu: {
        mainOeuvreChantier: { heures: nb(moHeures), facture: totalFacture, coutant: nb(moCoutant) },
        transport: { heures: 0, facture: 0, coutant: 0 },
        materiaux: { facture: 0, coutant: 0 },
        sousTraitants: [],
        totalFacture,
        totalCoutant,
        marge,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; onFermer(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">🏗️ Créer un projet à partir de cette tâche</h3>
            <p className="text-xs text-slate-500">{tache.titre || tache.clientNom}</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-600">
          Le client, l&apos;adresse et le secteur sont repris de la tâche. Entre le budget — c&apos;est ce qui permet de
          suivre la rentabilité. Tu pourras détailler transport, matériaux et sous-traitants dans l&apos;onglet Projets.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Nom du projet</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {(client || tache.clientNom) && (
            <p className="text-[11px] text-slate-500">
              Client : <span className="font-bold text-slate-700">{client?.nom || tache.clientNom}</span>
              {(tache.adresseTravaux || tache.adresseIntervention) && (
                <span className="block">Travaux : {tache.adresseTravaux || tache.adresseIntervention}</span>
              )}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Début</label>
              <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Fin prévue</label>
              <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Montant facturé au client ($)</label>
            <InputNombreDecimal valeur={facture} onChange={setFacture} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Heures prévues</label>
              <InputNombreDecimal valeur={moHeures} onChange={setMoHeures} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Coûtant main-d&apos;œuvre ($)</label>
              <InputNombreDecimal valeur={moCoutant} onChange={setMoCoutant} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
          </div>
          {totalFacture > 0 && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
              Marge prévue : {marge.toFixed(2)} $ ({totalFacture > 0 ? ((marge / totalFacture) * 100).toFixed(1) : "0"} %)
            </p>
          )}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
            ⚠️ En créant le projet, cette tâche y est rattachée — et les <span className="font-bold">heures déjà pointées</span>{" "}
            comptent tout de suite dans ses coûts réels.
          </p>
          <Button onClick={creer} disabled={!peutCreer} className="w-full">
            Créer le projet et y rattacher la tâche
          </Button>
          {!peutCreer && (
            <p className="text-center text-[11px] text-slate-400">Il manque : un nom et un montant facturé supérieur à 0 $.</p>
          )}
        </div>
      </div>
    </div>
  );
}


export function OngletAgenda({ tachesAttente, setTachesAttente, planning, setPlanning, ajouterJournal, clients, setClients, devisListe, projets, lectureSeule, employes, travaux, bons, pieces, depots, prixDepots, onCreerDepot, onCreerDepotDejaPaye, onDepotPaye, onDetacherPiece, onCreerProjet, role, onMajFacturable, facturablesAssignations = {}, statutsAssignations, sousTraitants, assignationsST, onEnregistrerSousTraitant, onStatutST, onAjouterCoutSousTraitant, achatsLibres = [] }) {
  // 🚗 Employes sans transport debut/fin (reglage entreprise + fiche) —
  // les 4 recalculs de la grille passent par cette ref, toujours fraiche.
  const configTransports = useEntreprise();
  const sansTransportAgendaRef = useRef(new Set());
  sansTransportAgendaRef.current = new Set(
    (employes || []).filter((e) => !transportQuotidienPayePour(e, configTransports)).map((e) => String(e.id))
  );
  // ============================================================
  // SECTIONS DE L'AGENDA (2026-08-19, demande du propriétaire) :
  //   🔧 Équipe terrain (en haut, comme avant)
  //   🗂️ Personnel de bureau (repliée — congés et déplacements)
  //   🤝 Sous-traitants (repliée — planification + suivi Présent/Absent)
  // Le choix ouvert/replié survit au rechargement (localStorage).
  // ============================================================
  const [bureauOuvert, setBureauOuvert] = useState(() => {
    try { return localStorage.getItem("agenda-bureau-ouvert") === "1"; } catch { return false; }
  });
  const [stOuvert, setStOuvert] = useState(() => {
    try { return localStorage.getItem("agenda-st-ouvert") === "1"; } catch { return false; }
  });
  const basculerSection = (quoi) => {
    if (quoi === "bureau") {
      setBureauOuvert((v) => { try { localStorage.setItem("agenda-bureau-ouvert", v ? "0" : "1"); } catch {} return !v; });
    } else {
      setStOuvert((v) => { try { localStorage.setItem("agenda-st-ouvert", v ? "0" : "1"); } catch {} return !v; });
    }
  };
  // Fiche sous-traitant (création/édition) et statut d'un bloc ST.
  const [modalFicheST, setModalFicheST] = useState(null); // { id?, nom, specialite, telephone, note, clientId }
  const [modalStatutST, setModalStatutST] = useState(null); // { tache, employe, date }
  // Statut d'un bloc de sous-traitant — lu dans SES assignations.
  const statutBlocST = (tacheId, courrielSt) => {
    const a = (assignationsST || []).find((x) => x.tache_id === tacheId && x.employe_email === courrielSt);
    return a?.donnees?.stStatut || "prevu";
  };
  // 💰/🤝 Le choix « facturable » en attente de réponse — { tacheId, titre, employe }.
  const [choixFacturable, setChoixFacturable] = useState(null);
  // 🏗️ « Créer un projet à partir de cette tâche » — la tâche visée.
  const [projetDepuisTache, setProjetDepuisTache] = useState(null);
  // Un AUTRE technicien tient-il déjà cette tâche dans la grille ?
  const autreTechnicienALaTache = (tacheId, employeIdCourant) =>
    Object.entries(planning || {}).some(
      ([cle, cellule]) =>
        cle.split("|")[1] !== String(employeIdCourant) &&
        // 🤝 Les rangées de SOUS-TRAITANTS ne comptent pas : un ST sur la
        // tâche ne fait pas du technicien un « 2e technicien » (pas de
        // question 💰/🤝 à cause d'un sous-traitant).
        !cle.split("|")[1].startsWith("st-") &&
        listeCellule(cellule).some((x) => x.id === tacheId)
    );
  // Taux de taxes des Paramètres — dépôts affichés taxes incluses.
  const configEnt = useEntreprise();
  // Statut du dépôt d'une tâche : bloque la planification tant que le
  // dépôt n'est pas payé (ou payé manuellement) — annulé après 24 h.
  const depotDe = (tacheId) => depots?.[tacheId];
  // 🧾 Commandes rattachées à une tâche (2026-09-04) : bons de commande
  // libres + pièces commandées — affichées dans les repères de la fiche.
  const commandesPourTache = (tacheId) => {
    if (!tacheId) return [];
    return [
      ...(achatsLibres || [])
        .filter((a) => a.tacheId === tacheId)
        .map((a) => ({ cle: `a-${a.id}`, numero: a.numeroBc || "—", fournisseur: a.fournisseurNom || "", statut: a.statut === "recu" ? "reçue ✓" : "commandée", texte: a.description || "" })),
      ...(pieces || [])
        .filter((p) => p.tacheRetourId === tacheId)
        .map((p) => ({ cle: `p-${p.id}`, numero: p.numeroBc || "—", fournisseur: p.fournisseurNom || "", statut: p.statut || "", texte: p.pieceRequise || "" })),
    ];
  };
  // 📧 RENVOYER LA DEMANDE DE DÉPÔT (2026-08-29) — la MÊME facture
  // QuickBooks repart (route /send par identifiant : jamais une
  // nouvelle). Destinataire : le prospect s'il y en a un, sinon le
  // courriel par défaut de la fiche client.
  // 📧 RENVOI DE LA DEMANDE DE DÉPÔT — avec CHOIX DU COURRIEL (2026-09-04,
  // demande du propriétaire : « pouvoir modifier le courriel du client
  // pour le renvoyer au besoin ») : le bouton ouvre un petit panneau
  // (cases de la fiche + autre adresse, ajoutable au dossier) au lieu
  // d'envoyer directement au courriel par défaut.
  const [renvoiDepot, setRenvoiDepot] = useState(null); // { tache, depot, coches, extra, extraAuDossier, enCours }
  const ouvrirRenvoiDepot = (t, d) => {
    const fiche = (clients || []).find((c) => c.id === t.clientId || c.nom === t.clientNom);
    const defaut = (d.prospectCourriel || "").trim() || courrielDefautClient(fiche)?.email || "";
    setRenvoiDepot({ tache: t, depot: d, coches: defaut ? [defaut] : [], extra: "", extraAuDossier: true, enCours: false });
  };
  const executerRenvoiDepot = async () => {
    const { tache: t, depot: d, coches, extra, extraAuDossier } = renvoiDepot;
    const extraCourriel = extra.trim().toLowerCase();
    const adresses = [...new Set([...coches, ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraCourriel) ? [extraCourriel] : [])])];
    if (adresses.length === 0) return;
    setRenvoiDepot((p) => ({ ...p, enCours: true }));
    // 📌 L'adresse tapée s'offre au dossier — même réflexe que partout.
    const fiche = (clients || []).find((c) => c.id === t.clientId || c.nom === t.clientNom);
    if (extraAuDossier && fiche && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraCourriel)) {
      const dejaLa = (fiche.courriels || []).some(
        (c) => String(typeof c === "string" ? c : c?.email || "").trim().toLowerCase() === extraCourriel
      );
      if (!dejaLa) {
        const entree = { id: `cc-${Date.now()}`, label: "", email: extraCourriel, defaut: false };
        setClients((prev) => prev.map((x) => (x.id === fiche.id ? { ...x, courriels: [...(x.courriels || []), entree] } : x)));
        ajouterJournal(`📌 Courriel « ${extraCourriel} » ajouté au dossier de ${fiche.nom}`);
      }
    }
    const r = await envoyerFactureQbo(d.qboInvoiceId, adresses);
    ajouterJournal(
      r?.envoyee
        ? `📧 Demande de dépôt (${d.qboDocNumber || d.qboInvoiceId}) RENVOYÉE à ${adresses.join(", ")} — même facture QuickBooks, aucune nouvelle créée.`
        : `⚠️ Renvoi de la demande de dépôt refusé${r?.erreur ? ` : ${r.erreur}` : r?.nonConnecte ? " — QuickBooks non connecté" : ""} — réessaie.`
    );
    setRenvoiDepot(null);
  };
  const depotBloque = (tacheId) => {
    const d = depotDe(tacheId);
    return !!d && (d.statut === "en_attente_paiement" || d.statut === "annule_delai" || d.statut === "annule_qb");
  };
  // Modale « Dépôt reçu manuellement » : { tacheId } ou null.
  const [depotModal, setDepotModal] = useState(null);
  const [depotMode, setDepotMode] = useState("Comptant");
  // Tâches TERMINÉES par les techniciens (via travaux_effectues) — la clé
  // `tacheId|courriel` colore le bloc du bon technicien en vert ET donne
  // accès au travail complété (note de terrain, heures réelles).
  // Sur un chantier de PLUSIEURS JOURS, chaque journée enregistre ses
  // heures sous une clé « tacheId::date » (sinon mardi écraserait
  // lundi). On rattache donc l'heure à la tâche par le préfixe.
  const travauxParCle = new Map(
    (travaux || [])
      .filter((t) => t.supabase && t.tacheId && t.employeEmail)
      .map((t) => [`${cleTacheDesHeures(t.tacheId)}|${t.employeEmail.toLowerCase()}`, t])
  );
  // Nombre de JOURNÉES déjà pointées sur un chantier — sert au « 2/3 »
  // affiché sur le bloc : un bloc gris trois jours de suite ne dit pas
  // si le technicien y est allé.
  const joursPointes = (tache, emp) => {
    const courriel = (emp?.courriel || "").toLowerCase();
    return (travaux || []).filter(
      (t) => t.supabase && cleTacheDesHeures(t.tacheId) === tache.id && (t.employeEmail || "").toLowerCase() === courriel
    ).length;
  };
  const travailTermine = (tache, emp) =>
    travauxParCle.get(`${tache.id}|${(emp?.courriel || "").toLowerCase()}`);
  // VERT = TRAVAUX FERMÉS, pas « une journée pointée ». Sur un chantier
  // de 3 jours, les trois blocs passent au vert ensemble, quand le
  // technicien a déclaré les travaux terminés (bon de travail envoyé).
  const estTerminee = (tache, emp) => {
    const t = travailTermine(tache, emp);
    if (!t) return false;
    if (!(Number(tache.jours) > 1)) return true;
    return (bons || []).some((b) => b.tacheId === tache.id);
  };
  // ⏱️ ROSE VIF (fuchsia) = CHRONOMÈTRE PARTI (2026-08-18) : le
  // technicien a pesé Débuter et n'a pas encore fermé sa carte. Fuchsia
  // parce que TOUT le reste de la palette est pris (le bleu ciel = les
  // visites de chantier, remarque du propriétaire). Le vert (travaux
  // fermés) garde priorité.
  const estEnCours = (tache, emp) =>
    !estTerminee(tache, emp) &&
    statutsAssignations?.[`${tache.id}|${(emp?.courriel || "").toLowerCase()}`] === "en_cours";
  const [jourAffiche, setJourAffiche] = useState(new Date());
  const [vue, setVue] = useState("jour"); // "jour" | "semaine" | "mois"
  const grilleScrollRef = useRef(null);

  // ------------------------------------------------------------
  // REDIMENSIONNEMENT D'UNE TÂCHE À LA SOURIS (vue Jour) — on suit le
  // pointeur via `document.elementFromPoint` plutôt qu'un calcul en
  // pixels : les colonnes horaires ont une largeur variable
  // (`minmax(52px, 1fr)`), donc lire directement la case survolée
  // (via l'attribut `data-heure-index`) reste fiable peu importe le
  // zoom, la largeur d'écran ou le défilement horizontal en cours.
  // ------------------------------------------------------------
  const [redim, setRedim] = useState(null); // { tache, employeId, jourCible, indexDebut, spanInitial, spanActuel }
  const [survol, setSurvol] = useState(null); // { tache, employe, x, y }

  useEffect(() => {
    if (!redim) return;

    const surDeplacement = (e) => {
      // Calcul GÉOMÉTRIQUE : la durée découle de la distance parcourue
      // par la souris depuis le bord gauche du bloc (mesuré au moment où
      // la poignée est attrapée). On ne lit plus « l'élément sous le
      // curseur » : passer au-dessus du bloc lui-même ou d'un bloc voisin
      // renvoyait le numéro de SA première case → la tâche sautait à
      // 1 h puis se ré-étirait d'un coup.
      //
      // ⬅️ POIGNÉE DE GAUCHE (2026-08-28) : le bord DROIT reste figé et
      // c'est l'HEURE DE DÉBUT qui bouge — « la job commence une heure
      // plus tôt » sans avoir à déplacer le bloc puis l'étirer.
      if (redim.cote === "gauche") {
        const indexFin = redim.indexDebut + redim.spanInitial - 1;
        const nbHeures = Math.max(1, Math.min(indexFin + 1, Math.ceil((redim.finX - e.clientX) / redim.largeurCase)));
        const nouvelIndex = indexFin + 1 - nbHeures;
        setRedim((prev) =>
          prev && (prev.spanActuel !== nbHeures || prev.indexActuel !== nouvelIndex)
            ? { ...prev, spanActuel: nbHeures, indexActuel: nouvelIndex }
            : prev
        );
        return;
      }
      const maxSpan = HEURES.length - redim.indexDebut;
      const nouveauSpan = Math.max(1, Math.min(maxSpan, Math.ceil((e.clientX - redim.origineX) / redim.largeurCase)));
      setRedim((prev) => (prev && prev.spanActuel !== nouveauSpan ? { ...prev, spanActuel: nouveauSpan } : prev));
    };

    const surRelachement = () => {
      setRedim((actuel) => {
        if (actuel && actuel.spanActuel !== actuel.spanInitial) {
          // Par la gauche, l'heure de début a bougé aussi —
          // redimensionnerTache repose la tâche à partir de CETTE heure.
          const indexDepart = actuel.indexActuel ?? actuel.indexDebut;
          redimensionnerTache(actuel.tache, actuel.employeId, actuel.jourCible, HEURES[indexDepart], actuel.spanActuel);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", surDeplacement);
    window.addEventListener("pointerup", surRelachement);
    return () => {
      window.removeEventListener("pointermove", surDeplacement);
      window.removeEventListener("pointerup", surRelachement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!redim]);

  // Au chargement (et à chaque retour en vue Jour), fait défiler la
  // grille horizontalement pour que 7h00 soit la première plage
  // visible à l'écran — sans retirer les heures avant 7h ni changer
  // leur ordre : l'admin peut toujours se déplacer librement vers la
  // gauche (heures plus tôt) ou la droite (heures plus tard) au besoin.
  useEffect(() => {
    if (vue !== "jour") return;
    // requestAnimationFrame plutôt qu'un calcul immédiat : au tout
    // premier rendu, la grille peut ne pas avoir encore sa largeur
    // intrinsèque finale (min-w-[640px]) au moment où l'effet
    // s'exécute — sans ce délai, scrollWidth === clientWidth et il
    // n'y a alors rien à faire défiler.
    const id = requestAnimationFrame(() => {
      if (!grilleScrollRef.current) return;
      // La colonne des noms est maintenant collante (sticky) : elle
      // occupe en permanence les 120 premiers pixels à gauche. Pour que
      // 07:00 apparaisse juste APRÈS elle (et non caché dessous), le
      // défilement ne compte plus la largeur de cette colonne.
      const LARGEUR_MIN_COLONNE_HEURE = 52;
      const indexSeptHeures = HEURES.indexOf("07:00");
      grilleScrollRef.current.scrollLeft = indexSeptHeures * LARGEUR_MIN_COLONNE_HEURE;
    });
    return () => cancelAnimationFrame(id);
  }, [vue]);

  const [tacheSurvolee, setTacheSurvolee] = useState(null);
  const [tacheDetailOuverte, setTacheDetailOuverte] = useState(null); // { tache, employe, date, heure }
  const [tacheEnEditionId, setTacheEnEditionId] = useState(null);
  // 🎴 Carte d'attente dépliée (une seule à la fois) — les autres
  // restent sur UNE ligne : pastille, titre, chips d'état.
  const [tacheDepliee, setTacheDepliee] = useState(null);
  const [assignationMobile, setAssignationMobile] = useState(null); // {tacheId, employeId, heure, date}
  // 📱 AGENDA TÉLÉPHONE — LISTE DÉPLIÉE (essai des cartes repliées
  // abandonné le 2026-08-22 après usage réel : ça tenait dans un écran,
  // mais ça se lisait moins bien qu'un simple défilement où tout est
  // déjà là. Rien à ouvrir, rien à mémoriser.)
  //
  // 📋 / ▦ DEUX MODES AU CHOIX (2026-08-22, demande du propriétaire).
  // ------------------------------------------------------------
  // La liste se lit vite, mais elle ne montre pas la FORME de la
  // journée — qui est libre à 10 h, qui déborde. La grille, elle, le
  // montre d'un coup d'œil ; elle demande juste de glisser de côté.
  // Les deux servent, à des moments différents : c'est donc un choix,
  // pas une devinette sur la largeur de l'écran. Mémorisé PAR
  // APPAREIL — le téléphone garde son réglage, le bureau le sien.
  const [modeAgendaMobile, setModeAgendaMobile] = useState("liste");
  useEffect(() => {
    try {
      if (localStorage.getItem("agenda-mobile-mode") === "grille") setModeAgendaMobile("grille");
    } catch {
      // stockage indisponible — on reste sur la liste, le choix sûr
    }
  }, []);
  const choisirModeAgenda = (mode) => {
    setModeAgendaMobile(mode);
    try {
      localStorage.setItem("agenda-mobile-mode", mode);
    } catch {}
  };
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  // « ➕ Nouveau client » depuis la création de tâche (fenêtre partagée).
  const [modalNouveauClientTache, setModalNouveauClientTache] = useState(false);
  // 👯 Tâche jumelle détectée à la création — { titre, client, date } :
  // la fenêtre demande confirmation avant de créer une seconde fois.
  const [doublonTache, setDoublonTache] = useState(null);
  // ✏️ Correction rapide de la fiche du client choisi, sans quitter la
  // création de tâche (retour de tests 2026-08-17 : « où est l'option
  // pour modifier les clients ? » — elle existait dans l'onglet Clients,
  // maintenant elle est aussi ICI, là où on en a besoin).
  const [clientEnEditionAgenda, setClientEnEditionAgenda] = useState(null);
  // Onglets du panneau « Tâches en attente » : PRÊTES à planifier
  // (glissables maintenant) vs EN ATTENTE (bloquées par un dépôt non
  // payé/annulé). Une tâche change d'onglet automatiquement dès que son
  // dépôt est payé.
  const [ongletAttente, setOngletAttente] = useState("pretes");
  // Une tache de RETOUR attend sa piece : elle ne peut pas aller a
  // l'horaire tant que la piece n'est pas recue (et payee si exige).
  // Meme mecanique que les depots — on reutilise la meme pile bloquee.
  const pieceBloque = (tacheId) => {
    const p = (pieces || []).find((x) => x.tacheRetourId === tacheId);
    return pieceBloqueLaTache(p);
  };
  const estBloquee = (t) => depotBloque(t.id) || pieceBloque(t.id);
  const tachesPretes = tachesAttente.filter((t) => !estBloquee(t));
  // TROIS PILES, PAS DEUX — parce que le GESTE diffère.
  //
  // Un dépôt impayé, on rappelle le CLIENT pour de l'argent. Une pièce
  // qui n'arrive pas, on rappelle le FOURNISSEUR. Ce n'est pas la même
  // personne au bureau qui décroche, et les mélanger obligeait à lire
  // chaque carte pour savoir laquelle des deux on regarde.
  const tachesPiece = tachesAttente.filter((t) => pieceBloque(t.id));
  const tachesBloquees = tachesAttente.filter((t) => depotBloque(t.id) && !pieceBloque(t.id));
  const tachesAttenteAffichees =
    ongletAttente === "bloquees" ? tachesBloquees : ongletAttente === "pieces" ? tachesPiece : tachesPretes;
  // Une date promise déjà dépassée : le compteur de l'onglet vire au
  // rouge pour que personne n'ait à ouvrir la pile pour le découvrir.
  const piecesEnRetard = (pieces || []).filter((p) => p.enRetard).length;
  const [nouveauTitre, setNouveauTitre] = useState("");
  // ASSISTANT EN 2 ÉTAPES (demande du propriétaire, 2026-08-17) : le
  // TYPE d'abord (grandes tuiles), puis un formulaire qui ne montre que
  // les cases utiles à ce type.
  const [etapeTypeTache, setEtapeTypeTache] = useState(true);
  const [adresseCourseLibre, setAdresseCourseLibre] = useState("");
  // 📎 PIÈCES JOINTES (photos du site, plans PDF) — téléversées dès la
  // sélection, transmises au technicien AVEC la tâche (via donnees).
  const [nouvellesPiecesJointes, setNouvellesPiecesJointes] = useState([]);
  const [televersementJointe, setTeleversementJointe] = useState(false);
  const ajouterPiecesJointes = async (fichiers) => {
    setTeleversementJointe(true);
    for (const fichier of fichiers) {
      try {
        if (fichier.type === "application/pdf") {
          if (fichier.size > 15 * 1024 * 1024) {
            ajouterJournal(`⚠️ « ${fichier.name} » dépasse 15 Mo — allège le PDF avant de le joindre.`);
            continue;
          }
          const url = await televerserPieceJointeTache(fichier);
          setNouvellesPiecesJointes((prev) => [...prev, { url, nom: fichier.name, type: "pdf" }]);
        } else if (fichier.type.startsWith("image/")) {
          const { blob } = await compresserImageJointe(fichier);
          const url = await televerserPieceJointeTache(fichier, { blob, contentType: "image/jpeg" });
          setNouvellesPiecesJointes((prev) => [...prev, { url, nom: fichier.name, type: "image" }]);
        } else {
          ajouterJournal(`⚠️ « ${fichier.name} » ignoré — seuls les images et les PDF sont acceptés.`);
        }
      } catch {
        ajouterJournal(`⚠️ Téléversement de « ${fichier.name} » échoué — réessaie.`);
      }
    }
    setTeleversementJointe(false);
  };
  // AUCUN client présélectionné (demande du propriétaire, 2026-08-17) :
  // avant, le premier en ordre alphabétique était choisi d'office — une
  // tâche pouvait partir sur le mauvais client par simple distraction.
  const [nouveauClientId, setNouveauClientId] = useState("");
  const [nouveauType, setNouveauType] = useState("appel_service");
  // TEMPS SUR LE PROJET, OU FRAIS ADMINISTRATIFS ?
  //
  // La même visite n'a pas le même sens selon le moment : préparer une
  // soumission qu'on ne remportera peut-être pas est un coût de VENTE,
  // alors qu'une visite sur un chantier en cours est un coût de CE
  // projet. Aucun automatisme ne peut trancher — c'est un choix humain,
  // fait au moment de créer la tâche.
  //
  // Par défaut décoché (= administratif), comme le propriétaire l'a
  // décrit : ces visites sont normalement faites par l'administration.
  const [tempsSurProjet, setTempsSurProjet] = useState(false);
  // --- Dépôt préalable (coché d'office pour les appels de service) ---
  const [depotRequis, setDepotRequis] = useState(true);
  const [depotMontant, setDepotMontant] = useState("");
  // 🗺️ ZONE DE TARIFICATION — INDÉPENDANTE DU DÉPÔT (2026-08-25,
  // demande du propriétaire). Avant, la zone se choisissait DANS le
  // bloc dépôt : décocher le dépôt (client régulier, payeur sur
  // facture) créait un appel SANS zone — et la facturation ne savait
  // plus ni le prix de base ni la règle du temps inclus (90 min chez
  // le client en zone, 180 min TOTALES transport compris hors zone).
  // La zone est maintenant un choix OBLIGATOIRE de l'appel de service,
  // dépôt ou pas ; le montant du dépôt en DÉCOULE quand il est requis.
  const [zoneAppelChoix, setZoneAppelChoix] = useState(""); // "", nom de zone, ou "hors_zone"
  // Destinataires de la DEMANDE DE DÉPÔT (courriel avec facture QBO) —
  // les adresses par défaut du client sont précochées au choix du client.
  const [depotEmails, setDepotEmails] = useState([]);
  // 💳 CHOIX VISIBLE carte/virement pour CETTE demande de dépôt
  // (2026-08-30, retour du propriétaire : « je n'ai pas l'option des
  // cartes quand on envoie la demande »). Avant, le choix était
  // automatique (Paramètres + seuil) mais INVISIBLE — impossible de
  // savoir, au moment d'envoyer, si le courriel offrirait un bouton de
  // paiement. null = automatique ; true/false = choix de l'admin pour
  // cet envoi seulement (les Paramètres ne bougent pas).
  const [depotCarteChoix, setDepotCarteChoix] = useState(null);
  const [depotVirementChoix, setDepotVirementChoix] = useState(null);
  // ✅ DÉPÔT DÉJÀ PAYÉ AILLEURS (2026-08-31, transfert de l'ancien
  // système) : on enregistre le fait (mode + Nº de facture QuickBooks
  // existante) — aucune facture créée, aucun courriel, tâche prête.
  const [depotDejaPaye, setDepotDejaPaye] = useState(false);
  const [depotDejaPayeMode, setDepotDejaPayeMode] = useState("Carte de crédit");
  const [depotDejaPayeRef, setDepotDejaPayeRef] = useState("");
  const [depotExtra, setDepotExtra] = useState("");
  // 📌 « Autre adresse » AU DOSSIER (2026-08-24, demande du
  // propriétaire) : un courriel tapé ici partait avec la demande de
  // dépôt puis disparaissait — à la prochaine tâche du même client, il
  // fallait le retaper. Même patron que l'adresse de chantier : coché
  // d'avance, anti-doublon, trace au journal.
  const [depotExtraAuDossier, setDepotExtraAuDossier] = useState(true);
  // Le défaut suit le type : appel de service = dépôt suggéré d'office.
  useEffect(() => {
    // Le dépôt d'appel suit la RÈGLE DE L'ENTREPRISE (Paramètres →
    // Appels de service) — certaines n'exigent pas de dépôt.
    setDepotRequis(nouveauType === "appel_service" && configEnt?.appelsDepotDefaut !== false);
  }, [nouveauType]);
  const [nouveauDevisId, setNouveauDevisId] = useState("");
  const [nouvelleFrequence, setNouvelleFrequence] = useState(4);
  const [nouveauProjetId, setNouveauProjetId] = useState(""); // "" = Aucun / Projet général
  // 🏗️ Mini-panneau « créer un projet pour cette tâche » (2026-09-03).
  const [miniProjetOuvert, setMiniProjetOuvert] = useState(false);
  const [miniProjetNom, setMiniProjetNom] = useState("");
  const [miniProjetFacture, setMiniProjetFacture] = useState("");
  const [miniProjetCoutant, setMiniProjetCoutant] = useState("");
  // SECTEUR CCQ — décide du taux coûtant de chaque heure. Hérité du
  // (DOIT vivre APRÈS nouveauProjetId : l'avoir déclaré AVANT plantait
  // tout l'onglet Agenda — « cannot access before initialization ».
  // Trouvé par le propriétaire en production, 2026-08-15.)
  // PROJET choisi (option validée par le propriétaire), Commercial par
  // défaut, changeable au cas par cas.
  // AUCUNE présélection (demande du propriétaire, 2026-08-17) : le
  // secteur décide du taux coûtant CCQ figé — un « Commercial » oublié
  // faussait la paie de toute la tâche. Choix obligatoire à la création
  // (sauf types sans heures) ; un projet choisi l'hérite quand même.
  const [nouveauSecteur, setNouveauSecteur] = useState("");
  useEffect(() => {
    const projetChoisi = (projets || []).find((pr) => pr.id === nouveauProjetId);
    if (projetChoisi?.secteur) setNouveauSecteur(projetChoisi.secteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nouveauProjetId]);
  const [adresseTravauxDifferente, setAdresseTravauxDifferente] = useState(false);
  const [adresseTravauxId, setAdresseTravauxId] = useState("");
  const [nouvelleAdresseTravaux, setNouvelleAdresseTravaux] = useState(null); // résultat de l'autocomplétion
  // 📌 Une NOUVELLE adresse tapée s'enregistre au dossier du client
  // (coché d'avance — retour de tests 2026-08-17 : l'adresse d'une tâche
  // précédente n'était jamais offerte à la suivante).
  const [enregistrerAdresseFiche, setEnregistrerAdresseFiche] = useState(true);
  // Planification directe dès la création — si date + technicien sont
  // tous les deux renseignés, la tâche se positionne immédiatement
  // dans la grille plutôt que d'atterrir dans "Tâches en attente".
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [nouvelleHeureDebut, setNouvelleHeureDebut] = useState(HEURE_PAR_DEFAUT);
  const [nouveauEmployeId, setNouveauEmployeId] = useState("");
  // MULTI-TECHNICIENS à la création (retour de tests 2026-08-10) : les
  // techniciens cochés EN PLUS reçoivent la MÊME tâche partagée (heures
  // additionnées, une seule facturation) — fini le détour « créer puis
  // ajouter dans l'agenda ».
  const [nouveauxEmployesEnPlus, setNouveauxEmployesEnPlus] = useState([]);
  // 💰/🤝 Choix facturable PAR technicien supplémentaire, fait À LA
  // CRÉATION (demande du propriétaire, 2026-08-17) : { employeId: true
  // (facturable) | false (aide interne) }. Obligatoire — remplace la
  // fenêtre posée après coup, qui s'écrasait quand on cochait deux
  // techniciens d'un coup (un des choix n'était jamais demandé).
  const [facturablesEnPlus, setFacturablesEnPlus] = useState({});
  // 📇 CONTACT SUR PLACE (demande du propriétaire, 2026-08-17) : la
  // personne à voir sur le chantier (chargé de projet, concierge…) —
  // souvent PAS le numéro de la fiche client. Choisi dans le carnet du
  // client, ou créé ici (et enregistré au carnet pour la prochaine
  // fois). "" = aucun (numéro de la fiche client), "nouveau" = saisie.
  const [contactSurPlaceId, setContactSurPlaceId] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactTel, setContactTel] = useState("");
  // Changer de client invalide le contact choisi (il appartient à
  // l'ancien client) — on repart à « Aucun ». Le DEVIS choisi aussi
  // (audit 2026-08-17) : sinon il restait sélectionné mais INVISIBLE
  // (filtré de la liste) et s'attachait au mauvais client.
  useEffect(() => {
    setContactSurPlaceId("");
    setContactNom("");
    setContactRole("");
    setContactTel("");
    setNouveauDevisId("");
    // Les items du devis de l'ANCIEN client sortent de la description —
    // le texte tapé à la main, lui, reste.
    if (dernierTexteDevisRef.current) {
      const ancien = dernierTexteDevisRef.current;
      dernierTexteDevisRef.current = "";
      setNouvelleDescription((prev) => (prev.includes(ancien) ? prev.split(ancien).join("").trim() : prev));
    }
    setUnitesChoisies([]);
  }, [nouveauClientId]);
  // 🔧 UNITÉS CONCERNÉES (2026-08-25, demande du propriétaire) : le
  // carnet d'équipements du client — relevé visite après visite sur les
  // bons signés — est offert à la création de la tâche. Cocher une
  // unité dit au technicien LAQUELLE travailler quand il y en a trois
  // sur le toit, et pré-remplit sa section « Unité vérifiée » (fini le
  // numéro de série retapé de travers). Clés `modele|serie`.
  const [unitesChoisies, setUnitesChoisies] = useState([]);
  const unitesConnuesDuClient = (clientId) => {
    const fiche = clients.find((x) => x.id === clientId);
    if (!fiche) return [];
    const unites = [];
    (bons || [])
      .filter((b) => b.client === fiche.nom)
      .forEach((b) => {
        const listeU =
          Array.isArray(b.unites) && b.unites.length > 0
            ? b.unites
            : b.modeleUnite || b.serieUnite
              ? [{ modele: b.modeleUnite, serie: b.serieUnite }]
              : [];
        listeU.forEach((ub) => {
          if (!(ub.modele || ub.serie)) return;
          const cle = `${ub.modele || ""}|${ub.serie || ""}`;
          const existe = unites.find((u) => u.cle === cle);
          if (existe) {
            // La plus récente gagne l'emplacement manquant.
            if (ub.emplacement && !existe.emplacement) existe.emplacement = ub.emplacement;
          } else {
            unites.push({ cle, modele: ub.modele || "", serie: ub.serie || "", emplacement: ub.emplacement || "" });
          }
        });
      });
    return unites;
  };
  // TRANSITION QUICKBOOKS : numéro d'un devis EXISTANT (hors application)
  // à attacher à la tâche — il suit jusqu'au bon de travail et à la
  // facturation.
  const [numeroDevisExistant, setNumeroDevisExistant] = useState("");
  // 🔎 Vérification du numéro tapé, DANS QuickBooks, au moment de la
  // création (2026-08-25) : une faute de frappe découverte à la
  // facturation, trois semaines plus tard, est dix fois plus chère
  // qu'ici. { etat: "cherche"|"trouve"|"introuvable"|"hors_ligne",
  // total?, nbLignes?, clientNomQbo? } — null = pas encore vérifié.
  const [verifDevisQbo, setVerifDevisQbo] = useState(null);
  const verifierDevisQbo = async () => {
    const numero = numeroDevisExistant.trim();
    if (!numero) return;
    setVerifDevisQbo({ etat: "cherche" });
    // ⏲️ 15 secondes maximum (2026-09-03, vécu : le bouton restait gelé
    // sur « … » quand QuickBooks ne répondait jamais) — au-delà, verdict
    // « injoignable » et le bouton redevient cliquable.
    const r = await Promise.race([
      lireEstimateQbo(numero),
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    if (r?.trouve) {
      setVerifDevisQbo({
        etat: "trouve",
        total: Number(r.total) || 0,
        nbLignes: (r.lignes || []).length,
        clientNomQbo: r.clientNomQbo || null,
      });
    } else if (r?.trouve === false) {
      setVerifDevisQbo({ etat: "introuvable" });
    } else {
      setVerifDevisQbo({ etat: "hors_ligne" });
    }
  };
  // Filtres de recherche des listes déroulantes (la liste RESTE — le
  // filtre la raccourcit seulement).
  const [filtreClientTache, setFiltreClientTache] = useState("");
  // 📋 Liste ouverte au clic (2026-08-25) — même raison que le devis :
  // quand on a oublié le nom, il n'y a pas de première lettre à taper.
  const [listeClientsTacheOuverte, setListeClientsTacheOuverte] = useState(false);
  const [filtreAdresseTache, setFiltreAdresseTache] = useState("");
  // Appartement / unité d'une nouvelle adresse de travaux.
  const [nouvelleAdresseApp, setNouvelleAdresseApp] = useState("");
  const [nouvelleDureeHeures, setNouvelleDureeHeures] = useState(1);
  const [nouvelleDureeJours, setNouvelleDureeJours] = useState(0);
  const [nouveauSauterWeekend, setNouveauSauterWeekend] = useState(false);
  // 📅 « Sauter les jours fériés » (CCQ) — offert seulement quand
  // l'entreprise suit le calendrier de la construction ; coché d'office
  // dans ce cas (c'est la norme de l'industrie, décocher est l'exception).
  const [nouveauSauterFeries, setNouveauSauterFeries] = useState(() => configEnt?.calendrierCcq === true);
  // Description des travaux — saisissable dès la création (avant, il
  // fallait rouvrir la fenêtre d'édition pour en écrire une).
  const [nouvelleDescription, setNouvelleDescription] = useState("");
  // 📝 Le texte de devis INJECTÉ dans la description (2026-08-29 — retour
  // du propriétaire : « je sélectionne un devis et la description ne suit
  // pas »). Mémorisé pour qu'un changement de devis REMPLACE les lignes de
  // l'ancien sans toucher à ce qui a été tapé à la main.
  const dernierTexteDevisRef = useRef("");

  // Filtrage dynamique : si un client est choisi, ne montrer que SES
  // projets ; sinon, montrer tous les projets actifs (on exclut
  // "Terminé" — un projet clos n'a plus de raison de recevoir de
  // nouvelles tâches).
  const projetsDisponibles = (projets || []).filter((p) => {
    if (p.statut === "Terminé") return false;
    if (nouveauClientId) return p.clientId === nouveauClientId;
    return true;
  });

  const jourKey = dateISO(jourAffiche);
  // ---- Les trois groupes de rangées + en-têtes intercalés ----
  const groupeTerrain = (employes || []).filter((e) => !e.estBureau && !e.estSousTraitant);
  const groupeBureau = (employes || []).filter((e) => e.estBureau);
  const groupeST = (employes || []).filter((e) => e.estSousTraitant);
  const entreesDuJourPour = (groupe) =>
    groupe.reduce((n, e) => n + tachesDuJourPourEmploye(planning, jourKey, e.id).length, 0);
  const rangeesAgenda = [
    ...groupeTerrain,
    ...(groupeBureau.length > 0 ? [{ enteteSection: "bureau" }] : []),
    ...(bureauOuvert ? groupeBureau : []),
    { enteteSection: "st" },
    ...(stOuvert ? groupeST : []),
  ];
  // Couleurs et icônes des blocs de SOUS-TRAITANTS, par statut.
  const ST_COULEURS = {
    prevu: ["border-amber-400 bg-amber-50", "bg-amber-100 text-amber-900", "bg-amber-500"],
    present: ["border-emerald-500 bg-emerald-50", "bg-emerald-100 text-emerald-900", "bg-emerald-500"],
    absent: ["border-red-400 bg-red-50", "bg-red-100 text-red-800", "bg-red-500"],
  };
  const ST_ICONES = { prevu: "⏳", present: "✅", absent: "❌" };
  const stAConfirmer = (tacheId, courrielSt, dateIso) =>
    statutBlocST(tacheId, courrielSt) === "prevu" && dateIso < dateISO(new Date());
  const renderEnteteSection = (type) => {
    const estBureauSec = type === "bureau";
    const ouvert = estBureauSec ? bureauOuvert : stOuvert;
    const groupe = estBureauSec ? groupeBureau : groupeST;
    const nbEntrees = entreesDuJourPour(groupe);
    return (
      // ⚠️ COLLANT GAUCHE/DROITE (retour de tests 2026-08-19) : cette
      // rangée vit DANS la grille à défilement horizontal — sans sticky,
      // « Personnel de bureau » et « Sous-traitants » partaient hors
      // écran dès qu'on défilait vers les heures d'après-midi.
      <div key={`entete-${type}`} className="flex items-center justify-between gap-2 border-t-2 border-slate-200 bg-slate-100/80 px-3 py-1.5">
        <button
          onClick={() => basculerSection(type)}
          className="sticky left-3 z-[1] flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600"
        >
          <ChevronDown size={13} className={`shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`} />
          {estBureauSec ? `🗂️ ${tr("Personnel de bureau")}` : `🤝 ${tr("Sous-traitants")}`} ({groupe.length})
          {!ouvert && nbEntrees > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-700">
              {nbEntrees} entrée{nbEntrees > 1 ? "s" : ""} aujourd&apos;hui
            </span>
          )}
        </button>
        {!estBureauSec && !lectureSeule && (
          <button
            onClick={() => setModalFicheST({ nom: "", specialite: "", telephone: "", note: "", clientId: "" })}
            className="sticky right-3 z-[1] shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600"
          >
            ➕ Sous-traitant
          </button>
        )}
      </div>
    );
  };
  // 🌎 Version anglaise — tranche 2b (2026-09-03) : `tr` traduit la
  // coquille de l'agenda (repli français intact), `localeDates` met les
  // DATES dans la langue choisie. Nommé `tr` (pas `t`) : les maps du
  // fichier utilisent déjà `t` comme variable — un `t` de contexte
  // serait masqué dans ces blocs et les traductions y casseraient.
  const { t: tr, langue } = useLangue();
  const localeDates = langue === "en" ? "en-CA" : "fr-CA";
  const jourLabel = jourAffiche.toLocaleDateString(localeDates, { weekday: "long", day: "numeric", month: "long" });
  const moisLabel = jourAffiche.toLocaleDateString(localeDates, { month: "long", year: "numeric" });

  const semaine = Array.from({ length: 7 }, (_, i) => ajouterJours(jourAffiche, i - jourAffiche.getDay() + 1));
  const mois = joursDuMois(jourAffiche);
  const joursAffiches = vue === "semaine" ? semaine : vue === "mois" ? mois : [];

  const reculer = () => setJourAffiche(vue === "mois" ? new Date(jourAffiche.getFullYear(), jourAffiche.getMonth() - 1, 1) : ajouterJours(jourAffiche, vue === "semaine" ? -7 : -1));
  const avancer = () => setJourAffiche(vue === "mois" ? new Date(jourAffiche.getFullYear(), jourAffiche.getMonth() + 1, 1) : ajouterJours(jourAffiche, vue === "semaine" ? 7 : 1));

  const majDureeTache = (id, champs) => {
    setTachesAttente((prev) => prev.map((t) => (t.id === id ? { ...t, ...champs } : t)));
  };

  // Choisir un client depuis les SUGGESTIONS : mêmes effets que
  // l'ancien menu (adresse, projet et destinataires du dépôt suivent).
  const choisirClientTache = (id) => {
    setNouveauClientId(id);
    setAdresseTravauxId("");
    setNouvelleAdresseTravaux(null);
    setFiltreAdresseTache("");
    setNouveauProjetId("");
    setMiniProjetOuvert(false);
    const fiche = clients.find((c) => c.id === id);
    const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
    const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
    setDepotEmails(defauts.length > 0 ? defauts : tous.slice(0, 1));
    setDepotExtra("");
  };

  // 👯 GARDE ANTI-DOUBLON (2026-08-21, vécu) : « Déconnexion de 2 unités
  // au toit » a été créée DEUX fois pour le même client, la même
  // journée, à la même adresse — six heures d'écart, aucun signal.
  // Résultat : deux cartes strictement identiques sur le téléphone de
  // deux techniciens le matin même. L'ADRESSE fait partie de la
  // comparaison : le même client peut très bien avoir deux vraies jobs
  // le même jour à deux adresses différentes (c'était le cas ici).
  const tachesExistantesDuJour = (dateIso) => {
    const vues = new Map();
    (tachesAttente || []).forEach((t) => vues.set(`att-${t.id}`, { ...t, dateVue: null }));
    Object.entries(planning || {}).forEach(([cle, cellule]) => {
      const [dateCle] = cle.split("|");
      if (dateIso && dateCle !== dateIso) return;
      listeCellule(cellule).forEach((t) => {
        if (!t || t.est_tache_systeme) return;
        vues.set(`${t.id}|${dateCle}`, { ...t, dateVue: dateCle });
      });
    });
    return [...vues.values()];
  };
  const normaliserTexte = (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ");

  const creerTache = (doublonAccepte = false) => {
    if (lectureSeule || !nouveauTitre.trim()) return;
    const client = clients.find((c) => c.id === nouveauClientId);
    if (!doublonAccepte) {
      const adresseVisee = normaliserTexte(
        (adresseTravauxDifferente && (nouvelleAdresseTravaux?.label || client?.adresses?.find((a) => a.id === adresseTravauxId)?.ligne1)) ||
          client?.adresses?.[0]?.ligne1 ||
          ""
      );
      const jumelle = tachesExistantesDuJour(nouvelleDate || null).find((t) => {
        if (normaliserTexte(t.titre) !== normaliserTexte(nouveauTitre)) return false;
        const memeClient = nouveauClientId ? t.clientId === nouveauClientId : normaliserTexte(t.clientNom) === normaliserTexte(client?.nom);
        if (!memeClient) return false;
        const adresseAutre = normaliserTexte(t.adresseTravaux || t.adresseIntervention || "");
        return adresseAutre === adresseVisee;
      });
      if (jumelle) {
        setDoublonTache({ titre: nouveauTitre.trim(), client: client?.nom || "", date: nouvelleDate || "", adresse: adresseVisee });
        return;
      }
    }
    const nouvelle = {
      id: `tache-manuelle-${Date.now()}`,
      clientId: nouveauClientId || null,
      clientNom: client?.nom || "",
      // SECTEUR CCQ — hérité du projet choisi (Commercial par défaut).
      // C'est lui qui décidera du taux coûtant FIGÉ de chaque heure.
      secteur: nouveauSecteur === "residentiel" ? "residentiel" : "commercial",
      // Courriels du client transmis AVEC la tâche : le technicien peut
      // ainsi choisir à quelles adresses envoyer le bon de travail signé
      // (choix multiple) sans avoir accès au dossier client complet.
      clientCourriels: (client?.courriels || []).map((c) => ({ id: c.id, email: c.email, label: c.label, defaut: !!c.defaut })),
      // Téléphone du client transmis aussi (retour de tests 2026-08-17) :
      // le technicien sur place doit pouvoir appeler sans passer par le
      // bureau — bouton d'appel direct dans sa fiche de tâche.
      clientTelephone: client?.telephone || null,
      titre: nouveauTitre.trim(),
      typeTache: nouveauType,
      statut: "a_planifier",
      heures: nouvelleDureeHeures,
      jours: nouvelleDureeJours,
      sauterWeekend: nouveauSauterWeekend,
      sauterFeries: configEnt?.calendrierCcq === true && nouveauSauterFeries,
      // 🕚 TECHNICIEN / DATE / HEURE PRÉVUS — mémorisés sur TOUTE tâche
      // (2026-09-02, bogue vécu par Louise : réservés au chemin « avec
      // dépôt », une tâche ordinaire laissée en attente perdait son
      // 11 h — la carte et le placement en un clic retombaient à 07:00).
      technicienPrevu: nouveauEmployeId || null,
      datePrevue: nouvelleDate || null,
      heurePrevue: nouvelleHeureDebut || null,
      description: nouvelleDescription.trim(),
      // 📎 Photos et plans joints par le bureau — le technicien les
      // ouvre sur son téléphone, sans rappeler pour « c'est où déjà ? ».
      piecesJointes: nouvellesPiecesJointes,
      // Projet lié — optionnel ("" = Aucun / Projet général, hors
      // rentabilité). Dès qu'un projet est choisi, cette tâche (et ses
      // heures une fois travaillée) sera prise en compte par
      // calculerRentabiliteProjet pour ce projet.
      projetId: nouveauProjetId || null,
      // Adresse des travaux — distincte de l'adresse de facturation du
      // client quand ce n'est pas la même. `null` = même adresse que la
      // facturation. Transmise à QuickBooks au moment de la facturation
      // (champ "Ship To" / adresse de livraison de la facture).
      // Une COURSE n'a pas de client : son adresse est tapée librement.
      adresseTravaux: nouveauType === "course" ? adresseCourseLibre.trim() || null : null,
      // ---- COMPTABILISATION DES HEURES ----
      // `nonFacturable` : rien ne partira en facturation à la fin.
      // `sansHeures`    : congé — aucun chronomètre, aucune heure.
      // `categorieHeures` décide où le temps atterrit dans le coût :
      //   "projet"      → coût direct du projet (comme un technicien)
      //   "administratif" → frais généraux de l'entreprise
      //   "divers"      → payé, mais ni projet ni administratif
      nonFacturable: estTypeNonFacturable(nouveauType),
      sansHeures: estTypeSansHeures(nouveauType),
      categorieHeures: estTypeSansHeures(nouveauType)
        ? "aucune"
        : nouveauType === "shop"
        ? (nouveauProjetId ? "projet" : "divers")
        : nouveauType === "divers" || nouveauType === "course"
        ? "divers"
        : estTypeAdministratif(nouveauType) && !tempsSurProjet
        ? "administratif"
        : "projet",
    };

    if (adresseTravauxDifferente) {
      if (nouvelleAdresseTravaux) {
        // Appartement/unité ajouté à l'adresse choisie (retour de tests).
        nouvelle.adresseTravaux = `${nouvelleAdresseTravaux.label}${nouvelleAdresseApp.trim() ? `, app. ${nouvelleAdresseApp.trim()}` : ""}`;
        // 🚪 L'unité voyage AUSSI à part : l'app technicien l'affiche en
        // évidence, et le lien Google Maps reste SANS elle (Maps se perd
        // avec « app. 4 » dans une recherche).
        if (nouvelleAdresseApp.trim()) nouvelle.adresseUnite = nouvelleAdresseApp.trim();
        // 📌 ADRESSE AU DOSSIER (retour de tests 2026-08-17) : avant,
        // l'adresse tapée partait avec la tâche seulement — jamais
        // offerte à la tâche suivante du même client. Anti-doublon :
        // une adresse déjà au dossier n'est pas dupliquée.
        if (enregistrerAdresseFiche && client) {
          const ligne1 = nouvelleAdresseTravaux.label;
          const dejaAuDossier = (client.adresses || []).some(
            (a) => (a.ligne1 || "").trim().toLowerCase() === ligne1.trim().toLowerCase()
          );
          if (!dejaAuDossier) {
            const entree = {
              id: `adr-${Date.now()}`,
              nom: "Chantier",
              ligne1,
              ...(nouvelleAdresseApp.trim() ? { appartement: nouvelleAdresseApp.trim() } : {}),
            };
            setClients((prev) => prev.map((x) => (x.id === client.id ? { ...x, adresses: [...(x.adresses || []), entree] } : x)));
            ajouterJournal(`📌 Adresse « ${ligne1} » enregistrée au dossier de ${client.nom}`);
          }
        }
      } else if (adresseTravauxId) {
        const a = client?.adresses?.find((x) => x.id === adresseTravauxId);
        if (a) {
          nouvelle.adresseTravaux = `${a.nom} — ${libelleAdresse(a)}`;
          if (a.appartement) nouvelle.adresseUnite = a.appartement;
        }
      }
    }

    // ADRESSE OÙ LE TECHNICIEN DOIT SE RENDRE — toujours remplie.
    // `adresseTravaux` reste à null quand c'est la même que la
    // facturation (c'est ce que QuickBooks attend), mais le technicien,
    // lui, a besoin d'une adresse dans TOUS les cas : son app n'a pas
    // accès au répertoire des clients pour aller la chercher.
    // Sans ce champ, il partait le matin sans savoir où aller.
    const adressePrincipale = client?.adresses?.[0];
    // Repli FINAL : l'adresse de FACTURATION (2026-09-01, vécu — les
    // clients descendus de QuickBooks ont leur adresse dans la fiche
    // mais AUCUNE adresse de chantier : la tâche partait sans adresse
    // à l'horaire et chez le technicien).
    nouvelle.adresseIntervention =
      nouvelle.adresseTravaux ||
      (adressePrincipale ? `${adressePrincipale.nom} — ${adressePrincipale.ligne1}` : null) ||
      (client?.adresseFacturation ? String(client.adresseFacturation).trim() : null);
    if (!nouvelle.adresseUnite && adressePrincipale?.appartement && !nouvelle.adresseTravaux) {
      nouvelle.adresseUnite = adressePrincipale.appartement;
    }

    // 📇 CONTACT SUR PLACE — attaché à la tâche. « Nouveau » est AUSSI
    // enregistré au carnet du client (réutilisable à la prochaine tâche).
    if (contactSurPlaceId === "nouveau" && contactNom.trim() && contactTel.trim()) {
      const fiche = { id: `ct-${Date.now()}`, nom: contactNom.trim(), role: contactRole.trim(), telephone: contactTel.trim() };
      nouvelle.contactSurPlace = { ...fiche };
      if (client) {
        setClients((prev) => prev.map((x) => (x.id === client.id ? { ...x, contacts: [...(x.contacts || []), fiche] } : x)));
        ajouterJournal(`📇 Contact « ${fiche.nom} » ajouté au carnet de ${client.nom}`);
      }
    } else if (contactSurPlaceId && contactSurPlaceId !== "nouveau" && client) {
      const c = (client.contacts || []).find((x) => x.id === contactSurPlaceId);
      if (c) nouvelle.contactSurPlace = { id: c.id, nom: c.nom, role: c.role || "", telephone: c.telephone || "" };
    }

    if (nouveauType === "devis" || nouveauType === "entretien_contrat") {
      // Ceinture-bretelles : un devis d'un AUTRE client ne s'attache
      // jamais (le sélecteur filtre déjà, ceci couvre tout état résiduel).
      const devis = devisListe.find(
        (d) => d.id === nouveauDevisId && (!nouveauClientId || !d.clientId || d.clientId === nouveauClientId)
      );
      // « Travaux avec devis » accepte AUSSI un numéro tapé à la main
      // (devis fait hors de l'app — retour de tests 2026-08-17). Depuis
      // le 2026-09-04 (demande du propriétaire), l'ENTRETIEN aussi : les
      // ANCIENS contrats (papier ou QuickBooks, d'avant Fluxya) n'ont
      // aucun devis dans l'app — leur numéro se tape à la main et la
      // FRÉQUENCE se choisit dans le formulaire (le sélecteur y est).
      if (!devis && numeroDevisExistant.trim()) {
        nouvelle.devisNumero = numeroDevisExistant.trim();
        if (nouveauType === "entretien_contrat") {
          nouvelle.frequenceFacturationAnnuelle = nouvelleFrequence;
        }
      } else if (!devis) {
        return; // un devis/contrat doit être sélectionné pour ces types
      }
      if (devis) {
        nouvelle.devisNumero = devis.numero;
        // Texte du devis transmis sur la tâche, SANS les prix — ajouté à la
        // suite de la description saisie manuellement (si elle existe).
        // UN ITEM PAR LIGNE pour rester facile à lire.
        // ⚠️ Depuis le 2026-08-29, les items se posent DÉJÀ dans le champ à
        // la sélection du devis. Deux cas ici : (a) l'injection a eu lieu
        // (dernierTexteDevisRef) → le champ fait foi TEL QUEL — même si
        // l'admin a effacé des lignes exprès, rien ne revient en douce ;
        // (b) le devis est arrivé par un autre chemin sans injection → on
        // ajoute les items comme avant (l'ancien comportement en filet).
        const texteDevis = texteDevisPourDescription(devis);
        const descSaisie = nouvelleDescription.trim();
        const dejaInjecte = dernierTexteDevisRef.current === texteDevis || descSaisie.includes(texteDevis);
        nouvelle.description = dejaInjecte
          ? descSaisie
          : descSaisie
            ? `${descSaisie}\n${texteDevis}`
            : texteDevis;
        // Lignes du devis SANS AUCUN PRIX ni total — pour la fenêtre
        // « Voir le devis » de l'app technicien. Les montants ne quittent
        // jamais l'admin : seuls nom, quantité et unité sont transmis.
        nouvelle.devisLignes = devis.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, unite: l.unite || "" }));
        if (nouveauType === "entretien_contrat") {
          nouvelle.frequenceFacturationAnnuelle = nouvelleFrequence;
        }
      }
    }

    // TRANSITION QUICKBOOKS : un numéro de devis EXISTANT (hors app)
    // s'attache à n'importe quel type de tâche — il suivra jusqu'au bon
    // de travail et à la facturation. Le devis choisi dans l'app garde
    // priorité s'il y en a un.
    if (!nouvelle.devisNumero && numeroDevisExistant.trim()) {
      nouvelle.devisNumero = numeroDevisExistant.trim();
    }

    const projetLie = projetsDisponibles.find((p) => p.id === nouveauProjetId);
    const suffixeProjet = projetLie ? ` — lié au projet "${projetLie.nom}"` : "";
    const libelleType =
      nouveauType === "devis"
        ? `Travaux avec devis #${nouvelle.devisNumero}`
        : nouveauType === "entretien_contrat"
        ? `Entretien selon contrat #${nouvelle.devisNumero}, ${nouvelleFrequence} factures/an`
        : TYPES_TACHE.find((t) => t.id === nouveauType).label;

    // 👥 Techniciens EN PLUS cochés SANS date (2026-08-17) : mémorisés
    // sur la tâche avec leurs choix 💰/🤝 — ils s'assigneront d'un coup
    // dès qu'elle entrera à l'horaire (dépôt payé, glisser-déposer ou
    // édition). Avec date + technicien, le chemin direct plus bas les
    // assigne immédiatement, comme avant.
    const enPlusPrevus = nouveauxEmployesEnPlus.filter((id) => id && id !== nouveauEmployeId);
    if (!(nouvelleDate && nouveauEmployeId) && enPlusPrevus.length > 0) {
      nouvelle.equipePrevue = enPlusPrevus.map((id) => ({ employeId: id, facturable: facturablesEnPlus[id] }));
    }

    // 🗺️ ZONE DE L'APPEL — enregistrée AVEC OU SANS dépôt (2026-08-25) :
    // elle détermine le prix de base et la règle du temps inclus (zones
    // = temps chez le client seulement ; hors zone = transport compris).
    // Avant, elle ne s'écrivait que dans la branche dépôt : un appel
    // sans dépôt partait sans zone et la facturation devinait.
    if (nouveauType === "appel_service") {
      nouvelle.zoneAppel = zoneAppelChoix === "hors_zone" ? "hors_zone" : zoneAppelChoix || null;
    }

    // 🔧 Unités cochées : elles voyagent avec la tâche (donnees) — la
    // fiche du technicien les affiche et « Unité vérifiée » se
    // pré-remplit avec le VRAI numéro de série au lieu d'une saisie.
    if (unitesChoisies.length > 0) {
      const connues = unitesConnuesDuClient(nouveauClientId);
      nouvelle.unites = connues
        .filter((u) => unitesChoisies.includes(u.cle))
        .map((u) => ({ modele: u.modele, serie: u.serie, ...(u.emplacement ? { emplacement: u.emplacement } : {}) }));
    }

    // Dépôt préalable : la tâche porte l'info et le dépôt est créé
    // (24 h pour payer). Une tâche avec dépôt en attente NE PEUT PAS
    // être placée dans l'horaire — même si date/technicien sont saisis.
    const montantDepot = parseFloat(depotMontant) || 0;
    if (depotRequis && montantDepot > 0) {
      nouvelle.depotRequis = true;
      nouvelle.depotMontant = montantDepot;
      // Technicien / date souhaités par le client, MÉMORISÉS sur la tâche
      // sans la placer : dès que le dépôt est payé, un clic suffit pour
      // l'envoyer à l'horaire avec le bon technicien.
      nouvelle.technicienPrevu = nouveauEmployeId || null;
      nouvelle.datePrevue = nouvelleDate || null;
      nouvelle.heurePrevue = nouvelleHeureDebut || null;
      // Plus de « prospect » séparé : un client pas encore enregistré se
      // crée via « ➕ Nouveau client… » en haut de la liste Client — sa
      // fiche complète et validée sert au dépôt (et à QuickBooks).
      if (depotDejaPaye) {
        // ✅ Transfert : le dépôt est DÉJÀ payé — on enregistre le fait
        // (mode + Nº de facture QuickBooks), aucune facture créée,
        // aucun courriel. La tâche arrive directement dans « Prêtes ».
        onCreerDepotDejaPaye?.(nouvelle.id, {
          montantHT: montantDepot,
          modePaiement: depotDejaPayeMode,
          refFacture: depotDejaPayeRef.trim(),
        });
      } else {
      onCreerDepot?.(nouvelle.id, {
        montantHT: montantDepot,
        isProspect: false,
        prospect: null,
        // Facture de dépôt QuickBooks + courriel au client (point 9
        // des retours de tests) — traités par creerDepotPourTache.
        clientId: nouvelle.clientId || null,
        clientNom: client?.nom || nouvelle.clientNom || "",
        zone: nouvelle.zoneAppel === "hors_zone" ? "hors zone" : nouvelle.zoneAppel,
        joursLimite: 1,
        courriels: [...new Set([...depotEmails, ...(depotExtra.trim() ? [depotExtra.trim()] : [])])],
        // 📝 L'OBJET DE LA VISITE SUIT (2026-08-25, retour du
        // propriétaire) : la facture disait « Dépôt — appel de service »
        // sans jamais dire POURQUOI on vient. Titre + description de la
        // tâche voyagent jusqu'à la ligne de facture et au courriel.
        titre: nouvelle.titre || "",
        descriptionTravaux: nouvelle.description || "",
        // 💳 Le choix affiché dans la fenêtre part AVEC la demande —
        // même règle automatique qu'avant si l'admin n'a rien touché.
        paiementCarte:
          depotCarteChoix ??
          (configEnt?.paiementCarteAppels === true && montantDepot <= (Number(configEnt?.seuilCarteAppels) || 2000)),
        paiementVirement: depotVirementChoix ?? (configEnt?.paiementVirementAppels === true),
      });
      }
      // 📌 COURRIEL AU DOSSIER (2026-08-24) : l'« autre adresse » tapée
      // pour la demande de dépôt s'ajoute à la fiche du client — sinon
      // il fallait la retaper à chaque tâche. Anti-doublon, et jamais
      // « par défaut » : les adresses déjà cochées gardent leur rang.
      const extraCourriel = depotExtra.trim().toLowerCase();
      if (depotExtraAuDossier && client && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraCourriel)) {
        const dejaAuDossier = (client.courriels || []).some(
          (c) => String(typeof c === "string" ? c : c?.email || "").trim().toLowerCase() === extraCourriel
        );
        if (!dejaAuDossier) {
          const entree = { id: `cc-${Date.now()}`, label: "", email: extraCourriel, defaut: false };
          setClients((prev) =>
            prev.map((x) => (x.id === client.id ? { ...x, courriels: [...(x.courriels || []), entree] } : x))
          );
          ajouterJournal(`📌 Courriel « ${extraCourriel} » ajouté au dossier de ${client.nom}`);
        }
      }
      setTachesAttente((prev) => [nouvelle, ...prev]);
      const nomPrevu = nouveauEmployeId ? employes.find((e) => e.id === nouveauEmployeId)?.nom : "";
      ajouterJournal(
        depotDejaPaye
          ? `📋 Tâche créée — ${libelleType} — dépôt DÉJÀ PAYÉ (transfert), prête à planifier${nomPrevu ? ` (technicien prévu : ${nomPrevu})` : ""}`
          : `📋 Tâche créée — ${libelleType} — EN ATTENTE DE DÉPÔT avant planification${nomPrevu ? ` (technicien prévu : ${nomPrevu})` : ""}`
      );
    } else if (nouvelleDate && nouveauEmployeId) {
      // Positionnement direct dans la grille si DATE + TECHNICIEN sont
      // tous les deux renseignés dès la création — sinon, comme avant,
      // la tâche atterrit dans "Tâches en attente".
      assigner(nouvelle, nouveauEmployeId, new Date(`${nouvelleDate}T00:00:00`), nouvelleHeureDebut);
      // MULTI-TECHNICIENS : chaque coché EN PLUS reçoit la MÊME tâche
      // partagée (id identique = heures additionnées, une facturation).
      const enPlus = nouveauxEmployesEnPlus.filter((id) => id && id !== nouveauEmployeId);
      // Chaque technicien EN PLUS part avec SON choix 💰/🤝 fait dans le
      // formulaire (obligatoire — le bouton Créer le garantit).
      enPlus.forEach((id) => assigner(nouvelle, id, new Date(`${nouvelleDate}T00:00:00`), nouvelleHeureDebut, facturablesEnPlus[id]));
      const nomsEquipe = [nouveauEmployeId, ...enPlus]
        .map((id) => employes.find((e) => e.id === id)?.nom)
        .filter(Boolean)
        .join(", ");
      ajouterJournal(
        `📋 Tâche créée et placée directement dans l'horaire — ${libelleType} (${client?.nom})${suffixeProjet}${enPlus.length > 0 ? ` — équipe : ${nomsEquipe}` : ""}`
      );
    } else {
      setTachesAttente((prev) => [nouvelle, ...prev]);
      ajouterJournal(`📋 Tâche créée — ${libelleType} (${client?.nom})${suffixeProjet}`);
    }

    setDepotMontant("");
    setZoneAppelChoix("");
    setDepotEmails([]);
    setDepotCarteChoix(null);
    setDepotVirementChoix(null);
    setDepotDejaPaye(false);
    setDepotDejaPayeMode("Carte de crédit");
    setDepotDejaPayeRef("");
    setDepotExtra("");
    setNouveauTitre("");
    setNouvellesPiecesJointes([]);
    setNouvelleDescription("");
    setNouveauDevisId("");
    dernierTexteDevisRef.current = "";
    setNouvelleFrequence(4);
    setNouveauProjetId("");
    setMiniProjetOuvert(false);
    setMiniProjetNom("");
    setMiniProjetFacture("");
    setMiniProjetCoutant("");
    setAdresseTravauxDifferente(false);
    setAdresseTravauxId("");
    setNouvelleAdresseTravaux(null);
    setNouvelleDate("");
    setNouvelleHeureDebut(HEURE_PAR_DEFAUT);
    // Le CLIENT repart vide lui aussi (bogue vécu : le dernier client
    // restait « collé » d'une création à l'autre — exactement l'erreur
    // que la règle « aucun client présélectionné » devait empêcher).
    setNouveauClientId("");
    setNouveauEmployeId("");
    setNouveauxEmployesEnPlus([]);
    setFacturablesEnPlus({});
    setNouveauSecteur("");
    setEnregistrerAdresseFiche(true);
    setContactSurPlaceId("");
    setContactNom("");
    setContactRole("");
    setContactTel("");
    setNumeroDevisExistant("");
    setVerifDevisQbo(null);
    setUnitesChoisies([]);
    setFiltreClientTache("");
    setFiltreAdresseTache("");
    setNouvelleAdresseApp("");
    setNouvelleDureeHeures(1);
    setNouvelleDureeJours(0);
    setNouveauSauterWeekend(false);
    setFormulaireOuvert(false);
  };

  // Fonction unique d'assignation — utilisée par la vue Jour (glisser-
  // déposer sur une heure précise) ET les vues Semaine/Mois (glisser-
  // déposer sur un jour). Respecte toujours tache.jours ET tache.heures,
  // peu importe la vue utilisée pour l'assignation — avant ce correctif,
  // seule assignerJours (Semaine/Mois) en tenait compte, donc assigner
  // une tâche multi-jours depuis la vue Jour (la vue par défaut) la
  // limitait silencieusement à une seule journée.
  // `facturablePredetermine` (facultatif) : true/false quand le choix
  // 💰/🤝 a DÉJÀ été fait (cases de la création de tâche) — la fenêtre
  // après coup ne s'ouvre alors pas. Absent : comportement habituel
  // (question posée dès qu'un 2e technicien rejoint la tâche).
  const assigner = (tacheParam, employeId, dateDepart, heureDepart, facturablePredetermine) => {
    if (lectureSeule) return;
    // 👥 ÉQUIPE PRÉVUE (cochée à la création SANS date, 2026-08-17) :
    // détachée de l'objet dès l'entrée — elle ne doit ni vivre dans les
    // cases de la grille ni voyager dans `donnees` (sinon chaque
    // déplacement futur ré-assignerait les coéquipiers). Elle sert UNE
    // fois, à la fin de cette assignation, pour placer le reste de
    // l'équipe d'un coup avec leurs choix 💰/🤝.
    const { equipePrevue, ...tache } = tacheParam || {};
    // Blocage strict : impossible d'assigner tant que le dépôt requis
    // n'est pas payé (ou si le délai de 24 h l'a annulé).
    if (depotBloque(tache.id)) {
      const d = depotDe(tache.id);
      ajouterJournal(
        `⛔ "${tache.titre || tache.clientNom}" non planifiable — dépôt ${d?.statut === "annule_delai" ? "annulé (délai de 24 h dépassé)" : "en attente de paiement"}`
      );
      return;
    }
    // L'employé doit exister dans la grille : sinon les cases seraient
    // écrites sur une ligne invisible (identifiant périmé) et la tâche
    // « disparaîtrait » sans explication ni envoi au technicien.
    const employe = employes.find((e) => e.id === employeId);
    if (!employe) {
      ajouterJournal(
        `⚠️ "${tache.titre || tache.clientNom}" non planifiée — technicien introuvable dans l'agenda. Réassigne-la par glisser-déposer sur la bonne ligne.`
      );
      return;
    }
    // Nombre de jours choisi sur la tâche (0 = pas de jour "réservé" à
    // l'avance ; 1 ou plus = un nombre de jours précis est sélectionné).
    const nbJoursSpecifie = tache.jours ?? 1;
    // Dès qu'un nombre de jours est sélectionné (>= 1), la tâche bloque
    // TOUTES les cases horaires de la journée pour l'employé assigné —
    // le champ "Heures / jour" ne sert alors qu'à titre indicatif. Le
    // blocage partiel (seulement N heures) ne s'applique que si jours
    // est explicitement mis à 0.
    const blocageJourComplet = nbJoursSpecifie >= 1;
    const joursCibles = calculerJoursCibles(dateDepart, nbJoursSpecifie, tache.sauterWeekend, tache.sauterFeries);
    const indexDepart = heureDepart ? Math.max(0, indexCaseHeure(heureDepart)) : 0;
    // ⏰ BOGUE DE MINUIT (corrigé 2026-08-17, vécu) : « journée complète »
    // partait de la case 00:00 — la barre commençait à minuit hors de
    // l'écran (la tâche semblait disparue) et le technicien recevait
    // « 00:00 » comme heure de début. Le blocage part maintenant de
    // l'heure CHOISIE jusqu'à la fin de la journée.
    // tache.heures peut valoir 0 (saisi explicitement) — on ne le
    // remplace plus par 1 via `|| 1`. Math.max(0, ...) plutôt que
    // Math.max(1, ...) : 0 case horaire bloquée est un résultat valide
    // si l'utilisateur a choisi 0 heure et 0 jour.
    const nbHeuresSpecifie = tache.heures ?? 1;
    const nbHeures = Math.max(0, Math.min(nbHeuresSpecifie, HEURES.length - indexDepart));
    const heuresCibles = blocageJourComplet ? HEURES.slice(indexDepart) : HEURES.slice(indexDepart, indexDepart + nbHeures);

    setPlanning((prev) => {
      const copie = { ...prev };
      joursCibles.forEach((d) => {
        heuresCibles.forEach((h) => {
          // Statut explicite "planifiee" dès qu'une tâche atterrit dans
          // l'horaire — que ce soit par glisser-déposer ou via la
          // modale d'édition rapide, elle n'est plus "à planifier".
          // AJOUT à la case (jamais d'écrasement) : une tâche déposée sur
          // une plage occupée s'empile au lieu de faire disparaître
          // l'autre.
          const cle = `${dateISO(d)}|${employeId}|${h}`;
          copie[cle] = [
            ...listeCellule(copie[cle]).filter((x) => x.id !== tache.id),
            { ...tache, employeId, statut: "planifiee" },
          ];
        });
      });
      return recalculerTransports(copie, sansTransportAgendaRef.current);
    });
    setTachesAttente((prev) => prev.filter((t) => t.id !== tache.id));
    const derniereDate = joursCibles[joursCibles.length - 1];
    const detailJours = joursCibles.length > 1 ? `du ${dateISO(dateDepart)} au ${dateISO(derniereDate)}${tache.sauterWeekend ? " (fins de semaine sautées)" : ""}${tache.sauterFeries ? " (fériés CCQ sautés)" : ""}` : `le ${dateISO(dateDepart)}`;
    // 📅 Avertissement doux (jamais bloquant) : la 1re journée tombe sur
    // un jour marqué du calendrier CCQ — on le DIT, l'humain décide.
    const marqueDepart = configEnt?.calendrierCcq ? marqueurCcq(dateISO(dateDepart)) : null;
    if (marqueDepart) {
      ajouterJournal(`📅 Attention : « ${tache.titre || tache.type} » démarre le ${dateISO(dateDepart)} — ${marqueDepart.nom}.`);
    }
    const detailHeures = blocageJourComplet
      ? `journée bloquée à partir de ${heureDepart || heuresCibles[0] || "07:00"}`
      : nbHeures > 0
      ? `à partir de ${heuresCibles[0]} (${nbHeures} h/jour)`
      : "aucune case horaire bloquée (0 h)";
    ajouterJournal(
      `✅ "${tache.titre || tache.clientNom}" assignée à ${employe?.nom || employeId} ${detailJours} — ${detailHeures} — mise à jour envoyée à son app mobile`
    );
    // Écriture réelle dans Supabase (taches_assignees) : l'app technicien
    // du courriel correspondant la voit en direct. Jamais pour les
    // transports système (chaque app les génère localement).
    if (!tache.est_tache_systeme) {
      if (!employe?.courriel) {
        // Sans courriel dans le Répertoire, impossible de savoir quelle
        // app technicien doit recevoir la tâche — on le dit clairement.
        ajouterJournal(
          `⚠️ "${tache.titre || tache.clientNom}" reste dans l'agenda mais N'A PAS été envoyée à l'app technicien — ${employe?.nom || employeId} n'a pas de courriel dans le Répertoire`
        );
      } else {
        // 2e technicien et plus : le choix 💰/🤝 est OBLIGATOIRE. S'il a
        // déjà été fait à la création (cases à cocher), on l'applique
        // directement — sinon la question s'ouvre juste après
        // (l'assignation part facturable en attendant la réponse).
        const choixDejaFait = facturablePredetermine === true || facturablePredetermine === false;
        // « conserver » (audit 2026-08-17) : modification ou déplacement
        // d'une assignation EXISTANTE — on ne repose pas la question et
        // on n'écrit pas facturable (le choix déjà en base reste).
        const conserverChoix = facturablePredetermine === "conserver";
        if (autreTechnicienALaTache(tache.id, employeId) && !conserverChoix && !employe.estSousTraitant) {
          if (choixDejaFait) {
            onMajFacturable?.(tache.id, employe.courriel, facturablePredetermine);
            ajouterJournal(
              facturablePredetermine
                ? `💰 ${employe.nom} ajouté sur « ${tache.titre || tache.clientNom || "cette tâche"} » — FACTURABLE au client.`
                : `🤝 ${employe.nom} ajouté sur « ${tache.titre || tache.clientNom || "cette tâche"} » — NON facturable (aide interne) : ses heures ne seront pas comptées dans la facturation.`
            );
          } else {
            setChoixFacturable({ tacheId: tache.id, titre: tache.titre || tache.clientNom || "cette tâche", employe });
          }
        }
        assignerTacheSupabase(tache, employe, {
          // L'heure CHOISIE d'abord (quarts d'heure conservés) — jamais
          // la première case de la grille (c'était le bogue de minuit).
          heureDebut: heureDepart || heuresCibles[0] || null,
          date: dateISO(dateDepart),
          // Le choix fait à la création part avec l'assignation même ;
          // sans choix explicite, la clé est OMISE — la valeur en base
          // reste (nouvelle ligne : défaut true de la base).
          ...(choixDejaFait ? { facturable: facturablePredetermine } : {}),
        }).then(() => {
          // 🔔 Notification push au technicien — un bonus, jamais un
          // bloqueur : l'échec est silencieux (la tâche est déjà chez lui
          // par la synchronisation temps réel de toute façon). Jamais
          // pour un sous-traitant (pas d'application, pas d'abonnement).
          if (estCourrielST(employe.courriel)) return;
          envoyerPushA(
            employe.courriel,
            "📋 Nouvelle tâche",
            `${tache.titre || tache.clientNom || "Tâche"} — ${dateISO(dateDepart)}${heureDepart ? ` à ${heureDepart}` : ""}`
          );
        }).catch((e) => {
          // Échec d'écriture Supabase (hors-ligne, table/colonne absente,
          // droits) — visible dans le Journal au lieu d'un silence total.
          ajouterJournal(
            `⚠️ "${tache.titre || tache.clientNom}" reste dans l'agenda mais N'A PAS été envoyée à l'app technicien — erreur de synchronisation : ${e?.message || "connexion impossible"}`
          );
        });
      }
    }
    // 👥 Le reste de l'équipe prévue s'assigne maintenant, d'un coup —
    // chacun avec le choix 💰/🤝 fait à la création. L'objet transmis
    // est déjà nettoyé (pas d'equipePrevue) : aucune récursion infinie.
    if (Array.isArray(equipePrevue) && equipePrevue.length > 0) {
      equipePrevue
        .filter((m) => m.employeId && m.employeId !== employeId)
        .forEach((m) => assigner(tache, m.employeId, dateDepart, heureDepart, m.facturable));
    }
  };

  // Redimensionne une tâche déjà placée dans la grille (vue Jour) en
  // faisant glisser la poignée à droite de son bloc — change le
  // nombre d'heures qu'elle occupe pour CE technicien, ce jour-là,
  // sans toucher aux autres jours si la tâche est aussi assignée
  // ailleurs (contrats/multi-jours).
  const redimensionnerTache = (tache, employeId, jourCible, heureDebut, nouvellesHeures) => {
    if (lectureSeule) return;
    const indexDepart = Math.max(0, indexCaseHeure(heureDebut));
    const nbHeures = Math.max(1, Math.min(nouvellesHeures, HEURES.length - indexDepart));
    const heuresCibles = HEURES.slice(indexDepart, indexDepart + nbHeures);
    setPlanning((prev) => {
      const copie = { ...prev };
      // Retire d'abord TOUTES les anciennes cases horaires de cette
      // tâche pour ce technicien ce jour-là (elle pouvait occuper plus
      // ou moins d'heures qu'après le redimensionnement) — sans toucher
      // aux AUTRES tâches empilées sur les mêmes cases.
      HEURES.forEach((h) => {
        const cle = `${jourCible}|${employeId}|${h}`;
        const restants = listeCellule(copie[cle]).filter((x) => x.id !== tache.id);
        if (restants.length) copie[cle] = restants;
        else delete copie[cle];
      });
      heuresCibles.forEach((h) => {
        const cle = `${jourCible}|${employeId}|${h}`;
        copie[cle] = [
          ...listeCellule(copie[cle]),
          { ...tache, employeId, heures: nbHeures, jours: 0, statut: "planifiee" },
        ];
      });
      return recalculerTransports(copie, sansTransportAgendaRef.current);
    });
    const employe = employes.find((e) => e.id === employeId);
    // 💾 ENREGISTRÉ POUR VRAI (2026-08-22) : le redimensionnement ne
    // touchait QUE la grille de l'écran. Le Journal annonçait « mise à
    // jour envoyée à son app mobile » — c'était faux : le technicien
    // gardait l'ancienne durée, et la nouvelle disparaissait au premier
    // rechargement. Le choix « conserver » laisse intact le 💰/🤝 déjà
    // décidé pour cette assignation.
    if (employe?.courriel) {
      assignerTacheSupabase(
        { ...tache, heures: nbHeures, jours: 0 },
        employe,
        { date: jourCible, heureDebut }
      )
        .then(() => {
          ajouterJournal(
            `↔️ "${tache.titre || tache.clientNom}" redimensionnée à ${nbHeures} h (${employe.nom}, ${jourCible}) — mise à jour envoyée à son app mobile`
          );
        })
        .catch((e) => {
          ajouterJournal(
            `⚠️ "${tache.titre || tache.clientNom}" redimensionnée à l'écran mais N'A PAS été enregistrée — ${employe.nom} garde l'ancienne durée : ${e?.message || "connexion impossible"}`
          );
        });
    } else {
      ajouterJournal(
        `⚠️ "${tache.titre || tache.clientNom}" redimensionnée à ${nbHeures} h (${employe?.nom || employeId}, ${jourCible}) — PAS envoyée à l'app mobile : aucun courriel au Répertoire`
      );
    }
  };

  // ------------------------------------------------------------
  // ANNULATION DÉFINITIVE D'UNE TÂCHE (règles validées avec le
  // propriétaire, 2026-08-07) :
  //   • Admins : toujours, avec avertissements si dépôt/pièce en jeu.
  //   • Répartiteur : SEULEMENT si aucun dépôt ni pièce en commande
  //     n'est lié — sinon réservé aux administrateurs.
  //   • Chargé de projet / lecture seule : aucun bouton.
  //   • App technicien : la fonction n'y existe pas, point.
  //   • Travail déjà exécuté (bon envoyé) : annulation refusée — ça se
  //     facture ou se crédite, ça ne disparaît pas.
  // Double vérification à l'écran (raison obligatoire + confirmation
  // rouge) — voir ModalEditionTache. Trace complète au journal.
  // ------------------------------------------------------------
  const estAdminAgenda = role === "Admin principal" || role === "Admin régulier";
  const estRepartiteurAgenda = role === "Répartiteur";
  // Pièce encore en jeu pour cette tâche (retour bloqué ou pose à
  // venir) — une pièce annulée ne compte plus.
  const pieceLieeATache = (tacheId) =>
    (pieces || []).find((p) => (p.tacheRetourId === tacheId || p.tacheOrigineId === tacheId) && p.statut !== "annulee");
  const contexteAnnulation = (tache) => {
    if (!tache) return { permise: false, bloqueeRaison: null, avertissements: [] };
    const depot = depotDe(tache.id);
    const piece = pieceLieeATache(tache.id);
    const avertissements = [];
    if (depot) {
      const paye = depot.statut === "paye" || depot.statut === "paye_manuel";
      avertissements.push(
        `💰 Un dépôt ${paye ? "PAYÉ" : "non payé"} est rattaché à cette tâche — décide de son sort (remboursement ou conservé, selon ta politique) en annulant.`
      );
    }
    if (piece) {
      avertissements.push(`🔧 La pièce « ${piece.pieceRequise} » est liée à cette tâche — pense à l'annuler ou la réaffecter dans l'onglet Pièces.`);
    }
    const sensible = !!depot || !!piece;
    const permise = estAdminAgenda || (estRepartiteurAgenda && !sensible);
    const bloqueeRaison =
      !permise && estRepartiteurAgenda
        ? "🔒 Un dépôt ou une pièce en commande est lié à cette tâche — son annulation est réservée aux administrateurs."
        : null;
    return { permise, bloqueeRaison, avertissements };
  };
  const peutOuvrirAnnulation = !lectureSeule && (estAdminAgenda || estRepartiteurAgenda);
  const annulerTacheDefinitivement = (tache, raison) => {
    if (!peutOuvrirAnnulation || !contexteAnnulation(tache).permise) {
      ajouterJournal("⛔ Tentative d'annulation de tâche refusée — rôle non autorisé");
      return;
    }
    // 1. Prévenir l'app mobile de chaque technicien concerné.
    techniciensPourTache(planning, tache.id, employes).forEach((t) => {
      const emp = employes.find((e) => e.id === t.employeId);
      retirerTacheSupabase(tache.id, emp?.courriel).catch(() => {});
    });
    // 2. Retirer TOUTES ses cases de l'horaire (tous techniciens, tous
    //    jours) et recalculer les transports.
    setPlanning((prev) => {
      const copie = { ...prev };
      Object.keys(copie).forEach((cle) => {
        const restants = listeCellule(copie[cle]).filter((x) => x.id !== tache.id);
        if (restants.length) copie[cle] = restants;
        else delete copie[cle];
      });
      return recalculerTransports(copie, sansTransportAgendaRef.current);
    });
    // 3. Retirer de la file d'attente — la persistance Supabase supprime
    //    la ligne automatiquement (voir l'effet de synchronisation).
    setTachesAttente((prev) => prev.filter((t) => t.id !== tache.id));
    // 4. La FACTURE DE DÉPÔT suit l'annulation (2026-08-29, demande du
    //    propriétaire : « est-ce que ça annule aussi la facture dans
    //    QuickBooks ? » — avant, elle restait VIVANTE, le journal disait
    //    seulement « à traiter »). Dépôt NON payé → VOID automatique
    //    (jamais Delete, règle gelée). Dépôt DÉJÀ PAYÉ → on ne touche à
    //    rien : de l'argent reçu se rembourse, ça ne s'efface pas.
    const depot = depotDe(tache.id);
    if (depot?.qboInvoiceId && depot.statut !== "paye" && depot.statut !== "paye_manuellement") {
      annulerFactureDepot(depot.qboInvoiceId)
        .then((rv) =>
          ajouterJournal(
            rv?.annulee
              ? `🧾 Facture de dépôt${depot.qboDocNumber ? ` Nº ${depot.qboDocNumber}` : ""} annulée par VOID dans QuickBooks (tâche annulée).`
              : `⚠️ VOID de la facture de dépôt REFUSÉ (${rv?.erreur || rv?.nonConnecte ? "QuickBooks non connecté" : "?"}) — annule-la à la main dans QuickBooks.`
          )
        )
        .catch(() => ajouterJournal("⚠️ VOID de la facture de dépôt injoignable — annule-la à la main dans QuickBooks."));
    }
    // 5. La trace : qui (rôle), quoi, pourquoi — et les suites à donner.
    const piece = pieceLieeATache(tache.id);
    ajouterJournal(
      `🗑️ Tâche "${tache.titre || tache.clientNom}" ANNULÉE définitivement (${role}) — raison : ${raison}` +
        (depot && (depot.statut === "paye" || depot.statut === "paye_manuellement")
          ? " · ⚠️ un dépôt DÉJÀ PAYÉ y était rattaché — remboursement à gérer"
          : "") +
        (piece ? ` · ⚠️ pièce liée « ${piece.pieceRequise} » : voir l'onglet Pièces` : "")
    );
  };

  // Modifie une tâche DÉJÀ planifiée, cliquée directement dans le
  // calendrier — retire d'abord toutes ses anciennes cases horaires
  // (chez l'ancien technicien, sur tous les jours qu'elle occupait si
  // elle était multi-jours), puis la replace via assigner() avec les
  // nouvelles valeurs. Fonctionne aussi pour un simple changement de
  // détail/description sans déplacer la date ou l'heure.
  // 🏗️/📄 LE PASSÉ SUIT LE NOUVEAU RATTACHEMENT (2026-08-22).
  // Les heures déjà pointées et le bon de travail déjà créé gardent une
  // COPIE du projet/devis prise à leur enregistrement. Sans cette
  // reprise, rattacher une tâche déjà travaillée laisserait la
  // rentabilité du projet fausse — en silence. Appelé UNE fois par
  // modification (le rattachement appartient à la tâche, pas à la
  // personne), et jamais bloquant : un échec réseau est dit au journal.
  const appliquerRattachements = async (tache, champs) => {
    const nomProjet = champs.projetId
      ? (projets || []).find((p) => p.id === champs.projetId)?.nom || "projet"
      : null;
    try {
      if (champs.projetId !== undefined) {
        const apercu = await heuresRattachablesA(tache.id);
        const n = await rattacherProjetAuxHeures(tache.id, champs.projetId);
        if (n > 0) {
          ajouterJournal(
            champs.projetId
              ? `🏗️ « ${tache.titre || tache.clientNom} » rattachée au projet « ${nomProjet} » — ${n} entrée${n > 1 ? "s" : ""} d'heures (${apercu.heures.toFixed(2)} h) ajoutée${n > 1 ? "s" : ""} à ses coûts réels.`
              : `🏗️ « ${tache.titre || tache.clientNom} » détachée de son projet — ${n} entrée${n > 1 ? "s" : ""} d'heures (${apercu.heures.toFixed(2)} h) retirée${n > 1 ? "s" : ""} des coûts du projet.`
          );
        } else {
          ajouterJournal(
            champs.projetId
              ? `🏗️ « ${tache.titre || tache.clientNom} » rattachée au projet « ${nomProjet} » (aucune heure pointée pour l'instant).`
              : `🏗️ « ${tache.titre || tache.clientNom} » détachée de son projet.`
          );
        }
      }
      if (champs.devisNumero !== undefined) {
        ajouterJournal(
          champs.devisNumero
            ? `📄 Devis #${champs.devisNumero} rattaché à « ${tache.titre || tache.clientNom} » — il suivra jusqu'à la facturation.`
            : `📄 Devis retiré de « ${tache.titre || tache.clientNom} ».`
        );
      }
      // Le bon de travail déjà créé (s'il existe) suit les deux.
      await rattacherAuBon(tache.id, {
        ...(champs.projetId !== undefined ? { projetId: champs.projetId } : {}),
        ...(champs.devisNumero !== undefined ? { devisNumero: champs.devisNumero } : {}),
      });
      // Pas de rechargement à la main : `travaux_effectues` et
      // `bons_travail` sont écoutés en Realtime — les coûts du projet et
      // la facturation se rafraîchissent d'eux-mêmes, ici comme sur les
      // autres postes ouverts.
    } catch (e) {
      ajouterJournal(
        `⚠️ Rattachement de « ${tache.titre || tache.clientNom} » NON enregistré (${e?.message || "connexion impossible"}) — réessaie : les heures déjà pointées n'ont pas suivi.`
      );
    }
  };

  // 🏗️ Rattache une tâche à un projet SANS toucher au reste (durée,
  // date, technicien) — utilisé par « Créer un projet à partir de cette
  // tâche ». Passer par modifierTachePlanifiee effacerait les champs
  // qu'on ne lui transmet pas ; ici on ne change QUE le projet.
  const rattacherTacheAuProjet = (tache, projetId) => {
    setPlanning((prev) => {
      const copie = { ...prev };
      Object.keys(copie).forEach((cle) => {
        const liste = listeCellule(copie[cle]);
        if (!liste.some((x) => x.id === tache.id)) return;
        copie[cle] = liste.map((x) => (x.id === tache.id ? { ...x, projetId } : x));
      });
      return copie;
    });
    // Chaque technicien de la tâche reçoit la fiche mise à jour.
    (techniciensPourTache(planning, tache.id, employes) || []).forEach((t) => {
      const emp = employes.find((e) => e.id === t.employeId);
      if (!emp?.courriel) return;
      majDonneesAssignation(tache.id, emp.courriel, { projetId }).catch(() => {});
    });
    appliquerRattachements(tache, { projetId });
  };

  // 📌 Une adresse tapée dans la FICHE de tâche rejoint le dossier du
  // client (2026-09-02) — même règle anti-doublon qu'à la création.
  const poserAdresseAuDossier = (tache, entree) => {
    if (!entree?.ligne1) return;
    const client = clients.find((c) => c.id === tache.clientId) || clients.find((c) => c.nom === tache.clientNom);
    if (!client) return;
    const deja = (client.adresses || []).some((a) => (a.ligne1 || "").trim().toLowerCase() === entree.ligne1.trim().toLowerCase());
    if (deja) return;
    const fiche = { id: `adr-${Date.now()}`, nom: "Chantier", ligne1: entree.ligne1, ...(entree.appartement ? { appartement: entree.appartement } : {}) };
    setClients((prev) => prev.map((x) => (x.id === client.id ? { ...x, adresses: [...(x.adresses || []), fiche] } : x)));
    ajouterJournal(`📌 Adresse « ${entree.ligne1} » enregistrée au dossier de ${client.nom}`);
  };

  const modifierTachePlanifiee = (tache, ancienEmployeId, champs) => {
    if (champs?.nouvelleAdressePourDossier) poserAdresseAuDossier(tache, champs.nouvelleAdressePourDossier);
    if (lectureSeule) return;
    // Synchro Supabase : si la tâche change de technicien (ou retourne en
    // attente), on retire l'ancienne assignation. Si c'est le même
    // technicien, l'upsert de assigner() écrasera simplement sa ligne.
    if (champs.employeId !== ancienEmployeId) {
      const ancienEmploye = employes.find((e) => e.id === ancienEmployeId);
      retirerTacheSupabase(tache.id, ancienEmploye?.courriel).catch(() => {});
    }
    setPlanning((prev) => {
      const copie = { ...prev };
      Object.keys(copie).forEach((cle) => {
        const [, empCle] = cle.split("|");
        if (empCle !== ancienEmployeId) return;
        const restants = listeCellule(copie[cle]).filter((x) => x.id !== tache.id);
        if (restants.length) copie[cle] = restants;
        else delete copie[cle];
      });
      return recalculerTransports(copie, sansTransportAgendaRef.current);
    });
    const tacheMiseAJour = {
      ...tache,
      heures: champs.heures,
      jours: champs.jours,
      sauterWeekend: champs.sauterWeekend,
      ...(champs.sauterFeries !== undefined ? { sauterFeries: champs.sauterFeries } : {}),
      // 🏠 Adresse des travaux modifiée dans la fiche (2026-09-02) —
      // clés absentes = adresse inchangée.
      ...(champs.adresseIntervention !== undefined
        ? { adresseTravaux: champs.adresseTravaux, adresseIntervention: champs.adresseIntervention, adresseUnite: champs.adresseUnite || null }
        : {}),
      description: champs.description,
      // Contact sur place : suit la modification (null = retiré) ; si la
      // modale ne l'a pas touché (undefined), l'existant est conservé.
      contactSurPlace: champs.contactSurPlace !== undefined ? champs.contactSurPlace : tache.contactSurPlace || null,
      // 🏗️/📄 Rattachements après coup (2026-08-22) — clés absentes =
      // rien à changer (voir la modale : elles ne partent que modifiées).
      ...(champs.projetId !== undefined ? { projetId: champs.projetId } : {}),
      ...(champs.devisNumero !== undefined ? { devisNumero: champs.devisNumero } : {}),
    };
    if (champs.employeId) {
      // « conserver » : une modification/un déplacement ne repose jamais
      // la question 💰/🤝 et n'écrase pas le choix déjà enregistré.
      assigner(tacheMiseAJour, champs.employeId, new Date(`${champs.date}T00:00:00`), champs.heureDebut, "conserver");
    } else {
      // Technicien retiré — la tâche retourne dans "Tâches en attente"
      // plutôt que de disparaître.
      setTachesAttente((prev) => [tacheMiseAJour, ...prev]);
      ajouterJournal(`↩️ "${tache.titre || tache.clientNom}" retirée de l'horaire — retour dans les tâches en attente`);
    }
  };

  // Enregistrement depuis la modale d'édition rapide (clic sur une
  // carte "en attente"). Met toujours à jour la durée ; assigne EN
  // PLUS dans l'horaire si un technicien a été choisi — même chemin
  // que le glisser-déposer (assigner), donc même comportement garanti
  // (statut "planifiee", retrait de la liste d'attente, journal).
  // En prod : `setTachesAttente`/`setPlanning` seraient remplacés par
  // les appels Supabase correspondants (voir lib/supabase/taches.js —
  // creerTache/assignerTache), avec une synchronisation Realtime pour
  // que l'app technicien voie la tâche apparaître instantanément.
  const enregistrerEditionRapide = (tacheId, { heures, jours, sauterWeekend, sauterFeries, employeId, employeIds, date, heureDebut, description, contactSurPlace, adresseTravaux, adresseIntervention, adresseUnite, nouvelleAdressePourDossier }) => {
    if (lectureSeule) return;
    const tache = tachesAttente.find((t) => t.id === tacheId);
    if (!tache) return;
    if (nouvelleAdressePourDossier) poserAdresseAuDossier(tache, nouvelleAdressePourDossier);
    const tacheMiseAJour = {
      ...tache,
      heures,
      jours,
      sauterWeekend,
      ...(sauterFeries !== undefined ? { sauterFeries } : {}),
      ...(adresseIntervention !== undefined ? { adresseTravaux, adresseIntervention, adresseUnite: adresseUnite || null } : {}),
      description: description ?? tache.description,
      contactSurPlace: contactSurPlace !== undefined ? contactSurPlace : tache.contactSurPlace || null,
    };
    // Assignation multiple : tous les techniciens cochés reçoivent la
    // tâche (même date/heure/durée) — chacun reste ensuite ajustable
    // individuellement en cliquant son bloc dans la grille.
    const cibles = employeIds && employeIds.length > 0 ? employeIds : employeId ? [employeId] : [];
    if (cibles.length > 0) {
      // assigner() retire déjà la tâche de tachesAttente et l'écrit
      // dans planning — on lui passe la version à jour (nouvelle
      // durée) pour que l'assignation reflète les derniers champs
      // édités, pas l'ancienne durée.
      cibles.forEach((id) => assigner(tacheMiseAJour, id, new Date(`${date}T00:00:00`), heureDebut));
    } else {
      // 🕚 La date/heure choisies SUIVENT la tâche en attente (2026-09-02,
      // bogue de Louise) : modifier « 11:00 » sans assigner de technicien
      // gardait l'ancien 07:00 sur la carte et au placement en un clic.
      const avecPrevisions = {
        ...tacheMiseAJour,
        ...(date ? { datePrevue: date } : {}),
        ...(heureDebut ? { heurePrevue: heureDebut } : {}),
      };
      setTachesAttente((prev) => prev.map((t) => (t.id === tacheId ? avecPrevisions : t)));
      ajouterJournal(`✏️ Durée mise à jour pour "${tache.titre || tache.clientNom}" (${heures} h/jour, ${jours} jour${jours > 1 ? "s" : ""})`);
    }
    setTacheEnEditionId(null);
  };

  // 🖱️ DÉPLACER UNE TÂCHE DÉJÀ PLACÉE (demande du propriétaire,
  // 2026-08-17) : attraper un bloc et le déposer sur une autre heure,
  // un autre technicien ou un autre jour — sans ouvrir la modale. En
  // dessous : EXACTEMENT le même chemin que « Enregistrer les
  // modifications » (modifierTachePlanifiee), donc mêmes garanties
  // (Supabase, temps réel, journal). Durée, jours, description et
  // contact voyagent intacts.
  const deplacerTache = (tacheId, ancienEmployeId, employeCibleId, dateCible, heureCible) => {
    if (lectureSeule) return;
    // Retrouver l'objet tâche dans la grille (sa version la plus à jour)
    // ET sa première case horaire actuelle : un dépôt sur un JOUR
    // (vue Semaine/Mois, heureCible null) conserve l'heure existante —
    // avant, elle retombait à 07:00 sans avertir (audit 2026-08-17).
    let tache = null;
    let heureActuelle = null;
    Object.keys(planning).forEach((cle) => {
      const [, empCle, hCle] = cle.split("|");
      if (empCle !== String(ancienEmployeId)) return;
      const t = listeCellule(planning[cle]).find((x) => x.id === tacheId);
      if (!t) return;
      if (!tache) tache = t;
      if (heureActuelle === null || hCle < heureActuelle) heureActuelle = hCle;
    });
    if (!tache || tache.est_tache_systeme) return;
    // ON NE DÉPLACE PAS LE PASSÉ : des heures déjà pointées sur cette
    // tâche par ce technicien = déplacement refusé, expliqué au journal.
    const ancienEmploye = employes.find((x) => x.id === ancienEmployeId);
    if (travailTermine(tache, ancienEmploye)) {
      ajouterJournal(
        `⛔ « ${tache.titre || tache.clientNom} » n'a pas été déplacée — ${ancienEmploye?.nom || "le technicien"} y a déjà des heures enregistrées. Passe par la fiche de la tâche au besoin.`
      );
      return;
    }
    const dateStr = typeof dateCible === "string" ? dateCible : dateISO(dateCible);
    modifierTachePlanifiee(tache, ancienEmployeId, {
      heures: tache.heures,
      jours: tache.jours,
      sauterWeekend: tache.sauterWeekend,
      sauterFeries: tache.sauterFeries,
      description: tache.description,
      employeId: employeCibleId,
      date: dateStr,
      // Dépôt sur une case horaire = nouvelle heure ; dépôt sur un jour
      // = l'heure ACTUELLE suit la tâche.
      heureDebut: heureCible || heureActuelle || HEURE_PAR_DEFAUT,
    });
  };

  // 🏢 FERMER LA TÂCHE POUR UN TECHNICIEN QUI A OUBLIÉ (2026-08-17).
  // L'admin déclare début/fin depuis la fiche de la tâche : la ligne
  // d'heures s'écrit au nom du TECHNICIEN (taux figé de son secteur),
  // sa carte se ferme sur son téléphone (marque fermetureBureau, même
  // canal temps réel que la fermeture d'équipe), et la facturation est
  // créée SEULEMENT si demandé (bon sans signature — alerte au bureau).
  // Jamais offert quand des heures existent déjà : on ne réécrit pas
  // ce que le technicien a pointé.
  const fermerTachePourTechnicien = async (tache, employe, jour, { debutHM, finHM, creerBon }) => {
    if (lectureSeule) return;
    const nbJours = Math.max(1, Number(tache.jours) || 1);
    // Chantier multi-jours : les heures se rangent sous la clé de LA
    // journée ouverte (id::AAAA-MM-JJ) — même règle que le téléphone.
    const cleHeures = nbJours > 1 ? `${tache.id}::${jour}` : tache.id;
    const debutTs = new Date(`${jour}T${debutHM}:00`).getTime();
    const finTs = new Date(`${jour}T${finHM}:00`).getTime();
    const heures = Math.max(0, (finTs - debutTs) / 3600000);
    try {
      await enregistrerTravailPourEmploye(
        {
          tacheId: cleHeures,
          secteur: tache.secteur || "commercial",
          titre: tache.titre || tache.clientNom || undefined,
          clientNom: tache.clientNom || null,
          date: jour,
          heures,
          estTransport: false,
          categorieHeures: tache.categorieHeures || "projet",
          kilometres: null,
          projetId: tache.projetId || null,
          noteTerrain: "",
          noteInterne: `🏢 FERMÉE PAR LE BUREAU — heures déclarées par l'administration (${debutHM} → ${finHM}) : le technicien avait oublié de fermer.`,
          debutReel: debutTs,
          finReelle: finTs,
          photosAvant: [],
          photosApres: [],
        },
        employe
      );
      // Avis au téléphone du technicien (sa carte se ferme) — meilleur
      // effort : un échec ici ne bloque pas la paie déjà écrite.
      majDonneesAssignation(tache.id, employe.courriel, {
        fermetureBureau: { par: "le bureau", a: new Date().toISOString(), debut: debutHM, fin: finHM, jour },
      }).catch(() => {});
      if (creerBon && !tache.nonFacturable) {
        await enregistrerBonTravailBureau(
          {
            tacheId: tache.id,
            titre: tache.titre || tache.clientNom || "Travail complété",
            clientNom: tache.clientNom || null,
            description: `${tache.description || ""}${tache.description ? "\n" : ""}(Fermée par le bureau — sans signature ni photos.)`,
            date: jour,
            heures,
            typeTache: tache.typeTache || null,
            secteur: tache.secteur || "commercial",
            devisNumero: tache.devisNumero || null,
            adresseTravaux: tache.adresseTravaux || tache.adresseIntervention || null,
            projetId: tache.projetId || null,
            photosAvant: [],
            photosApres: [],
            courrielsEnvoi: [],
            signeParNom: "",
            signeParCollegue: false,
            clientAbsent: false,
            unites: [],
            pieceACommander: false,
            pieceRequise: null,
          },
          employe
        );
      }
      ajouterJournal(
        `🏢 « ${tache.titre || tache.clientNom} » fermée par le bureau pour ${employe.nom || employe.courriel} — ${debutHM} → ${finHM} (${heures.toFixed(2)} h)${creerBon && !tache.nonFacturable ? " — demande de facturation créée (bon NON signé)" : " — paie seulement, rien en facturation"}.`
      );
    } catch (e) {
      ajouterJournal(
        `⚠️ Fermeture par le bureau ÉCHOUÉE pour « ${tache.titre || tache.clientNom} » (${employe.nom || employe.courriel}) — ${e?.message || "connexion impossible"}. Réessaie.`
      );
    }
  };

  const onDropHeure = (e, employeId, heure) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const objet = JSON.parse(data);
    // Bloc déjà placé qu'on déplace — sinon, tâche en attente qu'on assigne.
    if (objet?.deplacement) {
      deplacerTache(objet.tacheId, objet.employeId, employeId, dateISO(jourAffiche), heure);
      return;
    }
    assigner(objet, employeId, jourAffiche, heure);
  };

  const onDropJour = (e, employeId, date) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const objet = JSON.parse(data);
    if (objet?.deplacement) {
      // heure null = « garde l'heure actuelle de la tâche ».
      deplacerTache(objet.tacheId, objet.employeId, employeId, date, null);
      return;
    }
    // ⏰ L'HEURE CHOISIE À LA CRÉATION d'abord (2026-09-01, vécu :
    // « toutes à 7 h 00 même quand on demande une autre heure » — le
    // dépôt en vue Semaine/Mois ignorait heurePrevue).
    assigner(objet, employeId, date, objet.heurePrevue || HEURE_PAR_DEFAUT);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={reculer} aria-label="Précédent" className="rounded-lg border border-slate-200 p-1.5"><ChevronLeft size={16} /></button>
          {/* Largeur FIXE + texte centré : la longueur de la date varie
              (« mardi 28 juillet » vs « mercredi 24 septembre ») et sans
              largeur fixe, les flèches se déplaçaient à chaque clic. */}
          <h2 className="min-w-[230px] text-center text-sm font-extrabold capitalize text-slate-800">{vue === "mois" ? moisLabel : jourLabel}</h2>
          <button onClick={avancer} aria-label="Suivant" className="rounded-lg border border-slate-200 p-1.5"><ChevronRight size={16} /></button>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([id, labelVue]) => (
            <button
              key={id}
              onClick={() => setVue(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${vue === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              {tr(labelVue)}
            </button>
          ))}
        </div>
        {/* 📱 LISTE ou GRILLE — TÉLÉPHONE SEULEMENT (2026-08-22).
            Avant, la largeur de l'écran décidait toute seule : sous
            768 px, la grille disparaissait, point. Le choix appartient
            maintenant à la personne. Au bureau l'interrupteur ne
            s'affiche pas — la grille y est toujours le bon choix, et
            c'est un bouton de moins à l'écran. */}
        <div className="flex rounded-lg border border-slate-200 p-0.5 md:hidden">
          {[["liste", "📋 Liste"], ["grille", "▦ Grille"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => choisirModeAgenda(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${modeAgendaMobile === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {TYPES_TACHE.map((t) => (
          <div key={t.id} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${COULEUR_TYPE_TACHE[t.id].pastille}`} />
            {tr(t.label)}
          </div>
        ))}
      </div>

      {vue === "jour" && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto">
          {semaine.map((d) => {
            // 📅 Calendrier CCQ : le jour marqué se voit AVANT le clic —
            // pastille ambrée (férié) ou grise (vacances construction).
            const marque = configEnt?.calendrierCcq === true ? marqueurCcq(dateISO(d)) : null;
            return (
              <button
                key={dateISO(d)}
                onClick={() => setJourAffiche(d)}
                title={marque?.nom || undefined}
                className={`flex min-w-[52px] flex-col items-center rounded-xl px-2 py-1.5 text-xs font-bold ${
                  dateISO(d) === jourKey
                    ? "bg-[#131B2E] text-white"
                    : marque?.type === "ferie"
                      ? "bg-amber-100 text-amber-700"
                      : marque?.type === "vacances"
                        ? "bg-slate-200 text-slate-500"
                        : "bg-slate-100 text-slate-500"
                }`}
              >
                <span>{d.toLocaleDateString(localeDates, { weekday: "short" })}</span>
                <span className="tabular-nums">{d.getDate()}</span>
                {marque && <span className="text-[9px] leading-none">{marque.type === "ferie" ? "🎌" : "🏖️"}</span>}
              </button>
            );
          })}
        </div>
      )}
      {/* 📅 Bandeau du jour affiché : férié ou vacances de la
          construction — dit POURQUOI ne pas céduler ici. */}
      {vue === "jour" && configEnt?.calendrierCcq === true && (() => {
        const marque = marqueurCcq(jourKey);
        if (!marque) return null;
        return (
          <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${marque.type === "ferie" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
            {marque.type === "ferie" ? "🎌" : "🏖️"} {marque.nom} — calendrier de la construction (CCQ)
          </div>
        );
      })()}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* PANNEAU TÂCHES EN ATTENTE */}
        <div className="lg:w-80 lg:shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              {tr("Tâches en attente")} ({tachesAttente.length})
            </h3>
            {!lectureSeule && (
              <Button onClick={() => { setFormulaireOuvert((v) => !v); setEtapeTypeTache(false); }} className="min-h-0 gap-1 px-2 py-1 text-[11px]">
                <Plus size={12} /> {tr("Nouvelle tâche")}
              </Button>
            )}
          </div>

          {/* ONGLETS : prêtes / dépôt impayé / pièce en commande. */}
          <div className="mb-2 flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setOngletAttente("pretes")}
              className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold ${
                ongletAttente === "pretes" ? "bg-[#131B2E] text-white" : "text-slate-500"
              }`}
            >
              ✅ {tr("Prêtes")}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${ongletAttente === "pretes" ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
                {tachesPretes.length}
              </span>
            </button>
            <button
              onClick={() => setOngletAttente("bloquees")}
              className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold ${
                ongletAttente === "bloquees" ? "bg-amber-600 text-white" : "text-slate-500"
              }`}
            >
              🔒 {tr("Dépôt")}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${ongletAttente === "bloquees" ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
                {tachesBloquees.length}
              </span>
            </button>
            <button
              onClick={() => setOngletAttente("pieces")}
              className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold ${
                ongletAttente === "pieces" ? "bg-sky-600 text-white" : piecesEnRetard > 0 ? "text-red-600" : "text-slate-500"
              }`}
            >
              🔧 {tr("Pièces")}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${
                  ongletAttente === "pieces"
                    ? "bg-white/25"
                    : piecesEnRetard > 0
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {tachesPiece.length}
              </span>
            </button>
          </div>

          {lectureSeule && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
              <Lock size={12} className="shrink-0" /> Consultation seulement — ton rôle ne permet pas de modifier l'horaire.
            </p>
          )}

          {formulaireOuvert && !lectureSeule && (
            /* FENÊTRE SPACIEUSE (2026-08-18) : le formulaire sort de la
               colonne étroite — grande fenêtre centrée (2 colonnes sur
               ordinateur, plein écran sur téléphone), en-tête et pied
               COLLANTS (le bouton Créer toujours visible). Aucune
               logique ne change : mêmes champs, mêmes règles. */
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6"
              onClick={() => setFormulaireOuvert(false)}
            >
              <div
                className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white md:max-h-[88vh] md:max-w-3xl md:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    ➕ Nouvelle tâche
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{TYPE_INFO(nouveauType)?.label}</span>
                  </h3>
                  <button onClick={() => setFormulaireOuvert(false)} aria-label="Fermer">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4 md:columns-2 md:gap-x-6 md:space-y-0 md:[&>*]:mb-3 md:[&>*]:break-inside-avoid">
              <>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Type de tâche</label>
                <select
                  value={nouveauType}
                  onChange={(e) => setNouveauType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  {TYPES_TACHE.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  {TYPES_TACHE.find((t) => t.id === nouveauType)?.description}
                </p>

                {/* TEMPS SUR LE PROJET — seulement pour les visites.
                    Une visite de soumission qu'on ne remporte pas est un
                    coût de vente ; une visite sur un chantier en cours
                    appartient à ce projet. Toi seul le sais. */}
                {estTypeAdministratif(nouveauType) && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <input
                      type="checkbox"
                      checked={tempsSurProjet}
                      onChange={(e) => setTempsSurProjet(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
                    />
                    <span className="text-[10px] leading-snug text-slate-600">
                      <span className="font-bold text-slate-800">Temps comptabilisé sur le projet</span>
                      <br />
                      {tempsSurProjet
                        ? "Ces heures entreront dans le coût du projet choisi."
                        : "Décoché : les heures vont aux frais ADMINISTRATIFS de l'entreprise, pas au coût d'un projet."}
                    </span>
                  </label>
                )}

                {nouveauType === "conge" && (
                  <p className="mt-2 rounded-lg bg-zinc-100 px-2 py-1.5 text-[10px] leading-snug text-zinc-600">
                    🚫 Aucun chronomètre, aucune heure. La journée est simplement bloquée à l&apos;agenda pour qu&apos;on
                    n&apos;y place pas de travail.
                  </p>
                )}
              </div>
              {/* CLIENT EN DEUXIÈME (demande du propriétaire, 2026-08-17) :
                  c'est lui qui décide de tout le reste — devis offerts,
                  contact sur place, adresses enregistrées, courriels du
                  dépôt. On le choisit donc juste après le type. */}
              {!estTypeSansClient(nouveauType) && (
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Client</label>
                {/* ➕ TOUJOURS PREMIER À L'ÉCRAN (demande du propriétaire,
                    2026-08-17) : créer un client est l'action la plus
                    fréquente à rater — elle ne se cache plus dans un menu. */}
                <button
                  type="button"
                  onClick={() => setModalNouveauClientTache(true)}
                  className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-600 active:scale-[0.99]"
                >
                  ➕ Nouveau client…
                </button>
                {/* SUGGESTIONS VISIBLES : la liste rétrécit à chaque
                    lettre, sous les yeux — plus de menu à ouvrir. Les
                    noms qui commencent pareil se départagent à mesure. */}
                <input
                  value={filtreClientTache}
                  onChange={(e) => setFiltreClientTache(e.target.value)}
                  onFocus={() => setListeClientsTacheOuverte(true)}
                  onBlur={() => setTimeout(() => setListeClientsTacheOuverte(false), 200)}
                  placeholder="🔍 Clique pour la liste, ou tape le nom…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                />
                {(listeClientsTacheOuverte || filtreClientTache.trim() !== "") && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {clients
                      .filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientTache.trim().toLowerCase()))
                      .sort((a, b) => nomAffichageClient(a).localeCompare(nomAffichageClient(b), "fr"))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { choisirClientTache(c.id); setFiltreClientTache(""); setListeClientsTacheOuverte(false); }}
                          className="block w-full border-b border-slate-100 px-2 py-2 text-left text-xs font-semibold text-slate-700 last:border-0 active:bg-orange-50"
                        >
                          {/* truncate : un nom accidentellement TRÈS long
                              (texte collé — vécu 2026-08-17) reste sur
                              UNE ligne au lieu d'inonder la liste. */}
                          <span className="block truncate">{nomAffichageClient(c)}</span>
                        </button>
                      ))}
                    {clients.filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientTache.trim().toLowerCase())).length === 0 && (
                      <p className="px-2 py-2 text-[11px] text-slate-400">
                        Aucun client trouvé — crée-le avec « ➕ Nouveau client… » juste au-dessus.
                      </p>
                    )}
                  </div>
                )}
                {(() => {
                  const c = clients.find((x) => x.id === nouveauClientId);
                  return c ? (
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#FF6A13] bg-orange-50 px-2 py-1.5">
                      <span className="min-w-0 truncate text-xs font-bold text-slate-800">{nomAffichageClient(c)}</span>
                      <button
                        type="button"
                        onClick={() => setClientEnEditionAgenda(c.id)}
                        title="Modifier la fiche du client (téléphone, entreprise, contacts...)"
                        className="shrink-0 text-slate-400 hover:text-slate-700"
                        aria-label="Modifier la fiche du client"
                      >
                        <Pencil size={12} />
                      </button>
                      <button type="button" onClick={() => choisirClientTache("")} className="shrink-0 text-[10px] font-bold text-slate-400 underline underline-offset-2">
                        changer
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] font-bold text-amber-600">— Choisis le client (tape son nom, ou crée-le avec ➕) —</p>
                  );
                })()}
              </div>
              )}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Titre / description courte</label>
                <input
                  value={nouveauTitre}
                  onChange={(e) => setNouveauTitre(e.target.value)}
                  placeholder="Ex: Appel de service — bruit anormal"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                />
              </div>
              {nouveauType === "course" && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse de la course (facultatif)</label>
                  {/* La MÊME autocomplétion Google que partout ailleurs —
                      une adresse proprement choisie fait un vrai lien de
                      navigation sur le téléphone du technicien. */}
                  {adresseCourseLibre ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5">
                      <span className="min-w-0 truncate text-xs font-semibold text-slate-700">📍 {adresseCourseLibre}</span>
                      <button
                        type="button"
                        onClick={() => setAdresseCourseLibre("")}
                        className="shrink-0 text-[10px] font-bold text-slate-400 underline underline-offset-2"
                      >
                        changer
                      </button>
                    </div>
                  ) : (
                    <AutocompleteAdresse onSelection={(place) => setAdresseCourseLibre(place.label)} />
                  )}
                </div>
              )}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                  {/* 🏖️ Un congé n'a pas de « travaux » : on demande la
                      RAISON, qui reste notée au dossier (2026-09-02). */}
                  {nouveauType === "conge"
                    ? <>Raison du congé <span className="font-normal text-slate-400">(reste notée au dossier)</span></>
                    : <>Description des travaux <span className="font-normal text-orange-600">(visible au technicien)</span></>}
                </label>
                <textarea
                  value={nouvelleDescription}
                  onChange={(e) => setNouvelleDescription(e.target.value)}
                  rows={2}
                  placeholder={nouveauType === "conge" ? "Pourquoi cette journée est bloquée — vacances, rendez-vous, finir tôt…" : "Ce qu'il y a à faire sur cette tâche, instructions particulières..."}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                />
                {(nouveauType === "devis" || nouveauType === "entretien_contrat") && (
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    Les items du devis (quantités × items, sans les prix) apparaissent ici dès que tu choisis le devis — modifiables avant de créer la tâche.
                  </p>
                )}
              </div>

              {/* 📎 PHOTOS ET PLANS — le technicien les aura dans sa poche. */}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                  📎 Photos et plans <span className="font-normal text-orange-600">(visibles au technicien)</span>
                </label>
                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-[11px] font-semibold ${televersementJointe ? "border-slate-200 text-slate-300" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                  {televersementJointe ? "Téléversement…" : "➕ Ajouter des images ou des PDF"}
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    disabled={televersementJointe}
                    className="hidden"
                    onChange={(e) => {
                      const fichiers = Array.from(e.target.files || []);
                      e.target.value = "";
                      if (fichiers.length > 0) ajouterPiecesJointes(fichiers);
                    }}
                  />
                </label>
                {nouvellesPiecesJointes.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {nouvellesPiecesJointes.map((pj, idx) => (
                      <div key={pj.url} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px]">
                        {pj.type === "image" ? (
                          // Vignette cliquable — on vérifie ce qu'on envoie.
                          <a href={pj.url} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={pj.url} alt={pj.nom} loading="lazy" decoding="async" className="h-8 w-8 rounded object-cover" />
                          </a>
                        ) : (
                          <span className="shrink-0 text-base">📄</span>
                        )}
                        <a href={pj.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold text-slate-600 hover:underline">
                          {pj.nom}
                        </a>
                        <button
                          onClick={() => setNouvellesPiecesJointes((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 text-slate-400 hover:text-red-600"
                          aria-label="Retirer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 📌 NOTE GÉNÉRALE DU CLIENT (2026-08-30) — l'aide-mémoire
                  de la fiche ressurgit AU MOMENT DE DÉCIDER : c'est ici
                  qu'un « mauvais payeur — exiger un dépôt » doit se lire,
                  pas enfoui dans le dossier. */}
              {!estTypeSansClient(nouveauType) && nouveauClientId && (() => {
                const noteClient = clients.find((c) => c.id === nouveauClientId)?.note;
                if (!noteClient) return null;
                return (
                  <p className="whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                    📌 Note du dossier : {noteClient}
                  </p>
                );
              })()}
              {/* 📇 CONTACT SUR PLACE — la personne à voir sur le
                  chantier, choisie dans le carnet du client ou créée ici
                  (et mémorisée au carnet). Le technicien la verra avec
                  un bouton d'appel direct. */}
              {!estTypeSansClient(nouveauType) && nouveauClientId && (() => {
                const clientChoisi = clients.find((c) => c.id === nouveauClientId);
                const carnet = clientChoisi?.contacts || [];
                return (
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                      Contact sur place <span className="font-normal normal-case text-slate-400">— optionnel (chargé de projet, concierge…)</span>
                    </label>
                    <select
                      value={contactSurPlaceId}
                      onChange={(e) => setContactSurPlaceId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value="">Aucun — le technicien verra le numéro de la fiche client</option>
                      {carnet.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}{c.role ? ` — ${c.role}` : ""}{c.telephone ? ` (${c.telephone})` : ""}
                        </option>
                      ))}
                      <option value="nouveau">➕ Nouveau contact…</option>
                    </select>
                    {contactSurPlaceId === "nouveau" && (
                      <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            value={contactNom}
                            onChange={(e) => setContactNom(e.target.value)}
                            placeholder="Nom (ex. : Marc Tremblay)"
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={contactRole}
                            onChange={(e) => setContactRole(e.target.value)}
                            placeholder="Rôle (chargé de projet…)"
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <input
                          value={contactTel}
                          onChange={(e) => setContactTel(e.target.value)}
                          placeholder="Téléphone"
                          className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <p className="mt-1 text-[9px] text-slate-400">
                          Sera enregistré au carnet de {nomAffichageClient(clientChoisi) || "ce client"} — offert automatiquement à la prochaine tâche.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 🔧 UNITÉS CONCERNÉES — le carnet d'équipements du client
                  (relevé sur les bons passés). Cocher = le technicien
                  saura LAQUELLE travailler, et sa section « Unité
                  vérifiée » arrivera pré-remplie. Rien de coché = comme
                  avant. Un client jamais visité n'a pas de carnet : la
                  section ne s'affiche pas, le carnet se bâtit tout seul
                  au fil des visites. */}
              {!estTypeSansClient(nouveauType) && nouveauClientId && (() => {
                const connues = unitesConnuesDuClient(nouveauClientId);
                if (connues.length === 0) return null;
                return (
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                      🔧 Unité(s) concernée(s) <span className="font-normal normal-case text-slate-400">— relevées lors de visites passées, optionnel</span>
                    </label>
                    <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                      {connues.map((u) => (
                        <label key={u.cle} className="flex items-start gap-1.5 rounded px-1 py-0.5 text-[11px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={unitesChoisies.includes(u.cle)}
                            onChange={() =>
                              setUnitesChoisies((prev) =>
                                prev.includes(u.cle) ? prev.filter((x) => x !== u.cle) : [...prev, u.cle]
                              )
                            }
                            className="mt-0.5 shrink-0 accent-[#131B2E]"
                          />
                          <span className="min-w-0">
                            {u.emplacement ? <span className="mr-1 rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold text-slate-600">📍 {u.emplacement}</span> : null}
                            <span className="font-semibold">{u.modele || "Modèle non relevé"}</span>
                            {u.serie ? <span className="text-slate-500"> · Nº {u.serie}</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-400">
                      Le technicien verra l&apos;unité en évidence sur sa fiche de tâche, et sa section « Unité vérifiée » sera pré-remplie.
                    </p>
                  </div>
                );
              })()}

              {/* SECTEUR CCQ — commercial/résidentiel : décide du taux
                  coûtant. Hérité du projet choisi, changeable ici.
                  Course et congé : sans objet, masqué. */}
              {!estTypeSansClient(nouveauType) && (
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Secteur (taux CCQ)</label>
                <div className="flex gap-1.5">
                  {[["commercial", "🏢 Commercial"], ["residentiel", "🏠 Résidentiel"]].map(([val, lib]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNouveauSecteur(val)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                        nouveauSecteur === val ? "border-[#131B2E] bg-[#131B2E] text-white" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {lib}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Projet lié (optionnel)</label>
                <select
                  value={nouveauProjetId}
                  onChange={(e) => setNouveauProjetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Aucun / Projet général</option>
                  {projetsDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                {nouveauClientId && projetsDisponibles.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">Ce client n'a aucun projet actif — la tâche restera hors-projet.</p>
                )}
                {nouveauProjetId && (
                  <p className="mt-1 text-[10px] text-emerald-600">
                    Les heures de cette tâche compteront dans la rentabilité de ce projet.
                  </p>
                )}
                {/* 🏗️ CRÉER LE PROJET AVEC LA TÂCHE (2026-09-03, demande
                    du propriétaire) — le chantier naît du même geste :
                    nom prérempli du titre, budget global prérempli du
                    DEVIS QUICKBOOKS VÉRIFIÉ (🔎 ci-contre) quand il y en
                    a un. La tâche se rattache toute seule. */}
                {!nouveauProjetId && nouveauClientId && onCreerProjet && !miniProjetOuvert && (
                  <button
                    type="button"
                    onClick={() => {
                      setMiniProjetOuvert(true);
                      setMiniProjetNom(nouveauTitre.trim() || "");
                      setMiniProjetFacture(verifDevisQbo?.etat === "trouve" ? verifDevisQbo.total : "");
                      setMiniProjetCoutant("");
                    }}
                    className="mt-1 text-[10px] font-bold text-slate-500 underline underline-offset-2"
                  >
                    ➕ Créer un projet pour cette tâche…
                  </button>
                )}
                {miniProjetOuvert && (
                  <div className="mt-1.5 space-y-1.5 rounded-xl border border-dashed border-slate-300 p-2.5">
                    <input
                      value={miniProjetNom}
                      onChange={(e) => setMiniProjetNom(e.target.value)}
                      placeholder="Nom du projet *"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Prix vendu (total) $ *</label>
                        <InputNombreDecimal valeur={miniProjetFacture} onChange={setMiniProjetFacture} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coût projeté $</label>
                        <InputNombreDecimal valeur={miniProjetCoutant} onChange={setMiniProjetCoutant} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs tabular-nums" />
                      </div>
                    </div>
                    {verifDevisQbo?.etat === "trouve" && Number(miniProjetFacture) === Number(verifDevisQbo.total) && (
                      <p className="text-[9px] font-semibold text-emerald-700">💡 Prix vendu prérempli du devis QuickBooks vérifié.</p>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button variant="outline" onClick={() => setMiniProjetOuvert(false)} className="min-h-0 py-1.5 text-[11px]">Annuler</Button>
                      <Button
                        disabled={!miniProjetNom.trim() || (Number(miniProjetFacture) || 0) <= 0}
                        onClick={() => {
                          const nouveau = {
                            id: `projet-${Date.now()}`,
                            nom: miniProjetNom.trim(),
                            clientId: nouveauClientId,
                            adresseTravaux: null,
                            dateDebut: nouvelleDate || todayISO(),
                            dateFin: "",
                            secteur: nouveauSecteur === "residentiel" ? "residentiel" : "commercial",
                            statut: "À planifier",
                            budgetTotal: Number(miniProjetFacture) || 0,
                            tauxHoraireCoutant: 45,
                            bonsCommande: [],
                            ...(verifDevisQbo?.etat === "trouve" && numeroDevisExistant.trim() ? { devisNumero: numeroDevisExistant.trim() } : {}),
                            budgetPrevu: {
                              modeSimple: true,
                              mainOeuvreChantier: { heures: 0, facture: 0, coutant: 0 },
                              transport: { heures: 0, facture: 0, coutant: 0 },
                              materiaux: { facture: 0, coutant: 0 },
                              sousTraitants: [],
                              totalFacture: Number(miniProjetFacture) || 0,
                              totalCoutant: Number(miniProjetCoutant) || 0,
                              marge: (Number(miniProjetFacture) || 0) - (Number(miniProjetCoutant) || 0),
                            },
                          };
                          onCreerProjet(nouveau);
                          setNouveauProjetId(nouveau.id);
                          setMiniProjetOuvert(false);
                          ajouterJournal(`🏗️ Projet "${nouveau.nom}" créé avec la tâche — budget global ${(Number(miniProjetFacture) || 0).toFixed(2)} $.`);
                        }}
                        className="min-h-0 py-1.5 text-[11px]"
                      >
                        Créer et rattacher
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <input
                    type="checkbox"
                    checked={adresseTravauxDifferente}
                    onChange={(e) => {
                      setAdresseTravauxDifferente(e.target.checked);
                      setAdresseTravauxId("");
                      setNouvelleAdresseTravaux(null);
                    }}
                    className="h-3.5 w-3.5 accent-[#FF6A13]"
                  />
                  Adresse des travaux différente de l'adresse de facturation
                </label>
                {adresseTravauxDifferente && (
                  <div className="space-y-2 rounded-lg bg-slate-50 p-2">
                    {(() => {
                      const client = clients.find((c) => c.id === nouveauClientId);
                      if ((client?.adresses || []).length === 0) return null;
                      // La liste montre UNIQUEMENT les adresses de CE
                      // client — son nom est affiché pour qu'aucun doute
                      // ne subsiste (retour de tests : « adresses
                      // mélangées »). Filtre au-dessus, liste conservée.
                      const f = filtreAdresseTache.trim().toLowerCase();
                      const adressesFiltrees = client.adresses.filter(
                        (a) => !f || a.id === adresseTravauxId || `${a.nom} ${a.ligne1} ${a.appartement || ""}`.toLowerCase().includes(f)
                      );
                      return (
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Adresses enregistrées de {nomAffichageClient(client)}
                          </p>
                          <input
                            value={filtreAdresseTache}
                            onChange={(e) => setFiltreAdresseTache(e.target.value)}
                            placeholder="🔍 Filtrer les adresses…"
                            className="mb-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                          />
                          <select
                            value={adresseTravauxId}
                            onChange={(e) => { setAdresseTravauxId(e.target.value); setNouvelleAdresseTravaux(null); }}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">— Choisir une adresse enregistrée —</option>
                            {adressesFiltrees.map((a) => (
                              <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-slate-400">Ou saisir une nouvelle adresse :</p>
                    <AutocompleteAdresse
                      onSelection={(place) => { setNouvelleAdresseTravaux(place); setAdresseTravauxId(""); }}
                    />
                    <input
                      value={nouvelleAdresseApp}
                      onChange={(e) => setNouvelleAdresseApp(e.target.value)}
                      placeholder="App. / unité (optionnel) — ex. : 4B"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:w-52"
                    />
                    {nouvelleAdresseTravaux && (
                      <>
                        <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                          <Check size={12} /> {nouvelleAdresseTravaux.label}
                          {nouvelleAdresseApp.trim() ? `, app. ${nouvelleAdresseApp.trim()}` : ""}
                        </p>
                        {/* 📌 Cochée d'avance : l'adresse rejoint le dossier
                            du client et sera offerte dans la liste à la
                            prochaine tâche (anti-doublon à la création). */}
                        {nouveauClientId && (
                          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={enregistrerAdresseFiche}
                              onChange={(e) => setEnregistrerAdresseFiche(e.target.checked)}
                              className="h-3.5 w-3.5 accent-[#FF6A13]"
                            />
                            📌 Enregistrer cette adresse au dossier de {nomAffichageClient(clients.find((c) => c.id === nouveauClientId)) || "ce client"}
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>



              {(nouveauType === "devis" || nouveauType === "entretien_contrat" || nouveauType === "appel_service") && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                    {nouveauType === "entretien_contrat" ? "Devis / contrat à facturer" : nouveauType === "appel_service" ? "Devis à lier (optionnel — ex : devis fait après la 1re visite)" : "Devis à facturer"}
                  </label>
                  <select
                    value={nouveauDevisId}
                    onChange={(e) => {
                      setNouveauDevisId(e.target.value);
                      // Contrat d'entretien : la fréquence choisie sur le
                      // devis est reprise automatiquement (modifiable).
                      const d = devisListe.find((x) => x.id === e.target.value);
                      if (d?.estContrat && d.frequenceFacturationAnnuelle) setNouvelleFrequence(d.frequenceFacturationAnnuelle);
                      // 📝 LA DESCRIPTION SUIT LE DEVIS, sous les yeux
                      // (2026-08-29) : les items (quantité × nom, jamais de
                      // prix) se posent dans le champ dès la sélection —
                      // modifiables. Changer de devis remplace les lignes de
                      // l'ancien ; le texte tapé à la main reste intact.
                      if (d && (nouveauType === "devis" || nouveauType === "entretien_contrat")) {
                        const texteDevis = texteDevisPourDescription(d);
                        setNouvelleDescription((prev) => {
                          let base = prev;
                          const ancien = dernierTexteDevisRef.current;
                          if (ancien && base.includes(ancien)) {
                            // split/join — jamais String.replace (piège des $
                            // dans le texte remplacé, vécu).
                            base = base.split(ancien).join("").trim();
                          }
                          dernierTexteDevisRef.current = texteDevis;
                          if (!texteDevis) return base;
                          return base ? `${base}\n${texteDevis}` : texteDevis;
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="" disabled>Sélectionner un devis...</option>
                    {devisListe
                      .slice()
                      // 🎯 SEULEMENT les devis DU CLIENT choisi (retour de
                      // tests 2026-08-17) : la liste montrait les devis de
                      // TOUS les clients — risque de lier le mauvais devis
                      // à la tâche. Sans client choisi, liste complète.
                      .filter((d) => !nouveauClientId || d.clientId === nouveauClientId)
                      // Pour une tâche « Entretien selon contrat », les
                      // CONTRATS apparaissent en premier, clairement marqués.
                      .sort((a, b) => (nouveauType === "entretien_contrat" ? (b.estContrat ? 1 : 0) - (a.estContrat ? 1 : 0) : 0))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.estContrat ? `📄 CONTRAT ${d.frequenceFacturationAnnuelle}×/an — ` : ""}{d.numero} — {d.clientNom}
                        </option>
                      ))}
                  </select>
                  {!nouveauClientId && devisListe.length > 0 && (
                    <p className="mt-1 text-[10px] text-slate-400">Choisis d&apos;abord le client plus bas : la liste ne montrera que SES devis.</p>
                  )}
                  {nouveauClientId && devisListe.filter((d) => d.clientId === nouveauClientId).length === 0 && (
                    <p className="mt-1 text-[10px] text-amber-600">
                      Aucun devis au dossier de ce client{nouveauType !== "entretien_contrat" ? " — entre un numéro manuellement ci-dessous, ou crée le devis dans l'onglet Devis" : " — entre le Nº de l'ancien contrat ci-dessous, ou crée le contrat dans l'onglet Devis"}.
                    </p>
                  )}
                  {devisListe.length === 0 && (
                    <p className="mt-1 text-[10px] text-red-500">Aucun devis disponible — crée-en un dans l'onglet Devis.</p>
                  )}
                </div>
              )}

              {nouveauType === "entretien_contrat" && (
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Fréquence de facturation</label>
                  <select
                    value={nouvelleFrequence}
                    onChange={(e) => setNouvelleFrequence(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    {FREQUENCES_CONTRAT.map((f) => (
                      <option key={f} value={f}>{f === 1 ? "1 facture par an (paiement complet)" : `${f} factures par an`}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nº DE DEVIS EXISTANT (transition QuickBooks) — pour les
                  jobs vendues avec un devis d'AVANT l'application. Offert
                  AUSSI pour « Travaux avec devis » (retour de tests
                  2026-08-17) et, depuis le 2026-09-04 (demande du
                  propriétaire), pour les ENTRETIENS : les anciens
                  contrats n'ont aucun devis dans l'app — leur numéro se
                  tape ici et la fréquence se choisit juste au-dessus. */}
              {(
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">
                    {nouveauType === "devis" ? "…ou entre un Nº de devis manuellement (devis fait hors de l'app)" : nouveauType === "entretien_contrat" ? "…ou entre le Nº de l'ancien contrat / devis (d'avant Fluxya)" : "Nº de devis existant (QuickBooks)"} <span className="font-normal normal-case text-slate-400">— optionnel</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      value={numeroDevisExistant}
                      onChange={(e) => {
                        setNumeroDevisExistant(e.target.value);
                        setVerifDevisQbo(null); // le numéro change — la vérification d'avant ne vaut plus
                      }}
                      placeholder="Ex. : 1057 ou DEV-2024-312"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:w-64"
                    />
                    <button
                      type="button"
                      onClick={verifierDevisQbo}
                      disabled={!numeroDevisExistant.trim() || verifDevisQbo?.etat === "cherche"}
                      className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"
                    >
                      {verifDevisQbo?.etat === "cherche" ? "…" : "🔎 Vérifier"}
                    </button>
                  </div>
                  {/* Le verdict — une faute de frappe attrapée ICI coûte
                      dix fois moins cher qu'à la facturation. */}
                  {verifDevisQbo?.etat === "trouve" && (
                    <p className="mt-0.5 rounded bg-emerald-50 px-1.5 py-1 text-[9px] font-bold text-emerald-700">
                      ✓ Trouvé dans QuickBooks — {verifDevisQbo.nbLignes} ligne{verifDevisQbo.nbLignes > 1 ? "s" : ""},
                      total {verifDevisQbo.total.toFixed(2)} $ HT{verifDevisQbo.clientNomQbo ? ` · client : ${verifDevisQbo.clientNomQbo}` : ""}.
                      Le solde et la facturation progressive s&apos;appuieront dessus.
                    </p>
                  )}
                  {verifDevisQbo?.etat === "introuvable" && (
                    <p className="mt-0.5 rounded bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700">
                      ⚠️ Aucun devis à ce numéro dans QuickBooks — vérifie le numéro. Tu peux créer la tâche quand même :
                      le numéro suivra comme référence, sans montant ni lignes.
                    </p>
                  )}
                  {verifDevisQbo?.etat === "hors_ligne" && (
                    <p className="mt-0.5 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-semibold text-slate-500">
                      QuickBooks injoignable pour vérifier — la facturation réessaiera toute seule au moment venu.
                    </p>
                  )}
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    {nouveauType === "devis"
                      ? "Le numéro suivra la tâche jusqu'au bon de travail et à la facturation. S'il existe dans QuickBooks, son total et ses lignes seront relus à la facturation (solde anti-dépassement compris) — écris quand même l'essentiel dans la description pour le technicien."
                      : "Pour la transition : le numéro suivra la tâche jusqu'au bon de travail et à la facturation, et son contenu sera relu depuis QuickBooks au moment de facturer."}
                  </p>
                </div>
              )}

              <div className="border-t border-slate-100 pt-2">
                <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">Planification (optionnel)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date</label>
                    <input
                      type="date"
                      value={nouvelleDate}
                      onChange={(e) => setNouvelleDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heure de début</label>
                    <select
                      value={nouvelleHeureDebut}
                      onChange={(e) => setNouvelleHeureDebut(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heures / jour</label>
                    <input
                      type="number" min={0} max={HEURES.length} value={nouvelleDureeHeures}
                      onChange={(e) => { const v = parseInt(e.target.value); setNouvelleDureeHeures(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nombre de jours</label>
                    <input
                      type="number" min={0} value={nouvelleDureeJours}
                      onChange={(e) => { const v = parseInt(e.target.value); setNouvelleDureeJours(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
                {nouvelleDureeJours > 1 && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={nouveauSauterWeekend}
                      onChange={(e) => setNouveauSauterWeekend(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    Sauter les samedis et dimanches
                  </label>
                )}
                {/* 📅 Offerte seulement aux entreprises qui suivent le
                    calendrier CCQ (Paramètres → Paie & heures). TOUJOURS
                    visible (2026-09-01, retour du propriétaire : cachée
                    derrière « jours > 1 », il la cherchait sans la
                    trouver) — et utile même à 1 jour : une tâche posée
                    SUR un férié glisse au jour ouvrable suivant. */}
                {configEnt?.calendrierCcq === true && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={nouveauSauterFeries}
                      onChange={(e) => setNouveauSauterFeries(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    Sauter les jours fériés (calendrier CCQ)
                  </label>
                )}
                <div className="mt-1.5">
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Technicien attribué</label>
                  <select
                    value={nouveauEmployeId}
                    onChange={(e) => setNouveauEmployeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">— Laisser en attente (ne pas assigner) —</option>
                    {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
                  </select>
                </div>
                {/* MULTI-TECHNICIENS (retour de tests) : les cochés
                    rejoignent la MÊME tâche, planifiés d'un seul coup.
                    ⚠️ SANS DATE AUSSI (retour de tests 2026-08-17) : la
                    section n'apparaissait qu'avec une date — impossible
                    d'ajouter un 2e technicien sur un appel avec dépôt
                    (encore sans date). Sans date, les cochés sont
                    MÉMORISÉS sur la tâche et s'assignent d'un coup dès
                    qu'elle entre à l'horaire. */}
                {nouveauEmployeId && employes.filter((e) => e.id !== nouveauEmployeId).length > 0 && (
                  <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Ajouter d&apos;autres techniciens sur la même tâche
                    </p>
                    {!nouvelleDate && (
                      <p className="mb-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-700">
                        Sans date : ils seront assignés automatiquement avec la tâche quand elle sera placée à l&apos;horaire.
                      </p>
                    )}
                    <div className="space-y-1">
                      {employes
                        .filter((e) => e.id !== nouveauEmployeId)
                        .map((e) => {
                          const coche = nouveauxEmployesEnPlus.includes(e.id);
                          const choix = facturablesEnPlus[e.id]; // true | false | undefined
                          return (
                            <div key={e.id}>
                              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={coche}
                                  onChange={() => {
                                    setNouveauxEmployesEnPlus((prev) =>
                                      prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]
                                    );
                                    // Décoché = son choix 💰/🤝 s'efface
                                    // aussi (pas de choix fantôme si on
                                    // le recoche plus tard).
                                    setFacturablesEnPlus((prev) => {
                                      const maj = { ...prev };
                                      delete maj[e.id];
                                      return maj;
                                    });
                                  }}
                                  className="h-3.5 w-3.5 accent-[#131B2E]"
                                />
                                {e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}
                              </label>
                              {/* 🤝 SOUS-TRAITANT en renfort (2026-08-19) :
                                  pas de question 💰/🤝 (il n'est ni payé ni
                                  dans l'équipe de signature) — son bloc sur
                                  SA rangée sert au suivi Présent/Pas venu
                                  et au coût réel du projet. */}
                              {coche && e.estSousTraitant && (
                                <p className="mt-1 pl-5 text-[10px] leading-snug text-slate-500">
                                  Suivi Présent/Pas venu sur sa rangée — jamais compté dans l&apos;équipe de signature ni dans la paie.
                                </p>
                              )}
                              {/* CHOIX OBLIGATOIRE fait ICI (2026-08-17) —
                                  aucune présélection : facturable au client,
                                  ou aide interne non facturable. */}
                              {coche && !e.estSousTraitant && (
                                <div className="mt-1 flex gap-1.5 pl-5">
                                  <button
                                    type="button"
                                    onClick={() => setFacturablesEnPlus((prev) => ({ ...prev, [e.id]: true }))}
                                    className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                      choix === true ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-600"
                                    }`}
                                  >
                                    💰 Facturable
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFacturablesEnPlus((prev) => ({ ...prev, [e.id]: false }))}
                                    className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                      choix === false ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 bg-white text-slate-600"
                                    }`}
                                  >
                                    🤝 Non facturable (aide)
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <p className="mt-1 text-[9px] text-slate-400">
                      Même job à plusieurs bras : heures additionnées, UNE facturation. Chacun reste ajustable
                      individuellement ensuite dans l&apos;agenda.
                    </p>
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  {depotRequis
                    ? nouveauEmployeId
                      ? "Le technicien choisi sera RÉSERVÉ sur la tâche, mais elle restera en attente tant que le dépôt n'est pas payé."
                      : "Dépôt requis : la tâche ira dans « Tâches en attente » jusqu'au paiement. Tu peux quand même choisir le technicien prévu ci-dessus."
                    : nouvelleDate && nouveauEmployeId
                    ? `Sera placée directement dans l'horaire à ${nouvelleHeureDebut}.`
                    : "Sans date ET technicien, la tâche ira dans « Tâches en attente »."}
                </p>
              </div>

              {/* 🗺️ ZONE DE TARIFICATION — TOUJOURS, dépôt ou pas.
                  C'est elle qui dit à la facturation le prix de base de
                  l'appel ET la règle du temps inclus. Obligatoire pour
                  un appel de service, comme le secteur CCQ. */}
              {nouveauType === "appel_service" && (
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <label className="mb-0.5 block text-xs font-bold text-slate-700">
                    🗺️ Zone de tarification <span className="font-normal text-slate-400">(règle de facturation de l&apos;appel)</span>
                  </label>
                  <select
                    value={zoneAppelChoix}
                    onChange={(e) => {
                      const v = e.target.value;
                      setZoneAppelChoix(v);
                      // Le montant du dépôt SUIT la zone (saisie libre hors zone).
                      setDepotMontant(v === "hors_zone" || v === "" ? "" : String(Number(prixDepots?.[v]) || 0));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    <option value="">— Choisir la zone —</option>
                    {zonesEffectives(prixDepots).filter((z) => Number(prixDepots?.[z]) > 0).map((z) => {
                      const p = Number(prixDepots[z]);
                      return (
                        <option key={z} value={z}>
                          {z} — {p.toFixed(2)} $ HT ({taxesDepot(p, configEnt).total.toFixed(2)} $ taxes incl.) — transport inclus, {Number(prixDepots?.minutes_incluses) || 90} min chez le client
                        </option>
                      );
                    })}
                    <option value="hors_zone">
                      Hors zone — tarif sur mesure — {Number(prixDepots?.minutes_incluses_hors_zone) || 180} min totales, transport compté
                    </option>
                  </select>
                  <p className="mt-1 text-[9px] leading-snug text-slate-400">
                    La comptabilité s&apos;en sert même sans dépôt : prix de base de l&apos;appel et calcul du temps
                    supplémentaire (temps réel sur place seulement — jamais le bloc d&apos;agenda).
                  </p>
                </div>
              )}

              {/* DÉPÔT PRÉALABLE */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <label className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <input
                    type="checkbox"
                    checked={depotRequis}
                    onChange={(e) => {
                      setDepotRequis(e.target.checked);
                      // Cocher APRÈS avoir choisi la zone : le montant suit.
                      if (e.target.checked && zoneAppelChoix && zoneAppelChoix !== "hors_zone") {
                        setDepotMontant(String(Number(prixDepots?.[zoneAppelChoix]) || 0));
                      }
                    }}
                    className="h-4 w-4 accent-[#131B2E]"
                  />
                  💰 Dépôt requis avant planification
                </label>
                {depotRequis && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold text-amber-800">Montant du dépôt (HT $)</label>
                      {!zoneAppelChoix && (
                        <p className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-800">
                          Choisis d&apos;abord la <span className="font-bold">zone de tarification</span> ci-dessus — le montant du dépôt suivra tout seul.
                        </p>
                      )}
                      {zoneAppelChoix && zoneAppelChoix !== "hors_zone" && (
                        <p className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">
                          {zoneAppelChoix} — <span className="tabular-nums">{(Number(prixDepots?.[zoneAppelChoix]) || 0).toFixed(2)} $ HT</span> (liste de prix)
                        </p>
                      )}
                      {zonesEffectives(prixDepots).every((z) => !(Number(prixDepots?.[z]) > 0)) && (
                        <p className="mt-1 text-[9px] text-amber-700">
                          Aucun prix de zone configuré — l&apos;Admin principal peut les définir dans Utilisateurs → « Liste de prix — dépôts ».
                        </p>
                      )}
                      {zoneAppelChoix === "hors_zone" && (
                        <InputNombreDecimal
                          valeur={depotMontant || 0}
                          onChange={(v) => setDepotMontant(String(v))}
                          className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
                        />
                      )}
                      {parseFloat(depotMontant) > 0 && (() => {
                        const t = taxesDepot(depotMontant, configEnt);
                        return (
                          <p className="mt-1 text-[10px] text-amber-800 tabular-nums">
                            + TPS {t.tps.toFixed(2)} $ + TVQ {t.tvq.toFixed(2)} $ = <span className="font-bold">{t.total.toFixed(2)} $ à percevoir</span> · payable sous 24 h
                          </p>
                        );
                      })()}
                    </div>
                    {/* ✅ DÉPÔT DÉJÀ PAYÉ AILLEURS (2026-08-31, demande du
                        propriétaire : transfert des rendez-vous de son
                        ancien système, dépôt déjà encaissé) : on note le
                        fait avec le Nº de la facture QuickBooks — rien
                        n'est facturé ni envoyé, la tâche est prête. */}
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${depotDejaPaye ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-white text-slate-600"}`}>
                      <input
                        type="checkbox"
                        checked={depotDejaPaye}
                        onChange={(e) => setDepotDejaPaye(e.target.checked)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      ✅ Dépôt DÉJÀ payé (transfert / autre système)
                    </label>
                    {depotDejaPaye && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold text-emerald-800">Payé par</label>
                            <select
                              value={depotDejaPayeMode}
                              onChange={(e) => setDepotDejaPayeMode(e.target.value)}
                              className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-xs"
                            >
                              {["Carte de crédit", "Virement", "Comptant", "Chèque", "Interac", "Autre"].map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold text-emerald-800">Nº facture QuickBooks (optionnel)</label>
                            <input
                              value={depotDejaPayeRef}
                              onChange={(e) => setDepotDejaPayeRef(e.target.value)}
                              placeholder="Ex : 4187"
                              className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-emerald-800">
                          Aucune facture ne sera créée et aucun courriel ne partira — la tâche arrive directement dans « ✅ Prêtes » avec la référence sur son badge.
                        </p>
                      </div>
                    )}
                    {/* 💳 PAIEMENT EN LIGNE — ce que le courriel OFFRIRA
                        au client, sous les yeux AVANT d'envoyer. Cases
                        pré-cochées selon les Paramètres (+ seuil de
                        carte) ; modifiables pour CET envoi seulement. */}
                    {!depotDejaPaye && (() => {
                      const m = parseFloat(depotMontant) || 0;
                      const seuil = Number(configEnt?.seuilCarteAppels) || 2000;
                      const carteAuto = configEnt?.paiementCarteAppels === true && m <= seuil;
                      const carte = depotCarteChoix ?? carteAuto;
                      const virement = depotVirementChoix ?? (configEnt?.paiementVirementAppels === true);
                      return (
                        <div className="rounded-lg border border-amber-200 bg-white p-2">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            💳 Paiement en ligne offert dans le courriel :
                          </p>
                          <label className="mb-0.5 flex items-center gap-1.5 text-[11px] text-slate-700">
                            <input type="checkbox" checked={carte} onChange={(e) => setDepotCarteChoix(e.target.checked)} />
                            Carte de crédit <span className="text-[10px] text-slate-400">(frais ≈ 2,9 % + 0,25 $ — à ta charge)</span>
                          </label>
                          {configEnt?.paiementCarteAppels === true && m > seuil && depotCarteChoix === null && (
                            <p className="mb-0.5 text-[10px] font-semibold text-amber-700">
                              La carte s&apos;est éteinte toute seule : montant au-dessus de ton seuil de {seuil.toFixed(0)} $ HT (Paramètres) — coche-la si tu la veux quand même.
                            </p>
                          )}
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                            <input type="checkbox" checked={virement} onChange={(e) => setDepotVirementChoix(e.target.checked)} />
                            Virement bancaire <span className="text-[10px] text-slate-400">(frais ≈ 1 % — à ta charge)</span>
                          </label>
                          {!carte && !virement && (
                            <p className="mt-1 text-[10px] font-bold text-red-600">
                              ⚠️ Aucun paiement en ligne ne sera offert — le client devra payer autrement (comptant, chèque, virement direct) et tu débloqueras la tâche à la main.
                            </p>
                          )}
                          {(carte || virement) && (
                            <p className="mt-1 text-[9px] leading-snug text-slate-400">
                              Le bouton « payer » n&apos;apparaît chez le client que si QuickBooks Payments est actif sur ton compte Intuit. Ton choix ici ne vaut que pour cette demande — les Paramètres ne bougent pas.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {/* DESTINATAIRES DE LA DEMANDE DE DÉPÔT — le courriel
                        (avec le Nº de la facture QuickBooks) part à la
                        création de la tâche. Adresses par défaut du
                        client précochées ; « autre adresse » en secours.
                        Masqué quand le dépôt est DÉJÀ payé (rien ne part). */}
                    {!depotDejaPaye && (() => {
                      const fiche = clients.find((c) => c.id === nouveauClientId);
                      const contacts = (fiche?.courriels || [])
                        .map((c) => (typeof c === "string" ? { email: c } : c))
                        .filter((c) => c?.email);
                      return (
                        <div className="rounded-lg border border-amber-200 bg-white p-2">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            ✉️ Envoyer la demande de dépôt à :
                          </p>
                          {contacts.length === 0 && (
                            <p className="mb-1 text-[10px] font-semibold text-amber-700">
                              Ce client n&apos;a aucun courriel dans sa fiche — inscris une adresse ci-dessous, ou aucune (tu l&apos;appelleras).
                            </p>
                          )}
                          {contacts.map((c) => (
                            <label key={c.email} className="mb-0.5 flex items-center gap-1.5 text-[11px] text-slate-700">
                              <input
                                type="checkbox"
                                checked={depotEmails.includes(c.email)}
                                onChange={() =>
                                  setDepotEmails((prev) =>
                                    prev.includes(c.email) ? prev.filter((x) => x !== c.email) : [...prev, c.email]
                                  )
                                }
                              />
                              {c.email}
                              {c.label ? <span className="text-[10px] text-slate-400">({c.label})</span> : null}
                            </label>
                          ))}
                          <input
                            value={depotExtra}
                            onChange={(e) => setDepotExtra(e.target.value)}
                            placeholder="Autre adresse (optionnel)"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          {/* 📌 Même réflexe que l'adresse de chantier :
                              une adresse tapée ici servira encore — on
                              l'offre à la fiche plutôt que de la perdre. */}
                          {depotExtra.trim() && nouveauClientId && (
                            <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={depotExtraAuDossier}
                                onChange={(e) => setDepotExtraAuDossier(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#FF6A13]"
                              />
                              📌 Ajouter ce courriel au dossier de {nomAffichageClient(fiche) || "ce client"}
                            </label>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-[10px] font-semibold text-amber-800">
                      💡 Client pas encore enregistré ? Choisis <span className="font-bold">« ➕ Nouveau client… »</span> en haut de la liste Client — sa fiche complète sera créée et validée du même coup.
                    </p>
                    <p className="text-[9px] leading-snug text-amber-700">
                      La tâche restera bloquée hors agenda tant que le dépôt n&apos;est pas payé (ou confirmé manuellement).
                      À la création : la facture de dépôt est créée dans QuickBooks et la
                      demande part aux adresses cochées.
                    </p>
                  </div>
                )}
              </div>

              {/* Garde-fou : dépôt coché SANS montant = création bloquée.
                  Sinon la tâche filerait à l'agenda comme si aucun dépôt
                  n'était exigé (c'est exactement le trou qui permettait de
                  planifier un appel de service non payé). */}
              </>
                </div>
                <div className="shrink-0 border-t border-slate-200 px-4 py-3">
                    {depotRequis && !(parseFloat(depotMontant) > 0) && (
                      <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-700">
                        ⚠️ Choisis un montant de dépôt (liste de prix ou tarif sur mesure) pour pouvoir créer la tâche.
                      </p>
                    )}
                    {/* LE BOUTON GRIS S'EXPLIQUE (règle de la maison) : la
                        liste des raisons s'affiche au lieu de laisser
                        deviner. Un devis TAPÉ À LA MAIN débloque aussi le
                        type « Travaux avec devis » (2026-08-17). */}
                    {(() => {
                      const raisons = [];
                      if (!nouveauTitre.trim()) raisons.push("un titre");
                      // Secteur CCQ : obligatoire, AUCUNE présélection
                      // (2026-08-17) — il fige le taux coûtant de chaque
                      // heure. Sans objet pour course/congé (masqué).
                      if (!estTypeSansClient(nouveauType) && !nouveauSecteur) raisons.push("le secteur (taux CCQ — Commercial ou Résidentiel)");
                      // 🗺️ Zone OBLIGATOIRE pour un appel de service — avec
                      // ou sans dépôt : c'est elle qui dit à la comptabilité
                      // le prix de base et la règle du temps inclus.
                      if (nouveauType === "appel_service" && !zoneAppelChoix) raisons.push("la zone de tarification de l'appel");
                      if (nouveauType === "devis" && !nouveauDevisId && !numeroDevisExistant.trim()) raisons.push("un devis (de la liste, ou un numéro tapé à la main)");
                      if (nouveauType === "entretien_contrat" && !nouveauDevisId && !numeroDevisExistant.trim()) raisons.push("un contrat (de la liste, ou le Nº d'un ancien contrat tapé à la main)");
                      if (depotRequis && !(parseFloat(depotMontant) > 0)) raisons.push("un montant de dépôt");
                      // « Nouveau contact » choisi mais incomplet : on ne
                      // crée pas une tâche avec un contact fantôme.
                      if (contactSurPlaceId === "nouveau" && (!contactNom.trim() || !contactTel.trim()))
                        raisons.push("le nom et le téléphone du nouveau contact sur place");
                      // Choix 💰/🤝 obligatoire pour chaque technicien
                      // supplémentaire coché (2026-08-17) — les SOUS-
                      // TRAITANTS en sont exemptés (2026-08-19) : la
                      // question n'a pas de sens pour eux.
                      nouveauxEmployesEnPlus
                        .filter((id) => id !== nouveauEmployeId && facturablesEnPlus[id] !== true && facturablesEnPlus[id] !== false)
                        .forEach((id) => {
                          const fiche = employes.find((e) => e.id === id);
                          if (fiche?.estSousTraitant) return;
                          raisons.push(`le choix facturable ou non pour ${fiche?.nom || "un technicien ajouté"}`);
                        });
                      return (
                        <>
                          {raisons.length > 0 && (
                            <p className="mb-2 rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500">
                              Pour créer la tâche, il manque : {raisons.join(" · ")}.
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => creerTache(false)}
                              disabled={raisons.length > 0}
                              className="min-h-0 flex-1 py-2.5 text-xs"
                            >
                              Créer la tâche
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tachesAttenteAffichees.map((t) => (
              <div
                key={t.id}
                /* `estBloquee` couvre les DEUX raisons : dépôt impayé ET
                   pièce pas encore reçue. Avec `depotBloque` seul, une
                   tâche en attente de pièce restait glissable vers
                   l'agenda — on aurait envoyé un technicien poser une
                   pièce encore chez le fournisseur. */
                draggable={!lectureSeule && !estBloquee(t)}
                onDragStart={(e) => !lectureSeule && !estBloquee(t) && e.dataTransfer.setData("text/plain", JSON.stringify(t))}
                className={`rounded-xl border border-l-4 bg-white p-3 ${
                  depotDe(t.id)?.statut === "annule_delai"
                    ? "border-red-300 opacity-60"
                    : pieceBloque(t.id)
                    ? "border-sky-400"
                    : depotBloque(t.id)
                    ? "border-amber-300"
                    : "border-slate-200"
                } ${lectureSeule || estBloquee(t) ? "" : "cursor-grab active:cursor-grabbing"}`}
              >
                {/* EN-TÊTE COMPACT (2026-08-18) : une ligne — pastille,
                    titre, chips d'état, chevron. Le clic DÉPLIE ; le ✏️
                    ouvre l'édition rapide ; le glisser-déposer reste sur
                    toute la carte, compacte ou dépliée. */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTacheDepliee(tacheDepliee === t.id ? null : t.id)}
                    className="min-w-0 flex-1 rounded-lg p-1 text-left hover:bg-slate-50"
                    title={tacheDepliee === t.id ? "Replier" : "Voir le détail"}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${(COULEUR_TYPE_TACHE[t.typeTache] || COULEUR_TYPE_DEFAUT).pastille}`} />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{t.titre || t.clientNom}</p>
                      {t.statut === "en_attente_materiel" && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">MATÉRIEL</span>
                      )}
                      {pieceBloque(t.id) && (
                        <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700" title="En attente d'une pièce">🔧</span>
                      )}
                      {depotBloque(t.id) && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Dépôt impayé">🔒</span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`shrink-0 text-slate-300 transition-transform ${tacheDepliee === t.id ? "rotate-180" : ""}`}
                      />
                    </div>
                    {tacheDepliee !== t.id && t.clientNom && t.titre && (
                      <p className="ml-3.5 truncate text-[10px] text-slate-400">{t.clientNom}</p>
                    )}
                  </button>
                  {!lectureSeule && (
                    <button
                      onClick={() => setTacheEnEditionId(t.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-slate-50 hover:text-slate-600"
                      title="Édition rapide (date, heure, durée, technicien)"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
                {tacheDepliee === t.id && (
                <>
                <div className="mt-1">
                {(t.piecesJointes || []).length > 0 && (
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    📎 {t.piecesJointes.length} document{t.piecesJointes.length > 1 ? "s" : ""} joint{t.piecesJointes.length > 1 ? "s" : ""} pour le technicien
                  </p>
                )}
                {/* EN ATTENTE D'UNE PIÈCE — la raison du blocage doit
                    être écrite sur la carte. Une tâche bloquée sans
                    explication pousse à chercher pourquoi, ou pire à
                    la débloquer de force. */}
                {(() => {
                  const pc = (pieces || []).find((x) => x.tacheRetourId === t.id);
                  if (!pc) return null;
                  // PIÈCE ANNULÉE : la tâche reste bloquée ICI jusqu'à ce
                  // qu'un humain tranche — supprimer la tâche, ou la
                  // garder sans pièce (le client a pu changer d'idée).
                  // Avant, l'annulation déverrouillait la tâche : on
                  // risquait de céduler la pose d'une pièce inexistante.
                  if (pc.statut === "annulee") {
                    return (
                      <div className="mt-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-bold leading-snug text-red-700">
                        <p>❌ Pièce ANNULÉE{pc.annuleRaison ? ` — ${pc.annuleRaison}` : ""}</p>
                        <p className="mt-0.5 font-semibold opacity-80">Que faire de cette tâche de retour ?</p>
                        {!lectureSeule && (
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              onClick={() => {
                                setTachesAttente((prev) => prev.filter((x) => x.id !== t.id));
                                ajouterJournal(`🗑️ Tâche de retour supprimée (pièce annulée) — ${t.titre} · ${t.clientNom}.`);
                              }}
                              className="rounded-lg bg-red-600 px-2 py-1 font-extrabold text-white hover:bg-red-700"
                            >
                              Supprimer la tâche
                            </button>
                            <button
                              onClick={() => onDetacherPiece?.(pc.id, t)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-extrabold text-slate-600 hover:bg-slate-50"
                            >
                              Garder (sans pièce)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  const recue = pc.statut === "recue";
                  const attendPaiement = recue && pc.paiementRequis && !pc.paiementRecu;
                  const prevue = pc.dateReceptionPrevue
                    ? new Date(`${pc.dateReceptionPrevue}T00:00:00`).toLocaleDateString(localeDates, { day: "numeric", month: "long" })
                    : null;
                  return (
                    <div
                      className={`mt-1.5 rounded-lg px-2 py-1 text-[10px] font-bold leading-snug ${
                        recue && !attendPaiement
                          ? "bg-emerald-50 text-emerald-700"
                          : pc.enRetard
                            ? "bg-red-50 text-red-700"
                            : "bg-sky-50 text-sky-800"
                      }`}
                    >
                      <p>
                        {attendPaiement
                          ? `💰 Pièce reçue — en attente du PAIEMENT du client`
                          : recue
                          ? `📦 Pièce reçue — planifiable`
                          : pc.statut === "commandee"
                          ? `📦 COMMANDÉE — ${pc.pieceRequise}`
                          : `🔧 À COMMANDER — ${pc.pieceRequise}`}
                      </p>
                      {/* LE DÉTAIL SUIT LA TÂCHE. C'est ici qu'on répond au
                          client qui appelle « elle arrive quand, ma pièce ? »
                          — sans avoir à ouvrir un autre onglet. */}
                      {!recue && (
                        <p className="mt-0.5 font-semibold opacity-80">
                          {pc.fournisseurNom ? `${pc.fournisseurNom}` : "Fournisseur à choisir"}
                          {pc.numeroBc ? ` · ${pc.numeroBc}` : ""}
                          {prevue
                            ? ` · ${pc.enRetard ? "⚠️ attendue le" : "prévue le"} ${prevue}`
                            : pc.statut === "commandee"
                              ? " · aucune date confirmée"
                              : ""}
                          {pc.jours > 0 ? ` · ${pc.jours} jour${pc.jours > 1 ? "s" : ""}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* STATUT DU DÉPÔT */}
                {depotDe(t.id) && (() => {
                  const d = depotDe(t.id);
                  const tD = taxesDepot(d.montantHT, configEnt);
                  if (d.statut === "annule_delai") {
                    return (
                      <p className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                        ⏰ ANNULÉE — dépôt non payé sous 24 h
                      </p>
                    );
                  }
                  if (d.statut === "annule_qb") {
                    // Cas transitoire : le rattrapage de page.jsx retire
                    // la tâche — mais si elle s'affiche une seconde, elle
                    // dit la vérité au lieu de « en attente de dépôt ».
                    return (
                      <p className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                        🚫 ANNULÉE — facture de dépôt annulée dans QuickBooks
                      </p>
                    );
                  }
                  if (d.statut === "paye" || d.statut === "paye_manuellement") {
                    return (
                      <p className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                        💰 DÉPÔT REÇU{d.modePaiement ? ` (${d.modePaiement})` : ""} — planifiable
                      </p>
                    );
                  }
                  const heuresRestantes = Math.max(0, Math.round((new Date(d.dateLimite).getTime() - Date.now()) / 3600000));
                  return (
                    <span className="mt-1 inline-flex flex-wrap items-center gap-1">
                    <p className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                      🔒 EN ATTENTE DE DÉPÔT — {tD.total.toFixed(2)} $ · expire dans ~{heuresRestantes} h
                    </p>
                    {/* 📧 RENVOYER LA DEMANDE (2026-08-29 — « le client ne
                        l a pas recue ») : la MEME facture QuickBooks repart
                        (jamais une nouvelle — route /send par identifiant). */}
                    {d.qboInvoiceId && (
                      <button
                        onClick={() => ouvrirRenvoiDepot(t, d)}
                        title="Renvoie la meme facture de depot par QuickBooks — choisis ou corrige le courriel avant l'envoi"
                        className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[9px] font-bold text-amber-800 active:scale-95"
                      >
                        📧 Renvoyer la demande
                      </button>
                    )}
                    </span>
                  );
                })()}
                {/* TECHNICIEN RÉSERVÉ D'AVANCE (choisi à la création,
                    en attendant le paiement du dépôt) */}
                {t.technicienPrevu && (
                  <p className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                    👤 Technicien prévu : {employes.find((e) => e.id === t.technicienPrevu)?.nom || "?"}
                    {t.datePrevue ? ` · le ${t.datePrevue} à ${t.heurePrevue || "07:00"}` : ""}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.typeTache === "entretien_contrat" ? (
                    <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                      CONTRAT #{t.devisNumero} — {t.frequenceFacturationAnnuelle}×/an
                    </span>
                  ) : (
                    t.devisNumero && (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                        DEVIS #{t.devisNumero}
                      </span>
                    )
                  )}
                  {t.projetId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                      <Briefcase size={9} /> {(projets || []).find((p) => p.id === t.projetId)?.nom || "Projet"}
                    </span>
                  )}
                </div>
                {t.adresseTravaux && (
                  <div className="mt-1 flex items-start gap-1 text-[10px] text-slate-500">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span>Travaux : {t.adresseTravaux}</span>
                  </div>
                )}
                <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{t.description}</p>
                </div>

                {/* ✍️ CHAMPS ÉDITABLES DANS UNE CARTE GLISSABLE (2026-09-03,
                    vécu par le propriétaire) : deux misères réglées ici.
                    (1) Sélectionner le texte à la souris DÉPLAÇAIT toute la
                    carte (elle est draggable) — chaque champ se déclare
                    draggable et ANNULE son drag : la sélection reste au
                    champ, la carte ne bouge plus. (2) Impossible de VIDER
                    le champ pour taper une nouvelle valeur (le champ
                    contrôlé retombait à 1 dès « » ) — InputNombreDecimal
                    garde le texte tapé pendant la frappe et se remet
                    d'aplomb en quittant le champ. */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heures / jour</label>
                    <InputNombreDecimal
                      valeur={t.heures ?? 1}
                      onChange={(val) => majDureeTache(t.id, { heures: Math.max(0, Math.min(Math.round(val), HEURES.length)) })}
                      draggable
                      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nombre de jours</label>
                    <InputNombreDecimal
                      valeur={t.jours ?? 1}
                      onChange={(val) => majDureeTache(t.id, { jours: Math.max(0, Math.round(val)) })}
                      draggable
                      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs tabular-nums"
                    />
                  </div>
                </div>

                {(t.jours ?? 1) >= 1 && (
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                    <Lock size={10} /> Bloque la journée complète de chaque technicien assigné
                  </p>
                )}

                {(t.jours ?? 1) > 1 && (
                  <label className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={!!t.sauterWeekend}
                      onChange={(e) => majDureeTache(t.id, { sauterWeekend: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    Sauter les samedis et dimanches
                  </label>
                )}
                {configEnt?.calendrierCcq === true && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={!!t.sauterFeries}
                      onChange={(e) => majDureeTache(t.id, { sauterFeries: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[#FF6A13]"
                    />
                    Sauter les jours fériés (calendrier CCQ)
                  </label>
                )}

                {/* DÉBLOCAGE MANUEL DU DÉPÔT (admin) */}
                {!lectureSeule && depotDe(t.id)?.statut === "en_attente_paiement" && (
                  <Button
                    onClick={() => { setDepotModal({ tacheId: t.id, titre: t.titre || t.clientNom }); setDepotMode("Comptant"); }}
                    className="mt-2 w-full min-h-0 py-1.5 text-xs"
                  >
                    💰 Dépôt reçu manuellement…
                  </Button>
                )}
                {/* DÉPÔT PAYÉ + TECHNICIEN/DATE RÉSERVÉS D'AVANCE :
                    placement à l'horaire en un seul clic. */}
                {!lectureSeule &&
                  t.technicienPrevu &&
                  t.datePrevue &&
                  ["paye", "paye_manuellement"].includes(depotDe(t.id)?.statut) && (
                    <Button
                      onClick={() => {
                        assigner(t, t.technicienPrevu, new Date(`${t.datePrevue}T00:00:00`), t.heurePrevue || "07:00");
                        // Affiche tout de suite le jour où la tâche vient
                        // d'être placée — sinon l'agenda reste sur
                        // aujourd'hui et la tâche semble avoir disparu.
                        setJourAffiche(new Date(`${t.datePrevue}T00:00:00`));
                      }}
                      className="mt-2 w-full min-h-0 py-1.5 text-xs"
                    >
                      📅 Placer à l'horaire — {employes.find((e) => e.id === t.technicienPrevu)?.nom || "technicien prévu"} le {t.datePrevue}
                    </Button>
                  )}
                {!lectureSeule &&
                  t.technicienPrevu &&
                  !t.datePrevue &&
                  ["paye", "paye_manuellement"].includes(depotDe(t.id)?.statut) && (
                    <p className="mt-2 text-[10px] font-semibold text-emerald-700">
                      💰 Dépôt reçu — glisse la tâche sur la ligne de {employes.find((e) => e.id === t.technicienPrevu)?.nom || "son technicien"} dans l'agenda.
                    </p>
                  )}
                {/* RELANCE APRÈS ANNULATION — le client a rappelé : nouveau
                    dépôt, nouveau délai de 24 h. L'ancienne facture QBO est
                    annulée par VOID (jamais Delete — règle gelée), une
                    NOUVELLE facture et un nouveau courriel partent. */}
                {!lectureSeule && depotDe(t.id)?.statut === "annule_delai" && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const d = depotDe(t.id);
                      if (d?.qboInvoiceId) {
                        const rv = await annulerFactureDepot(d.qboInvoiceId);
                        ajouterJournal(
                          rv?.annulee
                            ? `🧾 Ancienne facture de dépôt${d.qboDocNumber ? ` Nº ${d.qboDocNumber}` : ""} annulée par VOID`
                            : `⚠️ VOID de l'ancienne facture refusé (${rv?.erreur || "?"}) — vérifie dans QuickBooks`
                        );
                      }
                      const fiche = clients.find((c) => c.id === t.clientId);
                      const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
                      const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
                      onCreerDepot?.(t.id, {
                        montantHT: d.montantHT,
                        isProspect: d.isProspect,
                        prospect: d.isProspect
                          ? { nom: d.prospectNom, courriel: d.prospectCourriel, telephone: d.prospectTelephone, adresse: d.prospectAdresse }
                          : null,
                        clientId: t.clientId || null,
                        clientNom: t.clientNom || fiche?.nom || "",
                        zone: t.zoneAppel === "hors_zone" ? "hors zone" : t.zoneAppel,
                        joursLimite: 1,
                        courriels: defauts.length > 0 ? defauts : tous.slice(0, 1),
                        // La relance porte aussi l'objet de la visite.
                        titre: t.titre || "",
                        descriptionTravaux: t.description || "",
                      });
                      ajouterJournal(`🔄 Dépôt relancé pour « ${t.titre || t.clientNom} » — nouveau délai de 24 h`);
                    }}
                    className="mt-2 w-full min-h-0 py-1.5 text-xs"
                  >
                    🔄 Relancer le dépôt (nouveau 24 h)
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() =>
                    setAssignationMobile(
                      assignationMobile?.tacheId === t.id
                        ? null
                        : {
                            tacheId: t.id,
                            // Le technicien, la date et l'heure PRÉVUS à la
                            // création pré-remplissent — plus de 07:00 forcé.
                            employeId: (t.technicienPrevu && employes.some((e) => e.id === t.technicienPrevu) ? t.technicienPrevu : employes[0].id),
                            heure: t.heurePrevue || HEURE_PAR_DEFAUT,
                            date: t.datePrevue || jourKey,
                          }
                    )
                  }
                  className="mt-2 w-full min-h-0 py-1.5 text-xs lg:hidden"
                >
                  Assigner
                </Button>

                {assignationMobile?.tacheId === t.id && (
                  <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 lg:hidden">
                    <select
                      value={assignationMobile.employeId}
                      onChange={(e) => setAssignationMobile({ ...assignationMobile, employeId: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
                    </select>
                    {vue === "jour" ? (
                      <select
                        value={assignationMobile.heure}
                        onChange={(e) => setAssignationMobile({ ...assignationMobile, heure: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    ) : (
                      <input
                        type="date"
                        value={assignationMobile.date}
                        onChange={(e) => setAssignationMobile({ ...assignationMobile, date: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    )}
                    <Button
                      onClick={() => {
                        if (vue === "jour") assigner(t, assignationMobile.employeId, jourAffiche, assignationMobile.heure);
                        // `T00:00:00` force l'interprétation en heure LOCALE :
                        // sans lui, "AAAA-MM-JJ" est lu en UTC et la tâche
                        // atterrirait la veille au Québec.
                        else assigner(t, assignationMobile.employeId, new Date(`${assignationMobile.date}T00:00:00`), HEURE_PAR_DEFAUT);
                        setAssignationMobile(null);
                      }}
                      className="w-full min-h-0 py-1.5 text-xs"
                    >
                      Confirmer l'assignation
                    </Button>
                  </div>
                )}
                </>
                )}
              </div>
            ))}
            {tachesAttenteAffichees.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                {tachesAttente.length === 0
                  ? "Aucune tâche en attente. Les devis acceptés apparaissent ici."
                  : ongletAttente === "bloquees"
                  ? "Aucune tâche bloquée par un dépôt — dès qu'un dépôt est payé, sa tâche passe dans « ✅ Prêtes »."
                  : ongletAttente === "pieces"
                  ? "Aucune pièce en commande. Quand un technicien coche « pièce à commander » sur un appel de service, le retour se range ici jusqu'à la réception."
                  : "Aucune tâche prête — regarde les onglets « 🔒 Dépôt » et « 🔧 Pièces »."}
              </p>
            )}
          </div>
          <p className="mt-3 hidden text-[11px] text-slate-400 lg:block">
            {tr("Glisse une tâche vers une case du calendrier pour l'assigner.")}
          </p>
        </div>

        {/* 📱 VUE LISTE — TÉLÉPHONE (2026-08-21, séance mobile)
            ------------------------------------------------------------
            La grille de 24 colonnes demande 640 px de large : sur un
            téléphone, c'est du défilement horizontal à l'aveugle. Même
            journée, mêmes données, présentée en LISTE par personne et
            dans l'ordre réel. Un tap ouvre la même fiche de tâche que
            sur l'ordinateur (elle est déjà pensée plein écran).

            2026-08-22 — RETOUR À LA LISTE DÉPLIÉE, après essai sur le
            terrain. On avait tenté des cartes repliées (un tap sur le
            nom pour ouvrir les tâches) : ça tenait dans un écran, mais
            ça se lisait moins bien. Le propriétaire préfère TOUT voir
            d'un seul défilement, sans geste à faire. Seule la bande du
            haut est conservée de cet essai — elle ne cache rien et
            répond à « combien de monde travaille aujourd'hui » pendant
            qu'on descend dans la liste. */}
        <div className={`${modeAgendaMobile === "grille" ? "hidden" : "flex-1 overflow-y-auto"} md:hidden`}>
          {vue !== "jour" && (
            <p className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-800">
              La vue {vue === "semaine" ? "Semaine" : "Mois"} ne se met pas en liste — seule la vue{" "}
              <span className="font-bold">Jour</span> le fait. Passe à <span className="font-bold">▦ Grille</span> pour
              la voir sur ton téléphone.
            </p>
          )}
          {(() => {
            // Un seul passage : on prépare les tâches de chacun, puis on
            // affiche. La bande du haut a besoin des mêmes comptes que
            // les rangées — inutile de balayer le planning deux fois.
            const fiches = rangeesAgenda.map((emp) => {
              if (emp.enteteSection) return { emp, entete: true };
              const entrees = tachesDuJourAvecHeure(planning, jourKey, emp.id).filter(
                (e) => !e.tache.est_tache_systeme
              );
              return { emp, entrees };
            });
            const occupes = fiches.filter((f) => !f.entete && f.entrees.length > 0).length;
            const libres = fiches.filter((f) => !f.entete && f.entrees.length === 0).length;
            return (
              <>
                {/* BANDEAU D'ÉTAT — une seule ligne collée en haut : elle
                    ne replie rien, ne demande aucun geste, et répond à
                    « combien de monde travaille aujourd'hui » pendant
                    qu'on descend dans la liste. */}
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    👷 {occupes} sur le terrain
                    {libres > 0 && (
                      <span className="font-semibold text-slate-400">
                        {" "}· {libres} libre{libres > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </div>

                {fiches.map((f) => {
                  if (f.entete) return renderEnteteSection(f.emp.enteteSection);
                  const { emp, entrees } = f;
                  return (
                    <div key={emp.id} className="border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5">
                        <span className="truncate text-xs font-extrabold text-slate-700">
                          {emp.estSousTraitant ? "🤝 " : ""}{emp.nom}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-slate-400">
                          {entrees.length === 0 ? "libre" : `${entrees.length} tâche${entrees.length > 1 ? "s" : ""}`}
                        </span>
                      </div>
                      {entrees.length > 0 && (
                        <div className="space-y-1.5 p-2">
                          {entrees.map(({ tache, heure }) => {
                            const reel = (travaux || []).find(
                              (x) =>
                                x.supabase &&
                                cleTacheDesHeures(x.tacheId) === tache.id &&
                                (x.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                                x.date === jourKey &&
                                x.debutReel &&
                                x.finReelle
                            );
                            const couleur = COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT;
                            return (
                              <button
                                key={tache.id}
                                onClick={() =>
                                  !lectureSeule &&
                                  (emp.estSousTraitant
                                    ? setModalStatutST({ tache, employe: emp, date: jourKey })
                                    : setTacheDetailOuverte({ tache, employe: emp, date: jourKey, heure }))
                                }
                                className={`block w-full rounded-xl border-l-4 p-2.5 text-left ${
                                  emp.estSousTraitant
                                    ? ST_COULEURS[statutBlocST(tache.id, emp.courriel)][0]
                                    : estTerminee(tache, emp)
                                      ? "border-emerald-500 bg-emerald-50"
                                      : estEnCours(tache, emp)
                                        ? "border-fuchsia-500 bg-fuchsia-50"
                                        : `bg-white ${couleur.bordurePastille}`
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold tabular-nums text-slate-500">{heure}</span>
                                  {emp.estSousTraitant ? (
                                    <span className="text-[10px]">{ST_ICONES[statutBlocST(tache.id, emp.courriel)]}</span>
                                  ) : estTerminee(tache, emp) ? (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">TERMINÉ</span>
                                  ) : estEnCours(tache, emp) ? (
                                    <span className="rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-700">EN COURS</span>
                                  ) : null}
                                  {reel && (
                                    <span className="ml-auto text-[10px] font-bold tabular-nums text-emerald-800">
                                      {heureLocaleHHMM(reel.debutReel)} → {heureLocaleHHMM(reel.finReelle)} · {(Number(reel.heures) || 0).toFixed(2)} h
                                    </span>
                                  )}
                                </span>
                                <span className="mt-1 block text-sm font-bold leading-snug text-slate-900">
                                  {tache.titre || tache.clientNom}
                                </span>
                                {tache.clientNom && tache.titre && (
                                  <span className="block text-[11px] text-slate-500">{tache.clientNom}</span>
                                )}
                                {(tache.adresseTravaux || tache.adresseIntervention) && (
                                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                    📍 {tache.adresseTravaux || tache.adresseIntervention}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* MODE GRILLE SUR TÉLÉPHONE — on dit tout de suite ce qui
            marche et ce qui ne marche pas. Le glisser-déposer utilise
            des événements de SOURIS que le doigt n'envoie pas : plutôt
            que de laisser quelqu'un s'acharner sur un bloc qui ne
            bouge pas, on nomme la limite et on donne le chemin qui
            fonctionne. */}
        {modeAgendaMobile === "grille" && (
          <p className="border-y border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] leading-snug text-slate-500 md:hidden">
            Glisse de côté pour parcourir la journée — la colonne des noms reste en place. Déplacer une tâche au doigt
            n&apos;est pas possible : tape le bloc et change la date ou le technicien dans sa fiche.
          </p>
        )}

        {/* GRILLE CALENDRIER — un technicien par rangée. Toujours au
            bureau ; sur le téléphone, seulement si « ▦ Grille » est
            choisi (elle se parcourt alors en glissant de côté, la
            colonne des noms reste collée à gauche). */}
        <div
          ref={grilleScrollRef}
          className={`${modeAgendaMobile === "grille" ? "block" : "hidden"} flex-1 overflow-x-auto md:block`}
        >
          {vue === "jour" ? (
            <div className="min-w-[640px]">
              <div className="grid" style={{ gridTemplateColumns: `120px repeat(${HEURES.length}, minmax(52px, 1fr))` }}>
                <div className="sticky left-0 z-10 bg-white" />
                {HEURES.map((h) => (
                  <div key={h} className="border-b border-slate-200 px-1 py-2 text-center text-[10px] font-semibold text-slate-400 tabular-nums">{h}</div>
                ))}
              </div>
              {rangeesAgenda.map((emp) => {
                if (emp.enteteSection) return renderEnteteSection(emp.enteteSection);
                // SEGMENTS : une entrée par tâche (id unique) de la journée,
                // avec sa case de départ (index) et sa durée (span) — les
                // cases contiennent maintenant des LISTES de tâches, donc
                // plusieurs segments peuvent se chevaucher.
                const segments = [];
                const parId = new Map();
                for (let i = 0; i < HEURES.length; i++) {
                  listeCellule(planning[`${jourKey}|${emp.id}|${HEURES[i]}`]).forEach((t) => {
                    const seg = parId.get(t.id);
                    if (seg) {
                      seg.fin = i;
                      seg.span = i - seg.index + 1;
                    } else {
                      const nouveau = { tache: t, index: i, fin: i, span: 1 };
                      parId.set(t.id, nouveau);
                      segments.push(nouveau);
                    }
                  });
                }
                // ⏱️ HEURES RÉELLES (2026-08-19, demande du propriétaire) :
                // une tâche TERMINÉE se replace sur la grille selon son
                // VRAI début/fin chronométrés — avant, trois tâches
                // planifiées à la même heure restaient empilées l'une sur
                // l'autre alors que la journée s'était déroulée en
                // séquence (7 h, 9 h, 13 h…).
                segments.forEach((seg) => {
                  if (seg.tache.est_tache_systeme) return;
                  const reel = (travaux || []).find(
                    (t) =>
                      t.supabase &&
                      cleTacheDesHeures(t.tacheId) === seg.tache.id &&
                      (t.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                      t.date === jourKey &&
                      t.debutReel &&
                      t.finReelle
                  );
                  if (!reel) return;
                  const d = new Date(reel.debutReel);
                  const f = new Date(new Date(reel.finReelle).getTime() - 60000);
                  const iDeb = Math.max(0, Math.min(HEURES.length - 1, d.getHours()));
                  const iFin = Math.max(iDeb, Math.min(HEURES.length - 1, f.getHours()));
                  seg.index = iDeb;
                  seg.fin = iFin;
                  seg.span = iFin - iDeb + 1;
                  // Conservé sur le segment : l'étiquette du bloc affiche
                  // les heures RÉELLES (début → fin · total pointé).
                  seg.reel = reel;
                });
                // 🚚 LES TRANSPORTS SYSTÈME SUIVENT LE MOUVEMENT (retour
                // de tests 2026-08-19) : une tâche replacée à son vrai
                // départ passait PAR-DESSUS le « Début de journée » resté
                // à l'heure planifiée — les deux blocs s'empilaient.
                // Début = la case juste AVANT la première vraie tâche
                // affichée ; Fin = juste APRÈS la dernière.
                {
                  const reelsAffiches = segments.filter((s) => !s.tache.est_tache_systeme);
                  if (reelsAffiches.length > 0) {
                    const premier = Math.min(...reelsAffiches.map((s) => s.index));
                    const dernier = Math.max(...reelsAffiches.map((s) => s.fin));
                    segments.forEach((seg) => {
                      if (!seg.tache.est_tache_systeme) return;
                      if (seg.tache.momentTransport === "debut") {
                        seg.index = Math.max(0, premier - 1);
                        seg.fin = seg.index;
                        seg.span = 1;
                      } else if (seg.tache.momentTransport === "fin") {
                        seg.index = Math.min(HEURES.length - 1, dernier + 1);
                        seg.fin = seg.index;
                        seg.span = 1;
                      }
                    });
                  }
                }
                // PISTES : les tâches qui se chevauchent s'empilent — chaque
                // segment prend la première piste libre. La rangée s'étire
                // en hauteur selon le nombre de pistes : AUCUNE tâche ne
                // peut être cachée, peu importe combien partagent la plage.
                const finsParPiste = [];
                segments.sort((a, b) => a.index - b.index || b.span - a.span);
                segments.forEach((seg) => {
                  let p = finsParPiste.findIndex((fin) => fin < seg.index);
                  if (p === -1) {
                    p = finsParPiste.length;
                    finsParPiste.push(seg.fin);
                  } else {
                    finsParPiste[p] = Math.max(finsParPiste[p], seg.fin);
                  }
                  seg.piste = p;
                });
                const nbPistes = Math.max(1, finsParPiste.length);

                return (
                  <div
                    key={emp.id}
                    className="grid border-t border-slate-100"
                    style={{
                      gridTemplateColumns: `120px repeat(${HEURES.length}, minmax(52px, 1fr))`,
                      gridTemplateRows: `repeat(${nbPistes}, minmax(52px, auto))`,
                    }}
                  >
                    <div
                      style={{ gridColumn: "1", gridRow: `1 / ${nbPistes + 1}` }}
                      className="sticky left-0 z-10 flex items-center border-r border-slate-100 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                    >
                      {emp.nom}
                    </div>
                    {/* CASES DE FOND — cibles de dépôt pleine hauteur, toujours
                        présentes même sous les blocs. */}
                    {HEURES.map((h, index) => {
                      const cle = `${jourKey}|${emp.id}|${h}`;
                      return (
                        <div
                          key={h}
                          data-heure-index={index}
                          data-emp={emp.id}
                          style={{ gridColumn: `${index + 2}`, gridRow: `1 / ${nbPistes + 1}` }}
                          onDragOver={(ev) => { ev.preventDefault(); setTacheSurvolee(cle); }}
                          onDragLeave={() => setTacheSurvolee(null)}
                          onDrop={(ev) => { onDropHeure(ev, emp.id, h); setTacheSurvolee(null); }}
                          className={`border-l border-slate-100 ${tacheSurvolee === cle ? "bg-orange-50" : ""}`}
                        />
                      );
                    })}
                    {/* BLOCS DE TÂCHES — par-dessus les cases, un par segment,
                        chacun sur SA piste. */}
                    {segments.map((seg) => {
                      const h = HEURES[seg.index];
                      const enRedimensionnement =
                        redim && redim.tache.id === seg.tache.id && redim.employeId === emp.id && redim.jourCible === jourKey;
                      const spanAffiche = enRedimensionnement ? redim.spanActuel : seg.span;
                      // Par la poignée de GAUCHE, la colonne de départ bouge aussi.
                      const indexAffiche =
                        enRedimensionnement && redim.indexActuel != null ? redim.indexActuel : seg.index;
                      const peutRedimensionner = !lectureSeule && !seg.tache.est_tache_systeme && (seg.tache.jours ?? 0) < 1; // ni journée complète, ni tâche système, ni lecture seule
                      return (
                        <div
                          key={seg.tache.id}
                          style={{ gridColumn: `${indexAffiche + 2} / span ${spanAffiche}`, gridRow: `${seg.piste + 1}` }}
                          onMouseMove={(e) => setSurvol({ tache: seg.tache, employe: emp, heure: h, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setSurvol(null)}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            // Dépôt PAR-DESSUS un bloc existant : la tâche
                            // déposée s'empile sur la case horaire visée
                            // (calculée depuis la position de la souris).
                            const rect = ev.currentTarget.getBoundingClientRect();
                            const largeurCase = rect.width / spanAffiche;
                            const idx = Math.min(
                              HEURES.length - 1,
                              seg.index + Math.max(0, Math.floor((ev.clientX - rect.left) / largeurCase))
                            );
                            onDropHeure(ev, emp.id, HEURES[idx]);
                            setTacheSurvolee(null);
                          }}
                          className={`relative z-[1] m-0.5 rounded-lg border-l-4 p-0.5 ${emp.estSousTraitant ? ST_COULEURS[statutBlocST(seg.tache.id, emp.courriel)][0] : estTerminee(seg.tache, emp) ? "border-emerald-500 bg-emerald-50" : estEnCours(seg.tache, emp) ? "border-fuchsia-500 bg-fuchsia-50" : seg.tache.est_tache_systeme ? "border-slate-400 bg-slate-100" : `${(COULEUR_TYPE_TACHE[seg.tache.typeTache] || COULEUR_TYPE_DEFAUT).clair} ${(COULEUR_TYPE_TACHE[seg.tache.typeTache] || COULEUR_TYPE_DEFAUT).bordurePastille}`}`}
                        >
                          {/* 🖱️ Clic simple = ouvrir la fiche ; clic
                              maintenu + déplacement = déplacer le bloc
                              (autre heure, autre technicien). */}
                          <button
                            draggable={!lectureSeule && !seg.tache.est_tache_systeme}
                            onDragStart={(ev) => {
                              ev.dataTransfer.setData(
                                "text/plain",
                                JSON.stringify({ deplacement: true, tacheId: seg.tache.id, employeId: emp.id })
                              );
                              ev.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => !redim && !lectureSeule && !seg.tache.est_tache_systeme && (emp.estSousTraitant ? setModalStatutST({ tache: seg.tache, employe: emp, date: jourKey }) : setTacheDetailOuverte({ tache: seg.tache, employe: emp, date: jourKey, heure: h }))}
                            className={`flex h-full w-full items-start gap-1 rounded-lg p-1 text-left text-[9px] font-semibold leading-tight ${
                              emp.estSousTraitant
                                ? ST_COULEURS[statutBlocST(seg.tache.id, emp.courriel)][1]
                                : estTerminee(seg.tache, emp)
                                ? "bg-emerald-100 text-emerald-900"
                                : estEnCours(seg.tache, emp)
                                ? "bg-fuchsia-100 text-fuchsia-900"
                                : seg.tache.est_tache_systeme
                                ? "bg-slate-200 text-slate-600"
                                : `text-black ${(COULEUR_TYPE_TACHE[seg.tache.typeTache] || COULEUR_TYPE_DEFAUT).fond}`
                            } ${enRedimensionnement ? "ring-2 ring-[#FF6A13]" : ""}`}
                          >
                            {emp.estSousTraitant && (
                              <span className="mt-px shrink-0 text-[9px]">
                                {ST_ICONES[statutBlocST(seg.tache.id, emp.courriel)]}
                                {stAConfirmer(seg.tache.id, emp.courriel, jourKey) && (
                                  <span className="ml-1 animate-pulse rounded bg-amber-200 px-1 text-[8px] font-extrabold text-amber-800">à confirmer</span>
                                )}
                              </span>
                            )}
                            {!emp.estSousTraitant && estTerminee(seg.tache, emp) && <Check size={10} className="mt-px shrink-0 text-emerald-600" />}
                            {!emp.estSousTraitant && estEnCours(seg.tache, emp) && <span className="mt-0.5 block h-2 w-2 shrink-0 animate-pulse rounded-full bg-fuchsia-500" />}
                            {seg.tache.est_tache_systeme && <Car size={10} className="mt-px shrink-0" />}
                            <span className="min-w-0">
                              {seg.tache.titre || seg.tache.clientNom}
                              {/* ⏱️ Tâche TERMINÉE : les heures RÉELLES
                                  chronométrées remplacent la durée
                                  planifiée — début → fin · total pointé
                                  (demande du propriétaire, 2026-08-19). */}
                              {seg.reel && seg.reel.debutReel && seg.reel.finReelle ? (
                                <span className="ml-1 font-bold text-emerald-800">
                                  · {heureLocaleHHMM(seg.reel.debutReel)} → {heureLocaleHHMM(seg.reel.finReelle)} · {(Number(seg.reel.heures) || 0).toFixed(2)} h
                                </span>
                              ) : (
                                spanAffiche > 1 && <span className="ml-1 opacity-60">· {spanAffiche} h</span>
                              )}
                              {seg.tache.description && spanAffiche >= 2 && (
                                <span className="mt-0.5 line-clamp-2 text-[8px] font-normal leading-tight opacity-75">
                                  {seg.tache.description}
                                </span>
                              )}
                              {travailTermine(seg.tache, emp)?.noteTerrain && spanAffiche >= 2 && (
                                <span className="mt-0.5 line-clamp-2 text-[8px] font-normal italic leading-tight text-emerald-800">
                                  📝 Note du technicien : {travailTermine(seg.tache, emp).noteTerrain}
                                </span>
                              )}
                            </span>
                          </button>
                          {peutRedimensionner && (() => {
                            // Les DEUX poignées partagent la même mesure du bloc.
                            const attraper = (cote) => (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              // Mesure RÉELLE du bloc à l'écran : la durée suit
                              // ensuite la distance parcourue par la souris.
                              const rect = e.currentTarget.parentElement.getBoundingClientRect();
                              setRedim({
                                cote,
                                tache: seg.tache,
                                employeId: emp.id,
                                jourCible: jourKey,
                                heureDebut: h,
                                indexDebut: seg.index,
                                indexActuel: seg.index,
                                spanInitial: seg.span,
                                spanActuel: seg.span,
                                origineX: rect.left,
                                finX: rect.right,
                                largeurCase: rect.width / seg.span,
                              });
                            };
                            return (
                              <>
                                {/* ⬅️ Poignée GAUCHE : recule ou avance l'HEURE DE
                                    DÉBUT, la fin reste où elle est. */}
                                <div
                                  onPointerDown={attraper("gauche")}
                                  title="Glisser pour changer l'heure de début"
                                  className="absolute left-0 top-0 h-full w-2.5 cursor-ew-resize touch-none rounded-l-lg hover:bg-black/10"
                                />
                                {/* ➡️ Poignée DROITE : change la durée, le début reste. */}
                                <div
                                  onPointerDown={attraper("droite")}
                                  title="Glisser pour changer la durée"
                                  className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize touch-none rounded-r-lg hover:bg-black/10"
                                />
                              </>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={vue === "mois" ? "min-w-[900px]" : "min-w-[640px]"}>
              <div className="grid" style={{ gridTemplateColumns: `120px repeat(${joursAffiches.length}, minmax(${vue === "mois" ? 34 : 84}px, 1fr))` }}>
                <div className="sticky left-0 z-10 bg-white" />
                {joursAffiches.map((d) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  // 📅 Jour marqué CCQ : l'en-tête l'annonce (couleur +
                  // infobulle) pour qu'on ne cédule pas dessus par erreur.
                  const marque = configEnt?.calendrierCcq === true ? marqueurCcq(dateISO(d)) : null;
                  return (
                    <div
                      key={dateISO(d)}
                      title={marque?.nom || undefined}
                      className={`border-b border-slate-200 px-1 py-2 text-center text-[10px] font-semibold tabular-nums ${
                        marque?.type === "ferie" ? "bg-amber-50 text-amber-600" : marque?.type === "vacances" ? "bg-slate-100 text-slate-400" : weekend ? "text-orange-400" : "text-slate-400"
                      }`}
                    >
                      {vue === "semaine" ? d.toLocaleDateString(localeDates, { weekday: "short" }) : ""}
                      <div>{marque ? `${marque.type === "ferie" ? "🎌" : "🏖️"}${d.getDate()}` : d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {rangeesAgenda.map((emp) => {
                if (emp.enteteSection) return renderEnteteSection(emp.enteteSection);
                return (
                <div key={emp.id} className="grid border-t border-slate-100" style={{ gridTemplateColumns: `120px repeat(${joursAffiches.length}, minmax(${vue === "mois" ? 34 : 84}px, 1fr))` }}>
                  <div className="sticky left-0 z-10 flex items-center border-r border-slate-100 bg-white px-2 py-2 text-xs font-bold text-slate-700">{emp.nom}</div>
                  {joursAffiches.map((d) => {
                    const cleSurvol = `${dateISO(d)}|${emp.id}|jour`;
                    // TOUTES les tâches du jour — empilées verticalement en
                    // vue Semaine, pastilles côte à côte en vue Mois : aucune
                    // tâche n'est cachée quand elles partagent la journée.
                    // ⏱️ ORDRE CHRONOLOGIQUE RÉEL dans la pile du jour.
                    // ------------------------------------------------
                    // Corrigé le 2026-08-22 (photo du propriétaire : le
                    // « Transport — Début de journée » se retrouvait SOUS
                    // la tâche de Dominic). Le tri se faisait sur
                    // `tache.heure`, un champ que SEULS les blocs de
                    // transport portent : les vraies tâches, sans heure,
                    // remontaient toutes en tête et les deux transports
                    // tombaient au fond, dans l'ordre début-puis-fin.
                    // On prend maintenant l'heure de la CASE (celle de la
                    // grille, qui existe pour tout le monde), remplacée
                    // par l'heure RÉELLE quand la tâche a été pointée —
                    // tout le monde sur le même axe de temps.
                    const entreesJour = tachesDuJourAvecHeure(planning, dateISO(d), emp.id);
                    const minutesDe = ({ tache, heure }) => {
                      const r = (travaux || []).find(
                        (x) =>
                          x.supabase &&
                          cleTacheDesHeures(x.tacheId) === tache.id &&
                          (x.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                          x.date === dateISO(d) &&
                          x.debutReel
                      );
                      if (r) {
                        const dte = new Date(r.debutReel);
                        return dte.getHours() * 60 + dte.getMinutes();
                      }
                      const [hh, mm] = String(heure || "00:00").split(":");
                      return (Number(hh) || 0) * 60 + (Number(mm) || 0);
                    };
                    entreesJour.sort((a, b) => minutesDe(a) - minutesDe(b));
                    const tachesJour = entreesJour.map((e) => e.tache);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    // 📅 Case vide d'un jour CCQ : teintée comme les fins
                    // de semaine — le vide se lit « congé », pas « libre ».
                    const marqueCase = configEnt?.calendrierCcq === true ? marqueurCcq(dateISO(d)) : null;
                    return (
                      <div
                        key={dateISO(d)}
                        title={marqueCase?.nom || undefined}
                        onDragOver={(ev) => { ev.preventDefault(); setTacheSurvolee(cleSurvol); }}
                        onDragLeave={() => setTacheSurvolee(null)}
                        onDrop={(ev) => { onDropJour(ev, emp.id, d); setTacheSurvolee(null); }}
                        onMouseLeave={() => setSurvol(null)}
                        className={`min-h-[44px] border-l border-slate-100 p-1 ${
                          tacheSurvolee === cleSurvol
                            ? "bg-orange-50"
                            : tachesJour.length === 0 && marqueCase
                              ? marqueCase.type === "ferie" ? "bg-amber-50" : "bg-slate-100"
                              : tachesJour.length === 0 && weekend ? "bg-slate-50" : ""
                        } ${vue === "mois" ? "flex flex-wrap content-center items-center justify-center gap-0.5" : "space-y-0.5"}`}
                      >
                        {tachesJour.map((tache) =>
                          vue === "mois" ? (
                            <button
                              key={tache.id}
                              onClick={() => !lectureSeule && !tache.est_tache_systeme && (emp.estSousTraitant ? setModalStatutST({ tache, employe: emp, date: dateISO(d) }) : setTacheDetailOuverte({ tache, employe: emp, date: dateISO(d), heure: entreesJour.find((x) => x.tache.id === tache.id)?.heure || HEURE_PAR_DEFAUT }))}
                              onMouseMove={(e) => setSurvol({ tache, employe: emp, heure: HEURE_PAR_DEFAUT, x: e.clientX, y: e.clientY })}
                              className="p-0.5"
                            >
                              <span className={`block h-2 w-2 rounded-full ${emp.estSousTraitant ? ST_COULEURS[statutBlocST(tache.id, emp.courriel)][2] : estTerminee(tache, emp) ? "bg-emerald-500" : estEnCours(tache, emp) ? "animate-pulse bg-fuchsia-500" : tache.est_tache_systeme ? "bg-slate-400" : (COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT).pastille}`} />
                            </button>
                          ) : (
                            <button
                              key={tache.id}
                              draggable={!lectureSeule && !tache.est_tache_systeme}
                              onDragStart={(ev) => {
                                ev.dataTransfer.setData(
                                  "text/plain",
                                  JSON.stringify({ deplacement: true, tacheId: tache.id, employeId: emp.id })
                                );
                                ev.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => !lectureSeule && !tache.est_tache_systeme && (emp.estSousTraitant ? setModalStatutST({ tache, employe: emp, date: dateISO(d) }) : setTacheDetailOuverte({ tache, employe: emp, date: dateISO(d), heure: entreesJour.find((x) => x.tache.id === tache.id)?.heure || HEURE_PAR_DEFAUT }))}
                              onMouseMove={(e) => setSurvol({ tache, employe: emp, heure: HEURE_PAR_DEFAUT, x: e.clientX, y: e.clientY })}
                              className={`block w-full rounded-lg border-l-4 p-1 text-left text-[9px] font-semibold leading-tight ${
                                emp.estSousTraitant
                                  ? `${ST_COULEURS[statutBlocST(tache.id, emp.courriel)][0]} ${ST_COULEURS[statutBlocST(tache.id, emp.courriel)][1]}`
                                  : estTerminee(tache, emp)
                                  ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                                  : estEnCours(tache, emp)
                                  ? "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-900"
                                  : tache.est_tache_systeme
                                  ? "border-slate-400 bg-slate-200 text-slate-600"
                                  : `border-transparent text-black ${(COULEUR_TYPE_TACHE[tache.typeTache] || COULEUR_TYPE_DEFAUT).fond}`
                              }`}
                            >
                              <span className="flex items-start gap-1">
                                {emp.estSousTraitant && (
                                  <span className="mt-px shrink-0 text-[9px]">
                                    {ST_ICONES[statutBlocST(tache.id, emp.courriel)]}
                                    {stAConfirmer(tache.id, emp.courriel, dateISO(d)) && (
                                      <span className="ml-1 animate-pulse rounded bg-amber-200 px-1 text-[8px] font-extrabold text-amber-800">à confirmer</span>
                                    )}
                                  </span>
                                )}
                                {!emp.estSousTraitant && estTerminee(tache, emp) && <Check size={9} className="mt-px shrink-0 text-emerald-600" />}
                                {!emp.estSousTraitant && estEnCours(tache, emp) && <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-fuchsia-500" />}
                                {tache.est_tache_systeme && <Car size={9} className="mt-px shrink-0" />}
                                <span className="min-w-0">
                                  {tache.titre || tache.clientNom}
                                  {/* ⏱️ Heures RÉELLES du bloc terminé —
                                      début → fin · total pointé, pour CE
                                      technicien et CETTE journée. */}
                                  {(() => {
                                    const r = (travaux || []).find(
                                      (x) =>
                                        x.supabase &&
                                        cleTacheDesHeures(x.tacheId) === tache.id &&
                                        (x.employeEmail || "").toLowerCase() === (emp.courriel || "").toLowerCase() &&
                                        x.date === dateISO(d) &&
                                        x.debutReel &&
                                        x.finReelle
                                    );
                                    return r ? (
                                      <span className="ml-1 font-bold text-emerald-800">
                                        · {heureLocaleHHMM(r.debutReel)} → {heureLocaleHHMM(r.finReelle)} · {(Number(r.heures) || 0).toFixed(2)} h
                                      </span>
                                    ) : null;
                                  })()}
                                  {tache.description && (
                                    <span className="mt-0.5 line-clamp-2 text-[8px] font-normal leading-tight opacity-75">
                                      {tache.description}
                                    </span>
                                  )}
                                  {travailTermine(tache, emp)?.noteTerrain && (
                                    <span className="mt-0.5 line-clamp-2 text-[8px] font-normal italic leading-tight text-emerald-800">
                                      📝 Note du technicien : {travailTermine(tache, emp).noteTerrain}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {survol && !redim && (() => {
        const client = (clients || []).find((c) => c.id === survol.tache.clientId) || (clients || []).find((c) => c.nom === survol.tache.clientNom);
        const adresse = survol.tache.adresseTravaux || (client?.adresses?.[0] ? `${client.adresses[0].nom} — ${client.adresses[0].ligne1}` : null);
        const couleur = COULEUR_TYPE_TACHE[survol.tache.typeTache] || COULEUR_TYPE_DEFAUT;
        // Décale l'infobulle du curseur (jamais pile dessous) et
        // l'empêche de sortir de l'écran à droite/en bas.
        const decalage = 14;
        const largeurEstimee = 240;
        const gauche = Math.min(survol.x + decalage, window.innerWidth - largeurEstimee - 12);
        return (
          <div
            className="pointer-events-none fixed z-[60] w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            style={{ left: gauche, top: survol.y + decalage }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${couleur.pastille}`} />
              <p className="text-xs font-bold text-slate-900">{survol.tache.titre || survol.tache.clientNom}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {survol.employe.nom}
              {vue === "jour" && <> · {survol.heure}</>}
              {(survol.tache.heures ?? 1) > 1 ? ` (${survol.tache.heures} h)` : ""}
            </p>
            {(client?.nom || survol.tache.clientNom) && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-600">
                <User size={11} className="shrink-0 text-slate-400" /> {client?.nom || survol.tache.clientNom}
              </p>
            )}
            {adresse && (
              <p className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-600">
                <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" /> {adresse}
              </p>
            )}
            {survol.tache.description && (
              <p className="mt-1.5 whitespace-pre-line border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">{survol.tache.description}</p>
            )}
            {(() => {
              const tr = travailTermine(survol.tache, survol.employe);
              if (!tr) return null;
              return (
                <div className="mt-1.5 border-t border-emerald-100 pt-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    Terminée · {tr.heures?.toFixed ? tr.heures.toFixed(2) : tr.heures} h réelles
                  </p>
                  {survol.tache.typeTache === "appel_service" && (() => {
                    // Zones 1-2-3 : temps chez le client seulement (transport
                    // inclus dans le prix). Hors zone : transport aller-retour
                    // (entrepôt) + sur place comptent dans le temps inclus.
                    const horsZone = survol.tache.zoneAppel === "hors_zone";
                    const inclusH = (horsZone ? Number(prixDepots?.minutes_incluses_hors_zone) || 180 : Number(prixDepots?.minutes_incluses) || 90) / 60;
                    const tauxV = Number(prixDepots?.taux_horaire_vendant) || 0;
                    const heuresTransport = horsZone
                      ? (travaux || [])
                          .filter((t) => t.supabase && t.estTransport && t.employeEmail === tr.employeEmail && t.date === tr.date)
                          .reduce((s, t) => s + (t.heures || 0), 0)
                      : 0;
                    const totalH = (tr.heures || 0) + heuresTransport;
                    // Dépassement facturé par TRANCHES DE 15 MIN entamées —
                    // même règle que la boîte en direct de l'app technicien.
                    const extraMinReel = Math.max(0, Math.round((totalH - inclusH) * 60 * 100) / 100);
                    const trancheMin = Number(configEnt?.trancheFacturationMin) || 15;
                    const extraFactMin = Math.ceil(extraMinReel / trancheMin) * trancheMin;
                    const extraFactH = extraFactMin / 60;
                    const detail = horsZone ? ` (total ${totalH.toFixed(2)} h dont ${heuresTransport.toFixed(2)} h transport)` : "";
                    if (extraMinReel <= 0) {
                      return <p className="mt-0.5 text-[10px] text-emerald-700">✔ Dans le temps inclus ({Math.round(inclusH * 60)} min{horsZone ? ", transport compris" : ""}){detail}</p>;
                    }
                    return (
                      <p className="mt-0.5 text-[10px] font-bold text-amber-700 tabular-nums">
                        ⏱️ Dépassement : {Math.ceil(extraMinReel)} min → facturable {extraFactMin} min (tranches de {Number(configEnt?.trancheFacturationMin) || 15})
                        {tauxV > 0
                          ? ` × ${tauxV.toFixed(2)} $/h = ${(extraFactH * tauxV).toFixed(2)} $ HT (${taxesDepot(extraFactH * tauxV, configEnt).total.toFixed(2)} $ taxes incl.)`
                          : " — définis le taux vendant dans Tarifs"}
                        {detail}
                      </p>
                    );
                  })()}
                  {tr.noteTerrain && (
                    <p className="mt-0.5 text-[11px] italic text-emerald-800">
                      📝 <span className="font-bold not-italic">Note du technicien :</span> {tr.noteTerrain}
                    </p>
                  )}
                  {tr.noteInterne && (
                    <p className="mt-0.5 text-[11px] italic text-slate-600">
                      🔒 <span className="font-bold not-italic">Note interne :</span> {tr.noteInterne}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* MODALE — DÉPÔT REÇU MANUELLEMENT */}
      {depotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setDepotModal(null))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-slate-900">Dépôt reçu manuellement</h3>
            <p className="mt-1 text-xs text-slate-500">
              « {depotModal.titre} » — confirme le paiement reçu hors QuickBooks. L'action sera consignée au journal (avec ton nom).
            </p>
            {depotDe(depotModal.tacheId) && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 tabular-nums">
                Montant attendu : {taxesDepot(depotDe(depotModal.tacheId).montantHT, configEnt).total.toFixed(2)} $ (taxes incluses)
              </p>
            )}
            <label className="mt-3 mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Mode de paiement</label>
            <select value={depotMode} onChange={(e) => setDepotMode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold">
              <option>Comptant</option>
              <option>Chèque</option>
              <option>Interac</option>
            </select>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDepotModal(null)} className="min-h-0 py-2 text-xs">Annuler</Button>
              <Button
                onClick={() => { onDepotPaye?.(depotModal.tacheId, depotMode); setDepotModal(null); }}
                className="min-h-0 py-2 text-xs"
              >
                Confirmer — débloquer la tâche
              </Button>
            </div>
          </div>
        </div>
      )}

      {tacheDetailOuverte && (
        <ModalEditionTache
          tache={tacheDetailOuverte.tache}
          clients={clients}
          dateInitiale={tacheDetailOuverte.date}
          heureInitiale={tacheDetailOuverte.heure}
          employeIdInitial={tacheDetailOuverte.employe.id}
          employes={employes}
          travailFait={travailTermine(tacheDetailOuverte.tache, tacheDetailOuverte.employe)}
          techniciensSurTache={techniciensPourTache(planning, tacheDetailOuverte.tache.id, employes)}
          depot={depotDe(tacheDetailOuverte.tache.id) || null}
          commandes={commandesPourTache(tacheDetailOuverte.tache.id)}
          facturables={facturablesAssignations}
          onBasculerFacturable={
            lectureSeule
              ? undefined
              : (employeId, facturable) => {
                  const employe = employes.find((x) => x.id === employeId);
                  const t = tacheDetailOuverte.tache;
                  majFacturableAssignation(t.id, employe?.courriel, facturable).catch(() =>
                    ajouterJournal("⚠️ Choix facturable NON enregistré (connexion ?) — réessaie.")
                  );
                  onMajFacturable?.(t.id, employe?.courriel, facturable);
                  ajouterJournal(
                    facturable
                      ? `💰 ${employe?.nom || "Technicien"} passe FACTURABLE sur « ${t.titre || t.clientNom} ».`
                      : `🤝 ${employe?.nom || "Technicien"} passe NON facturable (aide interne) sur « ${t.titre || t.clientNom} » — ses heures ne compteront pas dans la facturation.`
                  );
                }
          }
          onRetirerTechnicien={
            lectureSeule
              ? undefined
              : (employeId) => {
                  const employe = employes.find((x) => x.id === employeId);
                  const t = tacheDetailOuverte.tache;
                  // Ses cases quittent la grille — celles des autres restent.
                  setPlanning((prev) => {
                    const copie = { ...prev };
                    Object.keys(copie).forEach((cle) => {
                      const [, empCle] = cle.split("|");
                      if (empCle !== employeId) return;
                      const restants = listeCellule(copie[cle]).filter((x) => x.id !== t.id);
                      if (restants.length) copie[cle] = restants;
                      else delete copie[cle];
                    });
                    return recalculerTransports(copie, sansTransportAgendaRef.current);
                  });
                  // Et son téléphone est prévenu (l'assignation disparaît).
                  if (!t.est_tache_systeme && employe?.courriel) {
                    retirerTacheSupabase(t.id, employe.courriel).catch(() =>
                      ajouterJournal(`⚠️ Retrait de ${employe?.nom} : la grille est à jour ici, mais son app mobile n'a peut-être PAS reçu le retrait — vérifie la connexion.`)
                    );
                  }
                  ajouterJournal(`↩️ ${employe?.nom || "Technicien"} retiré de « ${t.titre || t.clientNom} » — les autres techniciens restent assignés.`);
                }
          }
          onAjouterTechnicien={({ employeId, date, heureDebut, heures, jours, dupliquer }) => {
            // « Ajouter » = même tâche partagée (id identique) ; « Dupliquer »
            // = copie indépendante (nouvel id). Dans les deux cas, le
            // technicien reçoit SON horaire (date/heure/durée saisis), et
            // les transports Début/Fin se recalculent automatiquement.
            const base = dupliquer
              ? { ...tacheDetailOuverte.tache, id: `${tacheDetailOuverte.tache.id}-copie-${Date.now()}` }
              : tacheDetailOuverte.tache;
            assigner({ ...base, heures, jours }, employeId, new Date(`${date}T00:00:00`), heureDebut);
            setTacheDetailOuverte(null);
          }}
          projets={projets}
          devisListe={devisListe}
          onTraiterPropositionProjet={
            lectureSeule
              ? undefined
              : async (t, accepter) => {
                  const projetId = t.projetProposeId;
                  const nomProjet = t.projetProposeNom || (projets || []).find((p) => p.id === projetId)?.nom || projetId;
                  setTacheDetailOuverte(null);
                  try {
                    await traiterPropositionProjetShop(t.id, accepter ? projetId : null);
                    if (accepter) {
                      const n = await rattacherProjetAuxHeures(t.id, projetId, { toutesCategories: true });
                      ajouterJournal(
                        `🏗️ Projet « ${nomProjet} » CONFIRMÉ sur « ${t.titre} » (proposé par ${t.projetProposePar || "le technicien"})${n > 0 ? ` — ${n} entrée${n > 1 ? "s" : ""} d'heures rejoint${n > 1 ? "" : ""} ses coûts réels` : ""}.`
                      );
                    } else {
                      ajouterJournal(`✗ Proposition de projet « ${nomProjet} » REFUSÉE sur « ${t.titre} » — le travail au shop reste hors projet.`);
                    }
                  } catch (e) {
                    ajouterJournal(`⚠️ Traitement de la proposition de projet impossible (${e?.message || "connexion"}) — réessaie.`);
                  }
                }
          }
          onCreerProjetDepuisTache={(t) => {
            // 🏗️ « Créer un projet à partir de cette tâche » : un projet
            // n'est pas qu'un dossier, c'est un BUDGET — impossible à
            // deviner depuis une tâche. On pré-remplit donc ce qu'on sait
            // (client, adresse, secteur, nom, date) et l'humain n'a plus
            // qu'à entrer les montants. Le rattachement de la tâche se
            // fait ensuite au retour (voir projetDepuisTache).
            setProjetDepuisTache(t);
            setTacheDetailOuverte(null);
          }}
          onFermer={() => setTacheDetailOuverte(null)}
          onEnregistrer={(champs) => {
            modifierTachePlanifiee(tacheDetailOuverte.tache, tacheDetailOuverte.employe.id, champs);
            // Rattachements : UNE fois pour la tâche (pas par technicien).
            if (champs.projetId !== undefined || champs.devisNumero !== undefined) {
              appliquerRattachements(tacheDetailOuverte.tache, champs);
            }
            // Modification groupée : chaque technicien coché reçoit les
            // mêmes date/heure/durée/description — sur SES plages (son
            // instance est déplacée/mise à jour, pas celle des autres).
            (champs.autresCibles || []).forEach((empId) => {
              if (empId === tacheDetailOuverte.employe.id) return;
              modifierTachePlanifiee(tacheDetailOuverte.tache, empId, { ...champs, employeId: empId });
            });
            setTacheDetailOuverte(null);
          }}
          onRetirerHoraire={
            lectureSeule
              ? undefined
              : (champs) => {
                  modifierTachePlanifiee(tacheDetailOuverte.tache, tacheDetailOuverte.employe.id, {
                    ...champs,
                    employeId: null,
                    date: tacheDetailOuverte.date,
                    heureDebut: tacheDetailOuverte.heure,
                  });
                  setTacheDetailOuverte(null);
                }
          }
          annulation={contexteAnnulation(tacheDetailOuverte.tache)}
          onFermerPourTechnicien={
            lectureSeule
              ? undefined
              : (champs) => {
                  fermerTachePourTechnicien(tacheDetailOuverte.tache, tacheDetailOuverte.employe, tacheDetailOuverte.date, champs);
                  setTacheDetailOuverte(null);
                }
          }
          onAnnulerTache={
            peutOuvrirAnnulation
              ? (raison) => {
                  annulerTacheDefinitivement(tacheDetailOuverte.tache, raison);
                  setTacheDetailOuverte(null);
                }
              : undefined
          }
        />
      )}
      {tacheEnEditionId && (
        <ModalEditionTache
          employes={employes}
          tache={tachesAttente.find((t) => t.id === tacheEnEditionId)}
          clients={clients}
          commandes={commandesPourTache(tacheEnEditionId)}
          onFermer={() => setTacheEnEditionId(null)}
          onEnregistrer={(champs) => enregistrerEditionRapide(tacheEnEditionId, champs)}
          annulation={contexteAnnulation(tachesAttente.find((t) => t.id === tacheEnEditionId))}
          onAnnulerTache={
            peutOuvrirAnnulation
              ? (raison) => {
                  annulerTacheDefinitivement(tachesAttente.find((t) => t.id === tacheEnEditionId), raison);
                  setTacheEnEditionId(null);
                }
              : undefined
          }
        />
      )}
      {/* 👯 TÂCHE JUMELLE — même titre, même client, même journée, MÊME
          ADRESSE : on demande avant de créer une seconde fois. Deux
          jobs le même jour à des adresses différentes ne déclenchent
          rien (cas légitime, vécu le 21 août). */}
      {doublonTache && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-base font-extrabold text-amber-700">👯 Cette tâche existe déjà</p>
            <p className="mt-2 text-[13px] leading-snug text-slate-700">
              « <span className="font-bold">{doublonTache.titre}</span> » est déjà à l&apos;horaire pour{" "}
              <span className="font-bold">{doublonTache.client || "ce client"}</span>
              {doublonTache.date ? ` le ${doublonTache.date}` : ""}, à la <span className="font-bold">même adresse</span>.
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
              Si tu la crées quand même, tes techniciens verront <span className="font-bold">deux cartes identiques</span> sur
              leur téléphone. Vérifie d&apos;abord dans l&apos;agenda.
            </p>
            <div className="mt-4 space-y-2">
              <Button variant="outline" onClick={() => setDoublonTache(null)} className="w-full">
                Annuler — je vais vérifier
              </Button>
              <button
                onClick={() => { setDoublonTache(null); creerTache(true); }}
                className="min-h-[44px] w-full rounded-xl text-[12px] font-bold text-slate-500"
              >
                C&apos;est une vraie deuxième job — créer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ FICHE CLIENT modifiable depuis la création de tâche (même
          fenêtre que l'onglet Clients — une seule logique). */}
      {clientEnEditionAgenda && (() => {
        const c = clients.find((x) => x.id === clientEnEditionAgenda);
        if (!c) return null;
        return (
          <ModalEditionClient
            client={c}
            onFermer={() => setClientEnEditionAgenda(null)}
            onEnregistrer={(champs) => {
              setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...champs } : x)));
              ajouterJournal(`✏️ Fiche client modifiée : ${champs.entreprise && champs.nomAffichage !== "nom" ? champs.entreprise : champs.nom}`);
            }}
          />
        );
      })()}

      {/* FENÊTRE — NOUVEAU CLIENT depuis la création de tâche (composant
          partagé avec l'onglet Devis, mêmes validations QuickBooks). */}
      {/* 🤝 FICHE SOUS-TRAITANT — création/édition, avec lien FACULTATIF
          vers une fiche client (même identité, deux rôles : ce qu'il te
          facture = coût, ce que tu lui factures = revenu — jamais
          mélangés). Un sous-traitant pur ne crée RIEN dans les clients. */}
      {modalFicheST && (() => {
        const f = modalFicheST;
        const clientsTries = (clients || []).slice().sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
        const clientLie = clientsTries.find((c) => c.id === f.clientId);
        // Suggestion automatique : le nom tapé ressemble à un client ?
        const nomTape = (f.nom || "").trim().toLowerCase();
        const suggestion =
          !f.clientId && nomTape.length >= 3
            ? clientsTries.find((c) => {
                const n = (c.nom || "").toLowerCase();
                return n.includes(nomTape) || nomTape.includes(n);
              })
            : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setModalFicheST(null))(); }}>
            <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-extrabold text-slate-900">🤝 {f.id ? "Modifier le sous-traitant" : "Nouveau sous-traitant"}</h3>
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Nom de l&apos;entreprise</label>
                  <input value={f.nom} onChange={(e) => setModalFicheST({ ...f, nom: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  {suggestion && (
                    <button
                      onClick={() => setModalFicheST({ ...f, clientId: suggestion.id })}
                      className="mt-1.5 w-full rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-left text-[11px] font-bold text-sky-800"
                    >
                      🔗 « {suggestion.nom} » existe dans tes clients — lier ce sous-traitant à sa fiche ?
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Spécialité</label>
                    <input value={f.specialite} onChange={(e) => setModalFicheST({ ...f, specialite: e.target.value })} placeholder="Électricien, plombier…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
                    <input type="tel" value={f.telephone} onChange={(e) => setModalFicheST({ ...f, telephone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Aussi un client ?</label>
                  <select
                    value={f.clientId || ""}
                    onChange={(e) => setModalFicheST({ ...f, clientId: e.target.value || "" })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Aucun lien (sous-traitant seulement) —</option>
                    {clientsTries.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    {clientLie
                      ? `🔗 Lié à la fiche client « ${clientLie.nom} » — ses coordonnées font foi (une seule source de vérité).`
                      : "Lier seulement si cette entreprise est AUSSI ton client — sinon laisse « aucun lien » : ta liste de clients reste propre."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Note</label>
                  <input value={f.note} onChange={(e) => setModalFicheST({ ...f, note: e.target.value })} placeholder="Taux habituel, particularités…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <Button
                  onClick={() => {
                    onEnregistrerSousTraitant?.({
                      id: f.id || String(Date.now()),
                      nom: f.nom.trim(),
                      specialite: f.specialite.trim(),
                      telephone: f.telephone.trim(),
                      note: f.note.trim(),
                      clientId: f.clientId || null,
                      actif: true,
                    });
                    setModalFicheST(null);
                    if (!stOuvert) basculerSection("st");
                  }}
                  disabled={!f.nom.trim()}
                  className="w-full"
                >
                  Enregistrer le sous-traitant
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🤝 STATUT D'UN BLOC SOUS-TRAITANT — Présent / Pas venu (+ note,
          + montant facturé qui alimente les coûts réels du projet lié). */}
      {modalStatutST && (() => {
        const { tache, employe, date } = modalStatutST;
        const a = (assignationsST || []).find((x) => x.tache_id === tache.id && x.employe_email === employe.courriel);
        const d = a?.donnees || {};
        const statut = d.stStatut || "prevu";
        const note = modalStatutST.note ?? d.stNote ?? "";
        const montant = modalStatutST.montant ?? (d.stMontant || "");
        const ficheSt = (sousTraitants || []).find((x) => `st-${x.id}` === employe.id);
        const projetLie = (projets || []).find((p) => p.id === tache.projetId);
        const valider = (nouveau) => {
          const montantNum = Math.max(0, Number(montant) || 0);
          onStatutST?.(
            tache.id,
            employe.courriel,
            { stStatut: nouveau, stNote: String(note || ""), stMontant: montantNum, stStatutLe: new Date().toISOString() },
            `🤝 ${employe.nom} — « ${tache.titre || tache.clientNom || "tâche"} » (${date}) : ${
              nouveau === "present" ? "PRÉSENT ✅" : nouveau === "absent" ? "PAS VENU ❌" : "remis à « prévu »"
            }`
          );
          if (nouveau === "present" && montantNum > 0 && tache.projetId) {
            onAjouterCoutSousTraitant?.(tache.projetId, employe.nom, montantNum, `${tache.id}|${employe.courriel}`);
          }
          setModalStatutST(null);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setModalStatutST(null))(); }}>
            <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-extrabold text-slate-900">🤝 {employe.nom}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {tache.titre || tache.clientNom || "Tâche"}{tache.clientNom && tache.titre ? ` — ${tache.clientNom}` : ""} · {date}
                {ficheSt?.telephone ? ` · 📞 ${ficheSt.telephone}` : ""}
              </p>
              <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">
                Statut actuel : {ST_ICONES[statut]} {statut === "present" ? "Présent" : statut === "absent" ? "Pas venu" : "Prévu — à confirmer après la visite"}
              </p>
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Note (facultative)</label>
                  <input
                    value={note}
                    onChange={(e) => setModalStatutST({ ...modalStatutST, note: e.target.value })}
                    placeholder="Arrivé à 9 h, travaux du sous-sol faits…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Montant qu&apos;il TE facture ($, avant taxes)</label>
                  <InputNombreDecimal
                    valeur={montant || 0}
                    onChange={(v) => setModalStatutST({ ...modalStatutST, montant: v })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    {projetLie
                      ? `S'ajoute aux coûts réels du projet « ${projetLie.nom} » en marquant Présent.`
                      : "Aucun projet lié à cette tâche — le montant est noté sur le bloc, sans coût de projet."}
                  </p>
                </div>
                <button onClick={() => valider("present")} className="min-h-[48px] w-full rounded-xl bg-emerald-600 text-sm font-extrabold text-white active:scale-[0.99]">
                  ✅ Présent — il est venu faire les travaux
                </button>
                <button onClick={() => valider("absent")} className="min-h-[48px] w-full rounded-xl border-2 border-red-300 bg-red-50 text-sm font-extrabold text-red-700 active:scale-[0.99]">
                  ❌ Pas venu
                </button>
                {statut !== "prevu" && (
                  <button onClick={() => valider("prevu")} className="min-h-[44px] w-full rounded-xl border border-slate-300 text-xs font-bold text-slate-600 active:scale-[0.99]">
                    ↩︎ Remettre « prévu »
                  </button>
                )}
                {ficheSt && !lectureSeule && (
                  <button
                    onClick={() => { setModalStatutST(null); setModalFicheST({ ...ficheSt }); }}
                    className="min-h-[40px] w-full rounded-xl text-[11px] font-bold text-slate-400 active:scale-[0.99]"
                  >
                    ✏️ Modifier la fiche du sous-traitant
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🏗️ CRÉER UN PROJET À PARTIR D'UNE TÂCHE (2026-08-22) — un projet
          est un BUDGET, pas un simple dossier : impossible de le deviner
          depuis une tâche. On pré-remplit ce qu'on sait, l'humain entre
          les montants, et la tâche (heures déjà pointées comprises) est
          rattachée au nouveau projet. La ventilation fine (transport,
          matériaux, sous-traitants) reste ajustable dans Projets. */}
      {projetDepuisTache && (
        <ModalProjetDepuisTache
          tache={projetDepuisTache}
          clients={clients}
          onFermer={() => setProjetDepuisTache(null)}
          onCreer={(projet) => {
            const t = projetDepuisTache;
            setProjetDepuisTache(null);
            onCreerProjet?.(projet);
            // La tâche rejoint son nouveau projet, avec son passé.
            rattacherTacheAuProjet(t, projet.id);
          }}
        />
      )}

      {choixFacturable && (
        <ModalChoixFacturable
          info={choixFacturable}
          onChoisir={(facturable) => {
            const c = choixFacturable;
            setChoixFacturable(null);
            majFacturableAssignation(c.tacheId, c.employe?.courriel, facturable).catch(() =>
              ajouterJournal("⚠️ Choix facturable NON enregistré (snippet 71 manquant ?) — réessaie en redéposant le technicien.")
            );
            onMajFacturable?.(c.tacheId, c.employe?.courriel, facturable);
            ajouterJournal(
              facturable
                ? `💰 ${c.employe?.nom || "Technicien"} ajouté sur « ${c.titre} » — FACTURABLE au client.`
                : `🤝 ${c.employe?.nom || "Technicien"} ajouté sur « ${c.titre} » — NON facturable (aide interne) : ses heures ne seront pas comptées dans la facturation.`
            );
          }}
        />
      )}
      {/* 📧 PANNEAU DE RENVOI DE LA DEMANDE DE DÉPÔT — courriels de la
          fiche cochables + adresse corrigée à la main (ajoutable au
          dossier). Même facture QuickBooks, jamais une nouvelle. */}
      {renvoiDepot && (() => {
        const ficheR = (clients || []).find((c) => c.id === renvoiDepot.tache.clientId || c.nom === renvoiDepot.tache.clientNom);
        const contactsR = (ficheR?.courriels || [])
          .map((c) => (typeof c === "string" ? { email: c } : c))
          .filter((c) => c?.email);
        const extraValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(renvoiDepot.extra.trim());
        const nbAdresses = new Set([...renvoiDepot.coches, ...(extraValide ? [renvoiDepot.extra.trim().toLowerCase()] : [])]).size;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setRenvoiDepot(null); }}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">📧 Renvoyer la demande de dépôt</h3>
                  <p className="text-xs text-slate-500">
                    {renvoiDepot.tache.clientNom || renvoiDepot.tache.titre} · facture {renvoiDepot.depot.qboDocNumber || renvoiDepot.depot.qboInvoiceId}
                  </p>
                </div>
                <button onClick={() => setRenvoiDepot(null)} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
              </div>
              {contactsR.length === 0 && (
                <p className="mb-2 text-[11px] font-semibold text-amber-700">Ce client n&apos;a aucun courriel dans sa fiche — inscris une adresse ci-dessous.</p>
              )}
              <div className="space-y-1">
                {contactsR.map((c) => (
                  <label key={c.email} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={renvoiDepot.coches.includes(c.email)}
                      onChange={() =>
                        setRenvoiDepot((p) => ({
                          ...p,
                          coches: p.coches.includes(c.email) ? p.coches.filter((x) => x !== c.email) : [...p.coches, c.email],
                        }))
                      }
                      className="h-4 w-4 accent-[#FF6A13]"
                    />
                    <span className="min-w-0 truncate font-semibold">{c.email}</span>
                    {c.label ? <span className="shrink-0 text-[10px] text-slate-400">({c.label}{c.defaut ? " · défaut" : ""})</span> : null}
                  </label>
                ))}
              </div>
              <input
                value={renvoiDepot.extra}
                onChange={(e) => setRenvoiDepot((p) => ({ ...p, extra: e.target.value }))}
                placeholder="Autre adresse (corrigée) — optionnel"
                className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              />
              {renvoiDepot.extra.trim() && !extraValide && (
                <p className="mt-1 text-[10px] text-red-500">Adresse invalide — elle ne sera pas utilisée.</p>
              )}
              {extraValide && ficheR && (
                <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={renvoiDepot.extraAuDossier}
                    onChange={(e) => setRenvoiDepot((p) => ({ ...p, extraAuDossier: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-[#FF6A13]"
                  />
                  📌 Ajouter ce courriel au dossier de {nomAffichageClient(ficheR)}
                </label>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setRenvoiDepot(null)} className="min-h-0 py-2 text-xs">Annuler</Button>
                <Button loading={renvoiDepot.enCours} disabled={nbAdresses === 0} onClick={executerRenvoiDepot} className="min-h-0 py-2 text-xs">
                  Renvoyer{nbAdresses > 1 ? ` (${nbAdresses} adresses)` : ""}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
      {modalNouveauClientTache && (
        <ModalNouveauClient
          clients={clients}
          setClients={setClients}
          ajouterJournal={ajouterJournal}
          onFermer={() => setModalNouveauClientTache(false)}
          onSelection={(id, ficheNeuve) => {
            setNouveauClientId(id);
            setAdresseTravauxId("");
            setNouvelleAdresseTravaux(null);
            setNouveauProjetId("");
            // 📧 COURRIELS DE DÉPÔT PRÉCOCHÉS (2026-09-04, vécu : le
            // dépôt de Luis Gonzalez est parti SANS courriel alors que
            // sa fiche toute neuve en avait un — la sélection d'un
            // client existant précoche, la création n'en faisait rien).
            // Même règle que choisirClientTache : les défauts d'abord.
            const courriels = ficheNeuve?.courriels || [];
            const defauts = courriels.filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
            const tous = courriels.map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
            setDepotEmails(defauts.length > 0 ? defauts : tous.slice(0, 1));
            setDepotExtra("");
          }}
        />
      )}
    </div>
  );
}

