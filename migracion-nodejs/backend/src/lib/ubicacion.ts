import type { Prisma } from "@prisma/client";
import { variantesManzana } from "./romanos";

/**
 * Filtro para saber si una ubicación ya está ocupada dentro de un panteón
 * (alta de un título nuevo).
 *
 * Incluye la sección porque también forma parte de la restricción de unicidad
 * de la base (@@unique([panteonId, seccion, numeroManzana, numeroLote])): la
 * misma manzana y lote pueden repetirse entre secciones. Está en su propia
 * función para poder probarla sin base de datos.
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

// "ANG" (Angelitos) no es un valor real de lotes.seccion: esos lotes están en
// ADEII con manzana "ANGELITOS" (así los reconoce folio.ts). Esta función
// permite elegir "ANG" en los buscadores como si fuera una sección más. No debe
// usarse al crear un lote: guardar "ANG" como sección rompería el folio.
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
  // Texto en cualquiera de las cuatro colindancias, para los panteones sin
  // manzana y lote formales.
  colindancia?: string;
}

/**
 * Condiciones de lote para los buscadores de Títulos y Permisos. Se devuelven
 * como lista para combinarlas con AND (`lote: { AND: [...] }`); en un solo
 * objeto se pisarían entre sí (por ejemplo, "ANG" ya fija numeroManzana).
 *
 * Manzana y lote usan "contiene", igual que Lotes > Buscar.
 */
export function filtrosLoteBusqueda(f: FiltroUbicacionBusqueda): Prisma.LoteWhereInput[] {
  const filtros: Prisma.LoteWhereInput[] = [];
  if (f.panteonId) filtros.push({ panteonId: f.panteonId });
  if (f.seccion) filtros.push(whereSeccion(f.seccion));
  if (f.manzana) {
    // Hay secciones que capturaron la manzana en romano ("XVI") y otras en arábigo
    // ("16") para el mismo número.
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
