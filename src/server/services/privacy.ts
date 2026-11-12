import { audit } from "../audit";
import { db } from "../db";

/**
 * Protection des données personnelles (loi sénégalaise 2008-12, A12) :
 * les consultations nominatives sont conservées 2 ans, puis anonymisées
 * (l'utilisateur est retiré, les compteurs statistiques sont conservés).
 */
export const ACCESS_LOG_RETENTION_DAYS = 2 * 365;

export async function anonymizeOldAccessLogs(now = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - ACCESS_LOG_RETENTION_DAYS * 86_400_000);
  const { count } = await db.accessLog.updateMany({ where: { createdAt: { lt: limit }, userId: { not: null } }, data: { userId: null } });
  if (count > 0) {
    await db.$transaction((tx) => audit(tx, { actorId: null, action: "ACCESS_LOGS_ANONYMIZED", entityType: "AccessLog", details: { count } }));
  }
  return count;
}
