import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmModal } from "../../components/ConfirmModal";

interface Rol {
  rolId: number;
  nombre: string;
}

interface UsuarioFila {
  usuarioId: number;
  nombreUsuario: string;
  nombreCompleto: string;
  email: string | null;
  activo: boolean;
  fechaAlta: string;
  ultimoAcceso: string | null;
  rol: Rol;
}

function fecha(f: string | null): string {
  return f ? new Date(f).toLocaleDateString("es-MX") : "—";
}
function fechaHora(f: string | null): string {
  return f ? new Date(f).toLocaleString("es-MX") : "Nunca";
}

export function UsuariosLista() {
  const { usuario: yo } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const exito = (location.state as { exito?: string } | null)?.exito;

  const [q, setQ] = useState("");
  const [rolId, setRolId] = useState("");
  const [estado, setEstado] = useState("");
  const [filtros, setFiltros] = useState({ q: "", rolId: "", estado: "" });

  const [aCambiarEstado, setACambiarEstado] = useState<UsuarioFila | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [aRestablecer, setARestablecer] = useState<UsuarioFila | null>(null);

  const { data: roles } = useQuery({
    queryKey: ["catalogos", "roles"],
    queryFn: () => api<{ roles: Rol[] }>("/catalogos/roles").then((r) => r.roles),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.rolId) params.set("rolId", filtros.rolId);
      if (filtros.estado) params.set("activo", filtros.estado);
      return api<{ usuarios: UsuarioFila[] }>(`/usuarios?${params}`).then((r) => r.usuarios);
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: (u: UsuarioFila) => api(`/usuarios/${u.usuarioId}/${u.activo ? "desactivar" : "activar"}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setACambiarEstado(null);
    },
    onError: (err) => setErrorEstado(err instanceof ApiError ? err.message : "No se pudo actualizar"),
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-people" />
          Usuarios
        </h2>
        <div className="page-header-acciones">
          <Link className="boton" to="/usuarios/nuevo">
            <i className="bi bi-person-plus" /> Nuevo usuario
          </Link>
        </div>
      </div>

      {exito && <p className="aviso-exito">{exito}</p>}

      <div className="card">
        <div className="card-body">
          <form
            className="barra-filtros"
            style={{ marginBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros({ q, rolId, estado });
            }}
          >
            <input
              placeholder="Usuario, nombre o email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <select value={rolId} onChange={(e) => setRolId(e.target.value)}>
              <option value="">Todos los roles</option>
              {roles?.map((r) => (
                <option key={r.rolId} value={r.rolId}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Usuarios registrados
          </span>
          <span className="badge badge-warning">{data?.length ?? 0} registro(s)</span>
        </div>
        <div className="card-body p-0">
          {isLoading && <p style={{ padding: "1rem 1.2rem" }}>Cargando...</p>}
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre completo</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Último acceso</th>
                    <th>Alta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={8}>Sin usuarios registrados.</td>
                    </tr>
                  )}
                  {data.map((u) => (
                    <tr key={u.usuarioId}>
                      <td>
                        <small className="font-monospace">{u.nombreUsuario}</small>
                      </td>
                      <td className="tabla-col-ancha">{u.nombreCompleto}</td>
                      <td className="tabla-col-ancha">
                        <small className="text-muted">{u.email ?? "—"}</small>
                      </td>
                      <td>
                        <span className="badge badge-guinda">{u.rol.nombre}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.activo ? "badge-success" : "badge-secondary"}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">{fechaHora(u.ultimoAcceso)}</small>
                      </td>
                      <td>
                        <small className="text-muted">{fecha(u.fechaAlta)}</small>
                      </td>
                      <td>
                        <div className="tabla-acciones">
                          <Link to={`/usuarios/${u.usuarioId}/editar`} className="boton-secundario boton-sm" title="Editar">
                            <i className="bi bi-pencil" />
                          </Link>
                          <button
                            className="boton-secundario boton-sm"
                            title="Restablecer contraseña"
                            onClick={() => setARestablecer(u)}
                          >
                            <i className="bi bi-key" />
                          </button>
                          {u.usuarioId !== yo?.usuarioId && (
                            <button
                              className={u.activo ? "boton-peligro boton-sm" : "boton-secundario boton-sm"}
                              title={u.activo ? "Desactivar" : "Activar"}
                              onClick={() => {
                                setACambiarEstado(u);
                                setErrorEstado(null);
                              }}
                            >
                              <i className={`bi ${u.activo ? "bi-slash-circle" : "bi-check-circle"}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        abierto={!!aCambiarEstado}
        titulo={aCambiarEstado?.activo ? "Confirmar desactivación" : "Confirmar activación"}
        mensaje={
          <>
            ¿Desea {aCambiarEstado?.activo ? "desactivar" : "activar"} al usuario{" "}
            <strong>{aCambiarEstado?.nombreCompleto}</strong>?
          </>
        }
        nota={aCambiarEstado?.activo ? "No podrá iniciar sesión hasta que se reactive su cuenta." : undefined}
        error={errorEstado}
        textoConfirmar={aCambiarEstado?.activo ? "Sí, desactivar" : "Sí, activar"}
        iconoConfirmar={aCambiarEstado?.activo ? "bi-slash-circle" : "bi-check-circle"}
        cargando={cambiarEstado.isPending}
        onCancelar={() => {
          setACambiarEstado(null);
          setErrorEstado(null);
        }}
        onConfirmar={() => aCambiarEstado && cambiarEstado.mutate(aCambiarEstado)}
      />

      {aRestablecer && <RestablecerPasswordModal usuario={aRestablecer} onCerrar={() => setARestablecer(null)} />}
    </div>
  );
}

function RestablecerPasswordModal({ usuario, onCerrar }: { usuario: UsuarioFila; onCerrar: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onConfirmar() {
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await api(`/usuarios/${usuario.usuarioId}/password`, { method: "PATCH", body: JSON.stringify({ password }) });
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3>
            <i className="bi bi-key" /> Restablecer contraseña
          </h3>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="modal-cuerpo">
          <p className="text-muted" style={{ marginTop: 0, fontSize: 13.5 }}>
            Nueva contraseña para <strong>{usuario.nombreCompleto}</strong> ({usuario.nombreUsuario}).
          </p>
          <div className="form-grid una-col">
            <div className="form-campo">
              <label>Nueva contraseña *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            <div className="form-campo">
              <label>Confirmar contraseña *</label>
              <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </div>
          </div>
          {error && (
            <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>
        <div className="modal-pie">
          <button type="button" className="boton-secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className="boton" onClick={onConfirmar} disabled={enviando}>
            <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Restablecer"}
          </button>
        </div>
      </div>
    </div>
  );
}
