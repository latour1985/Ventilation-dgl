// eslint.config.mjs
//
// VÉRIFICATION AVANT PUBLICATION — `npm run verifier`
//
// Pourquoi ce fichier existe : `npm run build` ne détecte PAS les
// erreurs du genre « joursDepuis is not defined ». Le build compile le
// code sans l'exécuter ; une variable oubliée ne plante qu'au moment où
// quelqu'un clique au bon endroit — donc en général sur le terrain,
// devant un client. On en a attrapé trois de cette famille.
//
// Cette configuration est volontairement ÉTROITE. Elle ne juge pas le
// style (guillemets, points-virgules, longueur des lignes) : rien de
// tout ça ne casse l'application. Elle cherche uniquement ce qui plante
// à l'exécution ou ce qui perd des données.

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";

export default [
  {
    // Dossiers générés ou installés : jamais notre code.
    ignores: ["node_modules/**", ".next/**", "out/**", "public/**", "*.config.mjs", "*.config.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, React: "readonly" },
    },
    settings: { react: { version: "detect" } },
    plugins: { react, "react-hooks": hooks },
    rules: {
      // ---- ERREURS : ça plante ou ça perd des données ----
      // La règle qui compte. Une variable utilisée mais jamais définie
      // dans la portée = ReferenceError garanti à l'écran.
      "no-undef": "error",
      // Variable utilisée AVANT sa déclaration (même portée) : plantage
      // « cannot access before initialization » garanti à l'exécution —
      // c'est le bogue qui a tué l'onglet Agenda le 2026-08-15.
      // En AVERTISSEMENT : 33 cas légitimes existent (fonctions appelées
      // après coup dans des gestionnaires). MAIS toute nouvelle occurrence
      // dans un chemin de RENDU (tableau de dépendances, corps de rendu)
      // doit être traitée comme fatale — vérifier avec npm run verifier:tout.
      "no-use-before-define": ["warn", { functions: false, classes: false, variables: true, allowNamedExports: true }],
      // Deux fois la même clé dans un objet : la seconde écrase la
      // première en silence.
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-dupe-class-members": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-obj-calls": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      // Code après un return : du travail qui ne s'exécutera jamais.
      "no-unreachable": "error",
      // `if (x = 1)` au lieu de `if (x === 1)`.
      "no-cond-assign": "error",
      "no-self-compare": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-fallthrough": "error",
      "no-sparse-arrays": "error",
      // Les Hooks appelés dans un `if` ou une boucle corrompent l'état
      // de React — c'est la cause des « champs qui perdent le focus ».
      "react-hooks/rules-of-hooks": "error",
      // Une clé manquante dans une liste : React réutilise la mauvaise
      // ligne (une signature apparaît sur le mauvais bon de travail).
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",

      // ---- AVERTISSEMENTS : suspect, pas fatal ----
      // Compte les composants utilisés dans le JSX comme « utilisés »,
      // sinon la liste se noie sous des centaines de faux positifs.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-useless-assignment": "warn",

      // ---- DÉSACTIVÉ VOLONTAIREMENT ----
      // `catch {}` vide : utilisé exprès sur localStorage, qui échoue en
      // navigation privée sans que ça doive arrêter l'application.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Les dépendances d'effets demandent un jugement humain ; la règle
      // se trompe assez souvent pour qu'on cesse de la lire.
      "react-hooks/exhaustive-deps": "off",
      // Faux positifs sur les propriétés passées en JSX.
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
    },
  },
];
