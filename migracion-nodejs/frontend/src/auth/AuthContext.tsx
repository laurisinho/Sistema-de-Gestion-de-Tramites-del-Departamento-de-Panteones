import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";

export interface Usuario {
  usuarioId: number;
  nombreUsuario: string;
  nombreCompleto: string;
  rol: string;
}

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (nombreUsuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api<{ usuario: Usuario }>("/auth/me")
      .then((r) => setUsuario(r.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  async function login(nombreUsuario: string, password: string) {
    const r = await api<{ usuario: Usuario }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ nombreUsuario, password }),
    });
    setUsuario(r.usuario);
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUsuario(null);
  }

  return <AuthContext.Provider value={{ usuario, cargando, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export { ApiError };
