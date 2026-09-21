import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Caso real: un permiso de sepultura "sin título registrado" crea el lote
// (Jardines del Edén, TERRAZAS, Mz 1, Lote 54). Al emitir después el título de
// ese mismo lote, antes se rechazaba con "ya existe un lote" aunque en Títulos
// no apareciera nada. Se prueba por la ruta HTTP real, con la base sustituida.
const m = vi.hoisted(() => {
  const tx = {
    persona: { create: vi.fn(async () => ({ personaId: 7, nombreCompleto: "TITULAR PRUEBA" })) },
    lote: {
      update: vi.fn(async () => ({ loteId: 6964 })),
      create: vi.fn(async () => ({ loteId: 9999 })),
    },
    tituloPropiedad: { create: vi.fn(async () => ({ tituloId: 501, loteId: 6964 })) },
  };
  return {
    tx,
    panteon: vi.fn(),
    loteFindFirst: vi.fn(),
    tituloFindFirst: vi.fn(),
  };
});

vi.mock("../lib/prisma", () => ({
  prisma: {
    panteon: { findUnique: m.panteon },
    lote: { findFirst: m.loteFindFirst },
    tituloPropiedad: { findFirst: m.tituloFindFirst },
    $transaction: async (cb: (tx: typeof m.tx) => unknown) => cb(m.tx),
  },
}));
vi.mock("../lib/folio", () => ({ generarFolio: vi.fn(async () => "PJE-TRZA1-54") }));
vi.mock("../lib/bitacora", () => ({
  Acciones: { Crear: "CREAR", Editar: "EDITAR" },
  registrarBitacora: vi.fn(async () => undefined),
}));
vi.mock("../lib/apariencia", () => ({ obtenerAparienciaDocumento: vi.fn() }));
vi.mock("../lib/pdf", () => ({ renderPdf: vi.fn() }));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Capturista" } as never;
    next();
  },
  requiereEscritura: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const { titulosRouter } = await import("./titulos.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use("/api/titulos", titulosRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/titulos`;
});
afterAll(() => {
  servidor.close();
});

const CUERPO = {
  nombreTitular: "TITULAR PRUEBA",
  panteonId: 1,
  numeroManzana: "1",
  numeroLote: "54",
  seccion: "TERRAZAS",
};

const emitir = (cuerpo = CUERPO) =>
  fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

beforeEach(() => {
  vi.clearAllMocks();
  m.panteon.mockResolvedValue({ panteonId: 1, clave: "PJE", usaColindancias: false });
});

describe("POST /api/titulos sobre un lote que ya existe", () => {
  it("emite el título en el lote creado por un permiso sin título", async () => {
    m.loteFindFirst.mockResolvedValue({ loteId: 6964 });
    m.tituloFindFirst.mockResolvedValue(null); // el lote no tiene título vigente

    const r = await emitir();

    expect(r.status).toBe(201);
    expect(m.tx.lote.create).not.toHaveBeenCalled(); // no se duplica el lote
    expect(m.tx.lote.update).toHaveBeenCalledWith({ where: { loteId: 6964 }, data: { estado: "OCUPADO" } });
    expect(m.tx.tituloPropiedad.create).toHaveBeenCalledOnce();
    expect(m.tx.tituloPropiedad.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ loteId: 6964, folio: "PJE-TRZA1-54" }) })
    );
  });

  it("rechaza si el lote ya tiene título vigente y dice cuál", async () => {
    m.loteFindFirst.mockResolvedValue({ loteId: 6964 });
    m.tituloFindFirst.mockResolvedValue({ folio: "PJE-TRZA1-54", titular: { nombreCompleto: "MARIA LOPEZ" } });

    const r = await emitir();
    const cuerpo = (await r.json()) as { error: string };

    expect(r.status).toBe(409);
    expect(cuerpo.error).toContain("PJE-TRZA1-54");
    expect(cuerpo.error).toContain("MARIA LOPEZ");
    expect(m.tx.tituloPropiedad.create).not.toHaveBeenCalled();
    expect(m.tx.lote.create).not.toHaveBeenCalled();
  });

  it("crea el lote como siempre cuando la ubicación está libre", async () => {
    m.loteFindFirst.mockResolvedValue(null);

    const r = await emitir();

    expect(r.status).toBe(201);
    expect(m.tituloFindFirst).not.toHaveBeenCalled();
    expect(m.tx.lote.create).toHaveBeenCalledOnce();
    expect(m.tx.lote.update).not.toHaveBeenCalled();
  });
});
