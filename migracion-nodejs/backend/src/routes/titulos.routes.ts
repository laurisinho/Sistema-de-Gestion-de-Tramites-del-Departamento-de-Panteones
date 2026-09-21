import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hoyLocal } from "../lib/fechas";
import { requiereAuth, requiereEscritura } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { generarFolio } from "../lib/folio";
import { filtrosLoteBusqueda, whereUbicacionLote } from "../lib/ubicacion";
import { renderPdf } from "../lib/pdf";
import { tituloHtml } from "../templates/titulo.template";
import { obtenerAparienciaDocumento } from "../lib/apariencia";

export const titulosRouter = Router();
titulosRouter.use(requiereAuth, requiereEscritura);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Sin filtros devuelve los últimos 50 (TitulosController.Index). Con filtros,
// hasta 100 (BusquedaController.Index/Buscar) por folio, titular, manzana o lote
// en texto libre más panteón, en cualquier estado. A diferencia de /buscar, que
// solo trae VIGENTES para elegir un título a ceder.
titulosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const seccion = str(req.query.seccion);
    const manzana = str(req.query.manzana);
    const lote = str(req.query.lote);
    const titular = str(req.query.titular);
    const colindancia = str(req.query.colindancia);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const porFallecido = req.query.tipoBusqueda === "fallecido";
    const hayFiltros = !!(q || panteonId || seccion || manzana || lote || titular || colindancia);
    const filtrosLote = filtrosLoteBusqueda({ panteonId, seccion, manzana, lote, colindancia });

    // Modo "buscar por fallecido" (BusquedaController.Buscar, tipo="fallecido"): el
    // nombre del difunto no está en el título, así que primero se buscan los lotes
    // donde se sepultó a alguien con ese nombre (permiso de inhumación) y luego los
    // títulos de esos lotes.
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
        ...(titular ? { titular: { nombreCompleto: { contains: titular, mode: "insensitive" as const } } } : {}),
        // Panteón, sección, manzana, lote y colindancia van dentro del mismo
        // filtro de lote, combinados con AND (ver filtrosLoteBusqueda).
        ...(filtrosLote.length ? { lote: { AND: filtrosLote } } : {}),
      },
      include: { titular: true, lote: { include: { panteon: true } } },
      orderBy: { fechaCreacion: "desc" },
      take: hayFiltros ? 100 : 50,
    });
    res.json({ titulos });
  })
);

// Búsqueda de títulos VIGENTES por folio, titular, manzana o lote, para elegir
// cuál se cede. Equivale a CesionesController.BuscarTitulo. Va antes de "/:id":
// si quedara después, "buscar" se interpretaría como un tituloId.
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

// Equivale a BusquedaController.Detalle: además del título, trae los fallecidos
// sepultados en el lote y el historial de permisos, para ver el expediente
// completo de un vistazo.
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
  numeroRecibo: z.string().optional(),
});

// Emite un título de propiedad para un lote nuevo (a diferencia de Permisos, que
// opera sobre lotes existentes). Equivale a TitulosController.Nuevo.
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
    // Lote que ya existe en esa ubicación sin título vigente, típicamente porque
    // un permiso "sin título registrado" lo creó. El título se emite sobre ese
    // mismo lote en lugar de rechazarse.
    let loteSinTitulo: { loteId: number } | null = null;

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

      // La sección entra en la comprobación porque también forma parte de la
      // restricción de unicidad de la base (ver lib/ubicacion).
      const existe = await prisma.lote.findFirst({
        where: whereUbicacionLote(vm.panteonId, vm.seccion ?? null, manzana, lote),
      });
      if (existe) {
        // Solo es un conflicto si el lote ya tiene un título vigente. Sin él, el
        // lote existe únicamente por un permiso y falta emitirle el título.
        const vigente = await prisma.tituloPropiedad.findFirst({
          where: { loteId: existe.loteId, estado: "VIGENTE" },
          include: { titular: true },
        });
        if (vigente) {
          const enSeccion = vm.seccion ? ` en la sección ${vm.seccion}` : "";
          return res.status(409).json({
            error:
              `Ese lote ya tiene título vigente: Manzana ${manzana} y Lote ${lote}${enSeccion}, ` +
              `folio ${vigente.folio} a nombre de ${vigente.titular.nombreCompleto}.`,
          });
        }
        loteSinTitulo = existe;
      }
    }

    // Persona, lote y título se confirman juntos: si el título fallara después de
    // crear la persona y el lote (p. ej. choque de folio entre dos capturistas
    // simultáneos), quedarían un titular huérfano y un lote OCUPADO sin título.
    try {
      const resultado = await prisma.$transaction(async (tx) => {
        // El folio sigue la forma de las claves de esa misma sección (ver lib/folio).
        const clave = panteon.clave?.trim() || `P${vm.panteonId}`;
        const seccion = panteon.usaColindancias ? null : vm.seccion ?? null;
        const folio = await generarFolio(tx, vm.panteonId, clave, seccion, manzana, lote);

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

        // Si el lote ya existía se conserva tal cual (clave, tipo y demás datos);
        // sus permisos anteriores siguen enlazados a él.
        const nuevoLote = loteSinTitulo
          ? await tx.lote.update({ where: { loteId: loteSinTitulo.loteId }, data: { estado: "OCUPADO" } })
          : await tx.lote.create({
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
            fechaEmision: vm.fechaEmision ?? hoyLocal(),
            usuarioEmitioId: usuarioId,
            estado: "VIGENTE",
            estadoEntrega: "PENDIENTE_ENTREGA",
            numeroRecibo: vm.numeroRecibo,
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

      // Se devuelve el loteId para encadenar el permiso de sepultura sin volver a
      // buscar el lote recién creado.
      res.status(201).json({
        tituloId: resultado.titulo.tituloId,
        folio: resultado.folio,
        loteId: resultado.titulo.loteId,
      });
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
        fechaEntrega: estadoEntrega === "ENTREGADO" ? hoyLocal() : titulo.fechaEntrega,
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

// Equivale a BusquedaController.EditarExpediente: titular, lote (manzana/lote/
// sección, o las 4 colindancias si NumeroManzana=="S/N") y datos del título en
// un solo guardado.
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
  numeroRecibo: z.string().optional(),
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

    // El original confirma titular, lote y título con un solo SaveChangesAsync; aquí
    // van en una transacción para que una falla intermedia no deje el expediente a
    // medias.
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
          numeroRecibo: vm.numeroRecibo,
        },
      });
    });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "titulos_propiedad", id, `Título ${titulo.folio} editado`, req.ip);

    res.json({ ok: true });
  })
);

// Equivale a BusquedaController.EliminarExpediente: no borra la fila, la marca
// CANCELADO.
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

    const apariencia = await obtenerAparienciaDocumento();
    const pdf = await renderPdf(tituloHtml(titulo, apariencia));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Titulo_${titulo.folio}.pdf"`);
    res.send(pdf);
  })
);
