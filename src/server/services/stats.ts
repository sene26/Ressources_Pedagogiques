import type { Prisma } from "@prisma/client";
import { toCsv } from "@/lib/csv";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { isTeacher } from "../policies/resource-policy";
import { canManageProgram } from "../policies/user-policy";

/**
 * Statistiques (F23, F24, F26). Uniquement des chiffres agrégés : jamais de liste nominative
 * des personnes qui ont consulté une ressource (A12, loi 2008-12).
 */

export const RECENT_DAYS = 30;

async function accessCounts(resourceIds: string[], since?: Date) {
  if (resourceIds.length === 0) return new Map<string, { views: number; downloads: number }>();
  const rows = await db.accessLog.groupBy({
    by: ["resourceId", "kind"],
    where: { resourceId: { in: resourceIds }, ...(since ? { createdAt: { gte: since } } : {}) },
    _count: true,
  });
  const result = new Map(resourceIds.map((id) => [id, { views: 0, downloads: 0 }]));
  for (const row of rows) {
    const entry = result.get(row.resourceId!);
    if (!entry) continue;
    if (row.kind === "VIEW") entry.views = row._count;
    else entry.downloads = row._count;
  }
  return result;
}

/** Tableau de bord enseignant (F23) : consultations et téléchargements de ses ressources. */
export async function teacherDashboard(actor: CurrentUser, academicYearId?: string, now = new Date()) {
  ensure(isTeacher(actor), "Le tableau de bord enseignant est réservé aux enseignants.");
  const resources = await db.resource.findMany({
    where: { authorId: actor.id, ...(academicYearId ? { academicYearId } : {}) },
    select: { id: true, title: true, type: true, status: true, publishAt: true, courseElements: { select: { courseElement: { select: { title: true } } } } },
    orderBy: { title: "asc" },
  });
  const ids = resources.map((r) => r.id);
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const [total, recent] = await Promise.all([accessCounts(ids), accessCounts(ids, since)]);
  const rows = resources
    .map((r) => ({
      ...r,
      views: total.get(r.id)!.views,
      downloads: total.get(r.id)!.downloads,
      recentViews: recent.get(r.id)!.views,
      recentDownloads: recent.get(r.id)!.downloads,
    }))
    .sort((a, b) => b.views + b.downloads - (a.views + a.downloads));
  return {
    rows,
    totals: {
      resources: rows.length,
      views: rows.reduce((s, r) => s + r.views, 0),
      downloads: rows.reduce((s, r) => s + r.downloads, 0),
      recentViews: rows.reduce((s, r) => s + r.recentViews, 0),
      recentDownloads: rows.reduce((s, r) => s + r.recentDownloads, 0),
    },
  };
}

/** Tableau de bord responsable (F24) : ressources par EC, EC sans ressource, ressources les plus consultées. */
export async function programDashboard(actor: CurrentUser, programId: string, academicYearId: string, now = new Date()) {
  ensure(canManageProgram(actor, programId));
  const elements = await db.courseElement.findMany({
    where: { archived: false, teachingUnit: { archived: false, semester: { programId } } },
    select: { id: true, code: true, title: true, teachingUnit: { select: { code: true, semester: { select: { number: true } } } } },
    orderBy: [{ teachingUnit: { semester: { number: "asc" } } }, { code: "asc" }],
  });
  // Ressources de l'année, non archivées, rattachées à un EC de la formation.
  const inProgram: Prisma.ResourceWhereInput = {
    academicYearId,
    status: { not: "ARCHIVED" },
    courseElements: { some: { courseElement: { teachingUnit: { semester: { programId } } } } },
  };
  const links = await db.resourceCourseElement.findMany({
    where: { resource: inProgram },
    select: { courseElementId: true, resource: { select: { status: true, visibility: true } } },
  });
  const perEc = new Map(elements.map((e) => [e.id, { total: 0, published: 0 }]));
  for (const link of links) {
    const entry = perEc.get(link.courseElementId);
    if (!entry) continue;
    entry.total += 1;
    if (link.resource.status === "PUBLISHED" && link.resource.visibility === "EC_STUDENTS") entry.published += 1;
  }
  const byCourseElement = elements.map((e) => ({ ...e, ...perEc.get(e.id)! }));

  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const top = await db.accessLog.groupBy({
    by: ["resourceId"],
    where: { createdAt: { gte: since }, resource: inProgram },
    _count: true,
    orderBy: { _count: { resourceId: "desc" } },
    take: 10,
  });
  const topResources = await db.resource.findMany({
    where: { id: { in: top.map((t) => t.resourceId!) } },
    select: { id: true, title: true, type: true, author: { select: { firstName: true, lastName: true } } },
  });
  const titles = new Map(topResources.map((r) => [r.id, r]));
  const [recentAccesses, publishedResources] = await Promise.all([
    db.accessLog.count({ where: { createdAt: { gte: since }, resource: inProgram } }),
    db.resource.count({ where: { ...inProgram, status: "PUBLISHED" } }),
  ]);

  return {
    byCourseElement,
    withoutResource: byCourseElement.filter((e) => e.published === 0),
    mostConsulted: top.map((t) => ({ ...titles.get(t.resourceId!)!, accesses: t._count })).filter((r) => r.id),
    totals: {
      courseElements: elements.length,
      publishedResources,
      recentAccesses,
    },
  };
}

/** Export CSV des statistiques d'une formation (F26). */
export async function programDashboardCsv(actor: CurrentUser, programId: string, academicYearId: string): Promise<string> {
  const data = await programDashboard(actor, programId, academicYearId);
  return toCsv(
    ["Semestre", "UE", "Code EC", "EC", "Ressources (toutes)", "Ressources publiées pour les étudiants"],
    data.byCourseElement.map((e) => [`S${e.teachingUnit.semester.number}`, e.teachingUnit.code, e.code, e.title, e.total, e.published]),
  );
}

/** Export CSV du tableau de bord enseignant (F26). */
export async function teacherDashboardCsv(actor: CurrentUser, academicYearId?: string): Promise<string> {
  const data = await teacherDashboard(actor, academicYearId);
  return toCsv(
    ["Ressource", "Type", "EC", "Consultations", "Téléchargements", `Consultations (${RECENT_DAYS} j)`, `Téléchargements (${RECENT_DAYS} j)`],
    data.rows.map((r) => [
      r.title,
      RESOURCE_TYPE_LABELS[r.type],
      r.courseElements.map((c) => c.courseElement.title).join(", "),
      r.views,
      r.downloads,
      r.recentViews,
      r.recentDownloads,
    ]),
  );
}
