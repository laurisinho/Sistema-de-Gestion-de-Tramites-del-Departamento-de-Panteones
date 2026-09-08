// Elimina los permisos, lotes, personas y fallecidos de prueba creados al
// verificar la funcion "sin titulo registrado" (permisos.routes.ts):
//   permiso 1854 SEP-1763  lote 7010 (De los Heroes, S/N 109)
//   permiso 1855 SEP-1764  lote 7011 (Jardines del Eden, TEST-SECCION/TEST-99/TEST-1)
//   permiso 1856 CEN-0005  mismo lote 7011 (probaba que reutiliza el lote ya creado)
//
// Antes de borrar comprueba que cada registro sea exactamente el de prueba
// esperado (folio, nombre); si algo no coincide se detiene sin tocar nada.
//
// Uso: npx tsx scripts/eliminar-pruebas-sin-registro.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const PERMISOS_ESPERADOS: Record<number, string> = {
  1854: "SEP-1763",
  1855: "SEP-1764",
  1856: "CEN-0005",
};
const LOTES_ESPERADOS: Record<number, { panteonId: number; numeroManzana: string; numeroLote: string }> = {
  7010: { panteonId: 3, numeroManzana: "S/N", numeroLote: "109" },
  7011: { panteonId: 1, numeroManzana: "TEST-99", numeroLote: "TEST-1" },
};

async function main() {
  const permisos = await prisma.permiso.findMany({
    where: { permisoId: { in: Object.keys(PERMISOS_ESPERADOS).map(Number) } },
    include: { solicitante: true, fallecido: true },
  });

  if (permisos.length === 0) {
    console.log("Ninguno de los permisos de prueba existe ya. Nada que hacer.");
    return;
  }

  for (const p of permisos) {
    if (p.folio !== PERMISOS_ESPERADOS[p.permisoId]) {
      console.error(`ABORTA: permiso ${p.permisoId} tiene folio "${p.folio}", se esperaba "${PERMISOS_ESPERADOS[p.permisoId]}".`);
      process.exitCode = 1;
      return;
    }
    if (!p.solicitante.nombreCompleto.startsWith("PRUEBA SIN REGISTRO")) {
      console.error(`ABORTA: el solicitante del permiso ${p.permisoId} es "${p.solicitante.nombreCompleto}", no parece de prueba.`);
      process.exitCode = 1;
      return;
    }
  }

  const loteIds = [...new Set(permisos.map((p) => p.loteId).filter((id): id is number => id != null))];
  const lotes = await prisma.lote.findMany({
    where: { loteId: { in: loteIds } },
    include: { titulos: true, cesiones: true, incidencias: true, reconocimientos: true, permisos: true },
  });

  for (const l of lotes) {
    const esperado = LOTES_ESPERADOS[l.loteId];
    if (!esperado || l.panteonId !== esperado.panteonId || l.numeroManzana !== esperado.numeroManzana || l.numeroLote !== esperado.numeroLote) {
      console.error(`ABORTA: el lote ${l.loteId} no coincide con lo esperado.`);
      process.exitCode = 1;
      return;
    }
    const permisosAjenos = l.permisos.filter((p) => !(p.permisoId in PERMISOS_ESPERADOS));
    const colgado = l.titulos.length + l.cesiones.length + l.incidencias.length + l.reconocimientos.length + permisosAjenos.length;
    if (colgado > 0) {
      console.error(`ABORTA: el lote ${l.loteId} tiene ${colgado} registro(s) ajenos a la prueba. No se toca.`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Se elimina:`);
  for (const p of permisos) {
    console.log(`   permiso ${p.permisoId} ${p.folio}  solicitante="${p.solicitante.nombreCompleto}"  fallecido="${p.fallecido?.nombreCompleto ?? "(ninguno)"}"`);
  }
  for (const l of lotes) console.log(`   lote ${l.loteId}  Mz ${l.numeroManzana} L ${l.numeroLote}`);
  if (dryRun) return;

  const personaIds = [...new Set(permisos.map((p) => p.solicitanteId))];
  const fallecidoIds = [...new Set(permisos.map((p) => p.fallecidoId).filter((id): id is number => id != null))];

  await prisma.$transaction(async (tx) => {
    await tx.permiso.deleteMany({ where: { permisoId: { in: permisos.map((p) => p.permisoId) } } });
    await tx.lote.deleteMany({ where: { loteId: { in: loteIds } } });
    await tx.persona.deleteMany({ where: { personaId: { in: personaIds } } });
    await tx.fallecido.deleteMany({ where: { fallecidoId: { in: fallecidoIds } } });
  });

  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  await registrarBitacora(
    admin.usuarioId,
    Acciones.Eliminar,
    "permisos",
    undefined,
    `Permisos de prueba eliminados (${permisos.map((p) => p.folio).join(", ")}): usados para verificar la funcion "sin titulo registrado"`
  );
  console.log("\nEliminado.");
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
