import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { requestPasswordReset, resetPassword, RESET_TOKEN_TTL_MS } from "@/server/services/password-reset";
import { authenticate } from "@/server/services/users";
import { makeUser, resetDatabase, TEST_PASSWORD } from "../support/db-helpers";

beforeEach(resetDatabase);

describe("F1 — Connexion par adresse et mot de passe", () => {
  it("accepte des identifiants valides, sans tenir compte de la casse de l'adresse", async () => {
    const user = await makeUser(["STUDENT"], { email: "fatou.sarr@uasz.test" });
    const result = await authenticate("Fatou.Sarr@UASZ.test", TEST_PASSWORD);
    expect(result).toEqual({ ok: true, userId: user.id });
  });

  it("refuse un mauvais mot de passe, une adresse inconnue ou un compte désactivé, avec la même réponse", async () => {
    await makeUser(["STUDENT"], { email: "actif@uasz.test" });
    await makeUser(["STUDENT"], { email: "inactif@uasz.test", active: false });
    expect(await authenticate("actif@uasz.test", "mauvais-mdp-1")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("inconnu@uasz.test", TEST_PASSWORD)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("inactif@uasz.test", TEST_PASSWORD)).toEqual({ ok: false, reason: "invalid" });
  });

  it("bloque l'adresse après 5 échecs, même avec le bon mot de passe", async () => {
    await makeUser(["STUDENT"], { email: "cible@uasz.test" });
    for (let i = 0; i < 5; i++) await authenticate("cible@uasz.test", "mauvais-mdp-1");
    expect(await authenticate("cible@uasz.test", TEST_PASSWORD)).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("stocke les mots de passe hachés avec argon2id", async () => {
    const user = await makeUser(["STUDENT"]);
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(stored.passwordHash).not.toContain(TEST_PASSWORD);
  });
});

describe("F1 — Mot de passe oublié", () => {
  it("permet de choisir un nouveau mot de passe avec le lien reçu, une seule fois", async () => {
    await makeUser(["TEACHER"], { email: "oubli@uasz.test" });
    const token = await requestPasswordReset("oubli@uasz.test");
    expect(token).toBeTruthy();

    // Seule l'empreinte du jeton est stockée.
    const stored = await db.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);

    await resetPassword({ token, password: "nouveau-mdp-2026", confirmation: "nouveau-mdp-2026" });
    expect((await authenticate("oubli@uasz.test", "nouveau-mdp-2026")).ok).toBe(true);
    expect((await authenticate("oubli@uasz.test", TEST_PASSWORD)).ok).toBe(false);

    await expect(resetPassword({ token, password: "autre-mdp-2026", confirmation: "autre-mdp-2026" })).rejects.toThrow(ValidationError);
  });

  it("refuse un lien expiré", async () => {
    await makeUser(["TEACHER"], { email: "expire@uasz.test" });
    const issuedAt = new Date("2026-11-01T10:00:00Z");
    const token = await requestPasswordReset("expire@uasz.test", issuedAt);
    const later = new Date(issuedAt.getTime() + RESET_TOKEN_TTL_MS + 1000);
    await expect(
      resetPassword({ token, password: "nouveau-mdp-2026", confirmation: "nouveau-mdp-2026" }, later),
    ).rejects.toThrow("invalide ou a expiré");
  });

  it("ne révèle pas si une adresse est inscrite", async () => {
    expect(await requestPasswordReset("personne@uasz.test")).toBeNull();
    expect(await db.passwordResetToken.count()).toBe(0);
  });
});
