import { useState } from "react";
import { Link } from "react-router-dom";
import { BotonDescarga } from "../../components/BotonDescarga";

const anioActual = new Date().getFullYear();
const trimActual = Math.floor(new Date().getMonth() / 3) + 1;
const anios = Array.from({ length: anioActual - 2015 + 1 }, (_, i) => anioActual - i);

export function NoReclamadosReporte() {
  const [anioTrim, setAnioTrim] = useState(String(anioActual));
  const [trimestre, setTrimestre] = useState(String(trimActual));
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [anioIdent, setAnioIdent] = useState("");
  const [trimIdent, setTrimIdent] = useState("");

  const paramsTrimestral = new URLSearchParams({ anio: anioTrim, trimestre });
  const paramsRango = new URLSearchParams();
  if (desde) paramsRango.set("desde", desde);
  if (hasta) paramsRango.set("hasta", hasta);
  const paramsIdent = new URLSearchParams();
  if (anioIdent) paramsIdent.set("anio", anioIdent);
  if (trimIdent) paramsIdent.set("trimestre", trimIdent);

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-excel" />
          Reporte de Personas No Reclamadas
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/no-reclamados">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-calendar3" /> Reporte trimestral
            </span>
          </div>
          <div className="card-body">
            <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Genera el reporte de un trimestre del año seleccionado.
            </p>
            <div className="barra-filtros" style={{ marginBottom: 0 }}>
              <select value={anioTrim} onChange={(e) => setAnioTrim(e.target.value)}>
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
                <option value="1">1º (Ene – Mar)</option>
                <option value="2">2º (Abr – Jun)</option>
                <option value="3">3º (Jul – Sep)</option>
                <option value="4">4º (Oct – Dic)</option>
              </select>
              <BotonDescarga
                className="boton"
                icono="bi-download"
                nombreArchivo="no-reclamados-trimestral.xlsx"
                ruta={`/no-reclamados/reportes/sepultados?${paramsTrimestral}`}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-calendar-range" /> Reporte por rango de fechas
            </span>
          </div>
          <div className="card-body">
            <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Genera el reporte entre dos fechas. Deja vacío para incluir todo.
            </p>
            <div className="barra-filtros" style={{ marginBottom: 0 }}>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
              <BotonDescarga
                className="boton"
                icono="bi-download"
                nombreArchivo="no-reclamados-rango.xlsx"
                ruta={`/no-reclamados/reportes/sepultados?${paramsRango}`}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ margin: 0, gridColumn: "1 / -1" }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person-check" /> Relación de identificadas y exhumadas
            </span>
          </div>
          <div className="card-body">
            <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Personas que estaban en calidad de desconocidas y fueron plenamente identificadas. Usa el formato
              oficial de <em>exhumaciones</em>.
            </p>
            <div className="barra-filtros" style={{ marginBottom: 0 }}>
              <select value={anioIdent} onChange={(e) => setAnioIdent(e.target.value)}>
                <option value="">Todos los años</option>
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select value={trimIdent} onChange={(e) => setTrimIdent(e.target.value)}>
                <option value="">Todo el año</option>
                <option value="1">1º (Ene – Mar)</option>
                <option value="2">2º (Abr – Jun)</option>
                <option value="3">3º (Jul – Sep)</option>
                <option value="4">4º (Oct – Dic)</option>
              </select>
              <BotonDescarga className="boton" icono="bi-download" nombreArchivo="identificados.xlsx" ruta={`/no-reclamados/reportes/identificados?${paramsIdent}`}>
                Generar
              </BotonDescarga>
              <Link className="boton-secundario" to="/no-reclamados/reconocidos">
                <i className="bi bi-eye" /> Ver
              </Link>
            </div>
          </div>
        </div>

        <div className="aviso-exito" style={{ gridColumn: "1 / -1", margin: 0 }}>
          <i className="bi bi-info-circle" /> Ambos archivos usan las columnas del formato que Sindicatura entrega a
          la Fiscalía General del Estado: clave, instancia que solicita, número único de caso, acta de defunción,
          ubicación, observaciones y ministerio público.
        </div>
      </div>
    </div>
  );
}
