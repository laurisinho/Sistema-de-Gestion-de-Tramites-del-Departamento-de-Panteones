import type { NextFunction, Request, Response } from "express";
import { Acciones, registrarBitacora } from "../lib/bitacora";

// Freno de fuerza bruta para /auth/login.
//
// Se cuenta por dos llaves, porque cada una cubre lo que la otra no:
//
//   - Por usuario: protege una cuenta aunque el atacante cambie de IP.
//   - Por IP: frena el barrido de muchos usuarios desde un mismo equipo, que
//     por usuario nunca llegaría al tope.
//
// El tope por IP es alto porque el departamento sale a internet por una sola
// dirección: un límite bajo dejaría fuera a todo el personal por los errores de
// una persona.
//
// El estado vive en memoria del proceso, lo que basta mientras la API corra en
// una sola instancia; con varias, cada una llevaría su propia cuenta.

const VENTANA_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;
const MAX_POR_USUARIO = 5;
const MAX_POR_IP = 30;

interface Intento {
  fallos: number;
  /** Fin de la ventana en la que se acumulan los fallos. */
  vence: number;
  /** Epoch hasta el que se rechaza sin siquiera consultar la base. */
  bloqueadoHasta?: number;
}

const porUsuario = new Map<string, Intento>();
const porIp = new Map<string, Intento>();

/** Normaliza el nombre de usuario para que las variantes de escritura compartan contador. */
function claveUsuario(nombreUsuario: unknown): string {
  return typeof nombreUsuario === "string" ? nombreUsuario.trim().toLowerCase() : "";
}

/**
 * Solo cuenta por IP cuando la dirección identifica a quien llama. Si es
 * privada o de loopback, lo que se ve es un proxy intermedio y todo el
 * departamento caería en el mismo cubo, así que en ese caso se usa solo el
 * límite por usuario.
 */
function ipUtilizable(ip: string | undefined): ip is string {
  if (!ip) return false;
  const limpia = ip.replace(/^::ffff:/, "");
  if (limpia === "::1" || limpia.startsWith("127.")) return false;
  if (limpia.startsWith("10.") || limpia.startsWith("192.168.")) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(limpia)) return false;
  if (limpia.startsWith("fc") || limpia.startsWith("fd")) return false;
  return true;
}

/** Segundos que faltan para poder reintentar; 0 si no está bloqueado. */
function segundosBloqueo(mapa: Map<string, Intento>, clave: string, ahora: number): number {
  const intento = mapa.get(clave);
  if (!intento?.bloqueadoHasta) return 0;
  if (intento.bloqueadoHasta <= ahora) {
    mapa.delete(clave);
    return 0;
  }
  return Math.ceil((intento.bloqueadoHasta - ahora) / 1000);
}

/** Suma un fallo. Devuelve true solo en el intento que dispara el bloqueo. */
function sumarFallo(mapa: Map<string, Intento>, clave: string, max: number, ahora: number): boolean {
  const previo = mapa.get(clave);
  const intento: Intento =
    previo && previo.vence > ahora ? previo : { fallos: 0, vence: ahora + VENTANA_MS };

  intento.fallos += 1;
  mapa.set(clave, intento);

  if (intento.fallos >= max && !intento.bloqueadoHasta) {
    intento.bloqueadoHasta = ahora + BLOQUEO_MS;
    return true;
  }
  return false;
}

/** Elimina las llaves caducadas para que los mapas no crezcan indefinidamente. */
function purgar(ahora: number): void {
  for (const mapa of [porUsuario, porIp]) {
    for (const [clave, intento] of mapa) {
      const caduco = (intento.bloqueadoHasta ?? intento.vence) <= ahora;
      if (caduco) mapa.delete(clave);
    }
  }
}

let ultimaPurga = 0;

/**
 * Middleware previo al login: si la cuenta o la IP están bloqueadas, corta
 * antes de tocar la base de datos y de comparar el hash con bcrypt.
 */
export function limitarLogin(req: Request, res: Response, next: NextFunction): void {
  const ahora = Date.now();

  if (ahora - ultimaPurga > VENTANA_MS) {
    purgar(ahora);
    ultimaPurga = ahora;
  }

  const usuario = claveUsuario((req.body as { nombreUsuario?: unknown } | undefined)?.nombreUsuario);
  const ip = req.ip;

  const espera = Math.max(
    usuario ? segundosBloqueo(porUsuario, usuario, ahora) : 0,
    ipUtilizable(ip) ? segundosBloqueo(porIp, ip, ahora) : 0
  );

  if (espera > 0) {
    const minutos = Math.ceil(espera / 60);
    res.setHeader("Retry-After", String(espera));
    res.status(429).json({
      error: `Demasiados intentos fallidos. Vuelve a intentar en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
    });
    return;
  }

  next();
}

/** Se llama cuando las credenciales no coinciden. */
export async function registrarFalloLogin(nombreUsuario: unknown, ip: string | undefined): Promise<void> {
  const ahora = Date.now();
  const usuario = claveUsuario(nombreUsuario);
  const clip = ip ?? "desconocida";

  const bloqueoUsuario = usuario ? sumarFallo(porUsuario, usuario, MAX_POR_USUARIO, ahora) : false;
  const bloqueoIp = ipUtilizable(ip) ? sumarFallo(porIp, ip, MAX_POR_IP, ahora) : false;

  // Solo se registra el bloqueo, no cada intento: durante un ataque se llenaría
  // la bitácora.
  if (bloqueoUsuario) {
    await registrarBitacora(
      null,
      Acciones.Bloqueo,
      "usuarios",
      undefined,
      `Acceso bloqueado por ${MAX_POR_USUARIO} intentos fallidos sobre el usuario "${usuario}"`,
      clip
    );
  }
  if (bloqueoIp) {
    await registrarBitacora(
      null,
      Acciones.Bloqueo,
      undefined,
      undefined,
      `Acceso bloqueado por ${MAX_POR_IP} intentos fallidos desde la misma dirección`,
      clip
    );
  }
}

/**
 * Se llama al iniciar sesión correctamente: limpia los fallos previos de esa
 * cuenta. El contador por IP no se limpia para que un acierto suelto no borre el
 * rastro de un barrido en curso.
 */
export function limpiarFallosLogin(nombreUsuario: unknown): void {
  const usuario = claveUsuario(nombreUsuario);
  if (usuario) porUsuario.delete(usuario);
}

/** Solo para pruebas. */
export function reiniciarLimites(): void {
  porUsuario.clear();
  porIp.clear();
  ultimaPurga = 0;
}
