export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    credentials: "include", // envía/recibe la cookie auth_token
    headers: { "Content-Type": "application/json", ...opciones.headers },
  });

  // Un 401 fuera del propio flujo de login significa que la cookie murió a
  // mitad de la sesión (expiró o el servidor la invalidó). El original .NET
  // resuelve esto solo porque cada navegación es una petición nueva al
  // servidor; aquí, sin este redirect, la SPA se queda mostrando una pantalla
  // rota con errores 401 silenciosos en vez de mandar a /login como se espera.
  if (res.status === 401 && !ruta.startsWith("/auth/")) {
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
