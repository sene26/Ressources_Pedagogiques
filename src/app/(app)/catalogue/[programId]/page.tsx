import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { levelLabel, levelOfSemester } from "@/lib/academic";
import { NotFoundError } from "@/lib/errors";
import { requireUser } from "@/server/session";
import { getProgramBrowse } from "@/server/services/browse";

export const metadata: Metadata = { title: "Formation" };

/** Navigation (F17) : semestres › UE › EC d'une formation, avec le nombre de ressources visibles. */
export default async function ProgramBrowsePage({ params }: { params: Promise<{ programId: string }> }) {
  const user = await requireUser();
  const { programId } = await params;
  const { program, counts } = await getProgramBrowse(user, programId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/catalogue" className="link">← Catalogue</Link></p>
      <h1 className="h1">{program.title}</h1>
      {program.semesters.map((semester) => (
        <section key={semester.id} className="card space-y-2">
          <h2 className="h2">
            Semestre {semester.number} <span className="text-sm font-normal text-slate-600">({levelLabel(program.cycle, levelOfSemester(semester.number))})</span>
          </h2>
          {semester.teachingUnits.length === 0 && <p className="text-sm text-slate-500">Aucune UE.</p>}
          {semester.teachingUnits.map((unit) => (
            <div key={unit.id}>
              <h3 className="text-sm font-medium text-slate-700">{unit.code} — {unit.title}</h3>
              <ul className="ml-4 list-disc text-sm">
                {unit.courseElements.map((ec) => (
                  <li key={ec.id}>
                    <Link href={`/ec/${ec.id}`} className="link">{ec.title}</Link>{" "}
                    <span className="text-slate-500">({counts.get(ec.id)?.total ?? 0})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
