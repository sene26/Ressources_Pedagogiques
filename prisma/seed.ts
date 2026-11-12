/**
 * Données de démonstration (cahier des charges §10) : la formation Master MIO avec ses UE et EC,
 * un administrateur, deux enseignants (dont une responsable de formation) et cinq étudiants.
 * Les ressources seront ajoutées au Lot 2.
 *
 * Le script est idempotent : il peut être relancé sans créer de doublons.
 * Les intitulés des UE et EC sont fictifs et sont à remplacer par la maquette réelle.
 *
 * Usage : DEMO_PASSWORD=… npm run db:seed
 */
import "dotenv/config";
import { PrismaClient, type Role } from "@prisma/client";
import { hash } from "@node-rs/argon2";

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

  console.info(
    `Données de démonstration prêtes : ${USERS.length} comptes (@${DEMO_DOMAIN}), formation ${program.code}, ` +
      `années ${previous.label} et ${current.label} (en cours).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
