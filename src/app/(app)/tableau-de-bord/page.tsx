import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RESOURCE_TYPE_LABELS, statusLabel } from "@/lib/labels";
import { isTeacher } from "@/server/policies/resource-policy";
import { canAccessManagement } from "@/server/policies/user-policy";
import { requireUser } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { listManageablePrograms } from "@/server/services/catalog";
import { RECENT_DAYS, programDashboard, teacherDashboard } from "@/server/services/stats";

export const metadata: Metadata = { title: "Tableau de bord" };

type Search = { annee?: string; formation?: string };

/** Tableaux de bord enseignant (F23) et responsable (F24), avec export CSV (F26). Chiffres agrégés uniquement (A12). */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const teacher = isTeacher(user);
  const manager = canAccessManagement(user);
  if (!teacher && !manager) redirect("/");
  const s = await searchParams;
  const years = await listAcademicYears();
  const year = years.find((y) => y.id === s.annee) ?? years.find((y) => y.isCurrent) ?? years[0];
  const programs = manager ? await listManageablePrograms(user) : [];
  const program = programs.find((p) => p.id === s.formation) ?? programs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">Tableau de bord</h1>
        <form method="get" className="flex flex-wrap items-end gap-2">
          {programs.length > 0 && (
            <div>
              <label htmlFor="formation" className="label">Formation</label>
              <select id="formation" name="formation" defaultValue={program?.id} className="input py-1">
                {programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="annee" className="label">Année</label>
            <select id="annee" name="annee" defaultValue={year?.id} className="input py-1">
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-sm">Afficher</button>
        </form>
      </div>
      {program && year && <ProgramSection programId={program.id} programTitle={program.title} yearId={year.id} />}
      {teacher && <TeacherSection yearId={year?.id} />}
    </div>
  );
}

async function ProgramSection({ programId, programTitle, yearId }: { programId: string; programTitle: string; yearId: string }) {
  const user = await requireUser();
  const data = await programDashboard(user, programId, yearId);
  return (
    <section className="space-y-4" data-testid="program-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Formation : {programTitle}</h2>
        <a href={`/api/export/stats?type=formation&formation=${programId}&annee=${yearId}`} className="btn btn-sm">Exporter (CSV)</a>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Kpi label="ressources publiées" value={data.totals.publishedResources} />
        <Kpi label="EC sans ressource" value={`${data.withoutResource.length}/${data.totals.courseElements}`} />
        <Kpi label={`consultations (${RECENT_DAYS} j)`} value={data.totals.recentAccesses} />
      </dl>
      <div className="card">
        <h3 className="mb-2 font-semibold">EC sans ressource publiée pour les étudiants</h3>
        {data.withoutResource.length === 0 ? (
          <p className="text-sm">Tous les EC ont au moins une ressource publiée.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm" data-testid="ec-without-resource">
            {data.withoutResource.map((e) => (
              <li key={e.id}><Link href={`/ec/${e.id}`} className="link">{e.title}</Link> <span className="text-slate-500">(S{e.teachingUnit.semester.number})</span></li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold">Les plus consultées ({RECENT_DAYS} derniers jours)</h3>
        {data.mostConsulted.length === 0 ? (
          <p className="text-sm">Aucune consultation sur la période.</p>
        ) : (
          <ol className="list-decimal pl-5 text-sm" data-testid="most-consulted">
            {data.mostConsulted.map((r) => (
              <li key={r.id}>
                <Link href={`/ressources/${r.id}`} className="link">{r.title}</Link> — {r.accesses} consultation(s) et téléchargement(s)
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="card overflow-x-auto">
        <h3 className="mb-2 font-semibold">Ressources par EC</h3>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-slate-600"><th className="py-1 pr-2">EC</th><th className="py-1 pr-2 text-right">Toutes</th><th className="py-1 text-right">Publiées</th></tr></thead>
          <tbody>
            {data.byCourseElement.map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="py-1 pr-2">S{e.teachingUnit.semester.number} · {e.title}</td>
                <td className="py-1 pr-2 text-right">{e.total}</td>
                <td className="py-1 text-right">{e.published}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function TeacherSection({ yearId }: { yearId?: string }) {
  const user = await requireUser();
  const data = await teacherDashboard(user, yearId);
  return (
    <section className="space-y-4" data-testid="teacher-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Mes ressources</h2>
        <a href={`/api/export/stats?type=enseignant${yearId ? `&annee=${yearId}` : ""}`} className="btn btn-sm">Exporter (CSV)</a>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Kpi label="ressources" value={data.totals.resources} />
        <Kpi label="consultations" value={data.totals.views} />
        <Kpi label="téléchargements" value={data.totals.downloads} />
      </dl>
      <div className="card overflow-x-auto">
        {data.rows.length === 0 ? (
          <p className="text-sm">Aucune ressource pour cette année.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="py-1 pr-2">Ressource</th>
                <th className="py-1 pr-2 text-right">Vues</th>
                <th className="py-1 pr-2 text-right">Téléch.</th>
                <th className="py-1 text-right">{RECENT_DAYS} j</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-1 pr-2">
                    <Link href={`/ressources/${r.id}`} className="link">{r.title}</Link>
                    <span className="block text-xs text-slate-500">{RESOURCE_TYPE_LABELS[r.type]} · {statusLabel(r)}</span>
                  </td>
                  <td className="py-1 pr-2 text-right">{r.views}</td>
                  <td className="py-1 pr-2 text-right">{r.downloads}</td>
                  <td className="py-1 text-right">{r.recentViews + r.recentDownloads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-3">
      <dd className="text-2xl font-bold text-brand-800">{value}</dd>
      <dt className="text-xs text-slate-600">{label}</dt>
    </div>
  );
}
