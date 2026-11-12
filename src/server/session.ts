import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { loadCurrentUser, type CurrentUser } from "./current-user";
import { canAccessManagement, canManageUsers } from "./policies/user-policy";

/** Utilisateur connecté (relu en base une seule fois par requête), ou null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? loadCurrentUser(userId) : null;
});

/** Utilisateur connecté ; sinon redirection vers la page de connexion. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/** Accès à l'espace de gestion (administrateur ou responsable de formation). */
export async function requireManagement(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccessManagement(user)) redirect("/");
  return user;
}

/** Accès réservé à l'administrateur. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/");
  return user;
}
