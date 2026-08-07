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

## Où en est-on (2026-08-07)

- **Fait et en ligne** : auth + rôles/permissions (Admin principal voit tout, toujours) ·
  agenda ↔ technicien temps réel · heures/paies · dépôts par zone · catalogue 289 items
  (retrait/réactivation) · devis (versions, acceptation publique avec T&C) · facturation
  (révision prix, temps supplémentaire auto, déductions auto) · pièces à commander (circuit
  complet, BC auto-numéroté, demandes de paiement) · inspections véhicules + passager ·
  pièces jointes de tâches (photos/plans → téléphone) · analyse de rentabilité · recherche
  globale · **COURRIELS RÉELS ACTIFS depuis le 2026-08-07** : domaine vérifié chez Resend,
  RESEND_API_KEY dans Vercel, DKIM Resend + DKIM Google activés, DMARC en surveillance
  (p=none). Envoi testé et reçu en production. Le poste de travail officiel est
  `C:\Dev\Ventilation-dgl` (clone git ; l'ancien dossier OneDrive est mort). Node LTS +
  Vercel CLI installés et connectés (projet lié).
- **Fait en LOCAL, PAS ENCORE PUBLIÉ (commit du 2026-08-07)** :
  1. Pièces : bouton « Commander la pièce » (ex-« Marquer commandée ») · date « Livraison
     demandée » avec choix SOUPLE/FIXE (fixe = quelqu'un se déplace à l'entrepôt pour
     recevoir) · historique des reports de date { de, a, le, par } affiché sur la carte ·
     courriel BC enrichi (date, adresse d'entrepôt des Paramètres, invitation à répondre) ·
     copie CC à l'expéditeur + réponses dirigées vers lui (route courriel, opt-in
     `copieExpediteur` — l'adresse vient du jeton de session, jamais du corps).
  2. Clause 10 des T&C (client absent à la fin des travaux / instructions verbales /
     retour facturable min. 3 h) — VERSION_CONDITIONS passée à « 2026-08-06 ».
  3. Technicien : case « Le client n'était pas sur place à la fin des travaux » —
     débloque l'envoi sans signature ; mention claire (clause 10) en facturation admin
     à la place de l'alerte « NON SIGNÉ ».
  4. Demande de paiement : plus de silence — messages explicites quand la fiche client
     n'a pas de courriel / aucun destinataire / montant à zéro.
  5. Devis : l'ENVOI RÉEL part À LA CRÉATION (fenêtre de choix des destinataires =
     vrai envoi avec lien d'acceptation). Le journal ne dit « envoyé » que si c'est vrai.
  6. QuickBooks Sandbox COMPLET : `lib/quickbooksServeur.js` + routes
     `/api/quickbooks/{connexion,callback,etat,transactions}` + `lib/quickbooksClient.js`
     + carte Paramètres → Connexions + sync réelle (Invoice/Purchase/Bill 12 mois) avec
     repli simulé. PAS ENCORE BRANCHÉ — il reste : Redirect URI
     `http://localhost:3000/api/quickbooks/callback` (+ URL Vercel) dans le portail
     développeur Intuit, et QB_CLIENT_ID / QB_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY
     dans `.env.local` (local) et Vercel (prod). Compte développeur Intuit créé.
- **Snippets SQL passés jusqu'au nº 38** (36 : livraison_fixe + reports_date ;
  37 : client_absent ; 38 : table quickbooks_connexion — RLS sans politique, clé service
  seulement).
- **Phase suivante** : brancher QuickBooks Sandbox (voir 6) · facture de dépôt QuickBooks
  avec envoi automatique (le dépôt d'appel de service N'ENVOIE PAS de courriel pour
  l'instant — c'est voulu) · durcissement RLS (politiques `using (true)` — OBLIGATOIRE
  avant une 2e entreprise) · textos « en route » (idée notée, propriétaire pas convaincu).

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
