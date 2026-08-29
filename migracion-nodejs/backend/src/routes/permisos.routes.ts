import { Router } from "express";
import { z } from "zod";
import type { Permiso } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { renderPdf } from "../lib/pdf";
import { permisoHtml } from "../templates/permiso.template";

export const permisosRouter = Router();
permisosRouter.use(requiereAuth);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Sin filtros: últimos 50 (como PermisosController.Index). Con filtros: hasta
// 100 resultados (como BusquedaController.Permisos) -- misma ruta cubre ambas
// pantallas del original, folio/solicitante/fallecido en texto libre + tipo +
// panteón, con estado persistido en la URL por el propio querystring.
permisosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const tipo = str(req.query.tipo);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const hayFiltros = !!(q || tipo || panteonId);

    const permisos = await prisma.permiso.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { folio: { contains: q, mode: "insensitive" } },
                { solicitante: { nombreCompleto: { contains: q, mode: "insensitive" } } },
                { fallecido: { nombreCompleto: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(tipo ? { tipoTramite: { clave: tipo } } : {}),
        ...(panteonId ? { lote: { panteonId } } : {}),
      },
      include: {
        tipoTramite: true,
        solicitante: true,
        fallecido: true,
        lote: { include: { panteon: true } },
      },
      orderBy: { fechaCreacion: "desc" },
      take: hayFiltros ? 100 : 50,
    });
    res.json({ permisos });
  })
);

permisosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const permiso = await prisma.permiso.findUnique({
      where: { permisoId: Number(req.params.id) },
      include: {
        tipoTramite: true,
        solicitante: true,
        fallecido: true,
        lote: { include: { panteon: true } },
        usuarioRegistro: { select: { nombreCompleto: true } },
      },
    });
    if (!permiso) return res.status(404).json({ error: "Permiso no encontrado" });
    res.json({ permiso });
  })
);

const fechaISO = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
  .transform((s) => new Date(s));

const nuevoPermisoSchema = z.object({
  tipoClave: z.string().min(1).default("SEP"),
  nombreSolicitante: z.string().min(1, "El nombre del solicitante es requerido"),
  telefonoSolicitante: z.string().optional(),
  domicilioSolicitante: z.string().optional(),

  fallecidoId: z.coerce.number().int().optional(),
  nombreFallecido: z.string().optional(),
  fechaFallecimiento: fechaISO.optional(),
  actaDefuncionNumero: z.string().optional(),

  loteId: z.coerce.number().int().optional(),

  motivoExhumacion: z.string().optional(),
  destinoRestos: z.string().optional(),
  ubicacionDeposito: z.string().optional(),
  tipoObra: z.string().optional(),
  descripcionObra: z.string().optional(),
  numeroRecibo: z.string().optional(),
  funeraria: z.string().optional(),
  esDonacion: z.boolean().default(false),
});

// Folio correlativo por tipo de trámite que continúa la numeración existente.
// Toma el número más alto usado en folios de ese tipo (incluye los migrados
// LEG-SEP-000XX, que se ignoran porque su sufijo no es puramente numérico) y
// suma 1. Ej: SEP-0066, SEP-0067, EXH-0001. Puerto exacto de GenerarFolioPermiso.
async function generarFolioPermiso(clave: string, tipoTramiteId: number): Promise<string> {
  const permisos = await prisma.permiso.findMany({
    where: { tipoTramiteId },
    select: { folio: true },
  });

  let max = 0;
  for (const { folio } of permisos) {
    const ultimo = folio.split("-").pop() ?? "";
    if (/^\d+$/.test(ultimo)) {
      const num = Number(ultimo);
      if (num > max) max = num;
    }
  }

  let siguiente = max + 1;
  for (;;) {
    const folio = `${clave}-${String(siguiente).padStart(4, "0")}`;
    const existe = await prisma.permiso.findUnique({ where: { folio } });
    if (!existe) return folio;
    siguiente++;
  }
}

function ubicacionLote(lote: { claveLegado: string | null; numeroManzana: string; numeroLote: string }): string {
  return lote.claveLegado ?? `Mz ${lote.numeroManzana} L ${lote.numeroLote}`;
}

// Al exhumar, los restos salen del lote. En fosa común eso lo deja libre para la
// siguiente persona no reclamada; un lote particular sigue siendo de su titular
// aunque quede vacío, así que NO se marca como disponible. Si el difunto tenía un
// reconocimiento pendiente, se enlaza con este permiso para cerrar el ciclo
// "no reclamado -> identificado -> exhumado". Puerto exacto de RegistrarExhumacionEnLote.
async function registrarExhumacionEnLote(permiso: Permiso, usuarioId: number, ip?: string): Promise<void> {
  if (!permiso.loteId) return;

  const lote = await prisma.lote.findUnique({ where: { loteId: permiso.loteId } });
  if (!lote) return;

  if (lote.esFosaComun) {
    await prisma.lote.update({ where: { loteId: lote.loteId }, data: { estado: "DISPONIBLE" } });
  }

  // Lo normal es encontrarlo por difunto, porque el permiso ya se enlaza al
  // expediente existente. La búsqueda por lote queda de red: cubre el caso en
  // que el capturista escribió el nombre en vez de enlazarlo.
  let rec = permiso.fallecidoId
    ? await prisma.reconocimiento.findFirst({
        where: { fallecidoId: permiso.fallecidoId, permisoExhumacionId: null },
        orderBy: { fechaReconocimiento: "desc" },
      })
    : null;

  rec ??= await prisma.reconocimiento.findFirst({
    where: { loteId: lote.loteId, permisoExhumacionId: null },
    orderBy: { fechaReconocimiento: "desc" },
  });

  if (rec) {
    await prisma.reconocimiento.update({
      where: { reconocimientoId: rec.reconocimientoId },
      data: { permisoExhumacionId: permiso.permisoId },
    });
  }

  const ubicacion = ubicacionLote(lote);
  await registrarBitacora(
    usuarioId,
    Acciones.Liberar,
    "lotes",
    lote.loteId,
    lote.esFosaComun
      ? `Lote ${ubicacion} liberado por exhumación (permiso ${permiso.folio})`
      : `Exhumación en el lote ${ubicacion} (permiso ${permiso.folio}); conserva a su titular, no se marca como disponible`,
    ip
  );
}

// Marca el lote como ocupado al sepultar o depositar cenizas. Sólo deja rastro
// en bitácora cuando el estado de verdad cambió: casi todos los lotes ya están
// ocupados y registrarlo siempre sería puro ruido. Puerto exacto de RegistrarOcupacionDeLote.
async function registrarOcupacionDeLote(permiso: Permiso, usuarioId: number, ip?: string): Promise<void> {
  if (!permiso.loteId) return;

  const lote = await prisma.lote.findUnique({ where: { loteId: permiso.loteId } });
  if (!lote || lote.estado === "OCUPADO") return;

  await prisma.lote.update({ where: { loteId: lote.loteId }, data: { estado: "OCUPADO" } });

  const ubicacion = ubicacionLote(lote);
  await registrarBitacora(
    usuarioId,
    Acciones.Editar,
    "lotes",
    lote.loteId,
    `Lote ${ubicacion} ocupado por el permiso ${permiso.folio}`,
    ip
  );
}

permisosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = nuevoPermisoSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    if (!vm.loteId) {
      return res.status(400).json({ error: "Debe seleccionar un lote." });
    }

    const loteSel = await prisma.lote.findUnique({ where: { loteId: vm.loteId } });

    const tieneTitulo = await prisma.tituloPropiedad.findFirst({
      where: { loteId: vm.loteId, estado: "VIGENTE" },
    });

    if (!tieneTitulo && !loteSel?.esFosaComun) {
      return res.status(400).json({
        error: "El lote seleccionado no tiene un título de propiedad vigente. No se puede emitir el permiso.",
      });
    }

    const usuarioId = req.usuario!.usuarioId;

    const solicitante = await prisma.persona.create({
      data: {
        nombreCompleto: vm.nombreSolicitante,
        telefono: vm.telefonoSolicitante,
        domicilio: vm.domicilioSolicitante,
      },
    });

    // Si el capturista eligió un expediente existente se reutiliza. Antes se
    // creaba siempre un difunto nuevo, lo que dejaba huérfano al registro de no
    // reclamado y salía sin lote en el reporte de Fiscalía -- es el bug que
    // motivó todo este bloque, no simplificar de vuelta a "siempre crear".
    let fallecido = vm.fallecidoId
      ? await prisma.fallecido.findUnique({ where: { fallecidoId: vm.fallecidoId } })
      : null;

    if (fallecido) {
      // Completa lo que le falte al expediente, sin pisar lo ya capturado.
      const data: { fechaFallecimiento?: Date; actaDefuncionNumero?: string } = {};
      if (!fallecido.fechaFallecimiento && vm.fechaFallecimiento) data.fechaFallecimiento = vm.fechaFallecimiento;
      if (!fallecido.actaDefuncionNumero?.trim() && vm.actaDefuncionNumero) data.actaDefuncionNumero = vm.actaDefuncionNumero;
      if (Object.keys(data).length > 0) {
        fallecido = await prisma.fallecido.update({ where: { fallecidoId: fallecido.fallecidoId }, data });
      }
    }

    if (!fallecido && vm.nombreFallecido?.trim()) {
      fallecido = await prisma.fallecido.create({
        data: {
          nombreCompleto: vm.nombreFallecido,
          fechaFallecimiento: vm.fechaFallecimiento,
          actaDefuncionNumero: vm.actaDefuncionNumero,
        },
      });
    }

    const tipoTramite = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: vm.tipoClave } });
    const folio = await generarFolioPermiso(vm.tipoClave, tipoTramite.tipoTramiteId);

    const permiso = await prisma.permiso.create({
      data: {
        tipoTramiteId: tipoTramite.tipoTramiteId,
        loteId: vm.loteId,
        solicitanteId: solicitante.personaId,
        fallecidoId: fallecido?.fallecidoId,
        folio,
        fechaSolicitud: new Date(new Date().toDateString()),
        usuarioRegistroId: usuarioId,
        estado: "APROBADO",
        motivoExhumacion: vm.motivoExhumacion,
        destinoRestos: vm.destinoRestos,
        ubicacionDeposito: vm.ubicacionDeposito,
        tipoObra: vm.tipoObra,
        descripcionObra: vm.descripcionObra,
        numeroRecibo: vm.numeroRecibo,
        funeraria: vm.funeraria,
        esDonacion: vm.esDonacion,
      },
    });

    await registrarBitacora(
      usuarioId,
      Acciones.Crear,
      "permisos",
      permiso.permisoId,
      `Permiso ${tipoTramite.nombre} ${folio} a nombre de ${solicitante.nombreCompleto}`,
      req.ip
    );

    // Una exhumación retira los restos: en fosa común eso libera el lote.
    if (vm.tipoClave === "EXH") {
      await registrarExhumacionEnLote(permiso, usuarioId, req.ip);
    }

    // Sepultar o depositar cenizas vuelve a ocupar el lote. Sin esto, un lote de
    // fosa común liberado seguía anunciándose como disponible aunque ya se
    // hubiera vuelto a usar.
    if (vm.tipoClave === "SEP" || vm.tipoClave === "CEN") {
      await registrarOcupacionDeLote(permiso, usuarioId, req.ip);
    }

    res.status(201).json({ permisoId: permiso.permisoId, folio });
  })
);

// Puerto exacto de BusquedaController.EditarPermiso: el solicitante siempre
// se actualiza; el fallecido solo si el permiso ya tiene uno enlazado y
// mandaron un nombre; los campos del trámite se actualizan sin condición
// (los que no aplican al tipo simplemente quedan vacíos).
const editarPermisoSchema = z.object({
  nombreSolicitante: z.string().min(1, "El nombre del solicitante es requerido"),
  telefonoSolicitante: z.string().optional(),
  domicilioSolicitante: z.string().optional(),
  nombreFallecido: z.string().optional(),
  fechaFallecimiento: fechaISO.optional(),
  actaDefuncionNumero: z.string().optional(),
  fechaSolicitud: fechaISO.optional(),
  estado: z.enum(["APROBADO", "PENDIENTE", "RECHAZADO", "CANCELADO"]),
  numeroRecibo: z.string().optional(),
  funeraria: z.string().optional(),
  motivoExhumacion: z.string().optional(),
  destinoRestos: z.string().optional(),
  tipoObra: z.string().optional(),
  descripcionObra: z.string().optional(),
  esDonacion: z.boolean().default(false),
});

permisosRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const permiso = await prisma.permiso.findUnique({ where: { permisoId: id }, include: { fallecido: true } });
    if (!permiso) return res.status(404).json({ error: "Permiso no encontrado" });

    const parseo = editarPermisoSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    await prisma.persona.update({
      where: { personaId: permiso.solicitanteId },
      data: {
        nombreCompleto: vm.nombreSolicitante.trim(),
        telefono: vm.telefonoSolicitante,
        domicilio: vm.domicilioSolicitante,
      },
    });

    if (permiso.fallecido && vm.nombreFallecido?.trim()) {
      await prisma.fallecido.update({
        where: { fallecidoId: permiso.fallecido.fallecidoId },
        data: {
          nombreCompleto: vm.nombreFallecido.trim(),
          fechaFallecimiento: vm.fechaFallecimiento,
          actaDefuncionNumero: vm.actaDefuncionNumero,
        },
      });
    }

    await prisma.permiso.update({
      where: { permisoId: id },
      data: {
        fechaSolicitud: vm.fechaSolicitud,
        estado: vm.estado,
        numeroRecibo: vm.numeroRecibo,
        funeraria: vm.funeraria,
        motivoExhumacion: vm.motivoExhumacion,
        destinoRestos: vm.destinoRestos,
        tipoObra: vm.tipoObra,
        descripcionObra: vm.descripcionObra,
        esDonacion: vm.esDonacion,
      },
    });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "permisos", id, `Permiso ${permiso.folio} editado`, req.ip);

    res.json({ ok: true });
  })
);

// Puerto exacto de BusquedaController.EliminarPermiso: nunca borra la fila,
// solo la marca CANCELADO -- conserva el folio y el historial.
permisosRouter.post(
  "/:id/cancelar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const permiso = await prisma.permiso.findUnique({ where: { permisoId: id } });
    if (!permiso) return res.status(404).json({ error: "Permiso no encontrado" });

    await prisma.permiso.update({ where: { permisoId: id }, data: { estado: "CANCELADO" } });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Cancelar, "permisos", id, `Permiso ${permiso.folio} cancelado`, req.ip);

    res.json({ ok: true });
  })
);

permisosRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const permiso = await prisma.permiso.findUnique({
      where: { permisoId: Number(req.params.id) },
      include: { tipoTramite: true, solicitante: true, fallecido: true, lote: { include: { panteon: true } } },
    });
    if (!permiso) return res.status(404).json({ error: "Permiso no encontrado" });

    const pdf = await renderPdf(permisoHtml(permiso));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Permiso_${permiso.folio}.pdf"`);
    res.send(pdf);
  })
);
