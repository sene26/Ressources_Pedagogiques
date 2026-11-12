import { z } from "zod";
import { ValidationError } from "./errors";
import { isValidAcademicYearLabel } from "./academic";

/**
 * Schémas de validation des entrées (formulaires, Server Actions).
 * Les messages sont en français et affichés à côté du champ concerné.
 */

const trimmed = (max: number, label: string) =>
  z
    .string({ error: `${label} : champ obligatoire.` })
    .trim()
    .min(1, `${label} : champ obligatoire.`)
    .max(max, `${label} : ${max} caractères au maximum.`);

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères au maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const code = (label: string) =>
  trimmed(30, label).regex(/^[A-Za-z0-9._-]+$/, `${label} : lettres, chiffres, « . », « _ » ou « - » uniquement.`);

const id = (label: string) => z.string({ error: `${label} : champ obligatoire.` }).uuid(`${label} : identifiant invalide.`);

const credits = z.coerce
  .number({ error: "Crédits : nombre attendu." })
  .int("Crédits : nombre entier attendu.")
  .min(0, "Crédits : valeur positive attendue.")
  .max(60, "Crédits : 60 au maximum.");

export const emailSchema = z
  .string({ error: "Adresse électronique : champ obligatoire." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Adresse électronique invalide.").max(191, "Adresse électronique trop longue."));

/** Politique de mot de passe : 10 caractères minimum, au moins une lettre et un chiffre. */
export const passwordSchema = z
  .string({ error: "Mot de passe : champ obligatoire." })
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
  .max(128, "Le mot de passe doit contenir au plus 128 caractères.")
  .regex(/[A-Za-zÀ-ÿ]/, "Le mot de passe doit contenir au moins une lettre.")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre.");

export const roleSchema = z.enum(["STUDENT", "TEACHER", "PROGRAM_MANAGER", "ADMIN"], {
  error: "Rôle invalide.",
});

export const cycleSchema = z.enum(["LICENCE", "MASTER"], { error: "Cycle : choisir Licence ou Master." });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe : champ obligatoire.").max(128),
});

export const createUserSchema = z.object({
  lastName: trimmed(100, "Nom"),
  firstName: trimmed(100, "Prénom"),
  email: emailSchema,
  phone: optionalTrimmed(30, "Téléphone"),
  password: passwordSchema,
  roles: z.array(roleSchema).min(1, "Choisir au moins un rôle."),
});

export const updateUserSchema = z.object({
  id: id("Utilisateur"),
  lastName: trimmed(100, "Nom"),
  firstName: trimmed(100, "Prénom"),
  email: emailSchema,
  phone: optionalTrimmed(30, "Téléphone"),
  roles: z.array(roleSchema).min(1, "Choisir au moins un rôle."),
});

export const academicYearSchema = z
  .object({
    label: trimmed(9, "Libellé").refine(isValidAcademicYearLabel, "Libellé : format attendu « 2025-2026 »."),
    startDate: z.coerce.date({ error: "Date de début invalide." }),
    endDate: z.coerce.date({ error: "Date de fin invalide." }),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "La date de fin doit être postérieure à la date de début.",
    path: ["endDate"],
  });

export const createProgramSchema = z.object({
  code: code("Code"),
  title: trimmed(200, "Intitulé"),
  cycle: cycleSchema,
});

export const updateProgramSchema = z.object({
  id: id("Formation"),
  code: code("Code"),
  title: trimmed(200, "Intitulé"),
});

export const createTeachingUnitSchema = z.object({
  semesterId: id("Semestre"),
  code: code("Code"),
  title: trimmed(200, "Intitulé"),
  credits,
});

export const updateTeachingUnitSchema = z.object({
  id: id("UE"),
  code: code("Code"),
  title: trimmed(200, "Intitulé"),
  credits,
});

export const createCourseElementSchema = z.object({
  teachingUnitId: id("UE"),
  code: code("Code"),
  title: trimmed(200, "Intitulé"),
  credits,
});

export const updateCourseElementSchema = z.object({
  id: id("EC"),
  code: code("Code"),
  title: trimmed(200, "Intitulé"),
  credits,
});

export const teachingAssignmentSchema = z.object({
  teacherId: id("Enseignant"),
  courseElementId: id("EC"),
  academicYearId: id("Année universitaire"),
});

export const enrollmentSchema = z.object({
  /** L'étudiant est désigné par son adresse : plus pratique qu'une liste de milliers de noms. */
  studentEmail: emailSchema,
  programId: id("Formation"),
  level: z.coerce.number({ error: "Niveau invalide." }).int("Niveau invalide.").min(1, "Niveau invalide.").max(3, "Niveau invalide."),
  academicYearId: id("Année universitaire"),
});

export const programManagerSchema = z.object({
  userId: id("Utilisateur"),
  programId: id("Formation"),
});

export const passwordResetSchema = z
  .object({
    token: z.string().min(20, "Lien de réinitialisation invalide.").max(200),
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

/**
 * Valide `input` avec `schema`. En cas d'échec, lève une ValidationError
 * portant le premier message de chaque champ.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    fieldErrors[key] ??= issue.message;
  }
  const first = Object.values(fieldErrors)[0] ?? "Données invalides.";
  throw new ValidationError(first, fieldErrors);
}
