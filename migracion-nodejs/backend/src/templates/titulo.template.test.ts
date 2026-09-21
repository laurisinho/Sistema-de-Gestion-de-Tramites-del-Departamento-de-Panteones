import { describe, expect, it } from "vitest";
import { derivarPaleta } from "../lib/colores";
import { tituloHtml } from "./titulo.template";

const apariencia = {
  logoNogales: "",
  logoFrontera: "",
  sindico: "MAESTRA EDNA ELINORA SOTO GRACIA",
  paleta: derivarPaleta("#6b1229", "#f5b400"),
};

const titulo = (nombre: string, lote: Record<string, unknown>) =>
  ({
    folio: "PJE-TRZA1-54",
    fechaEmision: new Date("2026-09-21T00:00:00Z"),
    estado: "VIGENTE",
    numeroRecibo: "A-12345",
    titular: { nombreCompleto: nombre, identificacionTipo: null, identificacionNumero: null },
    lote: { panteon: { nombre: "Jardines del Edén" }, ...lote },
  }) as never;

const MANZANA = { seccion: "TERRAZAS", numeroManzana: "1", numeroLote: "54" };
const escalaDe = (html: string) => Number(/--k:\s*([\d.]+)/.exec(html)![1]);

describe("título de propiedad: ubicación", () => {
  it("muestra sección, manzana y lote con su etiqueta", () => {
    const html = tituloHtml(titulo("MARIA LOPEZ", MANZANA), apariencia);
    expect(html).toContain("ubic-grid3");
    for (const et of ["SECCIÓN", "MANZANA", "LOTE"]) expect(html).toContain(`>${et}<`);
    expect(html).toContain(">TERRAZAS<");
    expect(html).toContain(">54<");
  });

  it("en panteones de colindancias muestra las cuatro orientaciones", () => {
    const html = tituloHtml(
      titulo("MARIA LOPEZ", {
        numeroManzana: "S/N",
        numeroLote: "109",
        colindanciaNorte: "calle uno",
        colindanciaSur: "calle dos",
        colindanciaEste: "lote tres",
        colindanciaOeste: "lote cuatro",
      }),
      apariencia
    );
    expect(html).toContain("ubic-grid2");
    for (const et of ["NORTE", "ESTE", "SUR", "OESTE"]) expect(html).toContain(`>${et}<`);
    expect(html).toContain(">CALLE UNO<");
  });

  it("escapa los datos capturados a mano", () => {
    const html = tituloHtml(titulo("<script>alert(1)</script>", MANZANA), apariencia);
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("título de propiedad: letra según el largo del texto", () => {
  it("usa el tamaño normal con un nombre corto", () => {
    expect(escalaDe(tituloHtml(titulo("MARIA LOPEZ", MANZANA), apariencia))).toBe(1);
  });

  it("baja la letra con nombres largos para que siga cabiendo en una hoja", () => {
    const largo = "N".repeat(200);
    expect(escalaDe(tituloHtml(titulo(largo, MANZANA), apariencia))).toBeLessThan(0.85);
  });

  it("la escala nunca crece al aumentar el texto", () => {
    const escalas = [10, 60, 90, 120, 160, 200, 260].map((n) => escalaDe(tituloHtml(titulo("N".repeat(n), MANZANA), apariencia)));
    for (let i = 1; i < escalas.length; i++) expect(escalas[i]).toBeLessThanOrEqual(escalas[i - 1]);
  });
});
