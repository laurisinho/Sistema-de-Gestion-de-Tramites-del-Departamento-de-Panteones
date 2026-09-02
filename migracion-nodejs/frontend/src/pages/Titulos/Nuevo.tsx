import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface Panteon {
  panteonId: number;
  nombre: string;
  usaColindancias: boolean;
}

export function TituloNuevo() {
  const navigate = useNavigate();
  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });

  const [panteonId, setPanteonId] = useState("");
  const [nombreTitular, setNombreTitular] = useState("");
  const [telefonoTitular, setTelefonoTitular] = useState("");
  const [domicilioTitular, setDomicilioTitular] = useState("");
  const [coloniaTitular, setColoniaTitular] = useState("");
  const [numeroINE, setNumeroINE] = useState("");
  const [numeroManzana, setNumeroManzana] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const [seccion, setSeccion] = useState("");
  const [colindanciaNorte, setColindanciaNorte] = useState("");
  const [colindanciaSur, setColindanciaSur] = useState("");
  const [colindanciaEste, setColindanciaEste] = useState("");
  const [colindanciaOeste, setColindanciaOeste] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const panteonSel = panteones?.find((p) => String(p.panteonId) === panteonId);
  const usaColindancias = panteonSel?.usaColindancias ?? false;

  // Secciones que ya existen en el panteon elegido, para no tener que
  // recordarlas de memoria ni escribirlas distinto cada vez. Va como datalist y
  // no como <select> porque una seccion nueva tiene que poder capturarse.
  const { data: secciones } = useQuery({
    queryKey: ["catalogos", "secciones", panteonId],
    queryFn: () =>
      api<{ secciones: string[] }>(`/catalogos/secciones?panteonId=${panteonId}`).then((r) => r.secciones),
    enabled: !!panteonId && !usaColindancias,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        nombreTitular,
        telefonoTitular: telefonoTitular || undefined,
        domicilioTitular: domicilioTitular || undefined,
        coloniaTitular: coloniaTitular || undefined,
        numeroINE: numeroINE || undefined,
        panteonId: Number(panteonId),
        fechaEmision: fechaEmision || undefined,
      };
      if (usaColindancias) {
        body.colindanciaNorte = colindanciaNorte || undefined;
        body.colindanciaSur = colindanciaSur || undefined;
        body.colindanciaEste = colindanciaEste || undefined;
        body.colindanciaOeste = colindanciaOeste || undefined;
      } else {
        body.numeroManzana = numeroManzana;
        body.numeroLote = numeroLote;
        body.seccion = seccion || undefined;
      }

      const r = await api<{ tituloId: number; folio: string }>("/titulos", {
        method: "POST",
        body: JSON.stringify(body),
      });
      navigate("/titulos", { state: { exito: `Título ${r.folio} emitido correctamente.` } });
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
          <i className="bi bi-award" />
          Nuevo Título de Propiedad
        </h2>
        <div className="page-header-acciones">
          <button type="button" className="boton-secundario" onClick={() => navigate("/titulos")}>
            <i className="bi bi-arrow-left" /> Regresar
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        {error && <p className="aviso-error">{error}</p>}

        <div className="detalle-grid" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-person" /> Datos del Titular
              </span>
            </div>
            <div className="card-body">
              <div className="form-grid una-col" style={{ maxWidth: "none" }}>
                <div className="form-campo">
                  <label>Nombre completo *</label>
                  <input value={nombreTitular} onChange={(e) => setNombreTitular(e.target.value)} required />
                </div>
              </div>
              <div className="form-grid" style={{ maxWidth: "none", marginTop: 16 }}>
                <div className="form-campo">
                  <label>Teléfono</label>
                  <input value={telefonoTitular} onChange={(e) => setTelefonoTitular(e.target.value)} />
                </div>
                <div className="form-campo">
                  <label>Número de INE</label>
                  <input value={numeroINE} onChange={(e) => setNumeroINE(e.target.value)} maxLength={20} />
                </div>
                <div className="form-campo span2">
                  <label>Domicilio</label>
                  <input value={domicilioTitular} onChange={(e) => setDomicilioTitular(e.target.value)} />
                </div>
                <div className="form-campo span2">
                  <label>Colonia</label>
                  <input value={coloniaTitular} onChange={(e) => setColoniaTitular(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-geo-alt" /> Ubicación del Lote
              </span>
            </div>
            <div className="card-body">
              <div className="form-grid una-col" style={{ maxWidth: "none" }}>
                <div className="form-campo">
                  <label>Panteón *</label>
                  <select
                    value={panteonId}
                    onChange={(e) => {
                      setPanteonId(e.target.value);
                      setSeccion("");
                    }}
                    required
                  >
                    <option value="">Seleccione...</option>
                    {panteones?.map((p) => (
                      <option key={p.panteonId} value={p.panteonId}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!panteonId && (
                <p className="text-muted" style={{ fontSize: 13, margin: "14px 0 0" }}>
                  <i className="bi bi-info-circle" /> Selecciona un panteón para capturar la ubicación.
                </p>
              )}

              {panteonId && usaColindancias && (
                <div className="form-grid" style={{ maxWidth: "none", marginTop: 16 }}>
                  <div className="form-campo">
                    <label>Colindancia Norte</label>
                    <input value={colindanciaNorte} onChange={(e) => setColindanciaNorte(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Colindancia Sur</label>
                    <input value={colindanciaSur} onChange={(e) => setColindanciaSur(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Colindancia Este</label>
                    <input value={colindanciaEste} onChange={(e) => setColindanciaEste(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Colindancia Oeste</label>
                    <input value={colindanciaOeste} onChange={(e) => setColindanciaOeste(e.target.value)} />
                  </div>
                </div>
              )}

              {panteonId && !usaColindancias && (
                <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: "none", marginTop: 16 }}>
                  <div className="form-campo">
                    <label>Manzana *</label>
                    <input value={numeroManzana} onChange={(e) => setNumeroManzana(e.target.value)} required />
                  </div>
                  <div className="form-campo">
                    <label>Lote *</label>
                    <input value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} required />
                  </div>
                  <div className="form-campo">
                    <label>Sección</label>
                    <input
                      value={seccion}
                      onChange={(e) => setSeccion(e.target.value)}
                      list="seccionesPanteon"
                      placeholder={secciones?.length ? "Elige o escribe una nueva" : ""}
                    />
                    <datalist id="seccionesPanteon">
                      {secciones?.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-file-earmark-text" /> Datos del Título
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none", alignItems: "flex-end" }}>
              <div className="form-campo">
                <label>Fecha de emisión</label>
                <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
              </div>
              <div className="form-campo" style={{ justifyContent: "flex-end" }}>
                <button className="boton" type="submit" disabled={enviando || !panteonId}>
                  <i className="bi bi-check-circle" /> {enviando ? "Emitiendo..." : "Emitir Título"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
