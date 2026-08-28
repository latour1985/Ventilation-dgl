// lib/importCatalogue.js
//
// 📄 IMPORT D'UNE LISTE DE PRIX (CSV) — décidé avec le propriétaire le
// 2026-09-06, construit le 2026-08-28.
//
// POURQUOI un fichier plutôt que « juste lire le catalogue QuickBooks » :
// lire les items de QuickBooks exige la MÊME connexion OAuth que tout le
// reste. Un fichier, lui, marche pour TOUS les clients — QuickBooks,
// Sage, Acomba, ou un simple tableur — sans dépendre d'un connecteur.
//
// Le fichier est lu ici, dans le navigateur : rien n'est téléversé.
//
// ⚠️ RÈGLE GELÉE RESPECTÉE : un coût ABSENT reste INCONNU (null), jamais
// zéro — sinon un forfait sans coût afficherait « 100 % de marge ».

// ------------------------------------------------------------
// 1. LIRE LE FICHIER (CSV avec guillemets, séparateur détecté)
// ------------------------------------------------------------
// Excel francophone écrit des « ; », les exports américains des « , »,
// certains outils des tabulations. On compte les séparateurs HORS
// guillemets sur la première ligne et on garde le plus fréquent.
export function detecterSeparateur(premiereLigne) {
  const candidats = [";", ",", "\t", "|"];
  let dansGuillemets = false;
  const comptes = Object.fromEntries(candidats.map((c) => [c, 0]));
  for (const caractere of premiereLigne) {
    if (caractere === '"') dansGuillemets = !dansGuillemets;
    else if (!dansGuillemets && candidats.includes(caractere)) comptes[caractere] += 1;
  }
  return candidats.reduce((meilleur, c) => (comptes[c] > comptes[meilleur] ? c : meilleur), ",");
}

// Analyse complète : gère les champs entre guillemets (qui peuvent
// contenir le séparateur ou un retour de ligne) et les « "" » échappés.
export function analyserCsv(texte) {
  const propre = String(texte || "").replace(/^\uFEFF/, ""); // BOM d'Excel
  const premiereFin = propre.search(/\r?\n/);
  const separateur = detecterSeparateur(premiereFin === -1 ? propre : propre.slice(0, premiereFin));
  const lignes = [];
  let champs = [];
  let valeur = "";
  let dansGuillemets = false;
  for (let i = 0; i < propre.length; i++) {
    const c = propre[i];
    if (dansGuillemets) {
      if (c === '"' && propre[i + 1] === '"') { valeur += '"'; i++; }
      else if (c === '"') dansGuillemets = false;
      else valeur += c;
      continue;
    }
    // ⚠️ Un guillemet n'ouvre un champ que s'il est au TOUT DÉBUT de
    // celui-ci. Ailleurs, c'est le symbole des POUCES — « Conduit spiral
    // 6" » est un nom de pièce parfaitement normal en ventilation, et
    // l'avaler comme une ouverture de citation mangeait la fin de la ligne.
    if (c === '"' && valeur === "") { dansGuillemets = true; continue; }
    if (c === separateur) { champs.push(valeur); valeur = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") {
      champs.push(valeur);
      // Une ligne entièrement vide ne compte pas.
      if (champs.some((x) => x.trim() !== "")) lignes.push(champs);
      champs = [];
      valeur = "";
      continue;
    }
    valeur += c;
  }
  champs.push(valeur);
  if (champs.some((x) => x.trim() !== "")) lignes.push(champs);
  return { separateur, lignes };
}

// ------------------------------------------------------------
// 2. RECONNAÎTRE LES COLONNES
// ------------------------------------------------------------
const sansAccent = (t) =>
  String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Les en-têtes courants — QuickBooks (FR et EN), Sage, Acomba, tableurs.
// L'ordre compte : on teste du plus précis au plus général.
const SYNONYMES = {
  nom: ["produit/service", "product/service", "product/service name", "nom du produit", "nom de l'article", "nom", "name", "produit", "product", "item", "article", "designation", "description du produit"],
  prix_vendant: ["prix de vente", "sales price", "prix vendant", "prix_vendant", "prix unitaire", "unit price", "prix", "price", "rate", "vendant", "montant"],
  prix_coutant: ["cout d'achat", "purchase cost", "prix coutant", "prix_coutant", "prix d'achat", "cost", "coutant", "cout", "prix de revient"],
  unite: ["unite", "unit", "u/m", "unite de mesure", "unit of measure"],
  categorie: ["categorie", "category", "famille", "classe", "type", "groupe"],
  description: ["description des ventes", "sales description", "description", "notes", "detail"],
};

export function repererColonnes(entetes) {
  const normalisees = (entetes || []).map(sansAccent);
  const mapping = {};
  const prises = new Set();
  for (const [champ, motsCles] of Object.entries(SYNONYMES)) {
    for (const mot of motsCles) {
      // Égalité d'abord (« prix » ne doit pas voler la colonne « prix
      // d'achat »), puis correspondance partielle en dernier recours.
      let index = normalisees.findIndex((e, i) => !prises.has(i) && e === mot);
      if (index === -1) index = normalisees.findIndex((e, i) => !prises.has(i) && e.includes(mot));
      if (index !== -1) { mapping[champ] = index; prises.add(index); break; }
    }
  }
  return mapping;
}

// ------------------------------------------------------------
// 3. LIRE UN NOMBRE ÉCRIT PAR UN HUMAIN
// ------------------------------------------------------------
// « 1 234,56 $ », « $1,234.56 », « 44.50 », « » (vide = INCONNU).
export function nombreDepuisTexte(texte) {
  const brut = String(texte ?? "").replace(/[\s\u00a0$]/g, "").replace(/[A-Za-z]/g, "").trim();
  if (!brut) return null;
  let normalise = brut;
  const virgule = brut.lastIndexOf(",");
  const point = brut.lastIndexOf(".");
  if (virgule !== -1 && point !== -1) {
    // Le SÉPARATEUR DÉCIMAL est le dernier des deux ; l'autre sépare
    // les milliers (1.234,56 en français · 1,234.56 en anglais).
    normalise = virgule > point
      ? brut.replace(/\./g, "").replace(",", ".")
      : brut.replace(/,/g, "");
  } else if (virgule !== -1) {
    // Une seule virgule : décimale (44,50) sauf si elle sépare des
    // milliers bien formés (1,234).
    normalise = /,\d{3}$/.test(brut) ? brut.replace(/,/g, "") : brut.replace(",", ".");
  }
  const n = Number(normalise);
  return Number.isFinite(n) ? n : null;
}

// ------------------------------------------------------------
// 4. DU FICHIER AUX ITEMS
// ------------------------------------------------------------
// Retourne { items, ignorees, mapping, entetes } — `items` porte des
// prix_coutant NULL quand la colonne est vide (inconnu ≠ zéro).
export function itemsDepuisCsv(texte) {
  const { lignes } = analyserCsv(texte);
  if (lignes.length === 0) return { items: [], ignorees: 0, mapping: {}, entetes: [] };
  const entetes = lignes[0].map((e) => String(e || "").trim());
  const mapping = repererColonnes(entetes);
  if (mapping.nom === undefined) return { items: [], ignorees: lignes.length - 1, mapping, entetes };

  const items = [];
  const dejaVus = new Set();
  let ignorees = 0;
  for (const ligne of lignes.slice(1)) {
    const lire = (champ) => (mapping[champ] === undefined ? "" : String(ligne[mapping[champ]] ?? "").trim());
    const nom = lire("nom");
    if (!nom) { ignorees += 1; continue; }
    const cle = nom.toLowerCase();
    if (dejaVus.has(cle)) { ignorees += 1; continue; } // doublon DANS le fichier
    dejaVus.add(cle);
    items.push({
      nom,
      prix_vendant: nombreDepuisTexte(lire("prix_vendant")),
      prix_coutant: nombreDepuisTexte(lire("prix_coutant")), // null = INCONNU
      unite: lire("unite") || "unité",
      categorie: lire("categorie"),
      description: lire("description"),
      typeItem: "materiel",
      actif: true,
    });
  }
  return { items, ignorees, mapping, entetes };
}
