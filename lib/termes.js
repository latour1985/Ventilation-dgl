// lib/termes.js
//
// ============================================================
// TERMES ET CONDITIONS GÉNÉRALES — LA SOURCE UNIQUE (2026-08-24)
// ------------------------------------------------------------
// Demande du propriétaire : le client doit pouvoir lire TOUTES les
// conditions AVANT de payer son dépôt — « le client ne peut pas être
// au courant après avoir fait les travaux ». Le texte vivait figé dans
// un composant React (components/TermesConditions.jsx) : impossible à
// mettre dans un courriel sans le recopier, et deux copies d'un texte
// LÉGAL finissent toujours par diverger.
//
// Ici : les clauses en DONNÉES. Trois consommateurs, un seul texte :
//   • components/TermesConditions.jsx — devis, factures, bons (aperçus)
//   • termesHtmlCourriel() — le courriel de demande de dépôt
//   • app/conditions/page.js — la page publique /conditions (liée
//     depuis la facture QuickBooks, dont le message est trop court
//     pour porter dix clauses)
//
// ⚠️ Toute modification ici change les TROIS d'un coup — c'est voulu.
// Contenu validé avec l'entreprise ; harmonisation avocat à venir.
// ============================================================

export const TERMES_TITRE = "Termes et conditions générales — Ventilation DGL inc.";

export const TERMES_CLAUSES = [
  {
    titre: "1. Validité du prix.",
    texte:
      "Les prix indiqués sur nos devis sont valides pour une durée de 30 jours à compter de la date " +
      "d'émission. En raison des ajustements de prix fréquents de la part de nos distributeurs et " +
      "fournisseurs, les tarifs seront maintenus pour une période maximale de 30 jours à la suite de " +
      "l'acceptation formelle du devis.",
  },
  {
    titre: "2. Ordre des travaux et exclusions.",
    texte: "",
    points: [
      {
        label: "Ordre de réalisation :",
        texte:
          "pour garantir la conformité et le bon déroulement du chantier, la séquence d'exécution " +
          "s'effectue dans l'ordre suivant : 1. Plomberie → 2. Ventilation → 3. Électricité.",
      },
      {
        label: "Câblage électrique préalable (résidentiel seulement) :",
        texte:
          "l'installation de la ventilation doit précéder le passage des fils électriques. Si l'électricien " +
          "intervient avant l'équipe de ventilation, des frais supplémentaires de 1 000 $ + taxes seront " +
          "facturés en raison du ralentissement et du prolongement des travaux. Ventilation DGL inc. ne sera " +
          "aucunement responsable en cas de bris ou de dommage aux fils électriques.",
      },
      {
        label: "Travaux exclus :",
        texte:
          "sauf mention explicite et détaillée sur le devis, tous les travaux d'électricité, de plomberie " +
          "ou de menuiserie sont strictement exclus de notre offre de service.",
      },
      {
        // Ajout du 2026-09-02 (demande du propriétaire) : les conduits
        // sous dalle exigent une tranchée — le creusage appartient à
        // l'excavateur ou au client, jamais à l'équipe de ventilation.
        label: "Excavation :",
        texte:
          "l'excavation, le creusage et le remblayage requis pour le passage de conduits sous dalle ne sont " +
          "pas inclus et demeurent la responsabilité du client, sauf mention explicite et détaillée sur le devis.",
      },
    ],
  },
  {
    titre: "3. Responsabilité et dommages cachés.",
    texte:
      "Ventilation DGL inc. ne pourra être tenue responsable des dommages causés à des éléments ou " +
      "structures cachés (tels que la tuyauterie, le câblage ou l'ossature) situés derrière un mur, un " +
      "plafond ou un plancher qui n'était pas ouvert ou accessible lors de l'évaluation initiale et de " +
      "l'établissement de la soumission.",
  },
  {
    titre: "4. Politiques d'annulation et de modification de rendez-vous.",
    texte:
      "Afin d'assurer la gestion et la planification efficace de nos équipes sur le terrain, les conditions " +
      "suivantes s'appliquent :",
    points: [
      {
        label: "Appels de service :",
        texte:
          "un préavis minimal de 24 heures est requis pour toute annulation ou modification. À défaut de " +
          "respecter ce délai, le dépôt versé lors de la réservation sera non remboursable et conservé à " +
          "titre de frais d'administration et d'immobilisation de plage horaire.",
      },
      {
        label: "Travaux d'une journée complète ou plus :",
        texte:
          "un préavis minimal de 72 heures ouvrables est requis. En cas d'annulation ou de report dans un " +
          "délai inférieur à 72 heures ouvrables, des frais fixes équivalents à 3 heures de déplacement " +
          "pour 2 techniciens au tarif régulier en vigueur seront facturés.",
      },
    ],
  },
  {
    titre: "5. Travaux en temps et matériel (T&M).",
    texte:
      "Dans le cadre de travaux effectués en mode « temps et matériel » (facturés au taux horaire auquel " +
      "s'ajoute le coût des matériaux), la signature du bon de travail par le client atteste de la réception " +
      "des travaux et de son entière satisfaction à l'égard du travail accompli. En cas de demande de " +
      "modification ultérieure ou d'omission constatée après la signature du bon de travail, tout retour sur " +
      "place fera l'objet d'une nouvelle intervention et le client s'engage à assumer à nouveau les frais de " +
      "déplacement minimaux ainsi que les heures de main-d'œuvre et les matériaux requis.",
  },
  {
    titre: "6. Litige et paiement.",
    texte:
      "Les factures sont payables selon les conditions convenues sur le devis. En cas de litige ou de défaut " +
      "de paiement à la suite des travaux effectués, le recouvrement du solde pourra être porté devant les " +
      "tribunaux compétents. Tous les frais judiciaires et d'avocat engagés pour la perception seront " +
      "entièrement à la charge du client s'il est reconnu en défaut.",
  },
  {
    titre: "7. Intérêts sur les paiements en retard.",
    texte:
      "Si les termes de paiement ne sont pas respectés, des intérêts de 2 % par mois de retard pourront " +
      "être facturés, pour un total de 24 % annuellement.",
  },
  {
    titre: "8. Preuve d'acceptation et prévalence du contrat.",
    texte:
      "L'acceptation du devis par le client — qu'elle soit effectuée par écrit, par signature électronique " +
      "ou manuscrite, par confirmation verbale, par l'émission d'un bon de travail ou de commande, ou par " +
      "toute autre forme de communication — constitue un consentement ferme. Le présent devis ainsi que ses " +
      "termes et conditions priment et prévalent expressément sur tout autre document ou contrat qui " +
      "pourrait être signé ou soumis ultérieurement par le client ou un tiers, sauf modification écrite " +
      "dûment approuvée par Ventilation DGL inc.",
  },
  {
    titre: "9. Validité continue des conditions.",
    texte:
      "Les présents termes et conditions demeurent pleinement en vigueur pour l'ensemble des travaux, même " +
      "lorsqu'ils ne sont pas reproduits sur un document émis par la suite — notamment sur la facture. Ayant " +
      "été acceptés par le client lors de l'autorisation des travaux (signature du devis, du bon de commande " +
      "ou du bon de travail, ou toute autre forme d'acceptation prévue à la clause 8), ils continuent de " +
      "régir l'exécution des travaux, la facturation et le paiement, sans qu'il soit nécessaire de les " +
      "rappeler sur chaque document subséquent.",
  },
  {
    titre: "10. Absence du client à la fin des travaux et instructions verbales.",
    texte:
      "Lorsque le client, ou son représentant, est absent des lieux au moment où les travaux sont terminés " +
      "et ne peut signer le bon de travail, les travaux sont réputés reçus et exécutés conformément aux " +
      "instructions données, y compris les instructions verbales. Le client demeure entièrement responsable " +
      "de la clarté et de l'exactitude des instructions transmises à nos employés ; Ventilation DGL inc. ne " +
      "pourra être tenue responsable d'une interprétation découlant d'instructions verbales, incomplètes ou " +
      "transmises par un intermédiaire, dès lors que le client n'était pas présent pour valider le résultat " +
      "avant le départ de l'équipe. Toute visite de retour demandée à la suite de ces travaux — notamment " +
      "pour un ajustement ou une modification ne résultant pas d'une faute de l'entreprise — constituera une " +
      "nouvelle intervention facturable, comprenant le temps de transport ainsi que le temps sur place, pour " +
      "un minimum de trois (3) heures au tarif régulier en vigueur.",
  },
];

export const TERMES_MERCI = "Merci de votre collaboration et de votre confiance.";

// Échappement minimal pour du HTML de courriel (les textes viennent de
// NOUS, pas d'un utilisateur — mais « T&M » casserait sans lui).
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ------------------------------------------------------------
// LES DIX CLAUSES EN HTML DE COURRIEL — styles en ligne seulement
// (les clients courriel ignorent les feuilles de style). Petit et
// gris : c'est du « fine print », mais du fine print COMPLET.
// ------------------------------------------------------------
export function termesHtmlCourriel() {
  const clause = (c) =>
    `<li style="margin:0 0 8px;">` +
    `<span style="font-weight:bold;color:#1e293b;">${esc(c.titre)}</span>` +
    (c.texte ? ` ${esc(c.texte)}` : "") +
    (c.points && c.points.length
      ? `<ul style="margin:4px 0 0;padding-left:16px;">` +
        c.points
          .map(
            (p) =>
              `<li style="margin:0 0 4px;"><span style="font-weight:600;color:#334155;">${esc(p.label)}</span> ${esc(p.texte)}</li>`
          )
          .join("") +
        `</ul>`
      : "") +
    `</li>`;
  return (
    `<div style="margin:16px 0 0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.4px;color:#64748b;">${esc(TERMES_TITRE)}</p>` +
    `<ol style="margin:0;padding-left:16px;font-size:11px;line-height:1.55;color:#475569;">` +
    TERMES_CLAUSES.map(clause).join("") +
    `</ol>` +
    `<p style="margin:8px 0 0;text-align:center;font-size:11px;font-style:italic;color:#64748b;">${esc(TERMES_MERCI)}</p>` +
    `</div>`
  );
}
