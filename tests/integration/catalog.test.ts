import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { actor } from "../support/db-helpers";
import {
  addProgramManager,
  createCourseElement,
  createProgram,
  createTeachingUnit,
  getProgramTree,
  setCourseElementArchived,
  setTeachingUnitArchived,
  updateCourseElement,
} from "@/server/services/catalog";
import { makeUser, resetDatabase } from "../support/db-helpers";

beforeEach(resetDatabase);

async function setup() {
  const admin = await makeUser(["ADMIN"]);
  const program = await createProgram(admin, { code: "M-MIO", title: "Master MIO", cycle: "MASTER" });
  const s1 = await db.semester.findFirstOrThrow({ where: { programId: program.id, number: 1 } });
  return { admin, program, s1 };
}

describe("F5 — Formations, semestres, UE et EC", () => {
  it("crée automatiquement 4 semestres pour un Master et 6 pour une Licence", async () => {
    const { admin, program } = await setup();
    const licence = await createProgram(admin, { code: "L-MI", title: "Licence MI", cycle: "LICENCE" });
    expect(await db.semester.count({ where: { programId: program.id } })).toBe(4);
    expect(await db.semester.count({ where: { programId: licence.id } })).toBe(6);
  });

  it("refuse deux formations de même code", async () => {
    const { admin } = await setup();
    await expect(createProgram(admin, { code: "M-MIO", title: "Doublon", cycle: "MASTER" })).rejects.toThrow(ConflictError);
  });

  it("RG1 — un EC appartient à une UE, une UE à un semestre, un semestre à une formation", async () => {
    const { admin, program, s1 } = await setup();
    const ue = await createTeachingUnit(admin, { semesterId: s1.id, code: "MIO111", title: "Maths", credits: 10 });
    const ec = await createCourseElement(admin, { teachingUnitId: ue.id, code: "MIO1111", title: "Optimisation linéaire", credits: 5 });

    const loaded = await db.courseElement.findUniqueOrThrow({
      where: { id: ec.id },
      include: { teachingUnit: { include: { semester: { include: { program: true } } } } },
    });
    expect(loaded.teachingUnit.semester.program.id).toBe(program.id);

    // Un EC sans UE existante est refusé par le service…
    await expect(
      createCourseElement(admin, { teachingUnitId: "00000000-0000-4000-8000-000000000000", code: "X", title: "X", credits: 1 }),
    ).rejects.toThrow(NotFoundError);
    // … et par la base elle-même (clé étrangère).
    await expect(
      db.courseElement.create({ data: { teachingUnitId: "00000000-0000-4000-8000-000000000000", code: "X", title: "X", credits: 1 } }),
    ).rejects.toThrow();
  });

  it("les codes d'UE et d'EC sont uniques dans leur parent", async () => {
    const { admin, s1 } = await setup();
    const ue = await createTeachingUnit(admin, { semesterId: s1.id, code: "MIO111", title: "Maths", credits: 10 });
    await expect(createTeachingUnit(admin, { semesterId: s1.id, code: "MIO111", title: "Bis", credits: 1 })).rejects.toThrow(ConflictError);
    await createCourseElement(admin, { teachingUnitId: ue.id, code: "EC1", title: "A", credits: 5 });
    await expect(createCourseElement(admin, { teachingUnitId: ue.id, code: "EC1", title: "B", credits: 5 })).rejects.toThrow(ConflictError);
  });

  it("valide les saisies (crédits, intitulé)", async () => {
    const { admin, s1 } = await setup();
    await expect(createTeachingUnit(admin, { semesterId: s1.id, code: "U", title: "", credits: 3 })).rejects.toThrow(ValidationError);
    await expect(createTeachingUnit(admin, { semesterId: s1.id, code: "U", title: "T", credits: 99 })).rejects.toThrow(ValidationError);
  });

  it("archive et restaure une UE ; une UE archivée n'accepte pas de nouvel EC", async () => {
    const { admin, s1 } = await setup();
    const ue = await createTeachingUnit(admin, { semesterId: s1.id, code: "MIO111", title: "Maths", credits: 10 });
    await setTeachingUnitArchived(admin, ue.id, true);
    await expect(createCourseElement(admin, { teachingUnitId: ue.id, code: "EC1", title: "A", credits: 5 })).rejects.toThrow(ConflictError);
    await setTeachingUnitArchived(admin, ue.id, false);
    await expect(createCourseElement(admin, { teachingUnitId: ue.id, code: "EC1", title: "A", credits: 5 })).resolves.toBeTruthy();
  });

  it("archiver un EC le conserve en base (pas de suppression)", async () => {
    const { admin, s1 } = await setup();
    const ue = await createTeachingUnit(admin, { semesterId: s1.id, code: "MIO111", title: "Maths", credits: 10 });
    const ec = await createCourseElement(admin, { teachingUnitId: ue.id, code: "EC1", title: "A", credits: 5 });
    await setCourseElementArchived(admin, ec.id, true);
    expect(await db.courseElement.findUniqueOrThrow({ where: { id: ec.id } })).toMatchObject({ archived: true });
  });
});

describe("F5 — Droits sur la maquette (A3)", () => {
  it("un responsable gère la maquette de sa formation, pas celle des autres", async () => {
    const { admin, program, s1 } = await setup();
    const other = await createProgram(admin, { code: "L-MI", title: "Licence MI", cycle: "LICENCE" });
    const otherS1 = await db.semester.findFirstOrThrow({ where: { programId: other.id, number: 1 } });
    const managerUser = await makeUser(["TEACHER", "PROGRAM_MANAGER"]);
    await addProgramManager(admin, { userId: managerUser.id, programId: program.id });
    const manager = (await actor(managerUser.id))!;

    const ue = await createTeachingUnit(manager, { semesterId: s1.id, code: "MIO111", title: "Maths", credits: 10 });
    expect(ue.code).toBe("MIO111");
    await expect(createTeachingUnit(manager, { semesterId: otherS1.id, code: "X", title: "X", credits: 1 })).rejects.toThrow(ForbiddenError);
    await expect(getProgramTree(manager, other.id)).rejects.toThrow(ForbiddenError);
    // Un responsable ne crée pas de formation.
    await expect(createProgram(manager, { code: "NEW", title: "Nouvelle", cycle: "LICENCE" })).rejects.toThrow(ForbiddenError);
  });

  it("un enseignant ou un étudiant ne peut pas modifier la maquette", async () => {
    const { admin, s1 } = await setup();
    const ue = await createTeachingUnit(admin, { semesterId: s1.id, code: "MIO111", title: "Maths", credits: 10 });
    const ec = await createCourseElement(admin, { teachingUnitId: ue.id, code: "EC1", title: "A", credits: 5 });
    for (const roles of [["TEACHER"], ["STUDENT"]] as const) {
      const someone = await makeUser([...roles]);
      await expect(updateCourseElement(someone, { id: ec.id, code: "EC1", title: "Piraté", credits: 5 })).rejects.toThrow(ForbiddenError);
    }
  });

  it("seuls les utilisateurs ayant le rôle de responsable peuvent être rattachés", async () => {
    const { admin, program } = await setup();
    const teacher = await makeUser(["TEACHER"]);
    await expect(addProgramManager(admin, { userId: teacher.id, programId: program.id })).rejects.toThrow(ValidationError);
  });
});
