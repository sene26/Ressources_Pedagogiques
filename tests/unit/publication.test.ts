import { describe, expect, it } from "vitest";
import { statusLabel } from "@/lib/labels";
import { computePublication } from "@/server/services/resources";

const now = new Date("2026-11-12T10:00:00Z");
const later = new Date("2026-12-01T08:00:00Z");

describe("F11, F13 — Publication et programmation", () => {
  it("un brouillon n'a ni date ni validation", () => {
    expect(computePublication("COURSE", "EC_STUDENTS", "draft", undefined, now)).toEqual({ status: "DRAFT", publishAt: null, approvalStatus: "NOT_REQUIRED" });
  });

  it("une publication programmée garde sa date et s'affiche « Programmée »", () => {
    const state = computePublication("COURSE", "EC_STUDENTS", "schedule", later, now);
    expect(state).toMatchObject({ status: "PUBLISHED", publishAt: later, approvalStatus: "NOT_REQUIRED" });
    expect(statusLabel(state, now)).toBe("Programmée");
    expect(statusLabel(state, new Date("2026-12-02T00:00:00Z"))).toBe("Publiée");
  });

  it("RG5 — un sujet d'examen publié pour les étudiants attend la validation et reçoit une date", () => {
    expect(computePublication("EXAM", "EC_STUDENTS", "now", undefined, now)).toEqual({ status: "PUBLISHED", publishAt: now, approvalStatus: "PENDING" });
    expect(computePublication("SOLUTION", "EC_STUDENTS", "schedule", later, now)).toMatchObject({ approvalStatus: "PENDING", publishAt: later });
    // Partagé entre enseignants seulement : pas de validation nécessaire.
    expect(computePublication("EXAM", "TEACHERS", "now", undefined, now)).toMatchObject({ approvalStatus: "NOT_REQUIRED" });
  });
});
