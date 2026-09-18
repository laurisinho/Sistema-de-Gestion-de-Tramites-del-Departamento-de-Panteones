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
  "/secciones",
  asyncHandler(async (req, res) => {
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;

    // Para dar de alta un lote nuevo: solo lo que Administración ya dio de
    // alta como sección válida de este panteón, sin mezclar con texto suelto
    // histórico (ver el punto medio acordado para Seccion en schema.prisma).
    if (req.query.soloCatalogo === "1") {
      const delCatalogo = await prisma.seccion.findMany({
        where: { activo: true, ...(panteonId ? { panteonId } : {}) },
        select: { nombre: true },
        orderBy: { nombre: "asc" },
      });
      return res.json({ secciones: delCatalogo.map((s) => s.nombre) });
    }

    const lotes = await prisma.lote.findMany({
      where: { seccion: { not: null }, ...(panteonId ? { panteonId } : {}) },
      select: { seccion: true },
      distinct: ["seccion"],
    });
    const delCatalogo = await prisma.seccion.findMany({
      where: { activo: true, ...(panteonId ? { panteonId } : {}) },
      select: { nombre: true },
    });

    // Unión de lo ya usado en lotes (histórico, incluye capturas sueltas que
    // nunca se formalizaron aquí) con el catálogo de Administración (permite
    // ofrecer una sección recién dada de alta aunque todavía no tenga ningún
    // lote). Lote.seccion sigue siendo texto libre -- ver Seccion en
    // schema.prisma -- así que ninguna de las dos fuentes es la "correcta"
    // por sí sola.
    const secciones = [...new Set([...lotes.map((l) => l.seccion as string), ...delCatalogo.map((s) => s.nombre)])];

    // "ANG" (Angelitos) se ofrece solo para buscar/filtrar, nunca para dar de
    // alta un lote nuevo (ver lib/ubicacion): por eso es un parámetro aparte
    // que cada pantalla pide a propósito, en vez de venir siempre incluido.
    if (req.query.incluirVirtuales === "1") {
      const hayAngelitos = await prisma.lote.count({
        where: { seccion: "ADEII", numeroManzana: { contains: "ANGEL", mode: "insensitive" }, ...(panteonId ? { panteonId } : {}) },
      });
      if (hayAngelitos > 0) secciones.push("ANG");
    }

    secciones.sort((a, b) => a.localeCompare(b));
    res.json({ secciones });
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

catalogosRouter.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    const roles = await prisma.rol.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ roles });
  })
);
