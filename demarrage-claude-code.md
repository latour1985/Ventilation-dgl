# Démarrer avec Claude Code — Ventilation DGL inc.

## Étape 1 — Rassembler les fichiers

Avant d'ouvrir Claude Code, télécharge sur ton ordinateur tous les fichiers qu'on a créés ensemble dans cette conversation, dans **un seul dossier** (peu importe son nom, ex: `ventilation-dgl-projet`). Voici la liste complète :

**Les deux applications**
- `AdminInterface.jsx`
- `TechnicienPWA.jsx`
- `Button.jsx`

**Base de données**
- `schema.sql`

**Intégration Supabase (dossier `lib/supabase/`)**
- `client.js`, `clients.js`, `projets.js`, `taches.js`, `travaux.js`, `quickbooks.js`, `utilisateurs.js`, `journal.js`, `realtime.js`
- `INTEGRATION.md`

**Suite de tests (dossier `tests-suite/`)**
- `playwright.config.js`, `README.md`, `tests/technicien.spec.js`, `tests/admin.spec.js`

**Logo**
- `logo-cmmtq.png` et `logo-cmmtq-blanc.png` (dossier `public/`)

Ne t'en fais pas si tu ne sais pas encore où exactement ces fichiers doivent aller dans un "vrai" projet — c'est justement ce que Claude Code va faire pour toi à la prochaine étape.

## Étape 2 — Ouvrir Claude Code dans ce dossier

1. Ouvre l'application Claude Code
2. Dirige-le vers le dossier où tu as mis tous les fichiers (souvent en le lançant depuis ce dossier, ou en utilisant l'option pour choisir un dossier de travail)

## Étape 3 — Copie-colle ce message à Claude Code

```
Bonjour Claude. J'ai travaillé avec Claude (sur claude.ai) pendant plusieurs
semaines pour concevoir une application de gestion pour mon entreprise,
Ventilation DGL inc. (ventilation, chauffage, plomberie). Tous les fichiers
qu'on a produits ensemble sont dans ce dossier. Je ne suis pas développeur —
c'est mon premier vrai projet de code, donc explique-moi chaque étape
importante avant de la faire.

Voici ce que je veux que tu fasses :

1. Crée un vrai projet Next.js (avec Tailwind CSS) dans ce dossier.
2. Installe les dépendances nécessaires : lucide-react (icônes), recharts
   (graphiques), et @supabase/supabase-js (pour plus tard).
3. Place AdminInterface.jsx et TechnicienPWA.jsx comme deux pages
   séparées du projet (ex: une page /admin et une page /technicien),
   en respectant le code tel quel — ce sont deux applications React
   complètes déjà fonctionnelles, ne les réécris pas.
4. Place Button.jsx dans components/ui/Button.jsx (les deux fichiers
   principaux l'importent de cet endroit).
5. Place les fichiers du dossier lib/supabase/ à leur bon endroit
   (lib/supabase/) — ils ne sont PAS encore branchés au reste du code,
   c'est normal, on s'en occupera plus tard.
6. Place logo-cmmtq.png et logo-cmmtq-blanc.png dans le dossier public/
   à la racine du projet.
7. Une fois tout en place, lance le serveur de développement et
   dis-moi comment voir le résultat dans mon navigateur.

Ne branche PAS encore Supabase (schema.sql et les fichiers lib/supabase/)
au reste de l'application — je veux d'abord voir les deux applications
fonctionner avec leurs données de démonstration actuelles, comme elles
fonctionnaient sur claude.ai. On branchera la vraie base de données
plus tard, une fois que je serai à l'aise avec le projet.

Explique-moi en langage simple ce que tu fais à chaque étape, et
préviens-moi si quelque chose ne fonctionne pas comme prévu plutôt que
d'essayer de le cacher ou de le contourner silencieusement.
```

## Ce qui va probablement se passer ensuite

Claude Code va te poser des questions ou te montrer ce qu'il fait au fur et à mesure — c'est normal, réponds simplement à ses questions comme tu le ferais ici. À la fin de cette étape, tu devrais pouvoir ouvrir ton navigateur et voir l'interface admin et l'app technicien fonctionner sur ton propre ordinateur, avec les données de démonstration.

## Pour la suite (une fois que ça fonctionne)

Quand tu seras prêt à brancher la vraie base de données (Supabase), reviens me voir ici sur claude.ai ou demande directement à Claude Code — les deux peuvent t'aider, selon ce qui te convient le mieux à ce moment-là.
