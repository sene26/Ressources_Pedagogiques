import type { Metadata } from "next";
import Link from "next/link";
import { CYCLE_LABELS } from "@/lib/labels";
import { requireUser } from "@/server/session";
import { listBrowsablePrograms } from "@/server/services/browse";

export const metadata: Metadata = { title: "Catalogue" };

/** Navigation (F17) : liste des formations. */
export default async function CataloguePage() {
  const user = await requireUser();
  const programs = await listBrowsablePrograms(user);
  return (
    <div className="space-y-4">
      <h1 className="h1">Catalogue des formations</h1>
      <section className="card">
        {programs.length === 0 ? (
          <p className="text-sm">Aucune formation.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {programs.map((p) => (
              <li key={p.id} className="py-2">
                <Link href={`/catalogue/${p.id}`} className="link font-medium">{p.title}</Link>{" "}
                <span className="badge">{CYCLE_LABELS[p.cycle]}</span> <span className="text-sm text-slate-500">{p.code}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
