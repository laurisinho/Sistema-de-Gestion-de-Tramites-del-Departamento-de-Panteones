import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { claseEstado } from "../../lib/badges";
import { ConfirmModal } from "../../components/ConfirmModal";
import { BotonImprimir } from "../../components/BotonImprimir";
import { useAuth } from "../../auth/AuthContext";

interface TituloDetalle {
  tituloId: number;
  folio: string;
  fechaEmision: string | null;
  estado: string;
  estadoEntrega: string;
  fechaEntrega: string | null;
  titular: { nombreCompleto: string; telefono: string | null; domicilio: string | null; colonia: string | null };
  lote: {
    numeroManzana: string;
    numeroLote: string;
    seccion: string | null;
    claveLegado: string | null;
    colindanciaNorte: string | null;
    colindanciaSur: string | null;
    colindanciaEste: string | null;
    colindanciaOeste: string | null;
    panteon: { nombre: string };
    tipoLote: { nombre: string };
  };
  usuarioEmitio: { nombreCompleto: string } | null;
}

interface FallecidoDelLote {
  fallecidoId: number;
  nombreCompleto: string;
  fechaFallecimiento: string | null;
}

interface PermisoDelLote {
  permisoId: number;
  folio: string;
  fechaSolicitud: string | null;
  estado: string;
  tipoTramite: { nombre: string };
  solicitante: { nombreCompleto: string };
}

interface TituloDetalleData {
  titulo: TituloDetalle;
  fallecidos: FallecidoDelLote[];
  permisos: PermisoDelLote[];
}

function fecha(f: string | null): string {
  return f ? new Date(f).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—";
}

export function TituloDetalle() {
  const { usuario } = useAuth();
  const puedeEscribir = usuario?.rol !== "Consulta";
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);
  const { data: resultado } = useQuery({
    queryKey: ["titulos", id],
    queryFn: () => api<TituloDetalleData>(`/titulos/${id}`),
  });

  const cancelar = useMutation({
    mutationFn: () => api(`/titulos/${id}/cancelar`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titulos"] });
      navigate("/titulos", { state: { exito: `Título ${resultado?.titulo.folio} cancelado.` } });
    },
    onError: (err) => setErrorCancelar(err instanceof ApiError ? err.message : "No se pudo cancelar"),
  });

  if (!resultado) return <p>Cargando...</p>;
  const { titulo: data, fallecidos, permisos } = resultado;
  const usaColindancias = data.lote.numeroManzana === "S/N";

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-award" />
          Título {data.folio}
        </h2>
        <div className="page-header-acciones">
          <BotonImprimir ruta={`/titulos/${id}/pdf`} nombreArchivo={`titulo-${data.folio}.pdf`} className="boton-secundario">
            {" "}Imprimir
          </BotonImprimir>
          {puedeEscribir && (
            <Link className="boton-secundario" to={`/reimpresiones?tipo=TITULO&id=${id}`}>
              <i className="bi bi-printer-fill" /> Reimprimir con sello
            </Link>
          )}
          {data.estado !== "CANCELADO" && puedeEscribir && (
            <>
              <Link className="boton-secundario" to={`/titulos/${id}/editar`}>
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
          <Link className="boton-secundario" to="/titulos">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {data.estado === "CANCELADO" && (
        <p className="aviso-error" style={{ marginBottom: 16 }}>
          <i className="bi bi-exclamation-triangle" /> Este expediente está cancelado.
        </p>
      )}

      <div className="detalle-grid">
        <div className="card">
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person" /> Titular
            </span>
          </div>
          <div className="card-body">
            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: "42%", paddingBottom: 8 }}>Nombre</td>
                  <td style={{ paddingBottom: 8, fontWeight: 600 }}>{data.titular.nombreCompleto}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 8 }}>Teléfono</td>
                  <td style={{ paddingBottom: 8 }}>{data.titular.telefono ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 8 }}>Colonia</td>
                  <td style={{ paddingBottom: 8 }}>{data.titular.colonia ?? "—"}</td>
                </tr>
                <tr>
                  <td className="text-muted">Domicilio</td>
                  <td>{data.titular.domicilio ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-geo-alt" /> Lote
            </span>
          </div>
          <div className="card-body">
            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: "42%", paddingBottom: 8 }}>Panteón</td>
                  <td style={{ paddingBottom: 8, fontWeight: 600 }}>{data.lote.panteon.nombre}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 8 }}>Tipo</td>
                  <td style={{ paddingBottom: 8 }}>{data.lote.tipoLote.nombre}</td>
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
                      <td className="text-muted" style={{ paddingBottom: 8 }}>Oeste</td>
                      <td style={{ paddingBottom: 8 }}>{data.lote.colindanciaOeste ?? "—"}</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td className="text-muted" style={{ paddingBottom: 8 }}>Sección</td>
                      <td style={{ paddingBottom: 8 }}>{data.lote.seccion ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="text-muted" style={{ paddingBottom: 8 }}>Manzana</td>
                      <td style={{ paddingBottom: 8 }}>{data.lote.numeroManzana}</td>
                    </tr>
                    <tr>
                      <td className="text-muted" style={{ paddingBottom: 8 }}>Lote</td>
                      <td style={{ paddingBottom: 8 }}>{data.lote.numeroLote}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="text-muted">Clave</td>
                  <td>
                    <small className="text-muted">{data.lote.claveLegado ?? "—"}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-award" /> Título de Propiedad
            </span>
          </div>
          <div className="card-body">
            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: "42%", paddingBottom: 8 }}>Fecha de emisión</td>
                  <td style={{ paddingBottom: 8 }}>{fecha(data.fechaEmision)}</td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 8 }}>Estado</td>
                  <td style={{ paddingBottom: 8 }}>
                    <span className={claseEstado(data.estado)}>{data.estado}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-muted" style={{ paddingBottom: 8 }}>Entrega</td>
                  <td style={{ paddingBottom: 8 }}>
                    <span className={claseEstado(data.estadoEntrega)}>{data.estadoEntrega.replaceAll("_", " ")}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">Emitió</td>
                  <td>{data.usuarioEmitio?.nombreCompleto ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-flower1" /> Fallecidos en este lote
            </span>
          </div>
          <div className="card-body">
            {fallecidos.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>Sin fallecidos registrados</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {fallecidos.map((f, i) => (
                  <li
                    key={f.fallecidoId}
                    style={{
                      padding: "8px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{f.nombreCompleto}</div>
                    <small className="text-muted">
                      {f.fechaFallecimiento ? fecha(f.fechaFallecimiento) : "Fecha no registrada"}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {permisos.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-clock-history" /> Historial de Trámites
            </span>
          </div>
          <div className="card-body p-0">
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Folio</th>
                    <th>Solicitante</th>
                    <th>Fecha solicitud</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {permisos.map((p) => (
                    <tr key={p.permisoId}>
                      <td>{p.tipoTramite.nombre}</td>
                      <td>
                        <small className="text-muted">{p.folio}</small>
                      </td>
                      <td>{p.solicitante.nombreCompleto}</td>
                      <td>{fecha(p.fechaSolicitud)}</td>
                      <td>
                        <span className={claseEstado(p.estado)}>{p.estado}</span>
                      </td>
                      <td>
                        <Link to={`/permisos/${p.permisoId}`} className="boton-secundario boton-sm" title="Ver permiso">
                          <i className="bi bi-eye" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        abierto={confirmando}
        titulo="Confirmar cancelación"
        mensaje={
          <>
            ¿Desea cancelar el título <strong>{data.folio}</strong>?
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
