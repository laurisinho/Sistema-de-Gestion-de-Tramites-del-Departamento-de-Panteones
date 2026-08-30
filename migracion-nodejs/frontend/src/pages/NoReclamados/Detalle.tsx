import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { ConfirmModal } from "../../components/ConfirmModal";

interface Fallecido {
  fallecidoId: number;
  nombreCompleto: string;
  posibleNombre: string | null;
  numeroCaso: string | null;
  fechaFallecimiento: string | null;
  horaFallecimiento: string | null;
  fechaLevantamiento: string | null;
  lugarLevantamiento: string | null;
  ministerioPublico: string | null;
  actaDefuncionNumero: string | null;
  actaDefuncionFolio: string | null;
  actaDefuncionFecha: string | null;
  causaFallecimiento: string | null;
  descripcionHallazgo: string | null;
  reconocido: boolean;
  fechaRegistro: string;
}

interface Reconocimiento {
  nombreIdentificado: string;
  fechaReconocimiento: string | null;
  medioIdentificacion: string | null;
  instanciaSolicita: string | null;
  permisoExhumacionId: number | null;
  permisoExhumacion: { folio: string } | null;
}

interface DetalleData {
  fallecido: Fallecido;
  ubicacion: string | null;
  reconocimiento: Reconocimiento | null;
}

function fecha(f: string | null): string {
  if (!f) return "—";
  const d = new Date(f);
  if (d.getUTCFullYear() <= 1905) return "—";
  return d.toLocaleDateString("es-MX", { timeZone: "UTC" });
}
function hora(f: string | null): string | null {
  if (!f) return null;
  const d = new Date(f);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function NoReclamadoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["no-reclamados", id],
    queryFn: () => api<DetalleData>(`/no-reclamados/${id}`),
  });

  const eliminar = useMutation({
    mutationFn: () => api(`/no-reclamados/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no-reclamados"] });
      navigate("/no-reclamados", { state: { exito: "Registro eliminado." } });
    },
  });

  if (isLoading) return <p>Cargando...</p>;
  if (!data) return <p className="aviso-error">No se encontró el registro.</p>;

  const { fallecido: f, ubicacion, reconocimiento: rec } = data;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-person-x" />
          Persona No Reclamada
        </h2>
        <div className="page-header-acciones">
          {!f.reconocido && (
            <Link className="boton" to={`/no-reclamados/${id}/reconocer`}>
              <i className="bi bi-person-check" /> Reconocer
            </Link>
          )}
          <Link className="boton-secundario" to={`/no-reclamados/${id}/editar`}>
            <i className="bi bi-pencil" /> Editar
          </Link>
          <Link className="boton-secundario" to="/no-reclamados">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {f.reconocido && rec && (
        <div className="card" style={{ borderColor: "#2fb875" }}>
          <div className="card-header-guinda" style={{ background: "#157347" }}>
            <span>
              <i className="bi bi-person-check" /> Persona identificada
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div>
                <div className="text-muted" style={{ fontSize: 12.5 }}>Sepultada como</div>
                <div style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>{f.nombreCompleto}</div>
                <div className="text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>Identificada como</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{rec.nombreIdentificado}</div>
              </div>
              <table style={{ fontSize: 14 }}>
                <tbody>
                  <tr>
                    <td className="text-muted" style={{ width: "42%", paddingBottom: 6 }}>Fecha</td>
                    <td style={{ paddingBottom: 6 }}>{fecha(rec.fechaReconocimiento)}</td>
                  </tr>
                  <tr>
                    <td className="text-muted" style={{ paddingBottom: 6 }}>Medio</td>
                    <td style={{ paddingBottom: 6 }}>{rec.medioIdentificacion ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-muted" style={{ paddingBottom: 6 }}>Solicita</td>
                    <td style={{ paddingBottom: 6 }}>{rec.instanciaSolicita ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Exhumación</td>
                    <td>
                      {rec.permisoExhumacion ? (
                        <Link to={`/permisos/${rec.permisoExhumacionId}`} className="badge badge-info">
                          {rec.permisoExhumacion.folio}
                        </Link>
                      ) : (
                        <span className="badge badge-warning">Pendiente — el lote sigue ocupado</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="detalle-grid" style={{ gridTemplateColumns: "7fr 5fr" }}>
        <div className="card">
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person" /> Identificación
            </span>
          </div>
          <div className="card-body">
            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: "38%", paddingBottom: 10 }}>Nombre</td>
                  <td style={{ fontWeight: 600, paddingBottom: 10 }}>{f.nombreCompleto}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Posible nombre</td>
                  <td style={{ paddingBottom: 10 }}>
                    {f.posibleNombre ? <span className={`badge ${f.reconocido ? "badge-success" : "badge-info"}`}>{f.posibleNombre}</span> : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Fecha de fallecimiento</td>
                  <td style={{ paddingBottom: 10 }}>
                    {fecha(f.fechaFallecimiento)}
                    {hora(f.horaFallecimiento) && <span className="text-muted"> · {hora(f.horaFallecimiento)}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Fecha de hallazgo</td>
                  <td style={{ paddingBottom: 10 }}>
                    {fecha(f.fechaLevantamiento)}
                    {f.lugarLevantamiento && (
                      <div>
                        <small className="text-muted">
                          <i className="bi bi-geo-alt" /> {f.lugarLevantamiento}
                        </small>
                      </div>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Ubicación</td>
                  <td style={{ paddingBottom: 10 }}>{ubicacion ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Causa</td>
                  <td style={{ paddingBottom: 10 }}>{f.causaFallecimiento ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ verticalAlign: "top" }}>Descripción del hallazgo</td>
                  <td>{f.descripcionHallazgo ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-file-earmark-text" /> Acta de Defunción
            </span>
          </div>
          <div className="card-body">
            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: "42%", paddingBottom: 10 }}>No. de acta</td>
                  <td style={{ fontWeight: 600, paddingBottom: 10 }}>{f.actaDefuncionNumero ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Folio</td>
                  <td style={{ paddingBottom: 10 }}>{f.actaDefuncionFolio ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Fecha del acta</td>
                  <td style={{ paddingBottom: 10 }}>{fecha(f.actaDefuncionFecha)}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>No. de caso (FGE)</td>
                  <td style={{ paddingBottom: 10 }} className="font-monospace">{f.numeroCaso ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ verticalAlign: "top", paddingBottom: 10 }}>Ministerio Público</td>
                  <td style={{ paddingBottom: 10 }}>{f.ministerioPublico ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted">Registrado</td>
                  <td>{fecha(f.fechaRegistro)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button className="boton-peligro" onClick={() => setConfirmando(true)}>
        <i className="bi bi-trash" /> Eliminar
      </button>
      {eliminar.isError && (
        <p className="aviso-error">{eliminar.error instanceof ApiError ? eliminar.error.message : "No se pudo eliminar"}</p>
      )}

      <ConfirmModal
        abierto={confirmando}
        titulo="Confirmar eliminación"
        mensaje={
          <>
            ¿Desea eliminar el registro de <strong>{f.nombreCompleto}</strong>?
          </>
        }
        nota="Solo se puede eliminar si no tiene un permiso vinculado."
        textoConfirmar="Sí, eliminar"
        iconoConfirmar="bi-trash"
        cargando={eliminar.isPending}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => eliminar.mutate()}
      />
    </div>
  );
}
