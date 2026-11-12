import type { Role } from "@prisma/client";
import type { CurrentUser } from "../current-user";

/**
 * Politiques d'accès liées aux rôles (F2) et à l'organisation pédagogique (F5–F7).
 * Ce sont des fonctions pures : elles ne lisent pas la base, ce qui les rend faciles à tester.
 */

export function hasRole(user: CurrentUser, role: Role): boolean {
  return user.roles.includes(role);
}

export function isAdmin(user: CurrentUser): boolean {
  return hasRole(user, "ADMIN");
}

/** Comptes, rôles et années universitaires : administrateur uniquement. */
export function canManageUsers(user: CurrentUser): boolean {
  return isAdmin(user);
}

export function canManageAcademicYears(user: CurrentUser): boolean {
  return isAdmin(user);
}

/** Créer une formation ou désigner ses responsables : administrateur uniquement. */
export function canCreateProgram(user: CurrentUser): boolean {
  return isAdmin(user);
}

/**
 * Gérer la maquette d'une formation (UE, EC), ses affectations et ses inscriptions :
 * administrateur, ou responsable rattaché à cette formation (A3).
 */
export function canManageProgram(user: CurrentUser, programId: string): boolean {
  if (isAdmin(user)) return true;
  return hasRole(user, "PROGRAM_MANAGER") && user.managedProgramIds.includes(programId);
}

/** Accès à l'espace « Gestion » : administrateur ou responsable d'au moins une formation. */
export function canAccessManagement(user: CurrentUser): boolean {
  return isAdmin(user) || (hasRole(user, "PROGRAM_MANAGER") && user.managedProgramIds.length > 0);
}
