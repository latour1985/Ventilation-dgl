# État du projet — Ventilation DGL inc.

> Ce fichier est le **briefing d'embarquement** pour une session de travail
> sur un nouvel ordinateur (ou après une longue pause). Il résume ce qui ne
> se devine pas en lisant le code. Mis à jour aux grandes étapes.
> Dernière mise à jour : 2026-08-07.

## Qui / quoi

- **Propriétaire** : Jean-François (Ventilation DGL inc., Blainville QC) — non-développeur,
  premier vrai projet. Toujours expliquer simplement, en français, étape par étape.
  Habitude validée : montrer/expliquer AVANT de construire les grosses fonctionnalités.
- **Produit** : gestion d'entreprise CVAC — application bureau (`/admin`) + application
  technicien mobile (`/technicien`) + page publique d'acceptation des devis (`/devis/[jeton]`).
- **EN PRODUCTION** : https://ventilation-dgl.vercel.app (test terrain réel en cours).

## Stack et commandes

- Next.js 16 (App Router, JavaScript) · React 19 · Tailwind v4 · Supabase
  (auth, Postgres, Realtime, Storage) · @react-pdf/renderer · Vercel.
- **Windows** : toujours `npm.cmd`, `npx.cmd`, `vercel.cmd` (les scripts .ps1 sont bloqués).
- `npm.cmd run verifier` — ESLint étroit (uniquement ce qui plante). **Toujours avant de publier.**
- `npm.cmd run publier` — vérifie → build → déploie en production.
- `.env.local` (JAMAIS dans git — règle absolue, même pour des clés « publiques » :
  l'historique git est éternel et des clés vraiment secrètes s'ajouteront un jour).
  **Sur un nouveau poste, RIEN à transporter** — reconstruire le fichier ainsi :
  1. supabase.com → se connecter → projet Ventilation DGL → ⚙️ Settings → API
  2. Copier « Project URL » et « anon public » dans un nouveau `.env.local` :
     ```
     NEXT_PUBLIC_SUPABASE_URL=<Project URL>
     NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public>
     ```
  3. `npm.cmd install`, et l'application démarre.
  (Les clés serveur — RESEND_API_KEY, etc. — vivent dans Vercel → Settings →
  Environment Variables du projet, jamais en local ni dans git.)

## Règles métier GELÉES (validées avec le propriétaire — ne pas re-débattre)

- **Dates TOUJOURS locales** — jamais `toISOString()` pour une date calendrier.
- **Taux figés à l'enregistrement** (salaires, camion) : changer un taux ne réécrit pas le passé.
- Marge = (vendant − coûtant) ÷ vendant ; « 20 % » ⇒ vendant = coûtant ÷ 0,8.
- Coût nul = INCONNU, jamais zéro. Lignes sans coût exclues du calcul de marge.
- Une visite = une facture. Multi-techniciens = UNE carte de facturation (heures additionnées,
  montant jamais doublé), signature par le DERNIER qui ferme (jour par jour en multi-jours).
- Appels de service : dépôt par zone payable sous 24 h ; temps inclus (90/180 min hors zone) ;
  dépassement par tranches de 15 min ENTAMÉES au taux vendant (130 $) ; 2e technicien
  passager du même camion = taux vendant − coût camion.
- Camion : 15 $/h au coûtant des heures des journées avec camion (inspection du matin fait foi,
  taux figé sur l'inspection) ; passager déclaré = zéro coût camion.
- Pièces à commander : la réception est confirmée par un HUMAIN (jamais une facture fournisseur) ;
  paiement client exigible avant la COMMANDE ou avant la PLANIFICATION ; pièce annulée ⇒ la
  tâche de retour reste bloquée jusqu'à décision humaine (supprimer ou garder).
- Solde d'un devis facturé en plusieurs fois : suit LE DEVIS, pas le bon de travail.
- Prépaiements (dépôt, pièce) : déduits AUTOMATIQUEMENT à la révision de facturation.
- Technicien : aucun montant d'argent visible sauf taux vendants d'appels ; jamais les coûtants.
- QuickBooks : DERNIÈRE phase, Sandbox d'abord. Factures de dépôt annulées par VOID, jamais Delete.

## Où en est-on (2026-08-10 — TOUT EST PUBLIÉ, tests terrain avec les employés en cours)

- **Fait, EN LIGNE et testé** : auth + rôles/permissions · agenda ↔ technicien temps réel ·
  heures/paies · dépôts par zone · catalogue 289 items · devis (versions, acceptation
  publique avec T&C v2026-08-06 incluant la clause 10 « client absent ») · facturation ·
  pièces à commander (bouton « Commander la pièce », livraison SOUPLE/FIXE, historique des
  reports de date, courriel BC enrichi + CC à l'expéditeur) · case « client absent » côté
  technicien · devis envoyés RÉELLEMENT à la création (lien d'acceptation) · annulation de
  tâches dans l'agenda (double vérification, raison obligatoire ; admins toujours,
  répartiteur seulement sans dépôt/pièce, refusée si travail exécuté) · **COURRIELS RÉELS**
  (Resend vérifié, DKIM Resend + Google, DMARC) · **COMPTES EMPLOYÉS EN UN CLIC** : fiche →
  compte Auth avec rôle → courriel d'invitation (Resend) → page /choisir-mot-de-passe ;
  testé de bout en bout ; en local le lien va au presse-papier (pas de clé Resend, voulu).
- **QuickBooks Sandbox CONNECTÉE** (realm 9341457669242533, « Sandbox Company US c42b ») —
  jetons dans quickbooks_connexion, sync Invoice/Purchase/Bill fonctionnelle. DÉCISION du
  propriétaire : rester en Sandbox pendant tous les tests employés ; bascule production
  seulement après validation de la facturation.
- **Retours de tests des employés — batch 1 LIVRÉ (2026-08-10)** : Nº de devis existant
  QuickBooks à la création de tâche (transition) · multi-techniciens d'un coup (même tâche
  partagée) · heures de début au QUART D'HEURE (« 09:15 » — la grille reste en cases d'une
  heure, helper `indexCaseHeure`) · filtres de recherche AU-DESSUS des listes client et
  adresses (la liste reste) · adresses identifiées par client · champ App./unité · choix
  « Nom affiché » du client (nom/entreprise/les deux) · bouton camion qui explique pourquoi
  il est gris · menu « Recherche » retiré (doublon) · salaires avec point ET virgule
  (44,50) — InputNombreDecimal partout, plus de champs « number » du navigateur.
- **Données** : base RÉINITIALISÉE le 2026-08-10 avant les tests (clients/devis/tâches/
  heures de test effacés ; catalogue, utilisateurs et paramètres conservés). Un fournisseur
  « TEST — Fournisseur » (courriel du propriétaire) existe pour tester les BC. RÈGLE
  ABSOLUE depuis : ne JAMAIS effacer de données sans demande explicite du propriétaire.
- **Snippets SQL passés jusqu'au nº 39** (36 livraison/reports · 37 client_absent ·
  38 quickbooks_connexion · 39 clients_app.nom_affichage).
- **Vercel** : RESEND_API_KEY + SUPABASE_SERVICE_ROLE_KEY posées (prod+preview). Supabase
  Auth URL Configuration faite (Site URL prod + redirect prod/localhost).
- **PROCHAIN GRAND CHANTIER (point 9 des retours)** : facture de DÉPÔT dans QuickBooks
  Sandbox à la création d'un appel de service — créer/lier le client QBO, créer la facture
  de dépôt, l'envoyer par courriel au destinataire choisi, journaliser. Règle gelée :
  annulation par VOID, jamais Delete. Ensuite : durcissement RLS (OBLIGATOIRE avant une
  2e entreprise) · textos « en route » (idée notée, propriétaire pas convaincu).

## Pièges connus (payés cher — ne pas répéter)

- `String.replace` avec du texte contenant `$` corrompt le fichier (séquences `$&`, `` $` ``) —
  toujours `split().join()` ou l'outil Edit.
- `app/admin/page.jsx` fait ~15 000 lignes : les composants et helpers sont au niveau MODULE
  (jamais définis dans le rendu — perte de focus). `depots` est un ANNUAIRE `{tacheId: depot}`,
  pas une liste.
- Snippets SQL numérotés 01→38 dans l'éditeur Supabase du propriétaire — on s'y réfère par numéro.
- Google Maps : chargeur officiel avec `callback` (un `<script>` nu ne donne pas `importLibrary`).
- `vercel env pull` renvoie « [SENSITIVE] » pour toute variable sensible — INUTILISABLE pour
  diagnostiquer une clé (une heure perdue à croire la clé mauvaise alors que c'était le
  cache-écran). Tester les clés par le circuit réel, jamais par relecture du coffre.
- Le propriétaire copie parfois le texte masqué « [SENSITIVE] » au lieu d'une vraie valeur —
  toujours vérifier le préfixe attendu (re_ pour Resend, etc.) avant de conclure.
