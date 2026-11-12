import { ForbiddenError } from "@/lib/errors";

/** Lève une ForbiddenError si la condition d'accès n'est pas remplie. */
export function ensure(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw new ForbiddenError(message);
}
