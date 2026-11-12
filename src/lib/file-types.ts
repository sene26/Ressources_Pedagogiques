/**
 * Formats acceptés (RG8, A9) et contrôle du contenu réel des fichiers.
 * L'extension seule ne suffit pas : on vérifie aussi la signature binaire (premiers octets),
 * pour refuser par exemple un exécutable renommé en « .pdf ».
 */

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 Mo

type Signature = "pdf" | "zip" | "png" | "jpg" | "mp4" | "mp3" | "text";

interface FileFormat {
  /** Format affiché et filtrable. */
  format: string;
  mimeType: string;
  signature: Signature;
  /** Peut être affiché dans le navigateur sans téléchargement (F12). */
  previewable: boolean;
}

const text = (format: string): FileFormat => ({ format, mimeType: "text/plain; charset=utf-8", signature: "text", previewable: false });

export const FILE_FORMATS: Record<string, FileFormat> = {
  pdf: { format: "pdf", mimeType: "application/pdf", signature: "pdf", previewable: true },
  docx: { format: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: "zip", previewable: false },
  pptx: { format: "pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: "zip", previewable: false },
  xlsx: { format: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: "zip", previewable: false },
  odt: { format: "odt", mimeType: "application/vnd.oasis.opendocument.text", signature: "zip", previewable: false },
  zip: { format: "zip", mimeType: "application/zip", signature: "zip", previewable: false },
  mp4: { format: "mp4", mimeType: "video/mp4", signature: "mp4", previewable: true },
  mp3: { format: "mp3", mimeType: "audio/mpeg", signature: "mp3", previewable: true },
  png: { format: "png", mimeType: "image/png", signature: "png", previewable: true },
  jpg: { format: "jpg", mimeType: "image/jpeg", signature: "jpg", previewable: true },
  jpeg: { format: "jpg", mimeType: "image/jpeg", signature: "jpg", previewable: true },
  txt: text("txt"),
  // Code source et jeux de données (A9).
  py: text("code"), ipynb: text("code"), java: text("code"), c: text("code"), h: text("code"), cpp: text("code"),
  js: text("code"), ts: text("code"), html: text("code"), css: text("code"), sql: text("code"), r: text("code"),
  m: text("code"), sh: text("code"), json: text("code"), md: text("code"), csv: text("csv"),
};

/** Formats proposés dans les filtres de recherche (F19). */
export const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF", docx: "Word", pptx: "PowerPoint", xlsx: "Excel", odt: "OpenDocument", zip: "ZIP",
  mp4: "Vidéo MP4", mp3: "Audio MP3", png: "Image PNG", jpg: "Image JPG", txt: "Texte", code: "Code source",
  csv: "Données CSV", lien: "Lien externe",
};

export const ACCEPT_ATTRIBUTE = Object.keys(FILE_FORMATS).map((ext) => `.${ext}`).join(",");

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  return prefix.every((b, i) => bytes[offset + i] === b);
}

/** Vérifie que les premiers octets correspondent au format annoncé. */
export function matchesSignature(signature: Signature, head: Uint8Array): boolean {
  switch (signature) {
    case "pdf":
      return startsWith(head, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "zip":
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06]); // PK
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case "mp4":
      return startsWith(head, [0x66, 0x74, 0x79, 0x70], 4); // « ftyp » à l'octet 4
    case "mp3":
      return startsWith(head, [0x49, 0x44, 0x33]) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0); // ID3 ou trame MPEG
    case "text":
      return isLikelyText(head);
  }
}

/**
 * Un fichier texte ne contient pas d'octet nul et se décode en UTF-8.
 * Le mode « stream » tolère un caractère multi-octets coupé en fin d'extrait.
 */
function isLikelyText(head: Uint8Array): boolean {
  if (head.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

export type UploadCheck =
  | { ok: true; extension: string; format: FileFormat }
  | { ok: false; message: string };

/** Contrôle complet d'un fichier déposé (RG8) : taille, extension, contenu. */
export function checkUpload(fileName: string, size: number, head: Uint8Array, maxBytes = MAX_UPLOAD_BYTES): UploadCheck {
  if (size === 0) return { ok: false, message: "Le fichier est vide." };
  if (size > maxBytes) {
    return { ok: false, message: `Le fichier dépasse la taille maximale de ${Math.round(maxBytes / 1024 / 1024)} Mo.` };
  }
  const extension = extensionOf(fileName);
  const format = FILE_FORMATS[extension];
  if (!format) return { ok: false, message: `Format « .${extension || "?"} » non accepté.` };
  if (!matchesSignature(format.signature, head)) {
    return { ok: false, message: `Le contenu du fichier ne correspond pas à son extension « .${extension} ».` };
  }
  return { ok: true, extension, format };
}

/** Lien externe (RG8) : uniquement https://. */
export function checkExternalUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return { ok: false, message: "Le lien doit commencer par https://." };
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, message: "Lien invalide." };
  }
}

/** Identifiant de vidéo YouTube, pour l'aperçu intégré (F12). */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = /^\/(embed|shorts)\/([\w-]+)/.exec(u.pathname);
      return m ? m[2] : null;
    }
  } catch {
    /* lien invalide */
  }
  return null;
}

/** Identifiant de fichier Google Drive, pour l'aperçu intégré (F12). */
export function googleDriveId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "drive.google.com") return null;
    const m = /\/file\/d\/([\w-]+)/.exec(u.pathname);
    return m ? m[1] : u.searchParams.get("id");
  } catch {
    return null;
  }
}

export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
