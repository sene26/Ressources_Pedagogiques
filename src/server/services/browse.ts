import type { Prisma, ResourceType } from "@prisma/client";
import { semestersOfLevel } from "@/lib/academic";
import { NotFoundError } from "@/lib/errors";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { isTeacher, visibleResourcesWhere, type ViewerContext } from "../policies/resource-policy";
import { hasRole, isAdmin } from "../policies/user-policy";
import { RESOURCE_PAGE_SIZE } from "./resources";
import { loadViewerContext } from "./viewer";

/**
 * Consultation (F17, F20) : navigation formation › semestre › UE › EC et pages d'EC.
 * Toutes les listes de ressources passent par `visibleResourcesWhere` (RG2–RG7).
 */

/** Une ressource est « nouvelle » pendant 7 jours après sa publication. */
export const NEW_RESOURCE_DAYS = 7;

/** Un étudiant ne parcourt que sa formation, à son niveau (RG7) ; les autres profils parcourent tout. */
function isStudentOnly(viewer: ViewerContext): boolean {
  return hasRole(viewer.user, "STUDENT") && !isTeacher(viewer.user) && !isAdmin(viewer.user);
}

export async function listBrowsablePrograms(actor: CurrentUser) {
  const viewer = await loadViewerContext(actor);
  if (isStudentOnly(viewer)) {
    if (!viewer.enrollment) return [];
    return db.program.findMany({ where: { id: viewer.enrollment.programId } });
  }
  return db.program.findMany({ where: { archived: false }, orderBy: { code: "asc" } });
}

/** Nombre de ressources visibles (et nouvelles) par EC. */
async function countByCourseElement(viewer: ViewerContext, courseElementIds: string[], now: Date) {
  if (courseElementIds.length === 0) return new Map<string, { total: number; recent: number }>();
  const visible = visibleResourcesWhere(viewer, now);
  const since = new Date(now.getTime() - NEW_RESOURCE_DAYS * 86_400_000);
  const recentWhere: Prisma.ResourceWhereInput = {
    AND: [visible, { status: "PUBLISHED" }, { OR: [{ publishAt: { gte: since, lte: now } }, { publishAt: null, createdAt: { gte: since } }] }],
  };
  const [totals, recents] = await Promise.all([
    db.resourceCourseElement.groupBy({ by: ["courseElementId"], where: { courseElementId: { in: courseElementIds }, resource: visible }, _count: true }),
    db.resourceCourseElement.groupBy({ by: ["courseElementId"], where: { courseElementId: { in: courseElementIds }, resource: recentWhere }, _count: true }),
  ]);
  const result = new Map(courseElementIds.map((id) => [id, { total: 0, recent: 0 }]));
  for (const t of totals) result.get(t.courseElementId)!.total = t._count;
  for (const r of recents) result.get(r.courseElementId)!.recent = r._count;
  return result;
}

/**
 * Maquette d'une formation avec, pour chaque EC, le nombre de ressources visibles (F17).
 * Pour un étudiant : sa formation seulement, et les semestres de son niveau (F20).
 */
export async function getProgramBrowse(actor: CurrentUser, programId: string, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  let semesterNumbers: number[] | undefined;
  if (isStudentOnly(viewer)) {
    if (viewer.enrollment?.programId !== programId) throw new NotFoundError("Formation introuvable.");
    semesterNumbers = semestersOfLevel(viewer.enrollment.level);
  }
  const program = await db.program.findUnique({
    where: { id: programId },
    include: {
      semesters: {
        where: semesterNumbers ? { number: { in: semesterNumbers } } : {},
        orderBy: { number: "asc" },
        include: {
          teachingUnits: {
            where: { archived: false },
            orderBy: { code: "asc" },
            include: { courseElements: { where: { archived: false }, orderBy: { code: "asc" } } },
          },
        },
      },
    },
  });
  if (!program || (program.archived && !isAdmin(actor))) throw new NotFoundError("Formation introuvable.");
  const ecIds = program.semesters.flatMap((s) => s.teachingUnits.flatMap((u) => u.courseElements.map((e) => e.id)));
  const counts = await countByCourseElement(viewer, ecIds, now);
  return { program, counts, enrollment: viewer.enrollment };
}

/** « Mes cours » (F20) : la formation et le niveau de l'étudiant pour l'année en cours. */
export async function getMyCourses(actor: CurrentUser, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  if (!viewer.enrollment) return null;
  const browse = await getProgramBrowse(actor, viewer.enrollment.programId, now);
  return { ...browse, level: viewer.enrollment.level };
}

export interface CourseElementFilters {
  type?: ResourceType;
  format?: string;
  page?: number;
}

/** Page d'un EC : son chemin, ses enseignants de l'année et ses ressources visibles, filtrées et paginées. */
export async function getCourseElementPage(actor: CurrentUser, courseElementId: string, filters: CourseElementFilters = {}, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const element = await db.courseElement.findUnique({
    where: { id: courseElementId },
    include: { teachingUnit: { include: { semester: { include: { program: true } } } } },
  });
  if (!element) throw new NotFoundError("EC introuvable.");
  const semester = element.teachingUnit.semester;
  if (isStudentOnly(viewer)) {
    // RG7 : un étudiant n'ouvre que les EC de sa formation et de son niveau.
    const level = viewer.enrollment?.level;
    if (viewer.enrollment?.programId !== semester.programId || !level || !semestersOfLevel(level).includes(semester.number)) {
      throw new NotFoundError("EC introuvable.");
    }
  }

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const where: Prisma.ResourceWhereInput = {
    AND: [
      visibleResourcesWhere(viewer, now),
      { courseElements: { some: { courseElementId } } },
      filters.type ? { type: filters.type } : {},
      filters.format ? { versions: { some: { format: filters.format } } } : {},
    ],
  };
  const [total, resources, teachers] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({
      where,
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * RESOURCE_PAGE_SIZE,
      take: RESOURCE_PAGE_SIZE,
      include: {
        author: { select: { firstName: true, lastName: true } },
        versions: { orderBy: { number: "desc" }, take: 1, select: { number: true, format: true, sizeBytes: true, createdAt: true } },
      },
    }),
    viewer.currentYearId
      ? db.user.findMany({
          where: { teachingAssignments: { some: { courseElementId, academicYearId: viewer.currentYearId } } },
          select: { firstName: true, lastName: true },
          orderBy: { lastName: "asc" },
        })
      : [],
  ]);
  const canUpload =
    viewer.currentYearId !== null &&
    viewer.assignments.some((a) => a.courseElementId === courseElementId && a.academicYearId === viewer.currentYearId) &&
    !element.archived;
  return { element, resources, total, page, pageCount: Math.max(1, Math.ceil(total / RESOURCE_PAGE_SIZE)), teachers, canUpload };
}
