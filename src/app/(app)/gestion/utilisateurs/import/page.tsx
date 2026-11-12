import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { requireAdmin } from "@/server/session";
import { importUsersAction } from "../../../pilotage-actions";

export const metadata: Metadata = { title: "Importer des comptes" };

/** Import des étudiants et enseignants par CSV (F3). */
export default async function ImportUsersPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/gestion/utilisateurs" className="link">← Utilisateurs</Link></p>
      <h1 className="h1">Importer des comptes (CSV)</h1>
      <section className="card space-y-2 text-sm">
        <p>Colonnes attendues (première ligne), séparées par « ; » ou « , » :</p>
        <p><code className="rounded bg-slate-100 px-1">nom ; prenom ; courriel ; telephone ; roles ; formation ; niveau</code></p>
        <ul className="list-disc pl-5">
          <li><strong>roles</strong> : etudiant, enseignant, responsable, administrateur ; plusieurs séparés par « | ». Vide = etudiant.</li>
          <li><strong>formation</strong> et <strong>niveau</strong> (facultatifs) : inscription pour l&apos;année en cours, ex. « M-MIO » et « 1 ».</li>
          <li>Le fichier est entièrement vérifié avant l&apos;import : à la moindre erreur, rien n&apos;est importé.</li>
          <li>Les adresses déjà inscrites sont ignorées. Chaque nouveau compte reçoit un courriel pour choisir son mot de passe (lien valable 7 jours).</li>
        </ul>
      </section>
      <section className="card">
        <ImportForm action={importUsersAction} />
      </section>
    </div>
  );
}
