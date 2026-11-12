import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma unique. En développement, le rechargement à chaud recrée les modules :
 * on garde l'instance sur `globalThis` pour ne pas multiplier les connexions.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
