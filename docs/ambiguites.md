# Points ambigus et solutions proposées

Ce document recense les points du cahier des charges qui admettent plusieurs lectures. Pour chacun, une solution est proposée.
Le 12/11/2026, la porteuse du projet a demandé d'**adopter les propositions par défaut**, quitte à les améliorer ensuite. Elles font donc foi pour les lots suivants tant qu'elles ne sont pas modifiées.

Légende de l'état : ⏳ à valider · ✅ par défaut (proposition adoptée en attendant une révision) · ✏️ modifié par la porteuse du projet

---

## A1. « Niveau » : de la formation ou de l'inscription ? — ✅ par défaut

**Constat.** L'entité *Formation* porte un « niveau (Licence, Master) », et l'*Inscription* porte aussi un « niveau ». Les données de démonstration parlent de « Master 1 MIO ». On ne sait pas si « Master 1 MIO » est une formation à part entière ou l'année 1 de la formation « Master MIO ».

**Proposition.**
- La *Formation* représente le diplôme complet, par exemple « Master MIO », avec un **cycle** (`LICENCE` ou `MASTER`).
- Les *Semestres* sont numérotés dans la formation : S1 à S6 en Licence, S1 à S4 en Master.
- Le **niveau** est l'année d'étude dans la formation (1, 2 ou 3). Il se déduit du semestre : niveau = ⌈numéro / 2⌉. Ainsi S1 et S2 donnent le niveau 1, et S3 et S4 le niveau 2.
- L'*Inscription* porte (étudiant, formation, niveau, année universitaire). « Master 1 MIO » correspond donc à la formation *Master MIO* au niveau 1.
- Un EC est visible des étudiants de niveau *n* si son semestre appartient au niveau *n* (RG4, RG7).

## A2. La maquette varie-t-elle d'une année à l'autre ? — ✅ par défaut

**Constat.** Les affectations, les inscriptions et les ressources dépendent de l'année universitaire, mais pas la maquette (formation, UE, EC).

**Proposition.** En version 1, la maquette n'est pas versionnée par année. Un EC supprimé de la maquette est **archivé** (F5), pas effacé, ce qui préserve l'historique des ressources. Les ressources restent rattachées à une année universitaire. F15 permet de les dupliquer d'une année sur l'autre.

## A3. Rattachement d'un responsable à sa formation — ✅ par défaut

**Constat.** Le cahier des charges définit le rôle de responsable de formation, mais le modèle de données ne dit pas de quelle(s) formation(s) il est responsable.

**Proposition.** Ajouter l'entité `ProgramManagerAssignment` (utilisateur, formation). Un responsable n'agit que sur les formations qui lui sont rattachées. L'administrateur a tous les droits du responsable sur toutes les formations.

## A4. Qui voit quoi, exactement ? (RG2 à RG7) — ✅ par défaut

**Constat.** Les règles de statut, de visibilité et de date se croisent, et certains cas ne sont pas couverts : brouillon partagé, ressource « Étudiants » vue par un enseignant, droits du responsable…

**Proposition.** Les visibilités sont **imbriquées** : `PRIVATE` ⊂ `TEACHERS` ⊂ `EC_STUDENTS`. Une ressource destinée aux étudiants est donc aussi visible des enseignants.

| Utilisateur | Peut voir la ressource si… |
| --- | --- |
| Auteur | toujours (tous statuts) |
| Administrateur | toujours |
| Responsable de la formation de l'EC | visibilité ≠ `PRIVATE` (tous statuts, versions comprises) |
| Enseignant affecté au même EC (équipe pédagogique) | visibilité ≠ `PRIVATE` (brouillons compris, pour travailler en équipe) |
| Autre enseignant | visibilité ≠ `PRIVATE` **et** statut = `PUBLISHED` |
| Étudiant | statut = `PUBLISHED` **et** visibilité = `EC_STUDENTS` **et** date de publication ≤ maintenant **et** inscription, pour l'année universitaire en cours, dans la formation et le niveau de l'un des EC de la ressource **et** année de la ressource = année en cours **et** (type ∉ {examen, corrigé} **ou** validation = `APPROVED`) |

Les ressources `ARCHIVED` ne sont visibles que de l'auteur, du responsable et de l'administrateur.
Une ressource `PRIVATE` reste l'affaire de son auteur. Le responsable ne la voit pas : pour être validée, une ressource doit avoir une autre visibilité.

## A5. Validation des sujets d'examen et des corrigés (RG5, F14) — ✅ par défaut

**Proposition.**
- Ajouter un champ `approvalStatus` : `NOT_REQUIRED`, `PENDING`, `APPROVED` ou `REJECTED` (avec un motif).
- Quand une ressource de type `EXAM` ou `SOLUTION` est publiée avec la visibilité `EC_STUDENTS`, le statut passe à `PUBLISHED` et l'`approvalStatus` à `PENDING`. Elle reste invisible des étudiants tant qu'elle n'est pas `APPROVED` **et** que sa date de publication n'est pas atteinte.
- La date de publication est **obligatoire** pour ces types.
- Si l'auteur dépose une **nouvelle version** d'une ressource validée, la validation repasse à `PENDING`.
- Si l'auteur est lui-même responsable de la formation, il peut valider (cas fréquent dans les petites équipes). L'action est tracée au journal.
- Avant le Lot 4 (qui livre F14), les examens et corrigés ne peuvent pas être rendus visibles des étudiants. C'est le comportement le plus sûr.

## A6. Ressource rattachée à plusieurs EC (RG1 et RG2) — ✅ par défaut

**Proposition.** Pour déposer une ressource sur plusieurs EC, l'enseignant doit être affecté à **chacun** de ces EC pour l'année de la ressource. Les EC peuvent appartenir à des formations différentes, par exemple un cours mutualisé. La validation d'un sujet d'examen peut alors être faite par le responsable de **l'une** des formations concernées.

## A7. Statut et date de publication (F11 et F13) — ✅ par défaut

**Proposition.** On n'ajoute pas de statut « Programmée ». Une ressource `PUBLISHED` dont la `publishAt` est dans le futur est considérée comme **programmée** : l'interface l'affiche ainsi, et elle reste invisible des étudiants jusqu'à cette date. Ce calcul se fait au moment de la lecture, ce qui évite une tâche planifiée pour rendre la ressource visible. Une tâche périodique ne sert qu'à envoyer les notifications à la date de publication (F22, Lot 4).
- « Dépublier » remet la ressource en `DRAFT`.
- Un brouillon peut être **supprimé** définitivement par son auteur s'il n'a jamais été publié. Une ressource déjà publiée ne peut être qu'archivée (RG9).

## A8. Versions et liens externes (RG6) — ✅ par défaut

**Proposition.** Une version contient **soit** un fichier, **soit** un lien externe. Changer le fichier ou le lien crée une nouvelle version. Modifier le titre, la description ou les mots-clés ne crée pas de version : c'est tracé au journal. La version en vigueur est la plus récente. Les étudiants et les collègues ne voient que celle-là. Les versions précédentes sont visibles de l'auteur, du responsable et de l'administrateur (RG6).

## A9. Formats « code source » (RG8) — ✅ par défaut

**Proposition.** Liste fermée et configurable : `.py`, `.ipynb`, `.java`, `.c`, `.h`, `.cpp`, `.js`, `.ts`, `.html`, `.css`, `.sql`, `.r`, `.m`, `.sh`, `.json`, `.csv`, `.md`. Ajout de `.csv` pour les jeux de données cités au §1. Le type réel du fichier est contrôlé (signature binaire) en plus de l'extension. Les liens externes acceptés sont : YouTube, Google Drive et toute URL `https://` (type « lien »).

## A10. EC « suivi » pour les notifications (F22) — ✅ par défaut

**Proposition.** Un étudiant suit automatiquement les EC de son inscription en cours. Un enseignant suit automatiquement les EC qui lui sont affectés. Chacun peut suivre ou ne plus suivre un EC (entité `EcSubscription`), et désactiver les courriels dans son profil.

## A11. Profil : formation et niveau (F4) — ✅ par défaut

**Proposition.** La formation et le niveau affichés dans le profil viennent de l'**inscription** de l'année en cours. Ils ne sont pas saisis librement, ce qui garde une seule source de vérité. La photo est facultative, redimensionnée à 256 px et compressée en WebP.

## A12. Données personnelles et statistiques (loi 2008-12, RG10) — ✅ par défaut

**Proposition.**
- Les tableaux de bord F23 et F24 n'affichent que des **chiffres agrégés** : jamais la liste nominative des étudiants qui ont consulté une ressource.
- Les consultations nominatives sont conservées **2 ans**, puis rendues anonymes (l'utilisateur est retiré, les compteurs sont gardés).
- Une vue répétée par le même utilisateur sur la même ressource dans un intervalle de 30 minutes n'est comptée qu'une fois, pour éviter de gonfler les statistiques.
- Une mention d'information (finalités, durée, droits d'accès et de rectification) sera ajoutée au Lot 6. Une **déclaration auprès de la CDP** (Commission de protection des données personnelles) relève de l'université.

## A13. Authentification : SSO de l'université ? — ✅ par défaut

**Constat.** Le cahier des charges demande une connexion par courriel et mot de passe. Si l'UASZ dispose d'un annuaire (LDAP, CAS, Google Workspace), les étudiants préféreront leurs identifiants habituels.

**Proposition.** La version 1 utilise courriel et mot de passe, comme demandé. Grâce à Auth.js, un fournisseur d'authentification unique pourra être ajouté plus tard sans refonte. **Par défaut :** pas d'authentification unique en version 1 ; seulement courriel et mot de passe.

## A14. Envoi de courriels — ✅ par défaut

**Proposition.** Configuration SMTP par variables d'environnement. En développement, un conteneur **Mailpit** capture les courriels. **Par défaut :** n'importe quel serveur SMTP, configuré par variables d'environnement. Si aucun n'est configuré, les courriels sont écrits dans le journal de l'application, ce qui ne bloque pas le fonctionnement.

## A15. Hébergement et stockage S3 en production — ✅ par défaut

**Proposition.** Pour un hébergement sur un serveur de l'université, utiliser **MinIO**, compatible S3 et auto-hébergé, ajouté au `docker-compose.yml` de production. Une sauvegarde quotidienne (`mariadb-dump` et copie des fichiers) est réalisée par un conteneur dédié, avec une rétention de 14 jours. **Par défaut :** hébergement sur un serveur de l'UASZ avec `docker compose`. Le stockage local (volume Docker) est utilisé tant que MinIO n'est pas mis en place ; le basculement se fait par `STORAGE_DRIVER=s3`.

## A16. Année universitaire « en cours » — ✅ par défaut

**Proposition.** Une seule année est marquée « en cours ». C'est l'administrateur qui la change, explicitement, sans bascule automatique par date. Au changement d'année, les étudiants non réinscrits ne voient plus de ressources (RG7) ; leur compte reste actif.

## A17. Base de données : MariaDB au lieu de PostgreSQL — ✏️ décision de la porteuse du projet

**Décision (12/11/2026).** Le cahier des charges proposait PostgreSQL ; la base retenue est **MariaDB**, version 10.11 LTS ou plus récente.

**Conséquences sur la conception.**
- Prisma reste l'ORM, avec le fournisseur `mysql`, compatible MariaDB.
- **Recherche plein texte (F18)** : index `FULLTEXT` InnoDB et `MATCH … AGAINST` en mode booléen, au lieu de `tsvector`. L'interclassement `utf8mb4_unicode_ci` rend la recherche insensible aux accents et à la casse. En revanche, MariaDB ne fait pas de racinisation du français ; la recherche par préfixe (`simplex*`) compense en partie. L'objectif de moins de 2 s pour 10 000 ressources reste atteignable et sera mesuré au Lot 6.
- **Mots-clés** : MariaDB n'a pas de type tableau. Ils sont stockés dans une colonne texte, séparés par des virgules et normalisés, ce qui permet de les indexer en plein texte.
- **Une seule année « en cours »** : MariaDB n'a pas d'index unique partiel. La colonne `isCurrent` vaut `true` ou `NULL`, jamais `false`, et porte un index unique.
- **Courriel unique, insensible à la casse** : assuré par l'interclassement `_ci` et par un stockage en minuscules.
- **Sauvegarde** : `mariadb-dump --single-transaction`.

## A18. Fuseau horaire des dates de publication — ✅ par défaut (Lot 2)

**Proposition.** Les dates saisies, comme une publication programmée, sont en **heure du Sénégal (GMT)**, qui n'a pas d'heure d'été. Elles sont stockées en UTC, ce qui revient au même, et affichées avec le fuseau `Africa/Dakar`.

## A19. Précisions sur les droits liés aux ressources — ✅ par défaut (Lot 2)

- Un **responsable de formation** est considéré comme un enseignant pour la consultation : il voit les ressources partagées « Enseignants ».
- L'**administrateur** voit tout, peut archiver ou supprimer définitivement, mais **ne dépose pas** de ressource s'il n'est pas affecté à l'EC (RG2 s'applique à tous).
- Seul l'**auteur** modifie le contenu et dépose des versions. L'auteur ou l'administrateur change le statut.
- « Supprimer » un brouillon jamais publié l'efface, fichier compris. Si la ressource a déjà été publiée, même une seule fois, elle est **archivée** (RG9).
- Une ressource **restaurée** revient en brouillon : sa republication est un acte explicite.
- Une **nouvelle version** est déposée avec un commentaire obligatoire. Un sujet déjà validé repasse « en attente de validation » (A5).
- L'aperçu dans le navigateur n'est proposé que pour les formats sûrs (PDF, images, audio, vidéo). Les fichiers HTML, texte et code sont toujours téléchargés, pour éviter toute exécution de script (XSS).

## A20. Recherche et consultation — ✅ par défaut (Lot 3)

- **Recherche :** chaque mot de 3 lettres ou plus est **obligatoire** et peut être complété (« algorith » trouve « algorithmique »). Le titre compte double dans le classement. Les mots plus courts (« TD », « TP ») sont cherchés dans le titre et les mots-clés. La liste de « mots vides » anglaise de MariaDB est désactivée (`innodb_ft_enable_stopword = 0`).
- **Filtre « Format » :** il porte sur l'ensemble des versions d'une ressource, pas seulement sur la version en vigueur. En pratique, le format change rarement d'une version à l'autre.
- **Étudiants :** ils ne parcourent que leur formation, aux semestres de leur niveau (RG7). Le catalogue complet est réservé aux enseignants, aux responsables et à l'administrateur.
- **« Nouvelle » :** une ressource est signalée comme nouvelle pendant **7 jours** après sa publication.
- **Aperçu (F12) :** PDF, images, audio, vidéo, YouTube (domaine « nocookie ») et Google Drive. Comme Chrome sur Android n'affiche pas les PDF intégrés, un lien « nouvel onglet » est toujours proposé.
- **Consultations (RG10) :** l'ouverture d'une fiche compte une **vue**, et un clic sur « Télécharger » compte un **téléchargement**. L'aperçu n'est pas compté comme un téléchargement.

## A21. Validation et notifications — ✅ par défaut (Lot 4)

- **Validation :** la date de publication fait partie de ce qui est validé. Modifier la date, republier ou déposer une nouvelle version d'un sujet le remet « en attente de validation ». Le responsable est prévenu à chaque demande, et l'auteur à chaque validation ou refus.
- **Qui valide :** le responsable de **l'une** des formations des EC du document, ou l'administrateur (A6).
- **Moment de la notification :** une ressource est notifiée **une seule fois**, quand elle devient réellement visible : publication immédiate, date programmée atteinte, ou validation d'un sujet. La tâche périodique (toutes les 10 minutes, avec `CRON_SECRET`) traite les dates programmées. Une nouvelle version ne déclenche pas de notification.
- **Destinataires :** les personnes qui suivent l'EC (inscription ou affectation de l'année, ou suivi explicite) **et** qui ont le droit de voir la ressource. L'auteur n'est jamais notifié de sa propre publication.
- **Courriels :** les notifications non lues sont regroupées en un seul courriel par personne. Chacun peut désactiver les courriels (page Notifications, puis Profil au Lot 5). Sans serveur SMTP configuré, les courriels sont écrits dans le journal de l'application.
- **Favoris :** une ressource devenue invisible (archivée, dépubliée) disparaît de la liste des favoris, sans être retirée des favoris.
