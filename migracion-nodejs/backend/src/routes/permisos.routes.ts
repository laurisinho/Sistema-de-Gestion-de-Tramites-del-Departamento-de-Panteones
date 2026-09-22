import { Router } from "express";
import { z } from "zod";
import type { Permiso } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hoyLocal } from "../lib/fechas";
import { requiereAuth, requiereEscritura } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";
import { filtrosLoteBusqueda, whereUbicacionLote } from "../lib/ubicacion";
import { renderPdf } from "../lib/pdf";
import { permisoHtml } from "../templates/permiso.template";
import { obtenerAparienciaDocumento } from "../lib/apariencia";

export const permisosRouter = Router();
permisosRouter.use(requiereAuth, requiereEscritura);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Sin filtros devuelve los últimos 50 (PermisosController.Index del original).
// Con filtros, hasta 100 resultados (BusquedaController.Permisos): folio,
// solicitante o fallecido en texto libre, más tipo y panteón. Una sola ruta
// cubre ambas pantallas.
permisosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const tipo = str(req.query.tipo);
    const seccion = str(req.query.seccion);
    const manzana = str(req.query.manzana);
    const lote = str(req.query.lote);
    const titular = str(req.query.titular);
    const colindancia = str(req.query.colindancia);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;
    const hayFiltros = !!(q || tipo || panteonId || seccion || manzana || lote || titular || colindancia);

    // Aquí "titular" es el del lote donde se hizo el trámite (título vigente), no
    // el solicitante, que ya cubre el buscador general.
    const filtrosLote = filtrosLoteBusqueda({ panteonId, seccion, manzana, lote, colindancia });
    if (titular) {
      filtrosLote.push({ titulos: { some: { estado: "VIGENTE", titular: { nombreCompleto: { contains: titular, mode: "insensitive" } } } } });
    }

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
        // Panteón, sección, manzana, lote, colindancia y titular van dentro del
        // mismo filtro de lote, combinados con AND (ver filtrosLoteBusqueda).
        ...(filtrosLote.length ? { lote: { AND: filtrosLote } } : {}),
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

  // Panteones antiguos sin título de propiedad: en lugar de elegir un lote
  // existente se captura su ubicación (manzana/lote o colindancias) y se crea u
  // obtiene el lote sin exigir título vigente.
  sinTituloRegistrado: z.boolean().default(false),
  panteonId: z.coerce.number().int().optional(),
  seccion: z.string().optional(),
  numeroManzana: z.string().optional(),
  numeroLote: z.string().optional(),
  colindanciaNorte: z.string().optional(),
  colindanciaSur: z.string().optional(),
  colindanciaEste: z.string().optional(),
  colindanciaOeste: z.string().optional(),

  motivoExhumacion: z.string().optional(),
  destinoRestos: z.string().optional(),
  ubicacionDeposito: z.string().optional(),
  tipoObra: z.string().optional(),
  descripcionObra: z.string().optional(),
  numeroRecibo: z.string().optional(),
  funeraria: z.string().optional(),
  esDonacion: z.boolean().default(false),
});

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Folio correlativo por tipo de trámite, a continuación de la numeración
// existente. Toma el número más alto usado en folios de ese tipo y suma 1
// (SEP-0066, SEP-0067, EXH-0001). Los migrados LEG-SEP-000XX se ignoran porque
// su sufijo no es numérico. Equivale a GenerarFolioPermiso del original.
async function generarFolioPermiso(clave: string, tipoTramiteId: number, tx: Tx): Promise<string> {
  const permisos = await tx.permiso.findMany({
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
    const existe = await tx.permiso.findUnique({ where: { folio } });
    if (!existe) return folio;
    siguiente++;
  }
}

function ubicacionLote(lote: { claveLegado: string | null; numeroManzana: string; numeroLote: string }): string {
  return lote.claveLegado ?? `Mz ${lote.numeroManzana} L ${lote.numeroLote}`;
}

// Al exhumar, los restos salen del lote. En fosa común eso lo deja libre para la
// siguiente persona no reclamada; un lote particular sigue siendo de su titular
// aunque quede vacío, por lo que no se marca como disponible. Si el difunto tenía
// un reconocimiento pendiente, se enlaza con este permiso (no reclamado ->
// identificado -> exhumado). Equivale a RegistrarExhumacionEnLote del original.
async function registrarExhumacionEnLote(permiso: Permiso, usuarioId: number, tx: Tx, ip?: string): Promise<void> {
  if (!permiso.loteId) return;

  const lote = await tx.lote.findUnique({ where: { loteId: permiso.loteId } });
  if (!lote) return;

  if (lote.esFosaComun) {
    await tx.lote.update({ where: { loteId: lote.loteId }, data: { estado: "DISPONIBLE" } });
  }

  // Normalmente se encuentra por difunto, porque el permiso ya se enlaza al
  // expediente existente. La búsqueda por lote cubre el caso en que el capturista
  // escribió el nombre en lugar de enlazarlo.
  let rec = permiso.fallecidoId
    ? await tx.reconocimiento.findFirst({
        where: { fallecidoId: permiso.fallecidoId, permisoExhumacionId: null },
        orderBy: { fechaReconocimiento: "desc" },
      })
    : null;

  rec ??= await tx.reconocimiento.findFirst({
    where: { loteId: lote.loteId, permisoExhumacionId: null },
    orderBy: { fechaReconocimiento: "desc" },
  });

  if (rec) {
    await tx.reconocimiento.update({
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

// Marca el lote como ocupado al sepultar o depositar cenizas. Solo registra en
// bitácora cuando el estado realmente cambia, porque casi todos los lotes ya
// están ocupados. Equivale a RegistrarOcupacionDeLote del original.
async function registrarOcupacionDeLote(permiso: Permiso, usuarioId: number, tx: Tx, ip?: string): Promise<void> {
  if (!permiso.loteId) return;

  const lote = await tx.lote.findUnique({ where: { loteId: permiso.loteId } });
  if (!lote || lote.estado === "OCUPADO") return;

  await tx.lote.update({ where: { loteId: lote.loteId }, data: { estado: "OCUPADO" } });

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

type UbicacionSinTitulo = {
  panteonId?: number;
  seccion?: string;
  numeroManzana?: string;
  numeroLote?: string;
  colindanciaNorte?: string;
  colindanciaSur?: string;
  colindanciaEste?: string;
  colindanciaOeste?: string;
};

// Panteones antiguos sin título de propiedad registrado: en lugar de buscar un
// lote existente (que exige título vigente o fosa común), se captura la
// ubicación según use el panteón y se obtiene o crea el lote. En los de
// colindancias el lote siempre es nuevo, con un consecutivo interno (mismo
// criterio que TitulosController.Nuevo).
async function resolverLoteSinTitulo(vm: UbicacionSinTitulo, tx: Tx): Promise<{ loteId: number } | { error: string }> {
  if (!vm.panteonId) return { error: "Selecciona el panteón." };
  const panteon = await tx.panteon.findUnique({ where: { panteonId: vm.panteonId } });
  if (!panteon) return { error: "Panteón no válido." };

  if (panteon.usaColindancias) {
    const existentes = await tx.lote.count({ where: { panteonId: vm.panteonId, numeroManzana: "S/N" } });
    const nuevoLote = await tx.lote.create({
      data: {
        panteonId: vm.panteonId,
        tipoLoteId: 1,
        numeroManzana: "S/N",
        numeroLote: String(existentes + 1),
        colindanciaNorte: vm.colindanciaNorte,
        colindanciaSur: vm.colindanciaSur,
        colindanciaEste: vm.colindanciaEste,
        colindanciaOeste: vm.colindanciaOeste,
      },
    });
    return { loteId: nuevoLote.loteId };
  }

  if (!vm.numeroManzana?.trim() || !vm.numeroLote?.trim()) {
    return { error: "Captura manzana y lote." };
  }
  const numeroManzana = vm.numeroManzana.trim();
  const numeroLote = vm.numeroLote.trim();
  const seccion = vm.seccion?.trim() || null;

  const existente = await tx.lote.findFirst({ where: whereUbicacionLote(vm.panteonId, seccion, numeroManzana, numeroLote) });
  if (existente) return { loteId: existente.loteId };

  const nuevoLote = await tx.lote.create({
    data: { panteonId: vm.panteonId, tipoLoteId: 1, numeroManzana, numeroLote, seccion },
  });
  return { loteId: nuevoLote.loteId };
}

permisosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = nuevoPermisoSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    if (!vm.loteId && !vm.sinTituloRegistrado) {
      return res.status(400).json({ error: "Debe seleccionar un lote." });
    }

    if (vm.loteId) {
      const loteSel = await prisma.lote.findUnique({ where: { loteId: vm.loteId } });
      const tieneTitulo = await prisma.tituloPropiedad.findFirst({
        where: { loteId: vm.loteId, estado: "VIGENTE" },
      });

      if (!tieneTitulo && !loteSel?.esFosaComun && !vm.sinTituloRegistrado) {
        return res.status(400).json({
          error: "El lote seleccionado no tiene un título de propiedad vigente. No se puede emitir el permiso.",
        });
      }
    } else {
      if (!vm.panteonId) {
        return res.status(400).json({ error: "Selecciona el panteón." });
      }
      const panteon = await prisma.panteon.findUnique({ where: { panteonId: vm.panteonId } });
      if (!panteon) return res.status(400).json({ error: "Panteón no válido." });
      if (!panteon.usaColindancias && (!vm.numeroManzana?.trim() || !vm.numeroLote?.trim())) {
        return res.status(400).json({ error: "Captura manzana y lote." });
      }
    }

    const usuarioId = req.usuario!.usuarioId;

    try {
      const resultado = await prisma.$transaction(async (tx) => {
        let loteId = vm.loteId ?? null;
        if (!loteId) {
          const resuelto = await resolverLoteSinTitulo(vm, tx);
          if ("error" in resuelto) throw new Error(resuelto.error);
          loteId = resuelto.loteId;
        }

        const solicitante = await tx.persona.create({
          data: {
            nombreCompleto: vm.nombreSolicitante,
            telefono: vm.telefonoSolicitante,
            domicilio: vm.domicilioSolicitante,
          },
        });

        // Si el capturista eligió un expediente existente se reutiliza; crear siempre
        // un difunto nuevo dejaba huérfano el registro de no reclamado y sin lote en el
        // reporte de Fiscalía.
        let fallecido = vm.fallecidoId
          ? await tx.fallecido.findUnique({ where: { fallecidoId: vm.fallecidoId } })
          : null;

        if (fallecido) {
          // Completa lo que le falte al expediente, sin pisar lo ya capturado.
          const data: { fechaFallecimiento?: Date; actaDefuncionNumero?: string } = {};
          if (!fallecido.fechaFallecimiento && vm.fechaFallecimiento) data.fechaFallecimiento = vm.fechaFallecimiento;
          if (!fallecido.actaDefuncionNumero?.trim() && vm.actaDefuncionNumero) data.actaDefuncionNumero = vm.actaDefuncionNumero;
          if (Object.keys(data).length > 0) {
            fallecido = await tx.fallecido.update({ where: { fallecidoId: fallecido.fallecidoId }, data });
          }
        }

        if (!fallecido && vm.nombreFallecido?.trim()) {
          fallecido = await tx.fallecido.create({
            data: {
              nombreCompleto: vm.nombreFallecido,
              fechaFallecimiento: vm.fechaFallecimiento,
              actaDefuncionNumero: vm.actaDefuncionNumero,
            },
          });
        }

        const tipoTramite = await tx.tipoTramite.findFirstOrThrow({ where: { clave: vm.tipoClave } });
        const folio = await generarFolioPermiso(vm.tipoClave, tipoTramite.tipoTramiteId, tx);

        const permiso = await tx.permiso.create({
          data: {
            tipoTramiteId: tipoTramite.tipoTramiteId,
            loteId,
            solicitanteId: solicitante.personaId,
            fallecidoId: fallecido?.fallecidoId,
            folio,
            fechaSolicitud: hoyLocal(),
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
            sinTituloRegistrado: vm.sinTituloRegistrado,
          },
        });

        // Una exhumación retira los restos: en fosa común eso libera el lote.
        if (vm.tipoClave === "EXH") {
          await registrarExhumacionEnLote(permiso, usuarioId, tx, req.ip);
        }

        // Sepultar o depositar cenizas vuelve a ocupar el lote; sin esto un lote de
        // fosa común liberado seguiría apareciendo como disponible.
        if (vm.tipoClave === "SEP" || vm.tipoClave === "CEN") {
          await registrarOcupacionDeLote(permiso, usuarioId, tx, req.ip);
        }

        return { permiso, folio, solicitante, tipoTramite };
      });

      await registrarBitacora(
        usuarioId,
        Acciones.Crear,
        "permisos",
        resultado.permiso.permisoId,
        `Permiso ${resultado.tipoTramite.nombre} ${resultado.folio} a nombre de ${resultado.solicitante.nombreCompleto}` +
          (vm.sinTituloRegistrado ? " (sin título de propiedad registrado)" : ""),
        req.ip
      );

      res.status(201).json({ permisoId: resultado.permiso.permisoId, folio: resultado.folio });
    } catch (err) {
      console.error("Error al registrar permiso (rollback aplicado):", err);
      res.status(500).json({ error: "No se pudo generar el permiso. No se guardó ningún cambio; inténtalo de nuevo." });
    }
  })
);

// Equivale a BusquedaController.EditarPermiso, con un agregado: el original
// solo dejaba actualizar el fallecido si el permiso ya tenía uno enlazado, así
// que un permiso capturado sin ese dato se quedaba sin forma de agregarlo
// después. Aquí, si no había fallecido y llega un nombre, se crea y se enlaza.
// Los campos del trámite se actualizan sin condición (los que no aplican al
// tipo quedan vacíos).
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

    // El original confirma solicitante, fallecido y permiso con un solo
    // SaveChangesAsync; aquí van en una transacción para que una falla intermedia no
    // deje el expediente a medias.
    await prisma.$transaction(async (tx) => {
      await tx.persona.update({
        where: { personaId: permiso.solicitanteId },
        data: {
          nombreCompleto: vm.nombreSolicitante.trim(),
          telefono: vm.telefonoSolicitante,
          domicilio: vm.domicilioSolicitante,
        },
      });

      let fallecidoId: number | undefined;
      if (permiso.fallecido && vm.nombreFallecido?.trim()) {
        await tx.fallecido.update({
          where: { fallecidoId: permiso.fallecido.fallecidoId },
          data: {
            nombreCompleto: vm.nombreFallecido.trim(),
            fechaFallecimiento: vm.fechaFallecimiento,
            actaDefuncionNumero: vm.actaDefuncionNumero,
          },
        });
      } else if (!permiso.fallecido && vm.nombreFallecido?.trim()) {
        const fallecido = await tx.fallecido.create({
          data: {
            nombreCompleto: vm.nombreFallecido.trim(),
            fechaFallecimiento: vm.fechaFallecimiento,
            actaDefuncionNumero: vm.actaDefuncionNumero,
          },
        });
        fallecidoId = fallecido.fallecidoId;
      }

      await tx.permiso.update({
        where: { permisoId: id },
        data: {
          fallecidoId,
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
    });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "permisos", id, `Permiso ${permiso.folio} editado`, req.ip);

    res.json({ ok: true });
  })
);

// Equivale a BusquedaController.EliminarPermiso: no borra la fila, la marca
// CANCELADO y conserva folio e historial.
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

    const apariencia = await obtenerAparienciaDocumento();
    const pdf = await renderPdf(permisoHtml(permiso, apariencia));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Permiso_${permiso.folio}.pdf"`);
    res.send(pdf);
  })
);
