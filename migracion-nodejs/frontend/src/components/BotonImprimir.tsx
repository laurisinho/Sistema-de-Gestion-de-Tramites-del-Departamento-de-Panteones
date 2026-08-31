import { useState, type ReactNode } from "react";
import { descargarArchivo } from "../lib/api";

interface Props {
  ruta: string;
  nombreArchivo?: string;
  className: string;
  title?: string;
  children?: ReactNode;
}

// Reemplaza los <a href> directos a la API: esos no pueden llevar el header
// Authorization (solo lo hace una petición de JS), así que dependían de la
// cookie entre sitios distintos que varios navegadores bloquean.
export function BotonImprimir({ ruta, nombreArchivo, className, title, children }: Props) {
  const [generando, setGenerando] = useState(false);

  async function onClick() {
    setGenerando(true);
    try {
      await descargarArchivo(ruta, nombreArchivo, { verEnNavegador: true });
    } catch {
      alert("No se pudo generar el documento. Intenta de nuevo en unos segundos.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <button type="button" className={className} title={title} onClick={onClick} disabled={generando}>
      <i className={`bi ${generando ? "bi-hourglass-split" : "bi-printer"}`} />
      {children}
    </button>
  );
}
