import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/server/session";
import { programDashboardCsv, teacherDashboardCsv } from "@/server/services/stats";

/** Export CSV des statistiques (F26) : ?type=enseignant[&annee=] ou ?type=formation&formation=&annee=. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401 });
  const params = request.nextUrl.searchParams;
  try {
    const csv =
      params.get("type") === "formation"
        ? await programDashboardCsv(user, params.get("formation") ?? "", params.get("annee") ?? "")
        : await teacherDashboardCsv(user, params.get("annee") ?? undefined);
    const name = params.get("type") === "formation" ? "statistiques-formation.csv" : "statistiques-mes-ressources.csv";
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
