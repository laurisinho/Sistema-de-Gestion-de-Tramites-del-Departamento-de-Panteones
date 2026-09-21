#!/usr/bin/env bash
# Carga en el servidor nuevo los datos reales exportados con
# exportar-desde-supabase.sh.
#
# Orden (ver DEPLOY.md):
#   1. docker compose up -d --build     (la API crea las tablas al arrancar)
#   2. ./deploy/importar-datos.sh archivo.dump
# No ejecutar el seed antes: el respaldo ya incluye roles, panteones y usuarios.
set -euo pipefail
cd "$(dirname "$0")/.."

ARCHIVO="${1:-}"
if [ -z "$ARCHIVO" ] || [ ! -f "$ARCHIVO" ]; then
  echo "Uso: ./deploy/importar-datos.sh panteones-datos-AAAA-MM-DD.dump" >&2
  exit 1
fi

psql_db() { docker compose exec -T db psql -U panteones -d panteones -tA -c "$1"; }

# 1) Las tablas deben existir (la API las crea al arrancar).
if ! ROLES="$(psql_db 'select count(*) from roles' 2>/dev/null)"; then
  echo "La base todavía no tiene tablas. Corre primero: docker compose up -d --build" >&2
  echo "y espera a que 'docker compose ps' muestre la API como (healthy)." >&2
  exit 1
fi

# 2) Deben estar vacías: importar sobre datos sembrados choca con las claves únicas.
if [ "$ROLES" != "0" ]; then
  echo "La base ya tiene datos (¿se corrió el seed?). Importar encima los duplicaría." >&2
  echo "Para empezar de cero: docker compose down -v && docker compose up -d --build" >&2
  echo "(ojo: 'down -v' BORRA la base de este servidor)." >&2
  exit 1
fi

echo "Importando $ARCHIVO ..."
docker compose stop web api

# --disable-triggers: carga las tablas sin importar el orden de sus llaves
# foráneas (requiere superusuario, y el usuario "panteones" de la imagen lo es).
# --single-transaction: si algo falla no queda nada a medias.
docker compose exec -T db pg_restore -U panteones -d panteones \
  --data-only --disable-triggers --single-transaction --no-owner < "$ARCHIVO"

docker compose start api web

echo
echo "Datos importados. Conteos:"
for T in usuarios panteones lotes personas titulos_propiedad permisos fallecidos; do
  printf '  %-20s %s\n' "$T" "$(psql_db "select count(*) from $T")"
done
echo
echo "IMPORTANTE: los usuarios vinieron con las contraseñas que ya tenían."
echo "Cambia la de 'admin' desde Administración > Usuarios antes de dar acceso."
