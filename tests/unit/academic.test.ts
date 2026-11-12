import { describe, expect, it } from "vitest";
import { isValidAcademicYearLabel, levelCount, levelLabel, levelOfSemester, semesterCount, semestersOfLevel } from "@/lib/academic";

describe("Maquette — niveaux et semestres (A1)", () => {
  it("une Licence compte 6 semestres et 3 niveaux, un Master 4 semestres et 2 niveaux", () => {
    expect(semesterCount("LICENCE")).toBe(6);
    expect(levelCount("LICENCE")).toBe(3);
    expect(semesterCount("MASTER")).toBe(4);
    expect(levelCount("MASTER")).toBe(2);
  });

  it.each([
    [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3],
  ])("le semestre %i appartient au niveau %i", (semester, level) => {
    expect(levelOfSemester(semester)).toBe(level);
  });

  it("refuse un numéro de semestre invalide", () => {
    expect(() => levelOfSemester(0)).toThrow(RangeError);
    expect(() => levelOfSemester(1.5)).toThrow(RangeError);
  });

  it("donne les deux semestres d'un niveau", () => {
    expect(semestersOfLevel(1)).toEqual([1, 2]);
    expect(semestersOfLevel(3)).toEqual([5, 6]);
  });

  it("libelle les niveaux en français", () => {
    expect(levelLabel("MASTER", 1)).toBe("Master 1");
    expect(levelLabel("LICENCE", 3)).toBe("Licence 3");
  });

  it("vérifie le format des années universitaires", () => {
    expect(isValidAcademicYearLabel("2025-2026")).toBe(true);
    expect(isValidAcademicYearLabel("2025-2027")).toBe(false);
    expect(isValidAcademicYearLabel("2025/2026")).toBe(false);
  });
});
