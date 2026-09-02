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
import { creerFactureQbo } from "@/lib/quickbooksClient";
import { STATUTS_PIECE, genererNumeroSecours, ITEMS_PAR_PAGE, BarrePagination, SelecteurCibleAchat, Button, todayISO } from "./partage";

export function OngletPieces({ pieces, peutCommander, onMaj, onRecue, onAnnuler, fournisseurs, setFournisseurs, ajouterJournal, nomUtilisateur, clients, depots, prixDepots, onCreerDepot, commandesCamion, onCommandePassee, achatsLibres, onCreerBcLibre, onMajBcLibre, onSupprimerBcLibre, onDemenagerBcVersProjet, projets, tachesPourAchat = [], transactionsQb = [] }) {
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
  const [bcLibre, setBcLibre] = useState({ fournisseurNom: "", description: "", montantHT: 0, projetId: "", tacheId: "", clientId: "", montantAttribue: "", livraisonEstimee: "", courrielFournisseur: "", enregistrerFournisseur: true });
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
  const [envoiBcAjout, setEnvoiBcAjout] = useState(""); // ➕ adresse différente
  const ficheFournisseurParNom = (nom) =>
    (fournisseurs || []).find((f) => (f.nom || "").trim().toLowerCase() === String(nom || "").trim().toLowerCase()) || null;
  const envoyerBcLibre = async () => {
    if (!offreEnvoiBc || offreEnvoiBc.coches.length === 0) return;
    setEnvoiBcLibreEnCours(true);
    const r = await envoyerCourriel({
      a: offreEnvoiBc.coches,
      sujet: `Bon de commande ${offreEnvoiBc.numero} — ${configEnt.nomLegal}`,
      html: gabaritBcSimple({ config: configEnt, numeroBc: offreEnvoiBc.numero, description: offreEnvoiBc.description }),
      // La réponse du fournisseur revient à celui qui a commandé.
      copieExpediteur: true,
      // 📧 Copie permanente des BC (réglage d'entreprise, ex. commande@).
      copieA: configEnt.courrielCopieBc ? [configEnt.courrielCopieBc] : [],
    });
    setEnvoiBcLibreEnCours(false);
    if (r.envoye) {
      setBcLibreMsg(`✓ ${offreEnvoiBc.numero} envoyé à ${offreEnvoiBc.fournisseur} (${offreEnvoiBc.coches.join(", ")})`);
      ajouterJournal?.(`📧 BC libre ${offreEnvoiBc.numero} envoyé à ${offreEnvoiBc.fournisseur} (${offreEnvoiBc.coches.join(", ")})`);
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
  const envoyerBcParApplication = async (p) => {
    const adresses = courrielsFournisseur(p);
    if (adresses.length === 0) return;
    setEnvoiBcEnCours(p.id);
    const r = await envoyerCourriel({
      a: adresses,
      sujet: `Bon de commande ${p.numeroBc || ""} — ${configEnt.nomLegal}`,
      html: gabaritBonCommande({ config: configEnt, piece: p }),
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
  const [formBc, setFormBc] = useState({ fournisseurNom: "", numeroBc: "", datePrevue: "", livraisonFixe: false });

  const ouvertes = (pieces || []).filter((p) => p.statut !== "recue" && p.statut !== "annulee");
  const affichees =
    filtre === "ouvertes" ? ouvertes : filtre === "toutes" ? pieces || [] : (pieces || []).filter((p) => p.statut === filtre);

  return (
    <div className="mx-auto max-w-4xl space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Pièces en commande</h2>
          <p className="text-xs text-slate-400">
            {ouvertes.length} pièce{ouvertes.length > 1 ? "s" : ""} en attente · la tâche de retour se débloque à la réception
          </p>
        </div>
        {!peutCommander && (
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
            <Lock size={12} /> Consultation seulement — pour tes suivis clients
          </span>
        )}
      </div>

      {/* 🧰 COMMANDES DE MATÉRIEL CAMION — le technicien demande, la
          personne des achats commande et clique « Commande passée »
          (+ note facultative, visible sur son téléphone). Boucle courte
          voulue : pas d'étape « reçue ». */}
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

      {/* 🏭 RÉPERTOIRE DES FOURNISSEURS (2026-08-30, demande du
          propriétaire) — LE endroit pour gérer les fournisseurs et leurs
          courriels : le même répertoire sert aux BC de projet, aux BC
          libres, aux pièces et aux commandes de camion. */}
      <SectionFournisseurs
        fournisseurs={fournisseurs}
        setFournisseurs={setFournisseurs}
        ajouterJournal={ajouterJournal}
        peutModifier={peutCommander}
      />

      {/* ➕ BON DE COMMANDE LIBRE — « 4 rouleaux de tape » : pas de tâche,
          pas de pièce client. Attribué à un PROJET = entre dans ses coûts
          matériaux (mécanisme existant) ; sinon achat général. */}
      {peutCommander && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🧾 Bon de commande libre</p>
            {!bcLibreOuvert && (
              <Button variant="outline" onClick={() => { setBcLibreOuvert(true); setBcLibreMsg(""); }} className="min-h-0 px-3 py-1.5 text-xs">
                ➕ Nouveau BC (sans tâche)
              </Button>
            )}
          </div>
          {bcLibreMsg && <p className="mt-1 text-[11px] font-semibold text-emerald-700">{bcLibreMsg}</p>}
          {/* 📧 Envoi du BC libre au fournisseur — offert quand la fiche
              du répertoire a des courriels ; coche, envoie, terminé. */}
          {offreEnvoiBc && (
            <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-2.5">
              <p className="text-[11px] font-bold text-blue-800">
                📧 Envoyer le {offreEnvoiBc.numero} à {offreEnvoiBc.fournisseur} ?
              </p>
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
                  <p className="text-[10px] text-slate-500">Ce fournisseur n&apos;a aucun courriel au répertoire — ajoute une adresse ci-dessous.</p>
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
                  Objet : Bon de commande {offreEnvoiBc.numero} — {configEnt.nomLegal}
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
              <div className="mt-2 flex gap-1.5">
                <Button
                  loading={envoiBcLibreEnCours}
                  disabled={offreEnvoiBc.coches.length === 0}
                  onClick={envoyerBcLibre}
                  className="min-h-0 flex-1 py-1.5 text-xs"
                >
                  📧 Envoyer le bon de commande
                </Button>
                <Button variant="outline" onClick={() => setOffreEnvoiBc(null)} className="min-h-0 py-1.5 text-xs">
                  Pas maintenant
                </Button>
              </div>
            </div>
          )}
          {bcLibreOuvert && (
            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-2.5">
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
                  Livraison souhaitée
                  <input
                    type="date"
                    value={bcLibre.livraisonEstimee}
                    onChange={(e) => setBcLibre((f) => ({ ...f, livraisonEstimee: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                </span>
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
              <p className="text-[9px] leading-snug text-slate-400">
                <span className="font-bold">Montant HT</span> = le total de la facture du fournisseur, avant taxes
                (les taxes sont récupérables, jamais un coût). Une estimation suffit : la facture QuickBooks portant
                ce nº de BC posera le montant réel.
              </p>
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
                  disabled={!(bcLibre.description || "").trim() || !(Number(bcLibre.montantHT) > 0 || Number(bcLibre.montantAttribue) > 0)}
                  onClick={async () => {
                    setBcLibreEnCours(true);
                    // 📦 La livraison souhaitée voyage DANS la description :
                    // elle suit le bon partout (liste, journal, courriel)
                    // sans nouvelle colonne.
                    const livraison = bcLibre.livraisonEstimee
                      ? `\n📦 Livraison souhaitée : ${new Date(`${bcLibre.livraisonEstimee}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
                      : "";
                    const descriptionFinale = `${(bcLibre.description || "").trim()}${livraison}`;
                    // 🤝 Montant HT laissé à 0 mais part attribuée tapée :
                    // la part DEVIENT le montant de l'achat (voir l'aide du
                    // champ) — plus jamais de part « ramenée à 0 ».
                    const partTapee = Number(bcLibre.montantAttribue) || 0;
                    const montantEffectif = (Number(bcLibre.montantHT) || 0) <= 0 && partTapee > 0 ? partTapee : bcLibre.montantHT;
                    const numero = await onCreerBcLibre?.({ ...bcLibre, montantHT: montantEffectif, description: descriptionFinale });
                    setBcLibreEnCours(false);
                    setBcLibreMsg("✓ " + numero + " créé" + (bcLibre.tacheId ? " et rattaché à la tâche." : bcLibre.clientId ? " et rattaché au client." : bcLibre.projetId ? " et attribué au projet." : " (achat général)."));
                    // 📧 Le fournisseur est au répertoire avec des
                    // courriels ? On offre l'envoi direct du bon.
                    const fiche = ficheFournisseurParNom(bcLibre.fournisseurNom);
                    const courrielTape = bcLibre.courrielFournisseur.trim();
                    const courrielTapeValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courrielTape);
                    if (fiche && (fiche.courriels || []).length > 0) {
                      setOffreEnvoiBc({
                        numero,
                        fournisseur: fiche.nom,
                        description: descriptionFinale,
                        courriels: fiche.courriels,
                        coches: (fiche.courriels || []).filter((c) => c.defaut).map((c) => c.email),
                      });
                    } else if (!fiche && courrielTapeValide) {
                      // 🏭 FOURNISSEUR HORS RÉPERTOIRE avec courriel tapé :
                      // l'envoi s'offre pareil — et la fiche s'enregistre
                      // au répertoire (si coché) pour la prochaine fois.
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
                        numero,
                        fournisseur: nomF || "fournisseur",
                        description: descriptionFinale,
                        courriels: [{ id: "libre", label: "Commande", email: courrielTape, defaut: true }],
                        coches: [courrielTape],
                      });
                    }
                    setBcLibre({ fournisseurNom: "", description: "", montantHT: 0, projetId: "", tacheId: "", clientId: "", montantAttribue: "", livraisonEstimee: "", courrielFournisseur: "", enregistrerFournisseur: true });
                    setBcLibreOuvert(false);
                  }}
                  className="min-h-0 flex-1 py-1.5 text-xs"
                >
                  Créer le bon de commande
                </Button>
                <Button variant="outline" onClick={() => setBcLibreOuvert(false)} className="min-h-0 py-1.5 text-xs">Annuler</Button>
              </div>
            </div>
          )}
          {(achatsLibres || []).length > 0 && (
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
                    {ecartQbPourBc(a2) && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Le montant réel de QuickBooks diffère du montant saisi — ouvre la fiche pour valider">⚠️ écart QB {ecartQbPourBc(a2).ecart > 0 ? "+" : ""}{ecartQbPourBc(a2).ecart.toFixed(2)} $</span>
                    )}
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
                        description: a2.description || "",
                        courriels: fiche?.courriels || [],
                        coches: (fiche?.courriels || []).filter((c) => c.defaut).map((c) => c.email),
                      });
                    }}
                    title="Renvoyer ce bon de commande par courriel"
                    className="shrink-0 rounded-lg border border-slate-200 px-1.5 py-1 text-[10px] font-bold text-slate-500 hover:border-blue-300 hover:text-blue-700"
                  >
                    📧
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
                      description: bcEdit.description.trim(),
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
                                  onChange={() => setFormBc({ ...formBc, livraisonFixe: false })}
                                  className="mt-0.5"
                                />
                                <span><span className="font-bold">Souple</span> — livrer au plus tard cette date, avant si possible</span>
                              </label>
                              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-600">
                                <input
                                  type="radio"
                                  name={`mode-livraison-${p.id}`}
                                  checked={formBc.livraisonFixe}
                                  onChange={() => setFormBc({ ...formBc, livraisonFixe: true })}
                                  className="mt-0.5"
                                />
                                <span><span className="font-bold">Date fixe</span> — livrer ce jour exactement : quelqu&apos;un sera présent à l&apos;entrepôt pour recevoir</span>
                              </label>
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
function SectionFournisseurs({ fournisseurs, setFournisseurs, ajouterJournal, peutModifier }) {
  const [ouvert, setOuvert] = useState(false);
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
      <button onClick={() => setOuvert(!ouvert)} className="flex w-full items-center justify-between text-left">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            🏭 Fournisseurs <span className="text-slate-400">({(fournisseurs || []).length})</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Le répertoire des bons de commande — courriels, téléphone, notes
          </p>
        </div>
        {ouvert ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
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
              <input value={f.adresse} onChange={(e) => setF((p) => ({ ...p, adresse: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
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
