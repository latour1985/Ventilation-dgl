// components/TermesConditions.jsx
//
// Bloc « Termes et conditions générales » affiché en bas des documents
// client (devis, facture, bon de travail). Contenu statique validé avec
// l'entreprise. Styles volontairement compacts (fine print) pour tenir
// dans les aperçus de documents (largeur max-w-md).
//
// Props :
//  - signature : bool — affiche une ligne « Signature du client / Date »
//                sous les conditions (utilisé sur le devis).

export default function TermesConditions({ signature = false }) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
        Termes et conditions générales — Ventilation DGL inc.
      </p>

      <ol className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-600">
        <li>
          <span className="font-bold text-slate-800">1. Validité du prix.</span>{" "}
          Les prix indiqués sur nos devis sont valides pour une durée de 30 jours à compter de la date
          d'émission. En raison des ajustements de prix fréquents de la part de nos distributeurs et
          fournisseurs, les tarifs seront maintenus pour une période maximale de 30 jours à la suite de
          l'acceptation formelle du devis.
        </li>

        <li>
          <span className="font-bold text-slate-800">2. Ordre des travaux et exclusions.</span>
          <ul className="mt-1 space-y-1">
            <li>
              <span className="font-semibold text-slate-700">Ordre de réalisation :</span> pour garantir la
              conformité et le bon déroulement du chantier, la séquence d'exécution s'effectue dans l'ordre
              suivant : 1. Plomberie → 2. Ventilation → 3. Électricité.
            </li>
            <li>
              <span className="font-semibold text-slate-700">Câblage électrique préalable (résidentiel seulement) :</span>{" "}
              l'installation de la ventilation doit précéder le passage des fils électriques. Si l'électricien
              intervient avant l'équipe de ventilation, des frais supplémentaires de 1 000 $ + taxes seront
              facturés en raison du ralentissement et du prolongement des travaux. Ventilation DGL inc. ne sera
              aucunement responsable en cas de bris ou de dommage aux fils électriques.
            </li>
            <li>
              <span className="font-semibold text-slate-700">Travaux exclus :</span> sauf mention explicite et
              détaillée sur le devis, tous les travaux d'électricité, de plomberie ou de menuiserie sont
              strictement exclus de notre offre de service.
            </li>
          </ul>
        </li>

        <li>
          <span className="font-bold text-slate-800">3. Responsabilité et dommages cachés.</span>{" "}
          Ventilation DGL inc. ne pourra être tenue responsable des dommages causés à des éléments ou
          structures cachés (tels que la tuyauterie, le câblage ou l'ossature) situés derrière un mur, un
          plafond ou un plancher qui n'était pas ouvert ou accessible lors de l'évaluation initiale et de
          l'établissement de la soumission.
        </li>

        <li>
          <span className="font-bold text-slate-800">4. Politiques d'annulation et de modification de rendez-vous.</span>{" "}
          Afin d'assurer la gestion et la planification efficace de nos équipes sur le terrain, les conditions
          suivantes s'appliquent :
          <ul className="mt-1 space-y-1">
            <li>
              <span className="font-semibold text-slate-700">Appels de service :</span> un préavis minimal de
              24 heures est requis pour toute annulation ou modification. À défaut de respecter ce délai, le
              dépôt versé lors de la réservation sera non remboursable et conservé à titre de frais
              d'administration et d'immobilisation de plage horaire.
            </li>
            <li>
              <span className="font-semibold text-slate-700">Travaux d'une journée complète ou plus :</span> un
              préavis minimal de 72 heures ouvrables est requis. En cas d'annulation ou de report dans un délai
              inférieur à 72 heures ouvrables, des frais fixes équivalents à 3 heures de déplacement pour 2
              techniciens au tarif régulier en vigueur seront facturés.
            </li>
          </ul>
        </li>

        <li>
          <span className="font-bold text-slate-800">5. Travaux en temps et matériel (T&amp;M).</span>{" "}
          Dans le cadre de travaux effectués en mode « temps et matériel » (facturés au taux horaire auquel
          s'ajoute le coût des matériaux), la signature du bon de travail par le client atteste de la réception
          des travaux et de son entière satisfaction à l'égard du travail accompli. En cas de demande de
          modification ultérieure ou d'omission constatée après la signature du bon de travail, tout retour sur
          place fera l'objet d'une nouvelle intervention et le client s'engage à assumer à nouveau les frais de
          déplacement minimaux ainsi que les heures de main-d'œuvre et les matériaux requis.
        </li>

        <li>
          <span className="font-bold text-slate-800">6. Litige et paiement.</span>{" "}
          Les factures sont payables selon les conditions convenues sur le devis. En cas de litige ou de défaut
          de paiement à la suite des travaux effectués, le recouvrement du solde pourra être porté devant les
          tribunaux compétents. Tous les frais judiciaires et d'avocat engagés pour la perception seront
          entièrement à la charge du client s'il est reconnu en défaut.
        </li>

        <li>
          <span className="font-bold text-slate-800">7. Intérêts sur les paiements en retard.</span>{" "}
          Si les termes de paiement ne sont pas respectés, des intérêts de 2 % par mois de retard pourront être
          facturés, pour un total de 24 % annuellement.
        </li>

        <li>
          <span className="font-bold text-slate-800">8. Preuve d'acceptation et prévalence du contrat.</span>{" "}
          L'acceptation du devis par le client — qu'elle soit effectuée par écrit, par signature électronique ou
          manuscrite, par confirmation verbale, par l'émission d'un bon de travail ou de commande, ou par toute
          autre forme de communication — constitue un consentement ferme. Le présent devis ainsi que ses termes
          et conditions priment et prévalent expressément sur tout autre document ou contrat qui pourrait être
          signé ou soumis ultérieurement par le client ou un tiers, sauf modification écrite dûment approuvée
          par Ventilation DGL inc.
        </li>

        <li>
          <span className="font-bold text-slate-800">9. Validité continue des conditions.</span>{" "}
          Les présents termes et conditions demeurent pleinement en vigueur pour l'ensemble des travaux, même
          lorsqu'ils ne sont pas reproduits sur un document émis par la suite — notamment sur la facture. Ayant
          été acceptés par le client lors de l'autorisation des travaux (signature du devis, du bon de commande
          ou du bon de travail, ou toute autre forme d'acceptation prévue à la clause 8), ils continuent de
          régir l'exécution des travaux, la facturation et le paiement, sans qu'il soit nécessaire de les
          rappeler sur chaque document subséquent.
        </li>
      </ol>

      <p className="mt-2 text-center text-[10px] italic text-slate-500">
        Merci de votre collaboration et de votre confiance.
      </p>

      {signature && (
        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <div className="h-6 border-b border-slate-300" />
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
              Signature du client
            </p>
          </div>
          <div className="flex-1">
            <div className="h-6 border-b border-slate-300" />
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">Date</p>
          </div>
        </div>
      )}
    </div>
  );
}
