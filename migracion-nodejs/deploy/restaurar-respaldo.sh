#!/usr/bin/env bash
# Restaura un respaldo hecho con respaldo.sh.
# REEMPLAZA todo lo que hay hoy en la base por lo que trae el respaldo.
set -euo pipefail
cd "$(dirname "$0")/.."

ARCHIVO="${1:-}"
if [ -z "$ARCHIVO" ] || [ ! -f "$ARCHIVO" ]; then
  echo "Uso: ./deploy/restaurar-respaldo.sh respaldos/panteones-AAAA-MM-DD_HHMMSS.dump" >&2
  exit 1
fi

echo "ATENCIÓN: esto REEMPLAZA todos los datos actuales por los del respaldo:"
echo "  $ARCHIVO"
read -r -p "Escribe RESTAURAR para continuar: " CONFIRMA
if [ "$CONFIRMA" != "RESTAURAR" ]; then
  echo "Cancelado. No se cambió nada."
  exit 1
fi

# Se detienen la API y el sitio para que nadie escriba durante la restauración.
docker compose stop web api

# Una sola transacción: si algo falla, la base queda como estaba, no a medias.
docker compose exec -T db pg_restore -U panteones -d panteones --clean --if-exists --no-owner --single-transaction < "$ARCHIVO"

docker compose start api web
echo "Restauración terminada. Corre ./deploy/verificar.sh para confirmar."
