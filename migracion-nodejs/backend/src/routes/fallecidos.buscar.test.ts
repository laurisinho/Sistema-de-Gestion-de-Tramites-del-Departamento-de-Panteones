import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Al buscar un difunto para una exhumación, el capturista casi siempre lo
// encuentra antes de haber elegido el lote. Se prueba que /fallecidos/buscar
// mande dónde está sepultado hoy (para que la pantalla lo enlace junto con el
// difunto), que no lo mande si ya lo exhumaron, y que cuente tanto sepultura
// como depósito de cenizas como formas de "ocupar" el lote (un fallecido
// solo enlazado por un permiso CEN se quedaba sin lote antes de este arreglo).
const m = vi.hoisted(() => ({
  fallecidoFindMany: vi.fn(async () => [{ fallecidoId: 30, nombreCompleto: "JUAN PEREZ", fechaFallecimiento: null, actaDefuncionNumero: null, numeroCaso: null, esNoReclamado: false }]),
  groupBy: vi.fn(async () => []),
  permisoFindMany: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    fallecido: { findMany: m.fallecidoFindMany },
    permiso: { groupBy: m.groupBy, findMany: m.permisoFindMany },
  },
}));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Capturista" } as never;
    next();
  },
}));

const { fallecidosRouter } = await import("./fallecidos.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

type WhereOcupacion = { where: { tipoTramite: { clave: string | { in: string[] } } } };

// El código real filtra la consulta de ocupación con `clave: { in: [...] }`;
// esta ayudante simula lo que Postgres haría con ese filtro, para que el mock
// solo devuelva el lote cuando la clave del permiso (aquí, "CEN") de verdad
// esté incluida en la consulta.
function coincideClave(args: WhereOcupacion, claveDelPermiso: string): boolean {
  const clave = args.where.tipoTramite.clave;
  return typeof clave === "string" ? clave === claveDelPermiso : clave.in.includes(claveDelPermiso);
}

function loteDePrueba() {
  return {
    fallecidoId: 30,
    lote: {
      loteId: 700,
      numeroManzana: "1",
      numeroLote: "54",
      seccion: "TERRAZAS",
      estado: "OCUPADO",
      esFosaComun: false,
      colindanciaNorte: null,
      colindanciaSur: null,
      colindanciaEste: null,
      colindanciaOeste: null,
      panteon: { nombre: "Jardines del Edén" },
      titulos: [],
    },
  };
}

const buscar = () => fetch(`${base}/buscar?termino=JUAN`);

beforeAll(() => {
  const app = express();
  app.use("/", fallecidosRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fallecidoFindMany.mockResolvedValue([
    { fallecidoId: 30, nombreCompleto: "JUAN PEREZ", fechaFallecimiento: null, actaDefuncionNumero: null, numeroCaso: null, esNoReclamado: false },
  ]);
});

describe("GET /fallecidos/buscar", () => {
  it("manda el lote donde sigue sepultado (permiso de Sepultura)", async () => {
    m.permisoFindMany.mockImplementation(async (args: WhereOcupacion) => (coincideClave(args, "SEP") ? [loteDePrueba()] : []));

    const r = await buscar();
    const cuerpo = (await r.json()) as Array<{ lote: { loteId: number; lote: string } | null }>;

    expect(r.status).toBe(200);
    expect(cuerpo[0].lote).toEqual(
      expect.objectContaining({ loteId: 700, lote: "54", manzana: "1", panteon: "Jardines del Edén" })
    );
  });

  it("manda el lote también si lo ocupa un Depósito de Cenizas (CEN), no solo Sepultura", async () => {
    // Solo responde si la consulta pide CEN: si el código volviera a filtrar
    // nada más por "SEP", esta prueba fallaría (lote quedaría null).
    m.permisoFindMany.mockImplementation(async (args: WhereOcupacion) => (coincideClave(args, "CEN") ? [loteDePrueba()] : []));

    const r = await buscar();
    const cuerpo = (await r.json()) as Array<{ lote: { loteId: number } | null }>;

    expect(cuerpo[0].lote).toEqual(expect.objectContaining({ loteId: 700 }));
  });

  it("no manda lote si ya lo exhumaron", async () => {
    m.permisoFindMany.mockImplementation(async (args: WhereOcupacion) =>
      coincideClave(args, "SEP") ? [loteDePrueba()] : [{ fallecidoId: 30 }]
    );

    const r = await buscar();
    const cuerpo = (await r.json()) as Array<{ lote: unknown }>;

    expect(cuerpo[0].lote).toBeNull();
  });
});
