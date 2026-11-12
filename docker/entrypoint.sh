#!/bin/sh
# Démarrage du conteneur applicatif : migrations de la base, puis serveur Next.js.
set -e
echo "Application des migrations de la base de données…"
node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
echo "Démarrage de RessourcesPéda sur le port ${PORT:-3000}."
exec node server.js
