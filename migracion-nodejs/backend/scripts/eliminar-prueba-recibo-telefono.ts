// Elimina el titulo, lote y persona de prueba creados al verificar el numero
// de recibo en Titulo de Propiedad y el encadenado telefono -> Permiso:
//   titulo PJE-TEST-97-TEST-1  lote (Jardines del Eden, TEST-SECCION/TEST-97/TEST-1)
//   titular "PRUEBA RECIBO TITULAR"
//
// Solo borra si todo coincide exactamente con lo esperado y el lote no tiene
// nada mas colgando (permisos, cesiones, incidencias, reconocimientos).
//
// Uso: npx tsx scripts/eliminar-prueba-recibo-telefono.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const FOLIO_ESPERADO = "PJE-TEST-97-TEST-1";
const TITULAR_ESPERADO = "PRUEBA RECIBO TITULAR";
const MANZANA_ESPERADA = "TEST-97";
const LOTE_ESPERADO = "TEST-1";

async function main() {
  const titulo = await prisma.tituloPropiedad.findUnique({
    where: { folio: FOLIO_ESPERADO },
    include: {
      titular: true,
      cesiones: true,
      reimpresiones: true,
      lote: { include: { permisos: true, cesiones: true, incidencias: true, reconocimientos: true, titulos: true } },
    },
  });

  if (!titulo) {
    console.log(`El titulo ${FOLIO_ESPERADO} ya no existe. Nada que hacer.`);
    return;
  }

  if (titulo.titular.nombreCompleto !== TITULAR_ESPERADO) {
    console.error(`ABORTA: el titular es "${titulo.titular.nombreCompleto}", se esperaba "${TITULAR_ESPERADO}".`);
    process.exitCode = 1;
    return;
  }
  if (titulo.lote.numeroManzana !== MANZANA_ESPERADA || titulo.lote.numeroLote !== LOTE_ESPERADO) {
    console.error(`ABORTA: el lote es Mz ${titulo.lote.numeroManzana} L ${titulo.lote.numeroLote}, no es el de prueba.`);
    process.exitCode = 1;
    return;
  }

  // Se creo un permiso de sepultura al probar el encadenado; tambien es de
  // prueba y se borra junto con lo demas (a diferencia del script anterior,
  // aqui SI se espera encontrarlo).
  const permisosDePrueba = await prisma.permiso.findMany({
    where: { loteId: titulo.loteId },
    include: { solicitante: true },
  });
  const permisosNoReconocidos = permisosDePrueba.filter((p) => !p.solicitante.nombreCompleto.startsWith("PRUEBA"));
  if (permisosNoReconocidos.length > 0) {
    console.error(`ABORTA: hay ${permisosNoReconocidos.length} permiso(s) que no son de prueba en este lote.`);
    process.exitCode = 1;
    return;
  }

  const colgado =
    titulo.lote.cesiones.length +
    titulo.lote.incidencias.length +
    titulo.lote.reconocimientos.length +
    titulo.cesiones.length +
    titulo.reimpresiones.length +
    (titulo.lote.titulos.length - 1);
  if (colgado > 0) {
    console.error(`ABORTA: hay ${colgado} registro(s) asociados al lote o al titulo (fuera de los permisos de prueba). No se toca.`);
    process.exitCode = 1;
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Se elimina:`);
  console.log(`   titulo ${titulo.folio}  titular="${titulo.titular.nombreCompleto}"  recibo="${titulo.numeroRecibo}"`);
  for (const p of permisosDePrueba) console.log(`   permiso ${p.permisoId} ${p.folio}  solicitante="${p.solicitante.nombreCompleto}"`);
  console.log(`   lote ${titulo.loteId}  Mz ${titulo.lote.numeroManzana} L ${titulo.lote.numeroLote} secc. ${titulo.lote.seccion}`);
  console.log(`   persona ${titulo.titularId}`);
  if (dryRun) return;

  const solicitantesDePrueba = [...new Set(permisosDePrueba.map((p) => p.solicitanteId))];

  await prisma.$transaction(async (tx) => {
    await tx.permiso.deleteMany({ where: { loteId: titulo.loteId } });
    await tx.tituloPropiedad.delete({ where: { tituloId: titulo.tituloId } });
    await tx.lote.delete({ where: { loteId: titulo.loteId } });
    await tx.persona.delete({ where: { personaId: titulo.titularId } });
    for (const id of solicitantesDePrueba) {
      if (id === titulo.titularId) continue;
      await tx.persona.delete({ where: { personaId: id } }).catch(() => {});
    }
  });

  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  await registrarBitacora(
    admin.usuarioId,
    Acciones.Eliminar,
    "titulos_propiedad",
    titulo.tituloId,
    `Registros de prueba eliminados (${FOLIO_ESPERADO}): usados para verificar numero de recibo y el encadenado de telefono a Permisos`
  );
  console.log("\nEliminado.");
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
