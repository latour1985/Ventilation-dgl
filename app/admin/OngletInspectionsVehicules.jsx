"use client";

// app/admin/OngletInspectionsVehicules.jsx
//
// INSPECTIONS + ENTRETIEN DES VÉHICULES — tranche T3 du découpage de
// page.jsx (2026-08-28). Extraction MÉCANIQUE : rien ne change.

import { useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { sauvegarderCamion, camionIndisponible, declarerIndispoCamion, leverIndispoCamion } from "@/lib/supabase/camions";
import { Button, PhotosInspection, todayISO, joursDepuis, moisDepuis, dateISO } from "./partage";

// ============================================================
// INSPECTIONS VÉHICULES — données de démo + entretien périodique
// (remplacées par Supabase à l'Étape B — voir schema.sql, table
// inspections_vehicules / entretiens_vehicules)
// ============================================================
export const SEUIL_ENTRETIEN_KM = 10000;

export const SEUIL_ENTRETIEN_MOIS = 6;


export function OngletInspectionsVehicules({ inspections, setInspections, entretiens, setEntretiens, ajouterJournal, persisterPriseEnCharge, persisterEntretien, parcCamions, setParcCamions, carnet, setCarnet, onEntreeCarnet, onAnomalieReparee }) {
  const [filtreDate, setFiltreDate] = useState("");
  const [filtreCamion, setFiltreCamion] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [chargeId, setChargeId] = useState(null);
  const [noteCharge, setNoteCharge] = useState("");
  // Gestion du parc de véhicules (ajout/retrait) — le technicien
  // choisira dans cette liste au lieu d'écrire le nom à la main.
  const [parcOuvert, setParcOuvert] = useState(false);
  const [nouveauCamionNom, setNouveauCamionNom] = useState("");
  const [nouveauCamionPlaque, setNouveauCamionPlaque] = useState("");
  const [nouveauCamionModele, setNouveauCamionModele] = useState("");
  // Retrait d'un camion : { camion } — saisie du motif et du remplaçant.
  const [retraitCamion, setRetraitCamion] = useState(null);
  const [motifRetrait, setMotifRetrait] = useState("");
  const [remplacePar, setRemplacePar] = useState("");
  // Dossier d'un ancien véhicule ouvert (consultation de l'historique).
  const [dossierAncienId, setDossierAncienId] = useState(null);
  // Saisie des travaux réalisés (réparation d'anomalie OU entretien) :
  // { type, camion, inspectionId, km } — alimente le carnet du véhicule.
  const [travauxSaisie, setTravauxSaisie] = useState(null);
  const [travDescription, setTravDescription] = useState("");
  const [travCout, setTravCout] = useState("");
  const [travGarage, setTravGarage] = useState("");
  // Carnet d'entretien global déplié (bas de page).
  const [carnetOuvert, setCarnetOuvert] = useState(null);
  // Dossier du véhicule ouvert (nom du camion) + onglet actif. La tuile
  // reste une vue de surveillance ; tout le détail et les actions vivent
  // ici, dans un espace confortable.
  const [dossierCamion, setDossierCamion] = useState(null);
  const [ongletDossier, setOngletDossier] = useState("etat");

  const entreesCarnetDe = (nom) => (carnet || []).filter((e) => e.camion === nom);

  // Enregistre les travaux au carnet. Pour une réparation, ferme aussi
  // l'anomalie d'origine (le camion peut redevenir conforme).
  const confirmerTravaux = () => {
    if (!travauxSaisie || !travDescription.trim()) return;
    const entree = {
      camion: travauxSaisie.camion,
      type: travauxSaisie.type,
      description: travDescription.trim(),
      cout: travCout === "" ? null : parseFloat(String(travCout).replace(",", ".")) || 0,
      garage: travGarage.trim(),
      km: travauxSaisie.km ?? null,
      inspectionId: travauxSaisie.inspectionId || null,
      date: todayISO(),
    };
    // Affichage immédiat, écriture en arrière-plan.
    setCarnet((prev) => [{ ...entree, id: `carnet-local-${Date.now()}`, parNom: "moi" }, ...(prev || [])]);
    onEntreeCarnet?.(entree).catch?.(() =>
      ajouterJournal(`⚠️ Travaux sur ${entree.camion} enregistrés localement, mais NON sauvegardés (table carnet_vehicules absente ?).`)
    );
    if (travauxSaisie.type === "reparation" && travauxSaisie.inspectionId) {
      // L'anomalie est close : elle sort des anomalies ouvertes.
      setInspections((prev) => prev.map((x) => (x.id === travauxSaisie.inspectionId ? { ...x, statutAnomalie: "reparee" } : x)));
      onAnomalieReparee?.(travauxSaisie.inspectionId);
      ajouterJournal(`✅ Réparation faite sur ${entree.camion} — ${entree.description}${entree.cout != null ? ` · ${entree.cout.toFixed(2)} $` : ""}${entree.garage ? ` · ${entree.garage}` : ""}`);
    } else {
      // Entretien périodique : remet aussi le compteur km/mois à zéro.
      setEntretiens((prev) => [{ id: `ent-${Date.now()}`, camion: entree.camion, km: entree.km || 0, date: todayISO() }, ...prev]);
      persisterEntretien?.({ camion: entree.camion, km: entree.km || 0 });
      ajouterJournal(`🔧 Entretien fait sur ${entree.camion} — ${entree.description}${entree.cout != null ? ` · ${entree.cout.toFixed(2)} $` : ""}${entree.garage ? ` · ${entree.garage}` : ""}`);
    }
    setTravauxSaisie(null);
    setTravDescription("");
    setTravCout("");
    setTravGarage("");
  };

  // Camions du PARC OFFICIEL (répertoire) + ceux vus dans les
  // inspections mais pas encore enregistrés (héritage / saisie libre).
  const camionsParc = (parcCamions || []).filter((c) => c.actif).map((c) => c.nom);
  const camionsInspectes = [...new Set(inspections.filter((i) => !i.sansVehicule && i.camion).map((i) => i.camion))];
  const camions = [...new Set([...camionsParc, ...camionsInspectes])];
  const camionsHorsParc = camionsInspectes.filter((n) => !camionsParc.includes(n));

  // ➕ Formulaire d'ajout PLIÉ par défaut (constat du propriétaire :
  // les champs sous la liste donnaient l'impression d'éditer le camion
  // du dessus). Un bouton clair l'ouvre, avec son propre titre.
  const [ajoutCamionOuvert, setAjoutCamionOuvert] = useState(false);
  // 🔧 Indisponibilité en saisie — { camionId, debut, fin, raison, note }.
  const [indispoCamion, setIndispoCamion] = useState(null);
  const declarerIndispo = () => {
    const i = indispoCamion;
    if (!i?.camionId || !i?.debut) return;
    const fiche = (parcCamions || []).find((c) => c.id === i.camionId);
    setParcCamions((prev) =>
      prev.map((c) =>
        c.id === i.camionId
          ? { ...c, indispoDebut: i.debut, indispoFin: i.fin || null, indispoRaison: i.raison, indispoNote: i.note }
          : c
      )
    );
    declarerIndispoCamion(i.camionId, i).catch(() =>
      ajouterJournal("⚠️ Indisponibilité affichée mais NON enregistrée (snippet 65 manquant ?) — réessaie.")
    );
    ajouterJournal(
      `🔧 ${fiche?.nom || "Camion"} déclaré INDISPONIBLE (${i.raison}) du ${i.debut}${i.fin ? ` au ${i.fin}` : " (durée indéterminée)"} — rappel à l'agenda, grisé chez les techniciens.`
    );
    setIndispoCamion(null);
  };
  const leverIndispo = (c) => {
    setParcCamions((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, indispoDebut: null, indispoFin: null, indispoRaison: "", indispoNote: "" } : x))
    );
    leverIndispoCamion(c.id).catch(() => ajouterJournal("⚠️ Remise en service affichée mais NON enregistrée — réessaie."));
    ajouterJournal(`✅ ${c.nom} remis en service.`);
  };

  const ajouterCamion = () => {
    const nom = nouveauCamionNom.trim();
    if (!nom) return;
    if ((parcCamions || []).some((c) => c.nom.trim().toLowerCase() === nom.toLowerCase())) return;
    const nouveau = {
      id: `cam-${Date.now()}`,
      nom,
      immatriculation: nouveauCamionPlaque.trim(),
      marqueModele: nouveauCamionModele.trim(),
      annee: "",
      actif: true,
      notes: "",
    };
    setParcCamions((prev) => [...(prev || []), nouveau]);
    sauvegarderCamion(nouveau).catch(() =>
      ajouterJournal(`⚠️ Camion « ${nom} » ajouté localement, mais NON enregistré (table camions absente ?).`)
    );
    ajouterJournal(`🚚 Camion « ${nom} » ajouté au parc — il apparaît maintenant dans la liste des techniciens.`);
    setAjoutCamionOuvert(false);
    setNouveauCamionNom("");
    setNouveauCamionPlaque("");
    setNouveauCamionModele("");
  };

  // RETRAIT DU PARC (vente, remplacement, bris majeur) : on note le motif
  // et le camion remplaçant. Le dossier reste consultable dans « Anciens
  // véhicules » avec tout son historique d'inspections et d'entretiens.
  const retirerCamion = (c, motif, remplacePar) => {
    const maj = { ...c, actif: false, retireLe: todayISO(), motifRetrait: motif || "", remplacePar: remplacePar || "" };
    setParcCamions((prev) => (prev || []).map((x) => (x.id === c.id ? maj : x)));
    sauvegarderCamion(maj).catch(() => {});
    ajouterJournal(
      `🚫 Camion « ${c.nom} » retiré du parc${motif ? ` — ${motif}` : ""}${remplacePar ? ` · remplacé par ${remplacePar}` : ""}. Son dossier reste consultable dans « Anciens véhicules ».`
    );
    setRetraitCamion(null);
  };

  const remettreCamion = (c) => {
    const maj = { ...c, actif: true, retireLe: null, motifRetrait: "", remplacePar: "" };
    setParcCamions((prev) => (prev || []).map((x) => (x.id === c.id ? maj : x)));
    sauvegarderCamion(maj).catch(() => {});
    ajouterJournal(`🚚 Camion « ${c.nom} » remis en service — de nouveau proposé aux techniciens.`);
  };

  // Résumé d'historique d'un camion (pour le dossier des anciens véhicules).
  const historiqueCamion = (nom) => {
    const ins = inspections.filter((i) => i.camion === nom);
    const ent = entretiens.filter((e) => e.camion === nom);
    const kms = ins.filter((i) => i.km != null).map((i) => i.km);
    return {
      nbInspections: ins.length,
      nbAnomalies: ins.filter((i) => i.anomalie).length,
      dernierKm: kms.length ? Math.max(...kms) : null,
      derniereInspection: ins.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null,
      nbEntretiens: ent.length,
      dernierEntretien: ent.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null,
    };
  };
  const statutEntretien = (camion) => {
    const kmList = inspections.filter((i) => i.camion === camion && i.km != null).map((i) => i.km);
    const kmActuel = kmList.length ? Math.max(...kmList) : 0;
    const dernier = entretiens.filter((e) => e.camion === camion).sort((a, b) => b.date.localeCompare(a.date))[0];
    const kmDernier = dernier ? dernier.km : 0;
    const ecartKm = kmActuel - kmDernier;
    const mois = dernier ? moisDepuis(dernier.date) : Infinity;
    const duKm = ecartKm >= SEUIL_ENTRETIEN_KM;
    const duMois = mois >= SEUIL_ENTRETIEN_MOIS;
    return { camion, kmActuel, ecartKm, mois, du: duKm || duMois, raison: duKm ? "km" : duMois ? "temps" : null };
  };
  // Note : la version courte « marquer l'entretien fait » a été retirée.
  // Elle remettait le compteur à zéro SANS rien écrire au carnet du
  // véhicule — donc sans description, sans coût, sans garage. C'est
  // `confirmerTravaux` qui fait les deux, et c'est le seul chemin.

  const confirmerCharge = (i) => {
    if (!noteCharge.trim()) return;
    // Mise à jour locale immédiate + écriture Supabase (statut + note).
    setInspections((prev) => prev.map((x) => (x.id === i.id ? { ...x, statutAnomalie: "prise_en_charge", noteCharge: noteCharge.trim(), prisParNom: "l'administrateur" } : x)));
    persisterPriseEnCharge?.(i.id, noteCharge.trim());
    ajouterJournal(`🛠️ Anomalie ${i.camion} prise en charge — ${noteCharge.trim()}`);
    setChargeId(null);
    setNoteCharge("");
  };

  const liste = inspections
    .filter((i) => (filtreDate ? i.date === filtreDate : true))
    .filter((i) => (filtreCamion.trim() ? (i.camion || "").toLowerCase().includes(filtreCamion.trim().toLowerCase()) : true))
    .filter((i) => (filtreStatut === "anomalie" ? i.anomalie : filtreStatut === "ok" ? !i.anomalie : true))
    .slice()
    // TRI : les anomalies NON PRISES EN CHARGE remontent TOUJOURS en tête,
    // peu importe leur date — sinon une anomalie de mardi non traitée se
    // retrouvait sous les inspections normales de mercredi. Entre elles,
    // la PLUS ANCIENNE d'abord (celle qui attend depuis le plus longtemps).
    // Le reste des inspections suit, de la plus récente à la plus ancienne.
    .sort((a, b) => {
      const ouverte = (i) => i.anomalie && i.statutAnomalie !== "prise_en_charge" && i.statutAnomalie !== "reparee";
      const urgenceA = ouverte(a) ? 1 : 0;
      const urgenceB = ouverte(b) ? 1 : 0;
      if (urgenceA !== urgenceB) return urgenceB - urgenceA;
      if (urgenceA === 1) return a.date.localeCompare(b.date); // la plus ancienne en premier
      return b.date.localeCompare(a.date);
    });

  // Le conducteur déclaré par un passager a-t-il vraiment un camion ce
  // jour-là ? Si lui-même s'est déclaré « sans véhicule » (ou passager),
  // quelque chose cloche — mieux vaut une petite alerte ici qu'une
  // erreur silencieuse dans les coûts et la facturation.
  const conducteurIncoherent = (i) => {
    if (!i.passagerDeNom) return false;
    const duJour = inspections.filter((x) => x.date === i.date && x.technicienNom === i.passagerDeNom);
    if (duJour.length === 0) return false; // pas encore inspecté — normal le matin
    return !duJour.some((x) => !x.sansVehicule && x.camion);
  };
  const badgeStatut = (i) => {
    if (i.passagerDeNom)
      return (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
          👥 Passager de {i.passagerDeNom}
          {conducteurIncoherent(i) ? " · ⚠️ conducteur sans camion ?" : ""}
        </span>
      );
    if (i.sansVehicule) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Sans véhicule</span>;
    if (!i.anomalie) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">OK</span>;
    if (i.statutAnomalie === "reparee") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✅ Réparée</span>;
    if (i.statutAnomalie === "prise_en_charge") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pris en charge</span>;
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">⚠ Anomalie · nouvelle</span>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <h2 className="text-lg font-extrabold text-slate-900">Inspections véhicules</h2>

      {/* ÉTAT DES VÉHICULES — une carte par camion réunissant SON anomalie
          (et la mesure prise) ET son entretien périodique. Trié par
          urgence : anomalie non traitée → prise en charge / entretien dû
          → conforme. Remplace l'ancienne section « Entretien périodique ». */}
      {(() => {
        const etats = camions
          .map((nom) => {
            const insCamion = inspections.filter((i) => i.camion === nom);
            const derniere = insCamion.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
            // Une anomalie RÉPARÉE est close : elle ne compte ni comme
            // ouverte, ni comme « prise en charge ».
            const anomaliesOuvertes = insCamion
              .filter((i) => i.anomalie && i.statutAnomalie !== "prise_en_charge" && i.statutAnomalie !== "reparee")
              .sort((a, b) => a.date.localeCompare(b.date));
            const anomaliesPrises = insCamion
              .filter((i) => i.anomalie && i.statutAnomalie === "prise_en_charge")
              .sort((a, b) => b.date.localeCompare(a.date));
            const ent = statutEntretien(nom);
            const priorite = anomaliesOuvertes.length > 0 ? 0 : anomaliesPrises.length > 0 || ent.du ? 1 : 2;
            return { nom, derniere, anomaliesOuvertes, anomaliesPrises, ent, priorite };
          })
          .sort((a, b) => a.priorite - b.priorite || a.nom.localeCompare(b.nom));
        const nbAnomalie = etats.filter((e) => e.anomaliesOuvertes.length > 0).length;
        const nbPris = etats.filter((e) => e.anomaliesOuvertes.length === 0 && e.anomaliesPrises.length > 0).length;
        const nbEntretien = etats.filter((e) => e.ent.du).length;
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🚚 État des véhicules</h3>
              <Button variant="outline" onClick={() => setParcOuvert((v) => !v)} className="min-h-0 gap-1 px-2 py-1 text-[11px]">
                {parcOuvert ? "Fermer" : "Gérer le parc"}
              </Button>
            </div>
            <p className="mb-3 text-[11px] text-slate-400">
              {nbAnomalie} en anomalie · {nbPris} pris en charge · {nbEntretien} entretien{nbEntretien > 1 ? "s" : ""} dû{nbEntretien > 1 ? "s" : ""} · {etats.length} camion{etats.length > 1 ? "s" : ""} au parc
            </p>

            {/* GESTION DU PARC — ajout/retrait des camions proposés aux techniciens. */}
            {parcOuvert && (
              <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Parc de véhicules</p>
                {(parcCamions || []).length === 0 && camionsHorsParc.length === 0 && (
                  <p className="text-xs text-slate-400">Aucun camion enregistré — ajoute-en un ci-dessous.</p>
                )}
                {(parcCamions || []).filter((c) => c.actif).map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">{c.nom}</p>
                        <p className="text-[10px] text-slate-400">{[c.marqueModele, c.immatriculation].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() =>
                            setIndispoCamion(
                              indispoCamion?.camionId === c.id
                                ? null
                                : { camionId: c.id, debut: dateISO(new Date()), fin: "", raison: "Au garage", note: "" }
                            )
                          }
                          className="rounded-md border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-700"
                        >
                          🔧 Indisponible…
                        </button>
                        <button
                          onClick={() => {
                            setRetraitCamion(c);
                            setMotifRetrait("");
                            setRemplacePar("");
                          }}
                          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600"
                        >
                          Retirer du parc…
                        </button>
                      </div>
                    </div>
                    {camionIndisponible(c) && (
                      <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-800">
                        🔧 Indisponible{c.indispoRaison ? ` — ${c.indispoRaison}` : ""} du {c.indispoDebut}
                        {c.indispoFin ? ` au ${c.indispoFin}` : " (durée indéterminée)"}
                        {c.indispoNote ? ` · ${c.indispoNote}` : ""}
                        <button
                          onClick={() => leverIndispo(c)}
                          className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white active:scale-95"
                        >
                          Remettre en service
                        </button>
                      </p>
                    )}
                    {indispoCamion?.camionId === c.id && (
                      <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                        <p className="text-[11px] font-bold text-amber-900">Déclarer « {c.nom} » indisponible</p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="mb-0.5 block text-[9px] font-bold text-amber-700">Du</label>
                            <input type="date" value={indispoCamion.debut} onChange={(e) => setIndispoCamion((p) => ({ ...p, debut: e.target.value }))} className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[9px] font-bold text-amber-700">Au (vide = indéterminé)</label>
                            <input type="date" value={indispoCamion.fin} onChange={(e) => setIndispoCamion((p) => ({ ...p, fin: e.target.value }))} className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                        <select
                          value={indispoCamion.raison}
                          onChange={(e) => setIndispoCamion((p) => ({ ...p, raison: e.target.value }))}
                          className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold"
                        >
                          {["Au garage", "Accidenté", "Prêté", "Autre"].map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input
                          value={indispoCamion.note}
                          onChange={(e) => setIndispoCamion((p) => ({ ...p, note: e.target.value }))}
                          placeholder="Note (ex : freins, retour prévu jeudi)"
                          className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
                        />
                        <div className="mt-2 flex gap-1.5">
                          <Button onClick={declarerIndispo} disabled={!indispoCamion.debut} className="min-h-0 flex-1 py-1.5 text-[11px]">
                            Confirmer l'indisponibilité
                          </Button>
                          <Button variant="outline" onClick={() => setIndispoCamion(null)} className="min-h-0 py-1.5 text-[11px]">
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* SAISIE DU RETRAIT — motif + camion remplaçant. */}
                    {retraitCamion?.id === c.id && (
                      <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                        <p className="text-[11px] font-bold text-amber-900">Retirer « {c.nom} » du parc</p>
                        <p className="mt-0.5 text-[10px] text-amber-700">
                          Il disparaîtra de la liste des techniciens, mais son dossier complet (inspections, anomalies, entretiens) restera consultable dans « Anciens véhicules ».
                        </p>
                        <div className="mt-2 space-y-1.5">
                          <select
                            value={motifRetrait}
                            onChange={(e) => setMotifRetrait(e.target.value)}
                            className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold"
                          >
                            <option value="">— Motif du retrait —</option>
                            <option value="Remplacé par un nouveau véhicule">Remplacé par un nouveau véhicule</option>
                            <option value="Vendu">Vendu</option>
                            <option value="Fin de location">Fin de location</option>
                            <option value="Bris majeur / hors service">Bris majeur / hors service</option>
                            <option value="Accident">Accident</option>
                            <option value="Autre">Autre</option>
                          </select>
                          <select
                            value={remplacePar}
                            onChange={(e) => setRemplacePar(e.target.value)}
                            className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">— Remplacé par (optionnel) —</option>
                            {(parcCamions || []).filter((x) => x.actif && x.id !== c.id).map((x) => (
                              <option key={x.id} value={x.nom}>{x.nom}</option>
                            ))}
                          </select>
                          <div className="flex gap-1.5">
                            <Button onClick={() => retirerCamion(c, motifRetrait, remplacePar)} disabled={!motifRetrait} className="min-h-0 flex-1 py-1.5 text-[11px]">
                              Confirmer le retrait
                            </Button>
                            <Button variant="outline" onClick={() => setRetraitCamion(null)} className="min-h-0 py-1.5 text-[11px]">
                              Annuler
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {camionsHorsParc.length > 0 && (
                  <p className="rounded-lg bg-amber-50 p-2 text-[10px] font-semibold text-amber-700">
                    ⚠️ Camions vus dans des inspections mais absents du parc : {camionsHorsParc.join(", ")} — ajoute-les pour qu'ils apparaissent dans la liste des techniciens.
                  </p>
                )}
                {!ajoutCamionOuvert ? (
                  <button
                    onClick={() => setAjoutCamionOuvert(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-2 py-2 text-xs font-bold text-slate-600 active:scale-[0.99]"
                  >
                    ➕ Ajouter un nouveau véhicule
                  </button>
                ) : (
                  <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">➕ Ajout d'un nouveau véhicule</p>
                      <button onClick={() => setAjoutCamionOuvert(false)}><X size={14} className="text-slate-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={nouveauCamionNom} onChange={(e) => setNouveauCamionNom(e.target.value)} placeholder="Nom / numéro *" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
                      <input value={nouveauCamionPlaque} onChange={(e) => setNouveauCamionPlaque(e.target.value)} placeholder="Immatriculation" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
                      <input value={nouveauCamionModele} onChange={(e) => setNouveauCamionModele(e.target.value)} placeholder="Marque / modèle" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
                      <Button variant="outline" onClick={ajouterCamion} disabled={!nouveauCamionNom.trim()} className="min-h-0 py-1.5 text-xs">
                        <Plus size={12} /> Ajouter le camion
                      </Button>
                    </div>
                    {/* POURQUOI le bouton est gris — toujours le dire. */}
                    {!nouveauCamionNom.trim() && (
                      <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                        ✋ Inscris au moins le « Nom / numéro » du camion (ex. : C-08) — le bouton s&apos;activera.
                      </p>
                    )}
                  </div>
                )}

                {/* ANCIENS VÉHICULES — dossiers conservés : coordonnées du
                    camion, motif du retrait, remplaçant, et tout son
                    historique d'inspections et d'entretiens. */}
                {(parcCamions || []).some((c) => !c.actif) && (
                  <div className="mt-3 border-t border-slate-200 pt-2.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      🗄️ Anciens véhicules ({(parcCamions || []).filter((c) => !c.actif).length})
                    </p>
                    <div className="space-y-1.5">
                      {(parcCamions || [])
                        .filter((c) => !c.actif)
                        .sort((a, b) => (b.retireLe || "").localeCompare(a.retireLe || ""))
                        .map((c) => {
                          const h = historiqueCamion(c.nom);
                          const ouvert = dossierAncienId === c.id;
                          return (
                            <div key={c.id} className="rounded-lg border border-slate-200 bg-white">
                              <button
                                onClick={() => setDossierAncienId(ouvert ? null : c.id)}
                                className="flex w-full items-center justify-between gap-2 p-2 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700">{c.nom}</p>
                                  <p className="text-[10px] text-slate-400">
                                    Retiré {c.retireLe || "—"}
                                    {c.motifRetrait ? ` · ${c.motifRetrait}` : ""}
                                    {c.remplacePar ? ` · remplacé par ${c.remplacePar}` : ""}
                                  </p>
                                </div>
                                <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${ouvert ? "rotate-180" : ""}`} />
                              </button>
                              {ouvert && (
                                <div className="space-y-1.5 border-t border-slate-100 p-2.5 text-[11px] text-slate-600">
                                  <p><span className="font-bold text-slate-700">Véhicule :</span> {[c.marqueModele, c.immatriculation].filter(Boolean).join(" · ") || "—"}</p>
                                  <p><span className="font-bold text-slate-700">Dernier kilométrage :</span> {h.dernierKm != null ? `${h.dernierKm.toLocaleString("fr-CA")} km` : "inconnu"}</p>
                                  <p><span className="font-bold text-slate-700">Inspections :</span> {h.nbInspections} au total{h.nbAnomalies > 0 ? ` · ${h.nbAnomalies} avec anomalie` : ""}</p>
                                  <p><span className="font-bold text-slate-700">Dernière inspection :</span> {h.derniereInspection ? `${h.derniereInspection.date}${h.derniereInspection.technicienNom ? ` par ${h.derniereInspection.technicienNom}` : ""}` : "aucune"}</p>
                                  <p><span className="font-bold text-slate-700">Entretiens :</span> {h.nbEntretiens} au total{h.dernierEntretien ? ` · dernier le ${h.dernierEntretien.date} (${h.dernierEntretien.km?.toLocaleString("fr-CA")} km)` : ""}</p>
                                  {/* CARNET conservé même après le retrait du parc. */}
                                  {entreesCarnetDe(c.nom).length > 0 && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                        📖 Carnet ({entreesCarnetDe(c.nom).length} entrées · {entreesCarnetDe(c.nom).reduce((s, x) => s + (x.cout || 0), 0).toFixed(2)} $ au total)
                                      </p>
                                      <div className="mt-1 space-y-0.5">
                                        {entreesCarnetDe(c.nom)
                                          .slice()
                                          .sort((a, b) => b.date.localeCompare(a.date))
                                          .map((entree) => (
                                            <p key={entree.id} className="text-[10px] text-slate-600">
                                              <span className="tabular-nums text-slate-400">{entree.date}</span> · {entree.type === "reparation" ? "🔴" : "🔵"} {entree.description}
                                              {entree.cout != null ? ` · ${entree.cout.toFixed(2)} $` : ""}
                                            </p>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex gap-1.5 pt-1">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setFiltreCamion(c.nom);
                                        setFiltreStatut("tous");
                                        setFiltreDate("");
                                      }}
                                      className="min-h-0 py-1.5 text-[11px]"
                                    >
                                      Voir ses inspections
                                    </Button>
                                    <Button variant="outline" onClick={() => remettreCamion(c)} className="min-h-0 py-1.5 text-[11px]">
                                      Remettre en service
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {etats.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun véhicule au parc — clique « Gérer le parc » pour en ajouter.</p>
            ) : (
              // TUILES DE SURVEILLANCE — l'essentiel seulement, scannable
              // d'un coup d'œil. Le détail, les formulaires et le carnet
              // vivent dans la fenêtre « Dossier du véhicule » (au clic).
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {etats.map((e) => {
                  const alerte = e.anomaliesOuvertes[0];
                  return (
                    <button
                      key={e.nom}
                      onClick={() => setDossierCamion(e.nom)}
                      title="Ouvrir le dossier du véhicule"
                      className={`rounded-xl border border-l-4 p-3 text-left transition-shadow hover:shadow-md ${
                        e.priorite === 0
                          ? "border-slate-200 border-l-red-500 bg-red-50"
                          : e.priorite === 1
                          ? "border-slate-200 border-l-amber-500 bg-amber-50"
                          : "border-slate-200 border-l-emerald-500 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <p className="text-sm font-extrabold text-slate-900">{e.nom}</p>
                        <div className="flex flex-wrap gap-1">
                          {e.anomaliesOuvertes.length > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-extrabold text-red-700">
                              ⚠️ ANOMALIE{e.anomaliesOuvertes.length > 1 ? ` ×${e.anomaliesOuvertes.length}` : ""}
                            </span>
                          )}
                          {e.anomaliesOuvertes.length === 0 && e.anomaliesPrises.length > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-700">🛠️ PRIS EN CHARGE</span>
                          )}
                          {e.ent.du && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold text-blue-700">🔧 ENTRETIEN DÛ</span>}
                          {e.priorite === 2 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">✓ CONFORME</span>}
                        </div>
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                        {e.ent.kmActuel > 0 ? `${e.ent.kmActuel.toLocaleString("fr-CA")} km` : "km inconnu"}
                        {e.derniere ? ` · inspection : ${e.derniere.date}` : " · jamais inspecté"}
                      </p>
                      {/* UNE SEULE ligne d'alerte — le détail est dans le dossier. */}
                      {alerte ? (
                        <p className="mt-1.5 truncate text-[11px] font-semibold text-red-700">
                          {alerte.remarque || (alerte.controleProblemes || []).join(", ") || "Anomalie signalée"} — en attente depuis {joursDepuis(alerte.date)} j
                        </p>
                      ) : e.anomaliesPrises.length > 0 ? (
                        <p className="mt-1.5 truncate text-[11px] text-amber-700">
                          {e.anomaliesPrises.length} anomalie{e.anomaliesPrises.length > 1 ? "s" : ""} en cours de règlement
                        </p>
                      ) : e.ent.du ? (
                        <p className="mt-1.5 truncate text-[11px] text-blue-700">
                          Entretien dû — {e.ent.raison === "km" ? `${e.ent.ecartKm.toLocaleString("fr-CA")} km depuis le dernier` : `dernier il y a ${e.ent.mois} mois`}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-400">Aucune anomalie · entretien à jour</p>
                      )}
                      <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                        Ouvrir le dossier ›{entreesCarnetDe(e.nom).length > 0 ? ` · 📖 ${entreesCarnetDe(e.nom).length} au carnet` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* INSPECTIONS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Inspections</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <input type="date" value={filtreDate} onChange={(e) => setFiltreDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <input value={filtreCamion} onChange={(e) => setFiltreCamion(e.target.value)} placeholder="Rechercher un camion" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold">
            <option value="tous">Tous les statuts</option>
            <option value="anomalie">Anomalies</option>
            <option value="ok">OK</option>
          </select>
        </div>
        {liste.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">Aucune inspection.</p>
        ) : (
          <div className="space-y-2">
            {liste.map((i) => (
              <div key={i.id} className={`rounded-lg p-3 ${i.anomalie && i.statutAnomalie === "nouvelle" ? "border-l-4 border-red-500 bg-red-50" : i.anomalie ? "border border-amber-200 bg-amber-50" : "border border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{i.sansVehicule ? "— (sans véhicule)" : i.camion}</p>
                    <p className="text-[11px] text-slate-400">{i.date} · {i.technicienNom}{i.km != null ? ` · ${i.km.toLocaleString("fr-CA")} km` : ""}</p>
                  </div>
                  {badgeStatut(i)}
                </div>
                {i.anomalie && (
                  <p className="mt-1.5 text-[12px] text-red-700">{i.remarque}{i.controleProblemes.length ? ` · ${i.controleProblemes.join(", ")}` : ""}</p>
                )}
                <PhotosInspection photos={i.photos} />
                {i.anomalie && i.statutAnomalie === "nouvelle" && (
                  chargeId === i.id ? (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-2.5">
                      <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Action effectuée (obligatoire)</label>
                      <textarea rows={2} value={noteCharge} onChange={(e) => setNoteCharge(e.target.value)} placeholder="Décris ce qui a été fait / à faire…" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                      <div className="mt-2 flex gap-2">
                        <Button onClick={() => confirmerCharge(i)} disabled={!noteCharge.trim()} className="min-h-0 py-1.5 text-xs">Confirmer la prise en charge</Button>
                        <Button variant="outline" onClick={() => setChargeId(null)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => setChargeId(i.id)} className="mt-2 min-h-0 py-1.5 text-xs">Prendre en charge</Button>
                  )
                )}
                {i.statutAnomalie === "prise_en_charge" && (
                  <p className="mt-1.5 text-[11px] text-amber-700"><span className="font-bold">Action :</span> {i.noteCharge} — par {i.prisParNom || "l'administrateur"}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CARNET D'ENTRETIEN DU PARC — tout ce qui a été fait sur TOUS les
          camions (réparations + entretiens), avec le total dépensé par
          véhicule : utile en fin d'année pour décider quel camion
          remplacer. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <button
          onClick={() => setCarnetOuvert(carnetOuvert === "global" ? null : "global")}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">📖 Carnet d'entretien du parc</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {(carnet || []).length} intervention{(carnet || []).length > 1 ? "s" : ""} enregistrée{(carnet || []).length > 1 ? "s" : ""}
              {(carnet || []).length > 0 ? ` · ${(carnet || []).reduce((s, x) => s + (x.cout || 0), 0).toFixed(2)} $ au total` : ""}
            </p>
          </div>
          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${carnetOuvert === "global" ? "rotate-180" : ""}`} />
        </button>
        {carnetOuvert === "global" && (
          (carnet || []).length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              Aucune intervention enregistrée — les réparations et entretiens confirmés depuis les cartes de véhicules apparaîtront ici.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {[...new Set((carnet || []).map((e) => e.camion))].sort().map((nomCamion) => {
                const entrees = entreesCarnetDe(nomCamion).slice().sort((a, b) => b.date.localeCompare(a.date));
                const total = entrees.reduce((s, x) => s + (x.cout || 0), 0);
                const nbRep = entrees.filter((x) => x.type === "reparation").length;
                const nbEnt = entrees.filter((x) => x.type === "entretien").length;
                return (
                  <div key={nomCamion} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-slate-900">{nomCamion}</p>
                      <p className="text-[11px] font-bold tabular-nums text-slate-700">
                        {nbRep} réparation{nbRep > 1 ? "s" : ""} · {nbEnt} entretien{nbEnt > 1 ? "s" : ""} · <span className="text-slate-900">{total.toFixed(2)} $</span>
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {entrees.map((entree) => (
                        <div key={entree.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                          <p className="min-w-0 text-[11px]">
                            <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${entree.type === "reparation" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                              {entree.type === "reparation" ? "RÉPARATION" : "ENTRETIEN"}
                            </span>
                            <span className="font-semibold text-slate-800">{entree.description}</span>
                            <span className="block text-[10px] text-slate-400">
                              {entree.date}
                              {entree.km ? ` · ${entree.km.toLocaleString("fr-CA")} km` : ""}
                              {entree.garage ? ` · ${entree.garage}` : ""}
                              {entree.parNom ? ` · par ${entree.parNom}` : ""}
                            </span>
                          </p>
                          {entree.cout != null && (
                            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-700">{entree.cout.toFixed(2)} $</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ============================================================
          DOSSIER DU VÉHICULE — ouvert au clic sur une tuile. Trois
          onglets : État actuel (avec TOUTES les actions), Carnet
          d'entretien, Historique des inspections. La tuile reste ainsi
          une simple vue de surveillance.
          ============================================================ */}
      {dossierCamion && (() => {
        const nom = dossierCamion;
        const insCamion = inspections.filter((i) => i.camion === nom);
        const ouvertes = insCamion
          .filter((i) => i.anomalie && i.statutAnomalie !== "prise_en_charge" && i.statutAnomalie !== "reparee")
          .sort((a, b) => a.date.localeCompare(b.date));
        const prises = insCamion
          .filter((i) => i.anomalie && i.statutAnomalie === "prise_en_charge")
          .sort((a, b) => b.date.localeCompare(a.date));
        const ent = statutEntretien(nom);
        const fiche = (parcCamions || []).find((c) => c.nom === nom);
        const entrees = entreesCarnetDe(nom).slice().sort((a, b) => b.date.localeCompare(a.date));
        const totalCarnet = entrees.reduce((s, x) => s + (x.cout || 0), 0);
        const fermer = () => {
          setDossierCamion(null);
          setTravauxSaisie(null);
          setChargeId(null);
          setOngletDossier("etat");
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (fermer)(); }}>
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" onClick={(ev) => ev.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">🚚 {nom}</h3>
                  <p className="text-[11px] text-slate-500">
                    {[fiche?.marqueModele, fiche?.immatriculation].filter(Boolean).join(" · ") || "Aucune information de véhicule"}
                    {ent.kmActuel > 0 ? ` · ${ent.kmActuel.toLocaleString("fr-CA")} km` : ""}
                  </p>
                </div>
                <button onClick={fermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
              </div>

              {/* ONGLETS */}
              <div className="mb-3 flex rounded-xl border border-slate-200 p-0.5">
                {[
                  ["etat", `État actuel${ouvertes.length > 0 ? ` (${ouvertes.length})` : ""}`],
                  ["carnet", `📖 Carnet (${entrees.length})`],
                  ["inspections", `Inspections (${insCamion.length})`],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setOngletDossier(id)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold ${ongletDossier === id ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ---------- ÉTAT ACTUEL ---------- */}
              {ongletDossier === "etat" && (
                <div className="space-y-2.5">
                  {ouvertes.length === 0 && prises.length === 0 && !ent.du && (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
                      ✓ Aucune anomalie · entretien à jour ({Math.max(0, SEUIL_ENTRETIEN_KM - ent.ecartKm).toLocaleString("fr-CA")} km restants)
                    </p>
                  )}

                  {/* ANOMALIES OUVERTES */}
                  {ouvertes.map((a) => (
                    <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-red-700">Anomalie signalée</p>
                      <p className="text-sm font-bold text-red-700">{a.remarque || (a.controleProblemes || []).join(", ") || "Anomalie signalée"}</p>
                      <p className="text-[11px] text-slate-500">
                        {(a.controleProblemes || []).join(", ")}
                        {a.technicienNom ? ` · par ${a.technicienNom}` : ""} · {a.date}
                      </p>
                      <p className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">
                        ⏳ En attente depuis {joursDepuis(a.date)} jour{joursDepuis(a.date) > 1 ? "s" : ""}
                      </p>
                      {chargeId === a.id ? (
                        <div className="mt-2 rounded-lg border border-slate-300 bg-white p-2">
                          <textarea
                            value={noteCharge}
                            onChange={(ev) => setNoteCharge(ev.target.value)}
                            rows={2}
                            placeholder="Mesure prise (ex : pièce commandée, réparation prévue vendredi)"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <div className="mt-1.5 flex gap-1.5">
                            <Button onClick={() => confirmerCharge(a)} disabled={!noteCharge.trim()} className="min-h-0 flex-1 py-1.5 text-xs">Confirmer</Button>
                            <Button variant="outline" onClick={() => setChargeId(null)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
                          </div>
                        </div>
                      ) : (
                        <Button onClick={() => { setChargeId(a.id); setNoteCharge(""); }} className="mt-2 w-full min-h-0 py-2 text-xs">
                          🛠️ Prendre en charge…
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* ANOMALIES PRISES EN CHARGE — à clore par « Réparation faite ». */}
                  {prises.map((a) => (
                    <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[10px] font-extrabold uppercase text-amber-700">Anomalie · prise en charge</p>
                      <p className="text-sm font-bold text-amber-800">{a.remarque || (a.controleProblemes || []).join(", ") || "Anomalie signalée"}</p>
                      <p className="text-[11px] text-slate-500">
                        {(a.controleProblemes || []).join(", ")}
                        {a.technicienNom ? ` · par ${a.technicienNom}` : ""} · {a.date}
                      </p>
                      <p className="mt-1.5 text-xs text-slate-700"><span className="font-bold">Mesure prise :</span> {a.noteCharge || "—"}</p>
                      {a.prisParNom && <p className="text-[10px] text-slate-400">par {a.prisParNom}</p>}
                      {travauxSaisie?.inspectionId === a.id ? (
                        <div className="mt-2 rounded-lg border border-slate-300 bg-white p-2.5">
                          <p className="text-xs font-bold text-slate-800">✅ Réparation faite</p>
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              value={travDescription}
                              onChange={(ev) => setTravDescription(ev.target.value)}
                              rows={2}
                              placeholder="Ce qui a été fait (ex : ampoule + fusible remplacés)"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input type="text" inputMode="decimal" value={travCout} onChange={(ev) => setTravCout(ev.target.value)} placeholder="Coût $ (optionnel)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                              <input value={travGarage} onChange={(ev) => setTravGarage(ev.target.value)} placeholder="Garage / fournisseur" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                            </div>
                            <p className="text-[10px] text-slate-400">Enregistré au carnet le {todayISO()}{ent.kmActuel > 0 ? ` · ${ent.kmActuel.toLocaleString("fr-CA")} km` : ""}.</p>
                            <div className="flex gap-1.5">
                              <Button onClick={confirmerTravaux} disabled={!travDescription.trim()} className="min-h-0 flex-1 py-1.5 text-xs">Confirmer</Button>
                              <Button variant="outline" onClick={() => setTravauxSaisie(null)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => { setTravauxSaisie({ type: "reparation", camion: nom, inspectionId: a.id, km: ent.kmActuel }); setTravDescription(""); setTravCout(""); setTravGarage(""); }}
                          className="mt-2 w-full min-h-0 py-2 text-xs"
                        >
                          ✅ Réparation faite…
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* ENTRETIEN PÉRIODIQUE */}
                  <div className={`rounded-xl border p-3 ${ent.du ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
                    <p className={`text-[10px] font-extrabold uppercase ${ent.du ? "text-blue-700" : "text-slate-400"}`}>Entretien périodique</p>
                    <p className="text-xs text-slate-700">
                      {ent.du
                        ? `Dû — ${ent.raison === "km" ? `${ent.ecartKm.toLocaleString("fr-CA")} km depuis le dernier` : `dernier entretien il y a ${ent.mois} mois`}`
                        : `À jour · ${Math.max(0, SEUIL_ENTRETIEN_KM - ent.ecartKm).toLocaleString("fr-CA")} km restants`}
                    </p>
                    {travauxSaisie?.type === "entretien" && travauxSaisie.camion === nom ? (
                      <div className="mt-2 rounded-lg border border-slate-300 bg-white p-2.5">
                        <p className="text-xs font-bold text-slate-800">🔧 Entretien fait</p>
                        <div className="mt-1.5 space-y-1.5">
                          <textarea
                            value={travDescription}
                            onChange={(ev) => setTravDescription(ev.target.value)}
                            rows={2}
                            placeholder="Ce qui a été fait (ex : huile, filtres, inspection freins)"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <input type="text" inputMode="decimal" value={travCout} onChange={(ev) => setTravCout(ev.target.value)} placeholder="Coût $ (optionnel)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                            <input value={travGarage} onChange={(ev) => setTravGarage(ev.target.value)} placeholder="Garage / fournisseur" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          </div>
                          <p className="text-[10px] text-slate-400">Enregistré au carnet le {todayISO()}{ent.kmActuel > 0 ? ` · ${ent.kmActuel.toLocaleString("fr-CA")} km` : ""}.</p>
                          <div className="flex gap-1.5">
                            <Button onClick={confirmerTravaux} disabled={!travDescription.trim()} className="min-h-0 flex-1 py-1.5 text-xs">Confirmer</Button>
                            <Button variant="outline" onClick={() => setTravauxSaisie(null)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => { setTravauxSaisie({ type: "entretien", camion: nom, inspectionId: null, km: ent.kmActuel }); setTravDescription(""); setTravCout(""); setTravGarage(""); }}
                        className="mt-2 w-full min-h-0 py-2 text-xs"
                      >
                        🔧 Entretien fait…
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ---------- CARNET ---------- */}
              {ongletDossier === "carnet" && (
                entrees.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    Aucune intervention au carnet — les réparations et entretiens confirmés apparaîtront ici.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {entrees.map((entree) => (
                      <div key={entree.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-xs">
                            <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${entree.type === "reparation" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                              {entree.type === "reparation" ? "RÉPARATION" : "ENTRETIEN"}
                            </span>
                            <span className="font-semibold text-slate-800">{entree.description}</span>
                          </p>
                          {entree.cout != null && <span className="shrink-0 text-xs font-bold tabular-nums text-slate-700">{entree.cout.toFixed(2)} $</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {entree.date}
                          {entree.km ? ` · ${entree.km.toLocaleString("fr-CA")} km` : ""}
                          {entree.garage ? ` · ${entree.garage}` : ""}
                          {entree.parNom ? ` · par ${entree.parNom}` : ""}
                        </p>
                      </div>
                    ))}
                    <p className="pt-1 text-right text-xs font-bold text-slate-700">Total dépensé sur ce véhicule : {totalCarnet.toFixed(2)} $</p>
                  </div>
                )
              )}

              {/* ---------- INSPECTIONS ---------- */}
              {ongletDossier === "inspections" && (
                insCamion.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">Aucune inspection pour ce véhicule.</p>
                ) : (
                  <div className="space-y-1.5">
                    {insCamion
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((i) => (
                        <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-800">
                              {i.date}
                              {i.technicienNom ? ` · ${i.technicienNom}` : ""}
                            </p>
                            {badgeStatut(i)}
                          </div>
                          <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                            {i.km != null ? `${i.km.toLocaleString("fr-CA")} km` : "km non saisi"}
                          </p>
                          {i.anomalie && (
                            <p className="mt-1 text-[11px] text-slate-600">
                              {i.remarque || (i.controleProblemes || []).join(", ")}
                              {i.noteCharge ? ` — mesure : ${i.noteCharge}` : ""}
                            </p>
                          )}
                          {/* Photos prises par le technicien — c'est ici,
                              dans le dossier du véhicule, qu'on veut les
                              retrouver avec la fiche d'inspection. */}
                          <PhotosInspection photos={i.photos} />
                        </div>
                      ))}
                  </div>
                )
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

