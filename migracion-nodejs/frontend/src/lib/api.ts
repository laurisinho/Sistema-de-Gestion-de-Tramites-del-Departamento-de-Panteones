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

  const cuerpo = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, cuerpo?.error ?? "Error de comunicación con el servidor");
  }

  return cuerpo as T;
}
