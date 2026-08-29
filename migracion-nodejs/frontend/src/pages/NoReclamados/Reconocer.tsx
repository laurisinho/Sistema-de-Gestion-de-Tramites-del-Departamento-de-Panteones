import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface ReconocerPrefill {
  nombreAnterior: string;
  ubicacion: string | null;
  numeroCasoActual: string | null;
}

const MEDIOS_FRECUENTES = [
  "FUE IDENTIFICADO MEDIANTE PRUEBA PERICIAL DE ADN",
  "FUE IDENTIFICADO MEDIANTE PRUEBA PERICIAL DE GENÉTICA",
  "FUE IDENTIFICADO POR SUS FAMILIARES DIRECTOS",
  "FUE IDENTIFICADO POR SUS FAMILIARES MEDIANTE PLACAS FOTOGRÁFICAS",
  "FUE IDENTIFICADO POR SUS FAMILIARES Y DICTÁMENES PERICIALES",
];

export function NoReclamadoReconocer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["no-reclamados", id, "reconocer"],
    queryFn: () => api<ReconocerPrefill>(`/no-reclamados/${id}/reconocer`),
  });

  const [nombreIdentificado, setNombreIdentificado] = useState("");
  const [fechaReconocimiento, setFechaReconocimiento] = useState(new Date().toISOString().slice(0, 10));
  const [medioIdentificacion, setMedioIdentificacion] = useState("");
  const [instanciaSolicita, setInstanciaSolicita] = useState("");
  const [numeroActaDefuncion, setNumeroActaDefuncion] = useState("");
  const [ministerioPublico, setMinisterioPublico] = useState("");
  const [numeroCaso, setNumeroCaso] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [enviarError, setEnviarError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (isLoading) return <p>Cargando...</p>;
  if (error) {
    return <p className="aviso-error">{error instanceof ApiError ? error.message : "No se pudo cargar el registro."}</p>;
  }
  if (!data) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviarError(null);
    setEnviando(true);
    try {
      const r = await api<{ mensaje: string }>(`/no-reclamados/${id}/reconocer`, {
        method: "POST",
        body: JSON.stringify({
          nombreIdentificado,
          fechaReconocimiento,
          medioIdentificacion,
          instanciaSolicita: instanciaSolicita || undefined,
          numeroActaDefuncion: numeroActaDefuncion || undefined,
          ministerioPublico: ministerioPublico || undefined,
          numeroCaso: numeroCaso || undefined,
          observaciones: observaciones || undefined,
        }),
      });
      navigate(`/no-reclamados/${id}`, { state: { exito: r.mensaje } });
    } catch (err) {
      setEnviarError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <p>
        <Link to={`/no-reclamados/${id}`}>
          <i className="bi bi-arrow-left" /> Volver
        </Link>
      </p>
      <div className="page-header">
        <h2>
          <i className="bi bi-person-check" />
          Reconocer: {data.nombreAnterior}
        </h2>
      </div>
      <div className="card">
      <div className="card-body">
      <p className="text-muted" style={{ marginTop: 0 }}>Ubicación actual: {data.ubicacion ?? "sin lote asignado"}</p>

      <form onSubmit={onSubmit}>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="form-campo span2">
            <label>Nombre identificado *</label>
            <input value={nombreIdentificado} onChange={(e) => setNombreIdentificado(e.target.value)} required />
          </div>
          <div className="form-campo">
            <label>Fecha de identificación *</label>
            <input type="date" value={fechaReconocimiento} onChange={(e) => setFechaReconocimiento(e.target.value)} required />
          </div>
          <div className="form-campo span2">
            <label>Medio de identificación *</label>
            <select value={medioIdentificacion} onChange={(e) => setMedioIdentificacion(e.target.value)} required>
              <option value="">Selecciona...</option>
              {MEDIOS_FRECUENTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__otro__">Otro (escribir abajo)</option>
            </select>
            {medioIdentificacion === "__otro__" && (
              <input
                placeholder="Describe el medio de identificación"
                onChange={(e) => setMedioIdentificacion(e.target.value)}
                style={{ marginTop: 6 }}
              />
            )}
          </div>
          <div className="form-campo span2">
            <label>Instancia que solicita</label>
            <input value={instanciaSolicita} onChange={(e) => setInstanciaSolicita(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Número de acta de defunción</label>
            <input value={numeroActaDefuncion} onChange={(e) => setNumeroActaDefuncion(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Ministerio Público</label>
            <input value={ministerioPublico} onChange={(e) => setMinisterioPublico(e.target.value)} />
          </div>
          <div className="form-campo">
            <label>Número único de caso</label>
            <input value={numeroCaso} onChange={(e) => setNumeroCaso(e.target.value)} placeholder={data.numeroCasoActual ?? ""} />
          </div>
          <div className="form-campo span2">
            <label>Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
          </div>
        </div>

        {enviarError && <p className="aviso-error">{enviarError}</p>}

        <button className="boton" type="submit" disabled={enviando}>
          <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Registrar identificación"}
        </button>
      </form>
      </div>
      </div>
    </div>
  );
}
