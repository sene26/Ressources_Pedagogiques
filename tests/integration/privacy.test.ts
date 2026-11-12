import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { anonymizeOldAccessLogs } from "@/server/services/privacy";
import { makeUser, resetDatabase } from "../support/db-helpers";

beforeEach(resetDatabase);

describe("Données personnelles (A12) — anonymisation des consultations", () => {
  it("retire l'utilisateur des consultations de plus de 2 ans et conserve les compteurs", async () => {
    const user = await makeUser(["STUDENT"]);
    const now = new Date("2029-01-01T00:00:00Z");
    await db.accessLog.createMany({
      data: [
        { userId: user.id, kind: "VIEW", createdAt: new Date("2026-06-01T00:00:00Z") }, // > 2 ans
        { userId: user.id, kind: "DOWNLOAD", createdAt: new Date("2028-06-01T00:00:00Z") }, // < 2 ans
      ],
    });
    expect(await anonymizeOldAccessLogs(now)).toBe(1);
    expect(await db.accessLog.count()).toBe(2);
    expect(await db.accessLog.count({ where: { userId: null } })).toBe(1);
    expect(await db.accessLog.findFirstOrThrow({ where: { kind: "DOWNLOAD" } })).toMatchObject({ userId: user.id });
    expect(await db.auditLog.count({ where: { action: "ACCESS_LOGS_ANONYMIZED" } })).toBe(1);
  });
});
