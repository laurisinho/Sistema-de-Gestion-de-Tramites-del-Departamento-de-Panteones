// Separa "Jardín de los Cipreses - Jardines y Monumentos" (panteón 7) en dos
// panteones distintos, como los maneja el departamento en la practica.
//
// Reparto acordado con el departamento:
//   Monumentos <- MONUMENTOS, MONUMENTOS AMPLIACION, CAPILLA
//   Jardines   <- JARDINES, TRASPASO y los lotes sin seccion
//
// El panteon 7 se queda como el de Jardines (conserva id y clave PC) y los
// lotes de monumentos se mudan a uno nuevo. Se mueve solo `lotes.panteonId`:
// titulos, permisos y cesiones cuelgan del lote, asi que viajan con el. Las
// incidencias son lo unico que apunta al panteon directo y hoy no hay ninguna
// en el 7 (se verifica antes de tocar nada).
//
// Los folios NO cambian: generarFolio deduce el prefijo de las claves
// historicas del mismo panteon+seccion, y como cada seccion se muda completa,
// el conjunto del que deduce es identico al de antes.
//
// Es idempotente: si ya esta separado, no hace nada.
//
// Uso: npx tsx scripts/separar-cipreses.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const PANTEON_ORIGEN = 7;
const NOMBRE_ESPERADO = "Jardín de los Cipreses - Jardines y Monumentos";
const NOMBRE_JARDINES = "Jardín de los Cipreses - Jardines";
const NOMBRE_MONUMENTOS = "Jardín de los Cipreses - Monumentos";
const CLAVE_MONUMENTOS = "PCM";
const SECCIONES_MONUMENTOS = ["MONUMENTOS", "MONUMENTOS AMPLIACION", "CAPILLA"];

async function main() {
  const origen = await prisma.panteon.findUnique({ where: { panteonId: PANTEON_ORIGEN } });
  if (!origen) {
    console.error(`ABORTA: no existe el panteón ${PANTEON_ORIGEN}.`);
    process.exitCode = 1;
    return;
  }

  const yaSeparado = await prisma.panteon.findFirst({ where: { nombre: NOMBRE_MONUMENTOS } });
  if (yaSeparado) {
    console.log(`Ya existe "${NOMBRE_MONUMENTOS}" (id ${yaSeparado.panteonId}). Nada que hacer.`);
    return;
  }

  if (origen.nombre !== NOMBRE_ESPERADO) {
    console.error(`ABORTA: el panteón ${PANTEON_ORIGEN} se llama "${origen.nombre}", se esperaba "${NOMBRE_ESPERADO}".`);
    process.exitCode = 1;
    return;
  }

  // Nada mas debe apuntar al panteón: si aparecieran incidencias habria que
  // repartirlas tambien, y eso no lo decide un script.
  const incidencias = await prisma.incidencia.count({ where: { panteonId: PANTEON_ORIGEN } });
  if (incidencias > 0) {
    console.error(`ABORTA: hay ${incidencias} incidencia(s) apuntando al panteón; hay que repartirlas a mano primero.`);
    process.exitCode = 1;
    return;
  }

  const claveOcupada = await prisma.panteon.findFirst({ where: { clave: CLAVE_MONUMENTOS } });
  if (claveOcupada) {
    console.error(`ABORTA: la clave ${CLAVE_MONUMENTOS} ya la usa "${claveOcupada.nombre}".`);
    process.exitCode = 1;
    return;
  }

  const porSeccion = await prisma.lote.groupBy({
    by: ["seccion"],
    where: { panteonId: PANTEON_ORIGEN },
    _count: true,
  });
  const aMonumentos = porSeccion.filter((s) => s.seccion && SECCIONES_MONUMENTOS.includes(s.seccion));
  const seQuedan = porSeccion.filter((s) => !s.seccion || !SECCIONES_MONUMENTOS.includes(s.seccion));
  const totalMonumentos = aMonumentos.reduce((a, s) => a + s._count, 0);
  const totalJardines = seQuedan.reduce((a, s) => a + s._count, 0);

  console.log(`${dryRun ? "[dry-run] " : ""}Separación de "${origen.nombre}" (${totalMonumentos + totalJardines} lotes):\n`);
  console.log(`  "${NOMBRE_JARDINES}"  (id ${PANTEON_ORIGEN}, clave ${origen.clave}) <- ${totalJardines} lotes`);
  for (const s of seQuedan) console.log(`      ${s.seccion ?? "(sin sección)"}: ${s._count}`);
  console.log(`  "${NOMBRE_MONUMENTOS}"  (nuevo, clave ${CLAVE_MONUMENTOS}) <- ${totalMonumentos} lotes`);
  for (const s of aMonumentos) console.log(`      ${s.seccion}: ${s._count}`);
  if (dryRun) return;

  const resultado = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.panteon.create({
      data: {
        nombre: NOMBRE_MONUMENTOS,
        clave: CLAVE_MONUMENTOS,
        usaColindancias: origen.usaColindancias,
        direccion: origen.direccion,
        activo: origen.activo,
      },
    });
    const movidos = await tx.lote.updateMany({
      where: { panteonId: PANTEON_ORIGEN, seccion: { in: SECCIONES_MONUMENTOS } },
      data: { panteonId: nuevo.panteonId },
    });
    await tx.panteon.update({ where: { panteonId: PANTEON_ORIGEN }, data: { nombre: NOMBRE_JARDINES } });
    return { nuevo, movidos: movidos.count };
  });

  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  await registrarBitacora(
    admin.usuarioId,
    Acciones.Editar,
    "panteones",
    resultado.nuevo.panteonId,
    `Panteón "${NOMBRE_ESPERADO}" separado en dos: "${NOMBRE_JARDINES}" (id ${PANTEON_ORIGEN}) y "${NOMBRE_MONUMENTOS}" (id ${resultado.nuevo.panteonId}, ${resultado.movidos} lotes: ${SECCIONES_MONUMENTOS.join(", ")})`
  );

  const quedanJardines = await prisma.lote.count({ where: { panteonId: PANTEON_ORIGEN } });
  const quedanMonumentos = await prisma.lote.count({ where: { panteonId: resultado.nuevo.panteonId } });
  console.log(`\nHecho. Jardines (id ${PANTEON_ORIGEN}): ${quedanJardines} lotes | Monumentos (id ${resultado.nuevo.panteonId}): ${quedanMonumentos} lotes.`);
  if (quedanJardines !== totalJardines || quedanMonumentos !== totalMonumentos) {
    console.error("ATENCION: los totales no coinciden con lo previsto.");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
