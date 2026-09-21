# API del sistema de Panteones (Node + Express + Prisma) con Chromium para los PDF.
FROM node:24-bookworm-slim

# Chromium del sistema + fuentes: los PDF usan Arial, que aquí se resuelve con
# Liberation Sans (mismas medidas), así que salen igual que en desarrollo.
# openssl lo necesita Prisma; tini reenvía bien las señales al apagar el contenedor.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    CHROMIUM_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

WORKDIR /app

# --include=dev: NODE_ENV=production haría que npm omita tsx, y con él los
# scripts de siembra y de verificación (npm run prisma:seed, verificar).
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && chown -R node:node /app

USER node
EXPOSE 4000

# Las migraciones se aplican al arrancar: una instalación nueva crea sus tablas
# sola, y una actualización aplica solo lo que falte (nunca borra datos).
ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
