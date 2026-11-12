import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";
import { markRead } from "@/server/services/notifications";

/** Ouvre une notification : la marque comme lue puis redirige vers sa cible (lien interne uniquement). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const link = await markRead(await requireUser(), id);
  redirect(link && link.startsWith("/") && !link.startsWith("//") ? link : "/notifications");
}
