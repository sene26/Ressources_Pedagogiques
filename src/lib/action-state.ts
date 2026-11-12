/** Résultat d'une Server Action, affiché par le composant ActionForm. */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialActionState: ActionState = { status: "idle" };
