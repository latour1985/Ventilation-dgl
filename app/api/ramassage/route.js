// app/api/ramassage/route.js
//
// 🚚 LE COMMISSIONNAIRE MARQUE UN BON « RAMASSÉ » OU « PAS PRÊT »
// (2026-09-21, demande du propriétaire).
//
// Pourquoi une route : la RLS réserve l'écriture des bons de commande au
// BUREAU. Le commissionnaire (un technicien côté accès) ne peut donc pas
// écrire `recu_le` lui-même. La route écrit avec la clé service, mais
// SEULEMENT :
//   • pour l'entreprise du jeton ;
//   • sur un bon dont il est la personne désignée (ramasse_par = son
//     courriel) — jamais le bon d'un collègue ;
//   • deux gestes : « ramasse » (recu_le maintenant, + photo du bon de
//     livraison, + note) et « pas_pret » (note horodatée, le bon reste
//     ouvert et le bureau le lit au journal).
// Les bons d'un PROJET (JSON dans projets_app.bons_commande) suivent la
// même règle, par numéro de BC.

import { clientSupabaseService, utilisateurDepuisJeton, entrepriseDuCompte } from "@/lib/quickbooksServeur";

export async function POST(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const numero = String(corps?.numero || "").trim();
  const geste = corps?.geste === "pas_pret" ? "pas_pret" : corps?.geste === "ramasse" ? "ramasse" : null;
  const note = String(corps?.note || "").trim().slice(0, 500);
  const photo = typeof corps?.photoUrl === "string" && /^https?:\/\//.test(corps.photoUrl) ? corps.photoUrl : null;
  if (!numero || !geste) return Response.json({ erreur: "Numéro de bon et geste requis." }, { status: 400 });
  if (geste === "pas_pret" && note.length < 3) return Response.json({ erreur: "Dis en quelques mots ce qui manque." }, { status: 400 });

  const entrepriseId = entrepriseDuCompte(utilisateur);
  const moi = String(utilisateur.email || "").toLowerCase();
  const nomMoi = utilisateur.user_metadata?.nom || moi;
  const admin = clientSupabaseService();
  const quand = new Date().toISOString();
  const horodatage = new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "short", timeStyle: "short" });
  const ligneNote = geste === "ramasse"
    ? `✅ Ramassé par ${nomMoi} le ${horodatage}${note ? ` — ${note}` : ""}${photo ? `\n📷 Bon de livraison : ${photo}` : ""}`
    : `⚠️ PAS PRÊT (${nomMoi}, ${horodatage}) : ${note}`;

  // 1. Achat libre (le chemin habituel — onglet Pièces).
  const { data: achats } = await admin
    .from("achats_libres")
    .select("id, numero_bc, ramasse_par, ramassage_note, fournisseur_nom, client_nom, tache_titre")
    .eq("entreprise_id", entrepriseId)
    .eq("numero_bc", numero)
    .limit(2);
  const achat = (achats || [])[0];
  if (achat) {
    if (String(achat.ramasse_par || "").toLowerCase() !== moi) {
      return Response.json({ erreur: "Ce bon n'est pas dans ta tournée." }, { status: 403 });
    }
    const maj = { ramassage_note: [achat.ramassage_note, ligneNote].filter(Boolean).join("\n") };
    if (geste === "ramasse") maj.recu_le = quand;
    const { error } = await admin.from("achats_libres").update(maj).eq("id", achat.id);
    if (error) return Response.json({ erreur: error.message }, { status: 502 });
    await journal(admin, entrepriseId, geste, numero, achat.fournisseur_nom, achat.client_nom || achat.tache_titre, nomMoi, note);
    return Response.json({ ok: true, source: "achat" });
  }

  // 1 bis. PIÈCE CLIENT commandée en ramassage (snippet 154) — oubliée
  // jusqu'au 2026-09-22 : la tournée l'affichait, mais « Ramassé »
  // répondait « introuvable ». Ramassée = REÇUE (la tâche de retour se
  // débloque) ; « pas prêt » = au journal seulement.
  const { data: pieces } = await admin
    .from("pieces_commandees")
    .select("id, numero_bc, ramasse_par, statut, piece_requise, client_nom, fournisseur_nom")
    .eq("entreprise_id", entrepriseId)
    .eq("numero_bc", numero)
    .limit(5);
  const piece = (pieces || []).find((p) => p.statut !== "annulee") || null;
  if (piece) {
    if (String(piece.ramasse_par || "").toLowerCase() !== moi) {
      return Response.json({ erreur: "Ce bon n'est pas dans ta tournée." }, { status: 403 });
    }
    if (geste === "ramasse" && piece.statut !== "recue") {
      const { error } = await admin
        .from("pieces_commandees")
        .update({ statut: "recue", recu_le: quand, recu_par_nom: nomMoi, recu_via: "manuel" }) // contrainte : manuel | quickbooks
        .eq("id", piece.id);
      if (error) return Response.json({ erreur: error.message }, { status: 502 });
    }
    await journal(admin, entrepriseId, geste, numero, piece.fournisseur_nom, `🔧 ${piece.piece_requise || "pièce"}${piece.client_nom ? ` — ${piece.client_nom}` : ""}`, nomMoi, `${note}${photo ? ` 📷 ${photo}` : ""}`.trim());
    return Response.json({ ok: true, source: "piece" });
  }

  // 2. Bon de commande d'un projet (JSON).
  const { data: projets } = await admin
    .from("projets_app")
    .select("id, nom, bons_commande")
    .eq("entreprise_id", entrepriseId)
    .limit(500);
  const projet = (projets || []).find((p) => (p.bons_commande || []).some((b) => b.numeroBC === numero));
  if (!projet) return Response.json({ erreur: "Bon de commande introuvable." }, { status: 404 });
  const bc = (projet.bons_commande || []).find((b) => b.numeroBC === numero);
  if (String(bc.ramassePar || "").toLowerCase() !== moi) {
    return Response.json({ erreur: "Ce bon n'est pas dans ta tournée." }, { status: 403 });
  }
  const bonsMaj = (projet.bons_commande || []).map((b) =>
    b.numeroBC === numero
      ? {
          ...b,
          ramassageNote: [b.ramassageNote, ligneNote].filter(Boolean).join("\n"),
          ...(geste === "ramasse" ? { statut: "Reçu", recuLe: quand } : {}),
        }
      : b
  );
  const { error } = await admin.from("projets_app").update({ bons_commande: bonsMaj }).eq("id", projet.id);
  if (error) return Response.json({ erreur: error.message }, { status: 502 });
  await journal(admin, entrepriseId, geste, numero, bc.fournisseur, `🏗️ ${projet.nom}`, nomMoi, note);
  return Response.json({ ok: true, source: "projet" });
}

async function journal(admin, entrepriseId, geste, numero, fournisseur, pour, qui, note) {
  const texte =
    geste === "ramasse"
      ? `🚚 BC ${numero}${fournisseur ? ` (${fournisseur})` : ""} RAMASSÉ par ${qui}${pour ? ` — pour ${pour}` : ""}${note ? ` — ${note}` : ""}.`
      : `⚠️ BC ${numero}${fournisseur ? ` (${fournisseur})` : ""} PAS PRÊT au ramassage — ${qui} : ${note}${pour ? ` (pour ${pour})` : ""}. Le bon reste à ramasser.`;
  try {
    await admin.from("journal_activite").insert({ entreprise_id: entrepriseId, created_by: null, texte });
  } catch {
    // le journal n'est jamais bloquant
  }
}
