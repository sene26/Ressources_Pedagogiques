import { approveResourceAction, rejectResourceAction } from "@/app/(app)/engagement-actions";
import { ActionForm } from "./action-form";

/** Boutons « Valider » et « Refuser » (avec motif), réutilisés sur la fiche ressource. */
export function ApprovalForms({ id, returnTo }: { id: string; returnTo: string }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <ActionForm action={approveResourceAction} submitLabel="✔ Valider" className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnTo" value={returnTo} />
      </ActionForm>
      <details>
        <summary className="btn btn-sm btn-danger cursor-pointer">✖ Refuser</summary>
        <ActionForm action={rejectResourceAction} submitLabel="Confirmer le refus" submitClassName="btn btn-sm btn-danger" className="mt-2 space-y-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label htmlFor={`reason-${id}`} className="label">Motif du refus</label>
          <textarea id={`reason-${id}`} name="reason" required maxLength={500} rows={2} className="input" />
        </ActionForm>
      </details>
    </div>
  );
}
