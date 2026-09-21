#!/usr/bin/env bash
# Exporta solo los datos de la base actual (Supabase) a un archivo que
# importar-datos.sh carga en el servidor nuevo. Las tablas las crea el sistema
# con sus migraciones, por eso no se exporta el esquema.
#
# Se ejecuta en la computadora del desarrollador, no en el servidor, y requiere
# el cliente de PostgreSQL 17 (pg_dump): no puede ser de una versión menor a la
# del servidor de origen (Supabase usa PostgreSQL 17).
#
#   ./deploy/exportar-desde-supabase.sh 'postgresql://postgres.xxx:CLAVE@...:5432/postgres'
#
# Se usa la DIRECT_URL (puerto 5432) de backend/.env, no la del pooler
# transaccional.
#
# El archivo resultante contiene datos personales reales (fallecidos, expedientes
# de Fiscalía, usuarios con contraseña cifrada): debe transferirse por un canal
# seguro (scp), borrarse después de importarlo y nunca subirse al repositorio.
set -euo pipefail

URL="${1:-${DIRECT_URL:-}}"
if [ -z "$URL" ]; then
  echo "Uso: $0 'postgresql://...:5432/postgres'  [archivo-de-salida.dump]" >&2
  exit 1
fi
SALIDA="${2:-panteones-datos-$(date +%Y-%m-%d).dump}"

command -v pg_dump >/dev/null 2>&1 || { echo "Falta pg_dump (cliente de PostgreSQL 17)." >&2; exit 1; }

pg_dump --dbname="$URL" \
  --data-only --schema=public \
  --exclude-table=public._prisma_migrations \
  --no-owner --no-privileges \
  -Fc -f "$SALIDA"

chmod 600 "$SALIDA"
echo "Listo: $SALIDA ($(du -h "$SALIDA" | cut -f1))"
echo "Recuerda: es información personal. Bórralo del servidor y de tu equipo cuando termines."
