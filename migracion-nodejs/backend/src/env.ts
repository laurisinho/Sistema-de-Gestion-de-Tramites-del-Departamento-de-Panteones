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
if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");
}
