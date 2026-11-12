import type { Metadata } from "next";
import type { ResourceType } from "@prisma/client";
import { Pagination } from "@/components/pagination";
import { ResourceList } from "@/components/resource-list";
import { FORMAT_LABELS } from "@/lib/file-types";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { isTeacher } from "@/server/policies/resource-policy";
import { requireUser } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { listVisibleAuthors, searchResources } from "@/server/services/search";

export const metadata: Metadata = { title: "Rechercher" };

type Search = { q?: string; type?: string; enseignant?: string; annee?: string; format?: string; page?: string };

/**
 * Recherche (F18) et filtres (F19). Formulaire GET : fonctionne sans JavaScript et l'adresse
 * de la page peut être partagée.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const s = await searchParams;
  const type = RESOURCE_TYPES.includes(s.type as ResourceType) ? (s.type as ResourceType) : undefined;
  const format = s.format && FORMAT_LABELS[s.format] ? s.format : undefined;
  const teacherView = isTeacher(user);
  const [years, authors] = await Promise.all([teacherView ? listAcademicYears() : Promise.resolve([]), listVisibleAuthors(user)]);
  const authorId = authors.some((a) => a.id === s.enseignant) ? s.enseignant : undefined;
  const academicYearId = years.some((y) => y.id === s.annee) ? s.annee : undefined;
  const hasCriteria = Boolean(s.q?.trim() || type || format || authorId || academicYearId);
  const result = hasCriteria
    ? await searchResources(user, { q: s.q, type, authorId, academicYearId, format, page: Number(s.page) || 1 })
    : null;

  const href = (page: number) => {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: s.q, type, enseignant: authorId, annee: academicYearId, format })) if (value) q.set(key, value);
    q.set("page", String(page));
    return `/recherche?${q}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="h1">Rechercher une ressource</h1>
      <form method="get" role="search" className="card space-y-3">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">Mots recherchés</label>
          <input id="q" name="q" type="search" defaultValue={s.q} placeholder="ex. simplexe dualité" className="input" />
          <button type="submit" className="btn btn-primary">Rechercher</button>
        </div>
        <details open={Boolean(type || format || authorId || academicYearId)}>
          <summary className="cursor-pointer text-sm text-brand-700">Filtres</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="type" className="label">Type</label>
              <select id="type" name="type" defaultValue={type ?? ""} className="input">
                <option value="">Tous</option>
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="format" className="label">Format</label>
              <select id="format" name="format" defaultValue={format ?? ""} className="input">
                <option value="">Tous</option>
                {Object.entries(FORMAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="enseignant" className="label">Enseignant</label>
              <select id="enseignant" name="enseignant" defaultValue={authorId ?? ""} className="input">
                <option value="">Tous</option>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.lastName} {a.firstName}</option>)}
              </select>
            </div>
            {teacherView && (
              <div>
                <label htmlFor="annee" className="label">Année universitaire</label>
                <select id="annee" name="annee" defaultValue={academicYearId ?? ""} className="input">
                  <option value="">Toutes</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </details>
      </form>
      {result && (
        <section className="card">
          <p className="mb-2 text-sm text-slate-600" role="status">{result.total} résultat{result.total > 1 ? "s" : ""}</p>
          <ResourceList resources={result.resources} showBadges={teacherView} showCourseElements />
          <Pagination page={result.page} pageCount={result.pageCount} href={href} />
        </section>
      )}
    </div>
  );
}
