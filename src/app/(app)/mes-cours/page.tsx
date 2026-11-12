import type { Metadata } from "next";
import { MyCourses } from "@/components/my-courses";
import { requireUser } from "@/server/session";
import { getMyCourses } from "@/server/services/browse";

export const metadata: Metadata = { title: "Mes cours" };

export default async function MyCoursesPage() {
  const user = await requireUser();
  const data = await getMyCourses(user);
  return (
    <div className="space-y-4">
      <h1 className="h1">Mes cours</h1>
      {data ? <MyCourses data={data} /> : <p className="card text-sm">Vous n&apos;êtes inscrit(e) dans aucune formation pour l&apos;année en cours. Contactez la scolarité.</p>}
    </div>
  );
}
