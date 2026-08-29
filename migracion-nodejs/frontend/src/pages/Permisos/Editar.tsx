import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface PermisoDetalle {
  permisoId: number;
  folio: string;
  estado: string;
  fechaSolicitud: string | null;
  numeroRecibo: string | null;
  funeraria: string | null;
  motivoExhumacion: string | null;
  destinoRestos: string | null;
  tipoObra: string | null;
  descripcionObra: string | null;
  esDonacion: boolean;
  tipoTramite: { clave: string; nombre: string };
  solicitante: { nombreCompleto: string; telefono: string | null; domicilio: string | null };
  fallecido: { nombreCompleto: string; fechaFallecimiento: string | null; actaDefuncionNumero: string | null } | null;
}

const ESTADOS = ["APROBADO", "PENDIENTE", "RECHAZADO", "CANCELADO"];

export function PermisoEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["permisos", id, "editar"],
    queryFn: () => api<{ permiso: PermisoDetalle }>(`/permisos/${id}`).then((r) => r.permiso),
  });

  const [nombreSolicitante, setNombreSolicitante] = useState("");
  const [telefonoSolicitante, setTelefonoSolicitante] = useState("");
  const [domicilioSolicitante, setDomicilioSolicitante] = useState("");
  const [nombreFallecido, setNombreFallecido] = useState("");
  const [fechaFallecimiento, setFechaFallecimiento] = useState("");
  const [actaDefuncionNumero, setActaDefuncionNumero] = useState("");
  const [fechaSolicitud, setFechaSolicitud] = useState("");
  const [estado, setEstado] = useState("APROBADO");
  const [numeroRecibo, setNumeroRecibo] = useState("");
  const [funeraria, setFuneraria] = useState("");
  const [motivoExhumacion, setMotivoExhumacion] = useState("");
  const [destinoRestos, setDestinoRestos] = useState("");
  const [tipoObra, setTipoObra] = useState("");
  const [descripcionObra, setDescripcionObra] = useState("");
  const [esDonacion, setEsDonacion] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data || cargado) return;
    setNombreSolicitante(data.solicitante.nombreCompleto);
    setTelefonoSolicitante(data.solicitante.telefono ?? "");
    setDomicilioSolicitante(data.solicitante.domicilio ?? "");
    setNombreFallecido(data.fallecido?.nombreCompleto ?? "");
    setFechaFallecimiento(data.fallecido?.fechaFallecimiento?.slice(0, 10) ?? "");
    setActaDefuncionNumero(data.fallecido?.actaDefuncionNumero ?? "");
    setFechaSolicitud(data.fechaSolicitud?.slice(0, 10) ?? "");
    setEstado(data.estado);
    setNumeroRecibo(data.numeroRecibo ?? "");
    setFuneraria(data.funeraria ?? "");
    setMotivoExhumacion(data.motivoExhumacion ?? "");
    setDestinoRestos(data.destinoRestos ?? "");
    setTipoObra(data.tipoObra ?? "");
    setDescripcionObra(data.descripcionObra ?? "");
    setEsDonacion(data.esDonacion);
    setCargado(true);
  }, [data, cargado]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/permisos/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombreSolicitante,
          telefonoSolicitante: telefonoSolicitante || undefined,
          domicilioSolicitante: domicilioSolicitante || undefined,
          nombreFallecido: nombreFallecido || undefined,
          fechaFallecimiento: fechaFallecimiento || undefined,
          actaDefuncionNumero: actaDefuncionNumero || undefined,
          fechaSolicitud: fechaSolicitud || undefined,
          estado,
          numeroRecibo: numeroRecibo || undefined,
          funeraria: funeraria || undefined,
          motivoExhumacion: motivoExhumacion || undefined,
          destinoRestos: destinoRestos || undefined,
          tipoObra: tipoObra || undefined,
          descripcionObra: descripcionObra || undefined,
          esDonacion,
        }),
      });
      navigate("/permisos", { state: { exito: `Permiso ${data?.folio} actualizado correctamente.` } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (!cargado || !data) return <p>Cargando...</p>;
  const clave = data.tipoTramite.clave;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-pencil-square" />
          Editar Permiso — {data.folio}
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/permisos">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {error && (
        <p className="aviso-error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className="card">
        <div className="card-body">
          <form onSubmit={onSubmit}>
            <h3>Solicitante</h3>
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="form-campo span2">
                <label>Nombre completo *</label>
                <input value={nombreSolicitante} onChange={(e) => setNombreSolicitante(e.target.value)} required />
              </div>
              <div className="form-campo">
                <label>Teléfono</label>
                <input value={telefonoSolicitante} onChange={(e) => setTelefonoSolicitante(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Domicilio</label>
                <input value={domicilioSolicitante} onChange={(e) => setDomicilioSolicitante(e.target.value)} />
              </div>
            </div>

            {data.fallecido && (
              <>
                <h3>Difunto</h3>
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div className="form-campo span2">
                    <label>Nombre</label>
                    <input value={nombreFallecido} onChange={(e) => setNombreFallecido(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Fecha de fallecimiento</label>
                    <input type="date" value={fechaFallecimiento} onChange={(e) => setFechaFallecimiento(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Número de acta de defunción</label>
                    <input value={actaDefuncionNumero} onChange={(e) => setActaDefuncionNumero(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <h3>Trámite</h3>
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="form-campo">
                <label>Fecha de solicitud</label>
                <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              {(clave === "SEP" || clave === "EXH" || clave === "CEN" || clave === "CON") && (
                <div className="form-campo">
                  <label>Número de recibo</label>
                  <input value={numeroRecibo} onChange={(e) => setNumeroRecibo(e.target.value)} />
                </div>
              )}
              {(clave === "SEP" || clave === "EXH") && (
                <div className="form-campo">
                  <label>Funeraria</label>
                  <input value={funeraria} onChange={(e) => setFuneraria(e.target.value)} />
                </div>
              )}
              {clave === "SEP" && (
                <div className="form-campo">
                  <label>
                    <input type="checkbox" checked={esDonacion} onChange={(e) => setEsDonacion(e.target.checked)} /> Lote donado
                  </label>
                </div>
              )}
            </div>

            {clave === "EXH" && (
              <div className="form-grid" style={{ marginBottom: 20 }}>
                <div className="form-campo span2">
                  <label>Motivo de exhumación</label>
                  <input value={motivoExhumacion} onChange={(e) => setMotivoExhumacion(e.target.value)} />
                </div>
                <div className="form-campo span2">
                  <label>Destino de los restos</label>
                  <input value={destinoRestos} onChange={(e) => setDestinoRestos(e.target.value)} />
                </div>
              </div>
            )}

            {clave === "CON" && (
              <div className="form-grid" style={{ marginBottom: 20 }}>
                <div className="form-campo">
                  <label>Tipo de construcción</label>
                  <input value={tipoObra} onChange={(e) => setTipoObra(e.target.value)} />
                </div>
                <div className="form-campo span2">
                  <label>Descripción de la obra</label>
                  <input value={descripcionObra} onChange={(e) => setDescripcionObra(e.target.value)} />
                </div>
              </div>
            )}

            <button className="boton" type="submit" disabled={enviando}>
              <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
