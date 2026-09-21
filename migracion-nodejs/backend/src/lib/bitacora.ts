import { prisma } from "./prisma";

// Mismas claves que Services/Acciones del sistema original.
export const Acciones = {
  Login: "LOGIN",
  Logout: "LOGOUT",
  Crear: "CREAR",
  Editar: "EDITAR",
  Cancelar: "CANCELAR",
  Eliminar: "ELIMINAR",
  Imprimir: "IMPRIMIR",
  Reimprimir: "REIMPRIMIR",
  Ceder: "CEDER",
  Entrega: "ENTREGA",
  Reconocer: "RECONOCER",
  Liberar: "LIBERAR",
  // Nueva: el sistema original no limitaba los intentos de acceso.
  Bloqueo: "BLOQUEO",
} as const;

// El registro de auditoría nunca debe interrumpir la operación del usuario
// (igual que BitacoraService.RegistrarAsync del sistema original).
export async function registrarBitacora(
  usuarioId: number | null,
  accion: string,
  tabla?: string,
  registroId?: number,
  descripcion?: string,
  ip?: string
): Promise<void> {
  try {
    await prisma.bitacora.create({
      data: {
        usuarioId,
        accion,
        tabla: tabla ?? null,
        registroId: registroId ?? null,
        descripcion: descripcion ?? null,
        ipAcceso: ip === "::1" ? "127.0.0.1" : (ip ?? null),
      },
    });
  } catch {
    // El error se ignora para no afectar la operación.
  }
}
