import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { UserFields } from "@/components/user-fields";
import { NotFoundError } from "@/lib/errors";
import { requireAdmin } from "@/server/session";
import { getUser } from "@/server/services/users";
import { setUserActiveAction, setUserPasswordAction, updateUserAction } from "../../actions";

export const metadata: Metadata = { title: "Utilisateur" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> };

export default async function UserPage({ params, searchParams }: Params) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { cree } = await searchParams;
  const user = await getUser(admin, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/gestion/utilisateurs" className="link">← Utilisateurs</Link></p>
      <h1 className="h1">{user.firstName} {user.lastName}</h1>
      {cree && <p role="status" className="text-sm text-brand-700">Compte créé.</p>}

      <section className="card">
        <h2 className="h2 mb-3">Identité et rôles</h2>
        <ActionForm action={updateUserAction} submitLabel="Enregistrer" className="space-y-4">
          <input type="hidden" name="id" value={user.id} />
          <UserFields
            lastName={user.lastName}
            firstName={user.firstName}
            email={user.email}
            phone={user.phone}
            roles={user.roles.map((r) => r.role)}
          />
        </ActionForm>
        {user.managedPrograms.length > 0 && (
          <p className="mt-3 text-sm text-slate-600">
            Responsable de : {user.managedPrograms.map((m) => m.program.code).join(", ")}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Mot de passe</h2>
        <ActionForm action={setUserPasswordAction} submitLabel="Définir le mot de passe" resetOnSuccess className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={user.id} />
          <div>
            <label htmlFor="new-password" className="label">Nouveau mot de passe</label>
            <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="h2 mb-2">État du compte</h2>
        <p className="mb-3 text-sm">{user.active ? "Le compte est actif." : "Le compte est désactivé : l'utilisateur ne peut plus se connecter."}</p>
        <ActionForm
          action={setUserActiveAction}
          submitLabel={user.active ? "Désactiver le compte" : "Réactiver le compte"}
          submitClassName={user.active ? "btn btn-danger" : "btn"}
          confirmMessage={user.active ? "Désactiver ce compte ?" : undefined}
        >
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="active" value={String(!user.active)} />
        </ActionForm>
      </section>
    </div>
  );
}
