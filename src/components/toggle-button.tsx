import type { ActionState } from "@/lib/action-state";
import { ActionForm } from "./action-form";

/** Bouton à deux états relié à une Server Action (favori, suivi d'un EC). */
export function ToggleButton({
  action,
  id,
  field,
  active,
  activeLabel,
  inactiveLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  field: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={active ? activeLabel : inactiveLabel} pendingLabel="…" submitClassName="btn btn-sm" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={field} value={String(!active)} />
    </ActionForm>
  );
}
