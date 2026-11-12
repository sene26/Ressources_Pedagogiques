import { access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { parseCsv } from "@/lib/csv";
import { db } from "@/server/db";
import { recordAccess } from "@/server/services/access-log";
import { listAuditLogs } from "@/server/services/audit-log";
import { changePassword, setProfilePhoto, updateProfile } from "@/server/services/profile";
import { createResource, duplicateResource, type CreateResourceInput } from "@/server/services/resources";
import { programDashboard, programDashboardCsv, teacherDashboard } from "@/server/services/stats";
import { importUsersCsv } from "@/server/services/user-import";
import { authenticate } from "@/server/services/users";
import { assignTeacher } from "@/server/services/assignments";
import { TEST_PASSWORD, resetDatabase } from "../support/db-helpers";
import { buildWorld, cleanTemporaryStorage, fileContent, pdf, useTemporaryStorage, type World } from "../support/resource-world";

let w: World;
let storageDir: string;
beforeAll(async () => {
  storageDir = await useTemporaryStorage();
});
afterAll(cleanTemporaryStorage);
beforeEach(async () => {
  await resetDatabase();
  w = await buildWorld();
});

const make = (overrides: Partial<CreateResourceInput> = {}) =>
  createResource(w.author, {
    title: "Cours",
    description: "",
    type: "COURSE",
    keywords: "",
    courseElementIds: [w.ec["M-MIO-S1"]],
    visibility: "EC_STUDENTS",
    publication: { mode: "now" },
    content: fileContent(pdf()),
    ...overrides,
  });

describe("F23 — Tableau de bord enseignant", () => {
  it("compte les consultations et téléchargements de ses ressources", async () => {
    const a = await make({ title: "A" });
    const b = await make({ title: "B" });
    await recordAccess({ userId: w.studentM1.id, resourceId: a.id, kind: "VIEW" });
    await recordAccess({ userId: w.studentM1.id, resourceId: a.id, kind: "DOWNLOAD" });
    await recordAccess({ userId: w.colleague.id, resourceId: a.id, kind: "VIEW" });
    await recordAccess({ userId: w.studentM1.id, resourceId: b.id, kind: "VIEW", }, new Date(Date.now() - 60 * 86_400_000));
    const data = await teacherDashboard(w.author);
    expect(data.rows.map((r) => [r.title, r.views, r.downloads, r.recentViews])).toEqual([
      ["A", 2, 1, 2],
      ["B", 1, 0, 0],
    ]);
    expect(data.totals).toMatchObject({ resources: 2, views: 3, downloads: 1 });
    await expect(teacherDashboard(w.studentM1)).rejects.toThrow(ForbiddenError);
  });
});

describe("F24, F26 — Tableau de bord responsable et export", () => {
  it("donne les ressources par EC, les EC sans ressource et les plus consultées, sans données nominatives", async () => {
    const a = await make({ title: "Très consultée" });
    await make({ title: "Brouillon", publication: { mode: "draft" } });
    for (const user of [w.studentM1, w.colleague, w.otherTeacher]) await recordAccess({ userId: user.id, resourceId: a.id, kind: "VIEW" });

    const data = await programDashboard(w.manager, w.master.id, w.year.id);
    const s1 = data.byCourseElement.find((e) => e.id === w.ec["M-MIO-S1"])!;
    expect(s1).toMatchObject({ total: 2, published: 1 });
    expect(data.withoutResource.map((e) => e.id)).toEqual([w.ec["M-MIO-S3"]]);
    expect(data.mostConsulted).toEqual([expect.objectContaining({ title: "Très consultée", accesses: 3 })]);
    expect(JSON.stringify(data)).not.toContain(w.studentM1.email);
    expect(data.totals).toMatchObject({ courseElements: 2, publishedResources: 1, recentAccesses: 3 });
  });

  it("réserve le tableau de bord aux responsables de la formation et l'exporte en CSV", async () => {
    await expect(programDashboard(w.otherManager, w.master.id, w.year.id)).rejects.toThrow(ForbiddenError);
    await expect(programDashboard(w.author, w.master.id, w.year.id)).rejects.toThrow(ForbiddenError);
    await make();
    const rows = parseCsv(await programDashboardCsv(w.manager, w.master.id, w.year.id));
    expect(rows[0]).toEqual(["Semestre", "UE", "Code EC", "EC", "Ressources (toutes)", "Ressources publiées pour les étudiants"]);
    expect(rows).toContainEqual(["S1", "UE1", "EC1", "M-MIO EC S1", "1", "1"]);
  });
});

describe("F25 — Journal des actions", () => {
  it("trace les actions, filtrables, et n'est accessible qu'à l'administrateur", async () => {
    await make({ title: "Tracée" });
    const all = await listAuditLogs(w.admin);
    expect(all.total).toBeGreaterThan(5);
    const created = await listAuditLogs(w.admin, { action: "RESOURCE_CREATED" });
    expect(created.logs).toHaveLength(1);
    expect(created.logs[0]).toMatchObject({ actorId: w.author.id, details: expect.objectContaining({ title: "Tracée" }) });
    await expect(listAuditLogs(w.manager)).rejects.toThrow(ForbiddenError);
  });
});

describe("F3 — Import CSV des comptes", () => {
  const header = "nom;prenom;courriel;telephone;roles;formation;niveau";

  it("crée les comptes, inscrit les étudiants pour l'année en cours et envoie un lien d'activation", async () => {
    const mail = await import("@/server/mail");
    const spy = vi.spyOn(mail, "sendMail").mockResolvedValue();
    try {
      const csv = [header, "Badji;Ibou;ibou.badji@uasz.test;771234567;;M-MIO;2", "Faye;Awa;awa.faye@uasz.test;;enseignant|responsable;;"].join("\n");
      const result = await importUsersCsv(w.admin, csv);
      expect(result).toEqual({ created: 2, enrolled: 1, skipped: [], errors: [] });
      const ibou = await db.user.findUniqueOrThrow({ where: { email: "ibou.badji@uasz.test" }, include: { roles: true, enrollments: true } });
      expect(ibou.roles.map((r) => r.role)).toEqual(["STUDENT"]);
      expect(ibou.enrollments[0]).toMatchObject({ programId: w.master.id, level: 2, academicYearId: w.year.id });
      const awa = await db.user.findUniqueOrThrow({ where: { email: "awa.faye@uasz.test" }, include: { roles: true } });
      expect(awa.roles.map((r) => r.role).sort()).toEqual(["PROGRAM_MANAGER", "TEACHER"]);
      expect(spy.mock.calls.map(([m]) => m.subject)).toEqual(["RessourcesPéda — activez votre compte", "RessourcesPéda — activez votre compte"]);
      expect(await db.passwordResetToken.count()).toBe(2);
      expect(await db.auditLog.count({ where: { action: "USERS_IMPORTED" } })).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("n'importe rien si une ligne est en erreur, et signale chaque erreur avec son numéro de ligne", async () => {
    const csv = [
      header,
      "Ok;Ligne;ok@uasz.test;;;;",
      "Sans;Adresse;pas-une-adresse;;;;",
      "Role;Inconnu;r@uasz.test;;doyen;;",
      "Mauvais;Niveau;n@uasz.test;;;M-MIO;3",
      "Double;Adresse;ok@uasz.test;;;;",
      "Inconnue;Formation;f@uasz.test;;;XYZ;1",
    ].join("\n");
    const result = await importUsersCsv(w.admin, csv);
    expect(result.created).toBe(0);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
    expect(await db.user.count({ where: { email: "ok@uasz.test" } })).toBe(0);
  });

  it("ignore les comptes existants, accepte la virgule comme séparateur et refuse un non-administrateur", async () => {
    const csv = `nom,prenom,courriel\nX,Y,${w.studentM1.email}\nNouveau,Compte,nouveau@uasz.test`;
    const mail = await import("@/server/mail");
    const spy = vi.spyOn(mail, "sendMail").mockResolvedValue();
    try {
      expect(await importUsersCsv(w.admin, csv)).toMatchObject({ created: 1, skipped: [w.studentM1.email], errors: [] });
    } finally {
      spy.mockRestore();
    }
    await expect(importUsersCsv(w.manager, csv)).rejects.toThrow(ForbiddenError);
    expect((await importUsersCsv(w.admin, "prenom;courriel\nA;a@b.sn")).errors[0].message).toContain("« nom » manquante");
  });
});

describe("F4 — Profil", () => {
  it("modifie nom et téléphone ; change le mot de passe en vérifiant l'ancien", async () => {
    await updateProfile(w.studentM1, { lastName: "Sarr", firstName: "Fatou", phone: "+221 77 123 45 67" });
    expect(await db.user.findUniqueOrThrow({ where: { id: w.studentM1.id } })).toMatchObject({ lastName: "Sarr", phone: "+221 77 123 45 67" });
    await expect(updateProfile(w.studentM1, { lastName: "", firstName: "F" })).rejects.toThrow(ValidationError);

    await expect(changePassword(w.studentM1, { current: "faux", password: "nouveau-2026", confirmation: "nouveau-2026" })).rejects.toThrow("Mot de passe actuel incorrect.");
    await changePassword(w.studentM1, { current: TEST_PASSWORD, password: "nouveau-2026", confirmation: "nouveau-2026" });
    expect((await authenticate(w.studentM1.email, "nouveau-2026")).ok).toBe(true);
  });

  it("recadre la photo en 256 × 256 et la compresse en WebP", async () => {
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#1f7a55" } }).png().toBuffer();
    await setProfilePhoto(w.studentM1, new File([new Uint8Array(png)], "photo.png"));
    const { photoKey } = await db.user.findUniqueOrThrow({ where: { id: w.studentM1.id } });
    expect(photoKey).toMatch(/^avatars\//);
    const meta = await sharp(path.join(storageDir, photoKey!)).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 256, height: 256 });
    await expect(setProfilePhoto(w.studentM1, new File(["<svg/>"], "x.svg"))).rejects.toThrow("Format d'image non accepté");
  });
});

describe("F15 — Duplication", () => {
  it("duplique vers une autre année en brouillon, avec une copie du fichier", async () => {
    const source = await make({ title: "Chapitre 1" });
    const nextYear = await db.academicYear.create({ data: { label: "2027-2028", startDate: new Date("2027-10-01"), endDate: new Date("2028-07-31") } });
    await expect(duplicateResource(w.author, source.id, { courseElementIds: [w.ec["M-MIO-S1"]], academicYearId: nextYear.id })).rejects.toThrow(ForbiddenError); // RG2
    await assignTeacher(w.admin, { teacherId: w.author.id, courseElementId: w.ec["M-MIO-S1"], academicYearId: nextYear.id });

    const copy = await duplicateResource(w.author, source.id, { courseElementIds: [w.ec["M-MIO-S1"]], academicYearId: nextYear.id });
    const stored = await db.resource.findUniqueOrThrow({ where: { id: copy.id }, include: { versions: true } });
    expect(stored).toMatchObject({ status: "DRAFT", academicYearId: nextYear.id, duplicatedFromId: source.id, title: "Chapitre 1" });
    const sourceVersion = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: source.id } });
    expect(stored.versions[0].storageKey).not.toBe(sourceVersion.storageKey);
    await expect(access(path.join(storageDir, stored.versions[0].storageKey!))).resolves.toBeUndefined();
  });

  it("un collègue peut dupliquer une ressource partagée vers ses propres EC", async () => {
    const source = await make({ title: "Partagée", visibility: "TEACHERS" });
    await assignTeacher(w.admin, { teacherId: w.otherTeacher.id, courseElementId: w.ec["M-MIO-S3"], academicYearId: w.year.id });
    const copy = await duplicateResource(w.otherTeacher, source.id, { courseElementIds: [w.ec["M-MIO-S3"]], academicYearId: w.year.id });
    expect(copy).toMatchObject({ authorId: w.otherTeacher.id, status: "DRAFT" });
  });
});
