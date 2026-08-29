import { prisma } from "./prisma";

// Mismas claves que Services/Acciones en el proyecto .NET original.
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
} as const;

// La auditoría nunca debe tumbar la operación del usuario -- igual que
// BitacoraService.RegistrarAsync en el .NET original, nunca lanza excepción.
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
    // silencioso a propósito
  }
}
