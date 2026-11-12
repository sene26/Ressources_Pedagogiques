#!/bin/sh
# Sauvegarde quotidienne (exigence de fiabilité) : base MariaDB et fichiers déposés.
# Conservées BACKUP_RETENTION_DAYS jours (14 par défaut) dans le dossier monté sur /backups.
set -eu
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"

backup() {
  stamp="$(date +%Y-%m-%d_%H%M)"
  echo "[$stamp] Sauvegarde de la base…"
  mariadb-dump --host=db --user=root --password="$MARIADB_ROOT_PASSWORD" \
    --single-transaction --routines --triggers --databases ressources_peda | gzip > "/backups/base_$stamp.sql.gz"
  echo "[$stamp] Sauvegarde des fichiers…"
  tar -czf "/backups/fichiers_$stamp.tar.gz" -C /data storage
  find /backups -name 'base_*.sql.gz' -mtime "+$RETENTION" -delete
  find /backups -name 'fichiers_*.tar.gz' -mtime "+$RETENTION" -delete
  echo "[$stamp] Sauvegarde terminée."
}

# BACKUP_ONCE=1 : une seule sauvegarde, immédiate (avant une mise à jour par exemple).
if [ "${BACKUP_ONCE:-0}" = "1" ]; then
  backup
  exit 0
fi

# Laisse à la base le temps de démarrer, puis sauvegarde à intervalle régulier.
sleep "${BACKUP_INITIAL_DELAY_SECONDS:-60}"
while true; do
  backup || echo "Échec de la sauvegarde ; nouvel essai au prochain cycle."
  sleep "$((INTERVAL_HOURS * 3600))"
done
