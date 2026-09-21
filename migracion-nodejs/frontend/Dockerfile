# Frontend (React) compilado y servido por Caddy, que además enruta /api al backend.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# La API vive en el mismo dominio, bajo /api (la enruta Caddy): con una URL
# relativa el mismo build sirve con cualquier dominio o IP sin recompilar.
# VITE_BASE_PATH=/ porque el sitio está en la raíz (GitHub Pages lo servía bajo
# /<repo>/).
ENV VITE_API_URL=/api \
    VITE_BASE_PATH=/
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
