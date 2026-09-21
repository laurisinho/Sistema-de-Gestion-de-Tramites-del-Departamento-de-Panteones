import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Cada cambio de Apariencia debe vaciar la caché de los documentos; si no, los
// PDF y Excel siguen con el color, el síndico o el logo anteriores hasta que se
// reinicie el proceso. Se prueba por la ruta HTTP real, con la base y la
// sesión sustituidas.
const mocks = vi.hoisted(() => ({
  invalidar: vi.fn(),
  upsert: vi.fn(async () => ({ id: 1 })),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    configuracionApariencia: { upsert: mocks.upsert },
  },
}));
vi.mock("../lib/bitacora", () => ({
  Acciones: { Editar: "EDITAR", Crear: "CREAR", Cancelar: "CANCELAR" },
  registrarBitacora: vi.fn(async () => undefined),
}));
vi.mock("../lib/apariencia", () => ({ invalidarCacheApariencia: mocks.invalidar }));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Administrador" } as never;
    next();
  },
  requiereRol: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const { administracionRouter } = await import("./administracion.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/administracion", administracionRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/administracion`;
});

afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  mocks.invalidar.mockClear();
  mocks.upsert.mockClear();
});

const put = (ruta: string, cuerpo: unknown) =>
  fetch(`${base}${ruta}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

describe("PUT /apariencia", () => {
  it("guarda los colores y vacía la caché de los documentos", async () => {
    const r = await put("/apariencia", { colorGuinda: "#1e4d7b", colorDorado: "#c9a227" });
    expect(r.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.invalidar).toHaveBeenCalledOnce();
  });

  it("no toca la caché si el color se rechaza", async () => {
    const r = await put("/apariencia", { colorGuinda: "#ffe08a", colorDorado: "#c9a227" });
    expect(r.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.invalidar).not.toHaveBeenCalled();
  });
});
