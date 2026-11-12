# Diagrammes UML — RessourcesPéda

Tous les diagrammes sont en Mermaid : GitHub et la plupart des éditeurs Markdown les affichent directement.
Mermaid n'a pas de type « cas d'utilisation » natif. Le diagramme de cas d'utilisation est donc dessiné en `flowchart`, avec les conventions UML : acteurs à gauche, cas d'utilisation en ovales, `«include»` et `«extend»` en pointillés.

## 1. Diagramme de cas d'utilisation

### 1.1 Héritage entre acteurs

Les rôles se cumulent (F2). Le responsable de formation est un enseignant doté de droits supplémentaires. L'administrateur a tous les droits du responsable sur toutes les formations (A3).

```mermaid
flowchart BT
    Etudiant([👤 Étudiant]) --> Utilisateur([👤 Utilisateur authentifié])
    Enseignant([👤 Enseignant]) --> Utilisateur
    Responsable([👤 Responsable de formation]) --> Enseignant
    Admin([👤 Administrateur]) --> Responsable
```

### 1.2 Cas d'utilisation par acteur

Un diagramme par acteur, pour la lisibilité. Chaque acteur hérite aussi des cas des acteurs qu'il spécialise (§1.1).

#### Visiteur et étudiant

```mermaid
flowchart LR
    Visiteur([👤 Visiteur])
    Etudiant([👤 Étudiant])
    subgraph S["RessourcesPéda"]
        direction TB
        UC1([Se connecter — F1])
        UC2([Réinitialiser son mot de passe — F1])
        UC3([Gérer son profil — F4])
        UC10([Consulter « Mes cours » — F20])
        UC11([Naviguer formation › semestre › UE › EC — F17])
        UC12([Rechercher et filtrer — F18, F19])
        UC13([Consulter une ressource])
        UC14([Prévisualiser — F12])
        UC15([Télécharger])
        UC16([Gérer ses favoris — F21])
        UC17([Suivre un EC, recevoir des notifications — F22])
        UC18([Enregistrer la consultation — RG10])
    end
    Visiteur --> UC1
    Visiteur --> UC2
    Etudiant --> UC3
    Etudiant --> UC10
    Etudiant --> UC11
    Etudiant --> UC12
    Etudiant --> UC13
    Etudiant --> UC16
    Etudiant --> UC17
    UC14 -.->|«extend»| UC13
    UC15 -.->|«extend»| UC13
    UC13 -.->|«include»| UC18
    UC15 -.->|«include»| UC18
```

#### Enseignant

L'enseignant dispose aussi des cas de consultation : profil, navigation, recherche, consultation, favoris, suivi d'EC.

```mermaid
flowchart LR
    Enseignant([👤 Enseignant])
    subgraph S["RessourcesPéda"]
        direction TB
        UC20([Déposer une ressource — F9])
        UC21([Modifier une ressource — F10])
        UC22([Déposer une nouvelle version — F10])
        UC23([Publier / dépublier / archiver — F11])
        UC24([Programmer la publication — F13])
        UC25([Dupliquer une ressource — F15])
        UC26([Consulter l'historique des versions — RG6])
        UC28([Consulter son tableau de bord — F23])
        UC27([Valider un sujet ou un corrigé — F14])
    end
    Enseignant --> UC20
    Enseignant --> UC21
    Enseignant --> UC23
    Enseignant --> UC25
    Enseignant --> UC26
    Enseignant --> UC28
    UC22 -.->|«extend»| UC21
    UC24 -.->|«extend»| UC23
    UC23 -.->|«include» si examen ou corrigé| UC27
```

#### Responsable de formation

```mermaid
flowchart LR
    Responsable([👤 Responsable de formation])
    subgraph S["RessourcesPéda — sur ses formations"]
        direction TB
        UC27([Valider ou refuser un sujet / corrigé — F14])
        UC30([Gérer la maquette : semestres, UE, EC — F5])
        UC31([Affecter les enseignants aux EC — F6])
        UC32([Consulter les statistiques de la formation — F24])
        UC33([Exporter les statistiques CSV — F26])
        UC26([Consulter l'historique des versions — RG6])
    end
    Responsable --> UC27
    Responsable --> UC30
    Responsable --> UC31
    Responsable --> UC32
    Responsable --> UC26
    UC33 -.->|«extend»| UC32
```

#### Administrateur et planificateur

```mermaid
flowchart LR
    Admin([👤 Administrateur])
    Cron([⏱ Planificateur])
    subgraph S["RessourcesPéda"]
        direction TB
        UC40([Gérer les comptes et les rôles — F2])
        UC41([Importer des utilisateurs CSV — F3])
        UC42([Gérer les formations et les années universitaires — F5])
        UC43([Inscrire les étudiants — F7])
        UC44([Consulter le journal des actions — F25])
        UC45([Supprimer définitivement une ressource — RG9])
        UC46([Importer une maquette — F8])
        UC50([Envoyer les notifications programmées — F22])
        UC51([Sauvegarder base et fichiers])
    end
    Admin --> UC40
    Admin --> UC42
    Admin --> UC43
    Admin --> UC44
    Admin --> UC45
    UC41 -.->|«extend»| UC40
    UC46 -.->|«extend»| UC42
    Cron --> UC50
    Cron --> UC51
```

## 2. Diagramme de classes (domaine)

```mermaid
classDiagram
    direction LR

    class User {
        +UUID id
        +String lastName
        +String firstName
        +String email
        -String passwordHash
        +String phone
        +String photoKey
        +Boolean active
        +Boolean emailNotifications
        +Role[] roles
        +hasRole(role) Boolean
    }
    class Role {
        <<enumeration>>
        STUDENT
        TEACHER
        PROGRAM_MANAGER
        ADMIN
    }

    class Program {
        +UUID id
        +String code
        +String title
        +Cycle cycle
        +Boolean archived
        +maxLevel() Int
    }
    class Cycle {
        <<enumeration>>
        LICENCE
        MASTER
    }
    class Semester {
        +UUID id
        +Int number
        +level() Int
    }
    class TeachingUnit {
        +UUID id
        +String code
        +String title
        +Int credits
        +Boolean archived
    }
    class CourseElement {
        +UUID id
        +String code
        +String title
        +Int credits
        +Boolean archived
    }
    class AcademicYear {
        +UUID id
        +String label
        +Date startDate
        +Date endDate
        +Boolean isCurrent
    }

    class TeachingAssignment
    class Enrollment {
        +Int level
    }
    class ProgramManagerAssignment

    class Resource {
        +UUID id
        +String title
        +String description
        +ResourceType type
        +String[] keywords
        +ResourceStatus status
        +Visibility visibility
        +DateTime publishAt
        +ApprovalStatus approvalStatus
        +String rejectionReason
        +Boolean everPublished
        +DateTime createdAt
        +DateTime updatedAt
        +currentVersion() ResourceVersion
        +requiresApproval() Boolean
        +isScheduled(now) Boolean
        +publish(publishAt)
        +unpublish()
        +archive()
    }
    class ResourceType {
        <<enumeration>>
        COURSE
        TUTORIAL
        LAB
        EXAM
        SOLUTION
        VIDEO
        LINK
        OTHER
    }
    class ResourceStatus {
        <<enumeration>>
        DRAFT
        PUBLISHED
        ARCHIVED
    }
    class Visibility {
        <<enumeration>>
        PRIVATE
        TEACHERS
        EC_STUDENTS
    }
    class ApprovalStatus {
        <<enumeration>>
        NOT_REQUIRED
        PENDING
        APPROVED
        REJECTED
    }
    class ResourceVersion {
        +UUID id
        +Int number
        +String storageKey
        +String externalUrl
        +String originalName
        +String mimeType
        +String format
        +Long sizeBytes
        +String comment
        +DateTime createdAt
        +isExternalLink() Boolean
    }
    class AccessLog {
        +UUID id
        +AccessKind kind
        +DateTime createdAt
    }
    class AccessKind {
        <<enumeration>>
        VIEW
        DOWNLOAD
    }
    class Favorite {
        +DateTime createdAt
    }
    class EcSubscription {
        +Boolean muted
    }
    class Notification {
        +UUID id
        +String message
        +DateTime readAt
        +DateTime emailedAt
    }
    class AuditLog {
        +UUID id
        +String action
        +String entityType
        +UUID entityId
        +Json details
        +DateTime createdAt
    }

    User "1" --> "1..*" Role : roles
    Program "1" *-- "1..*" Semester
    Semester "1" *-- "1..*" TeachingUnit
    TeachingUnit "1" *-- "1..*" CourseElement
    Program --> Cycle

    TeachingAssignment "*" --> "1" User : teacher
    TeachingAssignment "*" --> "1" CourseElement
    TeachingAssignment "*" --> "1" AcademicYear
    Enrollment "*" --> "1" User : student
    Enrollment "*" --> "1" Program
    Enrollment "*" --> "1" AcademicYear
    ProgramManagerAssignment "*" --> "1" User : manager
    ProgramManagerAssignment "*" --> "1" Program

    Resource "*" --> "1" User : author
    Resource "*" --> "1..*" CourseElement : courseElements (RG1)
    Resource "*" --> "1" AcademicYear
    Resource "*" --> "0..1" User : approvedBy
    Resource "*" --> "0..1" Resource : duplicatedFrom
    Resource "1" *-- "1..*" ResourceVersion : versions (RG6)
    ResourceVersion "*" --> "1" User : uploadedBy
    Resource --> ResourceType
    Resource --> ResourceStatus
    Resource --> Visibility
    Resource --> ApprovalStatus

    AccessLog "*" --> "0..1" User
    AccessLog "*" --> "1" Resource
    AccessLog --> AccessKind
    Favorite "*" --> "1" User
    Favorite "*" --> "1" Resource
    EcSubscription "*" --> "1" User
    EcSubscription "*" --> "1" CourseElement
    Notification "*" --> "1" User
    Notification "*" --> "1" Resource
    AuditLog "*" --> "1" User : actor
```

### Classes de service et de politique (architecture)

```mermaid
classDiagram
    direction LR
    class ResourcePolicy {
        <<module>>
        +visibleResourcesWhere(user, now) WhereInput
        +canViewResource(user, resource, now) Boolean
        +canViewVersionHistory(user, resource) Boolean
        +canUploadToEc(user, ecIds, yearId) Boolean
        +canEditResource(user, resource) Boolean
        +canApprove(user, resource) Boolean
        +canHardDelete(user) Boolean
    }
    class ResourceService {
        +create(user, input) Resource
        +update(user, id, input) Resource
        +addVersion(user, id, file, comment) ResourceVersion
        +publish(user, id, publishAt) Resource
        +unpublish(user, id) Resource
        +archive(user, id) Resource
        +hardDelete(user, id)
        +duplicate(user, id, target) Resource
    }
    class ApprovalService {
        +listPending(user) Resource[]
        +approve(user, id)
        +reject(user, id, reason)
    }
    class SearchService {
        +search(user, query, filters, cursor) Page
    }
    class AccessLogService {
        +record(user, resource, version, kind)
    }
    class FileService {
        +issueToken(user, versionId) String
        +resolveToken(token) VersionAccess
    }
    class StorageDriver {
        <<interface>>
        +put(key, stream, meta)
        +get(key, range) Stream
        +delete(key)
        +presignedUrl(key, ttl) String
    }
    class LocalStorage
    class S3Storage
    class AuditService {
        +log(tx, actor, action, entity, details)
    }

    ResourceService ..> ResourcePolicy
    ResourceService ..> StorageDriver
    ResourceService ..> AuditService
    ApprovalService ..> ResourcePolicy
    ApprovalService ..> AuditService
    SearchService ..> ResourcePolicy
    FileService ..> ResourcePolicy
    FileService ..> AccessLogService
    FileService ..> StorageDriver
    StorageDriver <|.. LocalStorage
    StorageDriver <|.. S3Storage
```

## 3. Cycle de vie d'une ressource

```mermaid
stateDiagram-v2
    [*] --> Brouillon : déposer (F9)
    Brouillon --> Brouillon : modifier / nouvelle version (F10)
    Brouillon --> [*] : supprimer (jamais publiée — A7)
    Brouillon --> Publiée : publier (F11)

    state Publiée {
        [*] --> Programmée : publishAt > maintenant
        [*] --> EnLigne : publishAt ≤ maintenant
        Programmée --> EnLigne : date atteinte (F13)
        state "En ligne" as EnLigne
    }

    Publiée --> Brouillon : dépublier (F11)
    Publiée --> Archivée : archiver / « supprimer » (RG9)
    Brouillon --> Archivée : archiver
    Archivée --> Brouillon : restaurer
    Archivée --> [*] : suppression définitive (administrateur, RG9)
```

### Validation des sujets d'examen et corrigés (RG5, F14)

```mermaid
stateDiagram-v2
    [*] --> NonRequise : type ∉ {EXAM, SOLUTION}
    [*] --> EnAttente : publication d'un EXAM / SOLUTION visible des étudiants
    EnAttente --> Validée : le responsable valide
    EnAttente --> Refusée : le responsable refuse (motif)
    Refusée --> EnAttente : l'auteur corrige et republie
    Validée --> EnAttente : nouvelle version déposée
    state "Non requise" as NonRequise
    state "En attente" as EnAttente
```

Un étudiant ne voit la ressource que si elle est **Validée** et que sa date de publication est **atteinte**.

## 4. Diagrammes de séquence

### 4.1 Dépôt d'une ressource (F9)

```mermaid
sequenceDiagram
    actor E as Enseignant
    participant UI as Page « Déposer »
    participant SA as Server Action
    participant RS as ResourceService
    participant P as ResourcePolicy
    participant ST as StorageDriver
    participant DB as PostgreSQL

    E->>UI: remplit le formulaire + fichier
    UI->>SA: envoi (multipart, flux)
    SA->>SA: validation Zod (champs)
    SA->>RS: create(user, input, file)
    RS->>P: canUploadToEc(user, ecIds, year)
    alt non affecté à l'un des EC (RG2)
        P-->>RS: false
        RS-->>UI: « Vous n'êtes pas affecté(e) à cet EC. »
    else autorisé
        RS->>RS: contrôle taille ≤ 100 Mo, extension, signature (RG8)
        RS->>ST: put(clé aléatoire, flux)
        RS->>DB: transaction : Resource, ResourceEc, Version n°1, AuditLog
        alt échec base de données
            RS->>ST: delete(clé) — pas de fichier orphelin
        end
        RS-->>UI: redirection vers la fiche
    end
```

### 4.2 Téléchargement contrôlé (RG2–RG7, RG10)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant Page as Fiche ressource
    participant FS as FileService
    participant P as ResourcePolicy
    participant API as /api/files/[token]
    participant L as AccessLogService
    participant ST as StorageDriver

    U->>Page: ouvre la fiche
    Page->>P: canViewResource(user, r, now)
    alt refusé
        Page-->>U: 404 « Ressource introuvable » (on ne révèle pas son existence)
    else autorisé
        Page->>L: record(VIEW)
        Page->>FS: issueToken(user, versionId) — HMAC, 10 min
        Page-->>U: page + lien /api/files/<jeton>
        U->>API: GET /api/files/<jeton>
        API->>FS: resolveToken (signature, expiration, utilisateur = session)
        API->>P: canViewResource (revérification)
        API->>L: record(DOWNLOAD)
        API->>ST: get(clé, Range) ou URL pré-signée S3
        API-->>U: flux du fichier
    end
```
