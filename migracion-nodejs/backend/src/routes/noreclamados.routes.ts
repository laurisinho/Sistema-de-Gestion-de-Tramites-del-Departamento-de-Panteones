import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import ExcelJS from "exceljs";
import { prepararHoja, cerrarHoja, escribirFecha, fechaHoraTexto, GUINDA, type ColDef } from "../lib/excel";

export const noReclamadosRouter = Router();
noReclamadosRouter.use(requiereAuth);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function fechaCortaLocal(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// Mismo cálculo de periodo (trimestre / año / rango libre) usado por
// AplicarPeriodo en el .NET original, generalizado para reusarse en ambos
// reportes (Fallecidos filtra por fecha de fallecimiento, Reconocimientos por
// fecha de reconocimiento).
function calcularPeriodo(
  desde?: string,
  hasta?: string,
  anio?: number,
  trimestre?: number
): { rango?: { gte?: Date; lte?: Date }; subtitulo: string } {
  if (anio && trimestre && trimestre >= 1 && trimestre <= 4) {
    const ini = new Date(Date.UTC(anio, (trimestre - 1) * 3, 1));
    const fin = new Date(Date.UTC(anio, (trimestre - 1) * 3 + 3, 0));
    return { rango: { gte: ini, lte: fin }, subtitulo: `${anio} · ${trimestre}º Trimestre (${fechaCortaLocal(ini)} al ${fechaCortaLocal(fin)})` };
  }
  if (anio) {
    return { rango: { gte: new Date(Date.UTC(anio, 0, 1)), lte: new Date(Date.UTC(anio, 11, 31)) }, subtitulo: `Ejercicio ${anio}` };
  }
  if (desde || hasta) {
    const rango: { gte?: Date; lte?: Date } = {};
    if (desde) rango.gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) rango.lte = new Date(`${hasta}T23:59:59.999Z`);
    const desdeTxt = desde ? fechaCortaLocal(new Date(`${desde}T00:00:00Z`)) : "inicio";
    const hastaTxt = hasta ? fechaCortaLocal(new Date(`${hasta}T00:00:00Z`)) : "hoy";
    return { rango, subtitulo: `Del ${desdeTxt} al ${hastaTxt}` };
  }
  return { subtitulo: "Todos los registros" };
}

// ── LISTADO + BÚSQUEDA ──────────────────────────────────────
noReclamadosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);

    const lista = await prisma.fallecido.findMany({
      where: {
        esNoReclamado: true,
        ...(q
          ? {
              OR: [
                { nombreCompleto: { contains: q, mode: "insensitive" } },
                { posibleNombre: { contains: q, mode: "insensitive" } },
                { numeroCaso: { contains: q, mode: "insensitive" } },
                { actaDefuncionNumero: { contains: q } },
                { actaDefuncionFolio: { contains: q } },
                { descripcionHallazgo: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { fechaFallecimiento: "desc" },
      take: 300,
    });

    const total = await prisma.fallecido.count({ where: { esNoReclamado: true } });

    res.json({ lista, total, q: q ?? null });
  })
);

// Agentes del M.P. ya capturados, para sugerirlos en el formulario.
noReclamadosRouter.get(
  "/ministerios-publicos",
  asyncHandler(async (_req, res) => {
    const filas = await prisma.fallecido.findMany({
      where: { ministerioPublico: { not: null } },
      select: { ministerioPublico: true },
      distinct: ["ministerioPublico"],
    });
    const lista = filas
      .map((f) => f.ministerioPublico!)
      .filter((m) => m.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
    res.json(lista);
  })
);

// El lote donde está sepultada la persona: el permiso de sepultura más
// antiguo con lote asignado. Puerto exacto de UbicacionDe / la búsqueda de
// lote usada en Reconocer.
async function primerLoteDe(fallecidoId: number) {
  const permiso = await prisma.permiso.findFirst({
    where: { fallecidoId, loteId: { not: null } },
    include: { lote: { include: { panteon: true } } },
    orderBy: { permisoId: "asc" },
  });
  return permiso?.lote ?? null;
}

function ubicacionTexto(lote: { panteon: { nombre: string }; seccion: string | null; numeroManzana: string; numeroLote: string }): string {
  return [lote.panteon.nombre, lote.seccion ? `Secc. ${lote.seccion}` : null, `Mz ${lote.numeroManzana}`, `Lote ${lote.numeroLote}`]
    .filter((x): x is string => !!x)
    .join(" · ");
}

// ── DETALLE ─────────────────────────────────────────────────
noReclamadosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const f = await prisma.fallecido.findFirst({ where: { fallecidoId: id, esNoReclamado: true } });
    if (!f) return res.status(404).json({ error: "No encontrado" });

    const lote = await primerLoteDe(id);
    const ultimoReconocimiento = await prisma.reconocimiento.findFirst({
      where: { fallecidoId: id },
      orderBy: { fechaReconocimiento: "desc" },
    });

    res.json({
      fallecido: f,
      ubicacion: lote ? ubicacionTexto(lote) : null,
      reconocimiento: ultimoReconocimiento,
    });
  })
);

// ── RECONOCER (desconocido -> identificado) ────────────────
// Solo actualiza la identidad de la persona. El lote se libera hasta que se
// aprueba el permiso de exhumación.
noReclamadosRouter.get(
  "/:id/reconocer",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const f = await prisma.fallecido.findFirst({ where: { fallecidoId: id, esNoReclamado: true } });
    if (!f) return res.status(404).json({ error: "No encontrado" });

    if (f.reconocido) {
      return res.status(409).json({ error: "Esta persona ya está registrada como identificada." });
    }

    const lote = await primerLoteDe(id);

    res.json({
      fallecidoId: f.fallecidoId,
      nombreAnterior: f.nombreCompleto,
      nombreIdentificado: f.posibleNombre ?? "",
      numeroCasoActual: f.numeroCaso,
      numeroCaso: f.numeroCaso,
      numeroActaDefuncion: f.actaDefuncionNumero,
      ministerioPublico: f.ministerioPublico,
      fechaReconocimiento: new Date(new Date().toDateString()),
      ubicacion: lote ? ubicacionTexto(lote) : null,
    });
  })
);

const fechaISO = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
  .transform((s) => new Date(s));

const reconocerSchema = z.object({
  nombreIdentificado: z.string().min(1, "Escriba el nombre con el que fue identificada la persona."),
  fechaReconocimiento: fechaISO,
  medioIdentificacion: z.string().min(1, "Indique cómo se identificó a la persona."),
  instanciaSolicita: z.string().optional(),
  numeroActaDefuncion: z.string().optional(),
  ministerioPublico: z.string().optional(),
  numeroCaso: z.string().optional(),
  observaciones: z.string().optional(),
});

noReclamadosRouter.post(
  "/:id/reconocer",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const f = await prisma.fallecido.findFirst({ where: { fallecidoId: id, esNoReclamado: true } });
    if (!f) return res.status(404).json({ error: "No encontrado" });
    if (f.reconocido) {
      return res.status(409).json({ error: "Esta persona ya está registrada como identificada." });
    }

    const parseo = reconocerSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;
    const usuarioId = req.usuario!.usuarioId;

    const lote = await primerLoteDe(id);

    const reconocimiento = await prisma.reconocimiento.create({
      data: {
        fallecidoId: f.fallecidoId,
        loteId: lote?.loteId,
        nombreAnterior: f.nombreCompleto,
        nombreIdentificado: vm.nombreIdentificado.trim(),
        fechaReconocimiento: vm.fechaReconocimiento,
        medioIdentificacion: vm.medioIdentificacion.trim(),
        instanciaSolicita: vm.instanciaSolicita?.trim(),
        numeroActaDefuncion: vm.numeroActaDefuncion?.trim(),
        ministerioPublico: vm.ministerioPublico?.trim(),
        observaciones: vm.observaciones?.trim(),
        usuarioRegistroId: usuarioId,
      },
    });

    await prisma.fallecido.update({
      where: { fallecidoId: f.fallecidoId },
      data: {
        reconocido: true,
        posibleNombre: vm.nombreIdentificado.trim(),
        numeroCaso: vm.numeroCaso?.trim() || f.numeroCaso,
        actaDefuncionNumero: vm.numeroActaDefuncion?.trim() || f.actaDefuncionNumero,
      },
    });

    await registrarBitacora(
      usuarioId,
      Acciones.Reconocer,
      "fallecidos",
      f.fallecidoId,
      `Identificada: «${f.nombreCompleto}» → ${vm.nombreIdentificado}`,
      req.ip
    );

    res.status(201).json({
      reconocimientoId: reconocimiento.reconocimientoId,
      mensaje: lote
        ? `«${f.nombreCompleto}» quedó registrada como ${vm.nombreIdentificado}. El lote se liberará al aprobar el permiso de exhumación.`
        : `«${f.nombreCompleto}» quedó registrada como ${vm.nombreIdentificado}. Nota: no tiene lote asignado, falta capturarle el permiso de inhumación.`,
    });
  })
);

// ── RELACIÓN DE RECONOCIDOS ─────────────────────────────────
noReclamadosRouter.get(
  "/reportes/reconocidos",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const anio = req.query.anio ? Number(req.query.anio) : undefined;
    const trimestre = req.query.trimestre ? Number(req.query.trimestre) : undefined;

    let rangoFecha: { gte?: Date; lte?: Date } | undefined;
    if (anio && trimestre && trimestre >= 1 && trimestre <= 4) {
      const ini = new Date(Date.UTC(anio, (trimestre - 1) * 3, 1));
      const fin = new Date(Date.UTC(anio, (trimestre - 1) * 3 + 3, 0));
      rangoFecha = { gte: ini, lte: fin };
    } else if (anio) {
      rangoFecha = { gte: new Date(Date.UTC(anio, 0, 1)), lte: new Date(Date.UTC(anio, 11, 31)) };
    }

    const lista = await prisma.reconocimiento.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { nombreIdentificado: { contains: q, mode: "insensitive" } },
                { nombreAnterior: { contains: q, mode: "insensitive" } },
                { medioIdentificacion: { contains: q, mode: "insensitive" } },
                { instanciaSolicita: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(rangoFecha ? { fechaReconocimiento: rangoFecha } : {}),
      },
      include: {
        fallecido: true,
        lote: { include: { panteon: true } },
        permisoExhumacion: true,
      },
      orderBy: { fechaReconocimiento: "desc" },
    });

    const total = await prisma.reconocimiento.count();
    const conExhumacion = lista.filter((r) => r.permisoExhumacionId !== null).length;

    const anios = await prisma.reconocimiento.findMany({
      where: { fechaReconocimiento: { not: null } },
      select: { fechaReconocimiento: true },
      distinct: ["fechaReconocimiento"],
    });
    const aniosDisponibles = [...new Set(anios.map((r) => r.fechaReconocimiento!.getUTCFullYear()))].sort(
      (a, b) => b - a
    );

    res.json({ lista, total, conExhumacion, anios: aniosDisponibles, q: q ?? null, anio: anio ?? null, trimestre: trimestre ?? null });
  })
);

// ── CREAR ───────────────────────────────────────────────────
const noReclamadoSchema = z.object({
  nombreCompleto: z.string().min(1, "El nombre o descripción es obligatorio.").default("PERSONA DESCONOCIDA"),
  posibleNombre: z.string().optional(),
  numeroCaso: z.string().optional(),
  fechaFallecimiento: fechaISO.optional(),
  horaFallecimiento: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida")
    .optional(),
  fechaLevantamiento: fechaISO.optional(),
  lugarLevantamiento: z.string().optional(),
  ministerioPublico: z.string().optional(),
  actaDefuncionNumero: z.string().optional(),
  actaDefuncionFolio: z.string().optional(),
  actaDefuncionFecha: fechaISO.optional(),
  causaFallecimiento: z.string().optional(),
  descripcionHallazgo: z.string().optional(),
});

noReclamadosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = noReclamadoSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    const f = await prisma.fallecido.create({
      data: {
        nombreCompleto: vm.nombreCompleto.trim(),
        posibleNombre: vm.posibleNombre,
        numeroCaso: vm.numeroCaso,
        fechaFallecimiento: vm.fechaFallecimiento,
        horaFallecimiento: vm.horaFallecimiento ? new Date(`1970-01-01T${vm.horaFallecimiento}`) : undefined,
        fechaLevantamiento: vm.fechaLevantamiento,
        lugarLevantamiento: vm.lugarLevantamiento?.trim(),
        ministerioPublico: vm.ministerioPublico?.trim(),
        actaDefuncionNumero: vm.actaDefuncionNumero,
        actaDefuncionFolio: vm.actaDefuncionFolio,
        actaDefuncionFecha: vm.actaDefuncionFecha,
        causaFallecimiento: vm.causaFallecimiento,
        descripcionHallazgo: vm.descripcionHallazgo,
        esNoReclamado: true,
      },
    });

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Crear,
      "fallecidos",
      f.fallecidoId,
      `No reclamado registrado: ${f.nombreCompleto}`,
      req.ip
    );

    res.status(201).json({ fallecidoId: f.fallecidoId });
  })
);

// ── EDITAR ──────────────────────────────────────────────────
noReclamadosRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const f = await prisma.fallecido.findFirst({ where: { fallecidoId: id, esNoReclamado: true } });
    if (!f) return res.status(404).json({ error: "No encontrado" });

    const parseo = noReclamadoSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    const actualizado = await prisma.fallecido.update({
      where: { fallecidoId: id },
      data: {
        nombreCompleto: vm.nombreCompleto.trim(),
        posibleNombre: vm.posibleNombre,
        numeroCaso: vm.numeroCaso,
        fechaFallecimiento: vm.fechaFallecimiento,
        horaFallecimiento: vm.horaFallecimiento ? new Date(`1970-01-01T${vm.horaFallecimiento}`) : undefined,
        fechaLevantamiento: vm.fechaLevantamiento,
        lugarLevantamiento: vm.lugarLevantamiento?.trim(),
        ministerioPublico: vm.ministerioPublico?.trim(),
        actaDefuncionNumero: vm.actaDefuncionNumero,
        actaDefuncionFolio: vm.actaDefuncionFolio,
        actaDefuncionFecha: vm.actaDefuncionFecha,
        causaFallecimiento: vm.causaFallecimiento,
        descripcionHallazgo: vm.descripcionHallazgo,
      },
    });

    res.json({ fallecido: actualizado });
  })
);

// ── ELIMINAR ────────────────────────────────────────────────
noReclamadosRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const f = await prisma.fallecido.findFirst({ where: { fallecidoId: id, esNoReclamado: true } });
    if (!f) return res.status(404).json({ error: "No encontrado" });

    const tienePermiso = await prisma.permiso.findFirst({ where: { fallecidoId: id } });
    if (tienePermiso) {
      return res.status(409).json({ error: "No se puede eliminar: el registro está vinculado a un permiso." });
    }

    // El original en .NET solo validaba permisos y no esto -- un no reclamado ya
    // reconocido (con Reconocimiento) truena con una violación de llave foránea
    // sin control al intentar borrarlo. Se detecta antes en vez de heredar el bug.
    const tieneReconocimiento = await prisma.reconocimiento.findFirst({ where: { fallecidoId: id } });
    if (tieneReconocimiento) {
      return res.status(409).json({ error: "No se puede eliminar: el registro ya tiene una identificación registrada." });
    }

    await prisma.fallecido.delete({ where: { fallecidoId: id } });

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Eliminar,
      "fallecidos",
      id,
      `No reclamado eliminado: ${f.nombreCompleto}`,
      req.ip
    );

    res.json({ ok: true });
  })
);

// ── REPORTE A: SEPULTADAS EN FOSAS COMUNES (Excel) ─────────
const ColsSepultados: ColDef[] = [
  { titulo: "CLAVE", ancho: 18, align: "left" },
  { titulo: "INSTANCIA QUE SOLICITA SEPULTAR", ancho: 32, align: "left" },
  { titulo: "FECHA DE SOLICITUD", ancho: 13, align: "center" },
  { titulo: "NOMBRE DEL DIFUNTO", ancho: 30, align: "left" },
  { titulo: "NÚMERO ÚNICO DE CASO", ancho: 24, align: "center" },
  { titulo: "NÚMERO DE ACTA DE DEFUNCIÓN", ancho: 14, align: "center" },
  { titulo: "FECHA DE FALLECIMIENTO Y HORA", ancho: 18, align: "center" },
  { titulo: "FECHA DE LEVANTAMIENTO DEL CADÁVER", ancho: 17, align: "center" },
  { titulo: "LUGAR DE LEVANTAMIENTO", ancho: 24, align: "left" },
  { titulo: "SECCIÓN", ancho: 20, align: "left" },
  { titulo: "MANZANA", ancho: 9, align: "center" },
  { titulo: "LOTE", ancho: 7, align: "center" },
  { titulo: "OBSERVACIONES", ancho: 58, align: "left" },
  { titulo: "MINISTERIO PÚBLICO QUE TURNÓ EL CASO", ancho: 30, align: "left" },
];

noReclamadosRouter.get(
  "/reportes/sepultados",
  asyncHandler(async (req, res) => {
    const { rango, subtitulo } = calcularPeriodo(str(req.query.desde), str(req.query.hasta), req.query.anio ? Number(req.query.anio) : undefined, req.query.trimestre ? Number(req.query.trimestre) : undefined);

    const fallecidos = await prisma.fallecido.findMany({
      where: { esNoReclamado: true, ...(rango ? { fechaFallecimiento: rango } : {}) },
      orderBy: { fechaFallecimiento: "asc" },
    });

    // Permiso de sepultura de cada uno: aporta lote, folio e instancia. Solo
    // el primero por difunto (igual que mapPermiso.GroupBy(...).First()).
    const ids = fallecidos.map((f) => f.fallecidoId);
    const permisos = await prisma.permiso.findMany({
      where: { fallecidoId: { in: ids }, loteId: { not: null } },
      include: { lote: { include: { panteon: true } } },
      orderBy: { permisoId: "asc" },
    });
    const mapPermiso = new Map<number, (typeof permisos)[number]>();
    for (const p of permisos) {
      if (p.fallecidoId != null && !mapPermiso.has(p.fallecidoId)) mapPermiso.set(p.fallecidoId, p);
    }

    const wb = new ExcelJS.Workbook();
    const ws = prepararHoja(wb, "No Reclamados", ColsSepultados, "RELACIÓN DE PERSONAS NO RECLAMADAS", "Sepultadas en fosas comunes", subtitulo, fallecidos.length);

    let r = 7;
    let i = 1;
    for (const f of fallecidos) {
      const p = mapPermiso.get(f.fallecidoId);
      const lote = p?.lote;

      ws.getCell(r, 1).value = lote?.claveLegado ?? "";
      ws.getCell(r, 2).value = p?.instanciaSolicita ?? p?.funeraria ?? "";
      escribirFecha(ws.getCell(r, 3), p?.fechaSolicitud);
      ws.getCell(r, 4).value = f.nombreCompleto;
      ws.getCell(r, 5).value = f.numeroCaso ?? "";
      ws.getCell(r, 6).value = f.actaDefuncionNumero ?? "";
      ws.getCell(r, 7).value = fechaHoraTexto(f.fechaFallecimiento, f.horaFallecimiento);
      escribirFecha(ws.getCell(r, 8), f.fechaLevantamiento);
      ws.getCell(r, 9).value = f.lugarLevantamiento ?? "";
      ws.getCell(r, 10).value = lote?.seccion ?? "";
      ws.getCell(r, 11).value = lote?.numeroManzana ?? "";
      ws.getCell(r, 12).value = lote?.numeroLote ?? "";
      ws.getCell(r, 13).value = f.descripcionHallazgo ?? "";
      ws.getCell(r, 14).value = f.ministerioPublico ?? "";

      ws.getCell(r, 13).alignment = { wrapText: true };
      ws.getCell(r, 2).alignment = { wrapText: true };
      if (f.numeroCaso?.trim()) {
        ws.getCell(r, 5).font = { bold: true, color: { argb: `FF${GUINDA}` } };
      }
      if (i % 2 === 0) {
        for (let c = 1; c <= ColsSepultados.length; c++) {
          ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3F4" } };
        }
      }
      r++;
      i++;
    }

    cerrarHoja(ws, ColsSepultados, fallecidos.length, r);

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Imprimir, "fallecidos", undefined, `Reporte de no reclamadas sepultadas (${subtitulo}) — ${fallecidos.length} registro(s)`, req.ip);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="PersonasNoReclamadas_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);

// ── REPORTE B: IDENTIFICADAS Y EXHUMADAS (Excel) ───────────
const ColsIdentificados: ColDef[] = [
  { titulo: "CLAVE", ancho: 18, align: "left" },
  { titulo: "INSTANCIA QUE SOLICITA EXHUMAR", ancho: 34, align: "left" },
  { titulo: "FECHA DE SOLICITUD", ancho: 13, align: "center" },
  { titulo: "NOMBRE DEL DIFUNTO IDENTIFICADO", ancho: 32, align: "left" },
  { titulo: "NÚMERO ÚNICO DE CASO", ancho: 24, align: "center" },
  { titulo: "NÚMERO DE ACTA DE DEFUNCIÓN", ancho: 14, align: "center" },
  { titulo: "SECCIÓN DE EXHUMACIÓN", ancho: 22, align: "left" },
  { titulo: "MANZANA", ancho: 9, align: "center" },
  { titulo: "LOTE", ancho: 7, align: "center" },
  { titulo: "OBSERVACIONES", ancho: 50, align: "left" },
  { titulo: "MINISTERIO PÚBLICO QUE TURNÓ EL CASO", ancho: 30, align: "left" },
];

noReclamadosRouter.get(
  "/reportes/identificados",
  asyncHandler(async (req, res) => {
    const { rango, subtitulo } = calcularPeriodo(str(req.query.desde), str(req.query.hasta), req.query.anio ? Number(req.query.anio) : undefined, req.query.trimestre ? Number(req.query.trimestre) : undefined);

    const recs = await prisma.reconocimiento.findMany({
      where: rango ? { fechaReconocimiento: rango } : {},
      include: { lote: true, fallecido: true },
      orderBy: { fechaReconocimiento: "asc" },
    });

    const wb = new ExcelJS.Workbook();
    const ws = prepararHoja(wb, "Identificadas", ColsIdentificados, "RELACIÓN DE PERSONAS NO RECLAMADAS", "Que fueron identificadas y exhumadas", subtitulo, recs.length);

    let r = 7;
    let i = 1;
    for (const rec of recs) {
      ws.getCell(r, 1).value = rec.lote?.claveLegado ?? "";
      ws.getCell(r, 2).value = rec.instanciaSolicita ?? "";
      escribirFecha(ws.getCell(r, 3), rec.fechaReconocimiento);
      ws.getCell(r, 4).value = rec.nombreIdentificado;
      ws.getCell(r, 5).value = rec.fallecido?.numeroCaso ?? "";
      ws.getCell(r, 6).value = rec.numeroActaDefuncion ?? "";
      ws.getCell(r, 7).value = rec.lote?.seccion ?? "";
      ws.getCell(r, 8).value = rec.lote?.numeroManzana ?? "";
      ws.getCell(r, 9).value = rec.lote?.numeroLote ?? "";
      ws.getCell(r, 10).value = rec.medioIdentificacion ?? rec.observaciones ?? "";
      ws.getCell(r, 11).value = rec.ministerioPublico ?? "";

      ws.getCell(r, 10).alignment = { wrapText: true };
      ws.getCell(r, 2).alignment = { wrapText: true };
      ws.getCell(r, 4).font = { bold: true };
      if (rec.fallecido?.numeroCaso?.trim()) {
        ws.getCell(r, 5).font = { bold: true, color: { argb: `FF${GUINDA}` } };
      }
      if (i % 2 === 0) {
        for (let c = 1; c <= ColsIdentificados.length; c++) {
          ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3F4" } };
        }
      }
      r++;
      i++;
    }

    cerrarHoja(ws, ColsIdentificados, recs.length, r);

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Imprimir, "reconocimientos", undefined, `Reporte de identificadas y exhumadas (${subtitulo}) — ${recs.length} registro(s)`, req.ip);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Identificadas_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);
