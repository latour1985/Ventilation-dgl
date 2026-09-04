// app/api/quickbooks/facture-depot/route.js
//
// FACTURE DE DÉPÔT QUICKBOOKS — la première ÉCRITURE vers QuickBooks
// (tout le reste est en lecture seule). Sandbox tant que la bascule
// production n'est pas faite.
//
// À la création d'un appel de service avec dépôt :
//   1. retrouve (ou crée) le CLIENT dans QuickBooks — l'id est mémorisé
//      sur la fiche client de l'app pour les fois suivantes ;
//   2. crée la FACTURE de dépôt (échéance = date limite du dépôt) ;
//   3. retourne son numéro — le courriel au client part ensuite de
//      l'application (gabarit maison, via Resend).
//
// RÈGLE GELÉE DU PROPRIÉTAIRE : une facture de dépôt s'annule par
// VOID, JAMAIS par Delete — la séquence comptable reste pleine.
// (action: "void" ci-dessous — relance de dépôt et délai dépassé.)
//
// NOTE SANDBOX : l'entreprise de test d'Intuit est américaine — les
// taxes TPS/TVQ n'y existent pas, la facture Sandbox porte le montant
// HT. À la bascule sur le VRAI QuickBooks (canadien), les codes de
// taxes du fichier réel prendront le relais. Le courriel au client,
// lui, affiche déjà les taxes québécoises exactes (calcul maison).

import {
  clientSupabaseService,
  configQuickbooksPresente,
  jetonAccesValide,
  requeteQbo,
  utilisateurDepuisJeton,
  ecrireQbo,
  echapperQbo,
  clientQboPour,
  articleServiceQboPour,
  codeTaxeVente,
  proprietesTaxe,
  envoyerFactureParQb,
  environnementQb, entrepriseDuCompte } from "@/lib/quickbooksServeur";
// 🔒 RLS phase 3 : le rôle vient de la table des permissions.
import { roleServeur } from "@/lib/quickbooksServeur";
// (Les helpers d'écriture vivent dans quickbooksServeur.js — partagés
// avec les routes facture, estimate et clients-sync.)

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // 🏢 Chaque route sert l'entreprise DU DEMANDEUR — et aucune autre.
  const entrepriseId = entrepriseDuCompte(utilisateur);
  // Les techniciens n'émettent pas de factures — tous les rôles de
  // bureau (admins, répartiteur...) le peuvent : ce sont eux qui créent
  // les appels de service.
  if ((await roleServeur(utilisateur)) === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }

  let acces;
  try {
    acces = await jetonAccesValide(entrepriseId);
  } catch (e) {
    return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  // ---------- ANNULATION PAR VOID (jamais Delete — règle gelée) ----------
  if (corps?.action === "void") {
    const factureId = String(corps?.factureId || "").trim();
    if (!factureId) return Response.json({ erreur: "factureId requis." }, { status: 400 });
    try {
      const lu = await requeteQbo(acces, `select Id, SyncToken from Invoice where Id = '${echapperQbo(factureId)}' maxresults 1`);
      const facture = lu?.Invoice?.[0];
      if (!facture) return Response.json({ annulee: true, note: "Facture introuvable — probablement déjà annulée." });
      await ecrireQbo(acces, "invoice?operation=void", { Id: facture.Id, SyncToken: facture.SyncToken });
      return Response.json({ annulee: true });
    } catch (e) {
      return Response.json({ erreur: `VOID refusé : ${e?.message || "erreur"}` }, { status: 502 });
    }
  }

  // ---------- CRÉATION DE LA FACTURE DE DÉPÔT ----------
  const clientNom = String(corps?.clientNom || "").trim();
  const montantHT = Number(corps?.montantHT) || 0;
  if (!clientNom || montantHT <= 0) {
    return Response.json({ erreur: "Client et montant requis." }, { status: 400 });
  }
  // 1000 et non 300 (2026-08-25) : la ligne porte maintenant l'objet de
  // la visite (titre + description des travaux) — « pourquoi on vient »,
  // pas seulement « vous payez un dépôt ». QuickBooks accepte 4000.
  const description = String(corps?.description || `Dépôt — appel de service${corps?.zone ? ` (${corps.zone})` : ""}`).slice(0, 1000);
  const joursLimite = Math.max(1, Number(corps?.joursLimite) || 1);

  try {
    const admin = clientSupabaseService();
    const [customerId, itemId, entreprise, codeTaxe] = await Promise.all([
      clientQboPour(acces, admin, { clientId: corps?.clientId || null, clientNom }),
      articleServiceQboPour(acces),
      // Scopé à L'ENTREPRISE DU DEMANDEUR (multi-QuickBooks 2026-09-08).
      admin.from("entreprises").select("paiement_carte_appels, paiement_virement_appels, seuil_carte_appels, note_facture").eq("id", entrepriseId).maybeSingle(),
      // 🍁 Code de taxe du fichier — OBLIGATOIRE au Canada (2026-09-09) :
      // sans lui, le fichier réel REFUSE la facture de dépôt et la
      // création de tâche avec dépôt échoue. Null sur un fichier US.
      codeTaxeVente(acces),
    ]);
    if (!customerId) return Response.json({ erreur: "Client QuickBooks introuvable et non créable." }, { status: 502 });
    if (!itemId) return Response.json({ erreur: "Aucun article de type Service dans ce fichier QuickBooks." }, { status: 502 });

    // ---------- PAIEMENT EN LIGNE (chemin AUTOMATIQUE des appels) ----------
    // Les interrupteurs vivent dans Paramètres (Admin principal). La
    // carte s'éteint TOUTE SEULE au-dessus du seuil : 2,9 % sur un gros
    // montant, c'est un coût de marchand déraisonnable — et au Québec il
    // ne se refile JAMAIS au client (LPC), donc on le gère à la source.
    const reglages = entreprise?.data || {};
    const seuilCarte = reglages.seuil_carte_appels != null ? Number(reglages.seuil_carte_appels) : 2000;
    // 💳 CHOIX EXPLICITE DE LA FENÊTRE (2026-08-30) : l'admin voit et
    // ajuste carte/virement au moment d'envoyer — son choix l'emporte
    // sur la règle automatique (Paramètres + seuil), pour CETTE facture
    // seulement. Absent (anciens appels) : la règle automatique, comme
    // avant.
    const carteAuto = reglages.paiement_carte_appels === true && montantHT <= seuilCarte;
    const virementAuto = reglages.paiement_virement_appels === true;
    const carteOfferte = typeof corps?.paiementCarte === "boolean" ? corps.paiementCarte : carteAuto;
    const virementOffert = typeof corps?.paiementVirement === "boolean" ? corps.paiementVirement : virementAuto;

    // 📧 ADRESSE DE LA FACTURE : les courriels choisis d'abord ; SINON
    // (2026-09-04, vécu Luis Gonzalez — « l'adresse est dans la fiche
    // QuickBooks mais pas sur la facture ») le courriel de la fiche
    // client QuickBooks fait le repli : la facture porte toujours une
    // adresse, et un envoi manuel depuis QuickBooks fonctionne. Le
    // repli n'envoie RIEN tout seul — il remplit le champ.
    const envoyerAValides = (Array.isArray(corps?.envoyerA) ? corps.envoyerA : [])
      .map((e) => String(e || "").trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .slice(0, 5);
    let adresseFacture = envoyerAValides.join(", ");
    if (!adresseFacture) {
      try {
        // « select * » obligatoire : la production QuickBooks refuse les
        // champs imbriqués nommés (même leçon que la descente clients).
        const luClient = await requeteQbo(acces, `select * from Customer where Id = '${String(customerId).replace(/'/g, "")}'`);
        adresseFacture = String(luClient?.Customer?.[0]?.PrimaryEmailAddr?.Address || "").trim();
      } catch {
        // fiche illisible — la facture partira sans adresse, comme avant
      }
    }
    const echeance = new Date(Date.now() + joursLimite * 24 * 60 * 60 * 1000);
    const dateLocale = `${echeance.getFullYear()}-${String(echeance.getMonth() + 1).padStart(2, "0")}-${String(echeance.getDate()).padStart(2, "0")}`;
    // `include=invoiceLink` : QuickBooks retourne le lien « voir et
    // payer » quand QuickBooks Payments est actif sur le compte — c'est
    // ce lien que notre courriel offre au client comme bouton.
    const cree = await ecrireQbo(acces, "invoice?include=invoiceLink", {
      CustomerRef: { value: customerId },
      DueDate: dateLocale,
      // 🍁 Le dépôt est HORS TAXES — QuickBooks ajoute TPS/TVQ dessus,
      // comme le courriel au client l'annonce déjà.
      ...proprietesTaxe(codeTaxe),
      // ENVOI PAR QUICKBOOKS (2026-08-17) : les courriels choisis et
      // notre message de réservation voyagent SUR la facture — le
      // client reçoit la facture officielle avec notre contexte dedans.
      ...(adresseFacture ? { BillEmail: { Address: adresseFacture } } : {}),
      // 💳 Les MODALITÉS DE PAIEMENT de l'entreprise (Paramètres) sont
      // ajoutées au message — sur CHAQUE facture de dépôt (2026-08-17).
      ...((() => {
        const memo = [String(corps?.messageClient || "").trim(), String(reglages.note_facture || "").trim()]
          .filter(Boolean)
          .join("\n\n");
        return memo ? { CustomerMemo: { value: memo.slice(0, 900) } } : {};
      })()),
      PrivateNote: `Dépôt d'appel de service — tâche ${corps?.tacheId || "?"} — créé par l'application Fluxya`,
      AllowOnlineCreditCardPayment: carteOfferte,
      AllowOnlineACHPayment: virementOffert,
      Line: [
        {
          DetailType: "SalesItemLineDetail",
          Amount: montantHT,
          Description: description,
          SalesItemLineDetail: {
            ItemRef: { value: itemId },
            Qty: 1,
            UnitPrice: montantHT,
            ...(codeTaxe ? { TaxCodeRef: { value: codeTaxe } } : {}),
          },
        },
      ],
    });
    const facture = cree?.Invoice;

    // ENVOI PAR QUICKBOOKS + PREUVE — seulement si l'entreprise a activé
    // l'envoi automatique (interrupteur Paramètres / console plateforme).
    let envoiQb = null;
    const adressesEnvoi = (Array.isArray(corps?.envoyerA) ? corps.envoyerA : [])
      .map((e) => String(e || "").trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .slice(0, 5);
    if (corps?.envoyerAuto === true && adressesEnvoi.length > 0 && facture?.Id) {
      try {
        envoiQb = await envoyerFactureParQb(acces, facture.Id, adressesEnvoi);
      } catch {
        envoiQb = { envoyee: false, envoyeeLe: null };
      }
    }

    return Response.json({
      creee: true,
      factureId: facture?.Id || null,
      docNumber: facture?.DocNumber || null,
      lienPaiement: facture?.InvoiceLink || null,
      carteOfferte,
      virementOffert,
      envoiQb,
      environnement: acces.environnement,
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
