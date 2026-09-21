import type { AparienciaDocumento } from "../lib/apariencia";
import { esc } from "../lib/html";

const PAGINA_ANCHO_CM = 21.59; // Carta/Letter
const PAGINA_ALTO_CM = 27.94;
const MARGEN_CM = 0.8;
const ESPACIO_CM = 0.2; // separación entre etiquetas, para poder recortar con tijeras

export interface MedidasEtiqueta {
  anchoCm: number;
  altoCm: number;
  /** Tamaño de letra del cuerpo, en puntos. */
  cuerpoPt: number;
}

// El archivo del departamento (ETIQUETAS PANTEONES CIPRESES) las trae de
// 9.7 x 1.9 cm; estas son algo más chicas para que no invadan la carpeta.
export const MEDIDAS_DEFECTO: MedidasEtiqueta = { anchoCm: 8.9, altoCm: 1.5, cuerpoPt: 7 };

/** Cuántas etiquetas caben en una hoja Carta con las medidas dadas. */
export function distribucion(m: MedidasEtiqueta): { columnas: number; filas: number; porHoja: number } {
  const columnas = Math.floor((PAGINA_ANCHO_CM - 2 * MARGEN_CM + ESPACIO_CM) / (m.anchoCm + ESPACIO_CM));
  const filas = Math.floor((PAGINA_ALTO_CM - 2 * MARGEN_CM + ESPACIO_CM) / (m.altoCm + ESPACIO_CM));
  return { columnas, filas, porHoja: columnas * filas };
}

export interface EtiquetaLote {
  /** Clave del lote (claveLegado), no el folio del título: el lote es la
   * carpeta física y no cambia aunque el título se ceda a otro dueño. */
  clave: string;
  titular: string;
  panteon: string;
  seccion?: string | null;
  manzana?: string | null;
  lote?: string | null;
}

/**
 * Una sola línea corrida, como en el archivo del departamento:
 * "EXP. {clave}.- {titular} · {PANTEÓN} · SECCIÓN: {sec} MANZANA: {mz} LOTE: {lote}".
 * Los panteones que se ubican por colindancias no tienen manzana ni lote
 * ("S/N" más un consecutivo interno), así que esas partes se omiten.
 */
function textoEtiqueta(e: EtiquetaLote): string {
  const panteon = e.panteon.toUpperCase();
  const seccion = e.seccion?.trim().toUpperCase() ?? "";
  const porColindancias = e.manzana?.trim().toUpperCase() === "S/N";
  // El Jardín de los Cipreses está dado de alta como dos panteones (Jardines y
  // Monumentos), así que su nombre ya termina con el de la sección y repetirla
  // solo gasta renglón.
  const seccionRedundante = !seccion || panteon.endsWith(seccion);

  const ubicacion = [
    seccionRedundante ? "" : `SECCIÓN: ${seccion}`,
    porColindancias || !e.manzana ? "" : `MANZANA: ${e.manzana}`,
    porColindancias || !e.lote ? "" : `LOTE: ${e.lote}`,
  ]
    .filter(Boolean)
    .join("   ");

  return [`EXP. ${e.clave}.- ${e.titular}`, panteon, ubicacion].filter(Boolean).join("   ·   ");
}

function celda(e: EtiquetaLote, apariencia: AparienciaDocumento): string {
  const texto = textoEtiqueta(e);
  // Un titular muy largo (dos personas, o con varios apellidos) no cabe en los
  // renglones disponibles, así que la letra baja en vez de recortarse.
  const ajuste = texto.length > 175 ? " muy-largo" : texto.length > 140 ? " largo" : "";
  return `
    <div class="etq">
      <div class="cab">
        <img src="${apariencia.logoNogales}" alt="" />
        <span class="cab-izq">H. AYUNTAMIENTO DE NOGALES</span>
        <span>SINDICATURA PANTEONES</span>
      </div>
      <div class="cuerpo${ajuste}"><span>${esc(texto)}</span></div>
    </div>`;
}

/**
 * Hoja de etiquetas para pegar en la pestaña del folder de cada expediente.
 * Cada hoja llena una cuadrícula, con un borde que sirve de guía para
 * recortarlas a mano.
 */
export function etiquetasHtml(
  etiquetas: EtiquetaLote[],
  apariencia: AparienciaDocumento,
  medidas: MedidasEtiqueta = MEDIDAS_DEFECTO
): string {
  const { columnas, porHoja } = distribucion(medidas);

  const paginas: EtiquetaLote[][] = [];
  for (let i = 0; i < etiquetas.length; i += porHoja) {
    paginas.push(etiquetas.slice(i, i + porHoja));
  }
  if (paginas.length === 0) paginas.push([]);

  const hojasHtml = paginas
    .map((pagina) => `<div class="hoja"><div class="grid">${pagina.map((e) => celda(e, apariencia)).join("")}</div></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; }

  /* Cada .hoja mide una página Carta. Chromium no reparte una cuadrícula entre
     páginas, así que la paginación se hace en TS, repartiendo el arreglo en
     tandas del total que cabe por hoja. */
  .hoja {
    width: ${PAGINA_ANCHO_CM}cm;
    height: ${PAGINA_ALTO_CM}cm;
    padding: ${MARGEN_CM}cm;
    page-break-after: always;
  }
  .hoja:last-child { page-break-after: auto; }

  .grid {
    display: grid;
    grid-template-columns: repeat(${columnas}, ${medidas.anchoCm}cm);
    grid-auto-rows: ${medidas.altoCm}cm;
    column-gap: ${ESPACIO_CM}cm;
    row-gap: ${ESPACIO_CM}cm;
  }

  .etq {
    border: 1pt solid #000;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .etq .cab {
    display: flex;
    align-items: center;
    gap: 3pt;
    padding: 1.5pt 4pt 0.5pt;
    font-size: 5pt;
    font-weight: 700;
    line-height: 1.1;
    color: #000;
    white-space: nowrap;
  }
  .etq .cab img { height: 8pt; width: auto; }
  /* Empuja "SINDICATURA PANTEONES" al extremo derecho. */
  .etq .cab .cab-izq { margin-right: auto; }

  .etq .cuerpo {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1pt 4pt 2pt;
    background: ${apariencia.paleta.guinda};
    color: #fff;
    font-size: ${medidas.cuerpoPt}pt;
    font-weight: 700;
    line-height: 1.18;
    text-align: center;
  }
  .etq .cuerpo.largo { font-size: ${(medidas.cuerpoPt * 0.87).toFixed(1)}pt; }
  .etq .cuerpo.muy-largo { font-size: ${(medidas.cuerpoPt * 0.75).toFixed(1)}pt; }
  /* Hasta cuatro renglones; si aun así no cabe, se recorta con puntos
     suspensivos en lugar de desbordarse sobre la etiqueta de abajo. */
  .etq .cuerpo span {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
  }
</style>
</head>
<body>
  ${hojasHtml}
</body>
</html>`;
}
