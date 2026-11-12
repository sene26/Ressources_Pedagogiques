import type { ApprovalStatus, Cycle, ResourceStatus, ResourceType, Role, Visibility } from "@prisma/client";

/** Libellés français des énumérations (le code reste en anglais). */
export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Étudiant",
  TEACHER: "Enseignant",
  PROGRAM_MANAGER: "Responsable de formation",
  ADMIN: "Administrateur",
};

export const CYCLE_LABELS: Record<Cycle, string> = {
  LICENCE: "Licence",
  MASTER: "Master",
};

export const ALL_ROLES: Role[] = ["STUDENT", "TEACHER", "PROGRAM_MANAGER", "ADMIN"];


export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  COURSE: "Cours",
  TUTORIAL: "TD",
  LAB: "TP",
  EXAM: "Sujet d'examen",
  SOLUTION: "Corrigé",
  VIDEO: "Vidéo",
  LINK: "Lien",
  OTHER: "Autre",
};

export const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PRIVATE: "Privée (moi seul·e)",
  TEACHERS: "Enseignants",
  EC_STUDENTS: "Étudiants de l'EC",
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  NOT_REQUIRED: "",
  PENDING: "En attente de validation",
  APPROVED: "Validée",
  REJECTED: "Refusée",
};

/** Statut affiché : une ressource publiée dont la date n'est pas atteinte est « Programmée » (A7). */
export function statusLabel(r: { status: ResourceStatus; publishAt: Date | null }, now = new Date()): string {
  if (r.status === "DRAFT") return "Brouillon";
  if (r.status === "ARCHIVED") return "Archivée";
  return r.publishAt && r.publishAt > now ? "Programmée" : "Publiée";
}
