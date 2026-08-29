import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface Panteon {
  panteonId: number;
  nombre: string;
}

export function IncidenciaNueva() {
  const navigate = useNavigate();
  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });
  const { data: tipos } = useQuery({
    queryKey: ["catalogos", "tipos-incidencia"],
    queryFn: () => api<string[]>("/catalogos/tipos-incidencia"),
  });

  const [panteonId, setPanteonId] = useState("");
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaIncidencia, setFechaIncidencia] = useState(new Date().toISOString().slice(0, 10));
  const [reportadoPor, setReportadoPor] = useState("");
  const [seccion, setSeccion] = useState("");
  const [numeroManzana, setNumeroManzana] = useState("");
  const [numeroLote, setNumeroLote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api("/incidencias", {
        method: "POST",
        body: JSON.stringify({
          panteonId: Number(panteonId),
          tipo,
          descripcion,
          fechaIncidencia,
          reportadoPor: reportadoPor || undefined,
          seccion: seccion || undefined,
          numeroManzana: numeroManzana || undefined,
          numeroLote: numeroLote || undefined,
        }),
      });
      navigate("/incidencias", { state: { exito: "Incidencia registrada correctamente." } });
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
          <i className="bi bi-exclamation-triangle" />
          Reportar incidencia
        </h2>
      </div>
      <div className="card">
      <div className="card-body">
      <form onSubmit={onSubmit}>
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
          <div className="form-campo">
            <label>Tipo *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} required>
              <option value="">Selecciona...</option>
              {tipos?.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-campo span2">
            <label>Descripción *</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} required />
          </div>
          <div className="form-campo">
            <label>Fecha *</label>
            <input type="date" value={fechaIncidencia} onChange={(e) => setFechaIncidencia(e.target.value)} required />
          </div>
          <div className="form-campo">
            <label>Reportado por</label>
            <input value={reportadoPor} onChange={(e) => setReportadoPor(e.target.value)} />
          </div>
          <div className="form-campo span2" style={{ color: "#666", fontSize: 13 }}>
            Ubicación (opcional — déjala vacía si es un área general, como un pasillo o barda):
          </div>
          <div className="form-campo">
            <label>Sección</label>
            <input value={seccion} onChange={(e) => setSeccion(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Manzana</label>
            <input value={numeroManzana} onChange={(e) => setNumeroManzana(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Lote</label>
            <input value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} />
          </div>
        </div>

        {error && <p className="aviso-error">{error}</p>}

        <button className="boton" type="submit" disabled={enviando}>
          <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Registrar incidencia"}
        </button>
      </form>
      </div>
      </div>
    </div>
  );
}
