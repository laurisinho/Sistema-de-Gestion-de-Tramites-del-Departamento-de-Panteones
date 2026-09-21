# API del sistema

Referencia de los endpoints que expone el backend. Sirve para trabajar en el frontend, para conectar otra herramienta o para entender qué hace cada pantalla por debajo.

Todo cuelga de `/api`. En desarrollo la base es `http://localhost:4000/api`; en el servidor es el mismo dominio del sitio, porque Caddy reenvía `/api` al backend.

## Convenciones

Las rutas van en español y en minúsculas, separadas con guion cuando llevan dos palabras (`/no-reclamados`, `/agentes-mp`). El JSON usa camelCase (`nombreCompleto`, `fechaEmision`), que es lo que devuelve Prisma sin transformar nada. En la base los nombres van en snake_case; el mapeo está en `backend/prisma/schema.prisma`.

Las fechas viajan en ISO 8601. Las que representan un día sin hora (emisión de un título, fecha de un trámite) se guardan a medianoche UTC y se interpretan en la zona de Nogales; el cálculo está en `backend/src/lib/fechas.ts`.

Los listados que aceptan filtros devuelven hasta 100 resultados. Sin filtros devuelven los últimos 50, salvo el buscador de lotes, que sin filtros no devuelve nada porque son varios miles.

## Autenticación

`POST /api/auth/login` recibe `{ nombreUsuario, password }` y responde con los datos del usuario y un token JWT. El token viaja de dos formas a la vez:

- En el encabezado `Authorization: Bearer <token>`, que es el que usa el frontend.
- En una cookie `HttpOnly`, que queda como respaldo cuando el sitio y la API comparten dominio.

El encabezado tiene prioridad. La razón de no depender solo de la cookie es que varios navegadores (Brave, Safari y cada vez más Chrome) bloquean por privacidad las cookies entre sitios distintos, y hoy el sitio está en GitHub Pages y la API en Render.

El token dura 8 horas por omisión (`JWT_EXPIRES_IN`).

Todos los endpoints exigen sesión iniciada, con tres excepciones: el login, `GET /api/health` y los dos de lectura de apariencia, que son públicos porque la pantalla de login necesita el color y el logo antes de que exista sesión.

Hay dos restricciones más por rol:

- `/api/administracion` y `/api/usuarios` requieren rol **Administrador**.
- El rol **Consulta** puede hacer cualquier GET, pero ningún método que escriba. Se aplica a nivel de router, para que ningún endpoint de escritura quede sin proteger por descuido.

### Intentos de acceso

El login limita los intentos fallidos por dos vías a la vez: 5 por usuario y 30 por dirección IP, en ventanas de 15 minutos, con bloqueo de otros 15. El tope por IP es alto porque el departamento sale a internet por una sola dirección y un límite bajo dejaría fuera a todo el personal. Cuando se agota, la respuesta es `429` con el tiempo que falta para reintentar.

## Errores

Los errores responden con `{ "error": "mensaje" }`. El mensaje está escrito para mostrarse tal cual al usuario.

| Código | Cuándo |
|---|---|
| 400 | Faltan datos o vienen mal formados |
| 401 | Sin sesión, sesión vencida, o credenciales incorrectas |
| 403 | El rol no alcanza para esa operación |
| 404 | El registro no existe |
| 409 | Choca con algo que ya existe, o el estado no permite la operación |
| 429 | Demasiados intentos de acceso fallidos |
| 500 | Error no previsto; el detalle queda en los logs, no en la respuesta |

En el login, un usuario que no existe y una contraseña incorrecta dan el mismo mensaje, para no confirmarle a nadie qué cuentas existen.

---

## Sesión

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/login` | Inicia sesión. Devuelve usuario, rol y token |
| POST | `/api/auth/logout` | Borra la cookie y lo anota en la bitácora |
| GET | `/api/auth/me` | Quién es el usuario actual. La SPA lo consulta al cargar |

## Títulos de propiedad

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/titulos` | Listado y búsqueda |
| GET | `/api/titulos/buscar` | Solo títulos vigentes, para elegir cuál ceder |
| GET | `/api/titulos/:id` | Detalle, con los sepultados en el lote y el historial de permisos |
| POST | `/api/titulos` | Emite un título para un lote nuevo |
| PUT | `/api/titulos/:id` | Corrige titular, ubicación y datos del título |
| PATCH | `/api/titulos/:id/entrega` | Marca el título como entregado |
| POST | `/api/titulos/:id/cancelar` | Lo marca CANCELADO. No borra la fila |
| GET | `/api/titulos/:id/pdf` | El título en PDF |

Filtros de `GET /api/titulos`: `q` (folio, titular o manzana y lote), `tipoBusqueda=fallecido` para buscar por el nombre del difunto, `panteonId`, `seccion`, `manzana`, `lote`, `titular`, `colindancia`.

Al emitir, el folio se arma solo siguiendo la forma que ya tienen las claves de esa misma sección. La lógica está en `backend/src/lib/folio.ts`, que explica por qué cada sección escribe distinto su clave.

## Permisos

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/permisos` | Listado y búsqueda |
| GET | `/api/permisos/:id` | Detalle |
| POST | `/api/permisos` | Registra un permiso |
| PUT | `/api/permisos/:id` | Corrige solicitante, fallecido y datos del trámite |
| POST | `/api/permisos/:id/cancelar` | Lo marca CANCELADO |
| GET | `/api/permisos/:id/pdf` | El permiso en PDF |

Filtros: `q` (folio, solicitante o fallecido), `tipo` (SEP, EXH, CEN, CON), `panteonId`, `seccion`, `manzana`, `lote`, `titular`, `colindancia`.

Al registrar un permiso, el lote cambia de estado según el trámite: inhumar o depositar cenizas lo ocupa; exhumar retira los restos y, si es de fosa común, lo libera para la siguiente persona no reclamada. Un lote particular vacío sigue siendo de su titular y no se marca como disponible.

`POST /api/permisos` también acepta capturar la ubicación a mano, para los panteones antiguos donde nunca se registró un título. En ese caso el permiso queda marcado como sin registro.

## Cesión de derechos

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/cesiones` | Listado |
| POST | `/api/cesiones` | Registra la cesión |
| GET | `/api/cesiones/:id/pdf` | La carta de cesión en PDF |

Una cesión toca tres tablas (título nuevo, título anterior y registro de cesión) dentro de una sola transacción. Si fallara a la mitad, quedaría un lote con dueño cambiado y sin constancia de quién cedió a quién.

## Lotes y expedientes

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/lotes` | Buscador de lotes. Sin filtros no devuelve nada |
| GET | `/api/lotes/buscar` | Lotes utilizables al registrar un permiso |
| GET | `/api/lotes/:id/expediente` | Todo lo ocurrido en esa tumba, en orden |
| GET | `/api/lotes/:id/ocupantes` | Quién está sepultado hoy ahí |
| GET | `/api/lotes/fosa-comun-disponibles` | Lotes de fosa común liberados |

El expediente reúne título, cesiones, inhumaciones, exhumaciones, obras e identificaciones en una sola línea de tiempo.

Buscar por manzana entiende números romanos y arábigos indistintamente, porque algunas secciones antiguas capturaron `XVI` y otras `16` para la misma manzana.

## Fallecidos

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/fallecidos/buscar` | Busca difuntos ya registrados, por `termino` |

Sirve para enlazar un permiso a un expediente que ya existe en lugar de duplicarlo. Busca por nombre, posible nombre, número de acta o número de caso.

## Personas no reclamadas

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/no-reclamados` | Listado y búsqueda |
| GET | `/api/no-reclamados/:id` | Detalle |
| POST | `/api/no-reclamados` | Registra a una persona no reclamada |
| PUT | `/api/no-reclamados/:id` | Corrige sus datos |
| DELETE | `/api/no-reclamados/:id` | La elimina, si no tiene reconocimiento |
| GET | `/api/no-reclamados/:id/reconocer` | Datos para el formulario de identificación |
| POST | `/api/no-reclamados/:id/reconocer` | Registra la identificación |
| GET | `/api/no-reclamados/reportes/reconocidos` | Listado de identificados |
| GET | `/api/no-reclamados/reportes/sepultados` | Relación para Fiscalía, en Excel |
| GET | `/api/no-reclamados/reportes/identificados` | Identificadas y exhumadas, en Excel |
| GET | `/api/no-reclamados/ministerios-publicos` | Agentes del MP para el selector |

Reconocer solo actualiza la identidad de la persona. El lote se libera después, cuando se aprueba el permiso de exhumación.

Los reportes aceptan `anio` y `trimestre`, o un rango libre con `desde` y `hasta`.

La lista de agentes del MP combina el catálogo de Administración con los nombres ya capturados como texto libre, normalizados para que un mismo agente no aparezca dos veces por diferencias de escritura.

## Incidencias

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/incidencias` | Listado, con filtros `panteonId`, `estado`, `tipo`, `q`, `desde`, `hasta` |
| GET | `/api/incidencias/:id` | Detalle |
| POST | `/api/incidencias` | Registra una incidencia |
| PUT | `/api/incidencias/:id` | La edita |
| PATCH | `/api/incidencias/:id/atender` | Cambia el estado y registra la resolución |
| DELETE | `/api/incidencias/:id` | La elimina |
| GET | `/api/incidencias/reporte` | Reporte en Excel |

## Reimpresiones

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/reimpresiones` | Historial de reimpresiones |
| GET | `/api/reimpresiones/buscar` | Busca entre permisos, títulos y cesiones |
| GET | `/api/reimpresiones/documento` | Un documento puntual por `tipo` e `id` |
| POST | `/api/reimpresiones` | Reimprime con sello. Body `{ tipo, id, motivo }` |

Reimprimir registra el motivo y devuelve el PDF con la marca de agua "REIMPRESIÓN" y el número de reimpresión. Un documento cancelado o rechazado no se puede reimprimir.

## Reportes

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/reportes` | Totales para las tarjetas de la pantalla de reportes |
| GET | `/api/reportes/dashboard` | Cifras del mes, últimos trámites y distribución por panteón |
| GET | `/api/reportes/movimientos` | Relación mensual de movimientos, en JSON |
| GET | `/api/reportes/movimientos/excel` | La misma relación, en Excel de dos hojas |
| GET | `/api/reportes/etiquetas` | Etiquetas de archivo, en PDF |

Movimientos acepta `anio` y `mes`, o un rango con `desde` y `hasta`, que tiene prioridad si vienen ambas.

Las etiquetas requieren `desde` y `hasta` sobre la fecha de emisión del título, para ir etiquetando por tandas conforme se emiten.

## Catálogos

Listas para llenar los selectores de los formularios.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/catalogos/panteones` | Panteones activos |
| GET | `/api/catalogos/secciones` | Secciones, filtrables por `panteonId` |
| GET | `/api/catalogos/tipos-tramite` | Tipos de permiso |
| GET | `/api/catalogos/tipos-lote` | Tipos de lote |
| GET | `/api/catalogos/tipos-incidencia` | Tipos de incidencia |
| GET | `/api/catalogos/estados-incidencia` | Estados de incidencia |
| GET | `/api/catalogos/roles` | Roles de usuario |

Secciones tiene dos parámetros que cambian lo que devuelve:

- `soloCatalogo=1` devuelve únicamente las secciones dadas de alta en Administración. Se usa al crear un lote, donde no conviene ofrecer texto histórico suelto.
- `incluirVirtuales=1` agrega `ANG` (Angelitos), que no es una sección real sino una forma de filtrar. Solo sirve para buscar; un lote nuevo nunca debe guardarse con esa sección.

## Bitácora

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/bitacora` | Auditoría, con filtros `q`, `accion`, `usuarioId`, `desde`, `hasta` |

Es solo lectura. La bitácora se escribe sola desde cada operación que modifica datos.

## Usuarios

Requieren rol Administrador.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/usuarios` | Listado |
| GET | `/api/usuarios/:id` | Detalle |
| POST | `/api/usuarios` | Da de alta un usuario |
| PUT | `/api/usuarios/:id` | Edita sus datos |
| PATCH | `/api/usuarios/:id/password` | Cambia la contraseña |
| POST | `/api/usuarios/:id/desactivar` | Desactiva la cuenta |
| POST | `/api/usuarios/:id/activar` | La reactiva |

No se puede desactivar la propia cuenta ni al último Administrador activo, porque dejaría el sistema sin nadie que pueda volver a dar de alta usuarios.

## Administración

Requieren rol Administrador. Nada se borra: los catálogos solo se activan o desactivan, para que los registros históricos no queden con una referencia rota.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/administracion/panteones` | Listado, incluidos los inactivos |
| POST | `/api/administracion/panteones` | Da de alta un panteón |
| PUT | `/api/administracion/panteones/:id` | Lo edita |
| POST | `/api/administracion/panteones/:id/activar` | Lo reactiva |
| POST | `/api/administracion/panteones/:id/desactivar` | Lo desactiva |
| GET | `/api/administracion/secciones` | Listado, filtrable por `panteonId` |
| POST | `/api/administracion/secciones` | Da de alta una sección |
| PUT | `/api/administracion/secciones/:id` | La edita |
| POST | `/api/administracion/secciones/:id/activar` | La reactiva |
| POST | `/api/administracion/secciones/:id/desactivar` | La desactiva |
| GET | `/api/administracion/agentes-mp` | Agentes del Ministerio Público |
| POST | `/api/administracion/agentes-mp` | Da de alta un agente |
| PUT | `/api/administracion/agentes-mp/:id` | Lo edita |
| POST | `/api/administracion/agentes-mp/:id/activar` | Lo reactiva |
| POST | `/api/administracion/agentes-mp/:id/desactivar` | Lo desactiva |

El catálogo de secciones no reemplaza al campo `seccion` del lote, que sigue siendo texto libre. Solo permite dar de alta una sección antes de que exista algún lote en ella, y que aparezca como sugerencia.

## Apariencia

Cambia la identidad visual del sistema sin tocar código. Sirve para cuando entra una administración nueva.

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| GET | `/api/apariencia` | público | Colores y nombre del síndico vigentes |
| GET | `/api/apariencia/logo/:cual` | público | El logo (`nogales` o `frontera`) en PNG |
| PUT | `/api/administracion/apariencia` | Administrador | Guarda los dos colores |
| PUT | `/api/administracion/apariencia/sindico` | Administrador | Cambia el nombre que firma |
| PUT | `/api/administracion/apariencia/logo/:cual` | Administrador | Sube un logo |
| POST | `/api/administracion/apariencia/logo/:cual/restablecer` | Administrador | Vuelve al logo original |

La lectura es pública porque la pantalla de login necesita pintarse con el color y el logo vigentes antes de que haya sesión. No expone nada sensible.

Solo se guardan los dos colores elegidos. Los demás tonos (degradados, franjas, marca de agua) se derivan de ellos al generar cada documento, en `backend/src/lib/colores.ts`.

Al guardar se rechaza un color demasiado claro para el texto blanco que va encima, con el criterio de contraste de WCAG. En pantalla un color ilegible se corrige en el momento, pero un título de propiedad ya impreso y firmado, no.

Los logos se guardan en la base y no en disco, porque el disco de algunos hospedajes se borra en cada despliegue. Se aceptan PNG de hasta 2 MB.

---

## Archivos

Los endpoints que devuelven documentos responden con el tipo correspondiente y un nombre de archivo en `Content-Disposition`:

| Tipo | Content-Type |
|---|---|
| PDF | `application/pdf` |
| Excel | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| Logo | `image/png` |

Los PDF se arman como HTML y se convierten con Chromium. Los Excel se generan con ExcelJS, reproduciendo el formato de los reportes que el departamento ya entregaba.

Conviene pedirlos con `fetch` y el encabezado `Authorization`, no con un enlace directo: una navegación normal no puede llevar ese encabezado y dependería de la cookie, que los navegadores bloquean entre sitios distintos.

## Cómo probar

Con la sesión iniciada:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"nombreUsuario":"admin","password":"..."}' | jq -r .token)

curl -s http://localhost:4000/api/titulos -H "Authorization: Bearer $TOKEN"
```

`GET /api/health` responde `{"ok":true}` sin autenticación y sirve para comprobar que la API está arriba.
