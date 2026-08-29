import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError, API_URL } from "../../lib/api";

interface ReimpresionFila {
  reimpresionId: number;
  fechaReimpresion: string;
  motivo: string;
  usuario: { nombreCompleto: string };
  permiso: { folio: string } | null;
  titulo: { folio: string } | null;
  cesion: { folio: string } | null;
}

interface BusquedaResultado {
  tipo: "PERMISO" | "TITULO" | "CESION";
  id: number;
  folio: string;
  nombre: string;
  extra: string;
  estado: string;
}

const MOTIVOS_FRECUENTES = [
  "Documento extraviado",
  "Documento dañado",
  "Copia adicional para el interesado",
  "Corrección de datos",
  "Uso administrativo interno",
  "Solicitud de otra dependencia",
];

export function ReimpresionesLista() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tipoUrl = searchParams.get("tipo");
  const idUrl = searchParams.get("id");

  const [termino, setTermino] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<BusquedaResultado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["reimpresiones"],
    queryFn: () => api<{ lista: ReimpresionFila[] }>("/reimpresiones").then((r) => r.lista),
  });

  // Precarga la selección cuando se llega desde el botón "Reimprimir con
  // sello" de otra pantalla (?tipo=&id=), sin obligar a buscar de nuevo.
  const { data: preseleccion } = useQuery({
    queryKey: ["reimpresiones", "documento", tipoUrl, idUrl],
    queryFn: () => api<BusquedaResultado>(`/reimpresiones/documento?tipo=${tipoUrl}&id=${idUrl}`),
    enabled: !!tipoUrl && !!idUrl,
  });

  useEffect(() => {
    if (preseleccion) {
      setSeleccion(preseleccion);
      setSearchParams({}, { replace: true });
    }
  }, [preseleccion, setSearchParams]);

  const { data: resultados } = useQuery({
    queryKey: ["reimpresiones", "buscar", busqueda],
    queryFn: () => api<BusquedaResultado[]>(`/reimpresiones/buscar?termino=${encodeURIComponent(busqueda)}`),
    enabled: busqueda.length > 1,
  });

  async function reimprimir() {
    if (!seleccion) return;
    setError(null);
    setExito(null);
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/reimpresiones`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: seleccion.tipo, id: seleccion.id, motivo: motivo || undefined }),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new ApiError(res.status, cuerpo?.error ?? "No se pudo reimprimir");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setExito(`Reimpresión de ${seleccion.folio} generada correctamente.`);
      setSeleccion(null);
      setMotivo("");
      setTermino("");
      setBusqueda("");
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-printer" />
          Reimpresiones
        </h2>
      </div>

      {exito && <p className="aviso-exito">{exito}</p>}

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-search" /> Buscar documento
          </span>
        </div>
        <div className="card-body">
          {seleccion ? (
            <div className="aviso-exito" style={{ marginBottom: 16 }}>
              <strong>
                {seleccion.tipo} {seleccion.folio}
              </strong>{" "}
              — {seleccion.nombre} ({seleccion.extra}) — estado: {seleccion.estado}{" "}
              <button type="button" className="boton-secundario" onClick={() => setSeleccion(null)}>
                Quitar
              </button>
            </div>
          ) : (
            <>
              <div className="barra-filtros" style={{ marginBottom: resultados?.length ? 16 : 0 }}>
                <input
                  placeholder="Folio o nombre..."
                  value={termino}
                  onChange={(e) => setTermino(e.target.value)}
                  style={{ minWidth: 300 }}
                />
                <button type="button" className="boton-secundario" onClick={() => setBusqueda(termino)}>
                  <i className="bi bi-search" /> Buscar
                </button>
              </div>

              {resultados && resultados.length > 0 && (
                <div className="tabla-contenedor">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Folio</th>
                        <th>Nombre</th>
                        <th>Detalle</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((r) => (
                        <tr key={`${r.tipo}-${r.id}`}>
                          <td>
                            <span className="badge badge-guinda">{r.tipo}</span>
                          </td>
                          <td>{r.folio}</td>
                          <td>{r.nombre}</td>
                          <td>{r.extra}</td>
                          <td>{r.estado}</td>
                          <td>
                            <button type="button" className="boton-secundario boton-sm" onClick={() => setSeleccion(r)}>
                              Usar este
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {seleccion && (
            <div className="form-grid una-col" style={{ marginBottom: 16, maxWidth: 480 }}>
              <div className="form-campo">
                <label>Motivo de la reimpresión</label>
                <select
                  value={MOTIVOS_FRECUENTES.includes(motivo) || motivo === "" ? motivo : "__otro__"}
                  onChange={(e) => setMotivo(e.target.value === "__otro__" ? " " : e.target.value)}
                >
                  <option value="">Selecciona...</option>
                  {MOTIVOS_FRECUENTES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__otro__">Otro (escribir abajo)</option>
                </select>
                {!MOTIVOS_FRECUENTES.includes(motivo) && motivo !== "" && (
                  <input
                    value={motivo.trim()}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Describe el motivo"
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
            </div>
          )}

          {error && <p className="aviso-error">{error}</p>}

          {seleccion && (
            <button className="boton" onClick={reimprimir} disabled={enviando}>
              <i className="bi bi-printer" /> {enviando ? "Generando..." : "Reimprimir"}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-clock-history" /> Historial
          </span>
        </div>
        <div className="card-body p-0">
          {data && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Documento</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={4}>Sin reimpresiones registradas.</td>
                    </tr>
                  )}
                  {data.map((r) => (
                    <tr key={r.reimpresionId}>
                      <td>{new Date(r.fechaReimpresion).toLocaleString("es-MX")}</td>
                      <td>{r.permiso?.folio ?? r.titulo?.folio ?? r.cesion?.folio ?? "—"}</td>
                      <td>{r.motivo}</td>
                      <td>{r.usuario.nombreCompleto}</td>
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
