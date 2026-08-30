import { getToken, clearToken } from "./token";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    credentials: "include", // conveniencia en local (mismo origen); en producción el auth real va por el header de abajo
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  // Un 401 fuera del propio flujo de login significa que la cookie murió a
  // mitad de la sesión (expiró o el servidor la invalidó). El original .NET
  // resuelve esto solo porque cada navegación es una petición nueva al
  // servidor; aquí, sin este redirect, la SPA se queda mostrando una pantalla
  // rota con errores 401 silenciosos en vez de mandar a /login como se espera.
  if (res.status === 401 && !ruta.startsWith("/auth/")) {
    clearToken();
    // Con HashRouter, la app siempre vive en BASE_URL/index.html -- la ruta
    // real la decide todo lo que va después de "#".
    window.location.href = `${import.meta.env.BASE_URL}#/login`;
    return new Promise<T>(() => {});
  }

  const cuerpo = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, cuerpo?.error ?? "Error de comunicación con el servidor");
  }

  return cuerpo as T;
}

// Los botones de imprimir eran <a href> directos a la API: una navegación de
// enlace normal no puede llevar el header Authorization, así que dependían
// por completo de la cookie -- justo la que los navegadores con protección
// de privacidad bloquean entre sitios distintos. Se descarga por JS en su
// lugar, con el mismo token que usa el resto de la app.
export async function descargarArchivo(ruta: string, nombreRespaldo = "documento"): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${ruta}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new ApiError(res.status, cuerpo?.error ?? "No se pudo generar el documento");
  }

  // Las rutas de descarga ya mandan el nombre real en Content-Disposition;
  // el respaldo solo aplica si por algo faltara.
  const nombreServidor = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1];

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreServidor ?? nombreRespaldo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
