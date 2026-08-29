import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { ESTADOS_INCIDENCIA, TIPOS_INCIDENCIA } from "./incidencias.routes";

export const catalogosRouter = Router();
catalogosRouter.use(requiereAuth);

catalogosRouter.get("/tipos-incidencia", (_req, res) => res.json(TIPOS_INCIDENCIA));
catalogosRouter.get("/estados-incidencia", (_req, res) => res.json(ESTADOS_INCIDENCIA));

catalogosRouter.get(
  "/panteones",
  asyncHandler(async (_req, res) => {
    const panteones = await prisma.panteon.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ panteones });
  })
);

catalogosRouter.get(
  "/tipos-lote",
  asyncHandler(async (_req, res) => {
    const tiposLote = await prisma.tipoLote.findMany({ orderBy: { nombre: "asc" } });
    res.json({ tiposLote });
  })
);

catalogosRouter.get(
  "/tipos-tramite",
  asyncHandler(async (_req, res) => {
    const tiposTramite = await prisma.tipoTramite.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ tiposTramite });
  })
);
