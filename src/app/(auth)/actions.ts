"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import type { ActionState } from "@/lib/action-state";
import { signIn } from "@/server/auth";
import { runAction } from "@/server/run-action";
import { requestPasswordReset, resetPassword } from "@/server/services/password-reset";

/** N'accepte qu'un chemin interne comme destination après connexion (pas de redirection ouverte). */
function safeRedirect(target: FormDataEntryValue | null): string {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
    return { status: "success" };
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return { status: "error", message: "Trop de tentatives. Réessayez dans 15 minutes." };
    }
    if (error instanceof AuthError) {
      return { status: "error", message: "Adresse électronique ou mot de passe incorrect." };
    }
    throw error; // redirection en cas de succès
  }
}

export async function forgotPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requestPasswordReset(formData.get("email"));
    return "Si un compte correspond à cette adresse, un courriel contenant un lien de réinitialisation vient d'être envoyé.";
  });
}

export async function resetPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await resetPassword({
      token: formData.get("token"),
      password: formData.get("password"),
      confirmation: formData.get("confirmation"),
    });
    return "Votre mot de passe a été modifié. Vous pouvez vous connecter.";
  });
}
