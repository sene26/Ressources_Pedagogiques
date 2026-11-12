import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { assignTeacher, listTeacherCourseElements, unassignTeacher } from "@/server/services/assignments";
import { addProgramManager, createCourseElement, createProgram, createTeachingUnit, setCourseElementArchived } from "@/server/services/catalog";
import { enrollStudent, getStudentCurriculum, listEnrollments } from "@/server/services/enrollments";
import { actor, makeUser, makeYear, resetDatabase } from "../support/db-helpers";

beforeEach(resetDatabase);

/** Master MIO avec une UE et un EC par semestre (S1 à S4). */
async function setup() {
  const admin = await makeUser(["ADMIN"]);
  const year = await makeYear("2026-2027", true);
  const program = await createProgram(admin, { code: "M-MIO", title: "Master MIO", cycle: "MASTER" });
  const semesters = await db.semester.findMany({ where: { programId: program.id }, orderBy: { number: "asc" } });
  const ecs = [];
  for (const s of semesters) {
    const ue = await createTeachingUnit(admin, { semesterId: s.id, code: `UE${s.number}`, title: `UE S${s.number}`, credits: 30 });
    ecs.push(await createCourseElement(admin, { teachingUnitId: ue.id, code: `EC${s.number}`, title: `EC S${s.number}`, credits: 30 }));
  }
  return { admin, year, program, ecs };
}

describe("F6 — Affectation des enseignants aux EC", () => {
  it("affecte un enseignant à un EC pour une année et liste ses enseignements", async () => {
    const { admin, year, ecs } = await setup();
    const teacher = await makeUser(["TEACHER"]);
    await assignTeacher(admin, { teacherId: teacher.id, courseElementId: ecs[0].id, academicYearId: year.id });
    const previous = await makeYear("2025-2026", false);
    await assignTeacher(admin, { teacherId: teacher.id, courseElementId: ecs[1].id, academicYearId: previous.id });

    const current = await listTeacherCourseElements(teacher.id, year.id);
    expect(current.map((e) => e.code)).toEqual(["EC1"]);
    expect(await db.auditLog.count({ where: { action: "TEACHER_ASSIGNED" } })).toBe(2);
  });

  it("refuse un doublon, un utilisateur non enseignant et un EC archivé", async () => {
    const { admin, year, ecs } = await setup();
    const teacher = await makeUser(["TEACHER"]);
    const student = await makeUser(["STUDENT"]);
    const input = { teacherId: teacher.id, courseElementId: ecs[0].id, academicYearId: year.id };
    await assignTeacher(admin, input);
    await expect(assignTeacher(admin, input)).rejects.toThrow(ConflictError);
    await expect(assignTeacher(admin, { ...input, teacherId: student.id })).rejects.toThrow(ValidationError);
    await setCourseElementArchived(admin, ecs[1].id, true);
    await expect(assignTeacher(admin, { ...input, courseElementId: ecs[1].id })).rejects.toThrow(ConflictError);
  });

  it("retire une affectation", async () => {
    const { admin, year, ecs } = await setup();
    const teacher = await makeUser(["TEACHER"]);
    const input = { teacherId: teacher.id, courseElementId: ecs[0].id, academicYearId: year.id };
    await assignTeacher(admin, input);
    await unassignTeacher(admin, input);
    expect(await listTeacherCourseElements(teacher.id, year.id)).toEqual([]);
    await expect(unassignTeacher(admin, input)).rejects.toThrow(NotFoundError);
  });

  it("seul le responsable de la formation (ou l'administrateur) affecte", async () => {
    const { admin, year, program, ecs } = await setup();
    const teacher = await makeUser(["TEACHER"]);
    const input = { teacherId: teacher.id, courseElementId: ecs[0].id, academicYearId: year.id };

    const otherManager = await makeUser(["PROGRAM_MANAGER"]);
    await expect(assignTeacher(otherManager, input)).rejects.toThrow(ForbiddenError);
    await expect(assignTeacher(teacher, input)).rejects.toThrow(ForbiddenError);

    const managerUser = await makeUser(["TEACHER", "PROGRAM_MANAGER"]);
    await addProgramManager(admin, { userId: managerUser.id, programId: program.id });
    await expect(assignTeacher((await actor(managerUser.id))!, input)).resolves.toBeTruthy();
  });
});

describe("F7 — Inscription des étudiants", () => {
  it("inscrit un étudiant à une formation et un niveau ; ses cours sont ceux des semestres de son niveau", async () => {
    const { admin, year, program } = await setup();
    const student = await makeUser(["STUDENT"], { email: "fatou.sarr@uasz.test" });
    await enrollStudent(admin, { studentEmail: "Fatou.Sarr@uasz.test", programId: program.id, level: 1, academicYearId: year.id });

    const curriculum = await getStudentCurriculum(student.id, year.id);
    expect(curriculum?.semesters.map((s) => s.number)).toEqual([1, 2]);
    expect(curriculum?.semesters.flatMap((s) => s.teachingUnits.flatMap((u) => u.courseElements.map((e) => e.code)))).toEqual(["EC1", "EC2"]);
    expect((await listEnrollments(admin, program.id, year.id)).map((e) => e.studentId)).toEqual([student.id]);
  });

  it("les EC archivés n'apparaissent pas dans les cours de l'étudiant", async () => {
    const { admin, year, program, ecs } = await setup();
    const student = await makeUser(["STUDENT"], { email: "e@uasz.test" });
    await enrollStudent(admin, { studentEmail: "e@uasz.test", programId: program.id, level: 1, academicYearId: year.id });
    await setCourseElementArchived(admin, ecs[0].id, true);
    const curriculum = await getStudentCurriculum(student.id, year.id);
    expect(curriculum?.semesters.flatMap((s) => s.teachingUnits.flatMap((u) => u.courseElements.map((e) => e.code)))).toEqual(["EC2"]);
  });

  it("un étudiant a au plus une inscription par année", async () => {
    const { admin, year, program } = await setup();
    await makeUser(["STUDENT"], { email: "e@uasz.test" });
    const input = { studentEmail: "e@uasz.test", programId: program.id, level: 1, academicYearId: year.id };
    await enrollStudent(admin, input);
    await expect(enrollStudent(admin, { ...input, level: 2 })).rejects.toThrow(ConflictError);
    const next = await makeYear("2027-2028", false);
    await expect(enrollStudent(admin, { ...input, level: 2, academicYearId: next.id })).resolves.toBeTruthy();
  });

  it("refuse un niveau inexistant, un compte non étudiant ou une adresse inconnue", async () => {
    const { admin, year, program } = await setup();
    await makeUser(["STUDENT"], { email: "e@uasz.test" });
    await makeUser(["TEACHER"], { email: "t@uasz.test" });
    const base = { programId: program.id, academicYearId: year.id };
    await expect(enrollStudent(admin, { ...base, studentEmail: "e@uasz.test", level: 3 })).rejects.toThrow(ValidationError);
    await expect(enrollStudent(admin, { ...base, studentEmail: "t@uasz.test", level: 1 })).rejects.toThrow(ValidationError);
    await expect(enrollStudent(admin, { ...base, studentEmail: "inconnu@uasz.test", level: 1 })).rejects.toThrow(NotFoundError);
  });

  it("sans inscription pour l'année, l'étudiant n'a aucun cours (préparation de la RG7)", async () => {
    const { admin, program } = await setup();
    const student = await makeUser(["STUDENT"], { email: "e@uasz.test" });
    const previous = await makeYear("2025-2026", false);
    await enrollStudent(admin, { studentEmail: "e@uasz.test", programId: program.id, level: 1, academicYearId: previous.id });
    const current = await db.academicYear.findUniqueOrThrow({ where: { isCurrent: true } });
    expect(await getStudentCurriculum(student.id, current.id)).toBeNull();
  });
});
