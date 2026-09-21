#!/usr/bin/env bash
# Actualiza el sistema a la última versión del repositorio, con respaldo antes.
# Las migraciones de base de datos pendientes las aplica la API sola al arrancar.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/3 Respaldo previo..."
./deploy/respaldo.sh

echo "2/3 Descargando la última versión..."
git pull --ff-only

echo "3/3 Reconstruyendo y reiniciando..."
docker compose up -d --build
docker compose ps

echo "Listo. Corre ./deploy/verificar.sh para confirmar."
