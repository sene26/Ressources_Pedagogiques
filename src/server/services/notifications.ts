import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "../current-user";
import { loadCurrentUser } from "../current-user";
import { db } from "../db";
import { sendMail } from "../mail";
import { canViewResource, resourcePolicySelect, toPolicyView } from "../policies/resource-policy";
import { followersOf } from "./subscriptions";
import { loadViewerContext } from "./viewer";

/**
 * Notifications (F22) : à la mise à disposition d'une ressource dans un EC suivi,
 * dans la plateforme et par courriel. Les publications programmées sont traitées
 * par la tâche périodique /api/cron/notifications.
 */

export const NOTIFICATION_PAGE_SIZE = 20;

/** Ressources publiées, visibles à `now`, pas encore notifiées (et validées s'il s'agit d'examens). */
function dueWhere(now: Date): Prisma.ResourceWhereInput {
  return {
    status: "PUBLISHED",
    notifiedAt: null,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    AND: [{ OR: [{ type: { notIn: ["EXAM", "SOLUTION"] } }, { approvalStatus: "APPROVED" }] }],
  };
}

/** Crée les notifications de publication dues ; retourne le nombre de notifications créées. */
export async function dispatchPublicationNotifications(now = new Date(), resourceIds?: string[]): Promise<number> {
  const due = await db.resource.findMany({
    where: { AND: [dueWhere(now), resourceIds ? { id: { in: resourceIds } } : {}] },
    select: { id: true, title: true, ...resourcePolicySelect, courseElements: { select: { courseElementId: true, courseElement: { select: { title: true, teachingUnit: { select: { semester: { select: { programId: true, number: true } } } } } } } } },
    take: 200,
  });
  let created = 0;
  for (const resource of due) {
    // On marque d'abord la ressource : en cas d'exécutions concurrentes, une seule l'emporte.
    const claimed = await db.resource.updateMany({ where: { id: resource.id, notifiedAt: null }, data: { notifiedAt: now } });
    if (claimed.count === 0) continue;

    const policy = toPolicyView(resource);
    const ecIds = resource.courseElements.map((c) => c.courseElementId);
    const ecTitle = resource.courseElements[0]?.courseElement.title ?? "";
    const candidates = (await followersOf(ecIds, resource.academicYearId)).filter((id) => id !== resource.authorId);
    const recipients: string[] = [];
    for (const userId of candidates) {
      const user = await loadCurrentUser(userId);
      if (user && canViewResource(await loadViewerContext(user), policy, now)) recipients.push(userId);
    }
    if (recipients.length > 0) {
      await db.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          resourceId: resource.id,
          message: `Nouvelle ressource dans « ${ecTitle} » : ${resource.title}`.slice(0, 300),
          link: `/ressources/${resource.id}`,
          createdAt: now,
        })),
      });
      created += recipients.length;
    }
  }
  return created;
}

/** Notification individuelle (validation demandée, publication refusée…). */
export async function notifyUsers(userIds: string[], message: string, link: string, resourceId?: string): Promise<void> {
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: [...new Set(userIds)].map((userId) => ({ userId, resourceId: resourceId ?? null, message: message.slice(0, 300), link })),
  });
}

/**
 * Envoie par courriel les notifications non encore envoyées, regroupées par destinataire,
 * aux utilisateurs actifs qui l'acceptent. Retourne le nombre de courriels envoyés.
 */
export async function sendPendingNotificationEmails(now = new Date()): Promise<number> {
  const pending = await db.notification.findMany({
    where: { emailedAt: null, readAt: null },
    include: { user: { select: { id: true, email: true, firstName: true, active: true, emailNotifications: true } } },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  let sent = 0;
  for (const [, list] of byUser) {
    const user = list[0].user;
    if (user.active && user.emailNotifications) {
      await sendMail({
        to: user.email,
        subject: list.length === 1 ? `RessourcesPéda — ${list[0].message}` : `RessourcesPéda — ${list.length} nouvelles notifications`,
        text: [
          `Bonjour ${user.firstName},`,
          "",
          ...list.map((n) => `• ${n.message}\n  ${appUrl}${n.link}`),
          "",
          `Vous pouvez désactiver ces courriels depuis votre profil : ${appUrl}/profil`,
        ].join("\n"),
      });
      sent += 1;
    }
    // Même sans courriel (désactivé), on ne réessaie pas indéfiniment.
    await db.notification.updateMany({ where: { id: { in: list.map((n) => n.id) } }, data: { emailedAt: now } });
  }
  return sent;
}

/** Traitement complet : notifications dues puis courriels. Appelé après publication et par la tâche périodique. */
export async function processNotifications(now = new Date(), resourceIds?: string[]) {
  const notifications = await dispatchPublicationNotifications(now, resourceIds);
  const emails = await sendPendingNotificationEmails(now);
  return { notifications, emails };
}

/** Variante « au mieux » après une action utilisateur : une panne de messagerie ne doit pas faire échouer l'action. */
export async function processNotificationsSafely(resourceIds?: string[]): Promise<void> {
  try {
    await processNotifications(new Date(), resourceIds);
  } catch (error) {
    console.error("Envoi des notifications reporté à la prochaine tâche périodique :", error);
  }
}

export async function countUnread(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(actor: CurrentUser, page = 1) {
  const p = Math.max(1, Math.floor(page));
  const [total, notifications] = await Promise.all([
    db.notification.count({ where: { userId: actor.id } }),
    db.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * NOTIFICATION_PAGE_SIZE,
      take: NOTIFICATION_PAGE_SIZE,
    }),
  ]);
  return { notifications, total, page: p, pageCount: Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE)) };
}

export async function markAllRead(actor: CurrentUser, now = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: now } });
}

/** Marque comme lue la notification ouverte (seulement si elle appartient à l'utilisateur). */
export async function markRead(actor: CurrentUser, notificationId: string, now = new Date()): Promise<string | null> {
  const notification = await db.notification.findFirst({ where: { id: notificationId, userId: actor.id } });
  if (!notification) return null;
  if (!notification.readAt) await db.notification.update({ where: { id: notificationId }, data: { readAt: now } });
  return notification.link;
}

export async function setEmailNotifications(actor: CurrentUser, enabled: boolean): Promise<void> {
  await db.user.update({ where: { id: actor.id }, data: { emailNotifications: enabled } });
}
