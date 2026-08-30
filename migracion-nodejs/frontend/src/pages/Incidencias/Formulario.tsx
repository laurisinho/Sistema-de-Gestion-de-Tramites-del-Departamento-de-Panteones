import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Panteon {
  panteonId: number;
  nombre: string;
}

export interface CamposIncidencia {
  panteonId: string;
  tipo: string;
  descripcion: string;
  fechaIncidencia: string;
  reportadoPor: string;
  seccion: string;
  numeroManzana: string;
  numeroLote: string;
}

interface Props {
  valores: CamposIncidencia;
  onCambio: <K extends keyof CamposIncidencia>(campo: K, valor: CamposIncidencia[K]) => void;
}

// Equivale al _Form.cshtml del sistema original: las dos tarjetas ("Qué pasó" /
// "Dónde ocurrió") son idénticas al capturar y al editar, así que viven en un
// solo lugar en vez de duplicarse entre Nueva y Editar.
export function IncidenciaFormulario({ valores, onCambio }: Props) {
  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });
  const { data: tipos } = useQuery({
    queryKey: ["catalogos", "tipos-incidencia"],
    queryFn: () => api<string[]>("/catalogos/tipos-incidencia"),
  });

  return (
    <div className="detalle-grid" style={{ gridTemplateColumns: "7fr 5fr", marginBottom: 20 }}>
      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-exclamation-triangle" /> Qué pasó
          </span>
        </div>
        <div className="card-body">
          <div className="form-grid" style={{ gridTemplateColumns: "7fr 5fr", maxWidth: "none" }}>
            <div className="form-campo">
              <label>Tipo de incidencia *</label>
              <select value={valores.tipo} onChange={(e) => onCambio("tipo", e.target.value)} required>
                <option value="">— Selecciona —</option>
                {tipos?.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-campo">
              <label>Fecha de la incidencia *</label>
              <input
                type="date"
                value={valores.fechaIncidencia}
                onChange={(e) => onCambio("fechaIncidencia", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-campo" style={{ marginTop: 16 }}>
            <label>Descripción de lo ocurrido *</label>
            <textarea
              value={valores.descripcion}
              onChange={(e) => onCambio("descripcion", e.target.value)}
              rows={4}
              required
              placeholder="Describe qué sucedió, qué daño hay y cualquier dato útil para atenderlo..."
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

          <div className="form-campo" style={{ marginTop: 16 }}>
            <label>Reportado por</label>
            <input
              value={valores.reportadoPor}
              onChange={(e) => onCambio("reportadoPor", e.target.value)}
              placeholder="Nombre de quien reportó (panteonero, familiar, ciudadano...)"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-geo-alt" /> Dónde ocurrió
          </span>
        </div>
        <div className="card-body">
          <div className="form-campo">
            <label>Panteón *</label>
            <select value={valores.panteonId} onChange={(e) => onCambio("panteonId", e.target.value)} required>
              <option value="">— Selecciona —</option>
              {panteones?.map((p) => (
                <option key={p.panteonId} value={p.panteonId}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <p className="aviso-info" style={{ margin: "16px 0" }}>
            <i className="bi bi-info-circle" /> La manzana y el lote son <strong>opcionales</strong>. Déjalos vacíos si la incidencia
            fue en un pasillo, barda, acceso o cualquier área general.
          </p>

          <div className="form-campo">
            <label>Sección</label>
            <input value={valores.seccion} onChange={(e) => onCambio("seccion", e.target.value)} placeholder="Ej: COLINA, ADEII" />
          </div>

          <div className="form-grid" style={{ maxWidth: "none", marginTop: 16 }}>
            <div className="form-campo">
              <label>Manzana</label>
              <input value={valores.numeroManzana} onChange={(e) => onCambio("numeroManzana", e.target.value)} placeholder="Ej: 3" />
            </div>
            <div className="form-campo">
              <label>Lote</label>
              <input value={valores.numeroLote} onChange={(e) => onCambio("numeroLote", e.target.value)} placeholder="Ej: 30" />
            </div>
          </div>

          <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 0, marginTop: 16 }}>
            Si el lote está en el catálogo, puedes buscarlo desde <Link to="/lotes">Expediente de lote</Link> para confirmar sección y
            manzana antes de capturar.
          </p>
        </div>
      </div>
    </div>
  );
}
