import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { ConfirmModal } from "../../components/ConfirmModal";
import { BotonDescarga } from "../../components/BotonDescarga";
import { useAuth } from "../../auth/AuthContext";

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

const CLASE_ESTADO: Record<string, string> = {
  REPORTADA: "badge-danger",
  EN_PROCESO: "badge-warning",
  ATENDIDA: "badge-success",
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
  const { usuario } = useAuth();
  const puedeEscribir = usuario?.rol !== "Consulta";
  const queryClient = useQueryClient();
  const location = useLocation();
  const exito = (location.state as { exito?: string } | null)?.exito;

  const [panteonId, setPanteonId] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({ panteonId: "", estado: "", tipo: "", q: "" });

  const [aAtender, setAAtender] = useState<IncidenciaFila | null>(null);
  const [estadoAtender, setEstadoAtender] = useState("EN_PROCESO");
  const [atendidoPor, setAtendidoPor] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [aEliminar, setAEliminar] = useState<IncidenciaFila | null>(null);
  const [errorAtender, setErrorAtender] = useState<string | null>(null);

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });
  const { data: tipos } = useQuery({
    queryKey: ["catalogos", "tipos-incidencia"],
    queryFn: () => api<string[]>("/catalogos/tipos-incidencia"),
  });

  const { data } = useQuery({
    queryKey: ["incidencias", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros.panteonId) params.set("panteonId", filtros.panteonId);
      if (filtros.estado) params.set("estado", filtros.estado);
      if (filtros.tipo) params.set("tipo", filtros.tipo);
      if (filtros.q) params.set("q", filtros.q);
      return api<{ lista: IncidenciaFila[]; reportadas: number; enProceso: number; atendidas: number }>(
        `/incidencias?${params}`
      );
    },
  });

  const paramsExcel = new URLSearchParams({
    ...(filtros.panteonId ? { panteonId: filtros.panteonId } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
  });

  const atender = useMutation({
    mutationFn: () =>
      api(`/incidencias/${aAtender!.incidenciaId}/atender`, {
        method: "PATCH",
        body: JSON.stringify({ estado: estadoAtender, atendidoPor: atendidoPor || undefined, resolucion: resolucion || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidencias"] });
      setAAtender(null);
      setAtendidoPor("");
      setResolucion("");
      setErrorAtender(null);
    },
    onError: (err) => setErrorAtender(err instanceof ApiError ? err.message : "No se pudo actualizar"),
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => api(`/incidencias/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidencias"] });
      setAEliminar(null);
    },
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-exclamation-triangle" />
          Incidencias en panteones
        </h2>
        <div className="page-header-acciones">
          <BotonDescarga ruta={`/incidencias/reporte?${paramsExcel}`} nombreArchivo="incidencias.xlsx" className="boton-secundario" icono="bi-file-earmark-excel">
            Exportar a Excel
          </BotonDescarga>
          {puedeEscribir && (
            <Link className="boton" to="/incidencias/nueva">
              <i className="bi bi-plus-circle" /> Nueva incidencia
            </Link>
          )}
        </div>
      </div>

      {exito && (
        <p className="aviso-exito" style={{ marginBottom: 16 }}>
          {exito}
        </p>
      )}

      {data && (
        <div className="detalle-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#b02a37" }}>{data.reportadas}</div>
              <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>Reportadas</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#8a6207" }}>{data.enProceso}</div>
              <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>En proceso</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#157347" }}>{data.atendidas}</div>
              <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>Atendidas</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <form
            className="form-grid"
            style={{ gridTemplateColumns: "repeat(4, 1fr)", maxWidth: "none", alignItems: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros({ panteonId, estado, tipo, q });
            }}
          >
            <div className="form-campo">
              <label>Panteón</label>
              <select value={panteonId} onChange={(e) => setPanteonId(e.target.value)}>
                <option value="">Todos</option>
                {panteones?.map((p) => (
                  <option key={p.panteonId} value={p.panteonId}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-campo">
              <label>Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(ETIQUETAS_ESTADO).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-campo">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Todos</option>
                {tipos?.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-campo" style={{ flexDirection: "row", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Buscar</label>
                <input placeholder="Texto..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="boton" type="submit">
                <i className="bi bi-funnel" /> Filtrar
              </button>
            </div>
          </form>
        </div>
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
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Panteón</th>
                    <th>Tipo</th>
                    <th>Ubicación</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.lista.length === 0 && (
                    <tr>
                      <td colSpan={8}>Sin incidencias registradas.</td>
                    </tr>
                  )}
                  {data.lista.map((i) => (
                    <tr key={i.incidenciaId}>
                      <td style={{ fontWeight: 600 }}>{i.incidenciaId}</td>
                      <td>
                        <small>{new Date(i.fechaIncidencia).toLocaleDateString("es-MX", { timeZone: "UTC" })}</small>
                      </td>
                      <td>
                        <small>{i.panteon.nombre}</small>
                      </td>
                      <td>
                        <small>{i.tipo}</small>
                      </td>
                      <td className="tabla-col-ancha">
                        <small className="text-muted">{ubicacionTexto(i)}</small>
                      </td>
                      <td className="tabla-col-ancha" style={{ minWidth: 220 }}>
                        <small>{i.descripcion}</small>
                      </td>
                      <td>
                        <span className={`badge ${CLASE_ESTADO[i.estado] ?? "badge-secondary"}`}>{ETIQUETAS_ESTADO[i.estado] ?? i.estado}</span>
                      </td>
                      <td>
                        <div className="tabla-acciones">
                          {puedeEscribir && (
                            <>
                              {i.estado !== "ATENDIDA" && (
                                <button
                                  className="boton-secundario boton-sm"
                                  title="Atender"
                                  onClick={() => {
                                    setEstadoAtender(i.estado === "EN_PROCESO" ? "ATENDIDA" : "EN_PROCESO");
                                    setAtendidoPor("");
                                    setResolucion("");
                                    setErrorAtender(null);
                                    setAAtender(i);
                                  }}
                                >
                                  <i className="bi bi-check2-square" />
                                </button>
                              )}
                              <Link to={`/incidencias/${i.incidenciaId}/editar`} className="boton-secundario boton-sm" title="Editar">
                                <i className="bi bi-pencil" />
                              </Link>
                              <button className="boton-peligro boton-sm" onClick={() => setAEliminar(i)} title="Eliminar">
                                <i className="bi bi-trash" />
                              </button>
                            </>
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

      {aAtender && (
        <div className="modal-overlay" onClick={() => setAAtender(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <h3>
                <i className="bi bi-check2-square" /> Atender incidencia
              </h3>
              <button type="button" className="modal-cerrar" onClick={() => setAAtender(null)} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="modal-cuerpo">
              <div className="form-grid una-col">
                <div className="form-campo">
                  <label>Estado</label>
                  <select value={estadoAtender} onChange={(e) => setEstadoAtender(e.target.value)}>
                    <option value="EN_PROCESO">En proceso</option>
                    <option value="ATENDIDA">Atendida</option>
                  </select>
                </div>
                <div className="form-campo">
                  <label>Atendido por</label>
                  <input value={atendidoPor} onChange={(e) => setAtendidoPor(e.target.value)} placeholder="Nombre de quien atiende" />
                </div>
                <div className="form-campo">
                  <label>Resolución</label>
                  <textarea
                    value={resolucion}
                    onChange={(e) => setResolucion(e.target.value)}
                    placeholder="Qué se hizo para resolverla"
                    rows={3}
                    style={{
                      padding: "0.48rem 0.8rem",
                      border: "1px solid var(--input-border)",
                      borderRadius: 9,
                      fontSize: 13.5,
                      background: "var(--input-bg)",
                      color: "var(--text-base)",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
              {errorAtender && (
                <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
                  {errorAtender}
                </p>
              )}
            </div>
            <div className="modal-pie">
              <button
                type="button"
                className="boton-secundario"
                onClick={() => {
                  setAAtender(null);
                  setErrorAtender(null);
                }}
                disabled={atender.isPending}
              >
                Cancelar
              </button>
              <button type="button" className="boton" onClick={() => atender.mutate()} disabled={atender.isPending}>
                <i className="bi bi-check-circle" /> {atender.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        abierto={!!aEliminar}
        titulo="Confirmar eliminación"
        mensaje={
          <>
            ¿Eliminar la incidencia <strong>#{aEliminar?.incidenciaId}</strong>?
          </>
        }
        nota="Esta acción no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        iconoConfirmar="bi-trash"
        cargando={eliminar.isPending}
        onCancelar={() => setAEliminar(null)}
        onConfirmar={() => aEliminar && eliminar.mutate(aEliminar.incidenciaId)}
      />
    </div>
  );
}
