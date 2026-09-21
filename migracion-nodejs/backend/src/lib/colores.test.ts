import { describe, expect, it } from "vitest";
import { CONTRASTE_MINIMO, contrasteConBlanco, derivarPaleta, hexToHsl, hslToHex } from "./colores";

const GUINDA = "#6b1229";
const DORADO = "#f5b400";

describe("conversión de color", () => {
  it("ida y vuelta conserva el color", () => {
    for (const hex of [GUINDA, DORADO, "#000000", "#ffffff", "#1e5aa8"]) {
      const { h, s, l } = hexToHsl(hex);
      expect(hslToHex(h, s, l)).toBe(hex);
    }
  });
});

describe("paleta de documentos", () => {
  const p = derivarPaleta(GUINDA, DORADO);

  it("reproduce los tonos que estaban fijos en las plantillas", () => {
    expect(p.guinda).toBe(GUINDA);
    // Los valores fijos anteriores se eligieron a ojo, así que se admiten unos
    // pocos niveles de diferencia por canal (imperceptibles al imprimir).
    const canales = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const cerca = (a: string, b: string) =>
      canales(a).every((v, i) => Math.abs(v - canales(b)[i]) <= 5);
    expect(cerca(p.guindaOscuro, "#4a0c1c")).toBe(true);
    expect(cerca(p.guindaClaro, "#8b2040")).toBe(true);
    expect(cerca(p.marcaAgua, "#eac6ce")).toBe(true);
  });

  it("mantiene el matiz al derivar", () => {
    const base = Math.round(hexToHsl(GUINDA).h);
    for (const tono of [p.guindaOscuro, p.guindaClaro, p.marcaAgua]) {
      expect(Math.round(hexToHsl(tono).h)).toBe(base);
    }
  });

  it("la marca de agua queda clara y el tono oscuro, oscuro", () => {
    expect(hexToHsl(p.marcaAgua).l).toBeGreaterThan(75);
    expect(hexToHsl(p.guindaOscuro).l).toBeLessThan(hexToHsl(GUINDA).l);
  });

  it("no se sale de rango con colores extremos", () => {
    for (const hex of ["#000000", "#ffffff"]) {
      for (const tono of Object.values(derivarPaleta(hex, DORADO))) {
        expect(tono).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("contraste contra texto blanco", () => {
  it("acepta el guinda del sistema", () => {
    expect(contrasteConBlanco(GUINDA)).toBeGreaterThan(CONTRASTE_MINIMO);
  });

  it("rechaza colores claros, que dejarían el texto blanco ilegible", () => {
    for (const hex of [DORADO, "#ffffff", "#ffe08a", "#8bd4a0"]) {
      expect(contrasteConBlanco(hex)).toBeLessThan(CONTRASTE_MINIMO);
    }
  });

  it("el negro da el contraste máximo y el blanco el mínimo", () => {
    expect(contrasteConBlanco("#000000")).toBeCloseTo(21, 0);
    expect(contrasteConBlanco("#ffffff")).toBeCloseTo(1, 1);
  });
});
