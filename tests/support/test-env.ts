import { existsSync } from "node:fs";
import { config } from "dotenv";

/**
 * Charge .env.test (prioritaire sur .env). Par sécurité, on refuse toute base dont le nom
 * ne contient pas « test » : les tests vident la base à chaque fichier.
 */
export function loadTestEnv(): void {
  if (existsSync(".env.test")) config({ path: ".env.test", override: true, quiet: true });
  const url = process.env.DATABASE_URL ?? "";
  const dbName = url.split("/").pop()?.split("?")[0] ?? "";
  if (!dbName.includes("test")) {
    throw new Error(
      `Base de test invalide (« ${dbName} ») : créez .env.test avec un DATABASE_URL dont le nom de base contient « test » (voir .env.test.example).`,
    );
  }
}
