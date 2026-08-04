# Guide de branchement Supabase

## ⚠️ Ce qui a été vérifié — et ce qui ne l'a pas été

Contrairement au reste du code livré pendant cette conversation (chaque
fonctionnalité a été testée en navigateur réel via Playwright avant
livraison), **ce qui suit n'a pas pu être testé en conditions réelles**.
Je n'ai accès ni à un vrai projet Supabase, ni au réseau, dans cet
environnement. Ce qui a été fait :

- `schema.sql` — vérifié pour l'équilibre syntaxique (parenthèses,
  guillemets `$$`), mais **jamais exécuté contre un vrai Postgres**.
- `lib/supabase/*.js` — code structurellement cohérent avec le schéma
  et les fonctions React existantes, mais **jamais exécuté contre une
  vraie instance Supabase**.
- La fonction RPC `calculer_rentabilite_projet()` (dans un commentaire
  de `projets.js`) est fournie comme point de départ, pas comme
  migration prête à appliquer sans relecture.

**Avant la mise en prod**, fais relire le schéma par quelqu'un de ton
équipe (ou par Claude Code, qui peut exécuter du SQL contre une vraie
instance Supabase de test) et lance chaque fonction manuellement une
première fois.

## Étapes de branchement

1. `npm install @supabase/supabase-js`
2. Crée un projet Supabase, exécute `schema.sql` dans l'éditeur SQL
3. Configure `.env.local` (voir `lib/supabase/client.js`)
4. Active l'authentification par mot de passe dans Supabase Auth
5. Crée les buckets Storage `photos-travaux` et `signatures` (privés,
   avec policies limitant l'accès aux utilisateurs authentifiés)
6. Remplace progressivement chaque `useState(DONNEES_INIT)` — voir les
   deux exemples complets ci-dessous, à répliquer pour le reste

---

## Exemple 1 — `AdminInterface.jsx`, module Projets

### Avant (simulé)

```jsx
const [projets, setProjets] = useState(PROJETS_INIT);

const creerProjet = (clientId) => {
  const nouveau = { id: `projet-${Date.now()}`, nom: nouveauProjetNom.trim(), clientId, /* ... */ };
  setProjets((prev) => [...prev, nouveau]);
  ajouterJournal(`🏗️ Projet "${nouveau.nom}" créé pour ${client?.nom}`);
};
```

### Après (Supabase)

```jsx
import { listerProjets, creerProjet as creerProjetSupabase } from "@/lib/supabase/projets";
import { sAbonnerAuxProjets } from "@/lib/supabase/realtime";
import { ajouterJournal as ajouterJournalSupabase } from "@/lib/supabase/journal";
import { supabase } from "@/lib/supabase/client";

const [projets, setProjets] = useState([]);

useEffect(() => {
  let annule = false;
  listerProjets().then((data) => { if (!annule) setProjets(data); });
  const channel = sAbonnerAuxProjets(() => {
    listerProjets().then((data) => { if (!annule) setProjets(data); });
  });
  return () => { annule = true; supabase.removeChannel(channel); };
}, []);

const creerProjet = async (clientId) => {
  const nouveau = await creerProjetSupabase({
    nom: nouveauProjetNom.trim(),
    clientId,
    adresseTravaux: nouveauProjetAdresse,
    dateDebut: nouveauProjetDebut,
    dateFin: nouveauProjetFin,
    budgetTotal: parseFloat(nouveauProjetBudget) || 0,
    tauxHoraireCoutant: parseFloat(nouveauProjetTaux) || 0,
  });
  // Pas besoin de setProjets manuellement — l'abonnement Realtime
  // ci-dessus s'en charge automatiquement pour CETTE session ET
  // toutes les autres sessions admin ouvertes.
  await ajouterJournalSupabase(`🏗️ Projet "${nouveau.nom_projet}" créé pour ${clients.find((c) => c.id === clientId)?.nom}`);
};
```

Le reste du composant (JSX, calcul de rentabilité affiché, etc.) ne
change pas — seule la source des données change. Le calcul de
rentabilité lui-même (`calculerRentabiliteProjet`) peut soit rester
côté client (en passant les `travaux`/`transactionsQb` déjà chargés),
soit être remplacé par `obtenirRentabiliteProjet(projetId)` (RPC
serveur) si tu préfères éviter de retélécharger tout l'historique à
chaque affichage — les deux approches sont compatibles avec ce schéma.

---

## Exemple 2 — `TechnicienPWA.jsx`, file d'attente hors-ligne

### Avant (simulé — délai de 400ms, rien n'est réellement envoyé)

```jsx
useEffect(() => {
  if (!enLigne || syncEnCoursRef.current || fileAttente.length === 0) return;
  let annule = false;
  syncEnCoursRef.current = true;
  setSyncFileEnCours(true);
  (async () => {
    await new Promise((resolve) => setTimeout(resolve, 400)); // ← simulation
    if (annule || !navigator.onLine) { /* ... */ return; }
    setFileAttente((prev) => prev.slice(1));
    syncEnCoursRef.current = false;
    setSyncFileEnCours(false);
  })();
  return () => { annule = true; };
}, [enLigne, fileAttente]);
```

### Après (Supabase — envoi réel de la première action en file)

```jsx
import { mettreAJourBonDeTravail } from "@/lib/supabase/travaux";

useEffect(() => {
  if (!enLigne || syncEnCoursRef.current || fileAttente.length === 0) return;
  let annule = false;
  syncEnCoursRef.current = true;
  setSyncFileEnCours(true);
  (async () => {
    const action = fileAttente[0];
    try {
      // Remplace le délai simulé par le VRAI appel réseau.
      await mettreAJourBonDeTravail(action.tacheId, action.champs);
      if (!annule) setFileAttente((prev) => prev.slice(1));
    } catch (err) {
      // Échec réseau réel (pas juste hors-ligne détecté par le
      // navigateur) — l'action reste en file pour une prochaine
      // tentative, avec un backoff pour éviter de marteler l'API.
      if (!annule) await new Promise((r) => setTimeout(r, 2000));
    } finally {
      if (!annule) {
        syncEnCoursRef.current = false;
        setSyncFileEnCours(false);
      }
    }
  })();
  return () => { annule = true; };
}, [enLigne, fileAttente]);
```

La structure de l'effet (garde anti-concurrence par `ref`, traitement
un élément à la fois, redéclenchement automatique via la dépendance
`fileAttente`) reste identique — seul le contenu de l'action change.
C'est le même bug de boucle d'auto-annulation React qui a été corrigé
plus tôt dans le développement ; ne réintroduis pas `syncFileEnCours`
(l'état, pas la ref) dans le tableau de dépendances.

---

## Exemple 3 — Statut en temps réel ET synchronisation bidirectionnelle
## admin ↔ technicien

**Ce que ça résout précisément** : dans la version simulée, chaque app
a son propre état React local (`taches` côté `TechnicienPWA.jsx`,
`tachesAttente`/`planning` côté `AdminInterface.jsx`) — deux mémoires
totalement séparées, sans aucun lien entre elles. Ni un rafraîchissement
de page, ni un changement de code dans l'un des deux fichiers ne peut
créer ce lien : il faut une source de données PARTAGÉE entre les deux,
ce que ni React ni le navigateur ne fournissent seuls. C'est exactement
le rôle de la table `taches_planifiees` (schema.sql) — une fois les
deux apps branchées dessus, ce qui suit devient vrai automatiquement,
sans code supplémentaire au-delà de ceci :

### Côté `AdminInterface.jsx` — voit le statut du technicien évoluer en direct

```jsx
import { listerTachesEnAttente } from "@/lib/supabase/taches";
import { sAbonnerAuxTachesPlanifiees } from "@/lib/supabase/realtime";
import { supabase } from "@/lib/supabase/client";

const [tachesAttente, setTachesAttente] = useState([]);

useEffect(() => {
  let annule = false;
  listerTachesEnAttente().then((data) => { if (!annule) setTachesAttente(data); });
  // Se redéclenche pour TOUT changement sur taches_planifiees — y
  // compris quand le technicien signe et termine son intervention
  // depuis son téléphone, sur le terrain, à des kilomètres de l'admin.
  const channel = sAbonnerAuxTachesPlanifiees(() => {
    listerTachesEnAttente().then((data) => { if (!annule) setTachesAttente(data); });
  });
  return () => { annule = true; supabase.removeChannel(channel); };
}, []);
```

### Côté `TechnicienPWA.jsx` — reçoit les modifications de l'admin sans recharger

```jsx
import { listerTachesDuJour } from "@/lib/supabase/taches";
import { sAbonnerAMesTaches } from "@/lib/supabase/realtime";
import { supabase } from "@/lib/supabase/client";

useEffect(() => {
  let annule = false;
  const rafraichir = () => listerTachesDuJour(employeId, dateISO()).then((data) => { if (!annule) setTaches(data); });
  rafraichir();
  // Si l'admin change une adresse, ajoute un rendez-vous urgent ou
  // réassigne une tâche PENDANT que le technicien est hors-ligne, ce
  // channel se redéclenche dès la reconnexion (Supabase Realtime
  // rattrape automatiquement les événements manqués) — la mise à jour
  // arrive sans que le technicien touche à rien.
  const channel = sAbonnerAMesTaches(employeId, rafraichir);
  return () => { annule = true; supabase.removeChannel(channel); };
}, [employeId]);
```

**Sur la synchronisation "bidirectionnelle"** : la file d'attente
hors-ligne (Exemple 2) reste volontairement à sens unique
(technicien → serveur) — c'est le bon flux pour des ACTIONS que le
technicien déclenche lui-même. Le sens serveur → technicien (recevoir
les modifications de l'admin) ne passe pas par une file d'attente
symétrique : Realtime s'en charge nativement dès la reconnexion, comme
montré ci-dessus. Les deux mécanismes sont complémentaires, pas
redondants — pas besoin d'un deuxième système de file pour l'autre sens.

**Sur l'harmonisation des structures** (voir aussi `taches.js`) : la
fonction `versTacheTechnicien()` ajoutée dans `lib/supabase/taches.js`
est le SEUL endroit où la traduction entre le schéma "agenda" de l'admin
et le schéma "bon de travail" du technicien doit exister — ni
`AdminInterface.jsx` ni `TechnicienPWA.jsx` n'ont besoin de connaître la
structure interne de l'autre.

---

## Ce qui reste à faire (au-delà de ce guide)

- Répliquer le même pattern pour les autres `useState` (clients,
  devis, utilisateurs, journal, transactions QuickBooks) — même
  approche que les deux exemples ci-dessus.
- Écrire les 2 Supabase Edge Functions mentionnées dans le code
  (`sync-quickbooks-transactions` pour l'appel OAuth2 réel à
  QuickBooks, et une route API Next.js pour la création de comptes
  Auth via `supabase.auth.admin.createUser`).
- Chiffrement réel des champs sensibles (`courriel_chiffre`,
  `telephone_chiffre`) via les fonctions `encrypt_data()`/`decrypt_data()`
  déjà présentes dans `schema.sql`, appelées par des RPC dédiées —
  actuellement les fichiers `.js` écrivent ces champs en clair par
  simplicité, à corriger avant la mise en prod (conformité Loi 25).
