import { describe, expect, it } from "vitest";
import { compararNatural, filtrosLoteBusqueda, mismoLote, variantesLote, whereUbicacionLote } from "./ubicacion";

describe("lotes con letras", () => {
  it("'5A' y '5 A' se buscan como el mismo lote", () => {
    expect(variantesLote("5A").sort()).toEqual(["5 A", "5A"]);
    expect(variantesLote("5 A").sort()).toEqual(["5 A", "5A"]);
    expect(variantesLote("7")).toEqual(["7"]);
  });

  it("la coincidencia exacta ignora espacios y mayúsculas, pero no confunde 5 con 15", () => {
    expect(mismoLote("5A", "5 a")).toBe(true);
    expect(mismoLote("26 bis B", "26bisb")).toBe(true);
    expect(mismoLote("15", "5")).toBe(false);
  });

  it("el orden es natural: 2, 10, 10A", () => {
    expect(["10A", "10", "2", "5B", "5A"].sort(compararNatural)).toEqual(["2", "5A", "5B", "10", "10A"]);
  });
});

/**
 * Regresión: la comprobación de ubicación ocupada debe incluir la sección,
 * porque la misma manzana y lote pueden existir en secciones distintas. Si se
 * quita `seccion` del filtro, esta prueba falla.
 */
describe("whereUbicacionLote", () => {
  it("incluye la sección en el filtro, no solo panteón/manzana/lote", () => {
    const where = whereUbicacionLote(1, "TERRAZAS", "1", "1");
    expect(where).toHaveProperty("seccion", "TERRAZAS");
    expect(where).toEqual({ panteonId: 1, seccion: "TERRAZAS", numeroManzana: "1", numeroLote: "1" });
  });

  it("distingue explícitamente 'sin sección' (null) de una sección con nombre", () => {
    const conSeccion = whereUbicacionLote(1, "AMP", "1", "1");
    const sinSeccion = whereUbicacionLote(1, null, "1", "1");
    expect(conSeccion.seccion).toBe("AMP");
    expect(sinSeccion.seccion).toBeNull();
    // Un lote de la sección AMP no debe considerarse ocupado por uno sin sección,
    // y viceversa.
    expect(conSeccion).not.toEqual(sinSeccion);
  });
});

describe("filtrosLoteBusqueda", () => {
  it("sin filtros no genera ninguna condición", () => {
    expect(filtrosLoteBusqueda({})).toEqual([]);
  });

  it("cada filtro va en su propia condición, para combinarlos con AND", () => {
    const f = filtrosLoteBusqueda({ panteonId: 1, manzana: "3", lote: "7" });
    expect(f).toHaveLength(3);
    expect(f[0]).toEqual({ panteonId: 1 });
    expect(f[2]).toEqual({ OR: [{ numeroLote: { contains: "7", mode: "insensitive" } }] });
  });

  it("'ANG' y una manzana tecleada no se pisan: son condiciones distintas", () => {
    const f = filtrosLoteBusqueda({ seccion: "ANG", manzana: "ANGELITOS" });
    expect(f).toHaveLength(2);
    expect(f[0]).toEqual({ seccion: "ADEII", numeroManzana: { contains: "ANGEL", mode: "insensitive" } });
    expect(f[1]).toHaveProperty("OR");
  });

  it("la manzana busca también su equivalente romano/arábigo", () => {
    const f = filtrosLoteBusqueda({ manzana: "16" });
    const variantes = (f[0] as { OR: { numeroManzana: { contains: string } }[] }).OR.map((c) => c.numeroManzana.contains);
    expect(variantes).toEqual(expect.arrayContaining(["16", "XVI"]));
  });

  it("la colindancia se busca en las cuatro orientaciones", () => {
    const f = filtrosLoteBusqueda({ colindancia: "PEREZ" });
    expect((f[0] as { OR: unknown[] }).OR).toHaveLength(4);
  });
});
