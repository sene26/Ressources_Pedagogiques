import { FILE_FORMATS, extensionOf } from "@/lib/file-types";
import type { CurrentUser } from "../current-user";
import { db } from "../db";
import { verifyFileToken } from "../file-tokens";
import { canViewResource, canViewVersionHistory, resourcePolicySelect, toPolicyView } from "../policies/resource-policy";
import { recordAccess } from "./access-log";
import { loadViewerContext } from "./viewer";

export type FileAccess =
  | { ok: false; status: 403 | 404 | 410 }
  | {
      ok: true;
      kind: "link";
      url: string;
    }
  | {
      ok: true;
      kind: "file";
      storageKey: string;
      fileName: string;
      contentType: string;
      inline: boolean;
    };

/**
 * Résout un jeton de téléchargement : signature et expiration, utilisateur de la session,
 * droit de voir la ressource (RG2–RG7) et, pour une ancienne version, droit à l'historique (RG6).
 * Enregistre le téléchargement (RG10).
 */
export async function resolveFileAccess(
  user: CurrentUser | null,
  token: string,
  options: { inline: boolean; countDownload: boolean },
  now = new Date(),
): Promise<FileAccess> {
  const payload = verifyFileToken(token, now.getTime());
  if (!payload) return { ok: false, status: 410 }; // lien expiré ou altéré
  if (!user || user.id !== payload.userId) return { ok: false, status: 403 };

  const version = await db.resourceVersion.findUnique({
    where: { id: payload.versionId },
    include: { resource: { select: { id: true, ...resourcePolicySelect, versions: { orderBy: { number: "desc" }, take: 1, select: { id: true } } } } },
  });
  if (!version) return { ok: false, status: 404 };

  const viewer = await loadViewerContext(user);
  const policy = toPolicyView(version.resource);
  if (!canViewResource(viewer, policy, now)) return { ok: false, status: 404 };
  const isCurrent = version.resource.versions[0]?.id === version.id;
  if (!isCurrent && !canViewVersionHistory(viewer, policy)) return { ok: false, status: 404 };

  if (options.countDownload) {
    await recordAccess({ userId: user.id, resourceId: version.resourceId, versionId: version.id, kind: "DOWNLOAD" }, now);
  }

  if (version.externalUrl) return { ok: true, kind: "link", url: version.externalUrl };

  const format = FILE_FORMATS[extensionOf(version.originalName ?? "")];
  // Seuls les formats sûrs (PDF, images, audio, vidéo) s'affichent dans le navigateur ;
  // le reste, en particulier le HTML, est toujours servi en pièce jointe.
  const inline = options.inline && (format?.previewable ?? false);
  return {
    ok: true,
    kind: "file",
    storageKey: version.storageKey!,
    fileName: version.originalName ?? "fichier",
    contentType: format?.mimeType ?? "application/octet-stream",
    inline,
  };
}
