# Sistema de Gestión de Trámites — Departamento de Panteones

Aplicación web para el **Departamento de Panteones** de la Sindicatura Municipal
del H. Ayuntamiento de Nogales, Sonora. Reescritura en React + Node.js del
sistema original en .NET, sobre la misma base de datos relacional.

> ⚠️ **Este repositorio es público y aquí no va ningún dato real.** La base
> contiene nombres de personas fallecidas, números de acta y expedientes de la
> Fiscalía, y el Ayuntamiento es sujeto obligado bajo la LPDPPSO. Los datos
> viven solo en la base; nunca subas archivos `.env`, respaldos, exportaciones
> ni capturas con registros reales. El `.gitignore` de la raíz ya bloquea los
> casos conocidos, pero revisa antes de cada commit.

---

## Stack

| | |
|---|---|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL (Supabase) |
| Frontend | React + TypeScript (Vite) |
| Datos remotos | TanStack React Query |
| Sesión | JWT por encabezado `Authorization` (cookie como respaldo) + bcrypt |
| Documentos | Chromium para los PDF, ExcelJS para los reportes |

---

## Módulos

- **Búsqueda de expedientes** — localiza por difunto, titular, folio o ubicación
- **Permisos** — inhumación, exhumación, depósito de cenizas y construcción
- **Títulos de propiedad** y **cesión de derechos**
- **Reimpresiones** — con marca de agua, consecutivo y motivo obligatorio
- **Personas no reclamadas** — fosa común, identificaciones y liberación de lotes
- **Expediente de lote** — línea de tiempo de todo lo ocurrido en una tumba
- **Incidencias** — hechos reportados en los panteones y su seguimiento
- **Reportes** — formatos oficiales de Fiscalía y relación mensual de movimientos
- **Bitácora** — auditoría de toda operación que modifica datos
- **Usuarios** — alta, edición y control de acceso por rol (solo Administrador)
- **Catálogos** — panteones, secciones y agentes del Ministerio Público
- **Apariencia** — colores, logos y nombre del síndico, sin tocar código

---

## Puesta en marcha (desarrollo)

```bash
# Backend
cd backend
npm install
cp .env.example .env   # completar DATABASE_URL, DIRECT_URL, JWT_SECRET
npx prisma migrate deploy   # crea las tablas (base vacía)
npm run prisma:seed         # roles, panteones y el usuario admin
npm run dev                 # http://localhost:4000

# Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173
```

El seed no trae contraseña fija: genera una para `admin` y la imprime una sola vez
(o usa `ADMIN_PASSWORD` si se define).

Si cambias `prisma/schema.prisma`, genera la migración con
`npx prisma migrate dev --name lo-que-cambiaste` y sube la carpeta nueva de
`prisma/migrations/`. No uses `prisma db push` contra una base con datos reales.

---

## Despliegue en un servidor

Está todo en el repositorio (Docker Compose, Caddy, respaldos): ver
[DEPLOY.md](DEPLOY.md).

---

## Estructura

```
backend/    API Express + Prisma (routes, middleware, lib, prisma/migrations)
frontend/   SPA React (pages, components, auth)
deploy/     scripts de instalación, respaldo, restauración y verificación
```

Los endpoints están documentados en [API.md](API.md).
