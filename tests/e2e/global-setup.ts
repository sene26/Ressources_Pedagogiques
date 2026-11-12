import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { E2E_ADMIN, e2eEnv } from "./e2e-env";

/**
 * Prépare la base des tests de bout en bout : migrations, données vidées,
 * puis un administrateur et l'année universitaire en cours.
 */
export default async function globalSetup(): Promise<void> {
  const env = e2eEnv();
  if (!env.DATABASE_URL.split("/").pop()?.includes("test")) throw new Error("La base e2e doit contenir « test » dans son nom.");
  Object.assign(process.env, env);
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
  rmSync(env.STORAGE_LOCAL_DIR, { recursive: true, force: true });

  const { PrismaClient } = await import("@prisma/client");
  const { hash } = await import("@node-rs/argon2");
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    // Une transaction garantit une connexion unique (FOREIGN_KEY_CHECKS est propre à la connexion).
    await db.$transaction(async (tx) => {
      const tables = await tx.$queryRaw<{ name: string }[]>`
        SELECT TABLE_NAME AS name FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'`;
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
      for (const { name } of tables) await tx.$executeRawUnsafe(`DELETE FROM \`${name}\``);
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    });

    await db.user.create({
      data: {
        email: E2E_ADMIN.email,
        firstName: "Admin",
        lastName: "E2E",
        passwordHash: await hash(E2E_ADMIN.password),
        roles: { create: [{ role: "ADMIN" }] },
      },
    });
    await db.academicYear.create({
      data: { label: "2026-2027", startDate: new Date("2026-10-01"), endDate: new Date("2027-07-31"), isCurrent: true },
    });
  } finally {
    await db.$disconnect();
  }
}
