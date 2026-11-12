import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { CurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { approveResource, listPendingApprovals, rejectResource } from "@/server/services/approvals";
import { listFavorites, setFavorite } from "@/server/services/favorites";
import { dispatchPublicationNotifications, sendPendingNotificationEmails } from "@/server/services/notifications";
import { archiveResource, createResource, getResourceForViewer, type CreateResourceInput } from "@/server/services/resources";
import { isFollowing, setFollowing } from "@/server/services/subscriptions";
import { resetDatabase } from "../support/db-helpers";
import { buildWorld, cleanTemporaryStorage, fileContent, pdf, useTemporaryStorage, type World } from "../support/resource-world";

let w: World;
beforeAll(useTemporaryStorage);
afterAll(cleanTemporaryStorage);
beforeEach(async () => {
  await resetDatabase();
  w = await buildWorld();
});

const make = (overrides: Partial<CreateResourceInput> = {}) =>
  createResource(w.author, {
    title: "Sujet d'examen — session 1",
    description: "",
    type: "EXAM",
    keywords: "",
    courseElementIds: [w.ec["M-MIO-S1"]],
    visibility: "EC_STUDENTS",
    publication: { mode: "schedule", publishAt: "2030-01-15T08:00" },
    content: fileContent(pdf()),
    ...overrides,
  });

async function sees(user: CurrentUser, id: string, now?: Date) {
  return getResourceForViewer(user, id, now).then(
    () => true,
    (e) => {
      if (e instanceof NotFoundError) return false;
      throw e;
    },
  );
}

const DATE = new Date("2030-01-15T08:00:00Z");
const BEFORE = new Date("2030-01-15T07:59:00Z");
const AFTER = new Date("2030-01-15T08:01:00Z");
const notified = async (user: CurrentUser) => db.notification.count({ where: { userId: user.id, message: { startsWith: "Nouvelle ressource" } } });

describe("RG5, F13, F14 — Sujets d'examen et corrigés", () => {
  it("reste invisible jusqu'à sa date de publication validée", async () => {
    const exam = await make();
    expect(exam).toMatchObject({ status: "PUBLISHED", approvalStatus: "PENDING", publishAt: DATE });
    expect(await sees(w.studentM1, exam.id, AFTER)).toBe(false); // date atteinte mais non validé

    await approveResource(w.manager, exam.id);
    expect(await sees(w.studentM1, exam.id, BEFORE)).toBe(false); // validé mais date non atteinte
    expect(await sees(w.studentM1, exam.id, AFTER)).toBe(true); // validé et date atteinte
    expect(await sees(w.studentM2, exam.id, AFTER)).toBe(false); // RG7
    const stored = await db.resource.findUniqueOrThrow({ where: { id: exam.id } });
    expect(stored).toMatchObject({ approvalStatus: "APPROVED", approvedById: w.manager.id });
    expect(await db.auditLog.count({ where: { action: "RESOURCE_APPROVED", entityId: exam.id } })).toBe(1);
  });

  it("le responsable de la formation est prévenu et voit le document dans ses validations", async () => {
    const exam = await make();
    expect(await db.notification.count({ where: { userId: w.manager.id, message: { startsWith: "Validation demandée" } } })).toBe(1);
    expect((await listPendingApprovals(w.manager)).map((r) => r.id)).toEqual([exam.id]);
    expect(await listPendingApprovals(w.otherManager)).toEqual([]); // autre formation
    expect((await listPendingApprovals(w.admin)).map((r) => r.id)).toEqual([exam.id]);
  });

  it("seuls le responsable de la formation et l'administrateur valident", async () => {
    const exam = await make();
    for (const user of [w.author, w.colleague, w.otherManager, w.otherTeacher]) {
      await expect(approveResource(user, exam.id)).rejects.toThrow(ForbiddenError);
    }
    await expect(approveResource(w.studentM1, exam.id)).rejects.toThrow(NotFoundError);
    await approveResource(w.admin, exam.id);
    await expect(approveResource(w.admin, exam.id)).rejects.toThrow(ConflictError); // plus en attente
  });

  it("un refus exige un motif, prévient l'auteur et laisse le document invisible", async () => {
    const exam = await make();
    await expect(rejectResource(w.manager, exam.id, "  ")).rejects.toThrow(ValidationError);
    await rejectResource(w.manager, exam.id, "Barème manquant");
    expect(await db.resource.findUniqueOrThrow({ where: { id: exam.id } })).toMatchObject({ approvalStatus: "REJECTED", rejectionReason: "Barème manquant" });
    expect(await db.notification.count({ where: { userId: w.author.id, message: { contains: "Barème manquant" } } })).toBe(1);
    expect(await sees(w.studentM1, exam.id, AFTER)).toBe(false);
  });

  it("un corrigé partagé entre enseignants seulement ne demande pas de validation", async () => {
    const solution = await make({ type: "SOLUTION", visibility: "TEACHERS" });
    expect(solution.approvalStatus).toBe("NOT_REQUIRED");
  });
});

describe("F22 — Notifications de publication", () => {
  it("prévient les personnes qui suivent l'EC et peuvent voir la ressource, une seule fois", async () => {
    const course = await make({ type: "COURSE", title: "Chapitre 3", publication: { mode: "now" } });
    expect(await dispatchPublicationNotifications(new Date(), [course.id])).toBeGreaterThan(0);
    expect(await notified(w.studentM1)).toBe(1); // inscrit au bon niveau
    expect(await notified(w.colleague)).toBe(1); // enseignant affecté à l'EC
    expect(await notified(w.author)).toBe(0); // pas l'auteur
    expect(await notified(w.studentM2)).toBe(0); // autre niveau
    expect(await notified(w.studentL1)).toBe(0); // autre formation
    expect(await notified(w.otherTeacher)).toBe(0); // ne suit pas l'EC

    expect(await dispatchPublicationNotifications(new Date())).toBe(0); // pas de doublon
    expect(await notified(w.studentM1)).toBe(1);
  });

  it("une publication programmée n'est notifiée qu'à sa date ; un examen seulement s'il est validé", async () => {
    const course = await make({ type: "COURSE", title: "Cours programmé" });
    const exam = await make();
    expect(await dispatchPublicationNotifications(BEFORE)).toBe(0);
    expect(await dispatchPublicationNotifications(AFTER, [exam.id])).toBe(0); // non validé
    await dispatchPublicationNotifications(AFTER, [course.id]);
    expect(await db.notification.count({ where: { resourceId: course.id, userId: w.studentM1.id } })).toBe(1);

    await approveResource(w.manager, exam.id);
    await dispatchPublicationNotifications(AFTER, [exam.id]);
    expect(await db.notification.count({ where: { resourceId: exam.id, userId: w.studentM1.id, message: { startsWith: "Nouvelle" } } })).toBe(1);
  });

  it("suivre ou ne plus suivre un EC change les destinataires (A10)", async () => {
    expect(await isFollowing(w.studentM1.id, w.ec["M-MIO-S1"])).toBe(true);
    expect(await isFollowing(w.otherTeacher.id, w.ec["M-MIO-S1"])).toBe(false);
    await setFollowing(w.studentM1, w.ec["M-MIO-S1"], false);
    await setFollowing(w.otherTeacher, w.ec["M-MIO-S1"], true);
    expect(await isFollowing(w.studentM1.id, w.ec["M-MIO-S1"])).toBe(false);

    const course = await make({ type: "COURSE", title: "Chapitre 4", publication: { mode: "now" } });
    await dispatchPublicationNotifications(new Date(), [course.id]);
    expect(await notified(w.studentM1)).toBe(0);
    expect(await notified(w.otherTeacher)).toBe(1);
  });

  it("regroupe les courriels par destinataire et respecte le choix de ne pas en recevoir", async () => {
    const mail = await import("@/server/mail");
    const spy = vi.spyOn(mail, "sendMail").mockResolvedValue();
    try {
      await db.user.update({ where: { id: w.colleague.id }, data: { emailNotifications: false } });
      for (const title of ["Chapitre 5", "Chapitre 6"]) {
        const r = await make({ type: "COURSE", title, publication: { mode: "now" } });
        await dispatchPublicationNotifications(new Date(), [r.id]);
      }
      const sent = await sendPendingNotificationEmails();
      const recipients = spy.mock.calls.map(([m]) => m.to);
      expect(recipients).toContain(w.studentM1.email);
      expect(recipients).not.toContain(w.colleague.email);
      expect(recipients.filter((to) => to === w.studentM1.email)).toHaveLength(1); // un seul courriel pour deux notifications
      expect(sent).toBe(recipients.length);
      expect(await sendPendingNotificationEmails()).toBe(0); // rien n'est renvoyé
    } finally {
      spy.mockRestore();
    }
  });
});

describe("F21 — Favoris", () => {
  it("ajoute, liste et retire des favoris ; une ressource devenue invisible disparaît de la liste", async () => {
    const r = await make({ type: "COURSE", title: "Favori", publication: { mode: "now" } });
    await setFavorite(w.studentM1, r.id, true);
    await setFavorite(w.studentM1, r.id, true); // idempotent
    expect((await listFavorites(w.studentM1)).map((f) => f.title)).toEqual(["Favori"]);
    await archiveResource(w.author, r.id);
    expect(await listFavorites(w.studentM1)).toEqual([]);
    await setFavorite(w.studentM1, r.id, false);
    expect(await db.favorite.count()).toBe(0);
  });

  it("on ne peut pas mettre en favori une ressource invisible", async () => {
    const r = await make({ type: "COURSE", title: "Brouillon", publication: { mode: "draft" } });
    await expect(setFavorite(w.studentM1, r.id, true)).rejects.toThrow(NotFoundError);
  });
});

describe("Tâche périodique /api/cron/notifications", () => {
  it("exige le secret partagé", async () => {
    process.env.CRON_SECRET = "secret-cron-de-test";
    const { POST } = await import("@/app/api/cron/notifications/route");
    expect((await POST(new Request("http://x/api/cron/notifications", { method: "POST" }))).status).toBe(401);
    expect((await POST(new Request("http://x", { method: "POST", headers: { authorization: "Bearer mauvais" } }))).status).toBe(401);
    const ok = await POST(new Request("http://x", { method: "POST", headers: { authorization: "Bearer secret-cron-de-test" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ notifications: 0, emails: 0, anonymized: 0 });
  });
});
