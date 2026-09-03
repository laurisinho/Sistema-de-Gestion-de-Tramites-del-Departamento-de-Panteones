// Elimina el lote de prueba PJE-100-102 (loteId 6997), capturado al probar el
// formulario de Nuevo Titulo: su titular es "aaaaaaaaaaaa" y su seccion quedo
// como "Terrazas" en minusculas, duplicando la seccion TERRAZAS real de los 61
// lotes migrados.
//
// Antes de borrar comprueba que no tenga nada colgado (permisos, cesiones,
// incidencias, reconocimientos, reimpresiones); si encontrara algo se detiene.
// La persona del titulo tambien se borra, pero solo si no esta referenciada en
// ningun otro lado.
//
// Uso: npx tsx scripts/eliminar-lote-prueba.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const LOTE_ID = 6997;
const CLAVE_ESPERADA = "PJE-100-102";
const TITULAR_ESPERADO = "aaaaaaaaaaaa";

async function main() {
  const lote = await prisma.lote.findUnique({
    where: { loteId: LOTE_ID },
    include: {
      titulos: { include: { titular: true, cesiones: true, reimpresiones: true } },
      permisos: true,
      cesiones: true,
      incidencias: true,
      reconocimientos: true,
    },
  });
  if (!lote) { console.log(`El lote ${LOTE_ID} ya no existe. Nada que hacer.`); return; }

  // Salvaguardas: solo se borra si es exactamente el registro de prueba.
  if (lote.claveLegado !== CLAVE_ESPERADA) {
    console.error(`ABORTA: el lote ${LOTE_ID} tiene clave "${lote.claveLegado}", se esperaba "${CLAVE_ESPERADA}".`);
    process.exitCode = 1; return;
  }
  const colgado =
    lote.permisos.length + lote.cesiones.length + lote.incidencias.length + lote.reconocimientos.length +
    lote.titulos.reduce((a, t) => a + t.cesiones.length + t.reimpresiones.length, 0);
  if (colgado > 0) {
    console.error(`ABORTA: el lote tiene ${colgado} registro(s) asociados. No es un lote vacio de prueba.`);
    process.exitCode = 1; return;
  }
  const titular = lote.titulos[0]?.titular;
  if (titular && titular.nombreCompleto.trim() !== TITULAR_ESPERADO) {
    console.error(`ABORTA: el titular es "${titular.nombreCompleto}", se esperaba "${TITULAR_ESPERADO}".`);
    process.exitCode = 1; return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Se elimina:`);
  console.log(`   lote ${lote.loteId}  clave=${lote.claveLegado}  seccion="${lote.seccion}"  Mz ${lote.numeroManzana} L ${lote.numeroLote}`);
  for (const t of lote.titulos) console.log(`   titulo ${t.folio}  titular="${t.titular.nombreCompleto}"`);
  if (dryRun) return;

  // La persona solo se borra si no la usa nadie mas.
  let personaId: number | null = null;
  if (titular) {
    const otros = await prisma.persona.findUnique({
      where: { personaId: titular.personaId },
      select: { _count: { select: { titulos: true, permisos: true, cesionesCedente: true, cesionesCesionario: true } } },
    });
    const usos = otros
      ? otros._count.titulos + otros._count.permisos + otros._count.cesionesCedente + otros._count.cesionesCesionario
      : 0;
    if (usos <= 1) personaId = titular.personaId;
    else console.log(`   (la persona ${titular.personaId} se conserva: la usan ${usos} registros)`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tituloPropiedad.deleteMany({ where: { loteId: LOTE_ID } });
    await tx.lote.delete({ where: { loteId: LOTE_ID } });
    if (personaId) await tx.persona.delete({ where: { personaId } });
  });

  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  await registrarBitacora(
    admin.usuarioId, Acciones.Eliminar, "lotes", LOTE_ID,
    `Lote de prueba eliminado (${CLAVE_ESPERADA}, titular "${TITULAR_ESPERADO}"): su seccion "Terrazas" duplicaba a TERRAZAS`
  );
  console.log("\nEliminado.");
}

main()
  .catch((err) => { console.error("ERROR FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
