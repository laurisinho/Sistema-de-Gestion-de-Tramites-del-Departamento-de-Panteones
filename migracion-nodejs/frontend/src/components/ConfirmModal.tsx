import type { ReactNode } from "react";

interface ConfirmModalProps {
  abierto: boolean;
  titulo: string;
  mensaje: ReactNode;
  nota?: string;
  error?: string | null;
  textoConfirmar?: string;
  iconoConfirmar?: string;
  cargando?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  nota,
  error,
  textoConfirmar = "Sí, continuar",
  iconoConfirmar = "bi-trash",
  cargando = false,
  onCancelar,
  onConfirmar,
}: ConfirmModalProps) {
  if (!abierto) return null;

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3>
            <i className="bi bi-exclamation-triangle" /> {titulo}
          </h3>
          <button type="button" className="modal-cerrar" onClick={onCancelar} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="modal-cuerpo">
          <p style={{ margin: 0 }}>{mensaje}</p>
          {nota && (
            <p className="text-muted" style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              {nota}
            </p>
          )}
          {error && (
            <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>
        <div className="modal-pie">
          <button type="button" className="boton-secundario" onClick={onCancelar} disabled={cargando}>
            No, regresar
          </button>
          <button type="button" className="boton-peligro-solido" onClick={onConfirmar} disabled={cargando}>
            <i className={`bi ${iconoConfirmar}`} /> {cargando ? "Procesando..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
