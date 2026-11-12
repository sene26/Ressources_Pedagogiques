import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { parseInput, rejectionReasonSchema } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import { canApproveResource, canViewResource, resourcePolicySelect, toPolicyView } from "../policies/resource-policy";
import { isAdmin } from "../policies/user-policy";
import { notifyUsers } from "./notifications";
import { loadViewerContext } from "./viewer";

/**
 * Validation des sujets d'examen et des corrigés (RG5, F14) par le responsable de formation
 * (ou l'administrateur). Une ressource validée reste invisible des étudiants jusqu'à sa date.
 */

/** Sujets et corrigés en attente, pour les formations dont l'utilisateur est responsable. */
export async function listPendingApprovals(actor: CurrentUser) {
  const scope: Prisma.ResourceWhereInput = isAdmin(actor)
    ? {}
    : { courseElements: { some: { courseElement: { teachingUnit: { semester: { programId: { in: actor.managedProgramIds } } } } } } };
  if (!isAdmin(actor) && actor.managedProgramIds.length === 0) return [];
  return db.resource.findMany({
    where: { status: "PUBLISHED", approvalStatus: "PENDING", visibility: { not: "PRIVATE" }, ...scope },
    include: {
      author: { select: { firstName: true, lastName: true } },
      courseElements: { include: { courseElement: { select: { title: true } } } },
    },
    orderBy: [{ publishAt: "asc" }],
  });
}

export async function countPendingApprovals(actor: CurrentUser): Promise<number> {
  return (await listPendingApprovals(actor)).length;
}

async function loadForApproval(actor: CurrentUser, resourceId: string, now: Date) {
  const row = await db.resource.findUnique({ where: { id: resourceId }, select: { id: true, title: true, ...resourcePolicySelect } });
  if (!row) throw new NotFoundError("Ressource introuvable.");
  const viewer = await loadViewerContext(actor);
  const policy = toPolicyView(row);
  if (!canViewResource(viewer, policy, now)) throw new NotFoundError("Ressource introuvable.");
  ensure(canApproveResource(viewer, policy), "Seul le responsable de la formation peut valider ce document.");
  if (row.status !== "PUBLISHED" || row.approvalStatus !== "PENDING") throw new ConflictError("Ce document n'est pas en attente de validation.");
  return row;
}

export async function approveResource(actor: CurrentUser, resourceId: string, now = new Date()) {
  const row = await loadForApproval(actor, resourceId, now);
  const updated = await db.$transaction(async (tx) => {
    const resource = await tx.resource.update({
      where: { id: resourceId },
      data: { approvalStatus: "APPROVED", approvedById: actor.id, approvedAt: now, rejectionReason: null },
    });
    await audit(tx, { actorId: actor.id, action: "RESOURCE_APPROVED", entityType: "Resource", entityId: resourceId, details: { title: row.title } });
    return resource;
  });
  if (row.authorId !== actor.id) {
    await notifyUsers([row.authorId], `Publication validée : ${row.title}`, `/ressources/${resourceId}`, resourceId);
  }
  return updated;
}

export async function rejectResource(actor: CurrentUser, resourceId: string, reason: unknown, now = new Date()) {
  const motive = parseInput(rejectionReasonSchema, reason);
  const row = await loadForApproval(actor, resourceId, now);
  const updated = await db.$transaction(async (tx) => {
    const resource = await tx.resource.update({
      where: { id: resourceId },
      data: { approvalStatus: "REJECTED", approvedById: actor.id, approvedAt: now, rejectionReason: motive },
    });
    await audit(tx, { actorId: actor.id, action: "RESOURCE_REJECTED", entityType: "Resource", entityId: resourceId, details: { title: row.title, reason: motive } });
    return resource;
  });
  if (row.authorId !== actor.id) {
    await notifyUsers([row.authorId], `Publication refusée : ${row.title} — ${motive}`, `/ressources/${resourceId}`, resourceId);
  }
  return updated;
}

/** Prévient les responsables des formations concernées qu'un document attend leur validation. */
export async function notifyApprovalRequested(resourceId: string): Promise<void> {
  const resource = await db.resource.findUnique({
    where: { id: resourceId },
    select: { title: true, authorId: true, courseElements: { select: { courseElement: { select: { teachingUnit: { select: { semester: { select: { programId: true } } } } } } } } },
  });
  if (!resource) return;
  const programIds = resource.courseElements.map((c) => c.courseElement.teachingUnit.semester.programId);
  const managers = await db.programManagerAssignment.findMany({
    where: { programId: { in: programIds }, user: { active: true, roles: { some: { role: "PROGRAM_MANAGER" } } } },
    select: { userId: true },
  });
  const recipients = managers.map((m) => m.userId).filter((id) => id !== resource.authorId);
  await notifyUsers(recipients, `Validation demandée : ${resource.title}`, "/validations", resourceId);
}
