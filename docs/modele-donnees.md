# Modèle de données — RessourcesPéda

Ce modèle reprend les entités du cahier des charges (§6). Il ajoute celles qu'exigent les fonctionnalités et les solutions proposées dans [`ambiguites.md`](ambiguites.md), marquées ➕ ci-dessous.
Les noms de tables et de champs sont en anglais (convention de code) ; la correspondance avec les termes français est donnée au §3.

## 1. Diagramme entité-association

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : "possède"
    USER ||--o{ TEACHING_ASSIGNMENT : "est affecté"
    USER ||--o{ ENROLLMENT : "est inscrit"
    USER ||--o{ PROGRAM_MANAGER_ASSIGNMENT : "est responsable"
    USER ||--o{ RESOURCE : "est auteur"
    USER ||--o{ RESOURCE_VERSION : "dépose"
    USER ||--o{ ACCESS_LOG : "consulte"
    USER ||--o{ FAVORITE : "met en favori"
    USER ||--o{ EC_SUBSCRIPTION : "suit"
    USER ||--o{ NOTIFICATION : "reçoit"
    USER ||--o{ AUDIT_LOG : "agit"

    PROGRAM ||--|{ SEMESTER : "comprend"
    PROGRAM ||--o{ ENROLLMENT : "accueille"
    PROGRAM ||--o{ PROGRAM_MANAGER_ASSIGNMENT : "est gérée par"
    SEMESTER ||--|{ TEACHING_UNIT : "comprend"
    TEACHING_UNIT ||--|{ COURSE_ELEMENT : "comprend"

    ACADEMIC_YEAR ||--o{ TEACHING_ASSIGNMENT : "concerne"
    ACADEMIC_YEAR ||--o{ ENROLLMENT : "concerne"
    ACADEMIC_YEAR ||--o{ RESOURCE : "concerne"

    COURSE_ELEMENT ||--o{ TEACHING_ASSIGNMENT : "est enseigné par"
    COURSE_ELEMENT ||--o{ RESOURCE_EC : "regroupe"
    COURSE_ELEMENT ||--o{ EC_SUBSCRIPTION : "est suivi par"
    RESOURCE ||--|{ RESOURCE_EC : "est rattachée à (RG1)"
    RESOURCE ||--|{ RESOURCE_VERSION : "a des versions (RG6)"
    RESOURCE ||--o{ ACCESS_LOG : "est consultée (RG10)"
    RESOURCE ||--o{ FAVORITE : "est favorite"

    USER {
        uuid id PK
        string lastName
        string firstName
        string email UK
        string passwordHash
        string phone
        string photoKey
        bool active
        bool emailNotifications
    }
    USER_ROLE {
        uuid userId FK
        enum role "STUDENT|TEACHER|PROGRAM_MANAGER|ADMIN"
    }
    PROGRAM {
        uuid id PK
        string code UK
        string title
        enum cycle "LICENCE|MASTER"
        bool archived
    }
    SEMESTER {
        uuid id PK
        int number "1..6 ; niveau = ceil(number/2)"
        uuid programId FK
    }
    TEACHING_UNIT {
        uuid id PK
        string code
        string title
        int credits
        uuid semesterId FK
        bool archived
    }
    COURSE_ELEMENT {
        uuid id PK
        string code
        string title
        int credits
        uuid teachingUnitId FK
        bool archived
    }
    ACADEMIC_YEAR {
        uuid id PK
        string label UK "2025-2026"
        date startDate
        date endDate
        bool isCurrent "une seule à true"
    }
    TEACHING_ASSIGNMENT {
        uuid teacherId FK
        uuid courseElementId FK
        uuid academicYearId FK
    }
    ENROLLMENT {
        uuid studentId FK
        uuid programId FK
        int level "1..3"
        uuid academicYearId FK
    }
    PROGRAM_MANAGER_ASSIGNMENT {
        uuid userId FK
        uuid programId FK
    }
    RESOURCE {
        uuid id PK
        string title
        text description
        enum type "COURSE|TUTORIAL|LAB|EXAM|SOLUTION|VIDEO|LINK|OTHER"
        string[] keywords
        enum status "DRAFT|PUBLISHED|ARCHIVED"
        enum visibility "PRIVATE|TEACHERS|EC_STUDENTS"
        datetime publishAt
        enum approvalStatus "NOT_REQUIRED|PENDING|APPROVED|REJECTED"
        uuid approvedById FK
        text rejectionReason
        bool everPublished
        uuid authorId FK
        uuid academicYearId FK
        uuid duplicatedFromId FK
        tsvector searchVector
        datetime createdAt
        datetime updatedAt
    }
    RESOURCE_EC {
        uuid resourceId FK
        uuid courseElementId FK
    }
    RESOURCE_VERSION {
        uuid id PK
        uuid resourceId FK
        int number "unique par ressource"
        string storageKey "ou null si lien"
        string externalUrl "ou null si fichier"
        string originalName
        string mimeType
        string format "pdf, mp4, py…"
        bigint sizeBytes
        string comment
        uuid authorId FK
        datetime createdAt
    }
    ACCESS_LOG {
        uuid id PK
        uuid userId FK "null après anonymisation"
        uuid resourceId FK
        uuid versionId FK
        enum kind "VIEW|DOWNLOAD"
        datetime createdAt
    }
    FAVORITE {
        uuid userId FK
        uuid resourceId FK
        datetime createdAt
    }
    EC_SUBSCRIPTION {
        uuid userId FK
        uuid courseElementId FK
        bool muted
    }
    NOTIFICATION {
        uuid id PK
        uuid userId FK
        uuid resourceId FK
        string message
        datetime readAt
        datetime emailedAt
        datetime createdAt
    }
    AUDIT_LOG {
        uuid id PK
        uuid actorId FK
        string action "RESOURCE_CREATED, RESOURCE_PUBLISHED…"
        string entityType
        uuid entityId
        json details
        datetime createdAt
    }
```

Entité technique non représentée : `PasswordResetToken` (userId, tokenHash, expiresAt, usedAt). Les entités d'Auth.js ne sont pas nécessaires : la session est stockée en JWT.

## 2. Contraintes et index

| Table | Contrainte / index | Raison |
| --- | --- | --- |
| `User` | `email` unique (insensible à la casse, via `citext` ou stockage en minuscules) | F1 |
| `UserRole` | clé primaire (`userId`, `role`) | plusieurs rôles par utilisateur (F2) |
| `Semester` | unique (`programId`, `number`) | RG1 |
| `TeachingUnit`, `CourseElement` | unique (`semesterId`, `code`) / (`teachingUnitId`, `code`) | codes uniques dans leur parent |
| `AcademicYear` | index unique partiel `WHERE is_current` | une seule année en cours (A16) |
| `TeachingAssignment` | clé primaire (`teacherId`, `courseElementId`, `academicYearId`) | RG2 |
| `Enrollment` | unique (`studentId`, `academicYearId`) | un étudiant a une seule inscription par an |
| `ResourceEc` | clé primaire (`resourceId`, `courseElementId`) ; ≥ 1 ligne par ressource, vérifié par le service | RG1 |
| `ResourceVersion` | unique (`resourceId`, `number`) ; CHECK (`storageKey` IS NOT NULL) XOR (`externalUrl` IS NOT NULL) ; CHECK `sizeBytes ≤ 100 Mo` | RG6, RG8 |
| `Resource` | index GIN sur `searchVector` ; index (`status`, `visibility`, `academicYearId`) ; index `authorId` | F18, F19, performance |
| `AccessLog` | index (`resourceId`, `kind`, `createdAt`) | statistiques F23, F24 |
| `Favorite` | clé primaire (`userId`, `resourceId`) | F21 |
| `AuditLog` | index (`entityType`, `entityId`), index `createdAt` | F25 |

**Suppressions.** Pas de suppression en cascade sur les ressources publiées : l'archivage est logique (RG9). La suppression définitive par l'administrateur supprime en cascade les versions, `ResourceEc`, les favoris et les notifications, ainsi que les fichiers du stockage. Les `AccessLog` sont conservés avec `resourceId` mis à null, pour garder les totaux.

## 3. Correspondance avec le cahier des charges

| Cahier des charges | Modèle | Remarque |
| --- | --- | --- |
| Utilisateur | `User` + `UserRole` | rôles multiples (F2) ; `photoKey` et `emailNotifications` pour F4 et F22 |
| Formation (niveau Licence/Master) | `Program.cycle` | le « niveau » d'étude est porté par l'inscription (A1) |
| Semestre | `Semester` | |
| UE | `TeachingUnit` | |
| EC | `CourseElement` | |
| AnneeUniversitaire | `AcademicYear` | |
| Affectation | `TeachingAssignment` | |
| Inscription | `Enrollment` | |
| Ressource | `Resource` + `ResourceEc` | ➕ `approvalStatus` (RG5, A5), `everPublished` (A7), `duplicatedFromId` (F15) |
| Version | `ResourceVersion` | |
| Consultation | `AccessLog` | `kind` = `VIEW` / `DOWNLOAD` |
| Favori | `Favorite` | |
| ➕ Responsable ↔ formation | `ProgramManagerAssignment` | A3 |
| ➕ EC suivi | `EcSubscription` | F22, A10 |
| ➕ Notification | `Notification` | F22 |
| ➕ Journal | `AuditLog` | F25 |
| ➕ Réinitialisation du mot de passe | `PasswordResetToken` | F1 |
| (F16, priorité C) Commentaires et notes | `ResourceComment`, `ResourceRating` | reportés après la version 1, sauf avis contraire |

## 4. Valeurs des énumérations et libellés français

| Enum | Valeur | Libellé affiché |
| --- | --- | --- |
| `Role` | `STUDENT` / `TEACHER` / `PROGRAM_MANAGER` / `ADMIN` | Étudiant / Enseignant / Responsable de formation / Administrateur |
| `ResourceType` | `COURSE` / `TUTORIAL` / `LAB` / `EXAM` / `SOLUTION` / `VIDEO` / `LINK` / `OTHER` | Cours / TD / TP / Sujet d'examen / Corrigé / Vidéo / Lien / Autre |
| `ResourceStatus` | `DRAFT` / `PUBLISHED` / `ARCHIVED` | Brouillon / Publiée (ou « Programmée » si `publishAt` est dans le futur) / Archivée |
| `Visibility` | `PRIVATE` / `TEACHERS` / `EC_STUDENTS` | Privée / Enseignants / Étudiants de l'EC |
| `ApprovalStatus` | `NOT_REQUIRED` / `PENDING` / `APPROVED` / `REJECTED` | — / En attente de validation / Validée / Refusée |
| `AccessKind` | `VIEW` / `DOWNLOAD` | Consultation / Téléchargement |

## 5. Calcul de la visibilité étudiante (RG3, RG4, RG5, RG7)

Expression du filtre `visibleResourcesWhere` pour un étudiant, sous forme de pseudo-SQL :

```sql
r.status = 'PUBLISHED'
AND r.visibility = 'EC_STUDENTS'
AND (r.publish_at IS NULL OR r.publish_at <= now())
AND r.academic_year_id = :currentYearId
AND (r.type NOT IN ('EXAM','SOLUTION') OR r.approval_status = 'APPROVED')
AND EXISTS (
  SELECT 1
  FROM resource_ec re
  JOIN course_element ce ON ce.id = re.course_element_id
  JOIN teaching_unit tu ON tu.id = ce.teaching_unit_id
  JOIN semester s ON s.id = tu.semester_id
  JOIN enrollment e ON e.program_id = s.program_id
  WHERE re.resource_id = r.id
    AND e.student_id = :userId
    AND e.academic_year_id = :currentYearId
    AND e.level = CEIL(s.number / 2.0)
)
```

Pour les ressources de type `EXAM` et `SOLUTION`, `publishAt` est obligatoire (A5) : la condition `publish_at IS NULL` ne s'applique jamais à eux.
