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
  const [resultados, setResultados] = useState<TituloResultado[]>([]);
  const [tituloSel, setTituloSel] = useState<TituloResultado | null>(null);

  const [nombreCesionario, setNombreCesionario] = useState("");
  const [telefonoCesionario, setTelefonoCesionario] = useState("");
  const [domicilioCesionario, setDomicilioCesionario] = useState("");
  const [coloniaCesionario, setColoniaCesionario] = useState("");
  const [ineCesionario, setIneCesionario] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function buscar() {
    if (termino.trim().length < 2) return;
    const r = await api<TituloResultado[]>(`/titulos/buscar?termino=${encodeURIComponent(termino)}`);
    setResultados(r);
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
          Nueva cesión de derechos
        </h2>
      </div>
      <div className="card">
      <div className="card-body">
      <h3>Título a ceder</h3>
      {tituloSel ? (
        <div className="aviso-exito" style={{ marginBottom: 16 }}>
          <strong>{tituloSel.folio}</strong> — {tituloSel.titular} — {tituloSel.panteon}, {tituloSel.ubicacion}{" "}
          <button type="button" className="boton-secundario" onClick={() => setTituloSel(null)}>
            Quitar
          </button>
        </div>
      ) : (
        <>
          <div className="barra-filtros">
            <input
              placeholder="Folio, titular, manzana o lote"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              style={{ minWidth: 320 }}
            />
            <button type="button" className="boton-secundario" onClick={buscar}>
              Buscar
            </button>
          </div>
          {resultados.length > 0 && (
            <div className="tabla-contenedor">
              <table className="tabla" style={{ marginBottom: 16 }}>
                <tbody>
                  {resultados.map((t) => (
                    <tr key={t.tituloId}>
                      <td>{t.folio}</td>
                      <td>{t.titular}</td>
                      <td>{t.panteon}</td>
                      <td>{t.ubicacion}</td>
                      <td>
                        <button type="button" className="boton-secundario boton-sm" onClick={() => setTituloSel(t)}>
                          Usar este
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <form onSubmit={onSubmit}>
        <h3>Cesionario (nuevo dueño)</h3>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-campo span2">
            <label>Nombre completo *</label>
            <input value={nombreCesionario} onChange={(e) => setNombreCesionario(e.target.value)} required />
          </div>
          <div className="form-campo">
            <label>Teléfono</label>
            <input value={telefonoCesionario} onChange={(e) => setTelefonoCesionario(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Colonia</label>
            <input value={coloniaCesionario} onChange={(e) => setColoniaCesionario(e.target.value)} />
          </div>
          <div className="form-campo span2">
            <label>Domicilio</label>
            <input value={domicilioCesionario} onChange={(e) => setDomicilioCesionario(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Número de INE</label>
            <input value={ineCesionario} onChange={(e) => setIneCesionario(e.target.value)} />
          </div>
        </div>

        {error && <p className="aviso-error">{error}</p>}

        <button className="boton" type="submit" disabled={enviando || !tituloSel}>
          <i className="bi bi-check-circle" /> {enviando ? "Registrando..." : "Registrar cesión"}
        </button>
        {!tituloSel && <span style={{ marginLeft: 8, color: "var(--guinda)", fontSize: 13 }}>Selecciona un título primero.</span>}
      </form>
      </div>
      </div>
    </div>
  );
}
