"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/run-action";
import { processNotificationsSafely } from "@/server/services/notifications";
import { requireUser } from "@/server/session";
import {
  addVersion,
  archiveResource,
  createResource,
  deleteResource,
  hardDeleteResource,
  publishResource,
  restoreResource,
  unpublishResource,
  updateResource,
  type ContentInput,
} from "@/server/services/resources";

/** Server Actions des ressources (F9–F11) : elles délèguent aux services, qui contrôlent les droits. */

const str = (fd: FormData, key: string) => {
  const value = fd.get(key);
  return typeof value === "string" ? value : undefined;
};

function metadataFrom(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    type: str(fd, "type"),
    keywords: str(fd, "keywords"),
    courseElementIds: fd.getAll("courseElementIds"),
    visibility: str(fd, "visibility"),
  };
}

function contentFrom(fd: FormData): ContentInput {
  const file = fd.get("file");
  return {
    mode: str(fd, "contentMode") === "link" ? "link" : "file",
    file: file instanceof File && file.size > 0 ? file : null,
    externalUrl: str(fd, "externalUrl"),
  };
}

function publicationFrom(fd: FormData) {
  return { mode: str(fd, "publicationMode"), publishAt: str(fd, "publishAt") || undefined };
}

export async function createResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | undefined;
  const result = await runAction(async () => {
    const actor = await requireUser();
    const resource = await createResource(actor, { ...metadataFrom(fd), publication: publicationFrom(fd), content: contentFrom(fd) });
    id = resource.id;
    await processNotificationsSafely([resource.id]);
  });
  if (id) redirect(`/ressources/${id}?depose=1`);
  return result;
}

export async function updateResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const id = str(fd, "id") ?? "";
    await updateResource(actor, id, metadataFrom(fd));
    revalidatePath(`/ressources/${id}`, "layout");
    return "Ressource enregistrée.";
  });
}

export async function addVersionAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const id = str(fd, "id") ?? "";
    const version = await addVersion(actor, id, { content: contentFrom(fd), comment: str(fd, "comment") });
    revalidatePath(`/ressources/${id}`, "layout");
    return `Version ${version.number} déposée.`;
  });
}

/**
 * Les changements de statut réorganisent la fiche : on y revient avec un message
 * de confirmation (paramètre « info ») plutôt qu'un message dans un bloc qui disparaît.
 */
async function statusAction(fd: FormData, fn: (id: string) => Promise<string>): Promise<ActionState> {
  const id = str(fd, "id") ?? "";
  let info: string | undefined;
  const result = await runAction(async () => {
    info = await fn(id);
    revalidatePath("/", "layout");
  });
  if (info) redirect(`/ressources/${id}?info=${info}`);
  return result;
}

export async function publishResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return statusAction(fd, async (id) => {
    const resource = await publishResource(await requireUser(), id, publicationFrom(fd));
    await processNotificationsSafely([id]);
    if (resource.approvalStatus === "PENDING") return "en-attente";
    return resource.publishAt && resource.publishAt > new Date() ? "programmee" : "publiee";
  });
}

export async function unpublishResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return statusAction(fd, async (id) => {
    await unpublishResource(await requireUser(), id);
    return "depubliee";
  });
}

export async function archiveResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return statusAction(fd, async (id) => {
    await archiveResource(await requireUser(), id);
    return "archivee";
  });
}

export async function restoreResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return statusAction(fd, async (id) => {
    await restoreResource(await requireUser(), id);
    return "restauree";
  });
}

export async function deleteResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") ?? "";
  let outcome: "deleted" | "archived" | undefined;
  const result = await runAction(async () => {
    outcome = await deleteResource(await requireUser(), id);
    revalidatePath("/", "layout");
  });
  if (outcome === "deleted") redirect("/mes-ressources?supprimee=1");
  if (outcome === "archived") redirect(`/ressources/${id}?info=archivee-rg9`);
  return result;
}

export async function hardDeleteResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAction(async () => {
    const actor = await requireUser();
    await hardDeleteResource(actor, str(fd, "id") ?? "");
    done = true;
  });
  if (done) redirect("/?ressource-supprimee=1");
  return result;
}
