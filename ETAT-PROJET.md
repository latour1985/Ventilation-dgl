# État du projet — Ventilation DGL inc.

> Ce fichier est le **briefing d'embarquement** pour une session de travail
> sur un nouvel ordinateur (ou après une longue pause). Il résume ce qui ne
> se devine pas en lisant le code. Mis à jour aux grandes étapes.
> Dernière mise à jour : 2026-08-02.

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
- `.env.local` (JAMAIS dans git) : NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
  Sur un nouveau poste : copier ce fichier manuellement, puis `npm.cmd install`.

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

## Où en est-on (2026-08-02)

- **Fait et en ligne** : auth + rôles/permissions (Admin principal voit tout, toujours) ·
  agenda ↔ technicien temps réel · heures/paies · dépôts par zone · catalogue 289 items
  (retrait/réactivation) · devis (versions, acceptation publique avec T&C) · facturation
  (révision prix, temps supplémentaire auto, déductions auto) · pièces à commander (circuit
  complet, BC auto-numéroté, demandes de paiement) · inspections véhicules + passager ·
  pièces jointes de tâches (photos/plans → téléphone) · analyse de rentabilité (tuile Marge
  moyenne : période, année fiscale, comparatif an passé, estimé-vs-réel, top/flop,
  coût invisible, seuil d'alerte) · recherche globale en-tête avec liste déroulante ·
  courriels (route /api/courriel sécurisée, gabarits devis/BC/paiement) en MODE SIMULÉ.
- **En attente du propriétaire** : clé Resend (compte créé, DNS chez la personne externe du
  site web — domaine GoDaddy, courriels Google Workspace ; SPF cassé à réparer du même coup).
- **Phase 4 (plus tard)** : QuickBooks Sandbox · envoi réel des bons signés + relances ·
  durcissement RLS (35 politiques `using (true)` — OBLIGATOIRE avant une 2e entreprise) ·
  textos « en route » (idée notée, propriétaire pas convaincu encore).

## Pièges connus (payés cher — ne pas répéter)

- `String.replace` avec du texte contenant `$` corrompt le fichier (séquences `$&`, `` $` ``) —
  toujours `split().join()` ou l'outil Edit.
- `app/admin/page.jsx` fait ~15 000 lignes : les composants et helpers sont au niveau MODULE
  (jamais définis dans le rendu — perte de focus). `depots` est un ANNUAIRE `{tacheId: depot}`,
  pas une liste.
- Snippets SQL numérotés 01→35 dans l'éditeur Supabase du propriétaire — on s'y réfère par numéro.
- Google Maps : chargeur officiel avec `callback` (un `<script>` nu ne donne pas `importLibrary`).
