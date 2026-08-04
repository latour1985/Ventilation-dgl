// lib/permissions.js
//
// Modèle de rôles et de permissions (partagé admin + technicien).
// Depuis 2026-07-29 : le personnel de bureau est regroupé sous UN rôle
// « Administration bureau », précisé par une SOUS-CATÉGORIE (= métier de
// bureau) qui fixe ses accès par défaut. Les anciens rôles autonomes
// « Chargé de projet » et « Répartiteur » sont hérités : les comptes qui
// les portent encore sont automatiquement traités comme
// « Administration bureau » avec la sous-catégorie correspondante.
//
// Le rôle de l'utilisateur connecté est lu dans son "user_metadata.role"
// côté Supabase Auth (défini par l'admin principal). À défaut : Admin principal.

export const ROLES = ["Admin principal", "Admin régulier", "Administration bureau", "Technicien"];

// Anciens rôles autonomes — encore reconnus (comptes existants), mais
// plus proposés dans les listes : ils vivent maintenant comme
// sous-catégories d'« Administration bureau ».
export const ROLES_HERITES = ["Chargé de projet", "Répartiteur"];

// Sous-catégories d'« Administration bureau » — ce sont les métiers de
// bureau du répertoire : choisir la sous-catégorie fixe le métier ET les
// accès par défaut d'un seul geste.
export const SOUS_CATEGORIES_BUREAU = ["Adjointe administrative", "Chargé de projet", "Estimateur", "Répartiteur", "Directeur"];

// Ordre d'affichage des sections (onglets admin + l'app technicien).
export const ORDRE_SECTIONS = [
  "tableau-de-bord",
  "recherche",
  "clients",
  "projets",
  "devis",
  "agenda",
  "facturation",
  "inspections",
  "pieces",
  "paies",
  "tarifs",
  "parametres",
  "utilisateurs",
  "technicien",
];

// Accès par défaut de chaque SOUS-CATÉGORIE de bureau (validés avec le
// propriétaire) — modifiables ensuite au cas par cas (cases à cocher).
export const PERMISSIONS_PAR_SOUS_CATEGORIE = {
  "Adjointe administrative": ["tableau-de-bord", "clients", "devis", "facturation"],
  "Chargé de projet": ["tableau-de-bord", "projets", "agenda", "pieces", "technicien"], // agenda en LECTURE SEULE (couche 2)
  "Estimateur": ["tableau-de-bord", "clients", "devis", "projets"],
  // Répartiteur : agenda modifiable mais sans prix (couche 2) + « Heures
  // de la semaine » pour AJUSTER les heures des techniciens (ses
  // ajustements restent des PROPOSITIONS à valider par un admin).
  "Répartiteur": ["clients", "agenda", "inspections", "pieces", "paies"],
  "Directeur": ["tableau-de-bord", "recherche", "clients", "projets", "devis", "agenda", "facturation", "inspections", "pieces", "paies", "tarifs", "utilisateurs"],
};

// Accès par défaut de chaque rôle.
export const PERMISSIONS_DEFAUT = {
  "Admin principal": ["tableau-de-bord", "recherche", "clients", "projets", "devis", "agenda", "facturation", "inspections", "pieces", "paies", "tarifs", "parametres", "utilisateurs", "technicien"],
  "Admin régulier": ["tableau-de-bord", "recherche", "clients", "projets", "devis", "agenda", "facturation", "inspections", "pieces", "paies", "tarifs", "utilisateurs"],
  // Sans sous-catégorie précisée, « Administration bureau » démarre avec
  // les accès de la première sous-catégorie (adjointe administrative).
  "Administration bureau": ["tableau-de-bord", "clients", "devis", "facturation"],
  "Technicien": ["technicien"],
  // Héritage — anciens rôles autonomes :
  "Chargé de projet": ["tableau-de-bord", "projets", "agenda", "technicien"],
  "Répartiteur": ["clients", "agenda", "inspections", "paies"],
};

// Libellés affichés dans l'écran de gestion des accès (cases à cocher).
export const LIBELLES_SECTIONS = {
  "tableau-de-bord": "Tableau de bord",
  "recherche": "Recherche",
  "clients": "Clients",
  "projets": "Projets",
  "devis": "Devis",
  "agenda": "Agenda",
  "facturation": "Facturation",
  "inspections": "Véhicules / Inspections",
  "pieces": "Pièces en commande",
  "paies": "Heures de la semaine",
  "tarifs": "Tarifs",
  "parametres": "Paramètres",
  "utilisateurs": "Utilisateurs",
  "technicien": "App technicien",
};

// ============================================================
// AUTORISATIONS PARTICULIÈRES — des DROITS D'ACTION, pas des pages
// ------------------------------------------------------------
// Les sections ci-dessus sont des ONGLETS : on les coche, la personne
// voit la page. « Modifier la liste de prix » est différent : c'est un
// droit à l'intérieur d'une page. Quelqu'un peut avoir besoin de monter
// des devis sans pouvoir changer les prix de référence de l'entreprise.
//
// Elles sont RANGÉES DANS LA MÊME COLONNE `sections` en base (aucun SQL
// à ajouter), mais tenues hors d'ORDRE_SECTIONS : cette liste sert à
// décider quelle PAGE ouvrir, et y glisser une non-page finirait par
// afficher un écran vide.
export const AUTORISATIONS = ["modifier-liste-prix"];

export const LIBELLES_AUTORISATIONS = {
  "modifier-liste-prix": "Modifier la liste de prix",
};

export const AIDES_AUTORISATIONS = {
  "modifier-liste-prix":
    "Permet de mettre à jour un prix du catalogue depuis un devis. Sans ce droit, le prix saisi ne vaut que pour le devis en cours.",
};

// Seuls les deux rôles d'administration peuvent porter une autorisation.
export const ROLES_AVEC_AUTORISATIONS = ["Admin principal", "Admin régulier"];

// L'Admin principal les a TOUTES, sans avoir à les cocher : c'est le
// propriétaire, et ça évite une migration pour les comptes existants
// dont la liste de sections est déjà enregistrée.
export function aAutorisation(role, sections, cle) {
  if (role === "Admin principal") return true;
  if (!ROLES_AVEC_AUTORISATIONS.includes(role)) return false;
  return Array.isArray(sections) && sections.includes(cle);
}

export function permissionsPour(role, sousCategorie) {
  if (role === "Administration bureau" && PERMISSIONS_PAR_SOUS_CATEGORIE[sousCategorie]) {
    return PERMISSIONS_PAR_SOUS_CATEGORIE[sousCategorie];
  }
  return PERMISSIONS_DEFAUT[role] || PERMISSIONS_DEFAUT["Admin principal"];
}

// Normalise un rôle brut (métadonnées ou table) : les anciens rôles
// autonomes deviennent « Administration bureau » + leur sous-catégorie.
function normaliserRole(roleBrut, sousCategorieBrute) {
  if (ROLES_HERITES.includes(roleBrut)) {
    return { role: "Administration bureau", sousCategorie: roleBrut };
  }
  if (ROLES.includes(roleBrut)) {
    return {
      role: roleBrut,
      sousCategorie:
        roleBrut === "Administration bureau" && SOUS_CATEGORIES_BUREAU.includes(sousCategorieBrute)
          ? sousCategorieBrute
          : null,
    };
  }
  return null;
}

// Permissions effectives : accès personnalisés (table permissions_utilisateurs)
// s'ils existent, sinon les défauts du rôle (métadonnées). Retourne
// { role, sousCategorie, sections }.
export function permissionsEffectives(accesPerso, session) {
  const depuisTable = normaliserRole(accesPerso?.role, accesPerso?.sous_categorie);
  const normalise = depuisTable || normaliserRole(session?.user?.user_metadata?.role) || { role: "Admin principal", sousCategorie: null };
  // ADMIN PRINCIPAL : toujours TOUS les onglets, peu importe la liste
  // enregistrée. C'est le propriétaire — et sans cette règle, chaque
  // NOUVEL onglet ajouté à l'application restait invisible pour lui,
  // parce que sa liste d'accès en base datait d'avant l'onglet (c'est
  // arrivé deux fois : Paramètres, puis Pièces en commande). Ses
  // autorisations particulières (ex. modifier-liste-prix) ne passent pas
  // par ici : aAutorisation() répond déjà « oui » pour ce rôle.
  if (normalise.role === "Admin principal") {
    return { role: normalise.role, sousCategorie: normalise.sousCategorie, sections: PERMISSIONS_DEFAUT["Admin principal"] };
  }
  // Une liste de sections EXPLICITE est respectée telle quelle — y
  // compris VIDE (= aucun accès : fiche supprimée / accès révoqués).
  // Seule une liste absente (null) retombe sur les défauts du rôle.
  const sections = Array.isArray(accesPerso?.sections)
    ? accesPerso.sections
    : permissionsPour(normalise.role, normalise.sousCategorie);
  return { role: normalise.role, sousCategorie: normalise.sousCategorie, sections };
}

export function aAcces(role, section) {
  return permissionsPour(role).includes(section);
}

// Rôle de l'utilisateur connecté (depuis Supabase Auth), avec repli sûr.
export function rolePour(session) {
  const normalise = normaliserRole(session?.user?.user_metadata?.role);
  return normalise ? normalise.role : "Admin principal";
}
