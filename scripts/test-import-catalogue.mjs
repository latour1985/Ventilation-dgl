import { itemsDepuisCsv, nombreDepuisTexte, repererColonnes } from "file:///C:/Users/Administrateur/Desktop/test%20sur%20gemini%20pour%20claude/pour%20claude%20code/lib/importCatalogue.js";

let echecs = 0;
const verifie = (nom, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) { echecs++; console.log(`❌ ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`); }
  else console.log(`✅ ${nom}`);
};

// --- nombres écrits par des humains ---
verifie("44,50 (virgule décimale)", nombreDepuisTexte("44,50"), 44.5);
verifie("1 234,56 $ (français)", nombreDepuisTexte("1 234,56 $"), 1234.56);
verifie("$1,234.56 (anglais)", nombreDepuisTexte("$1,234.56"), 1234.56);
verifie("1.234,56 (européen)", nombreDepuisTexte("1.234,56"), 1234.56);
verifie("vide = INCONNU", nombreDepuisTexte(""), null);
verifie("1,234 (milliers)", nombreDepuisTexte("1,234"), 1234);

// --- export QuickBooks anglais, séparateur virgule, guillemets ---
const qbo = `Product/Service Name,Sales Description,Type,Sales Price,Purchase Cost
"Filtre 20x25","Filtre standard, boîte de 12",Inventory,34.50,18.75
"Forfait installation",Installation complète,Service,6450.00,
"Thermostat, programmable",,Inventory,189.00,102.40`;
const r1 = itemsDepuisCsv(qbo);
verifie("QBO — 3 items", r1.items.length, 3);
verifie("QBO — virgule DANS un champ entre guillemets", r1.items[2].nom, "Thermostat, programmable");
verifie("QBO — coût absent = null (jamais 0)", r1.items[1].prix_coutant, null);
verifie("QBO — vendant lu", r1.items[0].prix_vendant, 34.5);
verifie("QBO — description lue", r1.items[0].description, "Filtre standard, boîte de 12");

// --- Excel français : point-virgule, accents, virgules décimales ---
const excelFr = `Nom;Catégorie;Prix de vente;Coût d'achat;Unité
Conduit spiral 6";Ventilation;12,75;7,20;pied
Grille de retour;Ventilation;45,00;;unité
;Ventilation;99,00;10,00;unité`;
const r2 = itemsDepuisCsv(excelFr);
verifie("Excel FR — 2 items (ligne sans nom ignorée)", r2.items.length, 2);
verifie("Excel FR — ligne sans nom comptée ignorée", r2.ignorees, 1);
verifie("Excel FR — accents dans les en-têtes", r2.items[0].prix_coutant, 7.2);
verifie("Excel FR — catégorie", r2.items[0].categorie, "Ventilation");
verifie("Excel FR — unité", r2.items[0].unite, "pied");
verifie("Excel FR — coût vide = null", r2.items[1].prix_coutant, null);

// --- « prix » ne doit pas voler la colonne « prix d'achat » ---
verifie(
  "colonnes — vente et achat distinguées",
  repererColonnes(["Nom", "Prix d'achat", "Prix de vente"]),
  { nom: 0, prix_vendant: 2, prix_coutant: 1 }
);

// --- doublon dans le fichier ---
const doublon = `nom,prix\nPompe,10\npompe,20`;
verifie("doublon dans le fichier ignoré", itemsDepuisCsv(doublon).items.length, 1);

// --- fichier sans colonne de nom ---
verifie("aucune colonne de nom reconnue", itemsDepuisCsv("aaa,bbb\n1,2").items.length, 0);

console.log(echecs === 0 ? "\n🟢 TOUS LES TESTS PASSENT" : `\n🔴 ${echecs} test(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
