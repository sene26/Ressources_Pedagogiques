import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, checkExternalUrl, checkUpload, googleDriveId, youtubeId } from "@/lib/file-types";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("RG8 — Formats et taille des fichiers", () => {
  it("accepte les formats autorisés dont le contenu correspond à l'extension", () => {
    expect(checkUpload("cours.pdf", 10, ascii("%PDF-1.7 ...")).ok).toBe(true);
    expect(checkUpload("td.docx", 10, bytes(0x50, 0x4b, 0x03, 0x04, 0)).ok).toBe(true);
    expect(checkUpload("schema.png", 10, bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).ok).toBe(true);
    expect(checkUpload("photo.JPG", 10, bytes(0xff, 0xd8, 0xff, 0xe0)).ok).toBe(true);
    expect(checkUpload("video.mp4", 10, bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70)).ok).toBe(true);
    expect(checkUpload("son.mp3", 10, ascii("ID3...")).ok).toBe(true);
    expect(checkUpload("tp.py", 10, ascii("print('é')\n")).ok).toBe(true);
    expect(checkUpload("notes.txt", 10, ascii("Bonjour")).ok).toBe(true);
  });

  it("refuse plus de 100 Mo", () => {
    const result = checkUpload("gros.pdf", MAX_UPLOAD_BYTES + 1, ascii("%PDF"));
    expect(result).toEqual({ ok: false, message: "Le fichier dépasse la taille maximale de 100 Mo." });
    expect(checkUpload("limite.pdf", MAX_UPLOAD_BYTES, ascii("%PDF")).ok).toBe(true);
  });

  it("refuse un format non accepté ou un fichier vide", () => {
    expect(checkUpload("virus.exe", 10, bytes(0x4d, 0x5a))).toMatchObject({ ok: false });
    expect(checkUpload("sans-extension", 10, ascii("x"))).toMatchObject({ ok: false });
    expect(checkUpload("vide.pdf", 0, bytes())).toEqual({ ok: false, message: "Le fichier est vide." });
  });

  it("refuse un fichier dont le contenu ne correspond pas à l'extension", () => {
    expect(checkUpload("faux.pdf", 10, bytes(0x4d, 0x5a, 0x90, 0))).toMatchObject({ ok: false });
    expect(checkUpload("binaire.txt", 10, bytes(0x41, 0x00, 0x42))).toMatchObject({ ok: false });
  });

  it("n'accepte que des liens https", () => {
    expect(checkExternalUrl("https://www.youtube.com/watch?v=abc")).toMatchObject({ ok: true });
    expect(checkExternalUrl("http://exemple.sn")).toMatchObject({ ok: false });
    expect(checkExternalUrl("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(checkExternalUrl("pas un lien")).toMatchObject({ ok: false });
  });

  it("reconnaît les vidéos YouTube et les fichiers Google Drive", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(googleDriveId("https://drive.google.com/file/d/1AbC-dEf/view")).toBe("1AbC-dEf");
    expect(youtubeId("https://exemple.sn/watch?v=x")).toBeNull();
  });
});
