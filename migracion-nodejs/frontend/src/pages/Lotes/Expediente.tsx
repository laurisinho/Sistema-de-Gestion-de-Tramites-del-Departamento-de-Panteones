import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, descargarArchivo } from "../../lib/api";

interface EventoLote {
  fecha: string | null;
  tipo: string;
  titulo: string;
  detalle: string | null;
  folio: string | null;
  icono: string;
  color: string;
  enlace: string | null;
}

interface ExpedienteData {
  lote: {
    numeroManzana: string;
    numeroLote: string;
    estado: string;
    esFosaComun: boolean;
    claveLegado: string | null;
  };
  ubicacion: string;
  tituloVigente: { folio: string; titular: { nombreCompleto: string } } | null;
  eventos: EventoLote[];
  inhumaciones: number;
  exhumaciones: number;
  ocupantes: string[];
}

function fmtFecha(f: string | null): string {
  if (!f) return "Sin fecha";
  return new Date(f).toLocaleDateString("es-MX", { timeZone: "UTC" });
}

export function LoteExpediente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["lotes", id, "expediente"],
    queryFn: () => api<ExpedienteData>(`/lotes/${id}/expediente`),
  });

  if (isLoading) return <p>Cargando expediente...</p>;
  if (error || !data) return <p className="aviso-error">No se encontró el lote.</p>;

  const libre = data.lote.estado === "DISPONIBLE";
  let sinFechaMostrado = false;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-clock-history" />
          Expediente del lote
        </h2>
        <div className="page-header-acciones">
          <button type="button" className="boton-secundario" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left" /> Regresar
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <p className="exp-clave">{data.lote.claveLegado ?? `Mz ${data.lote.numeroManzana} · Lote ${data.lote.numeroLote}`}</p>
              <div className="exp-sub" style={{ marginTop: 4 }}>
                {data.ubicacion}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <span className={`badge ${libre ? "badge-success" : "badge-secondary"}`}>{data.lote.estado}</span>
                {data.lote.esFosaComun && <span className="badge badge-warning">Fosa común</span>}
                {data.tituloVigente && <span className="badge badge-info">Titular: {data.tituloVigente.titular.nombreCompleto}</span>}
              </div>
            </div>

            <div className="exp-stats">
              <div>
                <div className="exp-stat-n">{data.inhumaciones}</div>
                <div className="exp-stat-l">Inhumaciones</div>
              </div>
              <div>
                <div className="exp-stat-n">{data.exhumaciones}</div>
                <div className="exp-stat-l">Exhumaciones</div>
              </div>
              <div>
                <div className="exp-stat-n">{data.ocupantes.length}</div>
                <div className="exp-stat-l">Ocupantes hoy</div>
              </div>
            </div>
          </div>

          {data.ocupantes.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
              <div className="exp-sub">
                <i className="bi bi-person-fill" style={{ marginRight: 6 }} />
                {data.ocupantes.join(" · ")}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="exp-titulo-seccion">
        Historial{" "}
        <span className="text-muted" style={{ fontWeight: 400 }}>
          — {data.eventos.length} movimiento(s)
        </span>
      </div>

      {data.eventos.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2.5rem 0" }}>
          <i className="bi bi-inbox" style={{ fontSize: 28 }} />
          <p>Este lote no tiene movimientos registrados</p>
        </div>
      ) : (
        <ul className="exp-tl">
          {data.eventos.map((e, i) => {
            const necesitaSeparador = e.fecha === null && !sinFechaMostrado;
            if (necesitaSeparador) sinFechaMostrado = true;
            const tituloTexto = (
              <>
                {e.titulo} <i className="bi bi-box-arrow-up-right text-muted" style={{ fontSize: 12 }} />
              </>
            );
            return (
              <li key={i}>
                {necesitaSeparador && <div className="exp-tl-sep">Sin fecha registrada</div>}
                <div className="exp-tl-item">
                  <div className={`exp-tl-dot c-${e.color}`}>
                    <i className={`bi ${e.icono}`} />
                  </div>
                  <div>
                    <span className="exp-tl-fecha">{fmtFecha(e.fecha)}</span>
                    <span className={`exp-tl-tipo t-${e.color}`}>{e.tipo}</span>
                  </div>
                  <div className="exp-tl-titulo">
                    {e.enlace?.endsWith("/pdf") ? (
                      <button
                        type="button"
                        onClick={() => descargarArchivo(e.enlace!).catch(() => alert("No se pudo generar el documento."))}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          font: "inherit",
                          cursor: "pointer",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {tituloTexto}
                      </button>
                    ) : e.enlace ? (
                      <Link to={e.enlace} style={{ textDecoration: "none", color: "inherit" }}>
                        {tituloTexto}
                      </Link>
                    ) : (
                      e.titulo
                    )}
                  </div>
                  {e.detalle && <div className="exp-tl-detalle">{e.detalle}</div>}
                  {e.folio && (
                    <div className="exp-tl-folio" style={{ marginTop: 4 }}>
                      {e.folio}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
