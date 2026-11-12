import { timingSafeEqual } from "node:crypto";
import { processNotifications } from "@/server/services/notifications";

/**
 * Tâche périodique (F13, F22) : notifie les publications devenues visibles (dates programmées atteintes,
 * validations) et envoie les courriels en attente. Appelée par le conteneur « cron » avec
 * l'en-tête « Authorization: Bearer <CRON_SECRET> ».
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Accès refusé.", { status: 401 });
  }
  const result = await processNotifications();
  return Response.json(result);
}
