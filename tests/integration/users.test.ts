import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { db } from "@/server/db";
import { loadCurrentUser } from "@/server/current-user";
import { createProgram, addProgramManager } from "@/server/services/catalog";
import { createUser, listUsers, setUserActive, updateUser } from "@/server/services/users";
import { makeUser, resetDatabase } from "../support/db-helpers";

beforeEach(resetDatabase);

const newUser = (overrides: Record<string, unknown> = {}) => ({
  lastName: "Diallo",
  firstName: "Awa",
  email: "awa.diallo@uasz.test",
  password: "motdepasse-2026",
  roles: ["TEACHER", "PROGRAM_MANAGER"],
  ...overrides,
});

describe("F2 — Gestion des comptes et des rôles", () => {
  it("l'administrateur crée un compte avec plusieurs rôles, tracé au journal", async () => {
    const admin = await makeUser(["ADMIN"]);
    const user = await createUser(admin, newUser());
    const loaded = await loadCurrentUser(user.id);
    expect(loaded?.roles.sort()).toEqual(["PROGRAM_MANAGER", "TEACHER"]);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "USER_CREATED" } });
    expect(log).toMatchObject({ actorId: admin.id, entityId: user.id });
  });

  it("un non-administrateur ne peut pas créer de compte", async () => {
    for (const roles of [["STUDENT"], ["TEACHER"], ["PROGRAM_MANAGER"]] as const) {
      const someone = await makeUser([...roles]);
      await expect(createUser(someone, newUser({ email: `x${roles[0]}@uasz.test` }))).rejects.toThrow(ForbiddenError);
    }
  });

  it("l'adresse est unique, sans tenir compte de la casse", async () => {
    const admin = await makeUser(["ADMIN"]);
    await createUser(admin, newUser());
    await expect(createUser(admin, newUser({ email: "AWA.Diallo@uasz.test" }))).rejects.toThrow(ConflictError);
  });

  it("l'administrateur ne peut ni se retirer son rôle ni désactiver son propre compte", async () => {
    const admin = await makeUser(["ADMIN"]);
    await expect(
      updateUser(admin, { id: admin.id, lastName: "A", firstName: "B", email: admin.email, roles: ["TEACHER"] }),
    ).rejects.toThrow(ConflictError);
    await expect(setUserActive(admin, admin.id, false)).rejects.toThrow(ConflictError);
  });

  it("retirer le rôle de responsable retire aussi ses rattachements aux formations", async () => {
    const admin = await makeUser(["ADMIN"]);
    const manager = await makeUser(["TEACHER", "PROGRAM_MANAGER"]);
    const program = await createProgram(admin, { code: "M-MIO", title: "Master MIO", cycle: "MASTER" });
    await addProgramManager(admin, { userId: manager.id, programId: program.id });
    expect((await loadCurrentUser(manager.id))?.managedProgramIds).toEqual([program.id]);

    await updateUser(admin, { id: manager.id, lastName: "N", firstName: "P", email: manager.email, roles: ["TEACHER"] });
    expect((await loadCurrentUser(manager.id))?.managedProgramIds).toEqual([]);
  });

  it("un compte désactivé perd immédiatement l'accès", async () => {
    const admin = await makeUser(["ADMIN"]);
    const student = await makeUser(["STUDENT"]);
    await setUserActive(admin, student.id, false);
    expect(await loadCurrentUser(student.id)).toBeNull();
  });

  it("liste les utilisateurs avec recherche et filtre par rôle", async () => {
    const admin = await makeUser(["ADMIN"]);
    await createUser(admin, newUser());
    await createUser(admin, newUser({ lastName: "Sarr", firstName: "Fatou", email: "fatou.sarr@uasz.test", roles: ["STUDENT"] }));
    expect((await listUsers(admin, { q: "sarr" })).users.map((u) => u.lastName)).toEqual(["Sarr"]);
    expect((await listUsers(admin, { role: "TEACHER" })).total).toBe(1);
  });
});
