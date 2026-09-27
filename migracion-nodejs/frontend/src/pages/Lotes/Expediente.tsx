import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, descargarArchivo } from "../../lib/api";
import { archivoADataUri, formatoBytes } from "../../lib/archivos";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmModal } from "../../components/ConfirmModal";
import { BotonImprimir } from "../../components/BotonImprimir";

interface EventoLote {
  fecha: string | null;
  tipo: string;
  titulo: string;
  detalle: string | null;
  folio: string | null;
  icono: string;
  color: string;
  enlace: string | null;
}

interface ExpedienteData {
  lote: {
    numeroManzana: string;
    numeroLote: string;
    estado: string;
    esFosaComun: boolean;
    claveLegado: string | null;
  };
  ubicacion: string;
  tituloVigente: { folio: string; titular: { nombreCompleto: string } } | null;
  eventos: EventoLote[];
  inhumaciones: number;
  exhumaciones: number;
  ocupantes: string[];
}

interface DocumentoLote {
  documentoId: number;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  fechaSubida: string;
  subioPor: string;
}

const ICONO_POR_MIME: Record<string, string> = {
  "application/pdf": "bi-file-earmark-pdf",
  "image/jpeg": "bi-file-earmark-image",
  "image/png": "bi-file-earmark-image",
};

function fmtFecha(f: string | null): string {
  if (!f) return "Sin fecha";
  return new Date(f).toLocaleDateString("es-MX", { timeZone: "UTC" });
}

function fmtFechaHora(f: string): string {
  return new Date(f).toLocaleString("es-MX");
}

function DocumentosLote({ loteId, puedeEscribir }: { loteId: string; puedeEscribir: boolean }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<DocumentoLote | null>(null);

  const { data: documentos } = useQuery({
    queryKey: ["lotes", loteId, "documentos"],
    queryFn: () => api<DocumentoLote[]>(`/lotes/${loteId}/documentos`),
  });

  const subir = useMutation({
    mutationFn: async (archivo: File) => {
      const dataUri = await archivoADataUri(archivo);
      return api(`/lotes/${loteId}/documentos`, { method: "POST", body: JSON.stringify({ nombreArchivo: archivo.name, dataUri }) });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["lotes", loteId, "documentos"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo subir el archivo"),
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const borrar = useMutation({
    mutationFn: (documentoId: number) => api(`/lotes/${loteId}/documentos/${documentoId}`, { method: "DELETE" }),
    onSuccess: () => {
      setPorBorrar(null);
      queryClient.invalidateQueries({ queryKey: ["lotes", loteId, "documentos"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el archivo"),
  });

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header-guinda">
        <span>
          <i className="bi bi-folder2-open" /> Documentos escaneados
        </span>
      </div>
      <div className="card-body">
        <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>
          Identificación, actas, comprobantes o cualquier papel del expediente físico. Solo PDF, JPG o PNG, hasta 10 MB.
        </p>

        {puedeEscribir && (
          <>
            <button type="button" className="boton-secundario boton-sm" onClick={() => inputRef.current?.click()} disabled={subir.isPending}>
              <i className="bi bi-upload" /> {subir.isPending ? "Subiendo..." : "Subir documento"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              style={{ display: "none" }}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) subir.mutate(archivo);
              }}
            />
          </>
        )}
        {error && (
          <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
            {error}
          </p>
        )}

        {!documentos || documentos.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Sin documentos subidos todavía.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {documentos.map((d, i) => (
              <li
                key={d.documentoId}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
              >
                <i className={`bi ${ICONO_POR_MIME[d.tipoMime] ?? "bi-file-earmark"}`} style={{ fontSize: 18, color: "var(--guinda)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombreArchivo}</div>
                  <small className="text-muted">
                    {formatoBytes(d.tamanioBytes)} · {fmtFechaHora(d.fechaSubida)} · {d.subioPor}
                  </small>
                </div>
                <BotonImprimir ruta={`/lotes/${loteId}/documentos/${d.documentoId}/descargar`} nombreArchivo={d.nombreArchivo} className="boton-secundario boton-sm" title="Ver documento">
                  {" "}Ver
                </BotonImprimir>
                {puedeEscribir && (
                  <button type="button" className="boton-peligro boton-sm" title="Eliminar documento" onClick={() => setPorBorrar(d)}>
                    <i className="bi bi-trash" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <ConfirmModal
          abierto={!!porBorrar}
          titulo="Eliminar documento"
          mensaje={
            <>
              ¿Eliminar <strong>{porBorrar?.nombreArchivo}</strong>?
            </>
          }
          nota="Esta acción no se puede deshacer."
          cargando={borrar.isPending}
          onCancelar={() => setPorBorrar(null)}
          onConfirmar={() => porBorrar && borrar.mutate(porBorrar.documentoId)}
        />
      </div>
    </div>
  );
}

export function LoteExpediente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const puedeEscribir = usuario?.rol !== "Consulta";
  const { data, isLoading, error } = useQuery({
    queryKey: ["lotes", id, "expediente"],
    queryFn: () => api<ExpedienteData>(`/lotes/${id}/expediente`),
  });

  if (isLoading) return <p>Cargando expediente...</p>;
  if (error || !data) return <p className="aviso-error">No se encontró el lote.</p>;

  const libre = data.lote.estado === "DISPONIBLE";
  let sinFechaMostrado = false;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-clock-history" />
          Expediente del lote
        </h2>
        <div className="page-header-acciones">
          <button type="button" className="boton-secundario" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left" /> Regresar
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <p className="exp-clave">{data.lote.claveLegado ?? `Mz ${data.lote.numeroManzana} · Lote ${data.lote.numeroLote}`}</p>
              <div className="exp-sub" style={{ marginTop: 4 }}>
                {data.ubicacion}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <span className={`badge ${libre ? "badge-success" : "badge-secondary"}`}>{data.lote.estado}</span>
                {data.lote.esFosaComun && <span className="badge badge-warning">Fosa común</span>}
                {data.tituloVigente && <span className="badge badge-info">Titular: {data.tituloVigente.titular.nombreCompleto}</span>}
              </div>
            </div>

            <div className="exp-stats">
              <div>
                <div className="exp-stat-n">{data.inhumaciones}</div>
                <div className="exp-stat-l">Inhumaciones</div>
              </div>
              <div>
                <div className="exp-stat-n">{data.exhumaciones}</div>
                <div className="exp-stat-l">Exhumaciones</div>
              </div>
              <div>
                <div className="exp-stat-n">{data.ocupantes.length}</div>
                <div className="exp-stat-l">Ocupantes hoy</div>
              </div>
            </div>
          </div>

          {data.ocupantes.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
              <div className="exp-sub">
                <i className="bi bi-person-fill" style={{ marginRight: 6 }} />
                {data.ocupantes.join(" · ")}
              </div>
            </>
          )}
        </div>
      </div>

      <DocumentosLote loteId={id!} puedeEscribir={puedeEscribir} />

      <div className="exp-titulo-seccion">
        Historial{" "}
        <span className="text-muted" style={{ fontWeight: 400 }}>
          — {data.eventos.length} movimiento(s)
        </span>
      </div>

      {data.eventos.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2.5rem 0" }}>
          <i className="bi bi-inbox" style={{ fontSize: 28 }} />
          <p>Este lote no tiene movimientos registrados</p>
        </div>
      ) : (
        <ul className="exp-tl">
          {data.eventos.map((e, i) => {
            const necesitaSeparador = e.fecha === null && !sinFechaMostrado;
            if (necesitaSeparador) sinFechaMostrado = true;
            const tituloTexto = (
              <>
                {e.titulo} <i className="bi bi-box-arrow-up-right text-muted" style={{ fontSize: 12 }} />
              </>
            );
            return (
              <li key={i}>
                {necesitaSeparador && <div className="exp-tl-sep">Sin fecha registrada</div>}
                <div className="exp-tl-item">
                  <div className={`exp-tl-dot c-${e.color}`}>
                    <i className={`bi ${e.icono}`} />
                  </div>
                  <div>
                    <span className="exp-tl-fecha">{fmtFecha(e.fecha)}</span>
                    <span className={`exp-tl-tipo t-${e.color}`}>{e.tipo}</span>
                  </div>
                  <div className="exp-tl-titulo">
                    {e.enlace?.endsWith("/pdf") ? (
                      <button
                        type="button"
                        onClick={() =>
                          descargarArchivo(e.enlace!, "documento", { verEnNavegador: true }).catch(() =>
                            alert("No se pudo generar el documento.")
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          font: "inherit",
                          cursor: "pointer",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {tituloTexto}
                      </button>
                    ) : e.enlace ? (
                      <Link to={e.enlace} style={{ textDecoration: "none", color: "inherit" }}>
                        {tituloTexto}
                      </Link>
                    ) : (
                      e.titulo
                    )}
                  </div>
                  {e.detalle && <div className="exp-tl-detalle">{e.detalle}</div>}
                  {e.folio && (
                    <div className="exp-tl-folio" style={{ marginTop: 4 }}>
                      {e.folio}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
