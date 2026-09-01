import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Cada regla corrige el campo `seccion` de lotes cuya `claveLegado` ya trae el
// código de sección incrustado (p.ej. "PJE-AMP-15-09") pero donde `seccion`
// quedó null o con una variante de escritura distinta a la usada por el resto
// del mismo grupo. Detectado a partir de un análisis puntual pedido por el
// usuario ("PJE-AMP-15-09, Amp siendo la seccion, asi con todos").
const reglas: { descripcion: string; where: any; seccionNueva: string }[] = [
  {
    descripcion: 'PJE-AMP-14-* / PJE-AMP-15-*: seccion null -> "AMP" (coincide con manzanas 1-13 de la misma seccion)',
    where: { OR: [{ claveLegado: { startsWith: "PJE-AMP-14-" } }, { claveLegado: { startsWith: "PJE-AMP-15-" } }] },
    seccionNueva: "AMP",
  },
  {
    descripcion: 'seccion "ADE II" (con espacio) -> "ADEII" (normaliza con el resto del grupo PJE-ADEII-*)',
    where: { seccion: "ADE II" },
    seccionNueva: "ADEII",
  },
  {
    descripcion: 'seccion "ASEII" (typo) -> "ADEII"',
    where: { seccion: "ASEII" },
    seccionNueva: "ADEII",
  },
  {
    descripcion: 'PJE-ADEII-16 (loteId 6598, manzana XVI lote 89): seccion null -> "ADEII"',
    where: { loteId: 6598 },
    seccionNueva: "ADEII",
  },
  {
    descripcion: 'PJE-ANG-33 (loteId 6811, manzana ANGELITOS): seccion null -> "ADEII" (coincide con el resto de ANGELITOS)',
    where: { loteId: 6811 },
    seccionNueva: "ADEII",
  },
  {
    descripcion: 'PJE-IND-12 (loteId 6641, manzana IND): seccion null -> "AMP" (coincide con el resto de IND)',
    where: { loteId: 6641 },
    seccionNueva: "AMP",
  },
  {
    descripcion: 'PJE-ANEXO-*: seccion null -> "ANEXO" (seccion propia, nunca se asigno)',
    where: { claveLegado: { startsWith: "PJE-ANEXO-" } },
    seccionNueva: "ANEXO",
  },
];

async function main() {
  let totalActualizados = 0;
  let totalConflictos = 0;

  for (const regla of reglas) {
    const filas = await prisma.lote.findMany({
      where: regla.where,
      select: { loteId: true, panteonId: true, claveLegado: true, seccion: true, numeroManzana: true, numeroLote: true },
    });

    console.log(`\n--- ${regla.descripcion} ---`);
    console.log(`Filas afectadas: ${filas.length}`);

    const conflictos: typeof filas = [];
    const aplicables: typeof filas = [];

    for (const fila of filas) {
      if (fila.seccion === regla.seccionNueva) continue; // ya está bien, nada que hacer
      const choque = await prisma.lote.findFirst({
        where: {
          panteonId: fila.panteonId,
          seccion: regla.seccionNueva,
          numeroManzana: fila.numeroManzana,
          numeroLote: fila.numeroLote,
          loteId: { not: fila.loteId },
        },
        select: { loteId: true },
      });
      if (choque) {
        conflictos.push(fila);
      } else {
        aplicables.push(fila);
      }
    }

    if (conflictos.length > 0) {
      console.log(`  CONFLICTOS (ya existe otro lote con esa ubicacion+seccion, no se tocan): ${conflictos.length}`);
      for (const c of conflictos) {
        console.log(`    loteId=${c.loteId} clave="${c.claveLegado}" manzana="${c.numeroManzana}" lote="${c.numeroLote}"`);
      }
      totalConflictos += conflictos.length;
    }

    console.log(`  A actualizar: ${aplicables.length}`);
    if (!DRY_RUN && aplicables.length > 0) {
      const result = await prisma.lote.updateMany({
        where: { loteId: { in: aplicables.map((f) => f.loteId) } },
        data: { seccion: regla.seccionNueva },
      });
      console.log(`  Actualizados: ${result.count}`);
      totalActualizados += result.count;
    } else {
      totalActualizados += aplicables.length;
    }
  }

  console.log(`\n=== Resumen ${DRY_RUN ? "(dry-run, sin escribir)" : ""} ===`);
  console.log(`Total a actualizar: ${totalActualizados}`);
  console.log(`Total en conflicto (omitidos): ${totalConflictos}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
