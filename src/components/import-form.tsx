"use client";

import { useActionState } from "react";
import type { ImportState } from "@/app/(app)/pilotage-actions";
import { FormMessage } from "./action-form";

/** Formulaire d'import CSV (F3) avec compte rendu détaillé, ligne par ligne. */
export function ImportForm({ action }: { action: (state: ImportState, fd: FormData) => Promise<ImportState> }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ImportState);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="file" className="label">Fichier CSV</label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm" />
      </div>
      <div>
        <label htmlFor="csv" className="label">… ou coller le contenu</label>
        <textarea id="csv" name="csv" rows={6} className="input font-mono text-xs" placeholder={"nom;prenom;courriel;telephone;roles;formation;niveau\nSarr;Fatou;fatou.sarr@uasz.sn;;etudiant;M-MIO;1"} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Import en cours…" : "Importer"}</button>
        <FormMessage state={state} />
      </div>
      {state.report && state.report.errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-red-800" data-testid="import-errors">
          {state.report.errors.map((e) => <li key={e.line}>Ligne {e.line} : {e.message}</li>)}
        </ul>
      )}
      {state.report && state.report.skipped.length > 0 && (
        <p className="text-sm text-slate-600">Déjà existants (ignorés) : {state.report.skipped.join(", ")}</p>
      )}
    </form>
  );
}
