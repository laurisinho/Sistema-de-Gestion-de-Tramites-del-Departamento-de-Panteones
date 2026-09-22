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
  // En local, frontend y backend comparten origen y no hay HTTPS, así que basta
  // "strict" con secure dinámico (igual que el original). En producción están en
  // dominios distintos y un navegador no envía cookies "strict" entre sitios
  // distintos, sin importar el CORS: se requiere "none", que exige Secure.
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

const METODOS_SEGUROS = ["GET", "HEAD", "OPTIONS"];

export function requiereAuth(req: Request, res: Response, next: NextFunction) {
  // El header tiene prioridad: es lo que envía el frontend en producción, porque
  // varios navegadores (Brave, Safari y cada vez más Chrome) bloquean la cookie
  // entre sitios distintos sin importar SameSite/Secure. La cookie queda como
  // respaldo cuando frontend y backend comparten origen (desarrollo local).
  const encabezado = req.headers.authorization;
  const tokenHeader = encabezado?.startsWith("Bearer ") ? encabezado.slice(7) : undefined;
  const usaCookie = !tokenHeader;
  const token = tokenHeader ?? req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "No autenticado" });

  // La cookie viaja sola con cualquier petición al mismo origen, incluida una
  // que un sitio ajeno mande sin que el usuario lo note (CSRF): con
  // sameSite=none en producción, el navegador la adjunta aunque la petición
  // venga de otra página. El header Authorization no tiene ese problema -- una
  // página ajena no puede leerlo del localStorage ni agregarlo. Por eso solo
  // cuando la sesión depende de la cookie, en un método que modifica algo, se
  // exige que el origen declarado sea el del propio frontend. Si el navegador
  // no mandó Origin se deja pasar (las herramientas de línea de comandos no
  // lo mandan y no dependen de una cookie ajena para autenticarse).
  if (usaCookie && !METODOS_SEGUROS.includes(req.method)) {
    const origen = req.headers.origin;
    if (origen && origen !== env.frontendOrigin) {
      return res.status(403).json({ error: "Origen no permitido." });
    }
  }

  try {
    req.usuario = jwt.verify(token, env.jwtSecret) as TokenPayload;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

// El original nunca restringió nada por rol (solo exigía sesión iniciada): los 4
// roles existían solo como descripción en la base. "Consulta" se documenta como
// "sin posibilidad de edición", así que aquí se hace cumplir: puede hacer
// cualquier GET pero ningún método que escriba. Se aplica junto con requiereAuth
// a nivel de router para que ningún endpoint de escritura quede sin proteger.
export function requiereEscritura(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.rol === "Consulta" && req.method !== "GET") {
    return res.status(403).json({ error: "Tu rol (Consulta) solo tiene permiso de lectura." });
  }
  next();
}

export function requiereRol(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.usuario.rol)) return res.status(403).json({ error: "No autorizado" });
    next();
  };
}

export { COOKIE_NAME };
