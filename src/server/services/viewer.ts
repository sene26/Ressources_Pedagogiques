import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { isTeacher, type ViewerContext } from "../policies/resource-policy";
import { hasRole } from "../policies/user-policy";

/**
 * Charge le contexte nécessaire aux politiques d'accès aux ressources :
 * année en cours, inscription (étudiant) et affectations (enseignant).
 */
export async function loadViewerContext(user: CurrentUser): Promise<ViewerContext> {
  const year = await db.academicYear.findUnique({ where: { isCurrent: true }, select: { id: true } });
  const [enrollment, assignments] = await Promise.all([
    year && hasRole(user, "STUDENT")
      ? db.enrollment.findUnique({
          where: { studentId_academicYearId: { studentId: user.id, academicYearId: year.id } },
          select: { programId: true, level: true },
        })
      : null,
    isTeacher(user)
      ? db.teachingAssignment.findMany({
          where: { teacherId: user.id },
          select: { courseElementId: true, academicYearId: true },
        })
      : [],
  ]);
  return { user, currentYearId: year?.id ?? null, enrollment, assignments };
}
