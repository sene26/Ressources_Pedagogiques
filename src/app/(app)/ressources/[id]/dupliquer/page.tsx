import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { YearSelector } from "@/components/year-selector";
import { courseElementLabel } from "@/lib/course-element-label";
import { NotFoundError } from "@/lib/errors";
import { isTeacher } from "@/server/policies/resource-policy";
import { requireUser } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { getResourceForViewer, listUploadableCourseElementsForYear } from "@/server/services/resources";
import { duplicateResourceAction } from "../../../pilotage-actions";

export const metadata: Metadata = { title: "Dupliquer une ressource" };

/** Duplication vers d'autres EC ou une autre année (F15). */
export default async function DuplicatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string }> }) {
  const user = await requireUser();
  if (!isTeacher(user)) notFound();
  const { id } = await params;
  const { annee } = await searchParams;
  const { resource } = await getResourceForViewer(user, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const years = await listAcademicYears();
  const year = years.find((y) => y.id === annee) ?? years.find((y) => y.isCurrent) ?? years[0];
  const elements = year ? await listUploadableCourseElementsForYear(user, year.id) : [];
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href={`/ressources/${resource.id}`} className="link">← {resource.title}</Link></p>
      <h1 className="h1">Dupliquer la ressource</h1>
      <p className="text-sm text-slate-600">La copie est créée en brouillon, à votre nom, avec la version en vigueur du document.</p>
      <YearSelector years={years} selectedId={year?.id} />
      <section className="card">
        {elements.length === 0 ? (
          <p className="text-sm">Vous n&apos;êtes affecté(e) à aucun EC pour l&apos;année {year?.label}.</p>
        ) : (
          <ActionForm action={duplicateResourceAction} submitLabel="Dupliquer" className="space-y-3">
            <input type="hidden" name="id" value={resource.id} />
            <input type="hidden" name="academicYearId" value={year!.id} />
            <fieldset>
              <legend className="label">EC cibles pour {year!.label}</legend>
              <div className="space-y-1">
                {elements.map((e) => (
                  <label key={e.id} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="courseElementIds" value={e.id} className="mt-1" />
                    {courseElementLabel(e)}
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
