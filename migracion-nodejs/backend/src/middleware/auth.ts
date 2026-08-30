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
  // En local, frontend y backend comparten origen (localhost) y no hay HTTPS,
  // así que "strict" + secure dinámico basta -- igual que el .NET original.
  // En producción viven en dominios distintos (GitHub Pages + Render), y un
  // navegador nunca manda una cookie "strict" entre sitios distintos, sin
  // importar el CORS: hace falta "none", que a su vez exige Secure.
  if (env.isProduction) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      maxAge: 8 * 60 * 60 * 1000,
    };
  }
  return {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict" as const,
    maxAge: 8 * 60 * 60 * 1000,
  };
}

export function requiereAuth(req: Request, res: Response, next: NextFunction) {
  // El header gana: es lo que manda el frontend real (github.io -> onrender.com)
  // desde que se descubrió que varios navegadores (Brave, Safari y cada vez más
  // Chrome) bloquean por privacidad la cookie entre sitios distintos sin
  // importar cómo se configure SameSite/Secure. La cookie queda como respaldo
  // para cuando frontend y backend sí comparten origen (desarrollo local).
  const encabezado = req.headers.authorization;
  const tokenHeader = encabezado?.startsWith("Bearer ") ? encabezado.slice(7) : undefined;
  const token = tokenHeader ?? req.cookies?.[COOKIE_NAME];
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
