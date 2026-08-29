import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, API_URL, ApiError } from "../../lib/api";
import { claseEstado } from "../../lib/badges";

interface TituloDetalle {
  tituloId: number;
  folio: string;
  fechaEmision: string | null;
  estado: string;
  estadoEntrega: string;
  fechaEntrega: string | null;
  titular: { nombreCompleto: string; telefono: string | null; domicilio: string | null; colonia: string | null };
  lote: { numeroManzana: string; numeroLote: string; seccion: string | null; panteon: { nombre: string } };
  usuarioEmitio: { nombreCompleto: string } | null;
}

function fecha(f: string | null): string {
  return f ? new Date(f).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—";
}

export function TituloDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["titulos", id],
    queryFn: () => api<{ titulo: TituloDetalle }>(`/titulos/${id}`).then((r) => r.titulo),
  });

  const cancelar = useMutation({
    mutationFn: () => api(`/titulos/${id}/cancelar`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titulos"] });
      navigate("/titulos", { state: { exito: `Título ${data?.folio} cancelado.` } });
    },
    onError: (err) => alert(err instanceof ApiError ? err.message : "No se pudo cancelar"),
  });

  if (!data) return <p>Cargando...</p>;
  const usaColindancias = data.lote.numeroManzana === "S/N";

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-award" />
          Título {data.folio}
        </h2>
        <div className="page-header-acciones">
          <a href={`${API_URL}/titulos/${id}/pdf`} target="_blank" rel="noreferrer" className="boton-secundario">
            <i className="bi bi-printer" /> Imprimir
          </a>
          <Link className="boton-secundario" to={`/reimpresiones?tipo=TITULO&id=${id}`}>
            <i className="bi bi-printer-fill" /> Reimprimir con sello
          </Link>
          {data.estado !== "CANCELADO" && (
            <>
              <Link className="boton-secundario" to={`/titulos/${id}/editar`}>
                <i className="bi bi-pencil" /> Editar
              </Link>
              <button
                className="boton-secundario"
                onClick={() => {
                  if (confirm(`¿Cancelar el título ${data.folio}?`)) cancelar.mutate();
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

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="card" style={{ margin: 0 }}>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-clock-history" /> Lote
              </span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, margin: 0 }}>
                {data.lote.panteon.nombre} ·{" "}
                {usaColindancias
                  ? "Colindancias"
                  : `${data.lote.seccion ? `Secc. ${data.lote.seccion} · ` : ""}Mz ${data.lote.numeroManzana} · Lote ${data.lote.numeroLote}`}
              </p>
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-file-earmark-text" /> Título
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
        </div>
      </div>
    </div>
  );
}
