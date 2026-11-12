import type { Metadata } from "next";
import { Pagination } from "@/components/pagination";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/session";
import { AUDIT_ACTION_LABELS, listAuditLogs } from "@/server/services/audit-log";

export const metadata: Metadata = { title: "Journal des actions" };

type Search = { action?: string; acteur?: string; page?: string };

/** Journal des actions (F25). */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const s = await searchParams;
  const action = s.action && AUDIT_ACTION_LABELS[s.action] ? s.action : undefined;
  const result = await listAuditLogs(admin, { action, actor: s.acteur, page: Number(s.page) || 1 });
  const href = (page: number) => {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (s.acteur) q.set("acteur", s.acteur);
    q.set("page", String(page));
    return `/gestion/journal?${q}`;
  };
  return (
    <div className="space-y-4">
      <h1 className="h1">Journal des actions</h1>
      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="label">Action</label>
          <select id="action" name="action" defaultValue={action ?? ""} className="input">
            <option value="">Toutes</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="grow">
          <label htmlFor="acteur" className="label">Auteur de l&apos;action</label>
          <input id="acteur" name="acteur" defaultValue={s.acteur} placeholder="nom ou adresse" className="input" />
        </div>
        <button type="submit" className="btn">Filtrer</button>
      </form>
      <section className="card overflow-x-auto">
        <p className="mb-2 text-sm text-slate-600">{result.total} action(s)</p>
        <table className="w-full text-left text-sm" data-testid="audit-log">
          <thead>
            <tr className="border-b text-slate-600"><th className="py-1 pr-2">Date</th><th className="py-1 pr-2">Par</th><th className="py-1 pr-2">Action</th><th className="py-1">Détails</th></tr>
          </thead>
          <tbody>
            {result.logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap py-1 pr-2">{formatDateTime(log.createdAt)}</td>
                <td className="py-1 pr-2">{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "—"}</td>
                <td className="py-1 pr-2">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="py-1 text-xs text-slate-600 break-all">
                  {log.entityType === "Resource" && log.entityId && !log.action.endsWith("DELETED") ? (
                    <a href={`/ressources/${log.entityId}`} className="link">Voir la ressource</a>
                  ) : null}{" "}
                  {log.details ? JSON.stringify(log.details) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} pageCount={result.pageCount} href={href} />
      </section>
    </div>
  );
}
