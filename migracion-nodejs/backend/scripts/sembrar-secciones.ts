// Precarga el catálogo de Secciones (Administración) con lo que ya está en
// uso en lotes -- sin esto, el <select> estricto al dar de alta un lote
// nuevo empezaría vacío en cada panteón hasta que alguien recapturara a mano
// cada sección que ya existe. No toca Lote.seccion ni nada más; solo llena
// la tabla nueva. Idempotente: correrlo dos veces no duplica nada
// (skipDuplicates, más el filtro contra lo que ya esté dado de alta).
//
// Uso: npx tsx scripts/sembrar-secciones.ts [--dry-run]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const lotes = await prisma.lote.findMany({
    where: { seccion: { not: null } },
    select: { panteonId: true, seccion: true },
    distinct: ["panteonId", "seccion"],
  });

  // Misma normalización que aplica el alta manual en Administración
  // (nombreSeccionSchema en administracion.routes.ts): trim + mayúsculas.
  const candidatas = new Map<string, { panteonId: number; nombre: string }>();
  for (const l of lotes) {
    const nombre = l.seccion!.trim().toUpperCase();
    if (!nombre) continue;
    candidatas.set(`${l.panteonId}::${nombre}`, { panteonId: l.panteonId, nombre });
  }

  const existentes = await prisma.seccion.findMany({ select: { panteonId: true, nombre: true } });
  const yaExiste = new Set(existentes.map((s) => `${s.panteonId}::${s.nombre}`));

  const nuevas = [...candidatas.entries()].filter(([clave]) => !yaExiste.has(clave)).map(([, v]) => v);

  const panteones = await prisma.panteon.findMany({ select: { panteonId: true, nombre: true } });
  const nombrePanteon = new Map(panteones.map((p) => [p.panteonId, p.nombre]));

  console.log(`${dryRun ? "[dry-run] " : ""}${nuevas.length} sección(es) nueva(s) por dar de alta:`);
  for (const n of nuevas) {
    console.log(`   ${nombrePanteon.get(n.panteonId) ?? n.panteonId} -> ${n.nombre}`);
  }
  if (nuevas.length === 0 || dryRun) return;

  const resultado = await prisma.seccion.createMany({ data: nuevas, skipDuplicates: true });
  console.log(`\nCreadas: ${resultado.count}`);
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
