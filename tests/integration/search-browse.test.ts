import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import { getCourseElementPage, getMyCourses, getProgramBrowse } from "@/server/services/browse";
import { createResource, type CreateResourceInput } from "@/server/services/resources";
import { searchResources, tokenize, toBooleanQuery } from "@/server/services/search";
import { resetDatabase } from "../support/db-helpers";
import { buildWorld, cleanTemporaryStorage, fileContent, pdf, txt, useTemporaryStorage, type World } from "../support/resource-world";

let w: World;
beforeAll(useTemporaryStorage);
afterAll(cleanTemporaryStorage);

const make = (overrides: Partial<CreateResourceInput>) =>
  createResource(w.author, {
    title: "Ressource",
    description: "",
    type: "COURSE",
    keywords: "",
    courseElementIds: [w.ec["M-MIO-S1"]],
    visibility: "EC_STUDENTS",
    publication: { mode: "now" },
    content: fileContent(pdf()),
    ...overrides,
  });

const titles = (result: Awaited<ReturnType<typeof searchResources>>) => result.resources.map((r) => r.title);

beforeEach(async () => {
  await resetDatabase();
  w = await buildWorld();
  await make({ title: "Méthode du simplexe", keywords: "programmation linéaire", description: "Forme standard et tableau." });
  await make({ title: "Dualité", description: "Le dual se construit à partir du simplexe.", type: "TUTORIAL" });
  await make({ title: "Résolution de systèmes linéaires", keywords: "gauss, lu", content: fileContent(txt("systemes.txt")) });
  await make({ title: "TD 3 — Graphes", type: "TUTORIAL", keywords: "dijkstra" });
  await make({ title: "Brouillon sur le simplexe", publication: { mode: "draft" } });
  await createResource(w.author, {
    title: "Simplexe en Master 2",
    description: "",
    type: "COURSE",
    keywords: "",
    courseElementIds: [w.ec["M-MIO-S3"]],
    visibility: "EC_STUDENTS",
    publication: { mode: "now" },
    content: fileContent(pdf()),
  });
});

describe("F18 — Recherche plein texte", () => {
  it("trouve sans tenir compte des accents ni de la casse", async () => {
    expect(titles(await searchResources(w.studentM1, { q: "RESOLUTION" }))).toEqual(["Résolution de systèmes linéaires"]);
    expect(titles(await searchResources(w.studentM1, { q: "dualite" }))).toEqual(["Dualité"]);
  });

  it("complète les mots (préfixe) et cherche dans le titre, les mots-clés et la description", async () => {
    expect(titles(await searchResources(w.studentM1, { q: "simplex" })).sort()).toEqual(["Dualité", "Méthode du simplexe"]);
    expect(titles(await searchResources(w.studentM1, { q: "gauss" }))).toEqual(["Résolution de systèmes linéaires"]);
  });

  it("classe une correspondance dans le titre avant une correspondance dans la description", async () => {
    expect(titles(await searchResources(w.studentM1, { q: "simplexe" }))).toEqual(["Méthode du simplexe", "Dualité"]);
  });

  it("exige tous les mots saisis", async () => {
    expect(titles(await searchResources(w.studentM1, { q: "simplexe tableau" }))).toEqual(["Méthode du simplexe"]);
    expect(titles(await searchResources(w.studentM1, { q: "simplexe dijkstra" }))).toEqual([]);
  });

  it("cherche les mots courts (« TD ») par inclusion dans le titre et les mots-clés", async () => {
    expect(titles(await searchResources(w.studentM1, { q: "TD" }))).toEqual(["TD 3 — Graphes"]);
  });

  it("neutralise les opérateurs de la syntaxe booléenne et les mots vides", async () => {
    expect(tokenize('+simplexe -dual* "(the)" @2 ~x')).toEqual({ long: ["simplexe", "dual"], short: ["the", "2", "x"] });
    expect(toBooleanQuery(["simplexe", "dual"])).toBe("+simplexe* +dual*");
    await expect(searchResources(w.studentM1, { q: '+-*()"<>~@' })).resolves.toBeTruthy();
    expect(titles(await searchResources(w.studentM1, { q: "the simplexe" }))).toEqual([]); // « the » absent des titres
  });

  it("RG3, RG7 — ne renvoie que les ressources visibles par l'utilisateur", async () => {
    expect(titles(await searchResources(w.studentM1, { q: "simplexe" }))).not.toContain("Brouillon sur le simplexe");
    expect(titles(await searchResources(w.studentM1, { q: "simplexe" }))).not.toContain("Simplexe en Master 2");
    expect(titles(await searchResources(w.studentM2, { q: "simplexe" }))).toEqual(["Simplexe en Master 2"]);
    expect(titles(await searchResources(w.studentL1, { q: "simplexe" }))).toEqual([]);
    expect(titles(await searchResources(w.author, { q: "simplexe" }))).toContain("Brouillon sur le simplexe");
  });
});

describe("F19 — Filtres", () => {
  it("filtre par type, format, enseignant et année", async () => {
    expect(titles(await searchResources(w.studentM1, { type: "TUTORIAL" })).sort()).toEqual(["Dualité", "TD 3 — Graphes"]);
    expect(titles(await searchResources(w.studentM1, { format: "txt" }))).toEqual(["Résolution de systèmes linéaires"]);
    expect((await searchResources(w.studentM1, { authorId: w.colleague.id })).total).toBe(0);
    expect((await searchResources(w.otherTeacher, { academicYearId: w.previousYear.id })).total).toBe(0);
    expect((await searchResources(w.otherTeacher, { academicYearId: w.year.id })).total).toBe(5);
  });

  it("pagine les résultats par 20", async () => {
    for (let i = 0; i < 21; i++) await make({ title: `Chapitre ${i} — algèbre` });
    const first = await searchResources(w.studentM1, { q: "algebre" });
    expect(first).toMatchObject({ total: 21, pageCount: 2 });
    expect(first.resources).toHaveLength(20);
    expect((await searchResources(w.studentM1, { q: "algebre", page: 2 })).resources).toHaveLength(1);
  });
});

describe("F17, F20 — Navigation et « Mes cours »", () => {
  it("« Mes cours » présente les EC du niveau de l'étudiant avec le nombre de ressources", async () => {
    const data = await getMyCourses(w.studentM1);
    expect(data?.program.semesters.map((s) => s.number)).toEqual([1, 2]); // Master 1 : S1 et S2
    expect(data?.counts.get(w.ec["M-MIO-S1"])).toEqual({ total: 4, recent: 4 });
    expect(await getMyCourses(w.studentNotEnrolled)).toBeNull();
  });

  it("un étudiant ne parcourt ni une autre formation ni un EC d'un autre niveau (RG7)", async () => {
    await expect(getProgramBrowse(w.studentM1, w.licence.id)).rejects.toThrow(NotFoundError);
    await expect(getCourseElementPage(w.studentM1, w.ec["M-MIO-S3"])).rejects.toThrow(NotFoundError);
    await expect(getCourseElementPage(w.studentM1, w.ec["M-MIO-S1"])).resolves.toMatchObject({ total: 4 });
  });

  it("un enseignant parcourt toutes les formations ; la page d'EC propose le dépôt aux enseignants affectés", async () => {
    const browse = await getProgramBrowse(w.otherTeacher, w.master.id);
    expect(browse.counts.get(w.ec["M-MIO-S1"])?.total).toBe(4); // le brouillon n'est pas visible
    expect((await getCourseElementPage(w.author, w.ec["M-MIO-S1"])).canUpload).toBe(true);
    expect((await getCourseElementPage(w.otherTeacher, w.ec["M-MIO-S1"])).canUpload).toBe(false);
  });

  it("la page d'EC filtre par type", async () => {
    const page = await getCourseElementPage(w.studentM1, w.ec["M-MIO-S1"], { type: "TUTORIAL" });
    expect(page.resources.map((r) => r.title).sort()).toEqual(["Dualité", "TD 3 — Graphes"]);
    expect(await db.resource.count()).toBe(6);
  });
});
