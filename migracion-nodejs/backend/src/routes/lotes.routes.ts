import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { variantesManzana } from "../lib/romanos";
import { whereSeccion } from "../lib/ubicacion";

export const lotesRouter = Router();
lotesRouter.use(requiereAuth);

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

// Buscador de lotes para llegar al expediente. Sin filtros no devuelve nada:
// con miles de lotes, listarlos todos no sirve (igual que en el original).
lotesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const manzana = str(req.query.manzana);
    const lote = str(req.query.lote);
    const clave = str(req.query.clave);
    // La sección se elige de una lista, por lo que se compara exacta.
    const seccion = str(req.query.seccion);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;

    if (!manzana && !lote && !clave && !seccion) {
      return res.json({ resultados: [] });
    }

    // Filtros combinados con AND, cada uno en su entrada: si "manzana" y "clave"
    // compartieran where.OR, uno de los dos se perdería.
    const filtros: Prisma.LoteWhereInput[] = [];
    if (panteonId) filtros.push({ panteonId });
    if (manzana) {
      // Hay secciones que capturaron la manzana en romano ("XVI") y otras en arábigo
      // ("16") para el mismo número.
      filtros.push({
        OR: variantesManzana(manzana).map((v) => ({ numeroManzana: { contains: v, mode: "insensitive" as const } })),
      });
    }
    if (lote) filtros.push({ numeroLote: { contains: lote, mode: "insensitive" } });
    if (seccion) filtros.push(whereSeccion(seccion));
    if (clave) filtros.push({ claveLegado: { contains: clave, mode: "insensitive" } });

    const lotes = await prisma.lote.findMany({
      where: { AND: filtros },
      include: {
        panteon: true,
        titulos: { where: { estado: "VIGENTE" }, include: { titular: true }, take: 1 },
        _count: { select: { permisos: true } },
      },
    });

    // También es coincidencia exacta cuando es la misma manzana en romano y en
    // arábigo (la búsqueda "16" contra un lote guardado como "XVI").
    const igual = (a: string, b?: string) => !!b && variantesManzana(a).some((v) => v.toLowerCase() === b.toLowerCase());

    // "3" también coincide con 13, 33, 34...: la coincidencia exacta va primero. Se
    // ordena en memoria porque el filtro previo ya acota el conjunto.
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
// A diferencia del buscador de expedientes, solo muestra lotes utilizables:
// ocupados, de fosa común (donde se sepulta a la siguiente persona no
// reclamada) o con título vigente (para que no desaparezca un lote vacío que
// sigue siendo de su titular).
lotesRouter.get(
  "/buscar",
  asyncHandler(async (req, res) => {
    const manzana = str(req.query.manzana);
    const lote = str(req.query.lote);
    const seccion = str(req.query.seccion);
    // Titular del lote: alternativa a manzana/lote para los panteones que sí los
    // usan. "termino" es la búsqueda de los panteones de colindancias, donde también
    // entra el titular junto con los vecinos.
    const titular = str(req.query.titular);
    // Los panteones de colindancias (numeroManzana="S/N") no tienen sección ni un
    // número de lote conocido por el personal: se busca por titular o por el nombre
    // de un vecino registrado como colindancia, igual que /buscar en títulos para
    // cesiones.
    const termino = str(req.query.termino);
    const panteonId = req.query.panteonId ? Number(req.query.panteonId) : undefined;

    const disponibilidad: Prisma.LoteWhereInput = {
      OR: [{ estado: "OCUPADO" }, { esFosaComun: true }, { titulos: { some: { estado: "VIGENTE" } } }],
    };
    const filtros: Prisma.LoteWhereInput[] = [disponibilidad];
    // Un lote concreto por id: lo usa la pantalla de permiso cuando llega con
    // el lote ya elegido (p. ej. justo después de emitir su título).
    const loteId = req.query.loteId ? Number(req.query.loteId) : undefined;
    if (loteId) filtros.push({ loteId });
    if (panteonId) filtros.push({ panteonId });
    if (seccion) filtros.push(whereSeccion(seccion));
    if (manzana) {
      // Hay secciones que capturaron la manzana en romano ("XVI") y otras en arábigo
      // ("16") para el mismo número.
      filtros.push({
        OR: variantesManzana(manzana).map((v) => ({ numeroManzana: { contains: v, mode: "insensitive" as const } })),
      });
    }
    if (lote) filtros.push({ numeroLote: { contains: lote, mode: "insensitive" } });
    if (titular) {
      filtros.push({ titulos: { some: { estado: "VIGENTE", titular: { nombreCompleto: { contains: titular, mode: "insensitive" } } } } });
    }
    if (termino) {
      filtros.push({
        OR: [
          { titulos: { some: { estado: "VIGENTE", titular: { nombreCompleto: { contains: termino, mode: "insensitive" } } } } },
          { colindanciaNorte: { contains: termino, mode: "insensitive" } },
          { colindanciaSur: { contains: termino, mode: "insensitive" } },
          { colindanciaEste: { contains: termino, mode: "insensitive" } },
          { colindanciaOeste: { contains: termino, mode: "insensitive" } },
          { numeroLote: { contains: termino, mode: "insensitive" } },
        ],
      });
    }

    const lotes = await prisma.lote.findMany({
      where: { AND: filtros },
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
        colindanciaNorte: l.colindanciaNorte,
        colindanciaSur: l.colindanciaSur,
        colindanciaEste: l.colindanciaEste,
        colindanciaOeste: l.colindanciaOeste,
      }))
    );
  })
);

// Quién está sepultado hoy en el lote (inhumados menos exhumados), en el mismo
// formato que /fallecidos/buscar, para que al elegir el lote de una exhumación
// no haya que volver a teclear el nombre del difunto ya enlazado.
lotesRouter.get(
  "/:id/ocupantes",
  asyncHandler(async (req, res) => {
    const loteId = Number(req.params.id);

    const [sepultados, exhumaciones] = await Promise.all([
      prisma.permiso.findMany({
        where: { loteId, tipoTramite: { clave: "SEP" }, fallecidoId: { not: null } },
        include: { fallecido: true },
        orderBy: { permisoId: "asc" },
      }),
      prisma.permiso.findMany({
        where: { loteId, tipoTramite: { clave: "EXH" }, fallecidoId: { not: null } },
        select: { fallecidoId: true },
      }),
    ]);
    const yaExhumados = new Set(exhumaciones.map((p) => p.fallecidoId));

    const vistos = new Set<number>();
    const ocupantes = [];
    for (const p of sepultados) {
      const f = p.fallecido;
      if (!f || yaExhumados.has(f.fallecidoId) || vistos.has(f.fallecidoId)) continue;
      vistos.add(f.fallecidoId);
      ocupantes.push({
        fallecidoId: f.fallecidoId,
        nombre: f.nombreCompleto,
        fecha: f.fechaFallecimiento,
        acta: f.actaDefuncionNumero,
        numeroCaso: f.numeroCaso,
        esNoReclamado: f.esNoReclamado,
        yaTienePermiso: true,
      });
    }

    res.json(ocupantes);
  })
);

// Un lote de fosa común se libera al aprobar el permiso de exhumación de quien
// lo ocupaba. Aquí se ve dónde se puede sepultar a la siguiente persona no
// reclamada. Equivale a NoReclamadosController.LotesDisponibles del original.
lotesRouter.get(
  "/fosa-comun-disponibles",
  asyncHandler(async (req, res) => {
    const seccion = str(req.query.seccion);

    const where: Prisma.LoteWhereInput = { esFosaComun: true };
    if (seccion) where.seccion = seccion;

    const lotes = await prisma.lote.findMany({ where, include: { panteon: true } });
    const disponibles = lotes.filter((l) => l.estado === "DISPONIBLE");

    // Historial de ocupantes previos de los lotes liberados. Solo cuentan los
    // permisos de sepultura: el de exhumación apunta al mismo difunto y lo
    // duplicaría.
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

// Línea de tiempo de una tumba: título, cesiones, inhumaciones, exhumaciones,
// obras e identificaciones, reunidos en un solo lugar.
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
        // Un permiso CANCELADO no es un movimiento real; se marca en la línea de tiempo
        // para distinguirlo de uno vigente (títulos y cesiones ya muestran su estado).
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

    // De más antiguo a más reciente; lo que no trae fecha va al final.
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
