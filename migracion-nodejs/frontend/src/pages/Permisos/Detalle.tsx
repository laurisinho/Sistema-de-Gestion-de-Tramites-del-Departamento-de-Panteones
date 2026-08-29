import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, API_URL, ApiError } from "../../lib/api";
import { claseEstado } from "../../lib/badges";

interface PermisoDetalle {
  permisoId: number;
  folio: string;
  estado: string;
  fechaSolicitud: string | null;
  fechaEmision: string | null;
  numeroRecibo: string | null;
  funeraria: string | null;
  motivoExhumacion: string | null;
  destinoRestos: string | null;
  ubicacionDeposito: string | null;
  tipoObra: string | null;
  descripcionObra: string | null;
  esDonacion: boolean;
  tipoTramite: { clave: string; nombre: string };
  solicitante: { nombreCompleto: string; telefono: string | null; domicilio: string | null };
  fallecido: { nombreCompleto: string; fechaFallecimiento: string | null; actaDefuncionNumero: string | null } | null;
  lote: { numeroManzana: string; numeroLote: string; seccion: string | null; panteon: { nombre: string } } | null;
  usuarioRegistro: { nombreCompleto: string } | null;
}

function fecha(f: string | null): string {
  return f ? new Date(f).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—";
}

export function PermisoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["permisos", id],
    queryFn: () => api<{ permiso: PermisoDetalle }>(`/permisos/${id}`).then((r) => r.permiso),
  });

  const cancelar = useMutation({
    mutationFn: () => api(`/permisos/${id}/cancelar`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permisos"] });
      navigate("/permisos", { state: { exito: `Permiso ${data?.folio} cancelado.` } });
    },
    onError: (err) => alert(err instanceof ApiError ? err.message : "No se pudo cancelar"),
  });

  if (!data) return <p>Cargando...</p>;
  const clave = data.tipoTramite.clave;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-text" />
          Permiso {data.folio}
        </h2>
        <div className="page-header-acciones">
          <a href={`${API_URL}/permisos/${id}/pdf`} target="_blank" rel="noreferrer" className="boton-secundario">
            <i className="bi bi-printer" /> Imprimir
          </a>
          <Link className="boton-secundario" to={`/reimpresiones?tipo=PERMISO&id=${id}`}>
            <i className="bi bi-printer-fill" /> Reimprimir con sello
          </Link>
          {data.estado !== "CANCELADO" && (
            <>
              <Link className="boton-secundario" to={`/permisos/${id}/editar`}>
                <i className="bi bi-pencil" /> Editar
              </Link>
              <button
                className="boton-secundario"
                onClick={() => {
                  if (confirm(`¿Cancelar el permiso ${data.folio}?`)) cancelar.mutate();
                }}
              >
                <i className="bi bi-x-circle" /> Cancelar
              </button>
            </>
          )}
          <Link className="boton-secundario" to="/permisos">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-file-earmark-text" /> Datos del Permiso
            </span>
          </div>
          <div className="card-body">
            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: "42%", paddingBottom: 10 }}>Tipo</td>
                  <td style={{ paddingBottom: 10 }}>
                    <span className="badge badge-guinda">{data.tipoTramite.nombre}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Estado</td>
                  <td style={{ paddingBottom: 10 }}>
                    <span className={claseEstado(data.estado)}>{data.estado}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 10 }}>Fecha de solicitud</td>
                  <td style={{ paddingBottom: 10 }}>{fecha(data.fechaSolicitud)}</td>
                </tr>
                {data.numeroRecibo && (
                  <tr>
                    <td className="text-muted" style={{ paddingBottom: 10 }}>Número de recibo</td>
                    <td style={{ paddingBottom: 10 }}>{data.numeroRecibo}</td>
                  </tr>
                )}
                {data.funeraria && (
                  <tr>
                    <td className="text-muted" style={{ paddingBottom: 10 }}>Funeraria</td>
                    <td style={{ paddingBottom: 10 }}>{data.funeraria}</td>
                  </tr>
                )}
                {data.esDonacion && (
                  <tr>
                    <td className="text-muted">Donación</td>
                    <td>
                      <span className="badge badge-info">Lote donado</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="text-muted">Registró</td>
                  <td>{data.usuarioRegistro?.nombreCompleto ?? "—"}</td>
                </tr>
              </tbody>
            </table>

            {clave === "EXH" && (data.motivoExhumacion || data.destinoRestos) && (
              <>
                <h4 style={{ marginTop: 18 }}>Datos de exhumación</h4>
                <p style={{ fontSize: 14, margin: 0 }}>
                  {data.motivoExhumacion && <>Motivo: {data.motivoExhumacion}<br /></>}
                  {data.destinoRestos && <>Destino de los restos: {data.destinoRestos}</>}
                </p>
              </>
            )}
            {clave === "CEN" && data.ubicacionDeposito && (
              <>
                <h4 style={{ marginTop: 18 }}>Depósito de cenizas</h4>
                <p style={{ fontSize: 14, margin: 0 }}>Ubicación: {data.ubicacionDeposito}</p>
              </>
            )}
            {clave === "CON" && (data.tipoObra || data.descripcionObra) && (
              <>
                <h4 style={{ marginTop: 18 }}>Datos de construcción</h4>
                <p style={{ fontSize: 14, margin: 0 }}>
                  {data.tipoObra && <>Tipo: {data.tipoObra}<br /></>}
                  {data.descripcionObra && <>Descripción: {data.descripcionObra}</>}
                </p>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-person" /> Solicitante
              </span>
            </div>
            <div className="card-body">
              <table style={{ fontSize: 14, width: "100%" }}>
                <tbody>
                  <tr>
                    <td className="text-muted" style={{ width: "42%", paddingBottom: 8 }}>Nombre</td>
                    <td style={{ paddingBottom: 8, fontWeight: 600 }}>{data.solicitante.nombreCompleto}</td>
                  </tr>
                  <tr>
                    <td className="text-muted" style={{ paddingBottom: 8 }}>Teléfono</td>
                    <td style={{ paddingBottom: 8 }}>{data.solicitante.telefono ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Domicilio</td>
                    <td>{data.solicitante.domicilio ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {data.fallecido && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header-guinda">
                <span>
                  <i className="bi bi-flower1" /> Fallecido
                </span>
              </div>
              <div className="card-body">
                <table style={{ fontSize: 14, width: "100%" }}>
                  <tbody>
                    <tr>
                      <td className="text-muted" style={{ width: "42%", paddingBottom: 8 }}>Nombre</td>
                      <td style={{ paddingBottom: 8, fontWeight: 600 }}>{data.fallecido.nombreCompleto}</td>
                    </tr>
                    <tr>
                      <td className="text-muted" style={{ paddingBottom: 8 }}>Fecha de fallecimiento</td>
                      <td style={{ paddingBottom: 8 }}>{fecha(data.fallecido.fechaFallecimiento)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Acta de defunción</td>
                      <td>{data.fallecido.actaDefuncionNumero ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.lote && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header-guinda">
                <span>
                  <i className="bi bi-clock-history" /> Lote
                </span>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 14, margin: 0 }}>
                  {data.lote.panteon.nombre}
                  {data.lote.seccion ? ` · Secc. ${data.lote.seccion}` : ""} · Mz {data.lote.numeroManzana} · Lote {data.lote.numeroLote}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
