import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { ConfirmModal } from "../../components/ConfirmModal";

interface Panteon {
  panteonId: number;
  nombre: string;
  clave: string | null;
  usaColindancias: boolean;
  direccion: string | null;
  activo: boolean;
}

interface Seccion {
  seccionId: number;
  panteonId: number;
  nombre: string;
  activo: boolean;
  panteon: { nombre: string };
}

interface Agente {
  agenteId: number;
  nombre: string;
  activo: boolean;
}

export function AdministracionCatalogos() {
  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-collection" />
          Catálogos
        </h2>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Panteones, secciones y agentes del Ministerio Público que se ofrecen en el resto del sistema. Nada aquí se
        borra: solo se activa o desactiva.
      </p>

      <PanteonesCard />
      <SeccionesCard />
      <AgentesMpCard />
    </div>
  );
}

// ═══════════ PANTEONES ═══════════

function PanteonesCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["administracion", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/administracion/panteones").then((r) => r.panteones),
  });

  const [enEdicion, setEnEdicion] = useState<Panteon | "nuevo" | null>(null);
  const [aCambiarEstado, setACambiarEstado] = useState<Panteon | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ["administracion", "panteones"] });
    queryClient.invalidateQueries({ queryKey: ["catalogos", "panteones"] });
  }

  const cambiarEstado = useMutation({
    mutationFn: (p: Panteon) => api(`/administracion/panteones/${p.panteonId}/${p.activo ? "desactivar" : "activar"}`, { method: "POST" }),
    onSuccess: () => {
      invalidar();
      setACambiarEstado(null);
    },
    onError: (err) => setErrorEstado(err instanceof ApiError ? err.message : "No se pudo actualizar"),
  });

  return (
    <div className="card">
      <div className="card-header-guinda">
        <span>
          <i className="bi bi-geo-alt" /> Panteones
        </span>
        <button type="button" className="badge badge-warning" style={{ border: 0, cursor: "pointer" }} onClick={() => setEnEdicion("nuevo")}>
          <i className="bi bi-plus-circle" /> Nuevo panteón
        </button>
      </div>
      <div className="card-body p-0">
        {isLoading && <p style={{ padding: "1rem 1.2rem" }}>Cargando...</p>}
        {data && (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Clave</th>
                  <th>Usa colindancias</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6}>Sin panteones registrados.</td>
                  </tr>
                )}
                {data.map((p) => (
                  <tr key={p.panteonId}>
                    <td>{p.nombre}</td>
                    <td>
                      <small className="text-muted font-monospace">{p.clave ?? "—"}</small>
                    </td>
                    <td>{p.usaColindancias ? "Sí" : "No"}</td>
                    <td>
                      <small className="text-muted">{p.direccion ?? "—"}</small>
                    </td>
                    <td>
                      <span className={`badge ${p.activo ? "badge-success" : "badge-secondary"}`}>{p.activo ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td>
                      <div className="tabla-acciones">
                        <button className="boton-secundario boton-sm" title="Editar" onClick={() => setEnEdicion(p)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className={p.activo ? "boton-peligro boton-sm" : "boton-secundario boton-sm"}
                          title={p.activo ? "Desactivar" : "Activar"}
                          onClick={() => {
                            setACambiarEstado(p);
                            setErrorEstado(null);
                          }}
                        >
                          <i className={`bi ${p.activo ? "bi-slash-circle" : "bi-check-circle"}`} />
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

      {enEdicion && <PanteonModal panteon={enEdicion === "nuevo" ? null : enEdicion} onCerrar={() => setEnEdicion(null)} onGuardado={invalidar} />}

      <ConfirmModal
        abierto={!!aCambiarEstado}
        titulo={aCambiarEstado?.activo ? "Confirmar desactivación" : "Confirmar activación"}
        mensaje={
          <>
            ¿Desea {aCambiarEstado?.activo ? "desactivar" : "activar"} el panteón <strong>{aCambiarEstado?.nombre}</strong>?
          </>
        }
        nota={aCambiarEstado?.activo ? "Dejará de ofrecerse al capturar títulos, permisos o lotes nuevos." : undefined}
        error={errorEstado}
        textoConfirmar={aCambiarEstado?.activo ? "Sí, desactivar" : "Sí, activar"}
        iconoConfirmar={aCambiarEstado?.activo ? "bi-slash-circle" : "bi-check-circle"}
        cargando={cambiarEstado.isPending}
        onCancelar={() => {
          setACambiarEstado(null);
          setErrorEstado(null);
        }}
        onConfirmar={() => aCambiarEstado && cambiarEstado.mutate(aCambiarEstado)}
      />
    </div>
  );
}

function PanteonModal({ panteon, onCerrar, onGuardado }: { panteon: Panteon | null; onCerrar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(panteon?.nombre ?? "");
  const [clave, setClave] = useState(panteon?.clave ?? "");
  const [direccion, setDireccion] = useState(panteon?.direccion ?? "");
  const [usaColindancias, setUsaColindancias] = useState(panteon?.usaColindancias ?? false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const body = JSON.stringify({ nombre, clave: clave || undefined, direccion: direccion || undefined, usaColindancias });
      if (panteon) {
        await api(`/administracion/panteones/${panteon.panteonId}`, { method: "PUT", body });
      } else {
        await api("/administracion/panteones", { method: "POST", body });
      }
      onGuardado();
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3>
            <i className="bi bi-geo-alt" /> {panteon ? "Editar panteón" : "Nuevo panteón"}
          </h3>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-cuerpo">
            <div className="form-grid una-col">
              <div className="form-campo">
                <label>Nombre *</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required />
              </div>
              <div className="form-campo">
                <label>Clave</label>
                <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Ej: PC" maxLength={10} />
              </div>
              <div className="form-campo">
                <label>Dirección</label>
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </div>
              <div className="form-campo" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="usaColindancias"
                  checked={usaColindancias}
                  onChange={(e) => setUsaColindancias(e.target.checked)}
                />
                <label htmlFor="usaColindancias" style={{ margin: 0 }}>
                  No tiene manzana/lote formal: se ubica por colindancias
                </label>
              </div>
            </div>
            {error && (
              <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
                {error}
              </p>
            )}
          </div>
          <div className="modal-pie">
            <button type="button" className="boton-secundario" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="boton" disabled={enviando}>
              <i className="bi bi-check-circle" /> {enviando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════ SECCIONES ═══════════

function SeccionesCard() {
  const queryClient = useQueryClient();
  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });
  const [panteonId, setPanteonId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["administracion", "secciones", panteonId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (panteonId) params.set("panteonId", panteonId);
      return api<{ secciones: Seccion[] }>(`/administracion/secciones?${params}`).then((r) => r.secciones);
    },
  });

  const [nombreNueva, setNombreNueva] = useState("");
  const [panteonNueva, setPanteonNueva] = useState("");
  const [errorNueva, setErrorNueva] = useState<string | null>(null);
  const [editando, setEditando] = useState<Seccion | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [aCambiarEstado, setACambiarEstado] = useState<Seccion | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ["administracion", "secciones"] });
    queryClient.invalidateQueries({ queryKey: ["catalogos", "secciones"] });
  }

  const crear = useMutation({
    mutationFn: () => api("/administracion/secciones", { method: "POST", body: JSON.stringify({ panteonId: panteonNueva, nombre: nombreNueva }) }),
    onSuccess: () => {
      invalidar();
      setNombreNueva("");
      setErrorNueva(null);
    },
    onError: (err) => setErrorNueva(err instanceof ApiError ? err.message : "No se pudo crear"),
  });

  const renombrar = useMutation({
    mutationFn: () => api(`/administracion/secciones/${editando!.seccionId}`, { method: "PUT", body: JSON.stringify({ nombre: nombreEditado }) }),
    onSuccess: () => {
      invalidar();
      setEditando(null);
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: (s: Seccion) => api(`/administracion/secciones/${s.seccionId}/${s.activo ? "desactivar" : "activar"}`, { method: "POST" }),
    onSuccess: () => {
      invalidar();
      setACambiarEstado(null);
    },
    onError: (err) => setErrorEstado(err instanceof ApiError ? err.message : "No se pudo actualizar"),
  });

  return (
    <div className="card">
      <div className="card-header-guinda">
        <span>
          <i className="bi bi-map" /> Secciones
        </span>
      </div>
      <div className="card-body">
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Solo alimenta la lista al dar de alta un lote nuevo; no cambia nada de los lotes que ya existen.
        </p>

        <form
          className="barra-filtros"
          style={{ marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!panteonNueva || !nombreNueva.trim()) return;
            crear.mutate();
          }}
        >
          <select value={panteonNueva} onChange={(e) => setPanteonNueva(e.target.value)} required>
            <option value="">Panteón...</option>
            {panteones?.map((p) => (
              <option key={p.panteonId} value={p.panteonId}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} placeholder="Nombre de la sección" required />
          <button className="boton" type="submit" disabled={crear.isPending}>
            <i className="bi bi-plus-circle" /> Agregar
          </button>
        </form>
        {errorNueva && <p className="aviso-error">{errorNueva}</p>}

        <div className="form-campo" style={{ maxWidth: 280, marginBottom: 12 }}>
          <label>Filtrar por panteón</label>
          <select value={panteonId} onChange={(e) => setPanteonId(e.target.value)}>
            <option value="">Todos los panteones</option>
            {panteones?.map((p) => (
              <option key={p.panteonId} value={p.panteonId}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <p>Cargando...</p>}
        {data && (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Sección</th>
                  <th>Panteón</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4}>Sin secciones dadas de alta.</td>
                  </tr>
                )}
                {data.map((s) => (
                  <tr key={s.seccionId}>
                    <td>
                      {editando?.seccionId === s.seccionId ? (
                        <input
                          value={nombreEditado}
                          onChange={(e) => setNombreEditado(e.target.value)}
                          style={{ padding: "4px 8px" }}
                          autoFocus
                        />
                      ) : (
                        s.nombre
                      )}
                    </td>
                    <td>
                      <small className="text-muted">{s.panteon.nombre}</small>
                    </td>
                    <td>
                      <span className={`badge ${s.activo ? "badge-success" : "badge-secondary"}`}>{s.activo ? "Activa" : "Inactiva"}</span>
                    </td>
                    <td>
                      <div className="tabla-acciones">
                        {editando?.seccionId === s.seccionId ? (
                          <>
                            <button className="boton boton-sm" title="Guardar" onClick={() => renombrar.mutate()} disabled={renombrar.isPending}>
                              <i className="bi bi-check-lg" />
                            </button>
                            <button className="boton-secundario boton-sm" title="Cancelar" onClick={() => setEditando(null)}>
                              <i className="bi bi-x-lg" />
                            </button>
                          </>
                        ) : (
                          <button
                            className="boton-secundario boton-sm"
                            title="Renombrar"
                            onClick={() => {
                              setEditando(s);
                              setNombreEditado(s.nombre);
                            }}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                        )}
                        <button
                          className={s.activo ? "boton-peligro boton-sm" : "boton-secundario boton-sm"}
                          title={s.activo ? "Desactivar" : "Activar"}
                          onClick={() => {
                            setACambiarEstado(s);
                            setErrorEstado(null);
                          }}
                        >
                          <i className={`bi ${s.activo ? "bi-slash-circle" : "bi-check-circle"}`} />
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

      <ConfirmModal
        abierto={!!aCambiarEstado}
        titulo={aCambiarEstado?.activo ? "Confirmar desactivación" : "Confirmar activación"}
        mensaje={
          <>
            ¿Desea {aCambiarEstado?.activo ? "desactivar" : "activar"} la sección <strong>{aCambiarEstado?.nombre}</strong>?
          </>
        }
        error={errorEstado}
        textoConfirmar={aCambiarEstado?.activo ? "Sí, desactivar" : "Sí, activar"}
        iconoConfirmar={aCambiarEstado?.activo ? "bi-slash-circle" : "bi-check-circle"}
        cargando={cambiarEstado.isPending}
        onCancelar={() => {
          setACambiarEstado(null);
          setErrorEstado(null);
        }}
        onConfirmar={() => aCambiarEstado && cambiarEstado.mutate(aCambiarEstado)}
      />
    </div>
  );
}

// ═══════════ AGENTES DEL MINISTERIO PÚBLICO ═══════════

function AgentesMpCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["administracion", "agentes-mp"],
    queryFn: () => api<{ agentes: Agente[] }>("/administracion/agentes-mp").then((r) => r.agentes),
  });

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [editando, setEditando] = useState<Agente | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [aCambiarEstado, setACambiarEstado] = useState<Agente | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ["administracion", "agentes-mp"] });
    queryClient.invalidateQueries({ queryKey: ["no-reclamados", "ministerios-publicos"] });
  }

  const crear = useMutation({
    mutationFn: () => api("/administracion/agentes-mp", { method: "POST", body: JSON.stringify({ nombre: nombreNuevo }) }),
    onSuccess: () => {
      invalidar();
      setNombreNuevo("");
      setErrorNuevo(null);
    },
    onError: (err) => setErrorNuevo(err instanceof ApiError ? err.message : "No se pudo crear"),
  });

  const renombrar = useMutation({
    mutationFn: () => api(`/administracion/agentes-mp/${editando!.agenteId}`, { method: "PUT", body: JSON.stringify({ nombre: nombreEditado }) }),
    onSuccess: () => {
      invalidar();
      setEditando(null);
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: (a: Agente) => api(`/administracion/agentes-mp/${a.agenteId}/${a.activo ? "desactivar" : "activar"}`, { method: "POST" }),
    onSuccess: () => {
      invalidar();
      setACambiarEstado(null);
    },
    onError: (err) => setErrorEstado(err instanceof ApiError ? err.message : "No se pudo actualizar"),
  });

  return (
    <div className="card">
      <div className="card-header-guinda">
        <span>
          <i className="bi bi-person-badge" /> Agentes del Ministerio Público
        </span>
      </div>
      <div className="card-body">
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Se ofrecen al registrar o reconocer una persona no reclamada; si el agente no está en la lista, ese
          formulario deja capturarlo con "Otro".
        </p>

        <form
          className="barra-filtros"
          style={{ marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombreNuevo.trim()) return;
            crear.mutate();
          }}
        >
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="LIC. NOMBRE APELLIDO"
            style={{ minWidth: 280 }}
            required
          />
          <button className="boton" type="submit" disabled={crear.isPending}>
            <i className="bi bi-plus-circle" /> Agregar
          </button>
        </form>
        {errorNuevo && <p className="aviso-error">{errorNuevo}</p>}

        {isLoading && <p>Cargando...</p>}
        {data && (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3}>Sin agentes dados de alta.</td>
                  </tr>
                )}
                {data.map((a) => (
                  <tr key={a.agenteId}>
                    <td>
                      {editando?.agenteId === a.agenteId ? (
                        <input
                          value={nombreEditado}
                          onChange={(e) => setNombreEditado(e.target.value)}
                          style={{ padding: "4px 8px", minWidth: 260 }}
                          autoFocus
                        />
                      ) : (
                        a.nombre
                      )}
                    </td>
                    <td>
                      <span className={`badge ${a.activo ? "badge-success" : "badge-secondary"}`}>{a.activo ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td>
                      <div className="tabla-acciones">
                        {editando?.agenteId === a.agenteId ? (
                          <>
                            <button className="boton boton-sm" title="Guardar" onClick={() => renombrar.mutate()} disabled={renombrar.isPending}>
                              <i className="bi bi-check-lg" />
                            </button>
                            <button className="boton-secundario boton-sm" title="Cancelar" onClick={() => setEditando(null)}>
                              <i className="bi bi-x-lg" />
                            </button>
                          </>
                        ) : (
                          <button
                            className="boton-secundario boton-sm"
                            title="Renombrar"
                            onClick={() => {
                              setEditando(a);
                              setNombreEditado(a.nombre);
                            }}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                        )}
                        <button
                          className={a.activo ? "boton-peligro boton-sm" : "boton-secundario boton-sm"}
                          title={a.activo ? "Desactivar" : "Activar"}
                          onClick={() => {
                            setACambiarEstado(a);
                            setErrorEstado(null);
                          }}
                        >
                          <i className={`bi ${a.activo ? "bi-slash-circle" : "bi-check-circle"}`} />
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

      <ConfirmModal
        abierto={!!aCambiarEstado}
        titulo={aCambiarEstado?.activo ? "Confirmar desactivación" : "Confirmar activación"}
        mensaje={
          <>
            ¿Desea {aCambiarEstado?.activo ? "desactivar" : "activar"} a <strong>{aCambiarEstado?.nombre}</strong>?
          </>
        }
        error={errorEstado}
        textoConfirmar={aCambiarEstado?.activo ? "Sí, desactivar" : "Sí, activar"}
        iconoConfirmar={aCambiarEstado?.activo ? "bi-slash-circle" : "bi-check-circle"}
        cargando={cambiarEstado.isPending}
        onCancelar={() => {
          setACambiarEstado(null);
          setErrorEstado(null);
        }}
        onConfirmar={() => aCambiarEstado && cambiarEstado.mutate(aCambiarEstado)}
      />
    </div>
  );
}
