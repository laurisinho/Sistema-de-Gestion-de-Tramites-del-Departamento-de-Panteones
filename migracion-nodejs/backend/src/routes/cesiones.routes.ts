import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { renderPdf } from "../lib/pdf";
import { cesionHtml, type TituloCedidoParaPdf } from "../templates/cesion.template";

export const cesionesRouter = Router();
cesionesRouter.use(requiereAuth);

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

function hoy(): Date {
  return new Date(new Date().toDateString());
}

// Folio correlativo CES-####. Puerto exacto de GenerarFolioCesion.
async function generarFolioCesion(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const folios = await tx.cesionDerechos.findMany({ select: { folio: true } });
  let max = 0;
  for (const { folio } of folios) {
    const ultimo = folio.split("-").pop() ?? "";
    if (/^\d+$/.test(ultimo)) {
      const num = Number(ultimo);
      if (num > max) max = num;
    }
  }
  let siguiente = max + 1;
  for (;;) {
    const folio = `CES-${String(siguiente).padStart(4, "0")}`;
    const existe = await tx.cesionDerechos.findUnique({ where: { folio } });
    if (!existe) return folio;
    siguiente++;
  }
}

// Una cesión toca tres tablas (nuevo título, título viejo, registro de
// cesión). Sin transacción, una falla a medias deja el título viejo en CEDIDO
// y el nuevo VIGENTE sin registro de cesión: cambia el dueño y no queda
// constancia de quién cedió a quién. Puerto exacto de CesionesController.Nueva.
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
            fechaEmision: vm.fechaCesion ?? hoy(),
            usuarioEmitioId: usuarioId,
            estado: "VIGENTE",
            estadoEntrega: "PENDIENTE_ENTREGA",
          },
        });

        await tx.tituloPropiedad.update({ where: { tituloId: titulo.tituloId }, data: { estado: "CEDIDO" } });

        const folioCesion = await generarFolioCesion(tx);
        const cesion = await tx.cesionDerechos.create({
          data: {
            tituloId: nuevoTitulo.tituloId,
            loteId: titulo.loteId,
            cedenteId: titulo.titularId,
            cesionarioId: cesionario.personaId,
            folio: folioCesion,
            fechaCesion: vm.fechaCesion ?? hoy(),
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

    // Título cedido (para mostrar su folio/fecha en la carta): el del cedente
    // sobre ese lote. Si no se encuentra (dato migrado incompleto), un folio
    // de reserva "—" en vez de tronar. Puerto exacto de CesionesController.Imprimir.
    const tituloDb = await prisma.tituloPropiedad.findFirst({
      where: { loteId: cesion.loteId, titularId: cesion.cedenteId },
      orderBy: { tituloId: "desc" },
    });
    const tituloCedido: TituloCedidoParaPdf = tituloDb
      ? { folio: tituloDb.folio, fechaEmision: tituloDb.fechaEmision }
      : { folio: "—", fechaEmision: null };

    const pdf = await renderPdf(cesionHtml(cesion, tituloCedido));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Cesion_${cesion.folio}.pdf"`);
    res.send(pdf);
  })
);
