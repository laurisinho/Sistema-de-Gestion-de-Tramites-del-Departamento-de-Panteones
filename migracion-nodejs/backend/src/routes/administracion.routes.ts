import { Router, json } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth, requiereRol } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { invalidarCacheApariencia } from "../lib/apariencia";
import { CONTRASTE_MINIMO, contrasteConBlanco } from "../lib/colores";

// Alta y mantenimiento de los catálogos de Panteones, Secciones y Agentes del
// Ministerio Público. Nada se borra físicamente, igual que en Usuarios: solo se
// activa o desactiva, para que títulos y reportes históricos no queden con una
// referencia rota.
export const administracionRouter = Router();
administracionRouter.use(requiereAuth, requiereRol("Administrador"));

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Panteones

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

// Secciones
// Catálogo por panteón (ver Seccion en schema.prisma). Solo alimenta las
// sugerencias al dar de alta un lote; Lote.seccion sigue siendo texto libre, así
// que no afecta lotes existentes.

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

// Agentes del Ministerio Público

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

// Apariencia
// La lectura (GET /api/apariencia) es pública (ver apariencia.routes.ts); solo
// cambiarla requiere ser Administrador.

const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser un código hexadecimal, p. ej. #6b1229.");

const aparienciaSchema = z.object({
  // El guinda es el fondo de los encabezados y lleva texto blanco encima, tanto
  // en pantalla como en los títulos, permisos, cesiones y reportes en Excel. Un
  // color claro dejaría ilegible un documento ya impreso y firmado, así que se
  // rechaza aquí en lugar de descubrirlo al imprimir.
  colorGuinda: colorHexSchema.refine(
    (c) => contrasteConBlanco(c) >= CONTRASTE_MINIMO,
    "Ese color es demasiado claro: el texto blanco de los documentos no se leería encima. Elige uno más oscuro."
  ),
  colorDorado: colorHexSchema,
});

administracionRouter.put(
  "/apariencia",
  asyncHandler(async (req, res) => {
    const parseo = aparienciaSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    const vm = parseo.data;

    const config = await prisma.configuracionApariencia.upsert({
      where: { id: 1 },
      create: { id: 1, colorGuinda: vm.colorGuinda, colorDorado: vm.colorDorado },
      update: { colorGuinda: vm.colorGuinda, colorDorado: vm.colorDorado },
    });
    invalidarCacheApariencia();

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Editar,
      "configuracion_apariencia",
      1,
      `Colores del sistema actualizados (guinda ${vm.colorGuinda}, dorado ${vm.colorDorado})`,
      req.ip
    );

    res.json(config);
  })
);

// Síndico municipal
// Nombre de quien firma títulos, permisos y cesiones; lo comparten las tres
// plantillas.

const sindicoSchema = z.object({
  nombreSindico: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
});

administracionRouter.put(
  "/apariencia/sindico",
  asyncHandler(async (req, res) => {
    const parseo = sindicoSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    const vm = parseo.data;

    const config = await prisma.configuracionApariencia.upsert({
      where: { id: 1 },
      create: { id: 1, nombreSindico: vm.nombreSindico },
      update: { nombreSindico: vm.nombreSindico },
    });
    invalidarCacheApariencia();

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Editar,
      "configuracion_apariencia",
      1,
      `Síndico Municipal actualizado a "${vm.nombreSindico}"`,
      req.ip
    );

    res.json({ nombreSindico: config.nombreSindico });
  })
);

// Logos
// Se reciben como data URI base64 y no como multipart/form-data para no
// agregar multer por dos archivos pequeños. El límite se define en la ruta en
// lugar de subir el límite global de JSON.
const cargaLogoSchema = z.object({
  dataUri: z
    .string()
    .regex(/^data:image\/png;base64,/, "El archivo debe ser una imagen PNG."),
});

const LIMITE_LOGO_BYTES = 2 * 1024 * 1024;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

administracionRouter.put(
  "/apariencia/logo/:cual",
  json({ limit: "3mb" }),
  asyncHandler(async (req, res) => {
    const cual = req.params.cual;
    if (cual !== "nogales" && cual !== "frontera") return res.status(404).json({ error: "Logo no reconocido" });

    const parseo = cargaLogoSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });

    const base64 = parseo.data.dataUri.split(",")[1] ?? "";
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > LIMITE_LOGO_BYTES) {
      return res.status(400).json({ error: "El logo debe pesar menos de 2 MB." });
    }
    if (!bytes.subarray(0, 4).equals(FIRMA_PNG)) {
      return res.status(400).json({ error: "El archivo no es un PNG válido." });
    }

    const campo = cual === "nogales" ? "logoNogales" : "logoFrontera";
    await prisma.configuracionApariencia.upsert({
      where: { id: 1 },
      create: { id: 1, [campo]: bytes },
      update: { [campo]: bytes },
    });
    invalidarCacheApariencia();

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "configuracion_apariencia", 1, `Logo "${cual}" actualizado`, req.ip);
    res.json({ ok: true });
  })
);

administracionRouter.post(
  "/apariencia/logo/:cual/restablecer",
  asyncHandler(async (req, res) => {
    const cual = req.params.cual;
    if (cual !== "nogales" && cual !== "frontera") return res.status(404).json({ error: "Logo no reconocido" });

    const campo = cual === "nogales" ? "logoNogales" : "logoFrontera";
    await prisma.configuracionApariencia.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: { [campo]: null },
    });
    invalidarCacheApariencia();

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "configuracion_apariencia", 1, `Logo "${cual}" restablecido al original`, req.ip);
    res.json({ ok: true });
  })
);
