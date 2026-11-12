# Cahier des charges — Plateforme de gestion des ressources pédagogiques

**Nom du projet :** RessourcesPéda (nom provisoire)
**Établissement :** Université Assane Seck de Ziguinchor (UASZ)
**Porteuse du projet :** Dr Jeanne Pia Malick SENE
**Version :** 1.0 — novembre 2026

---

## 1. Contexte

Les enseignants de l'université produisent de nombreuses ressources pédagogiques : supports de cours, travaux dirigés et pratiques, sujets d'examen et corrigés, vidéos, jeux de données, liens. Ces ressources sont aujourd'hui dispersées entre les ordinateurs personnels, les clés USB, les messageries, Google Drive et les groupes WhatsApp. Il en résulte :

- des pertes de documents et des doublons ;
- l'impossibilité de retrouver la version à jour d'un support ;
- un partage difficile entre enseignants d'une même équipe pédagogique ;
- un accès inégal des étudiants aux ressources, en présentiel comme à distance ;
- aucune vision des ressources disponibles par formation ou par unité d'enseignement.

## 2. Objectifs

1. **Centraliser** les ressources pédagogiques dans un espace unique, organisé selon la maquette (formation, niveau, semestre, UE, EC).
2. **Partager** les ressources entre enseignants et les diffuser de façon contrôlée aux étudiants.
3. **Retrouver** rapidement une ressource grâce à la recherche et aux filtres.
4. **Gérer les versions** d'une ressource et savoir laquelle est en vigueur.
5. **Suivre l'usage** des ressources (consultations, téléchargements) pour aider le pilotage pédagogique.
6. Fonctionner correctement **avec une connexion internet faible** et sur téléphone.

## 3. Acteurs

| Acteur | Rôle |
| --- | --- |
| **Étudiant** | Consulte et télécharge les ressources publiées pour les EC de sa formation et de son niveau |
| **Enseignant** | Dépose, modifie, versionne et publie ses ressources ; consulte et réutilise les ressources partagées par ses collègues |
| **Responsable de formation** | Gère la maquette de sa formation (UE, EC, enseignants affectés) ; valide les ressources sensibles (sujets d'examen) ; consulte les statistiques de sa formation |
| **Administrateur** | Gère les comptes, les rôles, les formations, les paramètres de la plateforme et les sauvegardes |

Un même utilisateur peut avoir plusieurs rôles (par exemple enseignant et responsable de formation).

## 4. Règles de gestion

- **RG1.** Toute ressource est rattachée à au moins un EC ; un EC appartient à une UE, une UE à un semestre, un semestre à une formation.
- **RG2.** Seuls les enseignants affectés à un EC peuvent y déposer des ressources ; tout enseignant peut consulter les ressources marquées « partagées entre enseignants ».
- **RG3.** Une ressource a un statut : `Brouillon`, `Publiée`, `Archivée`. Seules les ressources `Publiée` sont visibles des étudiants.
- **RG4.** Une ressource a une visibilité : `Privée` (son auteur seul), `Enseignants` (tous les enseignants), `Étudiants de l'EC` (étudiants inscrits dans la formation et le niveau de l'EC).
- **RG5.** Les sujets d'examen et les corrigés ne sont jamais visibles des étudiants avant une date de publication fixée par l'enseignant ; leur publication doit être validée par le responsable de formation.
- **RG6.** La modification du fichier d'une ressource crée une nouvelle version ; les versions précédentes sont conservées et consultables par l'auteur et le responsable de formation.
- **RG7.** Un étudiant ne voit que les ressources de sa formation et de son niveau pour l'année universitaire en cours.
- **RG8.** Taille maximale d'un fichier : 100 Mo ; formats acceptés : PDF, DOCX, PPTX, XLSX, ODT, ZIP, MP4, MP3, PNG, JPG, TXT, code source. Les vidéos peuvent aussi être référencées par un lien externe (YouTube, Google Drive).
- **RG9.** La suppression d'une ressource publiée est un archivage (suppression logique) ; seul l'administrateur peut supprimer définitivement.
- **RG10.** Chaque consultation et chaque téléchargement est enregistré (utilisateur, ressource, date) à des fins statistiques.

## 5. Fonctionnalités

Priorités : **M** = indispensable (version 1), **S** = importante, **C** = souhaitable.

### 5.1 Comptes et authentification

| N° | Fonctionnalité | Priorité |
| --- | --- | --- |
| F1 | Connexion par adresse électronique et mot de passe ; mot de passe oublié | M |
| F2 | Gestion des rôles (étudiant, enseignant, responsable, administrateur) | M |
| F3 | Import des étudiants et des enseignants par fichier CSV | S |
| F4 | Profil utilisateur (nom, photo, formation, niveau, téléphone) | S |

### 5.2 Organisation pédagogique

| N° | Fonctionnalité | Priorité |
| --- | --- | --- |
| F5 | Gestion des formations, semestres, UE et EC (création, modification, archivage) | M |
| F6 | Affectation des enseignants aux EC | M |
| F7 | Inscription des étudiants à une formation et à un niveau pour une année universitaire | M |
| F8 | Import d'une maquette depuis un fichier Excel ou CSV | C |

### 5.3 Ressources

| N° | Fonctionnalité | Priorité |
| --- | --- | --- |
| F9 | Déposer une ressource : titre, description, type (cours, TD, TP, examen, corrigé, vidéo, lien, autre), EC, mots-clés, fichier ou lien, statut, visibilité | M |
| F10 | Modifier une ressource ; déposer une nouvelle version avec un commentaire | M |
| F11 | Publier, dépublier, archiver une ressource | M |
| F12 | Prévisualiser dans le navigateur les PDF, images et vidéos sans téléchargement | S |
| F13 | Programmer la publication à une date donnée | S |
| F14 | Valider la publication des sujets d'examen et des corrigés (responsable) | S |
| F15 | Dupliquer une ressource vers un autre EC ou une autre année universitaire | S |
| F16 | Commenter une ressource et la noter (enseignants entre eux) | C |

### 5.4 Recherche et consultation

| N° | Fonctionnalité | Priorité |
| --- | --- | --- |
| F17 | Navigation par formation, semestre, UE et EC | M |
| F18 | Recherche plein texte sur le titre, la description et les mots-clés | M |
| F19 | Filtres par type, enseignant, année universitaire, format | M |
| F20 | Espace « Mes cours » pour l'étudiant : ressources de ses EC, classées par semestre | M |
| F21 | Favoris | S |
| F22 | Notification (dans la plateforme et par courriel) lors de la publication d'une ressource dans un EC suivi | S |

### 5.5 Statistiques et administration

| N° | Fonctionnalité | Priorité |
| --- | --- | --- |
| F23 | Tableau de bord enseignant : consultations et téléchargements de ses ressources | S |
| F24 | Tableau de bord responsable : nombre de ressources par EC, EC sans ressource, ressources les plus consultées | S |
| F25 | Journal des actions (dépôt, publication, suppression) | S |
| F26 | Export des statistiques en CSV | C |

## 6. Données principales

| Entité | Attributs principaux |
| --- | --- |
| Utilisateur | id, nom, prénom, courriel (unique), mot de passe haché, téléphone, rôles, actif |
| Formation | id, code, intitulé, niveau (Licence, Master) |
| Semestre | id, numéro, formation |
| UE | id, code, intitulé, crédits, semestre |
| EC | id, code, intitulé, crédits, UE |
| AnneeUniversitaire | id, libellé (ex. 2025-2026), date de début, date de fin, en cours |
| Affectation | enseignant, EC, année universitaire |
| Inscription | étudiant, formation, niveau, année universitaire |
| Ressource | id, titre, description, type, mots-clés, statut, visibilité, date de publication, auteur, EC (un ou plusieurs), année universitaire, dates de création et de modification |
| Version | id, ressource, numéro, fichier ou lien, taille, format, commentaire, date, auteur |
| Consultation | utilisateur, ressource, type (vue ou téléchargement), date |
| Favori | utilisateur, ressource |

## 7. Exigences non fonctionnelles

- **Langue :** interface entièrement en français.
- **Accessibilité mobile :** interface adaptée aux téléphones (responsive) ; pages légères.
- **Faible débit :** pagination des listes, compression des images, chargement différé des aperçus ; une page de liste doit rester utilisable en 3G.
- **Sécurité :**
  - mots de passe hachés (bcrypt ou argon2) ;
  - contrôle d'accès vérifié côté serveur pour chaque ressource (RG2 à RG7) ;
  - protection contre les failles OWASP courantes (injection, XSS, CSRF) ;
  - téléchargements servis uniquement aux utilisateurs autorisés, par des liens non devinables.
- **Données personnelles :** respect de la loi sénégalaise n° 2008-12 sur la protection des données à caractère personnel ; seules les données nécessaires sont collectées.
- **Performance :** une recherche renvoie ses résultats en moins de 2 secondes pour 10 000 ressources.
- **Fiabilité :** sauvegarde quotidienne de la base de données et des fichiers.
- **Qualité :** code commenté, tests automatisés sur les règles de gestion, README d'installation.

## 8. Choix techniques proposés

À confirmer ou à ajuster lors de la phase de conception :

- **Application :** Next.js (React) avec TypeScript, application web full-stack.
- **Base de données :** PostgreSQL, accès via l'ORM Prisma.
- **Authentification :** Auth.js (NextAuth) avec identifiants et rôles.
- **Stockage des fichiers :** stockage local en développement ; stockage compatible S3 en production.
- **Interface :** Tailwind CSS ; composants accessibles.
- **Tests :** Vitest pour les tests unitaires ; Playwright pour quelques tests de bout en bout.
- **Déploiement :** conteneur Docker et fichier `docker-compose.yml` (application + PostgreSQL).

## 9. Découpage en lots

| Lot | Contenu | Critère de fin |
| --- | --- | --- |
| **Lot 0 — Conception** | Architecture, modèle de données, diagramme de cas d'utilisation et de classes (en Mermaid), maquettes des écrans principaux | Documents validés par la porteuse du projet |
| **Lot 1 — Socle** | Projet initialisé, base de données, authentification, rôles, gestion des formations/UE/EC, affectations et inscriptions (F1, F2, F5 à F7) | Un administrateur crée une formation, un enseignant et un étudiant ; chacun se connecte avec son rôle |
| **Lot 2 — Ressources** | Dépôt, versions, statuts, visibilité, publication, archivage (F9 à F11) | Un enseignant dépose une ressource ; elle n'est visible des étudiants qu'une fois publiée |
| **Lot 3 — Consultation** | Navigation, recherche, filtres, espace « Mes cours », prévisualisation (F12, F17 à F20) | Un étudiant retrouve une ressource de son EC en moins de trois clics ou par la recherche |
| **Lot 4 — Examens et notifications** | Publication programmée, validation des sujets et corrigés, favoris, notifications (F13, F14, F21, F22) | Un sujet d'examen reste invisible jusqu'à sa date de publication validée |
| **Lot 5 — Pilotage** | Statistiques, tableaux de bord, journal, import CSV, duplication (F3, F4, F15, F23 à F25) | Le responsable voit les EC sans ressource et les ressources les plus consultées |
| **Lot 6 — Finalisation** | Tests, sécurité, performance, documentation, déploiement Docker | Tous les tests passent ; README complet ; application lancée avec `docker compose up` |

## 10. Livrables

- Code source dans le dépôt GitHub, une branche et une demande de fusion (pull request) par lot.
- `README.md` : installation, configuration, lancement, comptes de démonstration.
- `docs/` : architecture, modèle de données, diagrammes UML en Mermaid, guide utilisateur par rôle.
- Données de démonstration : une formation (Master 1 MIO) avec ses UE et EC, deux enseignants, cinq étudiants, une vingtaine de ressources.
- Tests automatisés couvrant les règles de gestion RG1 à RG10.

## 11. Consignes pour Claude Code

1. Lire entièrement ce cahier des charges avant de commencer.
2. Créer un fichier `CLAUDE.md` qui résume le projet, les choix techniques, les conventions et les règles de gestion.
3. Travailler **un lot à la fois**, dans l'ordre, et s'arrêter à la fin de chaque lot pour validation.
4. Commencer chaque lot par un plan court (fichiers à créer, étapes, tests prévus).
5. Écrire les tests en même temps que le code ; ne pas considérer un lot comme terminé tant que ses tests échouent.
6. Interface, messages d'erreur et documentation en français ; code (noms de variables, fonctions) en anglais.
7. Signaler toute ambiguïté du cahier des charges et proposer une solution plutôt que de deviner.
8. Ne jamais placer de secret (mot de passe, clé) dans le code : utiliser des variables d'environnement et un fichier `.env.example`.
