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
  urlBaseApiQb,
  utilisateurDepuisJeton,
} from "@/lib/quickbooksServeur";

// Appel d'écriture à l'API QuickBooks (POST JSON).
async function ecrireQbo(acces, chemin, corps) {
  const url = `${urlBaseApiQb()}/v3/company/${acces.realmId}/${chemin}${chemin.includes("?") ? "&" : "?"}minorversion=75`;
  const reponse = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${acces.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corps),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const detail = resultat?.Fault?.Error?.[0]?.Message || `QuickBooks a refusé (code ${reponse.status}).`;
    throw new Error(detail);
  }
  return resultat;
}

// Guillemets échappés pour le langage de requête QBO.
const echapper = (s) => String(s || "").replace(/'/g, "\\'");

// Retrouve ou crée le client QuickBooks. Retourne son id.
async function clientQbo(acces, admin, { clientId, clientNom }) {
  // 1. L'id mémorisé sur la fiche de l'app, s'il existe encore chez QBO.
  if (clientId) {
    const { data } = await admin.from("clients_app").select("quickbooks_customer_id").eq("id", clientId).maybeSingle();
    if (data?.quickbooks_customer_id) return data.quickbooks_customer_id;
  }
  // 2. Par nom exact chez QuickBooks.
  const trouve = await requeteQbo(acces, `select Id from Customer where DisplayName = '${echapper(clientNom)}' maxresults 1`);
  let id = trouve?.Customer?.[0]?.Id || null;
  // 3. Sinon : création.
  if (!id) {
    const cree = await ecrireQbo(acces, "customer", { DisplayName: clientNom.slice(0, 100) });
    id = cree?.Customer?.Id || null;
  }
  // Mémorise pour les fois suivantes (et pour la Règle 1 d'attribution).
  if (id && clientId) {
    await admin.from("clients_app").update({ quickbooks_customer_id: id, sync_qb: "synchronise" }).eq("id", clientId);
  }
  return id;
}

// Un article « Service » pour porter la ligne de la facture (QBO exige
// un article). On prend « Services » s'il existe, sinon le premier
// article de type Service du fichier.
async function articleServiceQbo(acces) {
  const nomme = await requeteQbo(acces, `select Id, Name from Item where Name = 'Services' maxresults 1`);
  if (nomme?.Item?.[0]?.Id) return nomme.Item[0].Id;
  const premier = await requeteQbo(acces, `select Id, Name from Item where Type = 'Service' maxresults 1`);
  return premier?.Item?.[0]?.Id || null;
}

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  // Les techniciens n'émettent pas de factures — tous les rôles de
  // bureau (admins, répartiteur...) le peuvent : ce sont eux qui créent
  // les appels de service.
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
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
    acces = await jetonAccesValide();
  } catch (e) {
    return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  // ---------- ANNULATION PAR VOID (jamais Delete — règle gelée) ----------
  if (corps?.action === "void") {
    const factureId = String(corps?.factureId || "").trim();
    if (!factureId) return Response.json({ erreur: "factureId requis." }, { status: 400 });
    try {
      const lu = await requeteQbo(acces, `select Id, SyncToken from Invoice where Id = '${echapper(factureId)}' maxresults 1`);
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
  const description = String(corps?.description || `Dépôt — appel de service${corps?.zone ? ` (${corps.zone})` : ""}`).slice(0, 300);
  const joursLimite = Math.max(1, Number(corps?.joursLimite) || 1);

  try {
    const [customerId, itemId] = await Promise.all([
      clientQbo(acces, clientSupabaseService(), { clientId: corps?.clientId || null, clientNom }),
      articleServiceQbo(acces),
    ]);
    if (!customerId) return Response.json({ erreur: "Client QuickBooks introuvable et non créable." }, { status: 502 });
    if (!itemId) return Response.json({ erreur: "Aucun article de type Service dans ce fichier QuickBooks." }, { status: 502 });

    const echeance = new Date(Date.now() + joursLimite * 24 * 60 * 60 * 1000);
    const dateLocale = `${echeance.getFullYear()}-${String(echeance.getMonth() + 1).padStart(2, "0")}-${String(echeance.getDate()).padStart(2, "0")}`;
    const cree = await ecrireQbo(acces, "invoice", {
      CustomerRef: { value: customerId },
      DueDate: dateLocale,
      PrivateNote: `Dépôt d'appel de service — tâche ${corps?.tacheId || "?"} — créé par l'application Ventilation DGL`,
      Line: [
        {
          DetailType: "SalesItemLineDetail",
          Amount: montantHT,
          Description: description,
          SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: montantHT },
        },
      ],
    });
    const facture = cree?.Invoice;
    return Response.json({ creee: true, factureId: facture?.Id || null, docNumber: facture?.DocNumber || null });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
