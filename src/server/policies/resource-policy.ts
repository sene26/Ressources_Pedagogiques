import type { ApprovalStatus, Prisma, ResourceStatus, ResourceType, Visibility } from "@prisma/client";
import { levelOfSemester, semestersOfLevel } from "@/lib/academic";
import type { CurrentUser } from "../current-user";
import { hasRole, isAdmin } from "./user-policy";

/**
 * « Qui voit quoi » pour les ressources (RG2 à RG7, décision A4).
 *
 * Les règles existent sous deux formes construites en miroir :
 * - `canViewResource` : vérification d'une ressource précise (fiche, téléchargement) ;
 * - `visibleResourcesWhere` : filtre Prisma appliqué à toutes les listes et recherches.
 * Un test d'intégration vérifie que les deux formes donnent toujours le même résultat.
 */

/** Ce qu'il faut savoir de l'utilisateur pour décider (chargé une fois par requête). */
export interface ViewerContext {
  user: CurrentUser;
  currentYearId: string | null;
  /** Inscription de l'étudiant pour l'année en cours (RG7). */
  enrollment: { programId: string; level: number } | null;
  /** Affectations de l'enseignant, toutes années confondues. */
  assignments: { courseElementId: string; academicYearId: string }[];
}

/** Ce qu'il faut savoir de la ressource pour décider. */
export interface ResourcePolicyView {
  authorId: string;
  status: ResourceStatus;
  visibility: Visibility;
  type: ResourceType;
  publishAt: Date | null;
  approvalStatus: ApprovalStatus;
  academicYearId: string;
  courseElements: { courseElementId: string; programId: string; semesterNumber: number }[];
}

/** Sélection Prisma qui fournit les données de `ResourcePolicyView`. */
export const resourcePolicySelect = {
  authorId: true,
  status: true,
  visibility: true,
  type: true,
  publishAt: true,
  approvalStatus: true,
  academicYearId: true,
  courseElements: {
    select: {
      courseElementId: true,
      courseElement: { select: { teachingUnit: { select: { semester: { select: { programId: true, number: true } } } } } },
    },
  },
} satisfies Prisma.ResourceSelect;

type PolicyRow = Prisma.ResourceGetPayload<{ select: typeof resourcePolicySelect }>;

export function toPolicyView(row: PolicyRow): ResourcePolicyView {
  return {
    authorId: row.authorId,
    status: row.status,
    visibility: row.visibility,
    type: row.type,
    publishAt: row.publishAt,
    approvalStatus: row.approvalStatus,
    academicYearId: row.academicYearId,
    courseElements: row.courseElements.map((rc) => ({
      courseElementId: rc.courseElementId,
      programId: rc.courseElement.teachingUnit.semester.programId,
      semesterNumber: rc.courseElement.teachingUnit.semester.number,
    })),
  };
}

// ─── Règles élémentaires ───────────────────────────────────────────────────────

/** Les sujets d'examen et corrigés exigent la validation du responsable (RG5). */
export function requiresApproval(type: ResourceType): boolean {
  return type === "EXAM" || type === "SOLUTION";
}

export function isTeacher(user: CurrentUser): boolean {
  return hasRole(user, "TEACHER") || hasRole(user, "PROGRAM_MANAGER");
}

/** Visible par les étudiants à l'instant `now`, indépendamment de qui regarde (RG3, RG4, RG5). */
export function isOpenToStudents(r: ResourcePolicyView, now: Date): boolean {
  return (
    r.status === "PUBLISHED" &&
    r.visibility === "EC_STUDENTS" &&
    (r.publishAt === null || r.publishAt <= now) &&
    (!requiresApproval(r.type) || r.approvalStatus === "APPROVED")
  );
}

/** Responsable d'une des formations de la ressource (A3). */
export function managesResourceProgram(viewer: ViewerContext, r: ResourcePolicyView): boolean {
  if (!hasRole(viewer.user, "PROGRAM_MANAGER")) return false;
  return r.courseElements.some((ec) => viewer.user.managedProgramIds.includes(ec.programId));
}

/** Enseignant affecté à l'un des EC de la ressource pour l'année de la ressource (équipe pédagogique). */
export function isTeamMember(viewer: ViewerContext, r: ResourcePolicyView): boolean {
  return viewer.assignments.some(
    (a) => a.academicYearId === r.academicYearId && r.courseElements.some((ec) => ec.courseElementId === a.courseElementId),
  );
}

// ─── Consultation ──────────────────────────────────────────────────────────────

export function canViewResource(viewer: ViewerContext, r: ResourcePolicyView, now: Date): boolean {
  const { user } = viewer;
  if (isAdmin(user) || r.authorId === user.id) return true;
  if (managesResourceProgram(viewer, r) && r.visibility !== "PRIVATE") return true;
  if (r.status === "ARCHIVED" || r.visibility === "PRIVATE") return false;

  if (isTeacher(user)) {
    if (r.status === "PUBLISHED") return true; // RG2 : partagée avec tous les enseignants
    if (isTeamMember(viewer, r)) return true; // brouillons partagés au sein de l'équipe de l'EC
  }

  if (hasRole(user, "STUDENT") && viewer.enrollment && viewer.currentYearId) {
    const { programId, level } = viewer.enrollment;
    return (
      isOpenToStudents(r, now) &&
      r.academicYearId === viewer.currentYearId && // RG7 : année en cours seulement
      r.courseElements.some((ec) => ec.programId === programId && levelOfSemester(ec.semesterNumber) === level)
    );
  }
  return false;
}

/** Filtre Prisma équivalent à `canViewResource`, pour les listes et la recherche. */
export function visibleResourcesWhere(viewer: ViewerContext, now: Date): Prisma.ResourceWhereInput {
  const { user } = viewer;
  if (isAdmin(user)) return {};

  const notPrivate = { visibility: { not: "PRIVATE" as const } };
  const clauses: Prisma.ResourceWhereInput[] = [{ authorId: user.id }];

  if (hasRole(user, "PROGRAM_MANAGER") && user.managedProgramIds.length > 0) {
    clauses.push({
      ...notPrivate,
      courseElements: {
        some: { courseElement: { teachingUnit: { semester: { programId: { in: user.managedProgramIds } } } } },
      },
    });
  }

  if (isTeacher(user)) {
    clauses.push({ ...notPrivate, status: "PUBLISHED" });
    // Équipe pédagogique : une clause par année, avec les EC affectés cette année-là.
    const byYear = new Map<string, string[]>();
    for (const a of viewer.assignments) byYear.set(a.academicYearId, [...(byYear.get(a.academicYearId) ?? []), a.courseElementId]);
    for (const [academicYearId, courseElementIds] of byYear) {
      clauses.push({
        ...notPrivate,
        status: { in: ["DRAFT", "PUBLISHED"] },
        academicYearId,
        courseElements: { some: { courseElementId: { in: courseElementIds } } },
      });
    }
  }

  if (hasRole(user, "STUDENT") && viewer.enrollment && viewer.currentYearId) {
    const { programId, level } = viewer.enrollment;
    clauses.push({
      status: "PUBLISHED",
      visibility: "EC_STUDENTS",
      academicYearId: viewer.currentYearId,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      AND: [{ OR: [{ type: { notIn: ["EXAM", "SOLUTION"] } }, { approvalStatus: "APPROVED" }] }],
      courseElements: {
        some: { courseElement: { teachingUnit: { semester: { programId, number: { in: semestersOfLevel(level) } } } } },
      },
    });
  }

  return { OR: clauses };
}

// ─── Actions sur les ressources ────────────────────────────────────────────────

/** RG2 : déposer sur des EC exige d'être affecté à chacun d'eux pour l'année (A6). */
export function canUploadToCourseElements(viewer: ViewerContext, courseElementIds: string[], academicYearId: string): boolean {
  if (!isTeacher(viewer.user) || courseElementIds.length === 0) return false;
  return courseElementIds.every((id) =>
    viewer.assignments.some((a) => a.courseElementId === id && a.academicYearId === academicYearId),
  );
}

/** Modifier le contenu ou les métadonnées : l'auteur seul. */
export function canEditResource(viewer: ViewerContext, r: ResourcePolicyView): boolean {
  return r.authorId === viewer.user.id;
}

/** Publier, dépublier, archiver, restaurer : l'auteur, ou l'administrateur. */
export function canChangeResourceStatus(viewer: ViewerContext, r: ResourcePolicyView): boolean {
  return r.authorId === viewer.user.id || isAdmin(viewer.user);
}

/** RG6 : l'historique des versions est réservé à l'auteur et au responsable (et à l'administrateur). */
export function canViewVersionHistory(viewer: ViewerContext, r: ResourcePolicyView): boolean {
  if (isAdmin(viewer.user) || r.authorId === viewer.user.id) return true;
  return managesResourceProgram(viewer, r) && r.visibility !== "PRIVATE";
}

/** RG5, F14 : valider un sujet d'examen ou un corrigé (A5 : un auteur responsable peut valider). */
export function canApproveResource(viewer: ViewerContext, r: ResourcePolicyView): boolean {
  return isAdmin(viewer.user) || managesResourceProgram(viewer, r);
}

/** RG9 : seul l'administrateur supprime définitivement. */
export function canHardDeleteResource(viewer: ViewerContext): boolean {
  return isAdmin(viewer.user);
}
