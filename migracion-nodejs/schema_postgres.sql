-- ============================================================
-- SISTEMA DE GESTIÓN DE TRÁMITES - DEPARTAMENTO DE PANTEONES
-- Esquema PostgreSQL (traducido desde QueryPAnteones.sql / SQL Server)
-- ============================================================
--
-- CONVENCIÓN DE NOMBRES: snake_case para tablas y columnas (idiomático en
-- Postgres, evita tener que entrecomillar identificadores en cada consulta
-- SQL cruda o herramienta de administración). En Prisma, los modelos se
-- declaran en PascalCase (igual que las entidades de C# actuales) y se
-- mapean a estas tablas con @@map/@map -- ver CONTRATO_API.md, sección
-- "Convención de nombres".
--
-- DESPLIEGUE: a diferencia de SQL Server, Postgres no permite crear y
-- usar una base de datos en el mismo script/conexión. Pasos:
--   1) psql -U postgres -c "CREATE DATABASE panteones_municipales;"
--   2) psql -U postgres -d panteones_municipales -f schema_postgres.sql
--
-- Encoding: este archivo debe guardarse en UTF-8 (los acentos van
-- literales; a diferencia de T-SQL no se necesitan trucos con NCHAR()).
-- ============================================================


CREATE TABLE roles (
    rol_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(50)   NOT NULL UNIQUE,
    descripcion VARCHAR(300),
    activo      BOOLEAN       NOT NULL DEFAULT TRUE,
    fecha_alta  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tipos_tramite (
    tipo_tramite_id INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave           VARCHAR(30)  NOT NULL UNIQUE,   -- SEP, EXH, CEN, CON, TIT, CES
    nombre          VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(300),
    retencion_anios INTEGER,                        -- NULL = permanente (sec. 8 propuesta)
    activo          BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE tipos_lote (
    tipo_lote_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL UNIQUE,      -- Lote, Nicho, Cripta
    descripcion  VARCHAR(200)
);

CREATE TABLE panteones (
    panteon_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre            VARCHAR(150) NOT NULL,
    clave             VARCHAR(10) UNIQUE,           -- PJE, PAZ, PH, PR, PN, PNA, PC
    usa_colindancias  BOOLEAN      NOT NULL DEFAULT FALSE,  -- true = N/S/E/O ; false = manzana/lote
    direccion         VARCHAR(300),
    activo            BOOLEAN      NOT NULL DEFAULT TRUE
);


CREATE TABLE usuarios (
    usuario_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_id          INTEGER      NOT NULL REFERENCES roles(rol_id),
    nombre_usuario  VARCHAR(100) NOT NULL UNIQUE,
    nombre_completo VARCHAR(200) NOT NULL,
    email           VARCHAR(150),
    password_hash   VARCHAR(256) NOT NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_alta      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso   TIMESTAMP
);


CREATE TABLE personas (
    persona_id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo       VARCHAR(200) NOT NULL,
    curp                  CHAR(18),
    domicilio             VARCHAR(300),                -- calle y número
    colonia               VARCHAR(150),
    telefono              VARCHAR(25),
    correo_electronico    VARCHAR(150),
    identificacion_tipo   VARCHAR(50),
    identificacion_numero VARCHAR(50),
    fecha_registro        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE fallecidos (
    fallecido_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo       VARCHAR(200) NOT NULL,
    fecha_nacimiento      DATE,
    fecha_fallecimiento   DATE,
    acta_defuncion_numero VARCHAR(100),
    acta_defuncion_folio  VARCHAR(100),
    acta_defuncion_fecha  DATE,
    causa_fallecimiento   VARCHAR(300),
    es_no_reclamado       BOOLEAN      NOT NULL DEFAULT FALSE,
    descripcion_hallazgo  VARCHAR(500),
    numero_caso           VARCHAR(60),                 -- Carpeta FGE: SON/NOG/FGE/AAAA/NNN/NNNNN
    posible_nombre        VARCHAR(200),                -- Nombre tentativo de persona no identificada
    -- Datos del formato oficial de Fiscalía
    hora_fallecimiento    TIME(0),
    fecha_levantamiento   DATE,
    lugar_levantamiento   VARCHAR(250),
    ministerio_publico    VARCHAR(200),
    reconocido            BOOLEAN      NOT NULL DEFAULT FALSE,  -- desconocido ya identificado
    fecha_registro        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE lotes (
    lote_id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panteon_id         INTEGER      NOT NULL REFERENCES panteones(panteon_id),
    tipo_lote_id       INTEGER      NOT NULL REFERENCES tipos_lote(tipo_lote_id),
    numero_manzana     VARCHAR(20)  NOT NULL,
    numero_lote        VARCHAR(20)  NOT NULL,
    seccion            VARCHAR(50),
    zona               VARCHAR(50),
    dimensiones        VARCHAR(100),
    comprobante_pago   VARCHAR(200),
    -- Colindancias
    colindancia_norte  VARCHAR(200),
    colindancia_sur    VARCHAR(200),
    colindancia_este   VARCHAR(200),
    colindancia_oeste  VARCHAR(200),

    clave_legado       VARCHAR(50),
    estado             VARCHAR(20)  NOT NULL DEFAULT 'DISPONIBLE'
                       CONSTRAINT ck_lotes_estado CHECK (estado IN ('DISPONIBLE','OCUPADO','RESERVADO')),
    es_fosa_comun      BOOLEAN      NOT NULL DEFAULT FALSE,   -- área de personas no reclamadas
    fecha_registro     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- La identidad de un lote incluye la sección: áreas distintas (COLINA, TALUD,
    -- ADEII) reusan los mismos números de manzana y lote.
    CONSTRAINT uq_lotes_ubicacion UNIQUE (panteon_id, seccion, numero_manzana, numero_lote)
);


CREATE TABLE titulos_propiedad (
    titulo_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lote_id            INTEGER      NOT NULL REFERENCES lotes(lote_id),
    titular_id         INTEGER      NOT NULL REFERENCES personas(persona_id),
    folio              VARCHAR(50)  NOT NULL UNIQUE,
    fecha_emision      DATE,
    usuario_emitio_id  INTEGER      NOT NULL REFERENCES usuarios(usuario_id),
    usuario_aprobo_id  INTEGER      REFERENCES usuarios(usuario_id),
    fecha_aprobacion   TIMESTAMP,
    estado             VARCHAR(20)  NOT NULL DEFAULT 'VIGENTE'
                       CONSTRAINT ck_titulos_estado CHECK (estado IN ('VIGENTE','CEDIDO','CANCELADO')),

    estado_entrega     VARCHAR(30)  NOT NULL DEFAULT 'PENDIENTE_ENTREGA'
                       CONSTRAINT ck_titulos_entrega CHECK (estado_entrega IN ('PENDIENTE_ENTREGA','LLAMADA_REALIZADA','BUZON','ENTREGADO')),
    fecha_entrega      DATE,
    ruta_documento     VARCHAR(500),                  -- ruta al PDF generado
    fecha_creacion     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE cesion_derechos (
    cesion_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo_id           INTEGER      NOT NULL REFERENCES titulos_propiedad(titulo_id),
    lote_id             INTEGER      NOT NULL REFERENCES lotes(lote_id),
    cedente_id          INTEGER      NOT NULL REFERENCES personas(persona_id),
    cesionario_id       INTEGER      NOT NULL REFERENCES personas(persona_id),
    folio               VARCHAR(50)  NOT NULL UNIQUE,
    fecha_cesion        DATE         NOT NULL,
    usuario_registro_id INTEGER      NOT NULL REFERENCES usuarios(usuario_id),
    usuario_aprobo_id   INTEGER      REFERENCES usuarios(usuario_id),
    fecha_aprobacion    TIMESTAMP,
    estado              VARCHAR(20)  NOT NULL DEFAULT 'VIGENTE'
                        CONSTRAINT ck_cesion_estado CHECK (estado IN ('VIGENTE','CANCELADO')),
    ruta_documento      VARCHAR(500),
    fecha_creacion      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE permisos (
    permiso_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_tramite_id     INTEGER      NOT NULL REFERENCES tipos_tramite(tipo_tramite_id),
    lote_id             INTEGER      REFERENCES lotes(lote_id),
    solicitante_id      INTEGER      NOT NULL REFERENCES personas(persona_id),
    fallecido_id        INTEGER      REFERENCES fallecidos(fallecido_id),
    folio               VARCHAR(50)  NOT NULL UNIQUE,
    fecha_solicitud     DATE,
    fecha_emision       TIMESTAMP,
    usuario_registro_id INTEGER      NOT NULL REFERENCES usuarios(usuario_id),
    usuario_aprobo_id   INTEGER      REFERENCES usuarios(usuario_id),
    estado              VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                        CONSTRAINT ck_permisos_estado CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','CANCELADO')),

    motivo_exhumacion   VARCHAR(300),
    destino_restos      VARCHAR(300),

    ubicacion_deposito  VARCHAR(300),

    tipo_obra           VARCHAR(100),
    descripcion_obra    VARCHAR(500),
    -- Donación
    es_donacion         BOOLEAN      NOT NULL DEFAULT FALSE,
    numero_recibo       VARCHAR(50),
    funeraria           VARCHAR(150),
    instancia_solicita  VARCHAR(250),                -- "FUNERARIA / NOMBRE DE QUIEN SOLICITA"
    ruta_documento      VARCHAR(500),
    fecha_creacion      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Relación de personas no reclamadas que pasaron de desconocidas a identificadas
CREATE TABLE reconocimientos (
    reconocimiento_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fallecido_id          INTEGER      NOT NULL REFERENCES fallecidos(fallecido_id),
    lote_id               INTEGER      REFERENCES lotes(lote_id),
    nombre_anterior       VARCHAR(200) NOT NULL,      -- pseudónimo con el que fue sepultado
    nombre_identificado   VARCHAR(200) NOT NULL,      -- nombre real
    fecha_reconocimiento  DATE,
    medio_identificacion  VARCHAR(300),               -- ADN, familiares directos, placas fotográficas...
    instancia_solicita    VARCHAR(250),
    numero_acta_defuncion VARCHAR(50),
    ministerio_publico    VARCHAR(200),
    observaciones         VARCHAR(600),
    permiso_exhumacion_id INTEGER      REFERENCES permisos(permiso_id),
    usuario_registro_id   INTEGER      REFERENCES usuarios(usuario_id),
    fecha_registro        TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_reconocimientos_fallecido ON reconocimientos(fallecido_id);
CREATE INDEX ix_reconocimientos_fecha     ON reconocimientos(fecha_reconocimiento);


CREATE TABLE reimpresiones (
    reimpresion_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    permiso_id        INTEGER      REFERENCES permisos(permiso_id),
    titulo_id         INTEGER      REFERENCES titulos_propiedad(titulo_id),
    cesion_id         INTEGER      REFERENCES cesion_derechos(cesion_id),
    usuario_id        INTEGER      NOT NULL REFERENCES usuarios(usuario_id),
    fecha_reimpresion TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo            VARCHAR(300) NOT NULL,
    ruta_documento    VARCHAR(500),

    CONSTRAINT ck_reimpresiones_un_solo_doc CHECK (
        (CASE WHEN permiso_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN titulo_id  IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN cesion_id  IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);


CREATE TABLE bitacoras (
    bitacora_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  INTEGER      REFERENCES usuarios(usuario_id),
    accion      VARCHAR(50)  NOT NULL,
    tabla       VARCHAR(100),
    registro_id INTEGER,
    descripcion VARCHAR(500),
    ip_acceso   VARCHAR(50),
    fecha_hora  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- INCIDENCIAS EN PANTEONES
--   Hechos reportados dentro de un panteón: vandalismo, daños,
--   maleza, fugas. El lote es OPCIONAL porque muchas ocurren en
--   pasillos, bardas o accesos que no son de ninguna tumba.
-- ============================================================
CREATE TABLE incidencias (
    incidencia_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panteon_id          INTEGER       NOT NULL REFERENCES panteones(panteon_id),
    lote_id             INTEGER       REFERENCES lotes(lote_id),

    seccion             VARCHAR(100),
    numero_manzana      VARCHAR(50),
    numero_lote         VARCHAR(50),

    tipo                VARCHAR(60)   NOT NULL,
    descripcion         VARCHAR(1000) NOT NULL,
    fecha_incidencia    DATE          NOT NULL,
    reportado_por       VARCHAR(200),

    estado              VARCHAR(20)   NOT NULL DEFAULT 'REPORTADA'
                        CONSTRAINT ck_incidencias_estado CHECK (estado IN ('REPORTADA','EN_PROCESO','ATENDIDA')),
    fecha_atencion      DATE,
    atendido_por        VARCHAR(200),
    resolucion          VARCHAR(1000),

    usuario_registro_id INTEGER       REFERENCES usuarios(usuario_id),
    fecha_registro      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_incidencias_panteon_fecha ON incidencias(panteon_id, fecha_incidencia DESC);
CREATE INDEX ix_incidencias_estado        ON incidencias(estado);


-- ============================================================
-- DATOS SEMILLA
-- ============================================================

INSERT INTO roles (nombre, descripcion) VALUES
('Administrador', 'Configuración global, gestión de usuarios, acceso a bitácoras y reportes'),
('Capturista',    'Registro de trámites, emisión de permisos y generación de documentos'),
('Consulta',      'Visualización y descarga de expedientes sin posibilidad de edición'),
('Supervisión',   'Aprobación de títulos, cesiones y permisos antes de su emisión oficial');

INSERT INTO tipos_tramite (clave, nombre, descripcion, retencion_anios) VALUES
('SEP', 'Sepultura',              'Permiso para inhumación de restos en lote asignado', 10),
('EXH', 'Exhumación',             'Permiso para exhumación de restos con motivo y destino declarado', 10),
('CEN', 'Depósito de Cenizas',    'Permiso para depósito de cenizas en ubicación designada', 10),
('CON', 'Construcción',          'Permiso para construcción o modificación de monumento en lote', 10),
('TIT', 'Título de Propiedad',   'Emisión de título de propiedad de lote o nicho', NULL),
('CES', 'Cesión de Derechos',    'Transferencia de titularidad de lote o nicho entre particulares', NULL);

INSERT INTO tipos_lote (nombre, descripcion) VALUES
('Lote',   'Lote de tierra para inhumación directa'),
('Nicho',  'Nicho en muro o estructura de mampostería'),
('Cripta', 'Cripta familiar de uso múltiple');

-- Los 7 panteones
INSERT INTO panteones (nombre, clave, usa_colindancias, direccion) VALUES
('Jardines del Edén',                                     'PJE', FALSE, 'Carretera Internacional'),
('Agua Zarca',                                             'PAZ', FALSE, 'Fraccionamiento La Mesa'),
('De los Héroes',                                          'PH',  TRUE,  'Calle Héroes'),
('Del Rosario',                                            'PR',  TRUE,  'Reforma e Independencia'),
('Nacional',                                               'PN',  TRUE,  'Calle Reforma Final'),
('Nacional Anexo',                                         'PNA', TRUE,  'Calle Reforma Final'),
('Jardín de los Cipreses - Jardines y Monumentos',         'PC',  FALSE, 'Calle Reforma Final');

INSERT INTO usuarios (rol_id, nombre_usuario, nombre_completo, email, password_hash)
VALUES (
    (SELECT rol_id FROM roles WHERE nombre = 'Administrador'),
    'admin',
    'Administrador del Sistema',
    'panteones@nogales.gob.mx',
    '$2b$12$i6Ulmy7m9B5FdA7eVTQbX.vDhUDNOIxYWD1NLZ9RmbPt34EH.xr32'  -- Admin2026 (hash bcrypt, portable a Node sin cambios)
);
