# RessourcesPéda — Gestion des ressources pédagogiques (UASZ)

Plateforme web de centralisation, de partage, de versionnement et de suivi des ressources pédagogiques de l'Université Assane Seck de Ziguinchor. Elle couvre les cours, TD, TP, sujets d'examen, corrigés, vidéos et liens, organisés par formation › semestre › UE › EC.

> **État :** les lots 0 à 6 sont terminés. Les fonctionnalités F1 à F7, F9 à F15 et F17 à F26 sont réalisées. F8 (import de maquette) et F16 (commentaires et notes), de priorité « souhaitable », sont reportées.

## Fonctionnalités

| Pour | Principales fonctions |
| --- | --- |
| **Étudiants** | « Mes cours » par semestre, recherche plein texte et filtres, aperçu des PDF, images et vidéos, téléchargements, favoris, notifications |
| **Enseignants** | Dépôt de fichiers (100 Mo) ou de liens, versions, publication immédiate ou programmée, archivage, duplication, partage entre collègues, tableau de bord des consultations |
| **Responsables** | Validation des sujets d'examen et corrigés, maquette (UE, EC), affectations, inscriptions, tableau de bord de la formation (EC sans ressource, ressources les plus consultées), export CSV |
| **Administrateurs** | Comptes et rôles, import CSV, années universitaires, formations, journal des actions, suppression définitive |

Guide complet par rôle : [`docs/guide-utilisateur.md`](docs/guide-utilisateur.md).

## Démarrage rapide avec Docker (production)

1. Copier la configuration.

   ```bash
   cp .env.example .env
   ```

2. Renseigner les secrets et mots de passe de `.env` (voir [`docs/deploiement.md`](docs/deploiement.md)), puis démarrer.

   ```bash
   docker compose up -d --build
   ```

3. (Facultatif) Charger les données de démonstration.

   ```bash
   docker compose --profile demo run --rm seed
   ```

L'application répond sur http://localhost:3000. Il faut la placer derrière un reverse proxy HTTPS. Les migrations sont appliquées automatiquement ; une tâche périodique envoie les notifications ; la base et les fichiers sont sauvegardés chaque jour dans `./backups`.

## Installation pour le développement

Prérequis : Node.js 22 ou plus récent, et MariaDB 10.11 ou plus récent (installé localement ou via Docker).

1. Installer les dépendances.

   ```bash
   npm install
   ```

2. Copier la configuration, puis renseigner `AUTH_SECRET`, `FILE_TOKEN_SECRET`, `CRON_SECRET`, `DEMO_PASSWORD` et `DATABASE_URL`.

   ```bash
   cp .env.example .env
   ```

3. Lancer MariaDB et Mailpit (capture des courriels sur http://localhost:8025). Si MariaDB est déjà installé localement, reprendre les réglages de `docker/mariadb/ressources.cnf`.

   ```bash
   docker compose --profile dev up -d db mailpit
   ```

4. Créer les tables.

   ```bash
   npm run db:deploy
   ```

5. Charger les données de démonstration.

   ```bash
   npm run db:seed
   ```

6. Lancer le serveur de développement, sur http://localhost:3000.

   ```bash
   npm run dev
   ```

Sans `SMTP_HOST`, le contenu des courriels (liens d'activation et de réinitialisation, notifications) est écrit dans la console du serveur.

## Comptes de démonstration

Tous les comptes ont le mot de passe défini par `DEMO_PASSWORD`. Le domaine `.test` est réservé : aucun courriel réel ne peut partir.

| Adresse | Rôle(s) |
| --- | --- |
| `admin@uasz.test` | Administrateur |
| `a.diallo@uasz.test` | Enseignante et responsable de la formation M-MIO |
| `m.ndiaye@uasz.test` | Enseignant |
| `f.sarr@uasz.test`, `i.badji@uasz.test`, `m.diatta@uasz.test`, `o.sane@uasz.test`, `a.coly@uasz.test` | Étudiants (Master 1 MIO, 2026-2027) |

La formation « Master MIO » comporte 4 semestres, 9 UE, 13 EC et 20 ressources : cours, TD, TP, vidéo, sujet d'examen en attente de validation, publication programmée, brouillon, ressource partagée entre enseignants. Les intitulés sont fictifs et sont à remplacer par la maquette réelle.

## Tests

Copier la configuration de test. Le nom de la base **doit** contenir « test » : elle est vidée par les tests.

```bash
cp .env.test.example .env.test
```

| Commande | Contenu |
| --- | --- |
| `npm test` | 148 tests unitaires et d'intégration (MariaDB), dont toutes les règles RG1 à RG10 |
| `npm run test:e2e` | 22 tests Playwright sur un écran de téléphone : un parcours par lot |
| `npm run test:perf` | Recherche sur 10 000 ressources : environ 130 ms au maximum, pour une exigence de 2 s |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript strict |

Détail et correspondance avec les règles de gestion : [`docs/tests.md`](docs/tests.md). L'intégration continue GitHub Actions est décrite dans `.github/workflows/ci.yml`.

## Documentation

| Document | Contenu |
| --- | --- |
| [Guide utilisateur](docs/guide-utilisateur.md) | Mode d'emploi par rôle |
| [Installation sous Windows](docs/installation-windows.md) | Tester sur son ordinateur, sans Docker |
| [Déploiement](docs/deploiement.md) | Docker, HTTPS, stockage S3, sauvegardes et restauration, mises à jour |
| [Sécurité](docs/securite.md) | Mesures en place, limites connues |
| [Tests](docs/tests.md) | Règles de gestion → tests, mesures de performance |
| [Cahier des charges](docs/cahier-des-charges.md) | Besoin initial |
| [Points ambigus et décisions](docs/ambiguites.md) | Interprétations adoptées (A1 à A22), dont le choix de MariaDB |
| [Architecture](docs/architecture.md) | Composants, organisation du code, contrôle d'accès |
| [Modèle de données](docs/modele-donnees.md) | Diagramme entité-association, contraintes |
| [Diagrammes UML](docs/diagrammes.md) | Cas d'utilisation, classes, états, séquences (Mermaid) |
| [Maquettes](docs/maquettes.md) | Écrans principaux |
| [CLAUDE.md](CLAUDE.md) | Conventions du projet |

## Choix techniques

Next.js 16 (App Router) + TypeScript · MariaDB 10.11 + Prisma 6 · Auth.js v5 (argon2id) · Tailwind CSS 4 · Zod · stockage local ou S3 (MinIO) · Vitest + Playwright · Docker Compose.
