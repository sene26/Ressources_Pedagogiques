import Link from "next/link";
import { signOut } from "@/server/auth";
import { isTeacher } from "@/server/policies/resource-policy";
import { canAccessManagement, hasRole } from "@/server/policies/user-policy";
import { requireUser } from "@/server/session";
import { ROLE_LABELS } from "@/lib/labels";

/** Mise en page de l'espace connecté : en-tête, navigation selon les rôles, déconnexion. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/connexion" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="font-bold text-brand-800">RessourcesPéda</Link>
          <nav aria-label="Navigation principale" className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="link">Accueil</Link>
            {hasRole(user, "STUDENT") && <Link href="/mes-cours" className="link">Mes cours</Link>}
            {isTeacher(user) && <Link href="/mes-ressources" className="link">Mes ressources</Link>}
            {(isTeacher(user) || canAccessManagement(user)) && <Link href="/catalogue" className="link">Catalogue</Link>}
            <Link href="/recherche" className="link">Rechercher</Link>
            {canAccessManagement(user) && <Link href="/gestion/formations" className="link">Gestion</Link>}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600" data-testid="current-user">
              {user.firstName} {user.lastName}
              <span className="sr-only"> — {user.roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
            </span>
            <form action={logout}>
              <button type="submit" className="btn btn-sm">Se déconnecter</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
