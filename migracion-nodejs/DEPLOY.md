# Cómo montar el sistema en un servidor

Esto levanta tres contenedores con Docker Compose: la base de datos (PostgreSQL 17), la API y un Caddy que sirve el sitio y le pasa todo lo que empiece con `/api` a la API. Solo Caddy abre puertos hacia afuera (80 y 443). La base y la API no se ven desde la red, y así deben quedarse.

Todo lo que hace falta está en este repositorio. No hay que instalar Node, Chrome ni Postgres en el servidor, solo Docker.

## Qué se necesita

Un Linux de 64 bits con Docker Engine y el plugin de Compose v2 (`docker compose version` tiene que responder), y `git`. Con 2 GB de RAM funciona, con 4 va más cómodo: los PDF se generan con un Chromium y ese sí come memoria. Unos 5 GB de disco para empezar, más lo que crezcan los respaldos.

Durante la primera construcción el servidor necesita salir a internet (baja imágenes y paquetes). Después ya no, salvo que use HTTPS con Let's Encrypt.

## Instalación

```bash
git clone <url-del-repositorio>
cd <repositorio>/migracion-nodejs
./deploy/generar-secretos.sh
```

El script crea el archivo `.env` con una contraseña de base de datos y una llave de sesiones al azar. Ábranlo y revisen `SITE_ADDRESS` y `PUBLIC_URL`: lo que va ahí depende de cómo se va a entrar al sitio y se explica más abajo, en HTTPS. Para probar rápido alcanza con `SITE_ADDRESS=:80` y `PUBLIC_URL=http://IP-DEL-SERVIDOR`.

Luego:

```bash
docker compose up -d --build
```

La primera vez tarda varios minutos. Cuando termine, `docker compose ps` debe mostrar la `api` como `healthy`; puede tardar hasta un minuto más porque al arrancar crea las tablas sola. Si dice `starting`, esperen.

## Con datos o sin datos

Falta decidir con qué información arranca el sistema. Son dos caminos y no se mezclan.

Si es una instalación vacía (para probar o para empezar de cero), se siembra lo básico: roles, tipos de trámite, los ocho panteones y el usuario `admin`:

```bash
docker compose exec api npm run prisma:seed
```

El seed no trae una contraseña fija. Genera una y la imprime una sola vez, así que cópienla en ese momento. Si prefieren elegirla: `docker compose exec -e ADMIN_PASSWORD='la-que-quieran' api npm run prisma:seed`.

Si van a usar los datos reales que ya existen, no corran el seed. El respaldo ya trae roles, panteones y usuarios, y lo sembrado le chocaría. Quien tiene acceso a la base actual (Supabase) hace la exportación desde su computadora, con `pg_dump` versión 17 instalado:

```bash
./deploy/exportar-desde-supabase.sh 'postgresql://...:5432/postgres'
```

Eso deja un archivo `.dump`. Se pasa al servidor con `scp` y ahí:

```bash
./deploy/importar-datos.sh panteones-datos-AAAA-MM-DD.dump
```

El script se niega a correr si las tablas ya tienen datos, para no duplicar nada. Ese archivo tiene información personal de gente (fallecidos, expedientes de Fiscalía), así que bórrenlo del servidor y de la computadora de origen cuando terminen. No lo suban a ningún lado, y menos al repositorio.

Los usuarios viajan con sus contraseñas de siempre. Cambien la de `admin` antes de darle acceso a alguien.

## Comprobar que quedó bien

```bash
./deploy/verificar.sh
```

Revisa los contenedores, que el sitio responda y hace un autodiagnóstico: conexión a la base, migraciones, datos base, un administrador activo y que se pueda generar un PDF. Si todo sale `[OK]`, abran el sitio en el navegador, entren y saquen un permiso en PDF. Esa última prueba es la que más rápido delata problemas.

## HTTPS

Conviene ponerlo. Sin HTTPS, el usuario y la contraseña viajan sin cifrar por la red. Hay tres casos y en los tres solo cambian dos líneas del `.env`.

Con un dominio propio que apunte al servidor y los puertos 80 y 443 alcanzables desde internet, Caddy pide y renueva el certificado de Let's Encrypt solo:

```
SITE_ADDRESS=panteones.midominio.gob.mx
PUBLIC_URL=https://panteones.midominio.gob.mx
```

Si el sitio se usa solo dentro de la red del Ayuntamiento, Let's Encrypt no sirve porque no puede llegar a verificar el dominio. Ahí hay que usar un certificado que dé Sistemas. Se guarda en una carpeta `certs/` junto al `docker-compose.yml`, se agrega `- ./certs:/certs:ro` a los `volumes` del servicio `web`, y en `frontend/Caddyfile` se pone esta línea dentro del bloque del sitio:

```
tls /certs/cert.pem /certs/key.pem
```

Después `docker compose up -d --build web`. Si no hay certificado y les da igual que el navegador avise, `tls internal` en esa misma línea hace que Caddy use su propia autoridad; cada computadora tendrá que confiar en ella o verá la advertencia.

Y si de plano se queda en HTTP, que sea solo en una red interna de confianza y como paso provisional.

## Respaldos

No hay nada automático hasta que ustedes lo pongan. Un respaldo completo se hace con:

```bash
./deploy/respaldo.sh
```

Guarda un archivo en `respaldos/` y borra los de más de 14 días. Para que corra solo, todas las noches a las 2:

```
0 2 * * * cd /ruta/al/repositorio/migracion-nodejs && ./deploy/respaldo.sh >> respaldos/respaldo.log 2>&1
```

Ojo con que los respaldos vivan en el mismo servidor que la base: si el disco se muere, se van los dos. Copien la carpeta a otro equipo con `rsync` o como manejen ustedes sus respaldos. Y de vez en cuando prueben restaurar uno; un respaldo que nunca se ha restaurado es una suposición.

Para restaurar:

```bash
./deploy/restaurar-respaldo.sh respaldos/panteones-AAAA-MM-DD_HHMMSS.dump
```

Pide que escriban `RESTAURAR` porque reemplaza todo lo que hay en la base.

## Actualizar

Cuando haya cambios nuevos en el repositorio:

```bash
./deploy/actualizar.sh
```

Hace un respaldo, baja los cambios con `git pull`, reconstruye y reinicia. Si los cambios traen cambios en la base, la API los aplica sola al arrancar y no borra datos.

## Cuando algo falla

Lo primero siempre es mirar los logs: `docker compose logs --tail=100 api` (o `web`, o `db`).

Si `docker compose up` dice que falta `POSTGRES_PASSWORD` o `JWT_SECRET`, es que no existe el `.env`; falta correr `./deploy/generar-secretos.sh`.

Si el puerto 80 ya lo usa otro servicio, pongan `HTTP_PORT=8080` en el `.env` y agréguenlo también a `PUBLIC_URL` (`http://IP:8080`).

Si el certificado no se emite, casi siempre es el DNS (el dominio no apunta a este servidor) o que 80 y 443 no llegan desde afuera. En `docker compose logs web` se ve el motivo.

Si los PDF fallan pero lo demás anda, corran `./deploy/verificar.sh`: dice si Chromium arranca. Lo más común es poca memoria.

Si después de cambiar `POSTGRES_PASSWORD` en el `.env` la API dice `password authentication failed`, es porque la base guardó la contraseña con la que se creó. Regresen el valor anterior. La otra salida es borrar la base con `docker compose down -v`, pero eso borra todos los datos.

Sobre ese comando: `docker compose down` apaga todo y conserva los datos; `docker compose down -v` los destruye. No lo corran por costumbre.

## Cosas que conviene saber

La API asume que hay un solo proxy delante (el Caddy de este mismo compose), y así está configurado: `TRUST_PROXY: 1` en `docker-compose.yml`. Si el servidor queda detrás de otro balanceador o proxy del Ayuntamiento, hay que subir ese número a 2. Si no, el límite de intentos de login y la IP que se anota en la bitácora se pueden engañar.

La base no publica ningún puerto. Si alguien necesita hacer una consulta a mano: `docker compose exec db psql -U panteones panteones`.

Los datos viven en el volumen `pgdata` de Docker, no dentro del repositorio.

El repositorio todavía trae un flujo de GitHub que publica el sitio en GitHub Pages apuntando al servidor viejo (Render). Cuando se cambien al servidor nuevo conviene apagarlo (archivo `.github/workflows/deploy-frontend.yml`) para que no queden dos sitios activos con los mismos datos.

Para quien desarrolle: si se cambia el esquema de la base, se hace con `npx prisma migrate dev --name lo-que-sea` en `backend/`, se sube la carpeta nueva que aparece en `backend/prisma/migrations/` y el servidor la aplica solo al actualizar. La regla de RLS que se usaba en Supabase no aplica aquí, porque la base no queda expuesta.

Si algo de esta guía no coincide con lo que ven en el servidor, avísenle a quien les pasó el repositorio.
