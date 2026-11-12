import { expect, type Page } from "@playwright/test";

/** Comptes créés par le parcours du Lot 1 (lot1-socle.spec.ts), réutilisés par les lots suivants. */
export const TEACHER = { email: "awa.diallo@uasz.test", password: "enseignant-2026" };
export const STUDENT = { email: "fatou.sarr@uasz.test", password: "etudiant-2026" };

export async function login(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse électronique").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("current-user")).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
}

/** Petit PDF valide pour les dépôts. */
export function pdfBuffer(text = "Document de test"): Buffer {
  return Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`, "latin1");
}
