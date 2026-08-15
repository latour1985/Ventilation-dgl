// app/confidentialite/page.jsx
//
// POLITIQUE DE CONFIDENTIALITÉ — obligation de la Loi 25 (Québec) :
// publiée en termes simples, accessible sans connexion. BROUILLON
// rédigé pour révision par le propriétaire — le responsable désigné —
// avant d'inviter toute entreprise cliente.

export const metadata = { title: "Politique de confidentialité — Ventilation DGL" };

export default function Confidentialite() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 md:p-10">
        <h1 className="text-xl font-extrabold text-slate-900">Politique de confidentialité</h1>
        <p className="mt-1 text-xs text-slate-400">Version du 15 août 2026 · Loi 25 (Québec)</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="font-extrabold text-slate-900">1. Qui nous sommes</h2>
            <p>
              Cette application de gestion est exploitée par Ventilation DGL inc. (771 boul. Industriel,
              Blainville, Québec). Elle sert à la gestion d'entreprises de services (devis, planification,
              feuilles de temps, facturation).
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">2. Responsable de la protection des renseignements personnels</h2>
            <p>
              Jean-François Latour — <span className="font-semibold">jeanfrancois@ventilationdgl.com</span>. Toute
              question, demande d'accès, de rectification ou de retrait de renseignements personnels lui est adressée.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">3. Ce que nous recueillons, et pourquoi</h2>
            <p>Uniquement ce qui sert à la gestion des opérations :</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><span className="font-semibold">Employés des entreprises utilisatrices</span> : nom, courriel, téléphone, métier et niveau, heures travaillées, inspections de véhicules — pour la planification et la paie.</li>
              <li><span className="font-semibold">Clients des entreprises utilisatrices</span> : nom, coordonnées, adresses des travaux, équipements — pour les devis, la réalisation des travaux et la facturation.</li>
              <li><span className="font-semibold">Photos de chantier</span> : prises par les techniciens pour documenter les travaux.</li>
            </ul>
            <p className="mt-1">Aucune donnée n'est vendue, louée ni utilisée à des fins publicitaires.</p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">4. Qui voit quoi</h2>
            <p>
              L'accès suit le principe du minimum nécessaire : chaque rôle ne voit que ce que son travail exige
              (un technicien ne voit pas les prix ; un répartiteur ne voit pas les salaires). Chaque entreprise
              utilisatrice ne voit que SES données — l'isolation est appliquée par la base de données elle-même.
              L'exploitant de la plateforme ne consulte pas le contenu des entreprises clientes ; ses accès de
              support sont explicites et consignés.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">5. Où vivent les données</h2>
            <p>
              Les données sont hébergées de façon chiffrée chez nos fournisseurs infonuagiques (Supabase et Vercel),
              dont les serveurs peuvent être situés à l'extérieur du Québec. Une évaluation des facteurs relatifs à
              la vie privée encadre cette communication, et des protections contractuelles s'appliquent.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">6. Vos droits</h2>
            <p>
              Toute personne peut demander l'accès à ses renseignements, leur rectification ou leur retrait en
              écrivant au responsable (article 2). Chaque entreprise utilisatrice demeure propriétaire de ses
              données et peut en obtenir l'export complet, ou leur suppression, sur demande.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">7. Incidents</h2>
            <p>
              Tout incident de confidentialité est consigné à un registre. En cas de risque de préjudice sérieux,
              la Commission d'accès à l'information et les personnes concernées sont notifiées, conformément à la loi.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-slate-900">8. Conservation</h2>
            <p>
              Les données sont conservées tant que l'entreprise utilisatrice est cliente, puis supprimées ou
              remises sur demande. Les documents à valeur légale ou comptable (devis signés, factures) suivent les
              délais de conservation prescrits par les lois fiscales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
