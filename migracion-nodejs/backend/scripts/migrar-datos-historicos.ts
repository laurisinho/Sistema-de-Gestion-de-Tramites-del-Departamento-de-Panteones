// Migración de datos históricos reales: SQL Server (PanteonesMunicipales, app .NET
// original) -> Postgres/Supabase (este backend). Preserva los IDs originales para
// que todas las relaciones (FKs) queden intactas sin necesidad de remapeo.
//
// Las columnas ID en Postgres son GENERATED ALWAYS AS IDENTITY, así que se inserta
// con OVERRIDING SYSTEM VALUE + ON CONFLICT DO NOTHING (no borra nada existente).
//
// Uso: npx tsx scripts/migrar-datos-historicos.ts [tabla]
//   Sin argumento corre todas las tablas en orden de dependencias.
//   Con argumento corre solo esa tabla (para reintentar una etapa puntual).

import "../src/lib/bigint-json";
import sqlModule from "mssql/msnodesqlv8.js";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();
const reporte: Record<string, { origen: number; insertados: number; omitidos: { id: number; motivo: string }[] }> = {};

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

// msnodesqlv8 devuelve columnas INT/BIGINT como string; Postgres/pg espera number (o bigint para bigint).
function num(v: unknown): number {
  return Number(v);
}
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function horaLimpia(v: unknown): Date | null {
  if (v == null) return null;
  const d = v as Date;
  return new Date(Date.UTC(1970, 0, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}

async function conectarSqlServer() {
  return sqlModule.connect({
    driver: "msnodesqlv8",
    connectionString:
      "Driver={ODBC Driver 17 for SQL Server};Server=LAURISINHO\\SQLEXPRESS;Database=PanteonesMunicipales;Trusted_Connection=Yes;",
  } as any);
}

async function insertarConId(tabla: string, columnaId: string, columnas: string[], filas: Record<string, any>[], tam = 200): Promise<number> {
  let total = 0;
  for (let i = 0; i < filas.length; i += tam) {
    const lote = filas.slice(i, i + tam);
    if (lote.length === 0) continue;
    const placeholders = lote
      .map((_, fi) => "(" + columnas.map((_, ci) => `$${fi * columnas.length + ci + 1}`).join(", ") + ")")
      .join(", ");
    const params = lote.flatMap((fila) => columnas.map((c) => fila[c]));
    const sql = `INSERT INTO ${tabla} (${columnas.join(", ")}) OVERRIDING SYSTEM VALUE VALUES ${placeholders} ON CONFLICT (${columnaId}) DO NOTHING`;
    total += await prisma.$executeRawUnsafe(sql, ...params);
  }
  return total;
}

async function resetSecuencia(tabla: string, columna: string) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${tabla}', '${columna}'), COALESCE((SELECT MAX(${columna}) FROM ${tabla}), 1), true)`
  );
}

type NombreTabla = "lote" | "panteon" | "tipoLote" | "persona" | "fallecido" | "tituloPropiedad" | "usuario" | "permiso" | "cesionDerechos" | "tipoTramite";
const COLUMNA_ID: Record<NombreTabla, string> = {
  lote: "loteId", panteon: "panteonId", tipoLote: "tipoLoteId", persona: "personaId", fallecido: "fallecidoId",
  tituloPropiedad: "tituloId", usuario: "usuarioId", permiso: "permisoId", cesionDerechos: "cesionId", tipoTramite: "tipoTramiteId",
};
async function idsExistentes(tabla: NombreTabla): Promise<Set<number>> {
  const col = COLUMNA_ID[tabla];
  const filas = await (prisma[tabla] as any).findMany({ select: { [col]: true } });
  return new Set(filas.map((f: any) => f[col]));
}

async function detectarColisiones(tabla: NombreTabla, idsOrigen: number[]): Promise<Set<number>> {
  const existentes = await idsExistentes(tabla);
  return new Set(idsOrigen.filter((id) => existentes.has(id)));
}

async function migrarPersonas(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Personas ORDER BY PersonaID");
  reporte.personas = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const colisiones = await detectarColisiones("persona", r.recordset.map((p: any) => num(p.PersonaID)));
  const filas = r.recordset
    .filter((p: any) => {
      if (colisiones.has(num(p.PersonaID))) { reporte.personas.omitidos.push({ id: num(p.PersonaID), motivo: "ID ya existe en destino (posible dato de prueba)" }); return false; }
      return true;
    })
    .map((p: any) => ({
      persona_id: num(p.PersonaID),
      nombre_completo: p.NombreCompleto,
      curp: trimOrNull(p.CURP),
      domicilio: trimOrNull(p.Domicilio),
      colonia: trimOrNull(p.Colonia),
      telefono: trimOrNull(p.Telefono),
      correo_electronico: trimOrNull(p.CorreoElectronico),
      identificacion_tipo: trimOrNull(p.IdentificacionTipo),
      identificacion_numero: trimOrNull(p.IdentificacionNumero),
      fecha_registro: p.FechaRegistro,
    }));
  const cols = ["persona_id", "nombre_completo", "curp", "domicilio", "colonia", "telefono", "correo_electronico", "identificacion_tipo", "identificacion_numero", "fecha_registro"];
  reporte.personas.insertados = await insertarConId("personas", "persona_id", cols, filas);
  console.log(`  -> personas: ${reporte.personas.insertados}/${filas.length}`);
  await resetSecuencia("personas", "persona_id");
}

async function migrarFallecidos(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Fallecidos ORDER BY FallecidoID");
  reporte.fallecidos = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const colisiones = await detectarColisiones("fallecido", r.recordset.map((f: any) => num(f.FallecidoID)));
  const filas = r.recordset
    .filter((f: any) => {
      if (colisiones.has(num(f.FallecidoID))) { reporte.fallecidos.omitidos.push({ id: num(f.FallecidoID), motivo: "ID ya existe en destino (posible dato de prueba)" }); return false; }
      return true;
    })
    .map((f: any) => ({
      fallecido_id: num(f.FallecidoID),
      nombre_completo: f.NombreCompleto,
      fecha_nacimiento: f.FechaNacimiento,
      fecha_fallecimiento: f.FechaFallecimiento,
      acta_defuncion_numero: trimOrNull(f.ActaDefuncionNumero),
      acta_defuncion_folio: trimOrNull(f.ActaDefuncionFolio),
      acta_defuncion_fecha: f.ActaDefuncionFecha,
      causa_fallecimiento: trimOrNull(f.CausaFallecimiento),
      es_no_reclamado: f.EsNoReclamado,
      descripcion_hallazgo: trimOrNull(f.DescripcionHallazgo),
      numero_caso: trimOrNull(f.NumeroCaso),
      posible_nombre: trimOrNull(f.PosibleNombre),
      hora_fallecimiento: horaLimpia(f.HoraFallecimiento),
      fecha_levantamiento: f.FechaLevantamiento,
      lugar_levantamiento: trimOrNull(f.LugarLevantamiento),
      ministerio_publico: trimOrNull(f.MinisterioPublico),
      reconocido: f.Reconocido,
      fecha_registro: f.FechaRegistro,
    }));
  const cols = ["fallecido_id", "nombre_completo", "fecha_nacimiento", "fecha_fallecimiento", "acta_defuncion_numero", "acta_defuncion_folio", "acta_defuncion_fecha", "causa_fallecimiento", "es_no_reclamado", "descripcion_hallazgo", "numero_caso", "posible_nombre", "hora_fallecimiento", "fecha_levantamiento", "lugar_levantamiento", "ministerio_publico", "reconocido", "fecha_registro"];
  reporte.fallecidos.insertados = await insertarConId("fallecidos", "fallecido_id", cols, filas);
  console.log(`  -> fallecidos: ${reporte.fallecidos.insertados}/${filas.length}`);
  await resetSecuencia("fallecidos", "fallecido_id");
}

async function migrarLotes(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Lotes ORDER BY LoteID");
  reporte.lotes = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const panteones = await idsExistentes("panteon");
  const tiposLote = await idsExistentes("tipoLote");
  const colisiones = await detectarColisiones("lote", r.recordset.map((l: any) => num(l.LoteID)));
  const filas: any[] = [];
  for (const l of r.recordset) {
    const loteId = num(l.LoteID);
    const panteonId = num(l.PanteonID);
    const tipoLoteId = num(l.TipoLoteID);
    if (colisiones.has(loteId)) { reporte.lotes.omitidos.push({ id: loteId, motivo: "ID ya existe en destino" }); continue; }
    if (!panteones.has(panteonId)) { reporte.lotes.omitidos.push({ id: loteId, motivo: `PanteonID ${panteonId} inexistente` }); continue; }
    if (!tiposLote.has(tipoLoteId)) { reporte.lotes.omitidos.push({ id: loteId, motivo: `TipoLoteID ${tipoLoteId} inexistente` }); continue; }
    filas.push({
      lote_id: loteId, panteon_id: panteonId, tipo_lote_id: tipoLoteId,
      numero_manzana: l.NumeroManzana, numero_lote: l.NumeroLote,
      seccion: trimOrNull(l.Seccion), zona: trimOrNull(l.Zona), dimensiones: trimOrNull(l.Dimensiones),
      comprobante_pago: trimOrNull(l.ComprobantePago),
      colindancia_norte: trimOrNull(l.ColindanciaNorte), colindancia_sur: trimOrNull(l.ColindanciaSur),
      colindancia_este: trimOrNull(l.ColindanciaEste), colindancia_oeste: trimOrNull(l.ColindanciaOeste),
      clave_legado: trimOrNull(l.ClaveLegado), estado: l.Estado, es_fosa_comun: l.EsFosaComun,
      fecha_registro: l.FechaRegistro,
    });
  }
  const vistos = new Set<string>();
  const finales: any[] = [];
  for (const f of filas) {
    const clave = `${f.panteon_id}|${f.seccion ?? ""}|${f.numero_manzana}|${f.numero_lote}`;
    if (vistos.has(clave)) { reporte.lotes.omitidos.push({ id: f.lote_id, motivo: `Ubicación duplicada: ${clave}` }); continue; }
    vistos.add(clave);
    finales.push(f);
  }
  const cols = ["lote_id", "panteon_id", "tipo_lote_id", "numero_manzana", "numero_lote", "seccion", "zona", "dimensiones", "comprobante_pago", "colindancia_norte", "colindancia_sur", "colindancia_este", "colindancia_oeste", "clave_legado", "estado", "es_fosa_comun", "fecha_registro"];
  reporte.lotes.insertados = await insertarConId("lotes", "lote_id", cols, finales);
  console.log(`  -> lotes: ${reporte.lotes.insertados}/${r.recordset.length}`);
  await resetSecuencia("lotes", "lote_id");
}

async function migrarTitulos(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM TitulosPropiedad ORDER BY TituloID");
  reporte.titulos = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const lotes = await idsExistentes("lote");
  const personas = await idsExistentes("persona");
  const usuarios = await idsExistentes("usuario");
  const colisiones = await detectarColisiones("tituloPropiedad", r.recordset.map((t: any) => num(t.TituloID)));
  const filas: any[] = [];
  for (const t of r.recordset) {
    const tituloId = num(t.TituloID);
    const loteId = num(t.LoteID);
    const titularId = num(t.TitularID);
    const usuarioEmitioId = num(t.UsuarioEmitioID);
    if (colisiones.has(tituloId)) { reporte.titulos.omitidos.push({ id: tituloId, motivo: "ID ya existe en destino" }); continue; }
    if (!lotes.has(loteId)) { reporte.titulos.omitidos.push({ id: tituloId, motivo: `LoteID ${loteId} inexistente` }); continue; }
    if (!personas.has(titularId)) { reporte.titulos.omitidos.push({ id: tituloId, motivo: `TitularID ${titularId} inexistente` }); continue; }
    if (!usuarios.has(usuarioEmitioId)) { reporte.titulos.omitidos.push({ id: tituloId, motivo: `UsuarioEmitioID ${usuarioEmitioId} inexistente` }); continue; }
    const usuarioAproboIdRaw = numOrNull(t.UsuarioAproboID);
    filas.push({
      titulo_id: tituloId, lote_id: loteId, titular_id: titularId,
      folio: t.Folio, fecha_emision: t.FechaEmision, usuario_emitio_id: usuarioEmitioId,
      usuario_aprobo_id: usuarioAproboIdRaw != null && usuarios.has(usuarioAproboIdRaw) ? usuarioAproboIdRaw : null,
      fecha_aprobacion: t.FechaAprobacion, estado: t.Estado, estado_entrega: t.EstadoEntrega,
      fecha_entrega: t.FechaEntrega, ruta_documento: trimOrNull(t.RutaDocumento), fecha_creacion: t.FechaCreacion,
    });
  }
  const vistosFolio = new Set<string>();
  const finales: any[] = [];
  for (const f of filas) {
    if (vistosFolio.has(f.folio)) { reporte.titulos.omitidos.push({ id: f.titulo_id, motivo: `Folio duplicado: ${f.folio}` }); continue; }
    vistosFolio.add(f.folio);
    finales.push(f);
  }
  const cols = ["titulo_id", "lote_id", "titular_id", "folio", "fecha_emision", "usuario_emitio_id", "usuario_aprobo_id", "fecha_aprobacion", "estado", "estado_entrega", "fecha_entrega", "ruta_documento", "fecha_creacion"];
  reporte.titulos.insertados = await insertarConId("titulos_propiedad", "titulo_id", cols, finales);
  console.log(`  -> titulos_propiedad: ${reporte.titulos.insertados}/${r.recordset.length}`);
  await resetSecuencia("titulos_propiedad", "titulo_id");
}

async function migrarCesiones(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM CesionDerechos ORDER BY CesionID");
  reporte.cesiones = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const titulos = await idsExistentes("tituloPropiedad");
  const lotes = await idsExistentes("lote");
  const personas = await idsExistentes("persona");
  const usuarios = await idsExistentes("usuario");
  const colisiones = await detectarColisiones("cesionDerechos", r.recordset.map((c: any) => num(c.CesionID)));
  const filas: any[] = [];
  for (const c of r.recordset) {
    const cesionId = num(c.CesionID);
    const tituloId = num(c.TituloID);
    const loteId = num(c.LoteID);
    const cedenteId = num(c.CedenteID);
    const cesionarioId = num(c.CesionarioID);
    const usuarioRegistroId = num(c.UsuarioRegistroID);
    if (colisiones.has(cesionId)) { reporte.cesiones.omitidos.push({ id: cesionId, motivo: "ID ya existe en destino" }); continue; }
    if (!titulos.has(tituloId)) { reporte.cesiones.omitidos.push({ id: cesionId, motivo: `TituloID ${tituloId} inexistente` }); continue; }
    if (!lotes.has(loteId)) { reporte.cesiones.omitidos.push({ id: cesionId, motivo: `LoteID ${loteId} inexistente` }); continue; }
    if (!personas.has(cedenteId)) { reporte.cesiones.omitidos.push({ id: cesionId, motivo: `CedenteID ${cedenteId} inexistente` }); continue; }
    if (!personas.has(cesionarioId)) { reporte.cesiones.omitidos.push({ id: cesionId, motivo: `CesionarioID ${cesionarioId} inexistente` }); continue; }
    if (!usuarios.has(usuarioRegistroId)) { reporte.cesiones.omitidos.push({ id: cesionId, motivo: `UsuarioRegistroID ${usuarioRegistroId} inexistente` }); continue; }
    const usuarioAproboIdRaw = numOrNull(c.UsuarioAproboID);
    filas.push({
      cesion_id: cesionId, titulo_id: tituloId, lote_id: loteId, cedente_id: cedenteId, cesionario_id: cesionarioId,
      folio: c.Folio, fecha_cesion: c.FechaCesion, usuario_registro_id: usuarioRegistroId,
      usuario_aprobo_id: usuarioAproboIdRaw != null && usuarios.has(usuarioAproboIdRaw) ? usuarioAproboIdRaw : null,
      fecha_aprobacion: c.FechaAprobacion, estado: c.Estado, ruta_documento: trimOrNull(c.RutaDocumento), fecha_creacion: c.FechaCreacion,
    });
  }
  const vistosFolio = new Set<string>();
  const finales: any[] = [];
  for (const f of filas) {
    if (vistosFolio.has(f.folio)) { reporte.cesiones.omitidos.push({ id: f.cesion_id, motivo: `Folio duplicado: ${f.folio}` }); continue; }
    vistosFolio.add(f.folio);
    finales.push(f);
  }
  const cols = ["cesion_id", "titulo_id", "lote_id", "cedente_id", "cesionario_id", "folio", "fecha_cesion", "usuario_registro_id", "usuario_aprobo_id", "fecha_aprobacion", "estado", "ruta_documento", "fecha_creacion"];
  reporte.cesiones.insertados = await insertarConId("cesion_derechos", "cesion_id", cols, finales);
  console.log(`  -> cesion_derechos: ${reporte.cesiones.insertados}/${r.recordset.length}`);
  await resetSecuencia("cesion_derechos", "cesion_id");
}

async function migrarPermisos(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Permisos ORDER BY PermisoID");
  reporte.permisos = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const tiposTramite = await idsExistentes("tipoTramite");
  const lotes = await idsExistentes("lote");
  const personas = await idsExistentes("persona");
  const fallecidos = await idsExistentes("fallecido");
  const usuarios = await idsExistentes("usuario");
  const colisiones = await detectarColisiones("permiso", r.recordset.map((p: any) => num(p.PermisoID)));
  const filas: any[] = [];
  for (const p of r.recordset) {
    const permisoId = num(p.PermisoID);
    const tipoTramiteId = num(p.TipoTramiteID);
    const solicitanteId = num(p.SolicitanteID);
    const usuarioRegistroId = num(p.UsuarioRegistroID);
    if (colisiones.has(permisoId)) { reporte.permisos.omitidos.push({ id: permisoId, motivo: "ID ya existe en destino" }); continue; }
    if (!tiposTramite.has(tipoTramiteId)) { reporte.permisos.omitidos.push({ id: permisoId, motivo: `TipoTramiteID ${tipoTramiteId} inexistente` }); continue; }
    if (!personas.has(solicitanteId)) { reporte.permisos.omitidos.push({ id: permisoId, motivo: `SolicitanteID ${solicitanteId} inexistente` }); continue; }
    if (!usuarios.has(usuarioRegistroId)) { reporte.permisos.omitidos.push({ id: permisoId, motivo: `UsuarioRegistroID ${usuarioRegistroId} inexistente` }); continue; }
    const loteIdRaw = numOrNull(p.LoteID);
    const fallecidoIdRaw = numOrNull(p.FallecidoID);
    const usuarioAproboIdRaw = numOrNull(p.UsuarioAproboID);
    filas.push({
      permiso_id: permisoId, tipo_tramite_id: tipoTramiteId,
      lote_id: loteIdRaw != null && lotes.has(loteIdRaw) ? loteIdRaw : null,
      solicitante_id: solicitanteId,
      fallecido_id: fallecidoIdRaw != null && fallecidos.has(fallecidoIdRaw) ? fallecidoIdRaw : null,
      folio: p.Folio, fecha_solicitud: p.FechaSolicitud, fecha_emision: p.FechaEmision,
      usuario_registro_id: usuarioRegistroId,
      usuario_aprobo_id: usuarioAproboIdRaw != null && usuarios.has(usuarioAproboIdRaw) ? usuarioAproboIdRaw : null,
      estado: p.Estado, motivo_exhumacion: trimOrNull(p.MotivoExhumacion), destino_restos: trimOrNull(p.DestinoRestos),
      ubicacion_deposito: trimOrNull(p.UbicacionDeposito), tipo_obra: trimOrNull(p.TipoObra), descripcion_obra: trimOrNull(p.DescripcionObra),
      es_donacion: p.EsDonacion, numero_recibo: trimOrNull(p.NumeroRecibo), funeraria: trimOrNull(p.Funeraria),
      instancia_solicita: trimOrNull(p.InstanciaSolicita), ruta_documento: trimOrNull(p.RutaDocumento), fecha_creacion: p.FechaCreacion,
    });
  }
  const vistosFolio = new Set<string>();
  const finales: any[] = [];
  for (const f of filas) {
    if (vistosFolio.has(f.folio)) { reporte.permisos.omitidos.push({ id: f.permiso_id, motivo: `Folio duplicado: ${f.folio}` }); continue; }
    vistosFolio.add(f.folio);
    finales.push(f);
  }
  const cols = ["permiso_id", "tipo_tramite_id", "lote_id", "solicitante_id", "fallecido_id", "folio", "fecha_solicitud", "fecha_emision", "usuario_registro_id", "usuario_aprobo_id", "estado", "motivo_exhumacion", "destino_restos", "ubicacion_deposito", "tipo_obra", "descripcion_obra", "es_donacion", "numero_recibo", "funeraria", "instancia_solicita", "ruta_documento", "fecha_creacion"];
  reporte.permisos.insertados = await insertarConId("permisos", "permiso_id", cols, finales);
  console.log(`  -> permisos: ${reporte.permisos.insertados}/${r.recordset.length}`);
  await resetSecuencia("permisos", "permiso_id");
}

async function migrarReconocimientos(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Reconocimientos ORDER BY ReconocimientoID");
  reporte.reconocimientos = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const fallecidos = await idsExistentes("fallecido");
  const lotes = await idsExistentes("lote");
  const permisos = await idsExistentes("permiso");
  const usuarios = await idsExistentes("usuario");
  const existentesReconocimiento = new Set(
    (await prisma.reconocimiento.findMany({ select: { reconocimientoId: true } })).map((x) => x.reconocimientoId)
  );
  const filas: any[] = [];
  for (const rec of r.recordset) {
    const reconocimientoId = num(rec.ReconocimientoID);
    const fallecidoId = num(rec.FallecidoID);
    if (existentesReconocimiento.has(reconocimientoId)) { reporte.reconocimientos.omitidos.push({ id: reconocimientoId, motivo: "ID ya existe en destino" }); continue; }
    if (!fallecidos.has(fallecidoId)) { reporte.reconocimientos.omitidos.push({ id: reconocimientoId, motivo: `FallecidoID ${fallecidoId} inexistente` }); continue; }
    const loteIdRaw = numOrNull(rec.LoteID);
    const permisoExhumacionIdRaw = numOrNull(rec.PermisoExhumacionID);
    const usuarioRegistroIdRaw = numOrNull(rec.UsuarioRegistroID);
    filas.push({
      reconocimiento_id: reconocimientoId, fallecido_id: fallecidoId,
      lote_id: loteIdRaw != null && lotes.has(loteIdRaw) ? loteIdRaw : null,
      nombre_anterior: rec.NombreAnterior, nombre_identificado: rec.NombreIdentificado,
      fecha_reconocimiento: rec.FechaReconocimiento, medio_identificacion: trimOrNull(rec.MedioIdentificacion),
      instancia_solicita: trimOrNull(rec.InstanciaSolicita), numero_acta_defuncion: trimOrNull(rec.NumeroActaDefuncion),
      ministerio_publico: trimOrNull(rec.MinisterioPublico), observaciones: trimOrNull(rec.Observaciones),
      permiso_exhumacion_id: permisoExhumacionIdRaw != null && permisos.has(permisoExhumacionIdRaw) ? permisoExhumacionIdRaw : null,
      usuario_registro_id: usuarioRegistroIdRaw != null && usuarios.has(usuarioRegistroIdRaw) ? usuarioRegistroIdRaw : null,
      fecha_registro: rec.FechaRegistro,
    });
  }
  const cols = ["reconocimiento_id", "fallecido_id", "lote_id", "nombre_anterior", "nombre_identificado", "fecha_reconocimiento", "medio_identificacion", "instancia_solicita", "numero_acta_defuncion", "ministerio_publico", "observaciones", "permiso_exhumacion_id", "usuario_registro_id", "fecha_registro"];
  reporte.reconocimientos.insertados = await insertarConId("reconocimientos", "reconocimiento_id", cols, filas);
  console.log(`  -> reconocimientos: ${reporte.reconocimientos.insertados}/${r.recordset.length}`);
  await resetSecuencia("reconocimientos", "reconocimiento_id");
}

async function migrarReimpresiones(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Reimpresiones ORDER BY ReimpresionID");
  reporte.reimpresiones = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const permisos = await idsExistentes("permiso");
  const titulos = await idsExistentes("tituloPropiedad");
  const cesiones = await idsExistentes("cesionDerechos");
  const usuarios = await idsExistentes("usuario");
  const existentes = new Set(
    (await prisma.reimpresion.findMany({ select: { reimpresionId: true } })).map((x) => x.reimpresionId)
  );
  const filas: any[] = [];
  for (const x of r.recordset) {
    const reimpresionId = num(x.ReimpresionID);
    const usuarioId = num(x.UsuarioID);
    if (existentes.has(reimpresionId)) { reporte.reimpresiones.omitidos.push({ id: reimpresionId, motivo: "ID ya existe en destino" }); continue; }
    if (!usuarios.has(usuarioId)) { reporte.reimpresiones.omitidos.push({ id: reimpresionId, motivo: `UsuarioID ${usuarioId} inexistente` }); continue; }
    const permisoIdRaw = numOrNull(x.PermisoID);
    const tituloIdRaw = numOrNull(x.TituloID);
    const cesionIdRaw = numOrNull(x.CesionID);
    filas.push({
      reimpresion_id: reimpresionId,
      permiso_id: permisoIdRaw != null && permisos.has(permisoIdRaw) ? permisoIdRaw : null,
      titulo_id: tituloIdRaw != null && titulos.has(tituloIdRaw) ? tituloIdRaw : null,
      cesion_id: cesionIdRaw != null && cesiones.has(cesionIdRaw) ? cesionIdRaw : null,
      usuario_id: usuarioId, fecha_reimpresion: x.FechaReimpresion, motivo: x.Motivo, ruta_documento: trimOrNull(x.RutaDocumento),
    });
  }
  const cols = ["reimpresion_id", "permiso_id", "titulo_id", "cesion_id", "usuario_id", "fecha_reimpresion", "motivo", "ruta_documento"];
  reporte.reimpresiones.insertados = await insertarConId("reimpresiones", "reimpresion_id", cols, filas);
  console.log(`  -> reimpresiones: ${reporte.reimpresiones.insertados}/${r.recordset.length}`);
  await resetSecuencia("reimpresiones", "reimpresion_id");
}

async function migrarIncidencias(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Incidencias ORDER BY IncidenciaID");
  reporte.incidencias = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const panteones = await idsExistentes("panteon");
  const lotes = await idsExistentes("lote");
  const usuarios = await idsExistentes("usuario");
  const existentes = new Set(
    (await prisma.incidencia.findMany({ select: { incidenciaId: true } })).map((x) => x.incidenciaId)
  );
  const filas: any[] = [];
  for (const inc of r.recordset) {
    const incidenciaId = num(inc.IncidenciaID);
    const panteonId = num(inc.PanteonID);
    if (existentes.has(incidenciaId)) { reporte.incidencias.omitidos.push({ id: incidenciaId, motivo: "ID ya existe en destino" }); continue; }
    if (!panteones.has(panteonId)) { reporte.incidencias.omitidos.push({ id: incidenciaId, motivo: `PanteonID ${panteonId} inexistente` }); continue; }
    const loteIdRaw = numOrNull(inc.LoteID);
    const usuarioRegistroIdRaw = numOrNull(inc.UsuarioRegistroID);
    filas.push({
      incidencia_id: incidenciaId, panteon_id: panteonId,
      lote_id: loteIdRaw != null && lotes.has(loteIdRaw) ? loteIdRaw : null,
      seccion: trimOrNull(inc.Seccion), numero_manzana: trimOrNull(inc.NumeroManzana), numero_lote: trimOrNull(inc.NumeroLote),
      tipo: inc.Tipo, descripcion: inc.Descripcion, fecha_incidencia: inc.FechaIncidencia,
      reportado_por: trimOrNull(inc.ReportadoPor), estado: inc.Estado, fecha_atencion: inc.FechaAtencion,
      atendido_por: trimOrNull(inc.AtendidoPor), resolucion: trimOrNull(inc.Resolucion),
      usuario_registro_id: usuarioRegistroIdRaw != null && usuarios.has(usuarioRegistroIdRaw) ? usuarioRegistroIdRaw : null,
      fecha_registro: inc.FechaRegistro,
    });
  }
  const cols = ["incidencia_id", "panteon_id", "lote_id", "seccion", "numero_manzana", "numero_lote", "tipo", "descripcion", "fecha_incidencia", "reportado_por", "estado", "fecha_atencion", "atendido_por", "resolucion", "usuario_registro_id", "fecha_registro"];
  reporte.incidencias.insertados = await insertarConId("incidencias", "incidencia_id", cols, filas);
  console.log(`  -> incidencias: ${reporte.incidencias.insertados}/${r.recordset.length}`);
  await resetSecuencia("incidencias", "incidencia_id");
}

async function migrarBitacoras(pool: sqlModule.ConnectionPool) {
  const r = await pool.request().query("SELECT * FROM Bitacoras ORDER BY BitacoraID");
  reporte.bitacoras = { origen: r.recordset.length, insertados: 0, omitidos: [] };
  const usuarios = await idsExistentes("usuario");
  const existentes = new Set(
    (await prisma.bitacora.findMany({ select: { bitacoraId: true } })).map((x) => x.bitacoraId.toString())
  );
  const filas: any[] = [];
  for (const b of r.recordset) {
    const bitacoraId = BigInt(b.BitacoraID);
    if (existentes.has(bitacoraId.toString())) { reporte.bitacoras.omitidos.push({ id: Number(bitacoraId), motivo: "ID ya existe en destino (posible dato de prueba)" }); continue; }
    const usuarioIdRaw = numOrNull(b.UsuarioID);
    filas.push({
      bitacora_id: bitacoraId,
      usuario_id: usuarioIdRaw != null && usuarios.has(usuarioIdRaw) ? usuarioIdRaw : null,
      accion: b.Accion, tabla: trimOrNull(b.Tabla), registro_id: numOrNull(b.RegistroID),
      descripcion: trimOrNull(b.Descripcion), ip_acceso: trimOrNull(b.IPAcceso), fecha_hora: b.FechaHora,
    });
  }
  const cols = ["bitacora_id", "usuario_id", "accion", "tabla", "registro_id", "descripcion", "ip_acceso", "fecha_hora"];
  reporte.bitacoras.insertados = await insertarConId("bitacoras", "bitacora_id", cols, filas);
  console.log(`  -> bitacoras: ${reporte.bitacoras.insertados}/${r.recordset.length}`);
  await resetSecuencia("bitacoras", "bitacora_id");
}

async function main() {
  const soloTabla = process.argv[2];
  const pool = await conectarSqlServer();

  if (!soloTabla || soloTabla === "personas") await migrarPersonas(pool);
  if (!soloTabla || soloTabla === "fallecidos") await migrarFallecidos(pool);
  if (!soloTabla || soloTabla === "lotes") await migrarLotes(pool);
  if (!soloTabla || soloTabla === "titulos") await migrarTitulos(pool);
  if (!soloTabla || soloTabla === "cesiones") await migrarCesiones(pool);
  if (!soloTabla || soloTabla === "permisos") await migrarPermisos(pool);
  if (!soloTabla || soloTabla === "reconocimientos") await migrarReconocimientos(pool);
  if (!soloTabla || soloTabla === "reimpresiones") await migrarReimpresiones(pool);
  if (!soloTabla || soloTabla === "incidencias") await migrarIncidencias(pool);
  if (!soloTabla || soloTabla === "bitacoras") await migrarBitacoras(pool);

  fs.writeFileSync("scripts/reporte_migracion.json", JSON.stringify(reporte, null, 2), "utf-8");
  console.log("\nReporte guardado en scripts/reporte_migracion.json");

  await pool.close();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("ERROR FATAL:", err);
  await prisma.$disconnect();
  process.exit(1);
});
