import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../auth/AuthContext";
import logoNogales from "../assets/logo_nogales.png";
import logoFrontera from "../assets/logo_frontera.png";
import "./login.css";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(nombreUsuario, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-fondo">
      <div className="login-shell">
        <div className="login-left">
          <div className="brand-icon">
            <i className="bi bi-building" />
          </div>
          <h1>H. Ayuntamiento de Nogales</h1>
          <div className="sub">Sindicatura Municipal</div>
          <p className="desc">
            Sistema de Gestión del Departamento de Control de Panteones. Administración de expedientes, títulos de
            propiedad, permisos y trámites.
          </p>
          <div style={{ marginTop: "1.3rem" }}>
            <div className="feature">
              <i className="bi bi-shield-check" /> Acceso exclusivo para personal autorizado
            </div>
            <div className="feature">
              <i className="bi bi-journal-text" /> Toda actividad queda registrada en bitácora
            </div>
            <div className="feature">
              <i className="bi bi-file-earmark-lock" /> Documentos oficiales con folio y control
            </div>
          </div>
          <div className="foot">Nogales, Sonora, México · Frontera de Todos</div>
        </div>

        <div className="login-right">
          <h2>Iniciar sesión</h2>
          <p className="hint">Ingresa tus credenciales para acceder al sistema.</p>

          {error && (
            <div className="aviso-error" style={{ marginBottom: 16 }}>
              <i className="bi bi-exclamation-triangle" style={{ marginRight: 6 }} />
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="login-campo">
              <label className="form-label">Usuario</label>
              <div className="input-wrap">
                <i className="bi bi-person lead-ic" />
                <input
                  className="form-control"
                  placeholder="Nombre de usuario"
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="login-campo" style={{ marginBottom: "1.4rem" }}>
              <label className="form-label">Contraseña</label>
              <div className="input-wrap">
                <i className="bi bi-lock lead-ic" />
                <input
                  className="form-control"
                  style={{ paddingRight: "2.6rem" }}
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-pass"
                  tabIndex={-1}
                  title="Mostrar contraseña"
                  onClick={() => setMostrarPassword((v) => !v)}
                >
                  <i className={`bi ${mostrarPassword ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
            </div>
            <button className="btn-ingresar" type="submit" disabled={enviando}>
              <i className="bi bi-box-arrow-in-right" style={{ marginRight: 8 }} />
              {enviando ? "Entrando..." : "Ingresar"}
            </button>
          </form>

          <div className="logos-row">
            <img src={logoNogales} alt="H. Ayuntamiento de Nogales" />
            <img src={logoFrontera} alt="Frontera de Todos" />
          </div>
          <div className="version">Sistema de Gestión de Trámites · v1.0 · © 2026</div>
        </div>
      </div>
    </div>
  );
}
