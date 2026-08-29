import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface CamposNoReclamado {
  nombreCompleto: string;
  posibleNombre: string;
  fechaFallecimiento: string;
  horaFallecimiento: string;
  fechaLevantamiento: string;
  lugarLevantamiento: string;
  descripcionHallazgo: string;
  causaFallecimiento: string;
  actaDefuncionNumero: string;
  actaDefuncionFolio: string;
  actaDefuncionFecha: string;
  numeroCaso: string;
  ministerioPublico: string;
}

export const CAMPOS_VACIOS: CamposNoReclamado = {
  nombreCompleto: "PERSONA DESCONOCIDA",
  posibleNombre: "",
  fechaFallecimiento: "",
  horaFallecimiento: "",
  fechaLevantamiento: "",
  lugarLevantamiento: "",
  descripcionHallazgo: "",
  causaFallecimiento: "",
  actaDefuncionNumero: "",
  actaDefuncionFolio: "",
  actaDefuncionFecha: "",
  numeroCaso: "",
  ministerioPublico: "",
};

interface Props {
  valores: CamposNoReclamado;
  onCambiar: <K extends keyof CamposNoReclamado>(campo: K, valor: CamposNoReclamado[K]) => void;
}

export function NoReclamadoFormulario({ valores, onCambiar }: Props) {
  const { data: ministerios } = useQuery({
    queryKey: ["no-reclamados", "ministerios-publicos"],
    queryFn: () => api<string[]>("/no-reclamados/ministerios-publicos"),
  });

  return (
    <div className="form-grid" style={{ gridTemplateColumns: "7fr 5fr", maxWidth: 960, alignItems: "start" }}>
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-person" /> Identificación y hallazgo
          </span>
        </div>
        <div className="card-body">
          <div className="form-grid una-col">
            <div className="form-campo">
              <label>Nombre *</label>
              <input
                value={valores.nombreCompleto}
                onChange={(e) => onCambiar("nombreCompleto", e.target.value)}
                placeholder="Nombre, o 'PERSONA DESCONOCIDA'"
                required
              />
            </div>
            <div className="form-campo">
              <label>Posible nombre</label>
              <input
                value={valores.posibleNombre}
                onChange={(e) => onCambiar("posibleNombre", e.target.value)}
                placeholder="Nombre tentativo de la persona no identificada"
              />
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="form-campo">
                <label>Fecha de fallecimiento</label>
                <input type="date" value={valores.fechaFallecimiento} onChange={(e) => onCambiar("fechaFallecimiento", e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Hora</label>
                <input type="time" value={valores.horaFallecimiento} onChange={(e) => onCambiar("horaFallecimiento", e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Fecha de hallazgo</label>
                <input type="date" value={valores.fechaLevantamiento} onChange={(e) => onCambiar("fechaLevantamiento", e.target.value)} />
              </div>
            </div>
            <div className="form-campo">
              <label>Lugar del levantamiento</label>
              <input
                value={valores.lugarLevantamiento}
                onChange={(e) => onCambiar("lugarLevantamiento", e.target.value)}
                placeholder="Ej: IMSS BIENESTAR, RANCHO EL RODEO, LA COMAYA..."
              />
            </div>
            <div className="form-campo">
              <label>Descripción / circunstancias del hallazgo</label>
              <textarea
                value={valores.descripcionHallazgo}
                onChange={(e) => onCambiar("descripcionHallazgo", e.target.value)}
                rows={3}
                placeholder="Dónde y cómo fue encontrado, observaciones..."
              />
            </div>
            <div className="form-campo">
              <label>Causa de fallecimiento</label>
              <input value={valores.causaFallecimiento} onChange={(e) => onCambiar("causaFallecimiento", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ margin: 0 }}>
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-file-earmark-text" /> Datos del Acta
          </span>
        </div>
        <div className="card-body">
          <div className="form-grid una-col">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="form-campo">
                <label>No. de acta</label>
                <input value={valores.actaDefuncionNumero} onChange={(e) => onCambiar("actaDefuncionNumero", e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Folio de acta</label>
                <input value={valores.actaDefuncionFolio} onChange={(e) => onCambiar("actaDefuncionFolio", e.target.value)} />
              </div>
            </div>
            <div className="form-campo">
              <label>Fecha del acta</label>
              <input type="date" value={valores.actaDefuncionFecha} onChange={(e) => onCambiar("actaDefuncionFecha", e.target.value)} />
            </div>
            <div className="form-campo">
              <label>Número de caso (Carpeta FGE)</label>
              <input
                value={valores.numeroCaso}
                onChange={(e) => onCambiar("numeroCaso", e.target.value)}
                placeholder="SON/NOG/FGE/2021/220/18937"
              />
            </div>
            <div className="form-campo">
              <label>Ministerio Público</label>
              <input
                value={valores.ministerioPublico}
                onChange={(e) => onCambiar("ministerioPublico", e.target.value)}
                placeholder="LIC. NOMBRE DEL AGENTE"
                list="lista-mp"
              />
              <datalist id="lista-mp">
                {ministerios?.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
