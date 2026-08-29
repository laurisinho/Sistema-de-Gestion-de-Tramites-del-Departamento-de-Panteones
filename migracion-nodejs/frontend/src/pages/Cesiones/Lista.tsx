import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, API_URL } from "../../lib/api";
import { claseEstado } from "../../lib/badges";

interface CesionFila {
  cesionId: number;
  folio: string;
  fechaCesion: string;
  estado: string;
  cedente: { nombreCompleto: string };
  cesionario: { nombreCompleto: string };
  lote: { numeroManzana: string; numeroLote: string; panteon: { nombre: string } };
}

export function CesionesLista() {
  const location = useLocation();
  const exito = (location.state as { exito?: string } | null)?.exito;

  const { data, isLoading } = useQuery({
    queryKey: ["cesiones"],
    queryFn: () => api<{ cesiones: CesionFila[] }>("/cesiones").then((r) => r.cesiones),
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-arrow-left-right" />
          Cesión de Derechos
        </h2>
        <div className="page-header-acciones">
          <Link className="boton" to="/cesiones/nueva">
            <i className="bi bi-plus-circle" /> Nueva cesión
          </Link>
        </div>
      </div>

      {exito && <p className="aviso-exito">{exito}</p>}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Últimas cesiones
          </span>
        </div>
        <div className="card-body p-0">
          {isLoading && <p style={{ padding: "1rem 1.2rem" }}>Cargando...</p>}
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cedente</th>
                    <th>Cesionario</th>
                    <th>Lote</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={7}>Sin cesiones registradas.</td>
                    </tr>
                  )}
                  {data.map((c) => (
                    <tr key={c.cesionId}>
                      <td>
                        <small className="text-muted">{c.folio}</small>
                      </td>
                      <td className="tabla-col-ancha">{c.cedente.nombreCompleto}</td>
                      <td className="tabla-col-ancha">{c.cesionario.nombreCompleto}</td>
                      <td className="tabla-col-ancha">
                        {c.lote.panteon.nombre} · Mz {c.lote.numeroManzana} L {c.lote.numeroLote}
                      </td>
                      <td>
                        <span className={claseEstado(c.estado)}>{c.estado}</span>
                      </td>
                      <td>{new Date(c.fechaCesion).toLocaleDateString("es-MX", { timeZone: "UTC" })}</td>
                      <td>
                        <div className="tabla-acciones">
                          <a
                            href={`${API_URL}/cesiones/${c.cesionId}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="boton-secundario boton-sm"
                            title="Imprimir"
                          >
                            <i className="bi bi-printer" />
                          </a>
                          {c.estado !== "CANCELADO" && (
                            <Link to={`/reimpresiones?tipo=CESION&id=${c.cesionId}`} className="boton-secundario boton-sm" title="Reimprimir con sello">
                              <i className="bi bi-printer-fill" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
