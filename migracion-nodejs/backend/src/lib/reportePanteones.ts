export interface PanteonBase {
  panteonId: number;
  nombre: string;
  activo: boolean;
}

export interface LoteBase {
  panteonId: number;
  estado: string;
  esFosaComun: boolean;
  conTituloVigente: boolean;
}

// Solo permisos no cancelados y con lote asignado: sin lote no hay forma de
// saber a qué panteón pertenecen.
export interface PermisoBase {
  clave: string;
  panteonId: number;
  fallecidoId: number | null;
}

export interface FilaPanteon {
  panteonId: number;
  nombre: string;
  lotes: number;
  ocupados: number;
  disponibles: number;
  fosaComun: number;
  conTitulo: number;
  sepulturas: number;
  exhumaciones: number;
  cenizas: number;
  construcciones: number;
  sepultados: number;
}

// Foto del estado actual de cada panteón: inventario de lotes y trámites
// acumulados. "Sepultados" son las personas con permiso de sepultura o de
// depósito de cenizas en ese panteón que no han sido exhumadas (misma regla que
// /lotes/:id/ocupantes, pero por panteón).
export function resumenPorPanteon(panteones: PanteonBase[], lotes: LoteBase[], permisos: PermisoBase[]): FilaPanteon[] {
  const exhumados = new Set(permisos.filter((p) => p.clave === "EXH" && p.fallecidoId !== null).map((p) => p.fallecidoId as number));

  return panteones.map((pan) => {
    const suyos = lotes.filter((l) => l.panteonId === pan.panteonId);
    const tramites = permisos.filter((p) => p.panteonId === pan.panteonId);
    const cuenta = (clave: string) => tramites.filter((p) => p.clave === clave).length;

    const sepultados = new Set(
      tramites
        .filter((p) => (p.clave === "SEP" || p.clave === "CEN") && p.fallecidoId !== null && !exhumados.has(p.fallecidoId))
        .map((p) => p.fallecidoId as number)
    );

    return {
      panteonId: pan.panteonId,
      nombre: pan.activo ? pan.nombre : `${pan.nombre} (inactivo)`,
      lotes: suyos.length,
      ocupados: suyos.filter((l) => l.estado === "OCUPADO").length,
      disponibles: suyos.filter((l) => l.estado === "DISPONIBLE").length,
      fosaComun: suyos.filter((l) => l.esFosaComun).length,
      conTitulo: suyos.filter((l) => l.conTituloVigente).length,
      sepulturas: cuenta("SEP"),
      exhumaciones: cuenta("EXH"),
      cenizas: cuenta("CEN"),
      construcciones: cuenta("CON"),
      sepultados: sepultados.size,
    };
  });
}
