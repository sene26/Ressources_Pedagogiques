# RessourcesPéda — Gestion des ressources pédagogiques (UASZ)

Plateforme web de centralisation, de partage, de versionnement et de suivi des ressources pédagogiques de l'Université Assane Seck de Ziguinchor.

> **État :** Lots 0 à 3 terminés : connexion, rôles, maquette, affectations, inscriptions, dépôt et versions des ressources, publication, archivage, téléchargements contrôlés, catalogue, recherche plein texte, « Mes cours », aperçus.

## Prérequis

- Node.js 22 ou plus récent
- MariaDB 10.11 ou plus récent, installé localement ou via `docker compose`

## Installation

1. Installer les dépendances.

   ```bash
   npm install
   ```

2. Copier la configuration, puis adapter les valeurs.

   ```bash
   cp .env.example .env
   ```

   Générer `AUTH_SECRET` avec `openssl rand -base64 32` et choisir un `DEMO_PASSWORD`.

3. Lancer MariaDB (et Mailpit, qui capture les courriels) avec Docker. Si vous utilisez votre propre serveur, passez cette étape.

   ```bash
   docker compose up -d
   ```

   Avec votre propre serveur MariaDB, reprenez les réglages de `docker/mariadb/ressources.cnf` : interclassement `utf8mb4_unicode_ci` et `innodb_ft_min_token_size = 3`.

4. Créer les tables.

   ```bash
   npm run db:deploy
   ```

5. Charger les données de démonstration (facultatif).

   ```bash
   npm run db:seed
   ```

6. Lancer l'application, puis ouvrir http://localhost:3000.

   ```bash
   npm run dev
   ```

Pour recevoir les courriels (mot de passe oublié) en développement, définir `SMTP_HOST=localhost` et `SMTP_PORT=1025`, puis ouvrir Mailpit sur http://localhost:8025. Sans `SMTP_HOST`, le contenu des courriels est écrit dans la console du serveur.

## Comptes de démonstration

Tous les comptes ont le mot de passe défini par `DEMO_PASSWORD` dans `.env`.

| Adresse | Rôle(s) |
| --- | --- |
| `admin@uasz.test` | Administrateur |
| `a.diallo@uasz.test` | Enseignante et responsable de la formation M-MIO |
| `m.ndiaye@uasz.test` | Enseignant |
| `f.sarr@uasz.test`, `i.badji@uasz.test`, `m.diatta@uasz.test`, `o.sane@uasz.test`, `a.coly@uasz.test` | Étudiants (Master 1 MIO, 2026-2027) |

La formation de démonstration « Master MIO » comporte 4 semestres, 9 UE et 13 EC, ainsi que 20 ressources (cours, TD, TP, vidéo, sujet d'examen en attente de validation, brouillon, ressource partagée entre enseignants). Ses intitulés sont fictifs et sont à remplacer par la maquette réelle.

## Tests

Copier la configuration de test. Le nom de la base doit contenir « test » : cette base est vidée par les tests.

```bash
cp .env.test.example .env.test
```

Lancer les tests unitaires et d'intégration.

```bash
npm test
```

Lancer les tests de bout en bout (Playwright). L'application est compilée puis lancée sur le port 3100, avec la base `ressources_e2e_test`.

```bash
npm run test:e2e
```

## Documentation

| Document | Contenu |
| --- | --- |
| [Cahier des charges](docs/cahier-des-charges.md) | Besoin, règles de gestion RG1 à RG10, fonctionnalités F1 à F26, lots |
| [Points ambigus et décisions](docs/ambiguites.md) | Interprétations adoptées (A1 à A17, dont le choix de MariaDB) |
| [Architecture](docs/architecture.md) | Composants, organisation du code, sécurité, déploiement, stratégie de tests |
| [Modèle de données](docs/modele-donnees.md) | Diagramme entité-association, contraintes, filtre de visibilité |
| [Diagrammes UML](docs/diagrammes.md) | Cas d'utilisation, classes, états, séquences (Mermaid) |
| [Maquettes](docs/maquettes.md) | Écrans principaux (filaires, mobile d'abord) |
| [CLAUDE.md](CLAUDE.md) | Résumé et conventions du projet |

## Choix techniques

Next.js 16 + TypeScript · MariaDB + Prisma 6 · Auth.js v5 (argon2id) · Tailwind CSS 4 · Zod · Vitest + Playwright · Docker Compose.
