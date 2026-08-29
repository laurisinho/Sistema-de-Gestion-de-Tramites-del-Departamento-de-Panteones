import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import ExcelJS from "exceljs";
import { prepararHoja, cerrarHoja, escribirFecha, type ColDef } from "../lib/excel";

export const incidenciasRouter = Router();
incidenciasRouter.use(requiereAuth);

// Mismos catálogos estáticos que Models/Entities/Incidencia.cs.
export const ESTADOS_INCIDENCIA = ["REPORTADA", "EN_PROCESO", "ATENDIDA"] as const;
export const TIPOS_INCIDENCIA = [
  "VANDALISMO",
  "DAÑO ESTRUCTURAL",
  "MALEZA / LIMPIEZA",
  "ROBO",
  "HUNDIMIENTO",
  "FUGA DE AGUA",
  "ALUMBRADO",
  "ACCESO / BARDA",
  "OTRO",
];

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function filtrar(panteonId?: number, estado?: string, tipo?: string, q?: string): Prisma.IncidenciaWhereInput {
  const where: Prisma.IncidenciaWhereInput = {};
  if (panteonId) where.panteonId = panteonId;
  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (q) {
    where.OR = [
      { descripcion: { contains: q, mode: "insensitive" } },
      { reportadoPor: { contains: q, mode: "insensitive" } },
      { numeroManzana: { contains: q, mode: "insensitive" } },
      { numeroLote: { contains: q, mode: "insensitive" } },
      { seccion: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

incidenciasRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const estado = str(req.query.estado);
    const tipo = str(req.query.tipo);
    const q = str(req.query.q);

    const where = filtrar(panteonId, estado, tipo, q);

    const [lista, reportadas, enProceso, atendidas] = await Promise.all([
      prisma.incidencia.findMany({
        where,
        include: { panteon: true },
        orderBy: [{ fechaIncidencia: "desc" }, { incidenciaId: "desc" }],
        take: 300,
      }),
      prisma.incidencia.count({ where: { estado: "REPORTADA" } }),
      prisma.incidencia.count({ where: { estado: "EN_PROCESO" } }),
      prisma.incidencia.count({ where: { estado: "ATENDIDA" } }),
    ]);

    res.json({ lista, reportadas, enProceso, atendidas });
  })
);

// Ubicación: si se eligió un lote del catálogo se copia de él; si no, se
// conserva lo capturado a mano para incidencias de área (pasillos, bardas).
// Puerto exacto de AsignarUbicacion.
async function asignarUbicacion(loteId: number | null | undefined, seccion?: string, numeroManzana?: string, numeroLote?: string) {
  if (loteId) {
    const lote = await prisma.lote.findUnique({ where: { loteId } });
    if (lote) {
      return { loteId, seccion: lote.seccion, numeroManzana: lote.numeroManzana, numeroLote: lote.numeroLote };
    }
    loteId = null;
  }
  return {
    loteId: null,
    seccion: seccion?.trim() || null,
    numeroManzana: numeroManzana?.trim() || null,
    numeroLote: numeroLote?.trim() || null,
  };
}

const fechaISO = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
  .transform((s) => new Date(s));

const incidenciaSchema = z.object({
  panteonId: z.coerce.number().int({ message: "Selecciona el panteón." }),
  loteId: z.coerce.number().int().optional(),
  seccion: z.string().optional(),
  numeroManzana: z.string().optional(),
  numeroLote: z.string().optional(),
  tipo: z.string().min(1, "Indica qué tipo de incidencia fue."),
  descripcion: z.string().min(1, "Describe qué pasó."),
  fechaIncidencia: fechaISO,
  reportadoPor: z.string().optional(),
});

incidenciasRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = incidenciaSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;
    const ubicacion = await asignarUbicacion(vm.loteId, vm.seccion, vm.numeroManzana, vm.numeroLote);

    const incidencia = await prisma.incidencia.create({
      data: {
        panteonId: vm.panteonId,
        loteId: ubicacion.loteId,
        seccion: ubicacion.seccion,
        numeroManzana: ubicacion.numeroManzana,
        numeroLote: ubicacion.numeroLote,
        tipo: vm.tipo.trim(),
        descripcion: vm.descripcion.trim(),
        fechaIncidencia: vm.fechaIncidencia,
        reportadoPor: vm.reportadoPor?.trim(),
        estado: "REPORTADA",
        usuarioRegistroId: req.usuario!.usuarioId,
      },
    });

    const ubicacionTexto = [
      ubicacion.seccion ? `Secc. ${ubicacion.seccion}` : null,
      ubicacion.numeroManzana ? `Mz ${ubicacion.numeroManzana}` : null,
      ubicacion.numeroLote ? `Lote ${ubicacion.numeroLote}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Área general";

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Crear,
      "incidencias",
      incidencia.incidenciaId,
      `Incidencia ${incidencia.tipo} registrada en ${ubicacionTexto}`,
      req.ip
    );

    res.status(201).json({ incidenciaId: incidencia.incidenciaId });
  })
);

// ── REPORTE EN EXCEL ─────────────────────────────────────────
// Registrada antes de "/:id": si no, Express toma "reporte" como el id y
// Prisma truena con un entero inválido (NaN).
const ColsIncidencias: ColDef[] = [
  { titulo: "FOLIO", ancho: 8, align: "center" },
  { titulo: "PANTEÓN", ancho: 26, align: "left" },
  { titulo: "FECHA", ancho: 12, align: "center" },
  { titulo: "TIPO DE INCIDENCIA", ancho: 20, align: "left" },
  { titulo: "DESCRIPCIÓN DE LO OCURRIDO", ancho: 45, align: "left" },
  { titulo: "SECCIÓN", ancho: 16, align: "center" },
  { titulo: "MANZANA", ancho: 11, align: "center" },
  { titulo: "LOTE", ancho: 10, align: "center" },
  { titulo: "REPORTADO POR", ancho: 22, align: "left" },
  { titulo: "ESTADO", ancho: 13, align: "center" },
  { titulo: "FECHA DE ATENCIÓN", ancho: 13, align: "center" },
  { titulo: "ATENDIÓ", ancho: 22, align: "left" },
  { titulo: "RESOLUCIÓN", ancho: 35, align: "left" },
];

const ETIQUETA_ESTADO: Record<string, string> = { REPORTADA: "Reportada", EN_PROCESO: "En proceso", ATENDIDA: "Atendida" };
const COLOR_ESTADO: Record<string, string> = { ATENDIDA: "FF157347", EN_PROCESO: "FF8A6207", REPORTADA: "FFB02A37" };

function subtituloIncidencias(estado?: string, tipo?: string, desde?: string, hasta?: string): string {
  const partes: string[] = [];
  if (desde || hasta) partes.push(`Del ${desde ?? "inicio"} al ${hasta ?? "hoy"}`);
  if (estado) partes.push(ETIQUETA_ESTADO[estado] ?? estado);
  if (tipo) partes.push(tipo);
  return partes.length > 0 ? partes.join("  ·  ") : "Todos los registros";
}

incidenciasRouter.get(
  "/reporte",
  asyncHandler(async (req, res) => {
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const estado = str(req.query.estado);
    const tipo = str(req.query.tipo);
    const desde = str(req.query.desde);
    const hasta = str(req.query.hasta);

    const where = filtrar(panteonId, estado, tipo, undefined);
    if (desde) where.fechaIncidencia = { ...((where.fechaIncidencia as object) ?? {}), gte: new Date(`${desde}T00:00:00.000Z`) };
    if (hasta) where.fechaIncidencia = { ...((where.fechaIncidencia as object) ?? {}), lte: new Date(`${hasta}T23:59:59.999Z`) };

    const lista = await prisma.incidencia.findMany({
      where,
      include: { panteon: true },
      orderBy: [{ panteon: { nombre: "asc" } }, { fechaIncidencia: "asc" }],
    });

    const subtitulo = subtituloIncidencias(estado, tipo, desde, hasta);
    const wb = new ExcelJS.Workbook();
    const ws = prepararHoja(wb, "Incidencias", ColsIncidencias, "REPORTE DE INCIDENCIAS EN PANTEONES", "Registro de hechos reportados y su atención", subtitulo, lista.length);

    let r = 7;
    let i = 1;
    for (const it of lista) {
      ws.getCell(r, 1).value = it.incidenciaId;
      ws.getCell(r, 2).value = it.panteon.nombre;
      escribirFecha(ws.getCell(r, 3), it.fechaIncidencia);
      ws.getCell(r, 4).value = it.tipo;
      ws.getCell(r, 5).value = it.descripcion;
      ws.getCell(r, 6).value = it.seccion ?? "";
      ws.getCell(r, 7).value = it.numeroManzana ?? "";
      ws.getCell(r, 8).value = it.numeroLote ?? "";
      ws.getCell(r, 9).value = it.reportadoPor ?? "";
      ws.getCell(r, 10).value = ETIQUETA_ESTADO[it.estado] ?? it.estado;
      escribirFecha(ws.getCell(r, 11), it.fechaAtencion);
      ws.getCell(r, 12).value = it.atendidoPor ?? "";
      ws.getCell(r, 13).value = it.resolucion ?? "";

      ws.getCell(r, 5).alignment = { wrapText: true };
      ws.getCell(r, 13).alignment = { wrapText: true };

      // Las pendientes saltan a la vista: es lo que el departamento persigue.
      ws.getCell(r, 10).font = { bold: true, color: { argb: COLOR_ESTADO[it.estado] ?? COLOR_ESTADO.REPORTADA } };

      // Sin manzana ni lote es una incidencia de área general.
      if (!it.numeroManzana?.trim() && !it.numeroLote?.trim()) {
        ws.getCell(r, 7).value = "—";
        ws.getCell(r, 8).value = "—";
        ws.getCell(r, 7).font = { color: { argb: "FF999999" } };
        ws.getCell(r, 8).font = { color: { argb: "FF999999" } };
      }

      if (i % 2 === 0) {
        for (let c = 1; c <= ColsIncidencias.length; c++) {
          ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3F4" } };
        }
      }
      r++;
      i++;
    }

    cerrarHoja(ws, ColsIncidencias, lista.length, r);

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Imprimir, "incidencias", undefined, `Reporte de incidencias — ${lista.length} registro(s)`, req.ip);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Incidencias_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);

incidenciasRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const incidencia = await prisma.incidencia.findUnique({
      where: { incidenciaId: Number(req.params.id) },
      include: { panteon: true, lote: true },
    });
    if (!incidencia) return res.status(404).json({ error: "No encontrada" });
    res.json({ incidencia });
  })
);

incidenciasRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.incidencia.findUnique({ where: { incidenciaId: id } });
    if (!existente) return res.status(404).json({ error: "No encontrada" });

    const parseo = incidenciaSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;
    const ubicacion = await asignarUbicacion(vm.loteId, vm.seccion, vm.numeroManzana, vm.numeroLote);

    const actualizada = await prisma.incidencia.update({
      where: { incidenciaId: id },
      data: {
        panteonId: vm.panteonId,
        loteId: ubicacion.loteId,
        seccion: ubicacion.seccion,
        numeroManzana: ubicacion.numeroManzana,
        numeroLote: ubicacion.numeroLote,
        tipo: vm.tipo.trim(),
        descripcion: vm.descripcion.trim(),
        fechaIncidencia: vm.fechaIncidencia,
        reportadoPor: vm.reportadoPor?.trim(),
      },
    });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "incidencias", id, `Incidencia ${id} actualizada`, req.ip);

    res.json({ incidencia: actualizada });
  })
);

const atenderSchema = z.object({
  estado: z.enum(ESTADOS_INCIDENCIA),
  atendidoPor: z.string().optional(),
  resolucion: z.string().optional(),
});

incidenciasRouter.patch(
  "/:id/atender",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.incidencia.findUnique({ where: { incidenciaId: id } });
    if (!existente) return res.status(404).json({ error: "No encontrada" });

    const parseo = atenderSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: "Estado no válido." });
    const { estado, atendidoPor, resolucion } = parseo.data;

    const etiqueta = { REPORTADA: "Reportada", EN_PROCESO: "En proceso", ATENDIDA: "Atendida" }[estado];

    const actualizada = await prisma.incidencia.update({
      where: { incidenciaId: id },
      data: {
        estado,
        atendidoPor: atendidoPor?.trim(),
        resolucion: resolucion?.trim(),
        // La fecha de atención solo tiene sentido cuando ya quedó resuelta.
        fechaAtencion: estado === "ATENDIDA" ? new Date(new Date().toDateString()) : null,
      },
    });

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Editar,
      "incidencias",
      id,
      `Incidencia ${id} marcada como ${etiqueta}`,
      req.ip
    );

    res.json({ incidencia: actualizada });
  })
);

incidenciasRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.incidencia.findUnique({ where: { incidenciaId: id } });
    if (!existente) return res.status(404).json({ error: "No encontrada" });

    await prisma.incidencia.delete({ where: { incidenciaId: id } });

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Eliminar,
      "incidencias",
      id,
      `Incidencia ${id} eliminada (${existente.tipo})`,
      req.ip
    );

    res.json({ ok: true });
  })
);

