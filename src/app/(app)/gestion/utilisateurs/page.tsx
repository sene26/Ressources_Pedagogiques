import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/labels";
import { requireAdmin } from "@/server/session";
import { listUsers } from "@/server/services/users";

export const metadata: Metadata = { title: "Utilisateurs" };

type Search = { q?: string; role?: string; page?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const { q, role, page } = await searchParams;
  const roleFilter = ALL_ROLES.includes(role as Role) ? (role as Role) : undefined;
  const result = await listUsers(admin, { q, role: roleFilter, page: Number(page) || 1 });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter) params.set("role", roleFilter);
    params.set("page", String(p));
    return `/gestion/utilisateurs?${params}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Utilisateurs</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/gestion/utilisateurs/import" className="btn">Importer (CSV)</Link>
          <Link href="/gestion/utilisateurs/nouveau" className="btn btn-primary">+ Nouvel utilisateur</Link>
        </div>
      </div>
      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div className="grow">
          <label htmlFor="q" className="label">Rechercher</label>
          <input id="q" name="q" defaultValue={q} placeholder="nom, prénom ou adresse" className="input" />
        </div>
        <div>
          <label htmlFor="role" className="label">Rôle</label>
          <select id="role" name="role" defaultValue={roleFilter ?? ""} className="input">
            <option value="">Tous</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn">Filtrer</button>
      </form>
      <section className="card overflow-x-auto">
        <p className="mb-2 text-sm text-slate-600">{result.total} utilisateur(s)</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-2 pr-2">Nom</th>
              <th className="py-2 pr-2">Adresse</th>
              <th className="py-2 pr-2">Rôles</th>
              <th className="py-2">État</th>
            </tr>
          </thead>
          <tbody>
            {result.users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <Link href={`/gestion/utilisateurs/${u.id}`} className="link">{u.lastName.toUpperCase()} {u.firstName}</Link>
                </td>
                <td className="py-2 pr-2 break-all">{u.email}</td>
                <td className="py-2 pr-2">{u.roles.map((r) => ROLE_LABELS[r.role]).join(", ")}</td>
                <td className="py-2">{u.active ? "Actif" : <span className="badge">Désactivé</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.pageCount > 1 && (
          <nav aria-label="Pagination" className="mt-3 flex items-center justify-center gap-3 text-sm">
            {result.page > 1 && <Link href={pageHref(result.page - 1)} className="link">‹ Précédent</Link>}
            <span>Page {result.page} / {result.pageCount}</span>
            {result.page < result.pageCount && <Link href={pageHref(result.page + 1)} className="link">Suivant ›</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
