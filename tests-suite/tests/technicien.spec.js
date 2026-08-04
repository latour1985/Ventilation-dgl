// Suite de tests — App Technicien (TechnicienPWA.jsx)
//
// ⚠️ AJUSTE L'URL : ces tests supposent que l'app technicien est
// servie à la racine ("/") ou à un chemin comme "/technicien" selon
// ta configuration de routes Next.js. Modifie la constante
// TECHNICIEN_URL ci-dessous en conséquence.
//
// Ces tests reprennent et formalisent les vérifications faites
// manuellement (via des scripts ad hoc) tout au long du développement
// de l'application — ils couvrent les flux critiques, pas 100% des
// fonctionnalités. À enrichir au fil des prochaines fonctionnalités.

import { test, expect } from "@playwright/test";

const TECHNICIEN_URL = "/"; // ex: "/technicien" si l'app admin est à la racine

test.describe("Connexion", () => {
  test("le compte 'admin' se connecte sans mot de passe (mode développement)", async ({ page }) => {
    await page.goto(TECHNICIEN_URL);
    await page.getByPlaceholder("Nom d'utilisateur").fill("admin");
    await page.getByText("Se connecter").click();
    await expect(page.getByText("Bonjour, Marc")).toBeVisible();
  });

  test("un nouveau compte doit créer son mot de passe à la première connexion", async ({ page }) => {
    await page.goto(TECHNICIEN_URL);
    await page.getByPlaceholder("Nom d'utilisateur").fill("sroy"); // compte non-admin, sans mdp existant
    await page.getByText("Se connecter").click();
    await expect(page.getByText(/crée ton mot de passe/i)).toBeVisible();
  });
});

test.describe("Cycle de vie d'une tâche", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TECHNICIEN_URL);
    await page.getByPlaceholder("Nom d'utilisateur").fill("admin");
    await page.getByText("Se connecter").click();
  });

  test("une seule tâche active à la fois — la deuxième reste bloquée", async ({ page }) => {
    await page.getByText("Toitures Lavallée inc.").first().click();
    await page.getByText("Débuter la tâche").click();
    await page.locator("button").first().click(); // retour à l'accueil
    // La deuxième tâche du jour doit afficher un blocage
    const taches = page.locator('button:has-text("Résidence Tremblay")');
    await taches.first().click();
    await expect(page.getByText(/une seule tâche à la fois/i)).toBeVisible();
    await expect(page.getByText("Débuter la tâche")).toBeDisabled();
  });

  test("l'envoi exige une photo après ET une description", async ({ page }) => {
    await page.getByText("Toitures Lavallée inc.").first().click();
    await page.getByText("Débuter la tâche").click();
    await expect(page.getByText("TERMINER ET ENVOYER")).toBeDisabled();
  });
});

test.describe("Transport & géolocalisation", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 45.5, longitude: -73.5 });
    await page.goto(TECHNICIEN_URL);
    await page.getByPlaceholder("Nom d'utilisateur").fill("admin");
    await page.getByText("Se connecter").click();
  });

  test("le trajet aller cible automatiquement la première tâche du jour", async ({ page }) => {
    await page.getByText("Transport — Début de journée").click();
    await expect(page.getByText(/Destination/)).toBeVisible();
    await expect(page.getByText("Lancer le trajet (Google Maps)")).toBeVisible();
  });

  test("l'arrivée calcule automatiquement le kilométrage via GPS", async ({ page, context }) => {
    await page.getByText("Transport — Début de journée").click();
    await page.getByText("Lancer le trajet (Google Maps)").click();
    await page.waitForTimeout(400);
    await context.setGeolocation({ latitude: 45.6, longitude: -73.65 });
    await page.getByText("Arrivé au chantier").click();
    await page.waitForTimeout(400);
    await expect(page.getByText("Calculé par GPS")).toBeVisible();
  });

  test("le trajet retour cible toujours l'entrepôt (adresse fixe)", async ({ page }) => {
    await page.getByText("Transport — Fin de journée").click();
    await expect(page.getByText(/771 boulevard Industriel, Blainville/)).toBeVisible();
  });
});

test.describe("Résilience hors-ligne", () => {
  test("les modifications se mettent en file d'attente hors-ligne et se synchronisent au retour", async ({ page, context }) => {
    await page.goto(TECHNICIEN_URL);
    await page.getByPlaceholder("Nom d'utilisateur").fill("admin");
    await page.getByText("Se connecter").click();

    await context.setOffline(true);
    await page.getByText("Toitures Lavallée inc.").first().click();
    await page.getByText("Débuter la tâche").click();
    await page.locator("button").first().click();

    await expect(page.getByText(/en attente/)).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText(/en attente/)).not.toBeVisible({ timeout: 5000 });
  });
});
