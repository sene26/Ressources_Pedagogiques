import { expect, test } from "@playwright/test";
import { STUDENT, login } from "./helpers";

/**
 * Critère de fin du Lot 3 : un étudiant retrouve une ressource de son EC en moins de trois clics
 * ou par la recherche. S'appuie sur la ressource publiée au Lot 2.
 */
test.describe.serial("Lot 3 — Consultation", () => {
  test("depuis l'accueil : EC (1) → ressource (2) → téléchargement (3)", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    // L'accueil de l'étudiant présente « Mes cours ».
    await page.getByRole("link", { name: /Algorithmique/ }).click(); // clic 1
    await expect(page.getByRole("heading", { name: "Algorithmique" })).toBeVisible();
    await page.getByRole("link", { name: /Algorithmique — Chapitre 1/ }).click(); // clic 2
    await expect(page.getByRole("heading", { name: "Algorithmique — Chapitre 1" })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Télécharger" }).click()]); // clic 3
    expect(download.suggestedFilename()).toBe("chapitre1-v2.pdf");
  });

  test("par la recherche, sans accent, avec un mot incomplet", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.getByRole("link", { name: "Rechercher" }).click();
    await page.getByRole("searchbox").fill("algorith");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByRole("status").filter({ hasText: "résultat" })).toHaveText("1 résultat");
    await expect(page.getByTestId("resource-list")).toContainText("Algorithmique — Chapitre 1");
  });

  test("aperçu du PDF dans le navigateur, chargé au clic", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/recherche?q=algorithmique");
    await page.getByRole("link", { name: /Algorithmique — Chapitre 1/ }).click();
    await expect(page.getByTestId("preview")).toHaveCount(0);
    await page.getByRole("button", { name: /Aperçu/ }).click();
    const frame = page.getByTestId("preview").locator("iframe");
    await expect(frame).toHaveAttribute("src", /\/api\/files\/.+\?apercu=1$/);
    const response = await page.request.get((await frame.getAttribute("src"))!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toMatch(/^inline/);
  });

  test("l'étudiant ne peut pas ouvrir un EC d'une autre formation", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    const response = await page.goto("/catalogue/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
  });
});
