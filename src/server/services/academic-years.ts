import { NotFoundError } from "@/lib/errors";
import { academicYearSchema, parseInput } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { canManageAcademicYears } from "../policies/user-policy";
import { withUniqueConflict } from "../prisma-errors";

/** Années universitaires, de la plus récente à la plus ancienne. */
export function listAcademicYears() {
  return db.academicYear.findMany({ orderBy: { startDate: "desc" } });
}

/** Année universitaire en cours (A16), ou null si aucune n'est définie. */
export function getCurrentAcademicYear() {
  return db.academicYear.findUnique({ where: { isCurrent: true } });
}

export async function createAcademicYear(actor: CurrentUser, input: unknown) {
  ensure(canManageAcademicYears(actor));
  const data = parseInput(academicYearSchema, input);
  return withUniqueConflict(`L'année universitaire ${data.label} existe déjà.`, () =>
    db.$transaction(async (tx) => {
      const year = await tx.academicYear.create({ data });
      await audit(tx, {
        actorId: actor.id,
        action: "ACADEMIC_YEAR_CREATED",
        entityType: "AcademicYear",
        entityId: year.id,
        details: { label: year.label },
      });
      return year;
    }),
  );
}

/**
 * Définit l'année en cours. L'ancienne année repasse à `null` (et non `false`) :
 * c'est ce qui permet à l'index unique de garantir une seule année en cours.
 */
export async function setCurrentAcademicYear(actor: CurrentUser, yearId: string) {
  ensure(canManageAcademicYears(actor));
  return db.$transaction(async (tx) => {
    const year = await tx.academicYear.findUnique({ where: { id: yearId } });
    if (!year) throw new NotFoundError("Année universitaire introuvable.");
    await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: null } });
    const updated = await tx.academicYear.update({ where: { id: yearId }, data: { isCurrent: true } });
    await audit(tx, {
      actorId: actor.id,
      action: "ACADEMIC_YEAR_SET_CURRENT",
      entityType: "AcademicYear",
      entityId: yearId,
      details: { label: year.label },
    });
    return updated;
  });
}
