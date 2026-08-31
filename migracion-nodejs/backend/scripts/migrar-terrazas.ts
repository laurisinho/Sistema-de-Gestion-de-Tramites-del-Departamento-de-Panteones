// Importa la Sección Terrazas de Jardines del Edén desde
// "BASE DE DATOS JARDINES DEL EDEN MARZO 2023 - copia.xlsb" (hoja "SECCION
// TERRAZAS"). Esa sección nunca se había migrado -- confirmado antes de correr
// esto: cero lotes con clave "PJE-TRZA..." existían en la base.
//
// Sigue exactamente el mismo camino que tomaría un capturista real usando la
// app (POST /titulos y POST /permisos): mismo folio de título (= claveLegado),
// mismo folio secuencial de permiso (SEP-/CEN-000N), mismos estados
// (OCUPADO/VIGENTE/APROBADO). No usa OVERRIDING SYSTEM VALUE porque estos
// registros no vienen de otro sistema con IDs que haya que preservar -- son
// datos nuevos, Postgres les asigna ID normal.
//
// Uso: npx tsx scripts/migrar-terrazas.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface FilaTerrazas {
  clave: string;
  nombre: string | null;
  direccion: string | null;
  colonia: string | null;
  telefono: number | string | null;
  seccion: string | null;
  manzana: number | string | null;
  lote: number | string | null;
  fecha: number | null;
  estatus: string | null;
  difunto: string | null;
}

function excelFechaAUTC(serial: number | null): Date | null {
  if (!serial) return null;
  // Excel cuenta desde 1899-12-30 (incluye el bug del año bisiesto 1900 que todo el mundo ignora igual).
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
  return new Date(ms);
}

function limpio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function esVacio(nombre: string | null): boolean {
  if (!nombre) return true;
  const n = nombre.trim().toUpperCase();
  return n === "" || n === "LOTE VACIO" || n === "  ";
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
    const existe = await prisma.permiso.findUnique({ where: { folio } });
    if (!existe) return folio;
    siguiente++;
  }
}

async function main() {
  const filas: FilaTerrazas[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_terrazas_raw.json"), "utf-8")
  );

  const panteon = await prisma.panteon.findFirstOrThrow({ where: { clave: "PJE" } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  const tipoSep = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "SEP" } });
  const tipoCen = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "CEN" } });
  const tipoLote = await prisma.tipoLote.findFirstOrThrow({ where: { nombre: "Lote" } });

  const reporte = { lotesCreados: 0, titulosCreados: 0, permisosCreados: 0, omitidos: [] as { clave: string; motivo: string }[] };

  for (const f of filas) {
    const clave = limpio(f.clave);
    if (!clave) continue;

    const yaExiste = await prisma.lote.findFirst({ where: { claveLegado: clave } });
    if (yaExiste) {
      reporte.omitidos.push({ clave, motivo: "claveLegado ya existe en destino" });
      continue;
    }

    const numeroLote = String(f.lote ?? "").trim() || clave.split("-").pop()!.trim();
    const numeroManzana = String(f.manzana ?? "1").trim();
    const nombreTitular = limpio(f.nombre);
    const tieneTitular = !esVacio(nombreTitular);
    const fechaTramite = excelFechaAUTC(f.fecha);
    const esDonacion = /DONAD|DONACION/i.test(f.estatus ?? "");

    console.log(`${dryRun ? "[dry-run] " : ""}${clave} -> lote ${tieneTitular ? "OCUPADO" : "DISPONIBLE"}${tieneTitular ? `, titular: ${nombreTitular}` : ""}`);

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      const lote = await tx.lote.create({
        data: {
          panteonId: panteon.panteonId,
          tipoLoteId: tipoLote.tipoLoteId,
          numeroManzana,
          numeroLote,
          seccion: "TERRAZAS",
          dimensiones: "1.50 m de frente por 2.50 m de largo",
          claveLegado: clave,
          estado: tieneTitular ? "OCUPADO" : "DISPONIBLE",
        },
      });
      reporte.lotesCreados++;

      if (!tieneTitular) return;

      const titular = await tx.persona.create({
        data: {
          nombreCompleto: nombreTitular!,
          domicilio: limpio(f.direccion),
          colonia: limpio(f.colonia),
          telefono: f.telefono ? String(f.telefono) : null,
        },
      });

      await tx.tituloPropiedad.create({
        data: {
          loteId: lote.loteId,
          titularId: titular.personaId,
          folio: clave,
          fechaEmision: fechaTramite,
          usuarioEmitioId: admin.usuarioId,
          estado: "VIGENTE",
          estadoEntrega: "PENDIENTE_ENTREGA",
        },
      });
      reporte.titulosCreados++;

      const nombreDifunto = limpio(f.difunto);
      if (esVacio(nombreDifunto)) return;

      const esCenizas = /CENIZA/i.test(f.estatus ?? "");
      const tipoTramite = esCenizas ? tipoCen : tipoSep;

      const fallecido = await tx.fallecido.create({
        data: { nombreCompleto: nombreDifunto! },
      });

      const folioPermiso = await generarFolioPermiso(tipoTramite.clave, tipoTramite.tipoTramiteId);
      await tx.permiso.create({
        data: {
          tipoTramiteId: tipoTramite.tipoTramiteId,
          loteId: lote.loteId,
          solicitanteId: titular.personaId,
          fallecidoId: fallecido.fallecidoId,
          folio: folioPermiso,
          fechaSolicitud: fechaTramite,
          usuarioRegistroId: admin.usuarioId,
          estado: "APROBADO",
          esDonacion,
        },
      });
      reporte.permisosCreados++;
    });
  }

  console.log("\n--- Reporte ---");
  console.log(reporte);
  if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, "reporte_terrazas.json"), JSON.stringify(reporte, null, 2), "utf-8");
  }
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
