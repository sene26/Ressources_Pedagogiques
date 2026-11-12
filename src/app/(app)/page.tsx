import type { Metadata } from "next";
import Link from "next/link";
import { levelLabel, levelOfSemester } from "@/lib/academic";
import { ROLE_LABELS } from "@/lib/labels";
import { canAccessManagement, hasRole } from "@/server/policies/user-policy";
import { requireUser } from "@/server/session";
import { getCurrentAcademicYear } from "@/server/services/academic-years";
import { listTeacherCourseElements } from "@/server/services/assignments";
import { getStudentCurriculum } from "@/server/services/enrollments";

export const metadata: Metadata = { title: "Accueil" };

/**
 * Page d'accueil : son contenu dépend des rôles de l'utilisateur.
 * Les ressources elles-mêmes arriveront aux lots 2 et 3 ; ce lot affiche l'organisation pédagogique.
 */
export default async function HomePage() {
  const user = await requireUser();
  const year = await getCurrentAcademicYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Bonjour {user.firstName}</h1>
        <p className="text-sm text-slate-600">
          {user.roles.map((r) => ROLE_LABELS[r]).join(" · ")}
          {year && <> — année universitaire {year.label}</>}
        </p>
      </div>

      {!year && (
        <p className="card text-sm" role="status">
          Aucune année universitaire n&apos;est définie comme « en cours ». Contactez l&apos;administrateur.
        </p>
      )}

      {year && hasRole(user, "STUDENT") && <StudentSection userId={user.id} yearId={year.id} yearLabel={year.label} />}
      {year && hasRole(user, "TEACHER") && <TeacherSection userId={user.id} yearId={year.id} />}

      {canAccessManagement(user) && (
        <section className="card">
          <h2 className="h2 mb-2">Gestion</h2>
          <Link href="/gestion/formations" className="link">Gérer les formations, les affectations et les inscriptions →</Link>
        </section>
      )}
    </div>
  );
}

async function StudentSection({ userId, yearId, yearLabel }: { userId: string; yearId: string; yearLabel: string }) {
  const curriculum = await getStudentCurriculum(userId, yearId);
  if (!curriculum) {
    return (
      <section className="card" data-testid="student-section">
        <h2 className="h2 mb-2">Mes cours</h2>
        <p className="text-sm">
          Vous n&apos;êtes inscrit(e) dans aucune formation pour l&apos;année {yearLabel}. Contactez la scolarité.
        </p>
      </section>
    );
  }
  const { enrollment, semesters } = curriculum;
  return (
    <section className="card space-y-4" data-testid="student-section">
      <div>
        <h2 className="h2">Mes cours</h2>
        <p className="text-sm text-slate-600">
          {enrollment.program.title} · {levelLabel(enrollment.program.cycle, enrollment.level)}
        </p>
      </div>
      {semesters.map((semester) => (
        <div key={semester.id}>
          <h3 className="font-semibold">Semestre {semester.number}</h3>
          {semester.teachingUnits.length === 0 && <p className="text-sm text-slate-500">Aucune UE.</p>}
          <ul className="mt-1 space-y-2">
            {semester.teachingUnits.map((unit) => (
              <li key={unit.id}>
                <p className="text-sm font-medium text-slate-700">{unit.code} — {unit.title}</p>
                <ul className="ml-4 list-disc text-sm">
                  {unit.courseElements.map((element) => (
                    <li key={element.id}>{element.title}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

async function TeacherSection({ userId, yearId }: { userId: string; yearId: string }) {
  const elements = await listTeacherCourseElements(userId, yearId);
  return (
    <section className="card" data-testid="teacher-section">
      <h2 className="h2 mb-2">Mes enseignements</h2>
      {elements.length === 0 ? (
        <p className="text-sm">Vous n&apos;êtes affecté(e) à aucun EC pour l&apos;année en cours.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {elements.map((element) => {
            const semester = element.teachingUnit.semester;
            return (
              <li key={element.id} className="py-2">
                <p className="font-medium">{element.title}</p>
                <p className="text-sm text-slate-600">
                  {semester.program.title} · {levelLabel(semester.program.cycle, levelOfSemester(semester.number))} · S{semester.number} · {element.teachingUnit.title}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
