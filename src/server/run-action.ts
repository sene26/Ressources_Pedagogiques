import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";

/**
 * Exécute le corps d'une Server Action et convertit le résultat en ActionState :
 * - erreur métier (AppError) → son message, en français ;
 * - redirection Next.js → relancée telle quelle ;
 * - toute autre erreur → journalisée, avec un message générique (aucun détail technique n'est exposé).
 */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { status: "success", message: message ?? "Enregistré." };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) return { status: "error", message: error.message };
    console.error(error);
    return { status: "error", message: "Une erreur inattendue s'est produite. Réessayez plus tard." };
  }
}
