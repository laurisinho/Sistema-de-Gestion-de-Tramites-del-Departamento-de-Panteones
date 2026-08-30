# Sistema de Gestión de Trámites — Departamento de Panteones

Aplicación web para el **Departamento de Panteones** de la Sindicatura Municipal
del H. Ayuntamiento de Nogales, Sonora. Sustituye el control manual en hojas de
cálculo por una base de datos relacional con generación automática de los
documentos oficiales.

> ⚠️ **Este repositorio debe ser privado.** Los scripts de migración contienen
> nombres de personas fallecidas, números de acta y carpetas de investigación de
> la Fiscalía. El Ayuntamiento es sujeto obligado bajo la LPDPPSO.

---

## Stack

| | |
|---|---|
| Backend | ASP.NET Core MVC — .NET 10 |
| Datos | Entity Framework Core + SQL Server |
| Vistas | Razor + Bootstrap 5.3 |
| PDF | QuestPDF |
| Excel | ClosedXML |
| Sesión | JWT en cookie HttpOnly + BCrypt |

Corre en Windows y en Linux. No usa ninguna API exclusiva de Windows.

---

## Módulos

- **Búsqueda de expedientes** — punto de entrada; localiza por difunto, titular, folio o ubicación
- **Permisos** — inhumación, exhumación, depósito de cenizas y construcción
- **Títulos de propiedad** y **cesión de derechos**
- **Reimpresiones** — con marca de agua, consecutivo y motivo obligatorio
- **Personas no reclamadas** — fosa común, identificaciones y liberación de lotes
- **Expediente de lote** — línea de tiempo de todo lo ocurrido en una tumba
- **Incidencias** — hechos reportados en los panteones y su seguimiento
- **Reportes** — formatos oficiales de Fiscalía y relación mensual de movimientos
- **Bitácora** — auditoría de toda operación que modifica datos

---

## Puesta en marcha

1. Crear la base con `QueryPAnteones.sql`
2. Copiar `appsettings.json` a `appsettings.Production.json` y ajustar:
   - `ConnectionStrings:DefaultConnection`
   - `Jwt:Key` — **32+ caracteres aleatorios propios**; la aplicación se niega
     a arrancar en producción con la llave de desarrollo
3. `dotnet run`

Para el despliegue de la prueba piloto, ver **`GUIA_PILOTO.html`**.

---

## Estructura

```
PanteonesMunicipales/     Solución .NET (Controllers, Views, Models, Services)
EXCEL/                    Migraciones de datos históricos y scripts de apoyo
QueryPAnteones.sql        Esquema completo de la base
GUIA_PILOTO.html          Guía de despliegue paso a paso
```

Cada carpeta de migración incluye su `LEEME.md` con las decisiones tomadas y los
scripts de reversa.

---

## Estado actual

Sistema funcional, en prueba piloto. Pendientes conocidos:

- **Los roles no restringen nada todavía** — cualquier usuario autenticado puede
  editar y cancelar. No dar de alta más usuarios hasta implementarlos.
- Nueve permisos de exhumación (`LEG-EXH-0000X`) son sintéticos: representan
  exhumaciones documentadas en los reportes de Fiscalía cuyo folio real no consta.
- 1,315 registros históricos traen fechas centinela (1900/1905) donde el dato
  original venía vacío. No se imprimen, pero siguen en la base.
- El campo `Seccion` es inconsistente en registros históricos.
