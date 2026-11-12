import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/current-user";
import {
  canAccessManagement,
  canCreateProgram,
  canManageAcademicYears,
  canManageProgram,
  canManageUsers,
  hasRole,
} from "@/server/policies/user-policy";

const user = (roles: Role[], managedProgramIds: string[] = []): CurrentUser => ({
  id: "u",
  email: "u@uasz.test",
  firstName: "U",
  lastName: "U",
  roles,
  managedProgramIds,
});

describe("Politiques d'accès — rôles (F2) et organisation (F5–F7)", () => {
  it("un utilisateur peut cumuler plusieurs rôles", () => {
    const u = user(["TEACHER", "PROGRAM_MANAGER"]);
    expect(hasRole(u, "TEACHER")).toBe(true);
    expect(hasRole(u, "PROGRAM_MANAGER")).toBe(true);
    expect(hasRole(u, "ADMIN")).toBe(false);
  });

  it("seul l'administrateur gère les comptes, les années et la création des formations", () => {
    for (const roles of [["STUDENT"], ["TEACHER"], ["PROGRAM_MANAGER"]] as Role[][]) {
      expect(canManageUsers(user(roles))).toBe(false);
      expect(canManageAcademicYears(user(roles))).toBe(false);
      expect(canCreateProgram(user(roles))).toBe(false);
    }
    expect(canManageUsers(user(["ADMIN"]))).toBe(true);
    expect(canManageAcademicYears(user(["ADMIN"]))).toBe(true);
    expect(canCreateProgram(user(["ADMIN"]))).toBe(true);
  });

  it("un responsable ne gère que les formations auxquelles il est rattaché (A3)", () => {
    const manager = user(["PROGRAM_MANAGER"], ["p1"]);
    expect(canManageProgram(manager, "p1")).toBe(true);
    expect(canManageProgram(manager, "p2")).toBe(false);
  });

  it("un rattachement sans le rôle de responsable ne donne aucun droit", () => {
    expect(canManageProgram(user(["TEACHER"], ["p1"]), "p1")).toBe(false);
  });

  it("l'administrateur gère toutes les formations", () => {
    expect(canManageProgram(user(["ADMIN"]), "nimporte")).toBe(true);
  });

  it("l'espace de gestion est réservé à l'administrateur et aux responsables rattachés", () => {
    expect(canAccessManagement(user(["ADMIN"]))).toBe(true);
    expect(canAccessManagement(user(["PROGRAM_MANAGER"], ["p1"]))).toBe(true);
    expect(canAccessManagement(user(["PROGRAM_MANAGER"]))).toBe(false);
    expect(canAccessManagement(user(["TEACHER"]))).toBe(false);
    expect(canAccessManagement(user(["STUDENT"]))).toBe(false);
  });
});
