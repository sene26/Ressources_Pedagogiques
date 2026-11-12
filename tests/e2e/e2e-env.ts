import { existsSync } from "node:fs";
import { config } from "dotenv";

/**
 * Variables d'environnement des tests de bout en bout : celles de .env.test,
 * avec une base distincte (« ressources_e2e_test ») et le port 3100.
 */
export function e2eEnv(): Record<string, string> {
  if (existsSync(".env.test")) config({ path: ".env.test", override: true, quiet: true });
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL manquant : créez .env.test (voir .env.test.example).");
  const databaseUrl = process.env.E2E_DATABASE_URL ?? base.replace(/\/[^/?]+(\?|$)/, "/ressources_e2e_test$1");
  return {
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "secret-e2e-uniquement",
    AUTH_TRUST_HOST: "true",
    APP_URL: "http://localhost:3100",
    SMTP_HOST: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export const E2E_ADMIN = { email: "admin@uasz.test", password: "admin-e2e-2026" };
