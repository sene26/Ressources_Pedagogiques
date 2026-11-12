import { expect, test } from "@playwright/test";
import { STUDENT, TEACHER, login, logout, pdfBuffer } from "./helpers";

/**
 * Critère de fin du Lot 2 : un enseignant dépose une ressource ; elle n'est visible
 * des étudiants qu'une fois publiée. S'appuie sur les comptes créés par le parcours du Lot 1.
 */
test.describe.serial("Lot 2 — Ressources", () => {
  let resourceUrl = "";

  test("l'enseignante dépose un cours en brouillon", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.getByRole("link", { name: "Mes ressources" }).click();
    await page.getByRole("link", { name: "+ Déposer" }).click();
    await page.getByLabel("Titre").fill("Algorithmique — Chapitre 1");
    await page.getByLabel("Mots-clés (séparés par des virgules)").fill("tri, complexité");
    await page.getByLabel(/Algorithmique — L-INFO · S1/).check();
    await page.locator("#file").setInputFiles({ name: "chapitre1.pdf", mimeType: "application/pdf", buffer: pdfBuffer() });
    await page.getByLabel("Enregistrer en brouillon").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByRole("heading", { name: "Algorithmique — Chapitre 1" })).toBeVisible();
    await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
    resourceUrl = new URL(page.url()).pathname;
    await logout(page);
  });

  test("l'étudiante ne voit pas le brouillon", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    const response = await page.goto(resourceUrl);
    expect(response?.status()).toBe(404);
  });

  test("l'enseignante publie, puis dépose une version 2", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto(resourceUrl);
    await page.getByRole("button", { name: "Valider la publication" }).click();
    await expect(page.getByText("Ressource publiée.")).toBeVisible();
    await expect(page.getByText("Publiée", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Modifier / nouvelle version" }).click();
    await page.locator("#file").setInputFiles({ name: "chapitre1-v2.pdf", mimeType: "application/pdf", buffer: pdfBuffer("v2") });
    await page.getByLabel("Commentaire de version").fill("Ajout des exercices");
    await page.getByRole("button", { name: "Déposer la nouvelle version" }).click();
    await expect(page.getByText("Version 2 déposée.")).toBeVisible();
    await page.goto(resourceUrl);
    await expect(page.getByTestId("version-history")).toContainText("Ajout des exercices");
  });

  test("l'étudiante voit la ressource publiée, sans l'historique, et la télécharge", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(resourceUrl);
    await expect(page.getByRole("heading", { name: "Algorithmique — Chapitre 1" })).toBeVisible();
    await expect(page.getByTestId("version-history")).toHaveCount(0);
    await expect(page.getByTestId("resource-actions")).toHaveCount(0);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Télécharger" }).click()]);
    expect(download.suggestedFilename()).toBe("chapitre1-v2.pdf");
  });
});
