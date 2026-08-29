import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, API_URL } from "../../lib/api";
import { claseEstado } from "../../lib/badges";

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

const COLOR_EVENTO: Record<string, string> = {
  dorado: "#d4a437",
  gris: "#9b9298",
  azul: "#0b6e99",
  guinda: "#6b1229",
  verde: "#157347",
};

interface ExpedienteData {
  lote: {
    numeroManzana: string;
    numeroLote: string;
    estado: string;
    esFosaComun: boolean;
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
  return new Date(f).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });
}

export function LoteExpediente() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["lotes", id, "expediente"],
    queryFn: () => api<ExpedienteData>(`/lotes/${id}/expediente`),
  });

  if (isLoading) return <p>Cargando expediente...</p>;
  if (error || !data) return <p className="aviso-error">No se encontró el lote.</p>;

  return (
    <div>
      <p>
        <Link to="/lotes">
          <i className="bi bi-arrow-left" /> Volver a la búsqueda
        </Link>
      </p>
      <div className="page-header">
        <h2>
          <i className="bi bi-clock-history" />
          {data.ubicacion}
        </h2>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{ display: "flex", gap: 24, marginBottom: data.tituloVigente || data.ocupantes.length ? 14 : 0, fontSize: 14, flexWrap: "wrap" }}>
            <span>
              Estado:{" "}
              <span className={claseEstado(data.lote.esFosaComun ? "FOSA_COMUN" : data.lote.estado)}>
                {data.lote.esFosaComun ? "Fosa común" : data.lote.estado}
              </span>
            </span>
            <span>Inhumaciones: <strong>{data.inhumaciones}</strong></span>
            <span>Exhumaciones: <strong>{data.exhumaciones}</strong></span>
          </div>

          {data.tituloVigente && (
            <p style={{ margin: data.ocupantes.length ? "0 0 12px" : 0 }}>
              <i className="bi bi-award" style={{ color: "var(--guinda)", marginRight: 6 }} />
              Título vigente <strong>{data.tituloVigente.folio}</strong> — {data.tituloVigente.titular.nombreCompleto}
            </p>
          )}

          {data.ocupantes.length > 0 && (
            <div className="aviso-exito" style={{ margin: 0 }}>
              Ocupante(s) actual(es): {data.ocupantes.join(", ")}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Historial
          </span>
        </div>
        <div className="card-body">
          <ul className="tl">
            {data.eventos.length === 0 && <li>Sin eventos registrados.</li>}
            {data.eventos.map((e, i) => {
              const color = COLOR_EVENTO[e.color] ?? "#9b9298";
              const cuerpo = (
                <div className="tl-cuerpo">
                  <div className="tl-tipo">{e.tipo}</div>
                  <div className="tl-titulo">{e.titulo}</div>
                  {e.detalle && <div className="tl-detalle">{e.detalle}</div>}
                  {e.folio && <div className="tl-detalle">Folio: {e.folio}</div>}
                </div>
              );
              return (
                <li className="tl-item" key={i}>
                  <div className="tl-fecha">{fmtFecha(e.fecha)}</div>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: `${color}1a`,
                      color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 14,
                      marginRight: 12,
                    }}
                  >
                    <i className={`bi ${e.icono}`} />
                  </div>
                  {e.enlace?.endsWith("/pdf") ? (
                    <a href={`${API_URL}${e.enlace}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
                      {cuerpo}
                    </a>
                  ) : e.enlace ? (
                    <Link to={e.enlace} style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
                      {cuerpo}
                    </Link>
                  ) : (
                    cuerpo
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
