import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { claseEstado } from "../../lib/badges";
import { ConfirmModal } from "../../components/ConfirmModal";
import { BotonImprimir } from "../../components/BotonImprimir";
import { useAuth } from "../../auth/AuthContext";

interface Panteon {
  panteonId: number;
  nombre: string;
}

interface PermisoFila {
  permisoId: number;
  folio: string;
  estado: string;
  fechaCreacion: string;
  tipoTramite: { nombre: string; clave: string };
  solicitante: { nombreCompleto: string };
  fallecido: { nombreCompleto: string } | null;
  lote: { numeroManzana: string; numeroLote: string; panteon: { nombre: string } } | null;
}

const TIPOS = [
  { clave: "SEP", nombre: "Sepultura" },
  { clave: "EXH", nombre: "Exhumación" },
  { clave: "CEN", nombre: "Depósito de cenizas" },
  { clave: "CON", nombre: "Construcción" },
];

export function PermisosLista() {
  const { usuario } = useAuth();
  const puedeEscribir = usuario?.rol !== "Consulta";
  const location = useLocation();
  const queryClient = useQueryClient();
  const exito = (location.state as { exito?: string } | null)?.exito;
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [panteonId, setPanteonId] = useState("");
  const [filtros, setFiltros] = useState({ q: "", tipo: "", panteonId: "" });
  const [aCancelar, setACancelar] = useState<PermisoFila | null>(null);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["permisos", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.tipo) params.set("tipo", filtros.tipo);
      if (filtros.panteonId) params.set("panteonId", filtros.panteonId);
      return api<{ permisos: PermisoFila[] }>(`/permisos?${params}`).then((r) => r.permisos);
    },
  });

  const cancelar = useMutation({
    mutationFn: (id: number) => api(`/permisos/${id}/cancelar`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permisos"] });
      setACancelar(null);
    },
    onError: (err) => setErrorCancelar(err instanceof ApiError ? err.message : "No se pudo cancelar"),
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-file-earmark-text" />
          Gestión de Permisos
        </h2>
        <div className="page-header-acciones">
          {puedeEscribir &&
            TIPOS.map((t) => (
              <Link key={t.clave} className="boton" to={`/permisos/nuevo?tipo=${t.clave}`}>
                <i className="bi bi-plus" /> {t.nombre}
              </Link>
            ))}
        </div>
      </div>

      {exito && <p className="aviso-exito">{exito}</p>}

      <div className="card">
        <div className="card-body">
          <form
            className="barra-filtros"
            style={{ marginBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros({ q, tipo, panteonId });
            }}
          >
            <input
              placeholder="Folio, solicitante o fallecido..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <select value={panteonId} onChange={(e) => setPanteonId(e.target.value)}>
              <option value="">Todos los panteones</option>
              {panteones?.map((p) => (
                <option key={p.panteonId} value={p.panteonId}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" /> {filtros.q || filtros.tipo || filtros.panteonId ? "Resultados" : "Últimos permisos"}
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
                    <th>Tipo</th>
                    <th>Solicitante</th>
                    <th>Difunto</th>
                    <th>Lote</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={8}>Sin permisos registrados.</td>
                    </tr>
                  )}
                  {data.map((p) => (
                    <tr key={p.permisoId}>
                      <td>
                        <small className="text-muted">{p.folio}</small>
                      </td>
                      <td>
                        <span className="badge badge-guinda">{p.tipoTramite.nombre}</span>
                      </td>
                      <td className="tabla-col-ancha">{p.solicitante.nombreCompleto}</td>
                      <td className="tabla-col-ancha">{p.fallecido?.nombreCompleto ?? "—"}</td>
                      <td className="tabla-col-ancha">{p.lote ? `${p.lote.panteon.nombre} · Mz ${p.lote.numeroManzana} L ${p.lote.numeroLote}` : "—"}</td>
                      <td>
                        <span className={claseEstado(p.estado)}>{p.estado}</span>
                      </td>
                      <td>{new Date(p.fechaCreacion).toLocaleDateString("es-MX")}</td>
                      <td>
                        <div className="tabla-acciones">
                          <BotonImprimir
                            ruta={`/permisos/${p.permisoId}/pdf`}
                            nombreArchivo={`permiso-${p.folio}.pdf`}
                            className="boton-secundario boton-sm"
                            title="Imprimir"
                          />
                          <Link to={`/permisos/${p.permisoId}`} className="boton boton-sm" title="Ver">
                            <i className="bi bi-eye" />
                          </Link>
                          {p.estado !== "CANCELADO" && puedeEscribir && (
                            <>
                              <Link to={`/permisos/${p.permisoId}/editar`} className="boton-secundario boton-sm" title="Editar">
                                <i className="bi bi-pencil" />
                              </Link>
                              <button
                                className="boton-peligro boton-sm"
                                title="Cancelar"
                                onClick={() => {
                                  setACancelar(p);
                                  setErrorCancelar(null);
                                }}
                              >
                                <i className="bi bi-x-circle" />
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

      <ConfirmModal
        abierto={!!aCancelar}
        titulo="Confirmar cancelación"
        mensaje={
          <>
            ¿Desea cancelar el permiso <strong>{aCancelar?.folio}</strong>?
          </>
        }
        nota="El registro se marcará como cancelado y no se elimina de la base de datos."
        error={errorCancelar}
        textoConfirmar="Sí, cancelar"
        iconoConfirmar="bi-x-circle"
        cargando={cancelar.isPending}
        onCancelar={() => {
          setACancelar(null);
          setErrorCancelar(null);
        }}
        onConfirmar={() => aCancelar && cancelar.mutate(aCancelar.permisoId)}
      />
    </div>
  );
}
