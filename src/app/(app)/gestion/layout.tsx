import Link from "next/link";
import { isAdmin } from "@/server/policies/user-policy";
import { requireManagement } from "@/server/session";

/** Espace « Gestion » : administrateur et responsables de formation. */
export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManagement();
  return (
    <div className="space-y-4">
      <nav aria-label="Gestion" className="flex flex-wrap gap-2 text-sm">
        <Link href="/gestion/formations" className="btn btn-sm">Formations</Link>
        {isAdmin(user) && <Link href="/gestion/utilisateurs" className="btn btn-sm">Utilisateurs</Link>}
        {isAdmin(user) && <Link href="/gestion/annees" className="btn btn-sm">Années universitaires</Link>}
        {isAdmin(user) && <Link href="/gestion/journal" className="btn btn-sm">Journal</Link>}
      </nav>
      {children}
    </div>
  );
}
