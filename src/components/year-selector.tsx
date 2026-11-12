interface YearSelectorProps {
  years: { id: string; label: string; isCurrent: boolean | null }[];
  selectedId?: string;
}

/** Choix de l'année universitaire par un formulaire GET (?annee=…) : fonctionne sans JavaScript. */
export function YearSelector({ years, selectedId }: YearSelectorProps) {
  if (years.length === 0) return null;
  return (
    <form method="get" className="flex items-end gap-2">
      <div>
        <label htmlFor="annee" className="label">Année universitaire</label>
        <select id="annee" name="annee" defaultValue={selectedId} className="input py-1">
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}{y.isCurrent ? " (en cours)" : ""}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-sm">Afficher</button>
    </form>
  );
}
