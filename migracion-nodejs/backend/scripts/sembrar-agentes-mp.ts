// Precarga el catálogo de Agentes del Ministerio Público (Administración >
// Catálogos) con los nombres que ya están capturados como texto libre en
// Fallecidos y Reconocimientos -- sin esto, la pantalla de administración
// arrancaba vacía aunque el selector ya sugiriera 16 nombres. No modifica
// ningún registro histórico; solo llena la tabla nueva. Idempotente.
//
// Uso: npx tsx scripts/sembrar-agentes-mp.ts [--dry-run]

import { PrismaClient } from "@prisma/client";
import { normalizarAgenteMp } from "../src/lib/agentesMp";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const [deFallecidos, deReconocimientos, existentes] = await Promise.all([
    prisma.fallecido.findMany({ where: { ministerioPublico: { not: null } }, select: { ministerioPublico: true }, distinct: ["ministerioPublico"] }),
    prisma.reconocimiento.findMany({ where: { ministerioPublico: { not: null } }, select: { ministerioPublico: true }, distinct: ["ministerioPublico"] }),
    prisma.agenteMinisterioPublico.findMany({ select: { nombre: true } }),
  ]);

  const yaExiste = new Set(existentes.map((a) => a.nombre.toUpperCase()));
  const nuevos = new Map<string, string>();
  for (const f of [...deFallecidos.map((x) => x.ministerioPublico!), ...deReconocimientos.map((x) => x.ministerioPublico!)]) {
    const nombre = normalizarAgenteMp(f);
    if (!nombre) continue;
    const clave = nombre.toUpperCase();
    if (!yaExiste.has(clave) && !nuevos.has(clave)) nuevos.set(clave, nombre);
  }

  console.log(`${dryRun ? "[dry-run] " : ""}${nuevos.size} agente(s) por dar de alta:`);
  for (const n of nuevos.values()) console.log(`   ${n}`);
  if (nuevos.size === 0 || dryRun) return;

  const r = await prisma.agenteMinisterioPublico.createMany({ data: [...nuevos.values()].map((nombre) => ({ nombre })), skipDuplicates: true });
  console.log(`\nCreados: ${r.count}`);
}

main()
  .catch((err) => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
