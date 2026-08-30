import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

interface TituloDetalle {
  tituloId: number;
  folio: string;
  fechaEmision: string | null;
  estado: string;
  estadoEntrega: string;
  fechaEntrega: string | null;
  titular: { nombreCompleto: string; telefono: string | null; domicilio: string | null; colonia: string | null };
  lote: {
    numeroManzana: string;
    numeroLote: string;
    seccion: string | null;
    colindanciaNorte: string | null;
    colindanciaSur: string | null;
    colindanciaEste: string | null;
    colindanciaOeste: string | null;
  };
}

const ESTADOS = ["VIGENTE", "CEDIDO", "CANCELADO"];
const ESTADOS_ENTREGA = [
  { v: "PENDIENTE_ENTREGA", l: "Pendiente de entrega" },
  { v: "LLAMADA_REALIZADA", l: "Llamada realizada" },
  { v: "BUZON", l: "Buzón" },
  { v: "ENTREGADO", l: "Entregado" },
];

export function TituloEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["titulos", id, "editar"],
    queryFn: () => api<{ titulo: TituloDetalle }>(`/titulos/${id}`).then((r) => r.titulo),
  });

  const [nombreTitular, setNombreTitular] = useState("");
  const [telefonoTitular, setTelefonoTitular] = useState("");
  const [domicilioTitular, setDomicilioTitular] = useState("");
  const [coloniaTitular, setColoniaTitular] = useState("");
  const [numeroManzana, setNumeroManzana] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const [seccion, setSeccion] = useState("");
  const [colindanciaNorte, setColindanciaNorte] = useState("");
  const [colindanciaSur, setColindanciaSur] = useState("");
  const [colindanciaEste, setColindanciaEste] = useState("");
  const [colindanciaOeste, setColindanciaOeste] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [estado, setEstado] = useState("VIGENTE");
  const [estadoEntrega, setEstadoEntrega] = useState("PENDIENTE_ENTREGA");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const usaColindancias = data?.lote.numeroManzana === "S/N";

  useEffect(() => {
    if (!data || cargado) return;
    setNombreTitular(data.titular.nombreCompleto);
    setTelefonoTitular(data.titular.telefono ?? "");
    setDomicilioTitular(data.titular.domicilio ?? "");
    setColoniaTitular(data.titular.colonia ?? "");
    setNumeroManzana(data.lote.numeroManzana);
    setNumeroLote(data.lote.numeroLote);
    setSeccion(data.lote.seccion ?? "");
    setColindanciaNorte(data.lote.colindanciaNorte ?? "");
    setColindanciaSur(data.lote.colindanciaSur ?? "");
    setColindanciaEste(data.lote.colindanciaEste ?? "");
    setColindanciaOeste(data.lote.colindanciaOeste ?? "");
    setFechaEmision(data.fechaEmision?.slice(0, 10) ?? "");
    setEstado(data.estado);
    setEstadoEntrega(data.estadoEntrega);
    setFechaEntrega(data.fechaEntrega?.slice(0, 10) ?? "");
    setCargado(true);
  }, [data, cargado]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/titulos/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombreTitular,
          telefonoTitular: telefonoTitular || undefined,
          domicilioTitular: domicilioTitular || undefined,
          coloniaTitular: coloniaTitular || undefined,
          numeroManzana: numeroManzana || undefined,
          numeroLote: numeroLote || undefined,
          seccion: seccion || undefined,
          colindanciaNorte: colindanciaNorte || undefined,
          colindanciaSur: colindanciaSur || undefined,
          colindanciaEste: colindanciaEste || undefined,
          colindanciaOeste: colindanciaOeste || undefined,
          fechaEmision: fechaEmision || undefined,
          estado,
          estadoEntrega,
          fechaEntrega: fechaEntrega || undefined,
        }),
      });
      navigate("/titulos", { state: { exito: `Título ${data?.folio} actualizado correctamente.` } });
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
          Editar Título — {data.folio}
        </h2>
        <div className="page-header-acciones">
          <Link className="boton-secundario" to="/titulos">
            <i className="bi bi-arrow-left" /> Regresar
          </Link>
        </div>
      </div>

      {error && <p className="aviso-error" style={{ marginBottom: 16 }}>{error}</p>}

      <form onSubmit={onSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-person" /> Datos del Titular
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none" }}>
              <div className="form-campo span2">
                <label>Nombre completo *</label>
                <input value={nombreTitular} onChange={(e) => setNombreTitular(e.target.value)} required />
              </div>
              <div className="form-campo">
                <label>Teléfono</label>
                <input value={telefonoTitular} onChange={(e) => setTelefonoTitular(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Colonia</label>
                <input value={coloniaTitular} onChange={(e) => setColoniaTitular(e.target.value)} />
              </div>
              <div className="form-campo span2">
                <label>Domicilio</label>
                <input value={domicilioTitular} onChange={(e) => setDomicilioTitular(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-geo-alt" /> Datos del Lote
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none" }}>
              {usaColindancias ? (
                <>
                  <div className="form-campo">
                    <label>Colindancia norte</label>
                    <input value={colindanciaNorte} onChange={(e) => setColindanciaNorte(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Colindancia sur</label>
                    <input value={colindanciaSur} onChange={(e) => setColindanciaSur(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Colindancia este</label>
                    <input value={colindanciaEste} onChange={(e) => setColindanciaEste(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Colindancia oeste</label>
                    <input value={colindanciaOeste} onChange={(e) => setColindanciaOeste(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-campo">
                    <label>Manzana</label>
                    <input value={numeroManzana} onChange={(e) => setNumeroManzana(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Lote</label>
                    <input value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} />
                  </div>
                  <div className="form-campo">
                    <label>Sección</label>
                    <input value={seccion} onChange={(e) => setSeccion(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-award" /> Título de Propiedad
            </span>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: "none" }}>
              <div className="form-campo">
                <label>Folio</label>
                <input value={data.folio} readOnly disabled />
              </div>
              <div className="form-campo">
                <label>Fecha de emisión</label>
                <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
              </div>
              <div className="form-campo">
                <label>Estado del título</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Estado de entrega</label>
                <select value={estadoEntrega} onChange={(e) => setEstadoEntrega(e.target.value)}>
                  {ESTADOS_ENTREGA.map((e) => (
                    <option key={e.v} value={e.v}>
                      {e.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-campo">
                <label>Fecha de entrega</label>
                <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="boton-secundario" onClick={() => navigate("/titulos")}>
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
