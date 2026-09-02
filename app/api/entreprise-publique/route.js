// app/api/entreprise-publique/route.js
//
// IDENTITÉ PUBLIQUE D'UNE ENTREPRISE (2026-09-04) — pour la page
// /conditions, qui est publique et sans jeton : le lien envoyé au
// client porte « ?e=<entreprise> » et cette route retourne UNIQUEMENT
// les champs d'affichage (nom, logo, adresse, téléphone) — les mêmes
// qui figurent déjà sur les devis et factures publics de l'entreprise.
// JAMAIS de courriels internes, de réglages ni de numéros de taxes.

import { clientSupabaseService } from "@/lib/quickbooksServeur";

export async function GET(request) {
  const e = String(new URL(request.url).searchParams.get("e") || "").trim();
  // Identifiants d'entreprise : lettres/chiffres/tirets seulement.
  if (!/^[a-z0-9-]{1,60}$/i.test(e)) {
    return Response.json({ erreur: "Entreprise inconnue." }, { status: 400 });
  }
  try {
    const { data } = await clientSupabaseService()
      .from("entreprises")
      .select("id, nom_legal, nom_commercial, adresse, telephone, logo_donnees")
      .eq("id", e)
      .maybeSingle();
    if (!data) return Response.json({ erreur: "Entreprise inconnue." }, { status: 404 });
    return Response.json({
      id: data.id,
      nom: data.nom_commercial || data.nom_legal || "",
      nomLegal: data.nom_legal || "",
      adresse: data.adresse || "",
      telephone: data.telephone || "",
      logo: data.logo_donnees || "",
    });
  } catch {
    return Response.json({ erreur: "Indisponible — réessaie." }, { status: 502 });
  }
}
