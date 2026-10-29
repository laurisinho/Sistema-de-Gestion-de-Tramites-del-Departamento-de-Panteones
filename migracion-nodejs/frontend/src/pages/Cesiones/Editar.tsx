import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface CesionDetalle {
  cesionId: number;
  folio: string;
  estado: string;
  fechaCesion: string;
  cedente: { nombreCompleto: string };
  cesionario: {
    nombreCompleto: string;
    telefono: string | null;
    domicilio: string | null;
    colonia: string | null;
    identificacionNumero: string | null;
  };
  lote: { numeroManzana: string; numeroLote: string; seccion: string | null; panteon: { nombre: string } };
}

export function CesionEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["cesiones", id, "editar"],
    queryFn: () => api<{ cesion: CesionDetalle }>(`/cesiones/${id}`).then((r) => r.cesion),
  });

  const [nombreCesionario, setNombreCesionario] = useState("");
  const [telefonoCesionario, setTelefonoCesionario] = useState("");
  const [domicilioCesionario, setDomicilioCesionario] = useState("");
  const [coloniaCesionario, setColoniaCesionario] = useState("");
  const [ineCesionario, setIneCesionario] = useState("");
  const [fechaCesion, setFechaCesion] = useState("");
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data || cargado) return;
    setNombreCesionario(data.cesionario.nombreCompleto);
    setTelefonoCesionario(data.cesionario.telefono ?? "");
    setDomicilioCesionario(data.cesionario.domicilio ?? "");
    setColoniaCesionario(data.cesionario.colonia ?? "");
    setIneCesionario(data.cesionario.identificacionNumero ?? "");
    setFechaCesion(data.fechaCesion.slice(0, 10));
    setCargado(true);
  }, [data, cargado]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/cesiones/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombreCesionario,
          telefonoCesionario: telefonoCesionario || undefined,
          domicilioCesionario: domicilioCesionario || undefined,
          coloniaCesionario: coloniaCesionario || undefined,
          ineCesionario,
          fechaCesion: fechaCesion || undefined,
        }),
      });
      navigate("/cesiones", { state: { exito: `Cesión ${data?.folio} actualizada correctamente.` } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (!cargado || !data) return <p>Cargando...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-pencil-square" />
          Editar Cesión — {data.folio}
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/cesiones">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {error && <p className="aviso-error" style={{ marginBottom: 16 }}>{error}</p>}

      <form onSubmit={onSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-info-circle" /> Cesión (no editable)
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none" }}>
              <div className="form-campo">
                <label>Cedente (dueño anterior)</label>
                <input value={data.cedente.nombreCompleto} readOnly disabled />
              </div>
              <div className="form-campo">
                <label>Lote</label>
                <input
                  value={`${data.lote.panteon.nombre} · ${data.lote.seccion ? data.lote.seccion + " · " : ""}Manzana ${data.lote.numeroManzana} · Lote ${data.lote.numeroLote}`}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person" /> Datos del cesionario (nuevo dueño)
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid una-col" style={{ maxWidth: "none" }}>
              <div className="form-campo">
                <label>Nombre completo *</label>
                <input
                  value={nombreCesionario}
                  onChange={(e) => setNombreCesionario(e.target.value)}
                  placeholder="Puede incluir 'Y/O' para dos personas"
                  required
                />
              </div>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: "none", marginTop: 16 }}>
              <div className="form-campo">
                <label>Teléfono</label>
                <input value={telefonoCesionario} onChange={(e) => setTelefonoCesionario(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Número de INE</label>
                <input value={ineCesionario} onChange={(e) => setIneCesionario(e.target.value)} maxLength={20} />
              </div>
              <div className="form-campo">
                <label>Fecha de la cesión</label>
                <input type="date" value={fechaCesion} onChange={(e) => setFechaCesion(e.target.value)} />
              </div>
              <div className="form-campo span2">
                <label>Domicilio</label>
                <input value={domicilioCesionario} onChange={(e) => setDomicilioCesionario(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Colonia</label>
                <input value={coloniaCesionario} onChange={(e) => setColoniaCesionario(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="boton-secundario" onClick={() => navigate("/cesiones")}>
            Cancelar
          </button>
          <button className="boton" type="submit" disabled={enviando}>
            <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
