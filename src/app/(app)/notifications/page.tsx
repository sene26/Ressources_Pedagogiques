import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Pagination } from "@/components/pagination";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { listNotifications } from "@/server/services/notifications";
import { markAllReadAction, setEmailNotificationsAction } from "../engagement-actions";

export const metadata: Metadata = { title: "Notifications" };

/** Notifications de l'utilisateur (F22). */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const { page } = await searchParams;
  const result = await listNotifications(user, Number(page) || 1);
  const { emailNotifications } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailNotifications: true } });
  const hasUnread = result.notifications.some((n) => !n.readAt);
  return (
    <div className="space-y-4">
      <h1 className="h1">Notifications</h1>
      <div className="flex flex-wrap items-center gap-3">
        {hasUnread && <ActionForm action={markAllReadAction} submitLabel="Tout marquer comme lu" submitClassName="btn btn-sm" className="flex items-center gap-2">{null}</ActionForm>}
        <ActionForm action={setEmailNotificationsAction} submitLabel={emailNotifications ? "Ne plus recevoir de courriel" : "Recevoir aussi par courriel"} submitClassName="btn btn-sm" className="flex items-center gap-2">
          <input type="hidden" name="enabled" value={String(!emailNotifications)} />
        </ActionForm>
      </div>
      <section className="card">
        {result.notifications.length === 0 ? (
          <p className="text-sm">Aucune notification. Suivez un EC pour être prévenu(e) des nouvelles ressources.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="notification-list">
            {result.notifications.map((n) => (
              <li key={n.id} className="py-2">
                <a href={`/notifications/${n.id}`} className={`link block ${n.readAt ? "text-slate-600" : "font-semibold"}`}>
                  {!n.readAt && <span className="sr-only">Non lue : </span>}
                  {n.message}
                </a>
                <p className="text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={result.page} pageCount={result.pageCount} href={(p) => `/notifications?page=${p}`} />
      </section>
    </div>
  );
}
