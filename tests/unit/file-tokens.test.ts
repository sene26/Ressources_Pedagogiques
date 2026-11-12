import { beforeAll, describe, expect, it } from "vitest";
import { FILE_TOKEN_TTL_MS, issueFileToken, verifyFileToken } from "@/server/file-tokens";

beforeAll(() => {
  process.env.FILE_TOKEN_SECRET = "secret-de-test";
});

describe("Liens de téléchargement non devinables", () => {
  it("un jeton valide désigne la version et l'utilisateur", () => {
    const token = issueFileToken("version-1", "user-1", 1_000);
    expect(verifyFileToken(token, 2_000)).toMatchObject({ versionId: "version-1", userId: "user-1" });
  });

  it("un jeton expire après 10 minutes", () => {
    const token = issueFileToken("version-1", "user-1", 1_000);
    expect(verifyFileToken(token, 1_000 + FILE_TOKEN_TTL_MS)).toBeNull();
  });

  it("un jeton modifié est refusé", () => {
    const token = issueFileToken("version-1", "user-1", 1_000);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ v: "version-2", u: "user-1", e: 9e15 })).toString("base64url");
    expect(verifyFileToken(`${forged}.${signature}`, 2_000)).toBeNull();
    expect(verifyFileToken(`${payload}.x${signature.slice(1)}`, 2_000)).toBeNull();
    expect(verifyFileToken("n'importe-quoi", 2_000)).toBeNull();
  });
});
