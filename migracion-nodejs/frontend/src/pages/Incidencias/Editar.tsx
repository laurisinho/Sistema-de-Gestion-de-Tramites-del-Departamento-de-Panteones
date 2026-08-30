import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { IncidenciaFormulario, type CamposIncidencia } from "./Formulario";

interface IncidenciaDetalle {
  panteonId: number;
  loteId: number | null;
  tipo: string;
  descripcion: string;
  fechaIncidencia: string;
  reportadoPor: string | null;
  seccion: string | null;
  numeroManzana: string | null;
  numeroLote: string | null;
}

export function IncidenciaEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["incidencias", id, "editar"],
    queryFn: () => api<{ incidencia: IncidenciaDetalle }>(`/incidencias/${id}`).then((r) => r.incidencia),
  });

  const [valores, setValores] = useState<CamposIncidencia>({
    panteonId: "",
    tipo: "",
    descripcion: "",
    fechaIncidencia: "",
    reportadoPor: "",
    seccion: "",
    numeroManzana: "",
    numeroLote: "",
  });

  function onCambio<K extends keyof CamposIncidencia>(campo: K, valor: CamposIncidencia[K]) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data || cargado) return;
    setValores({
      panteonId: String(data.panteonId),
      tipo: data.tipo,
      descripcion: data.descripcion,
      fechaIncidencia: data.fechaIncidencia.slice(0, 10),
      reportadoPor: data.reportadoPor ?? "",
      seccion: data.seccion ?? "",
      numeroManzana: data.numeroManzana ?? "",
      numeroLote: data.numeroLote ?? "",
    });
    setCargado(true);
  }, [data, cargado]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/incidencias/${id}`, {
        method: "PUT",
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
      navigate("/incidencias", { state: { exito: "Incidencia actualizada correctamente." } });
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
          Editar incidencia
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
          <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
