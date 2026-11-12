import { access } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/current-user";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { issueFileToken } from "@/server/file-tokens";
import { recordAccess } from "@/server/services/access-log";
import { resolveFileAccess } from "@/server/services/files";
import {
  addVersion,
  archiveResource,
  createResource,
  deleteResource,
  getResourceForViewer,
  hardDeleteResource,
  publishResource,
  restoreResource,
  unpublishResource,
  updateResource,
  type CreateResourceInput,
} from "@/server/services/resources";
import { resetDatabase } from "../support/db-helpers";
import { buildWorld, cleanTemporaryStorage, fileContent, pdf, txt, useTemporaryStorage, type World } from "../support/resource-world";

let storageDir: string;
let w: World;

beforeAll(async () => {
  storageDir = await useTemporaryStorage();
});
afterAll(cleanTemporaryStorage);
beforeEach(async () => {
  await resetDatabase();
  w = await buildWorld();
});

const input = (overrides: Partial<CreateResourceInput> = {}): CreateResourceInput => ({
  title: "Chapitre 1 — Simplexe",
  description: "Méthode du simplexe",
  type: "COURSE",
  keywords: "Simplexe, PL, simplexe",
  courseElementIds: [w.ec["M-MIO-S1"]],
  visibility: "EC_STUDENTS",
  publication: { mode: "draft" },
  content: fileContent(pdf()),
  ...overrides,
});

/** L'utilisateur peut-il ouvrir la fiche ? */
async function sees(user: CurrentUser, resourceId: string, now?: Date): Promise<boolean> {
  try {
    await getResourceForViewer(user, resourceId, now);
    return true;
  } catch (error) {
    if (error instanceof NotFoundError) return false;
    throw error;
  }
}

describe("F9 — Dépôt d'une ressource", () => {
  it("crée la ressource, sa version 1 et le fichier, avec mots-clés normalisés", async () => {
    const r = await createResource(w.author, input());
    const stored = await db.resource.findUniqueOrThrow({ where: { id: r.id }, include: { versions: true, courseElements: true } });
    expect(stored).toMatchObject({ status: "DRAFT", keywords: "simplexe, pl", academicYearId: w.year.id, authorId: w.author.id });
    expect(stored.versions).toHaveLength(1);
    expect(stored.versions[0]).toMatchObject({ number: 1, format: "pdf", originalName: "cours.pdf" });
    await expect(access(path.join(storageDir, stored.versions[0].storageKey!))).resolves.toBeUndefined();
    expect(await db.auditLog.count({ where: { action: "RESOURCE_CREATED", entityId: r.id } })).toBe(1);
  });

  it("accepte un lien externe à la place d'un fichier", async () => {
    const r = await createResource(w.author, input({ type: "VIDEO", content: { mode: "link", externalUrl: "https://youtu.be/abc123" } }));
    const version = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: r.id } });
    expect(version).toMatchObject({ externalUrl: "https://youtu.be/abc123", storageKey: null, format: "lien" });
  });

  it("RG1 — refuse une ressource sans EC", async () => {
    await expect(createResource(w.author, input({ courseElementIds: [] }))).rejects.toThrow("Choisir au moins un EC (RG1).");
  });

  it("RG2 — seul un enseignant affecté à chaque EC, pour l'année en cours, peut déposer", async () => {
    await expect(createResource(w.otherTeacher, input())).rejects.toThrow(ForbiddenError); // affecté l'an dernier seulement
    await expect(createResource(w.studentM1, input())).rejects.toThrow(ForbiddenError);
    await expect(createResource(w.admin, input())).rejects.toThrow(ForbiddenError);
    await expect(createResource(w.author, input({ courseElementIds: [w.ec["M-MIO-S1"], w.ec["L-INFO-S1"]] }))).rejects.toThrow(ForbiddenError);
    await expect(createResource(w.author, input({ courseElementIds: [w.ec["M-MIO-S1"], w.ec["M-MIO-S3"]] }))).resolves.toBeTruthy();
  });

  it("RG8 — refuse un fichier dont le contenu ne correspond pas à l'extension, sans rien stocker", async () => {
    const fake = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "virus.pdf");
    await expect(createResource(w.author, input({ content: fileContent(fake) }))).rejects.toThrow(ValidationError);
    await expect(createResource(w.author, input({ content: fileContent(new File(["x"], "script.exe")) }))).rejects.toThrow("Format « .exe » non accepté.");
    await expect(createResource(w.author, input({ content: { mode: "link", externalUrl: "http://exemple.sn" } }))).rejects.toThrow("https://");
    expect(await db.resource.count()).toBe(0);
  });

  it("RG8 — refuse un fichier au-delà de la taille maximale", async () => {
    process.env.MAX_UPLOAD_MB = "0.00001"; // ≈ 10 octets, pour le test
    try {
      await expect(createResource(w.author, input({ content: fileContent(pdf("gros.pdf", "x".repeat(100))) }))).rejects.toThrow("taille maximale");
    } finally {
      delete process.env.MAX_UPLOAD_MB;
    }
  });
});

describe("RG3, RG4, RG7 — Statut, visibilité et périmètre des étudiants", () => {
  it("un brouillon n'est visible que de l'auteur, de son équipe et du responsable", async () => {
    const r = await createResource(w.author, input());
    expect(await sees(w.author, r.id)).toBe(true);
    expect(await sees(w.colleague, r.id)).toBe(true); // même EC, même année
    expect(await sees(w.manager, r.id)).toBe(true);
    expect(await sees(w.otherTeacher, r.id)).toBe(false);
    expect(await sees(w.studentM1, r.id)).toBe(false);
  });

  it("publiée pour les étudiants de l'EC : visible des seuls étudiants de la formation et du niveau, pour l'année en cours", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    expect(await sees(w.studentM1, r.id)).toBe(true);
    expect(await sees(w.studentM2, r.id)).toBe(false); // autre niveau
    expect(await sees(w.studentL1, r.id)).toBe(false); // autre formation
    expect(await sees(w.studentPreviousYear, r.id)).toBe(false); // inscrit l'an dernier seulement
    expect(await sees(w.studentNotEnrolled, r.id)).toBe(false);
    expect(await sees(w.otherTeacher, r.id)).toBe(true); // tout enseignant voit une ressource publiée non privée
  });

  it("RG7 — une ressource d'une année passée n'est plus visible des étudiants", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    await db.resource.update({ where: { id: r.id }, data: { academicYearId: w.previousYear.id } });
    expect(await sees(w.studentM1, r.id)).toBe(false);
    expect(await sees(w.otherTeacher, r.id)).toBe(true);
  });

  it("visibilité « Enseignants » : partagée entre enseignants, jamais visible des étudiants", async () => {
    const r = await createResource(w.author, input({ visibility: "TEACHERS", publication: { mode: "now" } }));
    expect(await sees(w.otherTeacher, r.id)).toBe(true);
    expect(await sees(w.otherManager, r.id)).toBe(true); // un responsable de formation est aussi un enseignant
    expect(await sees(w.studentM1, r.id)).toBe(false);
  });

  it("visibilité « Privée » : l'auteur seul (et l'administrateur)", async () => {
    const r = await createResource(w.author, input({ visibility: "PRIVATE", publication: { mode: "now" } }));
    expect(await sees(w.author, r.id)).toBe(true);
    expect(await sees(w.admin, r.id)).toBe(true);
    for (const other of [w.colleague, w.manager, w.otherTeacher, w.studentM1]) expect(await sees(other, r.id)).toBe(false);
  });

  it("F13 — une publication programmée reste invisible des étudiants jusqu'à sa date", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "schedule", publishAt: "2030-01-15T08:00" } }));
    expect(await sees(w.studentM1, r.id)).toBe(false);
    expect(await sees(w.studentM1, r.id, new Date("2030-01-15T08:00:01Z"))).toBe(true);
  });

  it("RG5 — un sujet d'examen publié reste invisible des étudiants tant qu'il n'est pas validé", async () => {
    const r = await createResource(w.author, input({ type: "EXAM", publication: { mode: "now" } }));
    expect(r.approvalStatus).toBe("PENDING");
    expect(r.publishAt).not.toBeNull();
    expect(await sees(w.studentM1, r.id, new Date(Date.now() + 1000))).toBe(false);
    await db.resource.update({ where: { id: r.id }, data: { approvalStatus: "APPROVED" } });
    expect(await sees(w.studentM1, r.id, new Date(Date.now() + 1000))).toBe(true);
  });
});

describe("F10, RG6 — Modification et versions", () => {
  it("une nouvelle version incrémente le numéro et conserve l'historique pour l'auteur et le responsable", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    const v2 = await addVersion(w.author, r.id, { content: fileContent(pdf("cours-v2.pdf")), comment: "Correction de l'exercice 4" });
    expect(v2.number).toBe(2);

    const forAuthor = await getResourceForViewer(w.author, r.id);
    expect(forAuthor.resource.versions.map((v) => v.number)).toEqual([2, 1]);
    expect((await getResourceForViewer(w.manager, r.id)).resource.versions).toHaveLength(2);
    // Les autres ne voient que la version en vigueur.
    expect((await getResourceForViewer(w.studentM1, r.id)).resource.versions.map((v) => v.number)).toEqual([2]);
    expect((await getResourceForViewer(w.otherTeacher, r.id)).resource.versions).toHaveLength(1);
  });

  it("le commentaire de version est obligatoire ; seul l'auteur dépose une version", async () => {
    const r = await createResource(w.author, input());
    await expect(addVersion(w.author, r.id, { content: fileContent(pdf()), comment: "" })).rejects.toThrow(ValidationError);
    await expect(addVersion(w.colleague, r.id, { content: fileContent(pdf()), comment: "x" })).rejects.toThrow(ForbiddenError);
  });

  it("modifier les informations ne crée pas de version", async () => {
    const r = await createResource(w.author, input());
    await updateResource(w.author, r.id, { title: "Nouveau titre", type: "COURSE", courseElementIds: [w.ec["M-MIO-S1"]], visibility: "TEACHERS" });
    const stored = await db.resource.findUniqueOrThrow({ where: { id: r.id }, include: { versions: true } });
    expect(stored).toMatchObject({ title: "Nouveau titre", visibility: "TEACHERS" });
    expect(stored.versions).toHaveLength(1);
    await expect(
      updateResource(w.author, r.id, { title: "x", type: "COURSE", courseElementIds: [w.ec["L-INFO-S1"]], visibility: "TEACHERS" }),
    ).rejects.toThrow(ForbiddenError); // RG2 : EC non affecté
  });

  it("A5 — une nouvelle version d'un sujet validé doit être revalidée", async () => {
    const r = await createResource(w.author, input({ type: "EXAM", publication: { mode: "now" } }));
    await db.resource.update({ where: { id: r.id }, data: { approvalStatus: "APPROVED" } });
    await addVersion(w.author, r.id, { content: fileContent(pdf()), comment: "Barème ajouté" });
    expect((await db.resource.findUniqueOrThrow({ where: { id: r.id } })).approvalStatus).toBe("PENDING");
  });

  it("l'ancienne version n'est téléchargeable que par les personnes autorisées", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    const v1 = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: r.id } });
    await addVersion(w.author, r.id, { content: fileContent(pdf()), comment: "v2" });
    const download = (user: CurrentUser) => resolveFileAccess(user, issueFileToken(v1.id, user.id), { inline: false, countDownload: true });
    expect(await download(w.studentM1)).toEqual({ ok: false, status: 404 });
    expect(await download(w.author)).toMatchObject({ ok: true, kind: "file" });
    expect(await download(w.manager)).toMatchObject({ ok: true });
  });
});

describe("F11, RG9 — Publication, dépublication, archivage, suppression", () => {
  it("publier, dépublier, archiver puis restaurer", async () => {
    const r = await createResource(w.author, input());
    await publishResource(w.author, r.id, { mode: "now" });
    expect(await sees(w.studentM1, r.id)).toBe(true);
    await unpublishResource(w.author, r.id);
    expect(await sees(w.studentM1, r.id)).toBe(false);
    await archiveResource(w.author, r.id);
    expect(await sees(w.colleague, r.id)).toBe(false); // archivée : auteur, responsable, administrateur
    expect(await sees(w.manager, r.id)).toBe(true);
    await expect(publishResource(w.author, r.id, { mode: "now" })).rejects.toThrow(ConflictError);
    await restoreResource(w.author, r.id);
    expect((await db.resource.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DRAFT");
  });

  it("seul l'auteur (ou l'administrateur) change le statut", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    await expect(archiveResource(w.colleague, r.id)).rejects.toThrow(ForbiddenError);
    await expect(unpublishResource(w.manager, r.id)).rejects.toThrow(ForbiddenError);
    await expect(archiveResource(w.admin, r.id)).resolves.toBeTruthy();
  });

  it("RG9 — « supprimer » une ressource déjà publiée l'archive", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    await unpublishResource(w.author, r.id);
    expect(await deleteResource(w.author, r.id)).toBe("archived");
    expect((await db.resource.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("ARCHIVED");
  });

  it("un brouillon jamais publié est réellement supprimé, fichier compris", async () => {
    const r = await createResource(w.author, input());
    const key = (await db.resourceVersion.findFirstOrThrow({ where: { resourceId: r.id } })).storageKey!;
    expect(await deleteResource(w.author, r.id)).toBe("deleted");
    expect(await db.resource.count()).toBe(0);
    await expect(access(path.join(storageDir, key))).rejects.toThrow();
  });

  it("RG9 — seul l'administrateur supprime définitivement ; les statistiques sont conservées", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    await recordAccess({ userId: w.studentM1.id, resourceId: r.id, kind: "VIEW" });
    await expect(hardDeleteResource(w.author, r.id)).rejects.toThrow(ForbiddenError);
    await expect(hardDeleteResource(w.manager, r.id)).rejects.toThrow(ForbiddenError);
    await hardDeleteResource(w.admin, r.id);
    expect(await db.resource.count()).toBe(0);
    expect(await db.resourceVersion.count()).toBe(0);
    expect(await db.accessLog.findFirstOrThrow()).toMatchObject({ resourceId: null, kind: "VIEW" });
  });
});

describe("RG10 — Consultations et téléchargements", () => {
  it("enregistre les téléchargements et ne compte qu'une vue par période de 30 minutes", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" }, content: fileContent(txt()) }));
    const version = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: r.id } });
    const t0 = new Date();
    expect(await recordAccess({ userId: w.studentM1.id, resourceId: r.id, kind: "VIEW" }, t0)).toBe(true);
    expect(await recordAccess({ userId: w.studentM1.id, resourceId: r.id, kind: "VIEW" }, new Date(t0.getTime() + 60_000))).toBe(false);
    expect(await recordAccess({ userId: w.studentM1.id, resourceId: r.id, kind: "VIEW" }, new Date(t0.getTime() + 31 * 60_000))).toBe(true);

    const result = await resolveFileAccess(w.studentM1, issueFileToken(version.id, w.studentM1.id), { inline: false, countDownload: true });
    expect(result).toMatchObject({ ok: true, kind: "file", fileName: "notes.txt", inline: false });
    expect(await db.accessLog.count({ where: { kind: "DOWNLOAD", userId: w.studentM1.id, resourceId: r.id, versionId: version.id } })).toBe(1);
    expect(await db.accessLog.count({ where: { kind: "VIEW" } })).toBe(2);
  });

  it("un lien de téléchargement est personnel et ne sert pas à un autre utilisateur", async () => {
    const r = await createResource(w.author, input({ publication: { mode: "now" } }));
    const version = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: r.id } });
    const token = issueFileToken(version.id, w.studentM1.id);
    expect(await resolveFileAccess(w.studentL1, token, { inline: false, countDownload: true })).toEqual({ ok: false, status: 403 });
    expect(await resolveFileAccess(null, token, { inline: false, countDownload: true })).toEqual({ ok: false, status: 403 });
    expect(await resolveFileAccess(w.studentM1, `${token}x`, { inline: false, countDownload: true })).toEqual({ ok: false, status: 410 });
  });

  it("les fichiers texte et code ne sont jamais affichés dans le navigateur (protection XSS)", async () => {
    const html = new File(["<script>alert(1)</script>"], "page.html");
    const r = await createResource(w.author, input({ publication: { mode: "now" }, content: fileContent(html) }));
    const version = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: r.id } });
    const result = await resolveFileAccess(w.studentM1, issueFileToken(version.id, w.studentM1.id), { inline: true, countDownload: false });
    expect(result).toMatchObject({ ok: true, inline: false, contentType: "text/plain; charset=utf-8" });
  });
});
