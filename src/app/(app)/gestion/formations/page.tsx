import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CYCLE_LABELS } from "@/lib/labels";
import { canCreateProgram } from "@/server/policies/user-policy";
import { requireManagement } from "@/server/session";
import { listManageablePrograms } from "@/server/services/catalog";
import { createProgramAction } from "../actions";

export const metadata: Metadata = { title: "Formations" };

export default async function ProgramsPage() {
  const user = await requireManagement();
  const programs = await listManageablePrograms(user);
  return (
    <div className="space-y-6">
      <h1 className="h1">Formations</h1>
      <section className="card">
        {programs.length === 0 ? (
          <p className="text-sm">Aucune formation.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {programs.map((program) => (
              <li key={program.id} className="py-2">
                <Link href={`/gestion/formations/${program.id}`} className="link font-medium">
                  {program.code} — {program.title}
                </Link>{" "}
                <span className="badge">{CYCLE_LABELS[program.cycle]}</span>{" "}
                {program.archived && <span className="badge">Archivée</span>}
                <p className="text-sm text-slate-600">
                  Responsable(s) :{" "}
                  {program.managers.length > 0
                    ? program.managers.map((m) => `${m.user.firstName} ${m.user.lastName}`).join(", ")
                    : "aucun"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {canCreateProgram(user) && (
        <section className="card">
          <h2 className="h2 mb-3">Nouvelle formation</h2>
          <p className="mb-3 text-sm text-slate-600">
            Les semestres sont créés automatiquement : S1 à S6 pour une Licence, S1 à S4 pour un Master.
          </p>
          <ActionForm action={createProgramAction} submitLabel="Créer la formation" className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="code" className="label">Code</label>
              <input id="code" name="code" placeholder="M-MIO" required className="input" />
            </div>
            <div>
              <label htmlFor="title" className="label">Intitulé</label>
              <input id="title" name="title" placeholder="Master MIO" required className="input" />
            </div>
            <div>
              <label htmlFor="cycle" className="label">Cycle</label>
              <select id="cycle" name="cycle" required className="input">
                <option value="LICENCE">Licence</option>
                <option value="MASTER">Master</option>
              </select>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
