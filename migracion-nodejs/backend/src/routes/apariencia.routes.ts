import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { obtenerLogosBuffer } from "../lib/apariencia";

// Sin requiereAuth: la pantalla de login también necesita el color y logo
// vigentes antes de que exista sesión. No expone información sensible.
export const aparienciaRouter = Router();

const POR_DEFECTO = { colorGuinda: "#6b1229", colorDorado: "#f5b400", nombreSindico: "MAESTRA EDNA ELINORA SOTO GRACIA" };

aparienciaRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const config = await prisma.configuracionApariencia.findUnique({ where: { id: 1 } });
    res.json(
      config
        ? { colorGuinda: config.colorGuinda, colorDorado: config.colorDorado, nombreSindico: config.nombreSindico }
        : POR_DEFECTO
    );
  })
);

aparienciaRouter.get(
  "/logo/:cual",
  asyncHandler(async (req, res) => {
    if (req.params.cual !== "nogales" && req.params.cual !== "frontera") {
      return res.status(404).json({ error: "Logo no reconocido" });
    }
    const logos = await obtenerLogosBuffer();
    const bytes = req.params.cual === "nogales" ? logos.nogales : logos.frontera;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    res.send(bytes);
  })
);
