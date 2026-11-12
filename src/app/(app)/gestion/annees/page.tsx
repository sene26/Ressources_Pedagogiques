import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireAdmin } from "@/server/session";
import { listAcademicYears } from "@/server/services/academic-years";
import { createAcademicYearAction, setCurrentAcademicYearAction } from "../actions";

export const metadata: Metadata = { title: "Années universitaires" };

const dateFr = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" });

export default async function AcademicYearsPage() {
  await requireAdmin();
  const years = await listAcademicYears();
  return (
    <div className="space-y-6">
      <h1 className="h1">Années universitaires</h1>
      <section className="card">
        {years.length === 0 ? (
          <p className="text-sm">Aucune année universitaire.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {years.map((year) => (
              <li key={year.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium">{year.label}</span>{" "}
                  <span className="text-sm text-slate-600">
                    du {dateFr.format(year.startDate)} au {dateFr.format(year.endDate)}
                  </span>{" "}
                  {year.isCurrent && <span className="badge bg-brand-100 text-brand-800">En cours</span>}
                </div>
                {!year.isCurrent && (
                  <ActionForm
                    action={setCurrentAcademicYearAction}
                    submitLabel="Définir comme année en cours"
                    submitClassName="btn btn-sm"
                    className="flex items-center gap-2"
                    confirmMessage={`Définir ${year.label} comme année en cours ? Les étudiants ne verront plus que les ressources de cette année.`}
                  >
                    <input type="hidden" name="id" value={year.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="h2 mb-3">Nouvelle année</h2>
        <ActionForm action={createAcademicYearAction} submitLabel="Créer l'année" resetOnSuccess className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="label" className="label">Libellé</label>
            <input id="label" name="label" placeholder="2027-2028" required pattern="\d{4}-\d{4}" className="input" />
          </div>
          <div>
            <label htmlFor="startDate" className="label">Début</label>
            <input id="startDate" name="startDate" type="date" required className="input" />
          </div>
          <div>
            <label htmlFor="endDate" className="label">Fin</label>
            <input id="endDate" name="endDate" type="date" required className="input" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
