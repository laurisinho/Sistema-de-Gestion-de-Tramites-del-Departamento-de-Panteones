import type { Prisma } from "@prisma/client";
import { variantesManzana } from "./romanos";

/**
 * El filtro con el que se busca si una ubicación ya está ocupada dentro de un
 * panteón, para el alta de un título nuevo.
 *
 * La sección entra en el filtro a propósito: también entra en la restricción
 * de unicidad de la base (@@unique([panteonId, seccion, numeroManzana,
 * numeroLote])). Las secciones existen justamente para que la misma
 * numeración de manzana y lote se repita entre ellas -- omitir la sección
 * aquí hacía que 52 ubicaciones que hoy conviven en dos secciones (47 en
 * Jardines del Edén, 5 en Cipreses) quedaran imposibles de dar de alta,
 * aunque la base sí las admite. Se separó en su propia función para poder
 * probar este filtro sin levantar la base de datos.
 */
export function whereUbicacionLote(
  panteonId: number,
  seccion: string | null,
  numeroManzana: string,
  numeroLote: string
): Prisma.LoteWhereInput {
  return {
    panteonId,
    seccion,
    numeroManzana,
    numeroLote,
  };
}

// "ANG" (Angelitos) no es un valor real de lotes.seccion: esos lotes viven
// dentro de ADEII con manzana "ANGELITOS" -- así es como folio.ts los
// reconoce para darles su propio folio PJE-ANG-#. Esta función deja elegir
// "ANG" en cualquier buscador como si fuera una sección más, sin tocar cómo
// se guardan los datos. Nunca debe usarse al CREAR un lote: si "ANG" se
// guardara como sección literal, folio.ts dejaría de reconocerlo como ADEII.
export const SECCION_VIRTUAL_ANGELITOS = "ANG";

export function whereSeccion(seccion: string): Prisma.LoteWhereInput {
  if (seccion.toUpperCase() === SECCION_VIRTUAL_ANGELITOS) {
    return { seccion: "ADEII", numeroManzana: { contains: "ANGEL", mode: "insensitive" } };
  }
  return { seccion };
}

export interface FiltroUbicacionBusqueda {
  panteonId?: number;
  seccion?: string;
  manzana?: string;
  lote?: string;
  // Texto que se busca en cualquiera de las cuatro colindancias (norte, sur,
  // este, oeste), para los panteones que no tienen manzana/lote formal.
  colindancia?: string;
}

/**
 * Condiciones de lote para los buscadores de Títulos y Permisos. Se devuelven
 * como lista para combinarlas con AND (`lote: { AND: [...] }`): puestas como
 * llaves de un mismo objeto se pisarían entre sí -- por ejemplo "ANG" ya fija
 * numeroManzana, y una manzana tecleada aparte lo sobrescribiría.
 *
 * Manzana y lote van con "contiene" (como Lotes > Buscar): "3" también trae
 * 13 o 33, pero así "1A" o "XVI" se encuentran aunque no se teclee completo.
 */
export function filtrosLoteBusqueda(f: FiltroUbicacionBusqueda): Prisma.LoteWhereInput[] {
  const filtros: Prisma.LoteWhereInput[] = [];
  if (f.panteonId) filtros.push({ panteonId: f.panteonId });
  if (f.seccion) filtros.push(whereSeccion(f.seccion));
  if (f.manzana) {
    // Algunas secciones antiguas capturaron la manzana en romano (p. ej.
    // "XVI") y otras en arábigo ("16") para el mismo número real.
    filtros.push({
      OR: variantesManzana(f.manzana).map((v) => ({ numeroManzana: { contains: v, mode: "insensitive" as const } })),
    });
  }
  if (f.lote) filtros.push({ numeroLote: { contains: f.lote, mode: "insensitive" } });
  if (f.colindancia) {
    filtros.push({
      OR: [
        { colindanciaNorte: { contains: f.colindancia, mode: "insensitive" } },
        { colindanciaSur: { contains: f.colindancia, mode: "insensitive" } },
        { colindanciaEste: { contains: f.colindancia, mode: "insensitive" } },
        { colindanciaOeste: { contains: f.colindancia, mode: "insensitive" } },
      ],
    });
  }
  return filtros;
}
