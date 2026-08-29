// Equivalente a los INSERT semilla de schema_postgres.sql, para usarse con
// `npm run prisma:seed` después de `prisma migrate dev` (flujo estándar de Prisma,
// en vez de correr el .sql a mano).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.rol.createMany({
    data: [
      { nombre: "Administrador", descripcion: "Configuración global, gestión de usuarios, acceso a bitácoras y reportes" },
      { nombre: "Capturista", descripcion: "Registro de trámites, emisión de permisos y generación de documentos" },
      { nombre: "Consulta", descripcion: "Visualización y descarga de expedientes sin posibilidad de edición" },
      { nombre: "Supervisión", descripcion: "Aprobación de títulos, cesiones y permisos antes de su emisión oficial" },
    ],
    skipDuplicates: true,
  });

  await prisma.tipoTramite.createMany({
    data: [
      { clave: "SEP", nombre: "Sepultura", descripcion: "Permiso para inhumación de restos en lote asignado", retencionAnios: 10 },
      { clave: "EXH", nombre: "Exhumación", descripcion: "Permiso para exhumación de restos con motivo y destino declarado", retencionAnios: 10 },
      { clave: "CEN", nombre: "Depósito de Cenizas", descripcion: "Permiso para depósito de cenizas en ubicación designada", retencionAnios: 10 },
      { clave: "CON", nombre: "Construcción", descripcion: "Permiso para construcción o modificación de monumento en lote", retencionAnios: 10 },
      { clave: "TIT", nombre: "Título de Propiedad", descripcion: "Emisión de título de propiedad de lote o nicho" },
      { clave: "CES", nombre: "Cesión de Derechos", descripcion: "Transferencia de titularidad de lote o nicho entre particulares" },
    ],
    skipDuplicates: true,
  });

  await prisma.tipoLote.createMany({
    data: [
      { nombre: "Lote", descripcion: "Lote de tierra para inhumación directa" },
      { nombre: "Nicho", descripcion: "Nicho en muro o estructura de mampostería" },
      { nombre: "Cripta", descripcion: "Cripta familiar de uso múltiple" },
    ],
    skipDuplicates: true,
  });

  // upsert en vez de createMany+skipDuplicates: antes de agregar @unique a
  // `clave`, correr el seed dos veces dejó panteones duplicados en Supabase
  // porque no había ninguna restricción contra la que Prisma pudiera detectarlos.
  const panteones = [
    { nombre: "Jardines del Edén", clave: "PJE", usaColindancias: false, direccion: "Carretera Internacional" },
    { nombre: "Agua Zarca", clave: "PAZ", usaColindancias: false, direccion: "Fraccionamiento La Mesa" },
    { nombre: "De los Héroes", clave: "PH", usaColindancias: true, direccion: "Calle Héroes" },
    { nombre: "Del Rosario", clave: "PR", usaColindancias: true, direccion: "Reforma e Independencia" },
    { nombre: "Nacional", clave: "PN", usaColindancias: true, direccion: "Calle Reforma Final" },
    { nombre: "Nacional Anexo", clave: "PNA", usaColindancias: true, direccion: "Calle Reforma Final" },
    { nombre: "Jardín de los Cipreses - Jardines y Monumentos", clave: "PC", usaColindancias: false, direccion: "Calle Reforma Final" },
  ];
  for (const p of panteones) {
    await prisma.panteon.upsert({ where: { clave: p.clave }, update: {}, create: p });
  }

  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { nombre: "Administrador" } });

  await prisma.usuario.upsert({
    where: { nombreUsuario: "admin" },
    update: {},
    create: {
      rolId: rolAdmin.rolId,
      nombreUsuario: "admin",
      nombreCompleto: "Administrador del Sistema",
      email: "panteones@nogales.gob.mx",
      // Mismo hash bcrypt del seed .NET (contraseña: Admin2026) — portable sin cambios.
      passwordHash: "$2b$12$i6Ulmy7m9B5FdA7eVTQbX.vDhUDNOIxYWD1NLZ9RmbPt34EH.xr32",
    },
  });

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
