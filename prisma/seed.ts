/**
 * Données de démonstration (cahier des charges §10) : la formation Master MIO avec ses UE et EC,
 * un administrateur, deux enseignants (dont une responsable de formation), cinq étudiants
 * et une vingtaine de ressources (fichiers stockés selon STORAGE_DRIVER / STORAGE_LOCAL_DIR).
 *
 * Le script est idempotent : il peut être relancé sans créer de doublons.
 * Les intitulés des UE et EC sont fictifs et sont à remplacer par la maquette réelle.
 *
 * Usage : DEMO_PASSWORD=… npm run db:seed
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { PrismaClient, type ResourceType, type Role, type Visibility } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { LocalStorage } from "../src/server/storage/local";
import { makePdf } from "./demo-files";

const db = new PrismaClient();

const DEMO_DOMAIN = "uasz.test"; // domaine réservé (.test) : aucun courriel réel ne peut partir

interface DemoUser {
  firstName: string;
  lastName: string;
  login: string;
  roles: Role[];
}

const USERS: DemoUser[] = [
  { firstName: "Admin", lastName: "Plateforme", login: "admin", roles: ["ADMIN"] },
  { firstName: "Awa", lastName: "Diallo", login: "a.diallo", roles: ["TEACHER", "PROGRAM_MANAGER"] },
  { firstName: "Moussa", lastName: "Ndiaye", login: "m.ndiaye", roles: ["TEACHER"] },
  { firstName: "Fatou", lastName: "Sarr", login: "f.sarr", roles: ["STUDENT"] },
  { firstName: "Ibrahima", lastName: "Badji", login: "i.badji", roles: ["STUDENT"] },
  { firstName: "Mariama", lastName: "Diatta", login: "m.diatta", roles: ["STUDENT"] },
  { firstName: "Ousmane", lastName: "Sané", login: "o.sane", roles: ["STUDENT"] },
  { firstName: "Aminata", lastName: "Coly", login: "a.coly", roles: ["STUDENT"] },
];

/** Maquette : semestre → UE → EC (code, intitulé, crédits) ; `teacher` = identifiant de connexion. */
const CURRICULUM: Record<number, { code: string; title: string; credits: number; ecs: { code: string; title: string; credits: number; teacher?: string }[] }[]> = {
  1: [
    {
      code: "MIO111", title: "Mathématiques pour l'optimisation", credits: 10,
      ecs: [
        { code: "MIO1111", title: "Optimisation linéaire", credits: 5, teacher: "a.diallo" },
        { code: "MIO1112", title: "Analyse numérique", credits: 5, teacher: "m.ndiaye" },
      ],
    },
    {
      code: "MIO112", title: "Informatique", credits: 12,
      ecs: [
        { code: "MIO1121", title: "Programmation Python", credits: 6, teacher: "m.ndiaye" },
        { code: "MIO1122", title: "Bases de données", credits: 6, teacher: "m.ndiaye" },
      ],
    },
    { code: "MIO113", title: "Enseignements transversaux", credits: 8, ecs: [{ code: "MIO1131", title: "Anglais scientifique", credits: 8 }] },
  ],
  2: [
    {
      code: "MIO121", title: "Recherche opérationnelle", credits: 12,
      ecs: [
        { code: "MIO1211", title: "Optimisation combinatoire", credits: 6, teacher: "a.diallo" },
        { code: "MIO1212", title: "Théorie des graphes", credits: 6, teacher: "m.ndiaye" },
      ],
    },
    {
      code: "MIO122", title: "Statistique et données", credits: 12,
      ecs: [
        { code: "MIO1221", title: "Statistique inférentielle", credits: 6, teacher: "a.diallo" },
        { code: "MIO1222", title: "Apprentissage automatique", credits: 6 },
      ],
    },
    { code: "MIO123", title: "Professionnalisation", credits: 6, ecs: [{ code: "MIO1231", title: "Méthodologie de stage", credits: 6 }] },
  ],
  3: [{ code: "MIO231", title: "Optimisation avancée", credits: 30, ecs: [{ code: "MIO2311", title: "Optimisation non linéaire", credits: 15 }, { code: "MIO2312", title: "Programmation stochastique", credits: 15 }] }],
  4: [{ code: "MIO241", title: "Stage", credits: 30, ecs: [{ code: "MIO2411", title: "Mémoire de stage", credits: 30 }] }],
};

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error("Définir DEMO_PASSWORD (au moins 10 caractères) dans .env avant de lancer le seed.");
  }
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // Années universitaires : 2025-2026 (passée) et 2026-2027 (en cours).
  const previous = await db.academicYear.upsert({
    where: { label: "2025-2026" },
    update: {},
    create: { label: "2025-2026", startDate: new Date("2025-10-01"), endDate: new Date("2026-07-31") },
  });
  await db.academicYear.updateMany({ where: { isCurrent: true, NOT: { label: "2026-2027" } }, data: { isCurrent: null } });
  const current = await db.academicYear.upsert({
    where: { label: "2026-2027" },
    update: { isCurrent: true },
    create: { label: "2026-2027", startDate: new Date("2026-10-01"), endDate: new Date("2027-07-31"), isCurrent: true },
  });

  // Utilisateurs.
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const email = `${u.login}@${DEMO_DOMAIN}`;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        roles: { create: u.roles.map((role) => ({ role })) },
      },
    });
    userIds.set(u.login, user.id);
  }

  // Formation et semestres.
  const program = await db.program.upsert({
    where: { code: "M-MIO" },
    update: {},
    create: {
      code: "M-MIO",
      title: "Master MIO",
      cycle: "MASTER",
      semesters: { create: [1, 2, 3, 4].map((number) => ({ number })) },
    },
    include: { semesters: true },
  });
  await db.programManagerAssignment.upsert({
    where: { userId_programId: { userId: userIds.get("a.diallo")!, programId: program.id } },
    update: {},
    create: { userId: userIds.get("a.diallo")!, programId: program.id },
  });

  // UE, EC et affectations pour l'année en cours.
  for (const semester of program.semesters) {
    for (const ue of CURRICULUM[semester.number] ?? []) {
      const unit = await db.teachingUnit.upsert({
        where: { semesterId_code: { semesterId: semester.id, code: ue.code } },
        update: {},
        create: { semesterId: semester.id, code: ue.code, title: ue.title, credits: ue.credits },
      });
      for (const ec of ue.ecs) {
        const element = await db.courseElement.upsert({
          where: { teachingUnitId_code: { teachingUnitId: unit.id, code: ec.code } },
          update: {},
          create: { teachingUnitId: unit.id, code: ec.code, title: ec.title, credits: ec.credits },
        });
        if (ec.teacher) {
          const teacherId = userIds.get(ec.teacher)!;
          await db.teachingAssignment.upsert({
            where: {
              teacherId_courseElementId_academicYearId: { teacherId, courseElementId: element.id, academicYearId: current.id },
            },
            update: {},
            create: { teacherId, courseElementId: element.id, academicYearId: current.id },
          });
        }
      }
    }
  }

  // Inscriptions : les cinq étudiants en Master 1 pour l'année en cours.
  for (const u of USERS.filter((x) => x.roles.includes("STUDENT"))) {
    const studentId = userIds.get(u.login)!;
    await db.enrollment.upsert({
      where: { studentId_academicYearId: { studentId, academicYearId: current.id } },
      update: {},
      create: { studentId, programId: program.id, level: 1, academicYearId: current.id },
    });
  }

  const resourceCount = await seedResources(userIds, current.id, current.label);

  console.info(
    `Données de démonstration prêtes : ${USERS.length} comptes (@${DEMO_DOMAIN}), formation ${program.code}, ` +
      `années ${previous.label} et ${current.label} (en cours), ${resourceCount} ressources.`,
  );
}

// ─── Ressources de démonstration ───────────────────────────────────────────────

interface DemoResource {
  title: string;
  type: ResourceType;
  ec: string;
  author: string;
  keywords: string;
  description: string;
  visibility?: Visibility;
  status?: "DRAFT" | "PUBLISHED";
  link?: string;
  /** Jours avant (négatif) ou après (positif) aujourd'hui pour une publication programmée. */
  publishInDays?: number;
  approval?: "PENDING" | "APPROVED";
}

const RESOURCES: DemoResource[] = [
  { title: "Chapitre 1 — Programmation linéaire et méthode du simplexe", type: "COURSE", ec: "MIO1111", author: "a.diallo", keywords: "simplexe, programmation linéaire, base", description: "Forme standard, base réalisable, tableau du simplexe." },
  { title: "Chapitre 2 — Dualité", type: "COURSE", ec: "MIO1111", author: "a.diallo", keywords: "dualité, programme dual", description: "Construction du dual, théorèmes de dualité faible et forte." },
  { title: "TD 1 — Modélisation de problèmes linéaires", type: "TUTORIAL", ec: "MIO1111", author: "a.diallo", keywords: "modélisation, td", description: "Exercices de mise en équation." },
  { title: "TD 2 — Simplexe et dualité", type: "TUTORIAL", ec: "MIO1111", author: "a.diallo", keywords: "simplexe, dualité, td", description: "Application du simplexe ; interprétation du dual." },
  { title: "TP 1 — Résolution avec un solveur", type: "LAB", ec: "MIO1111", author: "a.diallo", keywords: "solveur, python, pulp", description: "Prise en main d'un solveur de programmation linéaire." },
  { title: "Démonstration du simplexe en vidéo", type: "VIDEO", ec: "MIO1111", author: "a.diallo", keywords: "simplexe, vidéo", description: "Vidéo de démonstration (lien externe).", link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { title: "Sujet d'examen — Optimisation linéaire (session 1)", type: "EXAM", ec: "MIO1111", author: "a.diallo", keywords: "examen, session 1", description: "Sujet de l'examen de fin de semestre.", publishInDays: 45, approval: "PENDING" },
  { title: "Notes de préparation du cours (brouillon)", type: "OTHER", ec: "MIO1111", author: "a.diallo", keywords: "préparation", description: "Brouillon non publié.", status: "DRAFT" },
  { title: "Analyse numérique — Chapitre 1 : erreurs et conditionnement", type: "COURSE", ec: "MIO1112", author: "m.ndiaye", keywords: "erreurs, conditionnement", description: "Arithmétique flottante, conditionnement d'un problème." },
  { title: "Analyse numérique — Chapitre 2 : résolution de systèmes linéaires", type: "COURSE", ec: "MIO1112", author: "m.ndiaye", keywords: "gauss, lu, systèmes linéaires", description: "Méthodes directes : Gauss, décomposition LU." },
  { title: "TD — Méthodes itératives", type: "TUTORIAL", ec: "MIO1112", author: "m.ndiaye", keywords: "jacobi, gauss-seidel", description: "Exercices sur les méthodes de Jacobi et Gauss-Seidel." },
  { title: "Python — Les bases du langage", type: "COURSE", ec: "MIO1121", author: "m.ndiaye", keywords: "python, bases, variables", description: "Types, structures de contrôle, fonctions." },
  { title: "Python — Programmation orientée objet", type: "COURSE", ec: "MIO1121", author: "m.ndiaye", keywords: "python, objet, classes", description: "Classes, héritage, méthodes spéciales." },
  { title: "TP — Manipulation de données avec pandas", type: "LAB", ec: "MIO1121", author: "m.ndiaye", keywords: "pandas, données, python", description: "Lecture, filtrage et agrégation de données." },
  { title: "Bases de données — Modèle relationnel", type: "COURSE", ec: "MIO1122", author: "m.ndiaye", keywords: "relationnel, sql, normalisation", description: "Modèle relationnel, clés, formes normales." },
  { title: "TD — Requêtes SQL", type: "TUTORIAL", ec: "MIO1122", author: "m.ndiaye", keywords: "sql, requêtes, jointures", description: "Sélections, jointures, agrégats." },
  { title: "Optimisation combinatoire — Introduction", type: "COURSE", ec: "MIO1211", author: "a.diallo", keywords: "combinatoire, complexité", description: "Problèmes combinatoires classiques et complexité.", publishInDays: 60 },
  { title: "Théorie des graphes — Plus courts chemins", type: "COURSE", ec: "MIO1212", author: "m.ndiaye", keywords: "graphes, dijkstra, bellman-ford", description: "Algorithmes de Dijkstra et de Bellman-Ford." },
  { title: "Statistique inférentielle — Estimation", type: "COURSE", ec: "MIO1221", author: "a.diallo", keywords: "estimation, intervalles de confiance", description: "Estimateurs, biais, intervalles de confiance." },
  { title: "Banque d'exercices partagée (enseignants)", type: "OTHER", ec: "MIO1111", author: "a.diallo", keywords: "exercices, banque", description: "Exercices réutilisables, partagés entre enseignants.", visibility: "TEACHERS" },
];

/** Crée les ressources de démonstration absentes, avec leur fichier et quelques consultations. */
async function seedResources(userIds: Map<string, string>, yearId: string, yearLabel: string): Promise<number> {
  const storage = new LocalStorage(path.resolve(process.env.STORAGE_LOCAL_DIR ?? "storage"));
  if (process.env.STORAGE_DRIVER === "s3") {
    console.warn("STORAGE_DRIVER=s3 : les fichiers de démonstration sont écrits dans le stockage local uniquement.");
  }
  const students = USERS.filter((u) => u.roles.includes("STUDENT")).map((u) => userIds.get(u.login)!);
  const now = Date.now();
  let index = 0;

  for (const demo of RESOURCES) {
    index += 1;
    const authorId = userIds.get(demo.author)!;
    const existing = await db.resource.findFirst({ where: { title: demo.title, authorId } });
    if (existing) continue;
    const ec = await db.courseElement.findFirstOrThrow({ where: { code: demo.ec } });

    let content: { storageKey?: string; externalUrl?: string; originalName?: string; mimeType?: string; format: string; sizeBytes?: number };
    if (demo.link) {
      content = { externalUrl: demo.link, format: "lien" };
    } else {
      const bytes = makePdf(demo.title, [demo.description, "", `EC : ${ec.title}`, "Document de démonstration — RessourcesPéda (UASZ)."]);
      const storageKey = `${yearLabel}/${randomUUID()}`;
      await storage.put(storageKey, Readable.toWeb(Readable.from(bytes)) as ReadableStream<Uint8Array>);
      const slug = demo.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase().slice(0, 60);
      content = { storageKey, originalName: `${slug}.pdf`, mimeType: "application/pdf", format: "pdf", sizeBytes: bytes.length };
    }

    const status = demo.status ?? "PUBLISHED";
    const publishAt =
      demo.publishInDays !== undefined ? new Date(now + demo.publishInDays * 86_400_000) : demo.type === "EXAM" ? new Date(now) : null;
    const resource = await db.resource.create({
      data: {
        title: demo.title,
        description: demo.description,
        type: demo.type,
        keywords: demo.keywords,
        status,
        visibility: demo.visibility ?? "EC_STUDENTS",
        publishAt: status === "PUBLISHED" ? publishAt : null,
        approvalStatus: demo.approval ?? "NOT_REQUIRED",
        everPublished: status === "PUBLISHED",
        authorId,
        academicYearId: yearId,
        createdAt: new Date(now - (30 - index) * 86_400_000),
        courseElements: { create: { courseElementId: ec.id } },
        versions: { create: { number: 1, comment: "Version initiale", authorId, ...content } },
      },
      include: { versions: true },
    });

    // Quelques consultations pour animer les statistiques (déterministe).
    if (status === "PUBLISHED" && !demo.publishInDays && (demo.visibility ?? "EC_STUDENTS") === "EC_STUDENTS") {
      const logs = students.flatMap((userId, s) =>
        (index + s) % 3 === 0 ? [] : [
          { userId, resourceId: resource.id, versionId: resource.versions[0].id, kind: "VIEW" as const, createdAt: new Date(now - ((index + s) % 20) * 86_400_000) },
          ...((index + s) % 2 === 0 ? [{ userId, resourceId: resource.id, versionId: resource.versions[0].id, kind: "DOWNLOAD" as const, createdAt: new Date(now - ((index + s) % 15) * 86_400_000) }] : []),
        ],
      );
      await db.accessLog.createMany({ data: logs });
    }
  }
  return db.resource.count();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
