import Link from "next/link";
import type { getMyCourses } from "@/server/services/browse";
import { levelLabel } from "@/lib/academic";

type MyCourses = NonNullable<Awaited<ReturnType<typeof getMyCourses>>>;

/** « Mes cours » (F20) : les EC de l'étudiant, par semestre, avec le nombre de ressources et de nouveautés. */
export function MyCourses({ data }: { data: MyCourses }) {
  const { program, counts, level } = data;
  return (
    <section className="space-y-4" data-testid="student-section">
      <p className="text-sm text-slate-600">
        {program.title} · {levelLabel(program.cycle, level)}
      </p>
      {program.semesters.map((semester) => (
        <div key={semester.id} className="card space-y-3">
          <h2 className="h2">Semestre {semester.number}</h2>
          {semester.teachingUnits.length === 0 && <p className="text-sm text-slate-500">Aucune UE.</p>}
          {semester.teachingUnits.map((unit) => (
            <div key={unit.id}>
              <h3 className="text-sm font-medium text-slate-700">{unit.code} — {unit.title}</h3>
              <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                {unit.courseElements.map((ec) => {
                  const count = counts.get(ec.id) ?? { total: 0, recent: 0 };
                  return (
                    <li key={ec.id}>
                      <Link href={`/ec/${ec.id}`} className="block rounded-md border border-slate-200 p-3 hover:border-brand-600 hover:bg-brand-50">
                        <span className="font-medium text-slate-900">{ec.title}</span>
                        <span className="block text-sm text-slate-600">
                          {count.total} ressource{count.total > 1 ? "s" : ""}
                          {count.recent > 0 && <span className="badge ml-2 bg-brand-100 text-brand-800">{count.recent} nouvelle{count.recent > 1 ? "s" : ""}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
