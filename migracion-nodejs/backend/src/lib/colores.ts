// Deriva los tonos de los documentos (PDF y Excel) a partir de los dos colores
// que se eligen en Administración > Apariencia, con los mismos ajustes que usa
// el frontend en src/lib/colores.ts para la pantalla.

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

export function hexToHsl(hex: string): Hsl {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = clamp(s) / 100;
  const lN = clamp(l) / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Contraste del color contra texto blanco, según la fórmula de WCAG 2.1.
 * Va de 1 (ilegible) a 21 (negro puro). El mínimo recomendado para texto es 4.5.
 */
export function contrasteConBlanco(hex: string): number {
  const n = hex.replace("#", "");
  const canal = (i: number) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminancia = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  return 1.05 / (luminancia + 0.05);
}

/** Contraste mínimo para que el texto blanco de los documentos se lea. */
export const CONTRASTE_MINIMO = 4.5;

export interface PaletaDocumento {
  /** Encabezados y recuadros; siempre lleva texto blanco encima. */
  guinda: string;
  /** Degradados y textos destacados sobre fondo claro. */
  guindaOscuro: string;
  /** Subtítulos y franjas secundarias. */
  guindaClaro: string;
  /** Marca de agua "REIMPRESIÓN": el mismo tono, muy lavado. */
  marcaAgua: string;
  dorado: string;
}

export function derivarPaleta(colorGuinda: string, colorDorado: string): PaletaDocumento {
  const g = hexToHsl(colorGuinda);
  return {
    guinda: colorGuinda,
    guindaOscuro: hslToHex(g.h, g.s, clamp(g.l - 8, 5)),
    guindaClaro: hslToHex(g.h, clamp(g.s - 9), clamp(g.l + 9)),
    // Va detrás del texto del documento, así que tiene que quedar muy claro
    // para no competir con lo que se lee encima.
    marcaAgua: hslToHex(g.h, clamp(g.s - 25), clamp(g.l + 60, 0, 90)),
    dorado: colorDorado,
  };
}
