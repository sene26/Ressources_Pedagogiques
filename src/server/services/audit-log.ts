import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { isAdmin } from "../policies/user-policy";

export const AUDIT_PAGE_SIZE = 50;

/** Libellés français des actions journalisées (F25). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Compte créé",
  USER_UPDATED: "Compte modifié",
  USER_ACTIVATED: "Compte activé",
  USER_DEACTIVATED: "Compte désactivé",
  USER_PASSWORD_SET: "Mot de passe défini par l'administrateur",
  USERS_IMPORTED: "Import de comptes (CSV)",
  PASSWORD_RESET: "Mot de passe réinitialisé",
  PROFILE_UPDATED: "Profil modifié",
  ACADEMIC_YEAR_CREATED: "Année universitaire créée",
  ACADEMIC_YEAR_SET_CURRENT: "Année en cours changée",
  PROGRAM_CREATED: "Formation créée",
  PROGRAM_UPDATED: "Formation modifiée",
  PROGRAM_ARCHIVED: "Formation archivée",
  PROGRAM_RESTORED: "Formation restaurée",
  PROGRAM_MANAGER_ADDED: "Responsable ajouté",
  PROGRAM_MANAGER_REMOVED: "Responsable retiré",
  TEACHING_UNIT_CREATED: "UE créée",
  TEACHING_UNIT_UPDATED: "UE modifiée",
  TEACHING_UNIT_ARCHIVED: "UE archivée",
  TEACHING_UNIT_RESTORED: "UE restaurée",
  COURSE_ELEMENT_CREATED: "EC créé",
  COURSE_ELEMENT_UPDATED: "EC modifié",
  COURSE_ELEMENT_ARCHIVED: "EC archivé",
  COURSE_ELEMENT_RESTORED: "EC restauré",
  TEACHER_ASSIGNED: "Enseignant affecté",
  TEACHER_UNASSIGNED: "Affectation retirée",
  STUDENT_ENROLLED: "Étudiant inscrit",
  STUDENT_UNENROLLED: "Inscription supprimée",
  RESOURCE_CREATED: "Ressource déposée",
  RESOURCE_UPDATED: "Ressource modifiée",
  RESOURCE_VERSION_ADDED: "Nouvelle version",
  RESOURCE_PUBLISHED: "Ressource publiée",
  RESOURCE_SCHEDULED: "Publication programmée",
  RESOURCE_UNPUBLISHED: "Ressource dépubliée",
  RESOURCE_ARCHIVED: "Ressource archivée",
  RESOURCE_RESTORED: "Ressource restaurée",
  RESOURCE_DELETED: "Brouillon supprimé",
  RESOURCE_HARD_DELETED: "Ressource supprimée définitivement",
  RESOURCE_DUPLICATED: "Ressource dupliquée",
  RESOURCE_APPROVED: "Publication validée",
  RESOURCE_REJECTED: "Publication refusée",
  ACCESS_LOGS_ANONYMIZED: "Consultations anonymisées",
};

export interface AuditFilters {
  action?: string;
  entityType?: string;
  actor?: string;
  page?: number;
}

/** Journal des actions (F25) : administrateur uniquement. */
export async function listAuditLogs(actor: CurrentUser, filters: AuditFilters = {}) {
  ensure(isAdmin(actor));
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const q = filters.actor?.trim();
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(q ? { actor: { OR: [{ lastName: { contains: q } }, { firstName: { contains: q } }, { email: { contains: q } }] } } : {}),
  };
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
  ]);
  return { logs, total, page, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}
