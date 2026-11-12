import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-env";
import { STUDENT, TEACHER, login } from "./helpers";

/**
 * Critère de fin du Lot 5 : le responsable voit les EC sans ressource et les ressources les plus consultées.
 * Vérifie aussi l'import CSV, le journal, le profil et le tableau de bord enseignant.
 */
test.describe.serial("Lot 5 — Pilotage", () => {
  test("l'administrateur ajoute un EC vide et importe des comptes par CSV", async ({ page }) => {
    await login(page, E2E_ADMIN.email, E2E_ADMIN.password);
    await page.goto("/gestion/formations");
    await page.getByRole("link", { name: /L-INFO/ }).click();
    const s1 = page.getByTestId("semester-1");
    const addElement = s1.locator("details", { hasText: "+ Ajouter un EC" });
    await addElement.getByText("+ Ajouter un EC").click();
    await addElement.getByLabel("Code").fill("INF1112");
    await addElement.getByLabel("Intitulé").fill("Architecture des ordinateurs");
    await addElement.getByRole("button", { name: "Ajouter l'EC" }).click();
    await expect(s1.getByText("INF1112 — Architecture des ordinateurs")).toBeVisible();

    await page.goto("/gestion/utilisateurs/import");
    await page.getByLabel("… ou coller le contenu").fill("nom;prenom;courriel;telephone;roles;formation;niveau\nColy;Aminata;aminata.coly@uasz.test;;etudiant;L-INFO;1");
    await page.getByRole("button", { name: "Importer" }).click();
    await expect(page.getByText("1 compte(s) créé(s), dont 1 inscrit(s) ; 0 déjà existant(s).")).toBeVisible();

    await page.goto("/gestion/journal");
    await expect(page.getByTestId("audit-log")).toContainText("Import de comptes (CSV)");
  });

  test("tableau de bord : EC sans ressource et ressources les plus consultées", async ({ page }) => {
    await login(page, E2E_ADMIN.email, E2E_ADMIN.password);
    await page.getByRole("link", { name: "Tableau de bord" }).click();
    await page.getByLabel("Formation").selectOption({ label: "L-INFO" });
    await page.getByRole("button", { name: "Afficher" }).click();
    const dashboard = page.getByTestId("program-dashboard");
    await expect(dashboard.getByTestId("ec-without-resource")).toContainText("Architecture des ordinateurs");
    await expect(dashboard.getByTestId("most-consulted")).toContainText("Algorithmique — Chapitre 1");
    const [download] = await Promise.all([page.waitForEvent("download"), dashboard.getByRole("link", { name: "Exporter (CSV)" }).click()]);
    expect(download.suggestedFilename()).toBe("statistiques-formation.csv");
  });

  test("l'enseignante voit les consultations de ses ressources", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/tableau-de-bord");
    await expect(page.getByTestId("teacher-dashboard")).toContainText("Algorithmique — Chapitre 1");
  });

  test("l'étudiante modifie son profil", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.getByTestId("current-user").click();
    await expect(page.getByText("Licence Informatique · Licence 1")).toBeVisible();
    await page.getByLabel("Téléphone").fill("+221 77 000 00 00");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Profil enregistré.")).toBeVisible();
  });
});
