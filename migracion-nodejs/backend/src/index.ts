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

const app = express();

// La API corre detrás del proxy de la plataforma de hospedaje. Sin esto,
// req.ip devuelve la dirección del proxy para todo el mundo: la bitácora
// registraría siempre la misma IP y el límite de intentos por dirección
// dejaría fuera a todo el departamento en cuanto una sola persona fallara
// varias veces. Se confía únicamente en el primer salto (el proxy), no en
// toda la cadena de X-Forwarded-For, que el cliente sí puede falsificar.
app.set("trust proxy", 1);

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

// TEMPORAL: para calibrar cuántos saltos de proxy hay delante de la API.
// Solo devuelve la dirección de quien llama; se quita en cuanto se ajuste.
app.get("/api/health/proxy", (req, res) => {
  res.json({
    ip: req.ip,
    xForwardedFor: req.headers["x-forwarded-for"] ?? null,
    socket: req.socket.remoteAddress ?? null,
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Red de seguridad: cualquier error no atrapado en una ruta (p. ej. la base de
// datos caída) cae aquí en vez de dejar la request colgada o tumbar el proceso.
const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
};
app.use(manejadorErrores);

const servidor = app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}`);
});

// Evita que un error de conexión a la base de datos (o cualquier rechazo no
// capturado en algún punto fuera de una ruta) tumbe el proceso completo.
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

process.on("SIGTERM", () => servidor.close());
