# Évaluation des facteurs relatifs à la vie privée (EFVP)
## Communication de renseignements personnels hors Québec — hébergement infonuagique

> Document exigé par la Loi 25 (art. 17, LPRPSP) avant de communiquer des
> renseignements personnels à l'extérieur du Québec. À conserver au dossier
> de l'entreprise. Rédigé le 15 août 2026 — à réviser par le responsable.

**Responsable de la protection des renseignements personnels :** Jean-François Latour, jeanfrancois@ventilationdgl.com

## 1. Le projet

Application de gestion pour entreprises de services (planification, feuilles de temps, devis,
facturation), exploitée par Ventilation DGL inc. et offerte à des entreprises clientes.

## 2. Renseignements personnels concernés

- Employés des entreprises utilisatrices : identité, coordonnées, métier/niveau, heures
  travaillées (paie), inspections de véhicules.
- Clients des entreprises utilisatrices : identité, coordonnées, adresses, équipements.
- Photos de chantier.

Sensibilité : modérée (aucune donnée bancaire, médicale ou biométrique ; les paiements sont
traités par QuickBooks/Intuit, jamais stockés par l'application).

## 3. Où les renseignements sont communiqués

| Fournisseur | Rôle | Localisation | Protections |
|---|---|---|---|
| Supabase (AWS) | Base de données, authentification, stockage des photos | États-Unis | Chiffrement en transit (TLS) et au repos ; contrat de traitement des données (DPA) ; clauses contractuelles types |
| Vercel | Hébergement de l'application | États-Unis (réseau mondial) | Chiffrement TLS ; DPA |
| Resend | Envoi de courriels transactionnels | États-Unis | DPA ; seuls les courriels transitent |
| Intuit (QuickBooks) | Comptabilité des entreprises utilisatrices | Canada/États-Unis | Connexion OAuth consentie par chaque entreprise ; Intuit est son propre responsable |

## 4. Évaluation

- **Nécessité** : l'hébergement infonuagique est nécessaire au service (application web
  accessible du terrain). Aucune alternative québécoise équivalente n'a été retenue au
  lancement ; la région canadienne de Supabase (Montréal) est identifiée comme option de
  migration si un client l'exige ou si le volume le justifie.
- **Proportionnalité** : seuls les renseignements utiles aux opérations sont recueillis
  (minimisation appliquée par conception — voir politique de confidentialité, art. 3-4).
- **Protections techniques** : chiffrement systématique ; isolation par entreprise appliquée
  par la base de données (RLS) ; accès par rôles au minimum nécessaire ; journalisation.
- **Conclusion** : les renseignements bénéficient d'une protection adéquate, équivalente en
  pratique à celle exigée au Québec. La communication hors Québec est acceptable avec les
  protections contractuelles en place.

## 5. Réévaluation

À refaire : (a) avant tout nouveau fournisseur recevant des renseignements personnels ;
(b) si la sensibilité des données change ; (c) au plus tard 12 mois après l'entrée du
premier client payant.

*Signé : ______________________ Date : ____________*
