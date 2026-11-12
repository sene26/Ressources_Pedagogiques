# Tests — RessourcesPéda

| Commande | Contenu | Résultat (fin du Lot 6) |
| --- | --- | --- |
| `npm test` | Vitest : tests unitaires et d'intégration sur une vraie base MariaDB (`.env.test`) | 148 tests |
| `npm run test:e2e` | Playwright : parcours de bout en bout sur un écran de téléphone (application compilée, port 3100) | 22 tests |
| `npm run test:perf` | Performance de la recherche sur 10 000 ressources | 7 tests (< 2 s exigé) |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript strict | sans erreur |

## Règles de gestion → tests

| Règle | Tests principaux (nom commençant par « RGx — » ou contenant la règle) |
| --- | --- |
| RG1 — au moins un EC ; EC → UE → Semestre → Formation | `catalog.test.ts` (hiérarchie, clés étrangères) ; `resources.test.ts` « RG1 — refuse une ressource sans EC » |
| RG2 — dépôt réservé aux enseignants affectés ; partage entre enseignants | `resources.test.ts` « RG2 — … » ; `pilotage.test.ts` (duplication) ; cohérence des politiques |
| RG3 — seules les ressources publiées sont visibles des étudiants | `resources.test.ts` (brouillon, archivage) ; `search-browse.test.ts` |
| RG4 — visibilités Privée, Enseignants, Étudiants de l'EC | `resources.test.ts` ; `resource-policy-consistency.test.ts` (11 profils × 486 ressources) |
| RG5 — examens et corrigés : date **et** validation | `resources.test.ts` « RG5 — … » ; `approvals-notifications.test.ts` ; e2e `lot4-examens.spec.ts` |
| RG6 — versions conservées, réservées à l'auteur et au responsable | `resources.test.ts` « F10, RG6 — … » ; e2e `lot2-ressources.spec.ts` |
| RG7 — formation, niveau et année en cours | `resources.test.ts` « RG7 — … » ; `search-browse.test.ts` « RG3, RG7 — … » ; e2e `lot3-consultation.spec.ts` |
| RG8 — 100 Mo, formats acceptés, liens | `file-types.test.ts` « RG8 — … » ; `resources.test.ts` « RG8 — … » |
| RG9 — suppression = archivage ; suppression définitive par l'administrateur | `resources.test.ts` « RG9 — … » |
| RG10 — consultations et téléchargements enregistrés | `resources.test.ts` « RG10 — … » ; `pilotage.test.ts` (statistiques) ; `privacy.test.ts` (anonymisation) |

## Critères de fin des lots (tests de bout en bout)

| Lot | Critère | Fichier |
| --- | --- | --- |
| 1 | Un administrateur crée une formation, un enseignant et un étudiant ; chacun se connecte avec son rôle | `tests/e2e/lot1-socle.spec.ts` |
| 2 | Une ressource déposée n'est visible des étudiants qu'une fois publiée | `tests/e2e/lot2-ressources.spec.ts` |
| 3 | Un étudiant retrouve une ressource en moins de trois clics ou par la recherche | `tests/e2e/lot3-consultation.spec.ts` |
| 4 | Un sujet d'examen reste invisible jusqu'à sa date de publication validée | `tests/e2e/lot4-examens.spec.ts` |
| 5 | Le responsable voit les EC sans ressource et les ressources les plus consultées | `tests/e2e/lot5-pilotage.spec.ts` |
| 6 | Tous les tests passent ; application lancée avec `docker compose up` | ce document ; `docs/deploiement.md` |

## Performance (exigence : < 2 s pour 10 000 ressources)

Mesures du 12/11/2026 (MariaDB 10.11, conteneur de développement) :

| Recherche | Étudiant | Enseignant | Administrateur |
| --- | --- | --- | --- |
| « simplexe » | 131 ms | 126 ms | 72 ms |
| « algorithme graphe » | 86 ms | 80 ms | 51 ms |
| « statistique estimation régression » | 42 ms | 35 ms | 29 ms |
| « chapitre » (10 000 correspondances) | 122 ms | 119 ms | 85 ms |
| filtre par type, sans texte | 107 ms | 15 ms | 10 ms |
| page d'un EC (liste paginée) | 71 ms | — | — |

Au-delà de 5 000 correspondances textuelles, seules les 5 000 plus pertinentes sont gardées avant le filtrage des droits. Les résultats affichés restent les plus pertinents.

## Base de données de test

Copier `.env.test.example` en `.env.test`. Le nom de la base **doit contenir « test »** : les tests la vident entièrement. Les migrations sont appliquées par `prisma migrate deploy` au début de la suite.
