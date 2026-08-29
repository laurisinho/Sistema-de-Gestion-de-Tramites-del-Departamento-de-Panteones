import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { COOKIE_NAME, cookieOpciones, firmarToken, requiereAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { Acciones, registrarBitacora } from "../lib/bitacora";

export const authRouter = Router();

const loginSchema = z.object({
  nombreUsuario: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parseo = loginSchema.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
  const { nombreUsuario, password } = parseo.data;

  const usuario = await prisma.usuario.findFirst({
    where: { nombreUsuario, activo: true },
    include: { rol: true },
  });

  if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  await prisma.usuario.update({
    where: { usuarioId: usuario.usuarioId },
    data: { ultimoAcceso: new Date() },
  });

  const token = firmarToken({
    usuarioId: usuario.usuarioId,
    nombreUsuario: usuario.nombreUsuario,
    nombreCompleto: usuario.nombreCompleto,
    rol: usuario.rol.nombre,
  });

  res.cookie(COOKIE_NAME, token, cookieOpciones(req));

  await registrarBitacora(usuario.usuarioId, Acciones.Login, "usuarios", usuario.usuarioId, `Inicio de sesión de ${usuario.nombreCompleto}`, req.ip);

  res.json({
    usuario: {
      usuarioId: usuario.usuarioId,
      nombreUsuario: usuario.nombreUsuario,
      nombreCompleto: usuario.nombreCompleto,
      rol: usuario.rol.nombre,
    },
  });
}));

authRouter.post("/logout", requiereAuth, asyncHandler(async (req, res) => {
  await registrarBitacora(req.usuario!.usuarioId, Acciones.Logout, undefined, undefined, "Cierre de sesión", req.ip);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}));

// Necesario porque React no tiene, como Razor, el usuario disponible del lado
// del servidor en cada render: la SPA pregunta quién es al cargar la app.
authRouter.get("/me", requiereAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});
