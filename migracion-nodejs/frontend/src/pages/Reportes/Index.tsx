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

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function ReportesIndex() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState<number | "">("");

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

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-bar-graph" />
          Reportes
        </h2>
      </div>

      <div className="rep-card" style={{ marginBottom: 20 }}>
        <div className="rep-head">
          <p className="rep-titulo">
            <i className="bi bi-calendar3" /> Relación mensual de movimientos
          </p>
          <p className="rep-desc">
            Concentrado de todos los trámites del periodo agrupados por panteón: inhumaciones, exhumaciones, depósitos de cenizas,
            construcciones, títulos emitidos y cesiones de derechos. Trae una segunda hoja con el detalle movimiento por movimiento.
          </p>
        </div>
        <div className="rep-body">
          <div className="barra-filtros" style={{ marginBottom: 0, alignItems: "flex-end" }}>
            <div className="form-campo">
              <label>Ejercicio</label>
              <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100 }} />
            </div>
            <div className="form-campo">
              <label>Mes</label>
              <select value={mes} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todo el año</option>
                {MESES.slice(1).map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <a
              className="boton"
              href={`${API_URL}/reportes/movimientos/excel?${new URLSearchParams({ anio: String(anio), ...(mes ? { mes: String(mes) } : {}) })}`}
              target="_blank"
              rel="noreferrer"
            >
              <i className="bi bi-file-earmark-excel" /> Generar Excel
            </a>
          </div>
        </div>
      </div>

      <div className="detalle-grid">
        <div className="rep-card">
          <div className="rep-head">
            <p className="rep-titulo">
              <i className="bi bi-exclamation-triangle" /> Incidencias en panteones
            </p>
            <p className="rep-desc">
              Hechos reportados en los panteones y su seguimiento: vandalismo, daños, maleza, fugas. Incluye ubicación y estado de
              atención.
            </p>
            {resumen && (
              <div className="rep-chips">
                <span className="rep-chip">{resumen.totalIncidencias} registradas</span>
                {resumen.incidenciasPendientes > 0 && <span className="rep-chip alerta">{resumen.incidenciasPendientes} pendientes</span>}
              </div>
            )}
          </div>
          <div className="rep-body">
            <div className="form-grid" style={{ marginBottom: 12, maxWidth: "none" }}>
              <div className="form-campo">
                <label>Panteón</label>
                <select value={panteonIdInc} onChange={(e) => setPanteonIdInc(e.target.value)}>
                  <option value="">Todos</option>
                  {panteones?.map((p) => (
                    <option key={p.panteonId} value={p.panteonId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Estado</label>
                <select value={estadoInc} onChange={(e) => setEstadoInc(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="REPORTADA">Reportada</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="ATENDIDA">Atendida</option>
                </select>
              </div>
              <div className="form-campo">
                <label>Desde</label>
                <input type="date" value={desdeInc} onChange={(e) => setDesdeInc(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Hasta</label>
                <input type="date" value={hastaInc} onChange={(e) => setHastaInc(e.target.value)} />
              </div>
            </div>
            <div className="barra-filtros" style={{ marginBottom: 0 }}>
              <a className="boton" href={`${API_URL}/incidencias/reporte?${paramsIncidencias}`} target="_blank" rel="noreferrer">
                <i className="bi bi-file-earmark-excel" /> Generar Excel
              </a>
              <Link className="boton-secundario" to="/incidencias">
                <i className="bi bi-eye" /> Ver y capturar
              </Link>
            </div>
          </div>
        </div>

        <div className="rep-card">
          <div className="rep-head">
            <p className="rep-titulo">
              <i className="bi bi-person-x" /> Personas no reclamadas sepultadas
            </p>
            <p className="rep-desc">
              Formato oficial que se entrega a la Fiscalía General de Justicia del Estado, con los datos del levantamiento y la
              ubicación en fosa común.
            </p>
            {resumen && (
              <div className="rep-chips">
                <span className="rep-chip">{resumen.totalNoReclamados} registradas</span>
              </div>
            )}
          </div>
          <div className="rep-body">
            <div className="barra-filtros" style={{ marginBottom: 0, alignItems: "flex-end" }}>
              <div className="form-campo">
                <label>Ejercicio</label>
                <select value={anioNR} onChange={(e) => setAnioNR(e.target.value)}>
                  {anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Trimestre</label>
                <select value={trimNR} onChange={(e) => setTrimNR(e.target.value)}>
                  <option value="">Todo el año</option>
                  <option value="1">1º (Ene–Mar)</option>
                  <option value="2">2º (Abr–Jun)</option>
                  <option value="3">3º (Jul–Sep)</option>
                  <option value="4">4º (Oct–Dic)</option>
                </select>
              </div>
              <a className="boton" href={`${API_URL}/no-reclamados/reportes/sepultados?${paramsNoReclamados}`} target="_blank" rel="noreferrer">
                <i className="bi bi-file-earmark-excel" /> Generar Excel
              </a>
            </div>
          </div>
        </div>

        <div className="rep-card">
          <div className="rep-head">
            <p className="rep-titulo">
              <i className="bi bi-person-check" /> Identificadas y exhumadas
            </p>
            <p className="rep-desc">
              Personas que ingresaron como desconocidas y fueron plenamente identificadas, con el medio de identificación y la
              instancia que lo solicitó.
            </p>
            {resumen && (
              <div className="rep-chips">
                <span className="rep-chip">{resumen.totalIdentificados} identificaciones</span>
              </div>
            )}
          </div>
          <div className="rep-body">
            <div className="barra-filtros" style={{ marginBottom: 0, alignItems: "flex-end" }}>
              <div className="form-campo">
                <label>Ejercicio</label>
                <select value={anioNR} onChange={(e) => setAnioNR(e.target.value)}>
                  {anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Trimestre</label>
                <select value={trimNR} onChange={(e) => setTrimNR(e.target.value)}>
                  <option value="">Todo el año</option>
                  <option value="1">1º (Ene–Mar)</option>
                  <option value="2">2º (Abr–Jun)</option>
                  <option value="3">3º (Jul–Sep)</option>
                  <option value="4">4º (Oct–Dic)</option>
                </select>
              </div>
              <a className="boton" href={`${API_URL}/no-reclamados/reportes/identificados?${paramsNoReclamados}`} target="_blank" rel="noreferrer">
                <i className="bi bi-file-earmark-excel" /> Generar Excel
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
