import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { NoReclamadoFormulario, CAMPOS_VACIOS, type CamposNoReclamado } from "./Formulario";

export function NoReclamadoCrear() {
  const navigate = useNavigate();
  const [valores, setValores] = useState<CamposNoReclamado>(CAMPOS_VACIOS);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function onCambiar<K extends keyof CamposNoReclamado>(campo: K, valor: CamposNoReclamado[K]) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await api<{ fallecidoId: number }>("/no-reclamados", {
        method: "POST",
        body: JSON.stringify({
          nombreCompleto: valores.nombreCompleto,
          posibleNombre: valores.posibleNombre || undefined,
          numeroCaso: valores.numeroCaso || undefined,
          fechaFallecimiento: valores.fechaFallecimiento || undefined,
          horaFallecimiento: valores.horaFallecimiento || undefined,
          fechaLevantamiento: valores.fechaLevantamiento || undefined,
          lugarLevantamiento: valores.lugarLevantamiento || undefined,
          ministerioPublico: valores.ministerioPublico || undefined,
          actaDefuncionNumero: valores.actaDefuncionNumero || undefined,
          actaDefuncionFolio: valores.actaDefuncionFolio || undefined,
          actaDefuncionFecha: valores.actaDefuncionFecha || undefined,
          causaFallecimiento: valores.causaFallecimiento || undefined,
          descripcionHallazgo: valores.descripcionHallazgo || undefined,
        }),
      });
      navigate(`/no-reclamados/${r.fallecidoId}`, { state: { exito: "Registro de persona no reclamada creado correctamente." } });
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
          <i className="bi bi-person-x" />
          Nuevo Registro — No Reclamado
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/no-reclamados">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {error && (
        <p className="aviso-error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <form onSubmit={onSubmit}>
        <NoReclamadoFormulario valores={valores} onCambiar={onCambiar} />
        <div style={{ marginTop: 16 }}>
          <button className="boton" type="submit" disabled={enviando}>
            <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar registro"}
          </button>
        </div>
      </form>
    </div>
  );
}
