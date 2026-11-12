import type { AccessKind } from "@prisma/client";
import { db } from "../db";

/** Une même personne qui revoit la même fiche dans les 30 minutes n'est comptée qu'une fois (A12). */
export const VIEW_DEDUP_MS = 30 * 60 * 1000;

/** Enregistre une consultation ou un téléchargement (RG10). */
export async function recordAccess(
  entry: { userId: string; resourceId: string; versionId?: string | null; kind: AccessKind },
  now = new Date(),
): Promise<boolean> {
  if (entry.kind === "VIEW") {
    const recent = await db.accessLog.findFirst({
      where: {
        userId: entry.userId,
        resourceId: entry.resourceId,
        kind: "VIEW",
        createdAt: { gt: new Date(now.getTime() - VIEW_DEDUP_MS) },
      },
      select: { id: true },
    });
    if (recent) return false;
  }
  await db.accessLog.create({
    data: { userId: entry.userId, resourceId: entry.resourceId, versionId: entry.versionId ?? null, kind: entry.kind, createdAt: now },
  });
  return true;
}
