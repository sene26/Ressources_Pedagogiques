import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { YearSelector } from "@/components/year-selector";
import { levelLabel, levelOfSemester } from "@/lib/academic";
import { CYCLE_LABELS } from "@/lib/labels";
import { NotFoundError } from "@/lib/errors";
import { canCreateProgram } from "@/server/policies/user-policy";
import { requireManagement } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { getProgramTree } from "@/server/services/catalog";
import { listActiveUsersWithRole } from "@/server/services/users";
import {
  addProgramManagerAction,
  assignTeacherAction,
  createCourseElementAction,
  createTeachingUnitAction,
  removeProgramManagerAction,
  setCourseElementArchivedAction,
  setProgramArchivedAction,
  setTeachingUnitArchivedAction,
  unassignTeacherAction,
  updateCourseElementAction,
  updateProgramAction,
  updateTeachingUnitAction,
} from "../../actions";

export const metadata: Metadata = { title: "Maquette de formation" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string }> };

/** Maquette d'une formation (F5) et affectation des enseignants aux EC (F6). */
export default async function ProgramPage({ params, searchParams }: Params) {
  const user = await requireManagement();
  const { id } = await params;
  const { annee } = await searchParams;

  const years = await listAcademicYears();
  const year = years.find((y) => y.id === annee) ?? years.find((y) => y.isCurrent) ?? years[0];

  const program = await getProgramTree(user, id, year?.id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const teachers = await listActiveUsersWithRole(user, "TEACHER");
  const isAdminUser = canCreateProgram(user);
  const managerCandidates = isAdminUser ? await listActiveUsersWithRole(user, "PROGRAM_MANAGER") : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm"><Link href="/gestion/formations" className="link">← Formations</Link></p>
          <h1 className="h1">{program.code} — {program.title}</h1>
          <p className="text-sm text-slate-600">
            {CYCLE_LABELS[program.cycle]} {program.archived && <span className="badge">Archivée</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/gestion/formations/${program.id}/inscriptions${year ? `?annee=${year.id}` : ""}`} className="btn">
            Inscriptions des étudiants
          </Link>
        </div>
      </div>

      <section className="card space-y-3">
        <details>
          <summary className="cursor-pointer font-medium">Modifier la formation</summary>
          <ActionForm action={updateProgramAction} submitLabel="Enregistrer" className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={program.id} />
            <div>
              <label className="label" htmlFor="program-code">Code</label>
              <input id="program-code" name="code" defaultValue={program.code} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="program-title">Intitulé</label>
              <input id="program-title" name="title" defaultValue={program.title} required className="input" />
            </div>
          </ActionForm>
        </details>
        {isAdminUser && (
          <ActionForm
            action={setProgramArchivedAction}
            submitLabel={program.archived ? "Restaurer la formation" : "Archiver la formation"}
            submitClassName={program.archived ? "btn btn-sm" : "btn btn-sm btn-danger"}
            confirmMessage={program.archived ? undefined : "Archiver cette formation ?"}
          >
            <input type="hidden" name="id" value={program.id} />
            <input type="hidden" name="archived" value={String(!program.archived)} />
          </ActionForm>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-2">Responsable(s) de formation</h2>
        {program.managers.length === 0 && <p className="text-sm">Aucun responsable désigné.</p>}
        <ul className="space-y-1">
          {program.managers.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{m.user.firstName} {m.user.lastName}</span>
              {isAdminUser && (
                <ActionForm action={removeProgramManagerAction} submitLabel="Retirer" submitClassName="btn btn-sm btn-danger" className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={m.userId} />
                  <input type="hidden" name="programId" value={program.id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
        {isAdminUser && (
          <ActionForm action={addProgramManagerAction} submitLabel="Ajouter" submitClassName="btn btn-sm" className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="programId" value={program.id} />
            <div>
              <label className="label" htmlFor="manager">Ajouter un responsable</label>
              <select id="manager" name="userId" required className="input">
                <option value="">— choisir —</option>
                {managerCandidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.lastName} {u.firstName} ({u.email})</option>
                ))}
              </select>
            </div>
          </ActionForm>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="h2">Maquette et affectations</h2>
          <YearSelector years={years} selectedId={year?.id} />
        </div>
        {!year && <p className="card text-sm">Créez une année universitaire pour pouvoir affecter des enseignants.</p>}

        {program.semesters.map((semester) => (
          <div key={semester.id} className="card space-y-3" data-testid={`semester-${semester.number}`}>
            <h3 className="font-semibold">
              Semestre {semester.number}{" "}
              <span className="text-sm font-normal text-slate-600">({levelLabel(program.cycle, levelOfSemester(semester.number))})</span>
            </h3>

            {semester.teachingUnits.map((unit) => (
              <div key={unit.id} className={`rounded-md border border-slate-200 p-3 ${unit.archived ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {unit.code} — {unit.title} <span className="text-sm text-slate-600">· {unit.credits} crédits</span>{" "}
                    {unit.archived && <span className="badge">Archivée</span>}
                  </p>
                  <ActionForm
                    action={setTeachingUnitArchivedAction}
                    submitLabel={unit.archived ? "Restaurer" : "Archiver"}
                    submitClassName="btn btn-sm"
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={unit.id} />
                    <input type="hidden" name="archived" value={String(!unit.archived)} />
                  </ActionForm>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-sm text-brand-700">Modifier l&apos;UE</summary>
                  <ActionForm action={updateTeachingUnitAction} submitLabel="Enregistrer" submitClassName="btn btn-sm btn-primary" className="mt-2 grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="id" value={unit.id} />
                    <CodeTitleCredits prefix={`ue-${unit.id}`} code={unit.code} title={unit.title} credits={unit.credits} />
                  </ActionForm>
                </details>

                <ul className="mt-2 space-y-2">
                  {unit.courseElements.map((element) => (
                    <li key={element.id} className={`rounded bg-slate-50 p-2 ${element.archived ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {element.code} — {element.title} <span className="text-slate-600">· {element.credits} cr.</span>{" "}
                          {element.archived && <span className="badge">Archivé</span>}
                        </p>
                        <ActionForm
                          action={setCourseElementArchivedAction}
                          submitLabel={element.archived ? "Restaurer" : "Archiver"}
                          submitClassName="btn btn-sm"
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={element.id} />
                          <input type="hidden" name="archived" value={String(!element.archived)} />
                        </ActionForm>
                      </div>
                      <details>
                        <summary className="cursor-pointer text-xs text-brand-700">Modifier l&apos;EC</summary>
                        <ActionForm action={updateCourseElementAction} submitLabel="Enregistrer" submitClassName="btn btn-sm btn-primary" className="mt-2 grid gap-2 sm:grid-cols-4">
                          <input type="hidden" name="id" value={element.id} />
                          <CodeTitleCredits prefix={`ec-${element.id}`} code={element.code} title={element.title} credits={element.credits} />
                        </ActionForm>
                      </details>

                      {year && (
                        <div className="mt-2 text-sm" data-testid={`assignments-${element.code}`}>
                          <span className="text-slate-600">Enseignant(s) {year.label} : </span>
                          {element.teachingAssignments.length === 0 && <span className="text-slate-500">aucun</span>}
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {element.teachingAssignments.map((a) => (
                              <li key={a.teacherId} className="flex items-center gap-1">
                                <span className="badge">{a.teacher.firstName} {a.teacher.lastName}</span>
                                <ActionForm action={unassignTeacherAction} submitLabel="Retirer" submitClassName="btn btn-sm" className="flex items-center gap-1">
                                  <input type="hidden" name="teacherId" value={a.teacherId} />
                                  <input type="hidden" name="courseElementId" value={element.id} />
                                  <input type="hidden" name="academicYearId" value={year.id} />
                                </ActionForm>
                              </li>
                            ))}
                          </ul>
                          {!element.archived && !unit.archived && (
                            <ActionForm action={assignTeacherAction} submitLabel="Affecter" submitClassName="btn btn-sm" className="mt-2 flex flex-wrap items-center gap-2">
                              <input type="hidden" name="courseElementId" value={element.id} />
                              <input type="hidden" name="academicYearId" value={year.id} />
                              <label className="sr-only" htmlFor={`teacher-${element.id}`}>Enseignant à affecter à {element.title}</label>
                              <select id={`teacher-${element.id}`} name="teacherId" required className="input w-auto py-1 text-sm">
                                <option value="">— enseignant —</option>
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
                                ))}
                              </select>
                            </ActionForm>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {!unit.archived && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-brand-700">+ Ajouter un EC</summary>
                    <ActionForm action={createCourseElementAction} submitLabel="Ajouter l'EC" submitClassName="btn btn-sm btn-primary" resetOnSuccess className="mt-2 grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="teachingUnitId" value={unit.id} />
                      <CodeTitleCredits prefix={`new-ec-${unit.id}`} />
                    </ActionForm>
                  </details>
                )}
              </div>
            ))}

            {!program.archived && (
              <details>
                <summary className="cursor-pointer text-sm text-brand-700">+ Ajouter une UE au semestre {semester.number}</summary>
                <ActionForm action={createTeachingUnitAction} submitLabel="Ajouter l'UE" submitClassName="btn btn-sm btn-primary" resetOnSuccess className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input type="hidden" name="semesterId" value={semester.id} />
                  <CodeTitleCredits prefix={`new-ue-${semester.id}`} />
                </ActionForm>
              </details>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

/** Champs communs aux UE et EC : code, intitulé, crédits. */
function CodeTitleCredits({ prefix, code, title, credits }: { prefix: string; code?: string; title?: string; credits?: number }) {
  return (
    <>
      <div>
        <label className="label" htmlFor={`${prefix}-code`}>Code</label>
        <input id={`${prefix}-code`} name="code" defaultValue={code} required className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${prefix}-title`}>Intitulé</label>
        <input id={`${prefix}-title`} name="title" defaultValue={title} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-credits`}>Crédits</label>
        <input id={`${prefix}-credits`} name="credits" type="number" min={0} max={60} defaultValue={credits ?? 3} required className="input" />
      </div>
    </>
  );
}
