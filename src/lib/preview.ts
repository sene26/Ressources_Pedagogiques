import type { PreviewKind } from "@/components/preview";
import { googleDriveId, youtubeId } from "./file-types";

/** Type d'aperçu possible pour une version (F12), et l'adresse à afficher ; null si aucun aperçu. */
export function previewFor(
  version: { format: string; externalUrl: string | null },
  fileUrl: string,
): { kind: PreviewKind; src: string } | null {
  if (version.externalUrl) {
    const yt = youtubeId(version.externalUrl);
    if (yt) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}` };
    const drive = googleDriveId(version.externalUrl);
    if (drive) return { kind: "drive", src: `https://drive.google.com/file/d/${encodeURIComponent(drive)}/preview` };
    return null;
  }
  const inline = `${fileUrl}?apercu=1`;
  switch (version.format) {
    case "pdf":
      return { kind: "pdf", src: inline };
    case "png":
    case "jpg":
      return { kind: "image", src: inline };
    case "mp4":
      return { kind: "video", src: inline };
    case "mp3":
      return { kind: "audio", src: inline };
    default:
      return null;
  }
}
