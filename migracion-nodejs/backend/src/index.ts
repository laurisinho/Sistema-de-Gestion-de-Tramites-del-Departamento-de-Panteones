import { app } from "./app";
import { env } from "./env";

const servidor = app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}`);
});

// Evita que un rechazo no capturado fuera de una ruta (p. ej. un error de
// conexión a la base) tumbe el proceso.
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

process.on("SIGTERM", () => servidor.close());
