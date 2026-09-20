import { describe, expect, it } from "vitest";
import { filtrosLoteBusqueda, whereUbicacionLote } from "./ubicacion";

/**
 * Guarda de regresión del bug corregido el 3 de septiembre: la comprobación
 * de duplicado no incluía la sección, así que 52 ubicaciones que hoy conviven
 * en dos secciones (47 en Jardines del Edén, 5 en Cipreses) quedaban
 * imposibles de dar de alta. Si alguien vuelve a quitar `seccion` del filtro,
 * esta prueba debe reventar.
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
    // Un lote de la sección AMP no debe considerarse ocupado por uno que no
    // tiene sección, y viceversa: por eso el propio filtro las distingue.
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
    expect(f[2]).toEqual({ numeroLote: { contains: "7", mode: "insensitive" } });
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
