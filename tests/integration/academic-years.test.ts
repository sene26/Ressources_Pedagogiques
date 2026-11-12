import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { createAcademicYear, getCurrentAcademicYear, setCurrentAcademicYear } from "@/server/services/academic-years";
import { makeUser, resetDatabase } from "../support/db-helpers";

beforeEach(resetDatabase);

describe("Années universitaires (A16)", () => {
  it("une seule année est en cours à la fois", async () => {
    const admin = await makeUser(["ADMIN"]);
    const y1 = await createAcademicYear(admin, { label: "2025-2026", startDate: "2025-10-01", endDate: "2026-07-31" });
    const y2 = await createAcademicYear(admin, { label: "2026-2027", startDate: "2026-10-01", endDate: "2027-07-31" });
    await setCurrentAcademicYear(admin, y1.id);
    await setCurrentAcademicYear(admin, y2.id);
    expect((await getCurrentAcademicYear())?.id).toBe(y2.id);
    expect(await db.academicYear.count({ where: { isCurrent: true } })).toBe(1);
  });

  it("la base refuse elle-même deux années en cours", async () => {
    await db.academicYear.create({ data: { label: "2025-2026", startDate: new Date("2025-10-01"), endDate: new Date("2026-07-31"), isCurrent: true } });
    await expect(
      db.academicYear.create({ data: { label: "2026-2027", startDate: new Date("2026-10-01"), endDate: new Date("2027-07-31"), isCurrent: true } }),
    ).rejects.toThrow();
  });

  it("refuse un libellé en double, un format invalide et un non-administrateur", async () => {
    const admin = await makeUser(["ADMIN"]);
    await createAcademicYear(admin, { label: "2026-2027", startDate: "2026-10-01", endDate: "2027-07-31" });
    await expect(createAcademicYear(admin, { label: "2026-2027", startDate: "2026-10-01", endDate: "2027-07-31" })).rejects.toThrow(ConflictError);
    await expect(createAcademicYear(admin, { label: "2026", startDate: "2026-10-01", endDate: "2027-07-31" })).rejects.toThrow(ValidationError);
    const manager = await makeUser(["PROGRAM_MANAGER"]);
    await expect(createAcademicYear(manager, { label: "2027-2028", startDate: "2027-10-01", endDate: "2028-07-31" })).rejects.toThrow(ForbiddenError);
  });
});
