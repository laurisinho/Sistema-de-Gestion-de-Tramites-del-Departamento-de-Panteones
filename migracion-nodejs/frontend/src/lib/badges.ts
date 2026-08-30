const CLASES: Record<string, string> = {
  APROBADO: "badge-success",
  VIGENTE: "badge-success",
  ACTIVO: "badge-success",
  ATENDIDA: "badge-success",
  IDENTIFICADA: "badge-success",
  CANCELADO: "badge-danger",
  RECHAZADO: "badge-danger",
  PENDIENTE: "badge-warning",
  PENDIENTE_ENTREGA: "badge-warning",
  REPORTADA: "badge-warning",
  EN_PROCESO: "badge-info",
  ENTREGADO: "badge-success",
  DISPONIBLE: "badge-success",
  OCUPADO: "badge-guinda",
  FOSA_COMUN: "badge-warning",
  CEDIDO: "badge-info",
  INACTIVO: "badge-secondary",
};

export function claseEstado(estado: string): string {
  return `badge ${CLASES[estado] ?? "badge-secondary"}`;
}
