import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

// 🕘 HISTORIQUE À L'ADRESSE — pour le téléphone du technicien (2026-09-22,
// demande du propriétaire : « voir les anciennes notes ou photos reliées
// à l'adresse »). Source : les BONS DE TRAVAIL fermés. On ne renvoie que
// ce qui sert sur le terrain — date, technicien, titre, notes, photos —
// JAMAIS un montant, une révision ni un état de facturation (les prix ne
// quittent pas le bureau). La RLS borne déjà les bons à l'entreprise ;
// la clé service lit ici pour épargner au téléphone la table complète,
// et on borne de nouveau à l'entreprise de l'appelant.
//
// Correspondance : par l'ADRESSE des travaux (sans majuscules, accents ni
// ponctuation, ville facultative) ; sans adresse, par le nom du client.

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
// « 495 Rue McGill, Montréal, QC H2Y 2E9 » → « 495 rue mcgill »
const cleAdresse = (adresse) => {
  // « Chantier — 146 Chem. de la Côte S » : le préfixe d'étiquette saute.
  const brut = sansAccents(adresse).toLowerCase().replace(/^\s*(chantier|projet|client|livraison)\s*[—:-]+\s*/, "").split(/[,\n]/)[0];
  return brut.replace(/[^a-z0-9 ]/g, " ").replace(/\b(rue|avenue|ave|av|boulevard|boul|blvd|chemin|chem|ch|route|rte)\b/g, " ").replace(/\s+/g, " ").trim();
};
const cleClient = (nom) => sansAccents(nom).toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ visites: [] });
  const url = new URL(request.url);
  const adresse = (url.searchParams.get("adresse") || "").trim();
  const client = (url.searchParams.get("client") || "").trim();
  const exclure = (url.searchParams.get("exclure") || "").trim(); // la tâche courante
  const cle = cleAdresse(adresse);
  const cleCl = cleClient(client);
  if (!cle && !cleCl) return Response.json({ visites: [] });

  const admin = clientSupabaseService();
  let requete = admin
    .from("bons_travail")
    .select("tache_id, titre, client_nom, date_travail, adresse_travaux, description, employe_nom, employe_email, photos")
    .eq("entreprise_id", entrepriseDuCompte(utilisateur))
    .order("date_travail", { ascending: false })
    .limit(400);
  // Pré-filtre côté base (le numéro civique OU le client) ; le tri fin
  // se fait en mémoire avec la clé normalisée.
  const civique = (adresse.match(/\d+/) || [])[0];
  const filtres = [];
  if (civique) filtres.push(`adresse_travaux.ilike.%${civique}%`);
  if (client) filtres.push(`client_nom.ilike.%${client.replace(/[%,]/g, "")}%`);
  if (filtres.length > 0) requete = requete.or(filtres.join(","));
  const { data, error } = await requete;
  if (error) return Response.json({ erreur: error.message }, { status: 502 });

  const parAdresse = cle ? (data || []).filter((b) => cleAdresse(b.adresse_travaux) === cle) : [];
  // Sans correspondance d'adresse (ou sans adresse) : le même client.
  const retenus = parAdresse.length > 0 || !cleCl ? parAdresse : (data || []).filter((b) => cleClient(b.client_nom) === cleCl);
  const vus = new Set();
  const visites = [];
  for (const b of retenus) {
    const base = String(b.tache_id || "").split("::")[0];
    if (exclure && base === exclure) continue;
    const k = `${base}|${b.date_travail}`;
    if (vus.has(k)) continue; // un bon par technicien : une visite par jour
    vus.add(k);
    visites.push({
      id: k,
      date: b.date_travail,
      titre: b.titre || "Travail complété",
      technicien: b.employe_nom || String(b.employe_email || "").split("@")[0],
      client: b.client_nom || "",
      adresse: b.adresse_travaux || "",
      notes: b.description || "",
      photosAvant: Array.isArray(b.photos?.avant) ? b.photos.avant : [],
      photosApres: Array.isArray(b.photos?.apres) ? b.photos.apres : [],
      videos: Array.isArray(b.photos?.videos) ? b.photos.videos : [],
    });
    if (visites.length >= 20) break;
  }
  return Response.json({ visites, critere: parAdresse.length > 0 ? "adresse" : "client" });
}
