"use client";

// app/admin/OngletPieces.jsx
//
// PIÈCES EN COMMANDE + matériel camion + bons de commande libres —
// tranche T2 du découpage de page.jsx (2026-08-28). Extraction
// MÉCANIQUE : aucun comportement ne change.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { envoyerCourriel, gabaritBonCommande, gabaritDemandePaiement, gabaritCommandeGroupee, gabaritBcSimple } from "@/lib/courriels";
import { sauvegarderFournisseur, supprimerFournisseur } from "@/lib/supabase/fournisseurs";
import { numeroBonCommande } from "@/lib/supabase/compteurs";
import { ZONES_DEPOTS } from "@/lib/supabase/prixDepots";
import { calculerTaxes } from "@/lib/supabase/entreprise";
import { listerMemoireFournisseurs, memoriserFournisseursArticles } from "@/lib/supabase/materiel";
import { listerInventaire, sauvegarderArticleInventaire, supprimerArticleInventaire } from "@/lib/supabase/inventaire";
import { creerFactureQbo } from "@/lib/quickbooksClient";
import { STATUTS_PIECE, genererNumeroSecours, ITEMS_PAR_PAGE, BarrePagination, ChampPhotosBc, ChampFichiersBc, SelecteurCibleAchat, Button, AutocompleteAdresse, libelleAdresse, descriptionAvecLivraison, bcEstAsap, bcEstRamassage } from "./partage";

export function OngletPieces({ employesRamassage = [], pieces, peutCommander, onMaj, onRecue, onAnnuler, fournisseurs, setFournisseurs, ajouterJournal, nomUtilisateur, clients, depots, prixDepots, onCreerDepot, commandesCamion, onCommandePassee, achatsLibres, onCreerBcLibre, onMajBcLibre, onSupprimerBcLibre, onDemenagerBcVersProjet, onMarquerBcEnvoye = null, onPartielPiece = null, onMajBcProjet = null, projets, tachesPourAchat = [], transactionsQb = [] }) {
  // 🧰 Commandes camion : note d'achat en cours de saisie (par demande).
  const camionEnAttente = (commandesCamion || []).filter((c) => c.statut === "envoyee");
  const configEnt = useEntreprise();
  const [notePassee, setNotePassee] = useState(null); // { id, note }
  // 🛒 COMMANDE GROUPÉE multi-fournisseurs (2026-08-17) : les demandes
  // de TOUS les techniciens agrégées par article, un fournisseur par
  // article (avec MÉMOIRE de la dernière fois), un P/O par fournisseur,
  // un clic = un courriel par fournisseur + tout marqué commandé.
  const [assignFournisseurs, setAssignFournisseurs] = useState({});
  const [envoiGroupeEnCours, setEnvoiGroupeEnCours] = useState(false);
  const [messageGroupe, setMessageGroupe] = useState(null);
  const [noteGroupee, setNoteGroupee] = useState("");
  // ✅ Confirmation avant « Pièce reçue » — le geste qui débloque la
  // planification mérite une double vérification.
  const [confirmRecue, setConfirmRecue] = useState(null);
  useEffect(() => {
    listerMemoireFournisseurs()
      .then((m) => setAssignFournisseurs((prev) => ({ ...m, ...prev })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const articlesGroupes = useMemo(() => {
    const m = new Map();
    camionEnAttente.forEach((c) =>
      (c.lignes || []).forEach((l) => {
        const cle = String(l.article || "").trim().toLowerCase();
        if (!cle) return;
        const e = m.get(cle) || { cle, article: l.article, total: 0, demandeurs: [] };
        e.total += Number(l.quantite) || 1;
        e.demandeurs.push(`${c.technicienNom} ×${Number(l.quantite) || 1}`);
        m.set(cle, e);
      })
    );
    return [...m.values()].sort((a, b) => a.article.localeCompare(b.article));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandesCamion]);
  const articlesSansFournisseur = articlesGroupes.filter((a) => !assignFournisseurs[a.cle]);
  const fournisseursDeLaCommande = [...new Set(articlesGroupes.map((a) => assignFournisseurs[a.cle]).filter(Boolean))];
  const copierListeGroupee = async () => {
    try {
      await navigator.clipboard?.writeText(articlesGroupes.map((a) => `${a.article} × ${a.total}`).join("\n"));
      setMessageGroupe({ ok: true, texte: "Liste copiée — colle-la où tu veux." });
    } catch {
      setMessageGroupe({ ok: false, texte: "Copie refusée par le navigateur." });
    }
  };
  const envoyerCommandesGroupees = async () => {
    if (articlesSansFournisseur.length > 0 || camionEnAttente.length === 0) return;
    setEnvoiGroupeEnCours(true);
    setMessageGroupe(null);
    const groupes = {};
    articlesGroupes.forEach((a) => {
      const f = assignFournisseurs[a.cle];
      if (f) (groupes[f] = groupes[f] || []).push(a);
    });
    const resume = [];
    const sansCourriel = [];
    for (const [fNom, arts] of Object.entries(groupes)) {
      let po;
      try {
        po = await numeroBonCommande();
      } catch {
        po = genererNumeroSecours("BC");
      }
      const fiche = (fournisseurs || []).find((x) => (x.nom || "").trim().toLowerCase() === fNom.trim().toLowerCase());
      const adressesF = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email || "")).filter(Boolean);
      let envoye = false;
      if (adressesF.length > 0) {
        const r = await envoyerCourriel({
          a: adressesF,
          sujet: `Bon de commande ${po} — matériel (${configEnt.nomCommercial || configEnt.nomLegal})`,
          html: gabaritCommandeGroupee({ config: configEnt, numeroPo: po, fournisseurNom: fNom, lignes: arts.map((a) => ({ article: a.article, quantite: a.total })) }),
          copieExpediteur: true,
          // 📧 Copie permanente des BC (réglage d'entreprise, ex. commande@).
          copieA: configEnt.courrielCopieBc ? [configEnt.courrielCopieBc] : [],
        });
        envoye = !!r.envoye;
      } else {
        sansCourriel.push(fNom);
      }
      resume.push(`P/O ${po} (${fNom}${envoye ? "" : adressesF.length > 0 ? " — courriel NON parti" : " — aucun courriel au dossier"})`);
    }
    const noteFinale = `${resume.join(" + ")}${noteGroupee.trim() ? ` — ${noteGroupee.trim()}` : ""}`;
    for (const c of camionEnAttente) {
      // eslint-disable-next-line no-await-in-loop
      await onCommandePassee?.(c.id, noteFinale);
    }
    memoriserFournisseursArticles(
      articlesGroupes.filter((a) => assignFournisseurs[a.cle]).map((a) => ({ article: a.cle, fournisseurNom: assignFournisseurs[a.cle] }))
    ).catch(() => {});
    setMessageGroupe({
      ok: true,
      texte: `✅ ${noteFinale}${sansCourriel.length > 0 ? ` · ⚠️ ${sansCourriel.join(", ")} : aucun courriel au dossier — passe la commande par téléphone (le P/O est réservé)` : ""}`,
    });
    setNoteGroupee("");
    setEnvoiGroupeEnCours(false);
  };
  // ➕ BC libre.
  const [bcLibreOuvert, setBcLibreOuvert] = useState(false);
  // `tacheId` (2026-08-25) : un achat fait POUR une job se rattache à
  // sa tâche — son montant (ajustable à la baisse) compte au coût du
  // client. `montantAttribue` vide = tout le montant.
  const [bcLibre, setBcLibre] = useState({ fournisseurNom: "", description: "", montantHT: 0, projetId: "", tacheId: "", clientId: "", montantAttribue: "", livraisonEstimee: "", courrielFournisseur: "", enregistrerFournisseur: true, livraisonChoix: "atelier", livraisonAutre: "", livraisonAsap: false, ramassePar: "", depotA: "", pourInventaire: false, photos: [], fichiers: [] });
  // 📍 RAPPEL D'ADRESSE (2026-09-09, demande du propriétaire) — avant de
  // créer un BC libre sans adresse choisie (resté sur « atelier » par
  // défaut) ET qui n'est pas du stock d'inventaire, une fenêtre demande
  // de confirmer : livrer à l'atelier, ou revenir choisir le chantier.
  const [rappelAdresseBc, setRappelAdresseBc] = useState(false);
  // ⚠️ RÉCEPTION PARTIELLE (snippet 155, 2026-09-22) : { ligne, manquant, date, erreur, enCours }
  const [partielPour, setPartielPour] = useState(null);
  // 🔗 RAMASSAGES COMBINÉS (2026-09-21, demande du propriétaire : « moins
  // de gestion ») — un bon « ramassage » chez un fournisseur qui a DÉJÀ un
  // ramassage prévu (pas encore fait) se range d'office le même jour,
  // avec la même personne : un seul arrêt pour le commissionnaire. Ne
  // remplit que les cases VIDES — le bureau garde toujours le dernier mot.
  const ramassageDejaPrevu = useMemo(() => {
    const nom = (bcLibre.fournisseurNom || "").trim().toLowerCase();
    if (!nom || bcLibre.livraisonChoix !== "ramassage") return null;
    const aujourdhui = new Date();
    const ajd = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}-${String(aujourdhui.getDate()).padStart(2, "0")}`;
    return (
      (achatsLibres || [])
        .filter((a) => !a.recuLe && bcEstRamassage(a.description) && a.ramassePar && a.livraisonSouhaitee && a.livraisonSouhaitee >= ajd)
        .filter((a) => (a.fournisseurNom || "").trim().toLowerCase() === nom)
        .sort((x, y) => String(x.livraisonSouhaitee).localeCompare(String(y.livraisonSouhaitee)))[0] || null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcLibre.fournisseurNom, bcLibre.livraisonChoix, achatsLibres]);
  useEffect(() => {
    if (!ramassageDejaPrevu) return;
    setBcLibre((f) => ({
      ...f,
      ramassePar: f.ramassePar || ramassageDejaPrevu.ramassePar,
      livraisonEstimee: f.livraisonEstimee || f.livraisonAsap ? f.livraisonEstimee : ramassageDejaPrevu.livraisonSouhaitee,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramassageDejaPrevu?.id]);
  // Création du bon libre — extraite pour être appelée soit directement,
  // soit après le rappel d'adresse (2026-09-09).
  const executerCreationBc = async () => {
    setRappelAdresseBc(false);
    setBcLibreEnCours(true);
    // ⚡/🚚 (2026-09-18) : « dès que possible » et « ramassage » — les
    // lignes du bon sont écrites par descriptionAvecLivraison (partage).
    const ramassageBc = bcLibre.livraisonChoix === "ramassage";
    const dateBc = bcLibre.livraisonAsap ? "" : bcLibre.livraisonEstimee || "";
    const tL = bcLibre.tacheId ? (tachesPourAchat || []).find((x) => x.id === bcLibre.tacheId) : null;
    const clL = bcLibre.clientId ? (clients || []).find((x) => x.id === bcLibre.clientId) : null;
    const prL = bcLibre.projetId ? (projets || []).find((x) => x.id === bcLibre.projetId) : null;
    const adresseLivraisonBc = (() => {
      const c = bcLibre.livraisonChoix;
      if (c === "atelier") return configEnt.adresse ? `Atelier — ${configEnt.adresse}` : "";
      if (c === "tache") return tL?.adresse || "";
      if (c.startsWith("ca:")) {
        const a = (clL?.adresses || []).find((x) => x.id === c.slice(3));
        return a ? `${clL.nom} — ${a.nom ? `${a.nom} · ` : ""}${libelleAdresse(a)}` : "";
      }
      if (c === "cfact") return clL?.adresseFacturation ? `${clL.nom} — ${clL.adresseFacturation}` : "";
      if (c === "projet") return prL ? `Projet ${prL.nom} — ${prL.adresseLivraison || prL.adresseTravaux || ""}` : "";
      if (c === "autre") return bcLibre.livraisonAutre.trim();
      return "";
    })();
    const descriptionFinale = descriptionAvecLivraison(
      `${(bcLibre.description || "").trim()}${bcLibre.pourInventaire ? "\n📦 Pour l'inventaire courant (stock du bureau)" : ""}${!ramassageBc && adresseLivraisonBc ? `\n📍 Livraison : ${adresseLivraisonBc}` : ""}`,
      dateBc || null,
      { asap: !!bcLibre.livraisonAsap, ramassage: ramassageBc }
    );
    const partTapee = Number(bcLibre.montantAttribue) || 0;
    const montantEffectif = (Number(bcLibre.montantHT) || 0) <= 0 && partTapee > 0 ? partTapee : bcLibre.montantHT;
    const numero = await onCreerBcLibre?.({
      ...bcLibre,
      livraisonEstimee: dateBc,
      montantHT: montantEffectif,
      description: descriptionFinale,
      // 🚚 Seulement pour un ramassage (snippet 153).
      ramassePar: ramassageBc ? bcLibre.ramassePar || null : null,
      depotA: ramassageBc ? bcLibre.depotA.trim() || "Atelier" : null,
    });
    setBcLibreEnCours(false);
    setBcLibreMsg("✓ " + numero + " créé" + (bcLibre.tacheId ? " et rattaché à la tâche." : bcLibre.clientId ? " et rattaché au client." : bcLibre.projetId ? " et attribué au projet." : " (achat général)."));
    const fiche = ficheFournisseurParNom(bcLibre.fournisseurNom);
    const courrielTape = bcLibre.courrielFournisseur.trim();
    const courrielTapeValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courrielTape);
    // 📧 LA FENÊTRE D'ENVOI S'OUVRE TOUJOURS (2026-09-15, vécu : un BC
    // créé puis jamais envoyé — l'encadré discret d'avant n'apparaissait
    // même pas sans courriel au répertoire). Avec ou sans adresse
    // connue : « L'envoyer maintenant ? » — Envoyer / Plus tard.
    if (fiche && (fiche.courriels || []).length > 0) {
      setOffreEnvoiBc({
        nouveau: true,
        numero,
        fournisseur: fiche.nom,
        description: descriptionFinale,
        photos: bcLibre.photos || [],
        fichiers: bcLibre.fichiers || [],
        courriels: fiche.courriels,
        coches: (fiche.courriels || []).filter((c) => c.defaut).map((c) => c.email),
      });
    } else if (!courrielTapeValide) {
      setOffreEnvoiBc({
        nouveau: true,
        numero,
        fournisseur: bcLibre.fournisseurNom.trim() || fiche?.nom || "le fournisseur",
        description: descriptionFinale,
        photos: bcLibre.photos || [],
        fichiers: bcLibre.fichiers || [],
        courriels: [],
        coches: [],
      });
    } else if (!fiche && courrielTapeValide) {
      const nomF = bcLibre.fournisseurNom.trim();
      if (bcLibre.enregistrerFournisseur && nomF) {
        const nouveauF = {
          id: `f-${Date.now()}`,
          nom: nomF,
          courriels: [{ id: `fc-${Date.now()}`, label: "Commande", email: courrielTape, defaut: true }],
        };
        setFournisseurs?.((prev) => [...(prev || []), nouveauF]);
        sauvegarderFournisseur(nouveauF)
          .then(() => ajouterJournal?.(`🏭 Fournisseur « ${nomF} » ajouté au répertoire (${courrielTape}).`))
          .catch(() => ajouterJournal?.(`⚠️ Fournisseur « ${nomF} » affiché mais NON enregistré au répertoire — réessaie.`));
      }
      setOffreEnvoiBc({
        nouveau: true,
        numero,
        fournisseur: nomF || "fournisseur",
        description: descriptionFinale,
        photos: bcLibre.photos || [],
        fichiers: bcLibre.fichiers || [],
        courriels: [{ id: "libre", label: "Commande", email: courrielTape, defaut: true }],
        coches: [courrielTape],
      });
    }
    setBcLibre({ fournisseurNom: "", description: "", montantHT: 0, projetId: "", tacheId: "", clientId: "", montantAttribue: "", livraisonEstimee: "", courrielFournisseur: "", enregistrerFournisseur: true, livraisonChoix: "atelier", livraisonAutre: "", livraisonAsap: false, ramassePar: "", depotA: "", pourInventaire: false, photos: [], fichiers: [] });
    setBcLibreOuvert(false);
  };
  // 📦➕ Réception d'un BC « stock » vers l'inventaire (étage 2) — le
  // compteur force la section Inventaire à se recharger après coup.
  const [receptionBc, setReceptionBc] = useState(null); // null | achat libre
  const [invVersion, setInvVersion] = useState(0);
  // ✏️ FICHE D'UN BC (2026-08-26) — la ligne cliquée s'ouvre en fenêtre :
  // fournisseur, description, montant et RATTACHEMENT modifiables,
  // suppression en deux clics. `bcOuvert` = l'achat ; `bcEdit` = la
  // copie de travail ; `bcSupprEtape` = confirmation armée ou non.
  const [bcOuvert, setBcOuvert] = useState(null);
  const [bcEdit, setBcEdit] = useState(null);
  const [bcSupprEtape, setBcSupprEtape] = useState(false);
  // 📄 Pagination (2026-08-26) — 10 pièces par page, 10 BC par page.
  // Avant : les 64 pièces s'empilaient, et les BC au-delà du 6e étaient
  // carrément INVISIBLES (coupés par un slice).
  const [pagePieces, setPagePieces] = useState(1);
  const [pageBc, setPageBc] = useState(1);
  const refListePieces = useRef(null);
  const refListeBc = useRef(null);
  const [bcEnregistrement, setBcEnregistrement] = useState(false);
  // 🧾 La dépense QuickBooks appariée à un BC (par « No de référence »
  // exact, ou retrouvée dans le mémo — cible.bc). Sert au badge d'écart
  // de prix et au bouton « Adopter le montant QuickBooks ».
  const depenseQbPourBc = (numeroBc) => {
    const n = String(numeroBc || "").trim().toUpperCase();
    if (!n) return null;
    return (
      (transactionsQb || []).find(
        (t) => t.type === "EXPENSE" && (String(t.cible?.bc || "").trim().toUpperCase() === n || String(t.poNumber || "").trim().toUpperCase() === n)
      ) || null
    );
  };
  const ecartQbPourBc = (a2) => {
    const dep = depenseQbPourBc(a2.numeroBc);
    if (!dep) return null;
    const reel = Number(dep.amountHT) || 0;
    const ecart = reel - (Number(a2.montantHT) || 0);
    return Math.abs(ecart) > 1 ? { reel, ecart } : null;
  };
  const ouvrirBc = (a2) => {
    setBcOuvert(a2);
    setBcEdit({
      fournisseurNom: a2.fournisseurNom || "",
      description: a2.description || "",
      montantHT: Number(a2.montantHT) || 0,
      cible: a2.tacheId ? `t:${a2.tacheId}` : a2.clientId ? `c:${a2.clientId}` : "",
      montantAttribue: a2.montantAttribue != null ? String(a2.montantAttribue) : "",
      // 📦 Livraison prévue — modifiable quand le fournisseur confirme.
      livraisonSouhaitee: a2.livraisonSouhaitee || "",
      // ⚡/🚚 Lus dans le texte du bon (2026-09-18).
      asap: !a2.livraisonSouhaitee && bcEstAsap(a2.description),
      ramassage: bcEstRamassage(a2.description),
      ramassePar: a2.ramassePar || "",
      depotA: a2.depotA || "",
    });
    setBcSupprEtape(false);
  };
  const [bcLibreEnCours, setBcLibreEnCours] = useState(false);
  const [bcLibreMsg, setBcLibreMsg] = useState("");
  // 📧 OFFRE D'ENVOI DU BC LIBRE (2026-08-30) : si le fournisseur tapé
  // correspond à une fiche du répertoire AVEC courriels, l'application
  // propose de lui envoyer le bon directement — coche les adresses,
  // clique, parti (même vrai service que les pièces).
  const [offreEnvoiBc, setOffreEnvoiBc] = useState(null); // { numero, fournisseur, description, coches }
  const [envoiBcLibreEnCours, setEnvoiBcLibreEnCours] = useState(false);
  // ⚠️ « Non envoyé » : BC libre créé DEPUIS la trace d'envoi (2026-09-15)
  // sans envoi par Fluxya ni marque manuelle. Les plus anciens : on ne
  // sait pas, on ne les accuse pas.
  const bcNonEnvoye = (a) => !a?.bcEnvoyeLe && String(a?.creeLe || "") >= "2026-09-15";
  const [envoiBcAjout, setEnvoiBcAjout] = useState(""); // ➕ adresse différente
  const ficheFournisseurParNom = (nom) =>
    (fournisseurs || []).find((f) => (f.nom || "").trim().toLowerCase() === String(nom || "").trim().toLowerCase()) || null;
  const envoyerBcLibre = async () => {
    if (!offreEnvoiBc || offreEnvoiBc.coches.length === 0) return;
    setEnvoiBcLibreEnCours(true);
    const r = await envoyerCourriel({
      a: offreEnvoiBc.coches,
      sujet: `${offreEnvoiBc.reclamation ? "Réclamation — items manquants, bon de commande" : "Bon de commande"} ${offreEnvoiBc.numero} — ${configEnt.nomLegal}`,
      html: gabaritBcSimple({ config: configEnt, numeroBc: offreEnvoiBc.numero, description: offreEnvoiBc.description, photos: offreEnvoiBc.photos || [], fichiers: offreEnvoiBc.fichiers || [] }),
      // 📎 Vraies pièces jointes (PDF, Excel…) — 2026-09-15.
      piecesJointes: offreEnvoiBc.fichiers || [],
      // La réponse du fournisseur revient à celui qui a commandé.
      copieExpediteur: true,
      // 📧 Copie permanente des BC (réglage d'entreprise, ex. commande@).
      copieA: configEnt.courrielCopieBc ? [configEnt.courrielCopieBc] : [],
    });
    setEnvoiBcLibreEnCours(false);
    if (r.envoye) {
      setBcLibreMsg(`✓ ${offreEnvoiBc.numero} envoyé à ${offreEnvoiBc.fournisseur} (${offreEnvoiBc.coches.join(", ")})`);
      const nbPj = (offreEnvoiBc.photos || []).length + (offreEnvoiBc.fichiers || []).length;
      ajouterJournal?.(`📧 BC libre ${offreEnvoiBc.numero} envoyé à ${offreEnvoiBc.fournisseur} (${offreEnvoiBc.coches.join(", ")})${nbPj ? ` — ${(offreEnvoiBc.photos || []).length} photo(s), ${(offreEnvoiBc.fichiers || []).length} fichier(s)` : ""}`);
      if (offreEnvoiBc.reclamation) {
        // ⚠️ Réclamation du reste (155) : trace « réclamé le » — pas la trace d'envoi du BC.
        const { type, objet } = offreEnvoiBc.reclamation;
        const champs = { reclameLe: new Date().toISOString() };
        if (type === "achat") onMajBcLibre?.(objet, champs, `⚠️ reste réclamé à ${offreEnvoiBc.fournisseur}`);
        else if (type === "projet") onMajBcProjet?.(offreEnvoiBc.reclamation.numero, champs, `⚠️ reste réclamé à ${offreEnvoiBc.fournisseur}`);
        else onPartielPiece?.(objet, champs, `reste réclamé à ${offreEnvoiBc.fournisseur}`);
      } else {
        // ✉️ Trace « envoyé le … à … » sur le BC (snippet 146).
        onMarquerBcEnvoye?.(offreEnvoiBc.numero, offreEnvoiBc.coches);
      }
      setOffreEnvoiBc(null);
    } else {
      setBcLibreMsg(
        r.simule
          ? "⚠️ Service d'envoi pas encore configuré (clé Resend absente) — le BC est créé, envoie-le à la main."
          : `⚠️ Envoi refusé (${r.erreur || "réessaie"}) — le BC est créé.`
      );
      setOffreEnvoiBc(null);
    }
  };
  const [filtre, setFiltre] = useState("ouvertes");
  const [annulationPour, setAnnulationPour] = useState(null);
  const [raisonAnnulation, setRaisonAnnulation] = useState("");
  // ENVOI DIRECT du BC par l'application (service Resend). Tant que la
  // clé n'est pas configurée, la route répond « simulé » et on affiche
  // quoi faire au lieu d'échouer. Le résultat s'écrit SUR la carte de
  // la pièce concernée, pas dans une alerte générique.
  const [envoiBcEnCours, setEnvoiBcEnCours] = useState(null);
  const [messageEnvoiBc, setMessageEnvoiBc] = useState(null); // { id, texte, ok }
  // 📷 Photos jointes au BC d'une PIÈCE — choisies sur la carte juste
  // avant l'envoi (état local, la photo sert au courriel).
  const [photosEnvoiBc, setPhotosEnvoiBc] = useState({});
  const [fichiersEnvoiBc, setFichiersEnvoiBc] = useState({}); // 📎 par pièce
  const envoyerBcParApplication = async (p) => {
    const adresses = courrielsFournisseur(p);
    if (adresses.length === 0) return;
    setEnvoiBcEnCours(p.id);
    const r = await envoyerCourriel({
      a: adresses,
      sujet: `Bon de commande ${p.numeroBc || ""} — ${configEnt.nomLegal}`,
      html: gabaritBonCommande({ config: configEnt, piece: p, photos: photosEnvoiBc[p.id] || [], fichiers: fichiersEnvoiBc[p.id] || [] }),
      piecesJointes: fichiersEnvoiBc[p.id] || [],
      // Celui qui commande reçoit la copie, et la réponse du fournisseur
      // (« impossible le 14, je peux le 18 ») lui revient directement.
      copieExpediteur: true,
      // 📧 Copie permanente des BC (réglage d'entreprise, ex. commande@).
      copieA: configEnt.courrielCopieBc ? [configEnt.courrielCopieBc] : [],
    });
    setEnvoiBcEnCours(null);
    if (r.envoye) {
      onMaj(p.id, { bc_envoye_le: new Date().toISOString() });
      setMessageEnvoiBc({ id: p.id, ok: true, texte: `Courriel envoyé à ${adresses.join(", ")}` });
    } else if (r.simule) {
      setMessageEnvoiBc({
        id: p.id,
        ok: false,
        texte: "Service d'envoi pas encore configuré (clé Resend absente) — utilise « ✉️ Courriel au fournisseur » en attendant.",
      });
    } else {
      setMessageEnvoiBc({ id: p.id, ok: false, texte: r.erreur || "Envoi refusé — réessaie." });
    }
  };
  // 💰 DEMANDE DE PAIEMENT AU CLIENT — montant taxé, descriptif, courriel.
  // La confirmation du paiement reste un geste humain (« Paiement reçu ✓ ») ;
  // en Phase 4, ce même bouton créera la vraie facture QuickBooks et le
  // paiement détecté déverrouillera tout seul.
  const [demandePour, setDemandePour] = useState(null);
  const [demandeMontant, setDemandeMontant] = useState("");
  const [demandeDescription, setDemandeDescription] = useState("");
  const [demandeEmails, setDemandeEmails] = useState([]);
  const [demandeExtra, setDemandeExtra] = useState("");
  const [demandeEnCours, setDemandeEnCours] = useState(false);
  const [messageDemande, setMessageDemande] = useState(null); // { id, ok, texte }
  // FRAIS DE DÉPLACEMENT — la visite de retour est un 2e appel de
  // service (règle validée) : elle peut exiger son dépôt comme les
  // autres. Cochable dans la même fenêtre : un seul courriel, un seul
  // virement — ou deux temps si on ne coche pas (pièce à la commande,
  // déplacement à la réception).
  const [demandeDeplacement, setDemandeDeplacement] = useState(false);
  const [demandeZone, setDemandeZone] = useState("Zone 1");
  const [demandeMontantDeplacement, setDemandeMontantDeplacement] = useState("");
  // La pièce est-elle encore à payer ? (sinon la fenêtre sert au
  // déplacement seul — 2e temps du circuit)
  const pieceEncoreAPayer = (p) => (p.paiementAvantCommande || p.paiementRequis) && !p.paiementRecu;
  const ficheClientPiece = (p) =>
    (clients || []).find((c) => c.id === p.clientId) ||
    (clients || []).find((c) => (c.nom || "").trim().toLowerCase() === (p.clientNom || "").trim().toLowerCase());
  const choisirZone = (zone) => {
    setDemandeZone(zone);
    const prix = Number(prixDepots?.[zone]) || 0;
    setDemandeMontantDeplacement(prix > 0 ? String(prix) : "");
  };
  const ouvrirDemande = (p, { deplacementSeul = false } = {}) => {
    const fiche = ficheClientPiece(p);
    const tous = (fiche?.courriels || []).map((c) => (typeof c === "string" ? c : c.email)).filter(Boolean);
    const defauts = (fiche?.courriels || []).filter((c) => c?.defaut).map((c) => c.email).filter(Boolean);
    setDemandePour(p);
    setDemandeMontant(!deplacementSeul && p.montantPiece != null ? String(p.montantPiece) : "");
    setDemandeEmails(defauts.length > 0 ? defauts : tous.slice(0, 1));
    setDemandeExtra("");
    setDemandeDeplacement(deplacementSeul);
    if (deplacementSeul) choisirZone(demandeZone);
    setDemandeDescription(
      deplacementSeul
        ? `Bonne nouvelle : la pièce pour votre ${p.modele ? `unité ${p.modele}` : "équipement"} (${p.pieceRequise}) est arrivée. Dès la réception des frais de déplacement ci-dessous, nous vous appelons pour fixer la visite d'installation.`
        : `Une pièce est requise pour la réparation de votre ${p.modele ? `unité ${p.modele}` : "équipement"} : ${p.pieceRequise}. ` +
            (p.paiementAvantCommande
              ? "Le paiement est requis avant que nous puissions passer la commande auprès du fournisseur."
              : "Le paiement est requis avant de planifier la visite d'installation.")
    );
  };
  const envoyerDemandePaiement = async () => {
    const p = demandePour;
    if (!p) return;
    const extra = demandeExtra.trim();
    const adresses = [...new Set([...demandeEmails, ...(extra ? [extra] : [])])];
    // Les lignes de la demande : pièce (si encore à payer), déplacement
    // (si coché). Le total taxé se calcule sur l'ensemble.
    const montantPiece = pieceEncoreAPayer(p) ? parseFloat(demandeMontant) || 0 : 0;
    const montantDepl = demandeDeplacement ? parseFloat(demandeMontantDeplacement) || 0 : 0;
    const lignes = [
      ...(montantPiece > 0 ? [{ etiquette: `Pièce — ${p.pieceRequise}`, montant: montantPiece }] : []),
      ...(montantDepl > 0 ? [{ etiquette: `Frais de déplacement — ${demandeZone}`, montant: montantDepl }] : []),
    ];
    const totalHT = montantPiece + montantDepl;
    if (adresses.length === 0 || totalHT <= 0) return;
    setDemandeEnCours(true);
    const t = calculerTaxes(totalHT, configEnt);
    // FACTURE QUICKBOOKS D'ABORD — même machine que le dépôt d'appel :
    // la demande s'appuie sur une vraie facture (numéro officiel +
    // bouton payer selon les réglages des appels). QuickBooks
    // indisponible ? Le courriel part quand même — le message le dit,
    // rien n'échoue en silence.
    let factureQb = null;
    const carteOk =
      configEnt.paiementCarteAppels === true &&
      (!(Number(configEnt.seuilCarteAppels) > 0) || totalHT <= Number(configEnt.seuilCarteAppels));
    const rQb = await creerFactureQbo({
      clientId: p.clientId || null,
      clientNom: p.clientNom || "",
      lignes: lignes.map((l) => ({ description: l.etiquette, montant: l.montant })),
      termePaiement: "Net 0",
      reference: `pièce — ${p.pieceRequise || ""}`,
      paiementCarte: carteOk,
      paiementVirement: configEnt.paiementVirementAppels === true,
      envoyerA: configEnt?.envoiAutoFactureQb === true ? adresses : [],
      customerMemo: demandeDescription,
    });
    if (rQb?.creee) factureQb = rQb;
    // PRODUCTION + envoi confirmé par QuickBooks : la facture officielle
    // (taxée, avec notre message) suffit. En Sandbox, les deux partent.
    const r =
      rQb?.environnement === "production" && rQb?.envoiQb?.envoyee
        ? { envoye: true, viaQb: true }
        : await envoyerCourriel({
      a: adresses,
      sujet: `Demande de paiement — ${montantPiece > 0 ? "pièce pour votre réparation" : "frais de déplacement"} (${configEnt.nomCommercial || configEnt.nomLegal})`,
      html: gabaritDemandePaiement({
        config: configEnt,
        clientNom: p.clientNom,
        description:
          demandeDescription +
          (factureQb?.docNumber ? ` Référence : facture Nº ${factureQb.docNumber}.` : ""),
        lignes,
        tps: t.tps,
        tvq: t.tvq,
        total: t.total,
        lienPaiement: factureQb?.lienPaiement || null,
      }),
    });
    setDemandeEnCours(false);
    if (!r.envoye && !r.simule) {
      setMessageDemande({ id: p.id, ok: false, texte: r.erreur || "Envoi refusé — réessaie." });
      return;
    }
    // Les verrous s'enregistrent même en mode simulé : le blocage est
    // l'intention, le courriel n'est que le messager (on peut appeler).
    if (montantPiece > 0) {
      onMaj(p.id, {
        ...(r.envoye ? { demande_paiement_le: new Date().toISOString() } : {}),
        montant_piece: montantPiece,
      });
    }
    if (montantDepl > 0 && p.tacheRetourId) {
      // Un VRAI dépôt sur la tâche de retour — même machine que les
      // appels de service : blocage 🔒, badge en facturation, déduction
      // automatique. 7 jours au lieu de 24 h : la pièce est déjà à nous,
      // on ne perd rien à laisser le client respirer.
      onCreerDepot?.(p.tacheRetourId, { montantHT: montantDepl, joursLimite: 7 });
    }
    setMessageDemande(
      r.envoye
        ? {
            id: p.id,
            ok: true,
            texte:
              `Demande de ${t.total.toFixed(2)} $ (taxes incl.) envoyée à ${adresses.join(", ")}` +
              (factureQb?.docNumber
                ? ` — facture QuickBooks Nº ${factureQb.docNumber}${factureQb.lienPaiement ? " + bouton Payer en ligne" : ""}`
                : rQb?.nonConnecte
                  ? " — ⚠️ SANS facture QuickBooks (non connecté)"
                  : rQb?.erreur
                    ? ` — ⚠️ facture QuickBooks NON créée : ${rQb.erreur}`
                    : ""),
          }
        : { id: p.id, ok: false, texte: "Service d'envoi pas encore configuré (clé Resend absente) — appelle le client, les montants et verrous sont notés." }
    );
    setDemandePour(null);
  };
  // Adresse courriel du fournisseur d'une pièce — depuis sa fiche.
  // Les fiches acceptent plusieurs adresses (achats, comptabilité…) ;
  // on accepte aussi bien des objets {email} que des chaînes brutes.
  const courrielsFournisseur = (p) => {
    const f = (fournisseurs || []).find((x) => (x.nom || "").trim().toLowerCase() === (p.fournisseurNom || "").trim().toLowerCase());
    return (f?.courriels || []).map((c) => (typeof c === "string" ? c : c.email || "")).filter(Boolean);
  };
  // Courriel du BC — tout pré-rempli, il ne reste qu'à cliquer Envoyer
  // dans son propre logiciel (Outlook, Gmail…). Le courriel part de la
  // vraie adresse de l'utilisateur : la réponse revient dans SA boîte.
  const lienCourrielBc = (p, adresse) => {
    const lignesUnites = (p.unites || [])
      .map((u) => `- ${u.emplacement ? `${u.emplacement} — ` : ""}Modèle : ${u.modele || "—"} · Nº série : ${u.serie || "—"}`)
      .join("\n");
    // Livraison demandée — même contenu que le courriel envoyé par
    // l'application (date locale, jamais toISOString).
    const dateLivraison = p.dateReceptionPrevue
      ? new Date(`${p.dateReceptionPrevue}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";
    const lignesLivraison =
      (dateLivraison
        ? p.livraisonFixe
          ? `\nLivraison : le ${dateLivraison} EXACTEMENT — notre entrepôt n'a pas de personnel en permanence, une personne sera sur place ce jour-là pour recevoir.\n`
          : `\nLivraison : au plus tard le ${dateLivraison} — avant si possible.\n`
        : `\nLivraison : merci de nous indiquer votre date possible.\n`) +
      (configEnt.adresse ? `À notre entrepôt — ${configEnt.adresse}.\n` : "") +
      `Si cette date est impossible, répondez à ce courriel en indiquant vos dates possibles.\n`;
    const corps =
      `Bonjour,\n\nVeuillez trouver notre bon de commande ${p.numeroBc || ""} :\n\n` +
      `Pièce : ${p.pieceRequise}\n` +
      (p.modele || p.numeroSerie ? `Équipement : ${p.modele || "—"} · Nº série : ${p.numeroSerie || "—"}\n` : "") +
      (lignesUnites ? `${lignesUnites}\n` : "") +
      (p.note ? `Note : ${p.note}\n` : "") +
      lignesLivraison +
      `\nMerci de confirmer la réception de cette commande et la date de livraison.\n\n` +
      `${configEnt.nomLegal}\n${configEnt.telephone || ""}`;
    return `mailto:${encodeURIComponent(adresse)}?subject=${encodeURIComponent(`Bon de commande ${p.numeroBc || ""} — ${configEnt.nomLegal}`)}&body=${encodeURIComponent(corps)}`;
  };
  // FORMULAIRE « pièce commandée » : fournisseur + nº de BC + date de
  // réception PRÉVUE. La date est facultative — bien des fournisseurs
  // ne s'engagent sur rien, et forcer une date inventée serait pire
  // que pas de date du tout : on planifierait dessus.
  const [editionBc, setEditionBc] = useState(null);
  const [formBc, setFormBc] = useState({ fournisseurNom: "", numeroBc: "", datePrevue: "", livraisonFixe: false, ramassage: false, ramassePar: "", depotA: "" });

  const ouvertes = (pieces || []).filter((p) => p.statut !== "recue" && p.statut !== "annulee");
  const affichees =
    filtre === "ouvertes" ? ouvertes : filtre === "toutes" ? pieces || [] : (pieces || []).filter((p) => p.statut === filtre);

  // ============================================================
  // 🗂️ PAGE À ONGLETS (2026-09-22, demande du propriétaire : « la page
  // Pièces en commande est lourde »). Une chose à la fois : À recevoir ·
  // Bons de commande · Matériel camion · Inventaire · Fournisseurs. Le
  // « ➕ Nouveau BC » vit dans l'entête et ouvre une fenêtre. Les
  // fenêtres (fiche BC, envoi, réception…) restent hors des onglets.
  // ============================================================
  const [onglet, setOnglet] = useState("recevoir");
  const livraisonsAttendues = (() => {
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ajd = iso(aujourdhui);
    const demain = iso(new Date(aujourdhui.getTime() + 86400000));
    const dans7 = iso(new Date(aujourdhui.getTime() + 7 * 86400000));
    const lignes = [
        ...(achatsLibres || [])
          .filter((a) => !a.recuLe)
          .map((a) => ({
            cle: `a-${a.id}`, numero: a.numeroBc || "(sans nº)", fournisseur: a.fournisseurNom || "", date: a.livraisonSouhaitee || null,
            cible: a.tacheId ? `🔗 ${a.clientNom || a.tacheTitre || "job"}` : a.clientId ? `👤 ${a.clientNom || "client"}` : (a.description || "").includes("Pour l'inventaire courant") ? "📦 stock" : "achat général",
            description: (a.description || "").split("\n")[0],
            // ⚡/🚚 Lus dans le texte du bon (2026-09-18).
            asap: bcEstAsap(a.description), ramassage: bcEstRamassage(a.description), ramassePar: a.ramassePar || null,
            envoye: !!a.bcEnvoyeLe, nonEnvoye: bcNonEnvoye(a), telephone: (a.bcEnvoyeA || []).includes("manuel"),
            ouvrir: () => ouvrirBc(a),
            recevoir: peutCommander ? () => onMajBcLibre?.(a, { recuLe: new Date().toISOString() }, "📦 reçu") : null,
            // ⚠️ Partiel (155) : ce qui manque, date promise du reste, réclamation.
            manquant: a.manquant || "", restePromisLe: a.restePromisLe || null, reclameLe: a.reclameLe || null, partielLe: a.partielLe || null,
            partiel: peutCommander ? (champs, resume) => onMajBcLibre?.(a, champs, resume) : null,
            reclamer: peutCommander ? (texte) => setOffreEnvoiBc({ reclamation: { type: "achat", objet: a }, numero: a.numeroBc || "(sans nº)", fournisseur: a.fournisseurNom || "le fournisseur", description: texte, photos: [], fichiers: [], courriels: ficheFournisseurParNom(a.fournisseurNom)?.courriels || [], coches: (ficheFournisseurParNom(a.fournisseurNom)?.courriels || []).filter((c) => c.defaut).map((c) => c.email) }) : null,
          })),
        ...(pieces || [])
          .filter((p) => p.statut === "commandee")
          .map((p) => ({
            cle: `p-${p.id}`, numero: p.numeroBc || "(sans nº)", fournisseur: p.fournisseurNom || "", date: p.dateReceptionPrevue || null,
            cible: `🔧 ${p.clientNom || "pièce"}`, description: p.pieceRequise || "", ramassage: !!p.ramassage, ramassePar: p.ramassePar || null, envoye: !!p.bcEnvoyeLe, nonEnvoye: false,
            ouvrir: null, recevoir: peutCommander && onRecue ? () => onRecue(p.id, nomUtilisateur) : null,
            manquant: p.manquant || "", restePromisLe: p.restePromisLe || null, reclameLe: p.reclameLe || null, partielLe: p.partielLe || null,
            partiel: peutCommander && onPartielPiece ? (champs, resume) => onPartielPiece(p, champs, resume) : null,
            reclamer: peutCommander ? (texte) => setOffreEnvoiBc({ reclamation: { type: "piece", objet: p }, numero: p.numeroBc || "(sans nº)", fournisseur: p.fournisseurNom || "le fournisseur", description: texte, photos: [], fichiers: [], courriels: ficheFournisseurParNom(p.fournisseurNom)?.courriels || [], coches: (ficheFournisseurParNom(p.fournisseurNom)?.courriels || []).filter((c) => c.defaut).map((c) => c.email) }) : null,
          })),
        ...(projets || []).flatMap((pr) =>
          (pr.bonsCommande || [])
            .filter((bc) => bc.statut !== "Reçu" && bc.statut !== "Annulé")
            .map((bc) => ({
              cle: `bc-${pr.id}-${bc.id}`, numero: bc.numeroBC || "(sans nº)", fournisseur: bc.fournisseur || "", date: bc.livraison || null,
              cible: `🏗️ ${pr.nom}`, description: (bc.description || "").split("\n")[0], asap: bcEstAsap(bc.description), ramassage: bcEstRamassage(bc.description), ramassePar: bc.ramassePar || null, envoye: !!bc.envoyeLe, nonEnvoye: false, ouvrir: null,
              // 🏗️ Reçu / partiel / réclamation aussi pour les BC de projets (2026-09-22) — le bon vit dans le JSON du projet.
              recevoir: peutCommander && onMajBcProjet ? () => onMajBcProjet(bc.numeroBC, { statut: "Reçu", recuLe: new Date().toISOString() }, "📦 reçu") : null,
              manquant: bc.manquant || "", restePromisLe: bc.restePromisLe || null, reclameLe: bc.reclameLe || null, partielLe: bc.partielLe || null,
              partiel: peutCommander && onMajBcProjet && bc.numeroBC ? (champs, resume) => onMajBcProjet(bc.numeroBC, champs, resume) : null,
              reclamer: peutCommander && bc.numeroBC ? (texte) => setOffreEnvoiBc({ reclamation: { type: "projet", numero: bc.numeroBC }, numero: bc.numeroBC, fournisseur: bc.fournisseur || "le fournisseur", description: texte, photos: [], fichiers: [], courriels: ficheFournisseurParNom(bc.fournisseur)?.courriels || [], coches: (ficheFournisseurParNom(bc.fournisseur)?.courriels || []).filter((c) => c.defaut).map((c) => c.email) }) : null,
            }))
        ),
      ].map((l) => (l.partielLe && l.restePromisLe ? { ...l, date: l.restePromisLe } : l)).sort((x, y) => (x.date || "9999").localeCompare(y.date || "9999"));
    // 📅 GROUPÉES PAR JOUR (2026-09-22) : en retard · aujourd'hui · demain ·
    // chaque jour · ⚡ dès que possible · sans date.
    const groupes = [];
    const dans = (cle, titre, ton) => { let g = groupes.find((x) => x.cle === cle); if (!g) { g = { cle, titre, ton, lignes: [] }; groupes.push(g); } return g; };
    lignes.forEach((l) => {
      if (l.date && l.date < ajd) dans("retard", "⚠️ En retard", "retard").lignes.push(l);
      else if (l.date === ajd) dans(ajd, "Aujourd'hui", "proche").lignes.push(l);
      else if (l.date === demain) dans(demain, "Demain", "proche").lignes.push(l);
      else if (l.date) dans(l.date, new Date(`${l.date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }), l.date <= dans7 ? "proche" : "normal").lignes.push(l);
      else if (l.asap) dans("asap", "⚡ Dès que possible", "asap").lignes.push(l);
      else dans("sans", "Sans date de livraison", "sans").lignes.push(l);
    });
    return { lignes, groupes, enRetard: lignes.filter((l) => l.date && l.date < ajd).length, cetteSemaine: lignes.filter((l) => l.date && l.date >= ajd && l.date <= dans7).length };
  })();
  const ONGLETS = [
    { cle: "recevoir", label: "📦 À recevoir", nb: livraisonsAttendues.lignes.length, alerte: livraisonsAttendues.enRetard > 0 },
    { cle: "bons", label: "🧾 Bons de commande", nb: ouvertes.length },
    { cle: "camion", label: "🧰 Matériel camion", nb: camionEnAttente.length, alerte: camionEnAttente.length > 0 },
    { cle: "inventaire", label: "📦 Inventaire", nb: null },
    { cle: "fournisseurs", label: "🏭 Fournisseurs", nb: (fournisseurs || []).length },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Pièces en commande</h2>
          <p className="text-xs text-slate-400">
            {ouvertes.length} pièce{ouvertes.length > 1 ? "s" : ""} en attente · la tâche de retour se débloque à la réception
          </p>
        </div>
        {peutCommander ? (
          <Button onClick={() => { setBcLibreOuvert(true); setBcLibreMsg(""); }} className="min-h-0 px-3 py-2 text-xs">
            ➕ Nouveau BC
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
            <Lock size={12} /> Consultation seulement — pour tes suivis clients
          </span>
        )}
      </div>

      {/* 🗂️ ONGLETS — un seul bloc visible à la fois. */}
      <div className="flex flex-wrap gap-1.5">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setOnglet(o.cle)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${onglet === o.cle ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {o.label}
            {o.nb != null && o.nb > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${onglet === o.cle ? "bg-white/20 text-white" : o.alerte ? "bg-red-100 text-red-700" : "bg-white text-slate-600"}`}>{o.nb}</span>
            )}
          </button>
        ))}
      </div>

      {/* 📦 À RECEVOIR (2026-09-15, puis groupé par jour 2026-09-22) — une
          ligne par bon (libre, pièce, projet) pas encore reçu. */}
      {onglet === "recevoir" && (() => {
        const { lignes, groupes, enRetard, cetteSemaine } = livraisonsAttendues;
        if (lignes.length === 0) return <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Rien à recevoir — tous les bons sont rentrés. 🎉</p>;
        const tons = { retard: "bg-red-100 text-red-700", proche: "bg-amber-100 text-amber-800", normal: "bg-slate-100 text-slate-600", asap: "bg-orange-100 text-orange-800", sans: "bg-slate-50 text-slate-400" };
        return (
          <div className={`rounded-2xl border bg-white p-3 ${enRetard > 0 ? "border-red-200" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                📦 À recevoir ({lignes.length})
                {enRetard > 0 && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold normal-case text-red-700">{enRetard} en retard</span>}
                {cetteSemaine > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold normal-case text-amber-700">{cetteSemaine} cette semaine</span>}
              </p>
              <p className="text-[10px] text-slate-400">« 📦 Reçu » retire la ligne · clic sur un bon libre = sa fiche.</p>
            </div>
            <div className="mt-2 space-y-3">
              {groupes.map((g) => (
                <div key={g.cle}>
                  <p className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold capitalize ${tons[g.ton]}`}>{g.titre} <span className="font-semibold opacity-70">· {g.lignes.length}</span></p>
                  <div className="mt-1 divide-y divide-slate-100">
                    {g.lignes.map((l) => (
                      <div key={l.cle} className="flex items-center gap-2 py-1.5 text-[11px]">
                        {l.ramassage ? <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${l.ramassePar ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`} title={l.ramassePar ? "À ramasser chez le fournisseur — ne sera pas livré" : "Personne n'est encore désigné — glisse la carte dans l'agenda"}>{l.ramassePar ? "🚚 à ramasser" : "🚚 à attribuer"}</span> : null}
                        <button type="button" onClick={l.ouvrir || undefined} className={`min-w-0 flex-1 truncate text-left ${l.ouvrir ? "hover:underline" : "cursor-default"}`} title={l.description}>
                          <span className="font-bold text-slate-800">{l.numero}</span>
                          {l.fournisseur ? <span className="text-slate-600"> — {l.fournisseur}</span> : null}
                          <span className="ml-1.5 text-slate-500">{l.cible}</span>
                          {l.description ? <span className="ml-1.5 text-slate-400">· {l.description}</span> : null}
                        </button>
                        {l.nonEnvoye ? (
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">⚠️ non envoyé</span>
                        ) : l.telephone ? (
                          <span className="shrink-0 text-[9px] font-bold text-sky-700" title="Commande passée par téléphone — aucun courriel envoyé par Fluxya">📞 par téléphone</span>
                        ) : l.envoye ? (
                          <span className="shrink-0 text-[9px] font-bold text-emerald-600">✉️ envoyé</span>
                        ) : null}
                        {l.partielLe && (
                          <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-800" title={`Reçu partiellement le ${new Date(l.partielLe).toLocaleDateString("fr-CA")}${l.reclameLe ? ` · réclamé le ${new Date(l.reclameLe).toLocaleDateString("fr-CA")}` : ""}`}>
                            ⚠️ partiel{l.manquant ? ` — manque : ${l.manquant}` : ""}{l.reclameLe ? " · réclamé" : ""}
                          </span>
                        )}
                        {l.partiel && (
                          <button type="button" onClick={() => setPartielPour({ ligne: l, manquant: l.manquant || "", date: l.restePromisLe || "", erreur: "", enCours: false })} title="Il manque des items — noter ce qui manque, la date promise, réclamer au fournisseur" className="shrink-0 rounded-lg border border-orange-200 px-1.5 py-1 text-[10px] font-bold text-orange-700 hover:border-orange-400">
                            {l.partielLe ? "✏️ Partiel" : "⚠️ Partiel…"}
                          </button>
                        )}
                        {l.recevoir && (
                          <button type="button" onClick={l.recevoir} title="Commande reçue" className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700 hover:border-emerald-400 active:scale-95">
                            📦 Reçu
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 🧰 COMMANDES DE MATÉRIEL CAMION — le technicien demande, la
          personne des achats commande et clique « Commande passée »
          (+ note facultative, visible sur son téléphone). Boucle courte
          voulue : pas d'étape « reçue ». */}
      {onglet === "camion" && (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          🧰 Matériel camion (techniciens)
          {camionEnAttente.length > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{camionEnAttente.length} à commander</span>
          )}
        </p>
        {camionEnAttente.length > 0 && peutCommander && articlesGroupes.length > 0 && (
          <div className="mt-2 rounded-xl border border-slate-300 bg-slate-50 p-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              🛒 Commande groupée — {articlesGroupes.length} article{articlesGroupes.length > 1 ? "s" : ""}, {camionEnAttente.length} demande{camionEnAttente.length > 1 ? "s" : ""}
            </p>
            <div className="mt-1.5 space-y-1">
              {articlesGroupes.map((a) => (
                <div key={a.cle} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-slate-800">{a.article}</span>
                    <span className="ml-1 font-extrabold tabular-nums text-slate-900">× {a.total}</span>
                    <span className="block text-[10px] text-slate-400">{a.demandeurs.join(" · ")}</span>
                  </span>
                  <select
                    value={assignFournisseurs[a.cle] || ""}
                    onChange={(e) => setAssignFournisseurs((prev) => ({ ...prev, [a.cle]: e.target.value }))}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${assignFournisseurs[a.cle] ? "border-slate-300" : "border-amber-400 bg-amber-50"}`}
                  >
                    <option value="">— Fournisseur ? —</option>
                    {(fournisseurs || []).map((f) => (
                      <option key={f.id || f.nom} value={f.nom}>{f.nom}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {fournisseursDeLaCommande.length > 0 && (
              <p className="mt-1.5 text-[10px] font-bold text-slate-600">
                📦 {fournisseursDeLaCommande.join(" · ")} — un P/O officiel par fournisseur à l'envoi.
              </p>
            )}
            {articlesSansFournisseur.length > 0 && (
              <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                ⚠️ {articlesSansFournisseur.length} article{articlesSansFournisseur.length > 1 ? "s" : ""} sans fournisseur — assigne-{articlesSansFournisseur.length > 1 ? "les" : "le"} pour pouvoir envoyer.
              </p>
            )}
            <input
              value={noteGroupee}
              onChange={(e) => setNoteGroupee(e.target.value)}
              placeholder="Note pour les techniciens (facultatif) — ex : arrive jeudi"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px]"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Button
                onClick={envoyerCommandesGroupees}
                disabled={envoiGroupeEnCours || articlesSansFournisseur.length > 0}
                className="min-h-0 flex-1 px-3 py-1.5 text-[11px]"
              >
                {envoiGroupeEnCours ? "Envoi…" : `📧 Envoyer les commandes${fournisseursDeLaCommande.length > 1 ? ` (${fournisseursDeLaCommande.length} fournisseurs)` : ""}`}
              </Button>
              <Button variant="outline" onClick={copierListeGroupee} className="min-h-0 px-2.5 py-1.5 text-[11px]">
                📋 Copier la liste
              </Button>
            </div>
            {messageGroupe && (
              <p className={`mt-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${messageGroupe.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                {messageGroupe.texte}
              </p>
            )}
          </div>
        )}
        {(commandesCamion || []).length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">Aucune demande — les techniciens commandent depuis leur téléphone (🧰 Matériel de camion).</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {(commandesCamion || []).slice(0, 12).map((c) => (
              <div key={c.id} className={"rounded-xl p-2.5 text-xs " + (c.statut === "envoyee" ? "bg-amber-50" : "bg-slate-50")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">
                    {c.technicienNom}
                    <span className="ml-1 font-normal text-slate-400">{c.creeLe ? new Date(c.creeLe).toLocaleDateString("fr-CA") : ""}</span>
                  </span>
                  {c.statut === "commandee" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">✓ Commande passée</span>
                  ) : peutCommander ? (
                    notePassee?.id === c.id ? null : (
                      <Button onClick={() => setNotePassee({ id: c.id, note: "" })} className="min-h-0 px-2.5 py-1 text-[11px]">
                        ✓ Commande passée…
                      </Button>
                    )
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">⏳ À commander</span>
                  )}
                </div>
                <p className="mt-1 text-slate-600">{(c.lignes || []).map((l) => l.article + " ×" + l.quantite).join(" · ")}</p>
                {c.noteTechnicien && <p className="mt-0.5 text-[11px] italic text-slate-500">📝 {c.noteTechnicien}</p>}
                {c.statut === "commandee" && c.noteBureau && (
                  <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">💬 {c.noteBureau}</p>
                )}
                {notePassee?.id === c.id && (
                  <div className="mt-1.5 flex gap-1.5">
                    <textarea
                      rows={2}
                      value={notePassee.note}
                      onChange={(e) => setNotePassee({ id: c.id, note: e.target.value })}
                      placeholder="Note pour le technicien (optionnel) — ex : arrive jeudi"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <Button onClick={() => { onCommandePassee?.(c.id, notePassee.note.trim()); setNotePassee(null); }} className="min-h-0 px-3 py-1.5 text-xs">
                      Confirmer
                    </Button>
                    <Button variant="outline" onClick={() => setNotePassee(null)} className="min-h-0 px-2 py-1.5 text-xs">✕</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* 🏭 RÉPERTOIRE DES FOURNISSEURS (2026-08-30, demande du
          propriétaire) — LE endroit pour gérer les fournisseurs et leurs
          courriels : le même répertoire sert aux BC de projet, aux BC
          libres, aux pièces et aux commandes de camion. */}
      {onglet === "fournisseurs" && (
      <SectionFournisseurs
        fournisseurs={fournisseurs}
        setFournisseurs={setFournisseurs}
        ajouterJournal={ajouterJournal}
        peutModifier={peutCommander}
        toujoursOuvert
      />
      )}

      {/* 📦 INVENTAIRE COURANT (2026-09-04, demande du propriétaire) —
          la liste vivante de l'atelier, à côté des bons de commande. */}
      {onglet === "inventaire" && <SectionInventaire key={invVersion} ajouterJournal={ajouterJournal} peutModifier={peutCommander} nomUtilisateur={nomUtilisateur} toujoursOuvert />}
      {receptionBc && (
        <ModalReceptionInventaire
          bc={receptionBc}
          onFermer={() => setReceptionBc(null)}
          onFait={() => setInvVersion((v) => v + 1)}
          ajouterJournal={ajouterJournal}
          nomUtilisateur={nomUtilisateur}
        />
      )}

      {/* 📍 RAPPEL D'ADRESSE DE LIVRAISON (2026-09-09, demande du
          propriétaire) — le BC est resté sur « atelier » sans choix
          explicite et ce n'est pas du stock d'inventaire : on confirme
          avant d'envoyer, plutôt que de livrer au bureau par défaut une
          pièce destinée à un chantier. */}
      {/* ⚠️ RÉCEPTION PARTIELLE (snippet 155, 2026-09-22) — « il manque des
          items » : le bon RESTE à recevoir avec ce qui manque, la date
          promise du reste et, au choix, une réclamation au fournisseur. */}
      {partielPour && (() => {
        const l = partielPour.ligne;
        const enregistrer = async (puisReclamer) => {
          if (!partielPour.manquant.trim()) { setPartielPour((p) => ({ ...p, erreur: "Écris ce qui manque." })); return; }
          setPartielPour((p) => ({ ...p, enCours: true, erreur: "" }));
          const champs = { manquant: partielPour.manquant.trim(), restePromisLe: partielPour.date || null, partielLe: l.partielLe || new Date().toISOString() };
          const ok = await l.partiel(champs, `⚠️ reçu partiellement — manque : ${champs.manquant}${champs.restePromisLe ? ` (reste promis le ${champs.restePromisLe})` : ""}`);
          if (ok === false) { setPartielPour((p) => ({ ...p, enCours: false, erreur: "Non enregistré — le snippet SQL 155 est-il passé ?" })); return; }
          setPartielPour(null);
          if (puisReclamer && l.reclamer) {
            const quand = l.partielLe || new Date().toISOString();
            l.reclamer(
              `Bonjour,\n\nNous avons reçu partiellement le bon de commande ${l.numero} le ${new Date(quand).toLocaleDateString("fr-CA")}.\n\nIl manque : ${champs.manquant}\n\n${champs.restePromisLe ? `Date convenue pour le reste : ${champs.restePromisLe}.\n\n` : ""}Merci de confirmer la date de livraison des items manquants.`
            );
          }
        };
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setPartielPour(null); }}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">⚠️ Reçu partiellement — {l.numero}</h3>
                  <p className="text-xs text-slate-500">{l.fournisseur}{l.description ? ` · ${l.description}` : ""}</p>
                </div>
                <button onClick={() => setPartielPour(null)} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
              </div>
              <label className="mt-3 mb-1 block text-[11px] font-bold text-slate-500">Qu&apos;est-ce qui manque ?</label>
              <textarea
                autoFocus
                rows={3}
                value={partielPour.manquant}
                onChange={(e) => setPartielPour((p) => ({ ...p, manquant: e.target.value, erreur: "" }))}
                placeholder="Ex. : 2 grilles 12×12, le moteur du ventilateur…"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
              <label className="mt-2 mb-1 block text-[11px] font-bold text-slate-500">Reste promis pour le <span className="font-normal text-slate-400">(facultatif)</span></label>
              <input type="date" value={partielPour.date} onChange={(e) => setPartielPour((p) => ({ ...p, date: e.target.value }))} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
              <p className="mt-2 text-[11px] leading-snug text-slate-500">Le bon reste dans « À recevoir » avec l&apos;étiquette ⚠️ partiel, classé au jour promis. Quand tout est arrivé : « 📦 Reçu ».</p>
              {partielPour.erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">⚠️ {partielPour.erreur}</p>}
              <div className="mt-4 grid grid-cols-1 gap-2">
                {l.reclamer && (
                  <Button loading={partielPour.enCours} onClick={() => enregistrer(true)} className="min-h-0 py-2 text-xs">✉️ Enregistrer et réclamer le reste au fournisseur</Button>
                )}
                <Button variant={l.reclamer ? "outline" : undefined} loading={partielPour.enCours} onClick={() => enregistrer(false)} className="min-h-0 py-2 text-xs">Enregistrer seulement</Button>
              </div>
            </div>
          </div>
        );
      })()}
      {rappelAdresseBc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setRappelAdresseBc(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            {/* Texte réécrit 2026-09-22 (« porte à confusion ») : une vraie
                question, deux réponses claires — pas de « quand même ». */}
            <h3 className="text-sm font-extrabold text-slate-900">📍 Où livrer ce bon ?</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Tu n&apos;as pas choisi d&apos;adresse de livraison. Le fournisseur livrera donc <span className="font-bold">à l&apos;atelier</span>
              {configEnt.adresse ? ` (${configEnt.adresse})` : ""}.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Button onClick={executerCreationBc} className="min-h-0 py-2 text-xs">🏭 À l&apos;atelier, c&apos;est bon — envoyer le bon</Button>
              <Button variant="outline" onClick={() => setRappelAdresseBc(false)} className="min-h-0 py-2 text-xs">🏗️ Non, c&apos;est pour un chantier — choisir l&apos;adresse</Button>
            </div>
          </div>
        </div>
      )}

      {/* ➕ BON DE COMMANDE LIBRE — « 4 rouleaux de tape » : pas de tâche,
          pas de pièce client. Attribué à un PROJET = entre dans ses coûts
          matériaux (mécanisme existant) ; sinon achat général. */}
      {peutCommander && (
        <>
          {/* 📧 Envoi du BC libre au fournisseur — offert quand la fiche
              du répertoire a des courriels ; coche, envoie, terminé. */}
          {/* 📧 FENÊTRE D'ENVOI (2026-09-15) — au premier plan, impossible
              à manquer : à la création (« L'envoyer maintenant ? ») comme
              au renvoi. « Plus tard » reste un vrai choix ; le BC porte
              alors « Non envoyé » dans la liste jusqu'à l'envoi. */}
          {offreEnvoiBc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setOffreEnvoiBc(null); }}>
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-blue-200 bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {offreEnvoiBc.reclamation ? `⚠️ Réclamation — ${offreEnvoiBc.numero}` : offreEnvoiBc.nouveau ? `✅ ${offreEnvoiBc.numero} créé` : `📧 ${offreEnvoiBc.numero}`}
                  </p>
                  <p className="text-xs font-bold text-blue-800">
                    {offreEnvoiBc.reclamation ? "Réclamer le reste" : offreEnvoiBc.nouveau ? "L'envoyer maintenant" : "Envoyer"} à {offreEnvoiBc.fournisseur} ?
                  </p>
                </div>
                <button onClick={() => setOffreEnvoiBc(null)} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
              </div>
              <div className="mt-1.5 space-y-1">
                {(offreEnvoiBc.courriels || []).map((c) => (
                  <label key={c.id || c.email} className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={offreEnvoiBc.coches.includes(c.email)}
                      onChange={() =>
                        setOffreEnvoiBc((p) => ({
                          ...p,
                          coches: p.coches.includes(c.email) ? p.coches.filter((e) => e !== c.email) : [...p.coches, c.email],
                        }))
                      }
                    />
                    <span className="font-semibold">{c.email}</span>
                    {c.label && <span className="text-[10px] text-slate-400">({c.label})</span>}
                  </label>
                ))}
                {(offreEnvoiBc.courriels || []).length === 0 && (
                  <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">Ce fournisseur n&apos;a aucun courriel au répertoire — tape son adresse ci-dessous et clique ➕ Ajouter.</p>
                )}
              </div>
              {/* ➕ ADRESSE DIFFÉRENTE (2026-09-04) : envoyer à quelqu'un
                  d'autre que les adresses du répertoire — l'adresse
                  s'ajoute à la liste, cochée, pour CET envoi. */}
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={envoiBcAjout}
                  onChange={(e) => setEnvoiBcAjout(e.target.value)}
                  placeholder="Autre adresse — ex. jean@descair.ca"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                />
                <Button
                  variant="outline"
                  disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(envoiBcAjout.trim())}
                  onClick={() => {
                    const email = envoiBcAjout.trim();
                    setOffreEnvoiBc((p) => ({
                      ...p,
                      courriels: p.courriels.some((c) => c.email.toLowerCase() === email.toLowerCase())
                        ? p.courriels
                        : [...p.courriels, { id: `ajout-${Date.now()}`, label: "ajoutée", email }],
                      coches: p.coches.includes(email) ? p.coches : [...p.coches, email],
                    }));
                    setEnvoiBcAjout("");
                  }}
                  className="min-h-0 shrink-0 py-1 text-[11px]"
                >
                  ➕ Ajouter
                </Button>
              </div>
              {/* 👁️ APERÇU MODIFIABLE AVANT L'ENVOI (2026-09-04, demande
                  du propriétaire : « voir la version du bon avant de
                  l'envoyer, appliquer des correctifs ») — l'objet est
                  affiché tel quel, le texte s'édite ICI et c'est cette
                  version corrigée qui part. */}
              <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2">
                <p className="text-[10px] font-bold text-slate-500">
                  Objet : {offreEnvoiBc.reclamation ? "Réclamation — items manquants, bon de commande" : "Bon de commande"} {offreEnvoiBc.numero} — {configEnt.nomLegal}
                </p>
                <textarea
                  rows={5}
                  value={offreEnvoiBc.description}
                  onChange={(e) => setOffreEnvoiBc((p) => ({ ...p, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                />
                <p className="text-[9px] text-slate-400">
                  L&apos;entête et la signature de {configEnt.nomCommercial || configEnt.nomLegal} s&apos;ajoutent automatiquement autour de ce texte.
                </p>
              </div>
              {/* 📷 PHOTOS DANS LE PANNEAU D'ENVOI (2026-09-06) — le
                  RENVOI d'un bon déjà créé partait toujours sans photos
                  (elles ne vivent pas sur la fiche de l'achat) : le choix
                  se fait ICI, pour tout envoi — création comme renvoi. */}
              <div className="mt-2">
                <ChampPhotosBc
                  photos={offreEnvoiBc.photos || []}
                  onChange={(liste) => setOffreEnvoiBc((p) => ({ ...p, photos: liste }))}
                  libelle="📷 Photos jointes à cet envoi (facultatif)"
                />
                <div className="mt-2">
                  <ChampFichiersBc
                    fichiers={offreEnvoiBc.fichiers || []}
                    onChange={(liste) => setOffreEnvoiBc((p) => ({ ...p, fichiers: liste }))}
                    libelle="📎 Fichiers joints à cet envoi (facultatif — PDF, Word, Excel…)"
                  />
                </div>
              </div>
              {offreEnvoiBc.coches.length === 0 && (
                <p className="mt-2 text-[10px] font-bold text-amber-700">Pour envoyer, il manque : au moins une adresse cochée.</p>
              )}
              <div className="mt-2 flex gap-1.5">
                <Button
                  loading={envoiBcLibreEnCours}
                  disabled={offreEnvoiBc.coches.length === 0}
                  onClick={envoyerBcLibre}
                  className="min-h-0 flex-1 py-2 text-xs"
                >
                  📧 Envoyer maintenant
                </Button>
                <Button variant="outline" onClick={() => setOffreEnvoiBc(null)} className="min-h-0 py-2 text-xs">
                  Plus tard
                </Button>
              </div>
              {/* 📞 Commande passée par téléphone (2026-09-17) — un clic
                  marque le bon « par téléphone » (aucun courriel), utile
                  quand le fournisseur n'a pas de courriel ou qu'on appelle. */}
              <button
                type="button"
                onClick={() => { onMarquerBcEnvoye?.(offreEnvoiBc.numero, ["manuel"]); setOffreEnvoiBc(null); }}
                className="mt-1.5 w-full rounded-lg border border-sky-300 bg-sky-50 py-2 text-xs font-bold text-sky-700 active:scale-[0.99]"
              >
                📞 Commande passée par téléphone (aucun courriel)
              </button>
              {offreEnvoiBc.nouveau && (
                <p className="mt-1.5 text-[10px] text-slate-400">« Plus tard » : le bon restera marqué <span className="font-bold text-red-600">Non envoyé</span> dans la liste, avec un bouton pour l&apos;envoyer.</p>
              )}
            </div>
            </div>
          )}
          {bcLibreOuvert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">➕ Nouveau bon de commande</h3>
                  <button type="button" onClick={() => setBcLibreOuvert(false)} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
                </div>
            <div className="space-y-1.5">
              {/* 🏭 VRAIE LISTE DÉROULANTE (2026-08-28) : c'était un champ
                  « datalist » — le navigateur n'affichait la liste qu'en
                  tapant, jamais au clic, et on croyait le répertoire vide
                  alors que le fournisseur était juste au-dessus. Un
                  <select> montre TOUJOURS ce qu'il contient. « Autre »
                  garde la saisie libre pour un fournisseur de passage. */}
              <select
                value={
                  (fournisseurs || []).some((f) => f.nom === bcLibre.fournisseurNom)
                    ? bcLibre.fournisseurNom
                    : bcLibre.fournisseurNom
                      ? "__autre__"
                      : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setBcLibre((f) => ({ ...f, fournisseurNom: v === "__autre__" ? " " : v === "" ? "" : v }));
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">— Choisir un fournisseur —</option>
                {(fournisseurs || []).map((f) => (
                  <option key={f.id || f.nom} value={f.nom}>{f.nom}</option>
                ))}
                <option value="__autre__">Autre (taper le nom)…</option>
              </select>
              {bcLibre.fournisseurNom !== "" && !(fournisseurs || []).some((f) => f.nom === bcLibre.fournisseurNom) && (
                <>
                  <input
                    autoFocus
                    value={bcLibre.fournisseurNom.trim()}
                    onChange={(e) => setBcLibre((f) => ({ ...f, fournisseurNom: e.target.value }))}
                    placeholder="Nom du fournisseur"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  {/* 📧 FOURNISSEUR HORS RÉPERTOIRE (2026-09-03, demande du
                      propriétaire : « il n'y a pas de courriel où on peut
                      envoyer chez un autre fournisseur ») — un courriel
                      tapé ici permet d'ENVOYER le bon quand même, et le
                      fournisseur s'enregistre au répertoire du même geste
                      (décochable) pour la prochaine fois. */}
                  <input
                    value={bcLibre.courrielFournisseur}
                    onChange={(e) => setBcLibre((f) => ({ ...f, courrielFournisseur: e.target.value }))}
                    placeholder="Courriel du fournisseur (optionnel — pour envoyer le bon)"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  {bcLibre.courrielFournisseur.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bcLibre.courrielFournisseur.trim()) && (
                    <p className="text-[10px] text-red-500">Adresse invalide — le bon sera créé mais ne partira pas par courriel.</p>
                  )}
                  {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bcLibre.courrielFournisseur.trim()) && (
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={bcLibre.enregistrerFournisseur}
                        onChange={(e) => setBcLibre((f) => ({ ...f, enregistrerFournisseur: e.target.checked }))}
                        className="h-3.5 w-3.5 accent-[#131B2E]"
                      />
                      Enregistrer ce fournisseur au répertoire (nom + courriel)
                    </label>
                  )}
                </>
              )}
              {(fournisseurs || []).length === 0 && (
                <p className="text-[10px] text-amber-700">
                  Aucun fournisseur au répertoire — ajoute-le avec « ➕ Nouveau fournisseur » ci-dessus pour pouvoir lui envoyer le bon.
                </p>
              )}
              <textarea
                rows={2}
                value={bcLibre.description}
                onChange={(e) => setBcLibre((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description — ex : 4 rouleaux de tape aluminium"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
              <ChampPhotosBc photos={bcLibre.photos || []} onChange={(liste) => setBcLibre((f) => ({ ...f, photos: liste }))} />
              <ChampFichiersBc fichiers={bcLibre.fichiers || []} onChange={(liste) => setBcLibre((f) => ({ ...f, fichiers: liste }))} />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  Montant HT
                  <InputNombreDecimal valeur={Number(bcLibre.montantHT) || 0} onChange={(v) => setBcLibre((f) => ({ ...f, montantHT: v }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                  $
                </span>
                {/* 📦 Livraison souhaitée (2026-09-03, demande du
                    propriétaire) : notée sur le bon ET écrite dans le
                    courriel au fournisseur — plus besoin de la taper
                    dans la description. */}
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  {bcLibre.livraisonChoix === "ramassage" ? "Prêt pour le" : "Livraison souhaitée"}
                  <input
                    type="date"
                    value={bcLibre.livraisonAsap ? "" : bcLibre.livraisonEstimee}
                    disabled={bcLibre.livraisonAsap}
                    onChange={(e) => setBcLibre((f) => ({ ...f, livraisonEstimee: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-300"
                  />
                </span>
                {/* ⚡ DÈS QUE POSSIBLE (2026-09-18) — commande spéciale : le
                    fournisseur n'a pas de date. Le bon le dit, et la
                    commande reste suivie « sans date — à confirmer ». */}
                <label className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={!!bcLibre.livraisonAsap}
                    onChange={(e) => setBcLibre((f) => ({ ...f, livraisonAsap: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-[#FF6A13]"
                  />
                  ⚡ Dès que possible
                </label>
                {/* 🔎 Recherche par nom OU liste complète au clic —
                    Tâches / Clients / Projets groupés. */}
                <SelecteurCibleAchat
                  valeur={bcLibre.tacheId ? `t:${bcLibre.tacheId}` : bcLibre.clientId ? `c:${bcLibre.clientId}` : bcLibre.projetId ? `p:${bcLibre.projetId}` : ""}
                  onChoisir={(v) => {
                    if (v.startsWith("t:")) setBcLibre((f) => ({ ...f, tacheId: v.slice(2), clientId: "", projetId: "" }));
                    else if (v.startsWith("c:")) setBcLibre((f) => ({ ...f, clientId: v.slice(2), tacheId: "", projetId: "" }));
                    else if (v.startsWith("p:")) setBcLibre((f) => ({ ...f, projetId: v.slice(2), tacheId: "", clientId: "", montantAttribue: "" }));
                    else setBcLibre((f) => ({ ...f, projetId: "", tacheId: "", clientId: "", montantAttribue: "" }));
                  }}
                  taches={tachesPourAchat || []}
                  clients={clients || []}
                  projets={projets || []}
                  className="min-w-0 flex-1"
                />
              </div>
              {/* 📦 INVENTAIRE COURANT (2026-09-06, demande du
                  propriétaire : « comme ça on sait que c'est au
                  bureau ») — la case marque l'achat comme du STOCK :
                  visible sur le bon, dans la liste et dans le courriel
                  au fournisseur. */}
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={bcLibre.pourInventaire}
                  onChange={(e) => setBcLibre((f) => ({ ...f, pourInventaire: e.target.checked }))}
                  className="h-3.5 w-3.5 accent-[#FF6A13]"
                />
                📦 Inventaire courant — cet achat est du stock pour le bureau
              </label>
              <p className="text-[9px] leading-snug text-slate-400">
                <span className="font-bold">Montant HT</span> = le total de la facture du fournisseur, avant taxes
                (les taxes sont récupérables, jamais un coût). Optionnel : à 0 $, la facture QuickBooks portant
                ce nº de BC posera le montant réel toute seule.
              </p>
              {/* 📍 LIVRAISON À (2026-09-04, demande du propriétaire :
                  « savoir où le stock sera mis ») — l'ATELIER par défaut
                  (l'adresse de l'entreprise, Paramètres) ; les adresses de
                  la tâche / du client / du projet rattachés s'offrent dès
                  qu'ils sont choisis ; « Autre » pour un cas spécial.
                  L'adresse suit le bon partout (courriel compris). */}
              {(() => {
                const t = bcLibre.tacheId ? (tachesPourAchat || []).find((x) => x.id === bcLibre.tacheId) : null;
                const cl = bcLibre.clientId ? (clients || []).find((x) => x.id === bcLibre.clientId) : null;
                const pr = bcLibre.projetId ? (projets || []).find((x) => x.id === bcLibre.projetId) : null;
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 🚚 RAMASSAGE = une CASE À COCHER (2026-09-22, demande du
                        propriétaire : l'option cachée dans le menu « Livraison
                        à » n'était pas intuitive). Cochée : on va chercher la
                        commande au comptoir — le menu de livraison disparaît. */}
                    <label className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${bcLibre.livraisonChoix === "ramassage" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-600"}`}>
                      <input
                        type="checkbox"
                        checked={bcLibre.livraisonChoix === "ramassage"}
                        onChange={(e) => setBcLibre((f) => ({ ...f, livraisonChoix: e.target.checked ? "ramassage" : "atelier" }))}
                        className="h-4 w-4 accent-[#FF6A13]"
                      />
                      🚚 On va le chercher nous-mêmes (ramassage chez le fournisseur — ne pas livrer)
                    </label>
                    {bcLibre.livraisonChoix !== "ramassage" && (<>
                    <span className="shrink-0 text-[10px] text-slate-400">📍 Livraison à</span>
                    <select
                      value={bcLibre.livraisonChoix}
                      onChange={(e) => setBcLibre((f) => ({ ...f, livraisonChoix: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="atelier">Atelier — {configEnt.adresse || "adresse de l'entreprise (Paramètres)"}</option>
                      {t?.adresse && <option value="tache">Chantier de la tâche — {t.adresse}</option>}
                      {(cl?.adresses || []).map((a) => (
                        <option key={a.id} value={`ca:${a.id}`}>{cl.nom} — {a.nom ? `${a.nom} · ` : ""}{libelleAdresse(a)}</option>
                      ))}
                      {cl?.adresseFacturation && <option value="cfact">{cl.nom} — facturation : {cl.adresseFacturation}</option>}
                      {pr && (pr.adresseLivraison || pr.adresseTravaux) && (
                        <option value="projet">Projet {pr.nom} — {pr.adresseLivraison || pr.adresseTravaux}</option>
                      )}
                      <option value="autre">Autre adresse…</option>
                    </select>
                    </>)}
                    {/* 🚚 RAMASSAGE : qui y va, où déposer (2026-09-21). Le JOUR
                        est la date « Prêt pour le » juste au-dessus. */}
                    {bcLibre.livraisonChoix === "ramassage" && (
                      <div className="w-full space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2">
                        {/* 📅 JOUR DU RAMASSAGE (2026-09-22, demande du propriétaire :
                            « mettre une date de ramassage pour que ça aille à l'agenda
                            directement ») — même champ que « Prêt pour le » : c'est ce
                            jour-là que la tournée se crée dans l'agenda. */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 text-[10px] font-bold text-sky-800">📅 Ramassage le</span>
                          <input
                            type="date"
                            value={bcLibre.livraisonAsap ? "" : bcLibre.livraisonEstimee}
                            disabled={bcLibre.livraisonAsap}
                            onChange={(e) => setBcLibre((f) => ({ ...f, livraisonEstimee: e.target.value }))}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-300"
                          />
                          {bcLibre.livraisonAsap ? <span className="text-[10px] text-slate-500">⚡ dès que possible — la tournée se fera quand tu poseras le jour</span> : <span className="text-[10px] text-slate-500">→ à l'agenda ce jour-là</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 text-[10px] font-bold text-sky-800">🚚 Ramassé par</span>
                          <select
                            value={bcLibre.ramassePar}
                            onChange={(e) => setBcLibre((f) => ({ ...f, ramassePar: e.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">— À décider plus tard —</option>
                            {(employesRamassage || []).map((u) => (
                              <option key={u.courriel} value={u.courriel}>{u.commissionnaire ? "🚚 " : ""}{u.nom}{u.commissionnaire ? " (commissionnaire)" : ""}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 text-[10px] font-bold text-sky-800">📦 À déposer à</span>
                          <input
                            list="lieux-depot-bc"
                            value={bcLibre.depotA}
                            onChange={(e) => setBcLibre((f) => ({ ...f, depotA: e.target.value }))}
                            placeholder="Atelier (défaut) — ou le chantier"
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          />
                          <datalist id="lieux-depot-bc">
                            <option value="Atelier" />
                            {t?.adresse && <option value={`Chantier — ${t.adresse}`} />}
                            {pr && (pr.adresseLivraison || pr.adresseTravaux) && <option value={`Chantier — ${pr.adresseLivraison || pr.adresseTravaux}`} />}
                            {(cl?.adresses || []).map((a) => <option key={a.id} value={`Chantier — ${libelleAdresse(a)}`} />)}
                          </datalist>
                        </div>
                        {ramassageDejaPrevu && (
                          <p className="text-[10px] font-semibold text-sky-800">
                            🔗 Combiné avec {ramassageDejaPrevu.numeroBc} (même fournisseur) — même jour, même personne : un seul arrêt. Tu peux changer.
                          </p>
                        )}
                        {bcLibre.ramassePar && !bcLibre.livraisonEstimee && !bcLibre.livraisonAsap && (
                          <p className="text-[10px] font-semibold text-amber-700">⚠️ Choisis le jour du ramassage — sans date, le bon n&apos;entre dans aucune tournée.</p>
                        )}
                      </div>
                    )}
                    {bcLibre.livraisonChoix === "autre" && (
                      <input
                        value={bcLibre.livraisonAutre}
                        onChange={(e) => setBcLibre((f) => ({ ...f, livraisonAutre: e.target.value }))}
                        placeholder="Adresse de livraison"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    )}
                  </div>
                );
              })()}
              {/* 💵 PART DE LA JOB — ajustable À LA BAISSE seulement : on
                  profite d'une commande pour ajouter du stock (rouleaux
                  de cuivre…), mais seule la part de la job compte dans
                  son coût. Vide = tout le montant. */}
              {(bcLibre.tacheId || bcLibre.clientId) && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                  <span className="text-[10px] font-bold text-emerald-800">Part attribuée à la job (HT)</span>
                  {/* ✍️ SAISIE LIBRE (2026-09-03, vécu : « le chiffre ne
                      reste pas ») — le plafonnement au Montant HT se
                      faisait À CHAQUE FRAPPE : tant que Montant HT était
                      à 0, tout chiffre tapé retombait à 0 en sortant du
                      champ. On tape librement ; le plafond s'applique à
                      la CRÉATION du bon (creerBcLibre), là où il a du
                      sens. */}
                  <InputNombreDecimal
                    valeur={bcLibre.montantAttribue === "" ? Number(bcLibre.montantHT) || 0 : Number(bcLibre.montantAttribue) || 0}
                    onChange={(v) => setBcLibre((f) => ({ ...f, montantAttribue: String(Number(v) || 0) }))}
                    className="w-24 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                  {Number(bcLibre.montantAttribue) > (Number(bcLibre.montantHT) || 0) && (
                    (Number(bcLibre.montantHT) || 0) <= 0 ? (
                      // 🤝 INDULGENCE (2026-09-04, vécu : part tapée avant le
                      // montant) : quand le Montant HT est encore à 0, la
                      // part devient le montant de l'achat à la création —
                      // c'est le cas le plus courant (tout l'achat est pour
                      // la job).
                      <span className="text-[9px] font-semibold text-emerald-700">
                        Le montant de l&apos;achat sera posé égal à la part ({(Number(bcLibre.montantAttribue) || 0).toFixed(2)} $) à la création.
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-amber-700">
                        ⚠️ dépasse le Montant HT — sera ramenée à {(Number(bcLibre.montantHT) || 0).toFixed(2)} $ à la création.
                      </span>
                    )
                  )}
                  <span className="text-[9px] leading-snug text-emerald-700">
                    $ — le reste ({Math.max(0, (Number(bcLibre.montantHT) || 0) - (bcLibre.montantAttribue === "" ? Number(bcLibre.montantHT) || 0 : Number(bcLibre.montantAttribue) || 0)).toFixed(2)} $) demeure un achat de stock.
                  </span>
                </div>
              )}
              <div className="flex gap-1.5">
                <Button
                  loading={bcLibreEnCours}
                  disabled={!(bcLibre.description || "").trim()}
                  onClick={async () => {
                    // 📍 Garde-fou : aucune adresse choisie (resté sur
                    // « atelier ») et ce n'est pas du stock → on demande
                    // confirmation avant d'envoyer.
                    if (bcLibre.livraisonChoix === "atelier" && !bcLibre.pourInventaire) {
                      setRappelAdresseBc(true);
                      return;
                    }
                    await executerCreationBc();
                  }}
                  className="min-h-0 flex-1 py-1.5 text-xs"
                >
                  Créer le bon de commande
                </Button>
                <Button variant="outline" onClick={() => setBcLibreOuvert(false)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
              </div>
            </div>
              </div>
            </div>
          )}
          {onglet === "bons" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🧾 Bons de commande libres <span className="text-slate-400">({(achatsLibres || []).length})</span></p>
              {bcLibreMsg && <p className="mt-1 text-[11px] font-semibold text-emerald-700">{bcLibreMsg}</p>}
              {(achatsLibres || []).length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">Aucun bon libre — « ➕ Nouveau BC » en haut de la page.</p>
              ) : (
            <div className="mt-2 space-y-1">
              {/* ✏️ Chaque ligne S'OUVRE au clic (2026-08-26) — la liste
                  était en lecture seule : impossible de corriger un
                  montant, de re-rattacher ou de supprimer un test. */}
              {(achatsLibres || []).slice((Math.min(pageBc, Math.max(1, Math.ceil((achatsLibres || []).length / ITEMS_PAR_PAGE))) - 1) * ITEMS_PAR_PAGE, Math.min(pageBc, Math.max(1, Math.ceil((achatsLibres || []).length / ITEMS_PAR_PAGE))) * ITEMS_PAR_PAGE).map((a2) => (
                <div key={a2.id} className="flex items-center gap-1">
                <button
                  onClick={() => ouvrirBc(a2)}
                  title="Ouvrir la fiche — modifier, rattacher, supprimer"
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[11px] text-slate-500 hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-bold text-slate-700">{a2.numeroBc}</span> · {a2.description}
                    {a2.fournisseurNom ? " — " + a2.fournisseurNom : ""}
                    {a2.tacheId ? (
                      <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">🔗 {a2.clientNom || a2.tacheTitre || "job"}</span>
                    ) : a2.clientId ? (
                      <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">👤 {a2.clientNom || "client"}</span>
                    ) : null}
                    {/* 📦 Marqué « inventaire courant » à la création —
                        on sait d'un œil que la boîte s'en va au bureau. */}
                    {(a2.description || "").includes("Pour l'inventaire courant") && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">📦 STOCK</span>
                    )}
                    {ecartQbPourBc(a2) && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Le montant réel de QuickBooks diffère du montant saisi — ouvre la fiche pour valider">⚠️ écart QB {ecartQbPourBc(a2).ecart > 0 ? "+" : ""}{ecartQbPourBc(a2).ecart.toFixed(2)} $</span>
                    )}
                    {/* ✉️ ENVOYÉ OU PAS (2026-09-15) — seulement pour les
                        BC créés depuis la trace (les anciens ne sont pas
                        tous « non envoyés », on n'en sait rien). */}
                    {a2.bcEnvoyeLe ? (
                      (a2.bcEnvoyeA || []).includes("manuel") ? (
                        <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700" title={`Commande passée par téléphone (ou hors Fluxya) le ${new Date(a2.bcEnvoyeLe).toLocaleString("fr-CA")} — aucun courriel envoyé par Fluxya`}>
                          📞 par téléphone {new Date(a2.bcEnvoyeLe).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                        </span>
                      ) : (
                      <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700" title={`Envoyé le ${new Date(a2.bcEnvoyeLe).toLocaleString("fr-CA")}${(a2.bcEnvoyeA || []).length ? ` à ${a2.bcEnvoyeA.join(", ")}` : ""}`}>
                        ✉️ envoyé {new Date(a2.bcEnvoyeLe).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                      </span>
                      )
                    ) : bcNonEnvoye(a2) ? (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700" title="Ce bon n'a pas été envoyé au fournisseur par Fluxya">⚠️ Non envoyé</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">{a2.montantHT.toFixed(2)} $</span>
                </button>
                {/* 📧 RENVOYER (2026-09-04, demande du propriétaire) : le
                    même panneau d'envoi (aperçu modifiable, choix des
                    adresses, adresse différente possible) — pour un bon
                    déjà créé, autant de fois que nécessaire. */}
                {peutCommander && (
                  <button
                    onClick={() => {
                      const fiche = ficheFournisseurParNom(a2.fournisseurNom);
                      setOffreEnvoiBc({
                        numero: a2.numeroBc || "(sans nº)",
                        fournisseur: a2.fournisseurNom || "le fournisseur",
                        // 📦 Le texte renvoyé porte la date de livraison À JOUR.
                        description: descriptionAvecLivraison(a2.description || "", a2.livraisonSouhaitee || null),
                        photos: [],
                        fichiers: [],
                        courriels: fiche?.courriels || [],
                        coches: (fiche?.courriels || []).filter((c) => c.defaut).map((c) => c.email),
                      });
                    }}
                    title={bcNonEnvoye(a2) ? "Envoyer ce bon de commande par courriel" : "Renvoyer ce bon de commande par courriel"}
                    className={`shrink-0 rounded-lg border px-1.5 py-1 text-[10px] font-bold ${bcNonEnvoye(a2) ? "border-red-300 bg-red-50 text-red-700 hover:border-red-400" : "border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-700"}`}
                  >
                    📧{bcNonEnvoye(a2) ? " Envoyer" : ""}
                  </button>
                )}
                {/* 📦 Reçu (2026-09-15) — pour TOUT BC libre, pas seulement
                    ceux du stock : la ligne quitte « Livraisons attendues ». */}
                {peutCommander && !a2.recuLe && (
                  <button
                    onClick={() => onMajBcLibre?.(a2, { recuLe: new Date().toISOString() }, "📦 reçu")}
                    title="Commande reçue"
                    className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700 hover:border-emerald-400 active:scale-95"
                  >
                    📦 Reçu
                  </button>
                )}
                {/* ✍️ Envoyé autrement (téléphone, courriel personnel) : la
                    trace se pose à la main, comme pour les BC de pièces. */}
                {peutCommander && bcNonEnvoye(a2) && (
                  <button
                    onClick={() => onMarquerBcEnvoye?.(a2.numeroBc, ["manuel"])}
                    title="Commande passée par téléphone (ou envoyée hors Fluxya) — poser la trace, sans courriel"
                    className="shrink-0 rounded-lg border border-sky-200 px-1.5 py-1 text-[10px] font-bold text-sky-700 hover:border-sky-400"
                  >
                    📞 par téléphone
                  </button>
                )}
                {/* 📦➕ La boîte est arrivée — ajouter son contenu à
                    l'inventaire courant (bons marqués STOCK seulement). */}
                {peutCommander && (a2.description || "").includes("Pour l'inventaire courant") && (
                  <button
                    onClick={() => setReceptionBc(a2)}
                    title="Commande reçue — ajouter au stock de l'inventaire courant"
                    className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1 text-[10px] font-bold text-amber-700 hover:border-amber-400 active:scale-95"
                  >
                    📦➕
                  </button>
                )}
                </div>
              ))}
              <div ref={refListeBc}>
                <BarrePagination total={(achatsLibres || []).length} page={pageBc} onPage={setPageBc} refHaut={refListeBc} libelle="bons de commande" />
              </div>
            </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ✏️ FICHE D'UN BON DE COMMANDE (2026-08-26) — modification,
          re-rattachement (général / job / client / projet), suppression
          en deux clics. Un projet choisi = DÉMÉNAGEMENT : le bon rejoint
          la fiche du projet et quitte cette liste (tracé au journal). */}
      {bcOuvert && bcEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; setBcOuvert(null); }}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">🧾 {bcOuvert.numeroBc || "Bon de commande"}</h3>
                <p className="text-xs text-slate-500">{bcOuvert.dateAchat || ""}</p>
              </div>
              <button onClick={() => setBcOuvert(null)} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Fournisseur</label>
                <input
                  value={bcEdit.fournisseurNom}
                  onChange={(e) => setBcEdit((f) => ({ ...f, fournisseurNom: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={bcEdit.description}
                  onChange={(e) => setBcEdit((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Montant HT ($)</label>
                <InputNombreDecimal
                  valeur={Number(bcEdit.montantHT) || 0}
                  onChange={(v) => setBcEdit((f) => ({ ...f, montantHT: v }))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">{bcEdit.ramassage ? "🚚 Prêt pour le (ramassage)" : "📦 Livraison prévue"}</label>
                <input
                  type="date"
                  value={bcEdit.asap ? "" : bcEdit.livraisonSouhaitee || ""}
                  disabled={!!bcEdit.asap}
                  onChange={(e) => setBcEdit((f) => ({ ...f, livraisonSouhaitee: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-300"
                />
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <input type="checkbox" checked={!!bcEdit.asap} onChange={(e) => setBcEdit((f) => ({ ...f, asap: e.target.checked }))} className="h-3.5 w-3.5 accent-[#FF6A13]" />
                    ⚡ Dès que possible (pas de date)
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <input type="checkbox" checked={!!bcEdit.ramassage} onChange={(e) => setBcEdit((f) => ({ ...f, ramassage: e.target.checked }))} className="h-3.5 w-3.5 accent-[#FF6A13]" />
                    🚚 Ramassage chez le fournisseur
                  </label>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">Le fournisseur confirme une date ? Décoche « dès que possible » et inscris-la ici — le suivi des livraisons suit.</p>
                {bcEdit.ramassage && (
                  <div className="mt-1.5 space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="shrink-0 text-[10px] font-bold text-sky-800">🚚 Ramassé par</span>
                      <select value={bcEdit.ramassePar || ""} onChange={(e) => setBcEdit((f) => ({ ...f, ramassePar: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                        <option value="">— À décider —</option>
                        {(employesRamassage || []).map((u) => (
                          <option key={u.courriel} value={u.courriel}>{u.commissionnaire ? "🚚 " : ""}{u.nom}{u.commissionnaire ? " (commissionnaire)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="shrink-0 text-[10px] font-bold text-sky-800">📦 À déposer à</span>
                      <input value={bcEdit.depotA || ""} onChange={(e) => setBcEdit((f) => ({ ...f, depotA: e.target.value }))} placeholder="Atelier (défaut) — ou le chantier" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
                    </div>
                    <p className="text-[10px] text-sky-800">La date ci-dessus est le JOUR de ramassage — le bon entre dans la tournée de cette personne ce jour-là.</p>
                  </div>
                )}
              </div>
              {(() => {
                const dep = depenseQbPourBc(bcOuvert.numeroBc);
                if (!dep) return null;
                const reel = Number(dep.amountHT) || 0;
                const ecart = reel - (Number(bcEdit.montantHT) || 0);
                if (Math.abs(ecart) <= 1)
                  return (
                    <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
                      ✓ Facture reçue dans QuickBooks : {reel.toFixed(2)} $ HT ({dep.status === "PAID" ? "payée" : "à payer"}) — conforme au BC.
                    </p>
                  );
                return (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                    <p className="text-[11px] font-bold leading-snug text-amber-800">
                      ⚠️ Écart de prix — BC : {(Number(bcEdit.montantHT) || 0).toFixed(2)} $ · QuickBooks : {reel.toFixed(2)} $ ({ecart > 0 ? "+" : ""}{ecart.toFixed(2)} $). Le prix est-il bon ?
                    </p>
                    <button
                      type="button"
                      onClick={() => setBcEdit((f) => ({ ...f, montantHT: reel }))}
                      className="mt-1.5 w-full rounded-lg border border-amber-400 bg-white py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                    >
                      ✓ Adopter le montant QuickBooks ({reel.toFixed(2)} $)
                    </button>
                    <p className="mt-1 text-[9px] leading-snug text-amber-700">
                      Le prix n'est PAS bon ? Laisse tel quel — le badge reste allumé comme aide-mémoire pendant que tu règles ça avec le fournisseur. (Le coût compté est de toute façon le montant réel de QuickBooks.)
                    </p>
                  </div>
                );
              })()}
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Rattachement (où va le coût ?)</label>
                {/* 🔎 Même sélecteur avec recherche qu'à la création. La
                    tâche déjà rattachée mais disparue de l'horaire garde
                    son étiquette (libelleRepli) — l'écran ne ment pas. */}
                <SelecteurCibleAchat
                  valeur={bcEdit.cible}
                  onChoisir={(v) => setBcEdit((f) => ({ ...f, cible: v }))}
                  taches={tachesPourAchat || []}
                  clients={clients || []}
                  projets={projets || []}
                  libelleRepli={
                    bcOuvert.tacheId
                      ? `Tâche : ${bcOuvert.clientNom ? `${bcOuvert.clientNom} — ` : ""}${bcOuvert.tacheTitre || bcOuvert.tacheId}`
                      : bcOuvert.clientNom
                        ? `Client : ${bcOuvert.clientNom}`
                        : ""
                  }
                />
                {bcEdit.cible.startsWith("p:") && (
                  <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-800">
                    🏗️ Un projet choisi = le bon DÉMÉNAGE dans la fiche du projet (ses coûts vivent là) et quitte cette liste.
                  </p>
                )}
              </div>
              {(bcEdit.cible.startsWith("t:") || bcEdit.cible.startsWith("c:")) && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                  <span className="text-[10px] font-bold text-emerald-800">Part attribuée (HT)</span>
                  <InputNombreDecimal
                    valeur={bcEdit.montantAttribue === "" ? Number(bcEdit.montantHT) || 0 : Number(bcEdit.montantAttribue) || 0}
                    onChange={(v) => setBcEdit((f) => ({ ...f, montantAttribue: String(Math.min(Number(v) || 0, Number(f.montantHT) || 0)) }))}
                    className="w-24 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                  <span className="text-[9px] leading-snug text-emerald-700">
                    $ — le reste ({Math.max(0, (Number(bcEdit.montantHT) || 0) - (bcEdit.montantAttribue === "" ? Number(bcEdit.montantHT) || 0 : Number(bcEdit.montantAttribue) || 0)).toFixed(2)} $) demeure un achat de stock.
                  </span>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  disabled={bcEnregistrement}
                  onClick={async () => {
                    setBcEnregistrement(true);
                    const cible = bcEdit.cible;
                    const attribue =
                      bcEdit.montantAttribue === "" ? Number(bcEdit.montantHT) || 0 : Math.min(Number(bcEdit.montantAttribue) || 0, Number(bcEdit.montantHT) || 0);
                    const champsBase = {
                      fournisseurNom: bcEdit.fournisseurNom.trim(),
                      // 📦 La ligne « Livraison souhaitée » du texte suit la date
                      // de la fiche (2026-09-16, vécu : renvoi avec l'ancienne date).
                      description: descriptionAvecLivraison(bcEdit.description.trim(), bcEdit.asap ? null : bcEdit.livraisonSouhaitee || null, { asap: !!bcEdit.asap, ramassage: !!bcEdit.ramassage }),
                      montantHT: Number(bcEdit.montantHT) || 0,
                    };
                    if (cible.startsWith("p:")) {
                      // Déménagement : la fiche à jour part au projet.
                      const ok = await onMajBcLibre?.(bcOuvert, champsBase, "fiche mise à jour avant déménagement");
                      if (ok !== false) await onDemenagerBcVersProjet?.({ ...bcOuvert, ...champsBase }, cible.slice(2));
                    } else {
                      const t = cible.startsWith("t:") ? (tachesPourAchat || []).find((x) => x.id === cible.slice(2)) : null;
                      const c = cible.startsWith("c:") ? (clients || []).find((x) => x.id === cible.slice(2)) : null;
                      const champs = {
                        ...champsBase,
                        tacheId: cible.startsWith("t:") ? cible.slice(2) : null,
                        tacheTitre: t?.titre || (cible.startsWith("t:") ? bcOuvert.tacheTitre : null) || null,
                        clientId: c?.id || null,
                        clientNom: c?.nom || t?.clientNom || (cible.startsWith("t:") ? bcOuvert.clientNom : null) || null,
                        montantAttribue: cible ? attribue : null,
                        livraisonSouhaitee: bcEdit.asap ? null : bcEdit.livraisonSouhaitee || null,
                        // 🚚 Ramassage (snippet 153) — vidés si le bon n'est plus un ramassage.
                        ramassePar: bcEdit.ramassage ? bcEdit.ramassePar || null : null,
                        depotA: bcEdit.ramassage ? (bcEdit.depotA || "").trim() || "Atelier" : null,
                      };
                      const avant = bcOuvert.tacheId
                        ? `Job « ${bcOuvert.tacheTitre || bcOuvert.tacheId} »`
                        : bcOuvert.clientId ? `Client « ${bcOuvert.clientNom || bcOuvert.clientId} »` : "achat général";
                      const apres = champs.tacheId
                        ? `Job « ${champs.tacheTitre || champs.tacheId} »`
                        : champs.clientId ? `Client « ${champs.clientNom} »` : "achat général";
                      const resume =
                        (avant !== apres ? `rattachement : ${avant} → ${apres}` : "fiche mise à jour") +
                        ` (${champs.montantHT.toFixed(2)} $ HT${cible ? `, ${attribue.toFixed(2)} $ attribués` : ""})`;
                      await onMajBcLibre?.(bcOuvert, champs, resume);
                    }
                    setBcEnregistrement(false);
                    setBcOuvert(null);
                  }}
                  className="min-h-0 flex-1 py-2 text-xs"
                >
                  {bcEnregistrement ? "Enregistrement…" : "Enregistrer"}
                </Button>
                <Button variant="outline" onClick={() => setBcOuvert(null)} className="min-h-0 py-2 text-xs">Annuler</Button>
              </div>
              {bcSupprEtape ? (
                <div className="rounded-xl border border-red-300 bg-red-50 p-2.5">
                  <p className="text-[11px] font-bold text-red-700">
                    Supprimer définitivement {bcOuvert.numeroBc} ({(Number(bcOuvert.montantHT) || 0).toFixed(2)} $ HT) ? Son coût disparaît des analyses.
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <Button
                      variant="danger"
                      onClick={async () => { await onSupprimerBcLibre?.(bcOuvert); setBcOuvert(null); }}
                      className="min-h-0 flex-1 py-1.5 text-[11px]"
                    >
                      Oui, supprimer
                    </Button>
                    <Button variant="outline" onClick={() => setBcSupprEtape(false)} className="min-h-0 flex-1 py-1.5 text-[11px]">Annuler</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setBcSupprEtape(true)}
                  className="w-full rounded-lg border border-red-200 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50"
                >
                  🗑️ Supprimer ce bon de commande…
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔧 PIÈCES POUR LES JOBS — sous l'onglet Bons de commande (2026-09-22). */}
      {onglet === "bons" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">🔧 Pièces pour les jobs <span className="text-slate-400">({ouvertes.length} en attente)</span></p>
          <div className="space-y-2">
      <div ref={refListePieces} className="flex flex-wrap gap-1.5">
        {[["ouvertes", "En attente"], ["a_commander", "À commander"], ["commandee", "Commandées"], ["recue", "Reçues"], ["toutes", "Toutes"]].map(
          ([val, label]) => (
            <button
              key={val}
              onClick={() => { setFiltre(val); setPagePieces(1); }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                filtre === val ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {affichees.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Aucune pièce dans cette catégorie.
        </p>
      ) : (
        <div className="space-y-2">
          {affichees.slice((Math.min(pagePieces, Math.max(1, Math.ceil(affichees.length / ITEMS_PAR_PAGE))) - 1) * ITEMS_PAR_PAGE, Math.min(pagePieces, Math.max(1, Math.ceil(affichees.length / ITEMS_PAR_PAGE))) * ITEMS_PAR_PAGE).map((p) => {
            const st = STATUTS_PIECE[p.statut] || STATUTS_PIECE.a_commander;
            // Deux façons d'être en retard : la date promise est passée
            // (le fournisseur a manqué sa parole), ou il n'y a jamais eu
            // de date et ça traîne depuis deux semaines.
            const enRetard = p.enRetard || (p.statut !== "recue" && p.statut !== "annulee" && p.jours >= 14);
            return (
              <div key={p.id} className={`rounded-2xl border bg-white p-4 ${enRetard ? "border-red-300" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="whitespace-pre-line text-sm font-extrabold text-slate-900">{p.pieceRequise}</p>
                    <p className="text-xs text-slate-500">{p.clientNom}</p>
                    {(p.modele || p.numeroSerie) && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {p.modele}
                        {p.modele && p.numeroSerie ? " · " : ""}
                        {p.numeroSerie ? `Nº ${p.numeroSerie}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${st.cls}`}>{st.label}</span>
                    {p.statut !== "recue" && p.statut !== "annulee" && (
                      <p className={`mt-1 text-[11px] font-bold tabular-nums ${enRetard ? "text-red-600" : "text-slate-400"}`}>
                        {p.jours === 0 ? "aujourd'hui" : `${p.jours} jour${p.jours > 1 ? "s" : ""}`}
                      </p>
                    )}
                  </div>
                </div>

                {(p.fournisseurNom || p.numeroBc) && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {p.fournisseurNom || "Fournisseur non précisé"}
                    {p.numeroBc ? <> · bon de commande <span className="font-bold">{p.numeroBc}</span></> : ""}
                  </p>
                )}
                {p.dateReceptionPrevue && p.statut !== "recue" && p.statut !== "annulee" && (
                  <p className={`mt-0.5 text-[11px] font-bold ${p.enRetard ? "text-red-600" : "text-sky-700"}`}>
                    {p.enRetard ? "⚠️ Était attendue le " : "📅 Livraison demandée le "}
                    {new Date(`${p.dateReceptionPrevue}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                    {!p.enRetard && p.livraisonFixe ? " — date FIXE (quelqu'un sera à l'entrepôt)" : ""}
                    {p.enRetard ? " — relancer le fournisseur" : ""}
                  </p>
                )}
                {/* HISTORIQUE DES REPORTS — visible seulement s'il y en a.
                    Une commande qui se passe bien garde une carte propre ;
                    un fournisseur qui repousse laisse des traces. */}
                {(p.reportsDate || []).length > 0 && p.statut !== "recue" && p.statut !== "annulee" && (
                  <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      🕓 Reports de date ({p.reportsDate.length})
                    </p>
                    {p.reportsDate.map((r, i) => (
                      <p key={i} className="mt-0.5 text-[11px] text-slate-600">
                        Promis le {new Date(`${r.de}T00:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
                        {r.a
                          ? ` → reporté au ${new Date(`${r.a}T00:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`
                          : " → date retirée"}
                        {r.le ? <span className="text-slate-400"> (changé le {new Date(r.le).toLocaleDateString("fr-CA")}{r.par ? ` par ${r.par}` : ""})</span> : null}
                      </p>
                    ))}
                  </div>
                )}
                {p.statut === "commandee" && !p.dateReceptionPrevue && (
                  <p className="mt-0.5 text-[11px] text-slate-400">Aucune date de réception confirmée par le fournisseur.</p>
                )}
                {p.statut === "recue" && (
                  <p className="mt-1.5 text-[11px] text-emerald-700">
                    Reçue par {p.recuParNom || "—"}
                    {p.recuVia === "quickbooks" ? " (via QuickBooks)" : ""}
                    {p.recuLe ? ` · ${new Date(p.recuLe).toLocaleDateString("fr-CA")}` : ""}
                  </p>
                )}
                {p.statut === "annulee" && p.annuleRaison && (
                  <p className="mt-1.5 text-[11px] italic text-slate-500">Annulée — {p.annuleRaison}</p>
                )}
                {/* PAIEMENT DU CLIENT — deux moments possibles, deux
                    messages différents : avant la COMMANDE (la pièce ne
                    part même pas chez le fournisseur sans l'argent) ou
                    avant la PLANIFICATION (on commande tout de suite,
                    mais on ne cédule pas la pose sans l'argent). */}
                {p.paiementAvantCommande && !p.paiementRecu && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                    💰 Le client doit payer{Number(p.montantPiece) > 0 ? ` ${Number(p.montantPiece).toFixed(2)} $ HT` : ""} AVANT la commande
                    {p.jours > 0 ? ` · en attente depuis ${p.jours} jour${p.jours > 1 ? "s" : ""} — relancer le CLIENT` : ""}
                  </p>
                )}
                {p.paiementAvantCommande && p.paiementRecu && p.statut !== "recue" && p.statut !== "annulee" && (
                  <p className="mt-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    💰 Pièce payée d&apos;avance par le client{Number(p.montantPiece) > 0 ? ` (${Number(p.montantPiece).toFixed(2)} $ HT)` : ""} — sera déduite de la facture du retour
                  </p>
                )}
                {p.paiementRequis && !p.paiementRecu && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                    💰 Paiement du client requis avant de replanifier
                  </p>
                )}
                {p.bcEnvoyeLe && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    ✉️ BC envoyé au fournisseur le {new Date(p.bcEnvoyeLe).toLocaleDateString("fr-CA")}
                  </p>
                )}

                {/* ACTIONS — administrateurs seulement. Le répartiteur
                    voit tout ce qui précède, mais rien de ce qui suit. */}
                {peutCommander && p.statut !== "recue" && p.statut !== "annulee" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {editionBc === p.id ? (
                      <div className="w-full space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Fournisseur</label>
                            <input
                              list={`fourn-${p.id}`}
                              value={formBc.fournisseurNom}
                              onChange={(e) => setFormBc({ ...formBc, fournisseurNom: e.target.value })}
                              placeholder="Descair, Master…"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            />
                            <datalist id={`fourn-${p.id}`}>
                              {(fournisseurs || []).map((f) => (
                                <option key={f.id || f.nom} value={f.nom} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Nº de bon de commande</label>
                            <input
                              value={formBc.numeroBc}
                              onChange={(e) => setFormBc({ ...formBc, numeroBc: e.target.value })}
                              placeholder="Vide = généré automatiquement"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            />
                            <p className="mt-0.5 text-[9px] text-slate-400">
                              Laisse vide : le prochain numéro officiel (même compteur que les BC fournisseurs) sera pris à l&apos;enregistrement — aucun numéro brûlé si tu annules.
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">
                            Livraison demandée pour le <span className="font-normal normal-case text-slate-400">(facultatif)</span>
                          </label>
                          <input
                            type="date"
                            value={formBc.datePrevue}
                            onChange={(e) => setFormBc({ ...formBc, datePrevue: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:w-52"
                          />
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Cette date part dans le courriel au fournisseur. Si tu n&apos;exiges rien, laisse vide — c&apos;est correct.
                            Elle sert aussi à rappeler le client d&apos;avance, et vire au rouge si elle passe sans que la pièce arrive.
                          </p>
                          {/* Livraison SOUPLE ou FIXE — l'entrepôt n'a pas de
                              personnel en permanence : en mode fixe, quelqu'un
                              se déplace pour recevoir CE jour-là, et le
                              courriel au fournisseur le dit clairement. */}
                          {formBc.datePrevue && (
                            <div className="mt-1.5 space-y-1">
                              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-600">
                                <input
                                  type="radio"
                                  name={`mode-livraison-${p.id}`}
                                  checked={!formBc.livraisonFixe}
                                  onChange={() => setFormBc({ ...formBc, livraisonFixe: false, ramassage: false })}
                                  className="mt-0.5"
                                />
                                <span><span className="font-bold">Souple</span> — livrer au plus tard cette date, avant si possible</span>
                              </label>
                              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-600">
                                <input
                                  type="radio"
                                  name={`mode-livraison-${p.id}`}
                                  checked={formBc.livraisonFixe}
                                  onChange={() => setFormBc({ ...formBc, livraisonFixe: true, ramassage: false })}
                                  className="mt-0.5"
                                />
                                <span><span className="font-bold">Date fixe</span> — livrer ce jour exactement : quelqu&apos;un sera présent à l&apos;entrepôt pour recevoir</span>
                              </label>
                              {/* 🚚 RAMASSAGE (snippet 154, 2026-09-21) — on va la
                                  chercher : qui, et où déposer. Le jour = la date
                                  prévue ci-dessus. */}
                              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-600">
                                <input
                                  type="radio"
                                  name={`mode-livraison-${p.id}`}
                                  checked={!!formBc.ramassage}
                                  onChange={() => setFormBc({ ...formBc, ramassage: true, livraisonFixe: false })}
                                  className="mt-0.5"
                                />
                                <span><span className="font-bold">🚚 Ramassage</span> — on va la chercher au comptoir du fournisseur (pas de livraison)</span>
                              </label>
                              {formBc.ramassage && (
                                <div className="ml-5 space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="shrink-0 text-[10px] font-bold text-sky-800">Ramassé par</span>
                                    <select value={formBc.ramassePar} onChange={(e) => setFormBc({ ...formBc, ramassePar: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                                      <option value="">— À attribuer plus tard (agenda) —</option>
                                      {(employesRamassage || []).map((u) => (
                                        <option key={u.courriel} value={u.courriel}>{u.commissionnaire ? "🚚 " : ""}{u.nom}{u.commissionnaire ? " (commissionnaire)" : ""}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="shrink-0 text-[10px] font-bold text-sky-800">📦 À déposer à</span>
                                    <input value={formBc.depotA} onChange={(e) => setFormBc({ ...formBc, depotA: e.target.value })} placeholder="Atelier (défaut) — ou le chantier" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={async () => {
                              // BLOC 1 — numéro généré À L'ENREGISTREMENT
                              // (pas à l'ouverture du formulaire) : un
                              // formulaire ouvert puis annulé ne brûle
                              // aucun numéro, la séquence comptable reste
                              // pleine. Même compteur que les BC
                              // fournisseurs : jamais de doublon.
                              let numero = formBc.numeroBc.trim();
                              if (!numero) {
                                try {
                                  numero = await numeroBonCommande();
                                } catch {
                                  numero = "";
                                }
                              }
                              // HISTORIQUE DES REPORTS — si une date existait
                              // déjà et qu'elle change, on garde la trace :
                              // « promis le 10 → reporté au 15, par qui,
                              // quand ». C'est ce qui permet de relancer un
                              // fournisseur avec des faits.
                              const ancienneDate = p.dateReceptionPrevue || null;
                              const nouvelleDate = formBc.datePrevue || null;
                              const reportAjoute =
                                ancienneDate && nouvelleDate !== ancienneDate
                                  ? [...(p.reportsDate || []), { de: ancienneDate, a: nouvelleDate, le: new Date().toISOString(), par: nomUtilisateur || "" }]
                                  : null;
                              onMaj(p.id, {
                                fournisseur_nom: formBc.fournisseurNom.trim() || null,
                                numero_bc: numero || null,
                                date_reception_prevue: nouvelleDate,
                                livraison_fixe: !!(nouvelleDate && formBc.livraisonFixe),
                                // 🚚 Ramassage (snippet 154).
                                ramassage: !!formBc.ramassage,
                                ramasse_par: formBc.ramassage && formBc.ramassePar ? String(formBc.ramassePar).toLowerCase() : null,
                                depot_a: formBc.ramassage ? (formBc.depotA || "").trim() || "Atelier" : null,
                                ...(reportAjoute ? { reports_date: reportAjoute } : {}),
                                statut: "commandee",
                              });
                              setEditionBc(null);
                            }}
                            className="min-h-0 px-3 py-1.5 text-xs"
                          >
                            <Check size={13} /> Pièce commandée
                          </Button>
                          <Button variant="outline" onClick={() => setEditionBc(null)} className="min-h-0 px-3 py-1.5 text-xs">Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* BLOC 3 — paiement avant commande : tant que le
                            client n'a pas payé, COMMANDER est verrouillé.
                            « Paiement reçu » reste un geste humain, comme
                            pour les dépôts : c'est la personne qui voit
                            l'argent rentrer qui clique. */}
                        {p.paiementAvantCommande && !p.paiementRecu && p.statut === "a_commander" ? (
                          <>
                            <span className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800">
                              <Lock size={12} /> Commande verrouillée — paiement du client requis
                            </span>
                            <Button
                              onClick={() => onMaj(p.id, { paiement_recu: true })}
                              className="min-h-0 px-3 py-1.5 text-xs"
                            >
                              <Check size={13} /> Paiement reçu
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditionBc(p.id);
                              setFormBc({
                                fournisseurNom: p.fournisseurNom || "",
                                numeroBc: p.numeroBc || "",
                                datePrevue: p.dateReceptionPrevue || "",
                                livraisonFixe: !!p.livraisonFixe,
                                ramassage: !!p.ramassage,
                                ramassePar: p.ramassePar || "",
                                depotA: p.depotA || "",
                              });
                            }}
                            className="min-h-0 px-3 py-1.5 text-xs"
                          >
                            {p.statut === "commandee" ? "Modifier la commande" : "📦 Commander la pièce"}
                          </Button>
                        )}
                        {/* BLOC 2 — courriel du BC : ouvre le logiciel de
                            courriel de l'utilisateur, tout pré-rempli.
                            On ne peut pas savoir s'il a vraiment cliqué
                            Envoyer — d'où la confirmation manuelle. */}
                        {p.statut === "commandee" && courrielsFournisseur(p).length > 0 && (
                          <>
                            <div className="w-full">
                              <ChampPhotosBc
                                photos={photosEnvoiBc[p.id] || []}
                                onChange={(liste) => setPhotosEnvoiBc((prev) => ({ ...prev, [p.id]: liste }))}
                                libelle="📷 Photos pour ce BC (facultatif)"
                              />
                              <div className="mt-2">
                                <ChampFichiersBc
                                  fichiers={fichiersEnvoiBc[p.id] || []}
                                  onChange={(liste) => setFichiersEnvoiBc((prev) => ({ ...prev, [p.id]: liste }))}
                                  libelle="📎 Fichiers pour ce BC (facultatif — PDF, Word, Excel…)"
                                />
                              </div>
                            </div>
                            <Button
                              onClick={() => envoyerBcParApplication(p)}
                              disabled={envoiBcEnCours === p.id}
                              className="min-h-0 px-3 py-1.5 text-xs"
                            >
                              {envoiBcEnCours === p.id ? "Envoi…" : "✉️ Envoyer le BC"}
                            </Button>
                            <a
                              href={lienCourrielBc(p, courrielsFournisseur(p)[0])}
                              className="flex min-h-0 items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              ✉️ Par mon logiciel
                            </a>
                          </>
                        )}
                        {p.statut === "commandee" && courrielsFournisseur(p).length === 0 && p.fournisseurNom && (
                          <span className="text-[10px] text-slate-400">✉️ Aucun courriel sur la fiche « {p.fournisseurNom} »</span>
                        )}
                        {p.statut === "commandee" && !p.bcEnvoyeLe && (
                          <button
                            onClick={() => onMaj(p.id, { bc_envoye_le: new Date().toISOString() })}
                            className="text-[11px] font-semibold text-slate-500 underline underline-offset-2 hover:text-emerald-700"
                          >
                            ✓ Marquer le BC envoyé
                          </button>
                        )}
                        {messageEnvoiBc?.id === p.id && (
                          <p className={`w-full text-[11px] font-semibold ${messageEnvoiBc.ok ? "text-emerald-700" : "text-amber-700"}`}>
                            {messageEnvoiBc.ok ? "✓ " : "⚠️ "}{messageEnvoiBc.texte}
                          </p>
                        )}
                        {/* RÉCEPTION — le seul geste qui débloque la
                            planification. Toujours humain : une facture
                            fournisseur ne prouve pas que la pièce est
                            arrivée sur la tablette. */}
                        {confirmRecue === p.id ? (
                          <div className="w-full rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[11px]">
                            <p className="font-bold text-emerald-900">
                              ✅ Confirmer la réception de « {p.pieceRequise} » pour {p.clientNom} ? La tâche de retour deviendra planifiable à l'agenda.
                            </p>
                            {p.statut !== "commandee" && (
                              <p className="mt-1 rounded bg-amber-100 px-1.5 py-1 font-bold text-amber-800">
                                ⚠️ Cette pièce n'a JAMAIS été marquée commandée. Reçue quand même ? (ex. : prise directement au comptoir)
                              </p>
                            )}
                            <div className="mt-1.5 flex gap-1.5">
                              <Button
                                onClick={() => {
                                  setConfirmRecue(null);
                                  onRecue(p.id, nomUtilisateur, p.statut !== "commandee");
                                }}
                                className="min-h-0 px-3 py-1.5 text-xs"
                              >
                                Oui, reçue
                              </Button>
                              <Button variant="outline" onClick={() => setConfirmRecue(null)} className="min-h-0 px-2.5 py-1.5 text-xs">
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button onClick={() => setConfirmRecue(p.id)} className="min-h-0 px-3 py-1.5 text-xs">
                            <Check size={13} /> Pièce reçue
                          </Button>
                        )}
                        <button
                          onClick={() => { setAnnulationPour(p.id); setRaisonAnnulation(""); }}
                          className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-red-600"
                        >
                          Annuler
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* BLOC 3 — moment du paiement exigé. Trois choix, parce
                    que trois réalités : rien (facturé au retour, le cas
                    normal), avant la COMMANDE (grosse pièce, client
                    inconnu), avant la PLANIFICATION (on commande, mais on
                    ne pose pas sans l'argent). */}
                {peutCommander && (p.statut === "a_commander" || p.statut === "commandee") && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[11px]">
                    <label className="font-bold text-slate-400">💰 Paiement du client :</label>
                    <select
                      value={p.paiementAvantCommande ? "avant_commande" : p.paiementRequis ? "avant_planification" : "aucun"}
                      onChange={(e) =>
                        onMaj(p.id, {
                          paiement_avant_commande: e.target.value === "avant_commande",
                          paiement_requis: e.target.value === "avant_planification",
                        })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                    >
                      <option value="aucun">Aucun — facturé au retour</option>
                      <option value="avant_commande">Exigé AVANT la commande</option>
                      <option value="avant_planification">Exigé avant la planification</option>
                    </select>
                    {(p.paiementAvantCommande || p.paiementRequis) && (
                      <span className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={p.montantPiece ?? ""}
                          onBlur={(e) => {
                            // Accepte le point ET la virgule (44,50).
                            const brut = String(e.target.value).replace(",", ".");
                            const v = brut === "" ? null : parseFloat(brut) || 0;
                            if (v !== p.montantPiece) onMaj(p.id, { montant_piece: v });
                          }}
                          placeholder="Montant"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[11px] tabular-nums"
                        />
                        <span className="text-slate-400">$ HT</span>
                      </span>
                    )}
                  </div>
                )}

                {/* 💰 DEMANDE DE PAIEMENT — le verrou sans la demande,
                    c'est une pièce qui dort : tout le monde croit que
                    quelqu'un d'autre a appelé le client. Ici, la demande
                    écrite part (courriel) et laisse une TRACE datée. */}
                {peutCommander && p.statut !== "annulee" && (p.paiementAvantCommande || p.paiementRequis) && !p.paiementRecu && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button onClick={() => ouvrirDemande(p)} className="min-h-0 px-3 py-1.5 text-xs">
                      💰 {p.demandePaiementLe ? "Renvoyer la demande de paiement" : "Demander le paiement"}
                    </Button>
                    {p.demandePaiementLe && (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        ✓ Demande envoyée le {new Date(p.demandePaiementLe).toLocaleDateString("fr-CA")}
                      </span>
                    )}
                  </div>
                )}
                {/* 2e TEMPS — pièce reçue (et payée s'il le fallait) :
                    demander les frais de déplacement seuls. Le meilleur
                    moment psychologique : la demande arrive avec la
                    bonne nouvelle « votre pièce est là ». */}
                {peutCommander && p.statut === "recue" && p.tacheRetourId && !depots?.[p.tacheRetourId] &&
                  !((p.paiementAvantCommande || p.paiementRequis) && !p.paiementRecu) && (
                  <div className="mt-2">
                    <Button onClick={() => ouvrirDemande(p, { deplacementSeul: true })} className="min-h-0 px-3 py-1.5 text-xs">
                      🚚 Demander les frais de déplacement
                    </Button>
                  </div>
                )}
                {/* ÉTAT DU DÉPÔT DE DÉPLACEMENT sur la tâche de retour */}
                {p.tacheRetourId && depots?.[p.tacheRetourId] && (() => {
                  const d = depots[p.tacheRetourId];
                  const paye = String(d.statut || "").startsWith("paye");
                  return (
                    <p className={`mt-1.5 rounded-lg px-2 py-1 text-[11px] font-bold ${paye ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                      {paye
                        ? `🚚 Frais de déplacement PAYÉS ✓${d.modePaiement ? ` (${d.modePaiement})` : ""}`
                        : `🚚 Frais de déplacement demandés — ${(Number(d.montantHT) || 0).toFixed(2)} $ HT · en attente du paiement`}
                    </p>
                  );
                })()}
                {messageDemande?.id === p.id && (
                  <p className={`mt-1 text-[11px] font-semibold ${messageDemande.ok ? "text-emerald-700" : "text-amber-700"}`}>
                    {messageDemande.ok ? "✓ " : "⚠️ "}{messageDemande.texte}
                  </p>
                )}

                {annulationPour === p.id && (
                  <div className="mt-2 rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Raison de l&apos;annulation</label>
                    <input
                      value={raisonAnnulation}
                      onChange={(e) => setRaisonAnnulation(e.target.value)}
                      placeholder="Client refuse la réparation, pièce discontinuée…"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        onClick={() => { onAnnuler(p.id, raisonAnnulation); setAnnulationPour(null); }}
                        disabled={!raisonAnnulation.trim()}
                        className="min-h-0 px-3 py-1.5 text-xs"
                      >
                        Confirmer l&apos;annulation
                      </Button>
                      <Button variant="outline" onClick={() => setAnnulationPour(null)} className="min-h-0 px-3 py-1.5 text-xs">Retour</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <BarrePagination total={affichees.length} page={pagePieces} onPage={setPagePieces} refHaut={refListePieces} libelle="pièces" />
          </div>
        </div>
      )}

      {/* FENÊTRE — DEMANDE DE PAIEMENT AU CLIENT */}
      {demandePour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (() => setDemandePour(null))(); }}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-slate-900">💰 Demande de paiement — {demandePour.clientNom}</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">{demandePour.pieceRequise}</p>

            <label className="mt-3 mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Message au client</label>
            <textarea
              value={demandeDescription}
              onChange={(e) => setDemandeDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />

            {pieceEncoreAPayer(demandePour) && (
              <>
                <label className="mt-2 mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Pièce ($ HT)</label>
                {/* InputNombreDecimal : accepte le point ET la virgule
                    (44,50) — un champ « number » du navigateur les refuse
                    selon sa langue. */}
                <InputNombreDecimal
                  valeur={Number(demandeMontant) || 0}
                  onChange={(v) => setDemandeMontant(v)}
                  className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                />
              </>
            )}

            {/* FRAIS DE DÉPLACEMENT — cochable ici (tout d'un coup) ou
                demandé plus tard, seul, à la réception (deux temps). */}
            {demandePour.tacheRetourId && !depots?.[demandePour.tacheRetourId] && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={demandeDeplacement}
                    onChange={(e) => {
                      setDemandeDeplacement(e.target.checked);
                      if (e.target.checked && !demandeMontantDeplacement) choisirZone(demandeZone);
                    }}
                  />
                  🚚 Inclure les frais de déplacement (visite d'installation)
                </label>
                {demandeDeplacement && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={demandeZone}
                      onChange={(e) => choisirZone(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      {ZONES_DEPOTS.map((z) => (
                        <option key={z} value={z}>
                          {z}{Number(prixDepots?.[z]) > 0 ? ` — ${Number(prixDepots[z]).toFixed(2)} $` : ""}
                        </option>
                      ))}
                      <option value="Hors zone">🗺️ Hors zone — montant manuel</option>
                    </select>
                    <span className="flex items-center gap-1">
                      <InputNombreDecimal
                        valeur={Number(demandeMontantDeplacement) || 0}
                        onChange={(v) => setDemandeMontantDeplacement(v)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-slate-400">$ HT</span>
                    </span>
                    <p className="w-full text-[10px] text-slate-400">
                      Crée un dépôt sur la tâche de retour (payable sous 7 jours) — elle restera bloquée tant que le déplacement n'est pas payé.
                    </p>
                  </div>
                )}
              </div>
            )}

            {(() => {
              const mp = pieceEncoreAPayer(demandePour) ? parseFloat(demandeMontant) || 0 : 0;
              const md = demandeDeplacement ? parseFloat(demandeMontantDeplacement) || 0 : 0;
              const totalHT = mp + md;
              if (totalHT <= 0) return null;
              const t = calculerTaxes(totalHT, configEnt);
              return (
                <p className="mt-2 text-[11px] text-slate-500">
                  {mp > 0 && md > 0 ? `Pièce ${mp.toFixed(2)} $ + déplacement ${md.toFixed(2)} $ · ` : ""}
                  TPS {t.tps.toFixed(2)} $ · TVQ {t.tvq.toFixed(2)} $ → <span className="font-extrabold text-slate-800">{t.total.toFixed(2)} $ toutes taxes incluses</span>
                  {" "}— c'est ce montant que le client verra.
                </p>
              );
            })()}

            <label className="mt-3 mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Envoyer à :</label>
            {/* FICHE SANS COURRIEL — le dire tout de suite, pas au clic.
                Le silence a déjà coûté une heure de test : fenêtre sans
                adresse, bouton sans effet, personne ne sait pourquoi. */}
            {(ficheClientPiece(demandePour)?.courriels || []).filter((c) => (typeof c === "string" ? c : c?.email)).length === 0 && (
              <p className="mb-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-amber-800">
                Ce client n&apos;a aucun courriel dans sa fiche. Inscris une adresse ci-dessous — et pense à
                compléter sa fiche dans l&apos;onglet Clients pour la prochaine fois.
              </p>
            )}
            {(ficheClientPiece(demandePour)?.courriels || []).map((c) => {
              const adresse = typeof c === "string" ? c : c.email;
              if (!adresse) return null;
              const coche = demandeEmails.includes(adresse);
              return (
                <label key={adresse} className="mb-1 flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() =>
                      setDemandeEmails((prev) => (coche ? prev.filter((a) => a !== adresse) : [...prev, adresse]))
                    }
                  />
                  {adresse}
                  {typeof c === "object" && c.label ? <span className="text-[10px] text-slate-400">({c.label})</span> : null}
                </label>
              );
            })}
            <input
              value={demandeExtra}
              onChange={(e) => setDemandeExtra(e.target.value)}
              placeholder="Autre adresse (optionnel)"
              className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />

            {/* POURQUOI le bouton est gris — toujours l'expliquer. */}
            {(demandeEmails.length === 0 && !demandeExtra.trim()) && (
              <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                ✋ Aucun destinataire — coche une adresse ci-dessus ou tapes-en une dans « Autre adresse ».
              </p>
            )}
            {((pieceEncoreAPayer(demandePour) ? parseFloat(demandeMontant) || 0 : 0) +
              (demandeDeplacement ? parseFloat(demandeMontantDeplacement) || 0 : 0)) <= 0 && (
              <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                ✋ Le montant est à zéro — inscris le montant à demander au client.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={envoyerDemandePaiement}
                disabled={
                  demandeEnCours ||
                  (pieceEncoreAPayer(demandePour) ? parseFloat(demandeMontant) || 0 : 0) +
                    (demandeDeplacement ? parseFloat(demandeMontantDeplacement) || 0 : 0) <=
                    0 ||
                  (demandeEmails.length === 0 && !demandeExtra.trim())
                }
                className="min-h-0 flex-1 py-2 text-xs"
              >
                {demandeEnCours ? "Envoi…" : "Envoyer la demande"}
              </Button>
              <Button variant="outline" onClick={() => setDemandePour(null)} className="min-h-0 py-2 text-xs">
                Annuler
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Quand l'argent rentre, clique « Paiement reçu ✓ » sur la carte — c'est toujours un humain qui confirme.
              (La facture officielle QuickBooks arrivera à la phase QuickBooks.)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// 🏭 RÉPERTOIRE DES FOURNISSEURS (2026-08-30)
// ------------------------------------------------------------
// Avant : on pouvait CRÉER un fournisseur (à la volée, depuis le BC
// d'un projet) mais jamais le REVOIR — impossible de corriger un
// courriel, d'ajouter une adresse ou de faire le ménage. Ici : la
// liste avec recherche, chaque fiche s'ouvre et se modifie, retrait
// en deux clics (le répertoire seulement — les BC existants gardent
// le nom du fournisseur, rien d'historique ne casse).
// ============================================================
// ============================================================
// 📦 INVENTAIRE COURANT (2026-09-04, demande du propriétaire — étage 1)
// ------------------------------------------------------------
// Nom, quantité, unité, emplacement — ajustement en un geste (+ / − /
// saisie directe), recherche, et CHAQUE mouvement au journal (« qui a
// bougé quoi », la règle maison). Repliée par défaut, comme les
// fournisseurs. Table inventaire_articles (snippet 126), cloisonnée
// par entreprise. Les automatismes (réception d'un BC → stock, stock
// utilisé → décrément, seuil minimum) viendront UN PAR UN sur demande.
// ============================================================
// ============================================================
// 📦➕ RÉCEPTION D'UN BC « STOCK » VERS L'INVENTAIRE (2026-09-04,
// étage 2 approuvé) — la boîte arrive au bureau : on tape quoi et
// combien, l'inventaire monte, le journal garde la trace avec le
// numéro du bon. Un article à la fois, autant de fois que la boîte
// contient de choses ; article inconnu = créé sur place.
// ============================================================
function ModalReceptionInventaire({ bc, onFermer, onFait, ajouterJournal, nomUtilisateur }) {
  const [articles, setArticles] = useState([]);
  const [nom, setNom] = useState("");
  const [quantite, setQuantite] = useState(0);
  const [unite, setUnite] = useState("");
  const [ajouts, setAjouts] = useState([]); // récapitulatif de la séance
  useEffect(() => {
    listerInventaire().then(setArticles).catch(() => {});
  }, []);
  const existant = articles.find((a) => a.nom.trim().toLowerCase() === nom.trim().toLowerCase());
  const ajouter = async () => {
    const q = Number(quantite) || 0;
    if (!nom.trim() || q <= 0) return;
    const a = existant
      ? { ...existant, quantite: Math.round(((Number(existant.quantite) || 0) + q) * 100) / 100 }
      : { id: `inv-${Date.now()}`, nom: nom.trim(), quantite: q, unite: unite.trim(), emplacement: "", seuilAlerte: 0 };
    try {
      await sauvegarderArticleInventaire(a);
      ajouterJournal?.(
        existant
          ? `📦 Réception ${bc.numeroBc || "BC"} — ${a.nom} : ${existant.quantite} → ${a.quantite} ${a.unite || ""} — par ${nomUtilisateur || "bureau"}`
          : `📦 Réception ${bc.numeroBc || "BC"} — nouvel article : ${a.nom} (${q} ${a.unite || ""}) — par ${nomUtilisateur || "bureau"}`
      );
      setArticles((prev) => (existant ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a]));
      setAjouts((prev) => [...prev, `${a.nom} +${q} ${a.unite || ""}`]);
      setNom(""); setQuantite(0); setUnite("");
      onFait?.();
    } catch {
      ajouterJournal?.(`⚠️ Réception ${bc.numeroBc || "BC"} : « ${nom.trim()} » NON enregistré — vérifie la connexion.`);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">📦 Réception — {bc.numeroBc || "bon de commande"}</h3>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <p className="mb-3 text-[11px] text-slate-400">La commande est arrivée : ajoute ce qu&apos;elle contient à l&apos;inventaire courant. Un article connu s&apos;additionne ; un nouveau se crée.</p>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Article</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              list="reception-articles"
              placeholder="Nom — choisis dans la liste ou tape un nouveau"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <datalist id="reception-articles">
              {articles.map((a) => <option key={a.id} value={a.nom} />)}
            </datalist>
            {existant && (
              <p className="mt-0.5 text-[10px] text-emerald-600">✓ Article connu — en stock : {existant.quantite} {existant.unite || ""}{existant.emplacement ? ` · 📍 ${existant.emplacement}` : ""}</p>
            )}
          </div>
          <div className="flex gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Quantité reçue</label>
              <InputNombreDecimal valeur={quantite} onChange={setQuantite} className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-xs tabular-nums" />
            </div>
            {!existant && (
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Unité</label>
                <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="pi, un…" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </div>
            )}
          </div>
          {ajouts.length > 0 && (
            <p className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-700">✓ Ajoutés : {ajouts.join(" · ")}</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">{ajouts.length > 0 ? "Terminé" : "Annuler"}</Button>
            <Button disabled={!nom.trim() || !(Number(quantite) > 0)} onClick={ajouter} className="min-h-0 py-2 text-xs">➕ Ajouter au stock</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionInventaire({ ajouterJournal, peutModifier, nomUtilisateur, toujoursOuvert = false }) {
  // 🗂️ Dans son onglet (2026-09-22), la section est ouverte d'office.
  const [ouvert, setOuvert] = useState(!!toujoursOuvert);
  const [articles, setArticles] = useState([]);
  const [charge, setCharge] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [nouveau, setNouveau] = useState(null); // { nom, quantite, unite, emplacement }
  useEffect(() => {
    listerInventaire().then((l) => { setArticles(l); setCharge(true); }).catch(() => setCharge(true));
  }, []);
  const persister = (a, texteJournal) => {
    setArticles((prev) => {
      const existe = prev.some((x) => x.id === a.id);
      const liste = existe ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a];
      return liste.slice().sort((x, y) => (x.nom || "").localeCompare(y.nom || "", "fr"));
    });
    sauvegarderArticleInventaire(a)
      .then(() => texteJournal && ajouterJournal?.(texteJournal))
      .catch(() => ajouterJournal?.(`⚠️ Inventaire : « ${a.nom} » affiché mais NON enregistré — vérifie la connexion.`));
  };
  const ajuster = (a, delta) => {
    const avant = Number(a.quantite) || 0;
    const apres = Math.max(0, Math.round((avant + delta) * 100) / 100);
    if (apres === avant) return;
    persister({ ...a, quantite: apres }, `📦 Inventaire — ${a.nom} : ${avant} → ${apres} ${a.unite || ""} — par ${nomUtilisateur || "bureau"}`);
  };
  const f = filtre.trim().toLowerCase();
  // 🛒 SEUIL « À COMMANDER » (2026-09-04, étage 2 approuvé) — un
  // article dont la quantité tombe AU seuil ou dessous se signale tout
  // seul : badge rouge, compte dans l'entête, filtre en un clic.
  const aCommander = (a) => (Number(a.seuilAlerte) || 0) > 0 && (Number(a.quantite) || 0) <= Number(a.seuilAlerte);
  const nbACommander = articles.filter(aCommander).length;
  const [filtreSeuil, setFiltreSeuil] = useState(false);
  const visibles = articles.filter((a) => (!f || `${a.nom} ${a.emplacement}`.toLowerCase().includes(f)) && (!filtreSeuil || aCommander(a)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <button onClick={() => !toujoursOuvert && setOuvert(!ouvert)} className={`flex w-full items-center justify-between text-left ${toujoursOuvert ? "cursor-default" : ""}`}>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            📦 Inventaire courant <span className="text-slate-400">({articles.length})</span>
            {nbACommander > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-red-700">
                🛒 {nbACommander} à commander
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Ce qui dort à l&apos;atelier — quantités ajustables, chaque mouvement au journal</p>
        </div>
        {!toujoursOuvert && <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${ouvert ? "rotate-180" : ""}`} />}
      </button>
      {ouvert && (
        <div className="mt-2 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Filtrer — nom ou emplacement…"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            {nbACommander > 0 && (
              <button
                onClick={() => setFiltreSeuil((v) => !v)}
                className={`shrink-0 rounded-lg border px-2 py-1.5 text-[11px] font-bold active:scale-95 ${filtreSeuil ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300 text-slate-600"}`}
              >
                🛒 À commander ({nbACommander})
              </button>
            )}
            {peutModifier && !nouveau && (
              <Button variant="outline" onClick={() => setNouveau({ nom: "", quantite: "", unite: "", emplacement: "", seuilAlerte: "" })} className="min-h-0 shrink-0 py-1.5 text-xs">
                ➕ Article
              </Button>
            )}
          </div>
          {nouveau && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-slate-300 p-2">
              <input value={nouveau.nom} onChange={(e) => setNouveau((p) => ({ ...p, nom: e.target.value }))} placeholder="Nom de l'article *" className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              <InputNombreDecimal valeur={nouveau.quantite === "" ? 0 : Number(nouveau.quantite)} onChange={(v) => setNouveau((p) => ({ ...p, quantite: v }))} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-xs tabular-nums" />
              <input value={nouveau.unite} onChange={(e) => setNouveau((p) => ({ ...p, unite: e.target.value }))} placeholder="unité (pi, un…)" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              <input value={nouveau.emplacement} onChange={(e) => setNouveau((p) => ({ ...p, emplacement: e.target.value }))} placeholder="emplacement (étagère B…)" className="min-w-[130px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              <label className="flex items-center gap-1 text-[10px] text-slate-400" title="Alerte « à commander » quand la quantité tombe à ce seuil ou dessous — vide = pas d'alerte">
                🛒 seuil
                <InputNombreDecimal valeur={nouveau.seuilAlerte === "" ? 0 : Number(nouveau.seuilAlerte)} onChange={(v) => setNouveau((p) => ({ ...p, seuilAlerte: v }))} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-xs tabular-nums" />
              </label>
              <Button
                disabled={!nouveau.nom.trim()}
                onClick={() => {
                  const a = { id: `inv-${Date.now()}`, nom: nouveau.nom.trim(), quantite: Number(nouveau.quantite) || 0, unite: nouveau.unite.trim(), emplacement: nouveau.emplacement.trim(), seuilAlerte: Number(nouveau.seuilAlerte) || 0 };
                  persister(a, `📦 Inventaire — article ajouté : ${a.nom} (${a.quantite} ${a.unite || ""}) — par ${nomUtilisateur || "bureau"}`);
                  setNouveau(null);
                }}
                className="min-h-0 shrink-0 py-1.5 text-xs"
              >
                Ajouter
              </Button>
              <Button variant="outline" onClick={() => setNouveau(null)} className="min-h-0 shrink-0 py-1.5 text-xs">Annuler</Button>
            </div>
          )}
          {visibles.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 font-semibold text-slate-800">
                {a.nom}
                {a.emplacement && <span className="ml-1.5 font-normal text-slate-400">📍 {a.emplacement}</span>}
                {aCommander(a) && (
                  <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700" title={`Quantité (${a.quantite}) au seuil (${a.seuilAlerte}) ou dessous`}>
                    🛒 à commander
                  </span>
                )}
              </span>
              {peutModifier && (
                <button onClick={() => ajuster(a, -1)} className="h-7 w-7 rounded-lg border border-slate-300 font-bold text-slate-600 active:scale-95">−</button>
              )}
              <InputNombreDecimal
                valeur={a.quantite}
                onChange={(v) => {
                  if (!peutModifier) return;
                  const apres = Math.max(0, Number(v) || 0);
                  persister({ ...a, quantite: apres }, `📦 Inventaire — ${a.nom} : ${a.quantite} → ${apres} ${a.unite || ""} — par ${nomUtilisateur || "bureau"}`);
                }}
                disabled={!peutModifier}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-bold tabular-nums"
              />
              {peutModifier && (
                <button onClick={() => ajuster(a, 1)} className="h-7 w-7 rounded-lg border border-slate-300 font-bold text-slate-600 active:scale-95">+</button>
              )}
              <span className="w-12 text-[10px] text-slate-400">{a.unite || ""}</span>
              {peutModifier && (
                <label className="flex items-center gap-0.5 text-[10px] text-slate-400" title="Seuil « à commander » — vide ou 0 = pas d'alerte">
                  🛒
                  <InputNombreDecimal
                    valeur={a.seuilAlerte || 0}
                    onChange={(v) => {
                      const seuil = Math.max(0, Number(v) || 0);
                      if (seuil === (a.seuilAlerte || 0)) return;
                      persister({ ...a, seuilAlerte: seuil }, `📦 Inventaire — ${a.nom} : seuil « à commander » ${a.seuilAlerte || 0} → ${seuil} — par ${nomUtilisateur || "bureau"}`);
                    }}
                    className="w-14 rounded-lg border border-slate-200 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-500"
                  />
                </label>
              )}
              {peutModifier && (
                <button
                  onClick={() => {
                    setArticles((prev) => prev.filter((x) => x.id !== a.id));
                    supprimerArticleInventaire(a.id)
                      .then(() => ajouterJournal?.(`📦 Inventaire — article retiré : ${a.nom} — par ${nomUtilisateur || "bureau"}`))
                      .catch(() => ajouterJournal?.(`⚠️ Inventaire : retrait de « ${a.nom} » NON enregistré — il reviendra au rechargement.`));
                  }}
                  title="Retirer cet article de l'inventaire"
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {charge && visibles.length === 0 && (
            <p className="py-2 text-center text-[11px] text-slate-400">
              {articles.length === 0 ? "Inventaire vide — ajoute ton premier article avec « ➕ Article »." : "Aucun article ne correspond au filtre."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionFournisseurs({ fournisseurs, setFournisseurs, ajouterJournal, peutModifier, toujoursOuvert = false }) {
  const [ouvert, setOuvert] = useState(!!toujoursOuvert);
  const [recherche, setRecherche] = useState("");
  const [ficheOuverte, setFicheOuverte] = useState(null); // null | {} (nouveau) | fournisseur

  const resultats = (fournisseurs || [])
    .filter((f) => {
      const q = recherche.trim().toLowerCase();
      if (!q) return true;
      return `${f.nom} ${(f.courriels || []).map((c) => c.email).join(" ")} ${f.telephone}`.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

  const sauvegarder = async (f) => {
    setFournisseurs((prev) => {
      const existe = prev.some((x) => x.id === f.id);
      return (existe ? prev.map((x) => (x.id === f.id ? f : x)) : [...prev, f]).slice();
    });
    try {
      await sauvegarderFournisseur(f);
      ajouterJournal?.(`🏭 Fournisseur « ${f.nom} » enregistré (${(f.courriels || []).length} courriel${(f.courriels || []).length > 1 ? "s" : ""})`);
    } catch {
      ajouterJournal?.(`⚠️ Fournisseur « ${f.nom} » modifié à l'écran mais NON enregistré — réessaie.`);
    }
  };

  const retirer = async (f) => {
    setFournisseurs((prev) => prev.filter((x) => x.id !== f.id));
    try {
      await supprimerFournisseur(f.id);
      ajouterJournal?.(`🗑️ Fournisseur « ${f.nom} » retiré du répertoire — les bons de commande existants gardent son nom.`);
    } catch {
      ajouterJournal?.(`⚠️ Retrait de « ${f.nom} » non enregistré — il reviendra au rechargement.`);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <button onClick={() => !toujoursOuvert && setOuvert(!ouvert)} className={`flex w-full items-center justify-between text-left ${toujoursOuvert ? "cursor-default" : ""}`}>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            🏭 Fournisseurs <span className="text-slate-400">({(fournisseurs || []).length})</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Le répertoire des bons de commande — courriels, téléphone, notes
          </p>
        </div>
        {!toujoursOuvert && (ouvert ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />)}
      </button>

      {ouvert && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[180px] flex-1 items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un fournisseur…"
                className="w-full text-xs outline-none"
              />
              {recherche && (
                <button onClick={() => setRecherche("")} aria-label="Effacer">
                  <X size={12} className="text-slate-400" />
                </button>
              )}
            </div>
            {peutModifier && (
              <Button onClick={() => setFicheOuverte({})} className="min-h-0 px-3 py-1.5 text-xs">
                <Plus size={13} /> Nouveau fournisseur
              </Button>
            )}
          </div>

          <div className="mt-2 max-h-[320px] overflow-y-auto rounded-xl border border-slate-200">
            {resultats.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-slate-400">
                {(fournisseurs || []).length === 0
                  ? "Aucun fournisseur au répertoire — clique « Nouveau fournisseur »."
                  : "Aucun fournisseur ne correspond."}
              </p>
            ) : (
              resultats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => peutModifier && setFicheOuverte(f)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-2 text-left last:border-0 ${peutModifier ? "hover:bg-slate-50" : "cursor-default"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{f.nom}</p>
                    <p className="truncate text-[10px] text-slate-400">
                      {(f.courriels || []).length > 0
                        ? (f.courriels || []).map((c) => c.email).join(" · ")
                        : "aucun courriel — l'envoi de BC ne sera pas offert"}
                      {f.telephone ? ` · ${f.telephone}` : ""}
                    </p>
                  </div>
                  {peutModifier && <Pencil size={13} className="shrink-0 text-slate-300" />}
                </button>
              ))
            )}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-400">
            Ces fiches alimentent le choix de fournisseur des BC de projet, des BC libres, des pièces et des commandes
            de camion — le courriel coché « défaut » est proposé en premier à l'envoi.
          </p>
        </div>
      )}

      {ficheOuverte !== null && (
        <FicheFournisseur
          fournisseur={ficheOuverte.id ? ficheOuverte : null}
          onFermer={() => setFicheOuverte(null)}
          onSauvegarder={sauvegarder}
          onRetirer={retirer}
        />
      )}
    </div>
  );
}

// La fiche d'UN fournisseur — création et modification dans la même
// fenêtre. Les courriels sont une vraie liste : étiquette + adresse +
// bouton « défaut » (celui proposé coché à l'envoi des BC).
function FicheFournisseur({ fournisseur, onFermer, onSauvegarder, onRetirer }) {
  const [f, setF] = useState(() => ({
    id: fournisseur?.id || `f-${Date.now()}`,
    nom: fournisseur?.nom || "",
    courriels: (fournisseur?.courriels || []).map((c) => ({ ...c })),
    telephone: fournisseur?.telephone || "",
    adresse: fournisseur?.adresse || "",
    notes: fournisseur?.notes || "",
  }));
  const [erreur, setErreur] = useState("");
  const [suppression, setSuppression] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  const majCourriel = (id, champs) =>
    setF((p) => ({ ...p, courriels: p.courriels.map((c) => (c.id === id ? { ...c, ...champs } : c)) }));
  const poserDefaut = (id) =>
    setF((p) => ({ ...p, courriels: p.courriels.map((c) => ({ ...c, defaut: c.id === id })) }));
  const retirerCourriel = (id) =>
    setF((p) => {
      const restants = p.courriels.filter((c) => c.id !== id);
      // Toujours UN défaut tant qu'il reste une adresse.
      if (restants.length > 0 && !restants.some((c) => c.defaut)) restants[0] = { ...restants[0], defaut: true };
      return { ...p, courriels: restants };
    });
  const ajouterCourriel = () =>
    setF((p) => ({
      ...p,
      courriels: [
        ...p.courriels,
        { id: `fc-${Date.now()}`, label: p.courriels.length === 0 ? "Principal" : "Autre", email: "", defaut: p.courriels.length === 0 },
      ],
    }));

  const enregistrer = async () => {
    const nom = f.nom.trim();
    if (!nom) {
      setErreur("Le nom est obligatoire.");
      return;
    }
    const courriels = f.courriels
      .map((c) => ({ ...c, email: c.email.trim(), label: (c.label || "").trim() }))
      .filter((c) => c.email);
    const invalides = courriels.filter((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));
    if (invalides.length > 0) {
      setErreur(`Adresse invalide : ${invalides.map((c) => c.email).join(", ")}`);
      return;
    }
    if (courriels.length > 0 && !courriels.some((c) => c.defaut)) courriels[0].defaut = true;
    setErreur("");
    setEnregistrement(true);
    await onSauvegarder({ ...f, nom, courriels, telephone: f.telephone.trim(), adresse: f.adresse.trim(), notes: f.notes.trim() });
    setEnregistrement(false);
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900">
            {fournisseur ? `🏭 ${fournisseur.nom}` : "🏭 Nouveau fournisseur"}
          </h3>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nom *</label>
            <input value={f.nom} onChange={(e) => setF((p) => ({ ...p, nom: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Courriels — le « défaut » est proposé coché à l&apos;envoi des BC</label>
            <div className="space-y-1.5">
              {f.courriels.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  <input
                    value={c.email}
                    onChange={(e) => majCourriel(c.id, { email: e.target.value })}
                    placeholder="achats@fournisseur.com"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={c.label || ""}
                    onChange={(e) => majCourriel(c.id, { label: e.target.value })}
                    placeholder="Étiquette"
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => poserDefaut(c.id)}
                    title={c.defaut ? "Adresse par défaut" : "En faire l'adresse par défaut"}
                    className={`shrink-0 rounded-lg border px-1.5 py-1 text-[10px] font-bold ${c.defaut ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-300 hover:text-slate-500"}`}
                  >
                    ✓ défaut
                  </button>
                  <button onClick={() => retirerCourriel(c.id)} aria-label="Retirer ce courriel" className="shrink-0 text-slate-300 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button onClick={ajouterCourriel} className="text-[11px] font-bold text-slate-500 underline">
                ➕ Ajouter un courriel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Téléphone</label>
              <input value={f.telephone} onChange={(e) => setF((p) => ({ ...p, telephone: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse</label>
              {/* 📍 AUTOCOMPLÉTION GOOGLE (2026-09-21, demande du propriétaire) —
                  la même que partout : une adresse propre fait un vrai lien
                  « Y aller » sur le téléphone du commissionnaire. */}
              {f.adresse ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2">
                  <span className="min-w-0 truncate text-sm text-slate-800">📍 {f.adresse}</span>
                  <button type="button" onClick={() => setF((p) => ({ ...p, adresse: "" }))} className="shrink-0 text-[10px] font-bold text-slate-400 underline underline-offset-2">changer</button>
                </div>
              ) : (
                <AutocompleteAdresse onSelection={(place) => setF((p) => ({ ...p, adresse: place.label }))} />
              )}
            </div>
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Notes (interne — jamais envoyé)</label>
            <textarea rows={2} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Ex : représentant Marc 514-555-0000, rabais 12 % sur conduits…"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
          </div>
        </div>

        {erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">{erreur}</p>}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" onClick={onFermer} className="min-h-0 py-2 text-xs">Annuler</Button>
          <Button onClick={enregistrer} loading={enregistrement} className="min-h-0 flex-1 py-2 text-xs">Enregistrer</Button>
        </div>
        {fournisseur && (
          <div className="mt-2 text-right">
            {suppression ? (
              <span className="text-[11px] font-semibold text-slate-500">
                Retirer « {fournisseur.nom} » du répertoire ?
                <button onClick={() => { onRetirer(fournisseur); onFermer(); }} className="ml-1.5 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-extrabold text-white">
                  Oui, retirer
                </button>
                <button onClick={() => setSuppression(false)} className="ml-1.5 text-[10px] underline">Non</button>
              </span>
            ) : (
              <button onClick={() => setSuppression(true)} className="text-[10px] font-semibold text-slate-400 underline hover:text-red-500">
                🗑️ Retirer du répertoire (les BC existants gardent son nom)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
