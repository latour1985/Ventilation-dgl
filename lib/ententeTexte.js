// lib/ententeTexte.js
//
// L'ENTENTE DE PARTENAIRE FONDATEUR — le texte de référence, affiché à
// la PREMIÈRE CONNEXION de l'admin principal d'une entreprise cliente
// (statut fondateur), qui l'accepte en cochant — comme les termes et
// conditions des devis. La version acceptée est consignée (qui, quand,
// quelle version) sur la fiche de l'entreprise.
//
// GABARIT : pour les futurs clients réguliers, une autre version du
// texte s'ajoutera ici (VERSION différente) — même mécanique.
//
// Source : dossier-legal/entente-partenaire-fondateur.md (+ .docx pour
// la révision par l'avocat). Les trois doivent rester synchronisés.

export const VERSION_ENTENTE_FONDATEUR = "fondateur-2026-08-15";

export const ENTENTE_FONDATEUR = [
  {
    titre: "1. Objet",
    points: [
      "L'Exploitant (Ventilation DGL inc., ou l'entité qui lui succédera pour l'exploitation du logiciel) donne au Fondateur accès à son logiciel de gestion d'entreprise de services (applications bureau et mobile, « le Logiciel »), avec l'ensemble des modules disponibles, en version d'amélioration continue (« rodage »). Le Fondateur agit comme partenaire de test : il utilise le Logiciel dans ses opérations réelles et contribue à son amélioration.",
    ],
  },
  {
    titre: "2. Gratuité de la première année",
    points: [
      "Douze (12) mois gratuits à compter de la date de création du compte de l'entreprise, utilisateurs illimités pendant cette période.",
      "La gratuité comprend l'infrastructure complète : hébergement, stockage des données et des photos, envoi des courriels transactionnels, sauvegardes.",
      "En contrepartie, le Fondateur s'engage à : (a) utiliser réellement le Logiciel dans ses opérations ; (b) fournir un retour d'usage au moins une fois par mois ; (c) signaler les anomalies rencontrées. S'il cesse d'utiliser le Logiciel ou de fournir ses retours pendant plus de soixante (60) jours, l'Exploitant peut mettre fin à la gratuité après un avis écrit de quinze (15) jours.",
    ],
  },
  {
    titre: "3. Prix fondateur — 25 % à vie",
    points: [
      "Au terme de la première année, l'abonnement devient payant au tarif fondateur : rabais de vingt-cinq pour cent (25 %) à vie sur le prix régulier en vigueur, applicable à la fois au forfait mensuel de base et au prix par utilisateur supplémentaire.",
      "Le prix régulier peut être ajusté annuellement par l'Exploitant sur préavis de trente (30) jours ; le rabais de 25 % s'applique alors au prix ajusté.",
      "Le tarif fondateur demeure acquis tant que l'abonnement reste actif et sans interruption. En cas de résiliation puis de retour, le tarif régulier s'applique.",
      "La facturation est mensuelle, par débit préautorisé ou tout autre mode convenu. Le premier mois civil suivant l'activation d'un utilisateur supplémentaire se facture au prorata des jours restants.",
    ],
  },
  {
    titre: "4. Propriété intellectuelle — interdiction de copie",
    points: [
      "Le Logiciel — son code, ses interfaces, sa structure, ses écrans, ses règles de calcul, sa documentation — est et demeure la propriété exclusive de l'Exploitant. La présente entente ne confère au Fondateur qu'un droit d'utilisation, non exclusif et non transférable.",
      "Le Fondateur s'engage à ne pas copier, reproduire, décompiler, désosser (rétro-ingénierie), traduire ni adapter le Logiciel, en tout ou en partie, ni à faire développer — par lui-même ou par un tiers — un logiciel substantiellement semblable au Logiciel, ni à aider ou renseigner un tiers à cette fin.",
      "Sanction convenue : en cas de violation, le Fondateur reconnaît que l'Exploitant pourra, en plus de tout autre recours (dommages-intérêts, injonction) : (a) résilier la présente entente sans préavis ; (b) réclamer la totalité des revenus générés par toute application issue d'une copie ou présentant une ressemblance substantielle avec le Logiciel, à titre de restitution des profits ; (c) exercer tout recours judiciaire utile devant les tribunaux compétents.",
      "La présente clause survit à la fin de l'entente, quelle qu'en soit la cause.",
    ],
  },
  {
    titre: "5. Confidentialité",
    points: [
      "Le Fondateur ne divulgue pas le fonctionnement interne du Logiciel (écrans, règles, structure) à un concurrent de l'Exploitant ni à un développeur tiers à des fins de reproduction, et n'accorde l'accès au Logiciel qu'à ses propres employés. Cette obligation survit cinq (5) ans à la fin de l'entente.",
    ],
  },
  {
    titre: "6. Données du Fondateur",
    points: [
      "Les données saisies par le Fondateur lui appartiennent. Leur protection, l'isolation entre entreprises, la conformité à la Loi 25, l'export complet et la remise en fin d'entente sont régis par l'Annexe A — Protection des données, qui fait partie intégrante de la présente entente.",
    ],
  },
  {
    titre: "7. Version en rodage — garanties limitées",
    points: [
      "Pendant la durée de l'entente, le Logiciel est fourni « tel quel » : des anomalies ou interruptions peuvent survenir. L'Exploitant effectue des sauvegardes régulières et fait des efforts raisonnables pour corriger les anomalies signalées, mais n'offre aucune garantie de disponibilité ni d'adéquation à un usage particulier. La responsabilité totale de l'Exploitant, toutes causes confondues, est limitée aux montants effectivement payés par le Fondateur au cours des douze (12) mois précédant la réclamation, et exclut tout dommage indirect (perte de profits, perte de données au-delà de la dernière sauvegarde, perte de clientèle).",
    ],
  },
  {
    titre: "8. Durée et résiliation",
    points: [
      "L'entente prend effet à l'acceptation et se poursuit tant que l'abonnement est actif.",
      "Chaque partie peut y mettre fin en tout temps sur préavis écrit de trente (30) jours.",
      "À la fin de l'entente : l'export complet des données est remis au Fondateur sans frais, puis les données sont supprimées sur demande écrite, sous réserve des délais de conservation légaux. Les clauses 4 (propriété intellectuelle) et 5 (confidentialité) survivent.",
    ],
  },
  {
    titre: "9. Dispositions générales",
    points: [
      "La présente entente et son Annexe A constituent l'entente complète entre les parties.",
      "Elle est régie par les lois du Québec ; tout litige relève des tribunaux du district judiciaire de l'Exploitant.",
      "Le Fondateur ne peut céder l'entente sans le consentement écrit de l'Exploitant.",
      "Si une clause est jugée invalide, les autres demeurent en vigueur.",
    ],
  },
];

// ------------------------------------------------------------
// ENTENTE RÉGULIÈRE — pour tout client APRÈS les 3 fondateurs.
// EXCLUSIVITÉ (décision du propriétaire) : la clause « 1 an gratuit +
// 25 % à vie » est réservée aux 3 premiers sélectionnés — elle est
// AUTOMATIQUEMENT absente de cette version, et la plateforme refuse
// d'accorder un 4e statut fondateur.
// ------------------------------------------------------------
export const VERSION_ENTENTE_REGULIERE = "reguliere-2026-08-15";

export const ENTENTE_REGULIERE = ENTENTE_FONDATEUR.map((section) => {
  if (section.titre.startsWith("2.")) {
    return {
      titre: "2. Période d'essai",
      points: [
        "Le premier mois suivant la création du compte de l'entreprise est gratuit, avec l'infrastructure complète (hébergement, stockage, courriels, sauvegardes).",
        "Une promotion de lancement peut s'appliquer ensuite, selon l'offre en vigueur au moment de l'inscription — sa durée et son rabais sont indiqués à l'entreprise avant l'acceptation.",
      ],
    };
  }
  if (section.titre.startsWith("3.")) {
    return {
      titre: "3. Tarif",
      points: [
        "Au terme de la période d'essai (et de toute promotion applicable), l'abonnement se facture au tarif régulier en vigueur : un forfait mensuel de base (incluant le nombre d'utilisateurs annoncé) plus un prix par utilisateur supplémentaire.",
        "Le tarif peut être ajusté annuellement par l'Exploitant sur préavis de trente (30) jours.",
        "La facturation est mensuelle, par débit préautorisé ou tout autre mode convenu. Le premier mois civil suivant l'activation d'un utilisateur supplémentaire se facture au prorata des jours restants.",
      ],
    };
  }
  // Le mot « Fondateur » devient « le Client » dans la version régulière.
  return {
    titre: section.titre,
    points: section.points.map((p) => p.split("le Fondateur").join("le Client").split("Le Fondateur").join("Le Client").split("du Fondateur").join("du Client").split("au Fondateur").join("au Client")),
  };
});

// La bonne version selon le statut de l'entreprise (plateforme).
export function ententePourStatut(statut) {
  if (statut === "fondateur") {
    return { titre: "Entente de partenaire fondateur", version: VERSION_ENTENTE_FONDATEUR, sections: ENTENTE_FONDATEUR };
  }
  return { titre: "Entente d'utilisation du logiciel", version: VERSION_ENTENTE_REGULIERE, sections: ENTENTE_REGULIERE };
}
