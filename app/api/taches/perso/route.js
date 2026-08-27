// app/api/taches/perso/route.js
//
// TÂCHES QUE LE TECHNICIEN SE CRÉE À LUI-MÊME — 🚗 course (porter le
// camion au garage, aller chercher une pièce) et 🏭 travail au shop.
//
// POURQUOI UNE ROUTE SERVEUR (diagnostic empirique du 2026-08-20) : la
// RLS interdit à un Technicien d'écrire dans `taches_assignees` — c'est
// le bureau qui planifie, et c'est très bien ainsi. Résultat : ces deux
// boutons échouaient depuis leur création pour TOUS les techniciens
// (zéro course en base, confirmé). Plutôt que d'ouvrir la table,
// la clé service écrit à leur place, avec des garde-fous stricts :
//
//   • l'employé est celui du JETON vérifié — jamais du corps de la
//     demande : personne ne peut créer une tâche au nom d'un autre ;
//   • la date est TOUJOURS aujourd'hui (heure locale du téléphone
//     transmise, règle gelée du projet : jamais toISOString) ;
//   • seuls les deux types sans client sont acceptés — aucune tâche
//     facturable ne peut naître ici.

import { clientSupabaseService, utilisateurDepuisJeton } from "@/lib/quickbooksServeur";

// 🏗️ LISTE DES PROJETS pour le sélecteur « C'est pour un projet ? » du
// travail au shop (2026-08-31, décision du propriétaire : le technicien
// peut PROPOSER le projet — le bureau CONFIRME avant que ça compte).
// Noms seulement, jamais rien de financier ; projets ni terminés ni
// annulés. La RLS bloque la table aux techniciens — la clé service lit
// pour eux ce strict minimum.
export async function GET(request) {
  const enTete = request.headers.get("authorization") || "";
  const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  const utilisateur = await utilisateurDepuisJeton(jeton);
  if (!utilisateur) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ simule: true });
  const admin = clientSupabaseService();
  const { data, error } = await admin
    .from("projets_app")
    .select("id, nom, statut")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return Response.json({ erreur: error.message }, { status: 502 });
  const projets = (data || [])
    .filter((p) => p.statut !== "Terminé" && p.statut !== "Annulé")
    .map((p) => ({ id: p.id, nom: p.nom }));
  return Response.json({ projets });
}

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

  const type = corps?.type === "shop" ? "shop" : corps?.type === "course" ? "course" : null;
  if (!type) return Response.json({ erreur: "Type inconnu." }, { status: 400 });
  const titre = String(corps?.titre || "").trim().slice(0, 200);
  if (!titre) return Response.json({ erreur: "Titre requis." }, { status: 400 });
  const note = String(corps?.note || "").trim().slice(0, 2000);
  const adresse = type === "course" ? String(corps?.adresse || "").trim().slice(0, 300) : "";

  // Jour et heure LOCAUX du téléphone (règle gelée : une date de
  // calendrier ne passe jamais par UTC). Format vérifié ; à défaut, on
  // retombe sur l'heure du serveur.
  const maintenant = new Date();
  const jourLocal = /^\d{4}-\d{2}-\d{2}$/.test(corps?.jour || "")
    ? corps.jour
    : `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
  const heureLocale = /^\d{2}:\d{2}$/.test(corps?.heure || "")
    ? corps.heure
    : `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;

  const email = (utilisateur.email || "").toLowerCase();
  const nom = utilisateur.user_metadata?.nom || email.split("@")[0];
  const prefixe = type === "shop" ? "🏭" : "🚗";
  const id = `${type}-${Date.now()}`;

  const admin = clientSupabaseService();

  // 🏗️ PROJET PROPOSÉ (shop seulement) — une PROPOSITION, jamais un
  // lien : projet_id reste null tant que le bureau n'a pas confirmé
  // (décision du propriétaire : « ça demande une vérification pour être
  // sûr que ce soit le bon projet »). L'id est vérifié contre la table —
  // un id inventé est simplement ignoré.
  let projetPropose = null;
  if (type === "shop" && corps?.projetProposeId) {
    const { data: p } = await admin
      .from("projets_app")
      .select("id, nom")
      .eq("id", String(corps.projetProposeId))
      .maybeSingle();
    if (p) projetPropose = { id: p.id, nom: p.nom };
  }
  const { error } = await admin.from("taches_assignees").upsert(
    {
      tache_id: id,
      employe_email: email,
      employe_nom: nom,
      titre: `${prefixe} ${titre}`,
      client_nom: null,
      description: note || null,
      type_tache: type,
      projet_id: null,
      date_debut: jourLocal,
      heure_debut: heureLocale,
      heures: 1,
      jours: 1,
      statut: "planifiee",
      donnees: {
        id,
        titre: `${prefixe} ${titre}`,
        typeTache: type,
        clientNom: "",
        description: note || "",
        ...(type === "course" ? { adresseIntervention: adresse, adresseTravaux: adresse, estCourse: true } : { estShop: true }),
        // Jamais de client, jamais de facturation : les heures sont
        // payées et rangées en « divers » (le coût invisible).
        nonFacturable: true,
        categorieHeures: "divers",
        secteur: "commercial",
        heures: 1,
        jours: 1,
        creeParTechnicien: nom,
        heure: heureLocale,
        ...(projetPropose
          ? { projetProposeId: projetPropose.id, projetProposeNom: projetPropose.nom, projetProposePar: nom }
          : {}),
      },
    },
    { onConflict: "tache_id,employe_email" }
  );
  if (error) return Response.json({ erreur: error.message }, { status: 502 });
  return Response.json({ id });
}
