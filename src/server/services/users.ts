import type { Prisma, Role } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { createUserSchema, emailSchema, parseInput, passwordSchema, updateUserSchema } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { getDummyHash, hashPassword, verifyPassword } from "../password";
import { canManageUsers, canAccessManagement } from "../policies/user-policy";
import { withNotFound, withUniqueConflict } from "../prisma-errors";
import { isRateLimited, recordAttempt, resetAttempts } from "../rate-limit";

export const PAGE_SIZE = 20;
const EMAIL_TAKEN = "Un compte existe déjà avec cette adresse électronique.";

/** Nombre de tentatives de connexion autorisées par adresse et par fenêtre de 15 minutes. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type AuthenticationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "rate_limited" };

/**
 * Vérifie l'adresse et le mot de passe (F1). Le message d'échec est le même que l'adresse
 * soit inconnue, le mot de passe faux ou le compte désactivé, pour ne pas révéler les comptes.
 */
export async function authenticate(rawEmail: unknown, password: unknown): Promise<AuthenticationResult> {
  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success || typeof password !== "string" || password.length === 0 || password.length > 128) {
    return { ok: false, reason: "invalid" };
  }
  const email = emailResult.data;
  const key = `login:${email}`;
  if (isRateLimited(key, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) return { ok: false, reason: "rate_limited" };

  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !valid || !user.active) {
    recordAttempt(key);
    return { ok: false, reason: "invalid" };
  }
  resetAttempts(key);
  return { ok: true, userId: user.id };
}

export async function createUser(actor: CurrentUser, input: unknown) {
  ensure(canManageUsers(actor));
  const data = parseInput(createUserSchema, input);
  const passwordHash = await hashPassword(data.password);
  return withUniqueConflict(EMAIL_TAKEN, () =>
    db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          lastName: data.lastName,
          firstName: data.firstName,
          email: data.email,
          phone: data.phone ?? null,
          passwordHash,
          roles: { create: uniqueRoles(data.roles).map((role) => ({ role })) },
        },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        details: { email: user.email, roles: data.roles },
      });
      return user;
    }),
  );
}

export async function updateUser(actor: CurrentUser, input: unknown) {
  ensure(canManageUsers(actor));
  const data = parseInput(updateUserSchema, input);
  const roles = uniqueRoles(data.roles);
  // Un administrateur ne peut pas se retirer lui-même ce rôle : on évite de perdre tout accès d'administration.
  if (data.id === actor.id && !roles.includes("ADMIN")) {
    throw new ConflictError("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
  }
  return withUniqueConflict(EMAIL_TAKEN, () =>
    db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: data.id } });
      if (!existing) throw new NotFoundError("Utilisateur introuvable.");
      const user = await tx.user.update({
        where: { id: data.id },
        data: {
          lastName: data.lastName,
          firstName: data.firstName,
          email: data.email,
          phone: data.phone ?? null,
          roles: { deleteMany: {}, create: roles.map((role) => ({ role })) },
        },
      });
      // Retirer le rôle de responsable retire aussi les rattachements aux formations.
      if (!roles.includes("PROGRAM_MANAGER")) {
        await tx.programManagerAssignment.deleteMany({ where: { userId: data.id } });
      }
      await audit(tx, {
        actorId: actor.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: user.id,
        details: { email: user.email, roles },
      });
      return user;
    }),
  );
}

/** Active ou désactive un compte (pas de suppression de compte en version 1). */
export async function setUserActive(actor: CurrentUser, userId: string, active: boolean) {
  ensure(canManageUsers(actor));
  if (userId === actor.id && !active) throw new ConflictError("Vous ne pouvez pas désactiver votre propre compte.");
  return withNotFound(() =>
    db.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { active } });
    await audit(tx, {
      actorId: actor.id,
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: userId,
    });
    return user;
    }),
  );
}

/** L'administrateur définit un nouveau mot de passe pour un utilisateur. */
export async function setUserPassword(actor: CurrentUser, userId: string, password: unknown) {
  ensure(canManageUsers(actor));
  const plain = parseInput(passwordSchema, password);
  const passwordHash = await hashPassword(plain);
  await withNotFound(() =>
    db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await audit(tx, { actorId: actor.id, action: "USER_PASSWORD_SET", entityType: "User", entityId: userId });
    }),
  );
}

export interface UserListFilters {
  q?: string;
  role?: Role;
  page?: number;
}

/** Liste paginée des utilisateurs, avec recherche sur le nom, le prénom et l'adresse. */
export async function listUsers(actor: CurrentUser, filters: UserListFilters = {}) {
  ensure(canManageUsers(actor));
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const q = filters.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(q
      ? { OR: [{ lastName: { contains: q } }, { firstName: { contains: q } }, { email: { contains: q } }] }
      : {}),
    ...(filters.role ? { roles: { some: { role: filters.role } } } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      include: { roles: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { users, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUser(actor: CurrentUser, userId: string) {
  ensure(canManageUsers(actor));
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true, managedPrograms: { include: { program: true } } },
  });
  if (!user) throw new NotFoundError("Utilisateur introuvable.");
  return user;
}

/** Utilisateurs actifs ayant un rôle donné (listes de choix pour les affectations et inscriptions). */
export async function listActiveUsersWithRole(actor: CurrentUser, role: Role) {
  ensure(canAccessManagement(actor));
  return db.user.findMany({
    where: { active: true, roles: { some: { role } } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

function uniqueRoles(roles: Role[]): Role[] {
  return [...new Set(roles)];
}
