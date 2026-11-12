import { createHash, randomBytes } from "node:crypto";
import { ValidationError } from "@/lib/errors";
import { emailSchema, parseInput, passwordResetSchema } from "@/lib/validation";
import { audit } from "../audit";
import { db } from "../db";
import { sendMail } from "../mail";
import { hashPassword } from "../password";
import { isRateLimited, recordAttempt } from "../rate-limit";

/** Durée de validité d'un lien de réinitialisation : 1 heure. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const INVALID_LINK = "Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande.";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Demande de réinitialisation (F1). La réponse est identique que le compte existe ou non,
 * pour ne pas révéler les adresses inscrites. Seule l'empreinte du jeton est stockée.
 * Retourne le jeton en clair uniquement pour les tests (il n'est jamais renvoyé au navigateur).
 */
export async function requestPasswordReset(rawEmail: unknown, now = new Date()): Promise<string | null> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return null;
  const email = parsed.data;

  // Au plus 3 demandes par adresse et par heure, pour éviter l'envoi massif de courriels.
  const key = `reset:${email}`;
  if (isRateLimited(key, 3, RESET_TOKEN_TTL_MS, now.getTime())) return null;
  recordAttempt(key, now.getTime());

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) return null;

  const token = randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: user.email,
    subject: "RessourcesPéda — réinitialisation de votre mot de passe",
    text: [
      `Bonjour ${user.firstName},`,
      "",
      "Une réinitialisation de votre mot de passe a été demandée. Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :",
      `${appUrl}/reinitialisation?jeton=${token}`,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
    ].join("\n"),
  });
  return token;
}

/** Définit le nouveau mot de passe si le jeton est valide, puis invalide tous les jetons de l'utilisateur. */
export async function resetPassword(input: unknown, now = new Date()): Promise<void> {
  const data = parseInput(passwordResetSchema, input);
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(data.token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt <= now || !record.user.active) {
    throw new ValidationError(INVALID_LINK);
  }
  const passwordHash = await hashPassword(data.password);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
    await audit(tx, { actorId: record.userId, action: "PASSWORD_RESET", entityType: "User", entityId: record.userId });
  });
}
