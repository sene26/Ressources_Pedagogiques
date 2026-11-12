import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ContentFields, ResourceMetadataFields } from "@/components/resource-fields";
import { courseElementLabel } from "@/lib/course-element-label";
import { NotFoundError } from "@/lib/errors";
import { requireUser } from "@/server/session";
import { getResourceForViewer, listUploadableCourseElements } from "@/server/services/resources";
import { addVersionAction, updateResourceAction } from "../../actions";

export const metadata: Metadata = { title: "Modifier une ressource" };

/** Modification des informations et dépôt d'une nouvelle version (F10). */
export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { resource, permissions } = await getResourceForViewer(user, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  if (!permissions.edit || resource.status === "ARCHIVED") notFound();

  // Les EC actuels restent proposés même si l'auteur n'y est plus affecté cette année.
  const uploadable = await listUploadableCourseElements(user);
  const options = new Map(uploadable.map((e) => [e.id, courseElementLabel(e)]));
  for (const { courseElement } of resource.courseElements) {
    if (!options.has(courseElement.id)) options.set(courseElement.id, courseElementLabel(courseElement));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href={`/ressources/${resource.id}`} className="link">← {resource.title}</Link></p>
      <h1 className="h1">Modifier la ressource</h1>

      <section className="card">
        <h2 className="h2 mb-3">Informations</h2>
        <ActionForm action={updateResourceAction} submitLabel="Enregistrer les informations" className="space-y-4">
          <input type="hidden" name="id" value={resource.id} />
          <ResourceMetadataFields
            courseElements={[...options].map(([value, label]) => ({ id: value, label }))}
            defaults={{
              title: resource.title,
              description: resource.description,
              type: resource.type,
              keywords: resource.keywords,
              courseElementIds: resource.courseElements.map((c) => c.courseElementId),
              visibility: resource.visibility,
            }}
          />
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="h2 mb-1">Nouvelle version</h2>
        <p className="mb-3 text-sm text-slate-600">
          La version actuelle (v{resource.versions[0]?.number}) est conservée dans l&apos;historique (RG6).
        </p>
        <ActionForm action={addVersionAction} submitLabel="Déposer la nouvelle version" pendingLabel="Envoi en cours…" resetOnSuccess className="space-y-3">
          <input type="hidden" name="id" value={resource.id} />
          <ContentFields />
          <div>
            <label htmlFor="comment" className="label">Commentaire de version</label>
            <input id="comment" name="comment" required maxLength={500} placeholder="Ex. : correction de l'exercice 4" className="input" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
