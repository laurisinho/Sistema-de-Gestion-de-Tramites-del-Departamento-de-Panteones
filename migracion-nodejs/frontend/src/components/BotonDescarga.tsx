import { useState, type CSSProperties, type ReactNode } from "react";
import { descargarArchivo } from "../lib/api";

interface Props {
  ruta: string;
  className: string;
  icono: string;
  children?: ReactNode;
  style?: CSSProperties;
}

// Igual que BotonImprimir pero para reportes/exportes (Excel, PDFs de
// reportes) con ícono y texto propios de cada botón -- mismo problema de
// fondo: un <a href> a la API no puede llevar el header Authorization.
export function BotonDescarga({ ruta, className, icono, children, style }: Props) {
  const [generando, setGenerando] = useState(false);

  async function onClick() {
    setGenerando(true);
    try {
      await descargarArchivo(ruta);
    } catch {
      alert("No se pudo generar el archivo. Intenta de nuevo en unos segundos.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick} disabled={generando}>
      <i className={`bi ${generando ? "bi-hourglass-split" : icono}`} /> {children}
    </button>
  );
}
