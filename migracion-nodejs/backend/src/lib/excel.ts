import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

const GUINDA = "6B1229";
const GUINDA_LT = "8B2040";
const DORADO = "F5B400";
const BORDE = "D8D2D4";

function argb(hex: string): string {
  return `FF${hex}`;
}

export interface ColDef {
  titulo: string;
  ancho: number;
  align: "left" | "center" | "right";
}

export const FILA_ENCABEZADO = 6;

function logoBuffer(nombre: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "..", "assets", nombre));
}

// Puerto de PrepararHoja: encabezado con logos, título, subtítulo, periodo y
// la fila de columnas. Las fórmulas de ancho son las mismas unidades de
// caracteres que usa ClosedXML/Excel, por eso los números de ColDef se
// copian tal cual del original sin necesidad de conversión.
export function prepararHoja(
  wb: ExcelJS.Workbook,
  nombreHoja: string,
  cols: ColDef[],
  titulo: string,
  subtituloFijo: string,
  periodo: string,
  totalItems: number
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nombreHoja, {
    properties: { tabColor: { argb: argb(GUINDA) } },
    views: [{ showGridLines: false }],
  });
  const ncol = cols.length;

  try {
    const idLeft = wb.addImage({ buffer: logoBuffer("logo_nogales.png") as never, extension: "png" });
    ws.addImage(idLeft, { tl: { col: 0.15, row: 0.1 }, ext: { width: 150, height: 52 } });
    const idRight = wb.addImage({ buffer: logoBuffer("logo_frontera.png") as never, extension: "png" });
    ws.addImage(idRight, { tl: { col: Math.max(ncol - 1.7, 0.5), row: 0.1 }, ext: { width: 95, height: 52 } });
  } catch {
    // si fallan los logos, el reporte sigue sin ellos
  }

  ws.getCell(1, 1).value = "H. AYUNTAMIENTO DE NOGALES";
  ws.getCell(2, 1).value = "Sindicatura Municipal · Departamento de Control de Panteones";
  ws.getCell(3, 1).value = titulo;
  ws.getCell(4, 1).value = subtituloFijo;
  ws.getCell(5, 1).value = `${periodo}    ·    Total: ${totalItems}    ·    Generado: ${new Date().toLocaleString("es-MX")}`;

  for (let r = 1; r <= 5; r++) {
    ws.mergeCells(r, 1, r, ncol);
  }

  ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: argb(GUINDA) } };
  ws.getCell(1, 1).alignment = { horizontal: "center" };
  ws.getCell(2, 1).font = { size: 9.5, color: { argb: argb(GUINDA_LT) } };
  ws.getCell(2, 1).alignment = { horizontal: "center" };
  ws.getCell(3, 1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  ws.getCell(3, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(GUINDA) } };
  ws.getCell(3, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell(4, 1).font = { bold: true, size: 10, color: { argb: argb(DORADO) } };
  ws.getCell(4, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(GUINDA_LT) } };
  ws.getCell(4, 1).alignment = { horizontal: "center" };
  ws.getCell(5, 1).font = { size: 9, italic: true, color: { argb: "FF555555" } };
  ws.getCell(5, 1).alignment = { horizontal: "center" };

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 16;
  ws.getRow(5).height = 16;

  for (let c = 0; c < ncol; c++) {
    const cell = ws.getCell(FILA_ENCABEZADO, c + 1);
    cell.value = cols[c].titulo;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(GUINDA) } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  ws.getRow(FILA_ENCABEZADO).height = 34;

  return ws;
}

// Puerto de CerrarHoja: renglón de total (o "sin registros"), bordes de tabla,
// anchos de columna, congelar encabezado y configuración de impresión.
export function cerrarHoja(ws: ExcelJS.Worksheet, cols: ColDef[], totalItems: number, filaSiguiente: number): void {
  const ncol = cols.length;
  let ultimaFila: number;

  if (totalItems === 0) {
    ws.getCell(filaSiguiente, 1).value = "Sin registros para el periodo seleccionado.";
    ws.mergeCells(filaSiguiente, 1, filaSiguiente, ncol);
    ws.getCell(filaSiguiente, 1).font = { italic: true, color: { argb: "FF888888" } };
    ws.getCell(filaSiguiente, 1).alignment = { horizontal: "center" };
    ultimaFila = filaSiguiente;
  } else {
    ws.getCell(filaSiguiente, 1).value = `TOTAL: ${totalItems} registro(s)`;
    ws.mergeCells(filaSiguiente, 1, filaSiguiente, ncol);
    ws.getCell(filaSiguiente, 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(filaSiguiente, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(GUINDA_LT) } };
    ws.getCell(filaSiguiente, 1).alignment = { horizontal: "right" };
    ws.getRow(filaSiguiente).height = 18;
    ultimaFila = filaSiguiente;
  }

  for (let r = FILA_ENCABEZADO; r <= ultimaFila; r++) {
    for (let c = 1; c <= ncol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: r === FILA_ENCABEZADO ? "medium" : "thin", color: { argb: r === FILA_ENCABEZADO ? argb(GUINDA) : argb(BORDE) } },
        left: { style: c === 1 ? "medium" : "thin", color: { argb: c === 1 ? argb(GUINDA) : argb(BORDE) } },
        right: { style: c === ncol ? "medium" : "thin", color: { argb: c === ncol ? argb(GUINDA) : argb(BORDE) } },
        bottom: { style: r === ultimaFila ? "medium" : "thin", color: { argb: r === ultimaFila ? argb(GUINDA) : argb(BORDE) } },
      };
    }
  }

  if (totalItems > 0) {
    const finDatos = filaSiguiente - 1;
    for (let r = FILA_ENCABEZADO + 1; r <= finDatos; r++) {
      for (let c = 0; c < ncol; c++) {
        const cell = ws.getCell(r, c + 1);
        if (!cell.font) cell.font = { size: 8.5 };
        cell.alignment = { ...(cell.alignment ?? {}), horizontal: cols[c].align, vertical: "top" };
      }
    }
  }

  for (let c = 0; c < ncol; c++) ws.getColumn(c + 1).width = cols[c].ancho;

  ws.views = [{ state: "frozen", ySplit: FILA_ENCABEZADO, showGridLines: false }];

  ws.pageSetup = {
    orientation: "landscape",
    paperSize: 5, // Legal
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { top: 0.4, bottom: 0.5, left: 0.3, right: 0.3, header: 0, footer: 0 },
    horizontalCentered: true,
  };
  ws.headerFooter = {
    oddFooter: "&LDepto. de Panteones — Nogales, Sonora&RPágina &P de &N",
  };
}

// Las fechas centinela (1900/1905) de la migración no deben imprimirse.
export function escribirFecha(cell: ExcelJS.Cell, f: Date | null | undefined): void {
  if (!f || f.getUTCFullYear() <= 1905) {
    cell.value = "";
    return;
  }
  cell.value = f;
  cell.numFmt = "dd/mm/yyyy";
}

// El formato oficial junta fecha y hora en una sola celda de texto.
export function fechaHoraTexto(f: Date | null | undefined, hora: Date | null | undefined): string {
  if (!f || f.getUTCFullYear() <= 1905) return "";
  const s = `${String(f.getUTCDate()).padStart(2, "0")}/${String(f.getUTCMonth() + 1).padStart(2, "0")}/${f.getUTCFullYear()}`;
  if (!hora) return s;
  const h = String(hora.getUTCHours()).padStart(2, "0");
  const m = String(hora.getUTCMinutes()).padStart(2, "0");
  return `${s} ${h}:${m}`;
}

export { argb, GUINDA, GUINDA_LT, DORADO, BORDE };
