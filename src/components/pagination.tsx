import Link from "next/link";

/** Pagination « Précédent / Suivant » par liens (fonctionne sans JavaScript). */
export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-center gap-3 text-sm">
      {page > 1 && <Link href={href(page - 1)} className="link">‹ Précédent</Link>}
      <span>Page {page} / {pageCount}</span>
      {page < pageCount && <Link href={href(page + 1)} className="link">Suivant ›</Link>}
    </nav>
  );
}
