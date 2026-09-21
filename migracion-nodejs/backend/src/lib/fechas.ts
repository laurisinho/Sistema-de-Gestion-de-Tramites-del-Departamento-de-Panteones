// Zona horaria de Nogales, Sonora (UTC-7, sin horario de verano). Se indica
// siempre de forma explícita para que las fechas de los documentos no dependan
// de la zona del servidor, que en un contenedor suele ser UTC.
const ZONA = "America/Hermosillo";

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA });

const formatoDiaHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * La fecha de hoy en Nogales como Date a medianoche UTC: así se guardan las
 * columnas DATE y así las leen los getters UTC del resto del código.
 */
export function hoyLocal(ahora: Date = new Date()): Date {
  const [anio, mes, dia] = formatoDia.format(ahora).split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** "dd/mm/aaaa hh:mm" en hora de Nogales, para instantes guardados en UTC. */
export function fechaHoraLocalCorta(fecha: Date): string {
  const p = Object.fromEntries(formatoDiaHora.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
