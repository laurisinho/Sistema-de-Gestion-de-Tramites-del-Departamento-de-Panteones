import "dotenv/config";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (revisa .env / .env.example)`);
  return valor;
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: requerida("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  // Ruta al Chromium del sistema para generar los PDF (imagen de Docker). Si no
  // se define, producción usa @sparticuz/chromium.
  chromiumPath: process.env.CHROMIUM_PATH || undefined,
  // Número de proxies delante de la API, para que req.ip sea la dirección del
  // cliente. En local no hay ninguno; se ajusta con TRUST_PROXY según la
  // infraestructura.
  trustProxy: Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? 3 : 0)),
};

// Igual que Program.cs en el sistema original: en producción no se arranca con
// una llave JWT por defecto o demasiado corta. El valor de .env.example es
// público, por lo que también se rechaza por coincidencia exacta.
if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");
}
if (env.isProduction && env.jwtSecret === "cambia-esto-por-una-llave-de-al-menos-32-caracteres") {
  throw new Error("JWT_SECRET sigue siendo el valor de ejemplo de .env.example -- genera uno propio.");
}
