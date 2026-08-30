import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requiereAuth, requiereRol } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";

// El original .NET nunca llegó a construir este módulo -- el menú traía un
// "Usuarios (pronto)" deshabilitado (_Layout.cshtml). No hay vista ni
// controlador que portar; esto es una pantalla nueva sobre el modelo Usuario/Rol
// que la autenticación ya usaba. Solo un Administrador puede entrar aquí.
export const usuariosRouter = Router();
usuariosRouter.use(requiereAuth, requiereRol("Administrador"));

function str(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

const SELECT_SEGURO = {
  usuarioId: true,
  nombreUsuario: true,
  nombreCompleto: true,
  email: true,
  activo: true,
  fechaAlta: true,
  ultimoAcceso: true,
  rol: { select: { rolId: true, nombre: true } },
} satisfies Prisma.UsuarioSelect;

usuariosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const rolId = req.query.rolId ? Number(req.query.rolId) : undefined;
    const activo = req.query.activo === "true" ? true : req.query.activo === "false" ? false : undefined;

    const usuarios = await prisma.usuario.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { nombreUsuario: { contains: q, mode: "insensitive" } },
                { nombreCompleto: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(rolId ? { rolId } : {}),
        ...(activo !== undefined ? { activo } : {}),
      },
      select: SELECT_SEGURO,
      orderBy: { nombreCompleto: "asc" },
    });

    res.json({ usuarios });
  })
);

usuariosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const usuario = await prisma.usuario.findUnique({
      where: { usuarioId: Number(req.params.id) },
      select: SELECT_SEGURO,
    });
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ usuario });
  })
);

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.");

const nuevoUsuarioSchema = z.object({
  nombreUsuario: z
    .string()
    .trim()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres.")
    .regex(/^[a-zA-Z0-9._-]+$/, "El nombre de usuario solo puede usar letras, números, punto, guion y guion bajo."),
  nombreCompleto: z.string().trim().min(1, "El nombre completo es obligatorio."),
  email: z.string().optional(),
  rolId: z.coerce.number().int({ message: "Selecciona un rol." }),
  password: passwordSchema,
});

usuariosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseo = nuevoUsuarioSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    const rol = await prisma.rol.findUnique({ where: { rolId: vm.rolId } });
    if (!rol) return res.status(400).json({ error: "El rol seleccionado no existe." });

    const passwordHash = await bcrypt.hash(vm.password, 12);

    let usuario;
    try {
      usuario = await prisma.usuario.create({
        data: {
          nombreUsuario: vm.nombreUsuario,
          nombreCompleto: vm.nombreCompleto,
          email: str(vm.email),
          rolId: vm.rolId,
          passwordHash,
        },
        select: SELECT_SEGURO,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Ya existe un usuario con el nombre "${vm.nombreUsuario}".` });
      }
      throw err;
    }

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Crear,
      "usuarios",
      usuario.usuarioId,
      `Usuario ${usuario.nombreUsuario} (${rol.nombre}) creado`,
      req.ip
    );

    res.status(201).json({ usuario });
  })
);

const editarUsuarioSchema = z.object({
  nombreCompleto: z.string().trim().min(1, "El nombre completo es obligatorio."),
  email: z.string().optional(),
  rolId: z.coerce.number().int({ message: "Selecciona un rol." }),
});

usuariosRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.usuario.findUnique({ where: { usuarioId: id } });
    if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });

    const parseo = editarUsuarioSchema.safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }
    const vm = parseo.data;

    const rol = await prisma.rol.findUnique({ where: { rolId: vm.rolId } });
    if (!rol) return res.status(400).json({ error: "El rol seleccionado no existe." });

    const usuario = await prisma.usuario.update({
      where: { usuarioId: id },
      data: { nombreCompleto: vm.nombreCompleto, email: str(vm.email), rolId: vm.rolId },
      select: SELECT_SEGURO,
    });

    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "usuarios", id, `Usuario ${usuario.nombreUsuario} editado`, req.ip);

    res.json({ usuario });
  })
);

usuariosRouter.patch(
  "/:id/password",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.usuario.findUnique({ where: { usuarioId: id } });
    if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });

    const parseo = z.object({ password: passwordSchema }).safeParse(req.body);
    if (!parseo.success) {
      return res.status(400).json({ error: parseo.error.issues[0]?.message ?? "Datos inválidos" });
    }

    const passwordHash = await bcrypt.hash(parseo.data.password, 12);
    await prisma.usuario.update({ where: { usuarioId: id }, data: { passwordHash } });

    await registrarBitacora(
      req.usuario!.usuarioId,
      Acciones.Editar,
      "usuarios",
      id,
      `Contraseña de ${existente.nombreUsuario} restablecida`,
      req.ip
    );

    res.json({ ok: true });
  })
);

// Antes de apagar una cuenta: nunca la propia (te deja fuera a media sesión)
// ni al último Administrador activo (deja el sistema sin nadie que pueda
// volver a dar de alta a alguien). Puerto de ninguna regla del original --
// es la salvaguarda mínima que cualquier alta de usuarios necesita.
async function bloqueoDesactivar(id: number, solicitanteId: number): Promise<string | null> {
  if (id === solicitanteId) return "No puedes desactivar tu propia cuenta.";

  const usuario = await prisma.usuario.findUnique({ where: { usuarioId: id }, include: { rol: true } });
  if (usuario?.rol.nombre === "Administrador") {
    const otrosAdminsActivos = await prisma.usuario.count({
      where: { activo: true, usuarioId: { not: id }, rol: { nombre: "Administrador" } },
    });
    if (otrosAdminsActivos === 0) return "No puedes desactivar al último administrador activo.";
  }
  return null;
}

usuariosRouter.post(
  "/:id/desactivar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.usuario.findUnique({ where: { usuarioId: id } });
    if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });

    const bloqueo = await bloqueoDesactivar(id, req.usuario!.usuarioId);
    if (bloqueo) return res.status(400).json({ error: bloqueo });

    await prisma.usuario.update({ where: { usuarioId: id }, data: { activo: false } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Cancelar, "usuarios", id, `Usuario ${existente.nombreUsuario} desactivado`, req.ip);

    res.json({ ok: true });
  })
);

usuariosRouter.post(
  "/:id/activar",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existente = await prisma.usuario.findUnique({ where: { usuarioId: id } });
    if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });

    await prisma.usuario.update({ where: { usuarioId: id }, data: { activo: true } });
    await registrarBitacora(req.usuario!.usuarioId, Acciones.Editar, "usuarios", id, `Usuario ${existente.nombreUsuario} reactivado`, req.ip);

    res.json({ ok: true });
  })
);
