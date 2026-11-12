import { randomUUID } from "node:crypto";
import type { ResourceType } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { searchResources } from "@/server/services/search";
import { getCourseElementPage } from "@/server/services/browse";
import { resetDatabase } from "../support/db-helpers";
import { buildWorld, type World } from "../support/resource-world";

/**
 * Exigence non fonctionnelle : une recherche renvoie ses résultats en moins de 2 secondes
 * pour 10 000 ressources. On génère 10 000 ressources réparties sur les EC du jeu de test,
 * puis on mesure la recherche pour un étudiant (filtre de visibilité le plus complexe) et un enseignant.
 */
const TOTAL = 10_000;
const LIMIT_MS = 2000;
const WORDS = (
  "algorithme graphe matrice simplexe dualité optimisation statistique probabilité estimation régression python java " +
  "base données requête jointure réseau protocole sécurité chiffrement compilation analyse numérique intégration " +
  "dérivée équation différentielle système linéaire valeur propre apprentissage classification arbre tri recherche " +
  "complexité récursivité pile file hachage modélisation simulation stochastique markov économie gestion projet"
).split(" ");
const TYPES: ResourceType[] = ["COURSE", "TUTORIAL", "LAB", "OTHER"];

let w: World;

/** Générateur pseudo-aléatoire déterministe (résultats reproductibles). */
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

beforeAll(async () => {
  await resetDatabase();
  w = await buildWorld();
  const ecs = Object.values(w.ec);
  const random = rng(42);
  const pick = () => WORDS[Math.floor(random() * WORDS.length)];
  for (let batch = 0; batch < TOTAL / 1000; batch++) {
    const resources = [];
    const links = [];
    const versions = [];
    for (let i = 0; i < 1000; i++) {
      const id = randomUUID();
      const n = batch * 1000 + i;
      resources.push({
        id,
        title: `${pick()} ${pick()} — chapitre ${n}`,
        description: Array.from({ length: 30 }, pick).join(" "),
        keywords: [pick(), pick(), pick()].join(", "),
        type: TYPES[n % TYPES.length],
        status: n % 10 === 0 ? ("DRAFT" as const) : ("PUBLISHED" as const),
        visibility: n % 7 === 0 ? ("TEACHERS" as const) : ("EC_STUDENTS" as const),
        authorId: n % 2 ? w.author.id : w.colleague.id,
        academicYearId: n % 5 === 0 ? w.previousYear.id : w.year.id,
      });
      links.push({ resourceId: id, courseElementId: ecs[n % ecs.length] });
      versions.push({ resourceId: id, number: 1, externalUrl: "https://exemple.sn/doc", format: n % 3 ? "pdf" : "lien", authorId: w.author.id });
    }
    await db.resource.createMany({ data: resources });
    await db.resourceCourseElement.createMany({ data: links });
    await db.resourceVersion.createMany({
      data: versions.map((v) => (v.format === "pdf" ? { ...v, externalUrl: null, storageKey: `2026-2027/${randomUUID()}` } : v)),
    });
  }
  // Statistiques à jour pour l'optimiseur de MariaDB.
  await db.$executeRawUnsafe("ANALYZE TABLE resources, resource_course_elements, resource_versions");
});

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  return { ms: performance.now() - start, result };
}

describe(`Performance — recherche sur ${TOTAL} ressources (< ${LIMIT_MS} ms)`, () => {
  const queries = ["simplexe", "algorithme graphe", "statistique estimation régression", "chapitre", "TD", ""];

  it.each(queries)("recherche « %s »", async (q) => {
    for (const user of [w.studentM1, w.author, w.admin]) {
      const { ms, result } = await timed(() => searchResources(user, { q: q || undefined, type: q ? undefined : "COURSE" }));
      console.info(`  « ${q || "(filtre type)"} » — ${user === w.studentM1 ? "étudiant" : user === w.author ? "enseignant" : "admin"} : ${Math.round(ms)} ms, ${result.total} résultats`);
      expect(ms).toBeLessThan(LIMIT_MS);
    }
  });

  it("page d'un EC (liste paginée)", async () => {
    const { ms } = await timed(() => getCourseElementPage(w.studentM1, w.ec["M-MIO-S1"]));
    console.info(`  page d'EC (étudiant) : ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(LIMIT_MS);
  });
});
