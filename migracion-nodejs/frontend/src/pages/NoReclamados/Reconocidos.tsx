import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, API_URL } from "../../lib/api";

interface ReconocimientoFila {
  reconocimientoId: number;
  fechaReconocimiento: string | null;
  nombreAnterior: string;
  nombreIdentificado: string;
  numeroActaDefuncion: string | null;
  medioIdentificacion: string | null;
  permisoExhumacionId: number | null;
  permisoExhumacion: { folio: string } | null;
  fallecido: { fallecidoId: number } | null;
  lote: { seccion: string | null; numeroManzana: string; numeroLote: string; estado: string } | null;
}

interface ReconocidosData {
  lista: ReconocimientoFila[];
  total: number;
  conExhumacion: number;
  anios: number[];
}

export function NoReclamadosReconocidos() {
  const location = useLocation();
  const exito = (location.state as { exito?: string } | null)?.exito;
  const [q, setQ] = useState("");
  const [anio, setAnio] = useState("");
  const [trimestre, setTrimestre] = useState("");
  const [filtros, setFiltros] = useState({ q: "", anio: "", trimestre: "" });

  const { data } = useQuery({
    queryKey: ["no-reclamados", "reconocidos", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.anio) params.set("anio", filtros.anio);
      if (filtros.trimestre) params.set("trimestre", filtros.trimestre);
      return api<ReconocidosData>(`/no-reclamados/reportes/reconocidos?${params}`);
    },
  });

  const pendientes = data ? data.lista.length - data.conExhumacion : 0;
  const paramsReporte = new URLSearchParams();
  if (filtros.q) paramsReporte.set("q", filtros.q);
  if (filtros.anio) paramsReporte.set("anio", filtros.anio);
  if (filtros.trimestre) paramsReporte.set("trimestre", filtros.trimestre);

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-person-check" />
          De no reconocidas a reconocidas
        </h2>
        <div className="page-header-acciones">
          <a className="boton-secundario" href={`${API_URL}/no-reclamados/reportes/identificados?${paramsReporte}`} target="_blank" rel="noreferrer">
            <i className="bi bi-file-earmark-excel" /> Reporte Excel
          </a>
          <Link className="boton-secundario" to="/no-reclamados">
            <i className="bi bi-arrow-left" /> No reclamados
          </Link>
        </div>
      </div>

      {exito && <p className="aviso-exito">{exito}</p>}

      {data && (
        <div className="tarjetas" style={{ marginBottom: 20 }}>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-person-check" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.total}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Identificadas en total</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-box-arrow-up" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.conExhumacion}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Ya exhumadas</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-hourglass-split" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{pendientes}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Pendientes de exhumar</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-funnel" /> Filtros
          </span>
        </div>
        <div className="card-body">
          <form
            className="barra-filtros"
            style={{ marginBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros({ q, anio, trimestre });
            }}
          >
            <input
              placeholder="Nombre, medio de identificación o instancia..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <select value={anio} onChange={(e) => setAnio(e.target.value)}>
              <option value="">Todos los años</option>
              {data?.anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
              <option value="">Todos los trimestres</option>
              <option value="1">1º (Ene–Mar)</option>
              <option value="2">2º (Abr–Jun)</option>
              <option value="3">3º (Jul–Sep)</option>
              <option value="4">4º (Oct–Dic)</option>
            </select>
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Filtrar
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Relación de identificaciones
          </span>
          <span className="badge badge-warning">{data?.lista.length ?? 0} registro(s)</span>
        </div>
        <div className="card-body p-0">
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Sepultada como</th>
                    <th>Identificada como</th>
                    <th>Ubicación</th>
                    <th>Medio de identificación</th>
                    <th>Exhumación</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.lista.length === 0 && (
                    <tr>
                      <td colSpan={7}>Aún no hay personas identificadas para este filtro.</td>
                    </tr>
                  )}
                  {data.lista.map((r) => (
                    <tr key={r.reconocimientoId}>
                      <td>{r.fechaReconocimiento ? new Date(r.fechaReconocimiento).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—"}</td>
                      <td className="tabla-col-ancha">
                        <small className="text-muted" style={{ textDecoration: "line-through" }}>
                          {r.nombreAnterior}
                        </small>
                      </td>
                      <td className="tabla-col-ancha">
                        <span style={{ fontWeight: 600 }}>{r.nombreIdentificado}</span>
                        {r.numeroActaDefuncion && (
                          <div>
                            <small className="text-muted">Acta {r.numeroActaDefuncion}</small>
                          </div>
                        )}
                      </td>
                      <td>
                        {r.lote ? (
                          <small>
                            {r.lote.seccion ? `${r.lote.seccion} · ` : ""}Mz {r.lote.numeroManzana} · L {r.lote.numeroLote}
                            <div>
                              <span className={`badge ${r.lote.estado === "DISPONIBLE" ? "badge-success" : "badge-secondary"}`}>{r.lote.estado}</span>
                            </div>
                          </small>
                        ) : (
                          <small className="text-muted">—</small>
                        )}
                      </td>
                      <td className="tabla-col-ancha">
                        <small>{r.medioIdentificacion ?? "—"}</small>
                      </td>
                      <td>
                        {r.permisoExhumacionId != null ? (
                          <span className="badge badge-info">
                            <i className="bi bi-check2" /> {r.permisoExhumacion?.folio}
                          </span>
                        ) : (
                          <span className="badge badge-warning">Pendiente</span>
                        )}
                      </td>
                      <td>
                        {r.fallecido && (
                          <Link to={`/no-reclamados/${r.fallecido.fallecidoId}`} className="boton-secundario boton-sm" title="Ver expediente">
                            <i className="bi bi-eye" />
                          </Link>
                        )}
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
