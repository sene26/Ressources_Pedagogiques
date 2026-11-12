import type { Role } from "@prisma/client";
import { loadCurrentUser, type CurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { hashPassword } from "@/server/password";

export const TEST_PASSWORD = "motdepasse-test-1";

/** Vide toutes les tables métier (la structure et l'historique des migrations sont conservés). */
export async function resetDatabase(): Promise<void> {
  const tables = await db.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'`;
  await db.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const { name } of tables) await db.$executeRawUnsafe(`TRUNCATE TABLE \`${name}\``);
  await db.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
}

let counter = 0;
let cachedHash: string | undefined;

/** Crée un utilisateur actif avec les rôles donnés et retourne sa vue « utilisateur courant ». */
export async function makeUser(roles: Role[], overrides: { email?: string; active?: boolean } = {}): Promise<CurrentUser> {
  counter += 1;
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `utilisateur${counter}@uasz.test`,
      firstName: `Prénom${counter}`,
      lastName: `Nom${counter}`,
      passwordHash: cachedHash,
      active: overrides.active ?? true,
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
  return (await actor(user.id)) ?? fallbackActor(user.id, user.email, roles);
}

/** Relit l'utilisateur courant (rôles et formations gérées à jour). */
export async function actor(userId: string): Promise<CurrentUser | null> {
  return loadCurrentUser(userId);
}

function fallbackActor(id: string, email: string, roles: Role[]): CurrentUser {
  return { id, email, firstName: "", lastName: "", roles, managedProgramIds: [] };
}

export async function makeYear(label = "2026-2027", current = true) {
  const start = Number(label.slice(0, 4));
  return db.academicYear.create({
    data: {
      label,
      startDate: new Date(`${start}-10-01`),
      endDate: new Date(`${start + 1}-07-31`),
      isCurrent: current ? true : null,
    },
  });
}
