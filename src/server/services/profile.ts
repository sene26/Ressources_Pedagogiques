import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { matchesSignature } from "@/lib/file-types";
import { ValidationError } from "@/lib/errors";
import { parseInput, passwordSchema } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { getStorage } from "../storage";

/**
 * Profil utilisateur (F4). La formation et le niveau affichés viennent de l'inscription
 * de l'année en cours (A11) : ils ne sont pas modifiables ici.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const profileSchema = z.object({
  lastName: z.string().trim().min(1, "Nom : champ obligatoire.").max(100),
  firstName: z.string().trim().min(1, "Prénom : champ obligatoire.").max(100),
  phone: z
    .string()
    .trim()
    .max(30, "Téléphone : 30 caractères au maximum.")
    .regex(/^[+\d\s().-]*$/, "Téléphone : chiffres, espaces et « + » uniquement.")
    .optional()
    .transform((v) => v || null),
});

export async function getProfile(actor: CurrentUser) {
  const year = await db.academicYear.findUnique({ where: { isCurrent: true } });
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { id: true, lastName: true, firstName: true, email: true, phone: true, photoKey: true, emailNotifications: true, roles: true },
  });
  const enrollment = year
    ? await db.enrollment.findUnique({
        where: { studentId_academicYearId: { studentId: actor.id, academicYearId: year.id } },
        include: { program: true },
      })
    : null;
  return { user, enrollment, year };
}

export async function updateProfile(actor: CurrentUser, input: unknown) {
  const data = parseInput(profileSchema, input);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data });
    await audit(tx, { actorId: actor.id, action: "PROFILE_UPDATED", entityType: "User", entityId: actor.id });
  });
}

export async function changePassword(actor: CurrentUser, input: { current?: unknown; password?: unknown; confirmation?: unknown }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (typeof input.current !== "string" || !(await verifyPassword(user.passwordHash, input.current))) {
    throw new ValidationError("Mot de passe actuel incorrect.", { current: "Mot de passe actuel incorrect." });
  }
  const password = parseInput(passwordSchema, input.password);
  if (password !== input.confirmation) throw new ValidationError("Les deux mots de passe ne correspondent pas.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(password) } });
    await audit(tx, { actorId: actor.id, action: "USER_PASSWORD_SET", entityType: "User", entityId: actor.id, details: { by: "self" } });
  });
}

/**
 * Photo de profil : PNG, JPG ou WebP de 2 Mo au plus, recadrée en 256 × 256 et compressée en WebP
 * (quelques Ko : adapté au faible débit).
 */
export async function setProfilePhoto(actor: CurrentUser, file: File | null): Promise<void> {
  if (!file || file.size === 0) throw new ValidationError("Choisir une image.");
  if (file.size > MAX_PHOTO_BYTES) throw new ValidationError("L'image dépasse 2 Mo.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45; // RIFF…WEBP
  if (!matchesSignature("png", bytes) && !matchesSignature("jpg", bytes) && !isWebp) {
    throw new ValidationError("Format d'image non accepté (PNG, JPG ou WebP).");
  }
  let webp: Buffer;
  try {
    webp = await sharp(bytes).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new ValidationError("Image illisible.");
  }
  const key = `avatars/${randomUUID()}`;
  const storage = getStorage();
  await storage.put(key, new Blob([new Uint8Array(webp)]).stream(), webp.length, "image/webp");
  const previous = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { photoKey: true } });
  await db.user.update({ where: { id: actor.id }, data: { photoKey: key } });
  if (previous.photoKey) await storage.delete(previous.photoKey).catch(() => undefined);
}

export async function removeProfilePhoto(actor: CurrentUser): Promise<void> {
  const previous = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { photoKey: true } });
  await db.user.update({ where: { id: actor.id }, data: { photoKey: null } });
  if (previous.photoKey) await getStorage().delete(previous.photoKey).catch(() => undefined);
}
