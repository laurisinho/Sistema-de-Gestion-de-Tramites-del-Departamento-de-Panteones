import { describe, expect, it } from "vitest";
import { whereUbicacionLote } from "./ubicacion";

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
