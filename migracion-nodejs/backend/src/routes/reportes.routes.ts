import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { prepararHoja, cerrarHoja, escribirFecha, GUINDA, GUINDA_LT, type ColDef } from "../lib/excel";

export const reportesRouter = Router();
reportesRouter.use(requiereAuth);

reportesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [totalNoReclamados, totalIdentificados, totalIncidencias, incidenciasPendientes] = await Promise.all([
      prisma.fallecido.count({ where: { esNoReclamado: true } }),
      prisma.reconocimiento.count(),
      prisma.incidencia.count(),
      prisma.incidencia.count({ where: { estado: { not: "ATENDIDA" } } }),
    ]);

    res.json({ totalNoReclamados, totalIdentificados, totalIncidencias, incidenciasPendientes });
  })
);

// Panel principal (Home/Index del original): KPIs del mes en curso + últimos
// trámites + distribución por panteón. Distinto del resumen de arriba, que
// alimenta la página de Reportes.
reportesRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const ahora = new Date();
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const inicioMesSiguiente = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
    const rangoMes = { gte: inicioMes, lt: inicioMesSiguiente };

    const [totalExpedientesVigentes, permisosEsteMes, titulosPendientesEntrega, totalFallecidos, permisosDelMes, ultimosPermisos, panteones] =
      await Promise.all([
        prisma.tituloPropiedad.count({ where: { estado: "VIGENTE" } }),
        prisma.permiso.count({ where: { fechaCreacion: rangoMes, estado: { not: "CANCELADO" } } }),
        prisma.tituloPropiedad.count({ where: { estado: "VIGENTE", estadoEntrega: { not: "ENTREGADO" } } }),
        prisma.fallecido.count(),
        prisma.permiso.findMany({
          where: { fechaCreacion: rangoMes, estado: { not: "CANCELADO" } },
          select: { tipoTramite: { select: { clave: true } } },
        }),
        prisma.permiso.findMany({
          where: { estado: { not: "CANCELADO" } },
          include: { tipoTramite: true, solicitante: true, lote: { include: { panteon: true } } },
          orderBy: { fechaCreacion: "desc" },
          take: 8,
        }),
        prisma.panteon.findMany({
          where: { activo: true },
          include: { lotes: { select: { titulos: { where: { estado: "VIGENTE" }, select: { tituloId: true } } } } },
        }),
      ]);

    const contarTipo = (clave: string) => permisosDelMes.filter((p) => p.tipoTramite.clave === clave).length;

    const porPanteon = panteones
      .map((p) => ({
        nombre: p.nombre,
        titulosVigentes: p.lotes.reduce((acc, l) => acc + l.titulos.length, 0),
      }))
      .filter((p) => p.titulosVigentes > 0)
      .sort((a, b) => b.titulosVigentes - a.titulosVigentes);

    const anioActual = ahora.getFullYear();
    const nombreMes = ahora.toLocaleDateString("es-MX", { month: "long", timeZone: "UTC" });

    res.json({
      totalExpedientesVigentes,
      permisosEsteMes,
      titulosPendientesEntrega,
      totalFallecidos,
      sepMes: contarTipo("SEP"),
      exhMes: contarTipo("EXH"),
      cenMes: contarTipo("CEN"),
      conMes: contarTipo("CON"),
      nombreMes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
      anioActual,
      ultimosPermisos: ultimosPermisos.map((p) => ({
        permisoId: p.permisoId,
        folio: p.folio,
        tipoTramite: { nombre: p.tipoTramite.nombre },
        solicitante: { nombreCompleto: p.solicitante.nombreCompleto },
        panteon: p.lote?.panteon.nombre ?? null,
        fechaSolicitud: p.fechaSolicitud,
      })),
      porPanteon,
    });
  })
);

function nombreTramite(clave?: string | null): string {
  switch (clave) {
    case "SEP":
      return "Inhumación";
    case "EXH":
      return "Exhumación";
    case "CEN":
      return "Depósito de cenizas";
    case "CON":
      return "Construcción";
    default:
      return clave ?? "Otro";
  }
}

const NOMBRES_MES = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

interface MovimientoDetalleItem {
  fecha: Date | null;
  panteon: string;
  movimiento: string;
  folio: string;
  persona: string | null;
  seccion: string | null;
  manzana: string;
  lote: string;
  observacion: string | null;
}

// Relación mensual de movimientos por panteón: es el concentrado que el
// departamento entregaba a mano cada mes (inhumaciones, exhumaciones,
// cenizas, construcciones, títulos y cesiones). Puerto exacto de la
// agregación de ReportesController.Movimientos.
async function calcularMovimientos(anioParam: number, mesParam?: number) {
    const anio = anioParam || new Date().getFullYear();
    const mes = mesParam && mesParam >= 1 && mesParam <= 12 ? mesParam : undefined;

    const ini = mes ? new Date(Date.UTC(anio, mes - 1, 1)) : new Date(Date.UTC(anio, 0, 1));
    const fin = mes ? new Date(Date.UTC(anio, mes, 0)) : new Date(Date.UTC(anio, 11, 31));

    const [panteones, permisos, titulos, cesiones] = await Promise.all([
      prisma.panteon.findMany({ orderBy: { nombre: "asc" } }),
      prisma.permiso.findMany({
        where: { fechaSolicitud: { gte: ini, lte: fin }, loteId: { not: null } },
        include: { tipoTramite: true, solicitante: true, fallecido: true, lote: { include: { panteon: true } } },
      }),
      prisma.tituloPropiedad.findMany({
        where: { fechaEmision: { gte: ini, lte: fin } },
        include: { titular: true, lote: { include: { panteon: true } } },
      }),
      prisma.cesionDerechos.findMany({
        where: { fechaCesion: { gte: ini, lte: fin } },
        include: { cedente: true, cesionario: true, lote: { include: { panteon: true } } },
      }),
    ]);

    // Resumen: un renglón por panteón, solo los que tuvieron movimiento.
    const resumen = panteones
      .map((pa) => {
        const pp = permisos.filter((x) => x.lote?.panteonId === pa.panteonId);
        const inhumaciones = pp.filter((x) => x.tipoTramite.clave === "SEP").length;
        const exhumaciones = pp.filter((x) => x.tipoTramite.clave === "EXH").length;
        const cenizas = pp.filter((x) => x.tipoTramite.clave === "CEN").length;
        const construcciones = pp.filter((x) => x.tipoTramite.clave === "CON").length;
        const titulosPanteon = titulos.filter((x) => x.lote.panteonId === pa.panteonId).length;
        const cesionesPanteon = cesiones.filter((x) => x.lote.panteonId === pa.panteonId).length;
        const donaciones = pp.filter((x) => x.esDonacion).length;
        const total = inhumaciones + exhumaciones + cenizas + construcciones + titulosPanteon + cesionesPanteon;
        return {
          panteon: pa.nombre,
          inhumaciones,
          exhumaciones,
          cenizas,
          construcciones,
          titulos: titulosPanteon,
          cesiones: cesionesPanteon,
          donaciones,
          total,
        };
      })
      .filter((x) => x.total > 0);

    // Detalle: cada movimiento individual, en orden cronológico por panteón.
    const detalle: MovimientoDetalleItem[] = [];

    for (const x of permisos) {
      detalle.push({
        fecha: x.fechaSolicitud,
        panteon: x.lote!.panteon.nombre,
        movimiento: nombreTramite(x.tipoTramite.clave),
        folio: x.folio,
        persona: x.solicitante?.nombreCompleto ?? null,
        seccion: x.lote!.seccion,
        manzana: x.lote!.numeroManzana,
        lote: x.lote!.numeroLote,
        observacion: x.esDonacion ? "LOTE EN DONACIÓN" : (x.fallecido?.nombreCompleto ?? null),
      });
    }
    for (const x of titulos) {
      detalle.push({
        fecha: x.fechaEmision,
        panteon: x.lote.panteon.nombre,
        movimiento: "Título de propiedad",
        folio: x.folio,
        persona: x.titular.nombreCompleto,
        seccion: x.lote.seccion,
        manzana: x.lote.numeroManzana,
        lote: x.lote.numeroLote,
        observacion: x.estado === "VIGENTE" ? null : `Título ${x.estado.toLowerCase()}`,
      });
    }
    for (const x of cesiones) {
      detalle.push({
        fecha: x.fechaCesion,
        panteon: x.lote.panteon.nombre,
        movimiento: "Cesión de derechos",
        folio: x.folio,
        persona: x.cesionario.nombreCompleto,
        seccion: x.lote.seccion,
        manzana: x.lote.numeroManzana,
        lote: x.lote.numeroLote,
        observacion: x.cedente ? `Cedido por ${x.cedente.nombreCompleto}` : null,
      });
    }

    detalle.sort((a, b) => {
      const p = a.panteon.localeCompare(b.panteon);
      if (p !== 0) return p;
      if (a.fecha === null && b.fecha === null) return 0;
      if (a.fecha === null) return 1;
      if (b.fecha === null) return -1;
      return a.fecha.getTime() - b.fecha.getTime();
    });

    const periodo = mes ? `${NOMBRES_MES[mes]} de ${anio}` : `Ejercicio ${anio}`;

    return { resumen, detalle, periodo, anio, mes: mes ?? null };
}

reportesRouter.get(
  "/movimientos",
  asyncHandler(async (req, res) => {
    const r = await calcularMovimientos(Number(req.query.anio), req.query.mes ? Number(req.query.mes) : undefined);
    res.json(r);
  })
);

const ColsResumen: ColDef[] = [
  { titulo: "PANTEÓN", ancho: 34, align: "left" },
  { titulo: "INHUMACIONES", ancho: 14, align: "center" },
  { titulo: "EXHUMACIONES", ancho: 14, align: "center" },
  { titulo: "DEPÓSITO DE CENIZAS", ancho: 15, align: "center" },
  { titulo: "CONSTRUCCIONES", ancho: 14, align: "center" },
  { titulo: "TÍTULOS EMITIDOS", ancho: 14, align: "center" },
  { titulo: "CESIONES DE DERECHOS", ancho: 15, align: "center" },
  { titulo: "TOTAL", ancho: 11, align: "center" },
  { titulo: "DE LOS CUALES FUERON DONACIÓN", ancho: 16, align: "center" },
];

const ColsDetalle: ColDef[] = [
  { titulo: "FECHA", ancho: 12, align: "center" },
  { titulo: "PANTEÓN", ancho: 30, align: "left" },
  { titulo: "MOVIMIENTO", ancho: 20, align: "left" },
  { titulo: "FOLIO", ancho: 18, align: "left" },
  { titulo: "SOLICITANTE / TITULAR", ancho: 34, align: "left" },
  { titulo: "SECCIÓN", ancho: 16, align: "center" },
  { titulo: "MANZANA", ancho: 10, align: "center" },
  { titulo: "LOTE", ancho: 10, align: "center" },
  { titulo: "OBSERVACIONES", ancho: 34, align: "left" },
];

reportesRouter.get(
  "/movimientos/excel",
  asyncHandler(async (req, res) => {
    const { resumen, detalle, periodo } = await calcularMovimientos(
      Number(req.query.anio),
      req.query.mes ? Number(req.query.mes) : undefined
    );

    const wb = new ExcelJS.Workbook();

    // ── Hoja 1: el concentrado que se entrega ──
    const totalMovs = resumen.reduce((s, x) => s + x.total, 0);
    const ws = prepararHoja(wb, "Resumen", ColsResumen, "RELACIÓN MENSUAL DE MOVIMIENTOS", "Trámites realizados por panteón", periodo, totalMovs);

    let r = 7;
    let i = 1;
    for (const it of resumen) {
      ws.getCell(r, 1).value = it.panteon;
      ws.getCell(r, 2).value = it.inhumaciones;
      ws.getCell(r, 3).value = it.exhumaciones;
      ws.getCell(r, 4).value = it.cenizas;
      ws.getCell(r, 5).value = it.construcciones;
      ws.getCell(r, 6).value = it.titulos;
      ws.getCell(r, 7).value = it.cesiones;
      ws.getCell(r, 8).value = it.total;
      ws.getCell(r, 9).value = it.donaciones;

      ws.getCell(r, 8).font = { bold: true, color: { argb: `FF${GUINDA}` } };

      // Un cero no aporta nada de leer: se atenúa para que resalte lo que sí hubo.
      for (let c = 2; c <= 9; c++) {
        const v = ws.getCell(r, c).value;
        if (v === 0) ws.getCell(r, c).font = { color: { argb: "FFBBBBBB" } };
      }

      if (i % 2 === 0) {
        for (let c = 1; c <= ColsResumen.length; c++) {
          ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3F4" } };
        }
      }
      r++;
      i++;
    }

    if (resumen.length > 0) {
      ws.getCell(r, 1).value = "TOTAL GENERAL";
      ws.getCell(r, 2).value = resumen.reduce((s, x) => s + x.inhumaciones, 0);
      ws.getCell(r, 3).value = resumen.reduce((s, x) => s + x.exhumaciones, 0);
      ws.getCell(r, 4).value = resumen.reduce((s, x) => s + x.cenizas, 0);
      ws.getCell(r, 5).value = resumen.reduce((s, x) => s + x.construcciones, 0);
      ws.getCell(r, 6).value = resumen.reduce((s, x) => s + x.titulos, 0);
      ws.getCell(r, 7).value = resumen.reduce((s, x) => s + x.cesiones, 0);
      ws.getCell(r, 8).value = totalMovs;
      ws.getCell(r, 9).value = resumen.reduce((s, x) => s + x.donaciones, 0);
      for (let c = 1; c <= ColsResumen.length; c++) {
        ws.getCell(r, c).font = { bold: true, color: { argb: "FFFFFFFF" } };
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GUINDA_LT}` } };
      }
      ws.getRow(r).height = 18;
      r++;
    }

    // Se pasa el total de movimientos, no el de panteones: el pie dice
    // "registro(s)" y contar renglones ahí contradecía al encabezado.
    cerrarHoja(ws, ColsResumen, totalMovs, r);

    // ── Hoja 2: el respaldo movimiento por movimiento ──
    const wd = prepararHoja(wb, "Detalle", ColsDetalle, "DETALLE DE MOVIMIENTOS", "Cada trámite del periodo", periodo, detalle.length);

    let rd = 7;
    let j = 1;
    for (const it of detalle) {
      escribirFecha(wd.getCell(rd, 1), it.fecha);
      wd.getCell(rd, 2).value = it.panteon;
      wd.getCell(rd, 3).value = it.movimiento;
      wd.getCell(rd, 4).value = it.folio;
      wd.getCell(rd, 5).value = it.persona ?? "";
      wd.getCell(rd, 6).value = it.seccion ?? "";
      wd.getCell(rd, 7).value = it.manzana ?? "";
      wd.getCell(rd, 8).value = it.lote ?? "";
      wd.getCell(rd, 9).value = it.observacion ?? "";
      wd.getCell(rd, 9).alignment = { wrapText: true };

      if (j % 2 === 0) {
        for (let c = 1; c <= ColsDetalle.length; c++) {
          wd.getCell(rd, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3F4" } };
        }
      }
      rd++;
      j++;
    }

    cerrarHoja(wd, ColsDetalle, detalle.length, rd);

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Imprimir, "permisos", undefined, `Relación de movimientos (${periodo}) — ${detalle.length} movimiento(s)`, req.ip);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Movimientos_${req.query.anio ?? new Date().getFullYear()}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);
