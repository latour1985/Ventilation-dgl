// Configuration Playwright — Ventilation DGL inc.
//
// À exécuter depuis la racine du projet Next.js avec :
//   npx playwright test
//
// Ajuste `baseURL` selon l'environnement (local, staging, prod) via
// la variable d'environnement PLAYWRIGHT_BASE_URL, ou modifie la
// valeur par défaut ci-dessous.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
