import type { Cycle } from "@prisma/client";

/**
 * Règles de la maquette (A1) : une formation compte 6 semestres en Licence et 4 en Master.
 * Le niveau d'étude (1, 2 ou 3) regroupe deux semestres consécutifs.
 */
export const SEMESTER_COUNT: Record<Cycle, number> = { LICENCE: 6, MASTER: 4 };

export function semesterCount(cycle: Cycle): number {
  return SEMESTER_COUNT[cycle];
}

/** Nombre de niveaux d'une formation (3 en Licence, 2 en Master). */
export function levelCount(cycle: Cycle): number {
  return SEMESTER_COUNT[cycle] / 2;
}

/** Niveau d'étude auquel appartient un semestre : S1-S2 → 1, S3-S4 → 2, S5-S6 → 3. */
export function levelOfSemester(semesterNumber: number): number {
  if (!Number.isInteger(semesterNumber) || semesterNumber < 1) {
    throw new RangeError(`Numéro de semestre invalide : ${semesterNumber}`);
  }
  return Math.ceil(semesterNumber / 2);
}

/** Numéros des deux semestres d'un niveau. */
export function semestersOfLevel(level: number): [number, number] {
  return [level * 2 - 1, level * 2];
}

/** Libellé d'un niveau, ex. « Master 1 », « Licence 3 ». */
export function levelLabel(cycle: Cycle, level: number): string {
  return `${cycle === "LICENCE" ? "Licence" : "Master"} ${level}`;
}

/** Vérifie le format « 2025-2026 » d'une année universitaire (deux années consécutives). */
export function isValidAcademicYearLabel(label: string): boolean {
  const match = /^(\d{4})-(\d{4})$/.exec(label);
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}
