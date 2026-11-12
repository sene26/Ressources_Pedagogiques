import type { Role } from "@prisma/client";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/labels";

interface UserFieldsProps {
  lastName?: string;
  firstName?: string;
  email?: string;
  phone?: string | null;
  roles?: Role[];
}

/** Champs d'identité et de rôles, communs à la création et à la modification d'un utilisateur. */
export function UserFields({ lastName, firstName, email, phone, roles = [] }: UserFieldsProps) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="lastName" className="label">Nom</label>
          <input id="lastName" name="lastName" defaultValue={lastName} required autoComplete="family-name" className="input" />
        </div>
        <div>
          <label htmlFor="firstName" className="label">Prénom</label>
          <input id="firstName" name="firstName" defaultValue={firstName} required autoComplete="given-name" className="input" />
        </div>
        <div>
          <label htmlFor="email" className="label">Adresse électronique</label>
          <input id="email" name="email" type="email" defaultValue={email} required className="input" />
        </div>
        <div>
          <label htmlFor="phone" className="label">Téléphone (facultatif)</label>
          <input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} className="input" />
        </div>
      </div>
      <fieldset>
        <legend className="label">Rôles</legend>
        <div className="flex flex-wrap gap-4">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roles" value={role} defaultChecked={roles.includes(role)} />
              {ROLE_LABELS[role]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
