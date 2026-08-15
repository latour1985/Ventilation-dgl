# État du projet — Ventilation DGL inc.

> Ce fichier est le **briefing d'embarquement** pour une session de travail
> sur un nouvel ordinateur (ou après une longue pause). Il résume ce qui ne
> se devine pas en lisant le code. Mis à jour aux grandes étapes.
> Dernière mise à jour : 2026-08-15.

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

## Où en est-on (2026-08-10 soir — TOUT PUBLIÉ ; chantiers 1-3 faits ; tests employés en cours)

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
- **Vercel** : RESEND_API_KEY + SUPABASE_SERVICE_ROLE_KEY + QB_CLIENT_ID/SECRET (Sandbox)
  posées (prod+preview). Supabase Auth URL Configuration faite ; Email OTP Expiration = 24 h.

### Travaux du 2026-08-10 (soirée) — TOUS PUBLIÉS
- **Zone 4 (Montréal)** ajoutée aux dépôts d'appels de service (315 $, mêmes règles que 1-2-3).
- **Facture de DÉPÔT QuickBooks** (route `/api/quickbooks/facture-depot`) : à la création d'un
  appel de service avec dépôt, crée/lie le client QBO, crée la facture de dépôt, envoie le
  courriel de demande au client (taxes QC, Nº de facture), journalise. Annulation = VOID
  (jamais Delete). Relance et délai 24 h gèrent le VOID + nouvelle facture.
- **SÉCURITÉ RLS DURCIE et vérifiée** : voir le fichier mémoire `securite-rls`. Les snippets
  40 (durcissement)/41 (retour arrière)/42 (ajustements) avaient été exécutés DANS LE DÉSORDRE,
  laissant l'auto-promotion admin OUVERTE ; corrigé en réexécutant 40 PUIS 42. Fuite salaires
  fermée par une VUE `annuaire_employes` (noms+courriels seulement, snippet 44) + reverrouillage
  (snippet 45) ; l'app technicien lit `listerAnnuaireEmployes()`. Vérifié par « test-sonde »
  (compte technicien jetable via clé service). Rôle du compte propriétaire réparé
  (« ChargÃ© de projet » corrompu → « Admin principal »).
- **Invitations — bug « lien plus valide » à la 1re ouverture CORRIGÉ** : les robots d'aperçu
  (RCS, Gmail, antivirus) consommaient le jeton à usage unique avant le clic humain. Désormais
  le lien porte le jeton HACHÉ vers `/choisir-mot-de-passe?jeton=...&type=` et n'est vérifié
  (verifyOtp) qu'au CLIC sur « Activer mon accès ».
- **Chantier 3 : attributions QuickBooks persistées** (table `qb_attributions_manuelles`,
  snippet 46 — projet_id en TEXT) : l'assignation manuelle d'une transaction à un projet
  survit au rafraîchissement (rechargée + réappliquée par-dessus l'auto-attribution).
- **Virgule décimale (44,50) acceptée PARTOUT** dans les champs d'argent ; `InputNombreDecimal`
  déplacé dans `components/` (partagé admin + technicien).
- **Snippets SQL passés jusqu'au nº 46** (40-42 RLS · 43 qbo_depot_doc_number · 44 vue annuaire ·
  45 reverrouillage répertoire · 46 attributions QB).

### Ordre de bataille (améliorations proposées par Claude, validées avec le propriétaire)
1. ✅ Facture de dépôt QuickBooks. 2. ✅ Durcissement RLS. 3. ✅ Attributions QB + virgule.
4. ⏸️ EN PAUSE (pendant les tests employés) : découpage de `app/admin/page.jsx` (~16 500 lignes,
   un onglet = un fichier, zéro changement visible). 5. À venir : tests automatiques des calculs
   critiques (marges, tranches 15 min, taux figés).
- **Sécurité phase 2 (non urgent)** : migrer le rôle vers app_metadata (voir `securite-rls`) ;
  durcir les tables héritées encore en `using(true)` ; politiques du Storage.
- **Autres** : bascule QuickBooks PRODUCTION (après validation Sandbox par les tests) ·
  textos « en route » (idée notée, propriétaire pas convaincu).

### Travaux du 2026-08-15 — TOUS PUBLIÉS
- Retours employés batch 2 : SIGNATURE sans défilement (blocage tactile natif non-passif sur
  le canevas + gel du défilement de page pendant le trait) ; RETOUR AU MENU après envoi du bon
  (chemins équipe/non-facturable réparés + retour auto 5 s depuis l'écran de confirmation).
- PAIEMENTS EN LIGNE (QuickBooks Payments, Sandbox) — RÈGLE VALIDÉE avec le propriétaire :
  APPELS DE SERVICE = automatique (Paramètres → « Paiements en ligne » : carte OFF/ON ≈2,9 %,
  virement OFF/ON ≈1 %, seuil carte défaut 2 000 $ HT qui COUPE la carte au-dessus) ;
  TOUTES LES AUTRES FACTURES = choix À L'ENVOI, cases DÉCOCHÉES par défaut, frais affichés en
  DOLLARS pour le propriétaire seul (à implémenter avec la facturation QBO régulière).
  JAMAIS de frais ajoutés à la facture client (LPC Québec) — coût interne du marchand.
  Route facture-depot : AllowOnlineCreditCardPayment/AllowOnlineACHPayment + include=invoiceLink ;
  le lien « 💳 Payer en ligne » entre dans le courriel de demande de dépôt quand QuickBooks le
  fournit (QuickBooks Payments actif sur le compte). Snippet SQL 47 (3 colonnes entreprises).

### Travaux du 2026-08-15 (suite) — FACTURATION QUICKBOOKS COMPLÈTE (Sandbox)
- VRAIES factures QBO pour TOUT ce qui se facture (envoi direct + progressives) — routes
  /api/quickbooks/facture (helpers d'écriture partagés déplacés dans quickbooksServeur.js).
  Un échec QBO n'invente JAMAIS de numéro : le bon reste en attente, journal explique.
- FENÊTRE D'AVANT-ENVOI sur chaque facture non-appel : carte/virement DÉCOCHÉS, frais du
  marchand en dollars (2,9 %+0,25 / 1 %) pour le propriétaire seul — jamais au client (LPC).
- DEVIS = miroir « estimate » QBO (un par dossier, mis à jour aux révisions, DocNumber =
  numeroBase, qbo_estimate_id mémorisé) — préserve la pratique du propriétaire.
- CLIENTS : TOUS dans QBO (décision propriétaire — c'était déjà sa réalité). Création de
  fiche → sync auto (persist d'abord, puis liaison par nom, jamais de doublon) ; bouton
  « Synchroniser les clients » (Connexions, lots de 100) pour le rattrapage. Les faux
  transferts simulés (QBO-xxxx) sont MORTS.
- FACTURES ÉMISES enfin PERSISTÉES (bons_travail.factures_emises jsonb — avant : perdues au
  rechargement). majFacturesEmises(rowId sans le préfixe sbb-).
- Snippet SQL 48 (factures_emises + devis.qbo_estimate_id). 47 = paiements appels.

### Travaux du 2026-08-15 (suite 2) — SECTEURS COMMERCIAL / RÉSIDENTIEL (CCQ)
- Grille des taux : DEUX colonnes par métier×niveau (COM | RÉS). Résidentiel à 0 = retombe
  sur le commercial (jamais une paie à zéro). listerTaux() retourne {com, res} ;
  sauvegarderTaux(com, res) ; tauxPourCourriel(courriel, secteur).
- Chaque TÂCHE porte son secteur : hérité du PROJET (champ au formulaire projet), Commercial
  par défaut, changeable à la création (boutons 🏢/🏠). Voyage par donnees → technicien.
- Transports : héritent de leur tâche (début = 1re du jour, fin = dernière, CCQ = destination).
- Le taux FIGÉ à l'enregistrement choisit la colonne du bon secteur ; travaux_effectues.secteur
  étiquette chaque heure. Tâche de retour pièce = secteur du diagnostic (bons_travail.secteur).
- Heures de la semaine : sous-total « 🏠 rés. X h » sous la colonne Chantier + colonne
  « dont Résidentiel » dans l'export TSV (chantier + transports, jamais admin/divers/dîner).
- Snippet SQL 49 (taux_residentiel + secteur sur travaux_effectues/projets_app/bons_travail).

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
