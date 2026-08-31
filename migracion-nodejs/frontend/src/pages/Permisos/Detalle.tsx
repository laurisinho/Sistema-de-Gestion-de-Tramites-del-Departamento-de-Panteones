import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { claseEstado } from "../../lib/badges";
import { ConfirmModal } from "../../components/ConfirmModal";
import { BotonImprimir } from "../../components/BotonImprimir";
import { useAuth } from "../../auth/AuthContext";

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
  lote: {
    numeroManzana: string;
    numeroLote: string;
    seccion: string | null;
    colindanciaNorte: string | null;
    colindanciaSur: string | null;
    colindanciaEste: string | null;
    colindanciaOeste: string | null;
    panteon: { nombre: string };
  } | null;
  usuarioRegistro: { nombreCompleto: string } | null;
}

function fecha(f: string | null): string {
  return f ? new Date(f).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—";
}

export function PermisoDetalle() {
  const { usuario } = useAuth();
  const puedeEscribir = usuario?.rol !== "Consulta";
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);
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
    onError: (err) => setErrorCancelar(err instanceof ApiError ? err.message : "No se pudo cancelar"),
  });

  if (!data) return <p>Cargando...</p>;
  const clave = data.tipoTramite.clave;
  const usaColindancias = data.lote?.numeroManzana === "S/N";

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-text" />
          Permiso {data.folio}
        </h2>
        <div className="page-header-acciones">
          <BotonImprimir ruta={`/permisos/${id}/pdf`} nombreArchivo={`permiso-${data.folio}.pdf`} className="boton-secundario">
            {" "}Imprimir
          </BotonImprimir>
          {puedeEscribir && (
            <Link className="boton-secundario" to={`/reimpresiones?tipo=PERMISO&id=${id}`}>
              <i className="bi bi-printer-fill" /> Reimprimir con sello
            </Link>
          )}
          {data.estado !== "CANCELADO" && puedeEscribir && (
            <>
              <Link className="boton-secundario" to={`/permisos/${id}/editar`}>
                <i className="bi bi-pencil" /> Editar
              </Link>
              <button
                className="boton-peligro"
                onClick={() => {
                  setConfirmando(true);
                  setErrorCancelar(null);
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

      {data.estado === "CANCELADO" && (
        <p className="aviso-error" style={{ marginBottom: 16 }}>
          <i className="bi bi-exclamation-triangle" /> Este permiso está cancelado.
        </p>
      )}

      <div className="detalle-grid">
        <div className="card">
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

        <div className="card">
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
                  <td className="text-muted">Teléfono</td>
                  <td>{data.solicitante.telefono ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {data.fallecido && (
          <div className={`card${data.lote ? "" : " span2"}`}>
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
          <div className={`card${data.fallecido ? "" : " span2"}`}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-clock-history" /> Lote
              </span>
            </div>
            <div className="card-body">
              <table style={{ fontSize: 14, width: "100%" }}>
                <tbody>
                  <tr>
                    <td className="text-muted" style={{ width: "42%", paddingBottom: 8 }}>Panteón</td>
                    <td style={{ paddingBottom: 8, fontWeight: 600 }}>{data.lote.panteon.nombre}</td>
                  </tr>
                  {usaColindancias ? (
                    <>
                      <tr>
                        <td className="text-muted" style={{ paddingBottom: 8 }}>Norte</td>
                        <td style={{ paddingBottom: 8 }}>{data.lote.colindanciaNorte ?? "—"}</td>
                      </tr>
                      <tr>
                        <td className="text-muted" style={{ paddingBottom: 8 }}>Sur</td>
                        <td style={{ paddingBottom: 8 }}>{data.lote.colindanciaSur ?? "—"}</td>
                      </tr>
                      <tr>
                        <td className="text-muted" style={{ paddingBottom: 8 }}>Este</td>
                        <td style={{ paddingBottom: 8 }}>{data.lote.colindanciaEste ?? "—"}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Oeste</td>
                        <td>{data.lote.colindanciaOeste ?? "—"}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="text-muted" style={{ paddingBottom: 8 }}>Manzana</td>
                        <td style={{ paddingBottom: 8 }}>{data.lote.numeroManzana}</td>
                      </tr>
                      <tr>
                        <td className="text-muted" style={{ paddingBottom: 8 }}>Lote</td>
                        <td style={{ paddingBottom: 8 }}>{data.lote.numeroLote}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Sección</td>
                        <td>{data.lote.seccion ?? "—"}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        abierto={confirmando}
        titulo="Confirmar cancelación"
        mensaje={
          <>
            ¿Desea cancelar el permiso <strong>{data.folio}</strong>?
          </>
        }
        nota="El registro se marcará como cancelado y no se elimina de la base de datos."
        error={errorCancelar}
        textoConfirmar="Sí, cancelar"
        iconoConfirmar="bi-x-circle"
        cargando={cancelar.isPending}
        onCancelar={() => {
          setConfirmando(false);
          setErrorCancelar(null);
        }}
        onConfirmar={() => cancelar.mutate()}
      />
    </div>
  );
}
