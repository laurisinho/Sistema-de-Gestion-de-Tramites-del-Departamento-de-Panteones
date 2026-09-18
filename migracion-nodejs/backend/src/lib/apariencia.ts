import { prisma } from "./prisma";
import { LOGO_NOGALES, LOGO_FRONTERA } from "./logos";

export interface AparienciaDocumento {
  logoNogales: string;
  logoFrontera: string;
  sindico: string;
}

const SINDICO_DEFECTO = "MAESTRA EDNA ELINORA SOTO GRACIA";

function aDataUri(bytes: Uint8Array | null): string | null {
  return bytes ? `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` : null;
}

// Cache en memoria del proceso: los títulos/permisos/cesiones se generan
// mucho más seguido que lo que Administración cambia el logo o el síndico,
// así que no tiene caso ir a la base en cada PDF/Excel. invalidarCache() se
// llama justo después de cada PUT en administracion.routes.ts para que el
// mismo proceso vea el cambio de inmediato, sin reiniciar el servidor.
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
  };
  return cache;
}

// Para prepararHoja() en excel.ts, que necesita el Buffer crudo (ExcelJS no
// acepta data URIs), no el string base64 que sí usan las plantillas de PDF.
export async function obtenerLogosBuffer(): Promise<{ nogales: Buffer; frontera: Buffer }> {
  const config = await prisma.configuracionApariencia.findUnique({ where: { id: 1 } });
  const deDataUri = (uri: string) => Buffer.from(uri.split(",")[1], "base64");
  return {
    nogales: config?.logoNogales ? Buffer.from(config.logoNogales) : deDataUri(LOGO_NOGALES),
    frontera: config?.logoFrontera ? Buffer.from(config.logoFrontera) : deDataUri(LOGO_FRONTERA),
  };
}
