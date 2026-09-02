// Corrige 2 lotes que quedaron con el titular equivocado por el orden en que se
// corrieron dos scripts previos.
//
// Que paso: corregir-notacion-cipreses renombro el lote (p. ej. Mz 2 "28-B" ->
// "28-BIS") y despues actualizar-titulares-cipreses, cuyo listado se habia
// calculado sobre la foto ANTERIOR al renombre, le asigno el titular que el
// Excel tiene para el numero viejo. Resultado: el lote quedo con el nombre
// nuevo pero con el dueño del numero anterior.
//
// Aqui se le pone a cada uno el titular que el Excel indica para el numero que
// hoy tiene. Los lotes que quedaron "libres" (Mz 2 L28 y Mz 15 L1) salen como
// faltantes en el reporte y se crean aparte, no aqui.
//
// Uso: npx tsx scripts/corregir-cruce-notacion-titular.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const CORRECCIONES = [
  { loteId: 2291, manzana: "2", lote: "28-BIS", titularCorrecto: "LETICIA MADA DE VILLA" },
  { loteId: 2928, manzana: "15", lote: "1-A", titularCorrecto: "OCTAVIO VELARDE ROBLES" },
];

async function main() {
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  let hechos = 0;

  for (const c of CORRECCIONES) {
    const titulo = await prisma.tituloPropiedad.findFirst({
      where: { loteId: c.loteId, estado: "VIGENTE" },
      include: { titular: true, lote: true },
    });
    if (!titulo) { console.log(`Mz ${c.manzana} L ${c.lote}: sin titulo vigente, se omite`); continue; }

    if (titulo.lote.numeroLote !== c.lote) {
      console.log(`Mz ${c.manzana}: el lote ${c.loteId} ahora se llama '${titulo.lote.numeroLote}', esperaba '${c.lote}'. Se omite por seguridad.`);
      continue;
    }
    const anterior = titulo.titular.nombreCompleto;
    if (anterior.trim().toUpperCase() === c.titularCorrecto.toUpperCase()) {
      console.log(`Mz ${c.manzana} L ${c.lote}: ya tiene el titular correcto`); continue;
    }

    console.log(`${dryRun ? "[dry-run] " : ""}Mz ${c.manzana} L ${c.lote} (${titulo.folio})`);
    console.log(`     antes: ${anterior}`);
    console.log(`     ahora: ${c.titularCorrecto}`);
    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      const nueva = await tx.persona.create({ data: { nombreCompleto: c.titularCorrecto } });
      await tx.tituloPropiedad.update({ where: { tituloId: titulo.tituloId }, data: { titularId: nueva.personaId } });
    });
    await registrarBitacora(
      admin.usuarioId, Acciones.Editar, "titulos_propiedad", titulo.tituloId,
      `Correccion: el titular no correspondia al numero de lote tras renombrarlo ` +
      `(Mz ${c.manzana}, L ${c.lote}, Monumentos): "${anterior}" -> "${c.titularCorrecto}"`
    );
    hechos++;
  }
  console.log(`\nCorregidos: ${hechos}`);
}

main()
  .catch((err) => { console.error("ERROR FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
