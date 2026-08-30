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
};

// Misma protección que Program.cs tenía en el proyecto .NET: nunca arrancar en
// producción con una llave por defecto o demasiado corta para firmar JWT.
// El valor de .env.example es público (el repo lo es) -- que sea "largo" no
// lo hace secreto, así que se rechaza también por coincidencia exacta.
if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");
}
if (env.isProduction && env.jwtSecret === "cambia-esto-por-una-llave-de-al-menos-32-caracteres") {
  throw new Error("JWT_SECRET sigue siendo el valor de ejemplo de .env.example -- genera uno propio.");
}
