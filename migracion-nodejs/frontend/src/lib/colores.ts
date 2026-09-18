// Deriva las variantes clara/oscura de guinda y dorado a partir de un solo
// color base, en vez de pedirle a Administración que elija 6 tonos a mano.
// Los números de ajuste (±9, ±8, etc.) reproducen aproximadamente la misma
// relación que ya tienen los tonos fijos de index.css entre sí.

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function hexToHsl(hex: string): Hsl {
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

function hslToHex(h: number, s: number, l: number): string {
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

export const APARIENCIA_DEFAULT = { colorGuinda: "#6b1229", colorDorado: "#f5b400" };

export function generarVariablesCss(colorGuinda: string, colorDorado: string): string {
  const g = hexToHsl(colorGuinda);
  const d = hexToHsl(colorDorado);

  const guindaLight = hslToHex(g.h, clamp(g.s - 9), clamp(g.l + 9));
  const guindaDark = hslToHex(g.h, g.s, clamp(g.l - 8, 5));
  const doradoSuave = hslToHex(d.h, clamp(d.s - 8), clamp(d.l + 15));

  // Fondo casi negro del sidebar y la topbar en modo oscuro: mismo tono que
  // el elegido pero a luminosidad fija y baja, en vez de un color de fondo
  // aparte (antes --bg-sidebar/--bg-topbar) que nunca se movía con el color
  // de marca -- eso era lo que se veía "sucio" al cambiarlo.
  const guindaSombra = hslToHex(g.h, clamp(g.s, 45, 80), 8);

  // Modo oscuro necesita un acento bastante más claro (el original pasa de
  // ~25% a ~52% de luminosidad) para que se lea sobre el fondo casi negro;
  // ahí "light" y "dark" convergen en el mismo tono, igual que en index.css.
  const oscuroBase = hslToHex(g.h, clamp(g.s - 23), clamp(g.l + 28));
  const oscuroVariante = hslToHex(g.h, clamp(g.s - 18), clamp(g.l + 40));

  return [
    `:root{--guinda:${colorGuinda};--guinda-light:${guindaLight};--guinda-dark:${guindaDark};--guinda-sombra:${guindaSombra};--dorado:${colorDorado};--dorado-suave:${doradoSuave};}`,
    `html.dark{--guinda:${oscuroBase};--guinda-light:${oscuroVariante};--guinda-dark:${oscuroVariante};}`,
  ].join("\n");
}

const ID_ESTILO = "apariencia-dinamica";

export function aplicarApariencia(colorGuinda: string, colorDorado: string): void {
  let estilo = document.getElementById(ID_ESTILO) as HTMLStyleElement | null;
  if (!estilo) {
    estilo = document.createElement("style");
    estilo.id = ID_ESTILO;
    document.head.appendChild(estilo);
  }
  estilo.textContent = generarVariablesCss(colorGuinda, colorDorado);
}
