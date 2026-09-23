import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Al buscar un difunto para una exhumación, el capturista casi siempre lo
// encuentra antes de haber elegido el lote. Se prueba que /fallecidos/buscar
// mande dónde está sepultado hoy (para que la pantalla lo enlace junto con el
// difunto), y que no lo mande si ya lo exhumaron.
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
  it("manda el lote donde sigue sepultado", async () => {
    m.permisoFindMany.mockImplementation(async (args: { where: { tipoTramite: { clave: string } } }) =>
      args.where.tipoTramite.clave === "SEP" ? [loteDePrueba()] : []
    );

    const r = await buscar();
    const cuerpo = (await r.json()) as Array<{ lote: { loteId: number; lote: string } | null }>;

    expect(r.status).toBe(200);
    expect(cuerpo[0].lote).toEqual(
      expect.objectContaining({ loteId: 700, lote: "54", manzana: "1", panteon: "Jardines del Edén" })
    );
  });

  it("no manda lote si ya lo exhumaron", async () => {
    m.permisoFindMany.mockImplementation(async (args: { where: { tipoTramite: { clave: string } } }) =>
      args.where.tipoTramite.clave === "SEP" ? [loteDePrueba()] : [{ fallecidoId: 30 }]
    );

    const r = await buscar();
    const cuerpo = (await r.json()) as Array<{ lote: unknown }>;

    expect(cuerpo[0].lote).toBeNull();
  });
});
