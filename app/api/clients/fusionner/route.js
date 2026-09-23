// app/api/clients/fusionner/route.js
//
// 🔗 FUSIONNER DEUX FICHES CLIENTS EN DOUBLE (2026-09-22, idée retenue par
// le propriétaire — « oui mais valider avant de fusionner »).
//
// Deux temps, TOUJOURS :
//   1. { garderId, fusionnerId, apercu: true } → rien n'est écrit ; la
//      route dit ce qui serait déplacé (devis, projets, tâches, bons…).
//   2. { garderId, fusionnerId, confirmer: true } → la fusion se fait.
//
// Ce qui se passe à la fusion : TOUT ce qui pointait vers la fiche
// « fusionnée » pointe vers la fiche « gardée » (devis, projets, achats,
// pièces, factures, sous-traitants, tâches en attente et à l'agenda, bons
// et heures par le nom) ; adresses, contacts, courriels et équipements
// sont ajoutés à la fiche gardée sans doublon ; le lien QuickBooks de la
// gardée est conservé (celui de l'autre est noté dans la fiche). Puis la
// fiche fusionnée est supprimée. Tout est inscrit au journal.
//
// Clé service (plusieurs tables), mais TOUJOURS bornée à l'entreprise de
// l'appelant, et réservée au bureau.

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte, roleServeur } from "@/lib/quickbooksServeur";

const norm = (s) => String(s || "").trim().toLowerCase();

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if ((await roleServeur(utilisateur)) === "Technicien") return Response.json({ erreur: "Réservé au bureau." }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ erreur: "Service indisponible." }, { status: 503 });

  let corps;
  try { corps = await request.json(); } catch { return Response.json({ erreur: "Demande illisible." }, { status: 400 }); }
  const garderId = String(corps?.garderId || "");
  const fusionnerId = String(corps?.fusionnerId || "");
  if (!garderId || !fusionnerId || garderId === fusionnerId) return Response.json({ erreur: "Deux fiches différentes requises." }, { status: 400 });

  const E = entrepriseDuCompte(utilisateur);
  const admin = clientSupabaseService();
  const { data: fiches, error: ef } = await admin.from("clients_app").select("*").eq("entreprise_id", E).in("id", [garderId, fusionnerId]);
  if (ef) return Response.json({ erreur: ef.message }, { status: 502 });
  const A = (fiches || []).find((c) => c.id === garderId);
  const B = (fiches || []).find((c) => c.id === fusionnerId);
  if (!A || !B) return Response.json({ erreur: "Fiche introuvable dans ton entreprise." }, { status: 404 });

  // ---- Ce qui pointe vers B ----
  const compter = async (table, col = "client_id") => {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("entreprise_id", E).eq(col, B.id);
    return count || 0;
  };
  const tachesJson = async (table) => {
    const { data } = await admin.from(table).select("id, donnees").eq("entreprise_id", E).eq("donnees->>clientId", B.id);
    return data || [];
  };
  const memeNom = norm(A.nom) === norm(B.nom);
  const compterNom = async (table) => {
    if (memeNom || !B.nom) return 0;
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("entreprise_id", E).eq("client_nom", B.nom);
    return count || 0;
  };
  const [nDevis, nProjets, nAchats, nPieces, nFactLibres, nFactMaison, nSousTraitants, tAttente, tAssignees, nBons, nHeures] = await Promise.all([
    compter("devis_app"), compter("projets_app"), compter("achats_libres"), compter("pieces_commandees"),
    compter("factures_libres"), compter("factures_maison"), compter("sous_traitants_app"),
    tachesJson("taches_attente"), tachesJson("taches_assignees"), compterNom("bons_travail"), compterNom("travaux_effectues"),
  ]);
  const cleAdr = (a) => `${norm(a.ligne1)}|${norm(a.appartement)}`;
  const adressesAjoutees = (B.adresses || []).filter((b) => !(A.adresses || []).some((a) => cleAdr(a) === cleAdr(b)));
  const courrielsAjoutes = (B.courriels || []).filter((b) => b?.email && !(A.courriels || []).some((a) => norm(a.email) === norm(b.email)));
  const contactsAjoutes = (B.contacts || []).filter((b) => !(A.contacts || []).some((a) => norm(a.nom) === norm(b.nom) && String(a.telephone || "") === String(b.telephone || "")));
  const equipementsAjoutes = (B.equipements || []).filter((b) => !(A.equipements || []).some((a) => a.id && a.id === b.id));
  const apercu = {
    garder: { id: A.id, nom: A.nom, quickbooks: A.quickbooks_customer_id || null },
    fusionner: { id: B.id, nom: B.nom, quickbooks: B.quickbooks_customer_id || null },
    deplaces: { devis: nDevis, projets: nProjets, achats: nAchats, pieces: nPieces, facturesLibres: nFactLibres, facturesMaison: nFactMaison, sousTraitants: nSousTraitants, tachesAttente: tAttente.length, tachesAgenda: tAssignees.length, bonsParNom: nBons, heuresParNom: nHeures },
    ajoutes: { adresses: adressesAjoutees.length, courriels: courrielsAjoutes.length, contacts: contactsAjoutes.length, equipements: equipementsAjoutes.length },
    deuxQuickbooks: !!(A.quickbooks_customer_id && B.quickbooks_customer_id && A.quickbooks_customer_id !== B.quickbooks_customer_id),
  };
  if (!corps?.confirmer) return Response.json({ apercu });

  // ---- FUSION (références d'abord, fiche B en dernier) ----
  try {
    for (const table of ["devis_app", "achats_libres", "pieces_commandees", "factures_libres", "factures_maison"]) {
      const { error } = await admin.from(table).update({ client_id: A.id, client_nom: A.nom }).eq("entreprise_id", E).eq("client_id", B.id);
      if (error && !/client_nom/.test(error.message || "")) throw new Error(`${table} : ${error.message}`);
      if (error) await admin.from(table).update({ client_id: A.id }).eq("entreprise_id", E).eq("client_id", B.id);
    }
    for (const table of ["projets_app", "sous_traitants_app"]) {
      const { error } = await admin.from(table).update({ client_id: A.id }).eq("entreprise_id", E).eq("client_id", B.id);
      if (error) throw new Error(`${table} : ${error.message}`);
    }
    for (const [table, lignes] of [["taches_attente", tAttente], ["taches_assignees", tAssignees]]) {
      for (const l of lignes) {
        const { error } = await admin.from(table).update({ donnees: { ...(l.donnees || {}), clientId: A.id, clientNom: A.nom }, client_nom: A.nom }).eq("id", l.id);
        if (error) throw new Error(`${table} : ${error.message}`);
      }
    }
    if (!memeNom && B.nom) {
      for (const table of ["bons_travail", "travaux_effectues"]) {
        const { error } = await admin.from(table).update({ client_nom: A.nom }).eq("entreprise_id", E).eq("client_nom", B.nom);
        if (error) throw new Error(`${table} : ${error.message}`);
      }
    }
    // La fiche gardée reçoit ce qui lui manquait.
    const noteFusion = `🔗 Fusionnée le ${new Date().toLocaleDateString("fr-CA")} avec « ${B.nom} » (${B.id}${B.quickbooks_customer_id ? `, QuickBooks #${B.quickbooks_customer_id}` : ""}).`;
    const maj = {
      adresses: [...(A.adresses || []), ...adressesAjoutees],
      courriels: [...(A.courriels || []), ...courrielsAjoutes.map((c) => ({ ...c, defaut: (A.courriels || []).length === 0 ? !!c.defaut : false }))],
      contacts: [...(A.contacts || []), ...contactsAjoutes],
      equipements: [...(A.equipements || []), ...equipementsAjoutes],
      telephone: A.telephone || B.telephone || null,
      adresse_facturation: A.adresse_facturation || B.adresse_facturation || null,
      quickbooks_customer_id: A.quickbooks_customer_id || B.quickbooks_customer_id || null,
      note: [A.note, noteFusion].filter(Boolean).join("\n"),
    };
    let { error: eA } = await admin.from("clients_app").update(maj).eq("id", A.id).eq("entreprise_id", E);
    if (eA && /note|contacts|equipements/.test(eA.message || "")) {
      const { note: _n, ...sansNote } = maj;
      ({ error: eA } = await admin.from("clients_app").update(sansNote).eq("id", A.id).eq("entreprise_id", E));
    }
    if (eA) throw new Error(`fiche gardée : ${eA.message}`);
    const { error: eB } = await admin.from("clients_app").delete().eq("id", B.id).eq("entreprise_id", E);
    if (eB) throw new Error(`suppression de la fiche fusionnée : ${eB.message}`);
    const d = apercu.deplaces;
    const texte = `🔗 Fiches clients FUSIONNÉES : « ${B.nom} » → « ${A.nom} » (fiche gardée). Déplacés : ${d.devis} devis, ${d.projets} projet(s), ${d.tachesAttente + d.tachesAgenda} tâche(s), ${d.achats + d.pieces} achat(s)/pièce(s), ${d.facturesLibres + d.facturesMaison} facture(s)${d.bonsParNom + d.heuresParNom ? `, ${d.bonsParNom} bon(s) et ${d.heuresParNom} ligne(s) d'heures renommés` : ""}. Ajoutés : ${apercu.ajoutes.adresses} adresse(s), ${apercu.ajoutes.courriels} courriel(s), ${apercu.ajoutes.contacts} contact(s).${apercu.deuxQuickbooks ? ` ⚠️ Les deux fiches étaient liées à QuickBooks (#${A.quickbooks_customer_id} gardé, #${B.quickbooks_customer_id} à fusionner aussi dans QuickBooks).` : ""} — par ${utilisateur.user_metadata?.nom || utilisateur.email}`;
    await admin.from("journal_activite").insert({ entreprise_id: E, created_by: null, texte });
    return Response.json({ fusionne: true, apercu });
  } catch (e) {
    return Response.json({ erreur: `Fusion interrompue — ${e?.message || "erreur"}. Rien n'a été supprimé ; relance la fusion pour terminer.` }, { status: 502 });
  }
}
