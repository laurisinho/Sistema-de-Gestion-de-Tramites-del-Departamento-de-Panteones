import type { Prisma } from "@prisma/client";

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
