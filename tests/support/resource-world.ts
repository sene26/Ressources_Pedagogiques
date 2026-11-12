import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "@/server/db";
import { createCourseElement, createProgram, createTeachingUnit, addProgramManager } from "@/server/services/catalog";
import { assignTeacher } from "@/server/services/assignments";
import { enrollStudent } from "@/server/services/enrollments";
import { setStorageForTests } from "@/server/storage";
import { LocalStorage } from "@/server/storage/local";
import { actor, makeUser, makeYear } from "./db-helpers";

/** Fichiers de test minimaux, au contenu conforme à leur extension. */
export const pdf = (name = "cours.pdf", body = "contenu") => new File([`%PDF-1.4\n${body}\n%%EOF`], name, { type: "application/pdf" });
export const txt = (name = "notes.txt", body = "Bonjour") => new File([body], name, { type: "text/plain" });
export const fileContent = (file: File) => ({ mode: "file" as const, file });

let storageDir: string | undefined;

/** Stockage local dans un dossier temporaire, propre à la suite de tests. */
export async function useTemporaryStorage(): Promise<string> {
  storageDir = await mkdtemp(path.join(tmpdir(), "ressources-test-"));
  setStorageForTests(new LocalStorage(storageDir));
  return storageDir;
}

export async function cleanTemporaryStorage(): Promise<void> {
  setStorageForTests(undefined);
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
}

/**
 * Jeu de données type : Master « M-MIO » (EC par semestre) et Licence « L-INFO »,
 * avec enseignants, responsable et étudiants de niveaux et formations différents.
 */
export async function buildWorld() {
  const admin = await makeUser(["ADMIN"]);
  const previousYear = await makeYear("2025-2026", false);
  const year = await makeYear("2026-2027", true);

  const master = await createProgram(admin, { code: "M-MIO", title: "Master MIO", cycle: "MASTER" });
  const licence = await createProgram(admin, { code: "L-INFO", title: "Licence Informatique", cycle: "LICENCE" });
  const ec: Record<string, string> = {};
  for (const program of [master, licence]) {
    const semesters = await db.semester.findMany({ where: { programId: program.id, number: { in: [1, 3] } } });
    for (const s of semesters) {
      const ue = await createTeachingUnit(admin, { semesterId: s.id, code: `UE${s.number}`, title: `UE ${s.number}`, credits: 10 });
      const element = await createCourseElement(admin, { teachingUnitId: ue.id, code: `EC${s.number}`, title: `${program.code} EC S${s.number}`, credits: 5 });
      ec[`${program.code}-S${s.number}`] = element.id;
    }
  }

  const author = await makeUser(["TEACHER"]); // affectée à M-MIO S1
  const colleague = await makeUser(["TEACHER"]); // même EC : équipe pédagogique
  const otherTeacher = await makeUser(["TEACHER"]); // aucune affectation commune
  const managerUser = await makeUser(["TEACHER", "PROGRAM_MANAGER"]);
  await addProgramManager(admin, { userId: managerUser.id, programId: master.id });
  const otherManagerUser = await makeUser(["PROGRAM_MANAGER"]);
  await addProgramManager(admin, { userId: otherManagerUser.id, programId: licence.id });

  for (const teacher of [author, colleague]) {
    await assignTeacher(admin, { teacherId: teacher.id, courseElementId: ec["M-MIO-S1"], academicYearId: year.id });
  }
  await assignTeacher(admin, { teacherId: author.id, courseElementId: ec["M-MIO-S3"], academicYearId: year.id });
  await assignTeacher(admin, { teacherId: otherTeacher.id, courseElementId: ec["L-INFO-S1"], academicYearId: year.id });
  await assignTeacher(admin, { teacherId: otherTeacher.id, courseElementId: ec["M-MIO-S1"], academicYearId: previousYear.id });

  const enroll = async (programId: string, level: number, academicYearId = year.id) => {
    const student = await makeUser(["STUDENT"]);
    await enrollStudent(admin, { studentEmail: student.email, programId, level, academicYearId });
    return student;
  };
  const studentM1 = await enroll(master.id, 1);
  const studentM2 = await enroll(master.id, 2);
  const studentL1 = await enroll(licence.id, 1);
  const studentPreviousYear = await enroll(master.id, 1, previousYear.id);
  const studentNotEnrolled = await makeUser(["STUDENT"]);

  return {
    admin,
    year,
    previousYear,
    master,
    licence,
    ec,
    author,
    colleague,
    otherTeacher,
    manager: (await actor(managerUser.id))!,
    otherManager: (await actor(otherManagerUser.id))!,
    studentM1,
    studentM2,
    studentL1,
    studentPreviousYear,
    studentNotEnrolled,
  };
}

export type World = Awaited<ReturnType<typeof buildWorld>>;
