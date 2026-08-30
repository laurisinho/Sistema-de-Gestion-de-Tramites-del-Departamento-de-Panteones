import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  if (usuario?.rol !== "Administrador") {
    return (
      <div>
        <div className="page-header">
          <h2>
            <i className="bi bi-people" />
            Usuarios
          </h2>
        </div>
        <p className="aviso-error">
          <i className="bi bi-shield-lock" /> No tienes permiso para acceder a esta sección. Solo el rol Administrador
          puede gestionar usuarios.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
