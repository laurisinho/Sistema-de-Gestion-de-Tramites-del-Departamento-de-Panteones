import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface Rol {
  rolId: number;
  nombre: string;
  descripcion: string | null;
}

interface UsuarioDetalle {
  usuarioId: number;
  nombreUsuario: string;
  nombreCompleto: string;
  email: string | null;
  activo: boolean;
  rol: { rolId: number; nombre: string };
}

export function UsuarioEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: roles } = useQuery({
    queryKey: ["catalogos", "roles"],
    queryFn: () => api<{ roles: Rol[] }>("/catalogos/roles").then((r) => r.roles),
  });
  const { data } = useQuery({
    queryKey: ["usuarios", id],
    queryFn: () => api<{ usuario: UsuarioDetalle }>(`/usuarios/${id}`).then((r) => r.usuario),
  });

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [rolId, setRolId] = useState("");
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data || cargado) return;
    setNombreCompleto(data.nombreCompleto);
    setEmail(data.email ?? "");
    setRolId(String(data.rol.rolId));
    setCargado(true);
  }, [data, cargado]);

  const rolSel = roles?.find((r) => String(r.rolId) === rolId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/usuarios/${id}`, {
        method: "PUT",
        body: JSON.stringify({ nombreCompleto, email: email || undefined, rolId: Number(rolId) }),
      });
      navigate("/usuarios", { state: { exito: `Usuario ${data?.nombreUsuario} actualizado correctamente.` } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (!cargado || !data) return <p>Cargando...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-pencil-square" />
          Editar usuario — {data.nombreUsuario}
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
                <label>Nombre de usuario</label>
                <input value={data.nombreUsuario} readOnly disabled />
              </div>
              <div className="form-campo">
                <label>Rol *</label>
                <select value={rolId} onChange={(e) => setRolId(e.target.value)} required>
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="boton-secundario" onClick={() => navigate("/usuarios")}>
            Cancelar
          </button>
          <button className="boton" type="submit" disabled={enviando}>
            <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
