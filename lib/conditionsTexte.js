// lib/conditionsTexte.js
//
// LES TERMES ET CONDITIONS EN TEXTE BRUT, avec une VERSION.
//
// Pourquoi ce fichier existe : quand un client accepte un devis, on
// enregistre le texte EXACT qu'il a lu ce jour-là. Si les clauses
// changent dans deux ans, on pourra encore prouver ce qui lui a été
// montré — pas la version courante.
//
// Sans ça, « il ne pourra pas dire qu'il n'a pas été avisé » reste une
// affirmation ; avec, c'est une pièce au dossier.
//
// ⚠️ EN MODIFIANT UNE CLAUSE, CHANGE AUSSI LA VERSION ci-dessous.
// Les acceptations déjà enregistrées gardent leur propre copie : elles
// ne sont jamais réécrites.

export const VERSION_CONDITIONS = "2026-08-06";

export const CONDITIONS_TEXTE = `TERMES ET CONDITIONS GÉNÉRALES

1. Validité du prix.
Les prix indiqués sur nos devis sont valides pour une durée de 30 jours à compter de la date d'émission. En raison des ajustements de prix fréquents de la part de nos distributeurs et fournisseurs, les tarifs seront maintenus pour une période maximale de 30 jours à la suite de l'acceptation formelle du devis.

2. Ordre des travaux et exclusions.
Ordre de réalisation : pour garantir la conformité et le bon déroulement du chantier, la séquence d'exécution s'effectue dans l'ordre suivant : 1. Plomberie, 2. Ventilation, puis 3. Électricité.
Câblage électrique préalable (résidentiel seulement) : l'installation de la ventilation doit précéder le passage des fils électriques. Si l'électricien intervient avant l'équipe de ventilation, des frais supplémentaires de 1 000 $ + taxes seront facturés en raison du ralentissement et du prolongement des travaux. L'entreprise ne sera aucunement responsable en cas de bris ou de dommage aux fils électriques.
Travaux exclus : sauf mention explicite et détaillée sur le devis, tous les travaux d'électricité, de plomberie ou de menuiserie sont strictement exclus de notre offre de service.

3. Responsabilité et dommages cachés.
L'entreprise ne pourra être tenue responsable des dommages causés à des éléments ou structures cachés (tels que la tuyauterie, le câblage ou l'ossature) situés derrière un mur, un plafond ou un plancher qui n'était pas ouvert ou accessible lors de l'évaluation initiale et de l'établissement de la soumission.

4. Politiques d'annulation et de modification de rendez-vous.
Appels de service : un préavis minimal de 24 heures est requis pour toute annulation ou modification. À défaut de respecter ce délai, le dépôt versé lors de la réservation sera non remboursable et conservé à titre de frais d'administration et d'immobilisation de plage horaire.
Travaux d'une journée complète ou plus : un préavis minimal de 72 heures ouvrables est requis. En cas d'annulation ou de report dans un délai inférieur à 72 heures ouvrables, des frais fixes équivalents à 3 heures de déplacement pour 2 techniciens au tarif régulier en vigueur seront facturés.

5. Travaux en temps et matériel (T&M).
Dans le cadre de travaux effectués en mode « temps et matériel » (facturés au taux horaire auquel s'ajoute le coût des matériaux), la signature du bon de travail par le client atteste de la réception des travaux et de son entière satisfaction à l'égard du travail accompli. En cas de demande de modification ultérieure ou d'omission constatée après la signature du bon de travail, tout retour sur place fera l'objet d'une nouvelle intervention et le client s'engage à assumer à nouveau les frais de déplacement minimaux ainsi que les heures de main-d'œuvre et les matériaux requis.

6. Litige et paiement.
Les factures sont payables selon les conditions convenues sur le devis. En cas de litige ou de défaut de paiement à la suite des travaux effectués, le recouvrement du solde pourra être porté devant les tribunaux compétents. Tous les frais judiciaires et d'avocat engagés pour la perception seront entièrement à la charge du client s'il est reconnu en défaut.

7. Intérêts sur les paiements en retard.
Si les termes de paiement ne sont pas respectés, des intérêts de 2 % par mois de retard pourront être facturés, pour un total de 24 % annuellement.

8. Preuve d'acceptation et prévalence du contrat.
L'acceptation du devis par le client — qu'elle soit effectuée par écrit, par signature électronique ou manuscrite, par confirmation verbale, par l'émission d'un bon de travail ou de commande, ou par toute autre forme de communication — constitue un consentement ferme. Le présent devis ainsi que ses termes et conditions priment et prévalent expressément sur tout autre document ou contrat qui pourrait être signé ou soumis ultérieurement par le client ou un tiers, sauf modification écrite dûment approuvée par l'entreprise.

9. Validité continue des conditions.
Les présents termes et conditions demeurent pleinement en vigueur pour l'ensemble des travaux, même lorsqu'ils ne sont pas reproduits sur un document émis par la suite — notamment sur la facture. Ayant été acceptés par le client lors de l'autorisation des travaux (signature du devis, du bon de commande ou du bon de travail, ou toute autre forme d'acceptation prévue à la clause 8), ils continuent de régir l'exécution des travaux, la facturation et le paiement, sans qu'il soit nécessaire de les rappeler sur chaque document subséquent.

10. Absence du client à la fin des travaux et instructions verbales.
Lorsque le client, ou son représentant, est absent des lieux au moment où les travaux sont terminés et ne peut signer le bon de travail, les travaux sont réputés reçus et exécutés conformément aux instructions données, y compris les instructions verbales. Le client demeure entièrement responsable de la clarté et de l'exactitude des instructions transmises à nos employés ; l'entreprise ne pourra être tenue responsable d'une interprétation découlant d'instructions verbales, incomplètes ou transmises par un intermédiaire, dès lors que le client n'était pas présent pour valider le résultat avant le départ de l'équipe. Toute visite de retour demandée à la suite de ces travaux — notamment pour un ajustement ou une modification ne résultant pas d'une faute de l'entreprise — constituera une nouvelle intervention facturable, comprenant le temps de transport ainsi que le temps sur place, pour un minimum de trois (3) heures au tarif régulier en vigueur.`;
