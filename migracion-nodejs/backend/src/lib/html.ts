import { fechaHoraLocalCorta, hoyLocal } from "./fechas";

// Los datos (nombres, descripciones capturadas a mano) se interpolan en HTML
// que renderiza Puppeteer, así que hay que escaparlos para no romper el
// documento ni permitir inyección de HTML.
export function esc(valor: string | null | undefined): string {
  if (valor == null) return "";
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function fechaLarga(fecha: Date | null | undefined): string {
  const f = fecha ?? hoyLocal();
  return `${String(f.getUTCDate()).padStart(2, "0")} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}

export function fechaLargaMayus(fecha: Date | null | undefined): string {
  return fechaLarga(fecha).toUpperCase();
}

// No se imprimen las fechas centinela (1900/1905) usadas en la migración.
export function esFechaReal(fecha: Date | null | undefined): boolean {
  return !!fecha && fecha.getUTCFullYear() > 1905;
}

export function fechaCorta(fecha: Date | null | undefined): string {
  if (!fecha) return "";
  return `${String(fecha.getUTCDate()).padStart(2, "0")}/${String(fecha.getUTCMonth() + 1).padStart(2, "0")}/${fecha.getUTCFullYear()}`;
}

export function fechaHoraCorta(fecha: Date): string {
  return fechaHoraLocalCorta(fecha);
}
