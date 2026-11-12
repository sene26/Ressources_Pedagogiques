# Points ambigus et solutions proposées

Ce document recense les points du cahier des charges qui admettent plusieurs lectures. Pour chacun, une solution est proposée.
**Chaque point est à valider ou à corriger par la porteuse du projet.** Une fois validées, ces décisions font foi pour les lots suivants.

Légende de l'état : ⏳ à valider · ✅ validé · ✏️ modifié

---

## A1. « Niveau » : de la formation ou de l'inscription ? — ⏳

**Constat.** L'entité *Formation* porte un « niveau (Licence, Master) », et l'*Inscription* porte aussi un « niveau ». Les données de démonstration parlent de « Master 1 MIO ». On ne sait pas si « Master 1 MIO » est une formation à part entière ou l'année 1 de la formation « Master MIO ».

**Proposition.**
- La *Formation* représente le diplôme complet, par exemple « Master MIO », avec un **cycle** (`LICENCE` ou `MASTER`).
- Les *Semestres* sont numérotés dans la formation : S1 à S6 en Licence, S1 à S4 en Master.
- Le **niveau** est l'année d'étude dans la formation (1, 2 ou 3). Il se déduit du semestre : niveau = ⌈numéro / 2⌉. Ainsi S1 et S2 donnent le niveau 1, et S3 et S4 le niveau 2.
- L'*Inscription* porte (étudiant, formation, niveau, année universitaire). « Master 1 MIO » correspond donc à la formation *Master MIO* au niveau 1.
- Un EC est visible des étudiants de niveau *n* si son semestre appartient au niveau *n* (RG4, RG7).

## A2. La maquette varie-t-elle d'une année à l'autre ? — ⏳

**Constat.** Les affectations, les inscriptions et les ressources dépendent de l'année universitaire, mais pas la maquette (formation, UE, EC).

**Proposition.** En version 1, la maquette n'est pas versionnée par année. Un EC supprimé de la maquette est **archivé** (F5), pas effacé, ce qui préserve l'historique des ressources. Les ressources restent rattachées à une année universitaire. F15 permet de les dupliquer d'une année sur l'autre.

## A3. Rattachement d'un responsable à sa formation — ⏳

**Constat.** Le cahier des charges définit le rôle de responsable de formation, mais le modèle de données ne dit pas de quelle(s) formation(s) il est responsable.

**Proposition.** Ajouter l'entité `ProgramManagerAssignment` (utilisateur, formation). Un responsable n'agit que sur les formations qui lui sont rattachées. L'administrateur a tous les droits du responsable sur toutes les formations.

## A4. Qui voit quoi, exactement ? (RG2 à RG7) — ⏳

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

## A5. Validation des sujets d'examen et des corrigés (RG5, F14) — ⏳

**Proposition.**
- Ajouter un champ `approvalStatus` : `NOT_REQUIRED`, `PENDING`, `APPROVED` ou `REJECTED` (avec un motif).
- Quand une ressource de type `EXAM` ou `SOLUTION` est publiée avec la visibilité `EC_STUDENTS`, le statut passe à `PUBLISHED` et l'`approvalStatus` à `PENDING`. Elle reste invisible des étudiants tant qu'elle n'est pas `APPROVED` **et** que sa date de publication n'est pas atteinte.
- La date de publication est **obligatoire** pour ces types.
- Si l'auteur dépose une **nouvelle version** d'une ressource validée, la validation repasse à `PENDING`.
- Si l'auteur est lui-même responsable de la formation, il peut valider (cas fréquent dans les petites équipes). L'action est tracée au journal.
- Avant le Lot 4 (qui livre F14), les examens et corrigés ne peuvent pas être rendus visibles des étudiants. C'est le comportement le plus sûr.

## A6. Ressource rattachée à plusieurs EC (RG1 et RG2) — ⏳

**Proposition.** Pour déposer une ressource sur plusieurs EC, l'enseignant doit être affecté à **chacun** de ces EC pour l'année de la ressource. Les EC peuvent appartenir à des formations différentes, par exemple un cours mutualisé. La validation d'un sujet d'examen peut alors être faite par le responsable de **l'une** des formations concernées.

## A7. Statut et date de publication (F11 et F13) — ⏳

**Proposition.** On n'ajoute pas de statut « Programmée ». Une ressource `PUBLISHED` dont la `publishAt` est dans le futur est considérée comme **programmée** : l'interface l'affiche ainsi, et elle reste invisible des étudiants jusqu'à cette date. Ce calcul se fait au moment de la lecture, ce qui évite une tâche planifiée pour rendre la ressource visible. Une tâche périodique ne sert qu'à envoyer les notifications à la date de publication (F22, Lot 4).
- « Dépublier » remet la ressource en `DRAFT`.
- Un brouillon peut être **supprimé** définitivement par son auteur s'il n'a jamais été publié. Une ressource déjà publiée ne peut être qu'archivée (RG9).

## A8. Versions et liens externes (RG6) — ⏳

**Proposition.** Une version contient **soit** un fichier, **soit** un lien externe. Changer le fichier ou le lien crée une nouvelle version. Modifier le titre, la description ou les mots-clés ne crée pas de version : c'est tracé au journal. La version en vigueur est la plus récente. Les étudiants et les collègues ne voient que celle-là. Les versions précédentes sont visibles de l'auteur, du responsable et de l'administrateur (RG6).

## A9. Formats « code source » (RG8) — ⏳

**Proposition.** Liste fermée et configurable : `.py`, `.ipynb`, `.java`, `.c`, `.h`, `.cpp`, `.js`, `.ts`, `.html`, `.css`, `.sql`, `.r`, `.m`, `.sh`, `.json`, `.csv`, `.md`. Ajout de `.csv` pour les jeux de données cités au §1. Le type réel du fichier est contrôlé (signature binaire) en plus de l'extension. Les liens externes acceptés sont : YouTube, Google Drive et toute URL `https://` (type « lien »).

## A10. EC « suivi » pour les notifications (F22) — ⏳

**Proposition.** Un étudiant suit automatiquement les EC de son inscription en cours. Un enseignant suit automatiquement les EC qui lui sont affectés. Chacun peut suivre ou ne plus suivre un EC (entité `EcSubscription`), et désactiver les courriels dans son profil.

## A11. Profil : formation et niveau (F4) — ⏳

**Proposition.** La formation et le niveau affichés dans le profil viennent de l'**inscription** de l'année en cours. Ils ne sont pas saisis librement, ce qui garde une seule source de vérité. La photo est facultative, redimensionnée à 256 px et compressée en WebP.

## A12. Données personnelles et statistiques (loi 2008-12, RG10) — ⏳

**Proposition.**
- Les tableaux de bord F23 et F24 n'affichent que des **chiffres agrégés** : jamais la liste nominative des étudiants qui ont consulté une ressource.
- Les consultations nominatives sont conservées **2 ans**, puis rendues anonymes (l'utilisateur est retiré, les compteurs sont gardés).
- Une vue répétée par le même utilisateur sur la même ressource dans un intervalle de 30 minutes n'est comptée qu'une fois, pour éviter de gonfler les statistiques.
- Une mention d'information (finalités, durée, droits d'accès et de rectification) sera ajoutée au Lot 6. Une **déclaration auprès de la CDP** (Commission de protection des données personnelles) relève de l'université.

## A13. Authentification : SSO de l'université ? — ⏳

**Constat.** Le cahier des charges demande une connexion par courriel et mot de passe. Si l'UASZ dispose d'un annuaire (LDAP, CAS, Google Workspace), les étudiants préféreront leurs identifiants habituels.

**Proposition.** La version 1 utilise courriel et mot de passe, comme demandé. Grâce à Auth.js, un fournisseur d'authentification unique pourra être ajouté plus tard sans refonte. **Question :** l'UASZ dispose-t-elle d'un tel service ?

## A14. Envoi de courriels — ⏳

**Proposition.** Configuration SMTP par variables d'environnement. En développement, un conteneur **Mailpit** capture les courriels. **Question :** quel serveur SMTP l'université peut-elle fournir en production ?

## A15. Hébergement et stockage S3 en production — ⏳

**Proposition.** Pour un hébergement sur un serveur de l'université, utiliser **MinIO**, compatible S3 et auto-hébergé, ajouté au `docker-compose.yml` de production. Une sauvegarde quotidienne (`pg_dump` et copie des fichiers) est réalisée par un conteneur dédié, avec une rétention de 14 jours. **Question :** où l'application sera-t-elle hébergée (serveur de l'UASZ, cloud) ?

## A16. Année universitaire « en cours » — ⏳

**Proposition.** Une seule année est marquée « en cours ». C'est l'administrateur qui la change, explicitement, sans bascule automatique par date. Au changement d'année, les étudiants non réinscrits ne voient plus de ressources (RG7) ; leur compte reste actif.
