#!/usr/bin/env bash
# Respaldo completo de la base (tablas + datos) en ./respaldos, con rotación.
# Se puede correr a mano o desde cron (ver DEPLOY.md).
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${RESPALDOS_DIR:-./respaldos}"
DIAS="${RESPALDOS_DIAS:-14}"

mkdir -p "$DIR"
chmod 700 "$DIR"

DESTINO="$DIR/panteones-$(date +%Y-%m-%d_%H%M%S).dump"
TMP="$DESTINO.parcial"
trap 'rm -f "$TMP"' EXIT

docker compose exec -T db pg_dump -U panteones -d panteones -Fc > "$TMP"

# Se rechaza un respaldo vacío.
if [ ! -s "$TMP" ]; then
  echo "El respaldo salió vacío: no se guardó." >&2
  exit 1
fi

mv "$TMP" "$DESTINO"
chmod 600 "$DESTINO"

# Rotación: se borran los respaldos de más de N días.
find "$DIR" -name 'panteones-*.dump' -mtime +"$DIAS" -delete

echo "Respaldo creado: $DESTINO ($(du -h "$DESTINO" | cut -f1))"
