import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";

export interface TokenPayload {
  usuarioId: number;
  nombreUsuario: string;
  nombreCompleto: string;
  rol: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

const COOKIE_NAME = "auth_token";

export function firmarToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function cookieOpciones(req: Request) {
  return {
    httpOnly: true,
    // Igual que en el .NET original: Secure fijo en true rompe el login en
    // silencio si todavía no hay HTTPS (p. ej. en la red local del piloto).
    secure: req.secure,
    sameSite: "strict" as const,
    maxAge: 8 * 60 * 60 * 1000,
  };
}

export function requiereAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    req.usuario = jwt.verify(token, env.jwtSecret) as TokenPayload;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

export function requiereRol(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.usuario.rol)) return res.status(403).json({ error: "No autorizado" });
    next();
  };
}

export { COOKIE_NAME };
