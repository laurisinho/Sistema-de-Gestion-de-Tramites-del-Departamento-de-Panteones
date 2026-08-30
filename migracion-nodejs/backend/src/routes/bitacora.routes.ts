import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

export const bitacoraRouter = Router();
bitacoraRouter.use(requiereAuth);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

bitacoraRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const accion = str(req.query.accion);
    const usuarioId = req.query.usuarioId ? Number(req.query.usuarioId) : undefined;
    const desde = str(req.query.desde);
    const hasta = str(req.query.hasta);

    const where: Prisma.BitacoraWhereInput = {};
    if (q) {
      where.OR = [
        { descripcion: { contains: q, mode: "insensitive" } },
        { tabla: { contains: q, mode: "insensitive" } },
      ];
    }
    if (accion) where.accion = accion;
    if (usuarioId) where.usuarioId = usuarioId;
    if (desde || hasta) {
      where.fechaHora = {};
      if (desde) where.fechaHora.gte = new Date(`${desde}T00:00:00.000Z`);
      if (hasta) where.fechaHora.lte = new Date(`${hasta}T23:59:59.999Z`);
    }

    const registros = await prisma.bitacora.findMany({
      where,
      include: { usuario: { select: { usuarioId: true, nombreCompleto: true, nombreUsuario: true } } },
      orderBy: { fechaHora: "desc" },
      take: 250,
    });

    // Ancladas en UTC para coincidir con los filtros desde/hasta de arriba
    // (también en UTC): si no, "Hoy" en las tarjetas y filtrar Desde=Hasta=hoy
    // podían dar totales distintos según el huso horario del servidor.
    const ahora2 = new Date();
    const hoy = new Date(Date.UTC(ahora2.getUTCFullYear(), ahora2.getUTCMonth(), ahora2.getUTCDate()));
    const iniSemana = new Date(hoy);
    iniSemana.setUTCDate(iniSemana.getUTCDate() - 6);
    const ini14 = new Date(hoy);
    ini14.setUTCDate(ini14.getUTCDate() - 13);

    const [total, deHoy, deSemana, usuariosDistintos, actividad14, acciones, listaUsuarios] = await Promise.all([
      prisma.bitacora.count(),
      prisma.bitacora.count({ where: { fechaHora: { gte: hoy } } }),
      prisma.bitacora.count({ where: { fechaHora: { gte: iniSemana } } }),
      prisma.bitacora.findMany({ where: { usuarioId: { not: null } }, select: { usuarioId: true }, distinct: ["usuarioId"] }),
      prisma.bitacora.findMany({ where: { fechaHora: { gte: ini14 } }, select: { fechaHora: true } }),
      prisma.bitacora.findMany({ select: { accion: true }, distinct: ["accion"] }),
      prisma.usuario.findMany({ orderBy: { nombreCompleto: "asc" }, select: { usuarioId: true, nombreCompleto: true } }),
    ]);

    // Gráfica de actividad de los últimos 14 días.
    const conteoPorDia = new Map<string, number>();
    for (const r of actividad14) {
      const clave = r.fechaHora.toISOString().slice(0, 10);
      conteoPorDia.set(clave, (conteoPorDia.get(clave) ?? 0) + 1);
    }
    const grafica = [];
    for (let k = 0; k < 14; k++) {
      const d = new Date(ini14);
      d.setUTCDate(d.getUTCDate() + k);
      const clave = d.toISOString().slice(0, 10);
      grafica.push({
        etiqueta: d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
        valor: conteoPorDia.get(clave) ?? 0,
      });
    }

    res.json({
      registros,
      estadisticas: { total, hoy: deHoy, semana: deSemana, usuarios: usuariosDistintos.length },
      grafica,
      acciones: acciones.map((a) => a.accion).sort(),
      listaUsuarios,
      filtros: { q: q ?? null, accion: accion ?? null, usuarioId: usuarioId ?? null, desde: desde ?? null, hasta: hasta ?? null },
    });
  })
);
