import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="h2 mb-2">Mot de passe oublié</h2>
      <p className="mb-4 text-sm text-slate-600">
        Saisissez votre adresse électronique : vous recevrez un lien pour choisir un nouveau mot de passe.
      </p>
      <ActionForm action={forgotPasswordAction} submitLabel="Envoyer le lien" pendingLabel="Envoi…" resetOnSuccess className="space-y-3">
        <div>
          <label htmlFor="email" className="label">Adresse électronique</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
      </ActionForm>
      <p className="mt-4 text-sm">
        <Link href="/connexion" className="link">← Retour à la connexion</Link>
      </p>
    </>
  );
}
