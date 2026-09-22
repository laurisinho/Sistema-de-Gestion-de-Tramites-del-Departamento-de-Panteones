-- Columnas heredadas del modelo original en SQL Server que nunca tuvieron
-- lógica detrás, ni allá ni en este sistema, y que hoy están vacías en el
-- 100% de las filas. Decisión tomada con el departamento el 22/09/2026.

-- El flujo de aprobación por un Supervisor nunca se construyó: hoy todo
-- trámite queda resuelto con solo capturarlo. Se quita también la relación
-- con Usuario (Usuario.titulosAprobados / cesionesAprobadas / permisosAprobados).
ALTER TABLE "titulos_propiedad" DROP COLUMN "usuario_aprobo_id";
ALTER TABLE "titulos_propiedad" DROP COLUMN "fecha_aprobacion";
ALTER TABLE "cesion_derechos" DROP COLUMN "usuario_aprobo_id";
ALTER TABLE "cesion_derechos" DROP COLUMN "fecha_aprobacion";
ALTER TABLE "permisos" DROP COLUMN "usuario_aprobo_id";

-- CURP, correo electrónico y fecha de nacimiento: no se piden en ningún
-- formulario y el departamento decidió que no se van a pedir.
ALTER TABLE "personas" DROP COLUMN "curp";
ALTER TABLE "personas" DROP COLUMN "correo_electronico";
ALTER TABLE "fallecidos" DROP COLUMN "fecha_nacimiento";

-- Zona y comprobante de pago del lote: sin ningún indicio de para qué se
-- iban a usar. Retención en años del trámite: tenía un valor cargado (10
-- años) pero ningún reporte lo aplica para archivar o depurar nada.
ALTER TABLE "lotes" DROP COLUMN "zona";
ALTER TABLE "lotes" DROP COLUMN "comprobante_pago";
ALTER TABLE "tipos_tramite" DROP COLUMN "retencion_anios";

-- rutaDocumento (títulos, cesiones, permisos, reimpresiones) se conserva a
-- propósito: los documentos se generan al vuelo y no se guardan hoy, pero se
-- decidió dejar la columna por si más adelante se guardan copias de los PDF.
