import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Preview } from "@/components/preview";
import { PublicationFields } from "@/components/resource-fields";
import { ResourceBadges } from "@/components/resource-badges";
import { levelLabel, levelOfSemester } from "@/lib/academic";
import { formatDateTime } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { FORMAT_LABELS, formatSize } from "@/lib/file-types";
import { RESOURCE_TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/labels";
import { previewFor } from "@/lib/preview";
import { issueFileToken } from "@/server/file-tokens";
import { requireUser } from "@/server/session";
import { recordAccess } from "@/server/services/access-log";
import { getResourceForViewer } from "@/server/services/resources";
import {
  archiveResourceAction,
  deleteResourceAction,
  hardDeleteResourceAction,
  publishResourceAction,
  restoreResourceAction,
  unpublishResourceAction,
} from "../actions";

export const metadata: Metadata = { title: "Ressource" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ depose?: string; info?: string }> };

/** Messages de confirmation après un changement de statut (voir statusAction). */
const INFO_MESSAGES: Record<string, string> = {
  publiee: "Ressource publiée.",
  programmee: "Publication programmée.",
  "en-attente": "Publication enregistrée : en attente de validation par le responsable de formation.",
  depubliee: "Ressource remise en brouillon.",
  archivee: "Ressource archivée.",
  "archivee-rg9": "Cette ressource a déjà été publiée : elle a été archivée et non supprimée (RG9).",
  restauree: "Ressource restaurée (en brouillon).",
};

/** Fiche d'une ressource : informations, version en vigueur, historique (RG6) et actions de l'auteur. */
export default async function ResourcePage({ params, searchParams }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const { depose, info } = await searchParams;
  const { resource, permissions } = await getResourceForViewer(user, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  await recordAccess({ userId: user.id, resourceId: resource.id, versionId: resource.versions[0]?.id, kind: "VIEW" });

  const current = resource.versions[0];
  const currentUrl = current ? `/api/files/${issueFileToken(current.id, user.id)}` : "";
  const preview = current ? previewFor(current, currentUrl) : null;
  const isAuthor = resource.authorId === user.id;
  const now = new Date();

  return (
    <article className="space-y-4">
      {depose && <p role="status" className="text-sm text-brand-700">Ressource enregistrée.</p>}
      {info && INFO_MESSAGES[info] && <p role="status" className="rounded-md bg-brand-50 p-3 text-sm text-brand-800">{INFO_MESSAGES[info]}</p>}
      <header className="space-y-1">
        <p className="text-sm text-slate-600">{RESOURCE_TYPE_LABELS[resource.type]}</p>
        <h1 className="h1">{resource.title}</h1>
        <ResourceBadges resource={resource} now={now} />
        <ul className="text-sm text-slate-600">
          {resource.courseElements.map(({ courseElement: ec }) => {
            const semester = ec.teachingUnit.semester;
            return (
              <li key={ec.id}>
                {semester.program.code} · {levelLabel(semester.program.cycle, levelOfSemester(semester.number))} · S{semester.number} · {ec.teachingUnit.title} › <strong>{ec.title}</strong>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-slate-600">
          Par {resource.author.firstName} {resource.author.lastName} · année {resource.academicYear.label}
          {(isAuthor || permissions.viewHistory) && <> · visibilité : {VISIBILITY_LABELS[resource.visibility]}</>}
        </p>
      </header>

      {resource.approvalStatus === "REJECTED" && resource.rejectionReason && (isAuthor || permissions.approve) && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="note">
          Publication refusée par le responsable : {resource.rejectionReason}
        </p>
      )}

      {resource.description && <p className="card whitespace-pre-line text-sm">{resource.description}</p>}
      {resource.keywords && <p className="text-sm text-slate-600">Mots-clés : {resource.keywords}</p>}

      {current && (
        <section className="card space-y-2" data-testid="current-version">
          <h2 className="h2">Version en vigueur (v{current.number})</h2>
          <p className="text-sm text-slate-600">
            {FORMAT_LABELS[current.format] ?? current.format} {current.sizeBytes ? `· ${formatSize(current.sizeBytes)}` : ""} · déposée le {formatDateTime(current.createdAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={currentUrl} className="btn btn-primary" rel="nofollow">
              {current.externalUrl ? "Ouvrir le lien" : "Télécharger"}
            </a>
          </div>
          {preview && <Preview kind={preview.kind} src={preview.src} title={resource.title} />}
        </section>
      )}

      {permissions.viewHistory && resource.versions.length > 1 && (
        <section className="card" data-testid="version-history">
          <h2 className="h2 mb-2">Historique des versions</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {resource.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>v{v.number}</strong> · {formatDateTime(v.createdAt)} · {v.author.firstName} {v.author.lastName} — « {v.comment} »
                </span>
                <a href={`/api/files/${issueFileToken(v.id, user.id)}`} className="link" rel="nofollow">
                  {v.externalUrl ? "Lien" : "Télécharger"}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(permissions.edit || permissions.changeStatus || permissions.hardDelete) && (
        <section className="card space-y-3" data-testid="resource-actions">
          <h2 className="h2">Actions</h2>
          {permissions.edit && resource.status !== "ARCHIVED" && (
            <Link href={`/ressources/${resource.id}/modifier`} className="btn">Modifier / nouvelle version</Link>
          )}
          {permissions.changeStatus && resource.status !== "ARCHIVED" && (
            <details open={resource.status === "DRAFT"}>
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                {resource.status === "DRAFT" ? "Publier" : "Modifier la date de publication"}
              </summary>
              <ActionForm action={publishResourceAction} submitLabel="Valider la publication" className="mt-2 space-y-3">
                <input type="hidden" name="id" value={resource.id} />
                <PublicationFields allowDraft={false} defaultMode="now" />
              </ActionForm>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {permissions.changeStatus && resource.status === "PUBLISHED" && (
              <IdAction action={unpublishResourceAction} id={resource.id} label="Dépublier" />
            )}
            {permissions.changeStatus && resource.status !== "ARCHIVED" && (
              <IdAction action={archiveResourceAction} id={resource.id} label="Archiver" confirm="Archiver cette ressource ? Elle ne sera plus visible des étudiants ni des collègues." />
            )}
            {permissions.changeStatus && resource.status === "ARCHIVED" && (
              <IdAction action={restoreResourceAction} id={resource.id} label="Restaurer" />
            )}
            {permissions.changeStatus && !resource.everPublished && (
              <IdAction action={deleteResourceAction} id={resource.id} label="Supprimer le brouillon" danger confirm="Supprimer définitivement ce brouillon ?" />
            )}
            {permissions.hardDelete && (
              <IdAction
                action={hardDeleteResourceAction}
                id={resource.id}
                label="Suppression définitive (administrateur)"
                danger
                confirm="Supprimer définitivement cette ressource, toutes ses versions et ses fichiers ? Cette action est irréversible."
              />
            )}
          </div>
        </section>
      )}
    </article>
  );
}

function IdAction({
  action,
  id,
  label,
  danger,
  confirm,
}: {
  action: Parameters<typeof ActionForm>[0]["action"];
  id: string;
  label: string;
  danger?: boolean;
  confirm?: string;
}) {
  return (
    <ActionForm action={action} submitLabel={label} submitClassName={`btn btn-sm ${danger ? "btn-danger" : ""}`} className="flex flex-wrap items-center gap-2" confirmMessage={confirm}>
      <input type="hidden" name="id" value={id} />
    </ActionForm>
  );
}
