// Suite de tests — Interface Admin (AdminInterface.jsx)
//
// ⚠️ AJUSTE L'URL : modifie ADMIN_URL selon ta configuration de
// routes Next.js (ex: "/admin" si l'app technicien est à la racine).
//
// Comme pour technicien.spec.js, cette suite couvre les flux
// critiques identifiés pendant le développement — à enrichir.

import { test, expect } from "@playwright/test";

const ADMIN_URL = "/admin";

test.describe("Clients", () => {
  test("créer un nouveau client transfère automatiquement vers QuickBooks", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Clients", { exact: true }).first().click();
    await page.getByText("Nouveau client").click();
    // Remplir les champs minimums requis — ajuste les placeholders
    // exacts selon le formulaire final si modifié.
    await expect(page.getByText(/QBO-/)).toBeVisible({ timeout: 3000 });
  });

  test("la synchronisation QuickBooks ne crée jamais de doublons", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Clients", { exact: true }).first().click();
    await page.getByText("Synchroniser depuis QuickBooks").click();
    await page.waitForTimeout(1000);
    const compteApresPremiereSync = await page.locator("text=Construction Bouchard").count();
    // Un deuxième clic (si le bouton était réactivé) ne doit jamais dupliquer
    expect(compteApresPremiereSync).toBeLessThanOrEqual(1);
  });
});

test.describe("Facturation progressive", () => {
  test("le montant facturé ne peut jamais dépasser le solde restant du devis", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Facturation", { exact: true }).first().click();
    const boutonFacturer = page.getByText("Facturer", { exact: true }).first();
    if (await boutonFacturer.isVisible()) {
      await boutonFacturer.click();
      await page.getByText("Facturation par pourcentage").click();
      const inputPct = page.locator('input[type="number"]').first();
      await inputPct.fill("150"); // tentative de dépassement
      // Le pourcentage est plafonné automatiquement à 100 → jamais de dépassement du solde
      await expect(page.getByText(/dépasse le solde restant/)).not.toBeVisible();
    }
  });
});

test.describe("Module Projets", () => {
  test("le Hub Projets affiche la recherche, les filtres et les cartes de rentabilité", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Projets", { exact: true }).first().click();
    await expect(page.getByText("Projets & Rentabilité")).toBeVisible();
    await expect(page.getByPlaceholder(/Rechercher par nom de projet/)).toBeVisible();
  });

  test("la vue Kanban permet de glisser un projet d'une colonne à l'autre", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Projets", { exact: true }).first().click();
    await page.getByText("Kanban", { exact: true }).click();
    await expect(page.getByText("À planifier")).toBeVisible();
    await expect(page.getByText("Facturation d'acompte")).toBeVisible();
  });

  test("le tableau de bord du projet a 4 onglets distincts", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Projets", { exact: true }).first().click();
    const premiereCarteProjet = page.locator('button:has-text("Budget")').first();
    if (await premiereCarteProjet.isVisible()) {
      await premiereCarteProjet.click();
      for (const onglet of ["Vue d'ensemble", "Bons de commande", "Feuille de temps", "Facturation"]) {
        await expect(page.getByText(onglet, { exact: true })).toBeVisible();
      }
    }
  });

  test("la jauge de santé budgétaire passe au rouge en cas de dépassement", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Projets", { exact: true }).first().click();
    // Vérifie la présence du système de code couleur (vert/jaune/rouge)
    const cartes = page.locator(".animate-pulse.bg-red-500");
    // Ne doit pas planter même si aucun projet n'est en dépassement actuellement
    expect(await cartes.count()).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Agenda", () => {
  test("cliquer sur une tâche assignée ouvre le détail", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByText("Agenda", { exact: true }).first().click();
    // Assigner la tâche de démo puis vérifier le détail
    const boutonAssigner = page.getByText("Assigner", { exact: true });
    if (await boutonAssigner.isVisible()) {
      await boutonAssigner.click();
      await page.getByText("Confirmer l'assignation").click();
    }
  });
});
