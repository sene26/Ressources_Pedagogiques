import type { Cycle, Role } from "@prisma/client";

/** Libellés français des énumérations (le code reste en anglais). */
export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Étudiant",
  TEACHER: "Enseignant",
  PROGRAM_MANAGER: "Responsable de formation",
  ADMIN: "Administrateur",
};

export const CYCLE_LABELS: Record<Cycle, string> = {
  LICENCE: "Licence",
  MASTER: "Master",
};

export const ALL_ROLES: Role[] = ["STUDENT", "TEACHER", "PROGRAM_MANAGER", "ADMIN"];
