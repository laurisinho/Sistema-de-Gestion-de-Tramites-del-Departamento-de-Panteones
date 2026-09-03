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

interface TituloFila {
  tituloId: number;
  folio: string;
  estado: string;
  estadoEntrega: string;
  fechaEmision: string | null;
  titular: { nombreCompleto: string };
  lote: { numeroManzana: string; numeroLote: string; panteon: { nombre: string } };
}

const ESTADOS_ENTREGA = [
  { v: "PENDIENTE_ENTREGA", l: "Pendiente" },
  { v: "LLAMADA_REALIZADA", l: "Llamada realizada" },
  { v: "BUZON", l: "Buzón" },
  { v: "ENTREGADO", l: "Entregado" },
];

export function TitulosLista() {
  const { usuario } = useAuth();
  const puedeEscribir = usuario?.rol !== "Consulta";
  const location = useLocation();
  const queryClient = useQueryClient();
  const exito = (location.state as { exito?: string } | null)?.exito;
  const [q, setQ] = useState("");
  const [panteonId, setPanteonId] = useState("");
  const [seccion, setSeccion] = useState("");
  const [tipoBusqueda, setTipoBusqueda] = useState<"titular" | "fallecido">("titular");
  const [filtros, setFiltros] = useState({ q: "", panteonId: "", seccion: "", tipoBusqueda: "titular" });
  const [aCancelar, setACancelar] = useState<TituloFila | null>(null);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

  const { data: panteones } = useQuery({
    queryKey: ["catalogos", "panteones"],
    queryFn: () => api<{ panteones: Panteon[] }>("/catalogos/panteones").then((r) => r.panteones),
  });

  // Secciones del panteón elegido; sin panteón, las de todos.
  const { data: secciones } = useQuery({
    queryKey: ["catalogos", "secciones", panteonId],
    queryFn: () =>
      api<{ secciones: string[] }>(`/catalogos/secciones${panteonId ? `?panteonId=${panteonId}` : ""}`).then(
        (r) => r.secciones
      ),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["titulos", filtros],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.panteonId) params.set("panteonId", filtros.panteonId);
      if (filtros.seccion) params.set("seccion", filtros.seccion);
      if (filtros.tipoBusqueda === "fallecido") params.set("tipoBusqueda", "fallecido");
      return api<{ titulos: TituloFila[] }>(`/titulos?${params}`).then((r) => r.titulos);
    },
  });

  const cambiarEntrega = useMutation({
    mutationFn: ({ id, estadoEntrega }: { id: number; estadoEntrega: string }) =>
      api(`/titulos/${id}/entrega`, { method: "PATCH", body: JSON.stringify({ estadoEntrega }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["titulos"] }),
  });

  const cancelar = useMutation({
    mutationFn: (id: number) => api(`/titulos/${id}/cancelar`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titulos"] });
      setACancelar(null);
    },
    onError: (err) => setErrorCancelar(err instanceof ApiError ? err.message : "No se pudo cancelar"),
  });

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-award" />
          Títulos de Propiedad
        </h2>
        <div className="page-header-acciones">
          {puedeEscribir && (
            <Link className="boton" to="/titulos/nuevo">
              <i className="bi bi-plus-circle" /> Nuevo título
            </Link>
          )}
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
              setFiltros({ q, panteonId, seccion, tipoBusqueda });
            }}
          >
            <select value={tipoBusqueda} onChange={(e) => setTipoBusqueda(e.target.value as "titular" | "fallecido")}>
              <option value="titular">Por titular / folio / lote</option>
              <option value="fallecido">Por nombre del fallecido</option>
            </select>
            <input
              placeholder={tipoBusqueda === "fallecido" ? "Nombre del fallecido..." : "Folio, titular, manzana o lote..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <select
              value={panteonId}
              onChange={(e) => {
                setPanteonId(e.target.value);
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
            <button className="boton" type="submit">
              <i className="bi bi-search" /> Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-list-ul" />{" "}
            {filtros.q || filtros.panteonId || filtros.seccion ? "Resultados de la búsqueda" : "Últimos títulos"}
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
                    <th>Titular</th>
                    <th>Lote</th>
                    <th>Estado</th>
                    <th>Entrega</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={7}>Sin títulos registrados.</td>
                    </tr>
                  )}
                  {data.map((t) => (
                    <tr key={t.tituloId}>
                      <td>
                        <small className="text-muted">{t.folio}</small>
                      </td>
                      <td className="tabla-col-ancha">{t.titular.nombreCompleto}</td>
                      <td className="tabla-col-ancha">
                        {t.lote.numeroManzana === "S/N" ? "Colindancias" : `${t.lote.panteon.nombre} · Mz ${t.lote.numeroManzana} L ${t.lote.numeroLote}`}
                      </td>
                      <td>
                        <span className={claseEstado(t.estado)}>{t.estado}</span>
                      </td>
                      <td>
                        {t.estado === "CANCELADO" || !puedeEscribir ? (
                          <span className={claseEstado(t.estadoEntrega)}>{t.estadoEntrega.replaceAll("_", " ")}</span>
                        ) : (
                          <select
                            value={t.estadoEntrega}
                            onChange={(e) => cambiarEntrega.mutate({ id: t.tituloId, estadoEntrega: e.target.value })}
                            style={{ padding: "4px 8px", fontSize: 12.5, borderRadius: 7 }}
                          >
                            {ESTADOS_ENTREGA.map((e) => (
                              <option key={e.v} value={e.v}>
                                {e.l}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{t.fechaEmision ? new Date(t.fechaEmision).toLocaleDateString("es-MX") : "—"}</td>
                      <td>
                        <div className="tabla-acciones">
                          <BotonImprimir
                            ruta={`/titulos/${t.tituloId}/pdf`}
                            nombreArchivo={`titulo-${t.folio}.pdf`}
                            className="boton-secundario boton-sm"
                            title="Imprimir"
                          />
                          <Link to={`/titulos/${t.tituloId}`} className="boton boton-sm" title="Ver">
                            <i className="bi bi-eye" />
                          </Link>
                          {t.estado !== "CANCELADO" && puedeEscribir && (
                            <>
                              <Link to={`/titulos/${t.tituloId}/editar`} className="boton-secundario boton-sm" title="Editar">
                                <i className="bi bi-pencil" />
                              </Link>
                              <button
                                className="boton-peligro boton-sm"
                                title="Cancelar"
                                onClick={() => {
                                  setACancelar(t);
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
            ¿Desea cancelar el título <strong>{aCancelar?.folio}</strong>?
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
        onConfirmar={() => aCancelar && cancelar.mutate(aCancelar.tituloId)}
      />
    </div>
  );
}
