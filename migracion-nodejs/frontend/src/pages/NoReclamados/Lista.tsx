import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface FallecidoFila {
  fallecidoId: number;
  nombreCompleto: string;
  posibleNombre: string | null;
  numeroCaso: string | null;
  fechaFallecimiento: string | null;
  fechaLevantamiento: string | null;
  actaDefuncionNumero: string | null;
  reconocido: boolean;
}

function fecha(f: string | null): string {
  if (!f) return "—";
  const d = new Date(f);
  if (d.getUTCFullYear() <= 1905) return "—";
  return d.toLocaleDateString("es-MX", { timeZone: "UTC" });
}

export function NoReclamadosLista() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const exito = (location.state as { exito?: string } | null)?.exito;
  const [q, setQ] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["no-reclamados", busqueda],
    queryFn: () =>
      api<{ lista: FallecidoFila[]; total: number }>(`/no-reclamados?q=${encodeURIComponent(busqueda)}`),
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => api(`/no-reclamados/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["no-reclamados"] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : "No se pudo eliminar"),
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-person-x" />
          Personas No Reclamadas
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/no-reclamados/reconocidos">
            <i className="bi bi-person-check" /> Identificadas
          </Link>
          <Link className="boton-secundario" to="/no-reclamados/lotes-disponibles">
            <i className="bi bi-grid-3x3-gap" /> Lotes disponibles
          </Link>
          <Link className="boton-secundario" to="/no-reclamados/reporte">
            <i className="bi bi-file-earmark-excel" /> Reporte Excel
          </Link>
          <Link className="boton" to="/no-reclamados/nuevo">
            <i className="bi bi-plus-circle" /> Nuevo registro
          </Link>
        </div>
      </div>

      {exito && <p className="aviso-exito">{exito}</p>}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-funnel" /> Búsqueda
          </span>
        </div>
        <div className="card-body">
          <form
            className="barra-filtros"
            style={{ marginBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setBusqueda(q);
            }}
          >
            <input
              placeholder="Ej: Manuel Ponce, 00999, persona desconocida..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 340 }}
            />
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Resultados
          </span>
          <span className="badge badge-warning">
            {data?.lista.length ?? 0} mostrados / {data?.total ?? 0} totales
          </span>
        </div>
        <div className="card-body p-0">
          {isLoading && <p style={{ padding: "1rem 1.2rem" }}>Cargando...</p>}
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Posible nombre</th>
                    <th>Fallecimiento</th>
                    <th>Hallazgo</th>
                    <th>Acta</th>
                    <th>No. Caso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.lista.length === 0 && (
                    <tr>
                      <td colSpan={7}>No se encontraron registros.</td>
                    </tr>
                  )}
                  {data.lista.map((f) => (
                    <tr key={f.fallecidoId}>
                      <td style={{ fontWeight: 600 }}>
                        {f.nombreCompleto}{" "}
                        {f.reconocido && (
                          <span className="badge badge-success" title="Persona ya identificada">
                            <i className="bi bi-person-check" />
                          </span>
                        )}
                      </td>
                      <td>
                        {f.posibleNombre ? (
                          <span className={`badge ${f.reconocido ? "badge-success" : "badge-info"}`}>{f.posibleNombre}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <small>{fecha(f.fechaFallecimiento)}</small>
                      </td>
                      <td>
                        <small className="text-muted">{fecha(f.fechaLevantamiento)}</small>
                      </td>
                      <td>
                        <small className="text-muted">{f.actaDefuncionNumero ?? "—"}</small>
                      </td>
                      <td>
                        <small className="text-muted font-monospace">{f.numeroCaso ?? "—"}</small>
                      </td>
                      <td>
                        <div className="tabla-acciones">
                          <Link to={`/no-reclamados/${f.fallecidoId}`} className="boton boton-sm" title="Ver">
                            <i className="bi bi-eye" />
                          </Link>
                          {!f.reconocido && (
                            <Link to={`/no-reclamados/${f.fallecidoId}/reconocer`} className="boton-secundario boton-sm" title="Reconocer">
                              <i className="bi bi-person-check" />
                            </Link>
                          )}
                          <Link to={`/no-reclamados/${f.fallecidoId}/editar`} className="boton-secundario boton-sm" title="Editar">
                            <i className="bi bi-pencil" />
                          </Link>
                          <button
                            className="boton-secundario boton-sm"
                            title="Eliminar"
                            onClick={() => {
                              if (confirm(`¿Eliminar el registro de "${f.nombreCompleto}"?`)) eliminar.mutate(f.fallecidoId);
                            }}
                          >
                            <i className="bi bi-trash" />
                          </button>
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
    </div>
  );
}
