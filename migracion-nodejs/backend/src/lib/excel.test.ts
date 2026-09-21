import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { derivarPaleta } from "./colores";

// El color de los reportes se lee de Administración > Apariencia. Aquí se
// sustituye esa consulta para comprobar que el color elegido llega de verdad a
// las celdas, sin depender de lo que haya guardado en la base.
const apariencia = vi.hoisted(() => ({ guinda: "#6b1229", dorado: "#f5b400" }));

vi.mock("./apariencia", () => ({
  obtenerAparienciaDocumento: async () => ({
    logoNogales: "",
    logoFrontera: "",
    sindico: "X",
    paleta: derivarPaleta(apariencia.guinda, apariencia.dorado),
  }),
  // Los logos se omiten: prepararHoja ya ignora el fallo y sigue sin ellos.
  obtenerLogosBuffer: async () => {
    throw new Error("sin logos en la prueba");
  },
}));

const { prepararHoja, cerrarHoja, coloresExcel } = await import("./excel");

const COLS = [
  { titulo: "Panteón", ancho: 30, align: "left" as const },
  { titulo: "Total", ancho: 10, align: "center" as const },
];

async function hojaDePrueba() {
  const wb = new ExcelJS.Workbook();
  const ws = await prepararHoja(wb, "Resumen", COLS, "REPORTE", "Subtítulo", "Septiembre 2026", 1);
  ws.getCell(7, 1).value = "Jardines del Edén";
  ws.getCell(7, 2).value = 3;
  await cerrarHoja(ws, COLS, 1, 8);
  return ws;
}

/** ExcelJS guarda los colores como "FFRRGGBB"; aquí se comparan sin el alfa. */
const rgb = (argb: string | undefined) => (argb ?? "").slice(2).toLowerCase();

beforeEach(() => {
  apariencia.guinda = "#6b1229";
  apariencia.dorado = "#f5b400";
});

describe("colores de los reportes en Excel", () => {
  it("usa el guinda del sistema cuando no se ha cambiado", async () => {
    const ws = await hojaDePrueba();
    expect(rgb(ws.getCell(3, 1).fill && (ws.getCell(3, 1).fill as ExcelJS.FillPattern).fgColor?.argb)).toBe("6b1229");
    expect(rgb(ws.getCell(1, 1).font?.color?.argb)).toBe("6b1229");
  });

  it("sigue el color elegido en Administración", async () => {
    apariencia.guinda = "#1e4d7b";
    apariencia.dorado = "#c9a227";

    const esperado = derivarPaleta("#1e4d7b", "#c9a227");
    const ws = await hojaDePrueba();

    const fondo = (f: number, c: number) => rgb((ws.getCell(f, c).fill as ExcelJS.FillPattern)?.fgColor?.argb);
    const letra = (f: number, c: number) => rgb(ws.getCell(f, c).font?.color?.argb);

    // Título con fondo de color, encabezado de la tabla y color de la pestaña.
    expect(fondo(3, 1)).toBe("1e4d7b");
    expect(fondo(6, 1)).toBe("1e4d7b");
    expect(rgb(ws.properties.tabColor?.argb)).toBe("1e4d7b");
    // Tonos derivados: subtítulo y franja secundaria.
    expect(letra(2, 1)).toBe(esperado.guindaClaro.slice(1));
    expect(fondo(4, 1)).toBe(esperado.guindaClaro.slice(1));
    expect(letra(4, 1)).toBe("c9a227");
    // Y no queda rastro del guinda anterior.
    expect(fondo(3, 1)).not.toBe("6b1229");
  });

  it("coloresExcel devuelve la paleta vigente", async () => {
    apariencia.guinda = "#1e4d7b";
    const c = await coloresExcel();
    expect(c.guinda).toBe("#1e4d7b");
    expect(c.guindaClaro).toBe(derivarPaleta("#1e4d7b", "#f5b400").guindaClaro);
  });
});
