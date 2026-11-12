# CLAUDE.md — RessourcesPéda

Plateforme web de gestion des ressources pédagogiques de l'Université Assane Seck de Ziguinchor (UASZ).
Porteuse du projet : Dr Jeanne Pia Malick SENE.
Cahier des charges complet : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).

## Objectif

Centraliser, partager, retrouver, versionner et suivre l'usage des ressources pédagogiques (cours, TD, TP,
examens, corrigés, vidéos, liens). Elles sont organisées selon la maquette : formation → semestre → UE → EC.
L'application doit rester utilisable sur téléphone et avec une connexion lente (3G).

## Acteurs (un utilisateur peut cumuler plusieurs rôles)

- **Étudiant** (`STUDENT`) : consulte les ressources publiées des EC de sa formation et de son niveau, pour l'année en cours.
- **Enseignant** (`TEACHER`) : dépose, versionne et publie des ressources dans les EC qui lui sont affectés ; consulte les ressources partagées.
- **Responsable de formation** (`PROGRAM_MANAGER`) : gère la maquette de sa formation, valide les sujets d'examen et les corrigés, consulte les statistiques.
- **Administrateur** (`ADMIN`) : gère les comptes, les rôles, les formations, les paramètres et les sauvegardes.

## Règles de gestion (à respecter et à tester)

- **RG1** Toute ressource est rattachée à ≥ 1 EC ; EC → UE → Semestre → Formation.
- **RG2** Seuls les enseignants affectés à un EC (pour l'année de la ressource) peuvent y déposer ; tout enseignant voit les ressources de visibilité `TEACHERS`.
- **RG3** Statut : `DRAFT` (Brouillon), `PUBLISHED` (Publiée), `ARCHIVED` (Archivée). Seules les `PUBLISHED` sont visibles des étudiants.
- **RG4** Visibilité : `PRIVATE` (auteur seul), `TEACHERS` (tous les enseignants), `EC_STUDENTS` (étudiants inscrits dans la formation et le niveau de l'EC).
- **RG5** Les types `EXAM` et `SOLUTION` ne sont visibles des étudiants qu'après la date de publication **et** la validation du responsable de formation.
- **RG6** Changer le fichier d'une ressource crée une nouvelle version ; les versions précédentes restent consultables par l'auteur et le responsable.
- **RG7** Un étudiant ne voit que les ressources de sa formation et de son niveau pour l'année universitaire en cours.
- **RG8** 100 Mo maximum par fichier ; formats : PDF, DOCX, PPTX, XLSX, ODT, ZIP, MP4, MP3, PNG, JPG, TXT, code source ; vidéos aussi par lien externe.
- **RG9** Supprimer une ressource publiée = l'archiver (suppression logique) ; seul l'administrateur supprime définitivement.
- **RG10** Chaque vue et chaque téléchargement est enregistré (utilisateur, ressource, date).

Les interprétations retenues pour les points ambigus sont dans [`docs/ambiguites.md`](docs/ambiguites.md). Elles font foi une fois validées.

## Choix techniques

- **Next.js** (App Router) + **TypeScript** strict, application full-stack.
- **MariaDB** (≥ 10.11 LTS) + **Prisma** (fournisseur `mysql`) ; recherche plein texte par index `FULLTEXT` InnoDB, en interclassement `utf8mb4_unicode_ci` (insensible à la casse et aux accents). Choix de la porteuse du projet (A17).
- **Auth.js** (NextAuth v5), fournisseur « identifiants » ; mots de passe hachés avec **argon2**.
- **Stockage des fichiers** : interface `StorageDriver`, avec une implémentation locale (développement) et une implémentation S3 (production).
- **Tailwind CSS** ; composants accessibles (HTML sémantique, labels, focus visible).
- **Zod** pour valider toutes les entrées (formulaires, Server Actions, routes).
- **Vitest** (unitaires et intégration, base de test MariaDB) ; **Playwright** (quelques parcours de bout en bout).
- **Docker** + `docker-compose.yml` (application, MariaDB, sauvegarde).

Architecture détaillée : [`docs/architecture.md`](docs/architecture.md). Modèle de données : [`docs/modele-donnees.md`](docs/modele-donnees.md).

## Conventions

- **Langues** : interface, messages d'erreur, documentation et messages de commit en **français** ; code (identifiants, noms de fichiers, enums) en **anglais**.
- **Contrôle d'accès** : toujours vérifié côté serveur, par les fonctions centralisées de `src/server/policies/`. Ne jamais filtrer seulement côté client. Les listes utilisent le même filtre Prisma que la vérification unitaire (`visibleResourcesWhere`, `canViewResource`).
- **Couches** : les pages et les Server Actions appellent les services (`src/server/services/`). Seuls les services accèdent à Prisma ; ils appliquent les politiques d'accès.
- **Fichiers** : ne jamais exposer le chemin de stockage. Les téléchargements passent par `/api/files/[token]` (jeton signé, avec expiration) ou par une URL S3 pré-signée.
- **Secrets** : uniquement dans des variables d'environnement ; tenir `.env.example` à jour ; ne jamais commiter `.env`.
- **Faible débit** : pagination côté serveur (20 éléments par défaut), pas de bibliothèque front lourde, images optimisées, aperçus chargés à la demande.
- **Tests** : chaque règle de gestion RG1 à RG10 a au moins un test nommé `RGx — …`. Un lot n'est terminé que si `npm test` passe.
- **Code** : commenter le *pourquoi* ; fonctions courtes ; pas de `any`.

## Méthode de travail

1. Un lot à la fois, dans l'ordre (0 → 6). Chaque lot a sa branche et sa pull request.
2. Chaque lot commence par un plan court (fichiers à créer, étapes, tests prévus).
3. Les tests s'écrivent en même temps que le code.
4. S'arrêter à la fin de chaque lot pour validation par la porteuse du projet.
5. Signaler toute ambiguïté et proposer une solution, sans deviner (ajouter le point à `docs/ambiguites.md`).

## État d'avancement

| Lot | Contenu | État |
| --- | --- | --- |
| 0 | Conception | Validé (propositions par défaut, MariaDB) |
| 1 | Socle (F1, F2, F5–F7) | Terminé |
| 2 | Ressources (F9–F11) | Terminé |
| 3 | Consultation (F12, F17–F20) | Terminé |
| 4 | Examens et notifications (F13, F14, F21, F22) | À faire |
| 5 | Pilotage (F3, F4, F15, F23–F25) | À faire |
| 6 | Finalisation | À faire |

## Commandes

```bash
npm run dev            # serveur de développement (http://localhost:3000)
npm run build          # compilation de production
npm run lint           # ESLint
npm run typecheck      # vérification TypeScript
npm test               # Vitest : unitaires + intégration (base MariaDB de .env.test)
npm run test:e2e       # Playwright : compile l'app et la lance sur le port 3100 (base ressources_e2e_test)
npm run db:migrate     # nouvelle migration Prisma (développement)
npm run db:deploy      # appliquer les migrations
npm run db:seed        # données de démonstration (DEMO_PASSWORD requis)
docker compose up -d   # MariaDB + Mailpit pour le développement
```

## Repères dans le code

- `src/server/policies/` : politiques d'accès pures (aucun accès à la base) ; à tester en unitaire.
- `src/server/services/` : seule couche qui touche Prisma ; chaque service valide (Zod), vérifie la politique, écrit au journal dans la même transaction.
- `src/app/(app)/gestion/actions.ts` : Server Actions, qui ne font qu'appeler les services via `runAction`.
- `src/components/action-form.tsx` : formulaire relié à une Server Action. Il fonctionne sans JavaScript et ne perd pas la saisie en cas d'erreur.
- `src/server/policies/resource-policy.ts` : « qui voit quoi » (A4), sous deux formes, `canViewResource` et `visibleResourcesWhere`, dont la concordance est testée (`tests/integration/resource-policy-consistency.test.ts`). Toute nouvelle liste de ressources DOIT passer par `visibleResourcesWhere`.
- `src/server/storage/` : `StorageDriver` (local ou S3) ; les clés sont aléatoires et validées (pas de chemin fourni par l'utilisateur).
- `src/app/api/files/[token]/route.ts` : seul point de sortie des fichiers (jeton HMAC de 10 min, accès revérifié, RG10).
- `tests/support/` : chargement de `.env.test` (refus si le nom de la base ne contient pas « test ») et utilitaires de base de données.
- Prisma refuse `migrate reset` lancé par un agent : les tests utilisent `migrate deploy` et vident les tables eux-mêmes.
