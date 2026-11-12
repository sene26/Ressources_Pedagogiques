import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { semesterCount } from "@/lib/academic";
import {
  createCourseElementSchema,
  createProgramSchema,
  createTeachingUnitSchema,
  parseInput,
  programManagerSchema,
  updateCourseElementSchema,
  updateProgramSchema,
  updateTeachingUnitSchema,
} from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { canCreateProgram, canManageProgram, isAdmin } from "../policies/user-policy";
import { withNotFound, withUniqueConflict } from "../prisma-errors";

/**
 * Gestion de la maquette (F5) : formations, semestres, UE et EC.
 * Hiérarchie (RG1) : EC → UE → Semestre → Formation, garantie par des clés étrangères non nulles.
 * On n'efface pas les éléments de la maquette : on les archive, pour préserver l'historique (A2).
 */

// ─── Formations ────────────────────────────────────────────────────────────────

/** Crée une formation et ses semestres (6 en Licence, 4 en Master). */
export async function createProgram(actor: CurrentUser, input: unknown) {
  ensure(canCreateProgram(actor));
  const data = parseInput(createProgramSchema, input);
  return withUniqueConflict(`Une formation existe déjà avec le code ${data.code}.`, () =>
    db.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: {
          ...data,
          semesters: {
            create: Array.from({ length: semesterCount(data.cycle) }, (_, i) => ({ number: i + 1 })),
          },
        },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "PROGRAM_CREATED",
        entityType: "Program",
        entityId: program.id,
        details: { code: program.code },
      });
      return program;
    }),
  );
}

export async function updateProgram(actor: CurrentUser, input: unknown) {
  const data = parseInput(updateProgramSchema, input);
  ensure(canManageProgram(actor, data.id));
  return withUniqueConflict(`Une formation existe déjà avec le code ${data.code}.`, () =>
    db.$transaction(async (tx) => {
      const program = await tx.program.update({
        where: { id: data.id },
        data: { code: data.code, title: data.title },
      });
      await audit(tx, { actorId: actor.id, action: "PROGRAM_UPDATED", entityType: "Program", entityId: program.id });
      return program;
    }),
  );
}

export async function setProgramArchived(actor: CurrentUser, programId: string, archived: boolean) {
  ensure(canCreateProgram(actor));
  return withNotFound(() =>
    db.$transaction(async (tx) => {
    const program = await tx.program.update({ where: { id: programId }, data: { archived } });
    await audit(tx, {
      actorId: actor.id,
      action: archived ? "PROGRAM_ARCHIVED" : "PROGRAM_RESTORED",
      entityType: "Program",
      entityId: programId,
    });
    return program;
    }),
  );
}

/** Formations visibles dans l'espace de gestion : toutes pour l'administrateur, les siennes pour un responsable. */
export function listManageablePrograms(actor: CurrentUser) {
  return db.program.findMany({
    where: isAdmin(actor) ? {} : { id: { in: actor.managedProgramIds } },
    include: { managers: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: [{ archived: "asc" }, { code: "asc" }],
  });
}

/**
 * Maquette complète d'une formation : semestres → UE → EC, avec les enseignants affectés
 * pour l'année `academicYearId` (si fournie).
 */
export async function getProgramTree(actor: CurrentUser, programId: string, academicYearId?: string) {
  ensure(canManageProgram(actor, programId));
  const program = await db.program.findUnique({
    where: { id: programId },
    include: {
      managers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      semesters: {
        orderBy: { number: "asc" },
        include: {
          teachingUnits: {
            orderBy: { code: "asc" },
            include: {
              courseElements: {
                orderBy: { code: "asc" },
                include: {
                  // Sans année universitaire, aucune affectation n'est chargée.
                  teachingAssignments: {
                    where: { academicYearId },
                    take: academicYearId ? undefined : 0,
                    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) throw new NotFoundError("Formation introuvable.");
  return program;
}

// ─── Responsables de formation (A3) ────────────────────────────────────────────

export async function addProgramManager(actor: CurrentUser, input: unknown) {
  ensure(canCreateProgram(actor));
  const data = parseInput(programManagerSchema, input);
  const user = await db.user.findUnique({ where: { id: data.userId }, include: { roles: true } });
  if (!user) throw new NotFoundError("Utilisateur introuvable.");
  if (!user.roles.some((r) => r.role === "PROGRAM_MANAGER")) {
    throw new ValidationError("Cet utilisateur n'a pas le rôle « Responsable de formation ».");
  }
  return withUniqueConflict("Cet utilisateur est déjà responsable de cette formation.", () =>
    db.$transaction(async (tx) => {
      const link = await tx.programManagerAssignment.create({ data });
      await audit(tx, {
        actorId: actor.id,
        action: "PROGRAM_MANAGER_ADDED",
        entityType: "Program",
        entityId: data.programId,
        details: { userId: data.userId },
      });
      return link;
    }),
  );
}

export async function removeProgramManager(actor: CurrentUser, input: unknown) {
  ensure(canCreateProgram(actor));
  const data = parseInput(programManagerSchema, input);
  await db.$transaction(async (tx) => {
    await tx.programManagerAssignment.deleteMany({ where: data });
    await audit(tx, {
      actorId: actor.id,
      action: "PROGRAM_MANAGER_REMOVED",
      entityType: "Program",
      entityId: data.programId,
      details: { userId: data.userId },
    });
  });
}

// ─── UE ────────────────────────────────────────────────────────────────────────

export async function createTeachingUnit(actor: CurrentUser, input: unknown) {
  const data = parseInput(createTeachingUnitSchema, input);
  const semester = await db.semester.findUnique({ where: { id: data.semesterId }, include: { program: true } });
  if (!semester) throw new NotFoundError("Semestre introuvable.");
  ensure(canManageProgram(actor, semester.programId));
  if (semester.program.archived) throw new ConflictError("Cette formation est archivée.");
  return withUniqueConflict(`Une UE de code ${data.code} existe déjà dans ce semestre.`, () =>
    db.$transaction(async (tx) => {
      const unit = await tx.teachingUnit.create({ data });
      await audit(tx, {
        actorId: actor.id,
        action: "TEACHING_UNIT_CREATED",
        entityType: "TeachingUnit",
        entityId: unit.id,
        details: { code: unit.code },
      });
      return unit;
    }),
  );
}

export async function updateTeachingUnit(actor: CurrentUser, input: unknown) {
  const data = parseInput(updateTeachingUnitSchema, input);
  const programId = await programIdOfTeachingUnit(data.id);
  ensure(canManageProgram(actor, programId));
  return withUniqueConflict(`Une UE de code ${data.code} existe déjà dans ce semestre.`, () =>
    db.$transaction(async (tx) => {
      const unit = await tx.teachingUnit.update({
        where: { id: data.id },
        data: { code: data.code, title: data.title, credits: data.credits },
      });
      await audit(tx, { actorId: actor.id, action: "TEACHING_UNIT_UPDATED", entityType: "TeachingUnit", entityId: unit.id });
      return unit;
    }),
  );
}

export async function setTeachingUnitArchived(actor: CurrentUser, unitId: string, archived: boolean) {
  const programId = await programIdOfTeachingUnit(unitId);
  ensure(canManageProgram(actor, programId));
  return withNotFound(() =>
    db.$transaction(async (tx) => {
    const unit = await tx.teachingUnit.update({ where: { id: unitId }, data: { archived } });
    await audit(tx, {
      actorId: actor.id,
      action: archived ? "TEACHING_UNIT_ARCHIVED" : "TEACHING_UNIT_RESTORED",
      entityType: "TeachingUnit",
      entityId: unitId,
    });
    return unit;
    }),
  );
}

// ─── EC ────────────────────────────────────────────────────────────────────────

export async function createCourseElement(actor: CurrentUser, input: unknown) {
  const data = parseInput(createCourseElementSchema, input);
  const unit = await db.teachingUnit.findUnique({
    where: { id: data.teachingUnitId },
    include: { semester: true },
  });
  if (!unit) throw new NotFoundError("UE introuvable.");
  ensure(canManageProgram(actor, unit.semester.programId));
  if (unit.archived) throw new ConflictError("Impossible d'ajouter un EC à une UE archivée.");
  return withUniqueConflict(`Un EC de code ${data.code} existe déjà dans cette UE.`, () =>
    db.$transaction(async (tx) => {
      const element = await tx.courseElement.create({ data });
      await audit(tx, {
        actorId: actor.id,
        action: "COURSE_ELEMENT_CREATED",
        entityType: "CourseElement",
        entityId: element.id,
        details: { code: element.code },
      });
      return element;
    }),
  );
}

export async function updateCourseElement(actor: CurrentUser, input: unknown) {
  const data = parseInput(updateCourseElementSchema, input);
  const programId = await programIdOfCourseElement(data.id);
  ensure(canManageProgram(actor, programId));
  return withUniqueConflict(`Un EC de code ${data.code} existe déjà dans cette UE.`, () =>
    db.$transaction(async (tx) => {
      const element = await tx.courseElement.update({
        where: { id: data.id },
        data: { code: data.code, title: data.title, credits: data.credits },
      });
      await audit(tx, { actorId: actor.id, action: "COURSE_ELEMENT_UPDATED", entityType: "CourseElement", entityId: element.id });
      return element;
    }),
  );
}

export async function setCourseElementArchived(actor: CurrentUser, elementId: string, archived: boolean) {
  const programId = await programIdOfCourseElement(elementId);
  ensure(canManageProgram(actor, programId));
  return withNotFound(() =>
    db.$transaction(async (tx) => {
    const element = await tx.courseElement.update({ where: { id: elementId }, data: { archived } });
    await audit(tx, {
      actorId: actor.id,
      action: archived ? "COURSE_ELEMENT_ARCHIVED" : "COURSE_ELEMENT_RESTORED",
      entityType: "CourseElement",
      entityId: elementId,
    });
    return element;
    }),
  );
}

// ─── Résolution de la formation d'un élément (pour les contrôles d'accès) ──────

export async function programIdOfTeachingUnit(unitId: string): Promise<string> {
  const unit = await db.teachingUnit.findUnique({ where: { id: unitId }, select: { semester: { select: { programId: true } } } });
  if (!unit) throw new NotFoundError("UE introuvable.");
  return unit.semester.programId;
}

export async function programIdOfCourseElement(elementId: string): Promise<string> {
  const element = await db.courseElement.findUnique({
    where: { id: elementId },
    select: { teachingUnit: { select: { semester: { select: { programId: true } } } } },
  });
  if (!element) throw new NotFoundError("EC introuvable.");
  return element.teachingUnit.semester.programId;
}
