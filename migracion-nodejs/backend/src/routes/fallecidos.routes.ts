import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

export const fallecidosRouter = Router();
fallecidosRouter.use(requiereAuth);

// Difuntos ya registrados, para enlazarlos en un permiso nuevo en vez de
// duplicarlos. Busca por nombre, posible nombre, número de acta o número de
// caso -- exactamente los mismos campos que PermisosController.BuscarFallecido.
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

    const conteos = await prisma.permiso.groupBy({
      by: ["fallecidoId"],
      where: { fallecidoId: { in: resultados.map((f) => f.fallecidoId) } },
      _count: true,
    });
    const tienenPermiso = new Set(conteos.map((c) => c.fallecidoId));

    res.json(
      resultados.map((f) => ({
        fallecidoId: f.fallecidoId,
        nombre: f.nombreCompleto,
        fecha: f.fechaFallecimiento,
        acta: f.actaDefuncionNumero,
        numeroCaso: f.numeroCaso,
        esNoReclamado: f.esNoReclamado,
        yaTienePermiso: tienenPermiso.has(f.fallecidoId),
      }))
    );
  })
);
