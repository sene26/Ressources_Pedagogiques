import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";

/**
 * Exécute `fn` et traduit les erreurs Prisma attendues en erreurs métier lisibles :
 * - P2002 (contrainte d'unicité) → ConflictError portant `conflictMessage` ;
 * - P2025 (enregistrement à modifier introuvable) → NotFoundError.
 */
export async function withUniqueConflict<T>(conflictMessage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new ConflictError(conflictMessage);
      if (error.code === "P2025") throw new NotFoundError();
    }
    throw error;
  }
}

/** Variante sans contrainte d'unicité attendue : traduit seulement « introuvable ». */
export function withNotFound<T>(fn: () => Promise<T>): Promise<T> {
  return withUniqueConflict("Conflit avec un élément existant.", fn);
}
