// Borra la sección "PRUEBA-TEST" creada al verificar el catálogo de
// secciones desde Administración. Solo borra si el nombre coincide exacto y
// no tiene nada más colgando (no debería, es una tabla nueva sin relaciones
// entrantes, pero se checa por si acaso).
//
// Uso: npx tsx scripts/eliminar-seccion-prueba.ts [--dry-run]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const seccion = await prisma.seccion.findFirst({ where: { nombre: "PRUEBA-TEST" }, include: { panteon: true } });
  if (!seccion) {
    console.log("La sección PRUEBA-TEST ya no existe. Nada que hacer.");
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Se elimina: sección "${seccion.nombre}" (id ${seccion.seccionId}) de ${seccion.panteon.nombre}`);
  if (dryRun) return;

  await prisma.seccion.delete({ where: { seccionId: seccion.seccionId } });
  console.log("Eliminada.");
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
