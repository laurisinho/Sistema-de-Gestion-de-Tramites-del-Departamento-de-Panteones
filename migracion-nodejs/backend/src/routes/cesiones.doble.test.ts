import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Dos peticiones para ceder el mismo título casi al mismo tiempo: las dos ven
// el título como VIGENTE (la comprobación es antes de abrir la transacción),
// así que sin un guardado atómico ambas terminarían creando un título nuevo
// VIGENTE sobre el mismo lote. Se prueba por la ruta HTTP real, simulando con
// updateMany.count lo que Postgres resuelve solo entre transacciones reales:
// la segunda en llegar encuentra la fila ya en CEDIDO y actualiza 0 filas.
const m = vi.hoisted(() => ({
  cuentaDeUpdate: 1,
  tx: {
    persona: { create: vi.fn(async () => ({ personaId: 9, nombreCompleto: "CESIONARIO PRUEBA" })) },
    tituloPropiedad: {
      findUnique: vi.fn(async () => null), // el folio propuesto está libre
      create: vi.fn(async () => ({ tituloId: 55 })),
      updateMany: vi.fn(async () => ({ count: m.cuentaDeUpdate })),
    },
    cesionDerechos: { create: vi.fn(async () => ({ cesionId: 3 })) },
  },
  tituloFindUnique: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    tituloPropiedad: { findUnique: m.tituloFindUnique },
    $transaction: async (cb: (tx: typeof m.tx) => unknown) => cb(m.tx),
  },
}));
vi.mock("../lib/folio", () => ({ generarFolioCesion: vi.fn(async () => "CES-0001") }));
vi.mock("../lib/bitacora", () => ({
  Acciones: { Ceder: "CEDER" },
  registrarBitacora: vi.fn(async () => undefined),
}));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Capturista" } as never;
    next();
  },
  requiereEscritura: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const { cesionesRouter } = await import("./cesiones.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

function tituloVigente() {
  return {
    tituloId: 42,
    folio: "PJE-35-01",
    estado: "VIGENTE",
    titularId: 7,
    titular: { nombreCompleto: "TITULAR ANTERIOR" },
    lote: { loteId: 6, claveLegado: "PJE-35-01" },
  };
}

const cuerpo = { tituloId: 42, nombreCesionario: "NUEVO TITULAR" };

const ceder = () =>
  fetch(`${base}/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use("/", cesionesRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  m.tituloFindUnique.mockResolvedValue(tituloVigente());
  m.cuentaDeUpdate = 1;
});

describe("POST /cesiones ante dos peticiones casi simultáneas", () => {
  it("la primera cede el título con normalidad", async () => {
    m.cuentaDeUpdate = 1; // el título seguía VIGENTE al momento de marcarlo
    const r = await ceder();
    expect(r.status).toBe(201);
    expect(m.tx.cesionDerechos.create).toHaveBeenCalledOnce();
  });

  it("la segunda, si el título ya fue cedido entre medio, no crea una cesión duplicada", async () => {
    m.cuentaDeUpdate = 0; // updateMany no encontró la fila en VIGENTE: ya la cedieron
    const r = await ceder();
    const cuerpoResp = (await r.json()) as { error: string };

    expect(r.status).toBe(409);
    expect(cuerpoResp.error).toMatch(/ya fue cedido/i);
    expect(m.tx.cesionDerechos.create).not.toHaveBeenCalled();
  });
});
