// Actualiza el titular de los lotes de Cipreses / Monumentos donde el Excel del
// departamento (mas reciente) difiere de lo que tiene la base.
//
// Como se registra el cambio: se crea una PERSONA NUEVA con los datos del Excel
// y se reapunta el titulo vigente hacia ella. NO se renombra la persona anterior
// porque 1,295 personas figuran a la vez como titular y como solicitante de
// permisos ya emitidos: renombrarlas reescribiria retroactivamente quien pidio
// esos permisos y no cuadraria con los PDF ya impresos. Dejando la persona vieja
// en su lugar, el historial de permisos queda intacto y el cambio es reversible.
//
// Cada cambio queda asentado en la bitacora con el titular anterior y el nuevo.
//
// Uso: npx tsx scripts/actualizar-titulares-cipreses.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { Acciones, registrarBitacora } from "../src/lib/bitacora";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface FilaTitular {
  loteId: number;
  manzana: string;
  lote: string;
  clave: string | null;
  titular_actual: string | null;
  titular_nuevo: string;
  telefono: string | null;
  origen: string;
}

function limpio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

// telefono es VARCHAR(25); varias celdas traen dos numeros ("631-... O 631-...").
function telefonoCorto(v: string | null | undefined): string | null {
  const t = limpio(v);
  if (!t) return null;
  if (t.length <= 25) return t;
  const primero = t.split(/\s+O\s+|\s*\/\s*|\s*,\s*/i)[0].trim();
  return (primero.length <= 25 ? primero : primero.slice(0, 25)) || null;
}

function recorta(v: string | null | undefined, max: number): string | null {
  const t = limpio(v);
  return t ? t.slice(0, max) : null;
}

async function main() {
  const filas: FilaTitular[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_pay_titulares.json"), "utf-8")
  );
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });

  const reporte = {
    actualizados: 0,
    omitidos: [] as { loteId: number; motivo: string }[],
    porOrigen: {} as Record<string, number>,
  };

  for (const f of filas) {
    const titulo = await prisma.tituloPropiedad.findFirst({
      where: { loteId: f.loteId, estado: "VIGENTE" },
      include: { titular: true, lote: true },
    });
    if (!titulo) {
      reporte.omitidos.push({ loteId: f.loteId, motivo: "el lote no tiene titulo vigente" });
      continue;
    }
    const anterior = titulo.titular.nombreCompleto;
    if (anterior.trim().toUpperCase() === f.titular_nuevo.trim().toUpperCase()) {
      reporte.omitidos.push({ loteId: f.loteId, motivo: "el titular ya coincide" });
      continue;
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}Mz ${f.manzana} L ${f.lote} (${titulo.folio})` +
      `\n     antes: ${anterior}\n     ahora: ${f.titular_nuevo}`
    );
    if (dryRun) {
      reporte.actualizados++;
      reporte.porOrigen[f.origen] = (reporte.porOrigen[f.origen] ?? 0) + 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const nueva = await tx.persona.create({
        data: {
          nombreCompleto: recorta(f.titular_nuevo, 200)!,
          telefono: telefonoCorto(f.telefono),
        },
      });
      await tx.tituloPropiedad.update({
        where: { tituloId: titulo.tituloId },
        data: { titularId: nueva.personaId },
      });
    });

    await registrarBitacora(
      admin.usuarioId, Acciones.Editar, "titulos_propiedad", titulo.tituloId,
      `Titular actualizado desde el Excel del departamento (Mz ${f.manzana}, L ${f.lote}, Monumentos): ` +
      `"${anterior}" -> "${f.titular_nuevo}"`
    );
    reporte.actualizados++;
    reporte.porOrigen[f.origen] = (reporte.porOrigen[f.origen] ?? 0) + 1;
  }

  console.log("\n--- Reporte ---");
  console.log(JSON.stringify(reporte, null, 2));
  if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, "reporte_titulares.json"), JSON.stringify(reporte, null, 2), "utf-8");
  }
}

main()
  .catch((err) => { console.error("ERROR FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
