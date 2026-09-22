-- Los lotes de panteones que se ubican por colindancias (numero_manzana='S/N')
-- o los que nunca tuvieron sección capturada guardan seccion = NULL. El índice
-- único de ubicación (uq_lotes_ubicacion, sobre panteon_id/seccion/manzana/lote)
-- no los protege: en PostgreSQL cada NULL cuenta como distinto de cualquier
-- otro NULL, así que dos lotes con la misma manzana y lote y seccion NULL no
-- se detectan como duplicados aunque el propio código sí los compare como
-- iguales al buscar (ver lib/ubicacion.ts). Este índice parcial cubre ese
-- caso. No está declarado en schema.prisma porque el generador de Prisma no
-- soporta índices parciales sin una preview feature; se mantiene a mano.
CREATE UNIQUE INDEX "uq_lotes_ubicacion_sin_seccion" ON "lotes"("panteon_id", "numero_manzana", "numero_lote") WHERE "seccion" IS NULL;
