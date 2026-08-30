import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

export const lotesRouter = Router();
lotesRouter.use(requiereAuth);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Buscador de lotes para llegar al expediente. Sin filtros no devuelve nada:
// son casi 7,000 lotes y volcarlos no le sirve a nadie (igual que en el .NET original).
lotesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const manzana = str(req.query.manzana);
    const lote = str(req.query.lote);
    const clave = str(req.query.clave);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;

    if (!manzana && !lote && !clave) {
      return res.json({ resultados: [] });
    }

    const where: Prisma.LoteWhereInput = {};
    if (panteonId) where.panteonId = panteonId;
    if (manzana) where.numeroManzana = { contains: manzana, mode: "insensitive" };
    if (lote) where.numeroLote = { contains: lote, mode: "insensitive" };
    if (clave) {
      where.OR = [
        { claveLegado: { contains: clave, mode: "insensitive" } },
        { seccion: { contains: clave, mode: "insensitive" } },
      ];
    }

    const lotes = await prisma.lote.findMany({
      where,
      include: {
        panteon: true,
        titulos: { where: { estado: "VIGENTE" }, include: { titular: true }, take: 1 },
        _count: { select: { permisos: true } },
      },
    });

    const igual = (a: string, b?: string) => !!b && a.toLowerCase() === b.toLowerCase();

    // "3" también coincide con 13, 33, 34...: la coincidencia exacta va primero.
    // Se ordena en memoria (no en la DB) porque el total de coincidencias es
    // acotado -- filtrar primero por manzana/lote/clave ya reduce el conjunto.
    const resultados = lotes
      .sort((a, b) => {
        const am = igual(a.numeroManzana, manzana) ? 0 : 1;
        const bm = igual(b.numeroManzana, manzana) ? 0 : 1;
        if (am !== bm) return am - bm;

        const al = igual(a.numeroLote, lote) ? 0 : 1;
        const bl = igual(b.numeroLote, lote) ? 0 : 1;
        if (al !== bl) return al - bl;

        return (
          (a.seccion ?? "").localeCompare(b.seccion ?? "") ||
          a.numeroManzana.localeCompare(b.numeroManzana) ||
          a.numeroLote.localeCompare(b.numeroLote)
        );
      })
      .slice(0, 60)
      .map((l) => ({
        loteId: l.loteId,
        panteon: l.panteon.nombre,
        seccion: l.seccion,
        numeroManzana: l.numeroManzana,
        numeroLote: l.numeroLote,
        claveLegado: l.claveLegado,
        estado: l.estado,
        esFosaComun: l.esFosaComun,
        titular: l.titulos[0]?.titular.nombreCompleto ?? null,
        permisosCount: l._count.permisos,
      }));

    res.json({ resultados });
  })
);

// Buscador de lotes para asignar en un permiso nuevo (PermisosController.BuscarLote).
// A diferencia del buscador de expedientes de arriba, aquí solo se muestran los
// lotes que de verdad se pueden usar: ocupados, de fosa común (donde se sepulta a
// la siguiente persona no reclamada), o con título vigente (para que no
// desaparezca un lote que quedó vacío pero sigue siendo de su titular).
lotesRouter.get(
  "/buscar",
  asyncHandler(async (req, res) => {
    const manzana = str(req.query.manzana);
    const lote = str(req.query.lote);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;

    const where: Prisma.LoteWhereInput = {
      OR: [{ estado: "OCUPADO" }, { esFosaComun: true }, { titulos: { some: { estado: "VIGENTE" } } }],
    };
    if (panteonId) where.panteonId = panteonId;
    if (manzana) where.numeroManzana = { contains: manzana, mode: "insensitive" };
    if (lote) where.numeroLote = { contains: lote, mode: "insensitive" };

    const lotes = await prisma.lote.findMany({
      where,
      include: {
        panteon: true,
        titulos: { where: { estado: "VIGENTE" }, include: { titular: true }, take: 1 },
      },
      take: 20,
    });

    res.json(
      lotes.map((l) => ({
        loteId: l.loteId,
        panteon: l.panteon.nombre,
        manzana: l.numeroManzana,
        lote: l.numeroLote,
        seccion: l.seccion,
        clave: l.claveLegado,
        estado: l.estado,
        esFosaComun: l.esFosaComun,
        titular: l.titulos[0]?.titular.nombreCompleto ?? (l.esFosaComun ? "Fosa común — sin titular" : "Sin titular"),
        tieneTitulo: l.titulos.length > 0 || l.esFosaComun,
      }))
    );
  })
);

// Un lote de fosa común se libera cuando se aprueba el permiso de exhumación
// de quien lo ocupaba. Aquí se ve dónde puede sepultarse a la siguiente
// persona no reclamada. Puerto exacto de NoReclamadosController.LotesDisponibles.
lotesRouter.get(
  "/fosa-comun-disponibles",
  asyncHandler(async (req, res) => {
    const seccion = str(req.query.seccion);

    const where: Prisma.LoteWhereInput = { esFosaComun: true };
    if (seccion) where.seccion = seccion;

    const lotes = await prisma.lote.findMany({ where, include: { panteon: true } });
    const disponibles = lotes.filter((l) => l.estado === "DISPONIBLE");

    // Historial de ocupantes previos de los lotes liberados. Sólo cuentan los
    // permisos de sepultura: el de exhumación apunta al mismo difunto y lo
    // duplicaría en la lista.
    const idsDisponibles = disponibles.map((l) => l.loteId);
    const historialPermisos = await prisma.permiso.findMany({
      where: { loteId: { in: idsDisponibles }, fallecidoId: { not: null }, tipoTramite: { clave: "SEP" } },
      include: { fallecido: true },
      orderBy: { permisoId: "asc" },
    });

    const historial = new Map<
      number,
      { fallecidoId: number; nombreCompleto: string; reconocido: boolean; posibleNombre: string | null }[]
    >();
    for (const p of historialPermisos) {
      if (!p.loteId || !p.fallecido) continue;
      const lista = historial.get(p.loteId) ?? [];
      lista.push({
        fallecidoId: p.fallecido.fallecidoId,
        nombreCompleto: p.fallecido.nombreCompleto,
        reconocido: p.fallecido.reconocido,
        posibleNombre: p.fallecido.posibleNombre,
      });
      historial.set(p.loteId, lista);
    }

    const parseNumeroLote = (s: string) => {
      const n = Number(s);
      return Number.isInteger(n) ? n : Number.MAX_SAFE_INTEGER;
    };

    const ordenados = [...disponibles].sort(
      (a, b) =>
        (a.seccion ?? "").localeCompare(b.seccion ?? "") ||
        a.numeroManzana.localeCompare(b.numeroManzana) ||
        parseNumeroLote(a.numeroLote) - parseNumeroLote(b.numeroLote) ||
        a.numeroLote.localeCompare(b.numeroLote)
    );

    res.json({
      lotes: ordenados.map((l) => ({
        loteId: l.loteId,
        panteon: l.panteon.nombre,
        seccion: l.seccion,
        numeroManzana: l.numeroManzana,
        numeroLote: l.numeroLote,
        claveLegado: l.claveLegado,
        historial: historial.get(l.loteId) ?? [],
      })),
      secciones: [...new Set(lotes.map((l) => l.seccion ?? "(sin sección)"))].sort(),
      seccion: seccion ?? null,
      totalFosaComun: lotes.length,
      ocupados: lotes.filter((l) => l.estado !== "DISPONIBLE").length,
    });
  })
);

interface EventoLote {
  fecha: Date | null;
  tipo: string;
  titulo: string;
  detalle: string | null;
  folio: string | null;
  icono: string;
  color: string;
  enlace: string | null;
}

// Las fechas centinela (1900/1905) de la migración se tratan como vacías.
function limpia(f: Date | null): Date | null {
  return !f || f.getUTCFullYear() <= 1905 ? null : f;
}

function junta(...partes: (string | null | undefined)[]): string | null {
  const p = partes.filter((s): s is string => !!s && s.trim() !== "");
  return p.length ? p.join(" · ") : null;
}

// Todo lo que le ha pasado a una tumba en una sola línea de tiempo: título,
// cesiones, inhumaciones, exhumaciones, obras e identificaciones. Sin esto hay
// que reconstruir la historia brincando entre módulos.
lotesRouter.get(
  "/:id/expediente",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const lote = await prisma.lote.findUnique({
      where: { loteId: id },
      include: { panteon: true, tipoLote: true },
    });
    if (!lote) return res.status(404).json({ error: "Lote no encontrado" });

    const [titulos, cesiones, permisos, reconocimientos] = await Promise.all([
      prisma.tituloPropiedad.findMany({ where: { loteId: id }, include: { titular: true } }),
      prisma.cesionDerechos.findMany({ where: { loteId: id }, include: { cedente: true, cesionario: true } }),
      prisma.permiso.findMany({
        where: { loteId: id },
        include: { tipoTramite: true, fallecido: true, solicitante: true },
      }),
      prisma.reconocimiento.findMany({ where: { loteId: id }, include: { fallecido: true } }),
    ]);

    const eventos: EventoLote[] = [];

    for (const t of titulos) {
      const vigente = t.estado === "VIGENTE";
      eventos.push({
        fecha: limpia(t.fechaEmision),
        tipo: "Título de propiedad",
        titulo: t.titular?.nombreCompleto ?? "Sin titular",
        detalle: vigente ? "Título vigente" : `Título ${t.estado.toLowerCase()}`,
        folio: t.folio,
        icono: "bi-award",
        color: vigente ? "dorado" : "gris",
        enlace: null,
      });
    }

    for (const c of cesiones) {
      eventos.push({
        fecha: limpia(c.fechaCesion),
        tipo: "Cesión de derechos",
        titulo: `${c.cedente?.nombreCompleto ?? "?"} → ${c.cesionario?.nombreCompleto ?? "?"}`,
        detalle: c.estado === "VIGENTE" ? null : `Cesión ${c.estado.toLowerCase()}`,
        folio: c.folio,
        icono: "bi-arrow-left-right",
        color: "azul",
        enlace: null,
      });
    }

    for (const p of permisos) {
      const clave = p.tipoTramite?.clave ?? "";
      const { icono, color } =
        clave === "SEP"
          ? { icono: "bi-flower1", color: "guinda" }
          : clave === "EXH"
            ? { icono: "bi-box-arrow-up", color: "verde" }
            : clave === "CEN"
              ? { icono: "bi-fire", color: "azul" }
              : clave === "CON"
                ? { icono: "bi-hammer", color: "gris" }
                : { icono: "bi-file-earmark", color: "gris" };

      const detalle =
        clave === "EXH"
          ? junta(p.motivoExhumacion, p.destinoRestos)
          : clave === "CON"
            ? junta(p.tipoObra, p.descripcionObra)
            : (p.instanciaSolicita ?? p.funeraria);

      eventos.push({
        fecha: limpia(p.fechaSolicitud),
        tipo: p.tipoTramite?.nombre ?? clave,
        titulo: p.fallecido?.nombreCompleto ?? p.solicitante?.nombreCompleto ?? "Sin nombre registrado",
        // Un permiso CANCELADO no representa un movimiento real (sepultura,
        // exhumación...) y sin esta nota se leía en la línea de tiempo igual
        // que uno vigente -- títulos y cesiones ya marcan su estado, permisos no.
        detalle: p.estado === "CANCELADO" ? junta(detalle, "Permiso cancelado") : (detalle ?? null),
        folio: p.folio,
        icono: p.estado === "CANCELADO" ? "bi-slash-circle" : icono,
        color: p.estado === "CANCELADO" ? "gris" : color,
        enlace: `/permisos/${p.permisoId}/pdf`,
      });
    }

    for (const r of reconocimientos) {
      eventos.push({
        fecha: limpia(r.fechaReconocimiento),
        tipo: "Identificación",
        titulo: `${r.nombreAnterior} → ${r.nombreIdentificado}`,
        detalle: r.medioIdentificacion,
        folio: null,
        icono: "bi-person-check",
        color: "verde",
        enlace: r.fallecidoId > 0 ? `/no-reclamados/${r.fallecidoId}` : null,
      });
    }

    // Orden narrativo: lo más viejo primero. Lo que no trae fecha va al final.
    eventos.sort((a, b) => {
      if (a.fecha === null && b.fecha === null) return 0;
      if (a.fecha === null) return 1;
      if (b.fecha === null) return -1;
      return a.fecha.getTime() - b.fecha.getTime();
    });

    const tituloVigente = titulos.find((t) => t.estado === "VIGENTE") ?? null;

    const ubicacion = [
      lote.panteon.nombre,
      lote.seccion ? `Secc. ${lote.seccion}` : null,
      `Mz ${lote.numeroManzana}`,
      `Lote ${lote.numeroLote}`,
    ]
      .filter((x): x is string => !!x)
      .join(" · ");

    const inhumaciones = permisos.filter((p) => p.tipoTramite?.clave === "SEP").length;
    const exhumaciones = permisos.filter((p) => p.tipoTramite?.clave === "EXH").length;

    // Ocupantes actuales = inhumados menos los que ya salieron por exhumación.
    const exhumados = new Set(
      permisos.filter((p) => p.tipoTramite?.clave === "EXH" && p.fallecidoId != null).map((p) => p.fallecidoId as number)
    );
    const ocupantes = permisos
      .filter((p) => p.tipoTramite?.clave === "SEP" && p.fallecidoId != null && !exhumados.has(p.fallecidoId as number))
      .map((p) => p.fallecido!.nombreCompleto);

    res.json({
      lote,
      ubicacion,
      tituloVigente,
      eventos,
      inhumaciones,
      exhumaciones,
      ocupantes,
    });
  })
);
