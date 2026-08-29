import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";

interface Resumen {
  totalNoReclamados: number;
  totalIdentificados: number;
  totalIncidencias: number;
  incidenciasPendientes: number;
}

interface Panteon {
  panteonId: number;
  nombre: string;
}

const anioActualG = new Date().getFullYear();
const anios = Array.from({ length: anioActualG - 2015 + 1 }, (_, i) => anioActualG - i);

interface MovimientoResumen {
  panteon: string;
  inhumaciones: number;
  exhumaciones: number;
  cenizas: number;
  construcciones: number;
  titulos: number;
  cesiones: number;
  donaciones: number;
  total: number;
}

interface MovimientoDetalle {
  fecha: string | null;
  panteon: string;
  movimiento: string;
  folio: string;
  persona: string | null;
  manzana: string;
  lote: string;
  observacion: string | null;
}

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function ReportesIndex() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState<number | "">("");
  const [consultado, setConsultado] = useState<{ anio: number; mes: number | "" } | null>(null);

  const [panteonIdInc, setPanteonIdInc] = useState("");
  const [estadoInc, setEstadoInc] = useState("");
  const [desdeInc, setDesdeInc] = useState("");
  const [hastaInc, setHastaInc] = useState("");
  const [anioNR, setAnioNR] = useState(String(anioActual));
  const [trimNR, setTrimNR] = useState("");

  const { data: resumen } = useQuery({
    queryKey: ["reportes"],
    queryFn: () => api<Resumen>("/reportes"),
  });

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });

  const paramsIncidencias = new URLSearchParams({
    ...(panteonIdInc ? { panteonId: panteonIdInc } : {}),
    ...(estadoInc ? { estado: estadoInc } : {}),
    ...(desdeInc ? { desde: desdeInc } : {}),
    ...(hastaInc ? { hasta: hastaInc } : {}),
  });
  const paramsNoReclamados = new URLSearchParams({ anio: anioNR, ...(trimNR ? { trimestre: trimNR } : {}) });

  const { data: movimientos, isFetching } = useQuery({
    queryKey: ["reportes", "movimientos", consultado],
    queryFn: () => {
      const params = new URLSearchParams({ anio: String(consultado!.anio) });
      if (consultado!.mes) params.set("mes", String(consultado!.mes));
      return api<{ resumen: MovimientoResumen[]; detalle: MovimientoDetalle[]; periodo: string; anio: number; mes: number | null }>(
        `/reportes/movimientos?${params}`
      );
    },
    enabled: consultado !== null,
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-bar-graph" />
          Reportes
        </h2>
      </div>

      {resumen && (
        <div className="tarjetas" style={{ marginBottom: 24 }}>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-person-x" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{resumen.totalNoReclamados}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>No reclamados</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-person-check" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{resumen.totalIdentificados}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Identificados</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-exclamation-triangle" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{resumen.totalIncidencias}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Incidencias ({resumen.incidenciasPendientes} pendientes)</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-calendar-range" /> Relación mensual de movimientos
          </span>
        </div>
        <div className="card-body">
          <form
            className="barra-filtros"
            style={{ marginBottom: movimientos ? 20 : 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setConsultado({ anio, mes });
            }}
          >
            <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 90 }} />
            <select value={mes} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todo el año</option>
              {MESES.slice(1).map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Consultar
            </button>
          </form>

          {isFetching && <p>Consultando...</p>}

          {movimientos && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p className="text-muted" style={{ margin: 0 }}>{movimientos.periodo}</p>
                <a
                  className="boton-secundario"
                  href={`${API_URL}/reportes/movimientos/excel?${new URLSearchParams({
                    anio: String(movimientos.anio),
                    ...(movimientos.mes ? { mes: String(movimientos.mes) } : {}),
                  })}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="bi bi-file-earmark-excel" /> Descargar Excel
                </a>
              </div>

              <h4 style={{ marginTop: 0 }}>Resumen por panteón</h4>
              <div className="tabla-contenedor" style={{ marginBottom: 24 }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Panteón</th>
                      <th>Inhumaciones</th>
                      <th>Exhumaciones</th>
                      <th>Cenizas</th>
                      <th>Construcciones</th>
                      <th>Títulos</th>
                      <th>Cesiones</th>
                      <th>Donaciones</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.resumen.length === 0 && (
                      <tr>
                        <td colSpan={9}>Sin movimientos en este periodo.</td>
                      </tr>
                    )}
                    {movimientos.resumen.map((r) => (
                      <tr key={r.panteon}>
                        <td>{r.panteon}</td>
                        <td>{r.inhumaciones}</td>
                        <td>{r.exhumaciones}</td>
                        <td>{r.cenizas}</td>
                        <td>{r.construcciones}</td>
                        <td>{r.titulos}</td>
                        <td>{r.cesiones}</td>
                        <td>{r.donaciones}</td>
                        <td style={{ fontWeight: 700, color: "var(--guinda)" }}>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4>Detalle cronológico</h4>
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Panteón</th>
                      <th>Movimiento</th>
                      <th>Folio</th>
                      <th>Persona</th>
                      <th>Ubicación</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.detalle.length === 0 && (
                      <tr>
                        <td colSpan={7}>Sin movimientos en este periodo.</td>
                      </tr>
                    )}
                    {movimientos.detalle.map((d, i) => (
                      <tr key={i}>
                        <td>{d.fecha ? new Date(d.fecha).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—"}</td>
                        <td>{d.panteon}</td>
                        <td>{d.movimiento}</td>
                        <td>{d.folio}</td>
                        <td>{d.persona ?? "—"}</td>
                        <td>
                          Mz {d.manzana} L {d.lote}
                        </td>
                        <td>{d.observacion ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-exclamation-triangle" /> Incidencias en panteones
            </span>
            {resumen && <span className="badge badge-warning">{resumen.totalIncidencias} — {resumen.incidenciasPendientes} pendientes</span>}
          </div>
          <div className="card-body">
            <div className="barra-filtros" style={{ marginBottom: 12 }}>
              <select value={panteonIdInc} onChange={(e) => setPanteonIdInc(e.target.value)}>
                <option value="">Todos los panteones</option>
                {panteones?.map((p) => (
                  <option key={p.panteonId} value={p.panteonId}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <select value={estadoInc} onChange={(e) => setEstadoInc(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="REPORTADA">Reportada</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="ATENDIDA">Atendida</option>
              </select>
            </div>
            <div className="barra-filtros" style={{ marginBottom: 0 }}>
              <input type="date" value={desdeInc} onChange={(e) => setDesdeInc(e.target.value)} title="Desde" />
              <input type="date" value={hastaInc} onChange={(e) => setHastaInc(e.target.value)} title="Hasta" />
              <a className="boton" href={`${API_URL}/incidencias/reporte?${paramsIncidencias}`} target="_blank" rel="noreferrer">
                <i className="bi bi-download" /> Generar Excel
              </a>
              <Link className="boton-secundario" to="/incidencias">
                <i className="bi bi-eye" /> Ver y capturar
              </Link>
            </div>
          </div>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person-x" /> Personas no reclamadas
            </span>
            {resumen && <span className="badge badge-warning">{resumen.totalNoReclamados} sepultadas · {resumen.totalIdentificados} identificadas</span>}
          </div>
          <div className="card-body">
            <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>Reporte trimestral de sepultadas en fosa común e identificadas y exhumadas.</p>
            <div className="barra-filtros" style={{ marginBottom: 0 }}>
              <select value={anioNR} onChange={(e) => setAnioNR(e.target.value)}>
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select value={trimNR} onChange={(e) => setTrimNR(e.target.value)}>
                <option value="">Todo el año</option>
                <option value="1">1º (Ene–Mar)</option>
                <option value="2">2º (Abr–Jun)</option>
                <option value="3">3º (Jul–Sep)</option>
                <option value="4">4º (Oct–Dic)</option>
              </select>
              <a className="boton" href={`${API_URL}/no-reclamados/reportes/sepultados?${paramsNoReclamados}`} target="_blank" rel="noreferrer">
                <i className="bi bi-download" /> Sepultadas
              </a>
              <a className="boton-secundario" href={`${API_URL}/no-reclamados/reportes/identificados?${paramsNoReclamados}`} target="_blank" rel="noreferrer">
                <i className="bi bi-download" /> Identificadas
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
