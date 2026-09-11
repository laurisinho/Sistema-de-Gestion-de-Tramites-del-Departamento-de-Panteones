import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { claseEstado } from "../../lib/badges";

interface Panteon {
  panteonId: number;
  nombre: string;
}

interface LoteResultado {
  loteId: number;
  panteon: string;
  seccion: string | null;
  numeroManzana: string;
  numeroLote: string;
  claveLegado: string | null;
  estado: string;
  esFosaComun: boolean;
  titular: string | null;
  permisosCount: number;
}

interface Filtros {
  manzana: string;
  lote: string;
  clave: string;
  seccion: string;
  panteonId: string;
}

export function LotesBuscar() {
  const [manzana, setManzana] = useState("");
  const [lote, setLote] = useState("");
  const [clave, setClave] = useState("");
  const [seccion, setSeccion] = useState("");
  const [panteonId, setPanteonId] = useState("");
  const [filtros, setFiltros] = useState<Filtros | null>(null);

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });

  // Secciones del panteón elegido; sin panteón, las de todos. Se muestran en
  // una lista porque cada panteón tiene las suyas y nadie las recuerda todas.
  const { data: secciones } = useQuery({
    queryKey: ["catalogos", "secciones", panteonId],
    queryFn: () =>
      api<{ secciones: string[] }>(`/catalogos/secciones${panteonId ? `?panteonId=${panteonId}` : ""}`).then(
        (r) => r.secciones
      ),
  });

  const { data: resultados, isFetching } = useQuery({
    queryKey: ["lotes", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros?.manzana) params.set("manzana", filtros.manzana);
      if (filtros?.lote) params.set("lote", filtros.lote);
      if (filtros?.clave) params.set("clave", filtros.clave);
      if (filtros?.seccion) params.set("seccion", filtros.seccion);
      if (filtros?.panteonId) params.set("panteonId", filtros.panteonId);
      return api<{ resultados: LoteResultado[] }>(`/lotes?${params}`).then((r) => r.resultados);
    },
    enabled: filtros !== null,
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-clock-history" />
          Expediente de lote
        </h2>
      </div>

      <div className="card">
        <div className="card-body">
          <p className="text-muted" style={{ marginTop: 0 }}>
            Son casi 7,000 lotes — elige una sección o captura manzana, lote o clave para buscar.
          </p>
          <form
            className="barra-filtros"
            style={{ marginBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros({ manzana, lote, clave, seccion, panteonId });
            }}
          >
            <select
              value={panteonId}
              onChange={(e) => {
                setPanteonId(e.target.value);
                // Las secciones cambian con el panteón: la que estaba elegida
                // puede no existir en el nuevo.
                setSeccion("");
              }}
            >
              <option value="">Todos los panteones</option>
              {panteones?.map((p) => (
                <option key={p.panteonId} value={p.panteonId}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
              <option value="">Todas las secciones</option>
              {secciones?.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input placeholder="Manzana" value={manzana} onChange={(e) => setManzana(e.target.value)} />
            <input placeholder="Lote" value={lote} onChange={(e) => setLote(e.target.value)} />
            <input placeholder="Clave" value={clave} onChange={(e) => setClave(e.target.value)} />
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Buscar
            </button>
          </form>
        </div>
      </div>

      {isFetching && <p>Buscando...</p>}

      {resultados && (
        <div className="card">
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-list-ul" /> Resultados
            </span>
          </div>
          <div className="card-body p-0">
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Panteón</th>
                    <th>Sección</th>
                    <th>Manzana</th>
                    <th>Lote</th>
                    <th>Clave</th>
                    <th>Estado</th>
                    <th>Titular</th>
                    <th>Permisos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.length === 0 && (
                    <tr>
                      <td colSpan={9}>Sin resultados.</td>
                    </tr>
                  )}
                  {resultados.map((l) => (
                    <tr key={l.loteId}>
                      <td>{l.panteon}</td>
                      <td>{l.seccion ?? "—"}</td>
                      <td>{l.numeroManzana}</td>
                      <td>{l.numeroLote}</td>
                      <td>
                        <small className="text-muted">{l.claveLegado ?? "—"}</small>
                      </td>
                      <td>
                        <span className={claseEstado(l.esFosaComun ? "FOSA_COMUN" : l.estado)}>
                          {l.esFosaComun ? "Fosa común" : l.estado}
                        </span>
                      </td>
                      <td>{l.titular ?? "Sin titular"}</td>
                      <td>{l.permisosCount}</td>
                      <td>
                        <Link to={`/lotes/${l.loteId}/expediente`} className="boton-secundario boton-sm" title="Ver expediente">
                          <i className="bi bi-eye" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
