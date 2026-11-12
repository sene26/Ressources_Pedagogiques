import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { levelCount, semestersOfLevel } from "@/lib/academic";
import { enrollmentSchema, parseInput } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { canManageProgram } from "../policies/user-policy";
import { withUniqueConflict } from "../prisma-errors";

/**
 * Inscription des étudiants à une formation et un niveau pour une année universitaire (F7).
 * Un étudiant a au plus une inscription par année (contrainte d'unicité en base).
 */
export async function enrollStudent(actor: CurrentUser, input: unknown) {
  const data = parseInput(enrollmentSchema, input);
  ensure(canManageProgram(actor, data.programId));

  const [student, program, year] = await Promise.all([
    db.user.findUnique({ where: { email: data.studentEmail }, include: { roles: true } }),
    db.program.findUnique({ where: { id: data.programId } }),
    db.academicYear.findUnique({ where: { id: data.academicYearId } }),
  ]);
  if (!student) throw new NotFoundError(`Aucun compte n'existe avec l'adresse ${data.studentEmail}.`);
  if (!student.roles.some((r) => r.role === "STUDENT")) {
    throw new ValidationError("Cet utilisateur n'a pas le rôle « Étudiant ».", { studentEmail: "Cet utilisateur n'a pas le rôle « Étudiant »." });
  }
  if (!program) throw new NotFoundError("Formation introuvable.");
  if (program.archived) throw new ConflictError("Cette formation est archivée.");
  if (data.level > levelCount(program.cycle)) {
    throw new ValidationError(`Niveau invalide : cette formation compte ${levelCount(program.cycle)} niveaux.`, { level: "Niveau invalide." });
  }
  if (!year) throw new NotFoundError("Année universitaire introuvable.");

  return withUniqueConflict(`Cet étudiant est déjà inscrit pour l'année ${year.label}.`, () =>
    db.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: { studentId: student.id, programId: program.id, level: data.level, academicYearId: year.id },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "STUDENT_ENROLLED",
        entityType: "Enrollment",
        entityId: enrollment.id,
        details: { studentId: student.id, program: program.code, level: data.level, academicYear: year.label },
      });
      return enrollment;
    }),
  );
}

export async function unenrollStudent(actor: CurrentUser, enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new NotFoundError("Inscription introuvable.");
  ensure(canManageProgram(actor, enrollment.programId));
  await db.$transaction(async (tx) => {
    await tx.enrollment.delete({ where: { id: enrollmentId } });
    await audit(tx, {
      actorId: actor.id,
      action: "STUDENT_UNENROLLED",
      entityType: "Enrollment",
      entityId: enrollmentId,
      details: { studentId: enrollment.studentId, programId: enrollment.programId },
    });
  });
}

/** Inscriptions d'une formation pour une année, par niveau puis par nom. */
export async function listEnrollments(actor: CurrentUser, programId: string, academicYearId: string) {
  ensure(canManageProgram(actor, programId));
  return db.enrollment.findMany({
    where: { programId, academicYearId },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true, active: true } } },
    orderBy: [{ level: "asc" }, { student: { lastName: "asc" } }],
  });
}

/**
 * Inscription d'un étudiant pour une année, avec les EC (non archivés) de son niveau,
 * classés par semestre puis par UE. Sert à l'espace « Mes cours » (F20, RG7).
 */
export async function getStudentCurriculum(studentId: string, academicYearId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_academicYearId: { studentId, academicYearId } },
    include: { program: true, academicYear: true },
  });
  if (!enrollment) return null;
  const semesters = await db.semester.findMany({
    where: { programId: enrollment.programId, number: { in: semestersOfLevel(enrollment.level) } },
    orderBy: { number: "asc" },
    include: {
      teachingUnits: {
        where: { archived: false },
        orderBy: { code: "asc" },
        include: { courseElements: { where: { archived: false }, orderBy: { code: "asc" } } },
      },
    },
  });
  return { enrollment, semesters };
}
