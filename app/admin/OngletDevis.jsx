"use client";

// app/admin/OngletDevis.jsx
//
// DEVIS (montage, lignes du catalogue, versions, envoi au client) —
// tranche T10 du découpage de page.jsx (2026-09-01). Extraction
// MÉCANIQUE : aucun comportement ne change, le code est déplacé tel
// quel — seuls des export/import s'ajoutent.

import { useEffect, useRef, useState } from "react";
import { Briefcase, Check, CheckCircle2, ClipboardList, Copy, FileCheck2, FileText, Mail, Plus, Trash2, X } from "lucide-react";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { calculerTaxes } from "@/lib/supabase/entreprise";
import { envoyerCourriel, gabaritDevis } from "@/lib/courriels";
import { rejeterEstimateQbo } from "@/lib/quickbooksClient";
import { genererJeton, lienDevisPublic, JOURS_VALIDITE_LIEN_DEVIS } from "@/lib/supabase/devisPublic";
import { activerVersionDevis, annulerDevisAccepte, supprimerDevis, reponsesClientATraiter, classerReponseDevis, rouvrirReponseDevis } from "@/lib/supabase/devis";
import { BlocReponsesClients } from "./BlocReponsesClients";
import { numeroDevis, numeroBonCommande } from "@/lib/supabase/compteurs";
import { margePourcent } from "@/lib/supabase/catalogue";
import { ModalNouveauClient } from "./OngletClients";
import { ApercuDevisClient, AutocompleteAdresse, BarrePagination, Button, FREQUENCES_CONTRAT, ITEMS_PAR_PAGE, ModalSelectionCourriel, SelecteurItem, genererNumeroSecours, hauteurDescription, libelleAdresse, libelleDestinataires, listeDestinataires, nomAffichageClient, tauxAffiche, todayISO, useCatalogue } from "./partage";

// Taux coûtant moyen de l'équipe, lu dans la GRILLE CCQ de l'entreprise
// (2026-08-28) : le champ « taux prévu » se pré-remplit avec un chiffre
// RÉEL plutôt qu'un 45 $ inventé. Repli 45 $ si la grille est vide.
export function tauxMoyenEquipe(tauxMetiers) {
  const valeurs = Object.values(tauxMetiers || {})
    .flatMap((niveaux) => Object.values(niveaux || {}))
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (valeurs.length === 0) return 45;
  return Math.round((valeurs.reduce((s, n) => s + n, 0) / valeurs.length) * 100) / 100;
}

export function ModalTraiterDevis({ devis, clients, onFermer, onChoisirBonTravail, onChoisirProjet, tauxMoyen = 45 }) {
  const [option, setOption] = useState(null); // "bon_travail" | "projet" | null
  const client = clients.find((c) => c.id === devis.clientId);
  const [adresseTravauxId, setAdresseTravauxId] = useState("");
  // 📅 Les DEUX dates (2026-08-28) : le projet partait d'office à la date
  // du jour — un chantier qui commence dans trois semaines était donc
  // « en retard » dès sa création.
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState("");

  // 💰 COÛTANT PRÉVU (2026-08-28 — remplace l'ancien champ « Taux horaire
  // coûtant »). Ce champ-là était un vestige : le coût réel d'une heure
  // vient du taux FIGÉ à la saisie, sinon du taux individuel de la fiche,
  // sinon de la grille CCQ — le taux du projet n'était qu'un filet de
  // dernier recours qui ne servait presque jamais. Ce qui manquait, en
  // revanche, c'est le COÛTANT ATTENDU du projet, pour comparer avec le
  // réel. Or le devis le connaît déjà : chaque ligne porte son coûtant.
  const lignesDevis = Array.isArray(devis.lignes) ? devis.lignes : [];
  const coutantDuDevis = lignesDevis.reduce(
    (s, l) => s + (Number(l.prix_coutant) || 0) * (Number(l.quantite) || 0),
    0
  );
  // ⚠️ Règle gelée : un coût à 0 est INCONNU, jamais zéro. On signale les
  // lignes vendues sans coûtant plutôt que de gonfler la marge en silence.
  const lignesSansCoutant = lignesDevis.filter(
    (l) => !l.estRabais && (Number(l.prix_coutant) || 0) === 0 && (Number(l.prix_vendant) || 0) > 0
  ).length;
  // 🔎 LE DÉTAIL (2026-08-28, demande du propriétaire) : heures + matériaux
  // séparés, MAIS le total global reste possible d'un coup — « que
  // quelqu'un ne calcule pas les 2 séparés ». Règle : dès qu'une des deux
  // lignes de détail est remplie, le total se CALCULE ; sinon c'est le
  // total saisi qui fait foi. Rien n'est jamais perdu en basculant.
  const [heuresPrevues, setHeuresPrevues] = useState("");
  const [tauxPrevu, setTauxPrevu] = useState(tauxMoyen);
  const [materiauxPrevus, setMateriauxPrevus] = useState("");
  const [totalSaisi, setTotalSaisi] = useState(coutantDuDevis);
  const coutMainOeuvrePrevu = (Number(heuresPrevues) || 0) * (Number(tauxPrevu) || 0);
  const coutMateriauxPrevu = Number(materiauxPrevus) || 0;
  const detailRempli = (Number(heuresPrevues) || 0) > 0 || coutMateriauxPrevu > 0;
  const coutantPrevu = detailRempli ? coutMainOeuvrePrevu + coutMateriauxPrevu : Number(totalSaisi) || 0;
  const margePrevue =
    devis.totalVendant > 0 ? ((devis.totalVendant - coutantPrevu) / devis.totalVendant) * 100 : 0;

  const adresseChoisie = () => {
    const a = client?.adresses?.find((x) => x.id === adresseTravauxId);
    return a ? `${a.nom} — ${libelleAdresse(a)}` : null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Traiter le devis {devis.numero}</h3>
            <p className="text-xs text-slate-500">{devis.clientNom} · {devis.totalVendant.toFixed(2)} $</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {!option && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-500">Comment ce devis accepté doit-il être converti ?</p>
            <button
              onClick={() => setOption("bon_travail")}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left hover:border-slate-300"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <ClipboardList size={16} className="text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Intervention directe (Bon de travail)</p>
                <p className="text-xs text-slate-500">Convertit le devis en un seul bon de travail pré-rempli, prêt à être assigné et planifié dans l'agenda.</p>
              </div>
            </button>
            <button
              onClick={() => setOption("projet")}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left hover:border-slate-300"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Briefcase size={16} className="text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Nouveau projet d'envergure</p>
                <p className="text-xs text-slate-500">Le montant du devis devient le budget initial ; chaque ligne devient une étape/tâche du projet, dans le Hub Projets.</p>
              </div>
            </button>
            <p className="text-[10px] text-slate-400">Dans les deux cas, le lien avec QuickBooks est conservé — la facturation finale se fait via l'onglet Facturation.</p>
          </div>
        )}

        {option === "bon_travail" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Adresse des travaux</label>
              {(client?.adresses || []).length > 0 ? (
                <select
                  value={adresseTravauxId}
                  onChange={(e) => setAdresseTravauxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Adresse de facturation par défaut —</option>
                  {client.adresses.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400">Aucune adresse enregistrée pour ce client — l'adresse de facturation sera utilisée par défaut.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setOption(null)}>Retour</Button>
              <Button onClick={() => onChoisirBonTravail(devis, adresseChoisie())}>Convertir et assigner</Button>
            </div>
          </div>
        )}

        {option === "projet" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Adresse des travaux</label>
              {(client?.adresses || []).length > 0 ? (
                <select
                  value={adresseTravauxId}
                  onChange={(e) => setAdresseTravauxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Adresse de facturation par défaut —</option>
                  {client.adresses.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400">Aucune adresse enregistrée pour ce client.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Date de début prévue</label>
                <input
                  type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Date de fin prévue</label>
                <input
                  type="date" value={dateFin} min={dateDebut || undefined} onChange={(e) => setDateFin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* 💰 COÛTANT PRÉVU — au détail OU d'un coup */}
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-bold text-slate-500">Coûtant prévu</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[86px] flex-1">
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">⏱️ Heures prévues</label>
                  <InputNombreDecimal valeur={heuresPrevues} onChange={setHeuresPrevues} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <span className="pb-2 text-xs text-slate-400">×</span>
                <div className="min-w-[86px] flex-1">
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Taux coûtant / h</label>
                  <InputNombreDecimal valeur={tauxPrevu} onChange={setTauxPrevu} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <span className="pb-2 text-xs font-bold text-slate-500 tabular-nums">= {coutMainOeuvrePrevu.toFixed(2)} $</span>
              </div>
              <div className="mt-2">
                <label className="mb-0.5 block text-[10px] font-bold text-slate-400">🧱 Matériaux prévus ($)</label>
                <InputNombreDecimal valeur={materiauxPrevus} onChange={setMateriauxPrevus} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-200 pt-2">
                <label className="text-[11px] font-bold text-slate-600">Total prévu</label>
                {detailRempli ? (
                  <span className="text-sm font-extrabold tabular-nums text-slate-800">{coutantPrevu.toFixed(2)} $</span>
                ) : (
                  <InputNombreDecimal valeur={totalSaisi} onChange={setTotalSaisi} className="w-[130px] rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm font-bold" />
                )}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-400">
                {detailRempli
                  ? "Total calculé depuis le détail — vide les deux lignes ci-dessus pour saisir un montant global à la place."
                  : "Pré-rempli depuis les lignes du devis. Remplis les heures et/ou les matériaux si tu veux suivre le dépassement par poste."}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Budget initial du projet : <span className="font-bold text-slate-800">{devis.totalVendant.toFixed(2)} $</span>
              {" · coûtant prévu "}
              <span className="font-bold text-slate-800">{(Number(coutantPrevu) || 0).toFixed(2)} $</span>
              {" · marge prévue "}
              <span className={`font-bold ${margePrevue < 0 ? "text-red-600" : "text-emerald-700"}`}>{margePrevue.toFixed(1)} %</span>
              <br />
              {devis.lignes.length} étape{devis.lignes.length > 1 ? "s" : ""} seront créées dans l&apos;agenda
              {lignesSansCoutant > 0 && (
                <span className="mt-1 block font-semibold text-amber-700">
                  ⚠️ {lignesSansCoutant} ligne{lignesSansCoutant > 1 ? "s" : ""} vendue{lignesSansCoutant > 1 ? "s" : ""} sans coûtant connu — la marge prévue est donc optimiste.
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setOption(null)}>Retour</Button>
              <Button
                onClick={() =>
                  onChoisirProjet(devis, {
                    coutantPrevu,
                    heuresPrevues: Number(heuresPrevues) || 0,
                    tauxPrevu: Number(tauxPrevu) || 0,
                    materiauxPrevus: coutMateriauxPrevu,
                    dateDebut,
                    dateFin,
                    adresseTravaux: adresseChoisie(),
                  })
                }
              >
                Créer le projet
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export function ModalReportCatalogue({ info, peutModifierListePrix, onFermer, onConfirmer }) {
  const [reporter, setReporter] = useState(false);
  const { item, saisi, auCatalogue } = info;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-slate-900">Coût saisi sur cette ligne</h3>
        <p className="mt-1 text-xs font-semibold text-slate-700">{item.nom}</p>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">
            Catalogue : <span className="tabular-nums font-semibold">{auCatalogue == null ? "aucun coût" : `${auCatalogue.toFixed(2)} $`}</span>
          </span>
          <span className="font-extrabold tabular-nums text-slate-900">→ {saisi.toFixed(2)} $</span>
        </div>

        {peutModifierListePrix ? (
          <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 p-2.5">
            <input
              type="checkbox"
              checked={reporter}
              onChange={(e) => setReporter(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#131B2E]"
            />
            <span className="text-[11px] leading-snug text-slate-600">
              <span className="font-bold text-slate-800">Mettre à jour la liste de prix</span> (onglet Tarifs)
              <br />
              Le coût servira à tous les prochains devis. Les devis déjà créés gardent leur prix d&apos;origine.
            </span>
          </label>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
            Ce coût s&apos;applique <span className="font-bold">à ce devis seulement</span>. La modification de la liste de prix
            demande une autorisation particulière.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button onClick={() => onConfirmer(peutModifierListePrix && reporter)} className="min-h-0 py-2 text-xs">
            Confirmer
          </Button>
        </div>
      </div>
    </div>
  );
}


export function OngletDevis({ clients, setClients, devisListe, setDevisListe, ajouterJournal, ajouterTacheAgenda, setProjets, onDevisTraite, persisterDevis, clientCible, peutModifierListePrix, onMajCoutCatalogue, tauxMetiers }) {
  // Liste de prix (289 items) — sert au sélecteur de lignes de devis.
  const catalogue = useCatalogue();
  // Taux de taxes des Paramètres — pour afficher le total client.
  const configEnt = useEntreprise();
  // AUCUN client présélectionné + recherche rapide (2026-08-17) —
  // même mécanique que le formulaire de tâche.
  const [clientId, setClientId] = useState("");
  const [filtreClientDevis, setFiltreClientDevis] = useState("");
  // 📋 LISTE OUVERTE AU CLIC (2026-08-25, demande du propriétaire) : la
  // liste n'apparaissait qu'après la première lettre — quand on a
  // OUBLIÉ le nom, il n'y a justement pas de première lettre à taper.
  // Un clic dans le champ montre tous les clients en ordre alphabétique.
  const [listeClientsDevisOuverte, setListeClientsDevisOuverte] = useState(false);
  // ARRIVÉE DEPUIS UNE FICHE CLIENT (bouton « + Créer un devis ») :
  // le client est déjà choisi, on ne le redemande pas. Même mécanisme
  // que la recherche rapide qui ouvre la bonne fiche.
  useEffect(() => {
    if (clientCible && clients.some((c) => c.id === clientCible)) setClientId(clientCible);
  }, [clientCible, clients]);
  const [nouvelleAdresseNom, setNouvelleAdresseNom] = useState("");
  const [nouvelleAdresseNomUnite, setNouvelleAdresseNomUnite] = useState("");
  const [lignes, setLignes] = useState([]);
  // 🙈 COÛTS MASQUÉS (demande du propriétaire, 2026-08-22) : chez le
  // client, l'écran du téléphone est visible par-dessus l'épaule — le
  // prix COÛTANT et la marge ne doivent pas s'y trouver. Masqués PAR
  // DÉFAUT ; les montants continuent d'être saisis, enregistrés et
  // comptés exactement pareil (on cache l'AFFICHAGE, jamais la donnée).
  // Le choix est mémorisé PAR APPAREIL : au bureau on les affiche une
  // fois, le téléphone reste discret de son côté.
  const [coutsVisibles, setCoutsVisibles] = useState(false);
  useEffect(() => {
    try {
      setCoutsVisibles(localStorage.getItem("devis-couts-visibles") === "1");
    } catch {
      // stockage indisponible — on reste sur « masqués », le choix sûr
    }
  }, []);
  const basculerCouts = () =>
    setCoutsVisibles((v) => {
      try {
        localStorage.setItem("devis-couts-visibles", v ? "0" : "1");
      } catch {}
      return !v;
    });
  // ✏️ Description en GRAND — { uid } : sur un téléphone, la petite
  // zone de deux lignes ne permet ni de lire ni d'écrire confortablement
  // l'argumentaire qui partira au client.
  const [descriptionOuverte, setDescriptionOuverte] = useState(null);
  const [pdfAperçu, setPdfAperçu] = useState(null);
  const [devisAperçu, setDevisAperçu] = useState(null);
  // Contrat d'entretien : le devis est facturé progressivement (2, 3 ou
  // 4 factures par an) — marqué dès sa création, repris automatiquement
  // à la création de la tâche « Entretien selon contrat ».
  const [estContrat, setEstContrat] = useState(false);
  const [frequenceContrat, setFrequenceContrat] = useState(4);
  // « ➕ Nouveau client » directement depuis le devis — fenêtre partagée
  // ModalNouveauClient (mêmes validations que l'onglet Clients). Le devis
  // en cours (lignes déjà saisies) reste intact derrière.
  const [modalNouveauClient, setModalNouveauClient] = useState(false);

  const client = clients.find((c) => c.id === clientId);

  const totaux = lignes.reduce(
    (acc, l) => ({
      coutant: acc.coutant + (Number(l.prix_coutant) || 0) * l.quantite,
      vendant: acc.vendant + (Number(l.prix_vendant) || 0) * l.quantite,
    }),
    { coutant: 0, vendant: 0 }
  );
  // MARGE CALCULÉE SUR LES SEULES LIGNES COMPLÈTES.
  //
  // Une ligne sans prix coûtant (tes forfaits d'installation, que
  // QuickBooks ne chiffre pas) est EXCLUE du calcul au lieu de le
  // fausser. Sinon un devis de 8 110 $ dont 8 100 $ ne sont pas évalués
  // affichait fièrement « 100 % de marge » — un chiffre faux et
  // rassurant, le pire mélange pour décider d'accepter un contrat.
  //
  // Le total VENDANT, lui, reste complet : c'est bien ce que le client
  // paiera. On ne cache rien, on refuse juste de calculer un
  // pourcentage sur du vide.
  const lignesEvaluees = lignes.filter((l) => (Number(l.prix_coutant) || 0) > 0);
  // Un RABAIS n'a pas de coût — ce n'est pas une donnée manquante, c'est
  // sa nature. Il ne doit donc jamais apparaître dans « coût manquant ».
  const lignesNonEvaluees = lignes.filter(
    (l) => !l.estRabais && (Number(l.prix_coutant) || 0) === 0 && (Number(l.prix_vendant) || 0) > 0
  );
  const evalues = lignesEvaluees.reduce(
    (acc, l) => ({
      coutant: acc.coutant + (Number(l.prix_coutant) || 0) * l.quantite,
      vendant: acc.vendant + (Number(l.prix_vendant) || 0) * l.quantite,
    }),
    { coutant: 0, vendant: 0 }
  );
  const montantNonEvalue = lignesNonEvaluees.reduce(
    (s, l) => s + (Number(l.prix_vendant) || 0) * l.quantite,
    0
  );
  const marge = evalues.vendant - evalues.coutant;
  const margePct = evalues.vendant > 0 ? (marge / evalues.vendant) * 100 : 0;

  // REPORT AU CATALOGUE — proposé quand le coûtant saisi sur une ligne
  // diffère de celui du catalogue, et seulement pour un item QUI VIENT
  // du catalogue : une ligne « sur mesure » ne doit jamais polluer la
  // liste de prix de l'entreprise.
  const [reportCatalogue, setReportCatalogue] = useState(null);
  const proposerReportCatalogue = (ligne) => {
    if (ligne.surMesure || !ligne.id) return;
    const item = (catalogue || []).find((i) => i.id === ligne.id);
    if (!item) return;
    const saisi = Number(ligne.prix_coutant) || 0;
    const auCatalogue = item.prix_coutant == null ? null : Number(item.prix_coutant);
    if (saisi <= 0) return;                       // rien de neuf à proposer
    if (auCatalogue != null && Math.abs(auCatalogue - saisi) < 0.005) return; // inchangé
    setReportCatalogue({ ligne, item, saisi, auCatalogue });
  };

  const ajouterLigne = (produit) => {
    // PRIX TOUJOURS NUMÉRIQUES SUR UNE LIGNE DE DEVIS.
    //
    // Dans le catalogue, un prix coûtant absent veut dire INCONNU — et
    // c'est le cas de tes 71 forfaits d'installation, que QuickBooks ne
    // chiffre pas. Mais une ligne de devis doit calculer : sans nombre,
    // l'affichage plantait dès l'ajout de l'item.
    //
    // On met donc 0, et la ligne est SIGNALÉE plus bas (« coût à
    // compléter ») : un 0 silencieux afficherait 100 % de marge sur un
    // forfait de 6 450 $, exactement le chiffre trompeur qu'on veut
    // éviter.
    const coutantInconnu = produit.prix_coutant == null;
    setLignes((prev) => [
      ...prev,
      {
        ...produit,
        uid: `${produit.id}-${Date.now()}`,
        quantite: 1,
        prix_coutant: Number(produit.prix_coutant) || 0,
        prix_vendant: Number(produit.prix_vendant) || 0,
        coutantInconnu,
      },
    ]);
  };
  const ajouterLignePersonnalisee = () => {
    setLignes((prev) => [
      ...prev,
      {
        uid: `perso-${Date.now()}`,
        nom: "",
        unite: "unité",
        quantite: 1,
        prix_coutant: 0,
        prix_vendant: 0,
        surMesure: true,
      },
    ]);
  };
  // LIEN D'ACCEPTATION — crée le jeton au premier clic (pas à la
  // création du devis : inutile d'exposer un lien qu'on n'enverra
  // peut-être jamais), puis le copie dans le presse-papier.
  // Le LIEN vit 1 an (des clients reviennent un an plus tard) ; la
  // clause « prix valides 30 jours » se joue sur la page publique, qui
  // ferme le bouton « Accepter » passé 30 jours.
  const [lienCopie, setLienCopie] = useState(null);
  const creerLienAcceptation = async (devis) => {
    let jeton = devis.jetonPublic;
    // ON REGÉNÈRE AUSSI UN JETON EXPIRÉ. Sans ça, recopier le lien d'un
    // vieux devis redonnait l'ancien jeton : le client cliquait et
    // tombait sur « Ce devis est expiré ». Quand on clique pour envoyer
    // un lien, on veut un lien qui MARCHE.
    const perime = !!devis.jetonExpireLe && new Date(devis.jetonExpireLe).getTime() < Date.now();
    if (!jeton || perime) {
      jeton = genererJeton();
      const expire = new Date(Date.now() + JOURS_VALIDITE_LIEN_DEVIS * 24 * 60 * 60 * 1000).toISOString();
      const maj = { ...devis, jetonPublic: jeton, jetonExpireLe: expire };
      setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? maj : d)));
      try {
        await persisterDevis(maj);
      } catch {
        ajouterJournal(`⚠️ Lien d'acceptation de ${devis.numero} créé localement mais NON enregistré — le client verrait une page invalide.`);
        return;
      }
      ajouterJournal(
        perime
          ? `🔗 Lien d'acceptation de ${devis.numero} EXPIRÉ — un nouveau lien a été créé (valide 1 an). L'ancien ne fonctionne plus.`
          : `🔗 Lien d'acceptation créé pour ${devis.numero} (valide 1 an — l'acceptation ferme après 30 jours, la consultation reste).`
      );
    }
    try {
      await navigator.clipboard?.writeText(lienDevisPublic(jeton));
      setLienCopie(devis.id);
      setTimeout(() => setLienCopie(null), 3000);
    } catch {
      // Presse-papier refusé — on montre le lien pour copie manuelle.
      window.prompt("Copie ce lien et envoie-le au client :", lienDevisPublic(jeton));
    }
  };

  // ------------------------------------------------------------
  // ENVOI DU DEVIS PAR COURRIEL — le client reçoit le lien
  // d'acceptation dans sa boîte : il clique, lit, accepte ou refuse.
  // ------------------------------------------------------------
  // Même règle de jeton que la copie du lien (expiré = régénéré), même
  // porte d'envoi que le reste du système (/api/courriel). Tant que le
  // service n'est pas configuré, le journal explique quoi faire — rien
  // n'échoue en silence.
  const [envoiDevis, setEnvoiDevis] = useState(null); // { devisId, choisis: [...], extra: "" }
  const [envoiDevisEnCours, setEnvoiDevisEnCours] = useState(false);
  const ficheClientDe = (devis) =>
    clients.find((c) => c.id === devis.clientId) ||
    clients.find((c) => (c.nom || "").trim().toLowerCase() === (devis.clientNom || "").trim().toLowerCase());
  const ouvrirEnvoiDevis = (devis) => {
    const fiche = ficheClientDe(devis);
    const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
    const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
    // Pré-coche l'adresse par défaut ; à défaut la première ; sinon rien
    // (le champ libre prend le relais pour un client sans courriel).
    setEnvoiDevis({ devisId: devis.id, choisis: defauts.length > 0 ? defauts : tous.slice(0, 1), extra: "", extraFiche: false });
  };
  const envoyerDevisParCourriel = async (devis) => {
    const extra = (envoiDevis?.extra || "").trim();
    const adresses = [...new Set([...(envoiDevis?.choisis || []), ...(extra ? [extra] : [])])];
    // 💾 L'adresse tapée rejoint la FICHE si demandé — la prochaine
    // fois, elle sera dans la liste à cocher.
    if (envoiDevis?.extraFiche && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)) {
      const fiche = ficheClientDe(devis);
      if (fiche) {
        setClients((prev) =>
          prev.map((c) => {
            if (c.id !== fiche.id) return c;
            if ((c.courriels || []).some((cc) => (cc.email || "").toLowerCase() === extra.toLowerCase())) return c;
            return { ...c, courriels: [...(c.courriels || []), { id: `cc-${Date.now()}`, label: "Ajouté à l'envoi", email: extra, defaut: (c.courriels || []).length === 0 }] };
          })
        );
        ajouterJournal(`💾 ${extra} ajouté à la fiche de ${fiche.nom}.`);
      }
    }
    if (adresses.length === 0) return;
    setEnvoiDevisEnCours(true);
    // Jeton valide — régénéré s'il est expiré, comme pour la copie.
    let jeton = devis.jetonPublic;
    const perime = !!devis.jetonExpireLe && new Date(devis.jetonExpireLe).getTime() < Date.now();
    if (!jeton || perime) {
      jeton = genererJeton();
      const expire = new Date(Date.now() + JOURS_VALIDITE_LIEN_DEVIS * 24 * 60 * 60 * 1000).toISOString();
      const maj = { ...devis, jetonPublic: jeton, jetonExpireLe: expire };
      setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? maj : d)));
      try {
        await persisterDevis(maj);
      } catch {
        ajouterJournal(`⚠️ Devis ${devis.numero} NON envoyé — le lien n'a pas pu être enregistré. Réessaie.`);
        setEnvoiDevisEnCours(false);
        return;
      }
    }
    const dejaAccepte = devis.reponseClient === "accepte";
    const r = await envoyerCourriel({
      a: adresses,
      sujet: dejaAccepte
        ? `Votre copie du devis ${devis.numero} — ${configEnt.nomCommercial || configEnt.nomLegal}`
        : `Devis ${devis.numero} — ${configEnt.nomCommercial || configEnt.nomLegal}`,
      html: gabaritDevis({
        config: configEnt,
        numero: devis.numero,
        clientNom: devis.clientNom,
        total: null,
        lien: lienDevisPublic(jeton),
        dejaAccepte,
      }),
    });
    setEnvoiDevisEnCours(false);
    if (r.envoye) {
      ajouterJournal(
        dejaAccepte
          ? `✉️ Copie du devis ${devis.numero} (déjà accepté) renvoyée à ${adresses.join(", ")}.`
          : `✉️ Devis ${devis.numero} ENVOYÉ à ${adresses.join(", ")} — le client peut répondre en ligne.`
      );
      setEnvoiDevis(null);
    } else if (r.simule) {
      ajouterJournal(
        `🔧 Envoi SIMULÉ du devis ${devis.numero} — le service de courriels n'est pas encore configuré (clé Resend absente dans Vercel). En attendant, « Copier le lien » et colle-le dans ton propre courriel.`
      );
      setEnvoiDevis(null);
    } else {
      ajouterJournal(`⚠️ Devis ${devis.numero} NON envoyé — ${r.erreur}`);
    }
  };

  // RABAIS — une ligne sur mesure au montant négatif, prête à remplir.
  // Le coûtant reste à 0 et la ligne est marquée `estRabais` pour ne
  // jamais être comptée comme « coût manquant » : un rabais n'a pas de
  // coût, ce n'est pas une donnée qui manque.
  const ajouterRabais = () => {
    setLignes((prev) => [
      ...prev,
      {
        uid: `rabais-${Date.now()}`,
        nom: "Rabais",
        unite: "unité",
        quantite: 1,
        prix_coutant: 0,
        prix_vendant: 0,
        surMesure: true,
        estRabais: true,
      },
    ]);
  };
  const majLigne = (uid, n) => setLignes((prev) => prev.map((l) => (l.uid === uid ? n : l)));
  const supprimerLigne = (uid) => setLignes((prev) => prev.filter((l) => l.uid !== uid));

  const enregistrerAdresse = (place) => {
    // Le petit nom est FACULTATIF (correctif 2026-09-06 : quand il était
    // vide, choisir une suggestion Google ne faisait RIEN, en silence —
    // « l'adresse n'apparaît pas »). Sans petit nom : l'adresse elle-même.
    const nouvelle = {
      id: `a-${Date.now()}`,
      nom: nouvelleAdresseNom.trim() || place.label,
      ligne1: place.label,
      ...(nouvelleAdresseNomUnite.trim() ? { appartement: nouvelleAdresseNomUnite.trim() } : {}),
      codePostal: place.codePostal,
    };
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, adresses: [...(c.adresses || []), nouvelle] } : c))
    );
    setNouvelleAdresseNom("");
    ajouterJournal(`Nouvelle adresse enregistrée au dossier de ${client.nom} : ${nouvelle.ligne1}`);
  };

  const [courrielModalOuvert, setCourrielModalOuvert] = useState(false);
  // ------------------------------------------------------------
  // VERSIONS DE DEVIS — un même dossier (numeroBase) peut avoir
  // plusieurs révisions. Une seule est ACTIVE ; les autres restent
  // consultables en lecture seule (on doit pouvoir revoir exactement ce
  // que le client avait reçu).
  // ------------------------------------------------------------
  // Dossier ouvert (numeroBase) + version affichée dans ses onglets.
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [versionAffichee, setVersionAffichee] = useState(null);
  // 💬 Ce à quoi les clients ont répondu et qui attend une action.
  const reponsesATraiter = reponsesClientATraiter(devisListe);
  // 🎯 ALLER AU DOSSIER (2026-08-28) : « Voir le devis » et « Nouvelle
  // version » ne semblaient RIEN faire — ils marchaient, mais la carte
  // visée était souvent sur une AUTRE PAGE de la liste (10 par page) et
  // hors de l'écran. On amène donc l'écran jusqu'à elle : bonne page,
  // dossier ouvert, défilement centré, et un surlignage de 2,5 s pour
  // que l'œil la retrouve tout de suite.
  const [dossierSurligne, setDossierSurligne] = useState(null);
  // 🪟 FENÊTRE CONTEXTUELLE (2026-08-30, demande du propriétaire) :
  // « Voir le devis » et « Nouvelle version » ouvrent maintenant le
  // dossier PAR-DESSUS la liste — plus de descente jusqu'à la carte.
  const [dossierEnModale, setDossierEnModale] = useState(null);
  const allerAuDossier = (d) => {
    const base = d.numeroBase || d.numero;
    setDossierOuvert(base);
    setVersionAffichee(d.numero);
    setDossierEnModale(base);
  };

  // ❌ ANNULATION D'UN DEVIS ACCEPTÉ — état + exécution.
  const [annulationDevis, setAnnulationDevis] = useState(null); // le devis | null
  const [raisonAnnulationDevis, setRaisonAnnulationDevis] = useState("");
  const executerAnnulationDevis = async () => {
    const d = annulationDevis;
    const raison = raisonAnnulationDevis.trim();
    if (!d || raison.length < 3) return;
    setAnnulationDevis(null);
    try {
      await annulerDevisAccepte(d.id, raison);
    } catch {
      ajouterJournal(`⚠️ Annulation de ${d.numero} NON enregistrée (le snippet 106 est-il passé ?) — rien n'a changé.`);
      return;
    }
    setDevisListe((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, statut: "annule", annuleLe: new Date().toISOString(), annuleRaison: raison } : x))
    );
    ajouterJournal(`❌ Devis ${d.numero} (${d.clientNom}) ANNULÉ après acceptation — raison : ${raison}. La preuve d'acceptation est conservée.`);
    // L'estimate QuickBooks suit — « Rejeté », jamais supprimé.
    if (d.qboEstimateId) {
      const r = await rejeterEstimateQbo(d.qboEstimateId).catch(() => null);
      ajouterJournal(
        r?.rejete
          ? `🧾 Estimate QuickBooks du devis ${d.numero} marqué « Rejeté ».`
          : `⚠️ L'estimate QuickBooks de ${d.numero} n'a PAS pu être marqué « Rejeté »${r?.erreur ? ` (${r.erreur})` : r?.nonConnecte ? " (QuickBooks non connecté)" : ""} — fais-le à la main dans QuickBooks.`
      );
    }
  };

  // 📧 RENVOYER APRÈS AVOIR RÉPONDU (2026-08-28) : le client avait une
  // question, tu l'as appelé — il faut maintenant qu'il puisse ACCEPTER.
  // Or il ne peut répondre qu'UNE fois : son lien était mort. On rouvre
  // donc sa réponse (jamais une acceptation), on garde sa question au
  // journal pour la trace, et on ouvre la fenêtre d'envoi habituelle.
  const renvoyerApresReponse = async (d) => {
    const question = d.messageClient;
    try {
      const rouvert = await rouvrirReponseDevis(d.id);
      if (!rouvert) {
        ajouterJournal(`⚠️ ${d.numero} : impossible de rouvrir — une ACCEPTATION ne s'efface jamais (c'est la preuve du client).`);
        return;
      }
    } catch {
      ajouterJournal(`⚠️ ${d.numero} : la réouverture a échoué — le client ne pourra pas répondre de nouveau. Réessaie.`);
      return;
    }
    const maj = { ...d, reponseClient: null, reponduLe: null, reponduParNom: "", messageClient: "", reponseTraiteeLe: null };
    setDevisListe((prev) => prev.map((x) => (x.id === d.id ? maj : x)));
    ajouterJournal(
      `🔁 ${d.numero} rouvert pour une nouvelle réponse du client${question ? ` — sa question était « ${question} »` : ""} : il peut de nouveau accepter en ligne.`
    );
    ouvrirEnvoiDevis(maj);
  };

  // 🗑️ EFFACER UNE DEMANDE ENVOYÉE PAR ERREUR (2026-08-29 — « si le
  // client envoie par erreur, ça pollue »). Différent de « J'ai
  // répondu » (qui CLASSE une vraie demande) : ici la réponse fautive
  // est EFFACÉE — le devis redevient simplement « envoyé » et le lien
  // du client fonctionne de nouveau (une réponse verrouille son lien).
  // La demande effacée reste au JOURNAL. Jamais sur une acceptation
  // (le garde de rouvrirReponseDevis s'en assure côté base).
  const effacerDemandeErreur = async (d) => {
    if (
      !window.confirm(
        `Effacer la demande de ${d.numero}${d.messageClient ? ` (« ${d.messageClient} »)` : ""} ?\n\nLe devis redevient « envoyé » et le client pourra répondre de nouveau sur le même lien. La demande reste au journal.`
      )
    )
      return;
    const question = d.messageClient;
    try {
      const rouvert = await rouvrirReponseDevis(d.id);
      if (!rouvert) {
        ajouterJournal(`⚠️ ${d.numero} : impossible d'effacer — une ACCEPTATION ne s'efface jamais.`);
        return;
      }
    } catch {
      ajouterJournal(`⚠️ ${d.numero} : l'effacement a échoué — réessaie.`);
      return;
    }
    setDevisListe((prev) =>
      prev.map((x) =>
        x.id === d.id ? { ...x, reponseClient: null, reponduLe: null, reponduParNom: "", messageClient: "", reponseTraiteeLe: null } : x
      )
    );
    ajouterJournal(
      `🗑️ Demande du client sur ${d.numero} EFFACÉE (envoyée par erreur)${question ? ` — elle disait « ${question} »` : ""}. Le client peut répondre de nouveau.`
    );
  };

  // « J'ai répondu » / « Pris en note » — la ligne se range, en base
  // (sinon elle reviendrait au prochain rechargement).
  const classerReponse = async (d) => {
    setDevisListe((prev) => prev.map((x) => (x.id === d.id ? { ...x, reponseTraiteeLe: new Date().toISOString() } : x)));
    try {
      await classerReponseDevis(d.id, true);
      ajouterJournal(`✅ Réponse du client sur ${d.numero} classée${d.messageClient ? ` — « ${d.messageClient} »` : ""}`);
    } catch {
      ajouterJournal(`⚠️ Réponse de ${d.numero} classée à l'écran mais NON enregistrée — le snippet 104 est-il passé ?`);
    }
  };
  const [noteNouvelleVersion, setNoteNouvelleVersion] = useState("");
  const [creationVersionPour, setCreationVersionPour] = useState(null);

  const versionsDuDossier = (numeroBase) =>
    devisListe.filter((d) => (d.numeroBase || d.numero) === numeroBase).sort((a, b) => (a.version ?? 0) - (b.version ?? 0));

  // Un seul enregistrement par DOSSIER dans la liste : la version active
  // (ou la plus récente à défaut). Sinon la liste triplerait.
  // 📝 Les BROUILLONS vivent dans leur propre section — ils n'ont pas
  // de numéro officiel et ne sont pas des dossiers.
  const brouillonsDevis = devisListe.filter((d) => d.statut === "brouillon");
  const dossiersDevis = (() => {
    const parBase = {};
    devisListe.filter((d) => d.statut !== "brouillon").forEach((d) => {
      const base = d.numeroBase || d.numero;
      (parBase[base] = parBase[base] || []).push(d);
    });
    return Object.entries(parBase)
      .map(([base, versions]) => {
        const triees = versions.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
        const active = triees.find((v) => v.versionActive !== false) || triees[triees.length - 1];
        return { base, versions: triees, active };
      })
      .sort((a, b) => (b.active.creeLe || b.active.date || "").localeCompare(a.active.creeLe || a.active.date || ""));
  })();

  // ÉDITION D'UNE VERSION : { source, note } — les lignes du devis
  // source sont chargées dans le constructeur pour être modifiées
  // (ajout/retrait de produits, quantités, prix) avant enregistrement.
  const [editionVersion, setEditionVersion] = useState(null);
  // 🪟 L'édition d'une révision se fait dans une FENÊTRE par-dessus la
  // liste (2026-08-30, demande du propriétaire : « modifier le devis
  // directement dans la fenêtre contextuelle »). Fermer la fenêtre ne
  // perd RIEN : l'édition reste chargée dans la colonne de la page.
  const [editionEnFenetre, setEditionEnFenetre] = useState(false);
  // 📄 Pagination (2026-08-26) : avant, la liste était COUPÉE aux 10
  // premiers — le 11e devis était invisible. 10 par page, tout visible.
  const [pageDevis, setPageDevis] = useState(1);
  const refListeDevis = useRef(null);

  // Étape 1 : charger la version source dans le constructeur. Le devis
  // d'origine reste INTACT tant que rien n'est enregistré (règle A :
  // un devis envoyé ne se modifie jamais, il se révise).
  const demarrerNouvelleVersion = (source, note) => {
    setLignes(
      (source.lignes || []).map((l, i) => ({ ...l, uid: `${l.uid || "l"}-copie-${Date.now()}-${i}` }))
    );
    setClientId(source.clientId || clientId);
    setEstContrat(!!source.estContrat);
    setFrequenceContrat(source.frequenceFacturationAnnuelle || 4);
    setEditionVersion({ source, note: (note || "").trim() });
    setCreationVersionPour(null);
    setNoteNouvelleVersion("");
    // La fenêtre du DOSSIER se ferme et celle de l'ÉDITION s'ouvre :
    // toute révision se fait désormais dans la fenêtre, la demande du
    // client sous les yeux — un devis NEUF, lui, se bâtit dans la page.
    setDossierEnModale(null);
    setEditionEnFenetre(true);
  };

  const annulerEdition = () => {
    setEditionEnFenetre(false);
    setEditionVersion(null);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
  };

  // Étape 2 : enregistrer la révision AVEC les lignes modifiées.
  // Incrémente le suffixe et archive les versions précédentes.
  const enregistrerVersion = async (etEnvoyer = false) => {
    if (!editionVersion) return;
    const { source, note } = editionVersion;
    const base = source.numeroBase || source.numero;
    const versions = versionsDuDossier(base);
    const prochaineVersion = Math.max(...versions.map((v) => v.version ?? 0)) + 1;
    const numero = `${base}-${prochaineVersion}`;
    const revision = {
      ...source,
      id: numero,
      numero,
      numeroBase: base,
      version: prochaineVersion,
      versionActive: true,
      // La révision repart « envoyée » : elle n'est ni acceptée ni traitée.
      statut: "envoye",
      traite: false,
      modeTraitement: null,
      projetId: null,
      date: todayISO(),
      courrielEnvoi: null,
      courrielsEnvoi: [],
      noteVersion: note,
      creeLe: new Date().toISOString(),
      // Les lignes MODIFIÉES dans le constructeur — la version d'origine
      // n'est jamais touchée.
      lignes,
      totalCoutant: totaux.coutant,
      totalVendant: totaux.vendant,
      estContrat,
      frequenceFacturationAnnuelle: estContrat ? frequenceContrat : null,
      // La révision repart SANS réponse de client (le « ...source »
      // copiait l'ancienne : le bloc des réponses aurait montré une
      // demande fantôme sur la nouvelle version jusqu'au rechargement).
      reponseClient: null,
      reponduLe: null,
      reponduParNom: null,
      messageClient: null,
      reponseTraiteeLe: null,
      annuleLe: null,
      annuleRaison: "",
    };
    // 🔑 LE LIEN DU CLIENT SUIT LA VERSION ACTIVE (bogue vécu par le
    // propriétaire, 2026-08-30 : « les ajouts et le prix n'apparaissent
    // pas ») : le jeton public est UNIQUE dans la base (idx_devis_jeton)
    // — copié tel quel sur la révision, l'enregistrement était REFUSÉ
    // pendant que l'originale se faisait archiver. On retire donc le
    // jeton de l'ancienne version AVANT de le poser sur la nouvelle,
    // et si quoi que ce soit échoue, on REMET tout comme avant.
    if (source.jetonPublic) {
      const libere = await persisterDevis?.({ ...source, versionActive: false, jetonPublic: null });
      if (libere === false) {
        ajouterJournal(`⚠️ Nouvelle version de ${source.numero} NON enregistrée (le lien du client n'a pas pu être transféré) — rien n'a changé, réessaie.`);
        return;
      }
    }
    const enregistre = await persisterDevis?.(revision);
    if (enregistre === false) {
      // Marche arrière : l'originale redevient exactement ce qu'elle était.
      if (source.jetonPublic) persisterDevis?.({ ...source });
      ajouterJournal(`⚠️ Nouvelle version de ${source.numero} NON enregistrée — rien n'a changé, réessaie.`);
      return;
    }
    setDevisListe((prev) => [
      revision,
      ...prev.map((d) =>
        (d.numeroBase || d.numero) === base
          ? { ...d, versionActive: false, ...(d.id === source.id ? { jetonPublic: null } : {}) }
          : d
      ),
    ]);
    activerVersionDevis(base, numero).catch(() => {});
    ajouterJournal(
      `📄 Version ${numero} enregistrée à partir de ${source.numero}${note ? ` — ${note}` : ""} · ${totaux.vendant.toFixed(2)} $ (les versions précédentes restent consultables)`
    );
    setEditionVersion(null);
    setEditionEnFenetre(false);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
    setDossierOuvert(base);
    setVersionAffichee(numero);
    // 🪟 ENCHAÎNEMENT (2026-08-30) : rien ne part jamais tout seul.
    // « Enregistrer et envoyer » ouvre DIRECTEMENT la fenêtre des
    // destinataires sur la révision (demande du propriétaire : « ça
    // irait plus vite et on est sûr de ne pas oublier de l'envoyer ») ;
    // « Enregistrer sans envoyer » ouvre la fenêtre du dossier, le
    // bouton « ✉️ Envoyer au client » sous les yeux pour plus tard.
    if (etEnvoyer) {
      // Le panneau « Envoyer le devis à : » vit DANS la carte du
      // dossier — on ouvre donc la fenêtre du dossier AVEC le panneau
      // déplié (vécu : « ça n'envoie pas, je dois retourner là » — le
      // panneau s'ouvrait sur la carte de la liste, hors du regard).
      ouvrirEnvoiDevis(revision);
      setDossierEnModale(base);
    } else {
      setDossierEnModale(base);
    }
  };

  const demarrerCreationDevis = () => {
    if (lignes.length === 0 || !clientId) return;
    setCourrielModalOuvert(true);
  };

  // ============================================================
  // 📝 BROUILLON DE DEVIS (séance 3, plan du propriétaire) —
  // commencer sur le téléphone chez le client, finir au bureau, SANS
  // consommer de numéro officiel. Le brouillon n'a ni numéro de la
  // séquence, ni courriel, ni miroir QuickBooks : c'est une feuille de
  // travail. « Reprendre » recharge tout dans le formulaire ; créer le
  // devis pour vrai prend alors un numéro et efface le brouillon.
  // ============================================================
  const [reprisBrouillonId, setReprisBrouillonId] = useState(null);
  const [brouillonASupprimer, setBrouillonASupprimer] = useState(null); // deux temps
  const garderBrouillon = async () => {
    if (lignes.length === 0 || !clientId) return;
    const brouillon = {
      // Reprise d'un brouillon existant : on ÉCRASE le même — pas de
      // multiplication de copies à chaque sauvegarde.
      id: reprisBrouillonId || `BR-${Date.now()}`,
      numero: reprisBrouillonId || `BR-${Date.now()}`,
      numeroBase: reprisBrouillonId || `BR-${Date.now()}`,
      version: 0,
      versionActive: true,
      clientId,
      clientNom: client?.nom || "",
      lignes,
      totalCoutant: totaux.coutant,
      totalVendant: totaux.vendant,
      statut: "brouillon",
      date: todayISO(),
      estContrat,
      frequenceFacturationAnnuelle: estContrat ? frequenceContrat : null,
    };
    // id/numero/numeroBase doivent être IDENTIQUES entre eux — recalcule
    // une seule fois si nouveau.
    if (!reprisBrouillonId) {
      const idB = `BR-${Date.now()}`;
      brouillon.id = idB; brouillon.numero = idB; brouillon.numeroBase = idB;
    }
    setDevisListe((prev) => [brouillon, ...prev.filter((d) => d.id !== brouillon.id)]);
    await persisterDevis?.(brouillon);
    ajouterJournal(`📝 Brouillon de devis gardé pour ${client?.nom || "?"} (${totaux.vendant.toFixed(2)} $, ${lignes.length} ligne${lignes.length > 1 ? "s" : ""}) — aucun numéro consommé.`);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
    setClientId("");
    setReprisBrouillonId(null);
  };
  const reprendreBrouillon = (b) => {
    setClientId(b.clientId || "");
    setLignes(Array.isArray(b.lignes) ? b.lignes : []);
    setEstContrat(!!b.estContrat);
    setFrequenceContrat(b.frequenceFacturationAnnuelle || 4);
    setReprisBrouillonId(b.id);
    ajouterJournal(`📝 Brouillon repris dans le formulaire (${b.clientNom}) — crée le devis pour lui donner son numéro officiel.`);
  };
  const supprimerBrouillon = async (b) => {
    setDevisListe((prev) => prev.filter((d) => d.id !== b.id));
    if (reprisBrouillonId === b.id) setReprisBrouillonId(null);
    setBrouillonASupprimer(null);
    await supprimerDevis(b.id).catch(() => {});
    ajouterJournal(`🗑️ Brouillon de devis supprimé (${b.clientNom}, ${Number(b.totalVendant || 0).toFixed(2)} $) — c'était une feuille de travail, aucun numéro n'y était attaché.`);
  };

  const creerDevis = async (choixCourriels) => {
    // Choix MULTIPLE : le devis peut partir à plusieurs contacts du client.
    const destinataires = listeDestinataires(choixCourriels);
    // Numéro SÉQUENTIEL attribué par la base (aucun doublon possible).
    let numero;
    try {
      numero = await numeroDevis();
    } catch {
      numero = genererNumeroSecours("DEV");
      ajouterJournal("⚠️ Numéro de devis séquentiel indisponible — numéro de secours attribué, à corriger manuellement.");
    }
    // ENVOI RÉEL À LA CRÉATION — le détour « aller dans Devis récents
    // puis Envoyer par courriel » créait des oublis. Désormais : des
    // destinataires choisis = le courriel part TOUT DE SUITE, avec le
    // lien d'acceptation (jeton généré ici, 1 an, comme partout).
    const jeton = destinataires.length > 0 ? genererJeton() : null;
    const nouveauDevis = {
      id: numero,
      numero,
      // Nouveau dossier : version 0, active. Les révisions à venir
      // partageront ce numeroBase (DEV-3500 → DEV-3500-1, -2 …).
      numeroBase: numero,
      version: 0,
      versionActive: true,
      clientId,
      clientNom: client.nom,
      lignes,
      totalCoutant: totaux.coutant,
      totalVendant: totaux.vendant,
      statut: "envoye",
      date: todayISO(),
      courrielEnvoi: destinataires[0]?.email || null,
      courrielsEnvoi: destinataires.map((c) => c.email),
      ...(jeton ? { jetonPublic: jeton, jetonExpireLe: new Date(Date.now() + JOURS_VALIDITE_LIEN_DEVIS * 24 * 60 * 60 * 1000).toISOString() } : {}),
      // Contrat d'entretien : fréquence portée par le devis lui-même,
      // reprise automatiquement à la création de la tâche.
      estContrat,
      frequenceFacturationAnnuelle: estContrat ? frequenceContrat : null,
    };
    setDevisListe((prev) => [nouveauDevis, ...prev]);
    setLignes([]);
    setEstContrat(false);
    setFrequenceContrat(4);
    setCourrielModalOuvert(false);
    // ON ATTEND la confirmation d'enregistrement AVANT tout envoi : un
    // devis qui n'est pas en base ne doit JAMAIS générer un courriel
    // (sinon le client reçoit un lien mort — vécu avec DEV-3509).
    const enregistre = await persisterDevis?.(nouveauDevis);
    if (enregistre === false) {
      // ⚠️ RETRAIT DU FANTÔME (audit 2026-08-17) : le devis avait été
      // ajouté à la liste AVANT la confirmation — le laisser affiché
      // offrait encore « Envoyer au client »/« Copier le lien » sur un
      // devis inexistant en base (lien mort DEV-3509 en différé).
      setDevisListe((prev) => prev.filter((d) => d.id !== nouveauDevis.id));
      ajouterJournal(`⛔ Devis ${numero} NON enregistré — retiré de la liste, AUCUN courriel envoyé (pas de lien mort). Vérifie la connexion et recrée le devis.`);
      return;
    }
    // 📝 Devis créé à partir d'un BROUILLON : le brouillon a fait son
    // travail, il s'efface — seulement APRÈS l'enregistrement confirmé
    // du vrai devis (jamais avant : sinon une panne effacerait les deux).
    if (reprisBrouillonId) {
      const idBrouillon = reprisBrouillonId;
      setReprisBrouillonId(null);
      setDevisListe((prev) => prev.filter((d) => d.id !== idBrouillon));
      supprimerDevis(idBrouillon).catch(() => {});
      ajouterJournal(`📝 Brouillon transformé en devis ${numero} — le brouillon est effacé.`);
    }
    if (destinataires.length === 0) {
      ajouterJournal(`Devis ${numero} créé pour ${client.nom} (${totaux.vendant.toFixed(2)} $) — aucun courriel disponible pour l'envoi`);
      return;
    }
    // Le journal ne dit « envoyé » QUE si c'est vrai — plus jamais de
    // « créé et envoyé » fictif.
    const r = await envoyerCourriel({
      a: destinataires.map((c) => c.email),
      sujet: `Devis ${numero} — ${configEnt.nomCommercial || configEnt.nomLegal}`,
      html: gabaritDevis({
        config: configEnt,
        numero,
        clientNom: client.nom,
        total: null,
        lien: lienDevisPublic(jeton),
      }),
    });
    if (r.envoye) {
      ajouterJournal(`✉️ Devis ${numero} créé ET envoyé à ${libelleDestinataires(destinataires)} pour ${client.nom} (${totaux.vendant.toFixed(2)} $) — le client peut accepter en ligne.`);
    } else if (r.simule) {
      ajouterJournal(`Devis ${numero} créé (${totaux.vendant.toFixed(2)} $) — envoi SIMULÉ : le service de courriels n'est pas configuré ici. Utilise « Copier le lien » en attendant.`);
    } else {
      ajouterJournal(`⚠️ Devis ${numero} créé, mais courriel NON parti — ${r.erreur || "erreur d'envoi"}. Réessaie avec « Envoyer par courriel » dans Devis récents.`);
    }
  };

  const [devisATraiterId, setDevisATraiterId] = useState(null);
  const devisATraiter = devisListe.find((d) => d.id === devisATraiterId) || null;

  // "Marquer accepté" ne fait plus QUE changer le statut — l'admin
  // choisit ENSUITE explicitement, via "Traiter le devis", comment ce
  // devis accepté doit être converti (bon de travail direct ou
  // nouveau projet d'envergure). `traite` distingue un devis accepté
  // mais pas encore converti d'un devis déjà traité.
  const accepterDevis = (devis) => {
    setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? { ...d, statut: "accepte", traite: false } : d)));
    persisterDevis?.({ ...devis, statut: "accepte", traite: false });
    ajouterJournal(`✅ Devis ${devis.numero} marqué accepté — prêt à être traité ("Traiter le devis")`);
  };

  // OPTION A — Intervention directe : le devis devient un bon de
  // travail unique, pré-rempli, envoyé directement dans l'agenda pour
  // attribution à un technicien. Conserve l'automatisation BC/achats
  // (du matériel est probablement encore nécessaire pour intervenir),
  // et surtout `devisNumero` — c'est ce lien qui permet à ce travail
  // d'apparaître ensuite dans l'onglet Facturation (facturation
  // progressive plafonnée au devis) puis d'être converti en facture
  // QuickBooks, exactement comme les devis traités par l'ancien flux.
  const traiterCommeBonDeTravail = async (devis, adresseTravaux) => {
    let numeroBc;
    try {
      numeroBc = await numeroBonCommande();
    } catch {
      numeroBc = genererNumeroSecours("BC");
      ajouterJournal("⚠️ Numéro de BC séquentiel indisponible — numéro de secours attribué, à corriger manuellement.");
    }
    const materiaux = devis.lignes.map((l) => ({ description: l.nom, quantite: l.quantite, unite: l.unite || "unité" }));

    setPdfAperçu({ numero: numeroBc, client: devis.clientNom, materiaux, date: todayISO() });
    ajouterJournal(`📄 Bon de commande ${numeroBc} généré (PDF, sans prix de vente)`);
    ajouterJournal(`📧 Courriel envoyé à achats@ventilationdgl.com — pièce jointe : ${numeroBc}.pdf`);

    ajouterTacheAgenda({
      id: `tache-${devis.id}`,
      clientId: devis.clientId,
      clientNom: devis.clientNom,
      titre: `Devis ${devis.numero} — Intervention`,
      description: materiaux.map((m) => `${m.quantite} × ${m.description}`).join(", "),
      statut: "a_planifier",
      heures: 1,
      jours: 0,
      sauterWeekend: false,
      typeTache: "devis",
      devisNumero: devis.numero,
      adresseTravaux: adresseTravaux || null,
    });

    setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? { ...d, traite: true, modeTraitement: "bon_travail" } : d)));
    persisterDevis?.({ ...devis, traite: true, modeTraitement: "bon_travail" });
    ajouterJournal(`🔧 Devis ${devis.numero} converti en bon de travail — prêt pour attribution dans l'agenda. Lien QuickBooks conservé (facturation finale via l'onglet Facturation).`);
    setDevisATraiterId(null);
    onDevisTraite?.("agenda");
  };

  // OPTION B — Nouveau projet d'envergure : le montant du devis
  // devient le budget initial du projet, et chaque ligne du devis
  // devient une tâche/étape distincte dans l'agenda, rattachée au
  // projet via projetId — pour un suivi de rentabilité dès le départ.
  const traiterCommeProjet = (devis, { coutantPrevu, heuresPrevues = 0, tauxPrevu = 0, materiauxPrevus = 0, dateDebut, dateFin, adresseTravaux }) => {
    const nouveauProjetId = `projet-${Date.now()}`;
    const coutantAttendu = Number(coutantPrevu) || 0;
    const nouveauProjet = {
      id: nouveauProjetId,
      nom: `Devis ${devis.numero} — ${devis.clientNom}`,
      clientId: devis.clientId,
      adresseTravaux: adresseTravaux || null,
      dateDebut: dateDebut || todayISO(),
      dateFin: dateFin || "",
      // ⚠️ Le statut d'un PROJET est une des 4 étiquettes de
      // STATUTS_PROJET — pas le code technique « a_planifier » des
      // TÂCHES (correctif 2026-08-28 : un projet créé depuis un devis
      // portait ce code, donc il n'entrait dans AUCUNE colonne du
      // tableau et restait invisible).
      statut: "À planifier",
      budgetTotal: devis.totalVendant,
      // Filet historique : le taux du projet ne sert QUE si une heure
      // n'a ni taux figé, ni taux de fiche, ni grille CCQ (cas rare).
      // On ne le demande plus — 45 $ reste la valeur de repli d'avant.
      tauxHoraireCoutant: 45,
      // 💰 Le COÛTANT PRÉVU, dans la même structure que les projets créés
      // depuis une tâche — c'est lui qui se compare au coût réel.
      budgetPrevu: {
        // Le DÉTAIL quand il a été saisi (heures × taux, matériaux) —
        // c'est lui qui permettra de dire OÙ le projet a dépassé, pas
        // seulement de combien. Zéro = « non détaillé », pas « gratuit ».
        mainOeuvreChantier: { heures: heuresPrevues, facture: 0, coutant: heuresPrevues * tauxPrevu },
        transport: { heures: 0, facture: 0, coutant: 0 },
        materiaux: { facture: 0, coutant: materiauxPrevus },
        tauxPrevu,
        detaille: heuresPrevues > 0 || materiauxPrevus > 0,
        sousTraitants: [],
        totalFacture: devis.totalVendant,
        totalCoutant: coutantAttendu,
        marge: devis.totalVendant > 0 ? ((devis.totalVendant - coutantAttendu) / devis.totalVendant) * 100 : 0,
        source: `devis ${devis.numero}`,
      },
      bonsCommande: [],
    };
    setProjets((prev) => [...prev, nouveauProjet]);

    // Chaque ligne du devis devient une étape/tâche distincte, déjà
    // rattachée au nouveau projet — l'admin n'a plus qu'à les
    // assigner dans l'agenda au fur et à mesure de l'avancement.
    devis.lignes.forEach((ligne, i) => {
      ajouterTacheAgenda({
        id: `tache-${devis.id}-etape-${i}`,
        clientId: devis.clientId,
        clientNom: devis.clientNom,
        titre: `${devis.numero} — ${ligne.nom}`,
        description: `${ligne.quantite} × ${ligne.nom}`,
        statut: "a_planifier",
        heures: 1,
        jours: 0,
        sauterWeekend: false,
        typeTache: "devis",
        devisNumero: devis.numero,
        projetId: nouveauProjetId,
        adresseTravaux: adresseTravaux || null,
      });
    });

    setDevisListe((prev) => prev.map((d) => (d.id === devis.id ? { ...d, traite: true, modeTraitement: "projet", projetId: nouveauProjetId } : d)));
    persisterDevis?.({ ...devis, traite: true, modeTraitement: "projet", projetId: nouveauProjetId });
    ajouterJournal(
      `🏗️ Devis ${devis.numero} converti en projet "${nouveauProjet.nom}" (budget initial ${devis.totalVendant.toFixed(2)} $, ${devis.lignes.length} étape${devis.lignes.length > 1 ? "s" : ""} ajoutée${devis.lignes.length > 1 ? "s" : ""} à l'agenda). Lien QuickBooks conservé (facturation progressive via l'onglet Facturation).`
    );
    setDevisATraiterId(null);
    onDevisTraite?.("projets");
  };

  // 🪟 CARTE DE DOSSIER — rendue à DEUX endroits : la liste paginée
  // et la FENÊTRE CONTEXTUELLE (demande du propriétaire, 2026-08-28 :
  // « Voir le devis » ouvre une fenêtre au lieu de descendre). Fonction
  // locale (fermeture sur tous les états) plutôt qu'un composant à
  // quinze props — strictement le même code aux deux endroits.
  const rendreCarteDossier = ({ base, versions, active }, enModale = false) => {
            const ouvert = dossierOuvert === base;
            const affichee = ouvert ? versions.find((v) => v.numero === versionAffichee) || active : active;
            const estActive = affichee.numero === active.numero;
            return (
              <div
                key={base}
                id={enModale ? undefined : `dossier-${base}`}
                className={`rounded-xl border bg-white p-3.5 transition-shadow ${
                  dossierSurligne === base ? "border-[#FF6A13] ring-2 ring-orange-300" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                      {affichee.numero}
                      {versions.length > 1 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                          {versions.length} versions
                        </span>
                      )}
                      {affichee.estContrat && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                          CONTRAT · {affichee.frequenceFacturationAnnuelle}×/an
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{affichee.clientNom}</p>
                    {/* 📌 Étiquette du devis : sa première ligne — pour le
                        reconnaître d'un coup d'œil dans la liste. */}
                    {affichee.lignes?.[0]?.nom && (
                      <p className="truncate text-[11px] text-slate-500">
                        📌 {affichee.lignes[0].nom}
                        {affichee.lignes.length > 1 ? ` (+${affichee.lignes.length - 1})` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      affichee.statut === "accepte" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-black"
                    }`}
                  >
                    {affichee.statut === "accepte" ? "ACCEPTÉ" : "ENVOYÉ"}
                  </span>
                </div>

                {/* ONGLETS DES VERSIONS — visibles dès qu'il y a une révision. */}
                {versions.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-slate-200 p-0.5">
                    {versions.map((v) => {
                      const selectionne = v.numero === affichee.numero;
                      return (
                        <button
                          key={v.numero}
                          onClick={() => {
                            setDossierOuvert(base);
                            setVersionAffichee(v.numero);
                          }}
                          className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${
                            selectionne ? "bg-[#131B2E] text-white" : "text-slate-500 hover:bg-slate-50"
                          }`}
                          title={v.noteVersion || undefined}
                        >
                          {v.version === 0 ? "Originale" : `v${v.version}`}
                          {v.numero === active.numero ? " ★" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="mt-1.5 text-sm font-bold tabular-nums text-slate-800">{affichee.totalVendant.toFixed(2)} $</p>
                <p className="text-[10px] text-slate-400">
                  {affichee.date}
                  {affichee.noteVersion ? ` · ${affichee.noteVersion}` : ""}
                </p>
                {/* 📋 LE DEVIS AU COMPLET dans la fenêtre (2026-08-30,
                    « je ne vois pas le devis au complet quand cette
                    fenêtre ouvre ») : les lignes en lecture seule —
                    la liste, elle, garde ses cartes courtes. */}
                {enModale && (affichee.lignes || []).length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                    {affichee.lignes.map((l, i) => (
                      <div key={l.uid || i} className="flex items-start justify-between gap-2 border-b border-slate-100 px-2.5 py-1.5 text-[11px] last:border-0">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800">{l.nom || "Ligne"}</p>
                          {l.description && (
                            <p className="whitespace-pre-wrap text-[10px] leading-snug text-slate-500">{l.description}</p>
                          )}
                        </div>
                        <p className="shrink-0 tabular-nums text-slate-700">
                          {Number(l.quantite) || 0} × {(Number(l.prix_vendant) || 0).toFixed(2)} $
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {!estActive && (
                  <p className="mt-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-500">
                    🔒 Version archivée — lecture seule. La version courante est {active.numero}.
                  </p>
                )}
                {affichee.traite && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    <CheckCircle2 size={11} /> Traité — {affichee.modeTraitement === "projet" ? "converti en projet" : "converti en bon de travail"}
                  </span>
                )}

                <Button variant="outline" onClick={() => setDevisAperçu(affichee)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                  <FileText size={13} /> Voir version client
                </Button>

                {/* RÉPONSE DU CLIENT — la preuve. Nom saisi, date, heure,
                    et la version des conditions qu'il a lues ce jour-là.
                    C'est ce qui répond à « je n'ai jamais été avisé ». */}
                {affichee.reponseClient && (
                  <div className={`mt-2 rounded-lg border p-2.5 ${
                    affichee.reponseClient === "accepte" ? "border-emerald-300 bg-emerald-50"
                      : affichee.reponseClient === "modification" ? "border-blue-300 bg-blue-50"
                      : "border-slate-300 bg-slate-50"
                  }`}>
                    <p className="text-[11px] font-extrabold text-slate-800">
                      {affichee.reponseClient === "accepte" ? "✅ Accepté par le client"
                        : affichee.reponseClient === "modification" ? "✏️ Modification demandée"
                        : "❌ Refusé par le client"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      {affichee.reponduParNom}
                      {affichee.reponduLe ? ` · ${new Date(affichee.reponduLe).toLocaleString("fr-CA")}` : ""}
                    </p>
                    {affichee.messageClient && (
                      <p className="mt-1 whitespace-pre-line rounded bg-white/70 px-2 py-1 text-[10px] italic text-slate-700">
                        « {affichee.messageClient} »
                      </p>
                    )}
                    {affichee.conditionsVersion && (
                      <p className="mt-1 text-[9px] text-slate-400">
                        Conditions version {affichee.conditionsVersion} — texte exact conservé
                      </p>
                    )}
                  </div>
                )}

                {/* ENVOI AU CLIENT — le courriel avec le lien d'acceptation.
                    « Copier le lien » reste là comme plan B (téléphone,
                    texto, ou service d'envoi pas encore configuré). */}
                {/* ENVOI / RENVOI — disponible tant que le client n'a pas
                    répondu, ET aussi pour un devis DÉJÀ ACCEPTÉ (le client
                    a perdu sa copie et la redemande). */}
                {estActive && (!affichee.reponseClient || affichee.reponseClient === "accepte") && envoiDevis?.devisId !== affichee.id && (
                  <Button onClick={() => ouvrirEnvoiDevis(affichee)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                    {affichee.reponseClient === "accepte" ? "✉️ Renvoyer la copie au client" : "✉️ Envoyer au client"}
                  </Button>
                )}
                {estActive && (!affichee.reponseClient || affichee.reponseClient === "accepte") && envoiDevis?.devisId === affichee.id && (
                  <div className="mt-2 rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">{affichee.reponseClient === "accepte" ? "Renvoyer la copie à :" : "Envoyer le devis à :"}</p>
                    {(ficheClientDe(affichee)?.courriels || []).map((c) => {
                      const adresse = typeof c === "string" ? c : c.email;
                      if (!adresse) return null;
                      const coche = envoiDevis.choisis.includes(adresse);
                      return (
                        <label key={adresse} className="mb-1 flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={coche}
                            onChange={() =>
                              setEnvoiDevis((prev) => ({
                                ...prev,
                                choisis: coche ? prev.choisis.filter((a) => a !== adresse) : [...prev.choisis, adresse],
                              }))
                            }
                          />
                          {adresse}
                          {typeof c === "object" && c.label ? <span className="text-[10px] text-slate-400">({c.label})</span> : null}
                        </label>
                      );
                    })}
                    <input
                      value={envoiDevis.extra}
                      onChange={(e) => setEnvoiDevis((prev) => ({ ...prev, extra: e.target.value }))}
                      placeholder="Autre adresse (optionnel)"
                      className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    {envoiDevis.extra.trim() !== "" && (
                      <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={!!envoiDevis.extraFiche}
                          onChange={(e) => setEnvoiDevis((prev) => ({ ...prev, extraFiche: e.target.checked }))}
                          className="h-4 w-4 accent-[#FF6A13]"
                        />
                        💾 Ajouter cette adresse à la fiche du client
                      </label>
                    )}
                    <div className="flex gap-1.5">
                      <Button
                        onClick={() => envoyerDevisParCourriel(affichee)}
                        disabled={envoiDevisEnCours || (envoiDevis.choisis.length === 0 && !envoiDevis.extra.trim())}
                        className="min-h-0 flex-1 py-1.5 text-xs"
                      >
                        {envoiDevisEnCours ? "Envoi…" : "Envoyer"}
                      </Button>
                      <Button variant="outline" onClick={() => setEnvoiDevis(null)} className="min-h-0 py-1.5 text-xs">
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
                {estActive && (!affichee.reponseClient || affichee.reponseClient === "accepte") && (
                  <Button
                    variant="outline"
                    onClick={() => creerLienAcceptation(affichee)}
                    className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs"
                  >
                    <Copy size={13} /> {lienCopie === affichee.id ? "Lien copié ✓" : affichee.reponseClient === "accepte" ? "Copier le lien du devis" : "Copier le lien d'acceptation"}
                  </Button>
                )}

                {/* Actions réservées à la version ACTIVE — on ne traite
                    jamais une révision archivée par erreur. */}
                {estActive && affichee.statut !== "accepte" && (
                  <Button onClick={() => accepterDevis(affichee)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                    <Check size={13} /> Marquer accepté
                  </Button>
                )}
                {estActive && affichee.statut === "accepte" && !affichee.traite && (
                  <Button onClick={() => setDevisATraiterId(affichee.id)} className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs">
                    <ClipboardList size={13} /> Traiter le devis
                  </Button>
                )}
                {/* ❌ ANNULER UN DEVIS ACCEPTÉ (2026-08-29) — le client
                    s'est désisté après coup. Raison obligatoire, preuve
                    d'acceptation conservée, et l'estimate QuickBooks
                    passe à « Rejeté » automatiquement. */}
                {estActive && affichee.statut === "accepte" && (
                  <button
                    onClick={() => { setAnnulationDevis(affichee); setRaisonAnnulationDevis(""); }}
                    className="mt-1.5 w-full text-center text-[10px] font-semibold text-red-400 underline underline-offset-2 hover:text-red-600"
                  >
                    ❌ Le client annule — annuler ce devis accepté…
                  </button>
                )}
                {affichee.statut === "annule" && (
                  <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">
                    ❌ ANNULÉ{affichee.annuleLe ? ` le ${String(affichee.annuleLe).slice(0, 10)}` : ""}
                    {affichee.annuleRaison ? ` — ${affichee.annuleRaison}` : ""}
                    <span className="mt-0.5 block text-[10px] font-normal text-red-500">
                      La preuve d&apos;acceptation du client est conservée. L&apos;estimate QuickBooks est marqué « Rejeté ».
                    </span>
                  </p>
                )}

                {/* NOUVELLE VERSION — depuis la version affichée. C'est ce
                    qui permet de « repartir d'une ancienne version ». */}
                {creationVersionPour === affichee.numero ? (
                  <div className="mt-2 rounded-lg border border-slate-300 bg-slate-50 p-2.5">
                    <p className="text-[11px] font-bold text-slate-800">Nouvelle version à partir de {affichee.numero}</p>
                    <input
                      value={noteNouvelleVersion}
                      onChange={(e) => setNoteNouvelleVersion(e.target.value)}
                      placeholder="Raison (ex : le client retire le rooftop)"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <Button onClick={() => demarrerNouvelleVersion(affichee, noteNouvelleVersion)} className="min-h-0 flex-1 py-1.5 text-[11px]">
                        Modifier et créer
                      </Button>
                      <Button variant="outline" onClick={() => setCreationVersionPour(null)} className="min-h-0 py-1.5 text-[11px]">
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  !affichee.traite && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreationVersionPour(affichee.numero);
                        setNoteNouvelleVersion("");
                      }}
                      className="mt-2 w-full min-h-0 gap-1.5 py-2 text-xs"
                    >
                      <Plus size={13} /> {estActive ? "Nouvelle version" : "Repartir de cette version"}
                    </Button>
                  )
                )}
              </div>
            );
  };

  // 🪟 CONSTRUCTEUR — rendu dans la COLONNE (devis neuf) ou dans la
  // FENÊTRE d'édition (nouvelle version, la demande du client sous les
  // yeux — demande du propriétaire, 2026-08-30). Même technique que la
  // carte de dossier : une seule source de vérité, rendue où il faut.
  const rendreConstructeur = () => (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-3 md:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
            {editionVersion ? "Modification en cours" : "Nouveau devis"}
          </h2>
          {/* MODE ÉDITION — les lignes de la version source sont chargées
              ici. Le devis d'origine reste INTACT : l'enregistrement crée
              une NOUVELLE version (règle validée : un devis envoyé ne se
              modifie jamais, il se révise). */}
          {editionVersion && (
            <div className="rounded-xl border border-blue-300 bg-blue-50 p-2.5">
              <p className="text-xs font-bold text-blue-900">
                ✏️ Nouvelle version à partir de {editionVersion.source.numero}
              </p>
              <p className="mt-0.5 text-[10px] text-blue-700">
                Ajoute ou retire des produits, change les quantités et les prix. {editionVersion.source.numero} ne sera pas modifié — une nouvelle version sera créée à l'enregistrement.
              </p>
              {editionVersion.note && <p className="mt-1 text-[10px] italic text-blue-600">Raison : {editionVersion.note}</p>}
              <Button variant="outline" onClick={annulerEdition} className="mt-2 w-full min-h-0 py-1.5 text-[11px]">
                Annuler la modification
              </Button>
            </div>
          )}

          {/* TYPE DE DEVIS — choisi dès le départ, bien visible (comme les
              boutons Jour/Semaine/Mois de l'agenda) : travaux réguliers, ou
              entretien périodique facturé selon contrat (1 à 4 fois/an). */}
          <div className="flex rounded-xl border border-slate-200 p-0.5">
            <button
              onClick={() => setEstContrat(false)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${!estContrat ? "bg-[#131B2E] text-white" : "text-slate-500"}`}
            >
              Travaux réguliers
            </button>
            <button
              onClick={() => setEstContrat(true)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${estContrat ? "bg-purple-700 text-white" : "text-slate-500"}`}
            >
              📄 Entretien périodique
            </button>
          </div>
          {estContrat && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-2.5">
              <label className="mb-0.5 block text-[10px] font-bold text-purple-800">Fréquence de facturation du contrat</label>
              <select
                value={frequenceContrat}
                onChange={(e) => setFrequenceContrat(parseInt(e.target.value))}
                className="w-full rounded-lg border border-purple-300 bg-white px-2 py-1.5 text-xs font-semibold"
              >
                {FREQUENCES_CONTRAT.map((f) => (
                  <option key={f} value={f}>
                    {f === 1 ? "1 facture par an (montant complet payé en une fois)" : `${f} factures par an (1/${f} du montant à chaque échéance)`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Client</label>
            <button
              type="button"
              onClick={() => setModalNouveauClient(true)}
              className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 active:scale-[0.99]"
            >
              ➕ Nouveau client…
            </button>
            <input
              value={filtreClientDevis}
              onChange={(e) => setFiltreClientDevis(e.target.value)}
              onFocus={() => setListeClientsDevisOuverte(true)}
              // Petit délai avant de fermer : le clic sur un nom de la
              // liste doit avoir le temps de compter avant que le champ
              // perde le focus.
              onBlur={() => setTimeout(() => setListeClientsDevisOuverte(false), 200)}
              placeholder="🔍 Clique pour la liste, ou tape le nom…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            />
            {(listeClientsDevisOuverte || filtreClientDevis.trim() !== "") && (
              <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {clients
                  .filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientDevis.trim().toLowerCase()))
                  .sort((a, b) => nomAffichageClient(a).localeCompare(nomAffichageClient(b), "fr"))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setClientId(c.id); setFiltreClientDevis(""); setListeClientsDevisOuverte(false); }}
                      className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 last:border-0 active:bg-orange-50"
                    >
                      <span className="block truncate">{nomAffichageClient(c)}</span>
                    </button>
                  ))}
                {clients.filter((c) => `${c.nom} ${c.entreprise || ""} ${c.telephone || ""}`.toLowerCase().includes(filtreClientDevis.trim().toLowerCase())).length === 0 && (
                  <p className="px-3 py-2.5 text-xs text-slate-400">Aucun client trouvé — crée-le avec « ➕ Nouveau client… » juste au-dessus.</p>
                )}
              </div>
            )}
            {(() => {
              const c = clients.find((x) => x.id === clientId);
              return c ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-[#FF6A13] bg-orange-50 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-bold text-slate-800">{c.nom}</span>
                  <button type="button" onClick={() => setClientId("")} className="shrink-0 text-[11px] font-bold text-slate-400 underline underline-offset-2">
                    changer
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[11px] font-bold text-amber-600">— Choisis le client (tape son nom, ou crée-le avec ➕) —</p>
              );
            })()}
          </div>

          {/* Ajouter une adresse — SEULEMENT quand un client est choisi :
              sans client sélectionné, `client` est undefined et lire
              `client.nom` faisait planter tout l'onglet Devis (depuis le
              retrait de la présélection, 2026-08-17). */}
          {client && (
            <div className="rounded-xl bg-slate-50 p-3">
              {/* 📍 L'ADRESSE D'ABORD (correctif 2026-09-06 : le champ
                  Google était le 3e — les gens tapaient l'adresse dans
                  « Nom de l'adresse » et rien n'apparaissait). */}
              <label className="mb-1 block text-xs font-bold text-slate-500">📍 Ajouter une adresse au dossier client — tape-la ici et CHOISIS dans la liste</label>
              <AutocompleteAdresse onSelection={enregistrerAdresse} />
              <input
                value={nouvelleAdresseNom}
                onChange={(e) => setNouvelleAdresseNom(e.target.value)}
                placeholder="Petit nom de l'adresse (facultatif — ex: Chantier Sud)"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={nouvelleAdresseNomUnite}
                onChange={(e) => setNouvelleAdresseNomUnite(e.target.value)}
                placeholder="App. / bureau / casier postal (facultatif)"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">Choisir un résultat enregistre l&apos;adresse au dossier de {client.nom} (avec le petit nom s&apos;il est rempli).</p>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                Lignes du devis
                {/* 👁️ L'interrupteur des coûts — bien en vue : d'un tap,
                    l'écran devient montrable au client. */}
                <button
                  type="button"
                  onClick={basculerCouts}
                  title={coutsVisibles ? "Masquer les coûts et la marge (écran montrable au client)" : "Afficher les coûts et la marge"}
                  className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                    coutsVisibles ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {coutsVisibles ? "👁️ Coûts visibles" : "🙈 Coûts masqués"}
                </button>
              </label>
              <div className="flex gap-1.5">
                <SelecteurItem catalogue={catalogue} onChoisir={(p) => ajouterLigne(p)} />
                <Button variant="outline" onClick={ajouterLignePersonnalisee} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
                  <Plus size={12} /> Ligne sur mesure
                </Button>
                {/* RABAIS — une ligne au montant NÉGATIF. Rien
                    n'empêchait d'en saisir une à la main, mais il
                    fallait deviner qu'un prix pouvait être négatif.
                    Le rabais s'applique AVANT les taxes, comme il se
                    doit : on ne facture pas de taxes sur un montant
                    que le client ne paie pas. */}
                <Button variant="outline" onClick={ajouterRabais} className="min-h-0 gap-1 px-2.5 py-1.5 text-xs">
                  − Rabais
                </Button>
              </div>
            </div>

            {/* 📱 LIGNES EN CARTES — TÉLÉPHONE (2026-08-21)
                ------------------------------------------------------------
                Le tableau à 4 colonnes (produit, qté, coûtant, vendant)
                est écrasé sur un écran de 6 pouces : on se trompe de
                case. Même devis, une CARTE par ligne, avec de vrais
                champs sous le pouce. Tout est modifiable comme sur
                l'ordinateur — c'est la même donnée. */}
            <div className="space-y-2 md:hidden">
              {lignes.map((l) => {
                const totalLigne = (Number(l.prix_vendant) || 0) * (Number(l.quantite) || 0);
                const coutant = Number(l.prix_coutant) || 0;
                return (
                  <div key={l.uid} className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      {l.surMesure ? (
                        <input
                          type="text"
                          value={l.nom}
                          onChange={(e) => majLigne(l.uid, { ...l, nom: e.target.value })}
                          placeholder="Détail de l'item…"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm font-semibold"
                        />
                      ) : (
                        <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900">{l.nom}</p>
                      )}
                      <button
                        onClick={() => supprimerLigne(l.uid)}
                        aria-label="Retirer la ligne"
                        className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* ✏️ La description s'ouvre EN GRAND d'un tap — deux
                        lignes ne suffisent ni pour lire ni pour écrire
                        l'argumentaire qui partira au client. */}
                    <button
                      type="button"
                      onClick={() => setDescriptionOuverte({ uid: l.uid })}
                      className="mt-2 flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left"
                    >
                      <span className={`min-w-0 flex-1 text-[12px] leading-snug ${l.description ? "text-slate-600" : "italic text-slate-400"}`}>
                        {l.description || "Ajouter une description visible par le client…"}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-slate-400">✏️</span>
                    </button>
                    <div className={`mt-2 grid gap-2 ${coutsVisibles ? "grid-cols-3" : "grid-cols-2"}`}>
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Qté</label>
                        <input
                          type="number"
                          min={1}
                          value={l.quantite}
                          onChange={(e) => majLigne(l.uid, { ...l, quantite: parseFloat(e.target.value) || 1 })}
                          className="min-h-[44px] w-full rounded-lg border border-slate-300 px-2 text-center text-sm tabular-nums"
                        />
                      </div>
                      {/* 🙈 Le COÛTANT n'apparaît que si les coûts sont
                          affichés — mais il continue d'être enregistré et
                          compté dans la marge, masqué ou non. */}
                      {coutsVisibles && (
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Coûtant</label>
                          <InputNombreDecimal
                            valeur={l.prix_coutant}
                            onChange={(v) => majLigne(l.uid, { ...l, prix_coutant: v })}
                            onBlur={() => proposerReportCatalogue(l)}
                            className={`min-h-[44px] w-full rounded-lg border px-2 text-right text-sm tabular-nums ${
                              coutant === 0 ? "border-amber-400 bg-amber-50" : "border-slate-300"
                            }`}
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Vendant</label>
                        <InputNombreDecimal
                          valeur={l.prix_vendant}
                          onChange={(v) => majLigne(l.uid, { ...l, prix_vendant: v })}
                          className={`min-h-[44px] w-full rounded-lg border px-2 text-right text-sm font-bold tabular-nums ${
                            (Number(l.prix_vendant) || 0) < 0 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-300"
                          }`}
                        />
                      </div>
                    </div>
                    <p className="mt-1.5 flex items-center justify-between text-[11px]">
                      {coutsVisibles ? (
                        <span className={coutant === 0 ? "font-semibold text-amber-600" : "text-slate-400"}>
                          {coutant === 0 ? "⚠️ Coût inconnu — hors marge" : `Marge ${margePourcent(coutant, Number(l.prix_vendant) || 0).toFixed(0)} %`}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="font-bold tabular-nums text-slate-700">{totalLigne.toFixed(2)} $</span>
                    </p>
                  </div>
                );
              })}
              {lignes.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">Aucune ligne — ajoute un produit du catalogue.</p>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-1.5 font-semibold">Produit</th>
                    <th className="pb-1.5 text-center font-semibold">Qté</th>
                    {coutsVisibles && <th className="pb-1.5 text-right font-semibold">Coûtant</th>}
                    <th className="pb-1.5 text-right font-semibold">Vendant</th>
                    <th className="pb-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.uid} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 font-semibold text-slate-800">
                        {l.surMesure ? (
                          <input
                            type="text"
                            value={l.nom}
                            onChange={(e) => majLigne(l.uid, { ...l, nom: e.target.value })}
                            placeholder="Détail de l'item..."
                            className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
                          />
                        ) : (
                          l.nom
                        )}
                        {/* DESCRIPTION DE L'ITEM — modèles, garantie,
                            numéros AHRI, subventions… Elle vient du
                            catalogue (importée de QuickBooks) et part
                            SUR LE DEVIS DU CLIENT : c'est l'argumentaire
                            de vente, il n'a rien à faire caché au fond
                            de la base de données.
                            Modifiable ici : on l'ajuste pour CE devis
                            sans toucher au catalogue. */}
                        <textarea
                          rows={hauteurDescription(l.description)}
                          value={l.description || ""}
                          onChange={(e) => majLigne(l.uid, { ...l, description: e.target.value })}
                          placeholder="Description visible par le client (modèles, garantie, ce qui est inclus…)"
                          className="mt-1 w-full resize-y rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] font-normal leading-snug text-slate-600 outline-none focus:border-slate-400"
                        />
                        <p className="mt-0.5 flex items-center justify-between gap-2 text-[9px] italic text-slate-400">
                          <span>Modifiable — n&apos;affecte que ce devis, pas le catalogue.</span>
                          <button
                            type="button"
                            onClick={() => setDescriptionOuverte({ uid: l.uid })}
                            className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold not-italic text-slate-500 hover:border-slate-400 hover:text-slate-700"
                          >
                            ⤢ Agrandir
                          </button>
                        </p>
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={l.quantite}
                          onChange={(e) => majLigne(l.uid, { ...l, quantite: parseFloat(e.target.value) || 1 })}
                          className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center tabular-nums"
                        />
                      </td>
                      {/* COÛTANT TOUJOURS MODIFIABLE — c'est ici qu'on
                          complète un forfait dont QuickBooks ne connaît
                          pas le coût, au moment où on monte le devis.
                          En sortant du champ, une fenêtre propose de
                          reporter le prix au catalogue (si le droit
                          l'autorise). Encadré en ambre tant qu'il est à
                          zéro : la ligne n'entre pas dans la marge. */}
                      {coutsVisibles && (
                        <td className="py-1.5 text-right tabular-nums text-slate-500">
                          <InputNombreDecimal
                            valeur={l.prix_coutant}
                            onChange={(v) => majLigne(l.uid, { ...l, prix_coutant: v })}
                            onBlur={() => proposerReportCatalogue(l)}
                            className={`w-16 rounded border px-1 py-0.5 text-right tabular-nums ${
                              (Number(l.prix_coutant) || 0) === 0
                                ? "border-amber-400 bg-amber-50"
                                : "border-slate-300"
                            }`}
                          />
                        </td>
                      )}
                      {/* PRIX DE VENTE TOUJOURS MODIFIABLE — il ne
                          l'était que sur les lignes « sur mesure » :
                          sur un item du catalogue, c'était du texte
                          figé. Impossible d'ajuster un prix pour un
                          client, ni de saisir un rabais.
                          Les valeurs NÉGATIVES sont acceptées (rabais,
                          crédit) : le champ et les totaux les gèrent. */}
                      <td className="py-1.5 text-right tabular-nums font-semibold text-slate-900">
                        <InputNombreDecimal
                          valeur={l.prix_vendant}
                          onChange={(v) => majLigne(l.uid, { ...l, prix_vendant: v })}
                          className={`w-20 rounded border px-1 py-0.5 text-right tabular-nums font-semibold ${
                            (Number(l.prix_vendant) || 0) < 0
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : "border-slate-300"
                          }`}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => supprimerLigne(l.uid)} className="text-slate-300 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lignes.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Aucune ligne — ajoute un produit du catalogue.</p>}
            </div>
          </div>

          {lignes.length > 0 && (
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
              {coutsVisibles && (
                <div className="flex justify-between text-slate-500"><span>Total coûtant</span><span className="tabular-nums">{totaux.coutant.toFixed(2)} $</span></div>
              )}
              <div className="flex justify-between font-bold text-slate-900"><span>Sous-total (HT)</span><span className="tabular-nums">{totaux.vendant.toFixed(2)} $</span></div>

              {/* TAXES — elles n'apparaissaient qu'au moment de l'aperçu
                  client. Or c'est le TOTAL TTC que le client compare et
                  retient : il doit être visible pendant qu'on monte le
                  devis, pas seulement à la fin. Taux lus dans les
                  Paramètres de l'entreprise. */}
              {(() => {
                const { tps, tvq, total } = calculerTaxes(totaux.vendant, configEnt);
                return (
                  <>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>TPS ({tauxAffiche(configEnt.tauxTps)}%)</span>
                      <span className="tabular-nums">{tps.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>TVQ ({tauxAffiche(configEnt.tauxTvq)}%)</span>
                      <span className="tabular-nums">{tvq.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-extrabold text-slate-900">
                      <span>Total client</span>
                      <span className="tabular-nums">{total.toFixed(2)} $</span>
                    </div>
                  </>
                );
              })()}
              {/* 🙈 MARGE ET COÛTS — masqués par défaut : l'écran est
                  souvent tourné vers le client pendant qu'on monte le
                  devis. Les chiffres restent enregistrés et calculés,
                  seul l'affichage disparaît. Le rappel « lignes sans
                  coûtant » reste, lui, visible : il ne dévoile aucun
                  montant et évite d'envoyer un devis à l'aveugle. */}
              {!coutsVisibles && lignesNonEvaluees.length > 0 && (
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>🙈 Coûts masqués</span>
                  <span>
                    {lignesNonEvaluees.length} ligne{lignesNonEvaluees.length > 1 ? "s" : ""} sans coûtant
                  </span>
                </div>
              )}
              {coutsVisibles && (
              <div className={`flex justify-between ${lignesNonEvaluees.length > 0 ? "text-slate-600" : "text-emerald-600"}`}>
                <span>
                  Marge
                  {lignesNonEvaluees.length > 0 && (
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      sur {lignesEvaluees.length} ligne{lignesEvaluees.length > 1 ? "s" : ""} sur {lignes.length}
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {lignesEvaluees.length === 0
                    ? "— non évaluable"
                    : `${marge.toFixed(2)} $ (${margePct.toFixed(0)}%)`}
                </span>
              </div>
              )}

              {/* CE QUI N'EST PAS ÉVALUÉ — en DOLLARS, pas en nombre de
                  lignes : « 1 ligne incomplète » ne dit pas s'il s'agit
                  d'un bouchon à 10 $ ou d'un contrat à 8 100 $. */}
              {coutsVisibles && lignesNonEvaluees.length > 0 && (
                <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2">
                  <p className="text-[11px] font-extrabold tabular-nums text-amber-800">
                    ⚠️ {montantNonEvalue.toFixed(2)} $ non évalués sur {totaux.vendant.toFixed(2)} $
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {lignesNonEvaluees.slice(0, 4).map((l) => (
                      <li key={l.uid} className="text-[10px] leading-snug text-amber-700">
                        • {l.nom || "Ligne sans nom"} — coût manquant
                      </li>
                    ))}
                    {lignesNonEvaluees.length > 4 && (
                      <li className="text-[10px] text-amber-700">• +{lignesNonEvaluees.length - 4} autre(s)</li>
                    )}
                  </ul>
                  <p className="mt-1 text-[10px] leading-snug text-amber-700">
                    Entre le coûtant directement dans la colonne pour compléter la marge.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ✏️ DESCRIPTION EN GRAND — deux lignes d'aperçu suffisent pour
              repérer, jamais pour écrire ni relire l'argumentaire qui
              partira au client. Le texte s'écrit directement dans la
              ligne : rien à « valider », fermer suffit. */}
          {descriptionOuverte && (() => {
            const ligneOuverte = lignes.find((x) => x.uid === descriptionOuverte.uid);
            if (!ligneOuverte) return null;
            return (
              <div
                className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
                onClick={() => setDescriptionOuverte(null)}
              >
                <div
                  className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Description visible par le client</p>
                      <p className="truncate text-sm font-bold text-slate-800">{ligneOuverte.nom || "Ligne sans nom"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescriptionOuverte(null)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Fermer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <textarea
                      autoFocus
                      value={ligneOuverte.description || ""}
                      onChange={(e) => majLigne(ligneOuverte.uid, { ...ligneOuverte, description: e.target.value })}
                      placeholder="Modèles, garantie, ce qui est inclus, ce qui ne l'est pas…"
                      className="h-[55vh] w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-slate-500 sm:h-72"
                    />
                    <p className="mt-2 text-[11px] italic leading-snug text-slate-400">
                      N&apos;affecte que ce devis, pas le catalogue. Le texte s&apos;enregistre au fur et à mesure.
                    </p>
                  </div>
                  <div className="border-t border-slate-200 p-3">
                    <Button onClick={() => setDescriptionOuverte(null)} className="w-full">
                      Terminé
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 📝 GARDER EN BROUILLON — commencer chez le client sur le
              téléphone, finir au bureau, sans brûler de numéro. Pas
              offert en révision de version (une révision a déjà son
              dossier — le brouillon n'a pas de sens là). */}
          {!editionVersion && (
            <Button
              variant="outline"
              onClick={garderBrouillon}
              disabled={lignes.length === 0 || !clientId}
              className="w-full"
            >
              📝 Garder en brouillon {reprisBrouillonId ? "(mise à jour)" : "(sans numéro)"}
            </Button>
          )}
          {editionVersion ? (
            <div className="space-y-1.5">
              {/* 📧 Le chemin RAPIDE demandé par le propriétaire : la
                  version s'enregistre et la fenêtre des destinataires
                  s'ouvre aussitôt — impossible d'oublier l'envoi. Le
                  courriel ne part qu'après TA confirmation là-dedans. */}
              <Button onClick={() => enregistrerVersion(true)} disabled={lignes.length === 0} className="w-full">
                💾 Enregistrer et envoyer au client…
              </Button>
              <Button variant="outline" onClick={() => enregistrerVersion(false)} disabled={lignes.length === 0} className="w-full min-h-0 py-2 text-xs">
                Enregistrer sans envoyer
              </Button>
            </div>
          ) : (
            <Button onClick={demarrerCreationDevis} disabled={lignes.length === 0} className="w-full">
              {estContrat ? "Créer le contrat d'entretien périodique" : "Créer le devis"}
            </Button>
          )}
        </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* 💬 CE À QUOI TES CLIENTS ONT RÉPONDU — en tête, avant tout le
          reste : une demande de modification ne doit plus dormir au fond
          d'une carte de devis (retour du propriétaire, 2026-08-28). */}
      <BlocReponsesClients
        reponses={reponsesATraiter}
        onOuvrirDevis={allerAuDossier}
        onNouvelleVersion={(d) => {
          // 🎯 DIRECT AU CONSTRUCTEUR (2026-08-30, retour du
          // propriétaire : « je ne peux pas faire le devis à partir de
          // là ») — plus d'étape intermédiaire : les lignes du devis se
          // chargent tout de suite dans le constructeur, la raison
          // pré-remplie avec la demande du client. L'enregistrement
          // créera la nouvelle version, l'originale reste intacte.
          demarrerNouvelleVersion(d, d.messageClient ? `Demande du client : ${d.messageClient}` : "");
        }}
        onTraiterDevis={(d) => setDevisATraiterId(d.id)}
        onRenvoyer={renvoyerApresReponse}
        onClasser={classerReponse}
        onEffacerErreur={effacerDemandeErreur}
      />

      <div className="grid gap-6 md:grid-cols-5">
        {/* CONSTRUCTEUR DE DEVIS */}
        {editionEnFenetre && editionVersion ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500 md:col-span-3">
            🪟 Modification en cours dans la fenêtre…
          </div>
        ) : (
          rendreConstructeur()
        )}

        {/* LISTE DES DEVIS */}
        <div className="space-y-2 md:col-span-2">
          {/* 📝 BROUILLONS — feuilles de travail sans numéro. Reprendre
              recharge le formulaire ; le vrai devis s'y crée ensuite. */}
          {brouillonsDevis.length > 0 && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                📝 Brouillons ({brouillonsDevis.length}) — sans numéro
              </p>
              <div className="mt-1.5 space-y-1.5">
                {brouillonsDevis.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{b.clientNom || "Client ?"}</p>
                      <p className="text-[10px] tabular-nums text-slate-500">
                        {(Number(b.totalVendant) || 0).toFixed(2)} $ · {(b.lignes || []).length} ligne{(b.lignes || []).length > 1 ? "s" : ""} · {b.date}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => reprendreBrouillon(b)} className="min-h-[40px] px-3 py-1.5 text-[11px]">
                      Reprendre
                    </Button>
                    {brouillonASupprimer === b.id ? (
                      <button onClick={() => supprimerBrouillon(b)} className="rounded-lg bg-red-600 px-2.5 py-2 text-[10px] font-bold text-white">
                        Confirmer ?
                      </button>
                    ) : (
                      <button onClick={() => setBrouillonASupprimer(b.id)} className="px-1 text-[10px] font-semibold text-slate-400 underline underline-offset-2">
                        Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 ref={refListeDevis} className="px-1 text-sm font-extrabold uppercase tracking-wide text-slate-500">Devis récents</h2>
          <p className="px-1 text-[11px] text-slate-400">
            10 par page. Tous les devis d'un client sont dans <span className="font-bold">son dossier</span> (onglet Clients), et la{" "}
            <span className="font-bold">recherche rapide</span> les trouve par numéro, client ou produit.
          </p>
          {dossiersDevis.length === 0 && <p className="px-1 text-xs text-slate-400">Aucun devis pour le moment.</p>}
          {/* UNE CARTE PAR DOSSIER — la version active est affichée ; les
              révisions précédentes s'atteignent par les onglets. */}
          {dossiersDevis.slice((Math.min(pageDevis, Math.max(1, Math.ceil(dossiersDevis.length / ITEMS_PAR_PAGE))) - 1) * ITEMS_PAR_PAGE, Math.min(pageDevis, Math.max(1, Math.ceil(dossiersDevis.length / ITEMS_PAR_PAGE))) * ITEMS_PAR_PAGE).map((dossier) => rendreCarteDossier(dossier))}
          <BarrePagination total={dossiersDevis.length} page={pageDevis} onPage={setPageDevis} refHaut={refListeDevis} libelle="devis" />
        </div>
      </div>

      {/* 🪟 FENÊTRE D'ÉDITION D'UNE RÉVISION — le VRAI constructeur,
          par-dessus la liste, avec la demande du client sous les yeux.
          Fermer ne perd rien : l'édition reste chargée dans la page. */}
      {editionEnFenetre && editionVersion && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 md:p-6" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; setEditionEnFenetre(false); }}>
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-2 md:p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-2 px-1 pt-1">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  🪟 Nouvelle version de {editionVersion.source?.numero}
                </p>
                {/* ✏️ LA DEMANDE DU CLIENT, en toutes lettres — on modifie
                    en la lisant, sans rien mémoriser. */}
                {editionVersion.source?.messageClient && (
                  <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] italic leading-snug text-amber-800">
                    ✏️ Demande du client{editionVersion.source?.reponduParNom ? ` (${editionVersion.source.reponduParNom})` : ""} : « {editionVersion.source.messageClient} »
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditionEnFenetre(false)}
                aria-label="Fermer"
                title="Ferme la fenêtre sans rien perdre — la modification reste chargée dans la page"
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            {rendreConstructeur()}
          </div>
        </div>
      )}
      {/* 🪟 FENÊTRE CONTEXTUELLE DU DOSSIER — la même carte que dans la
          liste, par-dessus l'écran. Se ferme au ✕ ou au clic à côté. */}
      {dossierEnModale && (() => {
        const dossier = dossiersDevis.find((x) => x.base === dossierEnModale);
        if (!dossier) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; setDossierEnModale(null); }}>
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">🪟 Dossier {dossierEnModale}</p>
                <button onClick={() => setDossierEnModale(null)} aria-label="Fermer" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              {rendreCarteDossier(dossier, true)}
            </div>
          </div>
        );
      })()}
      {pdfAperçu && <ApercuBonCommande data={pdfAperçu} onFermer={() => setPdfAperçu(null)} />}
      {devisAperçu && <ApercuDevisClient devis={devisAperçu} onFermer={() => setDevisAperçu(null)} />}
      {courrielModalOuvert && (
        <ModalSelectionCourriel
          client={client}
          contexte={`Devis pour ${client.nom} — ${totaux.vendant.toFixed(2)} $`}
          onFermer={() => setCourrielModalOuvert(false)}
          onConfirmer={(choix) => creerDevis(choix)}
        />
      )}
      {/* FENÊTRE — NOUVEAU CLIENT depuis le devis (composant partagé). */}
      {/* REPORT DU COÛT AU CATALOGUE — fenêtre de confirmation.
          Sans le droit « Modifier la liste de prix », la case n'est pas
          proposée : on l'annonce clairement plutôt que d'afficher un
          bouton grisé que personne ne comprend. */}
      {reportCatalogue && (
        <ModalReportCatalogue
          info={reportCatalogue}
          peutModifierListePrix={peutModifierListePrix}
          onFermer={() => setReportCatalogue(null)}
          onConfirmer={async (reporter) => {
            const { item, saisi } = reportCatalogue;
            setReportCatalogue(null);
            if (!reporter) return;
            try {
              await onMajCoutCatalogue?.({ ...item, prix_coutant: saisi });
            } catch {
              // L'échec ne doit pas faire perdre le devis en cours : le
              // prix reste bon sur la ligne, seul le catalogue n'a pas suivi.
              ajouterJournal(`⚠️ Coût de « ${item.nom} » appliqué au devis mais NON enregistré au catalogue — réessaie depuis l'onglet Tarifs.`);
            }
          }}
        />
      )}

      {modalNouveauClient && (
        <ModalNouveauClient
          clients={clients}
          setClients={setClients}
          ajouterJournal={ajouterJournal}
          onFermer={() => setModalNouveauClient(false)}
          onSelection={(id) => setClientId(id)}
        />
      )}
      {/* ❌ CONFIRMATION D'ANNULATION D'UN DEVIS ACCEPTÉ */}
      {annulationDevis && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setAnnulationDevis(null); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-red-700">❌ Annuler le devis {annulationDevis.numero} ?</h3>
            <p className="mt-1 text-xs text-slate-600">
              {annulationDevis.clientNom} · {(Number(annulationDevis.totalVendant) || 0).toFixed(2)} $ —
              accepté{annulationDevis.reponduParNom ? ` par ${annulationDevis.reponduParNom}` : ""}.
            </p>
            <ul className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-600">
              <li>• La <span className="font-bold">preuve d&apos;acceptation</span> (nom, date, conditions signées) est <span className="font-bold">conservée</span> — l&apos;annulation s&apos;ajoute par-dessus.</li>
              <li>• L&apos;estimate <span className="font-bold">QuickBooks</span> passera à « Rejeté » automatiquement.</li>
              {annulationDevis.traite && (
                <li className="font-bold text-amber-700">
                  ⚠️ Ce devis a DÉJÀ été converti ({annulationDevis.modeTraitement === "projet" ? "un projet existe" : "un bon de travail existe"}) —
                  l&apos;annulation ne touche PAS à ce qui a été créé ni aux factures parties : à gérer toi-même ensuite.
                </li>
              )}
            </ul>
            <label className="mb-1 mt-3 block text-xs font-bold text-slate-500">Raison (obligatoire — consignée au journal)</label>
            <input
              value={raisonAnnulationDevis}
              onChange={(e) => setRaisonAnnulationDevis(e.target.value)}
              placeholder="Ex. : le client s'est désisté, projet reporté…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setAnnulationDevis(null)}>Retour</Button>
              <button
                onClick={executerAnnulationDevis}
                disabled={raisonAnnulationDevis.trim().length < 3}
                className="min-h-[40px] rounded-xl bg-red-600 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Annuler ce devis
              </button>
            </div>
          </div>
        </div>
      )}

      {devisATraiter && (
        <ModalTraiterDevis
          devis={devisATraiter}
          clients={clients}
          onFermer={() => setDevisATraiterId(null)}
          onChoisirBonTravail={traiterCommeBonDeTravail}
          onChoisirProjet={traiterCommeProjet}
          tauxMoyen={tauxMoyenEquipe(tauxMetiers)}
        />
      )}
    </div>
  );
}


export function ApercuBonCommande({ data, onFermer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 size={18} className="text-[#FF6A13]" />
            <h3 className="text-sm font-extrabold">Bon de commande généré</h3>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <p className="font-bold">BON DE COMMANDE — {data.numero}</p>
          <p className="text-xs text-slate-500">Client : {data.client} · {data.date}</p>
          <p className="mt-2 text-xs font-bold uppercase text-slate-400">Matériaux requis</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {data.materiaux.map((m, i) => (
              <li key={i}>• {m.quantite} × {m.description} ({m.unite})</li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] italic text-slate-400">Aucun prix de vente inclus — document destiné aux achats uniquement.</p>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <Mail size={15} className="shrink-0 text-slate-400" />
          Envoyé automatiquement à <span className="font-semibold">achats@ventilationdgl.com</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Aperçu de démonstration — la génération réelle du PDF et l'envoi du courriel se font via une fonction backend (ex. Supabase Edge Function + service courriel transactionnel).
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ONGLET AGENDA
// ============================================================
