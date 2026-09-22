import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "x".repeat(32);
process.env.FRONTEND_ORIGIN ??= "https://panteones.example";

const { firmarToken, requiereAuth } = await import("./auth");

const PAYLOAD = { usuarioId: 1, nombreUsuario: "cap1", nombreCompleto: "Capturista Uno", rol: "Capturista" };
const TOKEN = firmarToken(PAYLOAD);
const ORIGEN_PROPIO = "https://panteones.example";
const ORIGEN_ATACANTE = "https://sitio-malicioso.com";

function mockReq(opts: { metodo?: string; header?: string; cookie?: string; origen?: string }): Request {
  return {
    method: opts.metodo ?? "POST",
    headers: {
      authorization: opts.header ? `Bearer ${opts.header}` : undefined,
      origin: opts.origen,
    },
    cookies: opts.cookie ? { auth_token: opts.cookie } : {},
  } as unknown as Request;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("requiereAuth: sesión por header (Authorization)", () => {
  it("autentica sin importar el origen, incluso en un método que escribe", () => {
    const req = mockReq({ metodo: "POST", header: TOKEN, origen: ORIGEN_ATACANTE });
    const res = mockRes();
    const next = vi.fn();
    requiereAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("requiereAuth: sesión por cookie, en un método que modifica datos", () => {
  let next: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    next = vi.fn();
  });

  it("rechaza un origen distinto al del frontend (CSRF)", () => {
    const req = mockReq({ metodo: "POST", cookie: TOKEN, origen: ORIGEN_ATACANTE });
    const res = mockRes();
    requiereAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("acepta el origen del propio frontend", () => {
    const req = mockReq({ metodo: "POST", cookie: TOKEN, origen: ORIGEN_PROPIO });
    const res = mockRes();
    requiereAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("sin encabezado Origin, deja pasar (curl y similares no lo mandan)", () => {
    const req = mockReq({ metodo: "POST", cookie: TOKEN });
    const res = mockRes();
    requiereAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("en GET no exige el origen, aunque sea de otro sitio", () => {
    const req = mockReq({ metodo: "GET", cookie: TOKEN, origen: ORIGEN_ATACANTE });
    const res = mockRes();
    requiereAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("requiereAuth: sin sesión", () => {
  it("responde 401 antes de revisar el origen", () => {
    const req = mockReq({ metodo: "POST", origen: ORIGEN_ATACANTE });
    const res = mockRes();
    const next = vi.fn();
    requiereAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
