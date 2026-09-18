import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth, requiereRol } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";

// Alta y mantenimiento de los catálogos que antes solo se tocaban con
// scripts (seed.ts, separar-cipreses.ts): Panteones, Secciones y Agentes del
// Ministerio Público. Nada aquí se borra físicamente -- igual que Usuarios,
// solo activar/desactivar, para que el histórico (títulos, reportes) nunca
// se quede con una referencia rota.
export const administracionRouter = Router();
administracionRouter.use(requiereAuth, requiereRol("Administrador"));

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// ═══════════ PANTEONES ═══════════

administracionRouter.get(
  "/panteones",
  asyncHandler(async (_req, res) => {
    const panteones = await prisma.panteon.findMany({ orderBy: { nombre: "asc" } });
    res.json({ panteones });
  })
);

const panteonSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  clave: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  usaColindancias: z.boolean().optional().default(false),
});

administracionRouter.post(
  "/panteones",
  asyncHandler(async (req, res) => {
    const parseo = panteonSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    const vm = parseo.data;

    let panteon;
    try {
      panteon = await prisma.panteon.create({
        data: { nombre: vm.nombre, clave: str(vm.clave), direccion: str(vm.direccion), usaColindancias: vm.usaColindancias },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Ya existe un panteón con la clave "${vm.clave}".` });
      }
      throw err;
    }

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Crear, "panteones", panteon.panteonId, `Panteón "${panteon.nombre}" creado`, req.ip);
    res.status(201).json({ panteon });
  })
);

administracionRouter.put(
  "/panteones/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.panteon.findUnique({ where: { panteonId: id } });
    if (!existente) return res.status(404).json({ error: "Panteón no encontrado" });

    const parseo = panteonSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    const vm = parseo.data;

    let panteon;
    try {
      panteon = await prisma.panteon.update({
        where: { panteonId: id },
        data: { nombre: vm.nombre, clave: str(vm.clave), direccion: str(vm.direccion), usaColindancias: vm.usaColindancias },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Ya existe un panteón con la clave "${vm.clave}".` });
      }
      throw err;
    }

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "panteones", id, `Panteón "${panteon.nombre}" editado`, req.ip);
    res.json({ panteon });
  })
);

administracionRouter.post(
  "/panteones/:id/desactivar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.panteon.findUnique({ where: { panteonId: id } });
    if (!existente) return res.status(404).json({ error: "Panteón no encontrado" });

    await prisma.panteon.update({ where: { panteonId: id }, data: { activo: false } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Cancelar, "panteones", id, `Panteón "${existente.nombre}" desactivado`, req.ip);
    res.json({ ok: true });
  })
);

administracionRouter.post(
  "/panteones/:id/activar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.panteon.findUnique({ where: { panteonId: id } });
    if (!existente) return res.status(404).json({ error: "Panteón no encontrado" });

    await prisma.panteon.update({ where: { panteonId: id }, data: { activo: true } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "panteones", id, `Panteón "${existente.nombre}" reactivado`, req.ip);
    res.json({ ok: true });
  })
);

// ═══════════ SECCIONES ═══════════
// Catálogo por panteón (ver Seccion en schema.prisma). Solo alimenta las
// sugerencias / el selector al dar de alta un lote nuevo -- Lote.seccion
// sigue siendo el texto libre de siempre, así que nada de esto toca lotes
// ya existentes.

administracionRouter.get(
  "/secciones",
  asyncHandler(async (req, res) => {
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const secciones = await prisma.seccion.findMany({
      where: panteonId ? { panteonId } : {},
      include: { panteon: { select: { nombre: true } } },
      orderBy: [{ panteonId: "asc" }, { nombre: "asc" }],
    });
    res.json({ secciones });
  })
);

const nombreSeccionSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio.")
  .transform((v) => v.toUpperCase());

const nuevaSeccionSchema = z.object({
  panteonId: z.coerce.number().int({ message: "Selecciona un panteón." }),
  nombre: nombreSeccionSchema,
});

administracionRouter.post(
  "/secciones",
  asyncHandler(async (req, res) => {
    const parseo = nuevaSeccionSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    const vm = parseo.data;

    const panteon = await prisma.panteon.findUnique({ where: { panteonId: vm.panteonId } });
    if (!panteon) return res.status(400).json({ error: "El panteón seleccionado no existe." });

    let seccion;
    try {
      seccion = await prisma.seccion.create({ data: { panteonId: vm.panteonId, nombre: vm.nombre } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `"${panteon.nombre}" ya tiene una sección "${vm.nombre}".` });
      }
      throw err;
    }

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Crear,
      "secciones",
      seccion.seccionId,
      `Sección "${seccion.nombre}" creada en ${panteon.nombre}`,
      req.ip
    );
    res.status(201).json({ seccion });
  })
);

administracionRouter.put(
  "/secciones/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.seccion.findUnique({ where: { seccionId: id } });
    if (!existente) return res.status(404).json({ error: "Sección no encontrada" });

    const parseo = z.object({ nombre: nombreSeccionSchema }).safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });

    let seccion;
    try {
      seccion = await prisma.seccion.update({ where: { seccionId: id }, data: { nombre: parseo.data.nombre } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Ya existe una sección "${parseo.data.nombre}" en ese panteón.` });
      }
      throw err;
    }

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Editar,
      "secciones",
      id,
      `Sección renombrada de "${existente.nombre}" a "${seccion.nombre}"`,
      req.ip
    );
    res.json({ seccion });
  })
);

administracionRouter.post(
  "/secciones/:id/desactivar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.seccion.findUnique({ where: { seccionId: id } });
    if (!existente) return res.status(404).json({ error: "Sección no encontrada" });

    await prisma.seccion.update({ where: { seccionId: id }, data: { activo: false } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Cancelar, "secciones", id, `Sección "${existente.nombre}" desactivada`, req.ip);
    res.json({ ok: true });
  })
);

administracionRouter.post(
  "/secciones/:id/activar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.seccion.findUnique({ where: { seccionId: id } });
    if (!existente) return res.status(404).json({ error: "Sección no encontrada" });

    await prisma.seccion.update({ where: { seccionId: id }, data: { activo: true } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "secciones", id, `Sección "${existente.nombre}" reactivada`, req.ip);
    res.json({ ok: true });
  })
);

// ═══════════ AGENTES DEL MINISTERIO PÚBLICO ═══════════

administracionRouter.get(
  "/agentes-mp",
  asyncHandler(async (_req, res) => {
    const agentes = await prisma.agenteMinisterioPublico.findMany({ orderBy: { nombre: "asc" } });
    res.json({ agentes });
  })
);

const nombreAgenteSchema = z.string().trim().min(1, "El nombre es obligatorio.");

administracionRouter.post(
  "/agentes-mp",
  asyncHandler(async (req, res) => {
    const parseo = z.object({ nombre: nombreAgenteSchema }).safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });

    let agente;
    try {
      agente = await prisma.agenteMinisterioPublico.create({ data: { nombre: parseo.data.nombre } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Ya existe un agente "${parseo.data.nombre}".` });
      }
      throw err;
    }

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Crear, "agentes_ministerio_publico", agente.agenteId, `Agente "${agente.nombre}" creado`, req.ip);
    res.status(201).json({ agente });
  })
);

administracionRouter.put(
  "/agentes-mp/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.agenteMinisterioPublico.findUnique({ where: { agenteId: id } });
    if (!existente) return res.status(404).json({ error: "Agente no encontrado" });

    const parseo = z.object({ nombre: nombreAgenteSchema }).safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });

    let agente;
    try {
      agente = await prisma.agenteMinisterioPublico.update({ where: { agenteId: id }, data: { nombre: parseo.data.nombre } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Ya existe un agente "${parseo.data.nombre}".` });
      }
      throw err;
    }

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Editar,
      "agentes_ministerio_publico",
      id,
      `Agente renombrado de "${existente.nombre}" a "${agente.nombre}"`,
      req.ip
    );
    res.json({ agente });
  })
);

administracionRouter.post(
  "/agentes-mp/:id/desactivar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.agenteMinisterioPublico.findUnique({ where: { agenteId: id } });
    if (!existente) return res.status(404).json({ error: "Agente no encontrado" });

    await prisma.agenteMinisterioPublico.update({ where: { agenteId: id }, data: { activo: false } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Cancelar, "agentes_ministerio_publico", id, `Agente "${existente.nombre}" desactivado`, req.ip);
    res.json({ ok: true });
  })
);

administracionRouter.post(
  "/agentes-mp/:id/activar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.agenteMinisterioPublico.findUnique({ where: { agenteId: id } });
    if (!existente) return res.status(404).json({ error: "Agente no encontrado" });

    await prisma.agenteMinisterioPublico.update({ where: { agenteId: id }, data: { activo: true } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "agentes_ministerio_publico", id, `Agente "${existente.nombre}" reactivado`, req.ip);
    res.json({ ok: true });
  })
);
