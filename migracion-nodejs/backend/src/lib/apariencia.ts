import { prisma } from "./prisma";
import { LOGO_NOGALES, LOGO_FRONTERA } from "./logos";

export interface AparienciaDocumento {
  logoNogales: string;
  logoFrontera: string;
  sindico: string;
  /** Color de marca elegido en Administración > Apariencia. */
  guinda: string;
}

const SINDICO_DEFECTO = "MAESTRA EDNA ELINORA SOTO GRACIA";
const GUINDA_DEFECTO = "#6B1229";
const HEX = /^#[0-9a-fA-F]{6}$/;

// Se valida aquí también (no solo al guardarlo) porque el valor se interpola en
// el CSS de los documentos.
function color(valor: string | undefined, porDefecto: string): string {
  return HEX.test(valor ?? "") ? valor! : porDefecto;
}

function aDataUri(bytes: Uint8Array | null): string | null {
  return bytes ? `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` : null;
}

// Caché en memoria del proceso. Los documentos se generan con mucha más
// frecuencia de lo que cambian los logos o el síndico. Se invalida tras cada
// cambio hecho en administracion.routes.ts.
let cache: AparienciaDocumento | null = null;

export function invalidarCacheApariencia(): void {
  cache = null;
}

export async function obtenerAparienciaDocumento(): Promise<AparienciaDocumento> {
  if (cache) return cache;

  const config = await prisma.configuracionApariencia.findUnique({ where: { id: 1 } });
  cache = {
    logoNogales: aDataUri(config?.logoNogales ?? null) ?? LOGO_NOGALES,
    logoFrontera: aDataUri(config?.logoFrontera ?? null) ?? LOGO_FRONTERA,
    sindico: config?.nombreSindico?.trim() || SINDICO_DEFECTO,
    guinda: color(config?.colorGuinda, GUINDA_DEFECTO),
  };
  return cache;
}

// Para prepararHoja() en excel.ts, que necesita el Buffer (ExcelJS no acepta
// data URIs) y no el base64 que usan las plantillas de PDF.
export async function obtenerLogosBuffer(): Promise<{ nogales: Buffer; frontera: Buffer }> {
  const config = await prisma.configuracionApariencia.findUnique({ where: { id: 1 } });
  const deDataUri = (uri: string) => Buffer.from(uri.split(",")[1], "base64");
  return {
    nogales: config?.logoNogales ? Buffer.from(config.logoNogales) : deDataUri(LOGO_NOGALES),
    frontera: config?.logoFrontera ? Buffer.from(config.logoFrontera) : deDataUri(LOGO_FRONTERA),
  };
}
