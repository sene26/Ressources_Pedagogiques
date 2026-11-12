import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { YearSelector } from "@/components/year-selector";
import { levelCount, levelLabel } from "@/lib/academic";
import { canManageProgram } from "@/server/policies/user-policy";
import { db } from "@/server/db";
import { requireManagement } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { listEnrollments } from "@/server/services/enrollments";
import { enrollStudentAction, unenrollStudentAction } from "../../../actions";

export const metadata: Metadata = { title: "Inscriptions" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string }> };

/** Inscriptions des étudiants d'une formation pour une année (F7). */
export default async function EnrollmentsPage({ params, searchParams }: Params) {
  const user = await requireManagement();
  const { id } = await params;
  const { annee } = await searchParams;
  if (!canManageProgram(user, id)) notFound();
  const program = await db.program.findUnique({ where: { id } });
  if (!program) notFound();

  const years = await listAcademicYears();
  const year = years.find((y) => y.id === annee) ?? years.find((y) => y.isCurrent) ?? years[0];
  const enrollments = year ? await listEnrollments(user, program.id, year.id) : [];
  const levels = Array.from({ length: levelCount(program.cycle) }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm"><Link href={`/gestion/formations/${program.id}`} className="link">← {program.code}</Link></p>
        <h1 className="h1">Inscriptions — {program.title}</h1>
      </div>
      <YearSelector years={years} selectedId={year?.id} />
      {!year ? (
        <p className="card text-sm">Aucune année universitaire n&apos;est définie.</p>
      ) : (
        <>
          <section className="card">
            <h2 className="h2 mb-3">Inscrire un étudiant pour {year.label}</h2>
            <p className="mb-3 text-sm text-slate-600">Le compte de l&apos;étudiant doit déjà exister, avec le rôle « Étudiant ».</p>
            <ActionForm action={enrollStudentAction} submitLabel="Inscrire" resetOnSuccess className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="programId" value={program.id} />
              <input type="hidden" name="academicYearId" value={year.id} />
              <div className="sm:col-span-2">
                <label htmlFor="studentEmail" className="label">Adresse électronique de l&apos;étudiant</label>
                <input id="studentEmail" name="studentEmail" type="email" required className="input" />
              </div>
              <div>
                <label htmlFor="level" className="label">Niveau</label>
                <select id="level" name="level" required className="input">
                  {levels.map((level) => (
                    <option key={level} value={level}>{levelLabel(program.cycle, level)}</option>
                  ))}
                </select>
              </div>
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="h2 mb-3">Étudiants inscrits ({enrollments.length})</h2>
            {enrollments.length === 0 ? (
              <p className="text-sm">Aucun étudiant inscrit pour cette année.</p>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="enrollment-list">
                {enrollments.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{e.student.lastName} {e.student.firstName}</span>{" "}
                      <span className="text-slate-600">{e.student.email}</span>{" "}
                      <span className="badge">{levelLabel(program.cycle, e.level)}</span>
                      {!e.student.active && <span className="badge ml-1">Compte désactivé</span>}
                    </span>
                    <ActionForm
                      action={unenrollStudentAction}
                      submitLabel="Désinscrire"
                      submitClassName="btn btn-sm btn-danger"
                      className="flex items-center gap-2"
                      confirmMessage={`Désinscrire ${e.student.firstName} ${e.student.lastName} ?`}
                    >
                      <input type="hidden" name="id" value={e.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
