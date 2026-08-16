// app/api/quickbooks/facture-pdf/route.js
//
// LE PDF OFFICIEL D'UNE FACTURE — tiré de QuickBooks au moment du
// clic : exactement le document que le client a reçu (numéro, termes,
// bouton de paiement), pas une reconstitution de l'application.
// GET ?id=<factureId> — réservé au bureau, jamais anonyme.

import {
  configQuickbooksPresente,
  jetonAccesValide,
  utilisateurDepuisJeton,
  urlBaseApiQb,
} from "@/lib/quickbooksServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (String(utilisateur.user_metadata?.role || "").trim() === "Technicien") {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }
  if (!configQuickbooksPresente()) return Response.json({ simule: true });

  const factureId = String(new URL(request.url).searchParams.get("id") || "").replace(/[^0-9]/g, "");
  if (!factureId) return Response.json({ erreur: "Identifiant de facture requis." }, { status: 400 });

  let acces;
  try {
    acces = await jetonAccesValide();
  } catch (e) {
    return Response.json({ erreur: `Jeton QuickBooks : ${e?.message || "erreur"}` }, { status: 502 });
  }
  if (!acces) return Response.json({ nonConnecte: true });

  try {
    const url = `${urlBaseApiQb()}/v3/company/${acces.realmId}/invoice/${factureId}/pdf?minorversion=75`;
    const reponse = await fetch(url, {
      headers: { Authorization: `Bearer ${acces.accessToken}`, Accept: "application/pdf" },
      cache: "no-store",
    });
    if (!reponse.ok) {
      return Response.json({ erreur: `QuickBooks a refusé le PDF (code ${reponse.status}).` }, { status: 502 });
    }
    const tampon = await reponse.arrayBuffer();
    return new Response(tampon, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-quickbooks-${factureId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "QuickBooks injoignable.") }, { status: 502 });
  }
}
