"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/run-action";
import { requireUser } from "@/server/session";
import { createAcademicYear, setCurrentAcademicYear } from "@/server/services/academic-years";
import { assignTeacher, unassignTeacher } from "@/server/services/assignments";
import {
  addProgramManager,
  createCourseElement,
  createProgram,
  createTeachingUnit,
  removeProgramManager,
  setCourseElementArchived,
  setProgramArchived,
  setTeachingUnitArchived,
  updateCourseElement,
  updateProgram,
  updateTeachingUnit,
} from "@/server/services/catalog";
import { enrollStudent, unenrollStudent } from "@/server/services/enrollments";
import { createUser, setUserActive, setUserPassword, updateUser } from "@/server/services/users";

/**
 * Server Actions de l'espace « Gestion ». Chaque action relit l'utilisateur courant,
 * délègue à un service (qui valide les données et vérifie les droits) puis rafraîchit la page.
 */

const str = (fd: FormData, key: string) => {
  const value = fd.get(key);
  return typeof value === "string" ? value : undefined;
};
const bool = (fd: FormData, key: string) => str(fd, key) === "true";

// ─── Utilisateurs ──────────────────────────────────────────────────────────────

export async function createUserAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let userId: string | undefined;
  const result = await runAction(async () => {
    const actor = await requireUser();
    const user = await createUser(actor, {
      lastName: str(fd, "lastName"),
      firstName: str(fd, "firstName"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      password: str(fd, "password"),
      roles: fd.getAll("roles"),
    });
    userId = user.id;
  });
  if (userId) redirect(`/gestion/utilisateurs/${userId}?cree=1`);
  return result;
}

export async function updateUserAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await updateUser(actor, {
      id: str(fd, "id"),
      lastName: str(fd, "lastName"),
      firstName: str(fd, "firstName"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      roles: fd.getAll("roles"),
    });
    revalidatePath("/gestion/utilisateurs", "layout");
    return "Utilisateur enregistré.";
  });
}

export async function setUserActiveAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const active = bool(fd, "active");
    await setUserActive(actor, str(fd, "id") ?? "", active);
    revalidatePath("/gestion/utilisateurs", "layout");
    return active ? "Compte activé." : "Compte désactivé.";
  });
}

export async function setUserPasswordAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await setUserPassword(actor, str(fd, "id") ?? "", str(fd, "password"));
    return "Mot de passe modifié.";
  });
}

// ─── Années universitaires ─────────────────────────────────────────────────────

export async function createAcademicYearAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const year = await createAcademicYear(actor, {
      label: str(fd, "label"),
      startDate: str(fd, "startDate"),
      endDate: str(fd, "endDate"),
    });
    revalidatePath("/gestion/annees");
    return `Année ${year.label} créée.`;
  });
}

export async function setCurrentAcademicYearAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const year = await setCurrentAcademicYear(actor, str(fd, "id") ?? "");
    revalidatePath("/", "layout");
    return `L'année ${year.label} est désormais l'année en cours.`;
  });
}

// ─── Formations et maquette ────────────────────────────────────────────────────

export async function createProgramAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  let programId: string | undefined;
  const result = await runAction(async () => {
    const actor = await requireUser();
    const program = await createProgram(actor, { code: str(fd, "code"), title: str(fd, "title"), cycle: str(fd, "cycle") });
    programId = program.id;
  });
  if (programId) redirect(`/gestion/formations/${programId}`);
  return result;
}

export async function updateProgramAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await updateProgram(actor, { id: str(fd, "id"), code: str(fd, "code"), title: str(fd, "title") });
    revalidatePath("/gestion/formations", "layout");
    return "Formation enregistrée.";
  });
}

export async function setProgramArchivedAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const archived = bool(fd, "archived");
    await setProgramArchived(actor, str(fd, "id") ?? "", archived);
    revalidatePath("/gestion/formations", "layout");
    return archived ? "Formation archivée." : "Formation restaurée.";
  });
}

export async function addProgramManagerAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await addProgramManager(actor, { userId: str(fd, "userId"), programId: str(fd, "programId") });
    revalidatePath("/gestion/formations", "layout");
    return "Responsable ajouté.";
  });
}

export async function removeProgramManagerAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await removeProgramManager(actor, { userId: str(fd, "userId"), programId: str(fd, "programId") });
    revalidatePath("/gestion/formations", "layout");
    return "Responsable retiré.";
  });
}

export async function createTeachingUnitAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const unit = await createTeachingUnit(actor, {
      semesterId: str(fd, "semesterId"),
      code: str(fd, "code"),
      title: str(fd, "title"),
      credits: str(fd, "credits"),
    });
    revalidatePath("/gestion/formations", "layout");
    return `UE ${unit.code} ajoutée.`;
  });
}

export async function updateTeachingUnitAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await updateTeachingUnit(actor, { id: str(fd, "id"), code: str(fd, "code"), title: str(fd, "title"), credits: str(fd, "credits") });
    revalidatePath("/gestion/formations", "layout");
    return "UE enregistrée.";
  });
}

export async function setTeachingUnitArchivedAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const archived = bool(fd, "archived");
    await setTeachingUnitArchived(actor, str(fd, "id") ?? "", archived);
    revalidatePath("/gestion/formations", "layout");
    return archived ? "UE archivée." : "UE restaurée.";
  });
}

export async function createCourseElementAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const element = await createCourseElement(actor, {
      teachingUnitId: str(fd, "teachingUnitId"),
      code: str(fd, "code"),
      title: str(fd, "title"),
      credits: str(fd, "credits"),
    });
    revalidatePath("/gestion/formations", "layout");
    return `EC ${element.code} ajouté.`;
  });
}

export async function updateCourseElementAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await updateCourseElement(actor, { id: str(fd, "id"), code: str(fd, "code"), title: str(fd, "title"), credits: str(fd, "credits") });
    revalidatePath("/gestion/formations", "layout");
    return "EC enregistré.";
  });
}

export async function setCourseElementArchivedAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const archived = bool(fd, "archived");
    await setCourseElementArchived(actor, str(fd, "id") ?? "", archived);
    revalidatePath("/gestion/formations", "layout");
    return archived ? "EC archivé." : "EC restauré.";
  });
}

// ─── Affectations et inscriptions ──────────────────────────────────────────────

export async function assignTeacherAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await assignTeacher(actor, {
      teacherId: str(fd, "teacherId"),
      courseElementId: str(fd, "courseElementId"),
      academicYearId: str(fd, "academicYearId"),
    });
    revalidatePath("/gestion/formations", "layout");
    return "Enseignant affecté.";
  });
}

export async function unassignTeacherAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await unassignTeacher(actor, {
      teacherId: str(fd, "teacherId"),
      courseElementId: str(fd, "courseElementId"),
      academicYearId: str(fd, "academicYearId"),
    });
    revalidatePath("/gestion/formations", "layout");
    return "Affectation retirée.";
  });
}

export async function enrollStudentAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await enrollStudent(actor, {
      studentEmail: str(fd, "studentEmail"),
      programId: str(fd, "programId"),
      level: str(fd, "level"),
      academicYearId: str(fd, "academicYearId"),
    });
    revalidatePath("/gestion/formations", "layout");
    return "Étudiant inscrit.";
  });
}

export async function unenrollStudentAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    await unenrollStudent(actor, str(fd, "id") ?? "");
    revalidatePath("/gestion/formations", "layout");
    return "Inscription supprimée.";
  });
}
