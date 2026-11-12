# Image de production de RessourcesPéda (Lot 6).
# Construction : docker compose build   (ou : docker build -t ressources-peda .)
# L'image de base est paramétrable, par exemple pour utiliser un miroir du registre Docker.
ARG NODE_IMAGE=node:22-bookworm-slim

# ─── Dépendances ───────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
  # CLI Prisma autonome (même version que le projet), pour appliquer les migrations au démarrage.
  && npm install --prefix /opt/prisma-cli --no-audit --no-fund --omit=dev "prisma@$(node -p "require('./node_modules/prisma/package.json').version")"

# ─── Compilation ───────────────────────────────────────────────────────────────
# Cette étape sert aussi d'outil (cible « tools ») pour charger les données de démonstration.
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npx prisma generate && npm run build

FROM build AS tools
CMD ["npx", "tsx", "prisma/seed.ts"]

# ─── Exécution ─────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app && useradd --system --gid app --home /app app \
  && mkdir -p /data/storage && chown -R app:app /data
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_LOCAL_DIR=/data/storage

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# Prisma : schéma, migrations et CLI autonome pour appliquer les migrations au démarrage.
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=deps /opt/prisma-cli /opt/prisma-cli
COPY --chown=app:app docker/entrypoint.sh docker/cron.mjs ./docker/

USER app
EXPOSE 3000
VOLUME ["/data/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/connexion').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
