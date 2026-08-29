# Contrato de API — Node.js/Express + React

Traducción de los 12 controladores actuales (ASP.NET Core MVC) a endpoints REST.
Base: inventario real de acciones en `PanteonesMunicipales/Controllers/*.cs` (no memoria/inferencia).

## Convención de nombres

- **Base de datos**: `snake_case` (ver `schema_postgres.sql`) — idiomático en Postgres, evita entrecomillar identificadores en consultas crudas o en `psql`.
- **Modelos Prisma**: `PascalCase` (igual que las entidades C# actuales: `Permiso`, `Fallecido`, `Lote`...) mapeados a las tablas snake_case con `@@map("permisos")` / columnas con `@map("fallecido_id")`. Esto conserva el vocabulario mental ya usado en este proyecto durante el port.
- **JSON de la API**: `camelCase` (convención de JS/React) — Prisma ya expone los campos del modelo en camelCase por defecto, no se necesita transformación extra.
- **Rutas**: `kebab-case`, en español (igual que ahora), bajo prefijo `/api`.

## Autenticación

Se mantiene JWT en cookie `HttpOnly`, no `Authorization: Bearer` — evita tener que guardar el token en `localStorage` (vulnerable a XSS) y es el patrón que ya está validado en el sistema actual.

| Actual (MVC) | Nuevo endpoint | Notas |
|---|---|---|
| `GET /Auth/Login` (view) | — | La vista la sirve React; no hay endpoint, es una ruta del router del frontend |
| `POST /Auth/Login` | `POST /api/auth/login` | Body `{ nombreUsuario, password }`. Responde `Set-Cookie: auth_token` + `{ usuario, rol }`. Rate-limit recomendado (no existía antes; una SPA expone el endpoint de login más directamente a fuerza bruta) |
| `GET /Auth/Logout` | `POST /api/auth/logout` | Borra la cookie. Convertir a POST: un GET que muta sesión es una mala práctica que ya arrastrábamos del MVC, aprovechar el rewrite para corregirlo |
| `GET /Auth/GenerarHash` | *(no migra)* | Era una utilidad de admin para generar hashes manualmente; en Node se resuelve con un script de seed/CLI, no necesita ser un endpoint HTTP |
| *(no existía)* | `GET /api/auth/me` | **Nuevo, necesario para la SPA.** Razor tenía el usuario disponible server-side en cada request (`User.Identity`); React necesita preguntarle a la API quién es el usuario actual al cargar la app, para decidir qué mostrar en el sidebar y proteger rutas del lado cliente |

CSRF: al pasar a JSON sobre fetch/axios (no `<form>` con submit tradicional), el vector de CSRF clásico baja mucho, pero como la auth sigue viviendo en cookie hay que mantener una defensa — la más simple es `SameSite=Strict` (ya se usa) + verificar `Origin`/`Referer` en mutaciones, o adoptar el patrón double-submit-cookie si Sistemas lo prefiere explícito.

## Dashboard

| Actual | Nuevo endpoint |
|---|---|
| `GET /Home/Index` | `GET /api/dashboard` — devuelve los mismos agregados que hoy arma `HomeController.Index()` (conteos por panteón, últimos movimientos, etc.) |

## Búsqueda global / Expedientes (`BusquedaController`)

Es el controlador más grande — cubre tanto búsqueda general como edición/eliminación de expedientes y de permisos ya emitidos (funciones administrativas de corrección).

| Actual | Nuevo endpoint |
|---|---|
| `GET /Busqueda/Index` | *(vista de React, sin endpoint propio si solo renderiza el formulario)* |
| `GET /Busqueda/Buscar?termino&tipo&panteonId` | `GET /api/busqueda?termino=&tipo=&panteonId=` |
| `GET /Busqueda/Detalle/{id}` | `GET /api/expedientes/{id}` |
| `GET /Busqueda/EditarExpediente/{id}` | `GET /api/expedientes/{id}/editar` (datos para precargar el formulario) |
| `POST /Busqueda/EditarExpediente` | `PUT /api/expedientes/{id}` |
| `POST /Busqueda/EliminarExpediente/{id}` | `DELETE /api/expedientes/{id}` |
| `GET /Busqueda/Permisos?termino&tipo&panteonId` | `GET /api/busqueda/permisos?termino=&tipo=&panteonId=` |
| `GET /Busqueda/DetallePermiso/{id}` | `GET /api/permisos/{id}` *(reusa el mismo recurso que `PermisosController`, ver abajo — en MVC estaba duplicado en dos controladores)* |
| `GET /Busqueda/EditarPermiso/{id}` | `GET /api/permisos/{id}/editar` |
| `POST /Busqueda/EditarPermiso` | `PUT /api/permisos/{id}` |
| `POST /Busqueda/EliminarPermiso/{id}` | `DELETE /api/permisos/{id}` |

**Nota de diseño**: al portar, vale la pena fusionar `BusquedaController.DetallePermiso/EditarPermiso/EliminarPermiso` con `PermisosController` — en Express no hay razón para mantener la separación que existía en MVC entre "búsqueda" y "gestión de permisos"; ambos terminan operando sobre el mismo recurso `/api/permisos/{id}`. Confirmarlo como parte del diseño del router, no es un cambio de comportamiento.

## Permisos (`PermisosController`)

| Actual | Nuevo endpoint | Notas |
|---|---|---|
| `GET /Permisos/Index` | `GET /api/permisos` |
| `GET /Permisos/Nuevo?tipo=SEP` | *(formulario en React; el `tipo` viaja como query param de la ruta del frontend, no de la API)* |
| `POST /Permisos/Nuevo` | `POST /api/permisos` | **El endpoint más delicado del port.** Debe reproducir exacto: reutilización de `Fallecido` si viene `fallecidoId` (sin pisar datos ya capturados), `RegistrarOcupacionDeLote` en SEP/CEN, `RegistrarExhumacionEnLote` en EXH (solo libera el lote si `esFosaComun`), lógica de `EsDonacion` + recibo. Ver `PermisosController.cs` líneas ~51-238 como referencia exacta de comportamiento a preservar |
| `GET /Permisos/BuscarFallecido?termino=` | `GET /api/fallecidos/buscar?termino=` |
| `GET /Permisos/BuscarLote?manzana&lote&panteonId` | `GET /api/lotes/buscar?manzana=&lote=&panteonId=` |
| `GET /Permisos/Imprimir/{id}` | `GET /api/permisos/{id}/pdf` → `Content-Type: application/pdf` |

## Títulos (`TitulosController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /Titulos/Index` | `GET /api/titulos` |
| `GET /Titulos/Nuevo` | *(formulario en React)* |
| `POST /Titulos/Nuevo` | `POST /api/titulos` |
| `GET /Titulos/Imprimir/{id}` | `GET /api/titulos/{id}/pdf` |
| `POST /Titulos/ActualizarEntrega` | `PATCH /api/titulos/{id}/entrega` — body `{ estadoEntrega }` |

## Cesiones (`CesionesController`)

| Actual | Nuevo endpoint | Notas |
|---|---|---|
| `GET /Cesiones/Index` | `GET /api/cesiones` |
| `GET /Cesiones/Nueva` | *(formulario en React)* |
| `GET /Cesiones/BuscarTitulo?termino=` | `GET /api/titulos/buscar?termino=` |
| `POST /Cesiones/Nueva` | `POST /api/cesiones` | **Debe preservar la transacción atómica** (Persona nueva → Título nuevo VIGENTE → Título viejo CEDIDO → registro de Cesión) usando `prisma.$transaction([...])`, igual que el `BeginTransactionAsync`/`Commit`/`Rollback` actual |
| `GET /Cesiones/Imprimir/{id}` | `GET /api/cesiones/{id}/pdf` |

## No Reclamados (`NoReclamadosController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /NoReclamados/Index?q=` | `GET /api/no-reclamados?q=` |
| `GET /NoReclamados/Reporte` | *(vista de selección de filtros en React)* |
| `GET /NoReclamados/GenerarReporte?desde&hasta&...` | `GET /api/no-reclamados/reporte?desde=&hasta=&...` → Excel (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |
| `GET /NoReclamados/ReporteIdentificados?desde&hasta&...` | `GET /api/no-reclamados/reporte-identificados?desde=&hasta=&...` → Excel |
| `GET /NoReclamados/Detalle/{id}` | `GET /api/no-reclamados/{id}` |
| `GET /NoReclamados/Reconocer/{id}` | `GET /api/no-reclamados/{id}/reconocer` (datos para precargar el formulario) |
| `POST /NoReclamados/Reconocer` | `POST /api/no-reclamados/{id}/reconocer` |
| `GET /NoReclamados/Reconocidos?q&anio&trimestre` | `GET /api/no-reclamados/reconocidos?q=&anio=&trimestre=` |
| `GET /NoReclamados/LotesDisponibles?seccion=` | `GET /api/lotes/fosa-comun-disponibles?seccion=` |
| `GET /NoReclamados/Crear` | *(formulario en React)* |
| `POST /NoReclamados/Crear` | `POST /api/no-reclamados` |
| `GET /NoReclamados/Editar/{id}` | `GET /api/no-reclamados/{id}/editar` |
| `POST /NoReclamados/Editar` | `PUT /api/no-reclamados/{id}` |
| `POST /NoReclamados/Eliminar/{id}` | `DELETE /api/no-reclamados/{id}` |

## Lotes / Expediente de lote (`LotesController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /Lotes/Index?manzana&lote&clave&panteonId` | `GET /api/lotes?manzana=&lote=&clave=&panteonId=` |
| `GET /Lotes/Expediente/{id}` | `GET /api/lotes/{id}/expediente` — arma el timeline (Títulos + Cesiones + Permisos + Reconocimientos) igual que hoy |

## Incidencias (`IncidenciasController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /Incidencias/Index?panteonId&estado&tipo&q` | `GET /api/incidencias?panteonId=&estado=&tipo=&q=` |
| `GET /Incidencias/Crear` | *(formulario en React)* |
| `POST /Incidencias/Crear` | `POST /api/incidencias` |
| `GET /Incidencias/Editar/{id}` | `GET /api/incidencias/{id}` |
| `POST /Incidencias/Editar` | `PUT /api/incidencias/{id}` |
| `POST /Incidencias/Atender` | `PATCH /api/incidencias/{id}/atender` — body `{ estado, atendidoPor?, resolucion? }` |
| `POST /Incidencias/Eliminar/{id}` | `DELETE /api/incidencias/{id}` |
| `GET /Incidencias/Reporte?...` | `GET /api/incidencias/reporte?...` → Excel |

## Reportes (`ReportesController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /Reportes/Index` | `GET /api/reportes` — agregados para las tarjetas (panteones, tipos, totales) |
| `GET /Reportes/Movimientos?anio&mes` | `GET /api/reportes/movimientos?anio=&mes=` → Excel de dos hojas (Resumen + Detalle), igual que `ReportesExcelService.GenerarMovimientos` |

## Reimpresiones (`ReimpresionesController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /Reimpresiones/Index` | `GET /api/reimpresiones` |
| `GET /Reimpresiones/Nueva?tipo&id` | *(formulario en React)* |
| `GET /Reimpresiones/Buscar?termino=` | `GET /api/reimpresiones/buscar?termino=` |
| `POST /Reimpresiones/Reimprimir` | `POST /api/reimpresiones` — body `{ tipo, id, motivo }`, respeta el `CHECK` de "un solo documento" (exactamente uno de permiso/título/cesión) |

## Bitácora (`BitacoraController`)

| Actual | Nuevo endpoint |
|---|---|
| `GET /Bitacora/Index?q&accion&usuarioId&...` | `GET /api/bitacora?q=&accion=&usuarioId=&...` — solo lectura, sin mutaciones que portar |

---

## Generación de PDF y Excel

- **PDF** (`PermisosPdfService`, `TitulosPdfService`, `CesionesPdfService` → QuestPDF): recomendado **Puppeteer** en Node — cada layout se reescribe como plantilla HTML/CSS y se renderiza con `page.pdf()`. Es la ruta que mejor conserva el ajuste fino ya validado este mismo proyecto (tamaños de fuente, posición de firmas, ancho de columnas del acuse, acentos) porque HTML/CSS es más parecido a maquetar con `flexbox`/posiciones que a recalcular coordenadas absolutas como pide `pdf-lib`.
- **Excel** (`ReportesExcelService` → ClosedXML): equivalente directo con `exceljs` — mismas hojas, mismos colores condicionales (verde/ámbar/rojo por estado, fila TOTAL en guinda).

## Pendiente antes de escribir código

1. Confirmar con Sistemas: ¿Express plano o NestJS? (NestJS da estructura más parecida a los Controllers de .NET — módulos, decoradores, inyección de dependencias — puede ser más cómodo para el equipo que lo va a mantener; Express es más ligero pero exige más disciplina propia)
2. Confirmar si el frontend será SPA pura (Vite + React Router) o Next.js (si Sistemas quiere SSR/SEO, que para un sistema interno de trámites normalmente no aplica)
3. Definir versión de PostgreSQL objetivo (afecta si se puede usar `GENERATED ALWAYS AS IDENTITY` sin problema — disponible desde Postgres 10, no debería ser una limitante)
