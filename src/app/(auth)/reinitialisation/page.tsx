import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  return (
    <>
      <h2 className="h2 mb-2">Choisir un nouveau mot de passe</h2>
      {jeton ? (
        <ActionForm action={resetPasswordAction} submitLabel="Enregistrer" className="space-y-3">
          <input type="hidden" name="token" value={jeton} />
          <p className="text-sm text-slate-600">Au moins 10 caractères, dont une lettre et un chiffre.</p>
          <div>
            <label htmlFor="password" className="label">Nouveau mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
          </div>
          <div>
            <label htmlFor="confirmation" className="label">Confirmation</label>
            <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required className="input" />
          </div>
        </ActionForm>
      ) : (
        <p role="alert" className="text-sm text-red-700">Lien de réinitialisation incomplet. Faites une nouvelle demande.</p>
      )}
      <p className="mt-4 text-sm">
        <Link href="/connexion" className="link">← Retour à la connexion</Link>
      </p>
    </>
  );
}
