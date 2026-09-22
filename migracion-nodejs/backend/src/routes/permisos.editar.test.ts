import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Un permiso de sepultura capturado sin fallecido (se dejó en blanco a
// propósito o por prisa) no tenía forma de recibirlo después: el PUT solo
// actualizaba un fallecido ya enlazado, nunca creaba uno nuevo. Se prueba por
// la ruta HTTP real, con la base sustituida.
const m = vi.hoisted(() => ({
  tx: {
    persona: { update: vi.fn(async () => ({})) },
    fallecido: {
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({ fallecidoId: 88 })),
    },
    permiso: { update: vi.fn(async () => ({})) },
  },
  permisoFindUnique: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    permiso: { findUnique: m.permisoFindUnique },
    $transaction: async (cb: (tx: typeof m.tx) => unknown) => cb(m.tx),
  },
}));
vi.mock("../lib/bitacora", () => ({
  Acciones: { Editar: "EDITAR" },
  registrarBitacora: vi.fn(async () => undefined),
}));
// permisos.routes.ts también importa esto para su endpoint /:id/pdf (no
// probado aquí). Sin simularlo, lib/pdf.ts arrastra a env.ts, que exige
// JWT_SECRET -- pasa en local por el .env, pero no en un runner de CI limpio.
vi.mock("../lib/pdf", () => ({ renderPdf: vi.fn() }));
vi.mock("../lib/apariencia", () => ({ obtenerAparienciaDocumento: vi.fn() }));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Capturista" } as never;
    next();
  },
  requiereEscritura: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const { permisosRouter } = await import("./permisos.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

function permisoSinFallecido() {
  return { permisoId: 10, folio: "SEP-0001", solicitanteId: 3, fallecido: null };
}

function permisoConFallecido() {
  return {
    permisoId: 10,
    folio: "SEP-0001",
    solicitanteId: 3,
    fallecido: { fallecidoId: 55, nombreCompleto: "JUAN PEREZ", fechaFallecimiento: null, actaDefuncionNumero: null },
  };
}

const CUERPO = {
  nombreSolicitante: "SOLICITANTE PRUEBA",
  nombreFallecido: "MARIA DIFUNTA",
  fechaFallecimiento: "2026-01-10",
  actaDefuncionNumero: "AD-1",
  estado: "APROBADO",
};

const editar = (cuerpo: Record<string, unknown> = CUERPO) =>
  fetch(`${base}/10`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use("/", permisosRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PUT /permisos/:id con fallecido no capturado originalmente", () => {
  it("crea el fallecido y lo enlaza al permiso cuando no había uno", async () => {
    m.permisoFindUnique.mockResolvedValue(permisoSinFallecido());

    const r = await editar();

    expect(r.status).toBe(200);
    expect(m.tx.fallecido.update).not.toHaveBeenCalled();
    expect(m.tx.fallecido.create).toHaveBeenCalledWith({
      data: { nombreCompleto: "MARIA DIFUNTA", fechaFallecimiento: new Date("2026-01-10"), actaDefuncionNumero: "AD-1" },
    });
    expect(m.tx.permiso.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { permisoId: 10 }, data: expect.objectContaining({ fallecidoId: 88 }) })
    );
  });

  it("no crea nada si sigue sin capturarse un nombre", async () => {
    m.permisoFindUnique.mockResolvedValue(permisoSinFallecido());

    const r = await editar({ ...CUERPO, nombreFallecido: "" });

    expect(r.status).toBe(200);
    expect(m.tx.fallecido.create).not.toHaveBeenCalled();
    expect(m.tx.fallecido.update).not.toHaveBeenCalled();
  });

  it("sigue actualizando el fallecido existente en vez de crear uno nuevo", async () => {
    m.permisoFindUnique.mockResolvedValue(permisoConFallecido());

    const r = await editar();

    expect(r.status).toBe(200);
    expect(m.tx.fallecido.create).not.toHaveBeenCalled();
    expect(m.tx.fallecido.update).toHaveBeenCalledWith({
      where: { fallecidoId: 55 },
      data: { nombreCompleto: "MARIA DIFUNTA", fechaFallecimiento: new Date("2026-01-10"), actaDefuncionNumero: "AD-1" },
    });
  });
});
