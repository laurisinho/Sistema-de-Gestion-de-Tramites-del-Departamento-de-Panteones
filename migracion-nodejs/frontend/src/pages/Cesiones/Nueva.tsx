import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface TituloResultado {
  tituloId: number;
  folio: string;
  titular: string;
  panteon: string;
  ubicacion: string;
}

export function CesionNueva() {
  const navigate = useNavigate();

  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<TituloResultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [tituloSel, setTituloSel] = useState<TituloResultado | null>(null);

  const [nombreCesionario, setNombreCesionario] = useState("");
  const [telefonoCesionario, setTelefonoCesionario] = useState("");
  const [domicilioCesionario, setDomicilioCesionario] = useState("");
  const [coloniaCesionario, setColoniaCesionario] = useState("");
  const [ineCesionario, setIneCesionario] = useState("");
  const [fechaCesion, setFechaCesion] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function buscar() {
    if (termino.trim().length < 2) return;
    setBuscando(true);
    try {
      const r = await api<TituloResultado[]>(`/titulos/buscar?termino=${encodeURIComponent(termino)}`);
      setResultados(r);
    } finally {
      setBuscando(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tituloSel) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await api<{ cesionId: number; folioCesion: string; nuevoFolio: string }>("/cesiones", {
        method: "POST",
        body: JSON.stringify({
          tituloId: tituloSel.tituloId,
          nombreCesionario,
          telefonoCesionario: telefonoCesionario || undefined,
          domicilioCesionario: domicilioCesionario || undefined,
          coloniaCesionario: coloniaCesionario || undefined,
          ineCesionario: ineCesionario || undefined,
          fechaCesion: fechaCesion || undefined,
        }),
      });
      navigate("/cesiones", {
        state: { exito: `Cesión ${r.folioCesion} registrada. Nuevo título ${r.nuevoFolio} emitido a ${nombreCesionario}.` },
      });
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
          <i className="bi bi-arrow-left-right" />
          Nueva Cesión de Derechos
        </h2>
        <div className="page-header-acciones">
          <button type="button" className="boton-secundario" onClick={() => navigate("/cesiones")}>
            <i className="bi bi-arrow-left" /> Regresar
          </button>
        </div>
      </div>

      {error && <p className="aviso-error">{error}</p>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-1-circle" /> Buscar el título a ceder
          </span>
        </div>
        <div className="card-body">
          <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
            El dueño actual debe presentar su título. Búscalo por folio, nombre del titular o manzana/lote.
          </p>
          <div className="barra-filtros" style={{ marginBottom: 0 }}>
            <input
              placeholder="Folio, titular, manzana o lote..."
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
              style={{ flex: 1, minWidth: 280 }}
            />
            <button type="button" className="boton" onClick={buscar}>
              <i className="bi bi-search" /> Buscar
            </button>
          </div>

          {buscando && (
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Buscando...
            </p>
          )}

          {!buscando && resultados?.length === 0 && (
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Sin títulos vigentes que coincidan.
            </p>
          )}

          {!buscando && resultados && resultados.length > 0 && (
            <div className="tabla-contenedor" style={{ marginTop: 12 }}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Titular</th>
                    <th>Panteón</th>
                    <th>Ubicación</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((t) => (
                    <tr key={t.tituloId}>
                      <td>
                        <small className="text-muted">{t.folio}</small>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.titular}</td>
                      <td>
                        <small>{t.panteon}</small>
                      </td>
                      <td>
                        <small>{t.ubicacion}</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="boton boton-sm"
                          onClick={() => {
                            setTituloSel(t);
                            setResultados(null);
                          }}
                        >
                          <i className="bi bi-check-lg" /> Ceder
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

      {tituloSel && (
        <form onSubmit={onSubmit}>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-2-circle" /> Título seleccionado (cedente)
              </span>
              <button type="button" className="boton-secundario boton-sm" onClick={() => setTituloSel(null)}>
                Cambiar
              </button>
            </div>
            <div className="card-body">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: "none" }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>Folio</div>
                  <strong>{tituloSel.folio}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>Titular actual</div>
                  <strong>{tituloSel.titular}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>Ubicación</div>
                  <strong>
                    {tituloSel.panteon} — {tituloSel.ubicacion}
                  </strong>
                </div>
              </div>
              <p className="aviso-advertencia" style={{ marginBottom: 0, marginTop: 16 }}>
                <i className="bi bi-info-circle" /> Al registrar la cesión, este título quedará <strong>CEDIDO</strong> y se emitirá
                uno <strong>nuevo VIGENTE</strong> al cesionario sobre el mismo lote.
              </p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-3-circle" /> Datos del cesionario (nuevo dueño)
              </span>
            </div>
            <div className="card-body">
              <div className="form-grid una-col" style={{ maxWidth: "none" }}>
                <div className="form-campo">
                  <label>Nombre completo *</label>
                  <input
                    value={nombreCesionario}
                    onChange={(e) => setNombreCesionario(e.target.value)}
                    placeholder="Puede incluir 'Y/O' para dos personas"
                    required
                  />
                </div>
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: "none", marginTop: 16 }}>
                <div className="form-campo">
                  <label>Teléfono</label>
                  <input value={telefonoCesionario} onChange={(e) => setTelefonoCesionario(e.target.value)} />
                </div>
                <div className="form-campo">
                  <label>Número de INE</label>
                  <input value={ineCesionario} onChange={(e) => setIneCesionario(e.target.value)} maxLength={20} />
                </div>
                <div className="form-campo">
                  <label>Fecha de la cesión</label>
                  <input type="date" value={fechaCesion} onChange={(e) => setFechaCesion(e.target.value)} />
                </div>
                <div className="form-campo span2">
                  <label>Domicilio</label>
                  <input value={domicilioCesionario} onChange={(e) => setDomicilioCesionario(e.target.value)} />
                </div>
                <div className="form-campo">
                  <label>Colonia</label>
                  <input value={coloniaCesionario} onChange={(e) => setColoniaCesionario(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="boton-secundario" onClick={() => navigate("/cesiones")}>
              Cancelar
            </button>
            <button className="boton" type="submit" disabled={enviando}>
              <i className="bi bi-check-circle" /> {enviando ? "Registrando..." : "Registrar cesión y emitir título"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
