# Déploiement et exploitation — RessourcesPéda

## 1. Prérequis

- Un serveur Linux avec **Docker** et **Docker Compose** (v2).
- Un nom de domaine et un **reverse proxy HTTPS** : Nginx, Caddy, ou celui de l'université.
- Un serveur **SMTP** pour les courriels (mot de passe oublié, activation, notifications). Il est facultatif : sans SMTP, les courriels sont écrits dans le journal de l'application.

## 2. Installation

1. Récupérer le code.

   ```bash
   git clone https://github.com/sene26/Ressources_Pedagogiques.git
   ```

   ```bash
   cd Ressources_Pedagogiques
   ```

2. Créer la configuration à partir du modèle.

   ```bash
   cp .env.example .env
   ```

3. Renseigner `.env` :

   | Variable | Valeur |
   | --- | --- |
   | `AUTH_SECRET`, `FILE_TOKEN_SECRET` | `openssl rand -base64 32` (deux valeurs différentes) |
   | `CRON_SECRET` | `openssl rand -hex 24` |
   | `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD` | mots de passe robustes |
   | `APP_URL` | adresse publique, par exemple `https://ressources.uasz.sn` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | serveur de messagerie |
   | `DEMO_PASSWORD` | seulement pour charger les données de démonstration |

   `DATABASE_URL` est calculée par `docker-compose.yml` à partir de `MARIADB_PASSWORD`.

4. Construire et démarrer. Les migrations de la base sont appliquées automatiquement au démarrage.

   ```bash
   docker compose up -d --build
   ```

5. (Facultatif) Charger les données de démonstration : Master MIO, 8 comptes, 20 ressources.

   ```bash
   docker compose --profile demo run --rm seed
   ```

6. Créer le premier administrateur. Avec les données de démonstration, il existe déjà : `admin@uasz.test`. Sinon, depuis un poste qui a accès à la base, lancer la commande ci-dessous, puis changer immédiatement le mot de passe et l'adresse :

   ```bash
   DEMO_PASSWORD='…' npm run db:seed
   ```

### Services lancés

| Service | Rôle |
| --- | --- |
| `app` | application Next.js (port `APP_PORT`, 3000 par défaut) |
| `db` | MariaDB 10.11 (port publié sur `127.0.0.1` uniquement) |
| `cron` | toutes les 10 minutes : notifications programmées et anonymisation des consultations de plus de 2 ans |
| `backup` | sauvegarde quotidienne de la base et des fichiers dans `./backups` (14 jours) |
| `minio` (profil `s3`) | stockage compatible S3 auto-hébergé |
| `mailpit` (profil `dev`) | capture des courriels en développement |

## 3. Reverse proxy HTTPS

Exemple avec Caddy (certificat automatique) :

```
ressources.uasz.sn {
    reverse_proxy 127.0.0.1:3000
    request_body {
        max_size 105MB
    }
}
```

Avec Nginx, prévoir `client_max_body_size 105m;` (fichiers de 100 Mo), `proxy_set_header Host $host;` et `proxy_set_header X-Forwarded-Proto $scheme;`.

L'application envoie déjà les en-têtes de sécurité (CSP, HSTS, X-Frame-Options, nosniff).

## 4. Stockage des fichiers

- **Par défaut** (`STORAGE_DRIVER=local`) : les fichiers sont dans le volume Docker `storage`, sauvegardé chaque jour.
- **S3 / MinIO** (`STORAGE_DRIVER=s3`) : renseigner `S3_ENDPOINT` (par exemple `http://minio:9000`), `S3_BUCKET`, `S3_ACCESS_KEY` et `S3_SECRET_KEY`, créer le bucket, puis lancer :

  ```bash
  docker compose --profile s3 up -d
  ```

  Les téléchargements passent alors par des URL pré-signées de 5 minutes. Le point d'accès S3 doit être joignable depuis les navigateurs, donc publié derrière le reverse proxy.

## 5. Sauvegardes et restauration

Le service `backup` produit chaque jour, dans `./backups`, deux fichiers :
- `base_AAAA-MM-JJ_HHMM.sql.gz` : export complet de la base ;
- `fichiers_AAAA-MM-JJ_HHMM.tar.gz` : fichiers déposés.

Il faut copier régulièrement `./backups` hors du serveur (autre machine, stockage de l'université).

**Restaurer la base :**

```bash
gunzip -c backups/base_2026-11-12_0300.sql.gz | docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'
```

**Restaurer les fichiers :**

```bash
docker compose run --rm -v "$PWD/backups:/backups" --entrypoint sh app -c 'tar -xzf /backups/fichiers_2026-11-12_0300.tar.gz -C /data'
```

## 6. Mise à jour

```bash
git pull
```

```bash
docker compose up -d --build
```

Les nouvelles migrations sont appliquées au démarrage du conteneur `app`. Faites une sauvegarde juste avant la mise à jour :

```bash
docker compose run --rm -e BACKUP_ONCE=1 backup
```

## 7. Exploitation courante

| Action | Où |
| --- | --- |
| Changer d'année universitaire | Gestion › Années universitaires › « Définir comme année en cours » |
| Importer les étudiants de la rentrée | Gestion › Utilisateurs › Importer (CSV) |
| Consulter le journal | Gestion › Journal |
| Journaux techniques | `docker compose logs app`, `docker compose logs cron`, `docker compose logs backup` |

## 8. Développement local (sans Docker pour l'application)

Lancer MariaDB et Mailpit :

```bash
docker compose --profile dev up -d db mailpit
```

Créer les tables, charger les données de démonstration et lancer le serveur de développement :

```bash
npm run db:deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Avec un MariaDB installé localement, reprendre les réglages de `docker/mariadb/ressources.cnf` : interclassement `utf8mb4_unicode_ci`, `innodb_ft_min_token_size = 3` et `innodb_ft_enable_stopword = 0`.
