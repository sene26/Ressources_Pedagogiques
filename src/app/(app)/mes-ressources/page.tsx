import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { ResourceBadges } from "@/components/resource-badges";
import { YearSelector } from "@/components/year-selector";
import { FORMAT_LABELS } from "@/lib/file-types";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { requireUser } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { listMyResources, type MyResourcesTab } from "@/server/services/resources";

export const metadata: Metadata = { title: "Mes ressources" };

const TABS: { id: MyResourcesTab; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "draft", label: "Brouillons" },
  { id: "published", label: "Publiées" },
  { id: "scheduled", label: "Programmées" },
  { id: "pending", label: "Validation" },
  { id: "archived", label: "Archivées" },
];

type Search = { onglet?: string; annee?: string; page?: string; supprimee?: string };

export default async function MyResourcesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { onglet, annee, page, supprimee } = await searchParams;
  const tab = TABS.find((t) => t.id === onglet)?.id ?? "all";
  const years = await listAcademicYears();
  const year = years.find((y) => y.id === annee) ?? years.find((y) => y.isCurrent) ?? years[0];
  const result = await listMyResources(user, { tab, academicYearId: year?.id, page: Number(page) || 1 });

  const href = (params: { onglet?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (year) q.set("annee", year.id);
    q.set("onglet", params.onglet ?? tab);
    if (params.page) q.set("page", String(params.page));
    return `/mes-ressources?${q}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Mes ressources</h1>
        <Link href="/ressources/nouvelle" className="btn btn-primary">+ Déposer</Link>
      </div>
      {supprimee && <p role="status" className="text-sm text-brand-700">Brouillon supprimé.</p>}
      <YearSelector years={years} selectedId={year?.id} />
      <nav aria-label="Filtrer par état" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.id} href={href({ onglet: t.id })} aria-current={t.id === tab ? "page" : undefined} className={`btn btn-sm ${t.id === tab ? "btn-primary" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <section className="card">
        {result.resources.length === 0 ? (
          <p className="text-sm">Aucune ressource.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="my-resources">
            {result.resources.map((r) => {
              const version = r.versions[0];
              return (
                <li key={r.id} className="py-3">
                  <Link href={`/ressources/${r.id}`} className="link font-medium">{r.title}</Link>
                  <p className="text-sm text-slate-600">
                    {RESOURCE_TYPE_LABELS[r.type]} · {r.courseElements.map((c) => c.courseElement.title).join(", ")}
                    {version && <> · {FORMAT_LABELS[version.format] ?? version.format} · v{version.number}</>}
                  </p>
                  <ResourceBadges resource={r} />
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={result.page} pageCount={result.pageCount} href={(p) => href({ page: p })} />
      </section>
    </div>
  );
}
