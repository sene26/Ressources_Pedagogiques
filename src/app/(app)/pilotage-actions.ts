"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/run-action";
import { requireUser } from "@/server/session";
import { changePassword, removeProfilePhoto, setProfilePhoto, updateProfile } from "@/server/services/profile";
import { duplicateResource } from "@/server/services/resources";
import { importUsersCsv } from "@/server/services/user-import";

/** Server Actions du Lot 5 : profil (F4), import CSV (F3), duplication (F15). */

const str = (fd: FormData, key: string) => {
  const value = fd.get(key);
  return typeof value === "string" ? value : undefined;
};

export async function updateProfileAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateProfile(await requireUser(), { lastName: str(fd, "lastName"), firstName: str(fd, "firstName"), phone: str(fd, "phone") });
    revalidatePath("/", "layout");
    return "Profil enregistré.";
  });
}

export async function changePasswordAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await changePassword(await requireUser(), { current: str(fd, "current"), password: str(fd, "password"), confirmation: str(fd, "confirmation") });
    return "Mot de passe modifié.";
  });
}

export async function setPhotoAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const file = fd.get("photo");
    await setProfilePhoto(await requireUser(), file instanceof File ? file : null);
    revalidatePath("/", "layout");
    return "Photo enregistrée.";
  });
}

export async function removePhotoAction(): Promise<ActionState> {
  return runAction(async () => {
    await removeProfilePhoto(await requireUser());
    revalidatePath("/", "layout");
    return "Photo supprimée.";
  });
}

export interface ImportState extends ActionState {
  report?: { created: number; enrolled: number; skipped: string[]; errors: { line: number; message: string }[] };
}

export async function importUsersAction(_s: ImportState, fd: FormData): Promise<ImportState> {
  let report: ImportState["report"];
  const state = await runAction(async () => {
    const file = fd.get("file");
    const text = file instanceof File && file.size > 0 ? await file.text() : (str(fd, "csv") ?? "");
    if (text.length > 2_000_000) return "Fichier trop volumineux (2 Mo au maximum).";
    report = await importUsersCsv(await requireUser(), text);
    revalidatePath("/gestion/utilisateurs");
    return report.errors.length > 0
      ? `Aucun compte importé : ${report.errors.length} erreur(s) à corriger.`
      : `${report.created} compte(s) créé(s), dont ${report.enrolled} inscrit(s) ; ${report.skipped.length} déjà existant(s).`;
  });
  if (report && report.errors.length > 0) return { status: "error", message: state.message, report };
  return { ...state, report };
}

export async function duplicateResourceAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let copyId: string | undefined;
  const result = await runAction(async () => {
    const copy = await duplicateResource(await requireUser(), str(fd, "id") ?? "", {
      courseElementIds: fd.getAll("courseElementIds"),
      academicYearId: str(fd, "academicYearId"),
    });
    copyId = copy.id;
  });
  if (copyId) redirect(`/ressources/${copyId}?info=dupliquee`);
  return result;
}
