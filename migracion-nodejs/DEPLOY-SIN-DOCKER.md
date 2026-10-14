# Instalación básica en Ubuntu, sin Docker

Esta guía es lo mínimo para poner el sistema a andar directamente en un Ubuntu. Cómo lo dejen (servicio, firewall, HTTPS, respaldos, quién lo vigila) lo deciden ustedes. Para esas partes sirve de referencia `DEPLOY.md`, que describe lo mismo pero con Docker.

## Lo más importante: la base de datos es PostgreSQL

El sistema está hecho para **PostgreSQL** (se desarrolló y probó con la versión 17). **No funciona con MySQL** tal como está. No es cambiar una línea de configuración: las búsquedas sin distinguir mayúsculas, un índice único parcial y las migraciones usan funciones propias de PostgreSQL. Pasarlo a MySQL es trabajo de programación, no de instalación.

Si el servidor ya tiene MySQL pero se puede instalar PostgreSQL al lado (`sudo apt install postgresql`), esa es la salida más corta.

## Qué se necesita

- Ubuntu de 64 bits, `git`, y **Node.js 22 o más nuevo** (el sistema se probó con 24).
- PostgreSQL 14 o más nuevo.
- Un navegador para generar los PDF (permisos, títulos). Ver "PDF" más abajo.
- Un servidor web que entregue los archivos del sitio y reenvíe `/api` a la API (nginx, Apache, lo que usen).

## 1. Base de datos

```bash
sudo -u postgres psql
```

```sql
CREATE USER panteones WITH PASSWORD 'una-contraseña-larga';
CREATE DATABASE panteones OWNER panteones;
```

La contraseña conviene que sea solo letras y números, porque va dentro de una URL.

## 2. API (backend)

```bash
git clone <url-del-repositorio>
cd <repositorio>/migracion-nodejs/backend
cp .env.example .env
```

Edítenle el `.env`. Lo que importa en producción:

```
DATABASE_URL="postgresql://panteones:LA-CONTRASEÑA@localhost:5432/panteones?schema=public"
DIRECT_URL="postgresql://panteones:LA-CONTRASEÑA@localhost:5432/panteones?schema=public"
JWT_SECRET="<una llave al azar de 48 bytes o más>"
JWT_EXPIRES_IN="8h"
PORT=4000
NODE_ENV=production
FRONTEND_ORIGIN="https://la-direccion-del-sitio"
TRUST_PROXY=1
```

- `JWT_SECRET`: se genera con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Quien la conozca puede fabricar una sesión de Administrador, así que no la compartan.
- `FRONTEND_ORIGIN`: la dirección con la que la gente abre el sitio, tal cual (`http://IP` o `https://dominio`). Si no coincide, el navegador bloquea las llamadas a la API.
- `TRUST_PROXY=1`: hay un proxy delante de la API (el servidor web). Si hay dos, `2`. De esto depende que la IP de la bitácora y el límite de intentos de login sean los reales.
- Las variables `SUPABASE_*` del ejemplo no se usan aquí. Ver "Documentos escaneados" abajo.

Luego instalar, compilar y crear las tablas:

```bash
npm ci --include=dev
npm run build
npx prisma migrate deploy
```

`migrate deploy` solo crea o actualiza tablas; no borra datos. Se corre otra vez cada vez que se actualice el código.

Para una instalación vacía (roles, tipos de trámite, panteones y el usuario `admin`):

```bash
ADMIN_PASSWORD='la-que-quieran' npm run prisma:seed
```

Si no se define `ADMIN_PASSWORD`, el seed genera una y la imprime una sola vez. Si van a cargar los datos reales existentes, **no** corran el seed (ver `DEPLOY.md`, sección "Con datos o sin datos").

Para dejar la API corriendo con `node dist/index.js` (desde `backend/`), lo normal es un servicio de systemd que reinicie solo, por ejemplo `/etc/systemd/system/panteones-api.service`:

```ini
[Unit]
Description=API Panteones
After=network.target postgresql.service

[Service]
WorkingDirectory=/ruta/al/repositorio/migracion-nodejs/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
User=panteones

[Install]
WantedBy=multi-user.target
```

`dist/index.js` lee el `.env` de su carpeta. Para comprobar que está viva: `curl http://localhost:4000/api/health`.

## 3. Sitio (frontend)

```bash
cd <repositorio>/migracion-nodejs/frontend
npm ci
VITE_API_URL=/api VITE_BASE_PATH=/ npm run build
```

Eso deja la carpeta `dist/` con el sitio ya compilado. Con `VITE_API_URL=/api` el sitio llama a la API en su mismo dominio, así que el mismo build sirve con cualquier IP o dominio sin recompilar.

Hay que servir esa carpeta y reenviar `/api` a la API. Ejemplo para nginx:

```nginx
server {
    listen 80;
    server_name _;
    root /ruta/al/repositorio/migracion-nodejs/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

El sitio usa rutas con `#`, así que no necesita reescribir URLs. `client_max_body_size` debe ser al menos 15 MB si se van a subir documentos.

## PDF

Los permisos y títulos se generan con un Chromium. Hay dos formas:

- **Sin hacer nada:** en producción la API usa el Chromium que viene incluido en `@sparticuz/chromium` (se instala con `npm ci`). Es lo que usa hoy el servidor en Render. En un Ubuntu completo no se ha probado.
- **Con el del sistema:** instalar Google Chrome (`.deb` de google.com/chrome) o un Chromium que no sea el paquete snap de Ubuntu (el snap no deja que otro programa lo abra), y apuntarlo en el `.env`: `CHROMIUM_PATH=/usr/bin/google-chrome`. Los PDF usan la tipografía Arial; en Ubuntu se resuelve con `sudo apt install fonts-liberation`, que tiene las mismas medidas.

Con 2 GB de RAM alcanza, con 4 va más cómodo.

## Comprobar que quedó bien

Desde `backend/`:

```bash
npx tsx scripts/verificar-instalacion.ts
```

Revisa la conexión a la base, las migraciones, los datos base, que exista un administrador activo y que se pueda generar un PDF. Si todo sale `[OK]`, abran el sitio, entren y saquen un permiso en PDF: esa prueba delata los problemas más rápido.

## Documentos escaneados (pendiente)

La función de subir documentos escaneados al expediente de un lote guarda los archivos en **Supabase Storage**. En un servidor propio no existe, así que esa función falla al subir, bajar o borrar un documento; todo lo demás funciona normal. Para tenerla aquí hay que cambiar el almacenamiento a una carpeta del servidor (`backend/src/lib/storageDocumentos.ts` es el único archivo que habla con Supabase). Por ahora queda como pendiente.

## Cosas que conviene saber

- La base contiene datos personales de gente (fallecidos, expedientes de Fiscalía): que no sea alcanzable desde la red, solo desde el propio servidor.
- Sin HTTPS, el usuario y la contraseña viajan sin cifrar. Conviene ponerlo, o dejarlo solo en una red interna de confianza.
- Respaldos: nada es automático. Un `pg_dump` periódico de la base `panteones` y copiarlo a otro equipo es lo mínimo.
- El repositorio trae un flujo de GitHub (`.github/workflows/deploy-frontend.yml`) que publica el sitio en GitHub Pages apuntando al servidor viejo (Render). Cuando se cambien al servidor nuevo conviene apagarlo para que no queden dos sitios con los mismos datos.
- Actualizar: `git pull`, y repetir en `backend/` `npm ci --include=dev`, `npm run build`, `npx prisma migrate deploy` y reiniciar el servicio; y en `frontend/` `npm ci` y la compilación de arriba.
