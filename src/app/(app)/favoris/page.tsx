import type { Metadata } from "next";
import { ResourceList } from "@/components/resource-list";
import { isTeacher } from "@/server/policies/resource-policy";
import { requireUser } from "@/server/session";
import { listFavorites } from "@/server/services/favorites";

export const metadata: Metadata = { title: "Favoris" };

/** Favoris (F21) : seules les ressources encore visibles sont listées. */
export default async function FavoritesPage() {
  const user = await requireUser();
  const favorites = await listFavorites(user);
  return (
    <div className="space-y-4">
      <h1 className="h1">Mes favoris</h1>
      <section className="card">
        {favorites.length === 0 ? (
          <p className="text-sm">Aucun favori. Utilisez « ☆ Ajouter aux favoris » sur la fiche d&apos;une ressource.</p>
        ) : (
          <ResourceList resources={favorites} showBadges={isTeacher(user)} showCourseElements />
        )}
      </section>
    </div>
  );
}
