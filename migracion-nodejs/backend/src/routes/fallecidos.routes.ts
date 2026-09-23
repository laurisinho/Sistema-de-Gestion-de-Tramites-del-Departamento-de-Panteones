import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

export const fallecidosRouter = Router();
fallecidosRouter.use(requiereAuth);

// Difuntos ya registrados, para enlazarlos en un permiso nuevo en lugar de
// duplicarlos. Busca por nombre, posible nombre, número de acta o número de
// caso, los mismos campos que PermisosController.BuscarFallecido.
fallecidosRouter.get(
  "/buscar",
  asyncHandler(async (req, res) => {
    const termino = typeof req.query.termino === "string" ? req.query.termino.trim() : "";
    if (termino.length < 3) return res.json([]);

    const resultados = await prisma.fallecido.findMany({
      where: {
        OR: [
          { nombreCompleto: { contains: termino, mode: "insensitive" } },
          { posibleNombre: { contains: termino, mode: "insensitive" } },
          { actaDefuncionNumero: { contains: termino } },
          { numeroCaso: { contains: termino, mode: "insensitive" } },
        ],
      },
      orderBy: [{ esNoReclamado: "desc" }, { fallecidoId: "desc" }],
      take: 15,
    });

    const idsFallecidos = resultados.map((f) => f.fallecidoId);

    const conteos = await prisma.permiso.groupBy({
      by: ["fallecidoId"],
      where: { fallecidoId: { in: idsFallecidos } },
      _count: true,
    });
    const tienenPermiso = new Set(conteos.map((c) => c.fallecidoId));

    // Al buscar para una exhumación, el capturista suele encontrar al difunto
    // antes de haber elegido el lote: se manda dónde está sepultado hoy (si no
    // lo han exhumado ya) para que la pantalla lo enlace también, en el mismo
    // formato que /lotes/buscar.
    const [sepultados, exhumaciones] = await Promise.all([
      prisma.permiso.findMany({
        where: { fallecidoId: { in: idsFallecidos }, tipoTramite: { clave: "SEP" }, loteId: { not: null } },
        include: { lote: { include: { panteon: true, titulos: { where: { estado: "VIGENTE" }, include: { titular: true }, take: 1 } } } },
        orderBy: { permisoId: "asc" },
      }),
      prisma.permiso.findMany({
        where: { fallecidoId: { in: idsFallecidos }, tipoTramite: { clave: "EXH" } },
        select: { fallecidoId: true },
      }),
    ]);
    const yaExhumados = new Set(exhumaciones.map((p) => p.fallecidoId));

    const loteDeFallecido = new Map<number, object>();
    for (const p of sepultados) {
      const l = p.lote;
      if (!p.fallecidoId || !l || yaExhumados.has(p.fallecidoId) || loteDeFallecido.has(p.fallecidoId)) continue;
      loteDeFallecido.set(p.fallecidoId, {
        loteId: l.loteId,
        panteon: l.panteon.nombre,
        manzana: l.numeroManzana,
        lote: l.numeroLote,
        seccion: l.seccion,
        estado: l.estado,
        esFosaComun: l.esFosaComun,
        titular: l.titulos[0]?.titular.nombreCompleto ?? (l.esFosaComun ? "Fosa común — sin titular" : "Sin titular"),
        tieneTitulo: l.titulos.length > 0 || l.esFosaComun,
        colindanciaNorte: l.colindanciaNorte,
        colindanciaSur: l.colindanciaSur,
        colindanciaEste: l.colindanciaEste,
        colindanciaOeste: l.colindanciaOeste,
      });
    }

    res.json(
      resultados.map((f) => ({
        fallecidoId: f.fallecidoId,
        nombre: f.nombreCompleto,
        fecha: f.fechaFallecimiento,
        acta: f.actaDefuncionNumero,
        numeroCaso: f.numeroCaso,
        esNoReclamado: f.esNoReclamado,
        yaTienePermiso: tienenPermiso.has(f.fallecidoId),
        lote: loteDeFallecido.get(f.fallecidoId) ?? null,
      }))
    );
  })
);
