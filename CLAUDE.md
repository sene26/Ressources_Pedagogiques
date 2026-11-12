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
- **PostgreSQL** + **Prisma** ; recherche plein texte PostgreSQL (configuration `french` + `unaccent`).
- **Auth.js** (NextAuth v5), fournisseur « identifiants » ; mots de passe hachés avec **argon2**.
- **Stockage des fichiers** : interface `StorageDriver`, avec une implémentation locale (développement) et une implémentation S3 (production).
- **Tailwind CSS** ; composants accessibles (HTML sémantique, labels, focus visible).
- **Zod** pour valider toutes les entrées (formulaires, Server Actions, routes).
- **Vitest** (unitaires et intégration, base de test PostgreSQL) ; **Playwright** (quelques parcours de bout en bout).
- **Docker** + `docker-compose.yml` (application, PostgreSQL, sauvegarde).

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
| 0 | Conception | En attente de validation |
| 1 | Socle (F1, F2, F5–F7) | À faire |
| 2 | Ressources (F9–F11) | À faire |
| 3 | Consultation (F12, F17–F20) | À faire |
| 4 | Examens et notifications (F13, F14, F21, F22) | À faire |
| 5 | Pilotage (F3, F4, F15, F23–F25) | À faire |
| 6 | Finalisation | À faire |

## Commandes (à compléter au Lot 1)

```bash
npm run dev          # serveur de développement
npm test             # tests Vitest
npm run test:e2e     # tests Playwright
npx prisma migrate dev
npm run db:seed      # données de démonstration
docker compose up    # application complète
```
