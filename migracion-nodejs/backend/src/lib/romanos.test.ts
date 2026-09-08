import { describe, expect, it } from "vitest";
import { aArabigo, aRomano, variantesManzana } from "./romanos";

describe("aRomano", () => {
  it.each([
    [1, "I"],
    [4, "IV"],
    [9, "IX"],
    [16, "XVI"],
    [40, "XL"],
    [90, "XC"],
    [1994, "MCMXCIV"],
  ])("convierte %i a %s", (arabigo, romano) => {
    expect(aRomano(arabigo)).toBe(romano);
  });

  it("regresa vacío fuera de rango o no entero", () => {
    expect(aRomano(0)).toBe("");
    expect(aRomano(-5)).toBe("");
    expect(aRomano(4000)).toBe("");
    expect(aRomano(1.5)).toBe("");
  });
});

describe("aArabigo", () => {
  it.each([
    ["I", 1],
    ["IV", 4],
    ["IX", 9],
    ["XVI", 16],
    ["viii", 8],
    ["  IX  ", 9],
  ])("convierte %s a %i", (romano, arabigo) => {
    expect(aArabigo(romano)).toBe(arabigo);
  });

  it("rechaza texto que no es un romano válido", () => {
    expect(aArabigo("IIII")).toBeNull();
    expect(aArabigo("1A")).toBeNull();
    expect(aArabigo("TALUD")).toBeNull();
    expect(aArabigo("")).toBeNull();
  });
});

describe("variantesManzana", () => {
  it("agrega la forma romana de un número", () => {
    expect(variantesManzana("16")).toEqual(["16", "XVI"]);
  });

  it("agrega la forma arábiga de un romano", () => {
    expect(variantesManzana("XVI")).toEqual(["XVI", "16"]);
  });

  it("deja intacto el texto que no es número ni romano", () => {
    expect(variantesManzana("1A")).toEqual(["1A"]);
    expect(variantesManzana("TALUD")).toEqual(["TALUD"]);
  });

  it("no duplica cuando el romano coincide consigo mismo tras normalizar", () => {
    expect(variantesManzana("")).toEqual([]);
  });
});
