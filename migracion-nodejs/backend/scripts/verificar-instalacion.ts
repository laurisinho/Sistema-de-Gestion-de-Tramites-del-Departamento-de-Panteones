// Autodiagnóstico de una instalación: base de datos, migraciones, datos base,
// usuario admin y generación de PDF (lo que más se rompe en un servidor nuevo).
// Sale con código distinto de 0 si algo falla.
//
//   docker compose exec api npx tsx scripts/verificar-instalacion.ts
import { PrismaClient } from "@prisma/client";
import { renderPdf, cerrarNavegadorPdf } from "../src/lib/pdf";

const prisma = new PrismaClient();
let fallos = 0;

function ok(texto: string) {
  console.log(`  [OK]    ${texto}`);
}
function mal(texto: string, detalle?: unknown) {
  fallos++;
  console.log(`  [FALLA] ${texto}`);
  if (detalle) console.log(`          ${detalle instanceof Error ? detalle.message : String(detalle)}`);
}

async function main() {
  console.log("Verificando la instalación...\n");

  try {
    await prisma.$queryRaw`select 1`;
    ok("Conexión con la base de datos");
  } catch (e) {
    mal("Conexión con la base de datos", e);
    return; // sin base no tiene caso seguir
  }

  try {
    const migs = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from _prisma_migrations where finished_at is not null`;
    Number(migs[0].n) > 0 ? ok(`Migraciones aplicadas: ${migs[0].n}`) : mal("No hay migraciones aplicadas (falta `prisma migrate deploy`)");
  } catch (e) {
    mal("Tabla de migraciones", e);
  }

  try {
    const [roles, panteones, admins, lotes] = await Promise.all([
      prisma.rol.count(),
      prisma.panteon.count(),
      prisma.usuario.count({ where: { rol: { nombre: "Administrador" }, activo: true } }),
      prisma.lote.count(),
    ]);
    roles >= 4 ? ok(`Roles: ${roles}`) : mal(`Faltan roles (hay ${roles}, se esperan 4): corre el seed o importa los datos`);
    panteones >= 1 ? ok(`Panteones: ${panteones}`) : mal("No hay panteones: corre el seed o importa los datos");
    admins >= 1 ? ok(`Administradores activos: ${admins}`) : mal("No hay ningún Administrador activo: nadie podrá entrar");
    ok(`Lotes registrados: ${lotes}${lotes === 0 ? " (instalación vacía, normal si no se importaron datos)" : ""}`);
  } catch (e) {
    mal("Lectura de datos base", e);
  }

  try {
    const pdf = await renderPdf("<html><body><h1>Verificación</h1></body></html>");
    pdf.subarray(0, 4).toString() === "%PDF" && pdf.length > 500
      ? ok(`Generación de PDF (${pdf.length} bytes)`)
      : mal("La generación de PDF devolvió algo que no es un PDF válido");
  } catch (e) {
    mal("Generación de PDF (¿Chromium instalado? ¿variable CHROMIUM_PATH?)", e);
  }
}

main()
  .catch((e) => mal("Error inesperado", e))
  .finally(async () => {
    await cerrarNavegadorPdf().catch(() => {});
    await prisma.$disconnect();
    console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} problema(s) encontrado(s).`);
    process.exit(fallos === 0 ? 0 : 1);
  });
