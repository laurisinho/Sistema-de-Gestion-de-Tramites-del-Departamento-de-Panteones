import { esc } from "../lib/html";

const GUINDA = "#6B1229";

// Medidas de la pestaña angosta que usa hoy el departamento en sus folders
// (~9 x 1.3 cm). Si el tamaño real resulta distinto, solo hay que tocar estas
// cuatro constantes: columnas, filas y el total por hoja se recalculan solos.
const PAGINA_ANCHO_CM = 21.59; // Carta/Letter
const PAGINA_ALTO_CM = 27.94;
const MARGEN_CM = 1; // margen de seguridad: casi ninguna impresora llega al borde
const ETIQUETA_ANCHO_CM = 9;
const ETIQUETA_ALTO_CM = 1.3;
const ESPACIO_CM = 0.2; // separación entre etiquetas, para poder recortar con tijeras

const COLUMNAS = Math.floor((PAGINA_ANCHO_CM - 2 * MARGEN_CM + ESPACIO_CM) / (ETIQUETA_ANCHO_CM + ESPACIO_CM));
const FILAS = Math.floor((PAGINA_ALTO_CM - 2 * MARGEN_CM + ESPACIO_CM) / (ETIQUETA_ALTO_CM + ESPACIO_CM));

// Cuántas etiquetas caben en una sola hoja con las medidas de arriba.
export const ETIQUETAS_POR_HOJA = COLUMNAS * FILAS;

export interface EtiquetaLote {
  /** Clave del lote (claveLegado), no el folio del título: el lote es la
   * carpeta física y no cambia aunque el título se ceda a otro dueño. */
  clave: string;
  titular: string;
}

function celda(e: EtiquetaLote): string {
  return `
    <div class="etq">
      <div class="clave">${esc(e.clave)}</div>
      <div class="titular">${esc(e.titular)}</div>
    </div>`;
}

/**
 * Hoja de etiquetas para pegar en la pestaña del folder de cada expediente.
 * Cada hoja trae ETIQUETAS_POR_HOJA etiquetas en cuadrícula, con un borde
 * punteado que sirve de guía para recortarlas a mano.
 */
export function etiquetasHtml(etiquetas: EtiquetaLote[]): string {
  const paginas: EtiquetaLote[][] = [];
  for (let i = 0; i < etiquetas.length; i += ETIQUETAS_POR_HOJA) {
    paginas.push(etiquetas.slice(i, i + ETIQUETAS_POR_HOJA));
  }
  if (paginas.length === 0) paginas.push([]);

  const hojasHtml = paginas
    .map((pagina) => `<div class="hoja"><div class="grid">${pagina.map(celda).join("")}</div></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; color: #1a1a1a; }

  /* Cada .hoja mide exactamente una página Carta: el contenido que no cabe
     en su grid no se reacomoda solo en la siguiente página (Chromium no
     reparte una cuadrícula entre páginas), así que la paginación se hace
     aquí, en TS, repartiendo el arreglo en tandas de ETIQUETAS_POR_HOJA. */
  .hoja {
    width: ${PAGINA_ANCHO_CM}cm;
    height: ${PAGINA_ALTO_CM}cm;
    padding: ${MARGEN_CM}cm;
    page-break-after: always;
  }
  .hoja:last-child { page-break-after: auto; }

  .grid {
    display: grid;
    grid-template-columns: repeat(${COLUMNAS}, ${ETIQUETA_ANCHO_CM}cm);
    grid-auto-rows: ${ETIQUETA_ALTO_CM}cm;
    column-gap: ${ESPACIO_CM}cm;
    row-gap: ${ESPACIO_CM}cm;
  }

  .etq {
    border: 1px dashed #999;
    padding: 0.12cm 0.25cm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  /* Una sola línea con puntos suspensivos si no cabe -- a este tamaño no hay
     espacio para que un nombre largo se parta en dos renglones. */
  .etq .clave {
    font-weight: 700;
    font-size: 10pt;
    line-height: 1.15;
    color: ${GUINDA};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .etq .titular {
    font-size: 7.5pt;
    line-height: 1.15;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
</head>
<body>
  ${hojasHtml}
</body>
</html>`;
}
