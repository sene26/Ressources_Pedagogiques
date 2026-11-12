import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApprovalForms } from "@/components/approval-forms";
import { formatDateTime } from "@/lib/dates";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { hasRole, isAdmin } from "@/server/policies/user-policy";
import { requireUser } from "@/server/session";
import { listPendingApprovals } from "@/server/services/approvals";

export const metadata: Metadata = { title: "Validations" };

/** Sujets d'examen et corrigés en attente de validation (F14). */
const INFO: Record<string, string> = {
  validee: "Publication validée.",
  refusee: "Publication refusée ; l'auteur est prévenu.",
};

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ info?: string }> }) {
  const user = await requireUser();
  const { info } = await searchParams;
  if (!isAdmin(user) && !hasRole(user, "PROGRAM_MANAGER")) redirect("/");
  const pending = await listPendingApprovals(user);
  return (
    <div className="space-y-4">
      <h1 className="h1">Validations en attente ({pending.length})</h1>
      {info && INFO[info] && <p role="status" className="rounded-md bg-brand-50 p-3 text-sm text-brand-800">{INFO[info]}</p>}
      <p className="text-sm text-slate-600">
        Un sujet d&apos;examen ou un corrigé validé reste invisible des étudiants jusqu&apos;à sa date de publication (RG5).
      </p>
      {pending.length === 0 ? (
        <p className="card text-sm">Aucun document en attente.</p>
      ) : (
        <ul className="space-y-3" data-testid="pending-approvals">
          {pending.map((r) => <ApprovalCard key={r.id} resource={r} />)}
        </ul>
      )}
    </div>
  );
}

function ApprovalCard({ resource: r }: { resource: Awaited<ReturnType<typeof listPendingApprovals>>[number] }) {
  return (
    <li className="card space-y-2">
      <Link href={`/ressources/${r.id}`} className="link font-medium">{r.title}</Link>
      <p className="text-sm text-slate-600">
        {RESOURCE_TYPE_LABELS[r.type]} · {r.courseElements.map((c) => c.courseElement.title).join(", ")} · {r.author.firstName} {r.author.lastName}
      </p>
      <p className="text-sm">Publication demandée : <strong>{r.publishAt ? formatDateTime(r.publishAt) : "—"}</strong></p>
      <ApprovalForms id={r.id} returnTo="/validations" />
    </li>
  );
}
