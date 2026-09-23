import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Dos reconocimientos casi simultáneos del mismo expediente: el chequeo
// "¿ya está reconocido?" se lee antes de abrir la transacción, así que las dos
// peticiones lo pasan. Sin un marcado atómico, ambas crearían un
// Reconocimiento con nombres distintos sobre la misma persona. Se prueba por
// la ruta HTTP real, simulando con updateMany.count lo que Postgres resuelve
// solo entre transacciones reales: la segunda en llegar encuentra la fila ya
// en reconocido=true y actualiza 0 filas.
const m = vi.hoisted(() => ({
  cuentaDeUpdate: 1,
  tx: {
    fallecido: { updateMany: vi.fn(async () => ({ count: m.cuentaDeUpdate })) },
    reconocimiento: { create: vi.fn(async () => ({ reconocimientoId: 9 })) },
  },
  fallecidoFindFirst: vi.fn(),
  permisoFindFirst: vi.fn(async () => null),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    fallecido: { findFirst: m.fallecidoFindFirst },
    permiso: { findFirst: m.permisoFindFirst },
    $transaction: async (cb: (tx: typeof m.tx) => unknown) => cb(m.tx),
  },
}));
vi.mock("../lib/bitacora", () => ({
  Acciones: { Reconocer: "RECONOCER" },
  registrarBitacora: vi.fn(async () => undefined),
}));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Capturista" } as never;
    next();
  },
  requiereEscritura: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const { noReclamadosRouter } = await import("./noreclamados.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

function fallecidoNoReconocido() {
  return { fallecidoId: 30, esNoReclamado: true, reconocido: false, nombreCompleto: "PERSONA DESCONOCIDA", numeroCaso: null, actaDefuncionNumero: null };
}

const CUERPO = { nombreIdentificado: "JUAN PEREZ", fechaReconocimiento: "2026-01-10", medioIdentificacion: "Huellas dactilares" };

const reconocer = () =>
  fetch(`${base}/30/reconocer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CUERPO) });

beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use("/", noReclamadosRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fallecidoFindFirst.mockResolvedValue(fallecidoNoReconocido());
  m.cuentaDeUpdate = 1;
});

describe("POST /no-reclamados/:id/reconocer ante dos peticiones casi simultáneas", () => {
  it("la primera reconoce con normalidad", async () => {
    m.cuentaDeUpdate = 1; // seguía reconocido=false al momento de marcarlo
    const r = await reconocer();
    expect(r.status).toBe(201);
    expect(m.tx.reconocimiento.create).toHaveBeenCalledOnce();
  });

  it("la segunda, si ya lo reconocieron entre medio, no crea un reconocimiento duplicado", async () => {
    m.cuentaDeUpdate = 0; // updateMany no encontró la fila en reconocido:false: ya la reconocieron
    const r = await reconocer();
    const cuerpoResp = (await r.json()) as { error: string };

    expect(r.status).toBe(409);
    expect(cuerpoResp.error).toMatch(/ya está registrada como identificada/i);
    expect(m.tx.reconocimiento.create).not.toHaveBeenCalled();
  });
});
