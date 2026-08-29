import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, API_URL } from "../../lib/api";

interface Panteon {
  panteonId: number;
  nombre: string;
}

interface IncidenciaFila {
  incidenciaId: number;
  tipo: string;
  descripcion: string;
  fechaIncidencia: string;
  estado: string;
  reportadoPor: string | null;
  seccion: string | null;
  numeroManzana: string | null;
  numeroLote: string | null;
  panteon: { nombre: string };
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  REPORTADA: "Reportada",
  EN_PROCESO: "En proceso",
  ATENDIDA: "Atendida",
};

function ubicacionTexto(i: IncidenciaFila): string {
  const partes = [
    i.seccion ? `Secc. ${i.seccion}` : null,
    i.numeroManzana ? `Mz ${i.numeroManzana}` : null,
    i.numeroLote ? `Lote ${i.numeroLote}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Área general";
}

export function IncidenciasLista() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const exito = (location.state as { exito?: string } | null)?.exito;
  const [panteonId, setPanteonId] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });
  const { data: tipos } = useQuery({
    queryKey: ["catalogos", "tipos-incidencia"],
    queryFn: () => api<string[]>("/catalogos/tipos-incidencia"),
  });

  const { data } = useQuery({
    queryKey: ["incidencias", panteonId, estado, tipo, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (panteonId) params.set("panteonId", panteonId);
      if (estado) params.set("estado", estado);
      if (tipo) params.set("tipo", tipo);
      if (q) params.set("q", q);
      return api<{ lista: IncidenciaFila[]; reportadas: number; enProceso: number; atendidas: number }>(
        `/incidencias?${params}`
      );
    },
  });

  const atender = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api(`/incidencias/${id}/atender`, { method: "PATCH", body: JSON.stringify({ estado }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidencias"] }),
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => api(`/incidencias/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidencias"] }),
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-exclamation-triangle" />
          Incidencias en panteones
        </h2>
        <div className="page-header-acciones">
          <Link className="boton" to="/incidencias/nueva">
            <i className="bi bi-plus-circle" /> Reportar incidencia
          </Link>
        </div>
      </div>

      {exito && (
        <p className="aviso-exito" style={{ marginBottom: 16 }}>
          {exito}
        </p>
      )}

      {data && (
        <div className="tarjetas" style={{ marginBottom: 20 }}>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-flag" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.reportadas}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Reportadas</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-hourglass-split" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.enProceso}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>En proceso</div>
            </div>
          </div>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-check-circle" />
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.atendidas}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Atendidas</div>
            </div>
          </div>
        </div>
      )}

      <div className="barra-filtros">
        <select value={panteonId} onChange={(e) => setPanteonId(e.target.value)}>
          <option value="">Todos los panteones</option>
          {panteones?.map((p) => (
            <option key={p.panteonId} value={p.panteonId}>
              {p.nombre}
            </option>
          ))}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ETIQUETAS_ESTADO).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos?.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="barra-filtros">
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
        <a
          className="boton-secundario"
          href={`${API_URL}/incidencias/reporte?${new URLSearchParams({
            ...(panteonId ? { panteonId } : {}),
            ...(estado ? { estado } : {}),
            ...(tipo ? { tipo } : {}),
            ...(desde ? { desde } : {}),
            ...(hasta ? { hasta } : {}),
          })}`}
          target="_blank"
          rel="noreferrer"
        >
          <i className="bi bi-file-earmark-excel" /> Descargar reporte
        </a>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Incidencias
          </span>
        </div>
        <div className="card-body p-0">
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Panteón</th>
                    <th>Ubicación</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.lista.length === 0 && (
                    <tr>
                      <td colSpan={7}>Sin incidencias registradas.</td>
                    </tr>
                  )}
                  {data.lista.map((i) => (
                    <tr key={i.incidenciaId}>
                      <td>{new Date(i.fechaIncidencia).toLocaleDateString("es-MX", { timeZone: "UTC" })}</td>
                      <td>{i.panteon.nombre}</td>
                      <td className="tabla-col-ancha">{ubicacionTexto(i)}</td>
                      <td>{i.tipo}</td>
                      <td className="tabla-col-ancha" style={{ minWidth: 220 }}>{i.descripcion}</td>
                      <td>
                        <select
                          value={i.estado}
                          onChange={(e) => atender.mutate({ id: i.incidenciaId, estado: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: 12.5, borderRadius: 7 }}
                        >
                          {Object.entries(ETIQUETAS_ESTADO).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="tabla-acciones">
                          <Link to={`/incidencias/${i.incidenciaId}/editar`} className="boton-secundario boton-sm" title="Editar">
                            <i className="bi bi-pencil" />
                          </Link>
                          <button
                            className="boton-secundario boton-sm"
                            onClick={() => {
                              if (confirm("¿Eliminar esta incidencia?")) eliminar.mutate(i.incidenciaId);
                            }}
                            title="Eliminar"
                          >
                            <i className="bi bi-trash" />
                          </button>
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
