# Versions de test — à jour avec le code actuel

Deux dossiers, chacun avec un `index.html` + `bundle.js` autonomes,
générés à partir des fichiers `AdminInterface.jsx` et
`TechnicienPWA.jsx` les plus récents.

## Comment tester

1. Télécharge le dossier `test-admin/` ou `test-technicien/` en entier
   (les deux fichiers doivent rester ensemble, dans le même dossier).
2. Double-clique sur `index.html` — il s'ouvre dans ton navigateur par
   défaut. Aucune installation requise (Node, npm, etc.).
3. Connexion app technicien : nom d'utilisateur `admin`, aucun mot de
   passe requis (mode développement).

## ⚠️ Limite importante à connaître

Je n'ai pas accès au réseau npm dans cet environnement — je n'ai donc
pas pu installer les vraies bibliothèques `lucide-react` (icônes) et
`recharts` (graphiques). Ces deux versions de test utilisent des
**remplacements simplifiés** :
- Les icônes s'affichent comme de petits carrés/formes génériques
  plutôt que les vraies icônes Lucide.
- Les graphiques de rentabilité (barres, donut) s'affichent comme des
  blocs simples plutôt que les vrais graphiques Recharts.

**Toute la logique et l'interactivité, elles, sont 100% réelles** —
mêmes calculs, mêmes validations, mêmes flux que le code livré. C'est
exactement l'environnement que j'utilise moi-même pour tester chaque
fonctionnalité avant de te la livrer tout au long de cette conversation.

Pour voir la vraie apparence visuelle (vraies icônes, vrais
graphiques), il faut lancer les fichiers `.jsx` dans un vrai projet
Next.js avec `npm install lucide-react recharts`.

## Contenu

- `test-admin/index.html` + `bundle.js` — interface admin complète
- `test-technicien/index.html` + `bundle.js` — app technicien complète

Ces deux builds seront à régénérer manuellement après tes prochaines
modifications si tu veux qu'ils restent synchronisés — je peux le
refaire à la demande.
