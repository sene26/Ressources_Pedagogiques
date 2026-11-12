import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-env";
import { STUDENT, TEACHER, login, logout, pdfBuffer } from "./helpers";

/**
 * Critère de fin du Lot 4 : un sujet d'examen reste invisible jusqu'à sa date de publication validée.
 * Valide aussi les notifications et les favoris.
 */
async function depositExam(page: Page, title: string, schedule?: string) {
  await page.goto("/ressources/nouvelle");
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel("Type").selectOption("EXAM");
  await expect(page.getByRole("note")).toContainText("doit être validée par le responsable");
  await page.getByLabel(/Algorithmique — L-INFO · S1/).check();
  await page.locator("#file").setInputFiles({ name: "examen.pdf", mimeType: "application/pdf", buffer: pdfBuffer("examen") });
  if (schedule) {
    await page.getByLabel("Programmer le").check();
    await page.getByLabel("Date et heure de publication (heure du Sénégal)").fill(schedule);
  } else {
    await page.getByLabel("Publier maintenant").check();
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("En attente de validation")).toBeVisible();
  return new URL(page.url()).pathname;
}

test.describe.serial("Lot 4 — Examens et notifications", () => {
  let examUrl = "";
  let futureExamUrl = "";

  test("l'enseignante dépose deux sujets : l'un pour maintenant, l'autre programmé", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    examUrl = await depositExam(page, "Examen d'algorithmique — session 1");
    futureExamUrl = await depositExam(page, "Examen d'algorithmique — rattrapage", "2030-06-15T09:00");
    await logout(page);
  });

  test("avant validation, l'étudiante ne voit pas le sujet", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    expect((await page.goto(examUrl))?.status()).toBe(404);
  });

  test("l'administrateur valide les deux sujets depuis la liste des validations", async ({ page }) => {
    await login(page, E2E_ADMIN.email, E2E_ADMIN.password);
    await page.getByRole("link", { name: /Validations/ }).click();
    const list = page.getByTestId("pending-approvals");
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await list.getByRole("listitem").first().getByRole("button", { name: "✔ Valider" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Publication validée." })).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await list.getByRole("listitem").first().getByRole("button", { name: "✔ Valider" }).click();
    await expect(page.getByText("Aucun document en attente.")).toBeVisible();
  });

  test("après validation : le sujet du jour est visible et notifié, le sujet programmé reste invisible", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await expect(page.getByTestId("notifications-link")).toContainText("non lue");
    await page.getByTestId("notifications-link").click();
    await page.getByRole("link", { name: /Examen d'algorithmique — session 1/ }).click();
    await expect(page.getByRole("heading", { name: "Examen d'algorithmique — session 1" })).toBeVisible();
    expect((await page.goto(futureExamUrl))?.status()).toBe(404);
  });

  test("l'étudiante ajoute un favori et le retrouve", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(examUrl);
    await page.getByRole("button", { name: "☆ Ajouter aux favoris" }).click();
    await expect(page.getByRole("button", { name: "★ Retirer des favoris" })).toBeVisible();
    await page.getByRole("link", { name: "Favoris" }).click();
    await expect(page.getByTestId("resource-list")).toContainText("Examen d'algorithmique — session 1");
  });
});
