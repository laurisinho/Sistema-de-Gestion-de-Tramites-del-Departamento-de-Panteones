import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface Registro {
  bitacoraId: string;
  accion: string;
  tabla: string | null;
  registroId: number | null;
  descripcion: string | null;
  ipAcceso: string | null;
  fechaHora: string;
  usuario: { nombreCompleto: string } | null;
}

interface BitacoraData {
  registros: Registro[];
  estadisticas: { total: number; hoy: number; semana: number; usuarios: number };
  grafica: { etiqueta: string; valor: number }[];
  acciones: string[];
  listaUsuarios: { usuarioId: number; nombreCompleto: string }[];
}

const ICONO_ACCION: Record<string, { icono: string; color: string }> = {
  LOGIN: { icono: "bi-box-arrow-in-right", color: "#157347" },
  LOGOUT: { icono: "bi-box-arrow-right", color: "#6c6168" },
  CREAR: { icono: "bi-plus-circle", color: "#2f5cc4" },
  EDITAR: { icono: "bi-pencil", color: "#2f5cc4" },
  CANCELAR: { icono: "bi-x-circle", color: "#b02a37" },
  ELIMINAR: { icono: "bi-trash", color: "#b02a37" },
  IMPRIMIR: { icono: "bi-printer", color: "#7c3aed" },
  REIMPRIMIR: { icono: "bi-printer-fill", color: "#e67e00" },
  CEDER: { icono: "bi-arrow-left-right", color: "#e67e00" },
  ENTREGA: { icono: "bi-box-arrow-up", color: "#0da294" },
  RECONOCER: { icono: "bi-person-check", color: "#157347" },
  LIBERAR: { icono: "bi-unlock", color: "#0da294" },
};

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

function tiempoRelativo(fechaISO: string): string {
  const f = new Date(fechaISO);
  const segundos = (Date.now() - f.getTime()) / 1000;
  if (segundos < 60) return "hace un momento";
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  const dias = Math.floor(segundos / 86400);
  if (dias <= 7) return `hace ${dias} d`;
  return f.toLocaleDateString("es-MX");
}

export function BitacoraLista() {
  const [q, setQ] = useState("");
  const [accion, setAccion] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtros, setFiltros] = useState({ q: "", accion: "", usuarioId: "", desde: "", hasta: "" });

  const { data } = useQuery({
    queryKey: ["bitacora", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.accion) params.set("accion", filtros.accion);
      if (filtros.usuarioId) params.set("usuarioId", filtros.usuarioId);
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      return api<BitacoraData>(`/bitacora?${params}`);
    },
  });

  const maxGrafica = data ? Math.max(1, ...data.grafica.map((g) => g.valor)) : 1;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-journal-text" />
          Bitácora
        </h2>
      </div>

      {data && (
        <>
          <div className="tarjetas" style={{ marginBottom: 20 }}>
            <div className="tarjeta" style={{ cursor: "default" }}>
              <span className="tarjeta-icono">
                <i className="bi bi-activity" />
              </span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{data.estadisticas.total}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Eventos totales</div>
              </div>
            </div>
            <div className="tarjeta" style={{ cursor: "default" }}>
              <span className="tarjeta-icono">
                <i className="bi bi-calendar-day" />
              </span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{data.estadisticas.hoy}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Hoy</div>
              </div>
            </div>
            <div className="tarjeta" style={{ cursor: "default" }}>
              <span className="tarjeta-icono">
                <i className="bi bi-calendar-week" />
              </span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{data.estadisticas.semana}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Últimos 7 días</div>
              </div>
            </div>
            <div className="tarjeta" style={{ cursor: "default" }}>
              <span className="tarjeta-icono">
                <i className="bi bi-people" />
              </span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{data.estadisticas.usuarios}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Usuarios activos</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-bar-chart" /> Actividad — últimos 14 días
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
                {data.grafica.map((g) => (
                  <div key={g.etiqueta} title={`${g.etiqueta}: ${g.valor}`} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        background: "linear-gradient(180deg, var(--guinda-light), var(--guinda))",
                        height: `${(g.valor / maxGrafica) * 44 + 2}px`,
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{g.etiqueta}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-funnel" /> Filtros
          </span>
        </div>
        <div className="card-body">
          <form
            className="barra-filtros"
            style={{ marginBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros({ q, accion, usuarioId, desde, hasta });
            }}
          >
            <input placeholder="Buscar en descripción o tabla..." value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
            <select value={accion} onChange={(e) => setAccion(e.target.value)}>
              <option value="">Todas las acciones</option>
              {data?.acciones.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              <option value="">Todos los usuarios</option>
              {data?.listaUsuarios.map((u) => (
                <option key={u.usuarioId} value={u.usuarioId}>
                  {u.nombreCompleto}
                </option>
              ))}
            </select>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
            <button className="boton" type="submit">
              <i className="bi bi-funnel" /> Filtrar
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> Registros
          </span>
          <span className="badge badge-warning">{data?.registros.length ?? 0} evento(s)</span>
        </div>
        <div className="card-body">
          <ul className="tl">
            {data?.registros.length === 0 && <li>Sin registros para este filtro.</li>}
            {data?.registros.map((r) => {
              const meta = ICONO_ACCION[r.accion] ?? { icono: "bi-circle", color: "#9b9298" };
              return (
                <li className="tl-item" key={r.bitacoraId} style={{ alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: `${meta.color}1a`,
                      color: meta.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 15,
                    }}
                    title={new Date(r.fechaHora).toLocaleString("es-MX")}
                  >
                    <i className={`bi ${meta.icono}`} />
                  </div>
                  <div className="tl-cuerpo">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-guinda">{r.accion}</span>
                      <span className="tl-titulo">{r.descripcion ?? r.tabla ?? "—"}</span>
                      <span className="text-muted" style={{ fontSize: 12, marginLeft: "auto" }} title={new Date(r.fechaHora).toLocaleString("es-MX")}>
                        {tiempoRelativo(r.fechaHora)}
                      </span>
                    </div>
                    <div className="tl-detalle" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                      <span>
                        <span
                          style={{
                            display: "inline-flex",
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "var(--guinda-50)",
                            color: "var(--guinda)",
                            fontSize: 9,
                            fontWeight: 700,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 4,
                          }}
                        >
                          {r.usuario ? iniciales(r.usuario.nombreCompleto) : "?"}
                        </span>
                        {r.usuario?.nombreCompleto ?? "Sistema"}
                      </span>
                      {r.tabla && (
                        <span>
                          {r.tabla}
                          {r.registroId != null ? ` #${r.registroId}` : ""}
                        </span>
                      )}
                      {r.ipAcceso && <span>IP: {r.ipAcceso}</span>}
                      <span>{new Date(r.fechaHora).toLocaleString("es-MX")}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
