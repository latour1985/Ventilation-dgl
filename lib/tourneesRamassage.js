// lib/tourneesRamassage.js
//
// 🚚 TOURNÉES DE RAMASSAGE (2026-09-21, demande du propriétaire) — le
// commissionnaire va chercher le matériel chez les fournisseurs.
//
// Un bon de commande marqué « 🚚 Ramassage » porte QUI le ramasse
// (ramassePar = courriel), le JOUR (livraisonSouhaitee) et OÙ déposer
// (depotA). Fluxya en tire UNE tâche par personne et par jour — la
// « tournée » — sans que personne ait à la créer : elle est CALCULÉE à
// partir des bons, puis écrite comme une vraie tâche assignée
// (taches_assignees) pour que l'agenda ET le téléphone la voient.
//
// La vérité, ce sont les bons. La tournée n'est qu'une projection :
//   • un bon change de jour / de personne → la tournée suit ;
//   • plus aucun bon un jour donné → la tournée disparaît ;
//   • un bon marqué reçu → il quitte la tournée.
// Même fournisseur = un seul arrêt (les bons y sont regroupés).
// Aucune écriture inutile : une signature résume le contenu, on
// n'écrit que quand elle change.

export const PREFIXE_TOURNEE = "ramassage-";

export const estTourneeRamassage = (tache) => String(tache?.id || "").startsWith(PREFIXE_TOURNEE) || Array.isArray(tache?.ramassages) && tache.ramassages.length > 0;

const cleTournee = (courriel, jour) => `${PREFIXE_TOURNEE}${String(courriel || "").toLowerCase()}-${jour}`;

// Les bons à ramasser, tous chemins confondus (achats libres + bons de
// commande des projets), avec ce que la tournée doit montrer.
export function bonsARamasser({ achatsLibres = [], projets = [], pieces = [], fournisseurs = [], bcEstRamassage }) {
  const ficheF = (nom) => (fournisseurs || []).find((f) => String(f.nom || "").trim().toLowerCase() === String(nom || "").trim().toLowerCase()) || null;
  const liste = [];
  (achatsLibres || []).forEach((a) => {
    if (a.recuLe || !a.ramassePar || !a.livraisonSouhaitee || !bcEstRamassage(a.description)) return;
    const f = ficheF(a.fournisseurNom);
    liste.push({
      numero: a.numeroBc || "(sans nº)",
      fournisseur: a.fournisseurNom || "Fournisseur",
      adresse: f?.adresse || "",
      telephone: f?.telephone || "",
      texte: String(a.description || "").split("\n").filter((l) => !/^(📦|🚚|📍)/.test(l.trim())).join("\n").trim(),
      pourJob: a.tacheTitre || a.clientNom || (String(a.description || "").includes("Pour l'inventaire courant") ? "Stock du bureau" : ""),
      depotA: a.depotA || "Atelier",
      jour: a.livraisonSouhaitee,
      ramassePar: String(a.ramassePar).toLowerCase(),
      source: "achat",
    });
  });
  (projets || []).forEach((pr) =>
    (pr.bonsCommande || []).forEach((bc) => {
      if (!bc.ramassePar || !bc.livraison || bc.statut === "Reçu" || bc.statut === "Annulé" || !bcEstRamassage(bc.description)) return;
      const f = ficheF(bc.fournisseur);
      liste.push({
        numero: bc.numeroBC || "(sans nº)",
        fournisseur: bc.fournisseur || "Fournisseur",
        adresse: f?.adresse || "",
        telephone: f?.telephone || "",
        texte: String(bc.description || "").split("\n").filter((l) => !/^(📦|🚚|📍)/.test(l.trim())).join("\n").trim(),
        pourJob: `🏗️ ${pr.nom}`,
        depotA: bc.depotA || pr.adresseLivraison || pr.adresseTravaux || "Atelier",
        jour: bc.livraison,
        ramassePar: String(bc.ramassePar).toLowerCase(),
        source: "projet",
        projetId: pr.id,
      });
    })
  );
  // 🔧 Pièces commandées depuis le téléphone, marquées ramassage (snippet 154).
  (pieces || []).forEach((p) => {
    if (!p.ramassage || !p.ramassePar || !p.dateReceptionPrevue || p.statut !== "commandee") return;
    const f = ficheF(p.fournisseurNom);
    liste.push({
      numero: p.numeroBc || "(sans nº)",
      fournisseur: p.fournisseurNom || "Fournisseur",
      adresse: f?.adresse || "",
      telephone: f?.telephone || "",
      texte: String(p.pieceRequise || "").trim(),
      pourJob: p.clientNom || "",
      depotA: p.depotA || "Atelier",
      jour: p.dateReceptionPrevue,
      ramassePar: String(p.ramassePar).toLowerCase(),
      source: "piece",
      pieceId: p.id,
    });
  });
  return liste;
}

// 🚚 À ATTRIBUER : les ramassages sans personne (ou sans jour) — ils ne
// peuvent entrer dans aucune tournée. Regroupés par fournisseur pour
// faire UNE carte glissable par fournisseur dans « Tâches en attente ».
export function ramassagesAAttribuer({ achatsLibres = [], projets = [], pieces = [], bcEstRamassage }) {
  const bons = [];
  (achatsLibres || []).forEach((a) => {
    if (a.recuLe || !bcEstRamassage(a.description)) return;
    if (a.ramassePar && a.livraisonSouhaitee) return;
    bons.push({ numero: a.numeroBc || "(sans nº)", fournisseur: a.fournisseurNom || "Fournisseur", pourJob: a.tacheTitre || a.clientNom || "", jour: a.livraisonSouhaitee || null, ramassePar: a.ramassePar || null, source: "achat" });
  });
  (projets || []).forEach((pr) =>
    (pr.bonsCommande || []).forEach((bc) => {
      if (bc.statut === "Reçu" || bc.statut === "Annulé" || !bcEstRamassage(bc.description)) return;
      if (bc.ramassePar && bc.livraison) return;
      bons.push({ numero: bc.numeroBC || "(sans nº)", fournisseur: bc.fournisseur || "Fournisseur", pourJob: `🏗️ ${pr.nom}`, jour: bc.livraison || null, ramassePar: bc.ramassePar || null, source: "projet" });
    })
  );
  (pieces || []).forEach((p) => {
    if (!p.ramassage || p.statut !== "commandee") return;
    if (p.ramassePar && p.dateReceptionPrevue) return;
    bons.push({ numero: p.numeroBc || "(sans nº)", fournisseur: p.fournisseurNom || "Fournisseur", pourJob: p.clientNom || "", jour: p.dateReceptionPrevue || null, ramassePar: p.ramassePar || null, source: "piece" });
  });
  const parFournisseur = {};
  bons.forEach((b) => {
    const k = b.fournisseur.trim().toLowerCase();
    if (!parFournisseur[k]) parFournisseur[k] = { id: `a-attribuer-${k.replace(/[^a-z0-9]+/g, "-")}`, fournisseur: b.fournisseur, bons: [] };
    parFournisseur[k].bons.push(b);
  });
  return Object.values(parFournisseur).sort((x, y) => x.fournisseur.localeCompare(y.fournisseur, "fr"));
}

// Regroupe par (personne, jour) → une tournée, arrêts groupés par
// fournisseur. Retourne { [cle]: tournee }.
export function calculerTournees(bons) {
  const parCle = {};
  (bons || []).forEach((b) => {
    const cle = cleTournee(b.ramassePar, b.jour);
    if (!parCle[cle]) parCle[cle] = { id: cle, courriel: b.ramassePar, jour: b.jour, bons: [] };
    parCle[cle].bons.push(b);
  });
  Object.values(parCle).forEach((t) => {
    t.bons.sort((x, y) => x.fournisseur.localeCompare(y.fournisseur, "fr") || x.numero.localeCompare(y.numero, "fr"));
    const arrets = [];
    t.bons.forEach((b) => {
      let a = arrets.find((x) => x.fournisseur.toLowerCase() === b.fournisseur.toLowerCase());
      if (!a) { a = { fournisseur: b.fournisseur, adresse: b.adresse, telephone: b.telephone, bons: [] }; arrets.push(a); }
      // Le nom le mieux écrit (majuscule initiale) l'emporte pour l'affichage.
      if (/^[A-ZÀ-Ý]/.test(b.fournisseur) && !/^[A-ZÀ-Ý]/.test(a.fournisseur)) a.fournisseur = b.fournisseur;
      if (!a.adresse && b.adresse) a.adresse = b.adresse;
      a.bons.push(b);
    });
    t.arrets = arrets;
    // + adresse et téléphone du fournisseur : compléter la fiche fournisseur
    // met la tournée à jour (revue 2026-09-22 — « M'y rendre » restait vide).
    t.signature = JSON.stringify(t.bons.map((b) => [b.numero, b.fournisseur, b.depotA, b.texte.slice(0, 200), b.pourJob, b.adresse || "", b.telephone || ""]));
    t.titre = `🚚 Tournée de ramassage — ${t.bons.length} bon${t.bons.length > 1 ? "s" : ""} · ${arrets.length} arrêt${arrets.length > 1 ? "s" : ""}`;
    t.description = arrets
      .map((a) => `${a.fournisseur}${a.adresse ? ` — ${a.adresse}` : ""}\n${a.bons.map((b) => `  • ${b.numero}${b.pourJob ? ` (${b.pourJob})` : ""} → déposer : ${b.depotA}`).join("\n")}`)
      .join("\n\n");
  });
  return parCle;
}

// La tâche à écrire dans taches_assignees pour une tournée.
export function tacheDeTournee(t) {
  return {
    id: t.id,
    titre: t.titre,
    description: t.description,
    typeTache: "course",
    nonFacturable: true,
    sansClient: true,
    heures: Math.min(8, Math.max(1, t.arrets.length * 1)),
    jours: 0,
    sauterWeekend: false,
    // 📍 Premier arrêt = destination du bouton « M'y rendre ».
    adresseTravaux: t.arrets[0]?.adresse || null,
    adresseIntervention: t.arrets[0]?.adresse ? `${t.arrets[0].fournisseur} — ${t.arrets[0].adresse}` : t.arrets[0]?.fournisseur || null,
    ramassages: t.bons.map((b) => ({ numero: b.numero, fournisseur: b.fournisseur, adresse: b.adresse, telephone: b.telephone, texte: b.texte, pourJob: b.pourJob, depotA: b.depotA, source: b.source, projetId: b.projetId || null })),
    signatureTournee: t.signature,
    tourneeRamassage: true,
  };
}
