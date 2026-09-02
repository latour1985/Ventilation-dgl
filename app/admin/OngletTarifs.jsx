"use client";

// app/admin/OngletTarifs.jsx
//
// TARIFS (grille CCQ, liste de prix des dépôts, catalogue d'items) —
// tranche T6 du découpage de page.jsx (2026-08-28). Mécanique.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { ZONES_DEPOTS, supprimerZoneDepot } from "@/lib/supabase/prixDepots";
import { taxesDepot } from "@/lib/supabase/depots";
import { listerCatalogueRetires, margePourcent, profitDollars, vendantPourMarge } from "@/lib/supabase/catalogue";
import { listerItemsQbo } from "@/lib/quickbooksClient";
import { itemsDepuisCsv, itemsDepuisLignes } from "@/lib/importCatalogue";
import { Button, correspond, tauxAffiche, zonesEffectives, METIERS_BUREAU, METIERS_TERRAIN, NIVEAUX_CCQ_DEFAUT, metiersTerrainDe, niveauxPourMetier, ITEMS_PAR_PAGE, BarrePagination } from "./partage";

// ============================================================
// ONGLET TARIFS — grille des taux horaires + liste de prix des dépôts
// (modification réservée à l'Admin principal, consultation sinon)
// ============================================================
export function OngletTarifs({ tauxMetiers, setTauxMetiers, tauxMetiersRes, setTauxMetiersRes, onSauvegarderTaux, prixDepots, setPrixDepots, onSauvegarderPrixDepots, estAdminPrincipal, ajouterJournal, catalogue, onEnregistrerItem, onImporterItems, onDesactiverItem, onReactiverItem, onSauvegarderCoutCamion, metiersMasques = [], onMasquerMetier }) {
  // Taux de taxes des Paramètres — pour afficher les prix taxes incluses.
  const configEnt = useEntreprise();
  // État du bouton « Sauvegarder la liste de prix » (dépôts par zone).
  const [etatPrix, setEtatPrix] = useState("");
  // Confirmation avant d'appliquer la nouvelle liste de prix.
  const [confirmationPrixOuverte, setConfirmationPrixOuverte] = useState(false);
  // Le message d'erreur EXACT de la base — pour ne plus jamais deviner.
  const [erreurPrix, setErreurPrix] = useState("");
  const sauvegarderLesPrix = async () => {
    setConfirmationPrixOuverte(false);
    setEtatPrix("enregistrement");
    try {
      await onSauvegarderPrixDepots?.();
      setEtatPrix("ok");
      ajouterJournal("💰 Liste de prix des dépôts (zones) sauvegardée");
      setTimeout(() => setEtatPrix(""), 2500);
    } catch (e) {
      // La VRAIE raison à l'écran — l'ancien message fixe (« vérifie le
      // SQL 08 ») envoyait sur une fausse piste quand la table existait
      // mais que l'écriture était refusée (vécu : clé « zone » partagée
      // entre entreprises avant le snippet 107).
      setErreurPrix(String(e?.message || ""));
      setEtatPrix("erreur");
    }
  };
  // État du bouton « Sauvegarder les taux » : "" | "enregistrement" | "ok" | "erreur"
  const [etatTaux, setEtatTaux] = useState("");
  // Fenêtre de confirmation avant d'appliquer la grille (les taux
  // touchent les coûts de main-d'œuvre — on valide avant d'écrire).
  const [confirmationTauxOuverte, setConfirmationTauxOuverte] = useState(false);
  const [erreurTaux, setErreurTaux] = useState("");
  const sauvegarderLesTaux = async () => {
    setConfirmationTauxOuverte(false);
    setEtatTaux("enregistrement");
    try {
      await onSauvegarderTaux?.();
      setEtatTaux("ok");
      ajouterJournal("💰 Grille des taux horaires coûtants sauvegardée");
      setTimeout(() => setEtatTaux(""), 2500);
    } catch (e) {
      setErreurTaux(String(e?.message || ""));
      setEtatTaux("erreur");
    }
  };

  // ➕ AJOUTER UN MÉTIER — le nom est nettoyé et dédoublonné ; le métier
  // naît avec les niveaux CCQ standards, tous à 0 $.
  // 🗺️ Ajout d'une zone d'appels (zones dynamiques par entreprise).
  // Le bouton reste TOUJOURS cliquable (retour du propriétaire : un
  // bouton grisé sans explication laisse croire que c'est brisé) — un
  // clic à vide met le focus dans le champ et affiche la marche à suivre.
  const [nouvelleZoneNom, setNouvelleZoneNom] = useState("");
  const [guideZoneVisible, setGuideZoneVisible] = useState(false);
  const refChampZone = useRef(null);
  const CLES_CONFIG_INTERDITES = ["taux_horaire_vendant", "minutes_incluses", "minutes_incluses_hors_zone"];
  const [nouveauMetier, setNouveauMetier] = useState("");
  // Ajout par NOM (saisie libre OU pastille de suggestion CCQ) — les
  // nouvelles entreprises partent d'une grille VIDE (retour du
  // propriétaire 2026-09-06) et choisissent leurs métiers ici.
  const ajouterMetierNom = (nom) => {
    const net = String(nom || "").trim().replace(/\s+/g, " ");
    if (!net) return;
    const propre = net.charAt(0).toUpperCase() + net.slice(1);
    // S'il est simplement MASQUÉ : on le réaffiche (taux conservés).
    const masque = (metiersMasques || []).find((m) => m.toLowerCase() === propre.toLowerCase());
    if (masque) {
      onMasquerMetier?.(masque, false);
      ajouterJournal(`🧰 Métier « ${masque} » réaffiché — il était masqué, ses taux sont intacts.`);
      setNouveauMetier("");
      return;
    }
    const dejaLa = [...metiersTerrainDe(tauxMetiers), ...METIERS_BUREAU].some(
      (m) => m.toLowerCase() === propre.toLowerCase()
    );
    if (dejaLa) {
      ajouterJournal(`⚠️ Le métier « ${propre} » existe déjà — rien à ajouter.`);
    } else {
      setTauxMetiers((prev) => ({ ...prev, [propre]: Object.fromEntries(NIVEAUX_CCQ_DEFAUT.map((n) => [n, 0])) }));
      ajouterJournal(`🧰 Métier « ${propre} » ajouté (Apprenti 1-4 + Compagnon, taux à 0) — remplis ses taux puis « Sauvegarder les taux ».`);
    }
    setNouveauMetier("");
  };
  const ajouterMetier = () => ajouterMetierNom(nouveauMetier);
  // 📋 CHOISIR MES MÉTIERS (retour du propriétaire, 2026-09-06 : « un
  // menu déroulant pour sélectionner les métiers nécessaires — un
  // électricien n'a pas besoin de voir Plâtrier ; ça reste accessible
  // au cas où sa compagnie évolue »). Le CATALOGUE = les métiers CCQ
  // courants + tout métier déjà connu de CETTE entreprise (dans la
  // grille ou masqué). Coché = visible ; décoché = masqué, TAUX
  // CONSERVÉS — recochable pour toujours.
  const [choixMetiersOuvert, setChoixMetiersOuvert] = useState(false);
  const catalogueMetiers = (() => {
    const vus = new Map();
    [...METIERS_TERRAIN, ...metiersTerrainDe(tauxMetiers), ...(metiersMasques || [])].forEach((m) => {
      const cle = m.toLowerCase();
      if (!vus.has(cle)) vus.set(cle, m);
    });
    return [...vus.values()];
  })();
  const metiersVisibles = metiersTerrainDe(tauxMetiers, metiersMasques);
  const basculerMetier = (m, visible) => {
    if (visible) {
      onMasquerMetier?.(m, true);
      ajouterJournal(`🧰 Métier « ${m} » retiré de la grille — ses taux sont conservés, recochable en tout temps.`);
    } else {
      // Réaffiche s'il était masqué, sinon le crée (niveaux à 0) —
      // ajouterMetierNom fait déjà les deux et journalise.
      ajouterMetierNom(m);
    }
  };

  // 🚚 COÛT DU CAMION — déménagé ici depuis Paramètres (demande du
  // propriétaire) : tous les COÛTANTS au même endroit. Un seul chiffre :
  // un camion coûte pareil peu importe le métier de celui qui le conduit.
  const [camionValeur, setCamionValeur] = useState(configEnt?.coutCamionHoraire ?? 15);
  const [etatCamion, setEtatCamion] = useState("");
  useEffect(() => {
    setCamionValeur(configEnt?.coutCamionHoraire ?? 15);
  }, [configEnt?.coutCamionHoraire]);
  const sauvegarderCamion = async () => {
    setEtatCamion("enregistrement");
    try {
      await onSauvegarderCoutCamion?.(Number(camionValeur) || 0);
      setEtatCamion("ok");
      setTimeout(() => setEtatCamion(""), 2500);
    } catch {
      setEtatCamion("erreur");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Tarifs</h2>

      {/* CATALOGUE D'ITEMS — replié par défaut : 289 items ne doivent
          pas repousser la grille des taux hors de l'écran. */}
      <SectionCatalogue
        catalogue={catalogue}
        onEnregistrerItem={onEnregistrerItem}
        onImporterItems={onImporterItems}
        onDesactiverItem={onDesactiverItem}
        onReactiverItem={onReactiverItem}
        estAdminPrincipal={estAdminPrincipal}
      />

      {/* TABLE CENTRALE DES TAUX PAR MÉTIER — modification réservée à l'Admin principal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Taux horaires coûtants par métier</p>
        {estAdminPrincipal ? (
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
            Modifie lors des augmentations annuelles, puis clique « Sauvegarder » — appliqué à chaque technicien selon son métier et son niveau.
          </p>
        ) : (
          <p className="mt-0.5 mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
            <Lock size={12} className="shrink-0" /> Consultation seulement — la modification des taux est réservée à l'Admin principal.
          </p>
        )}
        {/* Grille CCQ : métiers de TERRAIN seulement — les métiers de
            bureau ont leur taux individuel sur leur fiche employé.
            La liste est VIVANTE : les fondateurs + tout métier ajouté
            ci-dessous (électricien, plombier…). */}
        {/* 📋 LE SÉLECTEUR DE MÉTIERS — coché = dans la grille ;
            décoché = masqué, taux conservés, recochable pour toujours. */}
        {estAdminPrincipal && (
          <div className="mb-3">
            <Button variant="outline" onClick={() => setChoixMetiersOuvert(!choixMetiersOuvert)} className="min-h-0 gap-1 px-3 py-1.5 text-xs">
              📋 Choisir mes métiers {choixMetiersOuvert ? "▲" : "▼"}
            </Button>
            {choixMetiersOuvert && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[10px] leading-snug text-slate-500">
                  Coche les métiers de TON domaine. Un métier décoché disparaît de la grille mais reste ici —
                  ses taux sont conservés, tu le recoches le jour où ta compagnie évolue.
                </p>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {catalogueMetiers.map((m) => {
                    const visible = metiersVisibles.some((x) => x.toLowerCase() === m.toLowerCase());
                    return (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${visible ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => basculerMetier(m, visible)}
                          className="h-3.5 w-3.5 accent-[#131B2E]"
                        />
                        {m}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                  <input
                    value={nouveauMetier}
                    onChange={(e) => setNouveauMetier(e.target.value)}
                    placeholder="Autre métier (hors liste)…"
                    className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <Button onClick={ajouterMetier} disabled={!nouveauMetier.trim()} className="min-h-0 px-3 py-1.5 text-xs">
                    Ajouter
                  </Button>
                  <p className="w-full text-[10px] text-slate-400">
                    Un métier ajouté arrive avec ses niveaux (Apprenti 1-4 + Compagnon) et des taux à 0 $ —
                    remplis-les puis clique « Sauvegarder les taux ».
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {metiersVisibles.length === 0 && (
          <p className="mb-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[11px] text-slate-500">
            Aucun métier pour l&apos;instant — clique « 📋 Choisir mes métiers » et coche ceux de TON domaine.
            Chaque métier arrive avec ses niveaux (Apprenti 1-4 + Compagnon) à remplir.
          </p>
        )}
        {metiersTerrainDe(tauxMetiers, metiersMasques).map((m) => (
          <div key={m} className="mb-3 last:mb-0">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-700">{m}</p>
              {estAdminPrincipal && (
                <button
                  onClick={() => onMasquerMetier?.(m, true)}
                  className="text-[9px] font-semibold text-slate-300 underline underline-offset-2 hover:text-slate-500"
                  title="Masquer ce métier de la grille — ses taux sont conservés, réaffichable en un clic"
                >
                  masquer
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {niveauxPourMetier(m).map((niv) => (
                <div key={niv}>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">{niv}</label>
                  <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
                    {/* InputNombreDecimal (et non un champ « number » du
                        navigateur) : les champs number refusent le point
                        ou la virgule selon la langue du navigateur — la
                        saisie des centimes devenait impossible. Ici,
                        44.50 ET 44,50 passent. */}
                    <InputNombreDecimal
                      valeur={Number(tauxMetiers[m]?.[niv]) || 0}
                      disabled={!estAdminPrincipal}
                      onChange={(v) => setTauxMetiers((prev) => ({ ...prev, [m]: { ...prev[m], [niv]: v } }))}
                      className="w-full border-0 bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
                    />
                    <span className="shrink-0 text-[9px] font-bold text-slate-400" title="Commercial / institutionnel">COM</span>
                    <span className="mx-1 text-slate-200">|</span>
                    {/* SECTEUR RÉSIDENTIEL — le même compagnon, l'autre
                        taux CCQ. Laissé à 0 = retombe sur le commercial
                        (jamais une paie à zéro sur une grille à moitié
                        remplie). */}
                    <InputNombreDecimal
                      valeur={Number(tauxMetiersRes?.[m]?.[niv]) || 0}
                      disabled={!estAdminPrincipal}
                      onChange={(v) => setTauxMetiersRes((prev) => ({ ...prev, [m]: { ...(prev?.[m] || {}), [niv]: v } }))}
                      className="w-full border-0 bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
                    />
                    <span className="shrink-0 text-[9px] font-bold text-emerald-600" title="Résidentiel (0 = même taux que commercial)">RÉS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* (L'ancien bloc « Ajouter un métier » + pastilles de
            suggestions vit maintenant DANS le sélecteur ci-dessus.) */}
        {estAdminPrincipal && (
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => setConfirmationTauxOuverte(true)} loading={etatTaux === "enregistrement"} className="min-h-0 px-4 py-2 text-xs">
              💾 Sauvegarder les taux
            </Button>
            {etatTaux === "ok" && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={13} /> Enregistré</span>
            )}
            {etatTaux === "erreur" && (
              <span className="text-xs font-bold text-red-600">
                Échec de la sauvegarde{erreurTaux ? ` — la base répond : « ${erreurTaux} »` : ""} — vérifie que le SQL « 107 - cles par entreprise » a été lancé, puis réessaie.
              </span>
            )}
          </div>
        )}
      </div>

      {/* CONFIRMATION — sauvegarde de la grille des taux */}
      {confirmationTauxOuverte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setConfirmationTauxOuverte(false))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={18} className="text-amber-600" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Modifier les taux horaires ?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Cette sauvegarde <span className="font-bold">modifie les taux horaires coûtants des employés</span> selon
                  leur métier et leur niveau. Elle s'appliquera aux <span className="font-bold">travaux saisis à partir de
                  maintenant</span> — les travaux déjà enregistrés conservent leur taux d'origine (taux figé).
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmationTauxOuverte(false)} className="min-h-0 py-2 text-xs">
                Annuler
              </Button>
              <Button onClick={sauvegarderLesTaux} className="min-h-0 py-2 text-xs">
                Confirmer la sauvegarde
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 🚚 COÛT DU CAMION — un coûtant comme les taux, donc rangé avec
          eux. UNE seule valeur pour toute la flotte : figée chaque matin
          sur l'inspection, donc un changement ici ne touche que demain. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🚚 Coût du camion</p>
        <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
          Ajouté au coûtant de chaque heure (chantier et transport) des journées où le technicien a un camion.
          Sert aussi au taux du 2ᵉ technicien passager ({(Number(prixDepots?.taux_horaire_vendant) || 0) > 0 ? `${(Number(prixDepots.taux_horaire_vendant) - (Number(camionValeur) || 0)).toFixed(2)} $/h au lieu de ${Number(prixDepots.taux_horaire_vendant).toFixed(2)}` : "taux vendant − coût du camion"} $/h).
          Les journées déjà enregistrées gardent leur ancien coût (figé à l'inspection du matin).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex w-40 items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
            <InputNombreDecimal
              valeur={Number(camionValeur) || 0}
              disabled={!estAdminPrincipal}
              onChange={(v) => setCamionValeur(v)}
              className="w-full border-0 bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
            />
            <span className="text-[10px] text-slate-400">$/h</span>
          </div>
          {estAdminPrincipal && (
            <Button onClick={sauvegarderCamion} loading={etatCamion === "enregistrement"} className="min-h-0 px-4 py-2 text-xs">
              💾 Sauvegarder
            </Button>
          )}
          {etatCamion === "ok" && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={13} /> Enregistré</span>}
          {etatCamion === "erreur" && <span className="text-xs font-bold text-red-600">Échec — réessaie</span>}
        </div>
      </div>

      {/* LISTE DE PRIX — DÉPÔTS D'APPELS DE SERVICE (par zone) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Liste de prix — dépôts d'appels de service</p>
        {estAdminPrincipal ? (
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
            Montants HT par zone — proposés dans la liste déroulante à la création d'une tâche. « Hors zone » = tarif sur mesure, saisi manuellement.
          </p>
        ) : (
          <p className="mt-0.5 mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
            <Lock size={12} className="shrink-0" /> Consultation seulement — modification réservée à l'Admin principal.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {zonesEffectives(prixDepots).map((zone) => (
            <div key={zone}>
              <label className="mb-0.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
                {zone}
                {estAdminPrincipal && (
                  <button
                    onClick={() => {
                      if (!window.confirm(`Retirer la zone « ${zone} » ? Les tâches existantes gardent leur étiquette.`)) return;
                      setPrixDepots((prev) => {
                        const suivant = { ...prev };
                        delete suivant[zone];
                        return suivant;
                      });
                      supprimerZoneDepot(zone).catch(() => {});
                      ajouterJournal(`🗺️ Zone « ${zone} » retirée de la liste de prix des appels.`);
                    }}
                    className="text-slate-300 hover:text-red-500"
                    title="Retirer cette zone"
                  >
                    ✕
                  </button>
                )}
              </label>
              <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
                <InputNombreDecimal
                  valeur={Number(prixDepots?.[zone]) || 0}
                  disabled={!estAdminPrincipal}
                  onChange={(v) => setPrixDepots((prev) => ({ ...prev, [zone]: v }))}
                  className="w-full border-0 bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
                />
                <span className="text-[10px] text-slate-400">$ HT</span>
              </div>
            </div>
          ))}
        </div>
        {estAdminPrincipal && (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={refChampZone}
                value={nouvelleZoneNom}
                onChange={(e) => { setNouvelleZoneNom(e.target.value); if (e.target.value.trim()) setGuideZoneVisible(false); }}
                placeholder="Nom de la nouvelle zone — ex : Zone 5 (Rive-Sud)"
                className={`min-w-[170px] flex-1 rounded-lg border px-2 py-1.5 text-xs ${guideZoneVisible ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-300"}`}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const nom = nouvelleZoneNom.trim();
                  if (!nom || CLES_CONFIG_INTERDITES.includes(nom)) {
                    // Clic à vide : on GUIDE au lieu de bloquer.
                    setGuideZoneVisible(true);
                    refChampZone.current?.focus();
                    return;
                  }
                  setGuideZoneVisible(false);
                  setPrixDepots((prev) => ({ ...prev, [nom]: prev[nom] ?? 0 }));
                  setNouvelleZoneNom("");
                  ajouterJournal(`🗺️ Zone « ${nom} » ajoutée — fixe son prix puis « Sauvegarder la liste de prix ».`);
                }}
                className="min-h-0 px-3 py-1.5 text-xs"
              >
                ➕ Ajouter une zone
              </Button>
            </div>
            {guideZoneVisible && (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                ✍️ Écris d&apos;abord le nom de la zone dans le champ à gauche (ex : « Zone 5 (Rive-Sud) »), puis clique sur « Ajouter une zone ».
              </p>
            )}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-400">🗺️ Hors zone : pas de prix fixe — l'option « tarif sur mesure » de la liste déroulante ouvre la saisie manuelle. Chaque entreprise crée SES zones — rien n'est figé.</p>

        {/* TEMPS INCLUS + TAUX VENDANT (dépassement facturable) */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Zones 1-2-3 — temps inclus CHEZ LE CLIENT (min)</label>
            <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
              <input
                type="number"
                min={0}
                step="5"
                value={prixDepots?.minutes_incluses ?? 90}
                disabled={!estAdminPrincipal}
                onChange={(e) => setPrixDepots((prev) => ({ ...prev, minutes_incluses: e.target.value }))}
                className="w-full bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
              />
              <span className="text-[10px] text-slate-400">min</span>
            </div>
            <p className="mt-0.5 text-[9px] text-slate-400">Le transport est déjà inclus dans le prix de zone.</p>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Hors zone — temps inclus TOTAL (min)</label>
            <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
              <input
                type="number"
                min={0}
                step="15"
                value={prixDepots?.minutes_incluses_hors_zone ?? 180}
                disabled={!estAdminPrincipal}
                onChange={(e) => setPrixDepots((prev) => ({ ...prev, minutes_incluses_hors_zone: e.target.value }))}
                className="w-full bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
              />
              <span className="text-[10px] text-slate-400">min</span>
            </div>
            <p className="mt-0.5 text-[9px] text-slate-400">
              Transport aller-retour depuis l&apos;adresse de l&apos;entreprise (Paramètres{configEnt?.adresse ? ` — ${configEnt.adresse}` : ""}) + temps sur place.
            </p>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Taux horaire VENDANT technicien</label>
            <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
              <InputNombreDecimal
                valeur={Number(prixDepots?.taux_horaire_vendant) || 0}
                disabled={!estAdminPrincipal}
                onChange={(v) => setPrixDepots((prev) => ({ ...prev, taux_horaire_vendant: v }))}
                className="w-full border-0 bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
              />
              <span className="text-[10px] text-slate-400">$/h</span>
            </div>
          </div>
          {/* 👥 APPEL À 2 HOMMES (2026-09-04, règle du propriétaire) : dès
              2 techniciens facturables, plus de prix de zone ni de temps
              inclus — chaque homme est facturé max(minimum, aller-retour
              + sur place) : chauffeur au taux vendant, assistant au taux
              vendant moins le camion. */}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Appel à 2 hommes — minimum d&apos;heures</label>
            <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
              <input
                type="number"
                min={0}
                step="0.5"
                value={prixDepots?.minimum_heures_2_hommes ?? 3}
                disabled={!estAdminPrincipal}
                onChange={(e) => setPrixDepots((prev) => ({ ...prev, minimum_heures_2_hommes: e.target.value }))}
                className="w-full bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
              />
              <span className="text-[10px] text-slate-400">h</span>
            </div>
            <p className="mt-0.5 text-[9px] text-slate-400">
              Chaque homme : max(minimum, aller-retour + sur place). Chauffeur au taux vendant, assistant (passager) au taux vendant − camion. Remplace le prix de zone dès 2 hommes facturables.
            </p>
          </div>
          {/* 🔧 TEMPS & MATÉRIEL à 2 hommes facturables (2026-09-04,
              règle du propriétaire) : minimum PAR HOMME ; à 1 seul
              facturable, heures réelles sans minimum. */}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Temps &amp; matériel — minimum d&apos;heures par homme</label>
            <div className={`flex items-center rounded-lg border px-2 ${estAdminPrincipal ? "border-slate-300" : "border-slate-200 bg-slate-50"}`}>
              <input
                type="number"
                min={0}
                step="0.5"
                value={prixDepots?.minimum_heures_2_hommes_tm ?? 3}
                disabled={!estAdminPrincipal}
                onChange={(e) => setPrixDepots((prev) => ({ ...prev, minimum_heures_2_hommes_tm: e.target.value }))}
                className="w-full bg-transparent py-1.5 text-xs outline-none disabled:text-slate-400"
              />
              <span className="text-[10px] text-slate-400">h</span>
            </div>
            <p className="mt-0.5 text-[9px] text-slate-400">
              Appliqué PAR homme facturable : technicien SEUL sur la job, ou 2+ facturables. Seul cas sans minimum : plusieurs sur place mais un seul facturable (l&apos;autre en 🤝 aide interne). Chauffeur au taux vendant, passager au taux − camion.
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">
          ⏱️ Au-delà du temps inclus, le dépassement devient automatiquement <span className="font-bold">facturable au taux vendant</span> — calculé sur les heures réelles du technicien.
          {Number(prixDepots?.taux_horaire_vendant) > 0 && (
            <span className="ml-1 font-bold tabular-nums text-slate-500">
              ({Number(prixDepots.taux_horaire_vendant).toFixed(2)} $ HT = {taxesDepot(Number(prixDepots.taux_horaire_vendant), configEnt).total.toFixed(2)} $/h taxes incl.)
            </span>
          )}
        </p>
        {estAdminPrincipal && (
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => setConfirmationPrixOuverte(true)} loading={etatPrix === "enregistrement"} className="min-h-0 px-4 py-2 text-xs">
              💾 Sauvegarder la liste de prix
            </Button>
            {etatPrix === "ok" && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={13} /> Enregistré</span>
            )}
            {etatPrix === "erreur" && (
              <span className="text-xs font-bold text-red-600">
                Échec de la sauvegarde{erreurPrix ? ` — la base répond : « ${erreurPrix} »` : ""} — vérifie que le SQL « 107 - cles par entreprise » a été lancé, puis réessaie.
              </span>
            )}
          </div>
        )}
      </div>

      {/* CONFIRMATION — sauvegarde de la liste de prix des dépôts */}
      {confirmationPrixOuverte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setConfirmationPrixOuverte(false))(); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={18} className="text-amber-600" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Modifier la liste de prix des dépôts ?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Ces montants seront proposés dans la liste déroulante des dépôts d'appels de service
                  (zones 1, 2 et 3), <span className="font-bold">pour toutes les nouvelles tâches</span>.
                  Les dépôts déjà créés conservent leur montant d'origine.
                </p>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs tabular-nums text-slate-700">
                  {ZONES_DEPOTS.map((z) => (
                    <p key={z}><span className="font-bold">{z} :</span> {(Number(prixDepots?.[z]) || 0).toFixed(2)} $ HT ({taxesDepot(Number(prixDepots?.[z]) || 0, configEnt).total.toFixed(2)} $ taxes incl.)</p>
                  ))}
                  <p className="mt-1 border-t border-slate-200 pt-1"><span className="font-bold">Zones — temps chez le client :</span> {Number(prixDepots?.minutes_incluses) || 0} min · <span className="font-bold">Hors zone — temps total :</span> {Number(prixDepots?.minutes_incluses_hors_zone) || 0} min</p>
                  <p><span className="font-bold">Taux vendant :</span> {(Number(prixDepots?.taux_horaire_vendant) || 0).toFixed(2)} $/h HT ({taxesDepot(Number(prixDepots?.taux_horaire_vendant) || 0, configEnt).total.toFixed(2)} $/h taxes incl.)</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmationPrixOuverte(false)} className="min-h-0 py-2 text-xs">
                Annuler
              </Button>
              <Button onClick={sauvegarderLesPrix} className="min-h-0 py-2 text-xs">
                Confirmer la sauvegarde
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ============================================================
// CATALOGUE D'ITEMS — liste de prix (onglet Tarifs)
// ------------------------------------------------------------
// 289 items importés de QuickBooks : impossible d'afficher ça en bloc
// sans noyer l'écran. La liste reste donc REPLIÉE et ne montre que ce
// qu'on cherche — recherche instantanée + filtre par catégorie, dans
// une zone qui défile sur une hauteur fixe.
//
// Le prix coûtant est visible ICI et nulle part ailleurs : ni sur les
// devis, ni sur les bons de travail, ni dans l'app technicien.
// ============================================================

// ============================================================
// CATALOGUE D'ITEMS — liste de prix (onglet Tarifs)
// ------------------------------------------------------------
// 289 items importés de QuickBooks : impossible d'afficher ça en bloc
// sans noyer l'écran. La liste reste donc REPLIÉE et ne montre que ce
// qu'on cherche — recherche instantanée + filtre par catégorie, dans
// une zone qui défile sur une hauteur fixe.
//
// Le prix coûtant est visible ICI et nulle part ailleurs : ni sur les
// devis, ni sur les bons de travail, ni dans l'app technicien.
// ============================================================
export function ModalItemCatalogue({ item, categories, onFermer, onEnregistrer }) {
  const [f, setF] = useState({
    nom: item?.nom || "",
    categorie: item?.categorie || "",
    typeItem: item?.typeItem || "materiel",
    unite: item?.unite || "unité",
    prix_coutant: item?.prix_coutant ?? "",
    prix_vendant: item?.prix_vendant ?? "",
    description: item?.description || "",
  });
  const [etat, setEtat] = useState("");
  const [erreur, setErreur] = useState("");
  const maj = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const coutant = f.prix_coutant === "" ? null : Number(f.prix_coutant);
  const vendant = f.prix_vendant === "" ? null : Number(f.prix_vendant);
  const marge = margePourcent(vendant, coutant);
  const profit = profitDollars(vendant, coutant);

  // SAISIE DE LA MARGE → le prix de vente se calcule. C'est le sens
  // « inverse » : on tarife un item neuf à partir de son coût.
  const appliquerMarge = (pct) => {
    const v = vendantPourMarge(coutant, Number(pct));
    if (v != null) maj("prix_vendant", Math.round(v * 100) / 100);
  };

  const enregistrer = async () => {
    if (!f.nom.trim()) { setErreur("Le nom est obligatoire."); return; }
    setEtat("enregistrement");
    setErreur("");
    try {
      await onEnregistrer({ ...item, ...f });
      onFermer();
    } catch (e) {
      setEtat("");
      setErreur(e?.message || "Échec de l'enregistrement.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-800">{item?.id ? "Modifier l'item" : "Nouvel item"}</h3>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nom *</label>
            <input value={f.nom} onChange={(e) => maj("nom", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none" />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Catégorie</label>
              <input list="cats-catalogue" value={f.categorie} onChange={(e) => maj("categorie", e.target.value)}
                placeholder="Choisir ou écrire"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none" />
              <datalist id="cats-catalogue">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Type</label>
              <select value={f.typeItem} onChange={(e) => maj("typeItem", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none">
                <option value="materiel">Matériel</option>
                <option value="service">Service / forfait</option>
              </select>
            </div>
          </div>

          {/* LES TROIS CHAMPS LIÉS — coûtant, vendant, marge */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Prix et marge</p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Prix coûtant</label>
                <div className="flex items-center rounded-lg border border-slate-300 bg-white px-2">
                  <input type="text" inputMode="decimal" value={f.prix_coutant}
                    onChange={(e) => maj("prix_coutant", e.target.value.replace(",", "."))} placeholder="inconnu"
                    className="w-full bg-transparent py-1.5 text-xs outline-none" />
                  <span className="text-[10px] text-slate-400">$</span>
                </div>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Prix de vente</label>
                <div className="flex items-center rounded-lg border border-slate-300 bg-white px-2">
                  <input type="text" inputMode="decimal" value={f.prix_vendant}
                    onChange={(e) => maj("prix_vendant", e.target.value.replace(",", "."))}
                    className="w-full bg-transparent py-1.5 text-xs outline-none" />
                  <span className="text-[10px] text-slate-400">$</span>
                </div>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Marge visée</label>
                <div className={`flex items-center rounded-lg border bg-white px-2 ${coutant == null ? "border-slate-200" : "border-slate-300"}`}>
                  <input type="number" step="0.1" value={marge != null ? Math.round(marge * 10) / 10 : ""}
                    onChange={(e) => appliquerMarge(e.target.value)}
                    disabled={coutant == null}
                    placeholder={coutant == null ? "—" : ""}
                    className="w-full bg-transparent py-1.5 text-xs outline-none disabled:text-slate-300" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
              </div>
            </div>
            {coutant == null ? (
              <p className="mt-2 text-[10px] leading-snug text-amber-700">
                ⚠️ Sans prix coûtant, aucune marge n&apos;est calculée — un coût vide veut dire <span className="font-bold">inconnu</span>, jamais zéro.
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">
                Profit : <span className="font-extrabold tabular-nums text-emerald-700">{profit != null ? `${profit.toFixed(2)} $` : "—"}</span>
                <span className="ml-2 text-slate-400">marge = (vente − coûtant) ÷ vente</span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Description (apparaît sur le devis)</label>
            <textarea rows={3} value={f.description} onChange={(e) => maj("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none" />
          </div>
        </div>

        {erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">{erreur}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button onClick={enregistrer} loading={etat === "enregistrement"} className="min-h-0 py-2 text-xs">Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}

// SÉLECTEUR D'ITEM AVEC RECHERCHE — remplace la liste déroulante, qui
// tenait pour 5 items de démonstration mais devient inutilisable à 289.
// On tape, on filtre, on clique. Le prix COÛTANT n'apparaît jamais ici :
// ce composant sert à monter des devis et des factures, deux documents
// qui vont chez le client.

export function SectionCatalogue({ catalogue, onEnregistrerItem, onImporterItems, onDesactiverItem, onReactiverItem, estAdminPrincipal }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");
  const [itemModal, setItemModal] = useState(null);
  // RETRAIT — deux clics (le bouton devient « Confirmer ? ») : assez de
  // friction pour éviter l'accident, pas assez pour décourager le ménage.
  const [retraitPour, setRetraitPour] = useState(null);
  // ITEMS RETIRÉS — chargés seulement à l'ouverture du tiroir : 99 % des
  // visites du catalogue n'en ont pas besoin.
  const [retiresOuvert, setRetiresOuvert] = useState(false);
  const [retires, setRetires] = useState(null); // null = pas encore chargés
  const chargerRetires = () => {
    listerCatalogueRetires()
      .then(setRetires)
      .catch(() => setRetires([]));
  };
  const basculerRetires = () => {
    const suivant = !retiresOuvert;
    setRetiresOuvert(suivant);
    if (suivant && retires === null) chargerRetires();
  };
  const retirer = (i) => {
    setRetraitPour(null);
    onDesactiverItem(i);
    // S'il est déjà chargé, le tiroir des retirés l'accueille tout de suite.
    setRetires((prev) => (prev === null ? prev : [...prev, { ...i, actif: false }].sort((a, b) => a.nom.localeCompare(b.nom))));
  };
  const reactiver = (i) => {
    onReactiverItem?.(i);
    setRetires((prev) => (prev === null ? prev : prev.filter((x) => x.id !== i.id)));
  };

  // ============================================================
  // 🔄 MISE À JOUR DEPUIS QUICKBOOKS (2026-08-28)
  // ------------------------------------------------------------
  // Deux exigences du propriétaire, non négociables :
  //   1. JAMAIS de doublon — le lien se fait par qb_item_id, et à défaut
  //      par le NOM normalisé (l'item est alors RACCORDÉ : il reçoit son
  //      qb_item_id pour toutes les synchronisations suivantes).
  //   2. RIEN ne s'écrase sans autorisation — l'analyse LISTE chaque
  //      item qui serait modifié (vendant, coûtant, description :
  //      avant → après) avec une case à cocher ; décocher = garder le
  //      prix ajusté à la main. Le bouton « Appliquer » fait le reste.
  // ============================================================
  const [syncQb, setSyncQb] = useState(null); // null | "analyse" | { nouveaux, modifies, desactives }
  const [syncCoches, setSyncCoches] = useState({});
  const [syncEnCours, setSyncEnCours] = useState(false);
  const [syncErreur, setSyncErreur] = useState("");
  const normaliserNom = (n) =>
    String(n || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const memesPrix = (a, b) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Math.abs(Number(a) - Number(b)) < 0.005;
  };
  const analyserSyncQb = async () => {
    setSyncQb("analyse");
    setSyncErreur("");
    const r = await listerItemsQbo();
    if (!Array.isArray(r?.items)) {
      setSyncQb(null);
      setSyncErreur(
        r?.nonConnecte
          ? "QuickBooks n'est pas connecté — va dans Paramètres pour rebrancher."
          : r?.simule
            ? "Configuration QuickBooks absente sur ce serveur."
            : r?.erreur || "Lecture impossible — réessaie."
      );
      return;
    }
    // Le catalogue complet (actifs + retirés) pour ne JAMAIS recréer en
    // doublon un item qui existe mais a été retiré.
    let listeRetires = retires;
    if (listeRetires === null) {
      listeRetires = await listerCatalogueRetires().catch(() => []);
      setRetires(listeRetires);
    }
    const tous = [...(catalogue || []), ...listeRetires];
    const parQbId = new Map(tous.filter((i) => i.qbItemId).map((i) => [String(i.qbItemId), i]));
    const parNom = new Map();
    tous.forEach((i) => {
      const cle = normaliserNom(i.nom);
      if (cle && !parNom.has(cle)) parNom.set(cle, i);
    });
    const dejaLie = new Set(parQbId.keys());
    const nouveaux = [];
    const modifies = [];
    const qbActifs = new Set();
    r.items.forEach((q) => {
      if (!q.actif) return;
      qbActifs.add(q.qbId);
      const local = parQbId.get(q.qbId) || parNom.get(normaliserNom(q.nom)) || null;
      // Un item Fluxya déjà lié à UN AUTRE qb_item_id ne se fait pas
      // voler par un homonyme — l'homonyme devient un nouvel item.
      if (!local || (local.qbItemId && String(local.qbItemId) !== q.qbId)) {
        if (!local) nouveaux.push(q);
        return;
      }
      // Un item RETIRÉ du catalogue bloque la création en doublon, mais
      // on ne propose pas de le modifier : il a été retiré exprès — le
      // bouton « Remettre au catalogue » existe pour ça.
      if (local.actif === false) return;
      const changements = [];
      if (q.vendant != null && !memesPrix(local.prix_vendant, q.vendant))
        changements.push({ champ: "vendant", avant: local.prix_vendant, apres: q.vendant });
      if (q.coutant != null && !memesPrix(local.prix_coutant, q.coutant))
        changements.push({ champ: "coûtant", avant: local.prix_coutant, apres: q.coutant });
      const descQb = String(q.description || "").trim();
      if (descQb && descQb !== String(local.description || "").trim())
        changements.push({ champ: "description", avant: local.description || "", apres: descQb });
      const raccord = !local.qbItemId;
      if (changements.length > 0) modifies.push({ local, qb: q, changements, raccord });
      else if (raccord) modifies.push({ local, qb: q, changements: [], raccord: true });
    });
    // Items Fluxya liés à un item QuickBooks devenu INACTIF → retrait offert.
    const desactives = (catalogue || []).filter(
      (i) => i.qbItemId && dejaLie.has(String(i.qbItemId)) && r.items.some((q) => q.qbId === String(i.qbItemId)) && !qbActifs.has(String(i.qbItemId))
    );
    const coches = {};
    nouveaux.forEach((q) => { coches["n-" + q.qbId] = true; });
    // Les modifications de prix/description NE SONT PAS pré-cochées :
    // cocher = autoriser explicitement (règle du propriétaire). Les purs
    // raccords (aucun changement) s'appliquent d'office, sans case.
    modifies.forEach((m) => { if (m.changements.length > 0) coches["m-" + m.local.id] = false; });
    desactives.forEach((i) => { coches["d-" + i.id] = false; });
    setSyncCoches(coches);
    setSyncQb({ nouveaux, modifies, desactives });
  };
  // ============================================================
  // 📄 IMPORT D'UNE LISTE DE PRIX (fichier CSV/Excel) — 2026-08-28
  // ------------------------------------------------------------
  // MÊME écran de revue que la synchro QuickBooks (rien ne s'écrase sans
  // autorisation) — seule la SOURCE change. Décidé ainsi parce que lire
  // le catalogue de QuickBooks exige la même connexion OAuth que tout le
  // reste : un fichier, lui, marche pour tous les clients (QuickBooks,
  // Sage, Acomba, tableur) sans dépendre d'un connecteur.
  // ============================================================
  const [sourceMaj, setSourceMaj] = useState("quickbooks"); // "quickbooks" | "csv"
  const refFichierCsv = useRef(null);
  // Le fichier lu reste en mémoire : si une colonne a été mal devinée
  // (« les prix sont à zéro »), on recompose SANS redemander le fichier.
  const [csvBrut, setCsvBrut] = useState(null); // { entetes, donnees }
  const [csvMapping, setCsvMapping] = useState({});
  // Clé de case à cocher : l'identifiant QuickBooks quand il existe,
  // sinon le rang de la ligne dans le fichier.
  const cleDe = (q) => q.qbId || q.cle;
  const analyserFichierCsv = async (fichier) => {
    if (!fichier) return;
    setSyncErreur("");
    setSourceMaj("csv");
    setSyncQb("analyse");
    let texte = "";
    try {
      texte = await fichier.text();
    } catch {
      setSyncQb(null);
      setSyncErreur("Fichier illisible — réessaie avec un export CSV.");
      return;
    }
    const { entetes, donnees, mapping } = itemsDepuisCsv(texte);
    if (!entetes.length || !donnees.length) {
      setSyncQb(null);
      setSyncErreur("Aucune ligne exploitable dans ce fichier.");
      return;
    }
    setCsvBrut({ entetes, donnees });
    setCsvMapping(mapping);
    // Le catalogue COMPLET (actifs + retirés) : on ne recrée jamais en
    // doublon un item qui existe mais a été retiré exprès.
    let listeRetires = retires;
    if (listeRetires === null) {
      listeRetires = await listerCatalogueRetires().catch(() => []);
      setRetires(listeRetires);
    }
    composerDepuisCsv({ entetes, donnees }, mapping, listeRetires);
  };

  // Recompose la revue à partir d'un mapping de colonnes — appelée à la
  // lecture du fichier ET à chaque correction de colonne par l'admin.
  const composerDepuisCsv = (brut, mapping, listeRetires) => {
    if (!brut) return;
    if (mapping.nom === undefined) {
      setSyncQb({ nouveaux: [], modifies: [], desactives: [], lues: 0, ignorees: brut.donnees.length });
      return;
    }
    const { items, ignorees } = itemsDepuisLignes(brut.donnees, mapping);
    const parNom = new Map();
    [...(catalogue || []), ...(listeRetires || [])].forEach((i) => {
      const cle = normaliserNom(i.nom);
      if (cle && !parNom.has(cle)) parNom.set(cle, i);
    });
    const nouveaux = [];
    const modifies = [];
    items.forEach((it, rang) => {
      const commun = {
        cle: `csv-${rang}`,
        nom: it.nom,
        description: it.description,
        type: it.typeItem,
        vendant: it.prix_vendant,
        coutant: it.prix_coutant, // null = INCONNU (jamais 0)
        unite: it.unite,
        categorie: it.categorie,
      };
      const local = parNom.get(normaliserNom(it.nom));
      if (!local) { nouveaux.push(commun); return; }
      if (local.actif === false) return; // retiré exprès — « Remettre au catalogue » existe pour ça
      const changements = [];
      if (commun.vendant != null && !memesPrix(local.prix_vendant, commun.vendant))
        changements.push({ champ: "vendant", avant: local.prix_vendant, apres: commun.vendant });
      if (commun.coutant != null && !memesPrix(local.prix_coutant, commun.coutant))
        changements.push({ champ: "coûtant", avant: local.prix_coutant, apres: commun.coutant });
      const desc = String(commun.description || "").trim();
      if (desc && desc !== String(local.description || "").trim())
        changements.push({ champ: "description", avant: local.description || "", apres: desc });
      if (changements.length > 0) modifies.push({ local, qb: commun, changements, raccord: false });
    });
    const coches = {};
    nouveaux.forEach((q) => { coches["n-" + cleDe(q)] = true; });
    modifies.forEach((m) => { coches["m-" + m.local.id] = false; }); // écraser un prix s'AUTORISE
    setSyncCoches(coches);
    setSyncQb({ nouveaux, modifies, desactives: [], lues: items.length, ignorees });
  };

  const basculerCoche = (cle) => setSyncCoches((p) => ({ ...p, [cle]: !p[cle] }));
  const nbCoches = Object.values(syncCoches).filter(Boolean).length
    + (syncQb && syncQb !== "analyse" ? syncQb.modifies.filter((m) => m.changements.length === 0).length : 0);
  const appliquerSyncQb = async () => {
    if (!syncQb || syncQb === "analyse" || syncEnCours) return;
    setSyncEnCours(true);
    setSyncErreur("");
    // 📦 UN SEUL ENVOI EN LOT (correctif 2026-08-28) : enregistrer 293
    // items un par un — chacun suivi d'une écriture au journal lancée en
    // parallèle — saturait la base et la plupart échouaient. On rassemble
    // tout, on envoie par tranches, et l'erreur RÉELLE s'affiche.
    let ajoutes = 0, ajustes = 0, raccordes = 0, retiresN = 0, echecs = 0;
    const aEnregistrer = [];
    for (const q of syncQb.nouveaux) {
      if (!syncCoches["n-" + cleDe(q)]) continue;
      aEnregistrer.push({
        nom: q.nom,
        description: q.description || "",
        typeItem: q.type === "Service" ? "service" : "materiel",
        prix_vendant: q.vendant,
        prix_coutant: q.coutant,
        actif: true,
        // Import CSV : pas d'identifiant QuickBooks à poser
        // (undefined = la colonne n'est pas touchée).
        qbItemId: q.qbId,
        ...(q.unite ? { unite: q.unite } : {}),
        ...(q.categorie ? { categorie: q.categorie } : {}),
      });
      ajoutes++;
    }
    for (const m of syncQb.modifies) {
      const autorise = m.changements.length === 0 || syncCoches["m-" + m.local.id];
      if (!autorise) {
        // Modification refusée MAIS raccord quand même : le lien
        // qb_item_id se pose sans toucher aux prix ajustés à la main.
        if (m.raccord) { aEnregistrer.push({ ...m.local, qbItemId: m.qb.qbId }); raccordes++; }
        continue;
      }
      const maj = { ...m.local, qbItemId: m.qb.qbId };
      m.changements.forEach((c) => {
        if (c.champ === "vendant") maj.prix_vendant = c.apres;
        if (c.champ === "coûtant") maj.prix_coutant = c.apres;
        if (c.champ === "description") maj.description = c.apres;
      });
      aEnregistrer.push(maj);
      if (m.changements.length > 0) ajustes++; else raccordes++;
    }
    let ignores = [];
    if (aEnregistrer.length > 0) {
      try {
        if (onImporterItems) {
          const sauves = await onImporterItems(aEnregistrer, sourceMaj === "csv" ? "import de liste de prix" : "synchronisation QuickBooks");
          ignores = sauves?.ignores || [];
          ajoutes -= ignores.length > ajoutes ? ajoutes : ignores.length;
        } else {
          // Repli (aucun chemin en lot fourni) : un par un.
          for (const item of aEnregistrer) await onEnregistrerItem(item);
        }
      } catch (e) {
        setSyncEnCours(false);
        setSyncErreur(`Enregistrement refusé : ${e?.message || "erreur inconnue"} — rien n'a été appliqué, réessaie.`);
        return;
      }
    }
    for (const i of syncQb.desactives) {
      if (!syncCoches["d-" + i.id]) continue;
      try { await onDesactiverItem(i); retiresN++; } catch { echecs++; }
    }
    setSyncEnCours(false);
    if (echecs > 0) {
      setSyncErreur(`${echecs} item${echecs > 1 ? "s" : ""} n'ont pas pu être RETIRÉS — relance l'analyse.`);
      return;
    }
    setSyncQb(null);
    if (ignores.length > 0) {
      alert(
        `⚠️ ${ignores.length} item${ignores.length > 1 ? "s" : ""} refusé${ignores.length > 1 ? "s" : ""} : un item porte déjà ce nom.\n\n` +
          ignores.slice(0, 10).join("\n") +
          (ignores.length > 10 ? `\n… et ${ignores.length - 10} autre(s)` : "") +
          "\n\nLe reste a bien été enregistré."
      );
    }
    if (ajoutes + ajustes + raccordes + retiresN === 0) return;
    alert(
      (sourceMaj === "csv" ? "Catalogue mis à jour depuis le fichier :\n" : "Catalogue mis à jour depuis QuickBooks :\n") +
      (ajoutes ? `• ${ajoutes} nouvel${ajoutes > 1 ? "s" : ""} item${ajoutes > 1 ? "s" : ""} ajouté${ajoutes > 1 ? "s" : ""}\n` : "") +
      (ajustes ? `• ${ajustes} item${ajustes > 1 ? "s" : ""} ajusté${ajustes > 1 ? "s" : ""} (prix / description)\n` : "") +
      (raccordes ? `• ${raccordes} item${raccordes > 1 ? "s" : ""} raccordé${raccordes > 1 ? "s" : ""} à QuickBooks (sans changement de prix)\n` : "") +
      (retiresN ? `• ${retiresN} item${retiresN > 1 ? "s" : ""} retiré${retiresN > 1 ? "s" : ""} (inactifs dans QuickBooks)\n` : "")
    );
  };

  const categories = useMemo(
    () => [...new Set((catalogue || []).map((i) => i.categorie).filter(Boolean))].sort(),
    [catalogue]
  );

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (catalogue || [])
      .filter((i) => (categorie ? i.categorie === categorie : true))
      .filter((i) => (q ? `${i.nom} ${i.categorie} ${i.description}`.toLowerCase().includes(q) : true));
  }, [catalogue, recherche, categorie]);

  // Combien d'items n'ont pas de coût — utile à voir d'un coup d'œil,
  // ce sont eux dont la marge reste aveugle.
  const sansCout = (catalogue || []).filter((i) => i.prix_coutant == null).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <button onClick={() => setOuvert(!ouvert)} className="flex w-full items-center justify-between text-left">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Catalogue d&apos;items <span className="text-slate-400">({(catalogue || []).length})</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Liste de prix des devis · prix coûtant visible ici seulement
            {sansCout > 0 && <span className="ml-1 font-semibold text-amber-600">· {sansCout} sans coût</span>}
          </p>
        </div>
        {ouvert ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>

      {ouvert && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[180px] flex-1 items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un item…" className="w-full text-xs outline-none" />
              {recherche && <button onClick={() => setRecherche("")} aria-label="Effacer"><X size={12} className="text-slate-400" /></button>}
            </div>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold outline-none">
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {estAdminPrincipal && (
              <Button onClick={() => setItemModal({})} className="min-h-0 px-3 py-1.5 text-xs">
                <Plus size={13} /> Nouvel item
              </Button>
            )}
            {estAdminPrincipal && (
              <Button
                variant="outline"
                onClick={() => { setSourceMaj("quickbooks"); analyserSyncQb(); }}
                loading={syncQb === "analyse" && sourceMaj === "quickbooks"}
                className="min-h-0 px-3 py-1.5 text-xs"
                title="Compare le catalogue avec les items QuickBooks — rien ne change sans ton accord"
              >
                🔄 Mettre à jour depuis QuickBooks
              </Button>
            )}
            {/* 📄 IMPORT PAR FICHIER — pour toute entreprise, avec ou sans
                connecteur comptable (QuickBooks, Sage, Acomba, tableur). */}
            {estAdminPrincipal && (
              <>
                <input
                  ref={refFichierCsv}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const fichier = e.target.files?.[0];
                    e.target.value = "";
                    analyserFichierCsv(fichier);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => refFichierCsv.current?.click()}
                  loading={syncQb === "analyse" && sourceMaj === "csv"}
                  className="min-h-0 px-3 py-1.5 text-xs"
                  title="Importer une liste de prix exportée de QuickBooks, Sage, Acomba ou d'un tableur — rien ne change sans ton accord"
                >
                  📄 Importer une liste de prix
                </Button>
              </>
            )}
          </div>
          {syncErreur && !syncQb && (
            <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">{syncErreur}</p>
          )}

          <p className="mt-2 text-[10px] text-slate-400">
            {resultats.length} item{resultats.length > 1 ? "s" : ""} affiché{resultats.length > 1 ? "s" : ""}
          </p>

          {/* Hauteur fixe qui défile : la liste ne pousse jamais le reste
              de l'écran, même avec 289 items. */}
          <div className="mt-1 max-h-[380px] overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-2.5 py-1.5 font-bold text-slate-500">Item</th>
                  <th className="px-2 py-1.5 text-right font-bold text-slate-500">Coûtant</th>
                  <th className="px-2 py-1.5 text-right font-bold text-slate-500">Vente</th>
                  <th className="px-2 py-1.5 text-right font-bold text-slate-500">Profit</th>
                  <th className="px-2 py-1.5 text-right font-bold text-slate-500">Marge</th>
                  {estAdminPrincipal && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {resultats.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucun item ne correspond.</td></tr>
                ) : (
                  resultats.slice(0, 200).map((i) => {
                    const m = margePourcent(i.prix_vendant, i.prix_coutant);
                    const p = profitDollars(i.prix_vendant, i.prix_coutant);
                    return (
                      <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-2.5 py-1.5">
                          <p className="font-semibold text-slate-800">{i.nom}</p>
                          {i.categorie && <p className="text-[10px] text-slate-400">{i.categorie}</p>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                          {i.prix_coutant != null ? `${i.prix_coutant.toFixed(2)} $` : <span className="text-amber-500" title="Coût inconnu">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-800">
                          {i.prix_vendant != null ? `${i.prix_vendant.toFixed(2)} $` : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                          {p != null ? `${p.toFixed(2)} $` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${m == null ? "text-slate-300" : m < 0 ? "text-red-600" : "text-slate-700"}`}>
                          {m != null ? `${m.toFixed(1)} %` : "—"}
                        </td>
                        {estAdminPrincipal && (
                          <td className="px-2 py-1.5 text-right">
                            {retraitPour === i.id ? (
                              <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => retirer(i)}
                                  className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-extrabold text-white"
                                >
                                  Retirer ?
                                </button>
                                <button onClick={() => setRetraitPour(null)} className="text-[10px] font-semibold text-slate-400 underline">
                                  Non
                                </button>
                              </span>
                            ) : (
                              <span className="flex items-center justify-end gap-2">
                                <button onClick={() => setItemModal(i)} className="text-slate-400 hover:text-slate-700" aria-label="Modifier">
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setRetraitPour(i.id)}
                                  className="text-slate-300 hover:text-red-600"
                                  aria-label="Retirer du catalogue"
                                  title="Retirer (discontinué / remplacé) — récupérable en tout temps"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {resultats.length > 200 && (
            <p className="mt-1 text-[10px] text-slate-400">200 premiers affichés — affine ta recherche.</p>
          )}

          {/* 🗄️ ITEMS RETIRÉS — discontinués ou remplacés. Jamais
              supprimés : les anciens devis y réfèrent, et un produit
              « discontinué » revient parfois chez le fabricant. */}
          <div className="mt-3 border-t border-slate-100 pt-2">
            <button onClick={basculerRetires} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600">
              {retiresOuvert ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              🗄️ Items retirés{retires !== null ? ` (${retires.length})` : ""}
            </button>
            {retiresOuvert && (
              <div className="mt-2">
                {retires === null ? (
                  <p className="text-[11px] text-slate-400">Chargement…</p>
                ) : retires.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Aucun item retiré — le catalogue est entier.</p>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto rounded-xl border border-slate-200">
                    {retires.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-1.5 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-500 line-through">{i.nom}</p>
                          {i.categorie && <p className="text-[10px] text-slate-400">{i.categorie}</p>}
                        </div>
                        {estAdminPrincipal && (
                          <button
                            onClick={() => reactiver(i)}
                            className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            ↩️ Remettre au catalogue
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {itemModal && (
        <ModalItemCatalogue
          item={itemModal.id ? itemModal : null}
          categories={categories}
          onFermer={() => setItemModal(null)}
          onEnregistrer={onEnregistrerItem}
        />
      )}

      {/* 🔄 FENÊTRE D'ANALYSE — ce que QuickBooks changerait. Les
          nouveaux items sont pré-cochés (aucun risque : rien n'existe) ;
          les MODIFICATIONS ne le sont pas — cocher = autoriser, décocher
          = garder le prix ajusté à la main (le lien QuickBooks se pose
          quand même, sans toucher aux prix). */}
      {syncQb && syncQb !== "analyse" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget || syncEnCours) return; setSyncQb(null); }}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  {sourceMaj === "csv" ? "📄 Import d'une liste de prix" : "🔄 Mise à jour depuis QuickBooks"}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Rien n&apos;est encore modifié — coche ce que tu autorises, puis « Appliquer ».
                  {sourceMaj === "csv" && syncQb.lues != null && (
                    <> {syncQb.lues} ligne{syncQb.lues > 1 ? "s" : ""} lue{syncQb.lues > 1 ? "s" : ""} dans le fichier
                      {syncQb.ignorees > 0 ? `, ${syncQb.ignorees} ignorée${syncQb.ignorees > 1 ? "s" : ""} (sans nom ou en double)` : ""}.</>
                  )}
                </p>
              </div>
              <button onClick={() => !syncEnCours && setSyncQb(null)} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pt-3">
              {/* 🧭 LES COLONNES RECONNUES — visibles ET corrigeables.
                  Sans ce panneau, une colonne de prix au nom inattendu
                  passait inaperçue et TOUT s'importait à zéro. */}
              {sourceMaj === "csv" && csvBrut && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    🧭 Colonnes de ton fichier <span className="font-semibold normal-case text-slate-400">— corrige si une est mal devinée</span>
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {[
                      ["nom", "Nom du produit *"],
                      ["prix_vendant", "Prix de vente"],
                      ["prix_coutant", "Coûtant"],
                      ["unite", "Unité"],
                      ["categorie", "Catégorie"],
                      ["description", "Description"],
                    ].map(([champ, libelle]) => (
                      <label key={champ} className="flex items-center gap-1.5 text-[11px]">
                        <span className={`w-[92px] shrink-0 font-bold ${champ === "nom" && csvMapping.nom === undefined ? "text-red-600" : "text-slate-600"}`}>{libelle}</span>
                        <select
                          value={csvMapping[champ] === undefined ? "" : String(csvMapping[champ])}
                          onChange={(e) => {
                            const suivant = { ...csvMapping };
                            if (e.target.value === "") delete suivant[champ];
                            else suivant[champ] = Number(e.target.value);
                            setCsvMapping(suivant);
                            composerDepuisCsv(csvBrut, suivant, retires);
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-[11px]"
                        >
                          <option value="">— aucune —</option>
                          {csvBrut.entetes.map((e, i) => (
                            <option key={i} value={i}>{e || `(colonne ${i + 1})`}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  {csvMapping.nom === undefined && (
                    <p className="mt-1.5 text-[11px] font-bold text-red-600">
                      Choisis la colonne qui contient le NOM des produits pour continuer.
                    </p>
                  )}
                  {csvMapping.prix_vendant === undefined && csvMapping.nom !== undefined && (
                    <p className="mt-1.5 text-[11px] font-bold text-amber-700">
                      ⚠️ Aucune colonne de prix de vente — les items entreraient SANS prix. Choisis-la ci-dessus si elle existe.
                    </p>
                  )}
                  {/* Un aperçu de la 1re ligne : la preuve que la lecture est bonne. */}
                  {csvMapping.nom !== undefined && csvBrut.donnees[0] && (
                    <p className="mt-1.5 truncate text-[10px] text-slate-500">
                      1<sup>re</sup> ligne lue : <span className="font-semibold">{csvBrut.donnees[0][csvMapping.nom]}</span>
                      {csvMapping.prix_vendant !== undefined && <> · vente <span className="font-semibold">{csvBrut.donnees[0][csvMapping.prix_vendant] || "—"}</span></>}
                      {csvMapping.prix_coutant !== undefined && <> · coûtant <span className="font-semibold">{csvBrut.donnees[0][csvMapping.prix_coutant] || "—"}</span></>}
                    </p>
                  )}
                </div>
              )}

              {syncQb.nouveaux.length === 0 && syncQb.modifies.length === 0 && syncQb.desactives.length === 0 && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
                  ✅ Le catalogue est déjà à jour — rien à importer, rien à ajuster.
                </p>
              )}

              {syncQb.nouveaux.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    ➕ Nouveaux items {sourceMaj === "csv" ? "du fichier" : "QuickBooks"} ({syncQb.nouveaux.length}) <span className="font-semibold normal-case text-slate-400">— absents du catalogue, pré-cochés</span>
                  </p>
                  <div className="max-h-[200px] overflow-y-auto rounded-xl border border-slate-200">
                    {syncQb.nouveaux.map((q) => (
                      <label key={cleDe(q)} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-2.5 py-1.5 last:border-0 hover:bg-slate-50">
                        <input type="checkbox" checked={!!syncCoches["n-" + cleDe(q)]} onChange={() => basculerCoche("n-" + cleDe(q))} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-800">{q.nom}</span>
                          {q.description && <span className="block truncate text-[10px] text-slate-400">{q.description}</span>}
                        </span>
                        <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-600">
                          {q.coutant != null && <span className="mr-2 text-slate-400">coûtant {q.coutant.toFixed(2)} $</span>}
                          {q.vendant != null ? <span className="font-bold">{q.vendant.toFixed(2)} $</span> : "—"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {syncQb.modifies.filter((m) => m.changements.length > 0).length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
                    ✏️ Modifications proposées ({syncQb.modifies.filter((m) => m.changements.length > 0).length}) <span className="font-semibold normal-case text-slate-400">— cocher = autoriser {sourceMaj === "csv" ? "le fichier" : "QuickBooks"} à écraser</span>
                  </p>
                  <div className="max-h-[240px] overflow-y-auto rounded-xl border border-amber-200">
                    {syncQb.modifies.filter((m) => m.changements.length > 0).map((m) => (
                      <label key={m.local.id} className="flex cursor-pointer items-start gap-2.5 border-b border-amber-100 px-2.5 py-2 last:border-0 hover:bg-amber-50/50">
                        <input type="checkbox" checked={!!syncCoches["m-" + m.local.id]} onChange={() => basculerCoche("m-" + m.local.id)} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-800">{m.local.nom}</span>
                          {m.changements.map((c) => (
                            <span key={c.champ} className="block text-[10px] text-slate-500">
                              {c.champ === "description" ? (
                                <>description : <span className="text-slate-400 line-through">{String(c.avant || "—").slice(0, 60) || "—"}</span> → <span className="font-semibold text-slate-700">{String(c.apres).slice(0, 60)}</span></>
                              ) : (
                                <>{c.champ} : <span className="tabular-nums text-slate-400 line-through">{c.avant != null ? `${Number(c.avant).toFixed(2)} $` : "—"}</span> → <span className="font-bold tabular-nums text-slate-800">{Number(c.apres).toFixed(2)} $</span></>
                              )}
                            </span>
                          ))}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    Un item décoché garde ses prix tels quels — il est seulement relié à QuickBooks pour les prochaines fois.
                  </p>
                </div>
              )}

              {syncQb.modifies.filter((m) => m.changements.length === 0).length > 0 && (
                <p className="text-[10px] text-slate-400">
                  🔗 {syncQb.modifies.filter((m) => m.changements.length === 0).length} item{syncQb.modifies.filter((m) => m.changements.length === 0).length > 1 ? "s" : ""} identique{syncQb.modifies.filter((m) => m.changements.length === 0).length > 1 ? "s" : ""} ser{syncQb.modifies.filter((m) => m.changements.length === 0).length > 1 ? "ont" : "a"} simplement relié{syncQb.modifies.filter((m) => m.changements.length === 0).length > 1 ? "s" : ""} à QuickBooks (aucun prix ne change).
                </p>
              )}

              {syncQb.desactives.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    🗄️ Inactifs dans QuickBooks ({syncQb.desactives.length}) <span className="font-semibold normal-case text-slate-400">— cocher = retirer du catalogue (récupérable)</span>
                  </p>
                  <div className="max-h-[160px] overflow-y-auto rounded-xl border border-slate-200">
                    {syncQb.desactives.map((i) => (
                      <label key={i.id} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-2.5 py-1.5 last:border-0 hover:bg-slate-50">
                        <input type="checkbox" checked={!!syncCoches["d-" + i.id]} onChange={() => basculerCoche("d-" + i.id)} className="shrink-0" />
                        <span className="truncate text-xs font-semibold text-slate-700">{i.nom}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {syncErreur && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">{syncErreur}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-5 pt-3">
              <Button variant="outline" onClick={() => setSyncQb(null)} disabled={syncEnCours} className="min-h-0 py-2 text-xs">Annuler</Button>
              <Button onClick={appliquerSyncQb} loading={syncEnCours} disabled={nbCoches === 0} className="min-h-0 py-2 text-xs">
                Appliquer ({nbCoches})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ONGLET PARAMÈTRES — la fiche d'identité de l'entreprise
// ------------------------------------------------------------
// Tout ce qui était écrit en dur dans le code (adresse, téléphone,
// numéros TPS/TVQ/RBQ, taux de taxes, règles de paie) se règle ici.
// Trois onglets pour ne pas noyer l'écran :
//   1. Entreprise          — ce qui s'imprime en haut des documents
//   2. Taxes & facturation  — ce qui entre dans les calculs d'argent
//   3. Paie & heures        — les règles de l'onglet « Heures de la semaine »
//
// Sauvegarde EXPLICITE avec confirmation (même logique que Tarifs) :
// ces valeurs partent chez les clients et dans les paies, on ne les
// modifie pas par accident en cliquant à côté.
//
// Réservé à l'Admin principal — les autres consultent seulement.
// ============================================================
// Un champ des Paramètres (étiquette + saisie + aide facultative).
// Défini au niveau du fichier — voir la note dans OngletParametres.
