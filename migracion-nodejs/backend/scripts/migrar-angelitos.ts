// Importa los 4 registros de la sección ANGELITOS (Jardines del Edén) que
// quedaron fuera de la migración original, desde la hoja "ANGELITOS" de
// "BASE DE DATOS JARDINES DEL EDEN MARZO 2023 - copia.xlsb".
//
// Verificado antes de correr esto contra la base:
//   - PJE-ANG-58, 59 y 60 no existen (la numeración de la BD llega al 57):
//     se crean lote + titular + título + fallecido + permiso de sepultura.
//   - PJE-ANG-22-A YA existe como lote pero sin titular: NO se vuelve a crear
//     el lote, solo se le agrega el título. Su "difunto" dice LOTE DE RESERVA,
//     así que no lleva permiso -- nadie está sepultado ahí.
//
// Sigue el mismo camino que un capturista real con la app (folio de título =
// claveLegado, folio de permiso secuencial SEP-000N, estados
// OCUPADO/VIGENTE/APROBADO), igual que scripts/migrar-terrazas.ts.
//
// Uso: npx tsx scripts/migrar-angelitos.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface FilaAngelitos {
  clave: string;
  nombre: string | null;
  direccion: string | null;
  numero: string | null;
  colonia: string | null;
  telefono: string | null;
  seccion: string | null;
  manzana: string | null;
  lote: string;
  fecha: number | null;
  estatus: string | null;
  difunto: string | null;
}

function excelFechaAUTC(serial: number | null): Date | null {
  if (!serial) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

function limpio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

// "LOTE DE RESERVA" no es una persona sepultada: es un lote vendido y vacío.
function esDifuntoReal(nombre: string | null): boolean {
  if (!nombre) return false;
  const n = nombre.trim().toUpperCase();
  return n !== "" && !/^LOTE\s+(DE\s+RESERVA|VACIO)$/.test(n);
}

function domicilioCompleto(f: FilaAngelitos): string | null {
  return limpio([limpio(f.direccion), limpio(f.numero)].filter(Boolean).join(" "));
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
  const filas: FilaAngelitos[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "_ang4_raw.json"), "utf-8")
  );

  const panteon = await prisma.panteon.findFirstOrThrow({ where: { clave: "PJE" } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { nombreUsuario: "admin" } });
  const tipoSep = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "SEP" } });
  const tipoLote = await prisma.tipoLote.findFirstOrThrow({ where: { nombre: "Lote" } });

  const reporte = {
    lotesCreados: 0,
    lotesReutilizados: 0,
    titulosCreados: 0,
    permisosCreados: 0,
    omitidos: [] as { clave: string; motivo: string }[],
  };

  for (const f of filas) {
    const clave = limpio(f.clave);
    if (!clave) continue;

    const nombreTitular = limpio(f.nombre);
    if (!nombreTitular) {
      reporte.omitidos.push({ clave, motivo: "sin titular" });
      continue;
    }

    // Búsqueda tolerante: en la base la clave puede estar como "PJE-ANG-22-A"
    // mientras el Excel la escribe "PJE-ANG-22A".
    const sinSeparadores = clave.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const candidatos = await prisma.lote.findMany({
      where: { panteonId: panteon.panteonId, claveLegado: { startsWith: "PJE-ANG" } },
      include: { titulos: true },
    });
    const existente = candidatos.find(
      (l) => (l.claveLegado ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() === sinSeparadores
    );

    if (existente && existente.titulos.length > 0) {
      reporte.omitidos.push({ clave, motivo: "el lote ya tiene título" });
      console.log(`${dryRun ? "[dry-run] " : ""}${clave} -> OMITIDO (ya tiene título)`);
      continue;
    }

    const fechaTramite = excelFechaAUTC(f.fecha);
    const difunto = limpio(f.difunto);
    const conDifunto = esDifuntoReal(difunto);
    const accion = existente ? "reutiliza lote existente" : "crea lote nuevo";

    console.log(
      `${dryRun ? "[dry-run] " : ""}${clave} -> ${accion}; titular: ${nombreTitular}` +
        `; ${conDifunto ? `permiso SEP para ${difunto}` : "sin permiso (lote de reserva)"}` +
        `; fecha: ${fechaTramite?.toISOString().slice(0, 10) ?? "—"}`
    );

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      let loteId: number;
      if (existente) {
        await tx.lote.update({ where: { loteId: existente.loteId }, data: { estado: "OCUPADO" } });
        loteId = existente.loteId;
        reporte.lotesReutilizados++;
      } else {
        const lote = await tx.lote.create({
          data: {
            panteonId: panteon.panteonId,
            tipoLoteId: tipoLote.tipoLoteId,
            numeroManzana: limpio(f.manzana) ?? "ANGELITOS",
            numeroLote: f.lote.trim(),
            seccion: limpio(f.seccion) ?? "ADEII",
            dimensiones: "1.50 m de frente por 2.50 m de largo",
            claveLegado: clave,
            estado: "OCUPADO",
          },
        });
        loteId = lote.loteId;
        reporte.lotesCreados++;
      }

      const titular = await tx.persona.create({
        data: {
          nombreCompleto: nombreTitular,
          domicilio: domicilioCompleto(f),
          colonia: limpio(f.colonia),
          telefono: limpio(f.telefono),
        },
      });

      await tx.tituloPropiedad.create({
        data: {
          loteId,
          titularId: titular.personaId,
          folio: clave,
          fechaEmision: fechaTramite,
          usuarioEmitioId: admin.usuarioId,
          estado: "VIGENTE",
          estadoEntrega: "PENDIENTE_ENTREGA",
        },
      });
      reporte.titulosCreados++;

      if (!conDifunto) return;

      const fallecido = await tx.fallecido.create({ data: { nombreCompleto: difunto! } });
      const folioPermiso = await generarFolioPermiso(tipoSep.clave, tipoSep.tipoTramiteId);
      await tx.permiso.create({
        data: {
          tipoTramiteId: tipoSep.tipoTramiteId,
          loteId,
          solicitanteId: titular.personaId,
          fallecidoId: fallecido.fallecidoId,
          folio: folioPermiso,
          fechaSolicitud: fechaTramite,
          usuarioRegistroId: admin.usuarioId,
          estado: "APROBADO",
          esDonacion: false,
        },
      });
      reporte.permisosCreados++;
    });
  }

  console.log("\n--- Reporte ---");
  console.log(reporte);
  if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, "reporte_angelitos.json"), JSON.stringify(reporte, null, 2), "utf-8");
  }
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
