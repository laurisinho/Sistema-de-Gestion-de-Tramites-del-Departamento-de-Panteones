// Activa Row Level Security en todas las tablas del esquema public.
//
// Motivo: Supabase concede SELECT a los roles `anon` y `authenticated` sobre lo
// que vive en `public`. Esos roles son los que atiende la API REST del proyecto
// (PostgREST) y la llave `anon` es publicable, no un secreto. Con RLS apagado,
// cualquiera con esa llave podría leer tablas completas (`fallecidos`,
// `personas`, `usuarios`). Con RLS activo y sin políticas, esos roles no ven
// ninguna fila.
//
// No afecta a la aplicación: la API se conecta con el rol `postgres`, que tiene
// rolbypassrls = true. Lo mismo aplica a `service_role` y a las migraciones de
// Prisma.
//
// Es idempotente y hay que volver a ejecutarlo al agregar tablas nuevas, porque
// las migraciones de Prisma las crean con RLS apagado. Solo aplica a Supabase.
//
// Uso: npx tsx scripts/habilitar-rls.ts [--dry-run]

import "../src/lib/bigint-json";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

interface EstadoTabla {
  tabla: string;
  rls: boolean;
}

async function estado(): Promise<EstadoTabla[]> {
  return prisma.$queryRawUnsafe<EstadoTabla[]>(`
    select c.relname as tabla, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
}

async function main() {
  const antes = await estado();
  const apagadas = antes.filter((t) => !t.rls);

  console.log(`Tablas en public: ${antes.length} | con RLS: ${antes.length - apagadas.length}`);
  if (apagadas.length === 0) {
    console.log("Todas ya tienen RLS. Nada que hacer.");
    return;
  }
  console.log(`${dryRun ? "[dry-run] " : ""}Se enciende RLS en: ${apagadas.map((t) => t.tabla).join(", ")}`);
  if (dryRun) return;

  // No se usa FORCE ROW LEVEL SECURITY: aplicaría las políticas también al dueño
  // de la tabla y la API perdería acceso.
  for (const t of apagadas) {
    await prisma.$executeRawUnsafe(`alter table public."${t.tabla}" enable row level security`);
  }

  const despues = await estado();
  const faltan = despues.filter((t) => !t.rls);
  console.log(`\nResultado: ${despues.filter((t) => t.rls).length}/${despues.length} tablas con RLS.`);
  if (faltan.length > 0) {
    console.error("ATENCION, quedaron sin RLS:", faltan.map((t) => t.tabla).join(", "));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
