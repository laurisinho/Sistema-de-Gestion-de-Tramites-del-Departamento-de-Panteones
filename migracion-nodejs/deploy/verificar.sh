#!/usr/bin/env bash
# Revisa que la instalación esté sana: contenedores, sitio y autodiagnóstico
# (base de datos, migraciones, datos base y generación de PDF).
set -uo pipefail
cd "$(dirname "$0")/.."

set -a
[ -f .env ] && . ./.env
set +a

echo "== Contenedores =="
docker compose ps
echo

echo "== Sitio ${PUBLIC_URL:-http://localhost} =="
if command -v curl >/dev/null 2>&1; then
  if curl -fsSkL --max-time 15 "${PUBLIC_URL:-http://localhost}/api/health" >/dev/null; then
    echo "  [OK]    /api/health responde"
  else
    echo "  [FALLA] /api/health no responde (revisa PUBLIC_URL / SITE_ADDRESS en .env y el DNS)"
  fi
else
  echo "  (curl no está instalado; se omite esta prueba)"
fi
echo

echo "== Autodiagnóstico =="
docker compose exec -T api npx tsx scripts/verificar-instalacion.ts
