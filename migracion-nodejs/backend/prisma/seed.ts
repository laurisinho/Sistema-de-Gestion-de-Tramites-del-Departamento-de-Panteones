// Datos mínimos para una instalación nueva (base vacía): roles, tipos de
// trámite, tipos de lote, los 8 panteones y el usuario "admin".
// Es idempotente: se puede ejecutar más de una vez sin duplicar datos.
//
// No ejecutarlo si se va a restaurar un respaldo con datos reales
// (deploy/importar-datos.sh): el respaldo ya incluye todo esto y chocaría.
//
//   npm run prisma:seed
//   ADMIN_PASSWORD='...' npm run prisma:seed   (para elegir la contraseña)
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
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
      { clave: "SEP", nombre: "Sepultura", descripcion: "Permiso para inhumación de restos en lote asignado" },
      { clave: "EXH", nombre: "Exhumación", descripcion: "Permiso para exhumación de restos con motivo y destino declarado" },
      { clave: "CEN", nombre: "Depósito de Cenizas", descripcion: "Permiso para depósito de cenizas en ubicación designada" },
      { clave: "CON", nombre: "Construcción", descripcion: "Permiso para construcción o modificación de monumento en lote" },
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

  // upsert en lugar de createMany + skipDuplicates: sin @unique en `clave` no
  // había forma de detectar duplicados al correr el seed varias veces.
  // El Jardín de los Cipreses son dos panteones (Jardines y Monumentos) con
  // numeración de manzana independiente.
  const panteones = [
    { nombre: "Jardines del Edén", clave: "PJE", usaColindancias: false, direccion: "Carretera Internacional" },
    { nombre: "Agua Zarca", clave: "PAZ", usaColindancias: false, direccion: "Fraccionamiento La Mesa" },
    { nombre: "De los Héroes", clave: "PH", usaColindancias: true, direccion: "Calle Héroes" },
    { nombre: "Del Rosario", clave: "PR", usaColindancias: true, direccion: "Reforma e Independencia" },
    { nombre: "Nacional", clave: "PN", usaColindancias: true, direccion: "Calle Reforma Final" },
    { nombre: "Nacional Anexo", clave: "PNA", usaColindancias: true, direccion: "Calle Reforma Final" },
    { nombre: "Jardín de los Cipreses - Jardines", clave: "PC", usaColindancias: false, direccion: "Calle Reforma Final" },
    { nombre: "Jardín de los Cipreses - Monumentos", clave: "PCM", usaColindancias: false, direccion: "Calle Reforma Final" },
  ];
  for (const p of panteones) {
    await prisma.panteon.upsert({ where: { clave: p.clave }, update: {}, create: p });
  }

  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { nombre: "Administrador" } });
  const yaExiste = await prisma.usuario.findUnique({ where: { nombreUsuario: "admin" } });

  if (yaExiste) {
    console.log('El usuario "admin" ya existe: no se toca su contraseña.');
  } else {
    // No hay contraseña por defecto: se toma de ADMIN_PASSWORD o se genera una al
    // azar que se muestra una sola vez.
    const elegida = process.env.ADMIN_PASSWORD?.trim();
    if (elegida && elegida.length < 8) throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
    const contrasena = elegida || randomBytes(12).toString("base64url");

    await prisma.usuario.create({
      data: {
        rolId: rolAdmin.rolId,
        nombreUsuario: "admin",
        nombreCompleto: "Administrador del Sistema",
        email: "panteones@nogales.gob.mx",
        passwordHash: await bcrypt.hash(contrasena, 12),
      },
    });

    console.log("");
    console.log('Usuario "admin" creado.');
    if (!elegida) {
      console.log(`   Contraseña generada: ${contrasena}`);
      console.log("   Guárdala ahora: no se vuelve a mostrar. Cámbiala desde Administración > Usuarios.");
    } else {
      console.log("   Con la contraseña indicada en ADMIN_PASSWORD.");
    }
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
