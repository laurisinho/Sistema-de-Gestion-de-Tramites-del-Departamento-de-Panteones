import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { renderPdf } from "../lib/pdf";
import { permisoHtml } from "../templates/permiso.template";
import { tituloHtml } from "../templates/titulo.template";
import { cesionHtml, type TituloCedidoParaPdf } from "../templates/cesion.template";

export const reimpresionesRouter = Router();
reimpresionesRouter.use(requiereAuth);

reimpresionesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const lista = await prisma.reimpresion.findMany({
      include: {
        usuario: { select: { usuarioId: true, nombreCompleto: true } },
        permiso: true,
        titulo: true,
        cesion: true,
      },
      orderBy: { fechaReimpresion: "desc" },
      take: 80,
    });
    res.json({ lista });
  })
);

// Busca entre permisos, títulos y cesiones por folio o nombre de la persona
// involucrada, para elegir cuál se va a reimprimir. Puerto exacto de
// ReimpresionesController.Buscar. La acción de reimprimir en sí (que genera
// el PDF con sello de "REIMPRESIÓN") queda pendiente para la pasada de PDF.
reimpresionesRouter.get(
  "/buscar",
  asyncHandler(async (req, res) => {
    const termino = typeof req.query.termino === "string" ? req.query.termino.trim() : "";
    if (!termino) return res.json([]);

    const [permisos, titulos, cesiones] = await Promise.all([
      prisma.permiso.findMany({
        where: {
          OR: [
            { folio: { contains: termino, mode: "insensitive" } },
            { solicitante: { nombreCompleto: { contains: termino, mode: "insensitive" } } },
          ],
        },
        include: { tipoTramite: true, solicitante: true },
        orderBy: { fechaCreacion: "desc" },
        take: 10,
      }),
      prisma.tituloPropiedad.findMany({
        where: {
          OR: [
            { folio: { contains: termino, mode: "insensitive" } },
            { titular: { nombreCompleto: { contains: termino, mode: "insensitive" } } },
          ],
        },
        include: { titular: true, lote: { include: { panteon: true } } },
        orderBy: { tituloId: "desc" },
        take: 10,
      }),
      prisma.cesionDerechos.findMany({
        where: {
          OR: [
            { folio: { contains: termino, mode: "insensitive" } },
            { cesionario: { nombreCompleto: { contains: termino, mode: "insensitive" } } },
          ],
        },
        include: { cesionario: true },
        orderBy: { cesionId: "desc" },
        take: 10,
      }),
    ]);

    const resultados = [
      ...permisos.map((p) => ({
        tipo: "PERMISO",
        id: p.permisoId,
        folio: p.folio,
        nombre: p.solicitante.nombreCompleto,
        extra: p.tipoTramite.nombre,
        estado: p.estado,
      })),
      ...titulos.map((t) => ({
        tipo: "TITULO",
        id: t.tituloId,
        folio: t.folio,
        nombre: t.titular.nombreCompleto,
        extra: t.lote.panteon.nombre,
        estado: t.estado,
      })),
      ...cesiones.map((c) => ({
        tipo: "CESION",
        id: c.cesionId,
        folio: c.folio,
        nombre: c.cesionario.nombreCompleto,
        extra: "Cesión de derechos",
        estado: c.estado,
      })),
    ];

    res.json(resultados);
  })
);

// Trae UN documento puntual por tipo+id, en la misma forma que /buscar --
// para precargar la selección cuando se llega desde el botón "Reimprimir con
// sello" de otra pantalla (Permisos/Títulos/Cesiones), sin tener que
// volver a teclear la búsqueda.
reimpresionesRouter.get(
  "/documento",
  asyncHandler(async (req, res) => {
    const tipo = typeof req.query.tipo === "string" ? req.query.tipo : "";
    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ error: "Datos inválidos" });

    if (tipo === "PERMISO") {
      const p = await prisma.permiso.findUnique({ where: { permisoId: id }, include: { tipoTramite: true, solicitante: true } });
      if (!p) return res.status(404).json({ error: "No encontrado" });
      return res.json({ tipo: "PERMISO", id: p.permisoId, folio: p.folio, nombre: p.solicitante.nombreCompleto, extra: p.tipoTramite.nombre, estado: p.estado });
    }
    if (tipo === "TITULO") {
      const t = await prisma.tituloPropiedad.findUnique({ where: { tituloId: id }, include: { titular: true, lote: { include: { panteon: true } } } });
      if (!t) return res.status(404).json({ error: "No encontrado" });
      return res.json({ tipo: "TITULO", id: t.tituloId, folio: t.folio, nombre: t.titular.nombreCompleto, extra: t.lote.panteon.nombre, estado: t.estado });
    }
    if (tipo === "CESION") {
      const c = await prisma.cesionDerechos.findUnique({ where: { cesionId: id }, include: { cesionario: true } });
      if (!c) return res.status(404).json({ error: "No encontrado" });
      return res.json({ tipo: "CESION", id: c.cesionId, folio: c.folio, nombre: c.cesionario.nombreCompleto, extra: "Cesión de derechos", estado: c.estado });
    }
    res.status(400).json({ error: "Tipo inválido" });
  })
);

const reimprimirSchema = z.object({
  tipo: z.enum(["PERMISO", "TITULO", "CESION"]),
  id: z.coerce.number().int(),
  motivo: z.string().optional(),
});

// Crea el registro de reimpresión y regenera el PDF con el sello de
// "REIMPRESIÓN" y el número de reimpresión correspondiente a ese documento.
// Puerto exacto de ReimpresionesController.Reimprimir.
reimpresionesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = reimprimirSchema.safeParse(req.body);
    if (!parseo.success) return res.status(400).json({ error: "Datos inválidos" });
    const { tipo, id } = parseo.data;
    const motivo = parseo.data.motivo?.trim() || "No especificado";
    const usuarioId = req.usuario!.usuarioId;
    const ahora = new Date();

    let pdf: Buffer;
    let nombreArchivo: string;
    let descBitacora: string;
    let datosReimpresion: { permisoId?: number; tituloId?: number; cesionId?: number };

    if (tipo === "PERMISO") {
      const permiso = await prisma.permiso.findUnique({
        where: { permisoId: id },
        include: { tipoTramite: true, solicitante: true, fallecido: true, lote: { include: { panteon: true } } },
      });
      if (!permiso) return res.status(404).json({ error: "Permiso no encontrado" });
      if (permiso.estado === "CANCELADO" || permiso.estado === "RECHAZADO") {
        return res.status(409).json({ error: `El permiso está en estado ${permiso.estado}, por lo que no puede reexpedirse.` });
      }
      const n = (await prisma.reimpresion.count({ where: { permisoId: id } })) + 1;
      pdf = await renderPdf(permisoHtml(permiso, { esReimpresion: true, fechaReimpresion: ahora, numeroReimpresion: n }));
      nombreArchivo = `Permiso_${permiso.folio}_REIMP.pdf`;
      descBitacora = `Reimpresión Nº ${n} de permiso ${permiso.folio} — Motivo: ${motivo}`;
      datosReimpresion = { permisoId: id };
    } else if (tipo === "TITULO") {
      const titulo = await prisma.tituloPropiedad.findUnique({
        where: { tituloId: id },
        include: { titular: true, lote: { include: { panteon: true, tipoLote: true } } },
      });
      if (!titulo) return res.status(404).json({ error: "Título no encontrado" });
      if (titulo.estado === "CANCELADO") {
        return res.status(409).json({ error: `El título está en estado ${titulo.estado}, por lo que no puede reexpedirse.` });
      }
      const n = (await prisma.reimpresion.count({ where: { tituloId: id } })) + 1;
      pdf = await renderPdf(tituloHtml(titulo, { esReimpresion: true, fechaReimpresion: ahora, numeroReimpresion: n }));
      nombreArchivo = `Titulo_${titulo.folio}_REIMP.pdf`;
      descBitacora = `Reimpresión Nº ${n} de título ${titulo.folio} — Motivo: ${motivo}`;
      datosReimpresion = { tituloId: id };
    } else {
      const cesion = await prisma.cesionDerechos.findUnique({
        where: { cesionId: id },
        include: { cedente: true, cesionario: true, lote: { include: { panteon: true } } },
      });
      if (!cesion) return res.status(404).json({ error: "Cesión no encontrada" });
      if (cesion.estado === "CANCELADO") {
        return res.status(409).json({ error: `La cesión está en estado ${cesion.estado}, por lo que no puede reexpedirse.` });
      }
      const tituloDb = await prisma.tituloPropiedad.findFirst({
        where: { loteId: cesion.loteId, titularId: cesion.cedenteId },
        orderBy: { tituloId: "desc" },
      });
      const tituloCedido: TituloCedidoParaPdf = tituloDb
        ? { folio: tituloDb.folio, fechaEmision: tituloDb.fechaEmision }
        : { folio: "—", fechaEmision: null };
      const n = (await prisma.reimpresion.count({ where: { cesionId: id } })) + 1;
      pdf = await renderPdf(cesionHtml(cesion, tituloCedido, { esReimpresion: true, fechaReimpresion: ahora, numeroReimpresion: n }));
      nombreArchivo = `Cesion_${cesion.folio}_REIMP.pdf`;
      descBitacora = `Reimpresión Nº ${n} de cesión ${cesion.folio} — Motivo: ${motivo}`;
      datosReimpresion = { cesionId: id };
    }

    const reg = await prisma.reimpresion.create({
      data: { usuarioId, fechaReimpresion: ahora, motivo, ...datosReimpresion },
    });

    await registrarBitacora(usuarioId, Acciones.Reimprimir, "reimpresiones", reg.reimpresionId, descBitacora, req.ip);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombreArchivo}"`);
    res.send(pdf);
  })
);
