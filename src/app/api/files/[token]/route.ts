import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/session";
import { resolveFileAccess } from "@/server/services/files";
import { getStorage } from "@/server/storage";

const MESSAGES = {
  403: "Accès refusé.",
  404: "Fichier introuvable.",
  410: "Ce lien a expiré. Revenez à la fiche de la ressource pour obtenir un nouveau lien.",
} as const;

/** Parse un en-tête « Range: bytes=début-fin » (une seule plage). */
function parseRange(header: string | null): { start: number; end?: number } | undefined {
  const match = header ? /^bytes=(\d+)-(\d*)$/.exec(header) : null;
  if (!match) return undefined;
  return { start: Number(match[1]), end: match[2] ? Number(match[2]) : undefined };
}

/**
 * Téléchargement ou aperçu d'une version (?apercu=1). L'accès est revérifié à chaque requête ;
 * le chemin de stockage n'est jamais exposé.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inline = request.nextUrl.searchParams.get("apercu") === "1";
  const range = parseRange(request.headers.get("range"));

  const access = await resolveFileAccess(await getCurrentUser(), token, {
    inline,
    // Un aperçu n'est pas un téléchargement ; les requêtes partielles d'une vidéo ne comptent qu'une fois.
    countDownload: !inline && (!range || range.start === 0),
  });
  if (!access.ok) {
    return new Response(MESSAGES[access.status], { status: access.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (access.kind === "link") return Response.redirect(access.url, 302);

  const storage = getStorage();
  const disposition = `${access.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(access.fileName)}`;
  const presigned = await storage.presignedUrl(access.storageKey, {
    fileName: access.fileName,
    contentType: access.contentType,
    inline: access.inline,
    ttlSeconds: 300,
  });
  if (presigned) return Response.redirect(presigned, 302);

  let object;
  try {
    object = await storage.get(access.storageKey, range);
  } catch (error) {
    if (error instanceof RangeError) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */*" } });
    throw error;
  }
  const headers = new Headers({
    "Content-Type": access.contentType,
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });
  if (object.range) {
    headers.set("Content-Range", `bytes ${object.range.start}-${object.range.end}/${object.size}`);
    headers.set("Content-Length", String(object.range.end - object.range.start + 1));
    return new Response(object.stream, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.stream, { status: 200, headers });
}
