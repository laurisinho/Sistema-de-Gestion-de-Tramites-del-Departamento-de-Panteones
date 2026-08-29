import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface FallecidoResultado {
  fallecidoId: number;
  nombre: string;
  fecha: string | null;
  esNoReclamado: boolean;
  yaTienePermiso: boolean;
}

interface LoteResultado {
  loteId: number;
  panteon: string;
  manzana: string;
  lote: string;
  seccion: string | null;
  estado: string;
  esFosaComun: boolean;
  titular: string;
  tieneTitulo: boolean;
}

const TIPOS = [
  { clave: "SEP", nombre: "Sepultura" },
  { clave: "EXH", nombre: "Exhumación" },
  { clave: "CEN", nombre: "Depósito de cenizas" },
  { clave: "CON", nombre: "Construcción" },
];

export function PermisoNuevo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoInicial = TIPOS.some((t) => t.clave === searchParams.get("tipo")) ? searchParams.get("tipo")! : "SEP";
  const [tipoClave, setTipoClave] = useState(tipoInicial);

  const [nombreSolicitante, setNombreSolicitante] = useState("");
  const [telefonoSolicitante, setTelefonoSolicitante] = useState("");
  const [domicilioSolicitante, setDomicilioSolicitante] = useState("");

  const [fallecidoTermino, setFallecidoTermino] = useState("");
  const [fallecidoResultados, setFallecidoResultados] = useState<FallecidoResultado[]>([]);
  const [fallecidoSel, setFallecidoSel] = useState<FallecidoResultado | null>(null);
  const [nombreFallecido, setNombreFallecido] = useState("");
  const [fechaFallecimiento, setFechaFallecimiento] = useState("");
  const [actaDefuncionNumero, setActaDefuncionNumero] = useState("");

  const [loteManzana, setLoteManzana] = useState("");
  const [loteLote, setLoteLote] = useState("");
  const [loteResultados, setLoteResultados] = useState<LoteResultado[]>([]);
  const [loteSel, setLoteSel] = useState<LoteResultado | null>(null);

  const [motivoExhumacion, setMotivoExhumacion] = useState("");
  const [destinoRestos, setDestinoRestos] = useState("");
  const [ubicacionDeposito, setUbicacionDeposito] = useState("");
  const [tipoObra, setTipoObra] = useState("");
  const [descripcionObra, setDescripcionObra] = useState("");
  const [esDonacion, setEsDonacion] = useState(false);
  const [numeroRecibo, setNumeroRecibo] = useState("");
  const [funeraria, setFuneraria] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function buscarFallecido() {
    if (fallecidoTermino.trim().length < 3) return;
    const r = await api<FallecidoResultado[]>(`/fallecidos/buscar?termino=${encodeURIComponent(fallecidoTermino)}`);
    setFallecidoResultados(r);
  }

  async function buscarLote() {
    const params = new URLSearchParams();
    if (loteManzana) params.set("manzana", loteManzana);
    if (loteLote) params.set("lote", loteLote);
    const r = await api<LoteResultado[]>(`/lotes/buscar?${params}`);
    setLoteResultados(r);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        tipoClave,
        nombreSolicitante,
        telefonoSolicitante: telefonoSolicitante || undefined,
        domicilioSolicitante: domicilioSolicitante || undefined,
        loteId: loteSel?.loteId,
      };
      if (fallecidoSel) {
        body.fallecidoId = fallecidoSel.fallecidoId;
      } else {
        body.nombreFallecido = nombreFallecido || undefined;
        body.fechaFallecimiento = fechaFallecimiento || undefined;
        body.actaDefuncionNumero = actaDefuncionNumero || undefined;
      }
      if (tipoClave === "EXH") {
        body.motivoExhumacion = motivoExhumacion || undefined;
        body.destinoRestos = destinoRestos || undefined;
      }
      if (tipoClave === "CEN") {
        body.ubicacionDeposito = ubicacionDeposito || undefined;
      }
      if (tipoClave === "CON") {
        body.tipoObra = tipoObra || undefined;
        body.descripcionObra = descripcionObra || undefined;
      }
      if (tipoClave === "SEP") {
        body.esDonacion = esDonacion;
        body.numeroRecibo = numeroRecibo || undefined;
        body.funeraria = funeraria || undefined;
      }

      const r = await api<{ permisoId: number; folio: string }>("/permisos", {
        method: "POST",
        body: JSON.stringify(body),
      });
      navigate("/permisos", { state: { exito: `Permiso ${r.folio} generado correctamente.` } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-plus" />
          Nuevo permiso
        </h2>
      </div>
      <div className="card">
      <div className="card-body">
      <form onSubmit={onSubmit}>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-campo">
            <label>Tipo de trámite</label>
            <select value={tipoClave} onChange={(e) => setTipoClave(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3>Solicitante</h3>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-campo span2">
            <label>Nombre completo *</label>
            <input value={nombreSolicitante} onChange={(e) => setNombreSolicitante(e.target.value)} required />
          </div>
          <div className="form-campo">
            <label>Teléfono</label>
            <input value={telefonoSolicitante} onChange={(e) => setTelefonoSolicitante(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Domicilio</label>
            <input value={domicilioSolicitante} onChange={(e) => setDomicilioSolicitante(e.target.value)} />
          </div>
        </div>

        <h3>Difunto</h3>
        {fallecidoSel ? (
          <div className="aviso-exito" style={{ marginBottom: 12 }}>
            Enlazado a expediente existente: <strong>{fallecidoSel.nombre}</strong>{" "}
            {fallecidoSel.yaTienePermiso && "(ya tiene otro permiso)"}{" "}
            <button type="button" className="boton-secundario" onClick={() => setFallecidoSel(null)}>
              Quitar
            </button>
          </div>
        ) : (
          <>
            <div className="barra-filtros">
              <input
                placeholder="Buscar expediente existente (nombre, acta, número de caso)"
                value={fallecidoTermino}
                onChange={(e) => setFallecidoTermino(e.target.value)}
                style={{ minWidth: 320 }}
              />
              <button type="button" className="boton-secundario" onClick={buscarFallecido}>
                Buscar
              </button>
            </div>
            {fallecidoResultados.length > 0 && (
              <table className="tabla" style={{ marginBottom: 16 }}>
                <tbody>
                  {fallecidoResultados.map((f) => (
                    <tr key={f.fallecidoId}>
                      <td>{f.nombre}</td>
                      <td>{f.esNoReclamado ? "No reclamado" : ""}</td>
                      <td>{f.yaTienePermiso ? "Ya tiene permiso" : ""}</td>
                      <td>
                        <button type="button" className="boton-secundario boton-sm" onClick={() => setFallecidoSel(f)}>
                          Usar este
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="form-campo span2">
                <label>O capturar difunto nuevo — nombre</label>
                <input value={nombreFallecido} onChange={(e) => setNombreFallecido(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Fecha de fallecimiento</label>
                <input type="date" value={fechaFallecimiento} onChange={(e) => setFechaFallecimiento(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Número de acta de defunción</label>
                <input value={actaDefuncionNumero} onChange={(e) => setActaDefuncionNumero(e.target.value)} />
              </div>
            </div>
          </>
        )}

        <h3>Lote</h3>
        {loteSel ? (
          <div className="aviso-exito" style={{ marginBottom: 12 }}>
            <strong>
              {loteSel.panteon} · Mz {loteSel.manzana} L {loteSel.lote}
            </strong>{" "}
            — {loteSel.titular}{" "}
            <button type="button" className="boton-secundario" onClick={() => setLoteSel(null)}>
              Quitar
            </button>
          </div>
        ) : (
          <>
            <div className="barra-filtros">
              <input placeholder="Manzana" value={loteManzana} onChange={(e) => setLoteManzana(e.target.value)} />
              <input placeholder="Lote" value={loteLote} onChange={(e) => setLoteLote(e.target.value)} />
              <button type="button" className="boton-secundario" onClick={buscarLote}>
                Buscar lote
              </button>
            </div>
            {loteResultados.length > 0 && (
              <table className="tabla" style={{ marginBottom: 16 }}>
                <tbody>
                  {loteResultados.map((l) => (
                    <tr key={l.loteId}>
                      <td>
                        {l.panteon} · Mz {l.manzana} L {l.lote}
                      </td>
                      <td>{l.esFosaComun ? "Fosa común" : l.estado}</td>
                      <td>{l.titular}</td>
                      <td>
                        <button type="button" className="boton-secundario boton-sm" onClick={() => setLoteSel(l)}>
                          Usar este
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tipoClave === "EXH" && (
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-campo span2">
              <label>Motivo de exhumación</label>
              <input value={motivoExhumacion} onChange={(e) => setMotivoExhumacion(e.target.value)} />
            </div>
            <div className="form-campo span2">
              <label>Destino de los restos</label>
              <input value={destinoRestos} onChange={(e) => setDestinoRestos(e.target.value)} />
            </div>
          </div>
        )}

        {tipoClave === "CEN" && (
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-campo span2">
              <label>Ubicación del depósito</label>
              <input value={ubicacionDeposito} onChange={(e) => setUbicacionDeposito(e.target.value)} />
            </div>
          </div>
        )}

        {tipoClave === "CON" && (
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-campo">
              <label>Tipo de construcción</label>
              <input value={tipoObra} onChange={(e) => setTipoObra(e.target.value)} />
            </div>
            <div className="form-campo span2">
              <label>Descripción de la obra</label>
              <input value={descripcionObra} onChange={(e) => setDescripcionObra(e.target.value)} />
            </div>
          </div>
        )}

        {tipoClave === "SEP" && (
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-campo">
              <label>
                <input type="checkbox" checked={esDonacion} onChange={(e) => setEsDonacion(e.target.checked)} /> Es donación
              </label>
            </div>
            <div className="form-campo">
              <label>Número de recibo</label>
              <input value={numeroRecibo} onChange={(e) => setNumeroRecibo(e.target.value)} />
            </div>
            <div className="form-campo span2">
              <label>Funeraria</label>
              <input value={funeraria} onChange={(e) => setFuneraria(e.target.value)} />
            </div>
          </div>
        )}

        {error && <p className="aviso-error">{error}</p>}

        <button className="boton" type="submit" disabled={enviando || !loteSel}>
          <i className="bi bi-check-circle" /> {enviando ? "Generando..." : "Generar permiso"}
        </button>
        {!loteSel && <span style={{ marginLeft: 8, color: "var(--guinda)", fontSize: 13 }}>Selecciona un lote primero.</span>}
      </form>
      </div>
      </div>
    </div>
  );
}
