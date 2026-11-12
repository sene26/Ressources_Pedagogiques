import { Prisma, type ResourceType } from "@prisma/client";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { visibleResourcesWhere } from "../policies/resource-policy";
import { RESOURCE_PAGE_SIZE } from "./resources";
import { loadViewerContext } from "./viewer";

/**
 * Recherche plein texte (F18) et filtres (F19) sur les ressources visibles par l'utilisateur.
 *
 * MariaDB : index FULLTEXT sur (titre, mots-clés, description) et sur le titre seul.
 * - chaque mot de 3 lettres ou plus devient obligatoire et peut être complété (« simplex » → « simplexe ») ;
 * - l'interclassement utf8mb4_unicode_ci rend la recherche insensible aux accents et à la casse ;
 * - le titre compte double dans la pertinence ;
 * - les mots plus courts (« TD », « TP ») sont cherchés par simple inclusion dans le titre et les mots-clés.
 */

/** Taille minimale d'un mot indexé (innodb_ft_min_token_size). */
const MIN_TOKEN = 3;
/**
 * Mots vides par défaut d'InnoDB : exigés dans une recherche booléenne, ils annuleraient tout résultat
 * si le serveur n'a pas `innodb_ft_enable_stopword = 0`. On les cherche donc par simple inclusion.
 */
const INNODB_STOPWORDS = new Set(
  "a about an are as at be by com de en for from how i in is it la of on or that the this to was what when where who will with und www".split(" "),
);
/** Plafond de candidats plein texte avant filtrage par les droits. */
const MAX_CANDIDATES = 5000;

export interface SearchFilters {
  q?: string;
  type?: ResourceType;
  authorId?: string;
  academicYearId?: string;
  format?: string;
  page?: number;
}

/** Découpe la saisie en mots, sans aucun opérateur booléen de MariaDB (injection de syntaxe). */
export function tokenize(query: string): { long: string[]; short: string[] } {
  const words = query
    .normalize("NFC")
    .replace(/[+\-<>()~*"@'’.,;:!?/\\[\]{}|&^%$#=]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 10);
  const isShort = (w: string) => [...w].length < MIN_TOKEN || INNODB_STOPWORDS.has(w.toLowerCase());
  return { long: words.filter((w) => !isShort(w)), short: words.filter(isShort) };
}

/** Requête booléenne MariaDB : « +mot1* +mot2* ». */
export function toBooleanQuery(words: string[]): string {
  return words.map((w) => `+${w}*`).join(" ");
}

/** Identifiants des ressources correspondant au texte, du plus pertinent au moins pertinent. */
async function fullTextCandidates(words: string[]): Promise<string[]> {
  const query = toBooleanQuery(words);
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM resources
    WHERE MATCH(title, keywords, description) AGAINST (${query} IN BOOLEAN MODE)
    ORDER BY (2 * MATCH(title) AGAINST (${query} IN BOOLEAN MODE)
              + MATCH(title, keywords, description) AGAINST (${query} IN BOOLEAN MODE)) DESC,
             updatedAt DESC
    LIMIT ${MAX_CANDIDATES}`);
  return rows.map((r) => r.id);
}

export async function searchResources(actor: CurrentUser, filters: SearchFilters, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const { long, short } = tokenize(filters.q ?? "");

  const conditions: Prisma.ResourceWhereInput[] = [visibleResourcesWhere(viewer, now)];
  if (filters.type) conditions.push({ type: filters.type });
  if (filters.authorId) conditions.push({ authorId: filters.authorId });
  if (filters.academicYearId) conditions.push({ academicYearId: filters.academicYearId });
  if (filters.format) conditions.push({ versions: { some: { format: filters.format } } });
  for (const word of short) conditions.push({ OR: [{ title: { contains: word } }, { keywords: { contains: word } }] });

  let ranking: string[] | undefined;
  if (long.length > 0) {
    ranking = await fullTextCandidates(long);
    conditions.push({ id: { in: ranking } });
  }
  const where: Prisma.ResourceWhereInput = { AND: conditions };

  let pageIds: string[];
  let total: number;
  if (ranking) {
    // Filtre des droits en base, puis tri par pertinence et pagination en mémoire (≤ MAX_CANDIDATES identifiants).
    const allowed = new Set((await db.resource.findMany({ where, select: { id: true } })).map((r) => r.id));
    const ordered = ranking.filter((id) => allowed.has(id));
    total = ordered.length;
    pageIds = ordered.slice((page - 1) * RESOURCE_PAGE_SIZE, page * RESOURCE_PAGE_SIZE);
  } else {
    total = await db.resource.count({ where });
    pageIds = (
      await db.resource.findMany({
        where,
        select: { id: true },
        orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * RESOURCE_PAGE_SIZE,
        take: RESOURCE_PAGE_SIZE,
      })
    ).map((r) => r.id);
  }

  const rows = await db.resource.findMany({
    where: { id: { in: pageIds } },
    include: {
      author: { select: { firstName: true, lastName: true } },
      courseElements: { include: { courseElement: { select: { id: true, title: true } } } },
      versions: { orderBy: { number: "desc" }, take: 1, select: { format: true, sizeBytes: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const resources = pageIds.map((id) => byId.get(id)!).filter(Boolean);
  return { resources, total, page, pageCount: Math.max(1, Math.ceil(total / RESOURCE_PAGE_SIZE)), terms: [...long, ...short] };
}

/** Enseignants auteurs d'au moins une ressource visible (choix du filtre « Enseignant »). */
export async function listVisibleAuthors(actor: CurrentUser, now = new Date()) {
  const viewer = await loadViewerContext(actor);
  return db.user.findMany({
    where: { resources: { some: visibleResourcesWhere(viewer, now) } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
