#!/usr/bin/env bash
# Crea .env con claves al azar a partir de .env.example.
# No sobrescribe un .env que ya exista.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env ya existe: no lo toco. (Bórralo si de verdad quieres generar uno nuevo.)"
  exit 0
fi

# Hexadecimal: solo 0-9 y a-f, así la contraseña no necesita escaparse en la URL.
aleatorio() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

POSTGRES_PASSWORD="$(aleatorio 16)"   # 32 caracteres
JWT_SECRET="$(aleatorio 32)"          # 64 caracteres

sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" \
    .env.example > .env
chmod 600 .env

echo ".env creado con claves al azar."
echo "Antes de arrancar, revisa SITE_ADDRESS y PUBLIC_URL dentro de .env (ver DEPLOY.md)."
