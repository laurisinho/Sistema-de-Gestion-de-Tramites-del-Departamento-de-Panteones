import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface Rol {
  rolId: number;
  nombre: string;
  descripcion: string | null;
}

export function UsuarioNuevo() {
  const navigate = useNavigate();
  const { data: roles } = useQuery({
    queryKey: ["catalogos", "roles"],
    queryFn: () => api<{ roles: Rol[] }>("/catalogos/roles").then((r) => r.roles),
  });

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [rolId, setRolId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const rolSel = roles?.find((r) => String(r.rolId) === rolId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await api("/usuarios", {
        method: "POST",
        body: JSON.stringify({
          nombreUsuario,
          nombreCompleto,
          email: email || undefined,
          rolId: Number(rolId),
          password,
        }),
      });
      navigate("/usuarios", { state: { exito: `Usuario ${nombreUsuario} creado correctamente.` } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-person-plus" />
          Nuevo usuario
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/usuarios">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {error && <p className="aviso-error">{error}</p>}

      <form onSubmit={onSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person" /> Datos de la cuenta
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none" }}>
              <div className="form-campo">
                <label>Nombre de usuario *</label>
                <input
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                  placeholder="ej: jperez"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-campo">
                <label>Rol *</label>
                <select value={rolId} onChange={(e) => setRolId(e.target.value)} required>
                  <option value="">Selecciona...</option>
                  {roles?.map((r) => (
                    <option key={r.rolId} value={r.rolId}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
                {rolSel?.descripcion && (
                  <p className="text-muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                    {rolSel.descripcion}
                  </p>
                )}
              </div>
              <div className="form-campo span2">
                <label>Nombre completo *</label>
                <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required />
              </div>
              <div className="form-campo span2">
                <label>Correo electrónico</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-lock" /> Contraseña
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none" }}>
              <div className="form-campo">
                <label>Contraseña *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              <div className="form-campo">
                <label>Confirmar contraseña *</label>
                <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
              Mínimo 8 caracteres. La persona podrá cambiarla más adelante iniciando sesión.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="boton-secundario" onClick={() => navigate("/usuarios")}>
            Cancelar
          </button>
          <button className="boton" type="submit" disabled={enviando}>
            <i className="bi bi-check-circle" /> {enviando ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
