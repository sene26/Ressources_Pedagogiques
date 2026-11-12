import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-env";

/**
 * Critère de fin du Lot 1 : un administrateur crée une formation, un enseignant et un étudiant ;
 * chacun se connecte avec son rôle.
 */

const TEACHER = { email: "awa.diallo@uasz.test", password: "enseignant-2026" };
const STUDENT = { email: "fatou.sarr@uasz.test", password: "etudiant-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse électronique").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("current-user")).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
}

async function createUser(page: Page, data: { lastName: string; firstName: string; email: string; password: string; role: string }) {
  await page.goto("/gestion/utilisateurs/nouveau");
  await page.getByLabel("Nom", { exact: true }).fill(data.lastName);
  await page.getByLabel("Prénom").fill(data.firstName);
  await page.getByLabel("Adresse électronique").fill(data.email);
  await page.getByLabel("Étudiant").setChecked(data.role === "Étudiant");
  await page.getByLabel(data.role, { exact: true }).check();
  await page.getByLabel("Mot de passe initial").fill(data.password);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText("Compte créé.")).toBeVisible();
}

test.describe.serial("Lot 1 — Socle", () => {
  test("refuse un mot de passe erroné avec un message en français", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse électronique").fill(E2E_ADMIN.email);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe-1");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("Adresse électronique ou mot de passe incorrect.");
  });

  test("redirige vers la connexion sans session", async ({ page }) => {
    await page.goto("/gestion/formations");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("l'administrateur crée une formation, un enseignant et un étudiant", async ({ page }) => {
    await login(page, E2E_ADMIN.email, E2E_ADMIN.password);

    // Formation : les 6 semestres d'une Licence sont créés automatiquement.
    await page.goto("/gestion/formations");
    await page.getByLabel("Code").fill("L-INFO");
    await page.getByLabel("Intitulé").fill("Licence Informatique");
    await page.getByLabel("Cycle").selectOption("LICENCE");
    await page.getByRole("button", { name: "Créer la formation" }).click();
    await expect(page.getByRole("heading", { name: "L-INFO — Licence Informatique" })).toBeVisible();
    await expect(page.getByTestId("semester-6")).toBeVisible();

    // UE et EC au semestre 1.
    const s1 = page.getByTestId("semester-1");
    const addUnit = s1.locator("details", { hasText: "+ Ajouter une UE" });
    await addUnit.getByText("+ Ajouter une UE au semestre 1").click();
    await addUnit.getByLabel("Code").fill("INF111");
    await addUnit.getByLabel("Intitulé").fill("Fondamentaux de l'informatique");
    await addUnit.getByRole("button", { name: "Ajouter l'UE" }).click();
    await expect(s1.getByText("INF111 — Fondamentaux de l'informatique")).toBeVisible();
    const addElement = s1.locator("details", { hasText: "+ Ajouter un EC" });
    await addElement.getByText("+ Ajouter un EC").click();
    await addElement.getByLabel("Code").fill("INF1111");
    await addElement.getByLabel("Intitulé").fill("Algorithmique");
    await addElement.getByRole("button", { name: "Ajouter l'EC" }).click();
    await expect(s1.getByText("INF1111 — Algorithmique")).toBeVisible();
    const programUrl = page.url();

    // Comptes.
    await createUser(page, { lastName: "Diallo", firstName: "Awa", ...TEACHER, role: "Enseignant" });
    await createUser(page, { lastName: "Sarr", firstName: "Fatou", ...STUDENT, role: "Étudiant" });

    // Affectation de l'enseignante à l'EC pour l'année en cours.
    await page.goto(programUrl);
    const assignments = page.getByTestId("assignments-INF1111");
    await assignments.getByLabel("Enseignant à affecter à Algorithmique").selectOption({ label: "Diallo Awa" });
    await assignments.getByRole("button", { name: "Affecter" }).click();
    await expect(assignments.getByText("Awa Diallo")).toBeVisible();

    // Inscription de l'étudiante en Licence 1.
    await page.getByRole("link", { name: "Inscriptions des étudiants" }).click();
    await page.getByLabel("Adresse électronique de l'étudiant").fill(STUDENT.email);
    await page.getByLabel("Niveau").selectOption({ label: "Licence 1" });
    await page.getByRole("button", { name: "Inscrire" }).click();
    await expect(page.getByTestId("enrollment-list")).toContainText("Sarr Fatou");

    await logout(page);
  });

  test("l'enseignante se connecte et voit ses enseignements, sans accès à la gestion", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await expect(page.getByTestId("teacher-section")).toContainText("Algorithmique");
    await expect(page.getByRole("link", { name: "Gestion" })).toHaveCount(0);
    await page.goto("/gestion/utilisateurs");
    await expect(page).toHaveURL(/\/$/);
  });

  test("l'étudiante se connecte et voit ses cours de Licence 1", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    const section = page.getByTestId("student-section");
    await expect(section).toContainText("Licence Informatique · Licence 1");
    await expect(section).toContainText("Algorithmique");
  });
});
