import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { levelLabel } from "@/lib/academic";
import { ROLE_LABELS } from "@/lib/labels";
import { requireUser } from "@/server/session";
import { getProfile } from "@/server/services/profile";
import { setEmailNotificationsAction } from "../engagement-actions";
import { changePasswordAction, removePhotoAction, setPhotoAction, updateProfileAction } from "../pilotage-actions";

export const metadata: Metadata = { title: "Mon profil" };

/** Profil utilisateur (F4). */
export default async function ProfilePage() {
  const actor = await requireUser();
  const { user, enrollment, year } = await getProfile(actor);
  return (
    <div className="space-y-4">
      <h1 className="h1">Mon profil</h1>
      <section className="card flex flex-wrap items-center gap-4">
        {user.photoKey ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo protégée servie par /api/avatars
          <img src={`/api/avatars/${user.id}?v=${user.photoKey.slice(-8)}`} alt="Ma photo" width={96} height={96} className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div aria-hidden="true" className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-800">
            {user.firstName[0]}{user.lastName[0]}
          </div>
        )}
        <div className="text-sm">
          <p className="font-medium">{user.email}</p>
          <p className="text-slate-600">{user.roles.map((r) => ROLE_LABELS[r.role]).join(" · ")}</p>
          {enrollment && (
            <p className="text-slate-600">
              {enrollment.program.title} · {levelLabel(enrollment.program.cycle, enrollment.level)} ({year?.label})
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Informations</h2>
        <ActionForm action={updateProfileAction} submitLabel="Enregistrer" className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="lastName" className="label">Nom</label>
            <input id="lastName" name="lastName" defaultValue={user.lastName} required className="input" />
          </div>
          <div>
            <label htmlFor="firstName" className="label">Prénom</label>
            <input id="firstName" name="firstName" defaultValue={user.firstName} required className="input" />
          </div>
          <div>
            <label htmlFor="phone" className="label">Téléphone</label>
            <input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} className="input" />
          </div>
        </ActionForm>
        <p className="mt-2 text-xs text-slate-500">La formation et le niveau proviennent de votre inscription ; pour les modifier, contactez la scolarité.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Photo</h2>
        <ActionForm action={setPhotoAction} submitLabel="Enregistrer la photo" resetOnSuccess className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="photo" className="label">Image (PNG, JPG ou WebP, 2 Mo au maximum)</label>
            <input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" required className="block text-sm" />
          </div>
        </ActionForm>
        {user.photoKey && <ActionForm action={removePhotoAction} submitLabel="Supprimer la photo" submitClassName="btn btn-sm btn-danger">{null}</ActionForm>}
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Mot de passe</h2>
        <ActionForm action={changePasswordAction} submitLabel="Changer le mot de passe" resetOnSuccess className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="current" className="label">Mot de passe actuel</label>
            <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Nouveau mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
          </div>
          <div>
            <label htmlFor="confirmation" className="label">Confirmation</label>
            <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required className="input" />
          </div>
        </ActionForm>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Notifications par courriel</h2>
        <p className="text-sm">{user.emailNotifications ? "Vous recevez les notifications par courriel." : "Vous ne recevez pas de courriel."}</p>
        <ActionForm action={setEmailNotificationsAction} submitLabel={user.emailNotifications ? "Ne plus recevoir de courriel" : "Recevoir les courriels"} submitClassName="btn btn-sm">
          <input type="hidden" name="enabled" value={String(!user.emailNotifications)} />
        </ActionForm>
      </section>
    </div>
  );
}
