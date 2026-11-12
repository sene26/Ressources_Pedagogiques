import { randomUUID } from "node:crypto";
import type { ApprovalStatus, ResourceStatus, ResourceType, Visibility } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { canViewResource, resourcePolicySelect, toPolicyView, visibleResourcesWhere } from "@/server/policies/resource-policy";
import { loadViewerContext } from "@/server/services/viewer";
import { resetDatabase } from "../support/db-helpers";
import { buildWorld, type World } from "../support/resource-world";

/**
 * RG2 à RG7 — Les deux formes de la politique d'accès doivent concorder :
 * la vérification unitaire (fiche, téléchargement) et le filtre des listes et de la recherche.
 * On croise tous les statuts, visibilités, types, dates, années et EC, pour chaque profil d'utilisateur.
 */
let w: World;
const now = new Date("2026-11-12T12:00:00Z");

beforeAll(async () => {
  await resetDatabase();
  w = await buildWorld();
  const statuses: ResourceStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
  const visibilities: Visibility[] = ["PRIVATE", "TEACHERS", "EC_STUDENTS"];
  const kinds: [ResourceType, ApprovalStatus][] = [["COURSE", "NOT_REQUIRED"], ["EXAM", "PENDING"], ["EXAM", "APPROVED"]];
  const dates = [null, new Date("2026-11-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z")];
  const years = [w.year.id, w.previousYear.id];
  const ecs = [w.ec["M-MIO-S1"], w.ec["M-MIO-S3"], w.ec["L-INFO-S1"]];
  const authors = [w.author.id, w.otherTeacher.id];

  const resources = [];
  const links = [];
  let i = 0;
  for (const status of statuses)
    for (const visibility of visibilities)
      for (const [type, approvalStatus] of kinds)
        for (const publishAt of dates)
          for (const academicYearId of years)
            for (const courseElementId of ecs) {
              const id = randomUUID();
              const authorId = authors[i++ % authors.length];
              resources.push({ id, title: `R${i}`, description: "", type, status, visibility, publishAt, approvalStatus, academicYearId, authorId });
              links.push({ resourceId: id, courseElementId });
            }
  await db.resource.createMany({ data: resources });
  await db.resourceCourseElement.createMany({ data: links });
}, 120_000);

describe("RG2–RG7 — Cohérence entre canViewResource et visibleResourcesWhere", () => {
  const profiles = ["admin", "author", "colleague", "otherTeacher", "manager", "otherManager", "studentM1", "studentM2", "studentL1", "studentPreviousYear", "studentNotEnrolled"] as const;

  it.each(profiles)("profil %s", async (profile) => {
    const viewer = await loadViewerContext(w[profile]);
    const all = await db.resource.findMany({ select: { id: true, ...resourcePolicySelect } });
    const expected = all.filter((r) => canViewResource(viewer, toPolicyView(r), now)).map((r) => r.id).sort();
    const listed = (await db.resource.findMany({ where: visibleResourcesWhere(viewer, now), select: { id: true } })).map((r) => r.id).sort();
    expect(listed).toEqual(expected);
    // Garde-fou : chaque profil voit une partie, mais pas la totalité, sauf l'administrateur.
    if (profile === "admin") expect(listed).toHaveLength(all.length);
    else expect(listed.length).toBeLessThan(all.length);
  });

  it("un étudiant ne voit que des ressources publiées, ouvertes aux étudiants, datées et validées, de l'année en cours", async () => {
    const viewer = await loadViewerContext(w.studentM1);
    const visible = await db.resource.findMany({ where: visibleResourcesWhere(viewer, now), select: { id: true, ...resourcePolicySelect } });
    expect(visible.length).toBeGreaterThan(0);
    for (const r of visible) {
      expect(r).toMatchObject({ status: "PUBLISHED", visibility: "EC_STUDENTS", academicYearId: w.year.id });
      expect(r.publishAt === null || r.publishAt <= now).toBe(true);
      if (r.type === "EXAM") expect(r.approvalStatus).toBe("APPROVED");
      expect(r.courseElements[0].courseElementId).toBe(w.ec["M-MIO-S1"]);
    }
  });
});
