import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";

interface FallecidoResultado {
  fallecidoId: number;
  nombre: string;
  fecha: string | null;
  acta: string | null;
  numeroCaso: string | null;
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

interface Panteon {
  panteonId: number;
  nombre: string;
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
  const tipoNombre = TIPOS.find((t) => t.clave === tipoClave)?.nombre ?? tipoClave;

  const [nombreSolicitante, setNombreSolicitante] = useState("");
  const [telefonoSolicitante, setTelefonoSolicitante] = useState("");
  const [domicilioSolicitante, setDomicilioSolicitante] = useState("");

  const [fallecidoTermino, setFallecidoTermino] = useState("");
  const [fallecidoResultados, setFallecidoResultados] = useState<FallecidoResultado[]>([]);
  const [fallecidoSel, setFallecidoSel] = useState<FallecidoResultado | null>(null);
  const [nombreFallecido, setNombreFallecido] = useState("");
  const [fechaFallecimiento, setFechaFallecimiento] = useState("");
  const [actaDefuncionNumero, setActaDefuncionNumero] = useState("");

  const [panteonIdLote, setPanteonIdLote] = useState("");
  const [loteManzana, setLoteManzana] = useState("");
  const [loteLote, setLoteLote] = useState("");
  const [loteResultados, setLoteResultados] = useState<LoteResultado[]>([]);
  const [loteSel, setLoteSel] = useState<LoteResultado | null>(null);
  const [errorLote, setErrorLote] = useState<string | null>(null);

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

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });

  async function buscarFallecido() {
    if (fallecidoTermino.trim().length < 3) return;
    const r = await api<FallecidoResultado[]>(`/fallecidos/buscar?termino=${encodeURIComponent(fallecidoTermino)}`);
    setFallecidoResultados(r);
  }

  function seleccionarFallecido(f: FallecidoResultado) {
    setFallecidoSel(f);
    setNombreFallecido(f.nombre);
    if (f.fecha) setFechaFallecimiento(f.fecha.slice(0, 10));
    if (f.acta) setActaDefuncionNumero(f.acta);
    setFallecidoResultados([]);
  }

  function quitarFallecido() {
    setFallecidoSel(null);
    setNombreFallecido("");
    setFechaFallecimiento("");
    setActaDefuncionNumero("");
  }

  async function buscarLote() {
    if (!loteManzana.trim() && !loteLote.trim()) {
      setErrorLote("Ingresa al menos manzana o lote para buscar.");
      return;
    }
    setErrorLote(null);
    const params = new URLSearchParams();
    if (panteonIdLote) params.set("panteonId", panteonIdLote);
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
      body.numeroRecibo = numeroRecibo || undefined;
      if (tipoClave === "SEP" || tipoClave === "EXH") {
        body.funeraria = funeraria || undefined;
      }
      if (tipoClave === "SEP") {
        body.esDonacion = esDonacion;
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
          Nuevo Permiso — {tipoNombre}
        </h2>
        <div className="page-header-acciones">
          <button type="button" className="boton-secundario" onClick={() => navigate("/permisos")}>
            <i className="bi bi-arrow-left" /> Regresar
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-campo" style={{ maxWidth: 260, marginBottom: 20 }}>
          <label>Tipo de trámite</label>
          <select
            value={tipoClave}
            onChange={(e) => {
              const nuevo = e.target.value;
              if (nuevo !== "EXH" && fallecidoSel) quitarFallecido();
              setTipoClave(nuevo);
            }}
          >
            {TIPOS.map((t) => (
              <option key={t.clave} value={t.clave}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person" /> Datos del Solicitante
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ gridTemplateColumns: "5fr 3fr 4fr", maxWidth: "none" }}>
              <div className="form-campo">
                <label>Nombre completo *</label>
                <input
                  value={nombreSolicitante}
                  onChange={(e) => setNombreSolicitante(e.target.value)}
                  placeholder="Nombre del solicitante"
                  required
                />
              </div>
              <div className="form-campo">
                <label>Teléfono</label>
                <input value={telefonoSolicitante} onChange={(e) => setTelefonoSolicitante(e.target.value)} placeholder="10 dígitos" />
              </div>
              <div className="form-campo">
                <label>Domicilio</label>
                <input value={domicilioSolicitante} onChange={(e) => setDomicilioSolicitante(e.target.value)} placeholder="Calle y número" />
              </div>
            </div>
          </div>
        </div>

        {tipoClave !== "CON" && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-flower1" /> Datos del Fallecido
              </span>
            </div>
            <div className="card-body">
              {tipoClave === "EXH" && (
                <>
                  <div className="form-grid" style={{ gridTemplateColumns: "6fr 2fr 4fr", maxWidth: "none", alignItems: "flex-end" }}>
                    <div className="form-campo">
                      <label>
                        Buscar expediente ya registrado{" "}
                        <i
                          className="bi bi-info-circle text-muted"
                          title="Enlaza el permiso a un expediente existente en vez de duplicarlo. Busca por nombre, acta o número de caso."
                        />
                      </label>
                      <input
                        value={fallecidoTermino}
                        onChange={(e) => setFallecidoTermino(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarFallecido())}
                        placeholder="Nombre, no. de acta o SON/NOG/FGE/..."
                      />
                    </div>
                    <button type="button" className="boton" onClick={buscarFallecido}>
                      <i className="bi bi-search" /> Buscar
                    </button>
                    <div className="form-campo">
                      <label>Expediente enlazado</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div className={`campo-resultado${fallecidoSel ? " lleno" : ""}`}>
                          {fallecidoSel ? fallecidoSel.nombre : "Sin seleccionar"}
                        </div>
                        {fallecidoSel && (
                          <button type="button" className="boton-secundario" title="Quitar enlace" onClick={quitarFallecido}>
                            <i className="bi bi-x-lg" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {fallecidoResultados.length > 0 && (
                    <div className="tabla-contenedor" style={{ marginTop: 12 }}>
                      <table className="tabla">
                        <tbody>
                          {fallecidoResultados.map((f) => (
                            <tr key={f.fallecidoId}>
                              <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                              <td className="text-muted">
                                <small>
                                  {[f.fecha ? new Date(f.fecha).toLocaleDateString("es-MX", { timeZone: "UTC" }) : null, f.acta ? `Acta ${f.acta}` : null, f.numeroCaso]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </small>
                              </td>
                              <td>
                                {f.esNoReclamado && <span className="badge badge-warning">No reclamado</span>}{" "}
                                {f.yaTienePermiso && <span className="badge badge-secondary">Ya tiene permiso</span>}
                              </td>
                              <td>
                                <button type="button" className="boton-secundario boton-sm" onClick={() => seleccionarFallecido(f)}>
                                  Usar este
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
                </>
              )}

              <div className="form-grid" style={{ gridTemplateColumns: "5fr 3fr 4fr", maxWidth: "none" }}>
                <div className="form-campo">
                  <label>Nombre completo</label>
                  <input
                    value={nombreFallecido}
                    onChange={(e) => setNombreFallecido(e.target.value)}
                    readOnly={!!fallecidoSel}
                    placeholder="Nombre del fallecido"
                  />
                </div>
                <div className="form-campo">
                  <label>Fecha de fallecimiento</label>
                  <input type="date" value={fechaFallecimiento} onChange={(e) => setFechaFallecimiento(e.target.value)} />
                </div>
                <div className="form-campo">
                  <label>No. Acta de defunción</label>
                  <input value={actaDefuncionNumero} onChange={(e) => setActaDefuncionNumero(e.target.value)} placeholder="Número de acta" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-geo-alt" /> Ubicación del Lote
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ gridTemplateColumns: "3fr 2fr 2fr 2fr 3fr", maxWidth: "none", alignItems: "flex-end" }}>
              <div className="form-campo">
                <label>Panteón</label>
                <select value={panteonIdLote} onChange={(e) => setPanteonIdLote(e.target.value)}>
                  <option value="">Todos</option>
                  {panteones?.map((p) => (
                    <option key={p.panteonId} value={p.panteonId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Manzana</label>
                <input
                  value={loteManzana}
                  onChange={(e) => setLoteManzana(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarLote())}
                  placeholder="Ej: 1A"
                />
              </div>
              <div className="form-campo">
                <label>Lote</label>
                <input
                  value={loteLote}
                  onChange={(e) => setLoteLote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarLote())}
                  placeholder="Ej: 13"
                />
              </div>
              <button type="button" className="boton" onClick={buscarLote}>
                <i className="bi bi-search" /> Buscar
              </button>
              <div className="form-campo">
                <label>Lote seleccionado</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <div className={`campo-resultado${loteSel ? " lleno" : ""}`}>
                    {loteSel
                      ? `${loteSel.panteon} · ${loteSel.seccion ? `Secc. ${loteSel.seccion} · ` : ""}Mz ${loteSel.manzana} L ${loteSel.lote}`
                      : "Sin seleccionar"}
                  </div>
                  {loteSel && (
                    <button type="button" className="boton-secundario" title="Quitar selección" onClick={() => setLoteSel(null)}>
                      <i className="bi bi-x-lg" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {errorLote && (
              <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
                {errorLote}
              </p>
            )}

            {loteResultados.length > 0 && (
              <div className="tabla-contenedor" style={{ marginTop: 12 }}>
                <table className="tabla">
                  <tbody>
                    {loteResultados.map((l) => (
                      <tr key={l.loteId}>
                        <td style={{ fontWeight: 600 }}>{l.titular}</td>
                        <td className="text-muted">
                          <small>
                            {l.panteon} — {l.seccion && `Secc. ${l.seccion} · `}Mz {l.manzana} L {l.lote}
                          </small>
                        </td>
                        <td>{!l.tieneTitulo && !l.esFosaComun && <span className="badge badge-danger">Sin título vigente</span>}</td>
                        <td>
                          <button
                            type="button"
                            className="boton-secundario boton-sm"
                            disabled={!l.tieneTitulo && !l.esFosaComun}
                            onClick={() => {
                              setLoteSel(l);
                              setLoteResultados([]);
                            }}
                          >
                            Usar este
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {tipoClave === "EXH" && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-info-circle" /> Datos de Exhumación
              </span>
            </div>
            <div className="card-body">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", maxWidth: "none" }}>
                <div className="form-campo">
                  <label>Motivo</label>
                  <input value={motivoExhumacion} onChange={(e) => setMotivoExhumacion(e.target.value)} />
                </div>
                <div className="form-campo">
                  <label>Destino de los restos</label>
                  <input value={destinoRestos} onChange={(e) => setDestinoRestos(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {tipoClave === "CEN" && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-info-circle" /> Datos de Depósito
              </span>
            </div>
            <div className="card-body">
              <div className="form-campo" style={{ maxWidth: 420 }}>
                <label>Ubicación del depósito</label>
                <input value={ubicacionDeposito} onChange={(e) => setUbicacionDeposito(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {tipoClave === "CON" && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-info-circle" /> Datos de Construcción
              </span>
            </div>
            <div className="card-body">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 2fr", maxWidth: "none" }}>
                <div className="form-campo">
                  <label>Tipo de construcción *</label>
                  <input value={tipoObra} onChange={(e) => setTipoObra(e.target.value)} placeholder="Barda, monumento, nicho..." list="tiposObra" />
                  <datalist id="tiposObra">
                    <option value="BARDA" />
                    <option value="BARANDAL" />
                    <option value="MONUMENTO" />
                    <option value="LÁPIDA" />
                    <option value="JARDINERA" />
                    <option value="CAPILLA" />
                    <option value="NICHO" />
                    <option value="GAVETA" />
                    <option value="ENJARRE" />
                    <option value="COLOCACIÓN DE LOSA" />
                  </datalist>
                </div>
                <div className="form-campo">
                  <label>Descripción</label>
                  <input
                    value={descripcionObra}
                    onChange={(e) => setDescripcionObra(e.target.value)}
                    placeholder="Medidas, materiales u observaciones (opcional)"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-receipt" /> Datos del Trámite
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ gridTemplateColumns: "4fr 5fr 3fr", maxWidth: "none", alignItems: "flex-end" }}>
              <div className="form-campo">
                <label>Número de recibo</label>
                <input value={numeroRecibo} onChange={(e) => setNumeroRecibo(e.target.value)} placeholder="Ej: 880590" />
              </div>
              {(tipoClave === "SEP" || tipoClave === "EXH") && (
                <div className="form-campo">
                  <label>Funeraria</label>
                  <input value={funeraria} onChange={(e) => setFuneraria(e.target.value)} placeholder="Nombre de la funeraria" />
                </div>
              )}
              {tipoClave === "SEP" && (
                <div className="form-campo" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 }}>
                  <input type="checkbox" id="esDonacion" checked={esDonacion} onChange={(e) => setEsDonacion(e.target.checked)} />
                  <label htmlFor="esDonacion" style={{ margin: 0 }}>
                    Lote donado
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <p className="aviso-error">{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="boton-secundario" onClick={() => navigate("/permisos")}>
            Cancelar
          </button>
          <button className="boton" type="submit" disabled={enviando || !loteSel}>
            <i className="bi bi-check2" /> {enviando ? "Generando..." : "Generar Permiso"}
          </button>
        </div>
        {!loteSel && (
          <p style={{ textAlign: "right", marginTop: 6, color: "var(--guinda)", fontSize: 13 }}>Selecciona un lote primero.</p>
        )}
      </form>
    </div>
  );
}
