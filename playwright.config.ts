import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./tests/e2e/e2e-env";

/**
 * Tests de bout en bout : l'application est compilée puis lancée sur le port 3100,
 * avec une base dédiée (nom contenant « test »), vidée avant chaque exécution.
 */
const env = e2eEnv();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: env.APP_URL,
    locale: "fr-FR",
    trace: "off",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: `${env.APP_URL}/connexion`,
    reuseExistingServer: false,
    timeout: 240_000,
    env,
  },
});
