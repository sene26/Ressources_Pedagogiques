import { randomUUID } from "node:crypto";
import type { ApprovalStatus, Prisma, ResourceStatus, ResourceType, Visibility } from "@prisma/client";
import { z } from "zod";
import { checkExternalUrl, checkUpload } from "@/lib/file-types";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseInput, publicationSchema, resourceMetadataSchema, versionCommentSchema } from "@/lib/validation";
import { audit } from "../audit";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { ensure } from "../guards";
import {
  canApproveResource,
  canChangeResourceStatus,
  canEditResource,
  canHardDeleteResource,
  canUploadToCourseElements,
  canViewResource,
  canViewVersionHistory,
  requiresApproval,
  resourcePolicySelect,
  toPolicyView,
  visibleResourcesWhere,
  type ResourcePolicyView,
  type ViewerContext,
} from "../policies/resource-policy";
import { getStorage } from "../storage";
import { notifyApprovalRequested } from "./approvals";
import { loadViewerContext } from "./viewer";

export const RESOURCE_PAGE_SIZE = 20;

/** Contenu d'une version : un fichier déposé ou un lien externe (A8). */
export interface ContentInput {
  mode: "file" | "link";
  file?: File | null;
  externalUrl?: string | null;
}

type VersionContent = Pick<
  Prisma.ResourceVersionUncheckedCreateInput,
  "storageKey" | "externalUrl" | "originalName" | "mimeType" | "format" | "sizeBytes"
>;

// ─── Stockage du contenu ───────────────────────────────────────────────────────

/**
 * Contrôle (RG8) puis stocke le contenu. Pour un fichier, retourne aussi la clé
 * à supprimer si l'enregistrement en base échoue (pas de fichier orphelin).
 */
async function storeContent(content: ContentInput, yearLabel: string): Promise<VersionContent> {
  if (content.mode === "link") {
    const checked = checkExternalUrl(content.externalUrl ?? "");
    if (!checked.ok) throw new ValidationError(checked.message, { externalUrl: checked.message });
    return { externalUrl: checked.url, format: "lien" };
  }
  const file = content.file;
  if (!file || file.size === 0) throw new ValidationError("Choisir un fichier à déposer.", { file: "Choisir un fichier à déposer." });
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;
  const checked = checkUpload(file.name, file.size, head, Math.min(maxBytes, 100 * 1024 * 1024));
  if (!checked.ok) throw new ValidationError(checked.message, { file: checked.message });

  const storageKey = `${yearLabel}/${randomUUID()}`;
  await getStorage().put(storageKey, file.stream(), file.size, checked.format.mimeType);
  return {
    storageKey,
    originalName: file.name.slice(0, 255),
    mimeType: checked.format.mimeType,
    format: checked.format.format,
    sizeBytes: file.size,
  };
}

async function discardContent(content: VersionContent | undefined): Promise<void> {
  if (content?.storageKey) await getStorage().delete(content.storageKey).catch(() => undefined);
}

// ─── Publication ───────────────────────────────────────────────────────────────

type PublicationMode = "draft" | "now" | "schedule";

interface PublicationState {
  status: ResourceStatus;
  publishAt: Date | null;
  approvalStatus: ApprovalStatus;
}

/**
 * Calcule l'état de publication (F11, F13, RG5) :
 * - un sujet d'examen ou un corrigé publié pour les étudiants attend la validation du responsable ;
 * - sa date de publication est obligatoire (« maintenant » vaut date de publication) (A5).
 */
export function computePublication(type: ResourceType, visibility: Visibility, mode: PublicationMode, publishAt: Date | undefined, now: Date): PublicationState {
  if (mode === "draft") return { status: "DRAFT", publishAt: null, approvalStatus: "NOT_REQUIRED" };
  const date = mode === "schedule" ? (publishAt ?? null) : requiresApproval(type) ? now : null;
  const needsApproval = requiresApproval(type) && visibility === "EC_STUDENTS";
  return { status: "PUBLISHED", publishAt: date, approvalStatus: needsApproval ? "PENDING" : "NOT_REQUIRED" };
}

// ─── Chargement avec contrôle d'accès ──────────────────────────────────────────

async function loadPolicyView(resourceId: string): Promise<ResourcePolicyView & { id: string; everPublished: boolean }> {
  const row = await db.resource.findUnique({ where: { id: resourceId }, select: { id: true, everPublished: true, ...resourcePolicySelect } });
  if (!row) throw new NotFoundError("Ressource introuvable.");
  return { ...toPolicyView(row), id: row.id, everPublished: row.everPublished };
}

/** Ressource modifiable par l'acteur ; une ressource invisible pour lui est « introuvable ». */
async function loadForAction(viewer: ViewerContext, resourceId: string, now: Date) {
  const resource = await loadPolicyView(resourceId);
  if (!canViewResource(viewer, resource, now)) throw new NotFoundError("Ressource introuvable.");
  return resource;
}

// ─── Dépôt (F9) ────────────────────────────────────────────────────────────────

export interface CreateResourceInput {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  keywords?: unknown;
  courseElementIds?: unknown;
  visibility?: unknown;
  publication?: { mode?: unknown; publishAt?: unknown };
  content: ContentInput;
}

export async function createResource(actor: CurrentUser, input: CreateResourceInput, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const metadata = parseInput(resourceMetadataSchema, input);
  const publication = parseInput(publicationSchema, input.publication ?? { mode: "draft" });

  const year = await db.academicYear.findUnique({ where: { isCurrent: true } });
  if (!year) throw new ConflictError("Aucune année universitaire en cours : impossible de déposer une ressource.");
  await assertCourseElementsUsable(metadata.courseElementIds);
  ensure(
    canUploadToCourseElements(viewer, metadata.courseElementIds, year.id),
    "Vous devez être affecté(e) à chacun des EC choisis pour l'année en cours (RG2).",
  );

  const state = computePublication(metadata.type, metadata.visibility, publication.mode, publication.publishAt, now);
  const content = await storeContent(input.content, year.label);
  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const resource = await tx.resource.create({
        data: {
          title: metadata.title,
          description: metadata.description,
          type: metadata.type,
          keywords: metadata.keywords,
          visibility: metadata.visibility,
          ...state,
          everPublished: state.status === "PUBLISHED",
          authorId: actor.id,
          academicYearId: year.id,
          courseElements: { create: metadata.courseElementIds.map((courseElementId) => ({ courseElementId })) },
          versions: { create: { number: 1, comment: "Version initiale", authorId: actor.id, ...content } },
        },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "RESOURCE_CREATED",
        entityType: "Resource",
        entityId: resource.id,
        details: { title: resource.title, status: resource.status },
      });
      return resource;
    });
  } catch (error) {
    await discardContent(content);
    throw error;
  }
  if (created.approvalStatus === "PENDING") await notifyApprovalRequested(created.id);
  return created;
}

async function assertCourseElementsUsable(courseElementIds: string[]): Promise<void> {
  const found = await db.courseElement.findMany({
    where: { id: { in: courseElementIds } },
    select: { id: true, archived: true, teachingUnit: { select: { archived: true } } },
  });
  if (found.length !== courseElementIds.length) throw new NotFoundError("EC introuvable.");
  if (found.some((ec) => ec.archived || ec.teachingUnit.archived)) throw new ConflictError("Impossible de déposer sur un EC archivé.");
}

// ─── Modification (F10) ────────────────────────────────────────────────────────

/** Modifie les métadonnées ; ne crée pas de version (A8), mais l'action est tracée. */
export async function updateResource(actor: CurrentUser, resourceId: string, input: Omit<CreateResourceInput, "content" | "publication">, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canEditResource(viewer, resource), "Seul l'auteur peut modifier cette ressource.");
  if (resource.status === "ARCHIVED") throw new ConflictError("Restaurez la ressource avant de la modifier.");
  const metadata = parseInput(resourceMetadataSchema, input);

  // RG2 : les EC ajoutés doivent être des EC où l'auteur est affecté pour l'année de la ressource.
  const previousIds = resource.courseElements.map((ec) => ec.courseElementId);
  const addedIds = metadata.courseElementIds.filter((id) => !previousIds.includes(id));
  if (addedIds.length > 0) {
    await assertCourseElementsUsable(addedIds);
    ensure(canUploadToCourseElements(viewer, addedIds, resource.academicYearId), "Vous devez être affecté(e) aux EC ajoutés (RG2).");
  }

  const sameEcs = addedIds.length === 0 && previousIds.length === metadata.courseElementIds.length;
  const approvalStatus = nextApprovalStatus(resource, metadata.type, metadata.visibility, sameEcs && metadata.type === resource.type && metadata.visibility === resource.visibility);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.resource.update({
      where: { id: resourceId },
      data: {
        title: metadata.title,
        description: metadata.description,
        type: metadata.type,
        keywords: metadata.keywords,
        visibility: metadata.visibility,
        approvalStatus,
        ...(approvalStatus === "PENDING" ? { approvedById: null, approvedAt: null } : {}),
        courseElements: { deleteMany: {}, create: metadata.courseElementIds.map((courseElementId) => ({ courseElementId })) },
      },
    });
    await audit(tx, { actorId: actor.id, action: "RESOURCE_UPDATED", entityType: "Resource", entityId: resourceId });
    return result;
  });
  if (updated.approvalStatus === "PENDING" && resource.approvalStatus !== "PENDING") await notifyApprovalRequested(resourceId);
  return updated;
}

/** Après une modification : une validation acquise est conservée seulement si rien d'important n'a changé (A5). */
function nextApprovalStatus(resource: ResourcePolicyView, type: ResourceType, visibility: Visibility, unchanged: boolean): ApprovalStatus {
  if (resource.status !== "PUBLISHED" || !requiresApproval(type) || visibility !== "EC_STUDENTS") return "NOT_REQUIRED";
  if (unchanged && resource.approvalStatus !== "NOT_REQUIRED") return resource.approvalStatus;
  return "PENDING";
}

/** Dépose une nouvelle version (RG6) ; une ressource validée doit être revalidée (A5). */
export async function addVersion(actor: CurrentUser, resourceId: string, input: { content: ContentInput; comment?: unknown }, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canEditResource(viewer, resource), "Seul l'auteur peut déposer une nouvelle version.");
  if (resource.status === "ARCHIVED") throw new ConflictError("Restaurez la ressource avant de déposer une nouvelle version.");
  const comment = parseInput(versionCommentSchema, input.comment);
  const year = await db.academicYear.findUniqueOrThrow({ where: { id: resource.academicYearId } });

  const content = await storeContent(input.content, year.label);
  const needsRevalidation = resource.approvalStatus === "APPROVED" || resource.approvalStatus === "REJECTED";
  let version;
  try {
    version = await db.$transaction(async (tx) => {
      const last = await tx.resourceVersion.findFirst({ where: { resourceId }, orderBy: { number: "desc" }, select: { number: true } });
      const created = await tx.resourceVersion.create({
        data: { resourceId, number: (last?.number ?? 0) + 1, comment, authorId: actor.id, ...content },
      });
      await tx.resource.update({
        where: { id: resourceId },
        data: needsRevalidation ? { approvalStatus: "PENDING", approvedById: null, approvedAt: null, rejectionReason: null } : { updatedAt: now },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "RESOURCE_VERSION_ADDED",
        entityType: "Resource",
        entityId: resourceId,
        details: { number: created.number, comment },
      });
      return created;
    });
  } catch (error) {
    await discardContent(content);
    throw error;
  }
  if (needsRevalidation) await notifyApprovalRequested(resourceId);
  return version;
}

// ─── Publication, dépublication, archivage (F11, F13, RG9) ─────────────────────

export async function publishResource(actor: CurrentUser, resourceId: string, input: { mode?: unknown; publishAt?: unknown }, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canChangeResourceStatus(viewer, resource));
  if (resource.status === "ARCHIVED") throw new ConflictError("Restaurez la ressource avant de la publier.");
  const publication = parseInput(publicationSchema, input);
  if (publication.mode === "draft") throw new ValidationError("Choisir « maintenant » ou une date de publication.");
  const state = computePublication(resource.type, resource.visibility, publication.mode, publication.publishAt, now);
  const updated = await setState(actor, resourceId, { ...state, everPublished: true, rejectionReason: null, approvedById: null, approvedAt: null }, state.publishAt && state.publishAt > now ? "RESOURCE_SCHEDULED" : "RESOURCE_PUBLISHED");
  if (updated.approvalStatus === "PENDING") await notifyApprovalRequested(resourceId);
  return updated;
}

/** Dépublier remet la ressource en brouillon (A7). */
export async function unpublishResource(actor: CurrentUser, resourceId: string, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canChangeResourceStatus(viewer, resource));
  if (resource.status !== "PUBLISHED") throw new ConflictError("Cette ressource n'est pas publiée.");
  return setState(actor, resourceId, { status: "DRAFT", publishAt: null, approvalStatus: "NOT_REQUIRED", approvedById: null, approvedAt: null }, "RESOURCE_UNPUBLISHED");
}

export async function archiveResource(actor: CurrentUser, resourceId: string, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canChangeResourceStatus(viewer, resource));
  if (resource.status === "ARCHIVED") throw new ConflictError("Cette ressource est déjà archivée.");
  return setState(actor, resourceId, { status: "ARCHIVED" }, "RESOURCE_ARCHIVED");
}

/** Une ressource restaurée revient en brouillon : sa republication est un acte explicite. */
export async function restoreResource(actor: CurrentUser, resourceId: string, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canChangeResourceStatus(viewer, resource));
  if (resource.status !== "ARCHIVED") throw new ConflictError("Cette ressource n'est pas archivée.");
  return setState(actor, resourceId, { status: "DRAFT", publishAt: null, approvalStatus: "NOT_REQUIRED" }, "RESOURCE_RESTORED");
}

async function setState(actor: CurrentUser, resourceId: string, data: Prisma.ResourceUncheckedUpdateInput, action: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.resource.update({ where: { id: resourceId }, data });
    await audit(tx, { actorId: actor.id, action, entityType: "Resource", entityId: resourceId, details: { status: updated.status } });
    return updated;
  });
}

/**
 * « Supprimer » (RG9) : un brouillon jamais publié est effacé ; une ressource déjà publiée
 * est seulement archivée. Retourne ce qui a été fait.
 */
export async function deleteResource(actor: CurrentUser, resourceId: string, now = new Date()): Promise<"deleted" | "archived"> {
  const viewer = await loadViewerContext(actor);
  const resource = await loadForAction(viewer, resourceId, now);
  ensure(canChangeResourceStatus(viewer, resource));
  if (resource.everPublished) {
    if (resource.status !== "ARCHIVED") await setState(actor, resourceId, { status: "ARCHIVED" }, "RESOURCE_ARCHIVED");
    return "archived";
  }
  await eraseResource(actor, resourceId, "RESOURCE_DELETED");
  return "deleted";
}

/** Suppression définitive (RG9) : administrateur uniquement ; les fichiers sont effacés du stockage. */
export async function hardDeleteResource(actor: CurrentUser, resourceId: string) {
  const viewer = await loadViewerContext(actor);
  if (!canHardDeleteResource(viewer)) throw new ForbiddenError("Seul l'administrateur peut supprimer définitivement une ressource.");
  await loadPolicyView(resourceId);
  await eraseResource(actor, resourceId, "RESOURCE_HARD_DELETED");
}

async function eraseResource(actor: CurrentUser, resourceId: string, action: string) {
  const keys = await db.$transaction(async (tx) => {
    const resource = await tx.resource.findUniqueOrThrow({ where: { id: resourceId }, include: { versions: { select: { storageKey: true } } } });
    await tx.resource.delete({ where: { id: resourceId } });
    await audit(tx, { actorId: actor.id, action, entityType: "Resource", entityId: resourceId, details: { title: resource.title } });
    return resource.versions.map((v) => v.storageKey).filter((k): k is string => k !== null);
  });
  await Promise.all(keys.map((key) => getStorage().delete(key).catch(() => undefined)));
}

// ─── Lecture ───────────────────────────────────────────────────────────────────

const detailInclude = {
  author: { select: { id: true, firstName: true, lastName: true } },
  academicYear: { select: { id: true, label: true, isCurrent: true } },
  approvedBy: { select: { firstName: true, lastName: true } },
  courseElements: {
    include: {
      courseElement: {
        include: { teachingUnit: { include: { semester: { include: { program: { select: { id: true, code: true, title: true, cycle: true } } } } } } },
      },
    },
  },
  versions: { orderBy: { number: "desc" }, include: { author: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.ResourceInclude;

export type ResourceDetail = Prisma.ResourceGetPayload<{ include: typeof detailInclude }>;

/**
 * Fiche d'une ressource pour un utilisateur (contrôle RG2–RG7). Les versions antérieures
 * ne sont renvoyées qu'aux personnes autorisées (RG6) ; les autres ne voient que la version en vigueur.
 */
export async function getResourceForViewer(actor: CurrentUser, resourceId: string, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const row = await db.resource.findUnique({ where: { id: resourceId }, include: detailInclude });
  if (!row) throw new NotFoundError("Ressource introuvable.");
  const policy = toPolicyView({
    ...row,
    courseElements: row.courseElements.map((rc) => ({
      courseElementId: rc.courseElementId,
      courseElement: { teachingUnit: { semester: { programId: rc.courseElement.teachingUnit.semester.programId, number: rc.courseElement.teachingUnit.semester.number } } },
    })),
  });
  if (!canViewResource(viewer, policy, now)) throw new NotFoundError("Ressource introuvable.");
  const canSeeHistory = canViewVersionHistory(viewer, policy);
  return {
    resource: { ...row, versions: canSeeHistory ? row.versions : row.versions.slice(0, 1) },
    permissions: {
      edit: canEditResource(viewer, policy),
      changeStatus: canChangeResourceStatus(viewer, policy),
      viewHistory: canSeeHistory,
      hardDelete: canHardDeleteResource(viewer),
      approve: canApproveResource(viewer, policy),
    },
  };
}

export type MyResourcesTab = "all" | "draft" | "published" | "scheduled" | "pending" | "archived";

/** « Mes ressources » : ressources de l'auteur, par onglet et par année, paginées. */
export async function listMyResources(actor: CurrentUser, options: { tab?: MyResourcesTab; academicYearId?: string; page?: number }, now = new Date()) {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const tabWhere: Record<MyResourcesTab, Prisma.ResourceWhereInput> = {
    all: {},
    draft: { status: "DRAFT" },
    published: { status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
    scheduled: { status: "PUBLISHED", publishAt: { gt: now } },
    pending: { status: "PUBLISHED", approvalStatus: { in: ["PENDING", "REJECTED"] } },
    archived: { status: "ARCHIVED" },
  };
  const where: Prisma.ResourceWhereInput = {
    authorId: actor.id,
    ...(options.academicYearId ? { academicYearId: options.academicYearId } : {}),
    ...tabWhere[options.tab ?? "all"],
  };
  const [total, resources] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * RESOURCE_PAGE_SIZE,
      take: RESOURCE_PAGE_SIZE,
      include: {
        courseElements: { include: { courseElement: { select: { title: true, code: true } } } },
        versions: { orderBy: { number: "desc" }, take: 1, select: { number: true, format: true, sizeBytes: true } },
        _count: { select: { accessLogs: true } },
      },
    }),
  ]);
  return { resources, total, page, pageCount: Math.max(1, Math.ceil(total / RESOURCE_PAGE_SIZE)) };
}

/** Nombre de ressources visibles par l'utilisateur (sert aux tests de cohérence et aux compteurs). */
export async function countVisibleResources(actor: CurrentUser, where: Prisma.ResourceWhereInput = {}, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  return db.resource.count({ where: { AND: [visibleResourcesWhere(viewer, now), where] } });
}

/** EC sur lesquels l'utilisateur peut déposer pour l'année en cours (formulaire de dépôt). */
export async function listUploadableCourseElements(actor: CurrentUser) {
  const year = await db.academicYear.findUnique({ where: { isCurrent: true } });
  if (!year) return [];
  return db.courseElement.findMany({
    where: { archived: false, teachingUnit: { archived: false }, teachingAssignments: { some: { teacherId: actor.id, academicYearId: year.id } } },
    include: { teachingUnit: { include: { semester: { include: { program: { select: { code: true, cycle: true } } } } } } },
    orderBy: { code: "asc" },
  });
}

// ─── Duplication (F15) ─────────────────────────────────────────────────────────

/**
 * Duplique une ressource visible vers d'autres EC et/ou une autre année universitaire (F15).
 * La copie est un brouillon dont l'utilisateur est l'auteur ; seule la version en vigueur est copiée
 * (le fichier est recopié dans le stockage). RG2 s'applique aux EC et à l'année cibles.
 */
export async function duplicateResource(
  actor: CurrentUser,
  sourceId: string,
  input: { courseElementIds?: unknown; academicYearId?: unknown },
  now = new Date(),
) {
  const viewer = await loadViewerContext(actor);
  await loadForAction(viewer, sourceId, now);
  const target = parseInput(
    resourceMetadataSchema.pick({ courseElementIds: true }).extend({ academicYearId: z.string().uuid("Année universitaire invalide.") }),
    input,
  );
  const year = await db.academicYear.findUnique({ where: { id: target.academicYearId } });
  if (!year) throw new NotFoundError("Année universitaire introuvable.");
  await assertCourseElementsUsable(target.courseElementIds);
  ensure(
    canUploadToCourseElements(viewer, target.courseElementIds, year.id),
    `Vous devez être affecté(e) à chacun des EC choisis pour l'année ${year.label} (RG2).`,
  );

  const source = await db.resource.findUniqueOrThrow({
    where: { id: sourceId },
    include: { versions: { orderBy: { number: "desc" }, take: 1 } },
  });
  const current = source.versions[0];
  let storageKey: string | null = null;
  if (current.storageKey) {
    storageKey = `${year.label}/${randomUUID()}`;
    const object = await getStorage().get(current.storageKey);
    await getStorage().put(storageKey, object.stream, object.size, current.mimeType ?? "application/octet-stream");
  }
  try {
    return await db.$transaction(async (tx) => {
      const copy = await tx.resource.create({
        data: {
          title: source.title,
          description: source.description,
          type: source.type,
          keywords: source.keywords,
          visibility: source.visibility,
          status: "DRAFT",
          authorId: actor.id,
          academicYearId: year.id,
          duplicatedFromId: source.id,
          courseElements: { create: target.courseElementIds.map((courseElementId) => ({ courseElementId })) },
          versions: {
            create: {
              number: 1,
              comment: `Copie de « ${source.title} » (v${current.number})`.slice(0, 500),
              authorId: actor.id,
              storageKey,
              externalUrl: current.externalUrl,
              originalName: current.originalName,
              mimeType: current.mimeType,
              format: current.format,
              sizeBytes: current.sizeBytes,
            },
          },
        },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "RESOURCE_DUPLICATED",
        entityType: "Resource",
        entityId: copy.id,
        details: { from: source.id, academicYear: year.label },
      });
      return copy;
    });
  } catch (error) {
    if (storageKey) await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

/** EC où l'utilisateur peut déposer pour une année donnée (choix des cibles d'une duplication). */
export async function listUploadableCourseElementsForYear(actor: CurrentUser, academicYearId: string) {
  return db.courseElement.findMany({
    where: { archived: false, teachingUnit: { archived: false }, teachingAssignments: { some: { teacherId: actor.id, academicYearId } } },
    include: { teachingUnit: { include: { semester: { include: { program: { select: { code: true, cycle: true } } } } } } },
    orderBy: { code: "asc" },
  });
}
