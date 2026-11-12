import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jetons de téléchargement : liens non devinables, liés à un utilisateur et à une version,
 * valables 10 minutes. Signés par HMAC-SHA256 avec FILE_TOKEN_SECRET (ou AUTH_SECRET à défaut).
 */
export const FILE_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface FileTokenPayload {
  versionId: string;
  userId: string;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.FILE_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("FILE_TOKEN_SECRET (ou AUTH_SECRET) doit être défini.");
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function issueFileToken(versionId: string, userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ v: versionId, u: userId, e: now + FILE_TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Vérifie la signature et l'expiration ; retourne null si le jeton est invalide. */
export function verifyFileToken(token: string, now = Date.now()): FileTokenPayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: unknown; u?: unknown; e?: unknown };
    if (typeof data.v !== "string" || typeof data.u !== "string" || typeof data.e !== "number") return null;
    if (data.e <= now) return null;
    return { versionId: data.v, userId: data.u, expiresAt: data.e };
  } catch {
    return null;
  }
}
