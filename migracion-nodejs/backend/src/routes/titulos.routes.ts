import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { renderPdf } from "../lib/pdf";
import { tituloHtml } from "../templates/titulo.template";

export const titulosRouter = Router();
titulosRouter.use(requiereAuth);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Sin filtros: últimos 50 (TitulosController.Index). Con filtros: hasta 100
// (BusquedaController.Index/Buscar) -- por folio/titular/manzana/lote en
// texto libre + panteón, todos los estados (no solo VIGENTE, a diferencia de
// /buscar que es solo para elegir título a ceder).
titulosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const porFallecido = req.query.tipoBusqueda === "fallecido";
    const hayFiltros = !!(q || panteonId);

    // Modo "buscar por fallecido" (BusquedaController.Buscar, tipo="fallecido"):
    // el nombre del difunto no vive en el título, así que primero se resuelven
    // los lotes donde se sepultó a alguien con ese nombre (permiso de
    // inhumación) y luego se filtran los títulos de esos lotes.
    let loteIdsPorFallecido: number[] | undefined;
    if (porFallecido && q) {
      const permisos = await prisma.permiso.findMany({
        where: { tipoTramite: { clave: "SEP" }, loteId: { not: null }, fallecido: { nombreCompleto: { contains: q, mode: "insensitive" } } },
        select: { loteId: true },
      });
      loteIdsPorFallecido = permisos.map((p) => p.loteId!);
    }

    const titulos = await prisma.tituloPropiedad.findMany({
      where: {
        ...(porFallecido
          ? { loteId: { in: loteIdsPorFallecido ?? [] } }
          : q
            ? {
                OR: [
                  { folio: { contains: q, mode: "insensitive" } },
                  { titular: { nombreCompleto: { contains: q, mode: "insensitive" } } },
                  { lote: { numeroManzana: { contains: q, mode: "insensitive" } } },
                  { lote: { numeroLote: { contains: q, mode: "insensitive" } } },
                  { lote: { claveLegado: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        ...(panteonId ? { lote: { panteonId } } : {}),
      },
      include: { titular: true, lote: { include: { panteon: true } } },
      orderBy: { fechaCreacion: "desc" },
      take: hayFiltros ? 100 : 50,
    });
    res.json({ titulos });
  })
);

// Búsqueda de títulos VIGENTES por folio / titular / manzana / lote, para
// elegir cuál se va a ceder. Puerto exacto de CesionesController.BuscarTitulo.
// Va antes de "/:id": es una ruta literal, si quedara después "buscar" se
// interpretaría como un tituloId inválido (mismo bug ya corregido en Incidencias).
titulosRouter.get(
  "/buscar",
  asyncHandler(async (req, res) => {
    const termino = typeof req.query.termino === "string" ? req.query.termino.trim() : "";
    if (!termino) return res.json([]);

    const resultados = await prisma.tituloPropiedad.findMany({
      where: {
        estado: "VIGENTE",
        OR: [
          { folio: { contains: termino, mode: "insensitive" } },
          { titular: { nombreCompleto: { contains: termino, mode: "insensitive" } } },
          { lote: { numeroManzana: { contains: termino, mode: "insensitive" } } },
          { lote: { numeroLote: { contains: termino, mode: "insensitive" } } },
        ],
      },
      include: { titular: true, lote: { include: { panteon: true } } },
      orderBy: { titular: { nombreCompleto: "asc" } },
      take: 25,
    });

    res.json(
      resultados.map((x) => ({
        tituloId: x.tituloId,
        folio: x.folio,
        titular: x.titular.nombreCompleto,
        panteon: x.lote.panteon.nombre,
        ubicacion:
          x.lote.numeroManzana === "S/N"
            ? "Colindancias"
            : `Mz ${x.lote.numeroManzana} · Lote ${x.lote.numeroLote}` + (x.lote.seccion ? ` · Secc. ${x.lote.seccion}` : ""),
      }))
    );
  })
);

// Puerto exacto de BusquedaController.Detalle: además del título en sí, trae
// los fallecidos sepultados en el lote y el historial completo de permisos,
// para que el expediente cuente la historia completa del lote de un vistazo.
titulosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const titulo = await prisma.tituloPropiedad.findUnique({
      where: { tituloId: Number(req.params.id) },
      include: {
        titular: true,
        lote: { include: { panteon: true, tipoLote: true } },
        usuarioEmitio: { select: { nombreCompleto: true } },
      },
    });
    if (!titulo) return res.status(404).json({ error: "Título no encontrado" });

    const [fallecidos, permisos] = await Promise.all([
      prisma.permiso.findMany({
        where: { loteId: titulo.loteId, tipoTramite: { clave: "SEP" }, fallecidoId: { not: null } },
        select: { fallecido: { select: { fallecidoId: true, nombreCompleto: true, fechaFallecimiento: true } } },
      }),
      prisma.permiso.findMany({
        where: { loteId: titulo.loteId },
        include: { tipoTramite: true, solicitante: true },
        orderBy: { fechaCreacion: "desc" },
      }),
    ]);

    res.json({
      titulo,
      fallecidos: fallecidos.map((p) => p.fallecido!),
      permisos,
    });
  })
);

const fechaISO = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
  .transform((s) => new Date(s));

const nuevoTituloSchema = z.object({
  nombreTitular: z.string().min(1, "El nombre del titular es obligatorio."),
  telefonoTitular: z.string().optional(),
  domicilioTitular: z.string().optional(),
  coloniaTitular: z.string().optional(),
  numeroINE: z.string().optional(),

  panteonId: z.coerce.number().int({ message: "Seleccione un panteón." }),
  tipoLoteId: z.coerce.number().int().default(1),

  numeroManzana: z.string().optional(),
  numeroLote: z.string().optional(),
  seccion: z.string().optional(),

  colindanciaNorte: z.string().optional(),
  colindanciaSur: z.string().optional(),
  colindanciaEste: z.string().optional(),
  colindanciaOeste: z.string().optional(),

  fechaEmision: fechaISO.optional(),
});

function hoy(): Date {
  return new Date(new Date().toDateString());
}

// Quita espacios y '/' y pone en mayúsculas. "1 - A" -> "1-A"   "S/N" -> "SN"
function limpiarComponente(valor: string): string {
  return valor.trim().toUpperCase().replace(/[ /]/g, "");
}

// Emite un título de propiedad para un lote NUEVO (a diferencia de Permisos,
// que opera sobre lotes ya existentes). Puerto exacto de TitulosController.Nuevo.
titulosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = nuevoTituloSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    // El tipo de ubicación lo define el panteón, no el cliente.
    const panteon = await prisma.panteon.findUnique({ where: { panteonId: vm.panteonId } });
    if (!panteon) return res.status(400).json({ error: "Panteón no válido." });

    const usuarioId = req.usuario!.usuarioId;
    let manzana: string;
    let lote: string;

    if (panteon.usaColindancias) {
      manzana = "S/N";
      // Lote secuencial para no violar la unicidad de ubicación en panteones de colindancias.
      const ultimo = await prisma.lote.count({
        where: { panteonId: vm.panteonId, numeroManzana: "S/N" },
      });
      lote = String(ultimo + 1);
    } else {
      if (!vm.numeroManzana?.trim() || !vm.numeroLote?.trim()) {
        return res.status(400).json({ error: "Debe capturar Manzana y Lote." });
      }
      manzana = vm.numeroManzana.trim();
      lote = vm.numeroLote.trim();

      const existe = await prisma.lote.findFirst({
        where: { panteonId: vm.panteonId, numeroManzana: manzana, numeroLote: lote },
      });
      if (existe) {
        return res.status(400).json({
          error: `Ya existe un lote registrado en ese panteón con Manzana ${manzana} y Lote ${lote}.`,
        });
      }
    }

    // Persona, lote y título se confirman juntos: si el título fallara después de
    // crear la persona y el lote (p. ej. choque de folio entre dos capturistas
    // simultáneos), sin transacción quedarían un titular huérfano y un lote
    // marcado OCUPADO sin ningún título -- visibles en búsquedas y expedientes.
    try {
      const resultado = await prisma.$transaction(async (tx) => {
        // Folio por ubicación con la clave legible del panteón: {ClavePanteon}-{manzana}-{lote}
        // ej. PC-1A-13, PJE-10-16
        const clave = panteon.clave?.trim() || `P${vm.panteonId}`;
        const claveBase = `${clave}-${limpiarComponente(manzana)}-${limpiarComponente(lote)}`;
        let folio = claveBase;
        let n = 2;
        while (await tx.tituloPropiedad.findUnique({ where: { folio } })) {
          folio = `${claveBase}-${n++}`;
        }

        const titular = await tx.persona.create({
          data: {
            nombreCompleto: vm.nombreTitular.trim(),
            telefono: vm.telefonoTitular,
            domicilio: vm.domicilioTitular,
            colonia: vm.coloniaTitular,
            identificacionTipo: vm.numeroINE?.trim() ? "INE" : undefined,
            identificacionNumero: vm.numeroINE,
          },
        });

        const nuevoLote = await tx.lote.create({
          data: {
            panteonId: vm.panteonId,
            tipoLoteId: vm.tipoLoteId,
            numeroManzana: manzana,
            numeroLote: lote,
            seccion: panteon.usaColindancias ? null : vm.seccion,
            dimensiones: "1.50 m de frente por 2.50 m de largo",
            colindanciaNorte: panteon.usaColindancias ? vm.colindanciaNorte : null,
            colindanciaSur: panteon.usaColindancias ? vm.colindanciaSur : null,
            colindanciaEste: panteon.usaColindancias ? vm.colindanciaEste : null,
            colindanciaOeste: panteon.usaColindancias ? vm.colindanciaOeste : null,
            claveLegado: folio,
            estado: "OCUPADO",
          },
        });

        const titulo = await tx.tituloPropiedad.create({
          data: {
            loteId: nuevoLote.loteId,
            titularId: titular.personaId,
            folio,
            fechaEmision: vm.fechaEmision ?? hoy(),
            usuarioEmitioId: usuarioId,
            estado: "VIGENTE",
            estadoEntrega: "PENDIENTE_ENTREGA",
          },
        });

        return { titulo, titular, folio };
      });

      await registrarBitacora(
        usuarioId,
        Acciones.Crear,
        "titulos_propiedad",
        resultado.titulo.tituloId,
        `Título de propiedad ${resultado.folio} emitido a ${resultado.titular.nombreCompleto}`,
        req.ip
      );

      res.status(201).json({ tituloId: resultado.titulo.tituloId, folio: resultado.folio });
    } catch (err) {
      console.error("Error al emitir título (rollback aplicado):", err);
      res.status(500).json({ error: "No se pudo emitir el título. No se guardó ningún cambio; inténtalo de nuevo." });
    }
  })
);

const ESTADOS_ENTREGA_VALIDOS = ["PENDIENTE_ENTREGA", "LLAMADA_REALIZADA", "BUZON", "ENTREGADO"];

titulosRouter.patch(
  "/:id/entrega",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const estadoEntrega = typeof req.body.estadoEntrega === "string" ? req.body.estadoEntrega : "";

    if (!ESTADOS_ENTREGA_VALIDOS.includes(estadoEntrega)) {
      return res.status(400).json({ error: "Estado de entrega no válido." });
    }

    const titulo = await prisma.tituloPropiedad.findUnique({ where: { tituloId: id } });
    if (!titulo) return res.status(404).json({ error: "Título no encontrado" });

    const actualizado = await prisma.tituloPropiedad.update({
      where: { tituloId: id },
      data: {
        estadoEntrega,
        fechaEntrega: estadoEntrega === "ENTREGADO" ? new Date(new Date().toDateString()) : titulo.fechaEntrega,
      },
    });

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Entrega,
      "titulos_propiedad",
      titulo.tituloId,
      `Título ${titulo.folio}: entrega → ${estadoEntrega}`,
      req.ip
    );

    res.json({ titulo: actualizado });
  })
);

// Puerto exacto de BusquedaController.EditarExpediente: titular + lote
// (manzana/lote/sección, o las 4 colindancias si NumeroManzana=="S/N") +
// datos del título, todo en un solo guardado.
const editarTituloSchema = z.object({
  nombreTitular: z.string().min(1, "El nombre del titular es obligatorio."),
  telefonoTitular: z.string().optional(),
  domicilioTitular: z.string().optional(),
  coloniaTitular: z.string().optional(),
  numeroManzana: z.string().optional(),
  numeroLote: z.string().optional(),
  seccion: z.string().optional(),
  colindanciaNorte: z.string().optional(),
  colindanciaSur: z.string().optional(),
  colindanciaEste: z.string().optional(),
  colindanciaOeste: z.string().optional(),
  fechaEmision: fechaISO.optional(),
  estado: z.enum(["VIGENTE", "CEDIDO", "CANCELADO"]),
  estadoEntrega: z.enum(ESTADOS_ENTREGA_VALIDOS as [string, ...string[]]),
  fechaEntrega: fechaISO.optional(),
});

titulosRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const titulo = await prisma.tituloPropiedad.findUnique({ where: { tituloId: id }, include: { lote: true } });
    if (!titulo) return res.status(404).json({ error: "Título no encontrado" });

    const parseo = editarTituloSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;
    const usaColindancias = titulo.lote.numeroManzana === "S/N";

    // El original .NET confirma titular + lote + título con un solo
    // SaveChangesAsync; aquí eran 3 updates sueltos y una falla a la mitad
    // dejaba el expediente editado a medias sin que el usuario lo notara.
    await prisma.$transaction(async (tx) => {
      await tx.persona.update({
        where: { personaId: titulo.titularId },
        data: {
          nombreCompleto: vm.nombreTitular.trim(),
          telefono: vm.telefonoTitular,
          domicilio: vm.domicilioTitular,
          colonia: vm.coloniaTitular,
        },
      });

      await tx.lote.update({
        where: { loteId: titulo.loteId },
        data: usaColindancias
          ? {
              colindanciaNorte: vm.colindanciaNorte,
              colindanciaSur: vm.colindanciaSur,
              colindanciaEste: vm.colindanciaEste,
              colindanciaOeste: vm.colindanciaOeste,
            }
          : {
              numeroManzana: vm.numeroManzana?.trim() || titulo.lote.numeroManzana,
              numeroLote: vm.numeroLote?.trim() || titulo.lote.numeroLote,
              seccion: vm.seccion,
            },
      });

      await tx.tituloPropiedad.update({
        where: { tituloId: id },
        data: {
          fechaEmision: vm.fechaEmision,
          estado: vm.estado,
          estadoEntrega: vm.estadoEntrega,
          fechaEntrega: vm.fechaEntrega,
        },
      });
    });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "titulos_propiedad", id, `Título ${titulo.folio} editado`, req.ip);

    res.json({ ok: true });
  })
);

// Puerto exacto de BusquedaController.EliminarExpediente: nunca borra la
// fila, solo la marca CANCELADO.
titulosRouter.post(
  "/:id/cancelar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const titulo = await prisma.tituloPropiedad.findUnique({ where: { tituloId: id } });
    if (!titulo) return res.status(404).json({ error: "Título no encontrado" });

    await prisma.tituloPropiedad.update({ where: { tituloId: id }, data: { estado: "CANCELADO" } });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Cancelar, "titulos_propiedad", id, `Título ${titulo.folio} cancelado`, req.ip);

    res.json({ ok: true });
  })
);

titulosRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const titulo = await prisma.tituloPropiedad.findUnique({
      where: { tituloId: Number(req.params.id) },
      include: { titular: true, lote: { include: { panteon: true, tipoLote: true } } },
    });
    if (!titulo) return res.status(404).json({ error: "Título no encontrado" });

    const pdf = await renderPdf(tituloHtml(titulo));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Titulo_${titulo.folio}.pdf"`);
    res.send(pdf);
  })
);
