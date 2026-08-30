import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

interface UltimoPermiso {
  permisoId: number;
  folio: string;
  tipoTramite: { nombre: string };
  solicitante: { nombreCompleto: string };
  panteon: string | null;
  fechaSolicitud: string | null;
}

interface DashboardData {
  totalExpedientesVigentes: number;
  permisosEsteMes: number;
  titulosPendientesEntrega: number;
  totalFallecidos: number;
  sepMes: number;
  exhMes: number;
  cenMes: number;
  conMes: number;
  nombreMes: string;
  anioActual: number;
  ultimosPermisos: UltimoPermiso[];
  porPanteon: { nombre: string; titulosVigentes: number }[];
}

const ACCESOS = [
  { to: "/lotes", icono: "bi-clock-history", label: "Buscar lote / expediente" },
  { to: "/permisos/nuevo", icono: "bi-file-earmark-plus", label: "Nuevo permiso" },
  { to: "/titulos/nuevo", icono: "bi-award", label: "Nuevo título" },
  { to: "/cesiones/nueva", icono: "bi-arrow-left-right", label: "Nueva cesión" },
];

function Barra({ etiqueta, valor, max, color }: { etiqueta: string; valor: number; max: number; color: string }) {
  const pct = Math.max(4, (valor * 100) / Math.max(1, max));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ width: 36, fontSize: 12.5, fontWeight: 600, color: "var(--text-sub)" }}>{etiqueta}</span>
      <div style={{ flex: 1, height: 9, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
      </div>
      <span style={{ width: 24, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{valor}</span>
    </div>
  );
}

export function Dashboard() {
  const { usuario } = useAuth();
  const { data } = useQuery({
    queryKey: ["reportes", "dashboard"],
    queryFn: () => api<DashboardData>("/reportes/dashboard"),
  });

  const maxPerm = data ? Math.max(1, data.sepMes, data.exhMes, data.cenMes, data.conMes) : 1;
  const maxPanteon = data?.porPanteon[0]?.titulosVigentes ?? 1;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-speedometer2" />
          Panel Principal
        </h2>
        {data && (
          <span className="text-muted" style={{ fontSize: 13 }}>
            {data.nombreMes} {data.anioActual}
          </span>
        )}
      </div>

      {data && (
        <div className="tarjetas" style={{ marginBottom: 20 }}>
          <Link to="/titulos" className="tarjeta">
            <span className="tarjeta-icono">
              <i className="bi bi-folder2-open" />
            </span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{data.totalExpedientesVigentes.toLocaleString("es-MX")}</div>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Expedientes vigentes</div>
            </div>
          </Link>
          <Link to="/permisos" className="tarjeta">
            <span className="tarjeta-icono icon-blue">
              <i className="bi bi-file-earmark-check" />
            </span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{data.permisosEsteMes}</div>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Permisos — {data.nombreMes}</div>
            </div>
          </Link>
          <Link to="/titulos" className="tarjeta">
            <span className="tarjeta-icono icon-orange">
              <i className="bi bi-envelope-arrow-up" />
            </span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{data.titulosPendientesEntrega}</div>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Títulos por entregar</div>
            </div>
          </Link>
          <div className="tarjeta" style={{ cursor: "default" }}>
            <span className="tarjeta-icono">
              <i className="bi bi-flower1" />
            </span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{data.totalFallecidos.toLocaleString("es-MX")}</div>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Fallecidos registrados</div>
            </div>
          </div>
        </div>
      )}

      <div className="detalle-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header-guinda">
            <span>
              <i className="bi bi-clock-history" /> Últimos trámites registrados
            </span>
            <Link to="/permisos" className="badge badge-warning" style={{ textDecoration: "none" }}>
              Ver todos <i className="bi bi-arrow-right" />
            </Link>
          </div>
          <div className="card-body p-0">
            {data && data.ultimosPermisos.length > 0 ? (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Tipo</th>
                      <th>Solicitante</th>
                      <th>Panteón</th>
                      <th>Fecha</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ultimosPermisos.map((p) => (
                      <tr key={p.permisoId}>
                        <td>
                          <small className="text-muted font-monospace">{p.folio}</small>
                        </td>
                        <td>
                          <span className="badge badge-guinda">{p.tipoTramite.nombre}</span>
                        </td>
                        <td>{p.solicitante.nombreCompleto}</td>
                        <td>
                          <small className="text-muted">{p.panteon ?? "—"}</small>
                        </td>
                        <td>
                          <small>{p.fechaSolicitud ? new Date(p.fechaSolicitud).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—"}</small>
                        </td>
                        <td>
                          <Link to={`/permisos/${p.permisoId}`} className="boton boton-sm" title="Ver">
                            <i className="bi bi-eye" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2.5rem 0" }}>
                <i className="bi bi-inbox" style={{ fontSize: 28 }} />
                <p>Sin trámites registrados</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-bar-chart" /> Permisos de {data?.nombreMes ?? "este mes"}
              </span>
            </div>
            <div className="card-body">
              {data && data.permisosEsteMes === 0 ? (
                <p className="text-muted" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>Sin permisos este mes</p>
              ) : (
                data && (
                  <>
                    <Barra etiqueta="SEP" valor={data.sepMes} max={maxPerm} color="#a4222f" />
                    <Barra etiqueta="EXH" valor={data.exhMes} max={maxPerm} color="#7c3aed" />
                    <Barra etiqueta="CEN" valor={data.cenMes} max={maxPerm} color="#0b6e99" />
                    <Barra etiqueta="CON" valor={data.conMes} max={maxPerm} color="#157347" />
                    <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-muted" style={{ fontSize: 13 }}>Total</span>
                      <span style={{ fontWeight: 700, color: "var(--guinda)" }}>{data.permisosEsteMes}</span>
                    </div>
                  </>
                )
              )}
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-header-guinda">
              <span>
                <i className="bi bi-geo-alt" /> Expedientes por panteón
              </span>
            </div>
            <div className="card-body">
              {data && data.porPanteon.length === 0 && (
                <p className="text-muted" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>Sin datos</p>
              )}
              {data?.porPanteon.map((p) => (
                <div key={p.nombre} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                    <span>{p.nombre}</span>
                    <span style={{ fontWeight: 600 }}>{p.titulosVigentes}</span>
                  </div>
                  <div style={{ height: 9, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.max(4, (p.titulosVigentes * 100) / maxPanteon)}%`,
                        height: "100%",
                        borderRadius: 99,
                        background: "var(--guinda)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="text-muted" style={{ fontSize: 13 }}>Accesos rápidos:</span>
          {ACCESOS.map((a) => (
            <Link key={a.to} to={a.to} className={a.to === "/lotes" ? "boton-secundario" : "boton"} style={{ fontSize: 13 }}>
              <i className={`bi ${a.icono}`} /> {a.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: 13 }}>Bienvenido, {usuario?.nombreCompleto}.</p>
    </div>
  );
}
