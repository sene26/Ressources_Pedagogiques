import type { Metadata } from "next";
import Link from "next/link";
import { levelLabel, levelOfSemester } from "@/lib/academic";
import { ROLE_LABELS } from "@/lib/labels";
import { canAccessManagement, hasRole } from "@/server/policies/user-policy";
import type { CurrentUser } from "@/server/current-user";
import { requireUser } from "@/server/session";
import { getCurrentAcademicYear } from "@/server/services/academic-years";
import { listTeacherCourseElements } from "@/server/services/assignments";
import { getMyCourses } from "@/server/services/browse";
import { MyCourses } from "@/components/my-courses";

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

      {year && hasRole(user, "STUDENT") && <StudentSection user={user} yearLabel={year.label} />}
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

async function StudentSection({ user, yearLabel }: { user: CurrentUser; yearLabel: string }) {
  const data = await getMyCourses(user);
  if (!data) {
    return (
      <section className="card" data-testid="student-section">
        <h2 className="h2 mb-2">Mes cours</h2>
        <p className="text-sm">
          Vous n&apos;êtes inscrit(e) dans aucune formation pour l&apos;année {yearLabel}. Contactez la scolarité.
        </p>
      </section>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="h2">Mes cours</h2>
      <MyCourses data={data} />
    </div>
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
                <Link href={`/ec/${element.id}`} className="link font-medium">{element.title}</Link>
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
