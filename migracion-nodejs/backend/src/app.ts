import "./lib/bigint-json";
import { env } from "./env";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { catalogosRouter } from "./routes/catalogos.routes";
import { lotesRouter } from "./routes/lotes.routes";
import { fallecidosRouter } from "./routes/fallecidos.routes";
import { permisosRouter } from "./routes/permisos.routes";
import { titulosRouter } from "./routes/titulos.routes";
import { cesionesRouter } from "./routes/cesiones.routes";
import { noReclamadosRouter } from "./routes/noreclamados.routes";
import { incidenciasRouter } from "./routes/incidencias.routes";
import { reportesRouter } from "./routes/reportes.routes";
import { reimpresionesRouter } from "./routes/reimpresiones.routes";
import { bitacoraRouter } from "./routes/bitacora.routes";
import { usuariosRouter } from "./routes/usuarios.routes";
import { administracionRouter } from "./routes/administracion.routes";
import { aparienciaRouter } from "./routes/apariencia.routes";

export const app = express();

// La API corre detrás de proxies. Sin esta configuración req.ip devolvería la
// dirección del último proxy para todos los clientes: la bitácora registraría
// siempre la misma IP y el límite de intentos por dirección afectaría a todo el
// departamento. Se confía en un número fijo de saltos (TRUST_PROXY) y no en toda
// la cadena, para que un cliente no pueda falsear X-Forwarded-For.
app.set("trust proxy", env.trustProxy);

// Se oculta la cabecera X-Powered-By para no revelar la tecnología del servidor.
app.disable("x-powered-by");

// Los logos (PUT /apariencia/logo/:cual) viajan como data URI base64 y pesan
// hasta ~2.7 MB codificados. Este límite más grande se registra ANTES que el
// genérico y solo para esa ruta: como Express corre los `use` en el orden en
// que coinciden, si el genérico fuera primero rechazaría el cuerpo (o lo
// truncaría) antes de que la ruta específica tuviera oportunidad de aplicar su
// propio límite. body-parser no vuelve a leer un cuerpo ya parseado, así que
// el genérico de abajo no hace nada en esta ruta.
app.use("/api/administracion/apariencia/logo", express.json({ limit: "3mb" }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: env.frontendOrigin, credentials: true }));

app.use("/api/auth", authRouter);
app.use("/api/catalogos", catalogosRouter);
app.use("/api/lotes", lotesRouter);
app.use("/api/fallecidos", fallecidosRouter);
app.use("/api/permisos", permisosRouter);
app.use("/api/titulos", titulosRouter);
app.use("/api/cesiones", cesionesRouter);
app.use("/api/no-reclamados", noReclamadosRouter);
app.use("/api/incidencias", incidenciasRouter);
app.use("/api/reportes", reportesRouter);
app.use("/api/reimpresiones", reimpresionesRouter);
app.use("/api/bitacora", bitacoraRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/administracion", administracionRouter);
app.use("/api/apariencia", aparienciaRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Último recurso: cualquier error no atrapado en una ruta (p. ej. base de datos
// caída) responde aquí en lugar de dejar la petición colgada. Un cuerpo
// demasiado grande o un JSON mal formado llegan aquí como error de
// body-parser, con su propio `status`; se respeta en vez de convertirlo
// siempre en 500, para que el cliente sepa que el problema fue lo que mandó.
const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 500;
  if (status >= 400 && status < 500) {
    const mensaje = err?.type === "entity.too.large" ? "El archivo enviado es demasiado grande." : "La solicitud no se pudo interpretar.";
    return res.status(status).json({ error: mensaje });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
};
app.use(manejadorErrores);
