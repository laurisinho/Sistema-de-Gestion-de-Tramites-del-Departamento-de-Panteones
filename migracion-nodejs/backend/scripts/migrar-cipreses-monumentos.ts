// Importa los lotes de la seccion MONUMENTOS (Jardin de los Cipreses) que
// aparecen en "BASE DE DATOS JARDIN DE LOS CIPRESES,SECCION MONUMENTOS KRIS.xlsx"
// y no existian en la base.
//
// Convencion de clave verificada contra los 1,526 lotes ya migrados (854 casos,
// 0 excepciones): cuando la misma manzana/lote ya existe en la seccion JARDINES,
// el lote de MONUMENTOS lleva sufijo "-B" para no chocar de clave. Si el folio
// resultante siguiera ocupado se le agrega "-2", "-3"... igual que hace
// TitulosController al emitir un titulo (src/routes/titulos.routes.ts).
//
// Uso: npx tsx scripts/migrar-cipreses-monumentos.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface FilaNueva {
  clave: string;
  manzana: string;
  lote: string;
  lote_excel: string;
  sufijo_b: boolean;
  titular: string;
  telefono: string | null;
  difunto: string | null;
  expediente: string | null;
}

function limpio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

// telefono es VARCHAR(25) y varias celdas traen dos numeros ("631-... O 631-...").
// Cortar a ciegas dejaria un numero incompleto, asi que se toma el primero.
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

// "LOTE DE RESERVA" / "LOTE VACIO" no son personas sepultadas.
function esDifuntoReal(n: string | null): boolean {
  if (!n) return false;
  return !/^\s*(LOTE\s+(DE\s+RESERVA|VACIO|BALDIO)|SIN\s+NOMBRE|VACIO|RESERVA)\s*$/i.test(n);
}

async function folioLibre(base: string): Promise<string> {
  let folio = base;
  let n = 2;
  while (await prisma.tituloPropiedad.findUnique({ where: { folio } })) folio = `${base}-${n++}`;
  return folio;
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
  const filas: FilaNueva[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_pay_nuevos.json"), "utf-8")
  );

  const panteon = await prisma.panteon.findFirstOrThrow({ where: { clave: "PC" } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  const tipoSep = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "SEP" } });
  const tipoLote = await prisma.tipoLote.findFirstOrThrow({ where: { nombre: "Lote" } });

  const reporte = {
    lotesCreados: 0, titulosCreados: 0, permisosCreados: 0,
    omitidos: [] as { clave: string; motivo: string }[],
    foliosAjustados: [] as { pedido: string; usado: string }[],
  };

  for (const f of filas) {
    // Nadie debe ocupar ya esa ubicacion dentro de MONUMENTOS.
    const ocupado = await prisma.lote.findFirst({
      where: {
        panteonId: panteon.panteonId,
        seccion: { startsWith: "MONUMENTOS" },
        numeroManzana: f.manzana,
        numeroLote: f.lote,
      },
    });
    if (ocupado) {
      reporte.omitidos.push({ clave: f.clave, motivo: `la ubicacion ya existe (loteId ${ocupado.loteId})` });
      console.log(`${dryRun ? "[dry-run] " : ""}${f.clave} -> OMITIDO, ubicacion ocupada`);
      continue;
    }

    const folio = await folioLibre(f.clave);
    if (folio !== f.clave) reporte.foliosAjustados.push({ pedido: f.clave, usado: folio });

    const conDifunto = esDifuntoReal(f.difunto);
    console.log(
      `${dryRun ? "[dry-run] " : ""}${folio} -> Mz ${f.manzana} L ${f.lote}` +
        `${f.sufijo_b ? " (sufijo -B por coincidir con Jardines)" : ""}` +
        `; titular: ${f.titular}` +
        `; ${conDifunto ? `permiso SEP para ${f.difunto}` : "sin permiso"}`
    );

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      const lote = await tx.lote.create({
        data: {
          panteonId: panteon.panteonId,
          tipoLoteId: tipoLote.tipoLoteId,
          numeroManzana: f.manzana,
          numeroLote: f.lote,
          seccion: "MONUMENTOS",
          dimensiones: "1.50 m de frente por 2.50 m de largo",
          claveLegado: folio,
          estado: "OCUPADO",
        },
      });
      reporte.lotesCreados++;

      const titular = await tx.persona.create({
        data: {
          nombreCompleto: recorta(f.titular, 200)!,
          telefono: telefonoCorto(f.telefono),
          identificacionTipo: limpio(f.expediente) ? "EXPEDIENTE" : undefined,
          identificacionNumero: recorta(f.expediente, 50),
        },
      });

      await tx.tituloPropiedad.create({
        data: {
          loteId: lote.loteId,
          titularId: titular.personaId,
          folio,
          usuarioEmitioId: admin.usuarioId,
          estado: "VIGENTE",
          estadoEntrega: "PENDIENTE_ENTREGA",
        },
      });
      reporte.titulosCreados++;

      if (!conDifunto) return;

      const fallecido = await tx.fallecido.create({ data: { nombreCompleto: recorta(f.difunto, 200)! } });
      const folioPermiso = await generarFolioPermiso(tipoSep.clave, tipoSep.tipoTramiteId);
      await tx.permiso.create({
        data: {
          tipoTramiteId: tipoSep.tipoTramiteId,
          loteId: lote.loteId,
          solicitanteId: titular.personaId,
          fallecidoId: fallecido.fallecidoId,
          folio: folioPermiso,
          usuarioRegistroId: admin.usuarioId,
          estado: "APROBADO",
        },
      });
      reporte.permisosCreados++;
    });
  }

  console.log("\n--- Reporte ---");
  console.log(JSON.stringify(reporte, null, 2));
  if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, "reporte_cipreses_nuevos.json"), JSON.stringify(reporte, null, 2), "utf-8");
  }
}

main()
  .catch((err) => { console.error("ERROR FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
