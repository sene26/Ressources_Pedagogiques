import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ContentFields, PublicationFields, ResourceMetadataFields } from "@/components/resource-fields";
import { courseElementLabel } from "@/lib/course-element-label";
import { requireUser } from "@/server/session";
import { listUploadableCourseElements } from "@/server/services/resources";
import { createResourceAction } from "../actions";

export const metadata: Metadata = { title: "Déposer une ressource" };

/** Dépôt d'une ressource (F9). `?ec=` présélectionne un EC. */
export default async function NewResourcePage({ searchParams }: { searchParams: Promise<{ ec?: string }> }) {
  const user = await requireUser();
  const { ec } = await searchParams;
  const elements = await listUploadableCourseElements(user);
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/mes-ressources" className="link">← Mes ressources</Link></p>
      <h1 className="h1">Déposer une ressource</h1>
      {elements.length === 0 ? (
        <p className="card text-sm">
          Vous n&apos;êtes affecté(e) à aucun EC pour l&apos;année en cours : demandez à votre responsable de formation de vous affecter.
        </p>
      ) : (
        <section className="card">
          <ActionForm action={createResourceAction} submitLabel="Enregistrer" pendingLabel="Envoi en cours…" className="space-y-4">
            <ResourceMetadataFields
              courseElements={elements.map((e) => ({ id: e.id, label: courseElementLabel(e) }))}
              defaults={{ courseElementIds: ec ? [ec] : undefined }}
            />
            <ContentFields />
            <PublicationFields />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
