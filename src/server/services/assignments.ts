import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseInput, teachingAssignmentSchema } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { canManageProgram } from "../policies/user-policy";
import { withUniqueConflict } from "../prisma-errors";
import { programIdOfCourseElement } from "./catalog";

/**
 * Affectation des enseignants aux EC pour une année universitaire (F6).
 * Ces affectations fondent le droit de dépôt de la RG2 (Lot 2).
 */
export async function assignTeacher(actor: CurrentUser, input: unknown) {
  const data = parseInput(teachingAssignmentSchema, input);
  const programId = await programIdOfCourseElement(data.courseElementId);
  ensure(canManageProgram(actor, programId));

  const [teacher, element, year] = await Promise.all([
    db.user.findUnique({ where: { id: data.teacherId }, include: { roles: true } }),
    db.courseElement.findUnique({ where: { id: data.courseElementId }, include: { teachingUnit: true } }),
    db.academicYear.findUnique({ where: { id: data.academicYearId } }),
  ]);
  if (!teacher || !teacher.active) throw new NotFoundError("Enseignant introuvable ou compte désactivé.");
  if (!teacher.roles.some((r) => r.role === "TEACHER")) {
    throw new ValidationError("Cet utilisateur n'a pas le rôle « Enseignant ».");
  }
  if (!element) throw new NotFoundError("EC introuvable.");
  if (element.archived || element.teachingUnit.archived) throw new ConflictError("Impossible d'affecter un enseignant à un EC archivé.");
  if (!year) throw new NotFoundError("Année universitaire introuvable.");

  return withUniqueConflict("Cet enseignant est déjà affecté à cet EC pour cette année.", () =>
    db.$transaction(async (tx) => {
      const assignment = await tx.teachingAssignment.create({ data });
      await audit(tx, {
        actorId: actor.id,
        action: "TEACHER_ASSIGNED",
        entityType: "CourseElement",
        entityId: data.courseElementId,
        details: { teacherId: data.teacherId, academicYear: year.label },
      });
      return assignment;
    }),
  );
}

export async function unassignTeacher(actor: CurrentUser, input: unknown) {
  const data = parseInput(teachingAssignmentSchema, input);
  const programId = await programIdOfCourseElement(data.courseElementId);
  ensure(canManageProgram(actor, programId));
  await db.$transaction(async (tx) => {
    const { count } = await tx.teachingAssignment.deleteMany({ where: data });
    if (count === 0) throw new NotFoundError("Affectation introuvable.");
    await audit(tx, {
      actorId: actor.id,
      action: "TEACHER_UNASSIGNED",
      entityType: "CourseElement",
      entityId: data.courseElementId,
      details: { teacherId: data.teacherId },
    });
  });
}

/** EC affectés à un enseignant pour une année, avec leur UE, semestre et formation. */
export function listTeacherCourseElements(teacherId: string, academicYearId: string) {
  return db.courseElement.findMany({
    where: {
      archived: false,
      teachingAssignments: { some: { teacherId, academicYearId } },
    },
    include: { teachingUnit: { include: { semester: { include: { program: true } } } } },
    orderBy: [{ code: "asc" }],
  });
}
