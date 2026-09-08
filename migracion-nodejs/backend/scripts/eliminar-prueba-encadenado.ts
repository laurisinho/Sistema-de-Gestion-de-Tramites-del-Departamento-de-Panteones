// Elimina el titulo, lote y persona de prueba creados al verificar el paso
// encadenado "titulo emitido -> permiso de sepultura":
//   titulo PJE-TEST-98-TEST-1  lote 7012 (Jardines del Eden, TEST-SECCION/TEST-98/TEST-1)
//   titular "PRUEBA ENCADENADO TITULAR"
//
// Solo borra si todo coincide exactamente con lo esperado y el lote no tiene
// nada mas colgando (permisos, cesiones, incidencias, reconocimientos).
//
// Uso: npx tsx scripts/eliminar-prueba-encadenado.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const FOLIO_ESPERADO = "PJE-TEST-98-TEST-1";
const TITULAR_ESPERADO = "PRUEBA ENCADENADO TITULAR";
const MANZANA_ESPERADA = "TEST-98";
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

  const colgado =
    titulo.lote.permisos.length +
    titulo.lote.cesiones.length +
    titulo.lote.incidencias.length +
    titulo.lote.reconocimientos.length +
    titulo.cesiones.length +
    titulo.reimpresiones.length +
    (titulo.lote.titulos.length - 1);
  if (colgado > 0) {
    console.error(`ABORTA: hay ${colgado} registro(s) asociados al lote o al titulo. No se toca.`);
    process.exitCode = 1;
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Se elimina:`);
  console.log(`   titulo ${titulo.folio}  titular="${titulo.titular.nombreCompleto}"`);
  console.log(`   lote ${titulo.loteId}  Mz ${titulo.lote.numeroManzana} L ${titulo.lote.numeroLote} secc. ${titulo.lote.seccion}`);
  console.log(`   persona ${titulo.titularId}`);
  if (dryRun) return;

  await prisma.$transaction(async (tx) => {
    await tx.tituloPropiedad.delete({ where: { tituloId: titulo.tituloId } });
    await tx.lote.delete({ where: { loteId: titulo.loteId } });
    await tx.persona.delete({ where: { personaId: titulo.titularId } });
  });

  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  await registrarBitacora(
    admin.usuarioId,
    Acciones.Eliminar,
    "titulos_propiedad",
    titulo.tituloId,
    `Titulo de prueba eliminado (${FOLIO_ESPERADO}): usado para verificar el paso de titulo a permiso de sepultura`
  );
  console.log("\nEliminado.");
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
