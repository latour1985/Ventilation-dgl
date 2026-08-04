// lib/googlePlaces.js
//
// AUTOCOMPLÉTION D'ADRESSE via Google Places API (New).
//
// ------------------------------------------------------------
// POURQUOI LA CLÉ EST DANS LE NAVIGATEUR
// ------------------------------------------------------------
// Contrairement à un appel serveur (calcul de trajet), Google prévoit
// explicitement que la clé d'autocomplétion vive côté navigateur. Elle
// est protégée non pas par le secret, mais par une RESTRICTION DE
// DOMAINE configurée dans la console Google Cloud : copiée ailleurs,
// elle ne fonctionne pas. C'est pour ça qu'aucun serveur n'est requis.
//
// ------------------------------------------------------------
// JETON DE SESSION — ce n'est pas un détail
// ------------------------------------------------------------
// Sans jeton, Google facture CHAQUE FRAPPE au clavier. Avec, toute la
// recherche (« 8 », « 89 », « 895 »…) plus la sélection finale comptent
// pour UNE seule unité de facturation. Le jeton est jeté après chaque
// sélection : un nouveau doit être créé pour la recherche suivante.
//
// ------------------------------------------------------------
// JAMAIS BLOQUANT
// ------------------------------------------------------------
// Clé absente, quota dépassé, hors ligne, Google inaccessible : toutes
// les fonctions échouent proprement et l'appelant retombe sur la saisie
// manuelle. Créer un client ne doit jamais dépendre d'un service tiers.

const CLE = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

let promesseChargement = null;

export function googlePlacesDisponible() {
  return typeof window !== "undefined" && !!CLE;
}

// ------------------------------------------------------------
// CHARGEMENT — pourquoi ce n'est pas une simple balise <script>
// ------------------------------------------------------------
// Poser `<script src="...maps/api/js?libraries=places">` charge bien
// l'API, mais donne l'ANCIENNE interface : ni `google.maps.importLibrary`,
// ni même `google.maps.places`. Les classes de Places API (New) —
// AutocompleteSuggestion, AutocompleteSessionToken — ne s'obtiennent
// QUE par `importLibrary`, que Google ne définit que si l'on passe par
// son chargeur d'amorçage avec un `callback`.
//
// C'est ce que fait la fonction ci-dessous : elle crée elle-même
// `google.maps.importLibrary`, qui déclenche le vrai chargement au
// premier appel. Une seule fois, même avec plusieurs champs d'adresse
// ouverts en même temps.
const NOM_CALLBACK = "__pretGooglePlaces__";

function chargerApi() {
  if (!googlePlacesDisponible()) return Promise.reject(new Error("Clé Google Maps absente"));
  if (promesseChargement) return promesseChargement;

  promesseChargement = new Promise((resolve, reject) => {
    // Déjà chargé par ailleurs (navigation interne, autre champ).
    if (window.google?.maps?.importLibrary) {
      resolve();
      return;
    }
    window.google = window.google || {};
    window.google.maps = window.google.maps || {};
    // Google appelle ce callback quand l'API est prête ; c'est lui qui
    // installe le vrai `importLibrary`.
    window.google.maps[NOM_CALLBACK] = () => resolve();

    const params = new URLSearchParams({
      key: CLE,
      libraries: "places",
      v: "weekly",
      loading: "async",
      language: "fr-CA",
      region: "CA",
      callback: `google.maps.${NOM_CALLBACK}`,
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      promesseChargement = null; // permet un nouvel essai plus tard
      reject(new Error("Chargement de Google Maps impossible"));
    };
    document.head.appendChild(script);
  });
  return promesseChargement;
}

async function bibliothequePlaces() {
  await chargerApi();
  if (!window.google?.maps?.importLibrary) {
    throw new Error("API Google Maps chargée mais incomplète");
  }
  return window.google.maps.importLibrary("places");
}

// Nouveau jeton de session — à créer au DÉBUT d'une recherche et à
// jeter après la sélection (voir la note de facturation en tête).
export async function nouveauJeton() {
  const { AutocompleteSessionToken } = await bibliothequePlaces();
  return new AutocompleteSessionToken();
}

// Suggestions d'adresses pour le texte saisi. Limité au CANADA : sans
// ça, « 8954 rue Principale » remonte des résultats du Texas.
export async function chercherAdresses(texte, jeton) {
  if (!texte || texte.trim().length < 3) return [];
  const { AutocompleteSuggestion } = await bibliothequePlaces();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: texte.trim(),
    includedRegionCodes: ["ca"],
    sessionToken: jeton,
    language: "fr-CA",
  });
  return (suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      id: p.placeId,
      texte: p.text?.toString() || "",
      prediction: p,
    }));
}

// Détails d'une adresse choisie — retourne EXACTEMENT la forme attendue
// par le reste de l'application : { label, ligne1, ville, codePostal }.
// La ville et le code postal viennent découpés par Google, ce qui évite
// de les deviner dans une chaîne de texte (une ville mal extraite finit
// sur une facture envoyée au client).
export async function detailsAdresse(suggestion, jeton) {
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({
    fields: ["formattedAddress", "addressComponents"],
    sessionToken: jeton,
  });
  const composants = place.addressComponents || [];
  const trouver = (type) => composants.find((c) => (c.types || []).includes(type));

  const numero = trouver("street_number")?.longText || "";
  const rue = trouver("route")?.longText || "";
  const ville =
    trouver("locality")?.longText ||
    trouver("sublocality")?.longText ||
    trouver("administrative_area_level_2")?.longText ||
    "";
  const codePostal = trouver("postal_code")?.longText || "";
  const complet = place.formattedAddress || suggestion.texte;

  return {
    label: complet,
    // `ligne1` = numéro + rue seulement quand Google les fournit ;
    // sinon on garde l'adresse complète plutôt que de renvoyer du vide.
    ligne1: numero && rue ? `${numero} ${rue}` : complet,
    ville,
    codePostal,
  };
}
