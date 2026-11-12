import { describe, expect, it } from "vitest";
import { isRateLimited, recordAttempt, resetAttempts } from "@/server/rate-limit";

describe("Limitation des tentatives", () => {
  it("bloque au-delà du maximum puis libère après la fenêtre", () => {
    const key = "test:unitaire";
    for (let i = 0; i < 3; i++) recordAttempt(key, 1_000);
    expect(isRateLimited(key, 3, 60_000, 2_000)).toBe(true);
    expect(isRateLimited(key, 3, 60_000, 62_000)).toBe(false);
    resetAttempts(key);
  });
});
