import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { IncidenciaFormulario, type CamposIncidencia } from "./Formulario";

export function IncidenciaNueva() {
  const navigate = useNavigate();

  const [valores, setValores] = useState<CamposIncidencia>({
    panteonId: "",
    tipo: "",
    descripcion: "",
    fechaIncidencia: new Date().toISOString().slice(0, 10),
    reportadoPor: "",
    seccion: "",
    numeroManzana: "",
    numeroLote: "",
  });

  function onCambio<K extends keyof CamposIncidencia>(campo: K, valor: CamposIncidencia[K]) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

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
          panteonId: Number(valores.panteonId),
          tipo: valores.tipo,
          descripcion: valores.descripcion,
          fechaIncidencia: valores.fechaIncidencia,
          reportadoPor: valores.reportadoPor || undefined,
          seccion: valores.seccion || undefined,
          numeroManzana: valores.numeroManzana || undefined,
          numeroLote: valores.numeroLote || undefined,
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
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/incidencias">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {error && <p className="aviso-error">{error}</p>}

      <form onSubmit={onSubmit}>
        <IncidenciaFormulario valores={valores} onCambio={onCambio} />

        <button className="boton" type="submit" disabled={enviando}>
          <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Registrar incidencia"}
        </button>
      </form>
    </div>
  );
}
