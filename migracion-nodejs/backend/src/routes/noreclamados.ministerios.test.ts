import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// El selector de Ministerio Público junta el catálogo con los nombres ya
// capturados en registros viejos. Un agente desactivado en Administración debe
// dejar de ofrecerse aunque haya registros con su nombre; si no, casi nunca
// desaparecería, porque casi todos ya se usaron alguna vez.
const m = vi.hoisted(() => ({
  agentes: vi.fn(),
  fallecidos: vi.fn(),
  reconocimientos: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    agenteMinisterioPublico: { findMany: m.agentes },
    fallecido: { findMany: m.fallecidos },
    reconocimiento: { findMany: m.reconocimientos },
  },
}));
vi.mock("../lib/bitacora", () => ({
  Acciones: {},
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

beforeAll(() => {
  const app = express();
  app.use("/", noReclamadosRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fallecidos.mockResolvedValue([]);
  m.reconocimientos.mockResolvedValue([]);
});

const pedir = async () => (await (await fetch(`${base}/ministerios-publicos`)).json()) as string[];

describe("GET /no-reclamados/ministerios-publicos", () => {
  it("ofrece los agentes activos del catálogo", async () => {
    m.agentes.mockResolvedValue([
      { nombre: "LIC. ANA LOPEZ", activo: true },
      { nombre: "LIC. BETO RUIZ", activo: true },
    ]);
    expect(await pedir()).toEqual(["LIC. ANA LOPEZ", "LIC. BETO RUIZ"]);
  });

  it("no ofrece a un agente desactivado aunque lo tengan registros viejos", async () => {
    m.agentes.mockResolvedValue([
      { nombre: "LIC. ANA LOPEZ", activo: true },
      { nombre: "LIC. BETO RUIZ", activo: false },
    ]);
    // El nombre viejo viene con coma en lugar de punto: debe reconocerse igual.
    m.fallecidos.mockResolvedValue([{ ministerioPublico: "LIC, BETO RUIZ" }]);
    m.reconocimientos.mockResolvedValue([{ ministerioPublico: "LIC. BETO RUIZ" }]);

    expect(await pedir()).toEqual(["LIC. ANA LOPEZ"]);
  });

  it("sigue ofreciendo nombres capturados a mano que no están en el catálogo", async () => {
    m.agentes.mockResolvedValue([{ nombre: "LIC. ANA LOPEZ", activo: true }]);
    m.fallecidos.mockResolvedValue([{ ministerioPublico: "LIC. CARLA DIAZ" }]);

    expect(await pedir()).toEqual(["LIC. ANA LOPEZ", "LIC. CARLA DIAZ"]);
  });

  it("no duplica un nombre viejo con coma junto al del catálogo", async () => {
    m.agentes.mockResolvedValue([{ nombre: "LIC. ANA LOPEZ", activo: true }]);
    m.fallecidos.mockResolvedValue([{ ministerioPublico: "LIC, ANA LOPEZ" }]);

    expect(await pedir()).toEqual(["LIC. ANA LOPEZ"]);
  });
});
