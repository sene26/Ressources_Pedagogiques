# Installer RessourcesPéda sur un ordinateur Windows (pour tester)

Ce guide permet de faire tourner l'application sur votre propre ordinateur, sans Docker, avec les données de démonstration.
Comptez 20 à 30 minutes. À la fin, l'application est disponible sur **http://localhost:3000**, sur cet ordinateur seulement.

## Étape 1 — Installer Node.js

1. Allez sur https://nodejs.org et téléchargez la version **LTS** (22 ou plus récente).
2. Lancez l'installateur et gardez les options par défaut (« Next » jusqu'au bout).

## Étape 2 — Installer MariaDB

1. Allez sur https://mariadb.org/download et téléchargez **MariaDB Server** pour Windows (version 10.11 ou plus récente, fichier `.msi`).
2. Pendant l'installation :
   - choisissez un **mot de passe pour l'utilisateur root**, uniquement avec des lettres et des chiffres (par exemple `Uasz2026test`), et **notez-le** ;
   - laissez cochée l'option « Install as service » et le port **3306**.

> **Vous avez déjà XAMPP ?** Vous pouvez utiliser son MariaDB : démarrez « MySQL » dans le panneau XAMPP. Le mot de passe root est vide par défaut. Attention, XAMPP fournit souvent une version plus ancienne de MariaDB (10.4), avec laquelle l'application n'a pas été testée.

## Étape 3 — Régler MariaDB pour la recherche

1. Ouvrez le Bloc-notes **en tant qu'administrateur** (clic droit › « Exécuter en tant qu'administrateur »).
2. Ouvrez le fichier de configuration :
   - installation MariaDB : `C:\Program Files\MariaDB 11.4\data\my.ini` (le numéro de version peut différer) ;
   - XAMPP : `C:\xampp\mysql\bin\my.ini`.
3. Sous la ligne `[mysqld]`, ajoutez :

   ```
   character-set-server = utf8mb4
   collation-server = utf8mb4_unicode_ci
   innodb_ft_min_token_size = 3
   innodb_ft_enable_stopword = 0
   ```

4. Enregistrez, puis redémarrez MariaDB : menu Démarrer › « Services » › **MariaDB** › « Redémarrer ». Avec XAMPP, arrêtez puis redémarrez « MySQL ».

## Étape 4 — Télécharger l'application

1. Sur GitHub, ouvrez le dépôt **sene26/Ressources_Pedagogiques**.
2. Choisissez la branche **`claude/jolly-ride-it6uzu`** (bouton de choix de branche, en haut à gauche de la liste des fichiers).
3. Cliquez sur **Code › Download ZIP**.
4. Décompressez le fichier, par exemple dans `C:\RessourcesPeda`.

## Étape 5 — Ouvrir PowerShell dans le dossier

Dans l'Explorateur, ouvrez le dossier `C:\RessourcesPeda` (celui qui contient `package.json`). Cliquez dans la barre d'adresse, tapez `powershell`, puis appuyez sur Entrée.

Toutes les commandes suivantes se tapent dans cette fenêtre.

## Étape 6 — Installer les dépendances

```powershell
npm install
```

L'installation prend quelques minutes.

## Étape 7 — Créer le fichier de configuration

1. Copiez le modèle :

   ```powershell
   copy .env.example .env
   ```

2. Générez trois secrets en lançant **trois fois** cette commande, et notez chaque résultat :

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Ouvrez la configuration dans le Bloc-notes :

   ```powershell
   notepad .env
   ```

4. Modifiez ces lignes, en gardant les guillemets :

   ```
   DATABASE_URL="mysql://root:VOTRE_MOT_DE_PASSE_ROOT@127.0.0.1:3306/ressources_peda"
   AUTH_SECRET="premier secret généré"
   FILE_TOKEN_SECRET="deuxième secret généré"
   CRON_SECRET="troisième secret généré"
   DEMO_PASSWORD="Demo-uasz-2026"
   ```

   - Remplacez `VOTRE_MOT_DE_PASSE_ROOT` par le mot de passe choisi à l'étape 2.
   - Avec XAMPP, dont le mot de passe est vide, écrivez : `mysql://root:@127.0.0.1:3306/ressources_peda`.
   - Écrivez bien `127.0.0.1` et non `localhost` : sur certains Windows, « localhost » ne mène pas à MariaDB.
   - `DEMO_PASSWORD` sera le mot de passe de tous les comptes de démonstration (10 caractères au moins).

5. Enregistrez et fermez le Bloc-notes.

## Étape 8 — Créer la base et les données de démonstration

Créez les tables. La base `ressources_peda` est créée automatiquement.

```powershell
npm run db:deploy
```

Chargez la formation Master MIO, les 8 comptes et les 20 ressources :

```powershell
npm run db:seed
```

## Étape 9 — Lancer l'application

Compilez l'application (la première fois seulement, ou après une mise à jour) :

```powershell
npm run build
```

Démarrez-la :

```powershell
npm start
```

Ouvrez **http://127.0.0.1:3000** dans votre navigateur (ou http://localhost:3000). Pour arrêter l'application, appuyez sur Ctrl+C dans la fenêtre PowerShell. Pour la relancer plus tard, refaites l'étape 5, puis `npm start`.

## Comptes de démonstration

Tous les comptes ont le mot de passe défini par `DEMO_PASSWORD` (par exemple `Demo-uasz-2026`).

| Adresse | Pour tester |
| --- | --- |
| `f.sarr@uasz.test` | Étudiante en Master 1 : Mes cours, recherche, favoris |
| `a.diallo@uasz.test` | Enseignante et responsable : dépôt, validations, tableau de bord, gestion de la formation |
| `m.ndiaye@uasz.test` | Enseignant |
| `admin@uasz.test` | Administrateur : comptes, années, formations, journal |

Mode d'emploi détaillé : [`guide-utilisateur.md`](guide-utilisateur.md).

## En cas de problème

| Message | Solution |
| --- | --- |
| `npm` n'est pas reconnu | Fermez puis rouvrez PowerShell après l'installation de Node.js. |
| `Can't reach database server` ou `Access denied` | Vérifiez que MariaDB est démarré (Services) et que le mot de passe dans `DATABASE_URL` est le bon. |
| `DEMO_PASSWORD` au moins 10 caractères | Allongez la valeur dans `.env`, puis relancez `npm run db:seed`. |
| La recherche ne trouve pas certains mots | L'étape 3 doit être faite **avant** l'étape 8. Sinon, supprimez la base `ressources_peda` avec HeidiSQL (installé avec MariaDB), puis refaites l'étape 8. |
| Le port 3000 est déjà utilisé | Lancez `npm start -- -p 3001` et ouvrez http://localhost:3001. Dans ce cas, mettez aussi `APP_URL="http://localhost:3001"` dans `.env`. |

Les courriels (mot de passe oublié, notifications) ne sont pas envoyés : sans serveur de messagerie configuré, leur contenu s'affiche dans la fenêtre PowerShell.
