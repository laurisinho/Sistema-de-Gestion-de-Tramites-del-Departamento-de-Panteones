# Sistema de Gestión de Trámites — Departamento de Panteones

Aplicación web para el **Departamento de Panteones** de la Sindicatura Municipal
del H. Ayuntamiento de Nogales, Sonora. Reescritura en React + Node.js del
sistema original en .NET, sobre la misma base de datos relacional.

> ⚠️ **Este repositorio debe permanecer privado.** La base de datos (Supabase)
> contiene nombres de personas fallecidas, números de acta y expedientes de la
> Fiscalía. El Ayuntamiento es sujeto obligado bajo la LPDPPSO. El repo en sí
> no guarda esos datos (viven solo en la base), pero nunca subas archivos
> `.env`, dumps de la base ni exportes con datos reales.

---

## Stack

| | |
|---|---|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL (Supabase) |
| Frontend | React + TypeScript (Vite) |
| Datos remotos | TanStack React Query |
| Sesión | JWT en cookie HttpOnly + bcrypt |

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

---

## Puesta en marcha (desarrollo)

```bash
# Backend
cd backend
npm install
cp .env.example .env   # completar DATABASE_URL, DIRECT_URL, JWT_SECRET
npx prisma generate
npm run dev             # http://localhost:4000

# Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Usuario sembrado por `prisma/seed.ts`: `admin` / `Admin2026` (rol Administrador).

---

## Estructura

```
backend/    API Express + Prisma (routes, middleware, lib)
frontend/   SPA React (pages, components, auth)
```
