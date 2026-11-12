import type { ApprovalStatus, ResourceStatus, Visibility } from "@prisma/client";
import { formatDateTime } from "@/lib/dates";
import { APPROVAL_LABELS, statusLabel } from "@/lib/labels";

/** Badges d'état d'une ressource : statut, programmation, validation, visibilité privée. */
export function ResourceBadges({
  resource,
  now = new Date(),
}: {
  resource: { status: ResourceStatus; publishAt: Date | null; approvalStatus: ApprovalStatus; visibility: Visibility };
  now?: Date;
}) {
  const label = statusLabel(resource, now);
  const color =
    label === "Publiée" ? "bg-brand-100 text-brand-800" : label === "Programmée" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700";
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`badge ${color}`}>
        {label}
        {label === "Programmée" && resource.publishAt ? ` · ${formatDateTime(resource.publishAt)}` : ""}
      </span>
      {resource.approvalStatus !== "NOT_REQUIRED" && (
        <span className={`badge ${resource.approvalStatus === "APPROVED" ? "bg-brand-100 text-brand-800" : resource.approvalStatus === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
          {APPROVAL_LABELS[resource.approvalStatus]}
        </span>
      )}
      {resource.visibility === "PRIVATE" && <span className="badge">Privée</span>}
    </span>
  );
}
