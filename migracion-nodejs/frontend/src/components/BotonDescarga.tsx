import { useState, type CSSProperties, type ReactNode } from "react";
import { descargarArchivo } from "../lib/api";

interface Props {
  ruta: string;
  nombreArchivo: string;
  className: string;
  icono: string;
  children?: ReactNode;
  style?: CSSProperties;
  // Para reportes cuyos filtros aún están incompletos (p. ej. falta una de las
  // dos fechas de un rango): mejor no dejar pedir un archivo que saldría vacío.
  disabled?: boolean;
}

// Igual que BotonImprimir pero para reportes/exportes (Excel, PDFs de
// reportes) con ícono y texto propios de cada botón -- mismo problema de
// fondo: un <a href> a la API no puede llevar el header Authorization.
// nombreArchivo es obligatorio (y debe traer la extensión) porque el
// diálogo de "Guardar como" lo necesita desde antes de pedir el archivo
// real al servidor -- sin él, Windows no sabe qué tipo de archivo es.
export function BotonDescarga({ ruta, nombreArchivo, className, icono, children, style, disabled }: Props) {
  const [generando, setGenerando] = useState(false);

  async function onClick() {
    setGenerando(true);
    try {
      await descargarArchivo(ruta, nombreArchivo, { verEnNavegador: false });
    } catch {
      alert("No se pudo generar el archivo. Intenta de nuevo en unos segundos.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick} disabled={generando || disabled}>
      <i className={`bi ${generando ? "bi-hourglass-split" : icono}`} /> {children}
    </button>
  );
}
