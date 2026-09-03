import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Arma el folio de un título nuevo siguiendo la forma que ya tienen las claves
 * de esa misma sección, en vez de imponer un formato propio.
 *
 * Hace falta porque cada sección del departamento escribe su clave distinto y
 * no hay una regla común que valga para todas:
 *
 *   sección 7   mz "1"  lote "1-F"   ->  PJE-07-01-01
 *   AMP         mz "1"  lote "1-J"   ->  PJE-AMP-01-01
 *   TERRAZAS    mz "1"  lote "1"     ->  PJE-TRZA1-1
 *   ANEXO       mz "ANEXO" lote "1"  ->  PJE-ANEXO-01
 *
 * Ninguna abreviatura ("TRZA" por TERRAZAS) se deduce del nombre, así que la
 * única fuente confiable es el propio acervo: se prueban las distintas maneras
 * de escribir manzana y lote, se recorta ese sufijo de las claves existentes y
 * se toma el prefijo que más se repite.
 *
 * Se usa la moda y no el prefijo común a todas porque basta una clave mal
 * capturada -- en Jardines del Edén hay una escrita "PJE -ADEII17", con un
 * espacio de más -- para arruinar el prefijo de las 773 de su sección.
 */

const MUESTRA_MAX = 300;
// Debajo de esto se entiende que la sección no tiene un formato que seguir.
// Al 0.7 entra la sección 9, cuya forma canónica reproduce 44 de 58 claves y
// el resto son capturas sueltas; quedan fuera ADEII (28 %) y Árbol del Edén II
// (33 %), donde de verdad conviven varias convenciones en la misma sección.
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

// Un prefijo que termina en dígito casi siempre se comió el relleno de la
// manzana: reproduce bien las manzanas 1 a 9 y se rompe en la 10. A igualdad
// de aciertos se prefiere el que no termina en dígito, y luego el más corto.
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
 * Respaldo cuando la sección no tiene una forma reconocible: {clave}-{mz}-{lote},
 * que es el mismo formato que traía la aplicación antes y el que más se repite
 * en el acervo (todo el Jardín de los Cipreses y varias secciones del Edén).
 * No se mete el nombre de la sección porque inventaría un formato que no usa
 * nadie; si dos secciones coinciden en ubicación, el consecutivo de abajo las
 * separa igual que hoy.
 */
function folioGenerico(clavePanteon: string, manzana: string, lote: string): string {
  const limpia = (v: string) => v.trim().toUpperCase().replace(/[ /]/g, "");
  return `${clavePanteon}-${limpia(manzana)}-${limpia(lote)}`;
}

/**
 * Devuelve un folio libre para la ubicación dada. `tx` es el cliente de Prisma
 * (o el de la transacción en curso), para que la comprobación de unicidad vea
 * lo que se lleva escrito dentro de la misma transacción.
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

  // El folio es único en la base: si la ubicación ya tuvo título (uno
  // cancelado, por ejemplo) se agrega un consecutivo en vez de fallar.
  let folio = base;
  let n = 2;
  while (await tx.tituloPropiedad.findUnique({ where: { folio }, select: { folio: true } })) {
    folio = `${base}-${n++}`;
  }
  return folio;
}
