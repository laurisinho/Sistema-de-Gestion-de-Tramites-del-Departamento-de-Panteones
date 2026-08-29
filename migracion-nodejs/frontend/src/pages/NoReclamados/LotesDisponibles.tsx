import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Ocupante {
  fallecidoId: number;
  nombreCompleto: string;
  reconocido: boolean;
  posibleNombre: string | null;
}

interface LoteFila {
  loteId: number;
  panteon: string;
  seccion: string | null;
  numeroManzana: string;
  numeroLote: string;
  claveLegado: string | null;
  historial: Ocupante[];
}

interface LotesDisponiblesData {
  lotes: LoteFila[];
  secciones: string[];
  seccion: string | null;
  totalFosaComun: number;
  ocupados: number;
}

export function NoReclamadosLotesDisponibles() {
  const [seccion, setSeccion] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["lotes", "fosa-comun-disponibles", seccion],
    queryFn: () => {
      const params = new URLSearchParams();
      if (seccion) params.set("seccion", seccion);
      return api<LotesDisponiblesData>(`/lotes/fosa-comun-disponibles?${params}`);
    },
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-grid-3x3-gap" />
          Lotes disponibles en fosa común
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/no-reclamados">
            <i className="bi bi-arrow-left" /> No reclamados
          </Link>
        </div>
      </div>

      <div className="aviso-exito" style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20 }}>
        <i className="bi bi-info-circle" style={{ marginTop: 2 }} />
        <div>
          Un lote aparece aquí cuando se aprueba el <strong>permiso de exhumación</strong> de quien lo ocupaba. Puede
          volver a usarse para sepultar a la siguiente persona no reclamada.
        </div>
      </div>

      {data && (
        <div className="tarjetas" style={{ marginBottom: 20 }}>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-unlock" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.lotes.length}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Disponibles</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-lock" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.ocupados}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Ocupados</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-grid-3x3-gap" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.totalFosaComun}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Total en fosa común</div>
            </div>
          </div>
        </div>
      )}

      {data && data.secciones.length > 0 && (
        <div className="barra-filtros">
          <button className={seccion === null ? "boton" : "boton-secundario"} onClick={() => setSeccion(null)}>
            Todas las secciones
          </button>
          {data.secciones.map((s) => (
            <button key={s} className={seccion === s ? "boton" : "boton-secundario"} onClick={() => setSeccion(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Lotes liberados
          </span>
          <span className="badge badge-warning">{data?.lotes.length ?? 0} lote(s)</span>
        </div>
        <div className="card-body p-0">
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Panteón</th>
                    <th>Sección</th>
                    <th>Manzana</th>
                    <th>Lote</th>
                    <th>Clave</th>
                    <th>Ocupantes anteriores</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.lotes.length === 0 && (
                    <tr>
                      <td colSpan={7}>No hay lotes disponibles en este momento. Se liberan al aprobar un permiso de exhumación.</td>
                    </tr>
                  )}
                  {data.lotes.map((l) => (
                    <tr key={l.loteId}>
                      <td>
                        <small>{l.panteon}</small>
                      </td>
                      <td>
                        <small>{l.seccion ?? "—"}</small>
                      </td>
                      <td>{l.numeroManzana}</td>
                      <td style={{ fontWeight: 600 }}>{l.numeroLote}</td>
                      <td>
                        <small className="text-muted font-monospace">{l.claveLegado ?? "—"}</small>
                      </td>
                      <td>
                        {l.historial.length === 0 && <small className="text-muted">Sin ocupantes previos</small>}
                        {l.historial.map((f) => (
                          <div key={f.fallecidoId} style={{ fontSize: 13 }}>
                            <i className="bi bi-dot" />
                            {f.reconocido && f.posibleNombre ? (
                              <>
                                <span className="text-muted" style={{ textDecoration: "line-through" }}>
                                  {f.nombreCompleto}
                                </span>
                                <i className="bi bi-arrow-right" style={{ margin: "0 4px" }} />
                                <span style={{ fontWeight: 600 }}>{f.posibleNombre}</span>
                                <span className="badge badge-success" style={{ marginLeft: 4 }}>exhumado</span>
                              </>
                            ) : (
                              <span>{f.nombreCompleto}</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td>
                        <Link to={`/lotes/${l.loteId}/expediente`} className="boton-secundario boton-sm" title="Ver expediente del lote">
                          <i className="bi bi-clock-history" /> Expediente
                        </Link>
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
