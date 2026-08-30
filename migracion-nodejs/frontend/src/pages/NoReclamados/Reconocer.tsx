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
      <div className="page-header">
        <h2>
          <i className="bi bi-person-check" />
          Reconocer persona
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to={`/no-reclamados/${id}`}>
            <i className="bi bi-arrow-left" /> Cancelar
          </Link>
        </div>
      </div>

      {!data.ubicacion ? (
        <p className="aviso-advertencia" style={{ marginBottom: 16 }}>
          <i className="bi bi-exclamation-triangle" /> Esta persona <strong>no tiene lote asignado</strong>: todavía no se le
          captura el permiso de inhumación, así que no está ligada a ninguna tumba. Puedes registrar la identificación de
          todos modos, pero <strong>no habrá lote que liberar</strong> cuando se exhume.
        </p>
      ) : (
        <p className="aviso-info" style={{ marginBottom: 16 }}>
          <i className="bi bi-info-circle" /> Este registro deja constancia de que la persona fue{" "}
          <strong>plenamente identificada</strong>. El lote <strong>sigue ocupado</strong>: se libera hasta que se apruebe el
          permiso de exhumación correspondiente.
        </p>
      )}

      <form onSubmit={onSubmit}>
        <div className="detalle-grid" style={{ gridTemplateColumns: "7fr 5fr", marginBottom: 20 }}>
          <div className="card">
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-person-badge" /> Identificación
              </span>
            </div>
            <div className="card-body">
              <div className="form-campo">
                <label>Registrada actualmente como</label>
                <div className="campo-resultado lleno" style={{ height: "auto", flexDirection: "column", alignItems: "flex-start", whiteSpace: "normal" }}>
                  <span>{data.nombreAnterior}</span>
                  <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 400 }}>
                    <i className="bi bi-geo-alt" /> {data.ubicacion ?? "Sin lote asignado"}
                  </span>
                </div>
              </div>

              <div className="form-campo" style={{ marginTop: 16 }}>
                <label>Nombre identificado *</label>
                <input
                  value={nombreIdentificado}
                  onChange={(e) => setNombreIdentificado(e.target.value)}
                  placeholder="Nombre completo de la persona ya identificada"
                  required
                />
              </div>

              <div className="form-campo" style={{ marginTop: 16 }}>
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

              <div className="form-campo" style={{ marginTop: 16 }}>
                <label>Instancia que solicita</label>
                <input
                  value={instanciaSolicita}
                  onChange={(e) => setInstanciaSolicita(e.target.value)}
                  placeholder="FUNERARIA / NOMBRE DEL FAMILIAR QUE SOLICITA"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-file-earmark-text" /> Datos del expediente
              </span>
            </div>
            <div className="card-body">
              <div className="form-campo">
                <label>Fecha de identificación *</label>
                <input
                  type="date"
                  value={fechaReconocimiento}
                  onChange={(e) => setFechaReconocimiento(e.target.value)}
                  required
                />
              </div>
              <div className="form-campo" style={{ marginTop: 16 }}>
                <label>Número de acta de defunción</label>
                <input value={numeroActaDefuncion} onChange={(e) => setNumeroActaDefuncion(e.target.value)} />
              </div>
              <div className="form-campo" style={{ marginTop: 16 }}>
                <label>Número único de caso</label>
                <input
                  value={numeroCaso}
                  onChange={(e) => setNumeroCaso(e.target.value)}
                  placeholder={data.numeroCasoActual ?? "SON/NOG/FGE/2021/220/18937"}
                  className="font-monospace"
                />
              </div>
              <div className="form-campo" style={{ marginTop: 16 }}>
                <label>Ministerio Público que turnó el caso</label>
                <input
                  value={ministerioPublico}
                  onChange={(e) => setMinisterioPublico(e.target.value)}
                  placeholder="LIC. NOMBRE APELLIDO"
                />
              </div>
              <div className="form-campo" style={{ marginTop: 16 }}>
                <label>Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  style={{
                    padding: "0.48rem 0.8rem",
                    border: "1px solid var(--input-border)",
                    borderRadius: 9,
                    fontSize: 13.5,
                    background: "var(--input-bg)",
                    color: "var(--text-base)",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {enviarError && <p className="aviso-error">{enviarError}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Link className="boton-secundario" to={`/no-reclamados/${id}`}>
            Cancelar
          </Link>
          <button className="boton" type="submit" disabled={enviando}>
            <i className="bi bi-person-check" /> {enviando ? "Guardando..." : "Registrar identificación"}
          </button>
        </div>
      </form>
    </div>
  );
}
