import { useState } from "react";
import { Link } from "react-router-dom";
import { BotonDescarga } from "../../components/BotonDescarga";

const anioActual = new Date().getFullYear();
const trimActual = Math.floor(new Date().getMonth() / 3) + 1;
const anios = Array.from({ length: anioActual - 2015 + 1 }, (_, i) => anioActual - i);

const TRIMESTRES = [
  { v: "1", l: "1º (Ene – Mar)" },
  { v: "2", l: "2º (Abr – Jun)" },
  { v: "3", l: "3º (Jul – Sep)" },
  { v: "4", l: "4º (Oct – Dic)" },
];

export function NoReclamadosReporte() {
  // El corte trimestral es el que el departamento entrega a la Fiscalía; el
  // rango libre sirve para periodos que no caen en un trimestre cerrado.
  // Son el mismo reporte, así que comparten tarjeta y solo cambia el periodo.
  const [porRango, setPorRango] = useState(false);
  const [anioTrim, setAnioTrim] = useState(String(anioActual));
  const [trimestre, setTrimestre] = useState(String(trimActual));
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [anioIdent, setAnioIdent] = useState("");
  const [trimIdent, setTrimIdent] = useState("");

  const paramsSepultados = new URLSearchParams(
    porRango
      ? { ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) }
      : { anio: anioTrim, trimestre }
  );
  const paramsIdent = new URLSearchParams({
    ...(anioIdent ? { anio: anioIdent } : {}),
    ...(trimIdent ? { trimestre: trimIdent } : {}),
  });

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

      <div className="detalle-grid">
        <div className="rep-card">
          <div className="rep-head">
            <p className="rep-titulo">
              <i className="bi bi-person-x" /> Personas no reclamadas sepultadas
            </p>
            <p className="rep-desc">
              Relación de las personas inhumadas en fosa común, con los datos del levantamiento y la ubicación
              asignada. Se entrega por trimestre; el rango de fechas está para periodos que no caen en un trimestre
              cerrado.
            </p>
          </div>
          <div className="rep-body">
            <div className="barra-filtros" style={{ marginBottom: 0, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-campo">
                <label>Periodo</label>
                <select
                  value={porRango ? "rango" : "trimestre"}
                  onChange={(e) => setPorRango(e.target.value === "rango")}
                >
                  <option value="trimestre">Por trimestre</option>
                  <option value="rango">Por rango de fechas</option>
                </select>
              </div>

              {porRango ? (
                <>
                  <div className="form-campo">
                    <label>Desde</label>
                    <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Hasta</label>
                    <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-campo">
                    <label>Ejercicio</label>
                    <select value={anioTrim} onChange={(e) => setAnioTrim(e.target.value)}>
                      {anios.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-campo">
                    <label>Trimestre</label>
                    <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
                      {TRIMESTRES.map((t) => (
                        <option key={t.v} value={t.v}>
                          {t.l}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            {/* Los botones van en su propia fila para que las dos tarjetas se
                alineen igual, sin importar cuántos filtros muestre cada una. */}
            <div className="rep-acciones">
              <BotonDescarga
                className="boton"
                icono="bi-file-earmark-excel"
                nombreArchivo={porRango ? "no-reclamados-rango.xlsx" : "no-reclamados-trimestral.xlsx"}
                ruta={`/no-reclamados/reportes/sepultados?${paramsSepultados}`}
              >
                Generar Excel
              </BotonDescarga>
            </div>
            {porRango && !desde && !hasta && (
              <p className="text-muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
                <i className="bi bi-info-circle" /> Sin fechas, el reporte incluye todos los registros.
              </p>
            )}
          </div>
        </div>

        <div className="rep-card">
          <div className="rep-head">
            <p className="rep-titulo">
              <i className="bi bi-person-check" /> Relación de identificadas y exhumadas
            </p>
            <p className="rep-desc">
              Personas que ingresaron en calidad de desconocidas y fueron plenamente identificadas, con el medio de
              identificación y la instancia que lo solicitó. Usa el formato oficial de <em>exhumaciones</em>.
            </p>
          </div>
          <div className="rep-body">
            <div className="barra-filtros" style={{ marginBottom: 0, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-campo">
                <label>Ejercicio</label>
                <select value={anioIdent} onChange={(e) => setAnioIdent(e.target.value)}>
                  <option value="">Todos los años</option>
                  {anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Trimestre</label>
                <select value={trimIdent} onChange={(e) => setTrimIdent(e.target.value)}>
                  <option value="">Todo el año</option>
                  {TRIMESTRES.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rep-acciones">
              <BotonDescarga
                className="boton"
                icono="bi-file-earmark-excel"
                nombreArchivo="identificados.xlsx"
                ruta={`/no-reclamados/reportes/identificados?${paramsIdent}`}
              >
                Generar Excel
              </BotonDescarga>
              <Link className="boton-secundario" to="/no-reclamados/reconocidos">
                <i className="bi bi-eye" /> Ver listado
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="aviso-exito" style={{ marginTop: 20 }}>
        <i className="bi bi-info-circle" /> Ambos archivos usan las columnas del formato que Sindicatura entrega a la
        Fiscalía General del Estado: clave, instancia que solicita, número único de caso, acta de defunción,
        ubicación, observaciones y ministerio público.
      </div>
    </div>
  );
}
