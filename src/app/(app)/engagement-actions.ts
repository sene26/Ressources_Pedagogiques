"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/run-action";
import { requireUser } from "@/server/session";
import { approveResource, rejectResource } from "@/server/services/approvals";
import { setFavorite } from "@/server/services/favorites";
import { markAllRead, processNotificationsSafely, setEmailNotifications } from "@/server/services/notifications";
import { setFollowing } from "@/server/services/subscriptions";

/** Server Actions du Lot 4 : validations (F14), favoris (F21), suivi d'EC et notifications (F22). */

const str = (fd: FormData, key: string) => {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
};

/** Page interne où revenir après une validation (la carte validée disparaît de la liste). */
function returnPath(fd: FormData, info: string): string {
  const target = str(fd, "returnTo");
  const path = target.startsWith("/") && !target.startsWith("//") ? target.split("?")[0] : "/validations";
  return `${path}?info=${info}`;
}

export async function approveResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAction(async () => {
    const id = str(fd, "id");
    await approveResource(await requireUser(), id);
    await processNotificationsSafely([id]);
    revalidatePath("/", "layout");
    done = true;
  });
  if (done) redirect(returnPath(fd, "validee"));
  return result;
}

export async function rejectResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAction(async () => {
    await rejectResource(await requireUser(), str(fd, "id"), str(fd, "reason"));
    revalidatePath("/", "layout");
    done = true;
  });
  if (done) redirect(returnPath(fd, "refusee"));
  return result;
}

export async function setFavoriteAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const favorite = str(fd, "favorite") === "true";
    await setFavorite(await requireUser(), str(fd, "id"), favorite);
    revalidatePath("/", "layout");
    return favorite ? "Ajoutée aux favoris." : "Retirée des favoris.";
  });
}

export async function setFollowingAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const follow = str(fd, "follow") === "true";
    await setFollowing(await requireUser(), str(fd, "id"), follow);
    revalidatePath("/", "layout");
    return follow ? "Vous suivez cet EC : vous serez prévenu(e) des nouvelles ressources." : "Vous ne suivez plus cet EC.";
  });
}

export async function markAllReadAction(): Promise<ActionState> {
  return runAction(async () => {
    await markAllRead(await requireUser());
    revalidatePath("/", "layout");
    return "Toutes les notifications sont lues.";
  });
}

export async function setEmailNotificationsAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const enabled = str(fd, "enabled") === "true";
    await setEmailNotifications(await requireUser(), enabled);
    revalidatePath("/", "layout");
    return enabled ? "Vous recevrez les notifications par courriel." : "Vous ne recevrez plus de courriel.";
  });
}
