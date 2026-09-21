import { describe, expect, it } from "vitest";
import { derivarPaleta } from "../lib/colores";
import { permisoHtml } from "./permiso.template";

const apariencia = {
  logoNogales: "",
  logoFrontera: "",
  sindico: "MAESTRA EDNA ELINORA SOTO GRACIA",
  paleta: derivarPaleta("#6b1229", "#f5b400"),
};

const permiso = (clave: string, conDifunto: boolean) =>
  ({
    permisoId: 1,
    folio: `${clave}-0001`,
    fechaSolicitud: new Date("2026-09-21T00:00:00Z"),
    estado: "APROBADO",
    numeroRecibo: null,
    esDonacion: false,
    sinTituloRegistrado: false,
    tipoObra: "BARDA",
    descripcionObra: null,
    tipoTramite: { clave, nombre: clave },
    solicitante: { nombreCompleto: "LUIS ANTONIO GARFIAS", telefono: null },
    fallecido: conDifunto
      ? {
          nombreCompleto: "Rosa María Castañeda Coronado",
          fechaFallecimiento: new Date("2022-11-30T00:00:00Z"),
          numeroCaso: null,
          actaDefuncionNumero: "0456",
        }
      : null,
    lote: { seccion: "TERRAZAS", numeroManzana: "1", numeroLote: "54", panteon: { nombre: "Jardines del Edén" } },
  }) as never;

describe("permiso de Construcción y el difunto", () => {
  it("imprime el nombre del difunto cuando el permiso lo tiene enlazado", () => {
    const html = permisoHtml(permiso("CON", true), apariencia);
    expect(html).toContain("Difunto");
    expect(html).toContain("ROSA MARÍA CASTAÑEDA CORONADO");
    expect(html).toContain("Fecha fallecimiento");
  });

  it("sin difunto no imprime el bloque, ni una etiqueta vacía", () => {
    const html = permisoHtml(permiso("CON", false), apariencia);
    expect(html).not.toContain("Difunto");
    expect(html).not.toContain("Fecha fallecimiento");
  });

  it("los demás trámites siguen mostrando al difunto como antes", () => {
    for (const clave of ["SEP", "EXH", "CEN"]) {
      expect(permisoHtml(permiso(clave, true), apariencia)).toContain("ROSA MARÍA CASTAÑEDA CORONADO");
    }
  });
});
