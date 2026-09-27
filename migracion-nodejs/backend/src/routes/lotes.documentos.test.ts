import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Documentos escaneados del expediente del lote: el archivo va a Supabase
// Storage (simulado aquí) y solo la referencia a la base de datos.
const m = vi.hoisted(() => ({
  lote: { findUnique: vi.fn() },
  documentoLote: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  subir: vi.fn(async () => undefined),
  descargar: vi.fn(async () => Buffer.from("contenido-pdf")),
  eliminarStorage: vi.fn(async () => undefined),
}));

vi.mock("../lib/prisma", () => ({
  prisma: { lote: m.lote, documentoLote: m.documentoLote },
}));
vi.mock("../lib/storageDocumentos", () => ({
  subirDocumento: m.subir,
  descargarDocumento: m.descargar,
  eliminarDocumento: m.eliminarStorage,
}));
vi.mock("../lib/bitacora", () => ({
  Acciones: { Crear: "CREAR", Eliminar: "ELIMINAR" },
  registrarBitacora: vi.fn(async () => undefined),
}));
vi.mock("../middleware/auth", () => ({
  requiereAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.usuario = { usuarioId: 1, rol: "Capturista" } as never;
    next();
  },
  requiereEscritura: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const { lotesRouter } = await import("./lotes.routes");

let servidor: ReturnType<express.Express["listen"]>;
let base = "";

const PDF_BASE64 = Buffer.from("contenido-pdf").toString("base64");
const dataUriPdf = `data:application/pdf;base64,${PDF_BASE64}`;

beforeAll(() => {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use("/", lotesRouter);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  m.lote.findUnique.mockResolvedValue({ loteId: 42 });
});

describe("GET /:id/documentos", () => {
  it("lista los documentos del lote, más reciente primero", async () => {
    m.documentoLote.findMany.mockResolvedValue([
      { documentoId: 2, nombreArchivo: "acta.pdf", tipoMime: "application/pdf", tamanioBytes: 1000, fechaSubida: new Date(), usuarioSubio: { nombreCompleto: "ANA LOPEZ" } },
    ]);
    const r = await fetch(`${base}/42/documentos`);
    const cuerpo = (await r.json()) as Array<{ subioPor: string }>;
    expect(r.status).toBe(200);
    expect(cuerpo[0].subioPor).toBe("ANA LOPEZ");
    expect(m.documentoLote.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { loteId: 42 }, orderBy: { fechaSubida: "desc" } }));
  });
});

describe("POST /:id/documentos", () => {
  it("sube el archivo a Storage y crea el registro", async () => {
    m.documentoLote.create.mockResolvedValue({ documentoId: 9, nombreArchivo: "acta.pdf" });

    const r = await fetch(`${base}/42/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreArchivo: "acta.pdf", dataUri: dataUriPdf }),
    });

    expect(r.status).toBe(201);
    expect(m.subir).toHaveBeenCalledOnce();
    expect(m.subir.mock.calls[0][2]).toBe("application/pdf");
    expect(m.documentoLote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ loteId: 42, nombreArchivo: "acta.pdf", tipoMime: "application/pdf" }) })
    );
  });

  it("rechaza un tipo de archivo que no sea PDF, JPG o PNG", async () => {
    const dataUriTexto = `data:text/plain;base64,${Buffer.from("hola").toString("base64")}`;
    const r = await fetch(`${base}/42/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreArchivo: "notas.txt", dataUri: dataUriTexto }),
    });
    expect(r.status).toBe(400);
    expect(m.subir).not.toHaveBeenCalled();
  });

  it("rechaza un archivo mayor a 10MB", async () => {
    const grande = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
    const r = await fetch(`${base}/42/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreArchivo: "grande.pdf", dataUri: `data:application/pdf;base64,${grande}` }),
    });
    expect(r.status).toBe(400);
    expect(m.subir).not.toHaveBeenCalled();
  });

  it("404 si el lote no existe", async () => {
    m.lote.findUnique.mockResolvedValue(null);
    const r = await fetch(`${base}/999/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreArchivo: "acta.pdf", dataUri: dataUriPdf }),
    });
    expect(r.status).toBe(404);
    expect(m.subir).not.toHaveBeenCalled();
  });

  it("si falla el registro en la base, borra el archivo ya subido a Storage", async () => {
    m.documentoLote.create.mockRejectedValue(new Error("falla de BD"));

    const r = await fetch(`${base}/42/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreArchivo: "acta.pdf", dataUri: dataUriPdf }),
    });

    expect(r.status).toBe(500);
    expect(m.subir).toHaveBeenCalledOnce();
    expect(m.eliminarStorage).toHaveBeenCalledOnce();
  });
});

describe("GET /:id/documentos/:documentoId/descargar", () => {
  it("manda el archivo con su tipo y nombre", async () => {
    m.documentoLote.findFirst.mockResolvedValue({ documentoId: 9, loteId: 42, rutaStorage: "lotes/42/x.pdf", tipoMime: "application/pdf", nombreArchivo: "acta.pdf" });
    const r = await fetch(`${base}/42/documentos/9/descargar`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toContain("acta.pdf");
    expect(await r.text()).toBe("contenido-pdf");
  });

  it("404 si el documento no existe o no es de ese lote", async () => {
    m.documentoLote.findFirst.mockResolvedValue(null);
    const r = await fetch(`${base}/42/documentos/999/descargar`);
    expect(r.status).toBe(404);
    expect(m.descargar).not.toHaveBeenCalled();
  });
});

describe("DELETE /:id/documentos/:documentoId", () => {
  it("borra el registro y el archivo de Storage", async () => {
    m.documentoLote.findFirst.mockResolvedValue({ documentoId: 9, loteId: 42, rutaStorage: "lotes/42/x.pdf", nombreArchivo: "acta.pdf" });
    const r = await fetch(`${base}/42/documentos/9`, { method: "DELETE" });
    expect(r.status).toBe(200);
    expect(m.documentoLote.delete).toHaveBeenCalledWith({ where: { documentoId: 9 } });
    expect(m.eliminarStorage).toHaveBeenCalledWith("lotes/42/x.pdf");
  });

  it("404 si el documento no existe", async () => {
    m.documentoLote.findFirst.mockResolvedValue(null);
    const r = await fetch(`${base}/42/documentos/999`, { method: "DELETE" });
    expect(r.status).toBe(404);
    expect(m.documentoLote.delete).not.toHaveBeenCalled();
  });
});
