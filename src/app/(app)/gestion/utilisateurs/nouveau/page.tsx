import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { UserFields } from "@/components/user-fields";
import { requireAdmin } from "@/server/session";
import { createUserAction } from "../../actions";

export const metadata: Metadata = { title: "Nouvel utilisateur" };

export default async function NewUserPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/gestion/utilisateurs" className="link">← Utilisateurs</Link></p>
      <h1 className="h1">Nouvel utilisateur</h1>
      <section className="card">
        <ActionForm action={createUserAction} submitLabel="Créer le compte" className="space-y-4">
          <UserFields roles={["STUDENT"]} />
          <div className="max-w-sm">
            <label htmlFor="password" className="label">Mot de passe initial</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
            <p className="mt-1 text-xs text-slate-600">Au moins 10 caractères, dont une lettre et un chiffre. À communiquer à l&apos;utilisateur.</p>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
