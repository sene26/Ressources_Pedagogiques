import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { getCurrentUser } from "@/server/session";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { callbackUrl } = await searchParams;
  return (
    <>
      <h2 className="h2 mb-4">Connexion</h2>
      <ActionForm action={loginAction} submitLabel="Se connecter" pendingLabel="Connexion…" submitClassName="btn btn-primary w-full">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
        <div>
          <label htmlFor="email" className="label">Adresse électronique</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
      </ActionForm>
      <p className="mt-4 text-sm">
        <Link href="/mot-de-passe-oublie" className="link">Mot de passe oublié ?</Link>
      </p>
    </>
  );
}
