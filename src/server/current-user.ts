import type { Role } from "@prisma/client";
import { db } from "./db";

/**
 * Utilisateur courant tel que le voient les politiques d'accès et les services.
 * Il est relu en base à chaque requête : un compte désactivé ou un rôle retiré
 * prend effet immédiatement, sans attendre l'expiration de la session.
 */
export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  /** Formations dont l'utilisateur est responsable (A3). */
  managedProgramIds: string[];
}

export async function loadCurrentUser(userId: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true, managedPrograms: { select: { programId: true } } },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map((r) => r.role),
    managedProgramIds: user.managedPrograms.map((m) => m.programId),
  };
}
