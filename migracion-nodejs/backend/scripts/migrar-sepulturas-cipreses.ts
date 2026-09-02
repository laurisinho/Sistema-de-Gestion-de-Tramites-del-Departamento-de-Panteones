// Registra en la base las sepulturas que el Excel del departamento documenta
// en la columna DIFUNTO de Cipreses / Monumentos y que no estaban capturadas.
//
// Por indicacion del departamento, cuando una celda trae varios nombres
// ("TEODOSIO COTA Y ELVA GRIJALVA DE COTA") se deja tal cual en un solo
// registro de fallecido, sin partirlos.
//
// El Excel de Monumentos no trae columna de fecha, asi que estos permisos
// quedan sin fecha de solicitud. El solicitante es el titular vigente del lote,
// que es lo que corresponde y lo mismo que hicieron las migraciones previas.
//
// Uso: npx tsx scripts/migrar-sepulturas-cipreses.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface FilaSepultura {
  manzana: string;
  lote: string;
  difunto: string;
  titular: string;
  difuntos_en_bd: string[];
}

function recorta(v: string, max: number): string {
  return v.trim().slice(0, max);
}

function normaliza(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

// El Excel escribe el numero pelon ("4") donde la base guarda "4-B": en
// Monumentos el sufijo -B solo distingue de la seccion Jardines. Se compara en
// forma canonica para no fallar por esa diferencia de escritura.
function canonLote(v: string): string {
  let s = normaliza(v).replace(/\s+/g, "");
  const m = /^(\d+)-?([A-Z][A-Z-]*)$/.exec(s);
  if (m) s = `${parseInt(m[1], 10)}-${m[2]}`;
  else if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  if (s.endsWith("-B") && s.length > 2) s = s.slice(0, -2);
  return s;
}

async function generarFolioPermiso(clave: string, tipoTramiteId: number): Promise<string> {
  const permisos = await prisma.permiso.findMany({ where: { tipoTramiteId }, select: { folio: true } });
  let max = 0;
  for (const { folio } of permisos) {
    const ultimo = folio.split("-").pop() ?? "";
    if (/^\d+$/.test(ultimo)) max = Math.max(max, parseInt(ultimo, 10));
  }
  let siguiente = max + 1;
  for (;;) {
    const folio = `${clave}-${String(siguiente).padStart(4, "0")}`;
    if (!(await prisma.permiso.findUnique({ where: { folio } }))) return folio;
    siguiente++;
  }
}

async function main() {
  const filas: FilaSepultura[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_pay_sepulturas.json"), "utf-8")
  );

  const panteon = await prisma.panteon.findFirstOrThrow({ where: { clave: "PC" } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  const tipoSep = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "SEP" } });

  const reporte = {
    permisosCreados: 0,
    fallecidosCreados: 0,
    omitidos: [] as { manzana: string; lote: string; motivo: string }[],
  };

  // Se traen todos los lotes de Monumentos una sola vez y se emparejan en
  // memoria por (manzana, lote canonico).
  const todos = await prisma.lote.findMany({
    where: { panteonId: panteon.panteonId, seccion: { startsWith: "MONUMENTOS" } },
    include: {
      titulos: { where: { estado: "VIGENTE" }, take: 1 },
      permisos: { include: { fallecido: true } },
    },
  });
  const porUbicacion = new Map<string, (typeof todos)[number]>();
  for (const l of todos) {
    porUbicacion.set(`${canonLote(l.numeroManzana)}|${canonLote(l.numeroLote)}`, l);
  }

  for (const f of filas) {
    const lote = porUbicacion.get(`${canonLote(f.manzana)}|${canonLote(f.lote)}`);
    if (!lote) {
      reporte.omitidos.push({ manzana: f.manzana, lote: f.lote, motivo: "el lote no existe" });
      continue;
    }
    // Si ese difunto ya esta en el lote, no se duplica (permite re-correr el script).
    const yaEsta = lote.permisos.some(
      (p) => p.fallecido && normaliza(p.fallecido.nombreCompleto) === normaliza(f.difunto)
    );
    if (yaEsta) {
      reporte.omitidos.push({ manzana: f.manzana, lote: f.lote, motivo: "el difunto ya estaba registrado" });
      continue;
    }
    const titulo = lote.titulos[0];
    if (!titulo) {
      reporte.omitidos.push({ manzana: f.manzana, lote: f.lote, motivo: "el lote no tiene titulo vigente (falta solicitante)" });
      continue;
    }

    console.log(`${dryRun ? "[dry-run] " : ""}Mz ${f.manzana} L ${f.lote} -> ${f.difunto.slice(0, 52)}`);
    if (dryRun) { reporte.permisosCreados++; reporte.fallecidosCreados++; continue; }

    await prisma.$transaction(async (tx) => {
      const fallecido = await tx.fallecido.create({
        data: { nombreCompleto: recorta(f.difunto, 200) },
      });
      const folio = await generarFolioPermiso(tipoSep.clave, tipoSep.tipoTramiteId);
      await tx.permiso.create({
        data: {
          tipoTramiteId: tipoSep.tipoTramiteId,
          loteId: lote.loteId,
          solicitanteId: titulo.titularId,
          fallecidoId: fallecido.fallecidoId,
          folio,
          usuarioRegistroId: admin.usuarioId,
          estado: "APROBADO",
        },
      });
      reporte.fallecidosCreados++;
      reporte.permisosCreados++;
    });

    if (lote.estado !== "OCUPADO") {
      await prisma.lote.update({ where: { loteId: lote.loteId }, data: { estado: "OCUPADO" } });
    }
  }

  console.log("\n--- Reporte ---");
  console.log(JSON.stringify({ ...reporte, omitidos: reporte.omitidos.length }, null, 2));
  if (reporte.omitidos.length) {
    console.log("\nOmitidos por motivo:");
    const porMotivo = new Map<string, number>();
    for (const o of reporte.omitidos) porMotivo.set(o.motivo, (porMotivo.get(o.motivo) ?? 0) + 1);
    for (const [m, n] of porMotivo) console.log(`   ${n}x  ${m}`);
  }
  if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, "reporte_sepulturas.json"), JSON.stringify(reporte, null, 2), "utf-8");
  }
}

main()
  .catch((err) => { console.error("ERROR FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
