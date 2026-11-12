"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";

interface ActionFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Vider le formulaire après un succès (formulaires d'ajout). */
  resetOnSuccess?: boolean;
  submitClassName?: string;
  className?: string;
  /** Message de confirmation affiché avant l'envoi (actions sensibles). */
  confirmMessage?: string;
}

/**
 * Formulaire relié à une Server Action. Il fonctionne aussi avant le chargement du JavaScript
 * (envoi HTML classique) et affiche le message de succès ou d'erreur renvoyé par le serveur.
 *
 * Avec JavaScript, l'envoi est intercepté : React 19 viderait sinon le formulaire après chaque
 * action, y compris en cas d'erreur, et l'utilisateur perdrait sa saisie.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Enregistrement…",
  resetOnSuccess = false,
  submitClassName = "btn btn-primary",
  className = "space-y-3",
  confirmMessage,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-brand-700"}
    >
      {state.message}
    </p>
  );
}
