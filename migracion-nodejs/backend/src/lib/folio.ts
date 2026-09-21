import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Arma el folio de un título nuevo con la forma que ya tienen las claves de su
 * misma sección.
 *
 * Cada sección escribe su clave de manera distinta y no hay una regla común:
 *
 *   sección 7   mz "1"  lote "1-F"   ->  PJE-07-01-01
 *   AMP         mz "1"  lote "1-J"   ->  PJE-AMP-01-01
 *   TERRAZAS    mz "1"  lote "1"     ->  PJE-TRZA1-1
 *   ANEXO       mz "ANEXO" lote "1"  ->  PJE-ANEXO-01
 *
 * Las abreviaturas ("TRZA" por TERRAZAS) no se pueden deducir del nombre, así
 * que se infieren de las claves existentes: se prueban distintas formas de
 * escribir manzana y lote, se recorta ese sufijo y se toma el prefijo más
 * frecuente.
 *
 * Se usa la moda y no el prefijo común a todas las claves porque una sola
 * clave mal capturada bastaría para descartar el prefijo de toda la sección.
 *
 * ADEII es la excepción: conviven dos convenciones y la deducción automática
 * no es confiable, por eso tiene una regla fija (ver folioADEII).
 */

const MUESTRA_MAX = 300;
// Proporción mínima de claves que debe reproducir el formato inferido; por
// debajo de ese valor se usa el formato de respaldo. ADEII no pasa por aquí
// (ver folioADEII).
const CONFIANZA_MINIMA = 0.7;

const norm = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");
const soloDigitos = (v: string) => norm(v).match(/^\d+/)?.[0] ?? "";

interface Formato {
  nombre: string;
  fn: (v: string) => string;
}

const FORMATOS: Formato[] = [
  { nombre: "tal-cual", fn: (v) => norm(v) },
  { nombre: "sin-guion", fn: (v) => norm(v).replace(/-/g, "") },
  { nombre: "pad2", fn: (v) => (/^\d+$/.test(norm(v)) ? norm(v).padStart(2, "0") : norm(v)) },
  {
    nombre: "sin-guion-pad2",
    fn: (v) => {
      const s = norm(v).replace(/-/g, "");
      return /^\d+$/.test(s) ? s.padStart(2, "0") : s;
    },
  },
  { nombre: "num", fn: (v) => soloDigitos(v) },
  { nombre: "num-pad2", fn: (v) => soloDigitos(v).padStart(2, "0") },
];

const SEPARADORES = ["-", "", " "];

interface Plantilla {
  prefijo: string;
  fmtM: Formato;
  sep: string;
  fmtL: Formato;
  aciertos: number;
  total: number;
}

// Un prefijo que termina en dígito suele haber absorbido el relleno de la
// manzana (funciona de la 1 a la 9 y falla en la 10). Ante un empate se prefiere
// el que no termina en dígito y después el más corto.
function esMejor(a: Plantilla, b: Plantilla): boolean {
  if (a.aciertos !== b.aciertos) return a.aciertos > b.aciertos;
  const da = /\d$/.test(a.prefijo);
  const db = /\d$/.test(b.prefijo);
  if (da !== db) return db;
  return a.prefijo.length < b.prefijo.length;
}

type LoteMuestra = { numeroManzana: string; numeroLote: string; claveLegado: string | null };

function deducirPlantilla(lotes: LoteMuestra[]): Plantilla | null {
  const conClave = lotes.filter((l): l is LoteMuestra & { claveLegado: string } => !!l.claveLegado);
  if (conClave.length < 3) return null;

  let mejor: Plantilla | null = null;
  for (const fmtM of FORMATOS) {
    for (const sep of SEPARADORES) {
      for (const fmtL of FORMATOS) {
        const conteo = new Map<string, number>();
        for (const l of conClave) {
          const sufijo = fmtM.fn(l.numeroManzana) + sep + fmtL.fn(l.numeroLote);
          if (!sufijo || !l.claveLegado.endsWith(sufijo)) continue;
          conteo.set(
            l.claveLegado.slice(0, l.claveLegado.length - sufijo.length),
            (conteo.get(l.claveLegado.slice(0, l.claveLegado.length - sufijo.length)) ?? 0) + 1
          );
        }
        for (const [prefijo, aciertos] of conteo) {
          const cand: Plantilla = { prefijo, fmtM, sep, fmtL, aciertos, total: conClave.length };
          if (!mejor || esMejor(cand, mejor)) mejor = cand;
        }
      }
    }
  }
  if (!mejor || mejor.aciertos / mejor.total < CONFIANZA_MINIMA) return null;
  return mejor;
}

/**
 * Regla fija para la sección ADEII (Jardines del Edén), definida por el
 * departamento:
 *
 *   - Manzana "Angelitos" (incluidas sus variantes de captura): el folio es
 *     PJE-ANG-{lote}, sin manzana.
 *   - Cualquier otra manzana: PJE-ADEII-{manzana}-{lote}, ambos a dos dígitos.
 *
 * Solo aplica a los títulos nuevos; los folios ya registrados no se modifican.
 */
function esAngelitos(manzana: string): boolean {
  return norm(manzana).includes("ANGEL");
}

function folioADEII(manzana: string, lote: string): string {
  const limpia = (v: string) => v.trim().toUpperCase().replace(/[ /]/g, "");
  if (esAngelitos(manzana)) {
    return `PJE-ANG-${limpia(lote)}`;
  }
  const numPad2 = (v: string) => soloDigitos(v).padStart(2, "0") || limpia(v);
  return `PJE-ADEII-${numPad2(manzana)}-${numPad2(lote)}`;
}

/**
 * Formato de respaldo cuando la sección no tiene una forma reconocible:
 * {clave}-{mz}-{lote}, el mismo que usaba el sistema anterior. Si dos secciones
 * coinciden en ubicación, el consecutivo de generarFolio las distingue.
 */
function folioGenerico(clavePanteon: string, manzana: string, lote: string): string {
  const limpia = (v: string) => v.trim().toUpperCase().replace(/[ /]/g, "");
  return `${clavePanteon}-${limpia(manzana)}-${limpia(lote)}`;
}

/**
 * Devuelve un folio libre para la ubicación dada. `tx` es el cliente de Prisma
 * (o el de la transacción en curso), de modo que la verificación de unicidad
 * vea lo escrito dentro de la misma transacción.
 */
export async function generarFolio(
  tx: Prisma.TransactionClient | PrismaClient,
  panteonId: number,
  clavePanteon: string,
  seccion: string | null,
  manzana: string,
  lote: string
): Promise<string> {
  let base: string;

  if (seccion && norm(seccion) === "ADEII") {
    base = folioADEII(manzana, lote);
  } else {
    const muestra = seccion
      ? await tx.lote.findMany({
          where: { panteonId, seccion, claveLegado: { not: null } },
          select: { numeroManzana: true, numeroLote: true, claveLegado: true },
          take: MUESTRA_MAX,
        })
      : [];

    const plantilla = deducirPlantilla(muestra);
    if (plantilla) {
      base = plantilla.prefijo + plantilla.fmtM.fn(manzana) + plantilla.sep + plantilla.fmtL.fn(lote);
    } else {
      base = folioGenerico(clavePanteon, manzana, lote);
    }
  }

  // El folio es único en la base: si la ubicación ya tuvo un título (por ejemplo,
  // uno cancelado) se agrega un consecutivo.
  let folio = base;
  let n = 2;
  while (await tx.tituloPropiedad.findUnique({ where: { folio }, select: { folio: true } })) {
    folio = `${base}-${n++}`;
  }
  return folio;
}

/**
 * Folio correlativo CES-#### para la cesión de derechos. Equivale a
 * GenerarFolioCesion del sistema original. Vive aquí para poder probarlo sin
 * base de datos.
 */
export async function generarFolioCesion(tx: Prisma.TransactionClient | PrismaClient): Promise<string> {
  const folios = await tx.cesionDerechos.findMany({ select: { folio: true } });
  let max = 0;
  for (const { folio } of folios) {
    const ultimo = folio.split("-").pop() ?? "";
    if (/^\d+$/.test(ultimo)) {
      const num = Number(ultimo);
      if (num > max) max = num;
    }
  }
  let siguiente = max + 1;
  for (;;) {
    const folio = `CES-${String(siguiente).padStart(4, "0")}`;
    const existe = await tx.cesionDerechos.findUnique({ where: { folio } });
    if (!existe) return folio;
    siguiente++;
  }
}
