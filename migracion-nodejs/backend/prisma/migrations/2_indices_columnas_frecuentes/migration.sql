-- Ninguna de estas columnas tenía índice propio: al ser llave foránea, Postgres
-- no lo crea solo (a diferencia de la llave primaria). Cada una se verificó
-- contra una consulta real del código (no solo por ser FK) antes de agregarla.

-- Expediente de lote, ocupantes y búsqueda de no reclamados (lotes.routes.ts,
-- noreclamados.routes.ts, titulos.routes.ts).
CREATE INDEX "ix_permisos_lote" ON "permisos"("lote_id");
CREATE INDEX "ix_permisos_fallecido" ON "permisos"("fallecido_id");
-- Se recorre en cada alta de permiso, para calcular el folio consecutivo del
-- tipo de trámite (lib/folio.ts).
CREATE INDEX "ix_permisos_tipo_tramite" ON "permisos"("tipo_tramite_id");

-- Expediente de lote y comprobación de título vigente al ceder o emitir.
CREATE INDEX "ix_titulos_lote" ON "titulos_propiedad"("lote_id");

-- Expediente de lote y relación mensual de movimientos por rango de fechas.
CREATE INDEX "ix_cesiones_lote" ON "cesion_derechos"("lote_id");
CREATE INDEX "ix_cesiones_fecha" ON "cesion_derechos"("fecha_cesion");

-- Se consultan al reimprimir, para el número de reimpresión consecutivo de
-- ese documento en particular.
CREATE INDEX "ix_reimpresiones_permiso" ON "reimpresiones"("permiso_id");
CREATE INDEX "ix_reimpresiones_titulo" ON "reimpresiones"("titulo_id");
CREATE INDEX "ix_reimpresiones_cesion" ON "reimpresiones"("cesion_id");

-- Liberar el lote de fosa común al aprobar la exhumación, y expediente de lote.
CREATE INDEX "ix_reconocimientos_lote" ON "reconocimientos"("lote_id");

-- Filtro opcional del panel de bitácora y el conteo de usuarios distintos.
CREATE INDEX "ix_bitacoras_usuario" ON "bitacoras"("usuario_id");
-- Cortes de "hoy", "esta semana" y "últimos 14 días", y el orden del listado.
CREATE INDEX "ix_bitacoras_fecha" ON "bitacoras"("fecha_hora");
