import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { levelCount } from "@/lib/academic";
import { parseCsv } from "@/lib/csv";
import { emailSchema } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { hashPassword } from "../password";
import { canManageUsers } from "../policies/user-policy";
import { sendActivationLink } from "./password-reset";

/**
 * Import des étudiants et des enseignants par fichier CSV (F3).
 *
 * Colonnes (en-tête obligatoire, ordre libre, « ; » ou « , ») :
 *   nom ; prenom ; courriel ; telephone ; roles ; formation ; niveau
 * - roles : etudiant, enseignant, responsable, administrateur (plusieurs séparés par « | ») ; « etudiant » par défaut ;
 * - formation + niveau (facultatifs) : inscription pour l'année en cours (code de formation, ex. M-MIO).
 *
 * Le fichier est vérifié entièrement avant tout enregistrement : à la moindre erreur, rien n'est importé.
 * Les comptes existants (même adresse) sont ignorés. Chaque nouveau compte reçoit un lien d'activation.
 */

export const MAX_IMPORT_ROWS = 2000;

const ROLE_ALIASES: Record<string, Role> = {
  etudiant: "STUDENT",
  enseignant: "TEACHER",
  responsable: "PROGRAM_MANAGER",
  administrateur: "ADMIN",
};

export interface ImportResult {
  created: number;
  enrolled: number;
  skipped: string[];
  errors: { line: number; message: string }[];
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

interface ParsedRow {
  line: number;
  lastName: string;
  firstName: string;
  email: string;
  phone: string | null;
  roles: Role[];
  programCode: string | null;
  level: number | null;
}

export async function importUsersCsv(actor: CurrentUser, csvText: string): Promise<ImportResult> {
  ensure(canManageUsers(actor));
  const result: ImportResult = { created: 0, enrolled: 0, skipped: [], errors: [] };
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { ...result, errors: [{ line: 1, message: "Le fichier est vide ou ne contient que l'en-tête." }] };
  if (rows.length - 1 > MAX_IMPORT_ROWS) return { ...result, errors: [{ line: 1, message: `${MAX_IMPORT_ROWS} lignes au maximum par import.` }] };

  const header = rows[0].map((h) => normalize(h).replace(/^e-?mail$/, "courriel"));
  const col = (name: string) => header.indexOf(name);
  for (const required of ["nom", "prenom", "courriel"]) {
    if (col(required) < 0) return { ...result, errors: [{ line: 1, message: `Colonne « ${required} » manquante dans l'en-tête.` }] };
  }

  const year = await db.academicYear.findUnique({ where: { isCurrent: true } });
  const programs = new Map((await db.program.findMany({ where: { archived: false } })).map((p) => [p.code.toLowerCase(), p]));
  const seen = new Set<string>();
  const parsed: ParsedRow[] = [];

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const cell = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const fail = (message: string) => result.errors.push({ line, message });

    const lastName = cell("nom");
    const firstName = cell("prenom");
    const email = emailSchema.safeParse(cell("courriel"));
    if (!lastName || lastName.length > 100) return fail("Nom manquant ou trop long.");
    if (!firstName || firstName.length > 100) return fail("Prénom manquant ou trop long.");
    if (!email.success) return fail(`Adresse électronique invalide : « ${cell("courriel")} ».`);
    if (seen.has(email.data)) return fail(`Adresse en double dans le fichier : ${email.data}.`);
    seen.add(email.data);

    const roleNames = cell("roles") ? cell("roles").split(/[|,/]/).map(normalize).filter(Boolean) : ["etudiant"];
    const roles = roleNames.map((r) => ROLE_ALIASES[r]);
    if (roles.some((r) => !r)) return fail(`Rôle inconnu : « ${cell("roles")} » (etudiant, enseignant, responsable, administrateur).`);

    const programCode = cell("formation") || null;
    let level: number | null = null;
    if (programCode) {
      const program = programs.get(programCode.toLowerCase());
      if (!program) return fail(`Formation inconnue ou archivée : « ${programCode} ».`);
      if (!roles.includes("STUDENT")) return fail("Seul un étudiant peut être inscrit à une formation.");
      if (!year) return fail("Aucune année universitaire en cours : impossible d'inscrire l'étudiant.");
      level = Number(cell("niveau"));
      if (!Number.isInteger(level) || level < 1 || level > levelCount(program.cycle)) {
        return fail(`Niveau invalide pour ${program.code} : « ${cell("niveau")} » (1 à ${levelCount(program.cycle)}).`);
      }
    }
    const phone = cell("telephone");
    if (phone.length > 30) return fail("Téléphone trop long.");
    parsed.push({ line, lastName, firstName, email: email.data, phone: phone || null, roles: [...new Set(roles)], programCode, level });
  });

  if (result.errors.length > 0) return result;

  const existing = new Set((await db.user.findMany({ where: { email: { in: parsed.map((p) => p.email) } }, select: { email: true } })).map((u) => u.email));
  const toCreate = parsed.filter((p) => !existing.has(p.email));
  result.skipped = parsed.filter((p) => existing.has(p.email)).map((p) => p.email);

  // Mot de passe aléatoire et inconnu de tous : l'utilisateur choisit le sien via le lien d'activation.
  const placeholderHash = await hashPassword(randomBytes(32).toString("base64url"));
  const created = await db.$transaction(
    async (tx) => {
      const users = [];
      for (const row of toCreate) {
        const program = row.programCode ? programs.get(row.programCode.toLowerCase()) : undefined;
        const user = await tx.user.create({
          data: {
            lastName: row.lastName,
            firstName: row.firstName,
            email: row.email,
            phone: row.phone,
            passwordHash: placeholderHash,
            roles: { create: row.roles.map((role) => ({ role })) },
            ...(program && year && row.level ? { enrollments: { create: { programId: program.id, level: row.level, academicYearId: year.id } } } : {}),
          },
        });
        users.push(user);
        if (program) result.enrolled += 1;
      }
      await audit(tx, {
        actorId: actor.id,
        action: "USERS_IMPORTED",
        entityType: "User",
        details: { created: users.length, enrolled: result.enrolled, skipped: result.skipped.length },
      });
      return users;
    },
    { timeout: 120_000 },
  );
  result.created = created.length;

  for (const user of created) {
    await sendActivationLink(user).catch((error) => console.error(`Lien d'activation non envoyé à ${user.email} :`, error));
  }
  return result;
}
