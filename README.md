# Suite de tests — Ventilation DGL inc.

Tests Playwright couvrant les flux critiques de l'app technicien et de l'interface admin, formalisant les vérifications faites manuellement pendant le développement.

## Installation

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

## Configuration requise avant de lancer les tests

1. **Démarre ton app Next.js** (`npm run dev` ou déployée en staging).
2. **Ajuste les URLs** dans `tests/technicien.spec.js` (`TECHNICIEN_URL`) et `tests/admin.spec.js` (`ADMIN_URL`) selon ta structure de routes réelle.
3. **Ajuste `baseURL`** dans `playwright.config.js`, ou définis la variable d'environnement :
   ```bash
   PLAYWRIGHT_BASE_URL=https://staging.ventilationdgl.com npx playwright test
   ```

## Exécution

```bash
npx playwright test                    # tous les tests, headless
npx playwright test technicien.spec.js # un seul fichier
npx playwright test --ui               # mode interactif (recommandé en dev)
npx playwright show-report             # voir le dernier rapport HTML
```

## Ce que cette suite couvre (et ne couvre pas)

**Couvert** : connexion, cycle de vie d'une tâche (une seule active à la fois, validation photo+description obligatoire), transport GPS (destination auto, calcul de distance, entrepôt fixe), résilience hors-ligne, création de client + sync QuickBooks (anti-doublon), plafond de la facturation progressive, Hub Projets (recherche/filtres/Kanban), les 4 onglets du tableau de bord projet, jauge de santé budgétaire.

**Non couvert** (à ajouter au besoin) : signature tactile, dictée vocale (nécessite de mocker `SpeechRecognition`), upload/compression de photos, l'ensemble des permutations de statut de facturation, les rapports/graphiques Recharts en détail.

## Notes importantes

- Ces tests supposent que l'app tourne dans un vrai navigateur avec accès réseau normal — contrairement au bac à sable utilisé pendant le développement (qui simulait `lucide-react` et `recharts` pour valider la logique sans dépendances réelles). **Réinstalle les vraies dépendances npm** (`lucide-react`, `recharts`) avant de lancer cette suite contre ton vrai build.
- Certains tests utilisent `context.grantPermissions(["geolocation"])` et `context.setGeolocation(...)` — Playwright simule la position GPS, aucun vrai déplacement physique n'est nécessaire pour les valider.
- Le test `context.setOffline(...)` simule une coupure réseau réelle au niveau du navigateur.
