// app/api/plateforme/sieges/route.js
//
// COMPTEUR DE SIÈGES — le cœur de la facturation par utilisateur.
//
// La plateforme facture « au siège ACTIF » : un compte dont l'invitation
// a été acceptée (au moins une connexion). Une fiche sans compte = un
// contact, gratuit. Ces informations vivent dans Supabase Auth, que le
// navigateur ne peut pas lire — d'où cette route service.
//
// SÉCURITÉ : réservée aux comptes portant le SCEAU PLATEFORME
// (app_metadata, scellé serveur — snippet 51). Elle retourne le MINIMUM
// pour facturer : courriel, entreprise, dates d'activation/connexion —
// jamais de contenu d'entreprise (minimisation Loi 25).
//
// AVANT LE GRAND SOIR : les comptes ne portent pas encore leur
// entreprise_id — tout le monde est « dgl ». La route est déjà prête
// pour l'après : elle lit app_metadata.entreprise_id dès qu'il existera.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (utilisateur.app_metadata?.plateforme !== true) {
    return Response.json({ erreur: "Réservé à la plateforme." }, { status: 403 });
  }

  try {
    const admin = clientSupabaseService();
    // Tous les comptes (paginé — bien au-delà des besoins actuels).
    const comptes = [];
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      comptes.push(...(data?.users || []));
      if (!data?.users || data.users.length < 200 || page >= 10) break;
      page++;
    }

    // Par entreprise : la liste minimale pour facturer.
    const parEntreprise = {};
    for (const c of comptes) {
      const entrepriseId = c.app_metadata?.entreprise_id || "dgl";
      (parEntreprise[entrepriseId] = parEntreprise[entrepriseId] || []).push({
        email: c.email,
        role: c.user_metadata?.role || null,
        // ACTIF = s'est connecté au moins une fois (règle du propriétaire).
        actif: !!c.last_sign_in_at,
        // Date d'ACTIVATION (invitation acceptée) — c'est elle qui sert
        // au PRORATA du premier mois.
        activeLe: c.email_confirmed_at || c.created_at || null,
      });
    }
    return Response.json({ sieges: parEntreprise });
  } catch (e) {
    return Response.json({ erreur: String(e?.message || "Lecture des comptes impossible.") }, { status: 502 });
  }
}
