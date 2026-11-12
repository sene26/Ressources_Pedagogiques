import { execSync } from "node:child_process";
import { loadTestEnv } from "./test-env";

/**
 * Avant toute la suite : crée la base de test si besoin et applique les migrations.
 * Les données sont ensuite vidées par chaque fichier de test (resetDatabase).
 */
export default function setup(): void {
  loadTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
}
