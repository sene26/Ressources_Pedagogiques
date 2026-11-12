import { NotFoundError } from "@/lib/errors";
import { semestersOfLevel } from "@/lib/academic";
import type { CurrentUser } from "../current-user";
import { db } from "../db";

/**
 * Suivi des EC (A10) : un étudiant suit automatiquement les EC de son inscription en cours,
 * un enseignant ceux qui lui sont affectés. Chacun peut suivre d'autres EC ou cesser d'en suivre.
 */

/** L'utilisateur suit-il l'EC (automatiquement ou explicitement) ? */
export async function isFollowing(userId: string, courseElementId: string): Promise<boolean> {
  const explicit = await db.ecSubscription.findUnique({ where: { userId_courseElementId: { userId, courseElementId } } });
  if (explicit) return !explicit.muted;
  return isAutoFollower(userId, courseElementId);
}

async function isAutoFollower(userId: string, courseElementId: string): Promise<boolean> {
  const year = await db.academicYear.findUnique({ where: { isCurrent: true }, select: { id: true } });
  if (!year) return false;
  const assigned = await db.teachingAssignment.count({ where: { teacherId: userId, courseElementId, academicYearId: year.id } });
  if (assigned > 0) return true;
  const ec = await db.courseElement.findUnique({ where: { id: courseElementId }, select: { teachingUnit: { select: { semester: true } } } });
  if (!ec) return false;
  const semester = ec.teachingUnit.semester;
  const enrollment = await db.enrollment.findUnique({ where: { studentId_academicYearId: { studentId: userId, academicYearId: year.id } } });
  return enrollment !== null && enrollment.programId === semester.programId && semestersOfLevel(enrollment.level).includes(semester.number);
}

/** Suivre ou ne plus suivre un EC. */
export async function setFollowing(actor: CurrentUser, courseElementId: string, follow: boolean): Promise<void> {
  const ec = await db.courseElement.findUnique({ where: { id: courseElementId }, select: { id: true } });
  if (!ec) throw new NotFoundError("EC introuvable.");
  await db.ecSubscription.upsert({
    where: { userId_courseElementId: { userId: actor.id, courseElementId } },
    update: { muted: !follow },
    create: { userId: actor.id, courseElementId, muted: !follow },
  });
}

/**
 * Personnes qui suivent au moins un des EC (année `academicYearId`) : inscrits au bon niveau,
 * enseignants affectés et abonnés explicites, moins celles qui ont cessé de suivre ces EC.
 */
export async function followersOf(courseElementIds: string[], academicYearId: string): Promise<string[]> {
  const elements = await db.courseElement.findMany({
    where: { id: { in: courseElementIds } },
    select: { id: true, teachingUnit: { select: { semester: { select: { programId: true, number: true } } } } },
  });
  const followers = new Set<string>();
  for (const ec of elements) {
    const { programId, number } = ec.teachingUnit.semester;
    const [students, teachers] = await Promise.all([
      db.enrollment.findMany({ where: { programId, academicYearId, level: Math.ceil(number / 2) }, select: { studentId: true } }),
      db.teachingAssignment.findMany({ where: { courseElementId: ec.id, academicYearId }, select: { teacherId: true } }),
    ]);
    students.forEach((s) => followers.add(s.studentId));
    teachers.forEach((t) => followers.add(t.teacherId));
  }
  const explicit = await db.ecSubscription.findMany({ where: { courseElementId: { in: courseElementIds } } });
  for (const sub of explicit) if (!sub.muted) followers.add(sub.userId);
  // Une personne qui a cessé de suivre tous les EC concernés n'est pas notifiée.
  const mutedByUser = new Map<string, number>();
  for (const sub of explicit) if (sub.muted) mutedByUser.set(sub.userId, (mutedByUser.get(sub.userId) ?? 0) + 1);
  for (const [userId, count] of mutedByUser) if (count >= courseElementIds.length) followers.delete(userId);
  return [...followers];
}
