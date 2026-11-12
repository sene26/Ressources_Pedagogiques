import { NotFoundError } from "@/lib/errors";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { canViewResource, resourcePolicySelect, toPolicyView, visibleResourcesWhere } from "../policies/resource-policy";
import { loadViewerContext } from "./viewer";

/** Favoris (F21). On ne peut mettre en favori qu'une ressource que l'on peut voir. */
export async function setFavorite(actor: CurrentUser, resourceId: string, favorite: boolean, now = new Date()): Promise<void> {
  if (!favorite) {
    await db.favorite.deleteMany({ where: { userId: actor.id, resourceId } });
    return;
  }
  const row = await db.resource.findUnique({ where: { id: resourceId }, select: resourcePolicySelect });
  if (!row || !canViewResource(await loadViewerContext(actor), toPolicyView(row), now)) throw new NotFoundError("Ressource introuvable.");
  await db.favorite.upsert({
    where: { userId_resourceId: { userId: actor.id, resourceId } },
    update: {},
    create: { userId: actor.id, resourceId },
  });
}

export async function isFavorite(userId: string, resourceId: string): Promise<boolean> {
  return (await db.favorite.count({ where: { userId, resourceId } })) > 0;
}

/** Favoris encore visibles (une ressource archivée ou dépubliée disparaît de la liste). */
export async function listFavorites(actor: CurrentUser, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  return db.resource.findMany({
    where: { AND: [visibleResourcesWhere(viewer, now), { favorites: { some: { userId: actor.id } } }] },
    include: {
      author: { select: { firstName: true, lastName: true } },
      courseElements: { include: { courseElement: { select: { title: true } } } },
      versions: { orderBy: { number: "desc" }, take: 1, select: { format: true, sizeBytes: true } },
    },
    orderBy: { title: "asc" },
  });
}
