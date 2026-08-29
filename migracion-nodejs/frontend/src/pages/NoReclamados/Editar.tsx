import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { NoReclamadoFormulario, CAMPOS_VACIOS, type CamposNoReclamado } from "./Formulario";

interface Fallecido {
  fallecidoId: number;
  nombreCompleto: string;
  posibleNombre: string | null;
  numeroCaso: string | null;
  fechaFallecimiento: string | null;
  horaFallecimiento: string | null;
  fechaLevantamiento: string | null;
  lugarLevantamiento: string | null;
  ministerioPublico: string | null;
  actaDefuncionNumero: string | null;
  actaDefuncionFolio: string | null;
  actaDefuncionFecha: string | null;
  causaFallecimiento: string | null;
  descripcionHallazgo: string | null;
}

function aFechaInput(f: string | null): string {
  return f ? f.slice(0, 10) : "";
}
function aHoraInput(f: string | null): string {
  if (!f) return "";
  const d = new Date(f);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function NoReclamadoEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [valores, setValores] = useState<CamposNoReclamado>(CAMPOS_VACIOS);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data } = useQuery({
    queryKey: ["no-reclamados", id, "editar"],
    queryFn: () => api<{ fallecido: Fallecido }>(`/no-reclamados/${id}`).then((r) => r.fallecido),
  });

  useEffect(() => {
    if (!data || cargado) return;
    setValores({
      nombreCompleto: data.nombreCompleto,
      posibleNombre: data.posibleNombre ?? "",
      fechaFallecimiento: aFechaInput(data.fechaFallecimiento),
      horaFallecimiento: aHoraInput(data.horaFallecimiento),
      fechaLevantamiento: aFechaInput(data.fechaLevantamiento),
      lugarLevantamiento: data.lugarLevantamiento ?? "",
      descripcionHallazgo: data.descripcionHallazgo ?? "",
      causaFallecimiento: data.causaFallecimiento ?? "",
      actaDefuncionNumero: data.actaDefuncionNumero ?? "",
      actaDefuncionFolio: data.actaDefuncionFolio ?? "",
      actaDefuncionFecha: aFechaInput(data.actaDefuncionFecha),
      numeroCaso: data.numeroCaso ?? "",
      ministerioPublico: data.ministerioPublico ?? "",
    });
    setCargado(true);
  }, [data, cargado]);

  function onCambiar<K extends keyof CamposNoReclamado>(campo: K, valor: CamposNoReclamado[K]) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/no-reclamados/${id}`, {
        method: "PUT",
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
      navigate(`/no-reclamados/${id}`, { state: { exito: "Registro actualizado correctamente." } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (!cargado) return <p>Cargando...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-pencil-square" />
          Editar Registro — No Reclamado
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to={`/no-reclamados/${id}`}>
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
            <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
