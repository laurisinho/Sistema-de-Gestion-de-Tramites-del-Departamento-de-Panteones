import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hoyLocal } from "../lib/fechas";
import { requiereAuth, requiereEscritura } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { generarFolioCesion } from "../lib/folio";
import { renderPdf } from "../lib/pdf";
import { cesionHtml, type TituloCedidoParaPdf } from "../templates/cesion.template";
import { obtenerAparienciaDocumento } from "../lib/apariencia";

export const cesionesRouter = Router();
cesionesRouter.use(requiereAuth, requiereEscritura);

cesionesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const cesiones = await prisma.cesionDerechos.findMany({
      include: { cedente: true, cesionario: true, lote: { include: { panteon: true } } },
      orderBy: { fechaCreacion: "desc" },
      take: 50,
    });
    res.json({ cesiones });
  })
);

const fechaISO = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
  .transform((s) => new Date(s));

const nuevaCesionSchema = z.object({
  tituloId: z.coerce.number().int({ message: "Debe seleccionar el título a ceder." }),
  nombreCesionario: z.string().min(1, "El nombre del cesionario es obligatorio."),
  telefonoCesionario: z.string().optional(),
  domicilioCesionario: z.string().optional(),
  coloniaCesionario: z.string().optional(),
  ineCesionario: z.string().optional(),
  fechaCesion: fechaISO.optional(),
});

// Se lanza dentro de la transacción cuando, al momento de marcar el título
// anterior como CEDIDO, alguien ya lo hizo primero (dos peticiones casi
// simultáneas sobre el mismo título). Nunca sale de esta ruta.
class TituloYaCedidoError extends Error {}

// Una cesión toca tres tablas (nuevo título, título anterior y registro de
// cesión). Sin transacción, una falla intermedia dejaría el título anterior en
// CEDIDO y el nuevo VIGENTE sin registro de cesión. Equivale a
// CesionesController.Nueva.
cesionesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = nuevaCesionSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;
    const usuarioId = req.usuario!.usuarioId;

    const titulo = await prisma.tituloPropiedad.findUnique({
      where: { tituloId: vm.tituloId },
      include: { titular: true, lote: { include: { panteon: true } } },
    });

    if (!titulo) return res.status(400).json({ error: "No se encontró el título seleccionado." });
    if (titulo.estado !== "VIGENTE") {
      return res
        .status(400)
        .json({ error: `El título no está vigente (estado actual: ${titulo.estado}). No se puede ceder.` });
    }

    try {
      const resultado = await prisma.$transaction(async (tx) => {
        const cesionario = await tx.persona.create({
          data: {
            nombreCompleto: vm.nombreCesionario.trim(),
            telefono: vm.telefonoCesionario,
            domicilio: vm.domicilioCesionario,
            colonia: vm.coloniaCesionario,
            identificacionTipo: vm.ineCesionario?.trim() ? "INE" : undefined,
            identificacionNumero: vm.ineCesionario,
          },
        });

        // Folio del nuevo título: misma ubicación + sufijo de cesión.
        const baseFolio = titulo.lote.claveLegado?.trim() || titulo.folio;
        let nuevoFolio = baseFolio;
        let n = 1;
        while (await tx.tituloPropiedad.findUnique({ where: { folio: nuevoFolio } })) {
          nuevoFolio = `${baseFolio}-C${n++}`;
        }

        const nuevoTitulo = await tx.tituloPropiedad.create({
          data: {
            loteId: titulo.loteId,
            titularId: cesionario.personaId,
            folio: nuevoFolio,
            fechaEmision: vm.fechaCesion ?? hoyLocal(),
            usuarioEmitioId: usuarioId,
            estado: "VIGENTE",
            estadoEntrega: "PENDIENTE_ENTREGA",
          },
        });

        // Condicionado a que siga VIGENTE: la comprobación de arriba es antes de
        // abrir la transacción, así que dos peticiones para el mismo título
        // pueden pasarla las dos. Si otra ya lo cedió entre medio, aquí no
        // actualiza ninguna fila y se aborta -- revierte también el título
        // nuevo ya creado -- en vez de dejar dos títulos VIGENTES en el lote.
        const marcado = await tx.tituloPropiedad.updateMany({
          where: { tituloId: titulo.tituloId, estado: "VIGENTE" },
          data: { estado: "CEDIDO" },
        });
        if (marcado.count === 0) throw new TituloYaCedidoError();

        const folioCesion = await generarFolioCesion(tx);
        const cesion = await tx.cesionDerechos.create({
          data: {
            tituloId: nuevoTitulo.tituloId,
            loteId: titulo.loteId,
            cedenteId: titulo.titularId,
            cesionarioId: cesionario.personaId,
            folio: folioCesion,
            fechaCesion: vm.fechaCesion ?? hoyLocal(),
            usuarioRegistroId: usuarioId,
            estado: "VIGENTE",
          },
        });

        return { cesion, cesionario, nuevoFolio, folioCesion };
      });

      await registrarBitacora(
        usuarioId,
        Acciones.Ceder,
        "cesion_derechos",
        resultado.cesion.cesionId,
        `Cesión ${resultado.folioCesion}: de ${titulo.titular.nombreCompleto} a ${resultado.cesionario.nombreCompleto} (nuevo título ${resultado.nuevoFolio})`,
        req.ip
      );

      res.status(201).json({
        cesionId: resultado.cesion.cesionId,
        folioCesion: resultado.folioCesion,
        nuevoFolio: resultado.nuevoFolio,
      });
    } catch (err) {
      if (err instanceof TituloYaCedidoError) {
        return res
          .status(409)
          .json({ error: "Ese título ya fue cedido (probablemente desde otra pantalla). Actualiza la búsqueda e inténtalo de nuevo." });
      }
      console.error("Error al registrar cesión (rollback aplicado):", err);
      res.status(500).json({ error: "No se pudo completar la cesión. No se guardó ningún cambio; inténtalo de nuevo." });
    }
  })
);

cesionesRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const cesion = await prisma.cesionDerechos.findUnique({
      where: { cesionId: Number(req.params.id) },
      include: { cedente: true, cesionario: true, lote: { include: { panteon: true } } },
    });
    if (!cesion) return res.status(404).json({ error: "Cesión no encontrada" });

    // Título cedido (para mostrar su folio y fecha en la carta): el del cedente
    // sobre ese lote. Si no se encuentra (dato migrado incompleto) se usa un folio
    // de reserva "—". Equivale a CesionesController.Imprimir.
    const tituloDb = await prisma.tituloPropiedad.findFirst({
      where: { loteId: cesion.loteId, titularId: cesion.cedenteId },
      orderBy: { tituloId: "desc" },
    });
    const tituloCedido: TituloCedidoParaPdf = tituloDb
      ? { folio: tituloDb.folio, fechaEmision: tituloDb.fechaEmision }
      : { folio: "—", fechaEmision: null };

    const apariencia = await obtenerAparienciaDocumento();
    const pdf = await renderPdf(cesionHtml(cesion, tituloCedido, apariencia));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Cesion_${cesion.folio}.pdf"`);
    res.send(pdf);
  })
);
