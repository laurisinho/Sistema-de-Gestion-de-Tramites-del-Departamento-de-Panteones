// Alinea la escritura del numero de lote de la base con la del Excel del
// departamento en Cipreses / Monumentos (p. ej. la base guarda "28-B" donde el
// Excel dice "28-BIS"). Es el mismo lote y el mismo titular: solo cambia como
// esta escrito el numero.
//
// Antes de escribir se verifica que la ubicacion destino este libre dentro de
// la seccion; si estuviera ocupada se omite (no se pisa a nadie). El caso
// Mz 22 "45A" -> "45-B" ya quedo fuera de la lista por chocar con un par
// duplicado que se decidio dejar como esta.
//
// Uso: npx tsx scripts/corregir-notacion-cipreses.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface FilaNotacion {
  loteId: number;
  manzana: string;
  lote_actual: string;
  lote_nuevo: string;
  titular: string | null;
}

async function main() {
  const filas: FilaNotacion[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_pay_notacion.json"), "utf-8")
  );
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  const reporte = { actualizados: 0, omitidos: [] as { loteId: number; motivo: string }[] };

  for (const f of filas) {
    const lote = await prisma.lote.findUnique({ where: { loteId: f.loteId } });
    if (!lote) {
      reporte.omitidos.push({ loteId: f.loteId, motivo: "el lote ya no existe" });
      continue;
    }
    if (lote.numeroLote === f.lote_nuevo) {
      reporte.omitidos.push({ loteId: f.loteId, motivo: "ya estaba con la escritura nueva" });
      continue;
    }
    const ocupada = await prisma.lote.findFirst({
      where: {
        panteonId: lote.panteonId, seccion: lote.seccion,
        numeroManzana: lote.numeroManzana, numeroLote: f.lote_nuevo,
        loteId: { not: lote.loteId },
      },
    });
    if (ocupada) {
      reporte.omitidos.push({ loteId: f.loteId, motivo: `la ubicacion destino ya la ocupa el lote ${ocupada.loteId}` });
      console.log(`${dryRun ? "[dry-run] " : ""}Mz ${f.manzana} '${f.lote_actual}' -> '${f.lote_nuevo}' :: OMITIDO (ocupada)`);
      continue;
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}Mz ${f.manzana} lote '${lote.numeroLote}' -> '${f.lote_nuevo}'` +
      `  (titular: ${f.titular ?? "-"})`
    );
    if (dryRun) continue;

    await prisma.lote.update({ where: { loteId: lote.loteId }, data: { numeroLote: f.lote_nuevo } });
    await registrarBitacora(
      admin.usuarioId, Acciones.Editar, "lotes", lote.loteId,
      `Numero de lote alineado con el Excel del departamento: "${lote.numeroLote}" -> "${f.lote_nuevo}" (Mz ${f.manzana}, Monumentos)`
    );
    reporte.actualizados++;
  }

  console.log("\n--- Reporte ---");
  console.log(JSON.stringify(reporte, null, 2));
  if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, "reporte_notacion.json"), JSON.stringify(reporte, null, 2), "utf-8");
  }
}

main()
  .catch((err) => { console.error("ERROR FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
