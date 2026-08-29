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

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const panteonSel = panteones?.find((p) => String(p.panteonId) === panteonId);
  const usaColindancias = panteonSel?.usaColindancias ?? false;

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
          Nuevo título de propiedad
        </h2>
      </div>
      <div className="card">
      <div className="card-body">
      <form onSubmit={onSubmit}>
        <h3>Titular</h3>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-campo span2">
            <label>Nombre completo *</label>
            <input value={nombreTitular} onChange={(e) => setNombreTitular(e.target.value)} required />
          </div>
          <div className="form-campo">
            <label>Teléfono</label>
            <input value={telefonoTitular} onChange={(e) => setTelefonoTitular(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Colonia</label>
            <input value={coloniaTitular} onChange={(e) => setColoniaTitular(e.target.value)} />
          </div>
          <div className="form-campo span2">
            <label>Domicilio</label>
            <input value={domicilioTitular} onChange={(e) => setDomicilioTitular(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Número de INE</label>
            <input value={numeroINE} onChange={(e) => setNumeroINE(e.target.value)} />
          </div>
        </div>

        <h3>Lote</h3>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-campo">
            <label>Panteón *</label>
            <select value={panteonId} onChange={(e) => setPanteonId(e.target.value)} required>
              <option value="">Selecciona...</option>
              {panteones?.map((p) => (
                <option key={p.panteonId} value={p.panteonId}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          {panteonId && usaColindancias && (
            <>
              <div className="form-campo span2" style={{ color: "#666", fontSize: 13 }}>
                Este panteón usa colindancias — la manzana y el lote se asignan automáticamente.
              </div>
              <div className="form-campo">
                <label>Colindancia norte</label>
                <input value={colindanciaNorte} onChange={(e) => setColindanciaNorte(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Colindancia sur</label>
                <input value={colindanciaSur} onChange={(e) => setColindanciaSur(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Colindancia este</label>
                <input value={colindanciaEste} onChange={(e) => setColindanciaEste(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Colindancia oeste</label>
                <input value={colindanciaOeste} onChange={(e) => setColindanciaOeste(e.target.value)} />
              </div>
            </>
          )}

          {panteonId && !usaColindancias && (
            <>
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
                <input value={seccion} onChange={(e) => setSeccion(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {error && <p className="aviso-error">{error}</p>}

        <button className="boton" type="submit" disabled={enviando || !panteonId}>
          <i className="bi bi-check-circle" /> {enviando ? "Emitiendo..." : "Emitir título"}
        </button>
      </form>
      </div>
      </div>
    </div>
  );
}
