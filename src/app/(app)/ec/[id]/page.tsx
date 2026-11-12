import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ResourceType } from "@prisma/client";
import { Pagination } from "@/components/pagination";
import { ResourceList } from "@/components/resource-list";
import { levelLabel, levelOfSemester } from "@/lib/academic";
import { NotFoundError } from "@/lib/errors";
import { FORMAT_LABELS } from "@/lib/file-types";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { isTeacher } from "@/server/policies/resource-policy";
import { requireUser } from "@/server/session";
import { getCourseElementPage } from "@/server/services/browse";
import { isFollowing } from "@/server/services/subscriptions";
import { ToggleButton } from "@/components/toggle-button";
import { setFollowingAction } from "../../engagement-actions";

export const metadata: Metadata = { title: "EC" };

type Search = { type?: string; format?: string; page?: string };

/** Page d'un EC : ses ressources visibles, filtrables par type et format (F17, F19). */
export default async function CourseElementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { id } = await params;
  const search = await searchParams;
  const type = RESOURCE_TYPES.includes(search.type as ResourceType) ? (search.type as ResourceType) : undefined;
  const format = search.format && FORMAT_LABELS[search.format] ? search.format : undefined;
  const data = await getCourseElementPage(user, id, { type, format, page: Number(search.page) || 1 }).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const { element } = data;
  const following = await isFollowing(user.id, element.id);
  const semester = element.teachingUnit.semester;
  const href = (page: number) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (format) q.set("format", format);
    q.set("page", String(page));
    return `/ec/${id}?${q}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          {semester.program.code} · {levelLabel(semester.program.cycle, levelOfSemester(semester.number))} · S{semester.number} · {element.teachingUnit.title}
        </p>
        <h1 className="h1">{element.title}</h1>
        {data.teachers.length > 0 && (
          <p className="text-sm text-slate-600">Enseignant(s) : {data.teachers.map((t) => `${t.firstName} ${t.lastName}`).join(", ")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {data.canUpload && <Link href={`/ressources/nouvelle?ec=${element.id}`} className="btn btn-primary">+ Déposer dans cet EC</Link>}
        <ToggleButton action={setFollowingAction} id={element.id} field="follow" active={following} activeLabel="🔔 Ne plus suivre cet EC" inactiveLabel="🔕 Suivre cet EC" />
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="type" className="label">Type</label>
          <select id="type" name="type" defaultValue={type ?? ""} className="input py-1">
            <option value="">Tous</option>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="format" className="label">Format</label>
          <select id="format" name="format" defaultValue={format ?? ""} className="input py-1">
            <option value="">Tous</option>
            {Object.entries(FORMAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-sm">Filtrer</button>
      </form>
      <section className="card">
        <p className="mb-2 text-sm text-slate-600">{data.total} ressource(s)</p>
        <ResourceList resources={data.resources} showBadges={isTeacher(user)} />
        <Pagination page={data.page} pageCount={data.pageCount} href={href} />
      </section>
    </div>
  );
}
